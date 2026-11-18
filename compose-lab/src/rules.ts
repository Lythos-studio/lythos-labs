/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { Compose, Port, Service } from "./model";

export type Level = "fail" | "warn" | "info";
export type Group = "security" | "reliability" | "structure";

export const RULES = {
  "db-port-public": "security",
  "port-all-interfaces": "security",
  privileged: "security",
  "docker-socket": "security",
  "host-network": "security",
  "secret-in-env": "security",
  "latest-tag": "security",
  "runs-as-root": "security",
  "no-healthcheck": "reliability",
  "depends-without-condition": "reliability",
  "no-restart-policy": "reliability",
  "no-memory-limit": "reliability",
  "unbounded-logs": "reliability",
  "depends-on-missing": "structure",
  "duplicate-host-port": "structure",
  "network-undeclared": "structure",
  "network-unused": "structure",
  "volume-unused": "structure",
  "container-name-set": "structure",
  "version-obsolete": "structure",
} as const satisfies Record<string, Group>;

export type RuleId = keyof typeof RULES;

/**
 * `services` names the services a finding is about (empty for the file as a whole). `detail` is a short, harmless
 * hint such as a port ("5432:5432"), an environment key or a network name. It never holds an environment value.
 */
export type Finding = { id: RuleId; level: Level; group: Group; services: string[]; detail?: string };

const DB_IMAGES = new Set(["postgres", "postgresql", "mysql", "mariadb", "mongo", "mongodb", "redis", "valkey", "elasticsearch", "opensearch", "memcached", "cassandra", "couchdb", "influxdb", "clickhouse"]);
const DB_PORTS = new Set(["5432", "3306", "27017", "6379", "9200", "11211", "5984", "9042", "8086", "8123"]);
const PROXY_IMAGES = new Set(["traefik", "nginx", "caddy", "haproxy", "envoy"]);
const SECRET_KEY = /(PASSWORD|PASSWD|SECRET|TOKEN|API_?KEY|PRIVATE_?KEY|ACCESS_?KEY|CREDENTIAL)/i;

const imageBase = (s: Service) => s.image?.name.split("/").pop()?.toLowerCase() ?? "";
const allInterfaces = (p: Port) => !p.hostIp || p.hostIp === "0.0.0.0" || p.hostIp === "::";
const portText = (p: Port) => (p.published ? `${p.published}:${p.target}` : p.target);
/** A job runs once and stops (migrations, seeds), so health, restart and limit rules do not apply. */
const isJob = (s: Service) => /^(no|false)$/i.test(s.restart ?? "") || /(migrat|init|seed|setup)/i.test(s.name);

const levels: Record<Level, number> = { fail: 0, warn: 1, info: 2 };
const groups: Record<Group, number> = { security: 0, reliability: 1, structure: 2 };

/** Every rule is a fact about the file, not a verdict on the people who wrote it. */
export function evaluate(compose: Compose): Finding[] {
  const found: Finding[] = [];
  const add = (id: RuleId, level: Level, services: string[], detail?: string) =>
    found.push({ id, level, group: RULES[id], services, detail });
  const byName = new Map(compose.services.map((s) => [s.name, s]));
  const dependedOn = new Set(compose.services.flatMap((s) => s.dependsOn.map((d) => d.name)));
  const usedNetworks = new Set(compose.services.flatMap((s) => s.networks));
  const usedVolumes = new Set(compose.services.flatMap((s) => s.mounts.flatMap((m) => (m.kind === "volume" && m.source ? [m.source] : []))));
  const aggregate = { runsAsRoot: [] as string[], memory: [] as string[], logs: [] as string[], containerName: [] as string[] };

  for (const s of compose.services) {
    const open = s.ports.filter(allInterfaces);
    const isDb = DB_IMAGES.has(imageBase(s)) || s.ports.some((p) => DB_PORTS.has(p.target));
    if (isDb && open.length) add("db-port-public", "fail", [s.name], portText(open[0]));
    else {
      const loud = open.filter((p) => !(PROXY_IMAGES.has(imageBase(s)) && ["80", "443"].includes(p.target)));
      if (loud.length) add("port-all-interfaces", "warn", [s.name], portText(loud[0]));
    }
    if (s.privileged || s.capAdd.some((c) => /^(ALL|SYS_ADMIN)$/i.test(c))) add("privileged", "fail", [s.name]);
    if (s.mounts.some((m) => m.source?.includes("docker.sock"))) add("docker-socket", "warn", [s.name]);
    if (s.networkMode === "host") add("host-network", "warn", [s.name]);
    const secrets = s.env.filter((e) => e.kind === "literal" && SECRET_KEY.test(e.key) && !/_FILE$/i.test(e.key)).map((e) => e.key);
    if (secrets.length) add("secret-in-env", "fail", [s.name], secrets.slice(0, 5).join(", "));
    if (s.image && !s.image.digest && (!s.image.tag || s.image.tag === "latest")) add("latest-tag", "warn", [s.name]);
    if ((s.image || s.hasBuild) && !s.user && s.ports.length) aggregate.runsAsRoot.push(s.name);

    if (!isJob(s) && s.healthcheck === "none" && (s.ports.length || dependedOn.has(s.name))) add("no-healthcheck", "warn", [s.name]);
    for (const d of s.dependsOn) {
      const target = byName.get(d.name);
      if (!target) add("depends-on-missing", "fail", [s.name], d.name);
      else if (!d.condition && target.healthcheck === "set") add("depends-without-condition", "warn", [s.name], d.name);
    }
    if (!isJob(s) && !s.restart) add("no-restart-policy", "warn", [s.name]);
    if (!isJob(s) && !s.hasMemoryLimit) aggregate.memory.push(s.name);
    if (!isJob(s) && !s.hasLogLimits) aggregate.logs.push(s.name);

    for (const n of s.networks) if (n !== "default" && !compose.networks.some((c) => c.name === n)) add("network-undeclared", "fail", [s.name], n);
    if (s.containerName) aggregate.containerName.push(s.name);
  }

  const ports = new Map<string, { service: string; ip: string; all: boolean }[]>();
  for (const s of compose.services)
    for (const p of s.ports) {
      if (!p.published) continue;
      const key = `${p.published}/${p.protocol}`;
      ports.set(key, [...(ports.get(key) ?? []), { service: s.name, ip: p.hostIp ?? "", all: allInterfaces(p) }]);
    }
  for (const [key, users] of ports) {
    const clash = users.length > 1 && (users.some((u) => u.all) || new Set(users.map((u) => u.ip)).size < users.length);
    if (clash) add("duplicate-host-port", "fail", [...new Set(users.map((u) => u.service))], key.split("/")[0]);
  }

  for (const n of compose.networks) if (!n.external && !usedNetworks.has(n.name)) add("network-unused", "info", [], n.name);
  for (const v of compose.volumes) if (!v.external && !usedVolumes.has(v.name)) add("volume-unused", "info", [], v.name);
  if (compose.hasVersion) add("version-obsolete", "info", []);
  for (const [id, list] of [["runs-as-root", aggregate.runsAsRoot], ["no-memory-limit", aggregate.memory], ["unbounded-logs", aggregate.logs], ["container-name-set", aggregate.containerName]] as const)
    if (list.length) add(id, "info", list);

  return found.sort(
    (a, b) =>
      levels[a.level] - levels[b.level] ||
      groups[a.group] - groups[b.group] ||
      a.id.localeCompare(b.id) ||
      (a.services[0] ?? "").localeCompare(b.services[0] ?? ""),
  );
}
