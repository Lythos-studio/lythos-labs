/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const DNS_LABEL = /^[a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?$/;
const NOT_PUBLIC = new Set(["local", "localhost", "internal", "test", "invalid", "lan", "home", "corp", "arpa"]);

/**
 * Turns what a visitor typed into a public domain name, or null. Rejects instead of cleaning up:
 * no scheme, path, port, spaces, IP addresses or private suffixes. Internationalised names become punycode.
 */
export function parseDomain(input: string): string | null {
  const raw = input.trim().toLowerCase().replace(/\.$/, "");
  if (!raw || raw.length > 253 || /[\s/\\?#@:%*]/.test(raw)) return null;
  let host: string;
  try {
    host = new URL(`http://${raw}`).hostname;
  } catch {
    return null;
  }
  const labels = host.split(".");
  const tld = labels[labels.length - 1];
  if (labels.length < 2 || host.length > 253 || !labels.every((l) => LABEL.test(l))) return null;
  return /^\d+$/.test(tld) || NOT_PUBLIC.has(tld) ? null : host;
}

/** True for a name that is safe to ask DNS about. Underscores are allowed (_dmarc, _domainkey). */
export function isDnsName(name: string): boolean {
  const n = name.toLowerCase().replace(/\.$/, "");
  return n.length > 0 && n.length <= 253 && n.split(".").every((l) => DNS_LABEL.test(l));
}

export const MAX_DOMAINS = 5;

/** Several domains typed at once: split on spaces, commas and new lines, cleaned, deduplicated and capped at five. */
export function parseDomains(input: string): { domains: string[]; invalid: string[]; tooMany: boolean } {
  const domains: string[] = [];
  const invalid: string[] = [];
  let tooMany = false;
  for (const part of input.split(/[\s,;]+/).filter(Boolean)) {
    const name = parseDomain(part);
    if (!name) invalid.push(part);
    else if (!domains.includes(name)) {
      if (domains.length >= MAX_DOMAINS) tooMany = true;
      else domains.push(name);
    }
  }
  return { domains, invalid, tooMany };
}
