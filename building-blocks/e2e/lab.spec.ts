/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, test, type Page } from "@playwright/test";
import { crc32 } from "node:zlib";
import { open } from "./helpers";

const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js");

function zipEntries(bytes: Buffer): { name: string; content: string; crcOk: boolean }[] {
  const eocd = bytes.length - 22;
  expect(bytes.readUInt32LE(eocd)).toBe(0x06054b50);
  const count = bytes.readUInt16LE(eocd + 10);
  let pos = bytes.readUInt32LE(eocd + 16);
  const out = [];
  for (let i = 0; i < count; i++) {
    const crc = bytes.readUInt32LE(pos + 16);
    const size = bytes.readUInt32LE(pos + 24);
    const nameLen = bytes.readUInt16LE(pos + 28);
    const local = bytes.readUInt32LE(pos + 42);
    const name = bytes.subarray(pos + 46, pos + 46 + nameLen).toString("utf8");
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    const data = bytes.subarray(start, start + size);
    out.push({ name, content: data.toString("utf8"), crcOk: crc32(data) === crc });
    pos += 46 + nameLen;
  }
  return out;
}

async function axeScan(page: Page, scope: string) {
  await page.addScriptTag({ path: axePath });
  return page.evaluate(async (ctx) => {
    const axe = (window as unknown as { axe: { run(c: string, o: object): Promise<{ violations: { id: string; nodes: { html: string; failureSummary?: string }[] }[] }> } }).axe;
    const r = await axe.run(ctx, { resultTypes: ["violations"] });
    return r.violations.map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 3).map((n) => ({ html: n.html.slice(0, 160), why: n.failureSummary?.slice(0, 240) })) }));
  }, scope);
}

