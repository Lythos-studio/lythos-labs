/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { reveal } from "./inject";
import { lenient, shown } from "./model";

/**
 * Airlock for tool servers (for example an MCP server), without help from the client.
 *
 * The server cannot see the agent's planner, but it does see every tool result it hands out.
 * The guard remembers which results were written by strangers (an email, a web page) and which were
 * private (with their readers). On every later call it checks:
 * - a deciding argument (recipient, account, link) that appears in text from a stranger was chosen by that stranger:
 *   refused, or only after the user approves when it is on the user's list;
 * - private text that shows up in an argument may only go to its readers.
 *
 * It is a value check, so it catches values copied from untrusted text (the way an injected address or IBAN
 * reaches a tool), not values the model rewrote first. For actions where that matters, set `listedOnly`.
 */

export type GuardVerdict = { status: "run" | "ask" | "block"; reasons: GuardReason[] };
export type GuardReason =
  | { code: "from-untrusted"; arg: string; value: string; listed: boolean }
  | { code: "not-listed"; arg: string; value: string }
  | { code: "leak"; arg: string; recipient: string; readers: string[] }
  | { code: "always-ask" };

export type ToolPolicy = {
  /** Results of this tool are written by others (email, web page, ticket, issue). */
  untrustedOutput?: boolean;
  /** Results of this tool are private; who may read them. Return null for "anyone". */
  outputReaders?: (args: Record<string, unknown>, text: string) => string[] | null;
  /** Arguments that decide who receives something, which account, how much, or what is loaded. */
  control?: string[];
  /** Who receives the data of this call. */
  recipients?: (args: Record<string, unknown>) => string[] | "anyone";
  /** The user's own list for a deciding argument (contacts, payees, allowed sites). */
  listed?: Record<string, (value: string) => boolean>;
  /** Deciding arguments that must always be on the list, wherever they came from (payments, for example). */
  listedOnly?: string[];
  /** Always ask the user before this tool runs (payments, deletions), even when nothing looks wrong. */
  alwaysAsk?: boolean;
};

export type GuardEvent = { tool: string; args: Record<string, unknown>; verdict: GuardVerdict; approved?: boolean };

export type GuardOptions = {
  tools: Record<string, ToolPolicy>;
  /**
   * Ask the user. Return true only on a clear yes from a person, and "unavailable" when there is no way to ask.
   * Without this, every question is refused.
   */
  confirm?: (question: { tool: string; args: Record<string, unknown>; reasons: GuardReason[] }) => Promise<boolean | "unavailable">;
  /** Called for every decision, for an audit log. */
  onDecision?: (event: GuardEvent) => void;
  /** Memory per session, in characters; oldest text is forgotten first. */
  memory?: number;
};

const SHINGLE = 24;

/** Same normalisation for stored text and arguments: case, width, spacing and lookalike letters do not matter. */
const norm = (s: string) => lenient(s);

const strings = (v: unknown): string[] =>
  typeof v === "string" ? [v] : typeof v === "number" ? [String(v)] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === "object" ? Object.values(v).flatMap(strings) : [];

/** Text of a tool result, whatever its shape (MCP results carry `content: [{ type: "text", text }]`). */
export function resultText(result: unknown): string {
  if (result && typeof result === "object" && Array.isArray((result as { content?: unknown }).content))
    return (result as { content: { type?: string; text?: string }[] }).content.map((c) => (c.type === "text" && typeof c.text === "string" ? c.text : "")).join("\n");
  return strings(result).join("\n");
}

