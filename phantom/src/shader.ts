/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/** Shapes the shader can draw; "mask" uses a texture (text or drawing) instead of a 3D shape. */
export const SHAPES = ["torus", "gyroid", "bulb", "twist", "mask"] as const;
export type Shape = (typeof SHAPES)[number];

export const VERTEX = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

/*
 * Every cell is one noise bit. Outside the shape it comes from a background noise field; inside it
 * comes from a field that is glued to the shape (to its surface in 3D, or sliding along in 2D).
 * Both fields are the same kind of independent noise, so a single frame carries no trace of the shape.
 * Only the way cells move from frame to frame differs, and that is what the eye reads.
 */
export const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;

uniform vec2 uRes;
uniform int uShape;
uniform mat3 uRot;
uniform mat3 uRotPrev;
uniform vec2 uBg;
uniform vec2 uBgPrev;
uniform vec2 uFg;
uniform vec2 uFgPrev;
uniform float uDensity;
uniform int uView;
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uAccent;
uniform sampler2D uMask;
uniform uint uSeed;
out vec4 outColor;

uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}

float bit(ivec3 c, uint layer) {
  uvec3 h = pcg3d(uvec3(c) + uvec3(uSeed, layer * 0x9E3779B9u, 0u));
  return float(h.x >> 31u);
}

float sdTorus(vec3 p) { return length(vec2(length(p.xz) - 0.78, p.y)) - 0.36; }

float sdGyroid(vec3 p) {
  float s = length(p) - 1.08;
  float g = abs(dot(sin(p * 4.6), cos(p.zxy * 4.6))) / 4.6 - 0.045;
  return max(s, g * 0.75);
}

float sdBulb(vec3 p) {
  if (length(p) > 1.35) return length(p) - 1.25;
  vec3 z = p;
  float dr = 1.0;
  float r = 0.0;
  for (int i = 0; i < 6; i++) {
    r = length(z);
    if (r > 2.0) break;
    float th = acos(clamp(z.y / r, -1.0, 1.0)) * 8.0;
    float ph = atan(z.z, z.x) * 8.0;
    dr = pow(r, 7.0) * 8.0 * dr + 1.0;
    z = pow(r, 8.0) * vec3(sin(th) * cos(ph), cos(th), sin(th) * sin(ph)) + p;
  }
  return 0.5 * log(r) * r / dr;
}

float sdTwist(vec3 p) {
  float k = 1.5 * p.y;
  float c = cos(k), s = sin(k);
  vec3 q = vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
  vec3 d = abs(q) - vec3(0.48, 0.92, 0.48);
  return (length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0)) * 0.62 - 0.03;
}

float map(vec3 p) {
  if (uShape == 0) return sdTorus(p);
  if (uShape == 1) return sdGyroid(p);
  if (uShape == 2) return sdBulb(p * 0.92) / 0.92;
  return sdTwist(p);
}

// Ray against the shape turned by rot; returns distance or -1.
float march(vec3 ro, vec3 rd, mat3 inv) {
  float t = 1.6;
  for (int i = 0; i < 110; i++) {
    float d = map(inv * (ro + rd * t));
    if (d < 0.0012 * t) return t;
    t += d;
    if (t > 5.0) break;
  }
  return -1.0;
}

vec3 normalAt(vec3 p, mat3 inv) {
  const vec2 e = vec2(0.0015, -0.0015);
  return normalize(e.xyy * map(inv * (p + e.xyy)) + e.yyx * map(inv * (p + e.yyx)) + e.yxy * map(inv * (p + e.yxy)) + e.xxx * map(inv * (p + e.xxx)));
}

// x: noise bit, y: 1 inside the shape.
vec2 sampleAt(vec2 frag, mat3 rot, vec2 bg, vec2 fg) {
  float b = bit(ivec3(floor(frag + bg), 0), 1u);
  if (uShape == 4) {
    if (texture(uMask, frag / uRes).r < 0.5) return vec2(b, 0.0);
    return vec2(bit(ivec3(floor(frag + fg), 0), 2u), 1.0);
  }
  vec2 ndc = (2.0 * frag - uRes) / uRes.y;
  vec3 ro = vec3(0.0, 0.0, 3.2);
  vec3 rd = normalize(vec3(ndc * 0.42, -1.0));
  mat3 inv = transpose(rot);
  float t = march(ro, rd, inv);
  if (t < 0.0) return vec2(b, 0.0);
  vec3 p = ro + rd * t;
  // Where the surface turns away, its noise would stretch into visible blobs: use the background there.
  if (abs(dot(normalAt(p, inv), rd)) < 0.42) return vec2(b, 1.0);
  return vec2(bit(ivec3(floor(inv * p * uDensity)), 3u), 1.0);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 s = sampleAt(frag, uRot, uBg, uFg);
  if (uView == 1) {
    outColor = vec4(s.y, s.x, 0.0, 1.0);
  } else if (uView == 2) {
    // Two frames compared, with the background motion taken out: only the shape is left.
    vec2 prev = sampleAt(frag + (uBg - uBgPrev), uRotPrev, uBgPrev, uFgPrev);
    float changed = abs(s.x - prev.x);
    outColor = vec4(mix(uC0, uAccent, changed), 1.0);
  } else {
    outColor = vec4(mix(uC0, uC1, s.x), 1.0);
  }
}
`;
