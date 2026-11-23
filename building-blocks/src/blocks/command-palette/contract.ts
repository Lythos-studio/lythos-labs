/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockEntry } from "../../catalog-types";

const open = "dialog[open]";
const option = (i: number) => `${open} [role=option]@${i}`;

export const entry: BlockEntry = {
  meta: {
    slug: "command-palette",
    tier: "advanced",
    title: { en: "Command palette", nl: "Commandopalet" },
    summary: {
      en: "A searchable list of actions in a native modal dialog, opened with a button or Ctrl or Cmd plus K: focus stays in the search field, arrows move through the results, Enter runs the command.",
      nl: "Een doorzoekbare lijst met acties in een native modale dialoog, geopend met een knop of Ctrl of Cmd plus K: de focus blijft in het zoekveld, pijlen lopen door de resultaten en Enter voert de opdracht uit.",
    },
    native: {
      en: "There is no native command palette. It is a combobox in a dialog: the dialog gives the focus trap and Escape, the combobox pattern gives the keyboard behaviour. Always offer a visible button too, since shortcuts are not discoverable.",
      nl: "Er is geen native commandopalet. Het is een combobox in een dialoog: de dialoog geeft de focusvanger en Escape, het comboboxpatroon geeft het toetsenbordgedrag. Bied altijd ook een zichtbare knop aan, want sneltoetsen zijn niet vindbaar.",
    },
    limits: {
      en: "The list is filtered here from the commands you give; for a server-side search build on Combobox instead. Commands run immediately, so keep destructive ones out or ask for confirmation.",
      nl: "De lijst wordt hier gefilterd uit de opdrachten die je meegeeft; bouw voor zoeken op een server liever op Combobox. Opdrachten worden direct uitgevoerd, dus laat destructieve opdrachten weg of vraag om bevestiging.",
    },
    files: ["blocks/command-palette/command-palette.tsx", "blocks/command-palette/command-palette.css"],
    needs: [],
    core: ["announcer", "roving", "use"],
  },
  contract: {
    component: "command-palette",
    pattern: "APG: combobox inside a modal dialog",
    behaviours: [
      { id: "closed", title: "The palette is closed until asked for", kind: "static", expect: [{ sel: open, count: 0 }, { ref: "dialog", attr: { role: "dialog", "aria-label": "*" } }] },
      { id: "button-opens", title: "The button opens the palette with the search field focused", kind: "pointer", axe: true, steps: [{ click: "#open-palette" }], expect: [{ sel: open, count: 1 }, { ref: `${open} [role=combobox]`, focused: true }] },
      { id: "listbox-roles", title: "Results are a listbox of options, grouped, and the first is active", kind: "pointer", steps: [{ click: "#open-palette" }], expect: [{ ref: `${open} [role=listbox]`, attr: { "aria-label": "*" } }, { sel: `${open} [role=option]`, count: 5 }, { sel: `${open} [role=group]`, count: 2 }, { ref: option(0), attr: { "aria-selected": "true" } }] },
      { id: "typing-filters", title: "Typing filters the commands", kind: "keyboard", steps: [{ click: "#open-palette" }, { type: "inv" }], expect: [{ sel: `${open} [role=option]`, count: 1 }, { ref: option(0), text: "New invoice" }] },
      { id: "empty", title: "No match shows a message", kind: "keyboard", steps: [{ click: "#open-palette" }, { type: "zzz" }], expect: [{ ref: `${open} [role=status]`, text: "No matching commands" }, { sel: `${open} [role=option]`, count: 0 }] },
      { id: "arrow-moves", title: "Arrow down moves the active result and focus stays in the field", kind: "keyboard", steps: [{ click: "#open-palette" }, { key: "ArrowDown" }], expect: [{ ref: option(1), attr: { "aria-selected": "true" } }, { ref: `${open} [role=combobox]`, focused: true }] },
      { id: "enter-runs", title: "Enter runs the active command and closes the palette", kind: "keyboard", steps: [{ click: "#open-palette" }, { key: "ArrowDown" }, { key: "Enter" }], expect: [{ ref: "#cmd-result", text: "New invoice" }, { sel: open, count: 0 }] },
      { id: "click-runs", title: "Clicking a result runs it", kind: "pointer", steps: [{ click: "#open-palette" }, { click: option(2) }], expect: [{ ref: "#cmd-result", text: "Open settings" }, { sel: open, count: 0 }] },
      { id: "shortcut", title: "Ctrl+K opens the palette and Escape closes it, returning focus", kind: "native", note: "A real key combination and the dialog's Escape are checked with the real keyboard.", steps: [{ focus: "#open-palette" }, { key: "Control+k" }, { key: "Escape" }], expect: [{ sel: open, count: 0 }, { ref: "#open-palette", focused: true }] },
    ],
  },
};
