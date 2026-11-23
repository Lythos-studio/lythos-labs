/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockMeta } from "../../catalog-types";
import { themeVars, varsToCss, type ThemeState } from "../../theme/theme-vars";
import { buildZip, type ZipFile } from "./zip";
import { resolveClosure } from "./resolve";

const BASE_CSS_NOTE = "/* Defaults for every --lb-* variable live in tokens.css. Import this file once, then use the blocks. */";

/** Everything the starter kit contains, as files: the chosen blocks and what they need, your brand as tokens.css, a styles.css that pulls it together, an index and a README. */
export function buildKitFiles(slugs: string[], metas: BlockMeta[], sources: Record<string, string>, theme: ThemeState, baseCss: string): ZipFile[] {
  const blocks = resolveClosure(slugs, metas, sources);
  const tsx = blocks.filter((f) => f.path.startsWith("blocks/") && f.path.endsWith(".tsx")).map((f) => f.path);
  const css = blocks.filter((f) => f.path.endsWith(".css")).map((f) => f.path);
  const light = varsToCss(themeVars(theme.settings, "light"), ".lb-root");
  const dark = varsToCss(themeVars(theme.settings, "dark"), '.lb-root[data-lb-mode="dark"]');
  const files: ZipFile[] = [
    ...blocks,
    { path: "base.css", content: baseCss },
    { path: "tokens.css", content: `/* Your brand (Merklab), as variables for the blocks. Light is the default; set data-lb-mode="dark" on .lb-root for dark. */\n${light}\n${dark}` },
    { path: "styles.css", content: `${BASE_CSS_NOTE}\n@import "./base.css";\n@import "./tokens.css";\n${css.map((p) => `@import "./${p}";`).join("\n")}\n` },
    { path: "index.ts", content: `${tsx.map((p) => `export * from "./${p.replace(/\.tsx$/, "")}";`).join("\n")}\n` },
    {
      path: "README.md",
      content: `# Lythos building blocks (starter kit)

Blocks: ${slugs.join(", ")}

1. Copy this folder into your project.
2. Import \`styles.css\` once (for example in your root layout) and put \`className="lb-root"\` on an element around the blocks.
3. Import components from \`./index\`, for example \`import { Button } from "./index"\`.

Your brand is in \`tokens.css\`. Change the variables, or generate new ones at https://labs.lythos.nl/blocks.

Requires React 19. There are no other dependencies. The files use plain CSS (no CSS modules, no CSS-in-JS).

Licence: Mozilla Public License 2.0 (see the header of each file). The Lythos name and logo are not covered by this licence.
`,
    },
  ];
  return files;
}

export const kitZip = (files: ZipFile[], modified?: Date) => buildZip(files, modified);
