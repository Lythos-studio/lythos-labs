/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { parseAllDocuments } from "yaml";
import { mergeObjects } from "./merge";
import { LIMITS, type Compose, type EnvVar, type Mount, type ParseResult, type Port, type Service } from "./model";

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const obj = (x: unknown): Obj => (isObj(x) ? x : {});
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
/** Scalars compose accepts as text (numbers and booleans are common for ports and flags). */
const str = (x: unknown): string | undefined =>
  typeof x === "string" ? x : typeof x === "number" || typeof x === "boolean" ? String(x) : undefined;
/** A list of names written either as a list or as a map (networks, depends_on, volumes at the top). */
const names = (x: unknown): string[] => (Array.isArray(x) ? x.map(str).filter((s): s is string => !!s) : Object.keys(obj(x)));

function port(entry: unknown): Port | null {
  if (isObj(entry)) {
    const target = str(entry.target);
    return target ? { hostIp: str(entry.host_ip), published: str(entry.published), target, protocol: str(entry.protocol) ?? "tcp" } : null;
  }
  const text = str(entry);
  if (!text) return null;
  const [spec, protocol = "tcp"] = text.split("/");
  let hostIp: string | undefined;
  let rest = spec;
  if (spec.startsWith("[")) {
    const end = spec.indexOf("]");
    if (end < 0) return null;
    hostIp = spec.slice(1, end);
    rest = spec.slice(end + 2);
  }
  const parts = rest.split(":");
  if (!hostIp && parts.length === 3) hostIp = parts.shift();
  if (parts.length > 2 || !parts[parts.length - 1]) return null;
  return { hostIp, published: parts.length === 2 ? parts[0] : undefined, target: parts[parts.length - 1], protocol };
}

function mount(entry: unknown): Mount | null {
  if (isObj(entry)) {
    const target = str(entry.target);
    if (!target) return null;
    const type = str(entry.type);
    return { kind: type === "bind" ? "bind" : type === "tmpfs" ? "tmpfs" : "volume", source: str(entry.source), target, readOnly: entry.read_only === true };
  }
  const text = str(entry);
  if (!text) return null;
  const [first, second, mode] = text.split(":");
  if (second === undefined) return { kind: "volume", target: first, readOnly: false };
  return { kind: /^[./~]/.test(first) ? "bind" : "volume", source: first, target: second, readOnly: mode === "ro" };
}

function envVar(key: string, value: unknown): EnvVar {
  const text = str(value);
  if (text === undefined) return { key, kind: "passthrough" };
  if (text === "") return { key, kind: "empty" };
  return /\$/.test(text) ? { key, kind: "variable", value: text } : { key, kind: "literal", value: text };
}

function environment(x: unknown): EnvVar[] {
  if (Array.isArray(x))
    return x.flatMap((line) => {
      const text = str(line);
      if (!text) return [];
      const i = text.indexOf("=");
      return [i < 0 ? envVar(text, undefined) : envVar(text.slice(0, i), text.slice(i + 1))];
    });
  return Object.entries(obj(x)).map(([key, value]) => envVar(key, value));
}

function image(raw: string | undefined): Service["image"] {
  if (!raw) return undefined;
  const [withTag, digest] = raw.split("@");
  const slash = withTag.lastIndexOf("/");
  const colon = withTag.lastIndexOf(":");
  const hasTag = colon > slash;
  return { raw, name: hasTag ? withTag.slice(0, colon) : withTag, tag: hasTag ? withTag.slice(colon + 1) : undefined, digest };
}

function labels(x: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const put = (k: string, v: string) => {
    if (Object.keys(out).length < 200 && k && !["__proto__", "constructor", "prototype"].includes(k)) out[k] = v.slice(0, 300);
  };
  if (Array.isArray(x))
    for (const line of x) {
      const text = str(line);
      if (!text) continue;
      const i = text.indexOf("=");
      if (i < 0) put(text, "");
      else put(text.slice(0, i), text.slice(i + 1));
    }
  else for (const [k, v] of Object.entries(obj(x))) put(k, str(v) ?? "");
  return out;
}

