/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { fromLinear, hexToRgb, rgbToHex, toLinear } from "./tokens";

/** Colour vision simulation. An approximation (Machado et al. 2009, severity 1.0, in linear RGB), not a diagnosis. */
export type Cvd = "none" | "protanopia" | "deuteranopia" | "tritanopia" | "achromatopsia";
export const CVD_KINDS: readonly Cvd[] = ["none", "protanopia", "deuteranopia", "tritanopia", "achromatopsia"];

const MATRICES: Record<Cvd, number[]> = {
  none: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
  achromatopsia: [0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722],
};

/** Row-major 3x3 matrix applied to linear RGB. */
export const cvdMatrix = (kind: Cvd): number[] => MATRICES[kind];

export function simulate(hex: string, kind: Cvd): string {
  if (kind === "none") return hex;
  const { r, g, b } = hexToRgb(hex);
  const lin = [toLinear(r), toLinear(g), toLinear(b)];
  const m = MATRICES[kind];
  const out = [0, 1, 2].map((row) => {
    const v = m[row * 3] * lin[0] + m[row * 3 + 1] * lin[1] + m[row * 3 + 2] * lin[2];
    return fromLinear(Math.min(1, Math.max(0, v)));
  });
  return rgbToHex({ r: out[0], g: out[1], b: out[2] });
}

/** The same matrix as an SVG `feColorMatrix` values string (4x5, alpha untouched), for filtering the live preview. */
export function cvdFilterValues(kind: Cvd): string {
  const m = MATRICES[kind];
  const rows = [0, 1, 2].map((r) => `${m[r * 3]} ${m[r * 3 + 1]} ${m[r * 3 + 2]} 0 0`);
  return [...rows, "0 0 0 1 0"].join(" ");
}
