/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockEntry } from "../../catalog-types";

const auto = '[data-demo="auto"]';
const manual = '[data-demo="manual"]';
const vertical = '[data-demo="vertical"]';
const tab = (scope: string, i: number) => `${scope} [role=tab]@${i}`;

export const entry: BlockEntry = {
  meta: {
    slug: "tabs",
    tier: "core",
    title: { en: "Tabs", nl: "Tabs" },
    summary: {
      en: "The WAI-ARIA tabs pattern: one tab stop, arrow keys, Home and End, disabled tabs skipped, automatic or manual activation, horizontal or vertical, right-to-left aware.",
      nl: "Het WAI-ARIA-patroon voor tabs: één tab-stop, pijltjestoetsen, Home en End, uitgeschakelde tabs overgeslagen, automatische of handmatige activatie, horizontaal of verticaal, en bewust van rechts-naar-links.",
    },
    native: {
      en: "There is no native tabs element. If the content is a long page with sections, plain headings and anchor links are often better than tabs.",
      nl: "Er is geen native tabs-element. Is de inhoud een lange pagina met secties, dan zijn gewone koppen en ankerlinks vaak beter dan tabs.",
    },
    limits: {
      en: "All panels stay in the DOM (hidden), so heavy panels should load their own content lazily.",
      nl: "Alle panelen blijven in de DOM (verborgen), dus zware panelen moeten hun eigen inhoud lui laden.",
    },
    files: ["blocks/tabs/tabs.tsx", "blocks/tabs/tabs.css"],
    needs: [],
    core: ["roving", "use"],
  },
  contract: {
    component: "tabs",
    pattern: "APG: tabs",
    behaviours: [
      { id: "roles", title: "A tablist with named tabs, each linked to a tabpanel that points back at its tab", kind: "static", expect: [
        { ref: `${auto} [role=tablist]`, attr: { "aria-label": "*" } },
        { sel: `${auto} [role=tab]`, count: 4 },
        { ref: tab(auto, 0), attr: { "aria-selected": "true", "aria-controls": "*" } },
        { ref: `${auto} [role=tabpanel]@0`, attr: { "aria-labelledby": "*" } },
        { sel: `${auto} [role=tabpanel]:not([hidden])`, count: 1 },
      ] },
      { id: "roving", title: "Only the selected tab is in the tab order (roving tabindex)", kind: "static", expect: [{ ref: tab(auto, 0), attr: { tabindex: "0" } }, { ref: tab(auto, 1), attr: { tabindex: "-1" } }] },
      { id: "arrow-right-auto", title: "Arrow right moves focus to the next tab and selects it", kind: "keyboard", steps: [{ focus: tab(auto, 0) }, { key: "ArrowRight" }], expect: [{ ref: tab(auto, 1), focused: true }, { ref: tab(auto, 1), attr: { "aria-selected": "true" } }, { ref: `${auto} [role=tabpanel]:not([hidden])`, text: "Details content" }] },
      { id: "skips-disabled", title: "Arrows skip a disabled tab", kind: "keyboard", steps: [{ focus: tab(auto, 1) }, { key: "ArrowRight" }], expect: [{ ref: tab(auto, 3), focused: true }] },
      { id: "wraps", title: "Arrow left on the first tab wraps to the last", kind: "keyboard", steps: [{ focus: tab(auto, 0) }, { key: "ArrowLeft" }], expect: [{ ref: tab(auto, 3), focused: true }] },
      { id: "home-end", title: "Home jumps to the first tab and End to the last", kind: "keyboard", steps: [{ focus: tab(auto, 1) }, { key: "End" }], expect: [{ ref: tab(auto, 3), focused: true }] },
      { id: "home", title: "Home jumps to the first tab", kind: "keyboard", steps: [{ focus: tab(auto, 3) }, { key: "Home" }], expect: [{ ref: tab(auto, 0), focused: true }] },
      { id: "manual-moves-focus-only", title: "With manual activation, arrows move focus but do not select", kind: "keyboard", steps: [{ focus: tab(manual, 0) }, { key: "ArrowRight" }], expect: [{ ref: tab(manual, 1), focused: true }, { ref: tab(manual, 1), attr: { "aria-selected": "false" } }, { ref: tab(manual, 0), attr: { "aria-selected": "true" } }] },
      { id: "manual-enter-selects", title: "With manual activation, Enter selects the focused tab", kind: "keyboard", steps: [{ focus: tab(manual, 0) }, { key: "ArrowRight" }, { key: "Enter" }], expect: [{ ref: tab(manual, 1), attr: { "aria-selected": "true" } }] },
      { id: "click-selects", title: "Clicking a tab selects it and shows its panel", kind: "pointer", steps: [{ click: tab(auto, 3) }], expect: [{ ref: tab(auto, 3), attr: { "aria-selected": "true" } }, { ref: `${auto} [role=tabpanel]:not([hidden])`, text: "Settings content" }] },
      { id: "vertical-arrows", title: "A vertical tab list moves with up and down, and ignores left and right", kind: "keyboard", steps: [{ focus: tab(vertical, 0) }, { key: "ArrowRight" }, { key: "ArrowDown" }], expect: [{ ref: tab(vertical, 1), focused: true }] },
      { id: "panel-tab-stop", title: "Tab moves from the selected tab into its panel", kind: "native", note: "Tab order is browser behaviour; checked with the real keyboard.", steps: [{ focus: tab(auto, 0) }, { key: "Tab" }], expect: [{ ref: `${auto} [role=tabpanel]:not([hidden])`, focused: true }] },
    ],
  },
};
