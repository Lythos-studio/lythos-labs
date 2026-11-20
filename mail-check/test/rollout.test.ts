/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { dmarcRollout } from "../src/rollout";

test("the rollout has four stages with records for the checked domain only", () => {
  const { steps } = dmarcRollout("example.nl", "dmarc-missing");
  assert.deepEqual(
    steps.map((s) => s.record),
    [
      "v=DMARC1; p=none; rua=mailto:dmarc@example.nl",
      "v=DMARC1; p=quarantine; pct=25; rua=mailto:dmarc@example.nl",
      "v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc@example.nl",
      "v=DMARC1; p=reject; rua=mailto:dmarc@example.nl",
    ],
  );
  for (const s of steps) assert.equal(s.host, "_dmarc.example.nl");
});

test("the current stage follows the finding", () => {
  const stage = (code: string, detail?: string) => dmarcRollout("example.nl", code, detail).current;
  assert.equal(stage("dmarc-missing"), 0);
  assert.equal(stage("dmarc-monitoring-only"), 1);
  assert.equal(stage("dmarc-ok", "quarantine"), 3);
  assert.equal(stage("dmarc-ok", "reject"), 4);
  assert.equal(stage("dmarc-no-rua", "quarantine"), 3);
  assert.equal(stage("dmarc-no-rua", "none"), 1);
});

test("an invalid or multiple DMARC record has no current stage", () => {
  assert.equal(dmarcRollout("example.nl", "dmarc-invalid").current, null);
  assert.equal(dmarcRollout("example.nl", "dmarc-multiple").current, null);
});
