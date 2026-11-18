/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { rgbToHex, rgbToOklch } from "./tokens";

export const MAX_LOGO_BYTES = 5 * 1024 * 1024;

/**
 * Finds the most prominent brand colour in an image, entirely in the browser (nothing is uploaded).
 * Near-white, near-black, grey and transparent pixels are ignored; colours are grouped by hue and weighted by chroma.
 * Returns null when the image has no clear colour (for example a black logo).
 */
export async function logoColor(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) throw new Error("type");
  if (file.size > MAX_LOGO_BYTES) throw new Error("size");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const size = 96;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const g = canvas.getContext("2d", { willReadFrequently: true });
    if (!g) return null;
    const ratio = Math.min(size / (img.naturalWidth || size), size / (img.naturalHeight || size));
    const w = Math.max(1, Math.round((img.naturalWidth || size) * ratio));
    const h = Math.max(1, Math.round((img.naturalHeight || size) * ratio));
    g.drawImage(img, 0, 0, w, h);
    const data = g.getImageData(0, 0, w, h).data;

    const buckets = new Map<number, { weight: number; r: number; g: number; b: number }>();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const rgb = { r: data[i], g: data[i + 1], b: data[i + 2] };
      const { l, c, h: hue } = rgbToOklch(rgb);
      if (c < 0.04 || l < 0.15 || l > 0.96) continue;
      const key = Math.round(hue / 15) % 24;
      const bucket = buckets.get(key) ?? { weight: 0, r: 0, g: 0, b: 0 };
      bucket.weight += c;
      bucket.r += rgb.r * c;
      bucket.g += rgb.g * c;
      bucket.b += rgb.b * c;
      buckets.set(key, bucket);
    }
    let best: { weight: number; r: number; g: number; b: number } | null = null;
    for (const bucket of buckets.values()) if (!best || bucket.weight > best.weight) best = bucket;
    if (!best || best.weight < 0.5) return null;
    return rgbToHex({ r: best.r / best.weight, g: best.g / best.weight, b: best.b / best.weight });
  } finally {
    URL.revokeObjectURL(url);
  }
}
