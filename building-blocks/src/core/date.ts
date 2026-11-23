/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/** Calendar maths on plain year/month/day values, with no time zones and no Date parsing surprises. */
export type Ymd = { y: number; m: number; d: number };

export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** 0 = Monday ... 6 = Sunday, for the first day of the month. */
export const firstWeekday = (y: number, m: number) => (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;

export function addDays(v: Ymd, n: number): Ymd {
  const t = new Date(Date.UTC(v.y, v.m - 1, v.d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

export function addMonths(v: Ymd, n: number): Ymd {
  const idx = v.y * 12 + (v.m - 1) + n;
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return { y, m, d: Math.min(v.d, daysInMonth(y, m)) };
}

export const toIso = (v: Ymd) => `${String(v.y).padStart(4, "0")}-${String(v.m).padStart(2, "0")}-${String(v.d).padStart(2, "0")}`;

export function fromIso(s: string): Ymd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) return null;
  const v = { y: +match[1], m: +match[2], d: +match[3] };
  return v.m >= 1 && v.m <= 12 && v.d >= 1 && v.d <= daysInMonth(v.y, v.m) ? v : null;
}

export const compare = (a: Ymd, b: Ymd) => a.y - b.y || a.m - b.m || a.d - b.d;
export const sameDay = (a: Ymd | null | undefined, b: Ymd | null | undefined) => !!a && !!b && compare(a, b) === 0;

export function clamp(v: Ymd, min?: Ymd, max?: Ymd): Ymd {
  if (min && compare(v, min) < 0) return min;
  if (max && compare(v, max) > 0) return max;
  return v;
}

/** The weeks of a month as rows of 7 cells; days outside the month are null. */
export function monthGrid(y: number, m: number): (Ymd | null)[][] {
  const cells: (Ymd | null)[] = Array.from({ length: firstWeekday(y, m) }, () => null);
  for (let d = 1; d <= daysInMonth(y, m); d++) cells.push({ y, m, d });
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}
