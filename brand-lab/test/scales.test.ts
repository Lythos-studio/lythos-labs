/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TEXT_STEPS, spacing, typeScale } from "../src/scales";
import { exportCss, exportJson, exportTailwind, type Settings } from "../src/tokens";

const DEFAULT: Settings = { color: "#2449df", radius: "soft", type: "editorial" };
const baseline = JSON.parse(readFileSync(new URL("./fixtures/default-exports.json", import.meta.url), "utf8")) as Record<"css" | "tailwind" | "json", string>;

test("the type scale follows the ratio of each style", () => {
  assert.equal(typeScale("modern").base.size, "1rem");
  assert.equal(typeScale("modern").lg.size, "1.2rem");
  assert.equal(typeScale("editorial")["2xl"].size, "1.953rem");
});

test("sizes strictly increase for every style", () => {
  for (const style of ["editorial", "modern", "technical"] as const) {
    const sizes = TEXT_STEPS.map((s) => parseFloat(typeScale(style)[s].size));
    for (let i = 1; i < sizes.length; i++) assert.ok(sizes[i] > sizes[i - 1], `${style} ${i}`);
  }
});

test("spacing sits on a 4px grid", () => {
  assert.equal(spacing()[4], "16px");
  assert.equal(spacing()[12], "48px");
});

test("CSS export gains type, spacing and weight tokens", () => {
  const css = exportCss(DEFAULT);
  assert.ok(css.includes("--text-lg: 1.25rem;"));
  assert.ok(css.includes("--space-4: 16px;"));
  assert.ok(css.includes("--font-weight-heading: 500;"));
});

test("Tailwind export gains type and spacing tokens", () => {
  const tw = exportTailwind(DEFAULT);
  assert.ok(tw.includes("--text-lg: 1.25rem;"));
  assert.ok(tw.includes("--text-lg--line-height: 1.4;"));
  assert.ok(tw.includes("--spacing: 4px;"));
});

test("JSON export gains typography and spacing in the design token format", () => {
  const json = JSON.parse(exportJson(DEFAULT));
  assert.equal(json.typography.size.lg.$type, "dimension");
  assert.equal(json.spacing["4"].$value, "16px");
  assert.equal(json.typography.weight.heading.$type, "fontWeight");
});

test("every line of the previous default exports is still present (additive change only)", () => {
  const css = exportCss(DEFAULT);
  for (const line of baseline.css.split("\n")) assert.ok(css.includes(line), line);
  const tw = exportTailwind(DEFAULT);
  for (const line of baseline.tailwind.split("\n")) assert.ok(tw.includes(line), line);
  const now = JSON.parse(exportJson(DEFAULT));
  const before = JSON.parse(baseline.json);
  for (const key of Object.keys(before)) assert.deepEqual(now[key], before[key], key);
});
