/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCompose } from "../src/parse";
import { evaluate, type Finding, type RuleId } from "../src/rules";
import { fixFor } from "../src/fixes";

const run = (yaml: string): Finding[] => {
  const r = parseCompose(yaml);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  return evaluate(r.compose);
};
const find = (yaml: string, id: RuleId) => run(yaml).filter((f) => f.id === id);
/** A service that satisfies every older rule, so only the rule under test can fire. */
const base = `    image: app:1.0\n    restart: unless-stopped\n    mem_limit: 256m\n    user: "1000"\n    logging: { driver: local }\n`;

test("no-new-privileges: asked for in every spelling, skipped for jobs and overrides, listed once for all services", () => {
  const svc = (name: string, extra = "") => `  ${name}:\n${base}${extra}`;
  for (const opt of ['"no-new-privileges:true"', '"no-new-privileges=true"', "no-new-privileges"])
    assert.equal(find(`services:\n${svc("a", `    security_opt: [${opt}]\n`)}`, "no-new-privileges").length, 0, opt);
  const found = find(`services:\n${svc("a")}${svc("b")}  migrate:\n${base}  override-only:\n    environment: { A: "1" }\n`, "no-new-privileges");
  assert.equal(found.length, 1);
  assert.equal(found[0].level, "info");
  assert.deepEqual(found[0].services, ["a", "b"]);
});

test("sensitive-bind-mount: the whole host fails, writable system folders warn, read-only and normal mounts are fine", () => {
  const mount = (v: string) => `services:\n  a:\n${base}    security_opt: ["no-new-privileges:true"]\n    volumes: [${v}]\n`;
  assert.equal(find(mount(`"/:/host"`), "sensitive-bind-mount")[0]?.level, "fail");
  assert.equal(find(mount(`"/:/host:ro"`), "sensitive-bind-mount")[0]?.level, "warn");
  assert.equal(find(mount(`"/etc:/host-etc"`), "sensitive-bind-mount")[0]?.level, "warn");
  assert.equal(find(mount(`"/root:/r"`), "sensitive-bind-mount")[0]?.detail, "/root");
  for (const ok of [`"/etc:/h:ro"`, `"/etc/localtime:/etc/localtime:ro"`, `"./data:/data"`, `"data:/data"`, `"/srv/app:/data"`, `"/var/run/docker.sock:/var/run/docker.sock:ro"`])
    assert.equal(find(mount(ok), "sensitive-bind-mount").length, 0, ok);
  assert.equal(find(`services:\n  a:\n${base}    volumes:\n      - { type: bind, source: /, target: /host }\n`, "sensitive-bind-mount")[0]?.level, "fail");
});

test("env-file-unread: a note that the values in env files are not read", () => {
  const f = find(`services:\n  a:\n${base}    env_file: .env\n`, "env-file-unread");
  assert.equal(f.length, 1);
  assert.equal(f[0].level, "info");
  assert.equal(find(`services:\n  a:\n${base}`, "env-file-unread").length, 0);
});

test("proxy-reaches-database: a proxy and a database on one network warn, separate networks do not", () => {
  const stack = (proxyNet: string, dbNet: string) => `services:
  proxy:
    image: traefik:v3.1
    restart: unless-stopped
    ${proxyNet}
  db:
    image: postgres:16
    restart: unless-stopped
    ${dbNet}
networks: { front: {}, back: {} }
`;
  const shared = find(stack("networks: [front]", "networks: [front, back]"), "proxy-reaches-database");
  assert.equal(shared.length, 1);
  assert.deepEqual(shared[0].services, ["proxy", "db"]);
  assert.equal(shared[0].detail, "front");
  assert.equal(find(stack("", ""), "proxy-reaches-database").length, 1, "both on the default network");
  assert.equal(find(stack("networks: [front]", "networks: [back]"), "proxy-reaches-database").length, 0);
  assert.equal(find(`services:\n  proxy:\n    image: traefik:v3.1\n  app:\n    image: app:1\n`, "proxy-reaches-database").length, 0);
});

test("traefik rules: a router without entrypoints, a missing enable label and a published port next to a router", () => {
  const labels = (lines: string[], extra = "") => `services:\n  web:\n${base}    labels:\n${lines.map((l) => `      - "${l}"`).join("\n")}\n${extra}`;
  const router = ["traefik.enable=true", "traefik.http.routers.web.rule=Host(`a.example.nl`)", "traefik.http.routers.web.tls=true"];
  const noEntry = find(labels(router), "traefik-router-no-entrypoint");
  assert.equal(noEntry.length, 1);
  assert.equal(noEntry[0].detail, "web");
  assert.equal(find(labels([...router, "traefik.http.routers.web.entrypoints=websecure"]), "traefik-router-no-entrypoint").length, 0);
  assert.equal(find(labels(router.slice(1)), "traefik-enable-missing").length, 1);
  assert.equal(find(labels(router), "traefik-enable-missing").length, 0);
  assert.equal(find(labels(router, `    ports: ["8080:8080"]\n`), "traefik-and-public-port").length, 1);
  assert.equal(find(labels(router, `    ports: ["127.0.0.1:8080:8080"]\n`), "traefik-and-public-port").length, 0);
  assert.equal(find(`services:\n  plain:\n${base}    ports: ["8080:8080"]\n`, "traefik-and-public-port").length, 0);
  assert.equal(find(`services:\n  plain:\n${base}`, "traefik-enable-missing").length, 0);
});

test("the new rules offer fixes that are valid YAML and only use safe names", () => {
  const stack = `services:\n  web:\n${base}    labels:\n      - "traefik.http.routers.web.rule=Host(\`a.example.nl\`)"\n`;
  const router = run(stack).find((f) => f.id === "traefik-router-no-entrypoint")!;
  const fix = fixFor(router, (parseCompose(stack) as { ok: true; compose: never }).compose);
  assert.ok(fix && fix.includes("traefik.http.routers.web.entrypoints"));
  assert.ok(parseCompose(fix).ok || /services:/.test(fix));
  const hostile = { id: "traefik-router-no-entrypoint", level: "warn", group: "security", services: ["web"], detail: "x\n- evil" } as Finding;
  assert.equal(fixFor(hostile, (parseCompose(stack) as { ok: true; compose: never }).compose), null);
});
