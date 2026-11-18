/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { composeLabCopy } from "../src/copy";
import { evaluate, RULES } from "../src/rules";
import { fixFor } from "../src/fixes";
import { parseCompose } from "../src/parse";
import { EXAMPLES } from "../src/examples";

const cp = (n: number) => String.fromCodePoint(n);
const bad = new RegExp(`${cp(0x2014)}|[${cp(0x1f300)}-${cp(0x1faff)}${cp(0x2600)}-${cp(0x27bf)}]`, "u");

test("every rule has a title, an explanation, a reason and a 'when this is fine' in English and Dutch", () => {
  for (const locale of ["en", "nl"] as const) {
    const t = composeLabCopy[locale];
    for (const id of Object.keys(RULES) as (keyof typeof RULES)[]) {
      const r = t.rules[id];
      assert.ok(r, `${locale}: ${id}`);
      const what = r.what({ services: "svc", detail: "5432:5432" });
      for (const [field, text] of Object.entries({ title: r.title, what, why: r.why, fine: r.fine })) {
        assert.ok(text.length > 4, `${locale} ${id} ${field}`);
        assert.ok(!bad.test(text), `${locale} ${id} ${field} has an em dash or emoji`);
      }
      assert.ok(what.includes("svc") || id === "version-obsolete" || what.includes("5432:5432") || what.length > 10, `${locale} ${id}`);
    }
    assert.deepEqual(Object.keys(t.rules).sort(), Object.keys(RULES).sort());
  }
  assert.deepEqual(Object.keys(composeLabCopy.en.rules), Object.keys(composeLabCopy.nl.rules));
});

test("all interface strings exist in both languages and are free of em dashes and emoji", () => {
  const strings = (value: unknown, path = ""): [string, string][] =>
    typeof value === "string"
      ? [[path, value]]
      : Array.isArray(value)
        ? value.flatMap((v, i) => strings(v, `${path}[${i}]`))
        : value && typeof value === "object"
          ? Object.entries(value).flatMap(([k, v]) => strings(v, `${path}.${k}`))
          : [];
  const keys = (l: "en" | "nl") => strings(composeLabCopy[l]).map(([p]) => p).sort();
  assert.deepEqual(keys("en"), keys("nl"));
  for (const l of ["en", "nl"] as const) for (const [path, s] of strings(composeLabCopy[l])) assert.ok(!bad.test(s), `${l}${path}`);
  assert.equal(composeLabCopy.en.summary(2, 1, 3), "2 to fix, 1 to look at, 3 hints.");
  assert.equal(composeLabCopy.nl.summary(0, 0, 0).startsWith("Niets aan te merken"), true);
  assert.equal(composeLabCopy.en.errors["yaml-error"]({ code: "yaml-error", line: 4, detail: "BAD_INDENT" }).includes("line 4"), true);
});

test("the messy example never leaks its fake secrets into findings, snippets or messages", () => {
  const messy = parseCompose(EXAMPLES[1].yaml);
  assert.ok(messy.ok);
  const findings = evaluate(messy.compose);
  const out = JSON.stringify(findings) + findings.map((f) => fixFor(f, messy.compose) ?? "").join("\n");
  for (const t of Object.values(composeLabCopy))
    for (const f of findings) assert.ok(!out.includes("example-not-a-real") && !t.rules[f.id].what({ services: f.services.join(", "), detail: f.detail ?? "" }).includes("example-not-a-real"));
  assert.ok(out.includes("SESSION_SECRET"), "keys are named");
});

test("the diagram never reads environment values", () => {
  const source = readFileSync(new URL("../src/diagram.tsx", import.meta.url), "utf8");
  assert.ok(!/\.env\b|\.value\b/.test(source), "diagram.tsx must not touch env or values");
});
