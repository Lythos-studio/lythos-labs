/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { catalog } from "../src/catalog";

const src = (p: string) => new URL(`../src/${p}`, import.meta.url);
const read = (p: string) => readFileSync(src(p), "utf8");
const BAD = new RegExp(`${String.fromCodePoint(0x2014)}|[${String.fromCodePoint(0x1f300)}-${String.fromCodePoint(0x1faff)}${String.fromCodePoint(0x2600)}-${String.fromCodePoint(0x27bf)}]`, "u");
const HEADER = "This Source Code Form is subject to the terms of the Mozilla Public";

test("every block is described completely, in English and Dutch, and its files exist", () => {
  assert.ok(catalog.length >= 2);
  assert.equal(new Set(catalog.map((e) => e.meta.slug)).size, catalog.length, "slugs are unique");
  for (const { meta, contract } of catalog) {
    assert.equal(contract.component, meta.slug, meta.slug);
    for (const field of ["title", "summary", "native", "limits"] as const)
      for (const lang of ["en", "nl"] as const) assert.ok(meta[field][lang].trim().length > 3, `${meta.slug} ${field} ${lang}`);
    assert.ok(meta.files.length >= 2 && meta.files.some((f) => f.endsWith(".tsx")) && meta.files.some((f) => f.endsWith(".css")), meta.slug);
    for (const f of meta.files) assert.ok(existsSync(src(f)), `${meta.slug}: ${f} is missing`);
    for (const f of [`blocks/${meta.slug}/contract.ts`, `blocks/${meta.slug}/fixture.tsx`]) assert.ok(existsSync(src(f)), `${meta.slug}: ${f} is missing`);
  }
});

test("every contract is well formed: unique ids, steps for what is driven, expectations for what is checked", () => {
  for (const { meta, contract } of catalog) {
    const ids = contract.behaviours.map((b) => b.id);
    assert.equal(new Set(ids).size, ids.length, `${meta.slug}: behaviour ids are unique`);
    assert.ok(contract.behaviours.some((b) => b.kind === "static"), `${meta.slug}: has a static check`);
    assert.ok(contract.behaviours.length >= 6, `${meta.slug}: at least six behaviours`);
    assert.ok(contract.pattern.length > 3);
    for (const b of contract.behaviours) {
      assert.ok(b.title.trim().length > 8, `${meta.slug}/${b.id} title`);
      if (b.kind === "native") assert.ok(!b.steps && !b.expect && b.note, `${meta.slug}/${b.id}: native behaviours carry a note and nothing to simulate`);
      else {
        assert.ok((b.expect?.length ?? 0) > 0, `${meta.slug}/${b.id}: expects something`);
        if (b.kind === "keyboard" || b.kind === "pointer") assert.ok((b.steps?.length ?? 0) > 0, `${meta.slug}/${b.id}: has steps`);
      }
    }
  }
});

test("the declared dependencies are exactly what the source imports (so the starter kit is complete and minimal)", () => {
  for (const { meta } of catalog) {
    const code = meta.files.filter((f) => f.endsWith(".tsx")).map(read).join("\n");
    const core = [...code.matchAll(/from "\.\.\/\.\.\/core\/([a-z-]+)"/g)].map((m) => m[1]);
    const needs = [...code.matchAll(/from "\.\.\/([a-z-]+)\/[a-z-]+"/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(core)].sort(), [...meta.core].sort(), `${meta.slug}: core`);
    assert.deepEqual([...new Set(needs)].sort(), [...meta.needs].sort(), `${meta.slug}: needs`);
    assert.ok(!/from "\.\.\/\.\.\/(lab|theme|harness)/.test(code), `${meta.slug}: blocks never import lab code`);
    assert.ok(!/from "(?!react|\.)/.test(code), `${meta.slug}: no packages besides react`);
  }
});

test("every source file has the licence header and no em dash or emoji, and copy in the data has none either", () => {
  for (const { meta } of catalog) {
    for (const f of [...meta.files, `blocks/${meta.slug}/contract.ts`, `blocks/${meta.slug}/fixture.tsx`]) {
      const text = read(f);
      assert.ok(text.includes(HEADER), `${f}: header`);
      assert.ok(!BAD.test(text), `${f}: em dash or emoji`);
    }
  }
});
