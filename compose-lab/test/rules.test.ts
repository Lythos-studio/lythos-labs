/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCompose } from "../src/parse";
import { evaluate, RULES, type Finding, type RuleId } from "../src/rules";
import { fixFor } from "../src/fixes";
import type { Compose } from "../src/model";

function load(yaml: string): Compose {
  const r = parseCompose(yaml);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  return r.compose;
}
const run = (yaml: string) => evaluate(load(yaml));
const ids = (yaml: string) => run(yaml).map((f) => f.id);
const has = (yaml: string, id: RuleId, service?: string) => run(yaml).some((f) => f.id === id && (!service || f.services.includes(service)));
/** A small, healthy service that triggers none of the rules, to build cases from. */
const ok = (extra = "") => `    image: app:1.0\n    restart: unless-stopped\n    mem_limit: 256m\n    user: "1000"\n    logging: { driver: local }\n    security_opt: ["no-new-privileges:true"]\n${extra}`;

test("a tidy stack has no findings", () => {
  assert.deepEqual(
    ids(`
services:
  web:
${ok(`    ports: ["127.0.0.1:8080:8080"]\n    healthcheck: { test: ["CMD", "true"] }\n    depends_on: { db: { condition: service_healthy } }`)}
  db:
    image: postgres:16
    restart: unless-stopped
    mem_limit: 512m
    logging: { driver: local }
    security_opt: ["no-new-privileges:true"]
    healthcheck: { test: ["CMD-SHELL", "pg_isready"] }
    volumes: [data:/var/lib/postgresql/data]
volumes: { data: {} }
`),
    [],
  );
});

test("db-port-public: a database on all interfaces fails, on localhost it does not", () => {
  const stack = (ports: string, image = "postgres:16") => `services:\n  db:\n    image: ${image}\n    ports: [${ports}]\n`;
  assert.ok(has(stack(`"5432:5432"`), "db-port-public", "db"));
  assert.ok(has(stack(`"0.0.0.0:5432:5432"`), "db-port-public"));
  assert.ok(has(stack(`"6379:6379"`, "redis:7"), "db-port-public"));
  assert.ok(has(stack(`"15432:5432"`, "custom/thing:1"), "db-port-public"), "recognised by the container port");
  assert.ok(!has(stack(`"127.0.0.1:5432:5432"`), "db-port-public"));
  assert.ok(!has(stack(`"[::1]:5432:5432"`), "db-port-public"));
  assert.equal(run(stack(`"5432:5432"`)).find((f) => f.id === "db-port-public")?.detail, "5432:5432");
  assert.ok(!has(stack(`"5432:5432"`), "port-all-interfaces"), "reported once, as the worse rule");
});

test("port-all-interfaces: warns for apps, not for a proxy on 80 and 443", () => {
  assert.ok(has(`services:\n  app:\n    image: app:1\n    ports: ["8080:8080"]\n`, "port-all-interfaces"));
  assert.ok(has(`services:\n  app:\n    image: app:1\n    ports: ["8080"]\n`, "port-all-interfaces"), "a bare container port is published on a random host port, on all interfaces");
  assert.ok(!has(`services:\n  app:\n    image: app:1\n    ports: ["127.0.0.1:8080:8080"]\n`, "port-all-interfaces"));
  assert.ok(!has(`services:\n  proxy:\n    image: traefik:v3.1\n    ports: ["80:80", "443:443"]\n`, "port-all-interfaces"));
  assert.ok(has(`services:\n  proxy:\n    image: traefik:v3.1\n    ports: ["8080:8080"]\n`, "port-all-interfaces"));
});

test("privileged, docker socket and host network", () => {
  assert.ok(has(`services:\n  a:\n    image: x:1\n    privileged: true\n`, "privileged"));
  assert.ok(has(`services:\n  a:\n    image: x:1\n    cap_add: [sys_admin]\n`, "privileged"));
  assert.ok(!has(`services:\n  a:\n    image: x:1\n    cap_add: [NET_BIND_SERVICE]\n`, "privileged"));
  assert.ok(has(`services:\n  a:\n    image: x:1\n    volumes: ["/var/run/docker.sock:/var/run/docker.sock:ro"]\n`, "docker-socket"));
  assert.ok(!has(`services:\n  a:\n    image: x:1\n    volumes: ["./data:/data"]\n`, "docker-socket"));
  assert.ok(has(`services:\n  a:\n    image: x:1\n    network_mode: host\n`, "host-network"));
});

