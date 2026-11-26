/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * The same integer hash the shader uses (pcg3d, Jarzynski and Olano 2020), so the tests can check
 * the property the whole experiment rests on: inside and outside the shape, one frame is the same noise.
 */
export function pcg3d(x: number, y: number, z: number): [number, number, number] {
  x = (Math.imul(x >>> 0, 1664525) + 1013904223) >>> 0;
  y = (Math.imul(y >>> 0, 1664525) + 1013904223) >>> 0;
  z = (Math.imul(z >>> 0, 1664525) + 1013904223) >>> 0;
  x = (x + Math.imul(y, z)) >>> 0;
  y = (y + Math.imul(z, x)) >>> 0;
  z = (z + Math.imul(x, y)) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  y = (y ^ (y >>> 16)) >>> 0;
  z = (z ^ (z >>> 16)) >>> 0;
  x = (x + Math.imul(y, z)) >>> 0;
  y = (y + Math.imul(z, x)) >>> 0;
  z = (z + Math.imul(x, y)) >>> 0;
  return [x, y, z];
}

/** Layer ids, as in the shader: background, flat foreground (text, drawing), 3D surface. */
export const LAYER = { background: 1, flat: 2, surface: 3 } as const;
const GOLDEN = 0x9e3779b9;

/** One noise cell: 0 (dark) or 1 (light). Mirrors bit() in shader.ts. */
export function bit(cx: number, cy: number, cz: number, layer: number, seed: number): number {
  const [h] = pcg3d((cx + seed) | 0, (cy + Math.imul(layer, GOLDEN)) | 0, cz | 0);
  return h >>> 31;
}

export type FrameStats = {
  inside: number;
  outside: number;
  /** Share of light cells. */
  insideLight: number;
  outsideLight: number;
  /** Share of horizontal neighbours with the same value: a texture measure, 0.5 for pure noise. */
  insideAlike: number;
  outsideAlike: number;
};

/** Measures one frame. `values` and `mask` hold one entry per cell, row by row; mask is 1 inside the shape. */
export function frameStats(values: ArrayLike<number>, mask: ArrayLike<number>, width: number, height: number): FrameStats {
  let inside = 0;
  let outside = 0;
  let inLight = 0;
  let outLight = 0;
  let inPairs = 0;
  let outPairs = 0;
  let inAlike = 0;
  let outAlike = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const m = mask[i];
      if (m) {
        inside++;
        inLight += values[i];
      } else {
        outside++;
        outLight += values[i];
      }
      if (x + 1 < width && mask[i + 1] === m) {
        const same = values[i] === values[i + 1] ? 1 : 0;
        if (m) {
          inPairs++;
          inAlike += same;
        } else {
          outPairs++;
          outAlike += same;
        }
      }
    }
  }
  return {
    inside,
    outside,
    insideLight: inside ? inLight / inside : 0,
    outsideLight: outside ? outLight / outside : 0,
    insideAlike: inPairs ? inAlike / inPairs : 0,
    outsideAlike: outPairs ? outAlike / outPairs : 0,
  };
}

/** Text for the share link: only after the #, so it never reaches a server. */
export const MAX_TEXT = 40;
export function encodeText(text: string): string {
  return `t=${encodeURIComponent(text.slice(0, MAX_TEXT))}`;
}
export function decodeText(hash: string): string | null {
  const m = /(?:^|[#&])t=([^&]*)/.exec(hash);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]).slice(0, MAX_TEXT);
  } catch {
    return null;
  }
}
