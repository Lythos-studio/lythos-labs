# Lock lab

Paste a Postgres migration and watch what its locks do to live traffic, before production does. Next to it, the same migration written the careful way, replayed against exactly the same traffic.

Try it at [labs.lythos.nl/lock-lab](https://labs.lythos.nl/lock-lab) (Dutch: [/nl/lock-lab](https://labs.lythos.nl/nl/lock-lab)). Status: prototype.

- **A replay, not a list of warnings.** Every query is a dot that passes a gate per table. When a statement takes a lock that conflicts, or waits for one, the gate closes and you see queries pile up, turn red, and give up after your application's timeout. Both versions run on one clock, with the queue size over time drawn above each.
- **The real lock queue rules.** The replay is an event simulation of the Postgres lock manager: a request waits when it conflicts with a granted lock or with a request already waiting ahead of it. That second rule is why an "instant" `ALTER TABLE ... ADD COLUMN` behind one slow query stops every read and write on the table.
- **Which lock, per statement.** About forty statement forms are read: `ALTER TABLE` actions (add column with constant or volatile default, set not null, type changes, foreign keys and checks with and without `NOT VALID`, unique and primary keys with and without `USING INDEX`, renames, triggers, partitions), `CREATE INDEX` and `REINDEX` with and without `CONCURRENTLY`, `DROP`, `TRUNCATE`, `VACUUM FULL`, `CLUSTER`, `REFRESH MATERIALIZED VIEW`, `LOCK TABLE`, whole-table `UPDATE` and `DELETE`, and `SET lock_timeout` and `statement_timeout`. Transactions come from `BEGIN` and `COMMIT`, or from a switch for runners that wrap every file in one (most do).
- **Eighteen explained rules**, each with what it found, why it matters and when it is fine.
- **A safer version, written for you.** `lock_timeout` first, every statement in its own transaction, `CONCURRENTLY` for indexes, `NOT VALID` plus `VALIDATE` for constraints, the validated `CHECK (col IS NOT NULL)` pattern for `SET NOT NULL`, `CREATE UNIQUE INDEX CONCURRENTLY` plus `USING INDEX` for unique and primary keys, and a separate `SET DEFAULT` for volatile defaults. What cannot be rewritten safely (type changes, rewrites, whole-table updates) stays as written with a comment that says what to decide. The safer file is analysed and replayed with the same engine, with retries after a lock timeout.
- **Your SQL stays yours.** Everything runs in the browser; nothing is uploaded, stored or put in the address bar.

## Command line and CI

```bash
npx tsx bin/lock-lab.ts migrations/*.sql                          # text report, exit code 1 on a fail
npx tsx bin/lock-lab.ts migrations/042_orders.sql --safer           # also print the safer version
npx tsx bin/lock-lab.ts migrations/*.sql --format github --fail-on fail
npx tsx bin/lock-lab.ts migrations/*.sql --no-transaction           # the runner does not wrap files in a transaction
npx tsx bin/lock-lab.ts --list-rules
```

Exit codes: 0 nothing at or above `--fail-on` (default `fail`), 1 findings at or above it, 2 usage, read or parse error. Findings carry the line of the statement. A GitHub Actions step, checking only migrations changed in the pull request:

```yaml
- uses: actions/checkout@v4
  with: { fetch-depth: 0 }
- uses: actions/setup-node@v4
  with: { node-version: 22 }
- run: npm ci
- run: |
    files=$(git diff --name-only --diff-filter=A origin/${{ github.base_ref }}... -- 'migrations/*.sql')
    [ -z "$files" ] || npx tsx packages/labs/lock-lab/bin/lock-lab.ts $files --format github
```

## What it cannot tell

It does not connect to a database, so it cannot see real table sizes, indexes, old column types or running queries; a type change is shown as a rewrite even when it is binary compatible. Work time is an estimate from the row count (about 3 million rows per second for a scan, 1 million for a foreign key check, 750 thousand for an index build, 300 thousand for a rewrite, 80 thousand for an UPDATE of every row). A whole-table UPDATE is shown as blocking all writes, which is pessimistic. Functions, `DO` blocks and unknown statements are assumed to take no table lock. Row locks of normal traffic, deadlocks, replication lag and autovacuum are not simulated. The lock modes follow the documentation for Postgres 12 and later. It is a model with assumptions, not a guarantee: try the safer version on a copy of production first.

## Use

```ts
import { analyze, simulate, saferMigration, lockLabCopy, DEFAULT_TRAFFIC } from "@lythos-labs/lock-lab";

const result = analyze(sql, { wrap: true }); // { ok: true, analysis } or { ok: false, error }
if (result.ok) {
  const { steps, findings, tables } = result.analysis; // locks and work per statement, findings worst first
  const replay = simulate(result.analysis, { traffic: { ...DEFAULT_TRAFFIC, rows: { orders: 4_000_000 } } });
  const safer = saferMigration(sql, result.analysis, lockLabCopy.en.safe); // { sql, rewritten, manual }
}
```

`LockLab` is a React 19 client component with English and Dutch copy (`<LockLab locale="en" />`). Its styles are a CSS module, so use a bundler that supports CSS modules. It makes no network requests and renders no inline style attributes, so the host page needs no extra Content-Security-Policy entry. It reads `--max`, `--gutter` and `--font-mono` from its surroundings and is designed for a dark page. It has no runtime dependencies besides React.

The examples in `src/examples.ts` are invented and describe no real system.

## Develop

```bash
npm install
npm test
npm run typecheck
```

## License

[Mozilla Public License 2.0](LICENSE). The Lythos name and logo are not covered by this license.
