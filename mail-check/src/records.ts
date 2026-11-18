/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { Lookup } from "./dns";
import { isDnsName } from "./domain";
import type { Finding } from "./types";

/** `k=v; k=v` into a map with lower-case keys. */
function tags(record: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of record.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) map.set(part.slice(0, i).trim().toLowerCase(), part.slice(i + 1).trim());
  }
  return map;
}

const SPF = /^v=spf1(\s|$)/i;
export const spfRecords = (txts: string[]): string[] => txts.filter((t) => SPF.test(t.trim()));

/**
 * Counts the terms that make DNS queries in an SPF record and in everything it includes or redirects to
 * (RFC 7208 allows 10). Stops as soon as the limit is passed, so the result is exact up to 10 and "more" above it.
 */
export async function countSpfLookups(
  record: string,
  lookup: Lookup,
  path: string[],
): Promise<number> {
  let count = 0;
  for (const term of record.trim().split(/\s+/).slice(1)) {
    const t = term.replace(/^[+\-~?]/, "").toLowerCase();
    const target = /^(?:include:|redirect=)(.+)$/.exec(t)?.[1];
    if (target || /^(a|mx|ptr|exists)([:/]|$)/.test(t)) count++;
    // Macros (%{...}) cannot be followed; they are counted but not expanded.
    if (target && isDnsName(target) && !path.includes(target) && count <= 10) {
      const next = spfRecords(await lookup(target, "TXT"))[0];
      if (next) count += await countSpfLookups(next, lookup, [...path, target]);
    }
    if (count > 10) return count;
  }
  return count;
}

export function judgeSpf(records: string[], lookups: number): Finding {
  if (!records.length) return { level: "fail", code: "spf-missing" };
  if (records.length > 1) return { level: "fail", code: "spf-multiple" };
  if (lookups > 10) return { level: "fail", code: "spf-too-many-lookups", detail: ">10" };
  const all = /(?:^|\s)([+\-~?]?)all(?:\s|$)/i.exec(records[0]);
  if (!all && !/(?:^|\s)redirect=/i.test(records[0])) return { level: "warn", code: "spf-no-all" };
  if (all && all[1] !== "-" && all[1] !== "~") return { level: "warn", code: "spf-open-all" };
  if (lookups >= 8) return { level: "warn", code: "spf-near-limit", detail: String(lookups) };
  return { level: "ok", code: "spf-ok", detail: String(lookups) };
}

export function judgeDmarc(txts: string[]): Finding {
  const records = txts.filter((t) => /^v=DMARC1\s*(;|$)/i.test(t.trim()));
  if (!records.length) return { level: "fail", code: "dmarc-missing" };
  if (records.length > 1) return { level: "fail", code: "dmarc-multiple" };
  const t = tags(records[0]);
  const policy = t.get("p")?.toLowerCase();
  if (policy !== "none" && policy !== "quarantine" && policy !== "reject") return { level: "fail", code: "dmarc-invalid" };
  if (policy === "none") return { level: "warn", code: "dmarc-monitoring-only" };
  if (!t.get("rua")) return { level: "warn", code: "dmarc-no-rua", detail: policy };
  return { level: "ok", code: "dmarc-ok", detail: policy };
}

/** Selectors that large providers and common tools use. Finding one proves a key; finding none proves nothing. */
export const DKIM_SELECTORS = ["google", "selector1", "selector2", "default", "k1", "dkim", "s1", "s2", "mail"];

export function judgeDkim(found: { selector: string; records: string[] }[]): Finding {
  const valid: string[] = [];
  const revoked: string[] = [];
  for (const { selector, records } of found) {
    for (const record of records) {
      const t = tags(record);
      const p = t.get("p");
      if (p === undefined || (t.has("v") && t.get("v")?.toUpperCase() !== "DKIM1")) continue;
      (p === "" ? revoked : valid).push(selector);
    }
  }
  if (valid.length) return { level: "ok", code: "dkim-ok", detail: [...new Set(valid)].join(", ") };
  const withdrawn = [...new Set(revoked)];
  // Every tried selector is empty, as a wildcard does: the domain says it signs no mail at all.
  if (withdrawn.length >= 3 && withdrawn.length === found.length) return { level: "info", code: "dkim-none-signed" };
  if (withdrawn.length) return { level: "fail", code: "dkim-revoked", detail: withdrawn.join(", ") };
  return { level: "warn", code: "dkim-none-found" };
}

/** `records` are MX values as DNS gives them: "10 mail.example.com.". A single "." host means "accepts no mail". */
export function judgeMx(records: string[], hasAddress: boolean): Finding {
  const hosts = records.map((r) => r.trim().split(/\s+/)[1]).filter(Boolean);
  if (hosts.length === 1 && hosts[0] === ".") return { level: "ok", code: "mx-null" };
  if (!hosts.length) return hasAddress ? { level: "warn", code: "mx-fallback" } : { level: "fail", code: "mx-missing" };
  return hosts.length > 1
    ? { level: "ok", code: "mx-ok", detail: String(hosts.length) }
    : { level: "warn", code: "mx-single" };
}

/** MTA-STS, TLS-RPT and BIMI: present or not. `missing` says how loud absence is. */
export function judgeOptional(
  code: "mta-sts" | "tls-rpt" | "bimi",
  version: string,
  txts: string[],
  missing: "warn" | "info",
): Finding {
  const present = txts.some((t) => t.trim().toLowerCase().startsWith(`v=${version}`));
  return present ? { level: "ok", code: `${code}-present` } : { level: missing, code: `${code}-missing` };
}
