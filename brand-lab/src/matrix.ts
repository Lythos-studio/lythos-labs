/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { apca } from "./apca";
import { contrast, type Roles } from "./tokens";

export type WcagClass = "aaa" | "aa" | "aa-large" | "fail";

export const MATRIX_FOREGROUNDS = ["text", "muted", "link", "primary", "success", "warning", "danger"] as const;
export const MATRIX_BACKGROUNDS = ["background", "surface", "tint"] as const;

export type MatrixCell = { fg: string; bg: string; ratio: number; wcag: WcagClass; lc: number };

export function wcagClass(ratio: number): WcagClass {
  return ratio >= 7 ? "aaa" : ratio >= 4.5 ? "aa" : ratio >= 3 ? "aa-large" : "fail";
}

/** Rows are foregrounds, columns are backgrounds, both in the order of the exported constants. `tint` is the light primary wash used for badges and highlights. */
export function matrix(r: Roles, tint: string): MatrixCell[][] {
  const backgrounds = [r.background, r.surface, tint];
  return MATRIX_FOREGROUNDS.map((name) =>
    backgrounds.map((bg) => {
      const fg = r[name];
      const ratio = contrast(fg, bg);
      return { fg, bg, ratio, wcag: wcagClass(ratio), lc: apca(fg, bg) };
    }),
  );
}
