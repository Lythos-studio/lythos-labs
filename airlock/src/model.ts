/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Every value the agent handles carries a label: where it came from, and who may receive it.
 * Sources starting with "untrusted:" are text written by someone else (an email, a web page).
 */
export type Label = {
  sources: string[];
  /** Who may receive this data; null means anyone. */
  readers: string[] | null;
};

/** A value with its label and the graph nodes it was made from. */
export type Val = { v: string; label: Label; deps: string[] };

export const isUntrustedSource = (s: string) => s.startsWith("untrusted:");
export const isTrusted = (l: Label) => !l.sources.some(isUntrustedSource);

/** Combining data: sources add up, readers narrow down. */
export function join(...labels: Label[]): Label {
  const sources = [...new Set(labels.flatMap((l) => l.sources))].sort();
  let readers: string[] | null = null;
  for (const l of labels) {
    if (l.readers === null) continue;
    readers = readers === null ? [...l.readers] : readers.filter((r) => l.readers!.includes(r));
  }
  return { sources, readers };
}

export const TRUSTED_REQUEST: Label = { sources: ["request"], readers: null };

export type Schema = "email" | "iban" | "amount" | "date" | "text";

export type Expr = { lit: string } | { me: true } | { var: string };

export type ToolName = "read_email" | "read_file" | "fetch" | "send_email" | "pay" | "calendar_add" | "post_message";

export type Step =
  | { kind: "call"; tool: ToolName; args: Record<string, Expr>; bind?: string }
  | { kind: "extract"; from: string; schema: Schema; bind: string };

/**
 * Control arguments decide what happens and to whom (a recipient, an account, an amount, an address to load).
 * Data arguments are the payload. The monitor treats them differently.
 */
export const TOOLS: Record<ToolName, { control: string[]; data: string[] }> = {
  read_email: { control: ["id"], data: [] },
  read_file: { control: ["name"], data: [] },
  fetch: { control: ["url"], data: [] },
  send_email: { control: ["to"], data: ["subject", "body"] },
  pay: { control: ["iban", "amount"], data: ["reference"] },
  calendar_add: { control: [], data: ["title", "date"] },
  post_message: { control: ["channel"], data: ["text"] },
};

/** Everything outside the agent: your address book, payees, files, and what other people wrote. */
export type World = {
  me: string;
  contacts: Record<string, string>;
  payees: Record<string, string>;
  domains: string[];
  channels: Record<string, string[] | null>;
  files: Record<string, { text: string; readers: string[] }>;
  emails: Record<string, { from: string; subject: string; text: string }>;
  pages: Record<string, string>;
};

export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
};

/** Who receives the data of a call; "nobody" for reads, which stay inside the agent. */
export function recipients(tool: ToolName, args: Record<string, Val>, world: World): string[] | "anyone" {
  switch (tool) {
    case "send_email":
      return [args.to?.v ?? ""];
    case "pay":
      return [`account:${(args.iban?.v ?? "").replace(/\s+/g, "").toUpperCase()}`];
    case "fetch":
      return [hostOf(args.url?.v ?? "")];
    case "calendar_add":
      return [world.me];
    case "post_message": {
      const members = world.channels[args.channel?.v ?? ""];
      return members === undefined ? [] : members === null ? "anyone" : members;
    }
    default:
      return [];
  }
}

// Letters from other scripts that look like Latin ones; only used by the lenient matching the lab can switch on.
const LOOKALIKE: Record<string, string> = { "\u0430": "a", "\u0435": "e", "\u043E": "o", "\u0440": "p", "\u0441": "c", "\u0445": "x", "\u0456": "i", "\u0443": "y", "\u0501": "d", "\u04BB": "h", "\u0261": "g" };
export const lenient = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u200B-\u200D\u2060\uFEFF\s]/g, "")
    .replace(/[\u0400-\u052F\u0250-\u02AF]/g, (c) => LOOKALIKE[c] ?? c);

const ibanKey = (s: string) => s.replace(/\s+/g, "").toUpperCase();

/** The list a control argument is checked against, if any. */
export function onList(tool: ToolName, arg: string, value: string, world: World, exact: boolean): boolean {
  const eq = (a: string, b: string) => (exact ? a === b : lenient(a) === lenient(b));
  if (tool === "send_email" && arg === "to") return [world.me, ...Object.values(world.contacts)].some((c) => eq(c, value));
  if (tool === "pay" && arg === "iban") return Object.values(world.payees).some((p) => eq(ibanKey(p), ibanKey(value)));
  if (tool === "fetch" && arg === "url") return world.domains.some((d) => eq(d, hostOf(value)));
  if (tool === "post_message" && arg === "channel") return Object.keys(world.channels).some((c) => eq(c, value));
  if (tool === "read_file" && arg === "name") return value in world.files;
  if (tool === "read_email" && arg === "id") return value in world.emails;
  return false;
}

/** IBAN check digits (ISO 13616, mod 97). */
export function ibanValid(iban: string): boolean {
  const s = iban.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const moved = s.slice(4) + s.slice(0, 4);
  let rest = 0;
  for (const ch of moved) {
    const n = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of n) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1;
}

/** Builds a valid IBAN from country, bank code and account number, for the invented examples. */
export function makeIban(country: string, bank: string, account: string): string {
  for (let k = 2; k < 99; k++) {
    const candidate = `${country}${String(k).padStart(2, "0")}${bank}${account}`;
    if (ibanValid(candidate)) return candidate.replace(/(.{4})/g, "$1 ").trim();
  }
  throw new Error("no check digits");
}

/** Whether a reader's output fits what the plan asked for. The plan refuses anything else and stops. */
export function fitsSchema(schema: Schema, v: string): boolean {
  switch (schema) {
    case "email":
      return /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/.test(v);
    case "iban":
      return ibanValid(v);
    case "amount":
      return /^\d{1,9}(\.\d{2})?$/.test(v);
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
    case "text":
      return v.length <= 600;
  }
}

/** Makes lookalike and invisible characters visible, for showing addresses, accounts and links to a person. */
export const shown = (s: string) => s.replace(/[^ -~]/gu, (c) => `{U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}}`);
