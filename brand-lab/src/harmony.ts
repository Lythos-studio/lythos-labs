/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { hexToRgb, oklchToHex, rgbToOklch } from "./tokens";

export type HarmonyKind = "analogous" | "complementary" | "triad";

const ANGLE: Record<HarmonyKind, number> = { analogous: 30, complementary: 180, triad: 120 };

/** An accent colour at a fixed hue angle from the brand, same lightness, with enough chroma to read as a colour. */
export function suggestAccent(brand: string, kind: HarmonyKind): string {
  const { l, c, h } = rgbToOklch(hexToRgb(brand));
  return oklchToHex({ l: Math.min(0.9, Math.max(0.3, l)), c: Math.max(c, 0.04), h: (h + ANGLE[kind]) % 360 });
}

/** Smallest angle between two hues, 0 to 180 degrees. */
export function hueDistance(a: string, b: string): number {
  const d = Math.abs(rgbToOklch(hexToRgb(a)).h - rgbToOklch(hexToRgb(b)).h) % 360;
  return d > 180 ? 360 - d : d;
}

/** Warns when two colours would be hard to tell apart: similar hue and similar lightness. */
export function harmonyNote(brand: string, accent: string): "ok" | "too-close" {
  const dl = Math.abs(rgbToOklch(hexToRgb(brand)).l - rgbToOklch(hexToRgb(accent)).l);
  return hueDistance(brand, accent) < 25 && dl < 0.1 ? "too-close" : "ok";
}
