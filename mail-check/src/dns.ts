/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { isDnsName } from "./domain";

const TYPE = { A: 1, MX: 15, TXT: 16, AAAA: 28 } as const;
export type RecordType = keyof typeof TYPE;
/** Returns the record values for a name. Throws when the answer cannot be trusted or the budget is spent. */
export type Lookup = (name: string, type: RecordType) => Promise<string[]>;

const DOH = "https://cloudflare-dns.com/dns-query";
const MAX_CHARS = 64 * 1024;

/** Joins the quoted strings of a TXT value: `"part1" "part2"` becomes `part1part2`. */
export function txtValue(data: string): string {
  const parts = [...data.matchAll(/"((?:[^"\\]|\\.)*)"/g)];
  return parts.length ? parts.map((m) => m[1].replace(/\\(.)/g, "$1")).join("") : data;
}

/** Reads a DNS JSON answer. No record and a name that does not exist (status 3) give []; other statuses throw. */
export function readAnswer(json: unknown, type: RecordType): string[] {
  const j = json as { Status?: unknown; Answer?: unknown } | null;
  if (!j || typeof j !== "object" || typeof j.Status !== "number") throw new Error("bad-answer");
  if (j.Status === 3) return [];
  if (j.Status !== 0) throw new Error(`dns-status-${j.Status}`);
  if (j.Answer === undefined) return [];
  if (!Array.isArray(j.Answer)) throw new Error("bad-answer");
  const values: string[] = [];
  for (const a of j.Answer as { type?: unknown; data?: unknown }[]) {
    if (a && a.type === TYPE[type] && typeof a.data === "string") values.push(type === "TXT" ? txtValue(a.data) : a.data);
  }
  return values;
}

/** DNS-over-HTTPS lookup with a request budget (shared by one check run) and a time-out per request. */
export function makeLookup(options: { fetch?: typeof fetch; budget?: number; timeoutMs?: number } = {}): Lookup {
  const doFetch: typeof fetch = options.fetch ?? ((input, init) => fetch(input, init));
  let left = options.budget ?? 40;
  return async (name, type) => {
    if (!isDnsName(name)) throw new Error("bad-name");
    if (left-- <= 0) throw new Error("budget");
    const url = `${DOH}?${new URLSearchParams({ name, type })}`;
    const res = await doFetch(url, {
      headers: { accept: "application/dns-json" },
      signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
    });
    if (!res.ok) throw new Error(`http-${res.status}`);
    const text = await res.text();
    if (text.length > MAX_CHARS) throw new Error("too-large");
    return readAnswer(JSON.parse(text), type);
  };
}
