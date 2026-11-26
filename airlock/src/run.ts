/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { injectedCalls } from "./inject";
import { fitsSchema, isTrusted, join, onList, recipients, TOOLS, TRUSTED_REQUEST, type Expr, type Label, type Schema, type Step, type ToolName, type Val, type World } from "./model";

/** The rules of the monitor. Every rule can be switched off in the lab, so you can watch the prover find the hole. */
export type Policy = {
  /** Values from untrusted data may only decide an action after you said yes. */
  askUntrusted: boolean;
  /** Destinations from untrusted data that are not on your lists are refused outright. */
  blockUnknown: boolean;
  /** Lists match character for character (no lookalike letters). */
  exact: boolean;
  /** Data only goes to people allowed to read it. */
  readers: boolean;
  /** The planner never sees untrusted text, so it cannot be talked into extra steps. */
  isolated: boolean;
};

export const STRICT: Policy = { askUntrusted: true, blockUnknown: true, exact: true, readers: true, isolated: true };
export const POLICY_KEYS: (keyof Policy)[] = ["isolated", "askUntrusted", "blockUnknown", "exact", "readers"];

export type Reason =
  | { code: "control-untrusted"; arg: string; value: string; listed: boolean }
  | { code: "control-unknown"; arg: string; value: string }
  | { code: "leak"; arg: string; recipient: string; readers: string[] }
  | { code: "bad-output"; schema: Schema; value: string }
  | { code: "missing"; name: string };

export type Status = "run" | "ask" | "block" | "stop";
export type Harm = "injected" | "attacker-destination" | "attacker-amount" | "leak";

export type Entry = {
  /** Plan step, or null for a call the injected text added. */
  step: number | null;
  tool: ToolName | "extract";
  args: Record<string, Val>;
  status: Status;
  reasons: Reason[];
  injected: boolean;
  via?: string;
  harm: Harm[];
  /** Identifies this call for an approval. */
  key: string;
  node: string;
};

export type GraphNode = { id: string; kind: "request" | "email" | "page" | "file" | "value" | "call"; label: string; status?: Status; injected?: boolean; untrusted?: boolean; private?: boolean };
export type GraphEdge = { from: string; to: string; tone: "trusted" | "untrusted" | "private"; blocked: boolean };

export type Scenario = {
  id: string;
  world: World;
  plan: Step[];
  /** The document the attacker writes: an email id or a page url. */
  target: { kind: "email" | "page"; id: string };
  /** What the real document says, for each extraction; anything else came from the attacker. */
  legit: Record<string, string>;
};

/** What the attacker controls: the text of their document, and what the model that reads it returns. */
export type Attack = { text: string; reader: Record<string, string> };

export type RunResult = { entries: Entry[]; nodes: GraphNode[]; edges: GraphEdge[]; harms: number };

const toneOf = (l: Label): GraphEdge["tone"] => (!isTrusted(l) ? "untrusted" : l.readers ? "private" : "trusted");

/** The monitor: one function every tool call passes through, no matter who asked for it. */
export function check(tool: ToolName, args: Record<string, Val>, world: World, policy: Policy): { status: Status; reasons: Reason[] } {
  const reasons: Reason[] = [];
  let status: Status = "run";
  const worst = (s: Status) => {
    if (s === "block" || (s === "ask" && status === "run")) status = s;
  };
  for (const name of TOOLS[tool].control) {
    const val = args[name];
    if (!val || isTrusted(val.label)) continue;
    const listed = onList(tool, name, val.v, world, policy.exact);
    if (!listed && policy.blockUnknown && name !== "amount") {
      reasons.push({ code: "control-unknown", arg: name, value: val.v });
      worst("block");
    } else if (policy.askUntrusted) {
      reasons.push({ code: "control-untrusted", arg: name, value: val.v, listed });
      worst("ask");
    }
  }
  if (policy.readers) {
    const to = recipients(tool, args, world);
    for (const [name, val] of Object.entries(args)) {
      const readers = val.label.readers;
      if (readers === null) continue;
      for (const r of to === "anyone" ? ["anyone"] : to)
        if (!readers.includes(r)) {
          reasons.push({ code: "leak", arg: name, recipient: r, readers });
          worst("block");
        }
    }
  }
  return { status, reasons };
}

