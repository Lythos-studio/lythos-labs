/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze, type Analysis } from "../src/analyze";
import { DEFAULT_TRAFFIC, simulate, type Traffic } from "../src/simulate";

const read = (sql: string, wrap = true): Analysis => {
  const r = analyze(sql, { wrap });
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  return r.analysis;
};
const traffic = (over: Partial<Traffic> = {}): Traffic => ({ ...DEFAULT_TRAFFIC, ...over });

test("an instant ALTER TABLE behind a slow query stops every read and write until the slow query ends", () => {
  const a = read("ALTER TABLE orders ADD COLUMN note text;");
  const sim = simulate(a, { traffic: traffic({ slowMs: 15_000, appTimeoutMs: 0 }) });
  assert.equal(sim.outcome, "done");
  const lane = sim.lanes[0];
  // Slow query 0.5 s to 15.5 s, migration asks at 3 s: everything after 3 s waits about 12.5 s.
  assert.ok(lane.maxWaitMs > 12_000 && lane.maxWaitMs < 13_000, String(lane.maxWaitMs));
  assert.ok(lane.delayed > 2000, String(lane.delayed));
  assert.ok(sim.finishedAt! > 15_000 && sim.finishedAt! < 15_600, String(sim.finishedAt));
  assert.ok(lane.maxWaiting > 2500, String(lane.maxWaiting));
});

test("the same statement with lock_timeout and retries gives up quickly, lets traffic through and finishes later", () => {
  const a = read("SET lock_timeout = '2s';\nALTER TABLE orders ADD COLUMN note text;", false);
  const sim = simulate(a, { traffic: traffic({ slowMs: 15_000 }), retry: { attempts: 10, delayMs: 3000 } });
  assert.equal(sim.outcome, "done");
  assert.ok(sim.lanes[0].maxWaitMs <= 2001, String(sim.lanes[0].maxWaitMs));
  assert.ok(sim.attempts.filter((x) => x.outcome === "lock-timeout").length >= 2);
  assert.ok(sim.finishedAt! > 15_500);
  assert.equal(sim.lanes[0].timedOut, 0);
});

test("without retries a lock timeout fails the migration and nothing waits longer than the timeout", () => {
  const sim = simulate(read("SET lock_timeout TO 1000;\nALTER TABLE orders DROP COLUMN legacy;", false), { traffic: traffic() });
  assert.equal(sim.outcome, "failed");
  assert.ok(sim.lanes[0].maxWaitMs <= 1001);
});

test("CREATE INDEX blocks writes for the build but never reads; CONCURRENTLY blocks neither", () => {
  const rows = { orders: 7_500_000 }; // 10 s at 750k rows/s
  const plain = simulate(read("CREATE INDEX orders_status_idx ON orders (status);"), { traffic: traffic({ slowMs: 0, rows, appTimeoutMs: 0 }) });
  const lane = plain.lanes[0];
  assert.ok(lane.maxWaitMs > 9_000 && lane.maxWaitMs < 10_500, String(lane.maxWaitMs));
  const readsDelayed = lane.dots.filter((d) => !d.write && d.s - d.a > 100).length;
  assert.equal(readsDelayed, 0, "reads pass a SHARE lock");
  assert.ok(lane.dots.some((d) => d.write && d.s - d.a > 5000));

  const safe = simulate(read("CREATE INDEX CONCURRENTLY orders_status_idx ON orders (status);", false), { traffic: traffic({ slowMs: 0, rows }) });
  assert.ok(safe.lanes[0].maxWaitMs < 50, String(safe.lanes[0].maxWaitMs));
  assert.ok(safe.finishedAt! > 3000 + 19_000, "two passes");
});

test("a transaction holds an early ACCESS EXCLUSIVE lock through a later slow step", () => {
  const sql = "ALTER TABLE orders ADD COLUMN note text;\nCREATE INDEX orders_note_idx ON orders (note);";
  const rows = { orders: 3_000_000 }; // 4 s index
  const wrapped = simulate(read(sql, true), { traffic: traffic({ slowMs: 0, rows, appTimeoutMs: 0 }) });
  const free = simulate(read(sql, false), { traffic: traffic({ slowMs: 0, rows, appTimeoutMs: 0 }) });
  const readWait = (s: typeof wrapped) => Math.max(0, ...s.lanes[0].dots.filter((d) => !d.write).map((d) => d.s - d.a));
  assert.ok(readWait(wrapped) > 3500, `reads wait for the index while the ALTER lock is held (${readWait(wrapped)})`);
  assert.ok(readWait(free) < 50, `reads pass when each statement commits (${readWait(free)})`);
});

test("applications that give up count as timed out and the numbers are deterministic", () => {
  const a = read("ALTER TABLE orders ADD COLUMN note text;");
  const one = simulate(a, { traffic: traffic({ slowMs: 20_000, appTimeoutMs: 5000 }) });
  const two = simulate(a, { traffic: traffic({ slowMs: 20_000, appTimeoutMs: 5000 }) });
  assert.ok(one.totals.timedOut > 1000);
  assert.ok(one.totals.maxWaitMs <= 5001);
  assert.deepEqual(one.totals, two.totals);
});

test("a foreign key locks both tables against writes while it validates", () => {
  const a = read("ALTER TABLE invoices ADD CONSTRAINT invoices_customer_fk FOREIGN KEY (customer_id) REFERENCES customers (id);");
  assert.deepEqual(a.tables, ["invoices", "customers"]);
  const sim = simulate(a, { traffic: traffic({ slowMs: 0, rows: { invoices: 5_000_000 }, appTimeoutMs: 0 }) });
  for (const lane of sim.lanes) assert.ok(lane.dots.some((d) => d.write && d.s - d.a > 4000), lane.table);
  for (const lane of sim.lanes) assert.ok(!lane.dots.some((d) => !d.write && d.s - d.a > 50), lane.table);
});

test("a long simulation stops at the cap and says so", () => {
  const sim = simulate(read("UPDATE events SET processed = false;"), { traffic: traffic({ slowMs: 0, rows: { events: 100_000_000 } }), maxMs: 60_000 });
  assert.equal(sim.outcome, "cut");
  assert.equal(sim.endMs, 60_000);
  assert.ok(sim.attempts[0].outcome === "cut");
});
