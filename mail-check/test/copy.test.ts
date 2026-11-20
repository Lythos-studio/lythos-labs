/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mailCheckCopy } from "../src/copy";
import { fixFor } from "../src/fixes";

const source = ["records.ts", "checks.ts"].map((f) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8")).join("\n");
const optional = ["mta-sts", "tls-rpt", "bimi"].flatMap((id) => [`${id}-present`, `${id}-missing`]);
const codes = [...new Set([...[...source.matchAll(/code: "([a-z-]+)"(?=\s*[,}])/g)].map((m) => m[1]), ...optional])];

test("every verdict code has words in English and Dutch", () => {
  assert.ok(codes.length >= 25, `found ${codes.length} codes`);
  for (const locale of ["en", "nl"] as const) {
    const t = mailCheckCopy[locale];
    for (const code of codes) {
      const text = t.messages[code]?.("x");
      assert.ok(text && text.length > 10, `${locale}: ${code}`);
      assert.ok(!new RegExp(`${String.fromCodePoint(0x2014)}|[${String.fromCodePoint(0x1f300)}-${String.fromCodePoint(0x1faff)}${String.fromCodePoint(0x2600)}-${String.fromCodePoint(0x27bf)}]`, "u").test(text), `${locale}: ${code} has an em dash or emoji`);
    }
    assert.deepEqual(Object.keys(t.names).sort(), ["bimi", "dkim", "dmarc", "mta-sts", "mx", "spf", "tls-rpt"]);
    assert.deepEqual(Object.keys(t.levels).sort(), ["fail", "info", "ok", "unknown", "warn"]);
  }
  assert.deepEqual(Object.keys(mailCheckCopy.en.messages).sort(), Object.keys(mailCheckCopy.nl.messages).sort());
});

test("every suggested fix comes with an explanation in both languages and only uses the checked domain", () => {
  for (const code of codes) {
    const fix = fixFor(code, "example.nl");
    if (!fix) continue;
    assert.ok(mailCheckCopy.en.notes[code] && mailCheckCopy.nl.notes[code], code);
    assert.match(fix.host, /(^|\.)example\.nl$/, code);
    assert.ok(!/[\s"<>]/.test(fix.host), code);
    for (const m of fix.value.matchAll(/@([^;\s]+)/g)) assert.equal(m[1], "example.nl", code);
  }
  assert.equal(fixFor("dmarc-missing", "example.nl")?.host, "_dmarc.example.nl");
  assert.equal(fixFor("dkim-ok", "example.nl"), null);
});

test("the summary counts what needs work", () => {
  const { summary } = mailCheckCopy.en;
  assert.match(summary(0, 0, 0), /Nothing to fix/);
  assert.equal(summary(2, 1, 0), "2 to fix, 1 to improve.");
  assert.equal(mailCheckCopy.nl.summary(0, 3, 1), "3 te verbeteren, 1 niet te controleren.");
});

const shape = (value: unknown): unknown =>
  typeof value === "function" ? "fn" : Array.isArray(value) ? value.map(shape) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, shape(v)])) : typeof value;

const texts = (value: unknown): string[] =>
  typeof value === "function" ? [String((value as (...a: unknown[]) => unknown)("x", "y", "z"))] : typeof value === "string" ? [value] : value && typeof value === "object" ? Object.values(value).flatMap(texts) : [];

test("English and Dutch have the same keys all the way down, including the new report, roll-out and compare texts", () => {
  assert.deepEqual(shape(mailCheckCopy.nl), shape(mailCheckCopy.en));
  for (const key of ["providerDetected", "providerUnknown", "dkimEnable", "rolloutTitle", "rolloutSteps", "youAreHere", "rememberLabel", "compareTitle", "copyReport", "print", "tooMany", "invalidSome", "fileLabel", "reportFooter"])
    assert.ok(key in mailCheckCopy.en, key);
});

test("no em dash and no emoji anywhere in the copy, in either language", () => {
  const bad = new RegExp(`${String.fromCodePoint(0x2014)}|[${String.fromCodePoint(0x1f300)}-${String.fromCodePoint(0x1faff)}${String.fromCodePoint(0x2600)}-${String.fromCodePoint(0x27bf)}]`, "u");
  for (const locale of ["en", "nl"] as const) for (const text of texts(mailCheckCopy[locale])) assert.ok(!bad.test(text), `${locale}: ${text.slice(0, 60)}`);
});

test("the SPF note no longer tells every domain to block all senders", () => {
  for (const locale of ["en", "nl"] as const) assert.ok(!/If this domain sends no mail, add this TXT record\./.test(mailCheckCopy[locale].notes["spf-missing"]));
});
