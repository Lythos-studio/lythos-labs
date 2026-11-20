/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { RULES, type RuleId } from "./rules";

const ORDER = Object.keys(RULES) as RuleId[];

/** The rules a visitor switched off, as an address fragment. Only rule ids, never the compose file. */
export function encodeDisabled(disabled: readonly RuleId[]): string {
  const chosen = ORDER.filter((id) => disabled.includes(id));
  return chosen.length ? `off=${chosen.join(",")}` : "";
}

/** Reads the fragment back. Unknown, repeated or odd values are ignored and the result follows the order of the rules. */
export function decodeDisabled(hash: string): RuleId[] {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(decodeURIComponent(hash.replace(/^#/, "")));
  } catch {
    return [];
  }
  const raw = (params.get("off") ?? "").slice(0, 2000).split(",");
  return ORDER.filter((id) => raw.includes(id));
}
