/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { RoleKey } from "./import";
import { contrast, hexToRgb, luminance, oklchToHex, rgbToOklch } from "./tokens";

export type Repair = { hex: string; ratio: number; reached: boolean };

/**
 * Moves only the OKLCH lightness of `fg` (hue and chroma are kept as far as sRGB allows) until it meets `min` on `bg`.
 * When no lightness works it falls back to black or white, whichever is better, and says so with `reached`.
 */
export function repairColor(fg: string, bg: string, min: number): Repair {
  const start = contrast(fg, bg);
  if (start >= min) return { hex: fg, ratio: start, reached: true };
  const { l, c, h } = rgbToOklch(hexToRgb(fg));
  const preferred = luminance(fg) < luminance(bg) ? -1 : 1;
  for (const dir of [preferred, -preferred]) {
    for (let i = 1; i <= 200; i++) {
      const next = l + dir * 0.005 * i;
      if (next < 0 || next > 1) break;
      const hex = oklchToHex({ l: next, c, h });
      const ratio = contrast(hex, bg);
      if (ratio >= min) return { hex, ratio, reached: true };
    }
  }
  const [black, white] = [contrast("#000000", bg), contrast("#ffffff", bg)];
  const best = black >= white ? { hex: "#000000", ratio: black } : { hex: "#ffffff", ratio: white };
  return { ...best, reached: best.ratio >= min };
}

export type AuditRow = { label: string; fg: string; bg: string; ratio: number; min: number; pass: boolean; fix?: Repair };

/** The same pairs and minimums as `checks()`, on imported roles. Pairs with a missing role are left out. */
export function auditRoles(map: Partial<Record<RoleKey, string>>): AuditRow[] {
  const pairs: [RoleKey, RoleKey, number][] = [
    ["text", "background", 4.5],
    ["muted", map.surface ? "surface" : "background", 4.5],
    ["onPrimary", "primary", 4.5],
    ["link", "background", 4.5],
    ["success", "background", 4.5],
    ["warning", "background", 4.5],
    ["danger", "background", 4.5],
    ["border", "background", 1.2],
  ];
  const rows: AuditRow[] = [];
  for (const [f, b, min] of pairs) {
    const [fg, bg] = [map[f], map[b]];
    if (!fg || !bg) continue;
    const ratio = contrast(fg, bg);
    const pass = ratio >= min;
    rows.push({ label: `${f}/${b}`, fg, bg, ratio, min, pass, ...(pass ? {} : { fix: repairColor(fg, bg, min) }) });
  }
  return rows;
}
