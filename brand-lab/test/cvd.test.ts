/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { CVD_KINDS, cvdFilterValues, cvdMatrix, simulate } from "../src/cvd";
import { hexToRgb } from "../src/tokens";

const near = (a: string, b: string, tol = 1) => {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return Math.abs(x.r - y.r) <= tol && Math.abs(x.g - y.g) <= tol && Math.abs(x.b - y.b) <= tol;
};

test("none returns the input unchanged", () => {
  assert.equal(simulate("#2449df", "none"), "#2449df");
});

test("white and black stay white and black for every kind", () => {
  for (const kind of CVD_KINDS) {
    assert.ok(near(simulate("#ffffff", kind), "#ffffff"), `white ${kind}`);
    assert.ok(near(simulate("#000000", kind), "#000000"), `black ${kind}`);
  }
});

test("protanopia darkens pure red", () => {
  const out = simulate("#ff0000", "protanopia");
  assert.ok(hexToRgb(out).r < 120, out);
  assert.notEqual(out, "#ff0000");
});

test("achromatopsia gives grey", () => {
  const { r, g, b } = hexToRgb(simulate("#808080", "achromatopsia"));
  assert.ok(r === g && g === b);
  const c = hexToRgb(simulate("#e4572e", "achromatopsia"));
  assert.ok(c.r === c.g && c.g === c.b);
});

test("matrices are finite and the filter string has twenty numbers", () => {
  for (const kind of CVD_KINDS) {
    const m = cvdMatrix(kind);
    assert.equal(m.length, 9);
    assert.ok(m.every(Number.isFinite));
    assert.equal(cvdFilterValues(kind).split(" ").length, 20);
  }
});