test("secret-in-env: a fixed value for a secret-looking key fails; variables, empty values and _FILE keys do not", () => {
  const env = (lines: string) => `services:\n  a:\n    image: x:1\n    environment:\n${lines}`;
  const found = run(env(`      DB_PASSWORD: hunter2\n      API_KEY: abc\n      LOG_LEVEL: debug\n`)).find((f) => f.id === "secret-in-env");
  assert.equal(found?.level, "fail");
  assert.equal(found?.detail, "DB_PASSWORD, API_KEY");
  assert.ok(!has(env(`      DB_PASSWORD: \${DB_PASSWORD}\n`), "secret-in-env"));
  assert.ok(!has(env(`      DB_PASSWORD: ""\n`), "secret-in-env"));
  assert.ok(!has(env(`      DB_PASSWORD:\n`), "secret-in-env"));
  assert.ok(!has(env(`      DB_PASSWORD_FILE: /run/secrets/db\n`), "secret-in-env"));
  assert.ok(has(`services:\n  a:\n    image: x:1\n    environment: ["SESSION_SECRET=abc"]\n`, "secret-in-env"));
});

test("the finding never contains an environment value", () => {
  const findings = run(`services:\n  a:\n    image: x:1\n    environment:\n      DB_PASSWORD: s3cr3t-value-123\n`);
  assert.ok(!JSON.stringify(findings).includes("s3cr3t-value-123"));
});

test("latest-tag: no tag and latest warn; a version or a digest do not; a build-only service is skipped", () => {
  const image = (i: string) => `services:\n  a:\n    image: ${i}\n`;
  assert.ok(has(image("nginx"), "latest-tag"));
  assert.ok(has(image("nginx:latest"), "latest-tag"));
  assert.ok(!has(image("nginx:1.27"), "latest-tag"));
  assert.ok(!has(image('"nginx@sha256:abc"'), "latest-tag"));
  assert.ok(!has(`services:\n  a:\n    build: .\n`, "latest-tag"));
  assert.ok(!has(image("registry.example.com:5000/team/app:1.2"), "latest-tag"));
});

test("health, restart, limits and logs: jobs are left alone and the aggregated hints list the services", () => {
  const web = `services:\n  web:\n    image: app:1\n    ports: ["127.0.0.1:80:80"]\n`;
  assert.ok(has(web, "no-healthcheck", "web"));
  assert.ok(has(web, "no-restart-policy", "web"));
  const jobs = `services:\n  migrate:\n    image: app:1\n  seed:\n    image: app:1\n    restart: "no"\n`;
  assert.deepEqual(ids(jobs).filter((i) => ["no-restart-policy", "no-memory-limit", "unbounded-logs", "no-healthcheck"].includes(i)), []);
  assert.ok(has(`services:\n  db:\n    image: x:1\n    restart: always\n  app:\n    image: y:1\n    restart: always\n    depends_on: [db]\n`, "no-healthcheck", "db"), "a service others depend on needs a healthcheck");
  const memory = run(web).find((f) => f.id === "no-memory-limit");
  assert.deepEqual(memory?.services, ["web"]);
  assert.equal(memory?.level, "info");
  assert.ok(!has(`services:\n  a:\n    image: x:1\n    restart: always\n    mem_limit: 1g\n    logging: { driver: json-file, options: { max-size: 10m } }\n`, "no-memory-limit"));
});

test("depends_on: missing targets fail; the short form on a service with a healthcheck warns", () => {
  assert.ok(has(`services:\n  a:\n    image: x:1\n    depends_on: [ghost]\n`, "depends-on-missing", "a"));
  const stack = (dep: string) => `services:\n  a:\n    image: x:1\n    depends_on: ${dep}\n  b:\n    image: y:1\n    healthcheck: { test: ["CMD", "true"] }\n`;
  assert.ok(has(stack("[b]"), "depends-without-condition"));
  assert.ok(has(stack("{ b: {} }"), "depends-without-condition"));
  assert.ok(!has(stack("{ b: { condition: service_healthy } }"), "depends-without-condition"));
  assert.ok(!has(`services:\n  a:\n    image: x:1\n    depends_on: [b]\n  b:\n    image: y:1\n`, "depends-without-condition"), "no healthcheck on the target: another rule covers that");
});

test("duplicate-host-port: the same host port twice fails, different IPs or protocols do not; ranges are compared as written", () => {
  const two = (a: string, b: string) => `services:\n  a:\n    image: x:1\n    ports: ["${a}"]\n  b:\n    image: y:1\n    ports: ["${b}"]\n`;
  const clash = run(two("8080:80", "8080:81")).find((f) => f.id === "duplicate-host-port");
  assert.deepEqual([clash?.services, clash?.detail], [["a", "b"], "8080"]);
  assert.ok(has(two("8080:80", "127.0.0.1:8080:81"), "duplicate-host-port"), "all interfaces overlap a specific IP");
  assert.ok(!has(two("127.0.0.1:8080:80", "127.0.0.2:8080:81"), "duplicate-host-port"));
  assert.ok(!has(two("53:53/udp", "53:53/tcp"), "duplicate-host-port"));
  assert.ok(has(`services:\n  a:\n    image: x:1\n    ports: ["9000:1", "9000:2"]\n`, "duplicate-host-port", "a"));
});

