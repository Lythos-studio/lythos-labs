/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { isDnsName } from "./domain";
import { PROVIDERS, type ProviderId } from "./provider";

/** `kind` is "txt" for a DNS TXT record (the default) and "file" for a file to publish at the URL in `host`. */
export type Fix = { host: string; value: string; kind?: "txt" | "file" };

export type FixContext = {
  provider?: ProviderId | null;
  /** The domain says it accepts no mail (null MX). */
  nullMx?: boolean;
  /** Valid MX host names from the check, used for the MTA-STS policy file. */
  mx?: string[];
  now?: Date;
};

const stamp = (d: Date) => d.toISOString().replace(/\D/g, "").slice(0, 14);

/** Suggested records and files for a finding, built only from the checked domain and validated MX hosts. */
export function fixesFor(code: string, domain: string, ctx: FixContext = {}): Fix[] {
  switch (code) {
    case "spf-missing": {
      // Never "-all" for a domain that receives or sends mail: that would reject its own mail.
      const include = ctx.provider ? PROVIDERS[ctx.provider].spf : undefined;
      const value = ctx.nullMx ? "v=spf1 -all" : include ? `v=spf1 include:${include} ~all` : "v=spf1 mx ~all";
      return [{ host: domain, value }];
    }
    case "spf-no-all":
    case "spf-open-all":
      return [{ host: domain, value: "~all" }];
    case "dmarc-missing":
      return [{ host: `_dmarc.${domain}`, value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}` }];
    case "dmarc-monitoring-only":
      return [{ host: `_dmarc.${domain}`, value: "p=quarantine" }];
    case "dmarc-no-rua":
      return [{ host: `_dmarc.${domain}`, value: `rua=mailto:dmarc@${domain}` }];
    case "tls-rpt-missing":
      return [{ host: `_smtp._tls.${domain}`, value: `v=TLSRPTv1; rua=mailto:tlsrpt@${domain}` }];
    case "mta-sts-missing": {
      const record: Fix = { host: `_mta-sts.${domain}`, value: `v=STSv1; id=${stamp(ctx.now ?? new Date())}` };
      const hosts = (ctx.mx ?? []).filter((h) => isDnsName(h) && h.includes("."));
      if (!hosts.length) return [record];
      const body = ["version: STSv1", "mode: testing", ...hosts.map((h) => `mx: ${h}`), "max_age: 86400", ""].join("\n");
      return [record, { host: `https://mta-sts.${domain}/.well-known/mta-sts.txt`, value: body, kind: "file" }];
    }
    default:
      return [];
  }
}

/** The first suggested fix without extra context. */
export function fixFor(code: string, domain: string): Fix | null {
  return fixesFor(code, domain)[0] ?? null;
}

/** Where a provider's DKIM key will appear once DKIM is switched on. The key itself comes from the provider. */
export function dkimHosts(domain: string, provider: ProviderId | null | undefined): string[] {
  return provider ? PROVIDERS[provider].dkim.map((s) => `${s}._domainkey.${domain}`) : [];
}
