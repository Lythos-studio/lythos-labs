/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

export const TABBABLE =
  'a[href], area[href], button, input:not([type="hidden"]), select, textarea, summary, iframe, [contenteditable=""], [contenteditable="true"], [tabindex]';

export function isVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return true;
  if (el.hidden || el.closest("[hidden], [inert]")) return false;
  const style = getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none" && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0);
}

/** Elements Tab can reach inside `root`, in DOM order (the lens uses the full tab-order algorithm). */
export function tabbables(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (el) => !(el as HTMLButtonElement).disabled && el.getAttribute("tabindex") !== "-1" && isVisible(el),
  );
}

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");
