/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { a11yTree, accessibleName, roleOf, tabOrder, type A11yNode } from "../src/harness/a11y";

const t = (text: string): A11yNode => ({ tag: "#text", attrs: {}, text, children: [] });
const n = (tag: string, attrs: Record<string, string> = {}, ...children: (A11yNode | string)[]): A11yNode => ({
  tag,
  attrs,
  children: children.map((c) => (typeof c === "string" ? t(c) : c)),
});

test("implicit roles come from the element, explicit roles win, a link needs an href", () => {
  assert.equal(roleOf(n("button")), "button");
  assert.equal(roleOf(n("a", { href: "/x" })), "link");
  assert.equal(roleOf(n("a")), null);
  assert.equal(roleOf(n("input", { type: "checkbox" })), "checkbox");
  assert.equal(roleOf(n("input", { type: "range" })), "slider");
  assert.equal(roleOf(n("input")), "textbox");
  assert.equal(roleOf(n("input", { type: "hidden" })), null);
  assert.equal(roleOf(n("h2")), "heading");
  assert.equal(roleOf(n("img", { alt: "" })), "presentation");
  assert.equal(roleOf(n("img", { alt: "Logo" })), "img");
  assert.equal(roleOf(n("select")), "combobox");
  assert.equal(roleOf(n("select", { multiple: "" })), "listbox");
  assert.equal(roleOf(n("section")), null);
  assert.equal(roleOf(n("section", { "aria-label": "News" })), "region");
  assert.equal(roleOf(n("div", { role: "tablist" })), "tablist");
  assert.equal(roleOf(n("button", { role: "tab" })), "tab");
  assert.equal(roleOf(n("div", { role: "presentation none" })), "presentation");
});

test("the accessible name follows labelledby, then aria-label, then the native label, then the content", () => {
  const label = n("span", { id: "l" }, "From labelledby");
  const byId = new Map<string, A11yNode>([["l", label]]);
  const name = (node: A11yNode) => accessibleName(node, (id) => byId.get(id));
  assert.equal(name(n("button", { "aria-labelledby": "l", "aria-label": "Nope" }, "Text")), "From labelledby");
  assert.equal(name(n("button", { "aria-label": "Close" }, "x")), "Close");
  assert.equal(name({ ...n("input", { type: "text" }), labelText: "Email" }), "Email");
  assert.equal(name(n("img", { alt: "A cat" })), "A cat");
  assert.equal(name(n("button", {}, "  Save ", n("span", { "aria-hidden": "true" }, "icon"), " now ")), "Save now");
  assert.equal(name(n("input", { type: "submit" })), "Submit");
  assert.equal(name(n("input", { type: "button", value: "Go" })), "Go");
  assert.equal(name(n("div", {}, "plain text")), "", "a div does not take its name from content");
  assert.equal(name(n("div", { title: "Tip" })), "Tip");
  assert.equal(name(n("button", { "aria-labelledby": "missing" }, "Fallback")), "Fallback");
  assert.equal(name({ ...n("button", {}, "Hidden text"), children: [{ ...t("secret"), hidden: true }, t("shown")] }), "shown");
});

test("tab order: positive tabindex first, then DOM order; hidden, disabled and tabindex -1 are skipped", () => {
  const tree = n("div", {},
    n("button", { id: "a" }, "A"),
    n("button", { id: "b", disabled: "" }, "B"),
    n("a", { id: "c", href: "#" }, "C"),
    n("div", { id: "d", tabindex: "0" }, "D"),
    n("button", { id: "e", tabindex: "-1" }, "E"),
    n("button", { id: "f", tabindex: "2" }, "F"),
    n("button", { id: "g", tabindex: "1" }, "G"),
    { ...n("button", { id: "h" }, "H"), hidden: true },
    n("div", { id: "i" }, "I"),
    n("input", { id: "j", type: "hidden" }),
  );
  assert.deepEqual(tabOrder([tree]).map((x) => x.attrs.id), ["g", "f", "a", "c", "d"]);
});

test("a radio group has a single tab stop: the checked one, or the first", () => {
  const radios = (checked: number | null) =>
    n("div", {}, ...[0, 1, 2].map((i) => ({ ...n("input", { type: "radio", name: "g", id: "r" + i }), checked: checked === i })));
  assert.deepEqual(tabOrder([radios(null)]).map((x) => x.attrs.id), ["r0"]);
  assert.deepEqual(tabOrder([radios(2)]).map((x) => x.attrs.id), ["r2"]);
});

test("the accessibility tree lists roles, names and states, and leaves out hidden branches", () => {
  const tree = n("main", {},
    n("h1", {}, "Title"),
    n("button", { "aria-expanded": "false", "aria-controls": "p" }, "Menu"),
    { ...n("div", { role: "dialog", "aria-label": "Secret" }), hidden: true },
    n("ul", {}, n("li", {}, "One")),
  );
  const rows = a11yTree([tree], () => undefined);
  assert.deepEqual(rows.map((r) => [r.depth, r.role, r.name]), [
    [0, "main", ""],
    [1, "heading", "Title"],
    [1, "button", "Menu"],
    [1, "list", ""],
    [2, "listitem", "One"],
  ]);
  assert.deepEqual(rows[1].state, ["level 1"]);
  assert.deepEqual(rows[2].state, ["collapsed"]);
});
