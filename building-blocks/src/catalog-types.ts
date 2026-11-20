/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { Contract } from "./harness/types";

export type Localized = { en: string; nl: string };
export type Tier = "core" | "advanced" | "signature";

/** Everything about a block that is plain data: no React, so Node tests, the generators and the end-to-end tests can read it. */
export type BlockMeta = {
  slug: string;
  tier: Tier;
  title: Localized;
  summary: Localized;
  /** When the platform already does this, say so: honest advice is part of the value. */
  native: Localized;
  limits: Localized;
  /** Files of the block, relative to src, that make up the copy-paste unit (component and CSS). */
  files: string[];
  /** Other blocks this one imports. */
  needs: string[];
  /** Core modules (src/core/<name>.ts) this block imports. */
  core: string[];
};

export type BlockEntry = { meta: BlockMeta; contract: Contract };
