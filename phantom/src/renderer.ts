/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { frameStats, type FrameStats } from "./noise";
import { FRAGMENT, SHAPES, VERTEX, type Shape } from "./shader";

export type Frame = {
  shape: Shape;
  rot: Float32Array;
  rotPrev: Float32Array;
  bg: [number, number];
  bgPrev: [number, number];
  fg: [number, number];
  fgPrev: [number, number];
  /** 0 noise, 2 two frames compared. */
  view: 0 | 2;
  c0: [number, number, number];
  c1: [number, number, number];
  accent: [number, number, number];
};

export type Renderer = {
  /** Sets the noise grid: one cell per `grain` CSS pixels. Returns the grid size. */
  resize(cssWidth: number, cssHeight: number, grain: number): { width: number; height: number };
  setMask(source: HTMLCanvasElement): void;
  draw(frame: Frame): void;
  /** Renders the frame off screen and measures it, inside and outside the shape. */
  measure(frame: Frame): FrameStats;
  /** The current frame as a PNG, scaled up so every cell stays a crisp square. */
  snapshot(frame: Frame, scale: number): Promise<Blob | null>;
  dispose(): void;
};

/** Rotation matrix (column-major, as WebGL expects) from yaw and pitch. */
export function rotation(yaw: number, pitch: number, roll = 0): Float32Array {
  const [cy, sy, cp, sp, cr, sr] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch), Math.cos(roll), Math.sin(roll)];
  // R = Rz(roll) * Rx(pitch) * Ry(yaw)
  const ry = [cy, 0, -sy, 0, 1, 0, sy, 0, cy];
  const rx = [1, 0, 0, 0, cp, sp, 0, -sp, cp];
  const rz = [cr, sr, 0, -sr, cr, 0, 0, 0, 1];
  const mul = (a: number[], b: number[]) => {
    const o = new Array(9).fill(0);
    for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) o[c * 3 + r] += a[k * 3 + r] * b[c * 3 + k];
    return o;
  };
  return new Float32Array(mul(rz, mul(rx, ry)));
}

export function createRenderer(canvas: HTMLCanvasElement, seed: number): Renderer | null {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: "high-performance" });
  if (!gl) return null;
  const compile = (type: number, source: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  const program = gl.createProgram()!;
  try {
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "link");
  } catch (e) {
    console.error(e);
    return null;
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  // One triangle that covers the screen.
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u = (name: string) => gl.getUniformLocation(program, name);
  const loc = {
    res: u("uRes"),
    shape: u("uShape"),
    rot: u("uRot"),
    rotPrev: u("uRotPrev"),
    bg: u("uBg"),
    bgPrev: u("uBgPrev"),
    fg: u("uFg"),
    fgPrev: u("uFgPrev"),
    density: u("uDensity"),
    view: u("uView"),
    c0: u("uC0"),
    c1: u("uC1"),
    accent: u("uAccent"),
    mask: u("uMask"),
    seed: u("uSeed"),
  };
  gl.uniform1ui(loc.seed, seed >>> 0);
  gl.uniform1i(loc.mask, 0);

  const maskTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, maskTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));

  // The canvas holds the grid size, so a second renderer on the same canvas (React development mode) agrees with the first.
  let width = canvas.width;
  let height = canvas.height;

  const apply = (f: Frame, view: number) => {
    width = canvas.width;
    height = canvas.height;
    gl.viewport(0, 0, width, height);
    gl.uniform2f(loc.res, width, height);
    gl.uniform1i(loc.shape, SHAPES.indexOf(f.shape));
    gl.uniformMatrix3fv(loc.rot, false, f.rot);
    gl.uniformMatrix3fv(loc.rotPrev, false, f.rotPrev);
    gl.uniform2f(loc.bg, f.bg[0], f.bg[1]);
    gl.uniform2f(loc.bgPrev, f.bgPrev[0], f.bgPrev[1]);
    gl.uniform2f(loc.fg, f.fg[0], f.fg[1]);
    gl.uniform2f(loc.fgPrev, f.fgPrev[0], f.fgPrev[1]);
    // About one noise cell per screen cell on the front of the shape.
    gl.uniform1f(loc.density, height / 1.35);
    gl.uniform1i(loc.view, view);
    gl.uniform3fv(loc.c0, f.c0);
    gl.uniform3fv(loc.c1, f.c1);
    gl.uniform3fv(loc.accent, f.accent);
  };

  const offscreen = (draw: () => void) => {
    width = canvas.width;
    height = canvas.height;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindTexture(gl.TEXTURE_2D, maskTex);
    const out = new Uint8Array(width * height * 4);
    draw();
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, out);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);
    gl.deleteTexture(tex);
    return out;
  };

  return {
    resize(cssWidth, cssHeight, grain) {
      const w = Math.max(16, Math.floor(cssWidth / grain));
      const h = Math.max(16, Math.floor(cssHeight / grain));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      return { width: w, height: h };
    },
    setMask(source) {
      gl.bindTexture(gl.TEXTURE_2D, maskTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    },
    draw(frame) {
      apply(frame, frame.view);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    measure(frame) {
      // View 1 writes the shape into red and the noise bit into green, from the very same evaluation.
      const px = offscreen(() => {
        apply(frame, 1);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      });
      const n = width * height;
      const values = new Uint8Array(n);
      const mask = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        mask[i] = px[i * 4] > 127 ? 1 : 0;
        values[i] = px[i * 4 + 1] > 127 ? 1 : 0;
      }
      return frameStats(values, mask, width, height);
    },
    snapshot(frame, scale) {
      const px = offscreen(() => {
        apply(frame, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      });
      const out = document.createElement("canvas");
      out.width = width * scale;
      out.height = height * scale;
      const ctx = out.getContext("2d");
      if (!ctx) return Promise.resolve(null);
      const img = new ImageData(width, height);
      // readPixels starts at the bottom row.
      for (let y = 0; y < height; y++) img.data.set(px.subarray((height - 1 - y) * width * 4, (height - y) * width * 4), y * width * 4);
      const small = document.createElement("canvas");
      small.width = width;
      small.height = height;
      small.getContext("2d")!.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(small, 0, 0, out.width, out.height);
      return new Promise((resolve) => out.toBlob(resolve, "image/png"));
    },
    dispose() {
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
      gl.deleteTexture(maskTex);
    },
  };
}
