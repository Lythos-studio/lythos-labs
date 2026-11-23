/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { catalog } from "../src/catalog";
import { open, runSteps } from "./helpers";

const OUT = fileURLToPath(new URL("./out/", import.meta.url));
mkdirSync(OUT, { recursive: true });
const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js");

/** Three brands and both modes: the defaults, a light yellow (hard for contrast) and a dark near-black. */
const THEMES = [
  { name: "blue-light", hash: "#c=2449df&r=soft&t=modern" },
  { name: "blue-dark", hash: "#c=2449df&r=soft&t=modern&m=dark" },
  { name: "yellow-light", hash: "#c=ffcc00&r=round&t=editorial" },
  { name: "graphite-dark", hash: "#c=111827&r=sharp&t=technical&m=dark" },
];

for (const { meta } of catalog) {
  for (const theme of THEMES) {
    test(`axe: ${meta.slug} in ${theme.name}`, async ({ page }) => {
      await page.goto(`/labs/blocks/${meta.slug}${theme.hash}`);
      await page.locator('[data-lb-stage][data-lb-ready="true"]').waitFor();
      await page.addScriptTag({ path: axePath });
      const result = await page.evaluate(async () => {
        const axe = (window as unknown as { axe: { run(ctx: string, opts: object): Promise<{ violations: { id: string; help: string; nodes: { html: string; failureSummary?: string }[] }[]; passes: unknown[] }> } }).axe;
        const r = await axe.run("[data-lb-stage]", { resultTypes: ["violations", "passes"] });
        return { violations: r.violations.map((v) => ({ id: v.id, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => ({ html: n.html.slice(0, 200), why: n.failureSummary?.slice(0, 300) })) })), passes: r.passes.length };
      });
      writeFileSync(`${OUT}axe-${meta.slug}-${theme.name}.json`, JSON.stringify({ slug: meta.slug, theme: theme.name, passes: result.passes, violations: result.violations.map((v) => v.id), at: new Date().toISOString() }, null, 2));
      expect(result.violations, JSON.stringify(result.violations, null, 1)).toEqual([]);
    });
  }
}

/** States that a behaviour leaves behind (an open dialog or menu) are scanned too, in a light and a dark brand. */
for (const { meta, contract } of catalog) {
  for (const b of contract.behaviours.filter((x) => x.axe)) {
    for (const theme of [THEMES[0], THEMES[3]]) {
      test(`axe after ${meta.slug}/${b.id} in ${theme.name}`, async ({ page }) => {
        await open(page, meta.slug, theme.hash);
        await runSteps(page, b.steps ?? []);
        await page.addScriptTag({ path: axePath });
        // The open state may be in the top layer, outside the stage, so the whole page except the lab chrome is scanned.
        const result = await page.evaluate(async () => {
          const axe = (window as unknown as { axe: { run(ctx: object, opts: object): Promise<{ violations: { id: string; help: string; nodes: { html: string; failureSummary?: string }[] }[] }> } }).axe;
          const r = await axe.run({ include: [["[data-lb-stage]"], ["dialog[open]"], ["[popover]:popover-open"], ["[role=tooltip]"], ["[role=menu]"], ["[data-lb-toasts]"]] }, { resultTypes: ["violations"] });
          return r.violations.map((v) => ({ id: v.id, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => ({ html: n.html.slice(0, 200), why: n.failureSummary?.slice(0, 300) })) }));
        });
        writeFileSync(`${OUT}axe-${meta.slug}-${b.id}-${theme.name}.json`, JSON.stringify({ slug: meta.slug, behaviour: b.id, theme: theme.name, violations: result.map((v) => v.id), at: new Date().toISOString() }, null, 2));
        expect(result, JSON.stringify(result, null, 1)).toEqual([]);
      });
    }
  }
}
