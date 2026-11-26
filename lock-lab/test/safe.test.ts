/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { analyze, type Analysis } from "../src/analyze";
import { lockLabCopy } from "../src/copy";
import { EXAMPLES } from "../src/examples";
import { saferMigration } from "../src/safe";
import { DEFAULT_TRAFFIC, simulate } from "../src/simulate";

const read = (sql: string, wrap = true): Analysis => {
  const r = analyze(sql, { wrap });
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  return r.analysis;
};
const safer = (sql: string, wrap = true) => saferMigration(sql, read(sql, wrap), lockLabCopy.en.safe);
const fails = (sql: string) => read(sql, false).findings.filter((f) => f.level === "fail").map((f) => f.id);

test("the safer version uses CONCURRENTLY, NOT VALID plus VALIDATE, the CHECK pattern and lock_timeout", () => {
  const out = safer(`CREATE INDEX orders_status_idx ON orders (status);
ALTER TABLE invoices ADD FOREIGN KEY (customer_id) REFERENCES customers (id);
ALTER TABLE invoices ALTER COLUMN customer_id SET NOT NULL;
ALTER TABLE events ADD CONSTRAINT events_public_id_key UNIQUE (public_id);
ALTER TABLE events ADD COLUMN token uuid NOT NULL DEFAULT gen_random_uuid();`).sql;
  assert.match(out, /^SET lock_timeout = '2s';$/m);
  assert.match(out, /^CREATE INDEX CONCURRENTLY orders_status_idx ON orders \(status\);$/m);
  assert.match(out, /^ALTER TABLE invoices ADD CONSTRAINT invoices_customer_id_fkey FOREIGN KEY \(customer_id\) REFERENCES customers \(id\) NOT VALID;$/m);
  assert.match(out, /^ALTER TABLE invoices VALIDATE CONSTRAINT invoices_customer_id_fkey;$/m);
  assert.match(out, /^ALTER TABLE invoices ADD CONSTRAINT invoices_customer_id_not_null CHECK \(customer_id IS NOT NULL\) NOT VALID;$/m);
  assert.match(out, /^ALTER TABLE invoices DROP CONSTRAINT invoices_customer_id_not_null;$/m);
  assert.match(out, /^CREATE UNIQUE INDEX CONCURRENTLY events_public_id_key ON events \(public_id\);$/m);
  assert.match(out, /^ALTER TABLE events ADD CONSTRAINT events_public_id_key UNIQUE USING INDEX events_public_id_key;$/m);
  assert.match(out, /^ALTER TABLE events ADD COLUMN token uuid;$/m);
  assert.match(out, /^ALTER TABLE events ALTER COLUMN token SET DEFAULT gen_random_uuid\(\);$/m);
  assert.deepEqual(fails(out), [], "nothing left that holds a blocking lock while working");
});

test("comments above a statement are kept, BEGIN and COMMIT are dropped, and existing settings are respected", () => {
  const out = safer("SET lock_timeout = '5s';\nBEGIN;\n-- why we need it\nCREATE INDEX i ON t (a);\nCOMMIT;").sql;
  assert.ok(!/^BEGIN|^COMMIT/m.test(out));
  assert.ok(!out.includes("'2s'"));
  assert.match(out, /-- why we need it\n-- .*\nCREATE INDEX CONCURRENTLY i ON t \(a\);/);
});

test("what cannot be rewritten safely stays as written with a comment", () => {
  const r = safer("ALTER TABLE t ALTER COLUMN a TYPE bigint;\nUPDATE t SET b = 0;\nALTER TABLE t ADD COLUMN c int, ADD CHECK (c > 0);");
  assert.equal(r.manual.length, 3);
  assert.match(r.sql, /^ALTER TABLE t ALTER COLUMN a TYPE bigint;$/m);
  assert.match(r.sql, /^UPDATE t SET b = 0;$/m);
});

test("quoted and schema-qualified names stay correct", () => {
  const out = safer('ALTER TABLE app."Order" ALTER COLUMN "userId" SET NOT NULL;').sql;
  assert.match(out, /^ALTER TABLE app\."Order" ADD CONSTRAINT "Order_userId_not_null" CHECK \("userId" IS NOT NULL\) NOT VALID;$/m);
  assert.ok(read(out, false).steps.some((s) => s.actions.includes("set-not-null-checked")), "the safer file is itself recognised as safe");
});

test("every example: the safer version keeps traffic moving where the original stalls it", () => {
  for (const ex of EXAMPLES) {
    const a = read(ex.sql, ex.wrap);
    const s = saferMigration(ex.sql, a, lockLabCopy.nl.safe);
    const b = read(s.sql, false);
    const traffic = { ...DEFAULT_TRAFFIC, rows: ex.rows };
    const before = simulate(a, { traffic });
    const after = simulate(b, { traffic, retry: { attempts: 20, delayMs: 3000 } });
    assert.equal(after.outcome, "done", ex.id);
    assert.ok(after.totals.maxWaitMs <= 2100, `${ex.id}: ${after.totals.maxWaitMs}`);
    assert.equal(after.totals.timedOut, 0, ex.id);
    if (ex.id !== "careful") assert.ok(before.totals.maxWaitMs > 9000, `${ex.id}: ${before.totals.maxWaitMs}`);
  }
});

// Dogfooding: every migration in the Lythos monorepo is read without errors. Skipped in the public mirror, which has no migrations folder.
const dir = new URL("../../../../migrations/", import.meta.url);
test("every Lythos migration is read without an error", { skip: !existsSync(dir) }, () => {
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql"));
  assert.ok(files.length > 10);
  for (const f of files) {
    const sql = readFileSync(new URL(f, dir), "utf8");
    const r = analyze(sql, { wrap: true });
    assert.ok(r.ok, `${f}: ${JSON.stringify(!r.ok && r.error)}`);
    saferMigration(sql, r.analysis, lockLabCopy.en.safe);
  }
});
