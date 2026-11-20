/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

export type RolloutStep = { host: string; record: string };

/**
 * The usual way to roll DMARC out: watch, then quarantine a quarter, then all, then reject.
 * `current` is 0 when there is no record yet, 1 to 4 for the stage the domain is at, and null when the record is
 * invalid or doubled (fix that first). Records only contain the checked domain.
 */
export function dmarcRollout(domain: string, code: string, detail?: string): { current: number | null; steps: RolloutStep[] } {
  const host = `_dmarc.${domain}`;
  const rua = `rua=mailto:dmarc@${domain}`;
  const steps = [
    `v=DMARC1; p=none; ${rua}`,
    `v=DMARC1; p=quarantine; pct=25; ${rua}`,
    `v=DMARC1; p=quarantine; pct=100; ${rua}`,
    `v=DMARC1; p=reject; ${rua}`,
  ].map((record) => ({ host, record }));
  const byPolicy = (policy?: string) => (policy === "reject" ? 4 : policy === "quarantine" ? 3 : 1);
  const current =
    code === "dmarc-missing"
      ? 0
      : code === "dmarc-monitoring-only"
        ? 1
        : code === "dmarc-ok" || code === "dmarc-no-rua"
          ? byPolicy(detail)
          : null;
  return { current, steps };
}
