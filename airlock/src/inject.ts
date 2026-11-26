/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { ToolName, World } from "./model";

/**
 * The worst-case model: it obeys every instruction it reads, including hidden ones.
 * Real models obey injected instructions some of the time, which is enough for an attacker;
 * a defence worth having must hold even against this one.
 */
export type Injected = { tool: ToolName; args: Record<string, string>; attach: string[]; via: string };

const TAG_START = 0xe0000;
const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g;

/** Hides ASCII text in Unicode tag characters: invisible on screen, readable for a model. */
export function toTags(text: string): string {
  return [...text].map((c) => (c.charCodeAt(0) >= 0x20 && c.charCodeAt(0) < 0x7f ? String.fromCodePoint(TAG_START + c.charCodeAt(0)) : c)).join("");
}

/** Base64 of UTF-8 text, the way attackers hide instructions. */
export function toBase64(text: string): string {
  let bin = "";
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin);
}

function decodeBase64(s: string): string | null {
  try {
    const bin = atob(s);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    return /^[^\u0000-\u0008\u000e-\u001f]{12,}$/u.test(text) && /[a-z]{3}/i.test(text) ? text : null;
  } catch {
    return null;
  }
}

/** The parts of a text a person does not see but a model reads. */
export function hiddenParts(text: string): { tags: string; base64: string[]; comments: string[]; zeroWidth: number } {
  let tags = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp >= TAG_START + 0x20 && cp < TAG_START + 0x7f) tags += String.fromCharCode(cp - TAG_START);
  }
  const comments = [...text.matchAll(/<!--([\s\S]*?)-->/g)].map((m) => m[1].trim()).filter(Boolean);
  const base64 = (text.match(/[A-Za-z0-9+/]{20,}={0,2}/g) ?? []).map(decodeBase64).filter((x): x is string => !!x);
  const zeroWidth = (text.match(ZERO_WIDTH) ?? []).length;
  return { tags, base64, comments, zeroWidth };
}

/** Everything a model "reads" in a text: hidden tag characters decoded, zero-width characters gone, comments and base64 opened. */
export function reveal(text: string): string {
  let visible = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (!(cp >= TAG_START + 0x20 && cp < TAG_START + 0x7f)) visible += ch;
  }
  const hidden = hiddenParts(text);
  let out = visible.replace(ZERO_WIDTH, "").replace(/<!--([\s\S]*?)-->/g, "\n$1\n");
  if (hidden.tags) out += `\n${hidden.tags}`;
  for (const m of out.match(/[A-Za-z0-9+/]{20,}={0,2}/g) ?? []) {
    const decoded = decodeBase64(m);
    if (decoded) out += `\n${decoded}`;
  }
  return out;
}

const EMAIL = /[^\s<>()"',;:]+@[^\s<>()"',;:]+\.[^\s<>()"',;:.]+/;
const URL_RE = /https?:\/\/[^\s<>()"']+/;
const IBAN_RE = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,3})?\b/;
const AMOUNT_RE = /(?:€|eur(?:o)?\s?)\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)|(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)\s?(?:€|eur(?:o)?\b)/i;

/** Which of your files a sentence asks for. */
function wanted(sentence: string, world: World): string[] {
  const s = sentence.toLowerCase();
  const files = Object.keys(world.files);
  if (/\{\{\s*all\s*\}\}|everything|all (?:your|the|my) (?:files|data|documents)|alles|al je (?:bestanden|gegevens)/.test(s)) return files;
  const out: string[] = [];
  const pick = (name: string) => files.includes(name) && !out.includes(name) && out.push(name);
  if (/api[\s_-]?key|secret|password|token|credential|sleutel|wachtwoord|\{\{\s*secrets?\s*\}\}/.test(s)) pick("api-key");
  if (/\bq3\b|report|rapport|kwartaal|figures|cijfers/.test(s)) pick("q3-report");
  if (/salar|payroll|salaris|loon/.test(s)) pick("salaries");
  return out;
}

