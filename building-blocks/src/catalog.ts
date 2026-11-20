/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockEntry } from "./catalog-types";
import { entry as button } from "./blocks/button/contract";
import { entry as tabs } from "./blocks/tabs/contract";

/** Every block, as plain data (no React): used by the lab, the generators, the Node tests and the end-to-end tests. */
export const catalog: BlockEntry[] = [button, tabs];

export const bySlug = (slug: string): BlockEntry | undefined => catalog.find((e) => e.meta.slug === slug);