function service(name: string, raw: unknown): Service {
  const s = obj(raw);
  const depends = s.depends_on;
  const test = obj(s.healthcheck).test;
  const limits = obj(obj(obj(s.deploy).resources).limits);
  const logging = obj(s.logging);
  const loggingOptions = obj(logging.options);
  const disabled = obj(s.healthcheck).disable === true || (Array.isArray(test) && test[0] === "NONE");
  return {
    name,
    image: image(str(s.image)),
    hasBuild: s.build !== undefined && s.build !== null && s.build !== false,
    ports: arr(s.ports).map(port).filter((p): p is Port => !!p),
    networks: names(s.networks),
    mounts: arr(s.volumes).map(mount).filter((m): m is Mount => !!m),
    dependsOn: Array.isArray(depends)
      ? names(depends).map((n) => ({ name: n }))
      : Object.entries(obj(depends)).map(([n, v]) => ({ name: n, condition: str(obj(v).condition) })),
    dependsShort: Array.isArray(depends),
    healthcheck: disabled ? "disabled" : isObj(s.healthcheck) && test !== undefined ? "set" : "none",
    restart: str(s.restart) ?? str(obj(obj(s.deploy).restart_policy).condition),
    user: str(s.user),
    privileged: s.privileged === true,
    capAdd: arr(s.cap_add).map(str).filter((c): c is string => !!c),
    networkMode: str(s.network_mode),
    env: environment(s.environment),
    containerName: str(s.container_name),
    hasMemoryLimit: s.mem_limit !== undefined || limits.memory !== undefined,
    hasLogLimits: logging.driver === "none" || logging.driver === "local" || loggingOptions["max-size"] !== undefined,
    profiles: arr(s.profiles).map(str).filter((p): p is string => !!p),
    labels: labels(s.labels),
    securityOpt: arr(s.security_opt).map(str).filter((o): o is string => !!o),
    capDrop: arr(s.cap_drop).map(str).filter((c): c is string => !!c),
    readOnly: s.read_only === true,
    envFile: s.env_file !== undefined && s.env_file !== null,
  };
}

const declared = (x: unknown) => Object.entries(obj(x)).map(([name, v]) => ({ name, external: obj(v).external !== undefined && obj(v).external !== false }));

/**
 * Reads a compose file into a small model. Everything the diagram and the rules do not need is dropped.
 * The input is untrusted: it is size-limited, alias-limited, and every failure becomes an error value.
 */
export function parseCompose(text: string): ParseResult {
  if (!text.trim()) return { ok: false, error: { code: "empty" } };
  if (text.length > LIMITS.chars) return { ok: false, error: { code: "too-large" } };
  try {
    const docs = Array.from(parseAllDocuments(text, { merge: true, uniqueKeys: true, customTags: [] }));
    for (const doc of docs) {
      const first = doc.errors[0];
      if (first) return { ok: false, error: { code: "yaml-error", line: first.linePos?.[0].line, detail: first.code } };
    }
    // Documents separated by --- are a base file followed by overrides. Empty documents (a leading or trailing ---) are skipped.
    const parts = docs.map((doc) => doc.toJS({ maxAliasCount: LIMITS.aliases })).filter((part) => part !== null && part !== undefined);
    if (parts.length > LIMITS.files) return { ok: false, error: { code: "too-many-files" } };
    let root: unknown;
    for (const part of parts) {
      if (!isObj(part)) return { ok: false, error: { code: "not-a-mapping" } };
      root = root === undefined ? part : mergeObjects(root, part);
    }
    if (!isObj(root)) return { ok: false, error: { code: "not-a-mapping" } };
    const entries = Object.entries(obj(root.services));
    if (!entries.length) return { ok: false, error: { code: "no-services" } };
    if (entries.length > LIMITS.services) return { ok: false, error: { code: "too-many-services" } };
    const services = entries.map(([name, value]) => service(name, value));
    const compose: Compose = {
      services,
      networks: declared(root.networks),
      volumes: declared(root.volumes),
      hasVersion: root.version !== undefined,
      partial: services.some((s) => !s.image && !s.hasBuild),
    };
    return { ok: true, compose };
  } catch (e) {
    return { ok: false, error: { code: e instanceof Error && /alias/i.test(e.message) ? "alias-limit" : "parse-failed" } };
  }
}
