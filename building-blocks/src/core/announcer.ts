/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { createAnnounceQueue, type Announcement, type Politeness } from "./announce-queue";

const queue = createAnnounceQueue();
const listeners = new Set<(a: Announcement) => void>();
const regions: Partial<Record<Politeness, HTMLElement>> = {};

function region(politeness: Politeness): HTMLElement {
  let el = regions[politeness];
  if (!el || !el.isConnected) {
    el = document.createElement("div");
    el.setAttribute("data-lb-live", politeness);
    el.setAttribute("aria-live", politeness);
    el.setAttribute("aria-atomic", "true");
    if (politeness === "assertive") el.setAttribute("role", "alert");
    else el.setAttribute("role", "status");
    el.className = "lb-sr-only";
    document.body.appendChild(el);
    regions[politeness] = el;
  }
  return el;
}

/** Tells assistive technology something happened that has no visible focus change (a toast, a moved item). Works without a provider. */
export function announce(message: string, politeness: Politeness = "polite"): void {
  if (typeof document === "undefined") return;
  const verdict = queue.push(message, politeness, Date.now());
  if (!verdict.emit) return;
  const el = region(politeness);
  // Clearing first makes a screen reader read the same text again.
  el.textContent = "";
  setTimeout(() => {
    el.textContent = message.trim();
  }, 30);
  const entry = queue.log().at(-1);
  if (entry) listeners.forEach((l) => l(entry));
}

/** For the lens: everything that was announced, and a way to follow new announcements. */
export const announcementLog = () => queue.log();
export function onAnnounce(listener: (a: Announcement) => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
