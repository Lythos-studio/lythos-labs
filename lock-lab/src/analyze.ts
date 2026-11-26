/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import {
  ACCESS_EXCLUSIVE,
  blocksReads,
  blocksWrites,
  EXCLUSIVE,
  modeFromWords,
  ROW_EXCLUSIVE,
  SHARE,
  SHARE_ROW_EXCLUSIVE,
  SHARE_UPDATE_EXCLUSIVE,
  type Mode,
} from "./locks";
import { columnList, Cursor, splitStatements, splitTop, type Statement, type Tok } from "./sql";

export const LIMITS = { chars: 256 * 1024, statements: 500 } as const;

/** Work a statement does over the rows of a table while it holds its locks. */
export type WorkKind = "scan" | "validate" | "index" | "rewrite" | "backfill";
export type Work = { kind: WorkKind; table: string };

export type ActionKind =
  | "add-column"
  | "add-column-rewrite"
  | "add-column-not-null"
  | "drop-column"
  | "alter-type"
  | "set-not-null"
  | "set-not-null-checked"
  | "drop-not-null"
  | "set-default"
  | "drop-default"
  | "add-fk"
  | "add-fk-not-valid"
  | "add-check"
  | "add-check-not-valid"
  | "add-unique"
  | "add-unique-using-index"
  | "validate"
  | "drop-constraint"
  | "rename-column"
  | "rename-table"
  | "rename-other"
  | "trigger-toggle"
  | "rewrite-other"
  | "partition"
  | "other";

export type StepKind =
  | "begin"
  | "commit"
  | "rollback"
  | "set"
  | "create-table"
  | "create-index"
  | "create-index-concurrently"
  | "drop-index"
  | "drop-index-concurrently"
  | "reindex"
  | "reindex-concurrently"
  | "alter-table"
  | "drop-table"
  | "truncate"
  | "vacuum"
  | "vacuum-full"
  | "cluster"
  | "refresh-view"
  | "refresh-view-concurrently"
  | "lock-table"
  | "update"
  | "delete"
  | "insert"
  | "create-trigger"
  | "drop-trigger"
  | "comment"
  | "no-table-lock"
  | "unknown";

export type Lock = { table: string; mode: Mode; /** A backfill: shown as blocking writes because it locks every row it touches. */ rows?: boolean };

export type Step = {
  index: number;
  line: number;
  start: number;
  end: number;
  text: string;
  kind: StepKind;
  actions: ActionKind[];
  /** The main table, for labels. */
  table: string | null;
  locks: Lock[];
  works: Work[];
  /** CONCURRENTLY: blocks no traffic, but waits for older transactions to finish. */
  concurrent: boolean;
  /** Transaction this step runs in, or null when it commits on its own. */
  tx: number | null;
  /** For SET: the timeout it sets, in milliseconds (0 means off). */
  set?: { name: "lock_timeout" | "statement_timeout"; ms: number };
  /** Constraint and index names this step adds, for the safer rewrite. */
  names: string[];
};

export type Level = "fail" | "warn" | "info";
export type RuleId =
  | "index-not-concurrent"
  | "concurrently-in-transaction"
  | "fk-validates-under-lock"
  | "check-validates-under-lock"
  | "set-not-null-scans"
  | "unique-builds-index"
  | "column-rewrite"
  | "type-change-rewrite"
  | "table-rewrite"
  | "not-null-without-default"
  | "reindex-blocks"
  | "unbatched-backfill"
  | "no-lock-timeout"
  | "lock-held-in-transaction"
  | "destructive"
  | "rename-breaks-clients"
  | "explicit-lock"
  | "not-modeled";

