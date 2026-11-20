/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { Check } from "./checks";
import type { Level } from "./types";

/** Remembering results is the visitor's choice and stays in their browser. Only codes, levels and the date are kept. */
export type StoredRun = { at: string; results: Record<string, { level: Level; code: string }> };
export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type Change = { id: string; from: string; to: string; direction: "better" | "worse" | "changed" };

const KEY = "lythos-mail-check-v1";
const MAX_DOMAINS = 20;
const LEVELS: Level[] = ["ok", "warn", "fail", "info", "unknown"];
const RANK: Record<Level, number> = { ok: 4, info: 3, warn: 2, fail: 1, unknown: 0 };

export function toStored(checks: Check[], now: Date): StoredRun {
  return { at: now.toISOString(), results: Object.fromEntries(checks.map((c) => [c.id, { level: c.finding.level, code: c.finding.code }])) };
}

export function diffChecks(previous: StoredRun, checks: Check[]): Change[] {
  const changes: Change[] = [];
  for (const c of checks) {
    const before = previous.results[c.id];
    if (!before || before.code === c.finding.code) continue;
    const either = before.level === "unknown" || c.finding.level === "unknown";
    const direction = either || RANK[before.level] === RANK[c.finding.level] ? "changed" : RANK[c.finding.level] > RANK[before.level] ? "better" : "worse";
    changes.push({ id: c.id, from: before.code, to: c.finding.code, direction });
  }
  return changes;
}

function isRun(x: unknown): x is StoredRun {
  if (!x || typeof x !== "object") return false;
  const { at, results } = x as { at?: unknown; results?: unknown };
  if (typeof at !== "string" || at.length > 40 || !results || typeof results !== "object" || Array.isArray(results)) return false;
  return Object.values(results as object).every((r) => {
    const v = r as { level?: unknown; code?: unknown };
    return !!r && typeof v.code === "string" && v.code.length <= 60 && LEVELS.includes(v.level as Level);
  });
}

/** Never throws: private mode, blocked storage and tampered values all read as "nothing remembered". */
export function loadRuns(storage: StorageLike | undefined): Record<string, StoredRun> {
  if (!storage) return {};
  try {
    const parsed: unknown = JSON.parse(storage.getItem(KEY) ?? "null");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, run]) => isRun(run)));
  } catch {
    return {};
  }
}

/** Keeps the newest twenty domains. Returns false when nothing could be saved. */
export function saveRun(domain: string, run: StoredRun, storage: StorageLike | undefined): boolean {
  if (!storage) return false;
  try {
    const all = { ...loadRuns(storage), [domain]: run };
    const newest = Object.entries(all).sort(([, a], [, b]) => b.at.localeCompare(a.at)).slice(0, MAX_DOMAINS);
    storage.setItem(KEY, JSON.stringify(Object.fromEntries(newest)));
    return true;
  } catch {
    return false;
  }
}

export function forgetRuns(storage: StorageLike | undefined): void {
  try {
    storage?.removeItem(KEY);
  } catch {
    // Nothing to forget in a blocked store.
  }
}
