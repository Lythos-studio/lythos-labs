/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { auditRoles, repairColor } from "../src/repair";
import { contrast, hexToRgb, rgbToOklch } from "../src/tokens";

test("a failing colour is lightness-shifted until it reaches the minimum", () => {
  const r = repairColor("#777777", "#ffffff", 4.5);
  assert.ok(r.reached && r.ratio >= 4.5);
});

test("hue is kept while lightness moves", () => {
  const r = repairColor("#e4572e", "#ffffff", 4.5);
  const before = rgbToOklch(hexToRgb("#e4572e")).h;
  const after = rgbToOklch(hexToRgb(r.hex)).h;
  assert.ok(Math.abs(before - after) < 8, `${before} ${after}`);
});

test("a colour that already passes is returned unchanged", () => {
  assert.deepEqual(repairColor("#111111", "#ffffff", 4.5), { hex: "#111111", ratio: contrast("#111111", "#ffffff"), reached: true });
});

test("an impossible target falls back quickly instead of looping", () => {
  const t = performance.now();
  const r = repairColor("#808080", "#808080", 7);
  assert.ok(performance.now() - t < 50);
  assert.ok(r.hex === "#000000" || r.hex === "#ffffff" || r.reached);
});

test("auditRoles repairs failing pairs, leaves passing ones, and skips missing roles", () => {
  const rows = auditRoles({ background: "#ffffff", text: "#111111", muted: "#aaaaaa" });
  const muted = rows.find((x) => x.label.startsWith("muted"));
  const text = rows.find((x) => x.label.startsWith("text"));
  assert.equal(rows.length, 2);
  assert.ok(muted && !muted.pass && muted.fix && muted.fix.ratio >= 4.5);
  assert.ok(text && text.pass && text.fix === undefined);
});
