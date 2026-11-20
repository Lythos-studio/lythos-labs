/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { Fix } from "./fixes";

export type ReportRow = { name: string; level: string; message: string; fixes: Fix[] };
export type ReportInput = {
  heading: string;
  domain: string;
  date: string;
  provider?: string;
  summary: string;
  labels: { date: string; provider: string; host: string; file: string };
  rows: ReportRow[];
  footer: string;
};

/** Text goes in as text: markdown, HTML and links are made harmless, and line breaks cannot start a new block. */
const text = (s: string) => s.replace(/\s*\n+\s*/g, " ").replace(/[\\`*_[\]<>#|]/g, (c) => `\\${c}`).trim();
const code = (s: string) => s.replace(/`/g, "'").replace(/\s*\n+\s*/g, " ").trim();
const block = (s: string) => `\`\`\`\n${s.replace(/`{3,}/g, "'''").replace(/\s+$/, "")}\n\`\`\``;

/** A markdown summary to paste into a ticket or an email. Built only from our own texts, the checked domain and validated hosts. */
export function reportMarkdown(r: ReportInput): string {
  const out: string[] = [`# ${text(r.heading)}: ${text(r.domain)}`, "", `${r.labels.date}: ${text(r.date)}`];
  if (r.provider) out.push(`${r.labels.provider}: ${text(r.provider)}`);
  out.push("", text(r.summary), "");
  for (const row of r.rows) {
    out.push(`## ${text(row.name)} - ${text(row.level)}`, "", text(row.message), "");
    for (const fix of row.fixes) {
      out.push(`${fix.kind === "file" ? r.labels.file : r.labels.host}: \`${code(fix.host)}\``, "", block(fix.value), "");
    }
  }
  out.push("---", text(r.footer), "");
  return out.join("\n");
}
