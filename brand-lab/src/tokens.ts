/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Brand lab colour engine: one brand colour becomes accessible light and dark design tokens.
 * Pure functions only (no DOM), so they are unit tested in tests/labs-brand-lab.test.ts.
 * Colour math uses OKLCH (perceptual lightness) and WCAG 2.x relative luminance for contrast.
 */

export type Rgb = { r: number; g: number; b: number };
export type Oklch = { l: number; c: number; h: number };
export type Mode = "light" | "dark";
export type Radius = "sharp" | "soft" | "round";
export type TypeStyle = "editorial" | "modern" | "technical";

export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type Step = (typeof STEPS)[number];
export type Scale = Record<Step, string>;

const LIGHTNESS: Record<Step, number> = {
  50: 0.975, 100: 0.94, 200: 0.88, 300: 0.8, 400: 0.71, 500: 0.62, 600: 0.53, 700: 0.45, 800: 0.37, 900: 0.29, 950: 0.22,
};

export function parseHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(raw)) return `#${[...raw].map((x) => x + x).join("")}`;
  if (/^[0-9a-f]{6}$/.test(raw)) return `#${raw}`;
  return null;
}

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const part = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

export const toLinear = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
export const fromLinear = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

export function rgbToOklch({ r, g, b }: Rgb): Oklch {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.hypot(A, B), h: h < 0 ? h + 360 : h };
}

/** OKLCH to linear sRGB; values outside 0..1 mean out of gamut. */
function oklchToLinear({ l, c, h }: Oklch): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

/** Converts to hex, lowering chroma until the colour fits in sRGB so the hue and lightness hold. */
export function oklchToHex(color: Oklch): string {
  let c = color.c;
  for (let i = 0; i < 40; i++) {
    const lin = oklchToLinear({ ...color, c });
    if (lin.every((v) => v >= -0.0001 && v <= 1.0001)) {
      const [r, g, b] = lin.map((v) => fromLinear(Math.min(1, Math.max(0, v))));
      return rgbToHex({ r, g, b });
    }
    c *= 0.92;
  }
  const [r, g, b] = oklchToLinear({ ...color, c: 0 }).map((v) => fromLinear(Math.min(1, Math.max(0, v))));
  return rgbToHex({ r, g, b });
}

export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG 2.x contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** A scale of eleven steps at fixed perceptual lightness; chroma peaks in the middle and follows the brand. */
export function scale(hue: number, chroma: number): Scale {
  const out = {} as Scale;
  for (const step of STEPS) {
    const l = LIGHTNESS[step];
    const taper = 1 - Math.abs(l - 0.58) * 1.1;
    out[step] = oklchToHex({ l, c: Math.max(0, chroma * Math.max(0.18, taper)), h: hue });
  }
  return out;
}

export type Palette = {
  brand: string;
  primary: Scale;
  neutral: Scale;
  success: Scale;
  warning: Scale;
  danger: Scale;
};

export function palette(brandHex: string): Palette {
  const brand = parseHex(brandHex) ?? "#2449df";
  const { c, h } = rgbToOklch(hexToRgb(brand));
  // Near-grey brands keep a little chroma so the scale still reads as a colour.
  const chroma = Math.max(c, 0.02);
  return {
    brand,
    primary: scale(h, chroma),
    neutral: scale(h, Math.min(0.018, chroma * 0.12)),
    success: scale(150, 0.15),
    warning: scale(75, 0.15),
    danger: scale(27, 0.19),
  };
}

export type Roles = {
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  onPrimary: string;
  link: string;
  success: string;
  warning: string;
  danger: string;
};

const order = (mode: Mode): Step[] => (mode === "light" ? [...STEPS] : [...STEPS].reverse());

/** First step, walking from the background towards strong colours, that reaches the required contrast. */
function firstPassing(s: Scale, bg: string, min: number, mode: Mode, from: Step): string {
  const steps = order(mode);
  for (const step of steps.slice(steps.indexOf(from))) if (contrast(s[step], bg) >= min) return s[step];
  return s[mode === "light" ? 950 : 50];
}

export function roles(p: Palette, mode: Mode): Roles {
  const light = mode === "light";
  const background = light ? "#ffffff" : p.neutral[950];
  const surface = light ? p.neutral[50] : p.neutral[900];
  const text = light ? p.neutral[950] : p.neutral[50];
  // Buttons use the brand colour itself where it can carry readable text; otherwise the nearest step that can.
  const candidates = [p.brand, ...order(light ? "light" : "dark").map((s) => p.primary[s])];
  const fill = (c: string) => Math.max(contrast(c, "#ffffff"), contrast(c, p.neutral[950]));
  const primary = candidates.find((c) => fill(c) >= 4.5 && (light || luminance(c) > 0.08)) ?? p.primary[600];
  const onPrimary = contrast(primary, "#ffffff") >= contrast(primary, p.neutral[950]) ? "#ffffff" : p.neutral[950];
  return {
    background,
    surface,
    text,
    muted: firstPassing(p.neutral, surface, 4.5, mode, light ? 500 : 400),
    border: light ? p.neutral[200] : p.neutral[800],
    primary,
    onPrimary,
    link: firstPassing(p.primary, background, 4.5, mode, light ? 500 : 400),
    success: firstPassing(p.success, background, 4.5, mode, light ? 600 : 400),
    warning: firstPassing(p.warning, background, 4.5, mode, light ? 700 : 300),
    danger: firstPassing(p.danger, background, 4.5, mode, light ? 600 : 400),
  };
}