function normalizeAmount(raw: string): string {
  // 1.250,00 or 1,250.00 or 1250 -> 1250.00
  const t = raw.replace(/\s/g, "");
  const lastSep = Math.max(t.lastIndexOf(","), t.lastIndexOf("."));
  const decimals = lastSep >= 0 && t.length - lastSep - 1 === 2;
  const whole = (decimals ? t.slice(0, lastSep) : t).replace(/[.,]/g, "");
  return `${whole}.${decimals ? t.slice(lastSep + 1) : "00"}`;
}

function callSyntax(text: string): Injected[] {
  const out: Injected[] = [];
  for (const m of text.matchAll(/\b(send_email|pay|fetch|post_message|calendar_add)\s*\(([^)]*)\)/g)) {
    const tool = m[1] as ToolName;
    const args: Record<string, string> = {};
    const positional: string[] = [];
    for (const a of m[2].matchAll(/(?:(\w+)\s*=\s*)?["']([^"']*)["']/g)) (a[1] ? (args[a[1]] = a[2]) : positional.push(a[2]));
    if (tool === "fetch" && !args.url && positional[0]) args.url = positional[0];
    if (tool === "send_email" && !args.to && positional[0]) args.to = positional[0];
    out.push({ tool, args, attach: [], via: "tool-call" });
  }
  return out;
}

/** The calls the worst-case model makes after reading this text, on top of what you asked for. */
export function injectedCalls(text: string, world: World): Injected[] {
  const read = reveal(text);
  const out: Injected[] = [];
  const seen = new Set<string>();
  const add = (c: Injected) => {
    const key = `${c.tool}|${c.args.to ?? c.args.url ?? c.args.iban ?? c.args.channel ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(c);
  };

  for (const c of callSyntax(read)) {
    c.attach = wanted(`${c.args.body ?? ""} ${c.args.text ?? ""} ${c.args.url ?? ""}`, world);
    add(c);
  }
  // A markdown image is loaded as soon as the answer is shown: the classic way to leak data in a URL.
  for (const m of read.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)) add({ tool: "fetch", args: { url: m[1] }, attach: wanted(m[1], world), via: "markdown-image" });

  for (const sentence of read.split(/\n|(?<=[.!?])\s+/)) {
    const s = sentence.trim();
    if (!s) continue;
    const lower = s.toLowerCase();
    const email = EMAIL.exec(s)?.[0];
    const url = URL_RE.exec(s)?.[0];
    const iban = IBAN_RE.exec(s)?.[0];
    if (iban && /\b(pay|transfer|wire|send|betaal|maak|overmaken|stort)\b/.test(lower)) {
      const amount = AMOUNT_RE.exec(s);
      if (amount) add({ tool: "pay", args: { iban, amount: normalizeAmount(amount[1] ?? amount[2]) }, attach: [], via: "payment" });
      continue;
    }
    if (email && /\b(bcc|cc)\b/.test(lower)) {
      add({ tool: "send_email", args: { to: email.replace(/\.$/, ""), subject: "Fwd" }, attach: Object.keys(world.files), via: "bcc" });
      continue;
    }
    if (email && /\b(send|forward|mail|email|e-mail|share|stuur|doorsturen|mailen|deel)\b/.test(lower)) {
      add({ tool: "send_email", args: { to: email.replace(/\.$/, ""), subject: "Fwd" }, attach: wanted(s, world), via: "send" });
      continue;
    }
    const channel = /(^|\s)(#[\w-]+)/.exec(s)?.[2];
    if (channel && /\b(post|share|plaats|deel|zet)\b/.test(lower)) {
      add({ tool: "post_message", args: { channel }, attach: wanted(s, world), via: "post" });
      continue;
    }
    if (url && /\b(open|visit|fetch|load|go to|click|bezoek|ga naar|laad|klik)\b/.test(lower)) add({ tool: "fetch", args: { url }, attach: wanted(s, world), via: "visit" });
  }
  return out;
}
