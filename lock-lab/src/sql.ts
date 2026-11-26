/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/** A small SQL tokenizer: enough to split statements and read DDL, not a full Postgres parser. */
export type Tok = {
  /** word: keyword or plain identifier; ident: "quoted identifier"; str: any string literal; op: punctuation. */
  t: "word" | "ident" | "str" | "num" | "op";
  /** Identifier value (plain words folded to lower case, quoted ones kept), string contents, or the operator. */
  v: string;
  /** Upper case, for keyword matching. Empty for quoted identifiers and strings, so they never match a keyword. */
  k: string;
  start: number;
  end: number;
};

export type Statement = {
  toks: Tok[];
  /** Offsets of the statement in the source, from its first to its last token (comments before it excluded). */
  start: number;
  end: number;
  /** 1-based line of the first token. */
  line: number;
};

export type SplitResult = { ok: true; statements: Statement[] } | { ok: false; error: "unterminated"; line: number };

const isWordStart = (c: string) => /[A-Za-z_\u0080-￿]/.test(c);
const isWord = (c: string) => /[A-Za-z0-9_$\u0080-￿]/.test(c);

export function tokenize(sql: string): { ok: true; toks: Tok[] } | { ok: false; at: number } {
  const toks: Tok[] = [];
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i];
    const d = sql[i + 1];
    if (c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f") {
      i++;
    } else if (c === "-" && d === "-") {
      while (i < n && sql[i] !== "\n") i++;
    } else if (c === "/" && d === "*") {
      // Postgres block comments nest.
      const from = i;
      let depth = 0;
      while (i < n) {
        if (sql[i] === "/" && sql[i + 1] === "*") {
          depth++;
          i += 2;
        } else if (sql[i] === "*" && sql[i + 1] === "/") {
          depth--;
          i += 2;
          if (depth === 0) break;
        } else i++;
      }
      if (depth !== 0) return { ok: false, at: from };
    } else if (c === "'" || ((c === "E" || c === "e") && d === "'")) {
      const from = i;
      const escapes = c !== "'";
      i += escapes ? 2 : 1;
      let value = "";
      for (;;) {
        if (i >= n) return { ok: false, at: from };
        const ch = sql[i];
        if (escapes && ch === "\\") {
          value += sql[i + 1] ?? "";
          i += 2;
        } else if (ch === "'") {
          if (sql[i + 1] === "'") {
            value += "'";
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          value += ch;
          i++;
        }
      }
      toks.push({ t: "str", v: value, k: "", start: from, end: i });
    } else if (c === '"') {
      const from = i;
      i++;
      let value = "";
      for (;;) {
        if (i >= n) return { ok: false, at: from };
        if (sql[i] === '"') {
          if (sql[i + 1] === '"') {
            value += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else value += sql[i++];
      }
      toks.push({ t: "ident", v: value, k: "", start: from, end: i });
    } else if (c === "$" && /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.test(sql.slice(i, i + 66))) {
      const tag = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i, i + 66))![0];
      const close = sql.indexOf(tag, i + tag.length);
      if (close < 0) return { ok: false, at: i };
      toks.push({ t: "str", v: sql.slice(i + tag.length, close), k: "", start: i, end: close + tag.length });
      i = close + tag.length;
    } else if (/[0-9]/.test(c) || (c === "." && d !== undefined && /[0-9]/.test(d))) {
      const from = i;
      while (i < n && /[0-9._eE]/.test(sql[i])) i++;
      toks.push({ t: "num", v: sql.slice(from, i), k: sql.slice(from, i), start: from, end: i });
    } else if (isWordStart(c)) {
      const from = i;
      while (i < n && isWord(sql[i])) i++;
      const raw = sql.slice(from, i);
      toks.push({ t: "word", v: raw.toLowerCase(), k: raw.toUpperCase(), start: from, end: i });
    } else if (c === ":" && d === ":") {
      toks.push({ t: "op", v: "::", k: "::", start: i, end: i + 2 });
      i += 2;
    } else {
      toks.push({ t: "op", v: c, k: c, start: i, end: i + 1 });
      i++;
    }
  }
  return { ok: true, toks };
}

