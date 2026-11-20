/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { dkimHosts, fixesFor, fixFor } from "../src/fixes";

const NOW = new Date("2026-11-20T10:11:12Z");

test("a missing SPF record gets a starting point that does not block the domain's own mail", () => {
  const value = (ctx?: Parameters<typeof fixesFor>[2]) => fixesFor("spf-missing", "example.nl", ctx)[0]?.value;
  assert.equal(value({ provider: "google" }), "v=spf1 include:_spf.google.com ~all");
  assert.equal(value({ provider: "microsoft" }), "v=spf1 include:spf.protection.outlook.com ~all");
  assert.equal(value({ provider: "cloudflare" }), "v=spf1 include:_spf.mx.cloudflare.net ~all");
  assert.equal(value({ nullMx: true }), "v=spf1 -all");
  assert.equal(value({ provider: null }), "v=spf1 mx ~all");
  assert.equal(value(), "v=spf1 mx ~all");
  for (const ctx of [undefined, { provider: null }, { provider: "google" as const }]) assert.ok(!value(ctx)?.includes("-all"), JSON.stringify(ctx));
});

test("a missing MTA-STS record comes with the record and the policy file, built from the checked MX hosts", () => {
  const [record, file, extra] = fixesFor("mta-sts-missing", "example.nl", { mx: ["route1.mx.example.net", "evil host", "%{i}.example.net", "route2.mx.example.net"], now: NOW });
  assert.equal(extra, undefined);
  assert.deepEqual({ host: record.host, value: record.value, kind: record.kind ?? "txt" }, { host: "_mta-sts.example.nl", value: "v=STSv1; id=20261120101112", kind: "txt" });
  assert.equal(file.kind, "file");
  assert.equal(file.host, "https://mta-sts.example.nl/.well-known/mta-sts.txt");
  assert.equal(file.value, "version: STSv1\nmode: testing\nmx: route1.mx.example.net\nmx: route2.mx.example.net\nmax_age: 86400\n");
});

test("without usable MX hosts only the DNS record is suggested", () => {
  assert.equal(fixesFor("mta-sts-missing", "example.nl", { mx: [], now: NOW }).length, 1);
  assert.equal(fixesFor("mta-sts-missing", "example.nl", { mx: ["a b"], now: NOW }).length, 1);
});

test("DKIM tells where the provider's key will appear, never a made-up key", () => {
  assert.deepEqual(dkimHosts("example.nl", "google"), ["google._domainkey.example.nl"]);
  assert.deepEqual(dkimHosts("example.nl", "microsoft"), ["selector1._domainkey.example.nl", "selector2._domainkey.example.nl"]);
  assert.deepEqual(dkimHosts("example.nl", "cloudflare"), []);
  assert.deepEqual(dkimHosts("example.nl", null), []);
  assert.equal(fixesFor("dkim-none-found", "example.nl", { provider: "google" }).length, 0);
});

test("the single-fix helper keeps working and still returns null where there is nothing to add", () => {
  assert.equal(fixFor("dmarc-missing", "example.nl")?.host, "_dmarc.example.nl");
  assert.equal(fixFor("dkim-ok", "example.nl"), null);
  assert.equal(fixFor("spf-no-all", "example.nl")?.value, "~all");
});
