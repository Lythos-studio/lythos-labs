/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { Analysis, Step } from "./analyze";
import { Cursor, tokenize, type Tok } from "./sql";

/** Comment lines written into the safer file, per language (see copy.ts). */
export type SafeText = {
  header: string[];
  lockTimeout: string;
  index: string;
  validateLater: string;
  notNull: string;
  unique: string;
  defaultLater: string;
  backfill: (table: string, column: string) => string[];
  manualType: string;
  manualRewrite: string;
  manualNotNullColumn: string;
  manualBackfill: (table: string) => string[];
  manualSplit: string;
  destructive: string;
  rename: string;
  refresh: string;
  dropIndexMany: string;
};

export type SafeResult = {
  sql: string;
  /** Steps that were rewritten automatically. */
  rewritten: number[];
  /** Steps that still need a decision; they stay as written with a comment. */
  manual: number[];
};

const KEYWORDS = new Set(["user", "order", "group", "table", "select", "default", "check", "column", "constraint", "primary", "references", "end", "limit", "offset", "desc", "asc", "all", "to", "from", "where"]);
/** Quotes an identifier only when Postgres needs it. */
export const ident = (name: string) => (/^[a-z_][a-z0-9_$]*$/.test(name) && !KEYWORDS.has(name) ? name : `"${name.replace(/"/g, '""')}"`);
const qualified = (name: string) => name.split(".").map(ident).join(".");
const trunc = (name: string) => name.slice(0, 63);

const tokensOf = (s: Step): Tok[] => {
  const r = tokenize(s.text);
  return r.ok ? r.toks : [];
};
const sliceOf = (text: string, toks: Tok[]) => (toks.length ? text.slice(toks[0].start, toks[toks.length - 1].end) : "");
const insertAfter = (text: string, tok: Tok, words: string) => `${text.slice(0, tok.end)} ${words}${text.slice(tok.end)}`;
const hasWords = (toks: Tok[], a: string, b: string) => toks.some((t, i) => t.k === a && toks[i + 1]?.k === b);

/** Position of the action after ALTER TABLE [IF EXISTS] [ONLY] name [*]. */
function actionStart(toks: Tok[]): number {
  const c = new Cursor(toks);
  c.eat("ALTER", "TABLE");
  c.eat("IF", "EXISTS");
  c.eat("ONLY");
  c.name();
  if (c.peek()?.v === "*") c.i++;
  return c.i;
}

const CONSTRAINT_WORDS = new Set(["NOT", "NULL", "DEFAULT", "CHECK", "REFERENCES", "UNIQUE", "PRIMARY", "CONSTRAINT", "GENERATED", "COLLATE"]);

/**
 * Writes the migration the careful way: lock_timeout first, each statement in its own transaction,
 * CONCURRENTLY for indexes, NOT VALID plus VALIDATE for constraints, and the CHECK trick for NOT NULL.
 * What cannot be rewritten safely stays as written, with a comment that says what to decide.
 */
