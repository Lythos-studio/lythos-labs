/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze, type Analysis, type RuleId } from "../src/analyze";
import { ACCESS_EXCLUSIVE, conflicts, MODES, ROW_EXCLUSIVE, SHARE, SHARE_ROW_EXCLUSIVE, SHARE_UPDATE_EXCLUSIVE, type Mode } from "../src/locks";
import { splitStatements } from "../src/sql";

const read = (sql: string, wrap = true): Analysis => {
  const r = analyze(sql, { wrap });
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  return r.analysis;
};
const ids = (sql: string, wrap = true) => read(sql, wrap).findings.map((f) => f.id);
const has = (sql: string, id: RuleId, wrap = true) => ids(sql, wrap).includes(id);

test("the conflict table is symmetric and matches the documentation for a few well-known pairs", () => {
  for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) assert.equal(conflicts(a as Mode, b as Mode), conflicts(b as Mode, a as Mode), `${MODES[a]} / ${MODES[b]}`);
  assert.ok(!conflicts(0, 2), "SELECT and UPDATE do not conflict at table level");
  assert.ok(conflicts(SHARE, ROW_EXCLUSIVE), "CREATE INDEX blocks writes");
  assert.ok(!conflicts(SHARE, 0), "CREATE INDEX lets reads through");
  assert.ok(conflicts(SHARE_UPDATE_EXCLUSIVE, SHARE_UPDATE_EXCLUSIVE), "two CONCURRENTLY builds on one table wait for each other");
  assert.ok(!conflicts(SHARE_UPDATE_EXCLUSIVE, ROW_EXCLUSIVE));
  for (let m = 0; m < 8; m++) assert.ok(conflicts(ACCESS_EXCLUSIVE, m as Mode));
});

test("statements split on semicolons outside strings, dollar quotes, quoted names and nested comments", () => {
  const sql = `-- head; comment
CREATE FUNCTION f() RETURNS trigger AS $body$ BEGIN NEW.a := 'x;y'; RETURN NEW; END $body$ LANGUAGE plpgsql;
/* outer /* inner; */ still comment; */
INSERT INTO "we;ird" VALUES (E'it\\'s;', 'a''b;');
\\set ON_ERROR_STOP on
SELECT 1`;
  const r = splitStatements(sql);
  assert.ok(r.ok);
  assert.equal(r.statements.length, 3);
  assert.equal(r.statements[1].line, 4);
  assert.equal(r.statements[2].toks[0].k, "SELECT");
  const bad = splitStatements("SELECT 'open;");
  assert.ok(!bad.ok && bad.line === 1);
  assert.deepEqual(analyze("  ").ok, false);
});

test("lock modes per statement follow the documentation", () => {
  const lockOf = (sql: string) => read(sql, false).steps.find((s) => s.locks.length)!.locks.map((l) => [l.table, MODES[l.mode]]);
  assert.deepEqual(lockOf("CREATE INDEX i ON orders (a)"), [["orders", "SHARE"]]);
  assert.deepEqual(lockOf("CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS i ON public.orders (a)"), [["orders", "SHARE UPDATE EXCLUSIVE"]]);
  assert.deepEqual(lockOf("ALTER TABLE orders ADD COLUMN a int"), [["orders", "ACCESS EXCLUSIVE"]]);
  assert.deepEqual(lockOf("ALTER TABLE orders ADD CONSTRAINT fk FOREIGN KEY (c) REFERENCES customers (id) NOT VALID"), [["orders", "SHARE ROW EXCLUSIVE"], ["customers", "SHARE ROW EXCLUSIVE"]]);
  assert.deepEqual(lockOf("ALTER TABLE orders VALIDATE CONSTRAINT fk"), [["orders", "SHARE UPDATE EXCLUSIVE"]]);
  assert.deepEqual(lockOf("LOCK TABLE a, b IN SHARE ROW EXCLUSIVE MODE"), [["a", "SHARE ROW EXCLUSIVE"], ["b", "SHARE ROW EXCLUSIVE"]]);
  assert.deepEqual(lockOf("LOCK orders"), [["orders", "ACCESS EXCLUSIVE"]]);
  assert.deepEqual(lockOf("CREATE TRIGGER t BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION f()"), [["orders", "SHARE ROW EXCLUSIVE"]]);
  assert.deepEqual(lockOf("VACUUM (ANALYZE) orders"), [["orders", "SHARE UPDATE EXCLUSIVE"]]);
  assert.deepEqual(lockOf("VACUUM FULL orders"), [["orders", "ACCESS EXCLUSIVE"]]);
  assert.deepEqual(lockOf('ALTER TABLE "Orders" ALTER COLUMN a SET STATISTICS 500'), [["Orders", "SHARE UPDATE EXCLUSIVE"]]);
  assert.deepEqual(lockOf("REFRESH MATERIALIZED VIEW CONCURRENTLY totals"), [["totals", "EXCLUSIVE"]]);
  // Several actions: the strongest lock per table, once.
  assert.deepEqual(lockOf("ALTER TABLE orders VALIDATE CONSTRAINT x, ADD COLUMN b int"), [["orders", "ACCESS EXCLUSIVE"]]);
  assert.equal(SHARE_ROW_EXCLUSIVE, 5);
});

