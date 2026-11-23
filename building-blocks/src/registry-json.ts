/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { catalog } from "./catalog";
import { sources } from "./generated/sources";
import { resolveClosure } from "./lab/kit/resolve";

/**
 * A machine-readable list of every block: what it is, what it needs and its source files. For tools and agents that
 * want to copy a block into a project. It is a plain description, not a package manager.
 */
export function buildRegistry(site: string) {
  return {
    name: "lythos-building-blocks",
    license: "MPL-2.0",
    note: "Copy the files into your project. Blocks depend on React only, plus the core files and other blocks listed. The theme is a set of --lb-* CSS variables with defaults in base.css.",
    site,
    blocks: catalog.map(({ meta }) => ({
      name: meta.slug,
      tier: meta.tier,
      title: meta.title.en,
      description: meta.summary.en,
      native: meta.native.en,
      limits: meta.limits.en,
      dependencies: ["react"],
      blockDependencies: meta.needs,
      page: `${site}/blocks/${meta.slug}`,
      files: resolveClosure([meta.slug], catalog.map((e) => e.meta), sources),
    })),
  };
}

export function buildLlmsTxt(site: string) {
  const lines = [
    "# Lythos Building blocks",
    "",
    "> Accessible React components with a verifiable contract: every block lists the keyboard and screen reader behaviour it promises, and each promise is checked in a real browser. MPL-2.0. React is the only dependency.",
    "",
    `Machine-readable registry with source files: ${site}/blocks/registry.json`,
    "",
    "## Blocks",
    ...catalog.map(({ meta }) => `- [${meta.title.en}](${site}/blocks/${meta.slug}): ${meta.summary.en}`),
    "",
    "## Notes",
    "- Prefer the native HTML element when it does the job; each block page says when.",
    "- Each block page states its limits. Read them before using a block in production.",
    "- Test with a real screen reader before shipping: the checks here do not replace that.",
  ];
  return `${lines.join("\n")}\n`;
}
