/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

export type Orientation = "horizontal" | "vertical" | "both";

/**
 * The next focus position for a roving-focus widget (tabs, menus, toolbars, listboxes).
 * Returns `current` for keys that do nothing. `skip` marks disabled items. -1 means "no item".
 */
export function nextIndex(
  current: number,
  key: string,
  length: number,
  options: { orientation?: Orientation; wrap?: boolean; rtl?: boolean; skip?: (index: number) => boolean } = {},
): number {
  const { orientation = "both", wrap = true, rtl = false, skip = () => false } = options;
  if (length <= 0) return -1;
  const usable = (i: number) => i >= 0 && i < length && !skip(i);
  let step = 0;
  if (key === "Home" || key === "End") {
    const order = key === "Home" ? Array.from({ length }, (_, i) => i) : Array.from({ length }, (_, i) => length - 1 - i);
    return order.find(usable) ?? current;
  }
  const horizontal = orientation === "horizontal" || orientation === "both";
  const vertical = orientation === "vertical" || orientation === "both";
  if (vertical && key === "ArrowDown") step = 1;
  else if (vertical && key === "ArrowUp") step = -1;
  else if (horizontal && key === "ArrowRight") step = rtl ? -1 : 1;
  else if (horizontal && key === "ArrowLeft") step = rtl ? 1 : -1;
  if (!step) return current;
  let i = current;
  for (let n = 0; n < length; n++) {
    if (i === -1) i = step > 0 ? 0 : length - 1;
    else {
      i += step;
      if (i < 0 || i >= length) {
        if (!wrap) return current;
        i = (i + length) % length;
      }
    }
    if (usable(i)) return i;
  }
  return current;
}
