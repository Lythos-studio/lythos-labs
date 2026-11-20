/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { diffLines, improve, IMPROVE_DEFAULT_ON, type ImproveId } from "../src/improve";
import { parseCompose } from "../src/parse";
import { evaluate } from "../src/rules";
import { EXAMPLES } from "../src/examples";

const apply = (text: string, ids: ImproveId[]) => {
  const r = improve(text, ids);
  assert.ok(r.ok, JSON.stringify(r));
  return r;
};
const ALL: ImproveId[] = ["remove-version", "add-restart", "add-log-limits", "bind-db-localhost", "add-no-new-privileges"];

const SAMPLE = `# my stack
version: "3.8"

services:
  web:
    image: example/web:1.0   # the app
    ports:
      - "8080:8080"
    environment:
      A: "1"  # keep this comment

  db:
    image: postgres:16
    ports: ["5432:5432", "127.0.0.1:5433:5432"]
    volumes: [data:/var/lib/postgresql/data]
    security_opt: [seccomp:unconfined]

  migrate:
    image: example/web:1.0
    command: ["node", "migrate.js"]

volumes: { data: {} }
`;

test("with nothing chosen the output is the input, byte for byte, for every example and the sample", () => {
  for (const text of [SAMPLE, ...EXAMPLES.map((e) => e.yaml)]) assert.equal(apply(text, []).output, text);
});

test("the available changes are listed whatever is chosen", () => {
  const { changes } = apply(SAMPLE, []);
  const by = Object.fromEntries(changes.map((c) => [c.id, c.services]));
  assert.deepEqual(Object.keys(by).sort(), ["add-log-limits", "add-no-new-privileges", "add-restart", "bind-db-localhost", "remove-version"]);
  assert.deepEqual(by["add-restart"], ["web", "db"], "the migrate job is left alone");
  assert.deepEqual(by["bind-db-localhost"], ["db"]);
});

test("each change touches only its own lines and keeps comments, quotes and blank lines", () => {
  const out = (id: ImproveId) => apply(SAMPLE, [id]).output;
  assert.equal(out("remove-version"), SAMPLE.replace('version: "3.8"\n', ""));
  assert.ok(out("add-restart").includes("    ports:\n      - \"8080:8080\"\n    environment:\n      A: \"1\"  # keep this comment\n    restart: unless-stopped\n"));
  assert.ok(out("bind-db-localhost").includes('ports: ["127.0.0.1:5432:5432", "127.0.0.1:5433:5432"]'));
  assert.ok(out("add-log-limits").includes('    logging:\n      driver: json-file\n      options:\n        max-size: "10m"\n        max-file: "3"\n'));
  assert.ok(out("add-no-new-privileges").includes("    security_opt: [seccomp:unconfined, no-new-privileges:true]"));
  for (const id of ALL) for (const line of out(id).split("\n")) if (line.includes("# keep this comment")) assert.equal(line, '      A: "1"  # keep this comment');
});

test("everything together is still valid, parses, and clears the findings it claims to", () => {
  const out = apply(SAMPLE, ALL).output;
  const parsed = parseCompose(out);
  assert.ok(parsed.ok);
  const ids = evaluate(parsed.compose).map((f) => f.id);
  for (const gone of ["version-obsolete", "db-port-public", "no-restart-policy", "unbounded-logs", "no-new-privileges"]) assert.ok(!ids.includes(gone as never), gone);
  assert.ok(out.includes("# my stack") && out.includes("# the app"));
});

test("running it twice changes nothing more (idempotent)", () => {
  const once = apply(SAMPLE, ALL).output;
  const again = apply(once, ALL);
  assert.equal(again.output, once);
  assert.deepEqual(again.changes, []);
});

test("windows line endings are kept", () => {
  const crlf = SAMPLE.replace(/\n/g, "\r\n");
  const out = apply(crlf, ["add-restart", "remove-version"]).output;
  assert.ok(!/[^\r]\n/.test(out), "no bare line feed was introduced");
  assert.ok(out.includes("restart: unless-stopped\r\n"));
});

test("services written in flow style, aliases and merged keys are left alone instead of being broken", () => {
  const text = `x-base: &base\n  restart: unless-stopped\nservices:\n  a: { image: a:1 }\n  b:\n    <<: *base\n    image: b:1\n`;
  const r = apply(text, ALL);
  assert.ok(parseCompose(r.output).ok);
  assert.ok(!r.output.includes("a: { image: a:1, restart"), "flow style is not patched");
  assert.equal((r.output.match(/restart:/g) ?? []).length, 1, "the merged restart is not duplicated");
});

test("multiple files, empty or broken input are refused with a reason, never a crash", () => {
  assert.deepEqual(improve("services:\n  a:\n    image: a:1\n---\nservices:\n  b:\n    image: b:1\n", []), { ok: false, reason: "multiple-files" });
  assert.deepEqual(improve("", []), { ok: false, reason: "empty" });
  assert.deepEqual(improve("services: [", []), { ok: false, reason: "parse-error" });
});

test("a secret is never changed or copied by an automatic change", () => {
  const text = "services:\n  a:\n    image: a:1\n    environment:\n      DB_PASSWORD: hunter2\n";
  const out = apply(text, ALL).output;
  assert.ok(out.includes("DB_PASSWORD: hunter2"), "left as it was");
  assert.equal((out.match(/hunter2/g) ?? []).length, 1);
});

test("the recommended set is on by default and the hardening change is not", () => {
  assert.deepEqual([...IMPROVE_DEFAULT_ON].sort(), ["add-log-limits", "add-restart", "bind-db-localhost", "remove-version"]);
});

test("diffLines marks removed and added lines and keeps unchanged ones", () => {
  assert.deepEqual(diffLines("a\nb\nc\n", "a\nx\nc\n"), [
    { kind: "same", text: "a" },
    { kind: "removed", text: "b" },
    { kind: "added", text: "x" },
    { kind: "same", text: "c" },
  ]);
  assert.deepEqual(diffLines("a\n", "a\n"), [{ kind: "same", text: "a" }]);
  assert.deepEqual(diffLines("", "a\n"), [{ kind: "added", text: "a" }]);
  const big = Array.from({ length: 6000 }, (_, i) => `l${i}`).join("\n");
  assert.ok(diffLines(big, big + "\nx").length > 0, "large input still returns quickly");
});
