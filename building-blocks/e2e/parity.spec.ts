/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { open, realRun } from "./helpers";
import { catalog } from "../src/catalog";
import type { Behaviour } from "../src/harness/types";

const OUT = fileURLToPath(new URL("./out/", import.meta.url));
mkdirSync(OUT, { recursive: true });

for (const { meta, contract } of catalog) {
  test.describe(`${meta.slug}`, () => {
    let harness: Record<string, string> = {};
    const real: Record<string, string> = {};

    test.beforeAll(async ({ browser }) => {
      const page = await browser.newPage();
      await open(page, meta.slug);
      await page.locator("[data-lb-verify]").click();
      await page.locator("[data-lb-summary]").filter({ hasText: /checks passed/ }).waitFor({ timeout: 30000 });
      harness = Object.fromEntries(
        await page.locator("[data-lb-behaviour]").evaluateAll((els) => els.map((el) => [el.getAttribute("data-lb-behaviour"), el.getAttribute("data-lb-result")])),
      );
      await page.close();
    });

    for (const b of contract.behaviours) {
      test(`${b.id}: ${b.title}`, async ({ page }) => {
        await open(page, meta.slug);
        const reason = await realRun(page, b);
        real[b.id] = reason ? "fail" : "pass";
        // One file per behaviour: workers run in parallel and must not overwrite each other.
        writeFileSync(`${OUT}parity-${meta.slug}--${b.id}.json`, JSON.stringify({ slug: meta.slug, id: b.id, real: real[b.id], harness: harness[b.id], at: new Date().toISOString() }));
        expect(reason, `with the real keyboard: ${reason}`).toBeNull();
        if (b.kind === "native") expect(harness[b.id], "native behaviours are skipped in the page").toBe("skipped");
        else expect(harness[b.id], "the in-page check must agree with the real keyboard").toBe("pass");
      });
    }
  });
}

test.describe("the checks can fail", () => {
  test("a wrong expectation fails with the real keyboard and in the page", async ({ page }) => {
    const wrong: Behaviour = {
      id: "wrong",
      title: "Arrow right lands on the disabled tab (it must not)",
      kind: "keyboard",
      steps: [{ focus: '[data-demo="auto"] [role=tab]@1' }, { key: "ArrowRight" }],
      expect: [{ ref: '[data-demo="auto"] [role=tab]@2', focused: true }],
    };
    await open(page, "tabs");
    expect(await realRun(page, wrong)).not.toBeNull();
    const [result] = await page.evaluate((b) => window.__lb!.run!("tabs", [b]), wrong);
    expect(result.status).toBe("fail");
  });
});
