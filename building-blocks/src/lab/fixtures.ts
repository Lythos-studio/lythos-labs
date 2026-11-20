/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { FixtureModule } from "./types";

/** Fixtures are loaded on demand, so the overview does not pay for every block. Each import path is a literal so the bundler can split it. */
export const fixtures: Record<string, () => Promise<FixtureModule>> = {
  button: () => import("../blocks/button/fixture"),
  tabs: () => import("../blocks/tabs/fixture"),
};
