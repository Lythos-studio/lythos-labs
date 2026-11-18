/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { Compose } from "./model";
import type { Finding } from "./rules";

/** Names that are safe to put into a snippet as plain text. Anything else gets no snippet that uses it. */
const SAFE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/;
const SAFE_IMAGE = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/;
const SAFE_KEY = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

const HEALTH: Record<string, string> = {
  postgres: `["CMD-SHELL", "pg_isready -U postgres"]`,
  postgresql: `["CMD-SHELL", "pg_isready -U postgres"]`,
  mysql: `["CMD", "mysqladmin", "ping", "-h", "localhost"]`,
  mariadb: `["CMD", "healthcheck.sh", "--connect"]`,
  redis: `["CMD", "redis-cli", "ping"]`,
  valkey: `["CMD", "valkey-cli", "ping"]`,
};

/**
 * A snippet that addresses a finding, built from fixed templates. Only values that pass a strict pattern are placed
 * in it, never text taken as-is from the file, and never an environment value.
 */
export function fixFor(finding: Finding, compose: Compose): string | null {
  const name = finding.services[0];
  const service = compose.services.find((s) => s.name === name);
  const safeName = name !== undefined && SAFE.test(name);
  const wrap = (body: string) => (safeName ? `services:\n  ${name}:\n${body.replace(/^/gm, "    ")}` : null);
  switch (finding.id) {
    case "db-port-public":
    case "port-all-interfaces": {
      const [a, b] = (finding.detail ?? "").split(":");
      const target = b ?? a;
      return /^\d+$/.test(target) && /^\d+$/.test(a)
        ? wrap(`ports:\n  - "127.0.0.1:${a}:${target}"  # reachable from this machine only\n# or remove "ports:" and let other services reach it over the network`)
        : null;
    }
    case "privileged":
      return wrap(`# remove "privileged: true" and add only the capability that is needed\ncap_add:\n  - NET_BIND_SERVICE`);
    case "docker-socket":
      return wrap(`volumes:\n  - /var/run/docker.sock:/var/run/docker.sock:ro  # only for a service that must see containers`);
    case "host-network":
      return wrap(`# remove "network_mode: host", then publish only what is needed\nports:\n  - "127.0.0.1:8080:8080"`);
    case "secret-in-env": {
      const keys = (finding.detail ?? "").split(", ").filter((k) => SAFE_KEY.test(k));
      return keys.length ? wrap(`environment:\n${keys.map((k) => `  ${k}: \${${k}}  # set it in .env or your secret store`).join("\n")}`) : null;
    }
    case "latest-tag":
      return service?.image && SAFE_IMAGE.test(service.image.name) ? wrap(`image: ${service.image.name}:<version>  # pin a version, or a digest`) : null;
    case "runs-as-root":
      return wrap(`user: "1000:1000"  # a non-root user the image supports`);
    case "no-healthcheck": {
      const base = service?.image?.name.split("/").pop()?.toLowerCase() ?? "";
      const port = service?.ports.find((p) => /^\d+$/.test(p.target))?.target ?? "8080";
      const test = HEALTH[base] ?? `["CMD", "curl", "-f", "http://localhost:${port}/health"]`;
      return wrap(`healthcheck:\n  test: ${test}\n  interval: 10s\n  timeout: 3s\n  retries: 5`);
    }
    case "depends-without-condition":
      return finding.detail && SAFE.test(finding.detail) ? wrap(`depends_on:\n  ${finding.detail}:\n    condition: service_healthy`) : null;
    case "no-restart-policy":
      return wrap(`restart: unless-stopped`);
    case "no-memory-limit":
      return `services:\n  <service>:\n    mem_limit: 512m  # a value that fits the service`;
    case "unbounded-logs":
      return `services:\n  <service>:\n    logging:\n      driver: json-file\n      options:\n        max-size: "10m"\n        max-file: "3"`;
    case "network-undeclared":
      return finding.detail && SAFE.test(finding.detail) ? `networks:\n  ${finding.detail}: {}` : null;
    default:
      return null;
  }
}
