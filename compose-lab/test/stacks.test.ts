/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCompose } from "../src/parse";
import { evaluate, type Finding } from "../src/rules";

/** Invented but realistic stacks, written the way people write them. They describe no real infrastructure. */
function check(yaml: string): Finding[] {
  const r = parseCompose(yaml);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  return evaluate(r.compose);
}
const loud = (f: Finding[]) => f.filter((x) => x.level !== "info");
const ids = (f: Finding[]) => f.map((x) => x.id);

const PRODUCTION = `# production-style stack: proxy, app, worker, migration job, database, cache
name: shop
x-common: &common
  restart: unless-stopped
  logging:
    driver: json-file
    options: { max-size: "10m", max-file: "3" }
  security_opt: ["no-new-privileges:true"]

services:
  proxy:
    <<: *common
    image: traefik:v3.1
    command: ["--providers.docker=true", "--providers.docker.exposedbydefault=false", "--entrypoints.web.address=:80", "--entrypoints.websecure.address=:443"]
    ports: ["80:80", "443:443"]
    volumes: ["/var/run/docker.sock:/var/run/docker.sock:ro"]
    networks: [edge]
    mem_limit: 256m
    healthcheck: { test: ["CMD", "traefik", "healthcheck", "--ping"], interval: 15s }
  app:
    <<: *common
    image: registry.example.nl/shop/app:2.7.1
    user: "1000:1000"
    environment:
      DATABASE_URL: \${DATABASE_URL}
      SESSION_SECRET: \${SESSION_SECRET}
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.app.rule=Host(\`shop.example.nl\`)"
      - "traefik.http.routers.app.entrypoints=websecure"
      - "traefik.http.routers.app.tls=true"
    depends_on:
      db: { condition: service_healthy }
      migrate: { condition: service_completed_successfully }
    networks: [edge, backend]
    mem_limit: 512m
    healthcheck: { test: ["CMD", "curl", "-f", "http://localhost:3000/health"] }
  worker:
    <<: *common
    image: registry.example.nl/shop/app:2.7.1
    command: ["node", "worker.js"]
    user: "1000:1000"
    depends_on: { db: { condition: service_healthy } }
    networks: [backend]
    mem_limit: 512m
  migrate:
    image: registry.example.nl/shop/app:2.7.1
    command: ["node", "migrate.js"]
    restart: "no"
    depends_on: { db: { condition: service_healthy } }
    networks: [backend]
  db:
    <<: *common
    image: postgres:16.4
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets: [db_password]
    volumes: [db-data:/var/lib/postgresql/data]
    networks: [backend]
    mem_limit: 1g
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U postgres"], interval: 10s }
  cache:
    <<: *common
    image: redis:7.4
    networks: [backend]
    mem_limit: 256m
    healthcheck: { test: ["CMD", "redis-cli", "ping"] }

networks:
  edge: {}
  backend: { internal: true }
volumes:
  db-data: {}
secrets:
  db_password: { file: ./secrets/db_password.txt }
`;

test("a well-built production stack with anchors, jobs, secrets files and Traefik labels raises only the known Docker socket warning for the proxy", () => {
  const found = check(PRODUCTION);
  // Traefik reading the Docker socket is a common, deliberate pattern; the rule says so and explains when it is fine.
  assert.deepEqual(loud(found).map((f) => `${f.id}:${f.services.join("|")}`), ["docker-socket:proxy"], JSON.stringify(found));
});

test("the merged restart policy, logging and security options from the anchor are seen, not demanded again", () => {
  const found = ids(check(PRODUCTION));
  for (const id of ["no-restart-policy", "unbounded-logs", "no-new-privileges"]) assert.ok(!found.includes(id as never), id);
});

const HOMELAB = `services:
  media:
    image: lscr.io/linuxserver/jellyfin:latest
    network_mode: host
    privileged: true
    environment:
      - PUID=1000
      - API_KEY=literal-demo-value
    volumes:
      - /:/host
      - /etc:/hostetc
      - /var/run/docker.sock:/var/run/docker.sock
  db:
    image: mariadb:11
    ports: ["3306:3306"]
    environment:
      MARIADB_ROOT_PASSWORD: demo-password
`;

test("a careless home-lab stack gets the serious findings, each once and with the right service", () => {
  const found = check(HOMELAB);
  const has = (id: string, service?: string) => found.some((f) => f.id === id && (!service || f.services.includes(service)));
  assert.ok(has("privileged", "media"));
  assert.ok(has("host-network", "media"));
  assert.ok(has("docker-socket", "media"));
  assert.ok(has("latest-tag", "media"));
  assert.ok(has("secret-in-env", "media") && has("secret-in-env", "db"));
  assert.ok(has("db-port-public", "db"));
  assert.ok(found.some((f) => f.id === "sensitive-bind-mount" && f.level === "fail" && f.detail === "/"));
  assert.ok(found.some((f) => f.id === "sensitive-bind-mount" && f.detail === "/etc"));
  for (const f of found) assert.ok(!JSON.stringify(f).includes("literal-demo-value") && !JSON.stringify(f).includes("demo-password"), f.id);
});

test("an override with profiles and one-off tools raises no fail", () => {
  const found = check(`services:
  adminer:
    image: adminer:4
    profiles: [tools]
    ports: ["127.0.0.1:8081:8080"]
  seed:
    image: shop/app:1
    command: ["node", "seed.js"]
    restart: "no"
`);
  assert.deepEqual(found.filter((f) => f.level === "fail"), []);
  assert.ok(!ids(found).includes("no-restart-policy"));
});

test("typical syntax variations parse: port ranges, long port syntax, variables in ports, env as list and map, numbers and booleans", () => {
  const found = check(`services:
  app:
    image: app:1.0
    restart: unless-stopped
    ports:
      - "127.0.0.1:8000-8010:8000-8010"
      - target: 9000
        published: "9000"
        host_ip: 127.0.0.1
      - "\${APP_PORT:-8080}:8080"
    environment:
      - DEBUG=false
      - WORKERS=4
      - EMPTY=
      - PASSTHROUGH
    deploy:
      resources:
        limits: { memory: 512M }
`);
  assert.ok(Array.isArray(found));
  assert.ok(!ids(found).includes("no-memory-limit"));
});
