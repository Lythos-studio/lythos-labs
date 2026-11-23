/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { catalog } from "../src/catalog";
import { parseRef } from "../src/harness/check";
import type { Behaviour, Ref } from "../src/harness/types";

const OUT = new URL("./out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const where = (page: Page, ref: Ref) => {
  const { sel, index } = parseRef(ref);
  return page.locator(`[data-lb-stage] ${sel}`).nth(index);
};

/** Drives a behaviour with the real keyboard and mouse, then asks the page's own expectation checker for the verdict. */
async function realRun(page: Page, b: Behaviour): Promise<string | null> {
  for (const step of b.steps ?? []) {
    if ("focus" in step) await where(page, step.focus).focus();
    else if ("key" in step) await page.keyboard.press(step.key === " " ? "Space" : step.key);
    else if ("click" in step) {
      // A disabled control is never "actionable" for Playwright; a forced click is still a real mouse click that the browser may ignore.
      const target = where(page, step.click);
      await target.click({ force: await target.isDisabled(), timeout: 5000 });
    }
    else if ("hover" in step) await where(page, step.hover).hover();
    else if ("type" in step) await page.keyboard.type(step.type);
    else await page.waitForTimeout(step.wait);
    await page.waitForTimeout(30);
  }
  const reasons = await page.evaluate((e) => window.__lb!.check!(e), b.expect ?? []);
  return reasons.find((r) => r) ?? null;
}

async function open(page: Page, slug: string, hash = "") {
  await page.goto(`/labs/blocks/${slug}${hash}`);
  await page.locator('[data-lb-stage][data-lb-ready="true"]').waitFor();
}

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

    test.afterAll(() => {
      writeFileSync(`${OUT}parity-${meta.slug}.json`, JSON.stringify({ slug: meta.slug, harness, real, at: new Date().toISOString() }, null, 2));
    });

    for (const b of contract.behaviours) {
      test(`${b.id}: ${b.title}`, async ({ page }) => {
        await open(page, meta.slug);
        const reason = await realRun(page, b);
        real[b.id] = reason ? "fail" : "pass";
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
