/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, addMonths, clamp, daysInMonth, firstWeekday, fromIso, monthGrid, toIso } from "../src/core/date";

test("month lengths including leap years", () => {
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(daysInMonth(2025, 2), 28);
  assert.equal(daysInMonth(2025, 12), 31);
});

test("weekday of the first day is Monday-based", () => {
  assert.equal(firstWeekday(2026, 11), 6); // 1 Nov 2026 is a Sunday
  assert.equal(firstWeekday(2026, 6), 0); // 1 Jun 2026 is a Monday
});

test("adding days and months rolls over and clamps", () => {
  assert.deepEqual(addDays({ y: 2026, m: 12, d: 31 }, 1), { y: 2027, m: 1, d: 1 });
  assert.deepEqual(addDays({ y: 2026, m: 3, d: 1 }, -1), { y: 2026, m: 2, d: 28 });
  assert.deepEqual(addMonths({ y: 2026, m: 1, d: 31 }, 1), { y: 2026, m: 2, d: 28 });
  assert.deepEqual(addMonths({ y: 2026, m: 1, d: 15 }, -1), { y: 2025, m: 12, d: 15 });
  assert.deepEqual(addMonths({ y: 2026, m: 11, d: 5 }, 14), { y: 2028, m: 1, d: 5 });
});

test("ISO parsing is strict", () => {
  assert.deepEqual(fromIso("2026-02-28"), { y: 2026, m: 2, d: 28 });
  assert.equal(fromIso("2026-02-30"), null);
  assert.equal(fromIso("2026-13-01"), null);
  assert.equal(fromIso("26-1-1"), null);
  assert.equal(toIso({ y: 2026, m: 3, d: 4 }), "2026-03-04");
});

test("clamp keeps a date inside the range", () => {
  const min = { y: 2026, m: 1, d: 10 };
  const max = { y: 2026, m: 1, d: 20 };
  assert.deepEqual(clamp({ y: 2026, m: 1, d: 5 }, min, max), min);
  assert.deepEqual(clamp({ y: 2026, m: 2, d: 1 }, min, max), max);
});

test("month grid has full weeks and every day once", () => {
  const grid = monthGrid(2026, 11);
  assert.ok(grid.every((w) => w.length === 7));
  const days = grid.flat().filter(Boolean);
  assert.equal(days.length, 30);
  assert.equal(grid[0][6]?.d, 1);
});