test("work is found where Postgres reads or rewrites the table", () => {
  const work = (sql: string) => read(sql, false).steps.flatMap((s) => s.works.map((w) => w.kind));
  assert.deepEqual(work("ALTER TABLE t ADD COLUMN a text DEFAULT 'x'"), [], "constant default is stored, no rewrite (Postgres 11+)");
  assert.deepEqual(work("ALTER TABLE t ADD COLUMN a timestamptz NOT NULL DEFAULT now()"), [], "now() is stable");
  assert.deepEqual(work("ALTER TABLE t ADD COLUMN a uuid DEFAULT gen_random_uuid()"), ["rewrite"]);
  assert.deepEqual(work("ALTER TABLE t ADD COLUMN id bigserial"), ["rewrite"]);
  assert.deepEqual(work("ALTER TABLE t ADD COLUMN a int GENERATED ALWAYS AS (b * 2) STORED"), ["rewrite"]);
  assert.deepEqual(work("ALTER TABLE t ALTER COLUMN a TYPE bigint"), ["rewrite"]);
  assert.deepEqual(work("ALTER TABLE t ALTER COLUMN a SET NOT NULL"), ["scan"]);
  assert.deepEqual(work("ALTER TABLE t ADD CHECK (a > 0)"), ["scan"]);
  assert.deepEqual(work("ALTER TABLE t ADD CHECK (a > 0) NOT VALID"), []);
  assert.deepEqual(work("ALTER TABLE t ADD PRIMARY KEY (id)"), ["index"]);
  assert.deepEqual(work("ALTER TABLE t ADD CONSTRAINT t_pkey PRIMARY KEY USING INDEX t_idx"), []);
  assert.deepEqual(work("UPDATE t SET a = 1"), ["backfill"]);
  assert.deepEqual(work("UPDATE t SET a = 1 WHERE id = 3"), []);
  assert.deepEqual(work("CREATE TABLE n (id int); CREATE INDEX ON n (id); ALTER TABLE n ALTER COLUMN id SET NOT NULL"), [], "a new table is empty");
});

test("SET NOT NULL after a validated CHECK (col IS NOT NULL) does not scan", () => {
  const a = read(
    `ALTER TABLE t ADD CONSTRAINT t_a_nn CHECK (a IS NOT NULL) NOT VALID;
ALTER TABLE t VALIDATE CONSTRAINT t_a_nn;
ALTER TABLE t ALTER COLUMN a SET NOT NULL;`,
    false,
  );
  assert.deepEqual(a.steps[2].actions, ["set-not-null-checked"]);
  assert.deepEqual(a.steps[2].works, []);
  assert.ok(!a.findings.some((f) => f.id === "set-not-null-scans"));
});

