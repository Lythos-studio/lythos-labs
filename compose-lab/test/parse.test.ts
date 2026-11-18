/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCompose } from "../src/parse";
import { LIMITS, type Compose } from "../src/model";

function compose(yaml: string): Compose {
  const r = parseCompose(yaml);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  return r.compose;
}
const only = (yaml: string) => compose(yaml).services[0];
const refused = (yaml: string) => {
  const r = parseCompose(yaml);
  assert.ok(!r.ok, "expected an error");
  return r.error;
};

test("ports are read in the short and the long form, with IPs, ranges and protocols", () => {
  const s = only(`
services:
  web:
    image: nginx:1.27
    ports:
      - "80:80"
      - "127.0.0.1:5432:5432"
      - "8080"
      - 9000
      - "[::1]:3000:3000"
      - "53:53/udp"
      - "8000-8010:8000-8010"
      - { target: 443, published: 8443, host_ip: 10.0.0.5, protocol: tcp }
`);
  assert.deepEqual(s.ports, [
    { hostIp: undefined, published: "80", target: "80", protocol: "tcp" },
    { hostIp: "127.0.0.1", published: "5432", target: "5432", protocol: "tcp" },
    { hostIp: undefined, published: undefined, target: "8080", protocol: "tcp" },
    { hostIp: undefined, published: undefined, target: "9000", protocol: "tcp" },
    { hostIp: "::1", published: "3000", target: "3000", protocol: "tcp" },
    { hostIp: undefined, published: "53", target: "53", protocol: "udp" },
    { hostIp: undefined, published: "8000-8010", target: "8000-8010", protocol: "tcp" },
    { hostIp: "10.0.0.5", published: "8443", target: "443", protocol: "tcp" },
  ]);
});

test("odd port entries are skipped instead of breaking the file", () => {
  assert.equal(only(`services:\n  a:\n    ports: ["", "[::1", "1:2:3:4", null, [], 80]\n`).ports.length, 1);
});

test("volumes are told apart: named, bind, anonymous, read-only, long form", () => {
  const s = only(`
services:
  db:
    image: postgres:16
    volumes:
      - data:/var/lib/postgresql/data
      - ./init:/docker-entrypoint-initdb.d:ro
      - /var/run/docker.sock:/var/run/docker.sock
      - /cache
      - { type: tmpfs, target: /tmp }
      - { type: bind, source: ./conf, target: /conf, read_only: true }
`);
  assert.deepEqual(s.mounts, [
    { kind: "volume", source: "data", target: "/var/lib/postgresql/data", readOnly: false },
    { kind: "bind", source: "./init", target: "/docker-entrypoint-initdb.d", readOnly: true },
    { kind: "bind", source: "/var/run/docker.sock", target: "/var/run/docker.sock", readOnly: false },
    { kind: "volume", target: "/cache", readOnly: false },
    { kind: "tmpfs", source: undefined, target: "/tmp", readOnly: false },
    { kind: "bind", source: "./conf", target: "/conf", readOnly: true },
  ]);
});

test("depends_on works as a list and as a map with conditions", () => {
  const { services } = compose(`
services:
  a: { depends_on: [b, c] }
  b: { depends_on: { c: { condition: service_healthy }, d: {} } }
  c: {}
  d: {}
`);
  assert.deepEqual(services[0].dependsOn, [{ name: "b" }, { name: "c" }]);
  assert.equal(services[0].dependsShort, true);
  assert.deepEqual(services[1].dependsOn, [{ name: "c", condition: "service_healthy" }, { name: "d", condition: undefined }]);
  assert.equal(services[1].dependsShort, false);
});

test("environment is read as a map or a list, and values are classified", () => {
  const s = only(`
services:
  app:
    environment:
      LITERAL: abc
      NUM: 5
      EMPTY: ""
      FROM_HOST:
      VAR: \${DB_PASSWORD:-x}
`);
  assert.deepEqual(s.env, [
    { key: "LITERAL", kind: "literal", value: "abc" },
    { key: "NUM", kind: "literal", value: "5" },
    { key: "EMPTY", kind: "empty" },
    { key: "FROM_HOST", kind: "passthrough" },
    { key: "VAR", kind: "variable", value: "${DB_PASSWORD:-x}" },
  ]);
  const list = only(`services:\n  app:\n    environment:\n      - A=1\n      - B\n      - C=\n      - D=$X\n`).env;
  assert.deepEqual(list.map((e) => [e.key, e.kind]), [["A", "literal"], ["B", "passthrough"], ["C", "empty"], ["D", "variable"]]);
});

