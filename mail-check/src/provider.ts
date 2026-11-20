/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { isDnsName } from "./domain";

export type ProviderId = "google" | "microsoft" | "fastmail" | "proton" | "cloudflare";

export type Provider = {
  id: ProviderId;
  name: string;
  /** MX host suffixes (a host matches when it equals one or ends in ".<suffix>"). */
  mx: string[];
  /** The `include:` host for SPF, when the provider sends mail on the domain's behalf. */
  spf?: string;
  /** DKIM selectors the provider publishes. Empty when it does not sign (forwarding only). */
  dkim: string[];
};

/** Only values that are the same for every customer. Providers whose SPF or DKIM hosts differ per region or tenant are left out. */
export const PROVIDERS: Record<ProviderId, Provider> = {
  google: { id: "google", name: "Google Workspace", mx: ["aspmx.l.google.com", "googlemail.com", "smtp.google.com"], spf: "_spf.google.com", dkim: ["google"] },
  microsoft: { id: "microsoft", name: "Microsoft 365", mx: ["mail.protection.outlook.com"], spf: "spf.protection.outlook.com", dkim: ["selector1", "selector2"] },
  fastmail: { id: "fastmail", name: "Fastmail", mx: ["messagingengine.com"], spf: "spf.messagingengine.com", dkim: ["fm1", "fm2", "fm3"] },
  proton: { id: "proton", name: "Proton Mail", mx: ["protonmail.ch"], spf: "_spf.protonmail.ch", dkim: ["protonmail", "protonmail2", "protonmail3"] },
  cloudflare: { id: "cloudflare", name: "Cloudflare Email Routing", mx: ["mx.cloudflare.net"], spf: "_spf.mx.cloudflare.net", dkim: [] },
};

/** Valid, lower-case MX host names without the final dot, ordered by preference (lowest first). Anything else is dropped. */
export function mxHosts(records: string[]): string[] {
  return records
    .flatMap((record) => {
      const [pref, raw, ...rest] = record.trim().split(/\s+/);
      const host = raw?.toLowerCase().replace(/\.$/, "");
      const n = Number(pref);
      if (rest.length || !host || host.length > 253 || !Number.isFinite(n) || !host.includes(".") || !isDnsName(host)) return [];
      return [{ n, host }];
    })
    .sort((a, b) => a.n - b.n)
    .map((x) => x.host);
}

/** The provider behind the most preferred MX host that is recognised, or null (self-hosted or unknown). */
export function detectProvider(records: string[]): ProviderId | null {
  for (const host of mxHosts(records))
    for (const p of Object.values(PROVIDERS)) if (p.mx.some((s) => host === s || host.endsWith(`.${s}`))) return p.id;
  return null;
}
