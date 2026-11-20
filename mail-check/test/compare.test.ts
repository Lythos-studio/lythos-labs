/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import type { Check } from "../src/checks";
import { diffChecks, forgetRuns, loadRuns, saveRun, toStored, type StorageLike } from "../src/compare";

const check = (id: Check["id"], level: Check["finding"]["level"], code: string): Check => ({ id, finding: { level, code } });
const NOW = new Date("2026-11-20T10:00:00Z");

function memory(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => void (data[k] = v),
    removeItem: (k) => void delete data[k],
  };
}

test("a run is stored as codes and levels only, with the date", () => {
  const run = toStored([check("spf", "fail", "spf-missing")], NOW);
  assert.deepEqual(run, { at: "2026-11-20T10:00:00.000Z", results: { spf: { level: "fail", code: "spf-missing" } } });
});

test("changes are reported with a direction, and equal results are not reported", () => {
  const before = toStored([check("spf", "fail", "spf-missing"), check("dmarc", "ok", "dmarc-ok"), check("mx", "ok", "mx-ok"), check("dkim", "warn", "dkim-none-found")], NOW);
  const changes = diffChecks(before, [
    check("spf", "ok", "spf-ok"),
    check("dmarc", "warn", "dmarc-monitoring-only"),
    check("mx", "ok", "mx-ok"),
    check("dkim", "unknown", "lookup-failed"),
  ]);
  assert.deepEqual(changes, [
    { id: "spf", from: "spf-missing", to: "spf-ok", direction: "better" },
    { id: "dmarc", from: "dmarc-ok", to: "dmarc-monitoring-only", direction: "worse" },
    { id: "dkim", from: "dkim-none-found", to: "lookup-failed", direction: "changed" },
  ]);
});

test("remembering round-trips per domain and keeps at most twenty domains", () => {
  const store = memory();
  for (let i = 0; i < 22; i++) assert.equal(saveRun(`d${i}.nl`, toStored([check("mx", "ok", "mx-ok")], new Date(NOW.getTime() + i * 1000)), store), true);
  const runs = loadRuns(store);
  assert.equal(Object.keys(runs).length, 20);
  assert.ok(runs["d21.nl"] && !runs["d0.nl"] && !runs["d1.nl"]);
});

test("broken, oversized or tampered storage is ignored without throwing", () => {
  for (const raw of ["{not json", "[]", '"x"', "null", '{"a.nl":{"at":1,"results":{}}}', '{"a.nl":{"at":"x","results":{"mx":{"level":"nope","code":"y"}}}}']) {
    assert.deepEqual(loadRuns(memory({ "lythos-mail-check-v1": raw })), {}, raw);
  }
  const valid = { "a.nl": { at: "2026-01-01T00:00:00.000Z", results: { mx: { level: "ok", code: "mx-ok" } } }, "b.nl": { at: 5 } };
  assert.deepEqual(Object.keys(loadRuns(memory({ "lythos-mail-check-v1": JSON.stringify(valid) }))), ["a.nl"]);
});

test("a blocked store neither crashes nor pretends to have saved", () => {
  const blocked: StorageLike = {
    getItem: () => { throw new Error("denied"); },
    setItem: () => { throw new Error("denied"); },
    removeItem: () => { throw new Error("denied"); },
  };
  assert.deepEqual(loadRuns(blocked), {});
  assert.equal(saveRun("a.nl", toStored([], NOW), blocked), false);
  assert.doesNotThrow(() => forgetRuns(blocked));
  assert.deepEqual(loadRuns(undefined), {});
});

test("forgetting removes everything", () => {
  const store = memory();
  saveRun("a.nl", toStored([check("mx", "ok", "mx-ok")], NOW), store);
  forgetRuns(store);
  assert.deepEqual(loadRuns(store), {});
});