test("images, healthchecks, restart, limits and the small flags are read", () => {
  const { services } = compose(`
services:
  a: { image: "registry.example.com:5000/team/app:1.2", restart: unless-stopped, privileged: true, cap_add: [SYS_ADMIN], network_mode: host, user: "1000:1000", container_name: fixed, mem_limit: 512m }
  b: { image: nginx, healthcheck: { test: ["CMD", "true"] } }
  c: { image: "redis@sha256:abc", healthcheck: { disable: true }, logging: { driver: json-file, options: { max-size: 10m } } }
  d: { image: "x:latest", healthcheck: { test: ["NONE"] }, build: ., deploy: { resources: { limits: { memory: 1g } }, restart_policy: { condition: on-failure } } }
`);
  const [a, b, c, d] = services;
  assert.deepEqual(a.image, { raw: "registry.example.com:5000/team/app:1.2", name: "registry.example.com:5000/team/app", tag: "1.2", digest: undefined });
  assert.deepEqual(
    [a.restart, a.privileged, a.capAdd, a.networkMode, a.user, a.containerName, a.hasMemoryLimit],
    ["unless-stopped", true, ["SYS_ADMIN"], "host", "1000:1000", "fixed", true],
  );
  assert.deepEqual(b.image, { raw: "nginx", name: "nginx", tag: undefined, digest: undefined });
  assert.deepEqual([a.healthcheck, b.healthcheck, c.healthcheck, d.healthcheck], ["none", "set", "disabled", "disabled"]);
  assert.deepEqual(c.image, { raw: "redis@sha256:abc", name: "redis", tag: undefined, digest: "sha256:abc" });
  assert.equal(c.hasLogLimits, true);
  assert.deepEqual([d.hasBuild, d.hasMemoryLimit, d.restart, d.image?.tag], [true, true, "on-failure", "latest"]);
});

test("top-level networks, volumes and the obsolete version are noted", () => {
  const c = compose(`
version: "3.8"
services: { a: { networks: [front, back] } }
networks: { front: {}, back: { external: true }, unused: null }
volumes: { data: {}, shared: { external: true } }
`);
  assert.equal(c.hasVersion, true);
  assert.deepEqual(c.services[0].networks, ["front", "back"]);
  assert.deepEqual(c.networks, [{ name: "front", external: false }, { name: "back", external: true }, { name: "unused", external: false }]);
  assert.deepEqual(c.volumes, [{ name: "data", external: false }, { name: "shared", external: true }]);
});

test("anchors, merge keys and x- extensions are resolved by the YAML library", () => {
  const { services } = compose(`
x-common: &common
  restart: unless-stopped
  image: app:1
services:
  one:
    <<: *common
  two:
    <<: *common
    image: app:2
`);
  assert.deepEqual(
    services.map((s) => [s.name, s.image?.raw, s.restart]),
    [["one", "app:1", "unless-stopped"], ["two", "app:2", "unless-stopped"]],
  );
});

test("a service written as an empty entry is still a service", () => {
  assert.deepEqual(compose("services:\n  web:\n").services.map((s) => s.name), ["web"]);
});

test("broken or unsuitable input gives an error value, with a line for YAML errors", () => {
  assert.equal(refused("").code, "empty");
  assert.equal(refused("   \n").code, "empty");
  assert.equal(refused("- a\n- b\n").code, "not-a-mapping");
  assert.equal(refused("services: {}\n").code, "no-services");
  assert.equal(refused("name: x\n").code, "no-services");
  const bad = refused("services:\n  a:\n    image: x\n   bad: 1\n");
  assert.equal(bad.code, "yaml-error");
  assert.equal(typeof bad.line, "number");
  assert.equal(refused("services:\n  a: {}\n---\nservices:\n  b: {}\n").code, "yaml-error");
  assert.equal(refused("services:\n  a: 1\n  a: 2\n").code, "yaml-error");
  assert.equal(refused("services:\n\ta: 1\n").code, "yaml-error");
});

test("limits: too large, too many services, an alias bomb and deep nesting are refused quickly", () => {
  const started = Date.now();
  assert.equal(refused("services:\n  a:\n    image: " + "x".repeat(LIMITS.chars)).code, "too-large");
  assert.equal(
    refused("services:\n" + Array.from({ length: LIMITS.services + 1 }, (_, i) => `  s${i}: {}\n`).join("")).code,
    "too-many-services",
  );
  const letters = "abcdefghijklmnop";
  const bomb = [
    `${letters[0]}: &${letters[0]} [x, x, x, x, x, x, x, x, x]`,
    ...Array.from({ length: 12 }, (_, i) => `${letters[i + 1]}: &${letters[i + 1]} [${Array(9).fill("*" + letters[i]).join(", ")}]`),
  ];
  assert.equal(refused("services:\n  a: {}\nx-bomb:\n" + bomb.map((l) => "  " + l).join("\n") + "\n").code, "alias-limit");
  assert.ok(["parse-failed", "yaml-error"].includes(refused("services:\n  a: " + "[".repeat(50_000)).code));
  assert.ok(["parse-failed", "yaml-error"].includes(refused("services: " + "{a: ".repeat(30_000)).code));
  assert.ok(Date.now() - started < 3000, `took ${Date.now() - started} ms`);
});

test("custom YAML tags never run code and never throw out of the parser", () => {
  const r = parseCompose("services:\n  a:\n    image: !!js/function 'function(){ return 1 }'\n");
  assert.ok(r.ok || r.error.code === "yaml-error" || r.error.code === "parse-failed");
  if (r.ok) assert.equal(r.compose.services[0].image?.raw.startsWith("function"), true);
});
