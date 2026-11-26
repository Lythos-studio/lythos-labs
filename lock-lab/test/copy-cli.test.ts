/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { RULES } from "../src/analyze";
import { runCli } from "../src/cli";
import { lockLabCopy } from "../src/copy";

const cp = (n: number) => String.fromCodePoint(n);
const bad = new RegExp(`${cp(0x2014)}|[${cp(0x1f300)}-${cp(0x1faff)}${cp(0x2600)}-${cp(0x27bf)}]`, "u");

test("all strings exist in English and Dutch, without em dashes or emoji", () => {
  const strings = (value: unknown, path = ""): [string, string][] =>
    typeof value === "string"
      ? [[path, value]]
      : typeof value === "function"
        ? [[path, String((value as (...a: unknown[]) => unknown)({ table: "orders", detail: "x", line: 1 }, 2, 3))]]
        : Array.isArray(value)
          ? value.flatMap((v, i) => strings(v, `${path}[${i}]`))
          : value && typeof value === "object"
            ? Object.entries(value).flatMap(([k, v]) => strings(v, `${path}.${k}`))
            : [];
  const keys = (l: "en" | "nl") => strings(lockLabCopy[l]).map(([p]) => p).sort();
  assert.deepEqual(keys("en"), keys("nl"));
  for (const l of ["en", "nl"] as const) {
    for (const [path, s] of strings(lockLabCopy[l])) assert.ok(!bad.test(s), `${l}${path}`);
    assert.deepEqual(Object.keys(lockLabCopy[l].rules).sort(), Object.keys(RULES).sort());
    for (const id of Object.keys(RULES) as (keyof typeof RULES)[]) assert.ok(lockLabCopy[l].rules[id].what({ table: "orders", detail: "" }).includes("orders") || id === "not-modeled", `${l} ${id}`);
  }
});

const io = (files: Record<string, string>) => {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    io: {
      readFile: (p: string) => {
        if (!(p in files)) throw new Error("missing");
        return files[p];
      },
      out: (t: string) => void out.push(t),
      err: (t: string) => void err.push(t),
    },
  };
};

test("the command line reports findings with lines, exits 1 on a fail and 0 when told to ignore", () => {
  const files = { "a.sql": "-- add an index\nCREATE INDEX i ON orders (a);\n", "ok.sql": "SET lock_timeout = '2s';\nCREATE INDEX CONCURRENTLY i ON orders (a);\n" };
  const one = io(files);
  assert.equal(runCli(["a.sql"], one.io), 1);
  assert.match(one.out.join(""), /\s2 {2}fail {2}index-not-concurrent/);
  assert.equal(runCli(["ok.sql", "--no-transaction"], io(files).io), 0);
  assert.equal(runCli(["a.sql", "--fail-on", "none"], io(files).io), 0);
  assert.equal(runCli(["a.sql", "--disable", "index-not-concurrent,no-lock-timeout"], io(files).io), 0);

  const gh = io(files);
  runCli(["a.sql", "--format", "github"], gh.io);
  assert.match(gh.out.join(""), /^::error file=a\.sql,line=2,title=index-not-concurrent::/m);

  const json = io(files);
  runCli(["a.sql", "--format", "json", "--safer"], json.io);
  const parsed = JSON.parse(json.out.join(""));
  assert.equal(parsed.summary.fail, 1);
  assert.match(parsed.files[0].safer, /CREATE INDEX CONCURRENTLY i ON orders \(a\);/);
});

test("the command line rejects bad input with exit code 2", () => {
  assert.equal(runCli([], io({}).io), 2);
  assert.equal(runCli(["missing.sql"], io({}).io), 2);
  assert.equal(runCli(["a.sql", "--format", "xml"], io({ "a.sql": "" }).io), 2);
  assert.equal(runCli(["a.sql", "--disable", "nope"], io({ "a.sql": "" }).io), 2);
  assert.equal(runCli(["a.sql"], io({ "a.sql": "SELECT 'open" }).io), 2);
  assert.equal(runCli(["a.sql"], io({ "a.sql": "-- only a comment\n" }).io), 0, "an empty migration is fine");
  const list = io({});
  assert.equal(runCli(["--list-rules"], list.io), 0);
  assert.equal(list.out.length, Object.keys(RULES).length);
});