export const RULES: Record<RuleId, Level> = {
  "concurrently-in-transaction": "fail",
  "not-null-without-default": "fail",
  "index-not-concurrent": "fail",
  "fk-validates-under-lock": "fail",
  "check-validates-under-lock": "fail",
  "set-not-null-scans": "fail",
  "unique-builds-index": "fail",
  "column-rewrite": "fail",
  "type-change-rewrite": "fail",
  "table-rewrite": "fail",
  "reindex-blocks": "fail",
  "lock-held-in-transaction": "warn",
  "unbatched-backfill": "warn",
  "no-lock-timeout": "warn",
  "destructive": "warn",
  "rename-breaks-clients": "warn",
  "explicit-lock": "info",
  "not-modeled": "info",
};

export type Finding = { id: RuleId; level: Level; step: number; line: number; table: string; detail: string };

export type AnalyzeOptions = { /** The migration tool runs the whole file in one transaction (most do). */ wrap: boolean };
export type Analysis = {
  steps: Step[];
  findings: Finding[];
  /** Existing tables the file takes locks on, in order of first use. */
  tables: string[];
  /** Tables the file creates; they are empty, so work on them is instant. */
  created: string[];
  transaction: "explicit" | "wrapped" | "none";
};
export type AnalyzeError = { code: "empty" | "too-large" | "too-many-statements" | "unterminated"; line?: number };
export type AnalyzeResult = { ok: true; analysis: Analysis } | { ok: false; error: AnalyzeError };

// Functions whose value differs per row, so a DEFAULT with them rewrites the table (Postgres 11+ stores other defaults).
const VOLATILE = new Set(["random", "gen_random_uuid", "uuid_generate_v1", "uuid_generate_v1mc", "uuid_generate_v4", "uuidv4", "uuidv7", "clock_timestamp", "timeofday", "nextval", "txid_current", "statement_timestamp"]);
const SERIAL = new Set(["serial", "bigserial", "smallserial", "serial2", "serial4", "serial8"]);
// Column-constraint keywords that end a type or a DEFAULT expression.
const CONSTRAINT_WORDS = new Set(["NOT", "NULL", "DEFAULT", "CHECK", "REFERENCES", "UNIQUE", "PRIMARY", "CONSTRAINT", "GENERATED", "COLLATE"]);

function parseDuration(tok: Tok | undefined, unit: Tok | undefined): number | null {
  if (!tok) return null;
  const text = tok.t === "str" ? tok.v.trim() : tok.v + (unit && unit.t === "word" ? unit.v : "");
  const m = /^(\d+(?:\.\d+)?)\s*(ms|s|min|h)?$/i.exec(text);
  if (!m) return tok.k === "DEFAULT" ? 0 : null;
  const n = Number(m[1]);
  const factor = { ms: 1, s: 1000, min: 60_000, h: 3_600_000 }[(m[2] ?? "ms").toLowerCase() as "ms"];
  return Math.round(n * factor);
}

type Ctx = {
  created: Set<string>;
  /** Constraints added as CHECK (col IS NOT NULL) NOT VALID, by name, so a later VALIDATE makes SET NOT NULL instant. */
  notNullChecks: Map<string, { table: string; column: string }>;
  validatedNotNull: Set<string>;
  indexTables: Map<string, string>;
};

type Partial = Omit<Step, "index" | "line" | "start" | "end" | "text" | "tx">;
const base = (kind: StepKind, table: string | null = null): Partial => ({ kind, actions: [], table, locks: [], works: [], concurrent: false, names: [] });

