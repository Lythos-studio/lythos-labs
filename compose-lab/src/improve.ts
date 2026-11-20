/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { isMap, isScalar, isSeq, parseAllDocuments, type Node, type YAMLMap } from "yaml";
import { parseCompose } from "./parse";
import { isDatabase, isJob, isOverride } from "./rules";

export type ImproveId = "remove-version" | "add-restart" | "add-log-limits" | "bind-db-localhost" | "add-no-new-privileges";
/** On by default: mechanical and safe. The hardening change is offered but starts off, because some images need setuid helpers. */
export const IMPROVE_DEFAULT_ON: readonly ImproveId[] = ["remove-version", "add-restart", "add-log-limits", "bind-db-localhost"];

export type ImproveChange = { id: ImproveId; services: string[] };
export type ImproveResult =
  | { ok: true; output: string; changes: ImproveChange[] }
  | { ok: false; reason: "empty" | "parse-error" | "multiple-files" };

type Edit = { pos: number; remove: number; insert: string };
const NO_NEW_PRIVILEGES = /^no-new-privileges(?:[:=]true)?$/i;
const SHORT_PORT = /^\d[\d-]*:\d[\d-]*(?:\/(?:tcp|udp|sctp))?$/;

const rangeOf = (node: unknown): [number, number, number] | null => {
  const r = (node as { range?: [number, number, number] | null } | null | undefined)?.range;
  return r ?? null;
};

/**
 * Applies the chosen changes as small text edits at exact positions, so everything else (comments, quotes, blank lines,
 * line endings, flow style) stays byte for byte as it was. `changes` lists everything that could be done, chosen or not.
 * Only a single file is improved; services in flow style, aliases and merged keys are left alone rather than broken.
 */
