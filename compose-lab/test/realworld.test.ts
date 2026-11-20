/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCompose } from "../src/parse";
import { evaluate, type Finding, type RuleId } from "../src/rules";

const run = (yaml: string): Finding[] => {
  const r = parseCompose(yaml);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  return evaluate(r.compose);
};
const ids = (yaml: string) => run(yaml).map((f) => f.id);
const has = (yaml: string, id: RuleId, service?: string) => run(yaml).some((f) => f.id === id && (!service || f.services.includes(service)));

test("one-off jobs and profile services are not asked for health, restart policy, limits or log limits", () => {
  for (const name of ["scanner", "verify", "restore-db", "db-backup", "e2e-tests", "nightly-job", "lint"]) {
    const found = ids(`services:\n  ${name}:\n    image: tool:1.0\n    ports: ["127.0.0.1:9000:9000"]\n`);
    for (const id of ["no-healthcheck", "no-restart-policy", "no-memory-limit", "unbounded-logs"] as const) assert.ok(!found.includes(id), `${name} ${id}`);
  }
  const profiled = ids(`services:\n  debug:\n    image: tool:1.0\n    profiles: [debug]\n    ports: ["127.0.0.1:9000:9000"]\n`);
  assert.ok(!profiled.includes("no-restart-policy") && !profiled.includes("no-healthcheck"));
  assert.ok(has(`services:\n  api:\n    image: api:1.0\n`, "no-restart-policy", "api"), "a normal service is still asked");
});

test("an override file gets one note and no false fails about things defined elsewhere", () => {
  const overlay = `services:
  web:
    environment: { A: "1" }
    depends_on: [db]
    networks: [backend]
`;
  const found = run(overlay);
  assert.ok(found.some((f) => f.id === "partial-file" && f.level === "info" && f.services.includes("web")));
  for (const id of ["depends-on-missing", "network-undeclared", "no-healthcheck", "no-restart-policy", "no-memory-limit", "unbounded-logs"] as const)
    assert.ok(!found.some((f) => f.id === id), id);
});

test("a full file still fails on a real missing dependency, and base plus override together are checked as one stack", () => {
  assert.ok(has(`services:\n  app:\n    image: app:1.0\n    depends_on: [db]\n`, "depends-on-missing", "app"));
  const merged = `services:\n  db:\n    image: postgres:16\n---\nservices:\n  app:\n    image: app:1.0\n    depends_on: [db]\n`;
  assert.ok(!has(merged, "depends-on-missing"));
  assert.ok(!has(merged, "partial-file"));
});
