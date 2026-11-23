/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockEntry } from "../../catalog-types";

const button = ".lb-menu__button";
const item = (i: number) => `[role=menuitem]@${i}`;

export const entry: BlockEntry = {
  meta: {
    slug: "menu",
    tier: "core",
    title: { en: "Menu", nl: "Menu" },
    summary: {
      en: "The WAI-ARIA menu button: arrow keys, Home and End, type-to-find, disabled items skipped, Escape closes and returns focus, a click outside closes.",
      nl: "De WAI-ARIA-menuknop: pijltjestoetsen, Home en End, typen om te zoeken, uitgeschakelde items overgeslagen, Escape sluit en geeft de focus terug, een klik buiten sluit.",
    },
    native: {
      en: "There is no native menu element. For site navigation, a plain list of links is better than a menu role. A menu is for actions on something (rename, delete), like in an application.",
      nl: "Er is geen native menu-element. Voor sitenavigatie is een gewone lijst met links beter dan een menurol. Een menu is voor handelingen op iets (hernoemen, verwijderen), zoals in een applicatie.",
    },
    limits: {
      en: "No submenus yet. Items are buttons; a menu item that navigates should be a link styled as an item.",
      nl: "Nog geen submenu's. Items zijn knoppen; een menu-item dat navigeert zou een als item opgemaakte link moeten zijn.",
    },
    files: ["blocks/menu/menu.tsx", "blocks/menu/menu.css"],
    needs: [],
    core: ["roving", "typeahead"],
  },
  contract: {
    component: "menu",
    pattern: "APG: menu button",
    behaviours: [
      { id: "closed-state", title: "The button has a menu popup, reports collapsed, and no menu exists until opened", kind: "static", expect: [{ ref: button, attr: { "aria-haspopup": "menu", "aria-expanded": "false" } }, { sel: "[role=menu]", count: 0 }] },
      { id: "click-opens", title: "A click opens the menu, reports expanded and focuses the first item", kind: "pointer", axe: true, steps: [{ click: button }], expect: [{ sel: "[role=menu]", count: 1 }, { ref: button, attr: { "aria-expanded": "true" } }, { ref: item(0), focused: true }, { ref: "[role=menu]", attr: { "aria-labelledby": "*" } }] },
      { id: "arrow-down-opens", title: "Arrow down on the button opens the menu on the first item", kind: "keyboard", steps: [{ focus: button }, { key: "ArrowDown" }], expect: [{ sel: "[role=menu]", count: 1 }, { ref: item(0), focused: true }] },
      { id: "arrow-up-opens-last", title: "Arrow up on the button opens the menu on the last item", kind: "keyboard", steps: [{ focus: button }, { key: "ArrowUp" }], expect: [{ ref: item(3), focused: true }] },
      { id: "arrow-moves", title: "Arrow down moves to the next item", kind: "keyboard", steps: [{ click: button }, { key: "ArrowDown" }], expect: [{ ref: item(1), focused: true }] },
      { id: "skips-disabled", title: "Arrows skip a disabled item", kind: "keyboard", steps: [{ click: button }, { key: "ArrowDown" }, { key: "ArrowDown" }], expect: [{ ref: item(3), focused: true }] },
      { id: "wraps", title: "Arrow up on the first item wraps to the last", kind: "keyboard", steps: [{ click: button }, { key: "ArrowUp" }], expect: [{ ref: item(3), focused: true }] },
      { id: "home-end", title: "End jumps to the last item and Home to the first", kind: "keyboard", steps: [{ click: button }, { key: "End" }, { key: "Home" }], expect: [{ ref: item(0), focused: true }] },
      { id: "typeahead", title: "Typing letters finds the item that starts with them", kind: "keyboard", steps: [{ click: button }, { type: "de" }], expect: [{ ref: item(3), focused: true }] },
      { id: "escape-closes", title: "Escape closes the menu and returns focus to the button", kind: "keyboard", steps: [{ click: button }, { key: "Escape" }], expect: [{ sel: "[role=menu]", count: 0 }, { ref: button, focused: true }] },
      { id: "enter-chooses", title: "Enter chooses the item, runs it, closes the menu and returns focus to the button", kind: "keyboard", steps: [{ click: button }, { key: "ArrowDown" }, { key: "Enter" }], expect: [{ ref: "#menu-result", text: "Duplicate" }, { sel: "[role=menu]", count: 0 }, { ref: button, focused: true }] },
      { id: "click-item", title: "Clicking an item chooses it", kind: "pointer", steps: [{ click: button }, { click: item(0) }], expect: [{ ref: "#menu-result", text: "Rename" }, { sel: "[role=menu]", count: 0 }] },
      { id: "outside-click-closes", title: "A click outside closes the menu", kind: "native", note: "Closing on a pointer press outside is checked with a real mouse press.", steps: [{ click: button }, { click: "[data-demo=menu] p" }], expect: [{ sel: "[role=menu]", count: 0 }] },
      { id: "tab-closes", title: "Tab closes the menu and moves on", kind: "native", note: "Tab order is browser behaviour; checked with the real keyboard.", steps: [{ click: button }, { key: "Tab" }], expect: [{ sel: "[role=menu]", count: 0 }] },
    ],
  },
};