function readAlterAction(toks: Tok[], table: string, ctx: Ctx, out: Partial) {
  const c = new Cursor(toks);
  const lock = (mode: Mode, t = table) => out.locks.push({ table: t, mode });
  const act = (a: ActionKind) => out.actions.push(a);

  if (c.eat("ADD")) {
    const constraintName = c.eat("CONSTRAINT") ? c.name() : null;
    if (constraintName) out.names.push(constraintName);
    if (c.is("FOREIGN", "KEY")) {
      c.i += 2;
      const cols = columnList(c.group());
      c.eat("REFERENCES");
      const ref = c.name() ?? "?";
      const notValid = toks.some((t, i) => t.k === "NOT" && toks[i + 1]?.k === "VALID");
      lock(SHARE_ROW_EXCLUSIVE);
      if (ref !== table) lock(SHARE_ROW_EXCLUSIVE, ref);
      if (!constraintName) out.names.push(`${table.split(".").pop()}_${cols.join("_")}_fkey`);
      act(notValid ? "add-fk-not-valid" : "add-fk");
      if (!notValid) out.works.push({ kind: "validate", table });
      return;
    }
    if (c.is("CHECK")) {
      c.i++;
      const inner = c.group() ?? [];
      const notValid = c.rest().some((t, i, all) => t.k === "NOT" && all[i + 1]?.k === "VALID");
      lock(ACCESS_EXCLUSIVE);
      act(notValid ? "add-check-not-valid" : "add-check");
      if (!notValid) out.works.push({ kind: "scan", table });
      // CHECK (col IS NOT NULL): remembered so VALIDATE plus SET NOT NULL can skip the scan (Postgres 12+).
      const words = inner.map((t) => t.k || t.v);
      if (constraintName && inner.length === 4 && words[1] === "IS" && words[2] === "NOT" && words[3] === "NULL")
        ctx.notNullChecks.set(constraintName, { table, column: inner[0].v });
      return;
    }
    if (c.is("UNIQUE") || c.is("PRIMARY", "KEY") || c.is("EXCLUDE")) {
      const usingIndex = toks.some((t, i) => t.k === "USING" && toks[i + 1]?.k === "INDEX");
      lock(ACCESS_EXCLUSIVE);
      act(usingIndex ? "add-unique-using-index" : "add-unique");
      if (!usingIndex) out.works.push({ kind: "index", table });
      return;
    }
    // ADD [COLUMN] [IF NOT EXISTS] name type [column constraints]
    c.eat("COLUMN");
    c.eat("IF", "NOT", "EXISTS");
    c.name();
    const rest = c.rest();
    const words = rest.map((t) => t.k);
    const typeWord = rest[0]?.v ?? "";
    const defaultAt = words.indexOf("DEFAULT");
    let volatile = SERIAL.has(typeWord) || words.includes("STORED") || words.includes("IDENTITY");
    if (defaultAt >= 0) {
      for (let i = defaultAt + 1; i < rest.length; i++) {
        if (CONSTRAINT_WORDS.has(rest[i].k) && i > defaultAt + 1) break;
        if (rest[i].t === "word" && VOLATILE.has(rest[i].v) && rest[i + 1]?.v === "(") volatile = true;
      }
    }
    const notNull = words.some((w, i) => w === "NOT" && words[i + 1] === "NULL") || words.includes("PRIMARY");
    lock(ACCESS_EXCLUSIVE);
    const refAt = words.indexOf("REFERENCES");
    if (refAt >= 0) {
      const rc = new Cursor(rest.slice(refAt + 1));
      const ref = rc.name();
      if (ref && ref !== table) lock(SHARE_ROW_EXCLUSIVE, ref);
    }
    if (volatile) {
      act("add-column-rewrite");
      out.works.push({ kind: "rewrite", table });
    } else if (notNull && defaultAt < 0 && !SERIAL.has(typeWord)) act("add-column-not-null");
    else act("add-column");
    if (!volatile && (words.includes("UNIQUE") || words.includes("PRIMARY"))) out.works.push({ kind: "index", table });
    if (!volatile && words.includes("CHECK")) out.works.push({ kind: "scan", table });
    return;
  }

  if (c.eat("VALIDATE", "CONSTRAINT")) {
    const name = c.name() ?? "";
    lock(SHARE_UPDATE_EXCLUSIVE);
    act("validate");
    out.works.push({ kind: "validate", table });
    const check = ctx.notNullChecks.get(name);
    if (check && check.table === table) ctx.validatedNotNull.add(`${table}.${check.column}`);
    return;
  }

  if (c.eat("DROP")) {
    lock(ACCESS_EXCLUSIVE);
    if (c.eat("CONSTRAINT")) act("drop-constraint");
    else {
      c.eat("COLUMN");
      act("drop-column");
    }
    return;
  }

  if (c.eat("ALTER")) {
    c.eat("COLUMN");
    const column = c.name() ?? "";
    lock(ACCESS_EXCLUSIVE);
    if (c.eat("SET", "DATA", "TYPE") || c.eat("TYPE")) {
      act("alter-type");
      out.works.push({ kind: "rewrite", table });
      return;
    }
    if (c.eat("SET", "NOT", "NULL")) {
      if (ctx.validatedNotNull.has(`${table}.${column}`)) act("set-not-null-checked");
      else {
        act("set-not-null");
        out.works.push({ kind: "scan", table });
      }
      return;
    }
    if (c.eat("DROP", "NOT", "NULL")) return act("drop-not-null");
    if (c.eat("SET", "DEFAULT")) return act("set-default");
    if (c.eat("DROP", "DEFAULT")) return act("drop-default");
    if (c.is("SET", "STATISTICS")) {
      out.locks[out.locks.length - 1].mode = SHARE_UPDATE_EXCLUSIVE;
    }
    return act("other");
  }

  if (c.eat("RENAME")) {
    lock(ACCESS_EXCLUSIVE);
    if (c.eat("TO")) return act("rename-table");
    if (c.eat("CONSTRAINT")) return act("rename-other");
    return act("rename-column");
  }

  if (c.is("ENABLE") || c.is("DISABLE")) {
    const trigger = toks.some((t) => t.k === "TRIGGER");
    lock(trigger ? SHARE_ROW_EXCLUSIVE : ACCESS_EXCLUSIVE);
    return act(trigger ? "trigger-toggle" : "other");
  }

  if (c.is("SET", "LOGGED") || c.is("SET", "UNLOGGED") || c.is("SET", "TABLESPACE") || c.is("SET", "ACCESS", "METHOD")) {
    lock(ACCESS_EXCLUSIVE);
    act("rewrite-other");
    out.works.push({ kind: "rewrite", table });
    return;
  }

  if (c.is("ATTACH", "PARTITION") || c.is("DETACH", "PARTITION")) {
    const attach = c.is("ATTACH");
    c.i += 2;
    const part = c.name() ?? "?";
    const concurrently = toks.some((t) => t.k === "CONCURRENTLY");
    lock(attach || concurrently ? SHARE_UPDATE_EXCLUSIVE : ACCESS_EXCLUSIVE);
    lock(ACCESS_EXCLUSIVE, part);
    if (attach) out.works.push({ kind: "scan", table: part });
    return act("partition");
  }

  if (c.is("SET", "(") || c.is("RESET", "(") || c.is("CLUSTER", "ON") || c.is("SET", "WITHOUT", "CLUSTER") || c.is("SET", "STATISTICS")) {
    lock(SHARE_UPDATE_EXCLUSIVE);
    return act("other");
  }

  lock(ACCESS_EXCLUSIVE);
  act("other");
}

