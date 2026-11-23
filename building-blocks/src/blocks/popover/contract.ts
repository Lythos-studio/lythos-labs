/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockEntry } from "../../catalog-types";

const trigger = ".lb-popover__trigger";
const panel = ".lb-popover";

export const entry: BlockEntry = {
  meta: {
    slug: "popover",
    tier: "core",
    title: { en: "Popover", nl: "Popover" },
    summary: {
      en: "A small panel next to a button, on the native popover attribute: click outside and Escape close it, the button reports aria-expanded, and focus moves in and comes back.",
      nl: "Een klein paneel naast een knop, op het native popover-attribuut: klikken buiten het paneel en Escape sluiten het, de knop meldt aria-expanded en de focus gaat naar binnen en komt terug.",
    },
    native: {
      en: "The popover attribute is native and does the layering and dismissal. For a list of actions use Menu; for a hint on hover or focus use Tooltip; for something that must be answered use Dialog.",
      nl: "Het popover-attribuut is native en regelt de laag en het sluiten. Gebruik Menu voor een lijst met acties, Tooltip voor een hint bij hover of focus en Dialog voor iets dat beantwoord moet worden.",
    },
    limits: {
      en: "Position is computed when it opens; it does not follow the button while the page scrolls. Keep popover content short.",
      nl: "De positie wordt berekend bij het openen en volgt de knop niet als de pagina scrolt. Houd de inhoud van een popover kort.",
    },
    files: ["blocks/popover/popover.tsx", "blocks/popover/popover.css"],
    needs: [],
    core: ["position"],
  },
  contract: {
    component: "popover",
    pattern: "Native popover attribute; APG: disclosure",
    behaviours: [
      { id: "closed-state", title: "The button reports collapsed and points at its panel; the panel is hidden", kind: "static", expect: [{ ref: trigger, attr: { "aria-expanded": "false", "aria-controls": "*", "aria-haspopup": "dialog" } }, { ref: panel, attr: { role: "dialog", "aria-label": "*" } }, { ref: panel, visible: false }] },
      { id: "click-opens", title: "Clicking the button opens the panel and reports expanded", kind: "pointer", axe: true, steps: [{ click: trigger }], expect: [{ ref: panel, visible: true }, { ref: trigger, attr: { "aria-expanded": "true" } }] },
      { id: "enter-opens", title: "Enter on the button opens the panel", kind: "keyboard", steps: [{ focus: trigger }, { key: "Enter" }], expect: [{ ref: panel, visible: true }] },
      { id: "focus-moves-in", title: "Focus moves to the first control inside the panel", kind: "pointer", steps: [{ click: trigger }], expect: [{ ref: `${panel} input`, focused: true }] },
      { id: "toggle-closes", title: "Pressing the button again closes the panel", kind: "pointer", steps: [{ click: trigger }, { click: trigger }], expect: [{ ref: panel, visible: false }, { ref: trigger, attr: { "aria-expanded": "false" } }] },
      { id: "escape-closes", title: "Escape closes the panel and focus returns to the button", kind: "native", note: "Escape and light dismiss are native popover behaviour; checked with the real keyboard.", steps: [{ click: trigger }, { key: "Escape" }], expect: [{ ref: panel, visible: false }, { ref: trigger, focused: true }] },
      { id: "outside-click-closes", title: "Clicking outside the panel closes it", kind: "native", note: "Light dismiss is native popover behaviour; checked with a real click.", steps: [{ click: trigger }, { click: "[data-demo=popover] p" }], expect: [{ ref: panel, visible: false }] },
    ],
  },
};