/** Objective damage of a call that actually ran, independent of the policy in force. */
function harmOf(entry: Entry, scenario: Scenario, world: World): Harm[] {
  if (entry.tool === "extract" || entry.status !== "run") return [];
  const tool = entry.tool;
  const out: Harm[] = [];
  if (entry.injected) out.push("injected");
  for (const name of TOOLS[tool].control) {
    const val = entry.args[name];
    if (!val || isTrusted(val.label)) continue;
    if (name === "amount") {
      if (Object.values(scenario.legit).every((l) => l !== val.v)) out.push("attacker-amount");
    } else if (!onList(tool, name, val.v, world, true)) out.push("attacker-destination");
  }
  const to = recipients(tool, entry.args, world);
  for (const val of Object.values(entry.args)) {
    if (val.label.readers === null) continue;
    if ((to === "anyone" ? ["anyone"] : to).some((r) => !val.label.readers!.includes(r))) {
      out.push("leak");
      break;
    }
  }
  return out;
}

export type RunOptions = { mode: "airlock" | "naive"; policy?: Policy; approvals?: ReadonlySet<string> };

/**
 * Runs the plan. "naive" is the ordinary agent: one model that reads everything and obeys what it reads,
 * with no monitor. "airlock" runs the same plan behind the monitor, with the planner isolated (unless switched off).
 */
