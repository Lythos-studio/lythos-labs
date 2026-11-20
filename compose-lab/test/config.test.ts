/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeDisabled, encodeDisabled } from "../src/config";
import { parseCompose } from "../src/parse";
import { evaluate, RULES } from "../src/rules";

test("the rule choice round-trips through the address, in a stable order, and nothing else is in it", () => {
  assert.equal(encodeDisabled([]), "");
  const hash = encodeDisabled(["no-new-privileges", "db-port-public"]);
  assert.equal(hash, "off=db-port-public,no-new-privileges");
  assert.deepEqual(decodeDisabled(`#${hash}`), ["db-port-public", "no-new-privileges"]);
  assert.deepEqual(decodeDisabled(hash), ["db-port-public", "no-new-privileges"]);
});

test("unknown, repeated or hostile values in the address are ignored", () => {
  assert.deepEqual(decodeDisabled("#off=nope,db-port-public,db-port-public,%00,__proto__,constructor"), ["db-port-public"]);
  assert.deepEqual(decodeDisabled("#"), []);
  assert.deepEqual(decodeDisabled("#off="), []);
  assert.deepEqual(decodeDisabled("#x=1&off=privileged&y=2"), ["privileged"]);
  assert.deepEqual(decodeDisabled("%E0%A4%A"), []);
  assert.deepEqual(decodeDisabled("off=" + "a,".repeat(5000)), []);
});

test("evaluate leaves out the rules that are switched off and keeps the rest", () => {
  const r = parseCompose("services:\n  db:\n    image: postgres:16\n    ports: [\"5432:5432\"]\n");
  assert.ok(r.ok);
  const all = evaluate(r.compose);
  assert.ok(all.some((f) => f.id === "db-port-public"));
  const filtered = evaluate(r.compose, { disabled: ["db-port-public"] });
  assert.ok(!filtered.some((f) => f.id === "db-port-public"));
  assert.equal(filtered.length, all.length - all.filter((f) => f.id === "db-port-public").length);
  assert.ok(Object.keys(RULES).length >= 28);
});

test("the address never carries the compose file, only rule ids", () => {
  const hash = encodeDisabled(Object.keys(RULES) as (keyof typeof RULES)[]);
  assert.ok(/^off=[a-z,-]+$/.test(hash));
});
