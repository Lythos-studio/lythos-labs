/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Type-to-find for lists. Characters typed within `timeoutMs` of each other build a prefix; a repeated single
 * letter cycles through the items that start with it. Returns the index to move to, or -1.
 */
export function createTypeahead(timeoutMs = 700, now: () => number = () => Date.now()) {
  let buffer = "";
  let last = -Infinity;
  return {
    type(char: string, labels: string[], from: number): number {
      if (char.length !== 1 || !labels.length) return -1;
      const t = now();
      if (t - last > timeoutMs) buffer = "";
      last = t;
      buffer += plain(char);
      const cycling = buffer.length > 1 && [...buffer].every((c) => c === buffer[0]);
      const needle = cycling ? buffer[0] : buffer;
      const start = cycling || buffer.length === 1 ? from + 1 : from;
      for (let n = 0; n < labels.length; n++) {
        const i = (start + n + labels.length) % labels.length;
        if (plain(labels[i]).startsWith(needle)) return i;
      }
      return -1;
    },
    reset() {
      buffer = "";
    },
  };
}