export function improve(text: string, apply: readonly ImproveId[]): ImproveResult {
  if (!text.trim()) return { ok: false, reason: "empty" };
  const parsed = parseCompose(text);
  if (!parsed.ok) return { ok: false, reason: "parse-error" };
  const docs = Array.from(parseAllDocuments(text, { merge: true, uniqueKeys: true, customTags: [] }));
  const filled = docs.filter((d) => d.errors.length === 0 && d.contents !== null && !(isScalar(d.contents) && d.contents.value === null));
  if (filled.length > 1) return { ok: false, reason: "multiple-files" };
  const doc = filled[0];
  if (!doc || !isMap(doc.contents)) return { ok: false, reason: "parse-error" };

  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lineStart = (pos: number) => text.lastIndexOf("\n", pos - 1) + 1;
  const column = (pos: number) => pos - lineStart(pos);
  const lineEnd = (pos: number) => {
    const i = text.indexOf("\n", pos);
    const end = i === -1 ? text.length : i;
    return end > 0 && text[end - 1] === "\r" ? end - 1 : end;
  };
  const endOf = (map: YAMLMap): number | null => {
    const last = map.items.at(-1);
    const raw = rangeOf(last?.value)?.[1] ?? rangeOf(last?.key)?.[1];
    // A nested block's range runs on through the blank lines after it; the edit belongs right after its last real line.
    return raw === undefined ? null : text.slice(0, raw).trimEnd().length;
  };
  const blockMap = (node: unknown): YAMLMap | null => (isMap(node) && !node.flow && node.items.length > 0 ? node : null);
  const keyColumn = (map: YAMLMap): number | null => {
    const start = rangeOf(map.items[0]?.key)?.[0];
    return start === undefined ? null : column(start);
  };

  const services = blockMap(doc.contents.get("services", true));
  const model = new Map(parsed.compose.services.map((s) => [s.name, s]));
  const edits = new Map<ImproveId, Edit[]>();
  const touched = new Map<ImproveId, string[]>();
  const add = (id: ImproveId, service: string | null, edit: Edit) => {
    edits.set(id, [...(edits.get(id) ?? []), edit]);
    if (service && !(touched.get(id) ?? []).includes(service)) touched.set(id, [...(touched.get(id) ?? []), service]);
    if (!touched.has(id)) touched.set(id, []);
  };

  if (parsed.compose.hasVersion) {
    const pair = doc.contents.items.find((p) => isScalar(p.key) && p.key.value === "version");
    const k = rangeOf(pair?.key);
    if (pair && k) {
      const start = lineStart(k[0]);
      const end = lineEnd(rangeOf(pair.value)?.[1] ?? k[1]);
      add("remove-version", null, { pos: start, remove: Math.min(text.length, end + (text.startsWith("\r\n", end) ? 2 : text[end] === "\n" ? 1 : 0)) - start, insert: "" });
    }
  }

  for (const pair of services?.items ?? []) {
    if (!isScalar(pair.key) || typeof pair.key.value !== "string") continue;
    const name = pair.key.value;
    const s = model.get(name);
    const map = blockMap(pair.value);
    if (!s || !map) continue;
    const indent = keyColumn(map);
    const end = endOf(map);
    if (indent === null || end === null) continue;
    const pad = " ".repeat(indent);
    const append = (id: ImproveId, lines: string[]) => add(id, name, { pos: lineEnd(end), remove: 0, insert: lines.map((l) => `${eol}${pad}${l}`).join("") });
    const own = (key: string) => map.items.some((p) => isScalar(p.key) && p.key.value === key);
    const active = !isJob(s) && !isOverride(s);

    if (active && !s.restart) append("add-restart", ["restart: unless-stopped"]);
    if (active && !s.hasLogLimits && !own("logging"))
      append("add-log-limits", ["logging:", "  driver: json-file", "  options:", '    max-size: "10m"', '    max-file: "3"']);

    if (isDatabase(s)) {
      const ports = map.get("ports", true);
      if (isSeq(ports))
        for (const item of ports.items) {
          const r = rangeOf(item);
          if (!isScalar(item) || !r || typeof item.value !== "string" || !SHORT_PORT.test(item.value)) continue;
          add("bind-db-localhost", name, { pos: r[0] + (/["']/.test(text[r[0]] ?? "") ? 1 : 0), remove: 0, insert: "127.0.0.1:" });
        }
    }

    if (active && !s.securityOpt.some((o) => NO_NEW_PRIVILEGES.test(o.trim()))) {
      const opt = map.get("security_opt", true);
      if (isSeq(opt) && opt.flow) {
        const r = rangeOf(opt);
        if (r && text[r[1] - 1] === "]") add("add-no-new-privileges", name, { pos: r[1] - 1, remove: 0, insert: `${opt.items.length ? ", " : ""}no-new-privileges:true` });
      } else if (isSeq(opt) && opt.items.length) {
        const first = rangeOf(opt.items[0] as Node)?.[0];
        const last = rangeOf(opt.items.at(-1) as Node)?.[1];
        if (first !== undefined && last !== undefined) {
          const dash = lineStart(first) + text.slice(lineStart(first)).search(/-/);
          add("add-no-new-privileges", name, { pos: lineEnd(last), remove: 0, insert: `${eol}${" ".repeat(column(dash))}- no-new-privileges:true` });
        }
      } else if (!own("security_opt") && s.securityOpt.length === 0) append("add-no-new-privileges", ["security_opt:", "  - no-new-privileges:true"]);
    }
  }

  const changes: ImproveChange[] = (["remove-version", "add-restart", "add-log-limits", "bind-db-localhost", "add-no-new-privileges"] as const)
    .filter((id) => (edits.get(id) ?? []).length > 0)
    .map((id) => ({ id, services: touched.get(id) ?? [] }));

  // Back to front, so earlier positions stay valid while the text grows.
  const chosen = apply.flatMap((id) => edits.get(id) ?? []).sort((a, b) => b.pos - a.pos);
  let output = text;
  for (const e of chosen) output = output.slice(0, e.pos) + e.insert + output.slice(e.pos + e.remove);
  return { ok: true, output, changes };
}

export type DiffLine = { kind: "same" | "added" | "removed"; text: string };

const toLines = (s: string) => (s === "" ? [] : s.replace(/\r?\n$/, "").split(/\r?\n/));

/** A small line diff for showing what would change. Large inputs fall back to "all removed, all added" in the changed middle. */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = toLines(before);
  const b = toLines(after);
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const midA = a.slice(head, a.length - tail);
  const midB = b.slice(head, b.length - tail);
  const out: DiffLine[] = a.slice(0, head).map((text) => ({ kind: "same", text }));
  if (midA.length * midB.length > 4_000_000) {
    out.push(...midA.map((text): DiffLine => ({ kind: "removed", text })), ...midB.map((text): DiffLine => ({ kind: "added", text })));
  } else {
    const dp = Array.from({ length: midA.length + 1 }, () => new Uint32Array(midB.length + 1));
    for (let i = midA.length - 1; i >= 0; i--)
      for (let j = midB.length - 1; j >= 0; j--) dp[i][j] = midA[i] === midB[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    let i = 0;
    let j = 0;
    while (i < midA.length || j < midB.length) {
      if (i < midA.length && j < midB.length && midA[i] === midB[j]) out.push({ kind: "same", text: midA[i++] }), j++;
      else if (i < midA.length && (j === midB.length || dp[i + 1][j] >= dp[i][j + 1])) out.push({ kind: "removed", text: midA[i++] });
      else out.push({ kind: "added", text: midB[j++] });
    }
  }
  out.push(...a.slice(a.length - tail).map((text): DiffLine => ({ kind: "same", text })));
  return out;
}
