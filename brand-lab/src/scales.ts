/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { TypeStyle } from "./tokens";

/** Modular type scale ratios per style, from a 16px base. */
export const TYPE_RATIO: Record<TypeStyle, number> = { editorial: 1.25, modern: 1.2, technical: 1.125 };

export const TEXT_STEPS = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl"] as const;
export type TextStep = (typeof TEXT_STEPS)[number];
export type TextToken = { size: string; line: number };

const EXPONENT: Record<TextStep, number> = { xs: -2, sm: -1, base: 0, lg: 1, xl: 2, "2xl": 3, "3xl": 4, "4xl": 5 };
const lineFor = (step: TextStep) => (EXPONENT[step] <= 0 ? 1.6 : EXPONENT[step] <= 2 ? 1.4 : 1.2);

export function typeScale(style: TypeStyle): Record<TextStep, TextToken> {
  const out = {} as Record<TextStep, TextToken>;
  for (const step of TEXT_STEPS) {
    const rem = Number((TYPE_RATIO[style] ** EXPONENT[step]).toFixed(3));
    out[step] = { size: `${rem}rem`, line: lineFor(step) };
  }
  return out;
}

export const WEIGHTS: Record<TypeStyle, { heading: number; body: number }> = {
  editorial: { heading: 500, body: 400 },
  modern: { heading: 600, body: 400 },
  technical: { heading: 600, body: 400 },
};

export const SPACE_STEPS = [1, 2, 3, 4, 5, 6, 8, 10, 12] as const;

/** Spacing on a 4px grid. */
export function spacing(): Record<number, string> {
  return Object.fromEntries(SPACE_STEPS.map((step) => [step, `${step * 4}px`]));
}
