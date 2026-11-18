/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

export type Fix = { host: string; value: string };

/**
 * A record or tag to add for a finding. Built only from fixed templates and a domain that came through
 * `parseDomain`, never from text received in a DNS answer. The mailbox names are placeholders the owner replaces.
 */
export function fixFor(code: string, domain: string): Fix | null {
  switch (code) {
    case "spf-missing":
      return { host: domain, value: "v=spf1 -all" };
    case "spf-open-all":
      return { host: domain, value: "~all" };
    case "dmarc-missing":
      return { host: `_dmarc.${domain}`, value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}` };
    case "dmarc-monitoring-only":
      return { host: `_dmarc.${domain}`, value: "p=quarantine" };
    case "dmarc-no-rua":
      return { host: `_dmarc.${domain}`, value: `rua=mailto:dmarc@${domain}` };
    case "tls-rpt-missing":
      return { host: `_smtp._tls.${domain}`, value: `v=TLSRPTv1; rua=mailto:tlsrpt@${domain}` };
    default:
      return null;
  }
}
