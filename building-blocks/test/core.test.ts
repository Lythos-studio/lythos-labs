/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { nextIndex } from "../src/core/roving";
import { createTypeahead } from "../src/core/typeahead";
import { computePosition } from "../src/core/position";
import { createAnnounceQueue } from "../src/core/announce-queue";

test("nextIndex moves with the arrows of its orientation, wraps, and jumps with Home and End", () => {
  assert.equal(nextIndex(0, "ArrowRight", 3, { orientation: "horizontal" }), 1);
  assert.equal(nextIndex(2, "ArrowRight", 3, { orientation: "horizontal" }), 0, "wraps");
  assert.equal(nextIndex(2, "ArrowRight", 3, { orientation: "horizontal", wrap: false }), 2, "stops at the end without wrap");
  assert.equal(nextIndex(0, "ArrowLeft", 3, { orientation: "horizontal" }), 2);
  assert.equal(nextIndex(1, "ArrowDown", 3, { orientation: "vertical" }), 2);
  assert.equal(nextIndex(1, "ArrowRight", 3, { orientation: "vertical" }), 1, "ignores the other axis");
  assert.equal(nextIndex(1, "ArrowDown", 3, { orientation: "both" }), 2);
  assert.equal(nextIndex(1, "ArrowRight", 3, { orientation: "both" }), 2);
  assert.equal(nextIndex(2, "Home", 3), 0);
  assert.equal(nextIndex(0, "End", 3), 2);
  assert.equal(nextIndex(1, "a", 3), 1, "other keys change nothing");
});

test("nextIndex mirrors left and right in RTL, skips disabled items and survives an empty list", () => {
  assert.equal(nextIndex(0, "ArrowLeft", 3, { orientation: "horizontal", rtl: true }), 1);
  assert.equal(nextIndex(0, "ArrowRight", 3, { orientation: "horizontal", rtl: true }), 2);
  assert.equal(nextIndex(0, "ArrowRight", 4, { orientation: "horizontal", skip: (i) => i === 1 || i === 2 }), 3);
  assert.equal(nextIndex(0, "Home", 4, { skip: (i) => i === 0 }), 1);
  assert.equal(nextIndex(3, "End", 4, { skip: (i) => i === 3 }), 2);
  assert.equal(nextIndex(0, "ArrowRight", 0), -1);
  assert.equal(nextIndex(-1, "ArrowRight", 3, { orientation: "horizontal" }), 0, "no current item: the first");
  assert.equal(nextIndex(-1, "ArrowLeft", 3, { orientation: "horizontal" }), 2, "no current item: the last");
  assert.equal(nextIndex(0, "ArrowRight", 3, { orientation: "horizontal", skip: () => true }), 0, "everything disabled: stay");
});

test("typeahead finds by prefix, cycles a repeated letter, forgets after a pause and ignores accents and case", () => {
  let t = 0;
  const ta = createTypeahead(500, () => t);
  const labels = ["Apple", "Banana", "Blueberry", "Cherry", "Élan"];
  assert.equal(ta.type("b", labels, 0), 1);
  t = 100;
  assert.equal(ta.type("l", labels, 1), 2, "bl matches Blueberry");
  t = 1000;
  assert.equal(ta.type("b", labels, 2), 1, "after a pause the search starts over, after the current item it wraps");
  t = 1100;
  assert.equal(ta.type("b", labels, 1), 2, "the same letter again cycles");
  t = 3000;
  assert.equal(ta.type("e", labels, 0), 4, "accents and case are ignored");
  assert.equal(ta.type("z", labels, 0), -1);
  assert.equal(ta.type("Enter", labels, 0), -1, "not a character");
  assert.equal(ta.type("a", [], 0), -1);
});

test("computePosition places below, flips above when there is no room, and shifts back into the viewport", () => {
  const vp = { width: 400, height: 300 };
  const below = computePosition({ x: 100, y: 50, width: 80, height: 30 }, { width: 120, height: 60 }, vp, "bottom");
  assert.deepEqual([below.placement, below.y], ["bottom", 88]);
  const flipped = computePosition({ x: 100, y: 250, width: 80, height: 30 }, { width: 120, height: 60 }, vp, "bottom");
  assert.equal(flipped.placement, "top");
  assert.equal(flipped.y, 250 - 8 - 60);
  const shifted = computePosition({ x: 380, y: 50, width: 20, height: 30 }, { width: 120, height: 60 }, vp, "bottom", { align: "start" });
  assert.ok(shifted.x + 120 <= 400 - 8, String(shifted.x));
  const tooBig = computePosition({ x: 10, y: 10, width: 10, height: 10 }, { width: 900, height: 900 }, vp, "bottom");
  assert.ok(Number.isFinite(tooBig.x) && Number.isFinite(tooBig.y));
});

test("the announcement queue drops an identical message sent twice in a short time and keeps order", () => {
  const q = createAnnounceQueue(500);
  assert.deepEqual(q.push("Saved", "polite", 0), { emit: true });
  assert.deepEqual(q.push("Saved", "polite", 100), { emit: false });
  assert.deepEqual(q.push("Saved", "polite", 900), { emit: true });
  assert.deepEqual(q.push("Saved", "assertive", 950), { emit: true }, "another politeness is another message");
  assert.deepEqual(q.push("", "polite", 2000), { emit: false }, "empty messages are never announced");
  assert.deepEqual(q.log().map((e) => e.message), ["Saved", "Saved", "Saved"]);
});
