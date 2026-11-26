/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/** The eight Postgres table lock modes, weakest first (PostgreSQL docs, "Table-Level Locks"). */
export const MODES = [
  "ACCESS SHARE",
  "ROW SHARE",
  "ROW EXCLUSIVE",
  "SHARE UPDATE EXCLUSIVE",
  "SHARE",
  "SHARE ROW EXCLUSIVE",
  "EXCLUSIVE",
  "ACCESS EXCLUSIVE",
] as const;

export type ModeName = (typeof MODES)[number];
/** Index into MODES. */
export type Mode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const ACCESS_SHARE: Mode = 0;
export const ROW_SHARE: Mode = 1;
export const ROW_EXCLUSIVE: Mode = 2;
export const SHARE_UPDATE_EXCLUSIVE: Mode = 3;
export const SHARE: Mode = 4;
export const SHARE_ROW_EXCLUSIVE: Mode = 5;
export const EXCLUSIVE: Mode = 6;
export const ACCESS_EXCLUSIVE: Mode = 7;

// Row i lists the modes that conflict with mode i, straight from the conflict table in the docs.
const CONFLICTS: Mode[][] = [
  [7],
  [6, 7],
  [4, 5, 6, 7],
  [3, 4, 5, 6, 7],
  [2, 3, 5, 6, 7],
  [2, 3, 4, 5, 6, 7],
  [1, 2, 3, 4, 5, 6, 7],
  [0, 1, 2, 3, 4, 5, 6, 7],
];

/** Bit i set means "conflicts with mode i". */
export const CONFLICT_MASK: number[] = CONFLICTS.map((list) => list.reduce<number>((m, i) => m | (1 << i), 0));

export const conflicts = (a: Mode, b: Mode) => (CONFLICT_MASK[a] & (1 << b)) !== 0;
/** Plain SELECT takes ACCESS SHARE. */
export const blocksReads = (m: Mode) => conflicts(m, ACCESS_SHARE);
/** INSERT, UPDATE and DELETE take ROW EXCLUSIVE. */
export const blocksWrites = (m: Mode) => conflicts(m, ROW_EXCLUSIVE);

export function modeFromWords(words: string): Mode | null {
  const i = MODES.indexOf(words.toUpperCase().replace(/\s+/g, " ").trim() as ModeName);
  return i < 0 ? null : (i as Mode);
}
