/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { checkExpect, resolve } from "./check";
import type { Behaviour, BehaviourResult, Contract, Step } from "./types";

const keyEvent = (type: "keydown" | "keyup", key: string, target: Element) =>
  target.dispatchEvent(new KeyboardEvent(type, { key, code: key.length === 1 ? `Key${key.toUpperCase()}` : key, bubbles: true, cancelable: true }));

function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Presses a key on the focused element with synthetic events, then does what the browser would natively do for the simple cases
 * (Enter and Space activating a button, Space toggling a checkbox). Tab and anything else native is not simulated.
 */
export function pressKey(root: ParentNode, key: string): void {
  const doc = (root as Element).ownerDocument ?? (root as Document);
  const target = doc.activeElement ?? doc.body;
  if (key === "Tab" || key.includes("+")) throw new Error(`"${key}" is native and cannot be simulated`);
  const proceed = keyEvent("keydown", key, target);
  if (!proceed) {
    keyEvent("keyup", key, target);
    return;
  }
  const tag = target.tagName;
  const isCheck = tag === "INPUT" && ["checkbox", "radio"].includes((target as HTMLInputElement).type);
  if (key === "Enter" && (tag === "BUTTON" || (tag === "A" && target.hasAttribute("href")) || tag === "SUMMARY")) (target as HTMLElement).click();
  if (key === "Enter" && tag === "INPUT" && !isCheck) (target as HTMLInputElement).form?.requestSubmit?.();
  keyEvent("keyup", key, target);
  if (key === " " && (tag === "BUTTON" || tag === "SUMMARY" || isCheck)) (target as HTMLElement).click();
}

function perform(root: ParentNode, step: Step): Promise<void> | void {
  if ("focus" in step) {
    const el = resolve(root, step.focus);
    if (!el) throw new Error(`cannot focus ${JSON.stringify(step.focus)}: not found`);
    el.focus();
  } else if ("key" in step) pressKey(root, step.key);
  else if ("click" in step) {
    const el = resolve(root, step.click);
    if (!el) throw new Error(`cannot click ${JSON.stringify(step.click)}: not found`);
    el.click();
  } else if ("hover" in step) {
    const el = resolve(root, step.hover);
    if (!el) throw new Error(`cannot hover ${JSON.stringify(step.hover)}: not found`);
    for (const type of ["pointerover", "mouseover", "pointerenter", "mouseenter"]) el.dispatchEvent(new MouseEvent(type, { bubbles: type.endsWith("over"), cancelable: true }));
  } else if ("upload" in step) {
    const el = resolve(root, step.upload) as HTMLInputElement | null;
    if (!el) throw new Error(`cannot upload to ${JSON.stringify(step.upload)}: not found`);
    const dt = new DataTransfer();
    for (const f of step.files) dt.items.add(new File([new Uint8Array(f.size)], f.name, { type: f.type }));
    el.files = dt.files;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else if ("type" in step) {
    const el = (root as Element).ownerDocument.activeElement as HTMLInputElement | null;
    for (const ch of step.type) {
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
        keyEvent("keydown", ch, el);
        setValue(el, el.value + ch);
        keyEvent("keyup", ch, el);
      } else if (el) pressKey(root, ch);
    }
  } else return new Promise((r) => setTimeout(r, step.wait));
}

const settle = () => new Promise<void>((r) => setTimeout(r, 20));

/** Runs one behaviour on a fresh fixture. `native` behaviours are skipped on purpose: only the real browser can prove them. */
export async function runBehaviour(root: ParentNode, b: Behaviour): Promise<BehaviourResult> {
  if (b.kind === "native") return { id: b.id, status: "skipped", reason: "native" };
  try {
    for (const step of b.steps ?? []) {
      await perform(root, step);
      await settle();
    }
    for (const e of b.expect ?? []) {
      const reason = checkExpect(root, e);
      if (reason) return { id: b.id, status: "fail", reason };
    }
    return { id: b.id, status: "pass" };
  } catch (error) {
    return { id: b.id, status: "fail", reason: error instanceof Error ? error.message : "error" };
  }
}

export type Mounted = { root: HTMLElement; unmount(): void };

/** Runs a whole contract: every behaviour gets its own freshly mounted fixture, so one failure cannot affect the next. */
export async function runContract(contract: Contract, mount: () => Promise<Mounted> | Mounted): Promise<BehaviourResult[]> {
  const results: BehaviourResult[] = [];
  for (const b of contract.behaviours) {
    if (b.kind === "native") {
      results.push({ id: b.id, status: "skipped", reason: "native" });
      continue;
    }
    const m = await mount();
    try {
      results.push(await runBehaviour(m.root, b));
    } finally {
      m.unmount();
    }
  }
  return results;
}