test("findings name the risk and stay quiet for safe patterns and new tables", () => {
  assert.ok(has("CREATE INDEX i ON orders (a)", "index-not-concurrent"));
  assert.ok(has("CREATE INDEX CONCURRENTLY i ON orders (a)", "concurrently-in-transaction", true));
  assert.ok(!has("CREATE INDEX CONCURRENTLY i ON orders (a)", "concurrently-in-transaction", false));
  assert.ok(has("BEGIN; CREATE INDEX CONCURRENTLY i ON orders (a); COMMIT;", "concurrently-in-transaction", false));
  assert.ok(has("ALTER TABLE o ADD FOREIGN KEY (c) REFERENCES cu (id)", "fk-validates-under-lock"));
  assert.ok(has("ALTER TABLE o ADD COLUMN a int NOT NULL", "not-null-without-default"));
  assert.ok(!has("ALTER TABLE o ADD COLUMN a int NOT NULL DEFAULT 0", "not-null-without-default"));
  assert.ok(has("ALTER TABLE o ALTER COLUMN a TYPE text", "type-change-rewrite"));
  assert.ok(has("ALTER TABLE o RENAME COLUMN a TO b", "rename-breaks-clients"));
  assert.ok(has("DROP TABLE o", "destructive"));
  assert.ok(has("ALTER TABLE o ADD COLUMN a int", "no-lock-timeout"));
  assert.ok(!has("SET lock_timeout = '3s'; ALTER TABLE o ADD COLUMN a int", "no-lock-timeout"));
  assert.ok(!has("SET LOCAL lock_timeout TO 3000; ALTER TABLE o ADD COLUMN a int", "no-lock-timeout"));
  assert.ok(has("SET lock_timeout = 0; ALTER TABLE o ADD COLUMN a int", "no-lock-timeout"), "0 switches it off");
  assert.ok(has("DO $$ BEGIN PERFORM 1; END $$", "not-modeled"));

  const fresh = ids(`CREATE TABLE notes (id bigint PRIMARY KEY, customer_id bigint REFERENCES customers (id));
CREATE INDEX notes_customer_idx ON notes (customer_id);
ALTER TABLE notes ADD COLUMN body text NOT NULL;`);
  assert.ok(!fresh.includes("index-not-concurrent") && !fresh.includes("not-null-without-default"), fresh.join());
  assert.ok(fresh.includes("no-lock-timeout"), "the new table still locks customers for a moment");
});

test("a lock taken early in a transaction is reported when later work keeps it held", () => {
  const sql = "ALTER TABLE orders ADD COLUMN note text;\nCREATE INDEX CONCURRENTLY x ON other (a);\nALTER TABLE orders ADD CHECK (a > 0);";
  assert.ok(has(sql, "lock-held-in-transaction", true));
  assert.ok(!has(sql, "lock-held-in-transaction", false));
  const add = read("ALTER TABLE t ADD CONSTRAINT c CHECK (a > 0) NOT VALID;\nALTER TABLE t VALIDATE CONSTRAINT c;", true);
  assert.ok(add.findings.some((f) => f.id === "lock-held-in-transaction" && f.detail === "2"), "VALIDATE in the same transaction gains nothing");
});

test("explicit transactions are read from BEGIN and COMMIT", () => {
  const a = read("SET lock_timeout = '1s';\nBEGIN;\nALTER TABLE a ADD COLUMN x int;\nCOMMIT;\nCREATE INDEX CONCURRENTLY i ON a (x);", true);
  assert.equal(a.transaction, "explicit");
  assert.deepEqual(a.steps.map((s) => s.tx), [null, 0, 0, 0, null]);
  assert.ok(!a.findings.some((f) => f.id === "concurrently-in-transaction"));
});

test("limits are messages, not crashes", () => {
  assert.equal((analyze("SELECT 1;".repeat(501)) as { ok: false; error: { code: string } }).error.code, "too-many-statements");
  assert.equal((analyze("-- x\n".repeat(60_000)) as { ok: false; error: { code: string } }).error.code, "too-large");
  assert.equal((analyze("/* never closed") as { ok: false; error: { code: string } }).error.code, "unterminated");
});