export type Check = { label: string; fg: string; bg: string; ratio: number; min: number };

export function checks(r: Roles): Check[] {
  const pairs: [string, string, string, number][] = [
    ["text/background", r.text, r.background, 4.5],
    ["muted/surface", r.muted, r.surface, 4.5],
    ["onPrimary/primary", r.onPrimary, r.primary, 4.5],
    ["link/background", r.link, r.background, 4.5],
    ["success/background", r.success, r.background, 4.5],
    ["warning/background", r.warning, r.background, 4.5],
    ["danger/background", r.danger, r.background, 4.5],
    ["border/background", r.border, r.background, 1.2],
  ];
  return pairs.map(([label, fg, bg, min]) => ({ label, fg, bg, min, ratio: contrast(fg, bg) }));
}

export const RADIUS: Record<Radius, number> = { sharp: 2, soft: 8, round: 16 };

export const TYPE: Record<TypeStyle, { heading: string; body: string }> = {
  editorial: { heading: '"Newsreader Variable", Georgia, serif', body: '"Inter Variable", Inter, system-ui, sans-serif' },
  modern: { heading: '"Inter Variable", Inter, system-ui, sans-serif', body: '"Inter Variable", Inter, system-ui, sans-serif' },
  technical: {
    heading: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
    body: '"Inter Variable", Inter, system-ui, sans-serif',
  },
};

export type Settings = { color: string; radius: Radius; type: TypeStyle };

const SCALES = ["primary", "neutral", "success", "warning", "danger"] as const;

export function exportCss(s: Settings): string {
  const p = palette(s.color);
  const lines: string[] = [":root {"];
  for (const name of SCALES) for (const step of STEPS) lines.push(`  --${name}-${step}: ${p[name][step]};`);
  lines.push(`  --radius: ${RADIUS[s.radius]}px;`, `  --font-heading: ${TYPE[s.type].heading};`, `  --font-body: ${TYPE[s.type].body};`);
  const roleLines = (mode: Mode, indent: string) =>
    Object.entries(roles(p, mode)).map(([k, v]) => `${indent}--color-${kebab(k)}: ${v};`);
  lines.push(...roleLines("light", "  "), "}", "", "@media (prefers-color-scheme: dark) {", "  :root {");
  lines.push(...roleLines("dark", "    "), "  }", "}");
  return lines.join("\n") + "\n";
}

export function exportTailwind(s: Settings): string {
  const p = palette(s.color);
  const lines: string[] = ['@import "tailwindcss";', "", "@theme {"];
  for (const name of SCALES) for (const step of STEPS) lines.push(`  --color-${name}-${step}: ${p[name][step]};`);
  lines.push(`  --radius-brand: ${RADIUS[s.radius]}px;`, `  --font-heading: ${TYPE[s.type].heading};`, `  --font-body: ${TYPE[s.type].body};`, "}");
  return lines.join("\n") + "\n";
}

/** Design Tokens Community Group format (https://tr.designtokens.org/format/). */
export function exportJson(s: Settings): string {
  const p = palette(s.color);
  const color: Record<string, unknown> = {};
  for (const name of SCALES)
    color[name] = Object.fromEntries(STEPS.map((step) => [step, { $type: "color", $value: p[name][step] }]));
  const role = (mode: Mode) =>
    Object.fromEntries(Object.entries(roles(p, mode)).map(([k, v]) => [kebab(k), { $type: "color", $value: v }]));
  return (
    JSON.stringify(
      {
        color,
        role: { light: role("light"), dark: role("dark") },
        radius: { brand: { $type: "dimension", $value: `${RADIUS[s.radius]}px` } },
        font: {
          heading: { $type: "fontFamily", $value: TYPE[s.type].heading },
          body: { $type: "fontFamily", $value: TYPE[s.type].body },
        },
      },
      null,
      2,
    ) + "\n"
  );
}

function kebab(s: string) {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/** Settings in the URL hash, so a result can be shared without anything reaching a server. */
export function encodeSettings(s: Settings): string {
  return `c=${s.color.slice(1)}&r=${s.radius}&t=${s.type}`;
}

export function decodeSettings(hash: string, fallback: Settings): Settings {
  const q = new URLSearchParams(hash.replace(/^#/, ""));
  const color = parseHex(q.get("c") || "") ?? fallback.color;
  const radius = (["sharp", "soft", "round"] as const).find((x) => x === q.get("r")) ?? fallback.radius;
  const type = (["editorial", "modern", "technical"] as const).find((x) => x === q.get("t")) ?? fallback.type;
  return { color, radius, type };
}
