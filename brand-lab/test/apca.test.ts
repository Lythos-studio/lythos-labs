/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { apca, apcaLevel } from "../src/apca";

test("black on white and white on black match the APCA reference values", () => {
  assert.ok(Math.abs(apca("#000000", "#ffffff") - 106) < 1);
  assert.ok(Math.abs(apca("#ffffff", "#000000") + 108) < 1);
});

test("mid grey on white lands in the body-text range", () => {
  const lc = apca("#777777", "#ffffff");
  assert.ok(lc > 60 && lc < 80, String(lc));
});

test("the sign follows the polarity of the pair", () => {
  assert.ok(apca("#2449df", "#ffffff") > 0);
  assert.ok(apca("#ffffff", "#2449df") < 0);
});

test("identical colours give zero", () => {
  assert.equal(apca("#2449df", "#2449df"), 0);
});

test("apcaLevel groups by absolute Lc", () => {
  assert.equal(apcaLevel(75), "body");
  assert.equal(apcaLevel(-50), "large");
  assert.equal(apcaLevel(20), "weak");
});