const lineAt = (sql: string, offset: number) => {
  let line = 1;
  for (let i = 0; i < offset && i < sql.length; i++) if (sql.charCodeAt(i) === 10) line++;
  return line;
};

/** Splits on top-level semicolons. psql meta commands (lines starting with a backslash) are skipped. */
export function splitStatements(sql: string): SplitResult {
  const cleaned = sql.replace(/^[ \t]*\\[^\n]*/gm, (m) => " ".repeat(m.length));
  const r = tokenize(cleaned);
  if (!r.ok) return { ok: false, error: "unterminated", line: lineAt(sql, r.at) };
  const statements: Statement[] = [];
  let current: Tok[] = [];
  let depth = 0;
  // BEGIN ... END inside CREATE FUNCTION bodies is always quoted, so a top-level semicolon ends a statement.
  const flush = () => {
    if (current.length) {
      const start = current[0].start;
      statements.push({ toks: current, start, end: current[current.length - 1].end, line: lineAt(sql, start) });
    }
    current = [];
  };
  for (const tok of r.toks) {
    if (tok.t === "op" && tok.v === ";" && depth <= 0) {
      flush();
      depth = 0;
      continue;
    }
    if (tok.t === "op" && tok.v === "(") depth++;
    if (tok.t === "op" && tok.v === ")") depth--;
    current.push(tok);
  }
  flush();
  return { ok: true, statements };
}

/** A cursor over the tokens of one statement. */
export class Cursor {
  i = 0;
  constructor(readonly toks: Tok[]) {}
  get done() {
    return this.i >= this.toks.length;
  }
  peek(k = 0): Tok | undefined {
    return this.toks[this.i + k];
  }
  /** True when the next tokens are these keywords, in order. */
  is(...words: string[]) {
    return words.every((w, k) => this.toks[this.i + k]?.k === w);
  }
  /** Consumes the keywords when they are next. */
  eat(...words: string[]) {
    if (!this.is(...words)) return false;
    this.i += words.length;
    return true;
  }
  /** A possibly qualified name such as public."Orders"; null when no name follows. */
  name(): string | null {
    const part = () => {
      const t = this.toks[this.i];
      if (!t || (t.t !== "word" && t.t !== "ident")) return null;
      this.i++;
      return t.v;
    };
    const first = part();
    if (first === null) return null;
    const parts = [first];
    while (this.toks[this.i]?.v === "." && this.toks[this.i]?.t === "op") {
      this.i++;
      const next = part();
      if (next === null) break;
      parts.push(next);
    }
    return tableName(parts);
  }
  /** Skips one balanced parenthesised group when it is next; returns its inner tokens. */
  group(): Tok[] | null {
    if (this.toks[this.i]?.v !== "(") return null;
    const from = this.i + 1;
    let depth = 0;
    for (; this.i < this.toks.length; this.i++) {
      const v = this.toks[this.i];
      if (v.t !== "op") continue;
      if (v.v === "(") depth++;
      if (v.v === ")" && --depth === 0) {
        this.i++;
        return this.toks.slice(from, this.i - 1);
      }
    }
    return this.toks.slice(from);
  }
  rest(): Tok[] {
    return this.toks.slice(this.i);
  }
}

/** Tables in the default schema are shown without "public.". */
export function tableName(parts: string[]): string {
  const p = parts.length > 1 && parts[parts.length - 2] === "public" ? parts.slice(-1) : parts;
  return p.join(".");
}

/** Splits tokens on top-level commas (for ALTER TABLE actions and column lists). */
export function splitTop(toks: Tok[]): Tok[][] {
  const out: Tok[][] = [];
  let cur: Tok[] = [];
  let depth = 0;
  for (const t of toks) {
    if (t.t === "op" && t.v === "(") depth++;
    if (t.t === "op" && t.v === ")") depth--;
    if (t.t === "op" && t.v === "," && depth === 0) {
      out.push(cur);
      cur = [];
    } else cur.push(t);
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Identifiers of a column list like (a, "B"). */
export function columnList(inner: Tok[] | null): string[] {
  if (!inner) return [];
  return splitTop(inner)
    .map((part) => part.find((t) => t.t === "word" || t.t === "ident")?.v ?? "")
    .filter(Boolean);
}