export function saferMigration(sql: string, analysis: Analysis, t: SafeText): SafeResult {
  const out: string[] = t.header.map((l) => `-- ${l}`);
  const rewritten: number[] = [];
  const manual: number[] = [];
  const created = new Set<string>();
  const hasTimeout = analysis.steps.some((s) => s.set?.name === "lock_timeout" && s.set.ms > 0);
  if (!hasTimeout) out.push(`-- ${t.lockTimeout}`, "SET lock_timeout = '2s';");
  let prevEnd = 0;

  for (const s of analysis.steps) {
    // Comments written above a statement travel with it.
    const leading = sql
      .slice(prevEnd, s.start)
      .replace(/^[\s;]*;/, "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith("--"));
    prevEnd = s.end;
    if (s.kind === "begin" || s.kind === "commit") continue;
    const isNew = !!s.table && created.has(s.table);
    if (s.kind === "create-table" && s.table) created.add(s.table);
    const block = (lines: string[]) => out.push("", ...leading, ...lines);
    const keep = (note?: string | string[], isManual = true) => {
      if (note && isManual) manual.push(s.index);
      block([...(note ? (Array.isArray(note) ? note : [note]).map((l) => `-- ${l}`) : []), `${s.text};`]);
    };
    if (isNew || s.kind === "create-table") {
      keep();
      continue;
    }
    const toks = tokensOf(s);
    const table = s.table ? qualified(s.table) : "";

    if (s.kind === "create-index" || s.kind === "reindex" || (s.kind === "drop-index" && s.locks.length === 1)) {
      const at = toks.find((x) => x.k === "INDEX" || (s.kind === "reindex" && x.k === "TABLE"));
      if (at) {
        rewritten.push(s.index);
        block([`-- ${t.index}`, `${insertAfter(s.text, at, "CONCURRENTLY")};`]);
        continue;
      }
    }
    if (s.kind === "drop-index") {
      keep(t.dropIndexMany, false);
      continue;
    }
    if (s.kind === "refresh-view") {
      const at = toks.find((x) => x.k === "VIEW");
      if (at) {
        rewritten.push(s.index);
        block([`-- ${t.refresh}`, `${insertAfter(s.text, at, "CONCURRENTLY")};`]);
        continue;
      }
    }
    if (s.kind === "vacuum-full" || s.kind === "cluster") {
      keep(t.manualRewrite);
      continue;
    }
    if ((s.kind === "update" || s.kind === "delete") && s.works.length) {
      keep(t.manualBackfill(s.table ?? ""));
      continue;
    }
    if (s.kind === "drop-table" || s.kind === "truncate") {
      keep(t.destructive, false);
      continue;
    }
    if (s.kind !== "alter-table") {
      keep();
      continue;
    }

    // ALTER TABLE: only single-action statements are rewritten; several actions are kept with a hint to split them.
    const risky = s.actions.filter((a) => ["add-fk", "add-check", "set-not-null", "add-unique", "add-column-rewrite", "alter-type", "rewrite-other", "add-column-not-null"].includes(a));
    if (s.actions.length > 1 && risky.length) {
      keep(t.manualSplit);
      continue;
    }
    const action = s.actions[0];
    const from = actionStart(toks);
    const body = toks.slice(from);

    if (action === "add-fk" || action === "add-check") {
      const named = body[1]?.k === "CONSTRAINT";
      const name = s.names[0] ?? trunc(`${(s.table ?? "").split(".").pop()}_check`);
      let text = s.text;
      if (!named) {
        const kw = body.find((x) => x.k === (action === "add-fk" ? "FOREIGN" : "CHECK"))!;
        text = `${text.slice(0, kw.start)}CONSTRAINT ${ident(name)} ${text.slice(kw.start)}`;
      }
      const constraint = ident(name);
      rewritten.push(s.index);
      block([`-- ${t.validateLater}`, `${text} NOT VALID;`, `ALTER TABLE ${table} VALIDATE CONSTRAINT ${constraint};`]);
      continue;
    }

    if (action === "set-not-null") {
      const c = new Cursor(body);
      c.eat("ALTER");
      c.eat("COLUMN");
      const column = c.peek()?.v ?? "";
      const check = ident(trunc(`${(s.table ?? "").split(".").pop()}_${column}_not_null`));
      const col = ident(column);
      rewritten.push(s.index);
      block([
        `-- ${t.notNull}`,
        `ALTER TABLE ${table} ADD CONSTRAINT ${check} CHECK (${col} IS NOT NULL) NOT VALID;`,
        `ALTER TABLE ${table} VALIDATE CONSTRAINT ${check};`,
        `ALTER TABLE ${table} ALTER COLUMN ${col} SET NOT NULL;`,
        `ALTER TABLE ${table} DROP CONSTRAINT ${check};`,
      ]);
      continue;
    }

    if (action === "add-unique") {
      const c = new Cursor(body);
      c.eat("ADD");
      const name = c.eat("CONSTRAINT") ? c.name() : null;
      const primary = c.is("PRIMARY", "KEY");
      if (c.eat("UNIQUE") || c.eat("PRIMARY", "KEY")) {
        const group = c.group();
        if (group && c.done) {
          const short = (s.table ?? "").split(".").pop();
          const cols = group.filter((x) => x.t === "word" || x.t === "ident").map((x) => x.v);
          const constraint = ident(name ?? trunc(primary ? `${short}_pkey` : `${short}_${cols.join("_")}_key`));
          rewritten.push(s.index);
          block([
            `-- ${t.unique}`,
            `CREATE UNIQUE INDEX CONCURRENTLY ${constraint} ON ${table} (${sliceOf(s.text, group)});`,
            `ALTER TABLE ${table} ADD CONSTRAINT ${constraint} ${primary ? "PRIMARY KEY" : "UNIQUE"} USING INDEX ${constraint};`,
          ]);
          continue;
        }
      }
      keep(t.manualSplit);
      continue;
    }

    if (action === "add-column-rewrite") {
      const c = new Cursor(body);
      c.eat("ADD");
      c.eat("COLUMN");
      const ifNot = c.eat("IF", "NOT", "EXISTS");
      const nameTok = c.peek();
      c.name();
      const rest = c.rest();
      const words = rest.map((x) => x.k);
      const defaultAt = words.indexOf("DEFAULT");
      const typeEnd = rest.findIndex((x) => CONSTRAINT_WORDS.has(x.k));
      const typeToks = rest.slice(0, typeEnd < 0 ? rest.length : typeEnd);
      const simpleType = typeToks.length > 0 && !["serial", "bigserial", "smallserial", "serial2", "serial4", "serial8"].includes(typeToks[0].v);
      if (nameTok && defaultAt >= 0 && simpleType && !words.includes("STORED") && !words.includes("IDENTITY")) {
        let end = rest.length;
        let depth = 0;
        for (let i = defaultAt + 1; i < rest.length; i++) {
          if (rest[i].v === "(") depth++;
          if (rest[i].v === ")") depth--;
          if (depth === 0 && i > defaultAt + 1 && CONSTRAINT_WORDS.has(rest[i].k)) {
            end = i;
            break;
          }
        }
        const expr = sliceOf(s.text, rest.slice(defaultAt + 1, end));
        const others = [...rest.slice(typeToks.length, defaultAt), ...rest.slice(end)];
        const notNull = hasWords(others, "NOT", "NULL");
        const extra = sliceOf(s.text, others.filter((_, i, all) => !(all[i].k === "NOT" && all[i + 1]?.k === "NULL") && !(all[i].k === "NULL" && all[i - 1]?.k === "NOT")));
        const column = sliceOf(s.text, [nameTok]);
        rewritten.push(s.index);
        block([
          `-- ${t.defaultLater}`,
          `ALTER TABLE ${table} ADD COLUMN ${ifNot ? "IF NOT EXISTS " : ""}${column} ${sliceOf(s.text, typeToks)}${extra ? ` ${extra}` : ""};`,
          `ALTER TABLE ${table} ALTER COLUMN ${column} SET DEFAULT ${expr};`,
          ...t.backfill(s.table ?? "", column).map((l) => `-- ${l}`),
          ...(notNull ? [`-- ${t.manualNotNullColumn}`] : []),
        ]);
        continue;
      }
      keep(t.manualRewrite);
      continue;
    }

    if (action === "add-column-not-null") {
      keep(t.manualNotNullColumn);
      continue;
    }
    if (action === "alter-type") {
      keep(t.manualType);
      continue;
    }
    if (action === "rewrite-other") {
      keep(t.manualRewrite);
      continue;
    }
    if (action === "drop-column") {
      keep(t.destructive, false);
      continue;
    }
    if (action === "rename-column" || action === "rename-table") {
      keep(t.rename, false);
      continue;
    }
    keep();
  }

  return { sql: `${out.join("\n")}\n`, rewritten, manual };
}
