/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { hexToRgb } from "./tokens";

/**
 * APCA-W3 0.0.98G lightness contrast (Lc). Additional guidance next to WCAG 2.x, not part of WCAG 2.2.
 * Positive for dark text on a light background, negative for light text on a dark background.
 */
const BLACK_THRESHOLD = 0.022;
const BLACK_CLAMP = 1.414;
const DELTA_Y_MIN = 0.0005;
const LOW_CLIP = 0.1;
const OFFSET = 0.027;
const SCALE = 1.14;

function screenLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const y = 0.2126729 * (r / 255) ** 2.4 + 0.7151522 * (g / 255) ** 2.4 + 0.072175 * (b / 255) ** 2.4;
  return y < BLACK_THRESHOLD ? y + (BLACK_THRESHOLD - y) ** BLACK_CLAMP : y;
}

export function apca(fg: string, bg: string): number {
  const text = screenLuminance(fg);
  const back = screenLuminance(bg);
  if (Math.abs(back - text) < DELTA_Y_MIN) return 0;
  if (back > text) {
    const sapc = (back ** 0.56 - text ** 0.57) * SCALE;
    return sapc < LOW_CLIP ? 0 : (sapc - OFFSET) * 100;
  }
  const sapc = (back ** 0.65 - text ** 0.62) * SCALE;
  return sapc > -LOW_CLIP ? 0 : (sapc + OFFSET) * 100;
}

/** Indicative bands only (60 body text, 45 large text); APCA is shown as guidance, never as pass or fail. */
export function apcaLevel(lc: number): "body" | "large" | "weak" {
  const v = Math.abs(lc);
  return v >= 60 ? "body" : v >= 45 ? "large" : "weak";
}