export function createGuard(options: GuardOptions) {
  const limit = options.memory ?? 2_000_000;
  let untrusted: string[] = [];
  let untrustedSize = 0;
  /** Fingerprints of private text: every SHINGLE-character window, to the readers of that text. */
  const privateParts = new Map<string, string[] | null>();
  /** Private text shorter than one fingerprint (a token, a key): matched as a substring. */
  const privateShort: { text: string; readers: string[] }[] = [];

  const remember = (tool: string, args: Record<string, unknown>, text: string) => {
    const policy = options.tools[tool];
    if (!policy || !text) return;
    if (policy.untrustedOutput) {
      // Remember what a model reads, not what a person sees: hidden tag characters, comments and base64 included.
      const n = norm(reveal(text));
      untrusted.push(n);
      untrustedSize += n.length;
      while (untrustedSize > limit && untrusted.length > 1) untrustedSize -= untrusted.shift()!.length;
    }
    const readers = policy.outputReaders?.(args, text);
    if (readers) {
      const n = norm(text);
      if (n.length < SHINGLE) {
        if (n.length >= 6) privateShort.push({ text: n, readers });
      } else
        for (let i = 0; i + SHINGLE <= n.length; i += 4) privateParts.set(n.slice(i, i + SHINGLE), readers);
    }
  };

  const fromUntrusted = (value: string) => {
    const n = norm(value);
    return n.length >= 4 && untrusted.some((t) => t.includes(n));
  };

  const readersOf = (value: string): string[] | null => {
    const n = norm(value);
    let found: string[] | null = null;
    const take = (r: string[] | null | undefined) => {
      if (r === undefined || r === null) return;
      found = found === null ? [...r] : found.filter((x) => r.includes(x));
    };
    for (const p of privateShort) if (n.includes(p.text)) take(p.readers);
    for (let i = 0; i + SHINGLE <= n.length; i++) {
      const r = privateParts.get(n.slice(i, i + SHINGLE));
      if (r !== undefined) take(r);
    }
    return found;
  };

  /** Decides on one call, before it runs. */
  const check = (tool: string, args: Record<string, unknown>): GuardVerdict => {
    const policy = options.tools[tool] ?? {};
    const reasons: GuardReason[] = [];
    let status: GuardVerdict["status"] = "run";
    for (const name of policy.control ?? []) {
      for (const value of strings(args[name])) {
        const listed = policy.listed?.[name]?.(value) ?? false;
        if (policy.listedOnly?.includes(name) && !listed) {
          reasons.push({ code: "not-listed", arg: name, value: shown(value) });
          status = "block";
        } else if (fromUntrusted(value)) {
          reasons.push({ code: "from-untrusted", arg: name, value: shown(value), listed });
          if (!listed) status = "block";
          else if (status === "run") status = "ask";
        }
      }
    }
    const to = policy.recipients?.(args) ?? [];
    if (to === "anyone" || to.length) {
      for (const [name, v] of Object.entries(args))
        for (const value of strings(v)) {
          const readers = readersOf(value);
          if (!readers) continue;
          for (const r of to === "anyone" ? ["anyone"] : to)
            if (!readers.includes(r)) {
              reasons.push({ code: "leak", arg: name, recipient: shown(r), readers });
              status = "block";
            }
        }
    }
    if (policy.alwaysAsk && status === "run") {
      reasons.push({ code: "always-ask" });
      status = "ask";
    }
    return { status, reasons };
  };

  /**
   * Wraps a tool handler: checks the call, asks when needed, runs it, and remembers what it returned.
   * A refused call returns an error result that says why, so the agent can tell the user.
   */
  const wrap = <A extends Record<string, unknown>, E, R>(tool: string, handler: (args: A, extra: E) => Promise<R> | R) => {
    return async (args: A, extra: E): Promise<R | { content: { type: "text"; text: string }[]; isError: true }> => {
      const verdict = check(tool, args);
      let approved: boolean | undefined;
      let unavailable = false;
      if (verdict.status === "ask") {
        const answer = options.confirm ? await options.confirm({ tool, args, reasons: verdict.reasons }).catch(() => false as const) : "unavailable";
        approved = answer === true;
        unavailable = answer === "unavailable";
      }
      options.onDecision?.({ tool, args, verdict, approved });
      if (verdict.status === "block" || (verdict.status === "ask" && !approved)) {
        return { content: [{ type: "text", text: explain(tool, verdict, verdict.status === "ask" ? (unavailable ? "no-confirm" : "declined") : undefined) }], isError: true };
      }
      const result = await handler(args, extra);
      remember(tool, args, resultText(result));
      return result;
    };
  };

  return {
    check,
    wrap,
    /** Record a result by hand, for results that do not pass through `wrap`. */
    remember,
    reset() {
      untrusted = [];
      untrustedSize = 0;
      privateParts.clear();
      privateShort.length = 0;
    },
  };
}

export type Guard = ReturnType<typeof createGuard>;

/** Plain English for the agent and its logs; the agent should pass it on to the user. */
export function explain(tool: string, verdict: GuardVerdict, askOutcome?: "declined" | "no-confirm"): string {
  const lines = [`Airlock stopped ${tool}.`];
  for (const r of verdict.reasons) {
    if (r.code === "from-untrusted")
      lines.push(r.listed ? `"${r.value}" (${r.arg}) appears in text written by someone else. It is on the user's list, so the user has to approve.` : `"${r.value}" (${r.arg}) appears in text written by someone else and is not on the user's list. Refused.`);
    if (r.code === "not-listed") lines.push(`"${r.value}" (${r.arg}) is not on the user's list. Only listed values are allowed here.`);
    if (r.code === "leak") lines.push(`The ${r.arg} contains private data that only ${r.readers.join(", ")} may read, not ${r.recipient}. Refused.`);
    if (r.code === "always-ask") lines.push("This action always needs the user's approval.");
  }
  if (askOutcome === "declined") lines.push("The user did not approve.");
  if (askOutcome === "no-confirm") lines.push("This client cannot ask the user, so the action is refused. The user can add the value to their list, or use a client that supports confirmation.");
  lines.push("Do not retry with a changed value. Tell the user what happened.");
  return lines.join("\n");
}
