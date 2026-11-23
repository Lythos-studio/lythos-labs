/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { Page } from "@playwright/test";
import { parseRef } from "../src/harness/check";
import type { Behaviour, Ref, Step } from "../src/harness/types";

export const where = (page: Page, ref: Ref) => {
  const { sel, index } = parseRef(ref);
  return page.locator(`[data-lb-stage] ${sel}`).nth(index);
};

/** Drives steps with the real keyboard and mouse. */
export async function runSteps(page: Page, steps: Step[]) {
  for (const step of steps) {
    if ("focus" in step) await where(page, step.focus).focus();
    else if ("key" in step) await page.keyboard.press(step.key === " " ? "Space" : step.key);
    else if ("click" in step) {
      // A disabled control is never "actionable" for Playwright; a forced click is still a real mouse click that the browser may ignore.
      const target = where(page, step.click);
      await target.click({ force: await target.isDisabled(), timeout: 5000 });
    } else if ("hover" in step) await where(page, step.hover).hover();
    else if ("upload" in step) await where(page, step.upload).setInputFiles(step.files.map((f) => ({ name: f.name, mimeType: f.type, buffer: Buffer.alloc(f.size) })));
    else if ("type" in step) await page.keyboard.type(step.type);
    else await page.waitForTimeout(step.wait);
    await page.waitForTimeout(30);
  }
}

/** Real input, then the page's own expectation checker decides. Returns the failure reason or null. */
export async function realRun(page: Page, b: Behaviour): Promise<string | null> {
  await runSteps(page, b.steps ?? []);
  const reasons = await page.evaluate((e) => window.__lb!.check!(e), b.expect ?? []);
  return reasons.find((r) => r) ?? null;
}

export async function open(page: Page, slug: string, hash = "") {
  await page.goto(`/labs/blocks/${slug}${hash}`);
  await page.locator('[data-lb-stage][data-lb-ready="true"]').waitFor();
}
