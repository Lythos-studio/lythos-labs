/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/** ok: fine. warn: could be better. fail: wrong. info: neutral, nothing to fix. unknown: could not be determined. */
export type Level = "ok" | "warn" | "fail" | "info" | "unknown";

/** A verdict with a language-independent code; the interface turns it into words. */
export type Finding = { level: Level; code: string; detail?: string };
