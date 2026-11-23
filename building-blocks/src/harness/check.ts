/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { isVisible } from "../core/dom";
import type { Expect, Ref } from "./types";

export function parseRef(ref: Ref): { sel: string; index: number } {
  if (typeof ref !== "string") return { sel: ref.sel, index: ref.index ?? 0 };
  const m = /^(.*)@(\d+)$/.exec(ref);
  return m ? { sel: m[1], index: Number(m[2]) } : { sel: ref, index: 0 };
}

export function resolve(root: ParentNode, ref: Ref): HTMLElement | null {
  const { sel, index } = parseRef(ref);
  return root.querySelectorAll<HTMLElement>(sel)[index] ?? null;
}

const label = (ref: Ref) => (typeof ref === "string" ? ref : `${ref.sel}@${ref.index ?? 0}`);

/** Checks one expectation against the DOM. Returns null when it holds, otherwise the reason. The same function runs in the page and in the end-to-end tests. */
export function checkExpect(root: ParentNode, e: Expect): string | null {
  if ("count" in e) {
    const n = root.querySelectorAll(e.sel).length;
    return n === e.count ? null : `expected ${e.count} of ${e.sel}, found ${n}`;
  }
  const el = resolve(root, e.ref);
  if ("exists" in e) return !!el === e.exists ? null : `${label(e.ref)} ${e.exists ? "is missing" : "should not exist"}`;
  if (!el) return `${label(e.ref)} is missing`;
  if ("attr" in e) {
    for (const [name, want] of Object.entries(e.attr)) {
      const got = el.getAttribute(name);
      if (want === null ? got !== null : want === "*" ? !got : got !== want) return `${label(e.ref)} ${name} is ${got === null ? "absent" : JSON.stringify(got)}, expected ${want === null ? "absent" : JSON.stringify(want)}`;
    }
    return null;
  }
  if ("prop" in e) {
    for (const [name, want] of Object.entries(e.prop)) {
      const got = (el as unknown as Record<string, unknown>)[name];
      if (got !== want) return `${label(e.ref)} ${name} is ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`;
    }
    return null;
  }
  if ("focused" in e) {
    const active = el.ownerDocument.activeElement;
    const has = active === el || (el.contains(active) && el.getAttribute("role") === "dialog");
    return has === e.focused ? null : `${label(e.ref)} ${e.focused ? "should have focus" : "should not have focus"}`;
  }
  if ("text" in e) return (el.textContent ?? "").includes(e.text) ? null : `${label(e.ref)} text is ${JSON.stringify((el.textContent ?? "").slice(0, 60))}, expected it to contain ${JSON.stringify(e.text)}`;
  if ("value" in e) return (el as HTMLInputElement).value === e.value ? null : `${label(e.ref)} value is ${JSON.stringify((el as HTMLInputElement).value)}, expected ${JSON.stringify(e.value)}`;
  if ("visible" in e) return isVisible(el) === e.visible ? null : `${label(e.ref)} should be ${e.visible ? "visible" : "hidden"}`;
  return null;
}
