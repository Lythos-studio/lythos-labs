/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { crc32 as nodeCrc32 } from "node:zlib";
import { catalog } from "../src/catalog";
import { sources } from "../src/generated/sources";
import { buildKitFiles } from "../src/lab/kit/build";
import { resolveClosure } from "../src/lab/kit/resolve";
import { assertSafePath, buildZip, crc32 } from "../src/lab/kit/zip";
import { DEFAULT_THEME } from "../src/theme/theme-vars";
import { readFileSync } from "node:fs";

const metas = catalog.map((e) => e.meta);
const paths = (slugs: string[]) => resolveClosure(slugs, metas, sources).map((f) => f.path);

test("the closure of a block is the block, the blocks it needs and the core files they import, and nothing else", () => {
  const dialog = paths(["dialog"]);
  assert.ok(dialog.includes("blocks/dialog/dialog.tsx") && dialog.includes("blocks/dialog/dialog.css"));
  assert.ok(dialog.includes("blocks/button/button.tsx"), "a needed block comes along");
  assert.ok(!dialog.some((p) => p.startsWith("blocks/tabs/")), "an unrelated block does not");
  const toast = paths(["toast"]);
  assert.ok(toast.includes("core/announcer.ts") && toast.includes("core/announce-queue.ts"), "core files are followed through their own imports");
  assert.ok(!toast.includes("core/roving.ts"));
  assert.deepEqual(paths(["button"]), ["blocks/button/button.css", "blocks/button/button.tsx"]);
  assert.deepEqual(paths(["dialog", "button"]), paths(["button", "dialog"]), "order does not matter");
  assert.throws(() => paths(["nope"]), /unknown block/);
});

test("crc32 matches Node's", () => {
  for (const text of ["", "a", "The quick brown fox", "d\u00e9j\u00e0 vu"]) {
    const bytes = new TextEncoder().encode(text);
    assert.equal(crc32(bytes), nodeCrc32(bytes));
  }
});

test("the archive is a valid ZIP: signatures, entry count, names, sizes and checksums all agree", () => {
  const files = [{ path: "a/b.txt", content: "hello" }, { path: "c.css", content: "x{}" }, { path: "empty.txt", content: "" }];
  const zip = buildZip(files, new Date("2026-01-02T03:04:06Z"));
  const view = new DataView(zip.buffer);
  const eocd = zip.length - 22;
  assert.equal(view.getUint32(eocd, true), 0x06054b50);
  assert.equal(view.getUint16(eocd + 10, true), 3);
  let pos = view.getUint32(eocd + 16, true);
  for (const f of files) {
    assert.equal(view.getUint32(pos, true), 0x02014b50);
    const crc = view.getUint32(pos + 16, true);
    const size = view.getUint32(pos + 24, true);
    const nameLen = view.getUint16(pos + 28, true);
    const local = view.getUint32(pos + 42, true);
    const name = new TextDecoder().decode(zip.slice(pos + 46, pos + 46 + nameLen));
    assert.equal(name, f.path);
    assert.equal(size, new TextEncoder().encode(f.content).length);
    assert.equal(crc, nodeCrc32(new TextEncoder().encode(f.content)));
    assert.equal(view.getUint32(local, true), 0x04034b50);
    const dataStart = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    assert.equal(new TextDecoder().decode(zip.slice(dataStart, dataStart + size)), f.content);
    pos += 46 + nameLen;
  }
});

test("unsafe, absolute, duplicate and odd paths are refused", () => {
  for (const bad of ["../x", "/etc/passwd", "a/../b", "a\\b", "a//b", "", ".hidden/..", "x\u0000y", "a b", "C:/x", "a/./b", "x".repeat(201)]) assert.throws(() => assertSafePath(bad), /unsafe path/, bad);
  for (const ok of ["a.txt", "blocks/button/button.tsx", "core/use.ts", "README.md"]) assert.doesNotThrow(() => assertSafePath(ok), ok);
  assert.throws(() => buildZip([{ path: "a", content: "1" }, { path: "a", content: "2" }]), /duplicate/);
  assert.throws(() => buildZip([{ path: "../evil", content: "1" }]), /unsafe/);
});

test("a kit of every block compiles on its own with strict TypeScript (React is its only dependency)", { timeout: 120000 }, () => {
  const dir = new URL("../.tmp-kit/", import.meta.url);
  rmSync(dir, { recursive: true, force: true });
  const base = readFileSync(new URL("../src/styles/base.css", import.meta.url), "utf8");
  const files = buildKitFiles(catalog.map((e) => e.meta.slug), metas, sources, DEFAULT_THEME, base);
  for (const f of files) {
    const url = new URL(f.path, dir);
    mkdirSync(new URL("./", url), { recursive: true });
    writeFileSync(url, f.content);
  }
  writeFileSync(new URL("tsconfig.json", dir), JSON.stringify({ compilerOptions: { target: "ES2022", lib: ["DOM", "DOM.Iterable", "ES2022"], module: "ESNext", moduleResolution: "Bundler", jsx: "react-jsx", strict: true, noEmit: true, skipLibCheck: true, types: [] }, include: ["**/*.ts", "**/*.tsx"] }));
  const require = createRequire(import.meta.url);
  const tsc = resolve(dirname(require.resolve("typescript/package.json")), require("typescript/package.json").bin.tsc);
  const result = spawnSync(process.execPath, [tsc, "-p", "."], { cwd: dir, encoding: "utf8" });
  rmSync(dir, { recursive: true, force: true });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok(files.some((f) => f.path === "tokens.css" && f.content.includes("--lb-primary")));
  assert.ok(files.some((f) => f.path === "styles.css" && f.content.includes("@import")));
  assert.ok(!files.some((f) => /lab\/|theme\/|harness\//.test(f.path)), "no lab code in a kit");
});
