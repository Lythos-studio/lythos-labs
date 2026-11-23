/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { catalog } from "../src/catalog";

export const SRC = new URL("../src/", import.meta.url);
export const read = (path: string) => readFileSync(new URL(path, SRC), "utf8");

export { importsOf } from "../src/lab/kit/resolve";
import { importsOf } from "../src/lab/kit/resolve";

const EXT = [".ts", ".tsx", ".css"];
export const resolveFile = (base: string): string | null => EXT.map((e) => base + e).find((p) => existsSync(new URL(p, SRC))) ?? null;

/** Every file a set of block files needs, following imports inside src/core and src/blocks. */
export function closureFiles(files: string[]): string[] {
  const seen = new Set<string>();
  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    if (!/\.(ts|tsx)$/.test(file)) return;
    for (const imp of importsOf(file, read(file))) {
      const resolved = resolveFile(imp);
      if (resolved && (resolved.startsWith("core/") || resolved.startsWith("blocks/"))) walk(resolved);
    }
  };
  files.forEach(walk);
  return [...seen].sort();
}

/** The files that make up the copy-paste unit of every block, plus the core files they use. */
export function allCopyFiles(): string[] {
  return closureFiles(catalog.flatMap((e) => e.meta.files));
}

export function buildSources(): Record<string, string> {
  return Object.fromEntries(allCopyFiles().map((f) => [f, read(f)]));
}

export function buildSizes(): Record<string, { tsx: number; css: number; gzip: number }> {
  return Object.fromEntries(
    catalog.map(({ meta }) => {
      const files = closureFiles(meta.files).filter((f) => f.startsWith(`blocks/${meta.slug}/`));
      const size = (re: RegExp) => files.filter((f) => re.test(f)).reduce((n, f) => n + Buffer.byteLength(read(f)), 0);
      const all = files.map(read).join("\n");
      return [meta.slug, { tsx: size(/\.tsx?$/), css: size(/\.css$/), gzip: gzipSync(all).length }];
    }),
  );
}

/** Changes whenever a block, its contract or its fixture changes: the evidence must be regenerated after that. */
export function sourceHash(slug: string): string {
  const h = createHash("sha1");
  const files = [...catalog.find((e) => e.meta.slug === slug)!.meta.files, `blocks/${slug}/contract.ts`, `blocks/${slug}/fixture.tsx`];
  for (const f of closureFiles(files).sort()) h.update(f).update(read(f));
  return h.digest("hex").slice(0, 16);
}

export const listJson = (dir: URL) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")) : []);
