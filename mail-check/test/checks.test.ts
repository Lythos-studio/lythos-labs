/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { runChecks, type Check } from "../src/checks";
import type { Lookup, RecordType } from "../src/dns";

/** A fake zone shaped like the answers seen from a real domain with Cloudflare mail routing. */
const zone: Record<string, string[]> = {
  "MX example.nl": ["10 route1.mx.example.net.", "20 route2.mx.example.net."],
  "TXT example.nl": ["google-site-verification=abc", "v=spf1 include:_spf.example.net ~all"],
  "TXT _spf.example.net": ["v=spf1 ip4:192.0.2.0/24 -all"],
  "TXT _dmarc.example.nl": ["v=DMARC1; p=quarantine; rua=mailto:reports@example.nl; pct=100"],
  "TXT selector1._domainkey.example.nl": ["v=DKIM1; k=rsa; p=ABCDEF"],
};
const fake = (calls: string[] = []): Lookup => async (name: string, type: RecordType) => {
  calls.push(`${type} ${name}`);
  return zone[`${type} ${name}`] ?? [];
};

test("a typical domain gets one verdict per check, in order, and each one is reported as it finishes", async () => {
  const live: string[] = [];
  const checks = await runChecks("example.nl", fake(), { onCheck: (c) => live.push(c.id) });
  assert.deepEqual(live, ["mx", "spf", "dmarc", "dkim", "mta-sts", "tls-rpt", "bimi"]);
  const by = Object.fromEntries(checks.map((c) => [c.id, c.finding]));
  assert.equal(by.mx.code, "mx-ok");
  assert.deepEqual(by.spf, { level: "ok", code: "spf-ok", detail: "1" });
  assert.equal(by.dmarc.code, "dmarc-ok");
  assert.deepEqual(by.dkim, { level: "ok", code: "dkim-ok", detail: "selector1" });
  assert.equal(by["mta-sts"].level, "warn");
  assert.equal(by["tls-rpt"].level, "warn");
  assert.equal(by.bimi.level, "info");
});

test("no MX makes the check look for an address before it fails", async () => {
  const calls: string[] = [];
  const mx = (await runChecks("empty.nl", fake(calls))).find((c) => c.id === "mx");
  assert.equal(mx?.finding.code, "mx-missing");
  assert.ok(calls.includes("A empty.nl") && calls.includes("AAAA empty.nl"));
});

test("a failing lookup turns only that check into unknown, never a green tick", async () => {
  const flaky: Lookup = async (name, type) => {
    if (name.startsWith("_dmarc.")) throw new Error("http-503");
    return fake()(name, type);
  };
  const checks = await runChecks("example.nl", flaky);
  const dmarc = checks.find((c) => c.id === "dmarc") as Check;
  assert.deepEqual(dmarc.finding, { level: "unknown", code: "lookup-failed", detail: "http-503" });
  assert.equal(checks.find((c) => c.id === "spf")?.finding.level, "ok");
});

test("a run stays within the default request budget, even with many selectors and an SPF that includes a lot", async () => {
  const many: Record<string, string[]> = {
    ...zone,
    "TXT example.nl": [`v=spf1 ${Array.from({ length: 11 }, (_, i) => `include:i${i}.example.net`).join(" ")} -all`],
  };
  const calls: string[] = [];
  const lookup: Lookup = async (name, type) => (calls.push(name), many[`${type} ${name}`] ?? []);
  const spf = (await runChecks("example.nl", lookup)).find((c) => c.id === "spf");
  assert.equal(spf?.finding.code, "spf-too-many-lookups");
  assert.ok(calls.length <= 40, `${calls.length} requests`);
});

test("the MX check hands over the valid MX hosts, so later advice can use them", async () => {
  const mx = (await runChecks("example.nl", fake())).find((c) => c.id === "mx");
  assert.deepEqual(mx?.data?.mx, ["route1.mx.example.net", "route2.mx.example.net"]);
});

test("DKIM tries the selectors of the recognised provider first, without repeating any", async () => {
  const calls: string[] = [];
  const lookup: Lookup = async (name, type) => {
    calls.push(`${type} ${name}`);
    return name === "example.nl" && type === "MX" ? ["10 mail.protonmail.ch."] : [];
  };
  await runChecks("example.nl", lookup);
  const dkim = calls.filter((c) => c.includes("._domainkey."));
  assert.deepEqual(dkim.slice(0, 3), ["TXT protonmail._domainkey.example.nl", "TXT protonmail2._domainkey.example.nl", "TXT protonmail3._domainkey.example.nl"]);
  assert.equal(new Set(dkim).size, dkim.length);
});

test("a recognised provider that is already in the common list is not asked twice, and the request budget holds", async () => {
  const calls: string[] = [];
  const lookup: Lookup = async (name, type) => {
    calls.push(`${type} ${name}`);
    return name === "example.nl" && type === "MX" ? ["1 aspmx.l.google.com."] : [];
  };
  await runChecks("example.nl", lookup);
  assert.equal(calls.filter((c) => c === "TXT google._domainkey.example.nl").length, 1);
  assert.ok(calls.length <= 40, String(calls.length));
});
