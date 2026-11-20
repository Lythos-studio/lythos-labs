/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { harmonyNote, hueDistance, suggestAccent } from "../src/harmony";
import { contrast, decodeSettings, encodeSettings, exportCss, exportJson, exportTailwind, palette, parseHex, roles, type Settings } from "../src/tokens";

const DEFAULT: Settings = { color: "#2449df", radius: "soft", type: "editorial" };

test("suggestions rotate the hue by the harmony angle", () => {
  const near = (kind: "analogous" | "complementary" | "triad", angle: number) =>
    Math.abs(hueDistance("#2449df", suggestAccent("#2449df", kind)) - angle) < 3;
  assert.ok(near("complementary", 180));
  assert.ok(near("analogous", 30));
  assert.ok(near("triad", 120));
});

test("suggestions are valid hex codes even for white, black and grey brands", () => {
  for (const brand of ["#808080", "#ffffff", "#000000"])
    for (const kind of ["analogous", "complementary", "triad"] as const) {
      const hex = suggestAccent(brand, kind);
      assert.notEqual(parseHex(hex), null, `${brand} ${kind} ${hex}`);
    }
});

test("harmonyNote flags accents that are too close to the brand", () => {
  assert.equal(harmonyNote("#2449df", "#2a52e0"), "too-close");
  assert.equal(harmonyNote("#2449df", suggestAccent("#2449df", "complementary")), "ok");
});

test("without an accent nothing about it appears", () => {
  const p = palette("#2449df");
  assert.equal(p.accent, undefined);
  assert.equal("accent" in roles(p, "light"), false);
  assert.equal(encodeSettings(DEFAULT), "c=2449df&r=soft&t=editorial");
  assert.equal(exportCss(DEFAULT).includes("accent"), false);
});

test("an accent gets a scale and readable roles in both modes", () => {
  const p = palette("#2449df", "#e4572e");
  assert.equal(Object.keys(p.accent ?? {}).length, 11);
  for (const mode of ["light", "dark"] as const) {
    const r = roles(p, mode);
    assert.ok(r.accent && r.onAccent);
    assert.ok(contrast(r.onAccent, r.accent) >= 4.5, mode);
  }
});

test("the share link carries the accent only when set, and ignores bad values", () => {
  assert.ok(encodeSettings({ ...DEFAULT, accent: "#e4572e" }).endsWith("&a=e4572e"));
  assert.equal(decodeSettings("#c=2449df&a=zzz", DEFAULT).accent, undefined);
  const only = decodeSettings("#a=e4572e", DEFAULT);
  assert.equal(only.accent, "#e4572e");
  assert.equal(only.color, DEFAULT.color);
});

test("exports include the accent scale when it is set", () => {
  const s = { ...DEFAULT, accent: "#e4572e" };
  assert.ok(exportCss(s).includes("--accent-500:"));
  assert.ok(exportTailwind(s).includes("--color-accent-500:"));
  assert.ok(JSON.parse(exportJson(s)).color.accent["500"]);
});
