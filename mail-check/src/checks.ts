/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { Lookup } from "./dns";
import {
  countSpfLookups,
  DKIM_SELECTORS,
  judgeDkim,
  judgeDmarc,
  judgeMx,
  judgeOptional,
  judgeSpf,
  spfRecords,
} from "./records";
import { detectProvider, mxHosts, PROVIDERS } from "./provider";
import type { Finding } from "./types";

export type CheckId = "mx" | "spf" | "dmarc" | "dkim" | "mta-sts" | "tls-rpt" | "bimi";
/** `data.mx` (on the MX check only) holds the valid MX host names, for advice that needs them. */
export type Check = { id: CheckId; finding: Finding; data?: { mx?: string[] } };

/** A failed lookup is "unknown", never a green tick. */
async function guard(id: CheckId, run: () => Promise<Finding>): Promise<Check> {
  try {
    return { id, finding: await run() };
  } catch (e) {
    return { id, finding: { level: "unknown", code: "lookup-failed", detail: e instanceof Error ? e.message : "error" } };
  }
}

/**
 * Runs the checks one after another, so the report can build up live and the request budget is spent in a
 * predictable order. `domain` must come from `parseDomain`.
 */
export async function runChecks(
  domain: string,
  lookup: Lookup,
  options: { selectors?: string[]; onCheck?: (check: Check) => void } = {},
): Promise<Check[]> {
  let mxRecords: string[] = [];
  const txt = (name: string) => lookup(name, "TXT");
  const steps: [CheckId, () => Promise<Finding>][] = [
    ["mx", async () => {
      const mx = await lookup(domain, "MX");
      mxRecords = mx;
      const address = mx.length ? false : (await lookup(domain, "A")).length > 0 || (await lookup(domain, "AAAA")).length > 0;
      return judgeMx(mx, address);
    }],
    ["spf", async () => {
      const records = spfRecords(await txt(domain));
      const lookups = records.length === 1 ? await countSpfLookups(records[0], lookup, [domain]) : 0;
      return judgeSpf(records, lookups);
    }],
    ["dmarc", async () => judgeDmarc(await txt(`_dmarc.${domain}`))],
    ["dkim", async () => {
      const found = [];
      const provider = detectProvider(mxRecords);
      const selectors = [...new Set([...(provider ? PROVIDERS[provider].dkim : []), ...(options.selectors ?? DKIM_SELECTORS)])];
      for (const selector of selectors) found.push({ selector, records: await txt(`${selector}._domainkey.${domain}`) });
      return judgeDkim(found);
    }],
    ["mta-sts", async () => judgeOptional("mta-sts", "stsv1", await txt(`_mta-sts.${domain}`), "warn")],
    ["tls-rpt", async () => judgeOptional("tls-rpt", "tlsrptv1", await txt(`_smtp._tls.${domain}`), "warn")],
    ["bimi", async () => judgeOptional("bimi", "bimi1", await txt(`default._bimi.${domain}`), "info")],
  ];
  const checks: Check[] = [];
  for (const [id, run] of steps) {
    const check = await guard(id, run);
    if (id === "mx") check.data = { mx: mxHosts(mxRecords) };
    checks.push(check);
    options.onCheck?.(check);
  }
  return checks;
}
