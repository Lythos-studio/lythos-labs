/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { IMPORT_LIMIT, detectMode, mapRoles, parseColor, parseImport } from "../src/import";

test("parseColor reads the supported syntaxes", () => {
  assert.equal(parseColor("#fff"), "#ffffff");
  assert.equal(parseColor("#123456ff"), "#123456");
  assert.equal(parseColor("rgb(36 73 223)"), "#2449df");
  assert.equal(parseColor("rgb(36, 73, 223)"), "#2449df");
  assert.equal(parseColor("hsl(0 100% 50%)"), "#ff0000");
  assert.ok(/^#[0-9a-f]{6}$/.test(parseColor("oklch(0.62 0.2 264)") ?? ""));
});

test("parseColor rejects what it cannot read exactly", () => {
  for (const bad of ["#12345680", "var(--x)", "calc(1px)", "red", "", "rgb(1 2)", "rgba(1,2,3,0.5)", "#12"])
    assert.equal(parseColor(bad), null, bad);
});

test("empty, too large, broken and colourless input become error values", () => {
  assert.deepEqual(parseImport("  "), { ok: false, error: "empty" });
  assert.deepEqual(parseImport("a".repeat(IMPORT_LIMIT + 1)), { ok: false, error: "too-large" });
  assert.deepEqual(parseImport("{"), { ok: false, error: "invalid-json" });
  assert.deepEqual(parseImport("body { margin: 0; }"), { ok: false, error: "no-colors" });
});

test("CSS custom properties are collected and unreadable values are listed as skipped", () => {
  const r = parseImport(":root { --bg: #fff; --text: #111; --x: var(--y); }");
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.colors.bg, "#ffffff");
    assert.equal(r.colors.text, "#111111");
    assert.deepEqual(r.skipped, ["x"]);
  }
});

test("the last definition of a name wins and is noted", () => {
  const r = parseImport(":root { --bg: #fff; } .a { --bg: #eee; }");
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.colors.bg, "#eeeeee");
    assert.ok(r.notes.includes("duplicate"));
  }
});

test("dark blocks are not collected and are noted", () => {
  const r = parseImport(":root { --bg: #fff; } .dark { --bg: #000; } @media (prefers-color-scheme: dark) { :root { --text: #fff; } }");
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.colors.bg, "#ffffff");
    assert.equal(r.colors.text, undefined);
    assert.ok(r.notes.includes("dark-block"));
  }
});

test("design token JSON is read with joined names", () => {
  const r = parseImport('{"color":{"primary":{"$type":"color","$value":"#2449df"}}}');
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.colors["color-primary"], "#2449df");
});

test("hostile input never throws", () => {
  for (const text of ["<script>alert(1)</script>", "\u0000\u0001".repeat(40_000), "{".repeat(50_000), "--x:;", "}}}{{{", '{"a":'.repeat(2000)]) {
    assert.doesNotThrow(() => parseImport(text));
  }
});

test("mapRoles matches names to roles", () => {
  assert.deepEqual(mapRoles({ "color-background": "#ffffff", primary: "#2449df", destructive: "#cc0000" }), {
    background: "#ffffff",
    primary: "#2449df",
    danger: "#cc0000",
  });
});

test("detectMode reads the background", () => {
  assert.equal(detectMode({ background: "#0b1022" }), "dark");
  assert.equal(detectMode({ background: "#ffffff" }), "light");
  assert.equal(detectMode({}), "light");
});
