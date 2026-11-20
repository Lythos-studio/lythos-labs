/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { contrast, decodeSettings, encodeSettings, palette, roles, RADIUS, TYPE, type Mode, type Settings } from "@lythos-labs/brand-lab/tokens";
import { spacing, SPACE_STEPS, TEXT_STEPS, typeScale, WEIGHTS } from "@lythos-labs/brand-lab/scales";

export type ThemeState = { settings: Settings; mode: Mode };
export const DEFAULT_THEME: ThemeState = { settings: { color: "#2449df", radius: "soft", type: "modern" }, mode: "light" };

export const REQUIRED_VARS = [
  "--lb-bg", "--lb-surface", "--lb-text", "--lb-muted", "--lb-border", "--lb-primary", "--lb-on-primary", "--lb-link", "--lb-focus",
  "--lb-accent", "--lb-on-accent", "--lb-tint", "--lb-success-bg", "--lb-success-text", "--lb-warning-bg", "--lb-warning-text",
  "--lb-danger-bg", "--lb-danger-text", "--lb-info-bg", "--lb-info-text", "--lb-radius", "--lb-font-heading", "--lb-font-body",
  "--lb-weight-heading", "--lb-shadow", "--lb-scrim",
];

/** The most colourful step of a scale that still reads on \`bg\` at \`min\` contrast: from the middle outwards, towards dark in light mode and light in dark mode. */
function readable(scale: Record<number, string>, bg: string, min: number, mode: Mode): string {
  const order = mode === "light" ? [500, 600, 700, 800, 900, 950] : [500, 400, 300, 200, 100, 50];
  return scale[order.find((step) => contrast(scale[step], bg) >= min) ?? order[order.length - 1]];
}

/** Everything the blocks read, as CSS custom properties, from a Merklab brand (colour, corners, typography, optional accent) and a mode. */
export function themeVars(settings: Settings, mode: Mode): Record<string, string> {
  const p = palette(settings.color, settings.accent);
  const r = roles(p, mode);
  const light = mode === "light";
  const tint = light ? p.primary[100] : p.primary[900];
  const bgFor = (scale: Record<number, string>) => (light ? scale[50] : scale[950]);
  const tone = (scale: Record<number, string>) => {
    const bg = bgFor(scale);
    return { bg, text: readable(scale, bg, 4.5, mode) };
  };
  const success = tone(p.success);
  const warning = tone(p.warning);
  const danger = tone(p.danger);
  const info = { bg: tint, text: readable(p.primary, tint, 4.5, mode) };
  const scale = typeScale(settings.type);
  const vars: Record<string, string> = {
    "--lb-bg": r.background,
    "--lb-surface": r.surface,
    "--lb-text": r.text,
    "--lb-muted": r.muted,
    "--lb-border": light ? p.neutral[300] : p.neutral[700],
    "--lb-primary": r.primary,
    "--lb-on-primary": r.onPrimary,
    "--lb-link": r.link,
    "--lb-focus": r.link,
    "--lb-accent": r.accent ?? r.primary,
    "--lb-on-accent": r.onAccent ?? r.onPrimary,
    "--lb-tint": tint,
    "--lb-success-bg": success.bg,
    "--lb-success-text": success.text,
    "--lb-warning-bg": warning.bg,
    "--lb-warning-text": warning.text,
    "--lb-danger-bg": danger.bg,
    "--lb-danger-text": danger.text,
    "--lb-info-bg": info.bg,
    "--lb-info-text": info.text,
    "--lb-radius": `${RADIUS[settings.radius]}px`,
    "--lb-font-heading": TYPE[settings.type].heading,
    "--lb-font-body": TYPE[settings.type].body,
    "--lb-weight-heading": String(WEIGHTS[settings.type].heading),
    "--lb-shadow": light ? "0 1px 2px rgb(0 0 0 / 0.08), 0 8px 24px rgb(0 0 0 / 0.08)" : "0 1px 2px rgb(0 0 0 / 0.4), 0 8px 24px rgb(0 0 0 / 0.4)",
    "--lb-scrim": light ? "rgb(15 20 40 / 0.45)" : "rgb(0 0 0 / 0.6)",
  };
  for (const step of TEXT_STEPS) {
    vars[`--lb-text-${step}`] = scale[step].size;
    vars[`--lb-line-${step}`] = String(scale[step].line);
  }
  const space = spacing();
  for (const step of SPACE_STEPS) vars[`--lb-space-${step}`] = space[step];
  return vars;
}

export function parseThemeHash(hash: string): ThemeState {
  const raw = hash.replace(/^#/, "");
  const mode = new URLSearchParams(raw).get("m") === "dark" ? "dark" : "light";
  return { settings: decodeSettings(raw, DEFAULT_THEME.settings), mode };
}

/** Same format as Merklab (c, r, t, a) plus m=dark. Light is the default and stays out of the link. */
export function encodeThemeHash(state: ThemeState): string {
  return `${encodeSettings(state.settings)}${state.mode === "dark" ? "&m=dark" : ""}`;
}

/** A style rule for a selector, for the starter kit. */
export function varsToCss(vars: Record<string, string>, selector = ":root"): string {
  return `${selector} {\n${Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join("\n")}\n}\n`;
}
