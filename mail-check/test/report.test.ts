/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { reportMarkdown, type ReportInput } from "../src/report";

const base: ReportInput = {
  heading: "Mail check",
  domain: "example.nl",
  date: "2026-11-20",
  provider: "Google Workspace",
  summary: "1 to fix.",
  labels: { date: "Date", provider: "Mail provider", host: "Host", file: "Publish this file at" },
  rows: [
    { name: "Allowed senders (SPF)", level: "Needs fixing", message: "No SPF record.", fixes: [{ host: "example.nl", value: "v=spf1 mx ~all", kind: "txt" }] },
    { name: "Signatures (DKIM)", level: "In order", message: "DKIM keys found for: google.", fixes: [] },
  ],
  footer: "Made with Lythos Labs Mail check. A hint, not an audit.",
};

test("the report is plain markdown with a section per check and the records in code blocks", () => {
  const md = reportMarkdown(base);
  assert.match(md, /^# Mail check: example\.nl\n/);
  assert.ok(md.includes("Date: 2026-11-20"));
  assert.ok(md.includes("Mail provider: Google Workspace"));
  assert.ok(md.includes("## Allowed senders \\(SPF\\) - Needs fixing") || md.includes("## Allowed senders (SPF) - Needs fixing"));
  assert.ok(md.includes("Host: `example.nl`"));
  assert.ok(md.includes("```\nv=spf1 mx ~all\n```"));
  assert.ok(md.trimEnd().endsWith("A hint, not an audit."));
  assert.ok(!md.includes("—"));
});

test("a provider line is left out when none was recognised", () => {
  assert.ok(!reportMarkdown({ ...base, provider: undefined }).includes("Mail provider"));
});

test("markup in any text cannot break out of the report", () => {
  const md = reportMarkdown({
    ...base,
    rows: [{ name: "x", level: "Needs fixing", message: "<script>alert(1)</script> [a](http://evil.example) **bold**\n# heading", fixes: [{ host: "h", value: "a```\n# injected", kind: "txt" }] }],
  });
  assert.ok(!md.includes("<script>"));
  assert.ok(!md.includes("[a](http://evil.example)"));
  assert.ok(!/^# heading/m.test(md));
  assert.equal((md.match(/```/g) ?? []).length, 2);
});

test("a file fix is labelled with its address", () => {
  const md = reportMarkdown({ ...base, rows: [{ name: "MTA-STS", level: "Could be better", message: "m", fixes: [{ host: "https://mta-sts.example.nl/.well-known/mta-sts.txt", value: "version: STSv1\n", kind: "file" }] }] });
  assert.ok(md.includes("Publish this file at: `https://mta-sts.example.nl/.well-known/mta-sts.txt`"));
});