function readStatement(st: Statement, ctx: Ctx): Partial {
  const c = new Cursor(st.toks);
  const k = st.toks.map((t) => t.k);

  if (c.is("BEGIN") || c.is("START", "TRANSACTION")) return base("begin");
  if (c.is("COMMIT") || c.is("END")) return base("commit");
  if (c.is("ROLLBACK") || c.is("ABORT")) return base("rollback");

  if (c.eat("SET")) {
    c.eat("SESSION");
    c.eat("LOCAL");
    const name = c.peek()?.v;
    if (name === "lock_timeout" || name === "statement_timeout") {
      c.i++;
      if (!c.eat("TO")) c.eat("=");
      const ms = parseDuration(c.peek(), c.peek(1));
      const step = base("set");
      if (ms !== null) step.set = { name, ms };
      return step;
    }
    return base("no-table-lock");
  }

  if (c.eat("CREATE")) {
    c.eat("OR", "REPLACE");
    c.eat("UNIQUE");
    if (c.eat("INDEX")) {
      const concurrently = c.eat("CONCURRENTLY");
      c.eat("IF", "NOT", "EXISTS");
      const name = c.is("ON") ? null : c.name();
      c.eat("ON");
      c.eat("ONLY");
      const table = c.name() ?? "?";
      const step = base(concurrently ? "create-index-concurrently" : "create-index", table);
      if (name) {
        step.names.push(name);
        ctx.indexTables.set(name, table);
      }
      step.locks.push({ table, mode: concurrently ? SHARE_UPDATE_EXCLUSIVE : SHARE });
      step.works.push({ kind: "index", table });
      step.concurrent = concurrently;
      return step;
    }
    c.eat("GLOBAL");
    c.eat("LOCAL");
    c.eat("TEMPORARY") || c.eat("TEMP");
    c.eat("UNLOGGED");
    if (c.eat("TABLE")) {
      c.eat("IF", "NOT", "EXISTS");
      const table = c.name() ?? "?";
      ctx.created.add(table);
      const step = base("create-table", table);
      // Foreign keys in a new table take a short SHARE ROW EXCLUSIVE lock on the tables they reference.
      for (let i = 0; i < st.toks.length; i++)
        if (st.toks[i].k === "REFERENCES") {
          const ref = new Cursor(st.toks.slice(i + 1)).name();
          if (ref && ref !== table && !step.locks.some((l) => l.table === ref)) step.locks.push({ table: ref, mode: SHARE_ROW_EXCLUSIVE });
        }
      return step;
    }
    if (c.eat("TRIGGER") || c.eat("CONSTRAINT", "TRIGGER")) {
      const on = k.indexOf("ON");
      const table = on >= 0 ? new Cursor(st.toks.slice(on + 1)).name() : null;
      const step = base("create-trigger", table);
      if (table) step.locks.push({ table, mode: SHARE_ROW_EXCLUSIVE });
      return step;
    }
    if (c.eat("POLICY")) {
      const on = k.indexOf("ON");
      const table = on >= 0 ? new Cursor(st.toks.slice(on + 1)).name() : null;
      const step = base("alter-table", table);
      if (table) step.locks.push({ table, mode: ACCESS_EXCLUSIVE });
      step.actions.push("other");
      return step;
    }
    return base("no-table-lock");
  }

  if (c.eat("ALTER", "TABLE")) {
    c.eat("IF", "EXISTS");
    c.eat("ONLY");
    const table = c.name() ?? "?";
    if (c.peek()?.v === "*") c.i++;
    const step = base("alter-table", table);
    for (const action of splitTop(c.rest())) readAlterAction(action, table, ctx, step);
    // One ALTER TABLE takes the strongest lock of its actions on each table, once.
    const byTable = new Map<string, Mode>();
    for (const l of step.locks) byTable.set(l.table, Math.max(byTable.get(l.table) ?? 0, l.mode) as Mode);
    step.locks = [...byTable.entries()].map(([t, mode]) => ({ table: t, mode }));
    // A rewrite rebuilds the table once and does the other checks while it copies.
    if (step.works.some((w) => w.kind === "rewrite")) step.works = [{ kind: "rewrite", table }];
    return step;
  }

  if (c.eat("ALTER", "INDEX") || c.eat("ALTER", "SEQUENCE") || c.eat("ALTER", "VIEW") || c.eat("ALTER", "MATERIALIZED", "VIEW")) return base("no-table-lock");

  if (c.eat("DROP", "INDEX")) {
    const concurrently = c.eat("CONCURRENTLY");
    c.eat("IF", "EXISTS");
    const names = splitTop(c.rest()).map((part) => new Cursor(part).name()).filter((n): n is string => !!n && n !== "cascade" && n !== "restrict");
    const step = base(concurrently ? "drop-index-concurrently" : "drop-index");
    for (const name of names) {
      const table = ctx.indexTables.get(name) ?? `(table of ${name})`;
      step.table ??= table;
      if (!step.locks.some((l) => l.table === table)) step.locks.push({ table, mode: concurrently ? SHARE_UPDATE_EXCLUSIVE : ACCESS_EXCLUSIVE });
    }
    step.concurrent = concurrently;
    return step;
  }

  if (c.eat("DROP", "TABLE") || c.eat("TRUNCATE")) {
    const truncate = k[0] === "TRUNCATE";
    c.eat("TABLE");
    c.eat("IF", "EXISTS");
    c.eat("ONLY");
    const step = base(truncate ? "truncate" : "drop-table");
    for (const part of splitTop(c.rest())) {
      const table = new Cursor(part).name();
      if (!table) continue;
      step.table ??= table;
      step.locks.push({ table, mode: ACCESS_EXCLUSIVE });
    }
    return step;
  }

  if (c.eat("DROP", "TRIGGER")) {
    c.eat("IF", "EXISTS");
    c.name();
    c.eat("ON");
    const table = c.name();
    const step = base("drop-trigger", table);
    if (table) step.locks.push({ table, mode: ACCESS_EXCLUSIVE });
    return step;
  }

  if (c.eat("REINDEX")) {
    c.group();
    const target = c.peek()?.k;
    c.i++;
    const concurrently = c.eat("CONCURRENTLY");
    const name = c.name() ?? "?";
    const table = target === "INDEX" ? (ctx.indexTables.get(name) ?? `(table of ${name})`) : name;
    if (target !== "INDEX" && target !== "TABLE") return base("no-table-lock");
    const step = base(concurrently ? "reindex-concurrently" : "reindex", table);
    step.locks.push({ table, mode: concurrently ? SHARE_UPDATE_EXCLUSIVE : SHARE });
    step.works.push({ kind: "index", table });
    step.concurrent = concurrently;
    return step;
  }

  if (c.eat("VACUUM") || c.eat("ANALYZE") || c.eat("ANALYSE")) {
    const opts = c.group()?.map((t) => t.k) ?? [];
    const full = c.eat("FULL") || opts.includes("FULL");
    while (c.eat("FREEZE") || c.eat("VERBOSE") || c.eat("ANALYZE")) {
      // Old-style options before the table name.
    }
    const table = c.name();
    if (!table) return base("no-table-lock");
    const step = base(full ? "vacuum-full" : "vacuum", table);
    step.locks.push({ table, mode: full ? ACCESS_EXCLUSIVE : SHARE_UPDATE_EXCLUSIVE });
    step.works.push({ kind: full ? "rewrite" : "scan", table });
    return step;
  }

  if (c.eat("CLUSTER")) {
    c.eat("VERBOSE");
    const table = c.name();
    if (!table) return base("no-table-lock");
    const step = base("cluster", table);
    step.locks.push({ table, mode: ACCESS_EXCLUSIVE });
    step.works.push({ kind: "rewrite", table });
    return step;
  }

  if (c.eat("REFRESH", "MATERIALIZED", "VIEW")) {
    const concurrently = c.eat("CONCURRENTLY");
    const table = c.name() ?? "?";
    const step = base(concurrently ? "refresh-view-concurrently" : "refresh-view", table);
    step.locks.push({ table, mode: concurrently ? EXCLUSIVE : ACCESS_EXCLUSIVE });
    step.works.push({ kind: "rewrite", table });
    return step;
  }

  if (c.eat("LOCK")) {
    c.eat("TABLE");
    c.eat("ONLY");
    const inAt = k.indexOf("IN");
    const modeAt = k.lastIndexOf("MODE");
    const mode = inAt >= 0 && modeAt > inAt ? (modeFromWords(k.slice(inAt + 1, modeAt).join(" ")) ?? ACCESS_EXCLUSIVE) : ACCESS_EXCLUSIVE;
    const names = splitTop(st.toks.slice(c.i, inAt >= 0 ? inAt : undefined)).map((p) => new Cursor(p).name()).filter((n): n is string => !!n);
    const step = base("lock-table", names[0] ?? null);
    for (const table of names) step.locks.push({ table, mode });
    return step;
  }

  if (c.is("UPDATE") || c.is("DELETE")) {
    const update = c.eat("UPDATE");
    if (!update) {
      c.eat("DELETE");
      c.eat("FROM");
    }
    c.eat("ONLY");
    const table = c.name() ?? "?";
    const step = base(update ? "update" : "delete", table);
    const whole = !k.includes("WHERE");
    step.locks.push(whole ? { table, mode: ROW_EXCLUSIVE, rows: true } : { table, mode: ROW_EXCLUSIVE });
    if (whole) step.works.push({ kind: "backfill", table });
    return step;
  }

  if (c.eat("INSERT", "INTO")) {
    const table = c.name() ?? "?";
    const step = base("insert", table);
    step.locks.push({ table, mode: ROW_EXCLUSIVE });
    return step;
  }

  if (c.eat("COMMENT", "ON")) return base("comment");

  const harmless = ["SELECT", "GRANT", "REVOKE", "DROP", "ALTER", "CREATE", "DO", "NOTIFY", "RESET", "SHOW", "WITH", "VALUES", "EXPLAIN", "SECURITY"];
  if (k[0] === "DO") return base("unknown");
  return base(harmless.includes(k[0]) ? "no-table-lock" : "unknown");
}