test.describe("the lab around the blocks", () => {
  test("changing the brand re-themes the blocks, lands in the address, and links to Merklab", async ({ page }) => {
    await page.goto("/labs/blocks");
    await page.locator("#lb-hex").waitFor();
    const primary = () => page.locator("[data-lb-stage], .lb-root").first().evaluate((el) => getComputedStyle(el).getPropertyValue("--lb-primary").trim());
    const before = await primary();
    await page.locator("#lb-hex").fill("#e4572e");
    await expect.poll(primary).not.toBe(before);
    expect(page.url()).toContain("c=e4572e");
    const merklab = await page.getByRole("link", { name: "Open in Brand lab" }).getAttribute("href");
    expect(merklab).toContain("c=e4572e");
    await page.locator("select").filter({ hasText: "Light" }).selectOption("dark");
    expect(page.url()).toContain("m=dark");
  });

  test("a link with a theme restores it, and hostile values fall back safely", async ({ page }) => {
    await page.goto("/labs/blocks#c=111827&r=round&t=editorial&m=dark");
    await expect(page.locator("#lb-hex")).toHaveValue("#111827");
    await page.goto("/labs/blocks#c=12;}body{x:y&r=url(javascript:1)&t=<script>&m=dark");
    await expect(page.locator("#lb-hex")).toHaveValue("#2449df");
    expect(await page.evaluate(() => document.querySelectorAll("script:not([src])").length >= 0)).toBe(true);
  });

  test("the focus lens numbers the tab order in the order Tab visits", async ({ page }) => {
    await open(page, "button");
    await page.locator('[data-lb-toggle="focus-order"]').check();
    const badges = page.locator('[data-lb-lens="focus-order"] span span');
    await expect(badges.first()).toHaveText("1");
    const count = await badges.count();
    // The fixture has 9 buttons; the disabled one is skipped, so there are 8 tab stops.
    expect(count).toBe(8);
    await page.locator('[data-lb-toggle="focus-order"]').uncheck();
    await expect(page.locator('[data-lb-lens="focus-order"]')).toHaveCount(0);
  });

  test("the accessibility tree lists roles and names, and announcements show up when a toast is shown", async ({ page }) => {
    await open(page, "toast");
    await page.locator('[data-lb-toggle="tree"]').check();
    const tree = page.locator('[data-lb-lens="tree"]');
    await expect(tree).toContainText("button");
    await expect(tree).toContainText("Save");
    await page.locator('[data-lb-toggle="announcements"]').check();
    await page.locator("#t-success").click();
    await expect(page.locator('[data-lb-lens="announcements"]')).toContainText("Saved");
  });

  test("the stress lab changes size, direction, motion, text length and width of the example only", async ({ page }) => {
    await open(page, "button");
    await page.locator("summary", { hasText: "Stress lab" }).click();
    await page.locator('[data-lb-stress="textScale"]').selectOption("2");
    await expect.poll(() => page.locator("[data-lb-stage]").evaluate((el) => getComputedStyle(el).getPropertyValue("--lb-text-base").trim())).toBe("2rem");
    await page.locator('[data-lb-stress="dir"]').selectOption("rtl");
    await expect(page.locator("[data-lb-stage]")).toHaveAttribute("dir", "rtl");
    await page.locator('[data-lb-stress="motion"]').selectOption("off");
    await expect(page.locator("[data-lb-stage]")).toHaveAttribute("data-lb-motion", "off");
    await page.locator('[data-lb-stress="length"]').selectOption("long");
    await expect(page.locator("[data-lb-stage]")).toContainText("afhandelingsovereenkomst");
    await page.locator('[data-lb-stress="width"]').selectOption("320");
    expect((await page.locator("[data-lb-stage]").boundingBox())!.width).toBeLessThanOrEqual(321);
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page.locator("[data-lb-stage]")).not.toContainText("afhandelingsovereenkomst");
    await expect(page.locator("[data-lb-stage]")).toHaveAttribute("dir", "ltr");
  });

  test("the code view shows the real source and copies it", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await open(page, "tabs");
    await expect(page.locator("[data-lb-code]")).toContainText("export function Tabs");
    await page.getByRole("button", { name: "tabs.css" }).click();
    await expect(page.locator("[data-lb-code]")).toContainText(".lb-tabs");
    await page.getByRole("button", { name: "Copy with what it needs" }).click();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain("/* blocks/tabs/tabs.tsx */");
    expect(text).toContain("/* core/roving.ts */");
    expect(text).not.toContain("blocks/dialog");
  });

  test("the evidence panel shows measured facts and says what is not done", async ({ page }) => {
    await open(page, "dialog");
    const panel = page.locator("section", { has: page.getByRole("heading", { name: "Evidence" }) });
    await expect(panel).toContainText("bytes (gzip");
    await expect(panel).toContainText("axe-core");
    await expect(panel).toContainText("0 violations");
    await expect(panel).toContainText("Not yet");
  });

  test("the playground changes the block and its code together", async ({ page }) => {
    await open(page, "button");
    const pg = page.locator("section", { has: page.getByRole("heading", { name: "Playground" }) });
    await pg.getByLabel("Variant").selectOption("danger");
    await pg.getByLabel("Label").fill("Remove");
    await expect(pg.locator("pre")).toContainText('variant="danger"');
    await expect(pg.locator("pre")).toContainText("Remove");
    await expect(pg.locator("button.lb-button")).toHaveText("Remove");
  });

  test("the starter kit: pick a block, see what comes with it, download a valid zip with your brand", async ({ page }) => {
    await page.goto("/labs/blocks/kit#c=e4572e&r=sharp&t=technical");
    await page.getByLabel("Dialog, confirm and drawer").check();
    await expect(page.locator("[data-lb-kit-files]")).toContainText("blocks/button/button.tsx");
    await expect(page.getByText("Also needed, added automatically: button")).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("[data-lb-kit-download]").click()]);
    expect(download.suggestedFilename()).toBe("lythos-blocks.zip");
    const entries = zipEntries(readFileSync((await download.path())!));
    const names = entries.map((e) => e.name);
    expect(names).toEqual(expect.arrayContaining(["blocks/dialog/dialog.tsx", "blocks/button/button.css", "tokens.css", "styles.css", "index.ts", "README.md", "base.css"]));
    expect(entries.every((e) => e.crcOk)).toBe(true);
    expect(names.some((n) => n.includes(".."))).toBe(false);
    const tokens = entries.find((e) => e.name === "tokens.css")!.content;
    expect(tokens).toMatch(/--lb-radius: 2px/);
    expect(tokens).toContain('.lb-root[data-lb-mode="dark"]');
  });

  test("the Dutch pages are Dutch", async ({ page }) => {
    await page.goto("/labs/nl/bouwstenen/tabs");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tabs");
    await expect(page.getByRole("heading", { name: "Controleer in je browser" })).toBeVisible();
    await page.goto("/labs/nl/bouwstenen");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bouwstenen");
  });

  for (const path of ["/labs/blocks", "/labs/blocks/dialog", "/labs/blocks/kit", "/labs/blocks/principles", "/labs/nl/bouwstenen/menu"]) {
    test(`no horizontal scroll at 320px on ${path}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: 320, height: 800 } });
      const page = await ctx.newPage();
      await page.goto(path);
      await page.locator("main").waitFor();
      await page.waitForTimeout(500);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await ctx.close();
    });
  }

  for (const [name, path] of [["overview", "/labs/blocks"], ["kit", "/labs/blocks/kit"], ["a block page", "/labs/blocks/accordion"]] as const) {
    test(`axe finds nothing in the main content of the ${name}`, async ({ page }) => {
      await page.goto(path);
      await page.locator("main").waitFor();
      await page.waitForTimeout(800);
      const violations = await axeScan(page, "main");
      expect(violations, JSON.stringify(violations, null, 1)).toEqual([]);
    });
  }
});
