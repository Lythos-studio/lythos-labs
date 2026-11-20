/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { luminance, oklchToHex, parseHex, rgbToHex, type Mode } from "./tokens";

/**
 * Reads colours from pasted text: CSS custom properties, a Tailwind v4 `@theme` block (same syntax) or design token JSON.
 * The input is untrusted. It is limited in size, scanned by a small tokenizer (no CSS engine, no eval) and every
 * failure is an error value.
 */
export const IMPORT_LIMIT = 100_000;
const MAX_COLORS = 500;
const MAX_DEPTH = 20;

export type ImportNote = "dark-block" | "duplicate" | "alpha-skipped";
export type ImportResult =
  | { ok: true; colors: Record<string, string>; skipped: string[]; notes: ImportNote[] }
  | { ok: false; error: "empty" | "too-large" | "invalid-json" | "no-colors" };

const num = (s: string): number | null => {
  const m = /^(-?\d*\.?\d+)(%|deg)?$/.exec(s);
  return m ? Number(m[1]) * (m[2] === "%" ? 0.01 : 1) : null;
};

const isOpaque = (part: string | undefined) => part === undefined || num(part) === 1;

export function parseColor(text: string): string | null {
  const t = text.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(t)?.[1];
  if (hex) {
    if (hex.length === 4 && hex[3] !== "f") return null;
    if (hex.length === 8 && hex.slice(6) !== "ff") return null;
    return parseHex(hex.length === 4 ? hex.slice(0, 3) : hex.slice(0, hex.length === 8 ? 6 : hex.length));
  }
  const fn = /^(rgba?|hsla?|oklch)\(\s*([^()]*)\)$/.exec(t);
  if (!fn) return null;
  const parts = fn[2].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3 || parts.length > 4 || !isOpaque(parts[3])) return null;
  if (fn[1].startsWith("rgb")) {
    const v = parts.slice(0, 3).map((p) => {
      const n = num(p);
      return n === null ? null : p.endsWith("%") ? n * 255 : n;
    });
    return v.some((x) => x === null) ? null : rgbToHex({ r: v[0]!, g: v[1]!, b: v[2]! });
  }
  if (fn[1].startsWith("hsl")) {
    const [h, s, l] = [num(parts[0]), num(parts[1]), num(parts[2])];
    if (h === null || s === null || l === null || !parts[1].endsWith("%") || !parts[2].endsWith("%")) return null;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return rgbToHex({ r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 });
  }
  const [l, c, h] = [num(parts[0]), num(parts[1]), num(parts[2])];
  return l === null || c === null || h === null ? null : oklchToHex({ l: Math.min(1, Math.max(0, l)), c: Math.max(0, c), h: ((h % 360) + 360) % 360 });
}

const DARK = /\.dark\b|\.dark-mode|\[data-theme=["']?dark|prefers-color-scheme\s*:\s*dark/i;

export function parseImport(text: string): ImportResult {
  if (!text.trim()) return { ok: false, error: "empty" };
  if (text.length > IMPORT_LIMIT) return { ok: false, error: "too-large" };
  const colors: Record<string, string> = {};
  const skipped: string[] = [];
  const notes = new Set<ImportNote>();

  const add = (name: string, value: string) => {
    if (Object.keys(colors).length >= MAX_COLORS && !(name in colors)) return;
    if (name in colors) notes.add("duplicate");
    const hex = parseColor(value);
    if (hex) {
      colors[name] = hex;
      return;
    }
    delete colors[name];
    if (/^#[0-9a-f]{8}$|^rgba|^hsla/i.test(value.trim())) notes.add("alpha-skipped");
    if (!skipped.includes(name)) skipped.push(name);
  };

  if (text.trim().startsWith("{")) {
    let root: unknown;
    try {
      root = JSON.parse(text);
    } catch {
      return { ok: false, error: "invalid-json" };
    }
    const walk = (node: unknown, path: string[], type: string | undefined, depth: number) => {
      if (depth > MAX_DEPTH || typeof node !== "object" || node === null || Array.isArray(node)) return;
      const obj = node as Record<string, unknown>;
      const own = typeof obj.$type === "string" ? obj.$type : type;
      if (typeof obj.$value === "string" && own === "color") add(path.join("-").toLowerCase(), obj.$value);
      for (const [key, child] of Object.entries(obj)) if (!key.startsWith("$")) walk(child, [...path, key], own, depth + 1);
    };
    walk(root, [], undefined, 0);
  } else {
    const clean = text.replace(/\/\*[\s\S]*?\*\//g, "");
    const stack: boolean[] = [];
    let buf = "";
    const declaration = () => {
      const m = /^\s*--([\w-]+)\s*:\s*([\s\S]+?)\s*$/.exec(buf);
      buf = "";
      if (!m) return;
      if (stack.at(-1)) notes.add("dark-block");
      else add(m[1].toLowerCase(), m[2]);
    };
    for (const ch of clean) {
      if (ch === "{") {
        stack.push(DARK.test(buf) || (stack.at(-1) ?? false));
        buf = "";
      } else if (ch === "}") {
        declaration();
        stack.pop();
      } else if (ch === ";") declaration();
      else buf += ch;
    }
    declaration();
  }
  return Object.keys(colors).length ? { ok: true, colors, skipped, notes: [...notes] } : { ok: false, error: "no-colors" };
}

export type RoleKey = "background" | "surface" | "text" | "muted" | "border" | "primary" | "onPrimary" | "accent" | "link" | "success" | "warning" | "danger";
export const ROLE_KEYS: readonly RoleKey[] = ["background", "surface", "text", "muted", "border", "primary", "onPrimary", "accent", "link", "success", "warning", "danger"];

const ALIASES: Record<RoleKey, string[]> = {
  background: ["background", "bg"],
  surface: ["surface", "card"],
  text: ["text", "foreground", "fg", "ink"],
  muted: ["muted", "text-muted", "muted-foreground", "muted-text"],
  border: ["border"],
  primary: ["primary", "brand"],
  onPrimary: ["on-primary", "primary-foreground", "primary-text"],
  accent: ["accent"],
  link: ["link"],
  success: ["success"],
  warning: ["warning", "warn"],
  danger: ["danger", "error", "destructive"],
};

/** Matches token names to roles by exact name (after removing a leading `color-`). Anything else can be assigned by hand. */
export function mapRoles(colors: Record<string, string>): Partial<Record<RoleKey, string>> {
  const out: Partial<Record<RoleKey, string>> = {};
  const names = Object.keys(colors).map((n) => [n, n.replace(/^(colors?|clr)-/, "")] as const);
  for (const role of ROLE_KEYS)
    for (const alias of ALIASES[role]) {
      const hit = names.find(([, short]) => short === alias);
      if (hit) {
        out[role] = colors[hit[0]];
        break;
      }
    }
  return out;
}

/** An imported set describes one mode: dark when its background is dark. */
export function detectMode(map: Partial<Record<RoleKey, string>>): Mode {
  return map.background && luminance(map.background) < 0.18 ? "dark" : "light";
}
