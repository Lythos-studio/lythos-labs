/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import type { Lookup } from "../src/dns";
import { countSpfLookups, judgeDkim, judgeDmarc, judgeMx, judgeOptional, judgeSpf, spfRecords } from "../src/records";

const spf = (record: string) => judgeSpf(spfRecords([record]), 0);

test("SPF: one record that ends in -all or ~all is fine", () => {
  assert.equal(spf("v=spf1 include:_spf.example.net -all").code, "spf-ok");
  assert.equal(spf("V=SPF1 mx ~all").level, "ok");
});

test("SPF: open or missing endings, no record and several records are called out", () => {
  assert.equal(spf("v=spf1 mx ?all").code, "spf-open-all");
  assert.equal(spf("v=spf1 mx +all").code, "spf-open-all");
  assert.equal(spf("v=spf1 mx all").code, "spf-open-all");
  assert.equal(spf("v=spf1 mx").code, "spf-no-all");
  assert.equal(spf("v=spf1 redirect=_spf.example.net").level, "ok");
  assert.equal(judgeSpf([], 0).code, "spf-missing");
  assert.equal(judgeSpf(spfRecords(["v=spf1 -all", "v=spf1 ~all"]), 0).code, "spf-multiple");
  assert.deepEqual(spfRecords(["google-site-verification=x", "v=spf10 -all", " v=spf1 -all"]), [" v=spf1 -all"]);
});

test("SPF: the lookup count decides between fine, close to the limit and broken", () => {
  const one = spfRecords(["v=spf1 -all"]);
  assert.equal(judgeSpf(one, 7).level, "ok");
  assert.equal(judgeSpf(one, 8).code, "spf-near-limit");
  assert.equal(judgeSpf(one, 10).level, "warn");
  assert.equal(judgeSpf(one, 11).code, "spf-too-many-lookups");
});

const zone = (records: Record<string, string>): Lookup => async (name) => (records[name] ? [records[name]] : []);

test("SPF lookups: includes, redirects, a, mx, ptr and exists count; ip4, ip6 and all do not", async () => {
  const l = zone({ "a.nl": "v=spf1 mx -all", "b.nl": "v=spf1 a:x.nl include:a.nl -all" });
  assert.equal(await countSpfLookups("v=spf1 ip4:1.2.3.4 ip6:::1 -all", l, ["d.nl"]), 0);
  assert.equal(await countSpfLookups("v=spf1 a mx ptr exists:x.nl -all", l, ["d.nl"]), 4);
  assert.equal(await countSpfLookups("v=spf1 include:a.nl -all", l, ["d.nl"]), 2);
  assert.equal(await countSpfLookups("v=spf1 include:b.nl -all", l, ["d.nl"]), 4);
  assert.equal(await countSpfLookups("v=spf1 redirect=a.nl", l, ["d.nl"]), 2);
});

test("SPF lookups: a loop stops, a macro is counted but not followed, and the count stops past 10", async () => {
  const loop = zone({ "a.nl": "v=spf1 include:b.nl", "b.nl": "v=spf1 include:a.nl" });
  assert.equal(await countSpfLookups("v=spf1 include:a.nl", loop, ["d.nl"]), 3);
  const seen: string[] = [];
  const spy: Lookup = async (name) => (seen.push(name), []);
  assert.equal(await countSpfLookups("v=spf1 include:%{d}.spf.example.nl -all", spy, ["d.nl"]), 1);
  assert.deepEqual(seen, []);
  const wide = zone({ "w.nl": `v=spf1 ${Array.from({ length: 12 }, (_, i) => `a:h${i}.nl`).join(" ")}` });
  assert.ok((await countSpfLookups("v=spf1 include:w.nl", wide, ["d.nl"])) > 10);
});

test("SPF lookups: a failing lookup is an error, not a low count", async () => {
  const broken: Lookup = async () => {
    throw new Error("budget");
  };
  await assert.rejects(countSpfLookups("v=spf1 include:a.nl", broken, ["d.nl"]), /budget/);
});

test("DMARC: reject or quarantine with a report address is fine; the rest is explained", () => {
  assert.equal(judgeDmarc(["v=DMARC1; p=reject; rua=mailto:d@example.nl"]).code, "dmarc-ok");
  assert.equal(judgeDmarc(["v=DMARC1; p=QUARANTINE; rua=mailto:d@example.nl; pct=100"]).level, "ok");
  assert.equal(judgeDmarc(["v=DMARC1; p=reject"]).code, "dmarc-no-rua");
  assert.equal(judgeDmarc(["v=DMARC1;p=none;rua=mailto:d@example.nl"]).code, "dmarc-monitoring-only");
  assert.equal(judgeDmarc(["v=DMARC1; rua=mailto:d@example.nl"]).code, "dmarc-invalid");
  assert.equal(judgeDmarc(["v=DMARC1; p=sometimes"]).code, "dmarc-invalid");
  assert.equal(judgeDmarc(["v=spf1 -all"]).code, "dmarc-missing");
  assert.equal(judgeDmarc(["v=DMARC1; p=none", "v=DMARC1; p=reject"]).code, "dmarc-multiple");
});

test("DKIM: a key is proof, a revoked key is a problem, finding nothing is only a hint", () => {
  const key = "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3";
  assert.deepEqual(judgeDkim([{ selector: "google", records: [key] }, { selector: "k1", records: [] }]), {
    level: "ok",
    code: "dkim-ok",
    detail: "google",
  });
  assert.equal(judgeDkim([{ selector: "s1", records: ["k=rsa; p=ABC"] }]).level, "ok");
  assert.equal(judgeDkim([{ selector: "s1", records: ["v=DKIM1; p="] }]).code, "dkim-revoked");
  assert.equal(judgeDkim([{ selector: "s1", records: ["v=DKIM1; p="] }, { selector: "s2", records: [key] }]).code, "dkim-ok");
  const empty = ["a", "b", "c"].map((selector) => ({ selector, records: ["v=DKIM1; p="] }));
  assert.deepEqual(judgeDkim(empty), { level: "info", code: "dkim-none-signed" });
  assert.equal(judgeDkim([...empty, { selector: "d", records: [] }]).code, "dkim-revoked");
  assert.equal(judgeDkim([{ selector: "s1", records: ["v=spf1 -all", "v=DKIM2; p=ABC"] }]).code, "dkim-none-found");
  assert.equal(judgeDkim([]).level, "warn");
});

test("MX: two or more are fine, one is fragile, none falls back to an address or fails, and a null MX is deliberate", () => {
  assert.equal(judgeMx(["10 a.example.nl.", "20 b.example.nl."], false).code, "mx-ok");
  assert.equal(judgeMx(["10 a.example.nl."], false).code, "mx-single");
  assert.equal(judgeMx([], true).code, "mx-fallback");
  assert.equal(judgeMx([], false).code, "mx-missing");
  assert.equal(judgeMx(["0 ."], false).code, "mx-null");
  assert.equal(judgeMx(["garbage"], false).code, "mx-missing");
});

test("optional records are present or not, and absence is as loud as the caller says", () => {
  assert.equal(judgeOptional("mta-sts", "stsv1", ["v=STSv1; id=2024"], "warn").code, "mta-sts-present");
  assert.deepEqual(judgeOptional("tls-rpt", "tlsrptv1", ["v=spf1 -all"], "warn"), { level: "warn", code: "tls-rpt-missing" });
  assert.deepEqual(judgeOptional("bimi", "bimi1", [], "info"), { level: "info", code: "bimi-missing" });
});
