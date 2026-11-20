/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { brandLabCopy } from "../src/copy";

const shape = (value: unknown): unknown =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, shape(v)]))
    : Array.isArray(value)
      ? value.map(shape)
      : typeof value;

const strings = (value: unknown): string[] =>
  typeof value === "string" ? [value] : value && typeof value === "object" ? Object.values(value).flatMap(strings) : [];

test("English and Dutch have the same keys, all the way down", () => {
  assert.deepEqual(shape(brandLabCopy.nl), shape(brandLabCopy.en));
});

test("the new upgrade copy exists", () => {
  for (const key of ["matrixTitle", "apcaNote", "cvdOptions", "scalesTitle", "accentTitle", "importTitle", "importErrors", "importNotes", "wcagClasses", "roleNames"])
    assert.ok(key in brandLabCopy.en, key);
});

test("no em dash and no emoji in any copy", () => {
  for (const text of [...strings(brandLabCopy.en), ...strings(brandLabCopy.nl)]) {
    assert.ok(!text.includes("—"), text);
    assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text), text);
  }
});

test("the new maps cover the same keys in both languages", () => {
  for (const key of ["roleNames", "wcagClasses", "cvdOptions", "importErrors", "importNotes"] as const)
    assert.deepEqual(Object.keys(brandLabCopy.nl[key]).sort(), Object.keys(brandLabCopy.en[key]).sort(), key);
});