test("networks and volumes: undeclared fails, unused is a hint, external and default are fine", () => {
  assert.ok(has(`services:\n  a:\n    image: x:1\n    networks: [front]\n`, "network-undeclared", "a"));
  assert.ok(!has(`services:\n  a:\n    image: x:1\n    networks: [default]\n`, "network-undeclared"));
  assert.ok(!has(`services:\n  a:\n    image: x:1\n    networks: [front]\nnetworks: { front: { external: true } }\n`, "network-undeclared"));
  const unused = run(`services:\n  a:\n    image: x:1\nnetworks: { spare: {}, ext: { external: true } }\nvolumes: { old: {}, ext: { external: true } }\n`);
  assert.deepEqual(unused.filter((f) => f.id === "network-unused").map((f) => f.detail), ["spare"]);
  assert.deepEqual(unused.filter((f) => f.id === "volume-unused").map((f) => f.detail), ["old"]);
  assert.ok(!has(`services:\n  a:\n    image: x:1\n    volumes: ["old:/x"]\nvolumes: { old: {} }\n`, "volume-unused"));
});

test("container_name and the obsolete version are hints", () => {
  assert.deepEqual(run(`version: "3"\nservices:\n  a:\n    image: x:1\n    container_name: fixed\n`).filter((f) => ["version-obsolete", "container-name-set"].includes(f.id)).map((f) => [f.id, f.level]), [
    ["container-name-set", "info"],
    ["version-obsolete", "info"],
  ]);
});

test("runs-as-root is only mentioned for services that open a port", () => {
  assert.ok(has(`services:\n  a:\n    image: x:1\n    ports: ["127.0.0.1:80:80"]\n`, "runs-as-root"));
  assert.ok(!has(`services:\n  a:\n    image: x:1\n`, "runs-as-root"));
  assert.ok(!has(`services:\n  a:\n    image: x:1\n    user: app\n    ports: ["127.0.0.1:80:80"]\n`, "runs-as-root"));
});

test("a cycle in depends_on is not a crash", () => {
  assert.doesNotThrow(() => run(`services:\n  a:\n    image: x:1\n    depends_on: [b]\n  b:\n    image: y:1\n    depends_on: [a]\n`));
});

test("findings are sorted worst first, then by group, and every rule id is classified", () => {
  const findings = run(`
services:
  db:
    image: postgres
    ports: ["5432:5432"]
    environment: { POSTGRES_PASSWORD: x }
`);
  const order = { fail: 0, warn: 1, info: 2 };
  for (let i = 1; i < findings.length; i++) assert.ok(order[findings[i - 1].level] <= order[findings[i].level]);
  for (const f of findings) assert.equal(f.group, RULES[f.id]);
});

test("fixes: snippets use the service name and fixed templates, and refuse names that are not plain", () => {
  const compose = load(`services:\n  db:\n    image: postgres:16\n    ports: ["5432:5432"]\n    environment: { POSTGRES_PASSWORD: x }\n`);
  const by = (id: RuleId): Finding => evaluate(compose).find((f) => f.id === id) as Finding;
  assert.equal(fixFor(by("db-port-public"), compose), `services:\n  db:\n    ports:\n      - "127.0.0.1:5432:5432"  # reachable from this machine only\n    # or remove "ports:" and let other services reach it over the network`);
  assert.match(fixFor(by("no-healthcheck"), compose) ?? "", /pg_isready/);
  assert.match(fixFor(by("secret-in-env"), compose) ?? "", /POSTGRES_PASSWORD: \$\{POSTGRES_PASSWORD\}/);
  assert.ok(!(fixFor(by("secret-in-env"), compose) ?? "").includes("x\n"));

  const odd = load(`services:\n  "a: {b}\\n  c: d":\n    image: x\n    ports: ["8080:80"]\n`);
  for (const f of evaluate(odd)) {
    const snippet = fixFor(f, odd);
    if (snippet) assert.ok(!/[{}]\\n|a: \{b\}/.test(snippet.replace(/\$\{[A-Z_]+\}/g, "")), `${f.id}: ${snippet}`);
  }
  assert.equal(fixFor({ id: "latest-tag", level: "warn", group: "security", services: ["a b"] }, load("services:\n  a b:\n    image: x\n")), null);
});

test("the examples behave as advertised: the tidy one is clean, the messy one trips the main rules", async () => {
  const { EXAMPLES } = await import("../src/examples");
  const [tidy, messy] = EXAMPLES.map((e) => run(e.yaml));
  assert.deepEqual(tidy.filter((f) => f.level !== "info"), [], "the tidy example has no failures or warnings");
  const got = new Set(messy.map((f) => f.id));
  for (const id of ["db-port-public", "port-all-interfaces", "privileged", "docker-socket", "host-network", "secret-in-env", "latest-tag", "depends-on-missing", "duplicate-host-port", "network-unused", "volume-unused", "container-name-set", "version-obsolete", "depends-without-condition"] as RuleId[])
    assert.ok(got.has(id), `messy example misses ${id}`);
});
