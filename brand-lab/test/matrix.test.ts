/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { MATRIX_BACKGROUNDS, MATRIX_FOREGROUNDS, matrix, wcagClass } from "../src/matrix";
import { contrast, palette, roles, type Mode } from "../src/tokens";

const tintFor = (hex: string, mode: Mode) => {
  const p = palette(hex);
  return mode === "light" ? p.primary[100] : p.primary[900];
};

test("wcagClass uses the 7, 4.5 and 3 thresholds", () => {
  assert.equal(wcagClass(7), "aaa");
  assert.equal(wcagClass(6.99), "aa");
  assert.equal(wcagClass(4.5), "aa");
  assert.equal(wcagClass(4.49), "aa-large");
  assert.equal(wcagClass(3), "aa-large");
  assert.equal(wcagClass(2.99), "fail");
});

test("the matrix has a row per foreground and a column per background", () => {
  const r = roles(palette("#2449df"), "light");
  const m = matrix(r, tintFor("#2449df", "light"));
  assert.equal(m.length, MATRIX_FOREGROUNDS.length);
  assert.ok(m.every((row) => row.length === MATRIX_BACKGROUNDS.length));
  assert.equal(m[0][0].wcag, "aaa");
});

test("every cell ratio equals contrast(fg, bg)", () => {
  const r = roles(palette("#e4572e"), "dark");
  for (const row of matrix(r, tintFor("#e4572e", "dark")))
    for (const cell of row) assert.equal(cell.ratio, contrast(cell.fg, cell.bg));
});

test("body text stays readable on every background for the example colours, in both modes", () => {
  for (const hex of ["#2449df", "#e4572e", "#0f9d74", "#8b5cf6", "#ffcc00", "#111827"])
    for (const mode of ["light", "dark"] as const) {
      const row = matrix(roles(palette(hex), mode), tintFor(hex, mode))[0];
      for (const cell of row) assert.ok(cell.wcag === "aa" || cell.wcag === "aaa", `${hex} ${mode} ${cell.bg}`);
    }
});
