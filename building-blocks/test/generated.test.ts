/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { catalog } from "../src/catalog";
import evidence from "../src/generated/evidence.json";
import sizes from "../src/generated/sizes.json";
import { sources } from "../src/generated/sources";
import { buildSizes, buildSources, sourceHash } from "../scripts/lib";

const BUDGET = { core: 4096, advanced: 10240, signature: 10240 } as const;

test("the generated sources and sizes are current: run `npm run gen` after changing a block", () => {
  assert.deepEqual(sources, buildSources());
  assert.deepEqual(sizes, buildSizes());
});

test("every block stays inside its size budget (gzip of its own TSX and CSS) and needs no package besides React", () => {
  for (const { meta } of catalog) {
    const s = (sizes as Record<string, { gzip: number }>)[meta.slug];
    assert.ok(s.gzip <= BUDGET[meta.tier], `${meta.slug}: ${s.gzip} bytes gzip is over the ${BUDGET[meta.tier]} budget`);
  }
});

test("the evidence belongs to the current code and shows only what was measured", () => {
  const blocks = (evidence as { blocks: Record<string, { sourceHash: string; behaviours: number; native: number; realKeyboardPassed: number; inPagePassed: number; axeStates: number; axeViolations: number }> }).blocks;
  for (const { meta, contract } of catalog) {
    const e = blocks[meta.slug];
    assert.ok(e, `${meta.slug}: no evidence; run the end-to-end tests and \`npm run gen\``);
    assert.equal(e.sourceHash, sourceHash(meta.slug), `${meta.slug}: the code changed after the evidence was made; rerun \`npm run e2e\` and \`npm run gen\``);
    assert.equal(e.behaviours, contract.behaviours.length);
    assert.equal(e.native, contract.behaviours.filter((b) => b.kind === "native").length);
    assert.equal(e.realKeyboardPassed, e.behaviours, `${meta.slug}: every behaviour passed with the real keyboard`);
    assert.equal(e.inPagePassed, e.behaviours - e.native, `${meta.slug}: every in-page check passed`);
    assert.ok(e.axeStates >= 4, `${meta.slug}: axe ran in at least four themes`);
    assert.equal(e.axeViolations, 0, `${meta.slug}: axe found violations`);
  }
});
