/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const UNSAFE = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Merges an override into a base the way compose does for the common cases: mappings merge key by key,
 * lists are appended and anything else is replaced. Keys that could reach the prototype are dropped.
 */
export function mergeObjects(base: unknown, override: unknown): unknown {
  if (isObj(base) && isObj(override)) {
    const out: Obj = {};
    for (const [k, v] of Object.entries(base)) if (!UNSAFE.has(k)) out[k] = v;
    for (const [k, v] of Object.entries(override)) if (!UNSAFE.has(k)) out[k] = k in out ? mergeObjects(out[k], v) : v;
    return out;
  }
  if (Array.isArray(base) && Array.isArray(override)) return [...base, ...override];
  return override;
}
