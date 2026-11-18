/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { Compose } from "./model";

export const CARD = { w: 196, h: 84, gapX: 96, gapY: 28, pad: 28 } as const;

export type Placed = { name: string; x: number; y: number };
export type Layout = {
  nodes: Placed[];
  /** Present when at least one service publishes a port. */
  internet: { x: number; y: number } | null;
  width: number;
  height: number;
};

/**
 * A fixed layered layout: whatever nobody depends on sits on the left, its dependencies further right, and the
 * outside world ("Internet") at the far left. The same input always gives the same positions. A cycle in
 * `depends_on` is cut where it closes, so it never loops.
 */
export function layout(compose: Compose): Layout {
  const names = new Set(compose.services.map((s) => s.name));
  const dependents = new Map<string, string[]>();
  for (const s of compose.services)
    for (const d of s.dependsOn)
      if (names.has(d.name) && d.name !== s.name) dependents.set(d.name, [...(dependents.get(d.name) ?? []), s.name]);

  // Cut the edges that close a cycle (found with a depth-first walk), then the rest is a DAG and levels are a longest path.
  const state = new Map<string, 1 | 2>();
  const kept = new Map<string, string[]>();
  const walk = (name: string) => {
    state.set(name, 1);
    for (const parent of dependents.get(name) ?? []) {
      if (state.get(parent) === 1) continue;
      kept.set(name, [...(kept.get(name) ?? []), parent]);
      if (!state.has(parent)) walk(parent);
    }
    state.set(name, 2);
  };
  for (const name of [...names].sort()) if (!state.has(name)) walk(name);
  const memo = new Map<string, number>();
  const level = (name: string): number => {
    const known = memo.get(name);
    if (known !== undefined) return known;
    const value = Math.max(-1, ...(kept.get(name) ?? []).map(level)) + 1;
    memo.set(name, value);
    return value;
  };

  const columns: string[][] = [];
  for (const s of [...compose.services].sort((a, b) => a.name.localeCompare(b.name))) {
    const l = level(s.name);
    (columns[l] ??= []).push(s.name);
  }
  const hasInternet = compose.services.some((s) => s.ports.length > 0);
  const offset = hasInternet ? 1 : 0;
  const column = (i: number) => CARD.pad + (i + offset) * (CARD.w + CARD.gapX);
  const nodes: Placed[] = [];
  let rows = 1;
  columns.forEach((list, i) => {
    if (!list) return;
    rows = Math.max(rows, list.length);
    list.forEach((name, row) => nodes.push({ name, x: column(i), y: CARD.pad + row * (CARD.h + CARD.gapY) }));
  });
  const used = Math.max(0, columns.length);
  return {
    nodes,
    internet: hasInternet ? { x: CARD.pad, y: CARD.pad } : null,
    width: CARD.pad * 2 + (used + offset) * CARD.w + Math.max(0, used + offset - 1) * CARD.gapX,
    height: CARD.pad * 2 + rows * CARD.h + (rows - 1) * CARD.gapY,
  };
}
