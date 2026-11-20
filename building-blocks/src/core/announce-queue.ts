/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

export type Politeness = "polite" | "assertive";
export type Announcement = { message: string; politeness: Politeness; at: number };

/** Decides what is worth announcing: empty messages and an identical message repeated within `windowMs` are dropped. Keeps a log for the lens. */
export function createAnnounceQueue(windowMs = 500) {
  const entries: Announcement[] = [];
  return {
    push(message: string, politeness: Politeness, now: number): { emit: boolean } {
      const text = message.trim();
      if (!text) return { emit: false };
      const previous = [...entries].reverse().find((e) => e.politeness === politeness && e.message === text);
      if (previous && now - previous.at < windowMs) return { emit: false };
      entries.push({ message: text, politeness, at: now });
      if (entries.length > 200) entries.shift();
      return { emit: true };
    },
    log: () => [...entries],
    clear: () => void (entries.length = 0),
  };
}
