/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockMeta } from "../../catalog-types";

/** Relative imports of a source file as paths from src, without an extension. Used to follow what a block needs. */
export function importsOf(path: string, text: string): string[] {
  const dir = path.split("/").slice(0, -1);
  return [...text.matchAll(/from "(\.\.?\/[^"]+)"/g)].map((m) => {
    const parts = [...dir];
    for (const seg of m[1].split("/")) {
      if (seg === ".") continue;
      if (seg === "..") parts.pop();
      else parts.push(seg);
    }
    return parts.join("/");
  });
}

export type KitFile = { path: string; content: string };

/**
 * The files a set of blocks needs: their own files, the blocks they import, and the core files those use, found by following
 * imports in the source text. Nothing that was not chosen or needed is included.
 */
export function resolveClosure(slugs: string[], metas: BlockMeta[], sources: Record<string, string>): KitFile[] {
  const bySlug = new Map(metas.map((m) => [m.slug, m]));
  const wanted = new Set<string>();
  const addBlock = (slug: string) => {
    const meta = bySlug.get(slug);
    if (!meta) throw new Error(`unknown block: ${slug}`);
    if (wanted.has(`block:${slug}`)) return;
    wanted.add(`block:${slug}`);
    meta.needs.forEach(addBlock);
  };
  slugs.forEach(addBlock);

  const files = new Set<string>();
  const walk = (file: string) => {
    if (files.has(file)) return;
    if (!(file in sources)) throw new Error(`missing source: ${file}`);
    files.add(file);
    if (!/\.(ts|tsx)$/.test(file)) return;
    for (const imp of importsOf(file, sources[file])) {
      const resolved = [".ts", ".tsx", ".css"].map((e) => imp + e).find((p) => p in sources);
      if (resolved && (resolved.startsWith("core/") || resolved.startsWith("blocks/"))) walk(resolved);
    }
  };
  for (const key of wanted) for (const f of bySlug.get(key.slice(6))!.files) walk(f);
  return [...files].sort().map((path) => ({ path, content: sources[path] }));
}