export function runAgent(scenario: Scenario, attack: Attack, options: RunOptions): RunResult {
  const policy = options.mode === "naive" ? { ...STRICT, isolated: false } : (options.policy ?? STRICT);
  const world: World = structuredClone(scenario.world);
  if (scenario.target.kind === "email") world.emails[scenario.target.id] = { ...world.emails[scenario.target.id], text: attack.text };
  else world.pages[scenario.target.id] = attack.text;

  const env: Record<string, Val> = {};
  const entries: Entry[] = [];
  const nodes = new Map<string, GraphNode>([["request", { id: "request", kind: "request", label: "request" }]]);
  const edges: GraphEdge[] = [];
  const contextFiles: Val[] = [];

  const evalExpr = (e: Expr): Val | null => ("lit" in e ? { v: e.lit, label: TRUSTED_REQUEST, deps: ["request"] } : "me" in e ? { v: world.me, label: TRUSTED_REQUEST, deps: ["request"] } : (env[e.var] ?? null));

  const attempt = (tool: ToolName, args: Record<string, Val>, step: number | null, injected: boolean, via?: string): Val | null => {
    const key = `${step ?? "x"}:${tool}:${TOOLS[tool].control.map((c) => args[c]?.v ?? "").join("|")}`;
    const verdict = options.mode === "naive" ? { status: "run" as Status, reasons: check(tool, args, world, STRICT).reasons } : check(tool, args, world, policy);
    let status = verdict.status;
    if (status === "ask" && options.approvals?.has(key)) status = "run";
    const node = `call:${entries.length}`;
    const entry: Entry = { step, tool, args, status, reasons: verdict.reasons, injected, via, harm: [], key, node };
    entry.harm = harmOf(entry, scenario, world);
    entries.push(entry);
    const isRead = tool === "read_email" || tool === "read_file";
    if (!isRead) {
      nodes.set(node, { id: node, kind: "call", label: tool, status, injected });
      for (const val of Object.values(args)) for (const d of val.deps) edges.push({ from: d, to: node, tone: toneOf(val.label), blocked: status !== "run" });
    }
    if (status !== "run") return null;

    if (tool === "read_email") {
      const id = args.id.v;
      const mail = world.emails[id];
      if (!mail) return null;
      const nid = `email:${id}`;
      nodes.set(nid, { id: nid, kind: "email", label: mail.subject, untrusted: true });
      return { v: mail.text, label: { sources: [`untrusted:email:${id}`], readers: null }, deps: [nid] };
    }
    if (tool === "read_file") {
      const name = args.name.v;
      const file = world.files[name];
      if (!file) return null;
      const nid = `file:${name}`;
      nodes.set(nid, { id: nid, kind: "file", label: name, private: true });
      const val = { v: file.text, label: { sources: ["files"], readers: [...file.readers] }, deps: [nid] };
      contextFiles.push(val);
      return val;
    }
    if (tool === "fetch") {
      const url = args.url.v;
      if (!(url in world.pages)) return null;
      const nid = `page:${url}`;
      nodes.set(nid, { id: nid, kind: "page", label: url, untrusted: true });
      edges.push({ from: node, to: nid, tone: "untrusted", blocked: false });
      return { v: world.pages[url], label: { sources: [`untrusted:page:${url}`], readers: null }, deps: [nid] };
    }
    return null;
  };

  /** The ordinary agent, or a non-isolated planner, acts on what the text tells it. */
  const obey = (content: Val, step: number) => {
    for (const c of injectedCalls(content.v, world)) {
      const files: Val[] = c.attach.filter((name) => world.files[name]).map((name) => ({ v: world.files[name].text, label: { sources: ["files"], readers: [...world.files[name].readers] }, deps: [`file:${name}`] }));
      for (const name of c.attach) if (world.files[name]) nodes.set(`file:${name}`, { id: `file:${name}`, kind: "file", label: name, private: true });
      const attacker = (v: string): Val => ({ v, label: content.label, deps: content.deps });
      const args: Record<string, Val> = {};
      for (const [k, v] of Object.entries(c.args)) args[k] = attacker(v);
      if (files.length) {
        const payload: Val = { v: files.map((f) => f.v).join("\n"), label: join(content.label, ...files.map((f) => f.label)), deps: [...content.deps, ...files.flatMap((f) => f.deps)] };
        if (c.tool === "fetch") args.url = { ...payload, v: `${c.args.url}${c.args.url.includes("?") ? "&" : "?"}d=${encodeURIComponent(payload.v.slice(0, 80))}` };
        else if (c.tool === "post_message") args.text = payload;
        else if (c.tool === "send_email") args.body = payload;
      } else if (c.tool === "send_email" && !args.body) args.body = attacker("(forwarded)");
      if (c.tool === "pay" && !args.reference) args.reference = attacker("invoice");
      attempt(c.tool, args, null, true, c.via);
    }
    void step;
  };

  for (let i = 0; i < scenario.plan.length; i++) {
    const step = scenario.plan[i];
    if (step.kind === "extract") {
      const src = env[step.from];
      if (!src) {
        entries.push({ step: i, tool: "extract", args: {}, status: "stop", reasons: [{ code: "missing", name: step.from }], injected: false, harm: [], key: "", node: "" });
        break;
      }
      const out = attack.reader[step.bind] ?? "";
      const nid = `value:${step.bind}`;
      if (!fitsSchema(step.schema, out)) {
        entries.push({ step: i, tool: "extract", args: { [step.bind]: { v: out, label: src.label, deps: src.deps } }, status: "stop", reasons: [{ code: "bad-output", schema: step.schema, value: out }], injected: false, harm: [], key: "", node: nid });
        break;
      }
      env[step.bind] = { v: out, label: { ...src.label }, deps: [nid] };
      nodes.set(nid, { id: nid, kind: "value", label: step.bind, untrusted: !isTrusted(src.label), private: !!src.label.readers });
      for (const d of src.deps) edges.push({ from: d, to: nid, tone: toneOf(src.label), blocked: false });
      entries.push({ step: i, tool: "extract", args: { [step.bind]: env[step.bind] }, status: "run", reasons: [], injected: false, harm: [], key: "", node: nid });
      continue;
    }
    const args: Record<string, Val> = {};
    let missing: string | null = null;
    for (const [k, e] of Object.entries(step.args)) {
      const v = evalExpr(e);
      if (v) args[k] = v;
      else missing = "var" in e ? e.var : k;
    }
    if (missing) {
      entries.push({ step: i, tool: step.tool, args, status: "stop", reasons: [{ code: "missing", name: missing }], injected: false, harm: [], key: "", node: "" });
      break;
    }
    const result = attempt(step.tool, args, i, false);
    if (result && step.bind) env[step.bind] = result;
    if (result && !isTrusted(result.label) && (options.mode === "naive" || !policy.isolated)) obey(result, i);
  }
  void contextFiles;

  return { entries, nodes: [...nodes.values()], edges, harms: entries.reduce((n, e) => n + (e.harm.length ? 1 : 0), 0) };
}

/** The tool calls a run tried, with the arguments you chose; untrusted values are left out on purpose. */
export function signature(run: RunResult): string[] {
  return run.entries.filter((e) => e.tool !== "extract").map((e) => `${e.tool}(${Object.entries(e.args).filter(([, v]) => isTrusted(v.label)).map(([k, v]) => `${k}=${v.v}`).join(",")})`);
}
