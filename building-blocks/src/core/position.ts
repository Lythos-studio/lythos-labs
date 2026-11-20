/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

export type Rect = { x: number; y: number; width: number; height: number };
export type Placement = "bottom" | "top" | "left" | "right";

/** Where to put a floating box next to an anchor: flip to the other side when it does not fit, then shift to stay inside the viewport. */
export function computePosition(
  anchor: Rect,
  floating: { width: number; height: number },
  viewport: { width: number; height: number },
  placement: Placement = "bottom",
  options: { gap?: number; padding?: number; align?: "start" | "center" | "end" } = {},
): { x: number; y: number; placement: Placement } {
  const { gap = 8, padding = 8, align = "center" } = options;
  const room: Record<Placement, number> = {
    bottom: viewport.height - (anchor.y + anchor.height) - gap - padding,
    top: anchor.y - gap - padding,
    right: viewport.width - (anchor.x + anchor.width) - gap - padding,
    left: anchor.x - gap - padding,
  };
  const need = placement === "top" || placement === "bottom" ? floating.height : floating.width;
  const opposite: Record<Placement, Placement> = { bottom: "top", top: "bottom", left: "right", right: "left" };
  const side = room[placement] >= need || room[opposite[placement]] <= room[placement] ? placement : opposite[placement];
  const alongX = (side === "top" || side === "bottom");
  const alignOffset = (size: number, anchorSize: number) => (align === "start" ? 0 : align === "end" ? anchorSize - size : (anchorSize - size) / 2);
  let x = alongX ? anchor.x + alignOffset(floating.width, anchor.width) : side === "right" ? anchor.x + anchor.width + gap : anchor.x - gap - floating.width;
  let y = !alongX ? anchor.y + alignOffset(floating.height, anchor.height) : side === "bottom" ? anchor.y + anchor.height + gap : anchor.y - gap - floating.height;
  const clamp = (v: number, size: number, max: number) => Math.max(padding, Math.min(v, max - size - padding));
  x = clamp(x, floating.width, viewport.width);
  y = clamp(y, floating.height, viewport.height);
  return { x, y, placement: side };
}
