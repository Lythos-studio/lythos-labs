/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCompose } from "../src/parse";
import type { Compose } from "../src/model";

function load(yaml: string): Compose {
  const r = parseCompose(yaml);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  return r.compose;
}
const svc = (c: Compose, name: string) => c.services.find((s) => s.name === name)!;

test("the extra fields are read: profiles, labels in both forms, security options, dropped capabilities, read-only, env files", () => {
  const c = load(`
services:
  a:
    image: a:1
    profiles: [tools, debug]
    labels:
      traefik.enable: true
      traefik.http.routers.a.rule: Host(\`a.example.nl\`)
    security_opt: ["no-new-privileges:true"]
    cap_drop: [ALL]
    read_only: true
    env_file: .env
  b:
    image: b:1
    labels: ["traefik.enable=true", "plain"]
    env_file: [a.env, b.env]
  c:
    image: c:1
    env_file:
      - path: c.env
        required: false
`);
  const a = svc(c, "a");
  assert.deepEqual(a.profiles, ["tools", "debug"]);
  assert.equal(a.labels["traefik.enable"], "true");
  assert.equal(a.labels["traefik.http.routers.a.rule"], "Host(`a.example.nl`)");
  assert.deepEqual(a.securityOpt, ["no-new-privileges:true"]);
  assert.deepEqual(a.capDrop, ["ALL"]);
  assert.equal(a.readOnly, true);
  assert.equal(a.envFile, true);
  assert.equal(svc(c, "b").labels["traefik.enable"], "true");
  assert.equal(svc(c, "b").envFile, true);
  assert.equal(svc(c, "c").envFile, true);
  assert.equal(svc(c, "c").readOnly, false);
  assert.deepEqual(svc(c, "c").profiles, []);
});

test("a file where a service has neither image nor build is partial (an override), a full file is not", () => {
  assert.equal(load("services:\n  web:\n    environment: { A: '1' }\n").partial, true);
  assert.equal(load("services:\n  web:\n    image: web:1\n").partial, false);
  assert.equal(load("services:\n  web:\n    build: .\n").partial, false);
});

test("documents separated by --- are merged like a base file and its overrides", () => {
  const c = load(`
services:
  web:
    image: web:1
    ports: ["8080:8080"]
    environment: { A: "1", B: "2" }
---
services:
  web:
    image: web:2
    ports: ["9090:9090"]
    environment: { B: "3", C: "4" }
    restart: unless-stopped
  worker:
    image: worker:1
`);
  const web = svc(c, "web");
  assert.equal(web.image?.tag, "2");
  assert.deepEqual(web.ports.map((p) => p.target), ["8080", "9090"]);
  assert.deepEqual(web.env.map((e) => e.key).sort(), ["A", "B", "C"]);
  assert.equal(web.env.find((e) => e.key === "B")?.value, "3");
  assert.equal(web.restart, "unless-stopped");
  assert.equal(c.services.length, 2);
  assert.equal(c.partial, false);
});

test("an override that only refers to the base is no longer partial once merged", () => {
  const c = load("services:\n  db:\n    image: postgres:16\n---\nservices:\n  app:\n    image: app:1\n    depends_on: [db]\n");
  assert.equal(c.partial, false);
});

test("a leading --- or a trailing empty document is not a second file", () => {
  assert.equal(load("---\nservices:\n  a:\n    image: a:1\n").services.length, 1);
  assert.equal(load("services:\n  a:\n    image: a:1\n---\n").services.length, 1);
});

test("an error in a later document is reported with its line, and the total size and the document count are limited", () => {
  const r = parseCompose("services:\n  a:\n    image: a:1\n---\nservices:\n  b: [\n");
  assert.ok(!r.ok && r.error.code === "yaml-error" && (r.error.line ?? 0) >= 5);
  const many = Array.from({ length: 11 }, (_, i) => `services:\n  s${i}:\n    image: x:1\n`).join("---\n");
  const tooMany = parseCompose(many);
  assert.ok(!tooMany.ok && tooMany.error.code === "too-many-files");
  const second = parseCompose("services:\n  a:\n    image: a:1\n---\n- not a mapping\n");
  assert.ok(!second.ok && second.error.code === "not-a-mapping");
});

test("keys that could reach the prototype never do", () => {
  const before = ({} as Record<string, unknown>).polluted;
  const r = parseCompose("services:\n  a:\n    image: a:1\n    __proto__: { polluted: true }\n---\nservices:\n  a:\n    __proto__: { polluted: true }\n    constructor: { prototype: { polluted: true } }\n");
  assert.ok(r.ok);
  assert.equal(({} as Record<string, unknown>).polluted, before);
});
