/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockEntry } from "../../catalog-types";

const demo = '[data-demo="tree"]';
const items = `${demo} [role=treeitem]`;
const node = (i: number) => `${items}@${i}`;

export const entry: BlockEntry = {
  meta: {
    slug: "tree-view",
    tier: "signature",
    title: { en: "Tree view", nl: "Boomstructuur" },
    summary: {
      en: "The WAI-ARIA tree with one tab stop: arrows move and open and close branches, Left and Right go to the parent or first child, typing jumps to a name, and level, position and size are exposed.",
      nl: "De WAI-ARIA-boom met een tabstop: pijlen bewegen en openen en sluiten takken, Links en Rechts gaan naar de ouder of het eerste kind, typen springt naar een naam en niveau, positie en grootte zijn beschikbaar.",
    },
    native: {
      en: "<details> inside nested lists is a good native answer for a simple disclosure outline with Tab navigation. Use a tree when you want it to behave like a file explorer with a single tab stop and arrow keys, and accept that you own the details.",
      nl: "<details> in geneste lijsten is een goed native antwoord voor een eenvoudige uitklapstructuur met Tab-navigatie. Gebruik een boom als het zich als een bestandsverkenner moet gedragen met een tabstop en pijltjestoetsen, en neem de details dan zelf op je.",
    },
    limits: {
      en: "Single selection only. Children are given up front: there is no lazy loading and no drag and drop. Rendering is not virtualised, so keep trees to a few hundred visible rows.",
      nl: "Alleen enkele selectie. Kinderen worden vooraf meegegeven: geen lazy loading en geen slepen. Er is geen virtualisatie, dus houd bomen op enkele honderden zichtbare rijen.",
    },
    files: ["blocks/tree-view/tree-view.tsx", "blocks/tree-view/tree-view.css"],
    needs: [],
    core: ["typeahead", "use"],
  },
  contract: {
    component: "tree-view",
    pattern: "APG: tree view",
    behaviours: [
      { id: "roles", title: "A named tree of treeitems with level, position, size and expanded state", kind: "static", axe: true, expect: [{ ref: `${demo} [role=tree]`, attr: { "aria-label": "Files" } }, { sel: items, count: 5 }, { ref: node(0), attr: { "aria-level": "1", "aria-posinset": "1", "aria-setsize": "3", "aria-expanded": "true" } }, { ref: node(1), attr: { "aria-level": "2" } }] },
      { id: "one-tab-stop", title: "Exactly one item is in the tab order", kind: "static", expect: [{ sel: `${items}[tabindex="0"]`, count: 1 }] },
      { id: "arrow-down", title: "Arrow down moves to the next visible item", kind: "keyboard", steps: [{ focus: node(0) }, { key: "ArrowDown" }, { wait: 40 }], expect: [{ ref: node(1), focused: true }] },
      { id: "right-opens", title: "Arrow right opens a closed branch", kind: "keyboard", steps: [{ focus: node(3) }, { key: "ArrowRight" }, { wait: 40 }], expect: [{ ref: node(3), attr: { "aria-expanded": "true" } }, { sel: items, count: 6 }] },
      { id: "left-closes", title: "Arrow left closes an open branch", kind: "keyboard", steps: [{ focus: node(0) }, { key: "ArrowLeft" }, { wait: 40 }], expect: [{ ref: node(0), attr: { "aria-expanded": "false" } }, { sel: items, count: 3 }] },
      { id: "left-to-parent", title: "Arrow left on a child goes to its parent", kind: "keyboard", steps: [{ focus: node(1) }, { key: "ArrowLeft" }, { wait: 40 }], expect: [{ ref: node(0), focused: true }] },
      { id: "end", title: "End goes to the last visible item", kind: "keyboard", steps: [{ focus: node(0) }, { key: "End" }, { wait: 40 }], expect: [{ ref: `${items}@4`, focused: true }] },
      { id: "typeahead", title: "Typing a letter jumps to the item that starts with it", kind: "keyboard", steps: [{ focus: node(0) }, { type: "r" }, { wait: 40 }], expect: [{ ref: `${demo} [role=treeitem][data-id=readme]`, focused: true }] },
      { id: "enter-selects", title: "Enter selects the focused item", kind: "keyboard", steps: [{ focus: node(1) }, { key: "Enter" }], expect: [{ ref: node(1), attr: { "aria-selected": "true" } }, { ref: "#tree-result", text: "src-index" }] },
    ],
  },
};
