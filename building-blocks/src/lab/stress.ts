/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/** The stresses the lab can put on a block. They change the live example only. */
export type Stress = {
  /** Text size: 1, 1.5 or 2 times (the --lb-text-* sizes are scaled, the layout is not). */
  textScale: 1 | 1.5 | 2;
  /** "plus40" makes every word about 40% longer; "long" gives every word a long Dutch compound ending. */
  length: "normal" | "plus40" | "long";
  dir: "ltr" | "rtl";
  motion: "on" | "off";
  /** A fixed width for the example in CSS pixels, or "full". Media queries still follow the real window. */
  width: "full" | "320" | "480" | "768";
};

export const NO_STRESS: Stress = { textScale: 1, length: "normal", dir: "ltr", motion: "on", width: "full" };

export const isStressed = (s: Stress) => JSON.stringify(s) !== JSON.stringify(NO_STRESS);

/** Multiplies every --lb-text-* size (given in rem) by `factor`. Other variables are left alone. */
export function scaleTextVars(vars: Record<string, string>, factor: number): Record<string, string> {
  if (factor === 1) return vars;
  return Object.fromEntries(
    Object.entries(vars).map(([k, v]) => {
      const m = /^(-?\d*\.?\d+)rem$/.exec(v);
      return /^--lb-text-/.test(k) && m ? [k, `${Math.round(Number(m[1]) * factor * 1000) / 1000}rem`] : [k, v];
    }),
  );
}

const COMPOUND = "afhandelingsovereenkomst";

/** Makes text harder for a layout: longer words or very long unbreakable ones. Used to find boxes that cannot grow. */
export function expandText(text: string, mode: Stress["length"]): string {
  if (mode === "normal") return text;
  return text.replace(/\p{L}{3,}/gu, (word) => {
    if (mode === "long") return word.length >= 4 ? word + COMPOUND : word;
    const extra = Math.ceil(word.length * 0.4);
    const tail = word.slice(-2);
    return word + tail.repeat(Math.ceil(extra / tail.length)).slice(0, extra);
  });
}
