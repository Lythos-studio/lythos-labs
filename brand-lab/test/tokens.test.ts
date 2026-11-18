/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checks,
  contrast,
  decodeSettings,
  encodeSettings,
  exportCss,
  exportJson,
  hexToRgb,
  oklchToHex,
  palette,
  parseHex,
  rgbToOklch,
  roles,
} from "../src/tokens";

test("hex input is parsed strictly", () => {
  assert.equal(parseHex("#2449DF"), "#2449df");
  assert.equal(parseHex("abc"), "#aabbcc");
  for (const bad of ["", "#12", "zzzzzz", "#2449df0", "red"]) assert.equal(parseHex(bad), null, bad);
});

test("OKLCH round trip keeps the colour", () => {
  for (const hex of ["#2449df", "#ff0000", "#00b894", "#ffffff", "#000000", "#7a7a7a"]) {
    const back = hexToRgb(oklchToHex(rgbToOklch(hexToRgb(hex))));
    const orig = hexToRgb(hex);
    assert.ok(Math.abs(back.r - orig.r) <= 1 && Math.abs(back.g - orig.g) <= 1 && Math.abs(back.b - orig.b) <= 1, hex);
  }
});

test("contrast matches WCAG reference values", () => {
  assert.equal(Math.round(contrast("#000000", "#ffffff") * 10) / 10, 21);
  assert.equal(Math.round(contrast("#767676", "#ffffff") * 100) / 100, 4.54);
});

test("every brand colour gives text roles that pass AA in light and dark", () => {
  // Hard cases: bright yellow, pale pastel, near black, pure grey, saturated red and the Lythos blue.
  for (const brand of ["#ffe600", "#f5d0fe", "#0a0a0a", "#808080", "#ff0000", "#2449df", "#00ffcc"]) {
    for (const mode of ["light", "dark"] as const) {
      for (const c of checks(roles(palette(brand), mode))) {
        assert.ok(c.ratio >= c.min, `${brand} ${mode} ${c.label} ${c.ratio.toFixed(2)}`);
      }
    }
  }
});

test("a brand colour that can carry text is used for buttons as is", () => {
  assert.equal(roles(palette("#2449df"), "light").primary, "#2449df");
  assert.notEqual(roles(palette("#ffe600"), "light").onPrimary, "#ffffff");
});

test("exports contain every scale and the chosen settings", () => {
  const s = { color: "#2449df", radius: "soft", type: "editorial" } as const;
  const css = exportCss(s);
  assert.match(css, /--primary-500: #[0-9a-f]{6};/);
  assert.match(css, /--radius: 8px;/);
  assert.match(css, /prefers-color-scheme: dark/);
  const json = JSON.parse(exportJson(s));
  assert.equal(json.color.neutral["950"].$type, "color");
  assert.ok(json.role.dark.text.$value);
});

test("settings round trip through the URL hash and ignore junk", () => {
  const s = { color: "#ff6600", radius: "round", type: "technical" } as const;
  assert.deepEqual(decodeSettings(`#${encodeSettings(s)}`, { color: "#000000", radius: "soft", type: "modern" }), s);
  const fallback = { color: "#2449df", radius: "soft", type: "modern" } as const;
  assert.deepEqual(decodeSettings("#c=<script>&r=huge&t=x", fallback), fallback);
});
