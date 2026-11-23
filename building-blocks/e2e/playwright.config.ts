/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { defineConfig, devices } from "@playwright/test";

// End-to-end tests for the building blocks, with a real browser and a real keyboard. They need the Next dev server of the monorepo.
const port = Number(process.env.BLOCKS_E2E_PORT || 3112);

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  timeout: 60000,
  retries: 0,
  workers: 4,
  fullyParallel: true,
  reporter: [["list"]],
  outputDir: "./out/results",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "off",
    // axe-core is injected into the page; the dev CSP would block that, so the tests bypass it (the CSP itself is tested elsewhere).
    bypassCSP: true,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port ${port}`,
    cwd: "../../../..",
    url: `http://127.0.0.1:${port}/labs/blocks/button`,
    reuseExistingServer: true,
    timeout: 180000,
    env: { NEXT_TELEMETRY_DISABLED: "1" },
  },
});
