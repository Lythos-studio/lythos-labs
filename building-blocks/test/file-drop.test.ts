/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { validateFiles } from "../src/blocks/file-drop/file-drop";

const f = (name: string, type: string, size: number) => ({ name, type, size });

test("accepts by mime, wildcard and extension", () => {
  const r = validateFiles([f("a.pdf", "application/pdf", 1), f("b.PNG", "", 1), f("c.jpg", "image/jpeg", 1), f("d.txt", "text/plain", 1)], { accept: ["application/pdf", ".png", "image/*"] });
  assert.deepEqual(r.accepted.map((x) => x.name), ["a.pdf", "b.PNG", "c.jpg"]);
  assert.deepEqual(r.rejected, [{ name: "d.txt", reason: "type" }]);
});

test("rejects too large files and too many files", () => {
  const r = validateFiles([f("a", "x", 5), f("b", "x", 50), f("c", "x", 5), f("d", "x", 5)], { maxSize: 10, maxFiles: 2 });
  assert.deepEqual(r.accepted.map((x) => x.name), ["a", "c"]);
  assert.deepEqual(r.rejected, [{ name: "b", reason: "size" }, { name: "d", reason: "count" }]);
});

test("no rules accepts everything", () => {
  assert.equal(validateFiles([f("a", "x", 1e9)], {}).accepted.length, 1);
});