/** Reads a migration and tells, per statement, which locks it takes, what work it does under them, and what to watch out for. */
export function analyze(sql: string, options: AnalyzeOptions = { wrap: true }): AnalyzeResult {
  if (!sql.trim()) return { ok: false, error: { code: "empty" } };
  if (sql.length > LIMITS.chars) return { ok: false, error: { code: "too-large" } };
  const split = splitStatements(sql);
  if (!split.ok) return { ok: false, error: { code: "unterminated", line: split.line } };
  if (split.statements.length > LIMITS.statements) return { ok: false, error: { code: "too-many-statements" } };
  if (!split.statements.length) return { ok: false, error: { code: "empty" } };

  const ctx: Ctx = { created: new Set(), notNullChecks: new Map(), validatedNotNull: new Set(), indexTables: new Map() };
  const steps: Step[] = [];
  const explicit = split.statements.some((s) => s.toks[0]?.k === "BEGIN" || (s.toks[0]?.k === "START" && s.toks[1]?.k === "TRANSACTION"));
  const transaction: Analysis["transaction"] = explicit ? "explicit" : options.wrap ? "wrapped" : "none";
  let tx: number | null = transaction === "wrapped" ? 0 : null;
  let txCount = transaction === "wrapped" ? 1 : 0;

  for (const st of split.statements) {
    const createdBefore = new Set(ctx.created);
    const p = readStatement(st, ctx);
    if (p.kind === "begin" && transaction === "explicit") tx = txCount++;
    const step: Step = { ...p, index: steps.length, line: st.line, start: st.start, end: st.end, text: sql.slice(st.start, st.end), tx };
    // Work on a table this file created is instant: the table is still empty.
    step.works = step.works.filter((w) => !createdBefore.has(w.table) && !(step.kind === "create-table" && w.table === step.table));
    steps.push(step);
    if ((p.kind === "commit" || p.kind === "rollback") && transaction === "explicit") tx = null;
  }

  const created = [...ctx.created];
  const tables: string[] = [];
  for (const s of steps) for (const l of s.locks) if (!ctx.created.has(l.table) && !tables.includes(l.table)) tables.push(l.table);
  return { ok: true, analysis: { steps, findings: findingsFor(steps, ctx.created), tables, created, transaction } };
}

