/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { isDnsName, parseDomain } from "../src/domain";
import { makeLookup, readAnswer, txtValue } from "../src/dns";

test("a typed domain is normalised, and an international name becomes punycode", () => {
  assert.equal(parseDomain("  LYTHOS.nl. "), "lythos.nl");
  assert.equal(parseDomain("mail.example.co.uk"), "mail.example.co.uk");
  assert.equal(parseDomain("bücher.de"), "xn--bcher-kva.de");
});

test("anything that is not a plain public domain is refused, not cleaned up", () => {
  const bad = [
    "",
    "lythos",
    "https://lythos.nl",
    "lythos.nl/path",
    "lythos.nl:8080",
    "user@lythos.nl",
    "ly thos.nl",
    "lythos.nl?x=1",
    "a..nl",
    "-a.nl",
    "127.0.0.1",
    "0x7f.1",
    "192.168.1.1",
    "localhost",
    "printer.local",
    "host.internal",
    `${"a".repeat(64)}.nl`,
    `${"a.".repeat(130)}nl`,
  ];
  for (const input of bad) assert.equal(parseDomain(input), null, input);
});

test("DNS names allow the underscores of _dmarc and _domainkey but nothing else", () => {
  for (const ok of ["_dmarc.lythos.nl", "google._domainkey.lythos.nl", "_spf.mx.cloudflare.net."]) assert.ok(isDnsName(ok), ok);
  for (const bad of ["", "%{i}._spf.example.com", "a b.nl", "a/b.nl", "..", "x.nl\n"]) assert.ok(!isDnsName(bad), bad);
});

test("TXT strings are joined and unescaped", () => {
  assert.equal(txtValue('"v=spf1 -all"'), "v=spf1 -all");
  assert.equal(txtValue('"v=DKIM1; p=AAA" "BBB"'), "v=DKIM1; p=AAABBB");
  assert.equal(txtValue('"say \\"hi\\""'), 'say "hi"');
  assert.equal(txtValue("no quotes"), "no quotes");
});

test("an answer is read by type; no record and an unknown name are empty, other statuses and odd shapes throw", () => {
  const answer = { Status: 0, Answer: [{ type: 16, data: '"a"' }, { type: 5, data: "cname." }, { type: 16, data: 7 }, null] };
  assert.deepEqual(readAnswer(answer, "TXT"), ["a"]);
  assert.deepEqual(readAnswer({ Status: 0, Answer: [{ type: 15, data: "10 mx.example.nl." }] }, "MX"), ["10 mx.example.nl."]);
  assert.deepEqual(readAnswer({ Status: 0, Authority: [] }, "TXT"), []);
  assert.deepEqual(readAnswer({ Status: 3 }, "TXT"), []);
  for (const bad of [{ Status: 2 }, { Status: 0, Answer: "x" }, {}, null, "text", 5]) assert.throws(() => readAnswer(bad, "TXT"), Error);
});

const reply = (body: unknown, init?: ResponseInit) => async () => new Response(typeof body === "string" ? body : JSON.stringify(body), init);

test("a lookup asks Cloudflare in JSON, encodes the name, and never trusts a bad name", async () => {
  const seen: string[] = [];
  const lookup = makeLookup({
    fetch: async (url, init) => {
      seen.push(String(url));
      assert.equal((init?.headers as Record<string, string>).accept, "application/dns-json");
      return new Response(JSON.stringify({ Status: 0, Answer: [{ type: 16, data: '"v=spf1 -all"' }] }));
    },
  });
  assert.deepEqual(await lookup("lythos.nl", "TXT"), ["v=spf1 -all"]);
  assert.equal(seen[0], "https://cloudflare-dns.com/dns-query?name=lythos.nl&type=TXT");
  await assert.rejects(lookup("evil.nl&type=A", "TXT"), /bad-name/);
  assert.equal(seen.length, 1);
});

test("the budget, HTTP errors, huge answers and broken JSON all end in an error, not a result", async () => {
  const budget = makeLookup({ budget: 2, fetch: reply({ Status: 0 }) });
  await budget("a.nl", "TXT");
  await budget("b.nl", "TXT");
  await assert.rejects(budget("c.nl", "TXT"), /budget/);
  await assert.rejects(makeLookup({ fetch: reply("x", { status: 503 }) })("a.nl", "TXT"), /http-503/);
  await assert.rejects(makeLookup({ fetch: reply("x".repeat(70_000)) })("a.nl", "TXT"), /too-large/);
  await assert.rejects(makeLookup({ fetch: reply("{not json") })("a.nl", "TXT"));
  await assert.rejects(makeLookup({ fetch: async () => { throw new Error("offline"); } })("a.nl", "TXT"), /offline/);
});
