/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { NO_STRESS, expandText, isStressed, scaleTextVars } from "../src/lab/stress";

test("text sizes scale and nothing else does", () => {
  const vars = { "--lb-text-base": "1rem", "--lb-text-lg": "1.2rem", "--lb-space-4": "16px", "--lb-radius": "8px", "--lb-line-lg": "1.4" };
  assert.deepEqual(scaleTextVars(vars, 2), { "--lb-text-base": "2rem", "--lb-text-lg": "2.4rem", "--lb-space-4": "16px", "--lb-radius": "8px", "--lb-line-lg": "1.4" });
  assert.equal(scaleTextVars(vars, 1), vars, "no change returns the same object");
  assert.equal(scaleTextVars({ "--lb-text-sm": "0.8rem" }, 1.5)["--lb-text-sm"], "1.2rem");
});

test("longer text: about 40% longer words, or a long compound on every word, and short words and symbols are left alone", () => {
  assert.equal(expandText("Save", "normal"), "Save");
  const plus = expandText("Save changes now", "plus40");
  assert.ok(plus.length >= "Save changes now".length * 1.3 && plus.length <= "Save changes now".length * 1.6, plus);
  assert.ok(plus.startsWith("Save") && plus.includes("changes"));
  assert.equal(expandText("OK", "long"), "OK");
  assert.equal(expandText("Save!", "long"), "Saveafhandelingsovereenkomst!");
  assert.equal(expandText("12 ✓ -", "long"), "12 ✓ -");
  assert.equal(expandText("", "long"), "");
  assert.equal(expandText("Déjà", "long"), "Déjàafhandelingsovereenkomst");
});

test("a stress object that equals the default is not counted as stressed", () => {
  assert.equal(isStressed(NO_STRESS), false);
  assert.equal(isStressed({ ...NO_STRESS, dir: "rtl" }), true);
});
