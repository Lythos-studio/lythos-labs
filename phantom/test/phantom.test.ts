/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { phantomCopy } from "../src/copy";
import { bit, decodeText, encodeText, frameStats, LAYER, MAX_TEXT, pcg3d } from "../src/noise";
import { rotation } from "../src/renderer";
import { FRAGMENT } from "../src/shader";

const W = 240;
const H = 140;
const SEED = 0x5eed;

/** A ring-shaped mask, like a letter O. */
const mask = new Uint8Array(W * H);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const d = Math.hypot(x - W / 2, y - H / 2);
    mask[y * W + x] = d > 30 && d < 60 ? 1 : 0;
  }

/** The flat (text and drawing) branch of the shader, in JavaScript: background noise outside, sliding noise inside. */
function frame(time: number): Uint8Array {
  const out = new Uint8Array(W * H);
  const fgY = -time * 20;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const fx = x + 0.5;
      const fy = y + 0.5;
      out[y * W + x] = mask[y * W + x] ? bit(Math.floor(fx), Math.floor(fy + fgY), 0, LAYER.flat, SEED) : bit(Math.floor(fx), Math.floor(fy), 0, LAYER.background, SEED);
    }
  return out;
}

test("the hash matches the shader: same constants, same steps", () => {
  for (const s of ["1664525u", "1013904223u", "v ^= v >> 16u", "0x9E3779B9u", "h.x >> 31u"]) assert.ok(FRAGMENT.includes(s), s);
  assert.equal(pcg3d(0, 0, 0).length, 3);
  assert.notDeepEqual(pcg3d(0, 0, 0), pcg3d(1, 0, 0));
  assert.equal(bit(-5, 7, 0, LAYER.background, SEED), bit(-5, 7, 0, LAYER.background, SEED));
});

test("one frame: inside and outside the shape are the same noise", () => {
  for (const t of [0, 0.37, 2.5]) {
    const s = frameStats(frame(t), mask, W, H);
    assert.ok(s.inside > 5000 && s.outside > 5000);
    for (const v of [s.insideLight, s.outsideLight, s.insideAlike, s.outsideAlike]) assert.ok(Math.abs(v - 0.5) < 0.02, `${t}: ${JSON.stringify(s)}`);
  }
});

test("two frames: comparing them reveals exactly the shape", () => {
  const a = frame(1);
  const b = frame(1.1); // two cells of motion inside, none outside
  let changedIn = 0;
  let changedOut = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    if (mask[i]) changedIn++;
    else changedOut++;
  }
  const inside = mask.reduce((n, m) => n + m, 0);
  assert.equal(changedOut, 0, "the background does not change");
  assert.ok(changedIn / inside > 0.4, `inside changes like fresh noise (${changedIn / inside})`);
});

test("the noise inside moves as a whole, which is what the eye follows", () => {
  // After the field slides one cell, each inside cell equals its neighbour from the frame before.
  const a = frame(0);
  const b = frame(1 / 20);
  let same = 0;
  let total = 0;
  for (let y = 1; y < H - 1; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!mask[i] || !mask[i - W]) continue;
      total++;
      if (b[i] === a[i - W]) same++;
    }
  assert.ok(same / total > 0.99, `${same / total}`);
});

test("frameStats counts cells and neighbour pairs", () => {
  const s = frameStats([1, 1, 0, 0], [1, 1, 0, 0], 4, 1);
  assert.deepEqual(s, { inside: 2, outside: 2, insideLight: 1, outsideLight: 0, insideAlike: 1, outsideAlike: 1 });
  assert.equal(frameStats([], [], 0, 0).insideLight, 0);
});

test("words travel in the link after the # and are cut to the limit", () => {
  assert.equal(decodeText(`#${encodeText("Hallo & doei")}`), "Hallo & doei");
  assert.equal(decodeText("#x=1&t=caf%C3%A9"), "café");
  assert.equal(decodeText("#nothing"), null);
  assert.equal(decodeText("#t=%E0%A4%A"), null, "broken escapes are ignored");
  assert.equal(decodeText(`#${encodeText("a".repeat(100))}`)!.length, MAX_TEXT);
});

test("rotation matrices are orthonormal", () => {
  const m = rotation(0.7, -0.3, 0.2);
  const col = (c: number) => [m[c * 3], m[c * 3 + 1], m[c * 3 + 2]];
  for (let a = 0; a < 3; a++)
    for (let b = 0; b < 3; b++) {
      const dot = col(a).reduce((s, v, i) => s + v * col(b)[i], 0);
      assert.ok(Math.abs(dot - (a === b ? 1 : 0)) < 1e-6);
    }
});

test("all strings exist in English and Dutch, without em dashes or emoji", () => {
  const cp = (n: number) => String.fromCodePoint(n);
  const bad = new RegExp(`${cp(0x2014)}|[${cp(0x1f300)}-${cp(0x1faff)}${cp(0x2600)}-${cp(0x27bf)}]`, "u");
  const strings = (value: unknown, path = ""): [string, string][] =>
    typeof value === "string"
      ? [[path, value]]
      : typeof value === "function"
        ? [[path, String((value as (a: unknown) => unknown)(3))]]
        : Array.isArray(value)
          ? value.flatMap((v, i) => strings(v, `${path}[${i}]`))
          : value && typeof value === "object"
            ? Object.entries(value).flatMap(([k, v]) => strings(v, `${path}.${k}`))
            : [];
  const keys = (l: "en" | "nl") => strings(phantomCopy[l]).map(([p]) => p).sort();
  assert.deepEqual(keys("en"), keys("nl"));
  for (const l of ["en", "nl"] as const) for (const [path, s] of strings(phantomCopy[l])) assert.ok(!bad.test(s), `${l}${path}`);
  for (const l of ["en", "nl"] as const) assert.ok(phantomCopy[l].defaultText.length <= MAX_TEXT);
});