function findingsFor(steps: Step[], created: Set<string>): Finding[] {
  const out: Finding[] = [];
  const add = (id: RuleId, step: Step, table = step.table ?? "", detail = "") => {
    if (!out.some((f) => f.id === id && f.step === step.index && f.table === table)) out.push({ id, level: RULES[id], step: step.index, line: step.line, table, detail });
  };
  const existing = (t: string | null) => !!t && !created.has(t);
  // Created before this step: a table created later in the file still counts as existing earlier on.
  const createdUpTo = (i: number) => new Set(steps.slice(0, i).filter((s) => s.kind === "create-table" && s.table).map((s) => s.table!));
  let lockTimeout = 0;
  let warnedTimeout = false;

  for (const s of steps) {
    const before = createdUpTo(s.index);
    const old = (t: string | null) => !!t && !before.has(t) && t !== (s.kind === "create-table" ? s.table : null);
    if (s.set?.name === "lock_timeout") lockTimeout = s.set.ms;
    const strong = s.locks.filter((l) => old(l.table) && (blocksWrites(l.mode) || blocksReads(l.mode)));
    if (strong.length && !lockTimeout && !warnedTimeout) {
      warnedTimeout = true;
      add("no-lock-timeout", s, strong[0].table);
    }
    if (s.concurrent && s.tx !== null) add("concurrently-in-transaction", s);
    if (!old(s.table) && s.kind !== "drop-table" && s.kind !== "truncate") {
      // Statements on a new table cannot hurt traffic; only a few rules still apply.
      if (s.kind === "unknown") add("not-modeled", s, "", firstWords(s.text));
      continue;
    }
    switch (s.kind) {
      case "create-index":
        add("index-not-concurrent", s);
        break;
      case "reindex":
        add("reindex-blocks", s);
        break;
      case "vacuum-full":
      case "cluster":
      case "refresh-view":
        add("table-rewrite", s, s.table ?? "", s.kind === "refresh-view" ? "view" : "");
        break;
      case "drop-table":
      case "truncate":
        add("destructive", s, s.table ?? "", s.kind);
        break;
      case "lock-table":
        add("explicit-lock", s);
        break;
      case "update":
      case "delete":
        if (s.works.length) add("unbatched-backfill", s);
        break;
      case "unknown":
        add("not-modeled", s, "", firstWords(s.text));
        break;
      case "alter-table":
        for (const a of s.actions) {
          if (a === "add-fk") add("fk-validates-under-lock", s, s.table ?? "", s.locks.map((l) => l.table).filter((t) => t !== s.table)[0] ?? "");
          if (a === "add-check") add("check-validates-under-lock", s);
          if (a === "set-not-null") add("set-not-null-scans", s);
          if (a === "add-unique") add("unique-builds-index", s);
          if (a === "add-column-rewrite") add("column-rewrite", s);
          if (a === "rewrite-other") add("table-rewrite", s);
          if (a === "add-column-not-null") add("not-null-without-default", s);
          if (a === "alter-type") add("type-change-rewrite", s, s.table ?? "", typeTarget(s.text));
          if (a === "drop-column") add("destructive", s, s.table ?? "", "column");
          if (a === "rename-column" || a === "rename-table") add("rename-breaks-clients", s, s.table ?? "", a);
        }
        break;
    }
  }

  // Inside one transaction every lock is held until COMMIT: a strong lock taken early is held through every later step.
  const byTx = new Map<number, Step[]>();
  for (const s of steps) if (s.tx !== null && s.kind !== "begin" && s.kind !== "commit") byTx.set(s.tx, [...(byTx.get(s.tx) ?? []), s]);
  for (const group of byTx.values()) {
    for (let i = 0; i < group.length; i++) {
      const s = group[i];
      const held = s.locks.find((l) => existing(l.table) && (blocksReads(l.mode) || blocksWrites(l.mode)));
      if (!held) continue;
      const later = group.slice(i + 1).find((n) => n.works.length > 0);
      if (later) add("lock-held-in-transaction", s, held.table, String(later.line));
    }
  }

  const order: Record<Level, number> = { fail: 0, warn: 1, info: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level] || a.step - b.step);
}

const firstWords = (text: string) => (/^DO\b/i.test(text) ? "DO" : text.replace(/\s+/g, " ").split(" ").slice(0, 3).join(" ").slice(0, 40));
function typeTarget(text: string) {
  const m = /\bTYPE\s+([A-Za-z_][\w ]*(?:\([^)]*\))?)/i.exec(text);
  return m ? m[1].trim().split(/\s+USING\b/i)[0].trim() : "";
}
