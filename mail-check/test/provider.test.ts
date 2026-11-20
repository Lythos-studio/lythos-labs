/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { isDnsName } from "../src/domain";
import { PROVIDERS, detectProvider, mxHosts } from "../src/provider";

test("the common mail providers are recognised from their MX hosts", () => {
  assert.equal(detectProvider(["1 aspmx.l.google.com.", "5 alt1.aspmx.l.google.com."]), "google");
  assert.equal(detectProvider(["10 aspmx2.googlemail.com."]), "google");
  assert.equal(detectProvider(["0 example-nl.mail.protection.outlook.com."]), "microsoft");
  assert.equal(detectProvider(["10 in1-smtp.messagingengine.com."]), "fastmail");
  assert.equal(detectProvider(["10 mail.protonmail.ch.", "20 mailsec.protonmail.ch."]), "proton");
  assert.equal(detectProvider(["12 route1.mx.cloudflare.net."]), "cloudflare");
});

test("an unknown or self-hosted MX is not guessed, and look-alike hosts do not match", () => {
  assert.equal(detectProvider(["10 mail.example.nl."]), null);
  assert.equal(detectProvider(["10 xaspmx.l.google.com.evil.nl."]), null);
  assert.equal(detectProvider(["10 notprotonmail.ch."]), null);
  assert.equal(detectProvider([]), null);
});

test("hostile MX values never throw and never match", () => {
  for (const value of [".", "", "10", "abc def ghi", "10 ", "10 %{i}.google.com", "x".repeat(5000)]) {
    assert.doesNotThrow(() => detectProvider([value]));
    assert.equal(detectProvider([value]), null);
  }
});

test("the lowest preference decides when providers are mixed", () => {
  assert.equal(detectProvider(["20 aspmx.l.google.com.", "10 a.mail.protection.outlook.com."]), "microsoft");
});

test("mxHosts keeps only valid lower-case DNS names without the final dot", () => {
  assert.deepEqual(mxHosts(["10 Mail.Example.NL.", "20 bad host.nl", "30 .", "x", "5 ok.example.nl"]), ["ok.example.nl", "mail.example.nl"]);
});

test("every provider value is a valid DNS name", () => {
  for (const p of Object.values(PROVIDERS)) {
    if (p.spf) assert.ok(isDnsName(p.spf), p.id);
    for (const s of p.dkim) assert.ok(/^[a-z0-9-]+$/.test(s), `${p.id} ${s}`);
    for (const m of p.mx) assert.ok(isDnsName(m), `${p.id} ${m}`);
  }
  assert.equal(PROVIDERS.google.spf, "_spf.google.com");
  assert.equal(PROVIDERS.microsoft.spf, "spf.protection.outlook.com");
});
