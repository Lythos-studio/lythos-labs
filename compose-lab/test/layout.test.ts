/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCompose } from "../src/parse";
import { CARD, layout } from "../src/layout";
import { EXAMPLES } from "../src/examples";
import type { Compose } from "../src/model";

const load = (yaml: string): Compose => {
  const r = parseCompose(yaml);
  assert.ok(r.ok);
  return r.compose;
};
const at = (l: ReturnType<typeof layout>, name: string) => l.nodes.find((n) => n.name === name)!;

test("dependents sit left of what they depend on, and the outside world is at the far left", () => {
  const l = layout(load(`
services:
  proxy: { image: traefik:v3, ports: ["80:80"], depends_on: [app] }
  app: { image: app:1, depends_on: [db, cache] }
  db: { image: postgres:16 }
  cache: { image: redis:7 }
`));
  assert.ok(l.internet);
  assert.ok(l.internet!.x < at(l, "proxy").x);
  assert.ok(at(l, "proxy").x < at(l, "app").x);
  assert.ok(at(l, "app").x < at(l, "db").x);
  assert.equal(at(l, "db").x, at(l, "cache").x);
  assert.notEqual(at(l, "db").y, at(l, "cache").y);
});

test("the layout is deterministic and does not depend on the order in the file", () => {
  const a = layout(load("services:\n  b: { image: x }\n  a: { image: y, depends_on: [b] }\n  c: { image: z }\n"));
  const b = layout(load("services:\n  c: { image: z }\n  a: { image: y, depends_on: [b] }\n  b: { image: x }\n"));
  const sorted = (l: typeof a) => [...l.nodes].sort((p, q) => p.name.localeCompare(q.name));
  assert.deepEqual(sorted(a), sorted(b));
  assert.deepEqual(layout(load("services:\n  c: { image: z }\n")), layout(load("services:\n  c: { image: z }\n")));
});

test("no two cards overlap and every card is inside the canvas, for the examples and for a wide stack", () => {
  const stacks = [...EXAMPLES.map((e) => e.yaml), "services:\n" + Array.from({ length: 60 }, (_, i) => `  s${i}: { image: x, depends_on: [${i ? `s${Math.floor(i / 3)}` : ""}] }\n`).join("")];
  for (const yaml of stacks) {
    const l = layout(load(yaml));
    for (const n of l.nodes) {
      assert.ok(n.x >= 0 && n.y >= 0 && n.x + CARD.w <= l.width && n.y + CARD.h <= l.height, n.name);
      for (const m of l.nodes)
        if (m !== n) assert.ok(n.x + CARD.w <= m.x || m.x + CARD.w <= n.x || n.y + CARD.h <= m.y || m.y + CARD.h <= n.y, `${n.name} overlaps ${m.name}`);
    }
  }
});

test("a cycle, a self-reference and a missing dependency still give a valid layout", () => {
  const l = layout(load("services:\n  a: { image: x, depends_on: [b] }\n  b: { image: y, depends_on: [a, ghost] }\n  c: { image: z, depends_on: [c] }\n"));
  assert.equal(l.nodes.length, 3);
  assert.equal(new Set(l.nodes.map((n) => `${n.x},${n.y}`)).size, 3);
});

test("no published ports means no outside world, and a single service fits", () => {
  const l = layout(load("services:\n  a: { image: x }\n"));
  assert.equal(l.internet, null);
  assert.deepEqual(l.nodes, [{ name: "a", x: CARD.pad, y: CARD.pad }]);
  assert.equal(l.width, CARD.pad * 2 + CARD.w);
});

test("a long dependency chain stays quick", () => {
  const started = Date.now();
  const chain = "services:\n" + Array.from({ length: 200 }, (_, i) => `  s${String(i).padStart(3, "0")}: { image: x${i < 199 ? `, depends_on: [s${String(i + 1).padStart(3, "0")}]` : ""} }\n`).join("");
  assert.equal(layout(load(chain)).nodes.length, 200);
  assert.ok(Date.now() - started < 500, `${Date.now() - started} ms`);
});
