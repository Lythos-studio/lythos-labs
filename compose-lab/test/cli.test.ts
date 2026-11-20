/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeGithub, runCli, type CliIo } from "../src/cli";
import { EXAMPLES } from "../src/examples";
import { improve, IMPROVE_DEFAULT_ON } from "../src/improve";

function fakeIo(files: Record<string, string>) {
  const written: Record<string, string> = {};
  let out = "";
  let err = "";
  const io: CliIo = {
    readFile: (p) => {
      if (!(p in files)) throw new Error("ENOENT");
      return files[p];
    },
    writeFile: (p, c) => void (written[p] = c),
    out: (t) => void (out += t),
    err: (t) => void (err += t),
  };
  return { io, written, get out() { return out; }, get err() { return err; } };
}
const tidy = EXAMPLES[0].yaml;
const messy = EXAMPLES[1].yaml;
const warnOnly = "services:\n  app:\n    image: app:1.0\n    restart: unless-stopped\n    ports: [\"8080:8080\"]\n    security_opt: [no-new-privileges:true]\n    healthcheck: { test: [CMD, 'true'] }\n    mem_limit: 1g\n    logging: { driver: local }\n";

test("usage: no arguments and --help print the usage, an unknown flag is an error", () => {
  const none = fakeIo({});
  assert.equal(runCli([], none.io), 2);
  assert.match(none.err, /Usage/);
  const help = fakeIo({});
  assert.equal(runCli(["--help"], help.io), 0);
  assert.match(help.out, /--fail-on/);
  const bad = fakeIo({ "a.yml": tidy });
  assert.equal(runCli(["a.yml", "--nope"], bad.io), 2);
  assert.match(bad.err, /--nope/);
});

test("a tidy stack passes with exit code 0, a messy one fails with 1, and the report never contains its secrets", () => {
  const ok = fakeIo({ "a.yml": tidy });
  assert.equal(runCli(["a.yml"], ok.io), 0);
  const bad = fakeIo({ "b.yml": messy });
  assert.equal(runCli(["b.yml"], bad.io), 1);
  assert.match(bad.out, /db-port-public/);
  assert.ok(!bad.out.includes("example-not-a-real"));
  assert.ok(!bad.err.includes("example-not-a-real"));
});

test("--fail-on decides which findings turn the exit code to 1", () => {
  const run = (level: string, text: string) => runCli(["x.yml", "--fail-on", level], fakeIo({ "x.yml": text }).io);
  assert.equal(run("none", messy), 0);
  assert.equal(run("fail", warnOnly), 0);
  assert.equal(run("warn", warnOnly), 1);
  assert.equal(run("fail", messy), 1);
  const bad = fakeIo({ "x.yml": tidy });
  assert.equal(runCli(["x.yml", "--fail-on", "sometimes"], bad.io), 2);
});

test("--format json is machine readable and --format github makes workflow annotations", () => {
  const json = fakeIo({ "b.yml": messy });
  runCli(["b.yml", "--format", "json"], json.io);
  const parsed = JSON.parse(json.out);
  assert.equal(parsed.files[0].file, "b.yml");
  assert.ok(parsed.files[0].findings.some((f: { id: string }) => f.id === "db-port-public"));
  assert.ok(typeof parsed.summary.fail === "number");
  assert.ok(!json.out.includes("example-not-a-real"));
  const gh = fakeIo({ "b.yml": messy });
  runCli(["b.yml", "--format", "github"], gh.io);
  assert.match(gh.out, /^::error file=b\.yml,title=db-port-public::/m);
  assert.match(gh.out, /^::warning file=b\.yml/m);
  assert.equal(escapeGithub("a%b\nc\rd"), "a%25b%0Ac%0Dd");
});

test("--disable switches rules off by id, and an unknown id is refused", () => {
  const f = fakeIo({ "b.yml": messy });
  runCli(["b.yml", "--format", "json", "--disable", "db-port-public,secret-in-env"], f.io);
  const ids = JSON.parse(f.out).files[0].findings.map((x: { id: string }) => x.id);
  assert.ok(!ids.includes("db-port-public") && !ids.includes("secret-in-env"));
  const bad = fakeIo({ "b.yml": messy });
  assert.equal(runCli(["b.yml", "--disable", "nope"], bad.io), 2);
  assert.match(bad.err, /nope/);
});

test("a missing, empty or broken file gives exit code 2 with a short message and no stack trace", () => {
  for (const [files, name] of [[{}, "missing.yml"], [{ "e.yml": "" }, "e.yml"], [{ "x.yml": "services: [" }, "x.yml"]] as const) {
    const f = fakeIo({ ...files });
    assert.equal(runCli([name], f.io), 2, name);
    assert.ok(f.err.length > 0 && !/at .*\.ts/.test(f.err), name);
  }
});

test("several files are checked as one stack (base and overrides), or one by one with --each", () => {
  const files = { "base.yml": "services:\n  db:\n    image: postgres:16\n", "over.yml": "services:\n  app:\n    image: app:1.0\n    depends_on: [db]\n" };
  const together = fakeIo(files);
  runCli(["base.yml", "over.yml", "--format", "json"], together.io);
  assert.ok(!JSON.parse(together.out).files[0].findings.some((f: { id: string }) => f.id === "depends-on-missing"));
  const each = fakeIo(files);
  runCli(["base.yml", "over.yml", "--each", "--format", "json"], each.io);
  const parsed = JSON.parse(each.out);
  assert.equal(parsed.files.length, 2);
  assert.ok(parsed.files[1].findings.some((f: { id: string }) => f.id === "depends-on-missing"));
});

test("--diff shows what would change with secrets masked, and --fix writes exactly the recommended changes", () => {
  const diff = fakeIo({ "b.yml": messy });
  assert.equal(runCli(["b.yml", "--diff", "--fail-on", "none"], diff.io), 0);
  assert.match(diff.out, /^\+ +restart: unless-stopped/m);
  assert.ok(!diff.out.includes("example-not-a-real"));
  assert.deepEqual(diff.written, {});
  const fix = fakeIo({ "b.yml": messy });
  runCli(["b.yml", "--fix", "--fail-on", "none"], fix.io);
  const expected = improve(messy, [...IMPROVE_DEFAULT_ON]);
  assert.ok(expected.ok);
  assert.equal(fix.written["b.yml"], expected.ok ? expected.output : "");
  const none = fakeIo({ "t.yml": tidy });
  runCli(["t.yml", "--fix"], none.io);
  assert.deepEqual(none.written, {}, "nothing to change, nothing written");
  const many = fakeIo({ "a.yml": tidy, "b.yml": tidy });
  assert.equal(runCli(["a.yml", "b.yml", "--fix"], many.io), 2);
});

test("--list-rules prints every rule id with its title", () => {
  const f = fakeIo({});
  assert.equal(runCli(["--list-rules"], f.io), 0);
  assert.match(f.out, /db-port-public/);
  assert.match(f.out, /traefik-router-no-entrypoint/);
});
