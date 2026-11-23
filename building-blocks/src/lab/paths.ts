/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { LabLocale } from "./copy";

/** Page paths on the Labs host, per language. Slugs are the same in both languages. */
export const blocksPaths = {
  overview: { en: "/blocks", nl: "/nl/bouwstenen" },
  block: (slug: string) => ({ en: `/blocks/${slug}`, nl: `/nl/bouwstenen/${slug}` }),
};

export const blockHref = (locale: LabLocale, slug: string) => blocksPaths.block(slug)[locale];

export const kitPath = { en: "/blocks/kit", nl: "/nl/bouwstenen/kit" };
export const recipesPath = { en: "/blocks/recipes", nl: "/nl/bouwstenen/recepten" };
export const principlesPath = { en: "/blocks/principles", nl: "/nl/bouwstenen/principes" };
