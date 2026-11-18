/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

export type Port = { hostIp?: string; published?: string; target: string; protocol: string };

export type Mount = { kind: "volume" | "bind" | "tmpfs"; source?: string; target: string; readOnly: boolean };

/**
 * literal: a fixed value in the file. variable: `${VAR}` or `$VAR`, filled in elsewhere. empty: set to "".
 * passthrough: no value, taken from the environment that runs compose.
 */
export type EnvVar = { key: string; kind: "literal" | "variable" | "empty" | "passthrough"; value?: string };

export type Service = {
  name: string;
  image?: { raw: string; name: string; tag?: string; digest?: string };
  hasBuild: boolean;
  ports: Port[];
  networks: string[];
  mounts: Mount[];
  dependsOn: { name: string; condition?: string }[];
  /** True when `depends_on` was written as a plain list, which only waits for "started". */
  dependsShort: boolean;
  healthcheck: "none" | "set" | "disabled";
  restart?: string;
  user?: string;
  privileged: boolean;
  capAdd: string[];
  networkMode?: string;
  env: EnvVar[];
  containerName?: string;
  hasMemoryLimit: boolean;
  hasLogLimits: boolean;
};

export type Compose = {
  services: Service[];
  /** Networks declared at the top level, and which of them are external. */
  networks: { name: string; external: boolean }[];
  volumes: { name: string; external: boolean }[];
  hasVersion: boolean;
};

export const LIMITS = { chars: 256 * 1024, services: 200, aliases: 100 } as const;

export type ParseError = {
  code: "empty" | "too-large" | "too-many-services" | "yaml-error" | "alias-limit" | "not-a-mapping" | "no-services" | "parse-failed";
  /** 1-based line of a YAML error. */
  line?: number;
  /** The YAML library's own error code, such as BAD_INDENT. Never text from the input. */
  detail?: string;
};

export type ParseResult = { ok: true; compose: Compose } | { ok: false; error: ParseError };
