/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { contrast } from "@lythos-labs/brand-lab/tokens";
import { DEFAULT_THEME, encodeThemeHash, parseThemeHash, themeVars, varsToCss, REQUIRED_VARS } from "../src/theme/theme-vars";

const brands = ["#2449df", "#e4572e", "#0f9d74", "#8b5cf6", "#ffcc00", "#111827"];

test("every required variable is produced for every brand and mode", () => {
  for (const color of brands)
    for (const mode of ["light", "dark"] as const) {
      const vars = themeVars({ color, radius: "soft", type: "modern" }, mode);
      for (const name of REQUIRED_VARS) assert.ok(vars[name], `${color} ${mode} ${name}`);
    }
});

test("text on every tinted background (alerts, badges) reaches 4.5:1 for every brand and mode", () => {
  for (const color of brands)
    for (const mode of ["light", "dark"] as const) {
      const v = themeVars({ color, radius: "soft", type: "modern" }, mode);
      for (const tone of ["success", "warning", "danger", "info"]) assert.ok(contrast(v[`--lb-${tone}-text`], v[`--lb-${tone}-bg`]) >= 4.5, `${color} ${mode} ${tone}`);
      assert.ok(contrast(v["--lb-text"], v["--lb-bg"]) >= 7, `${color} ${mode} text`);
      assert.ok(contrast(v["--lb-on-primary"], v["--lb-primary"]) >= 4.5, `${color} ${mode} button`);
      assert.ok(contrast(v["--lb-link"], v["--lb-bg"]) >= 4.5, `${color} ${mode} link`);
      assert.ok(contrast(v["--lb-muted"], v["--lb-surface"]) >= 4.5, `${color} ${mode} muted`);
    }
});

test("the theme hash round-trips, keeps the Merklab format, and falls back safely", () => {
  const state = { settings: { color: "#e4572e", radius: "round" as const, type: "technical" as const, accent: "#0f9d74" }, mode: "dark" as const };
  assert.deepEqual(parseThemeHash("#" + encodeThemeHash(state)), state);
  assert.equal(encodeThemeHash(DEFAULT_THEME).includes("m="), false, "light is the default and stays out of the link");
  assert.ok(parseThemeHash("#c=2449df&r=soft&t=editorial").settings.type === "editorial", "a Merklab link works as it is");
  assert.deepEqual(parseThemeHash(""), DEFAULT_THEME);
  assert.equal(parseThemeHash("#m=banana").mode, "light");
});

test("a hostile hash can never put markup or declarations into a variable", () => {
  const hostile = "#c=12;}body{x:y&r=url(javascript:1)&t=<script>&a=%7D%7B&m=dark;}";
  const vars = themeVars(parseThemeHash(hostile).settings, parseThemeHash(hostile).mode);
  for (const value of Object.values(vars)) assert.ok(!/[{}<>]|url\(/i.test(value), value);
  const css = varsToCss(vars, ".lb-root");
  assert.ok(css.startsWith(".lb-root {") && css.trim().endsWith("}"));
  assert.equal((css.match(/\{/g) ?? []).length, 1);
});
