/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockEntry } from "../../catalog-types";

const demo = '[data-demo="sortable"]';
const handle = (i: number) => `${demo} button@${i}`;
const item = (i: number) => `${demo} li@${i}`;

export const entry: BlockEntry = {
  meta: {
    slug: "sortable-list",
    tier: "signature",
    title: { en: "Sortable list", nl: "Sorteerbare lijst" },
    summary: {
      en: "Reordering that works without a mouse: Space picks an item up, arrows move it, Space drops it, Escape puts it back, every step is announced. Dragging the handle does the same for pointers.",
      nl: "Herordenen dat zonder muis werkt: Spatie pakt een item op, pijlen verplaatsen het, Spatie laat het los, Escape zet het terug en elke stap wordt aangekondigd. Slepen aan de handgreep doet hetzelfde voor aanwijzers.",
    },
    native: {
      en: "Nothing native exists for this (the HTML drag and drop API has no keyboard or screen reader story). The honest alternative for short lists is two buttons, Move up and Move down. This block gives the keyboard flow the WAI-ARIA authoring guidance describes for reordering.",
      nl: "Hier bestaat niets native voor (de HTML-sleep-API heeft geen toetsenbord- of schermlezerverhaal). Het eerlijke alternatief voor korte lijsten is twee knoppen, Omhoog en Omlaag. Dit blok geeft de toetsenbordflow die de WAI-ARIA-richtlijnen voor herordenen beschrijven.",
    },
    limits: {
      en: "One flat list, one column. No dragging between lists and no nested lists. You own the state: onReorder gives you the new order, save it yourself. Test with a real screen reader before shipping: announcements are only checked here as text.",
      nl: "Een vlakke lijst, een kolom. Geen slepen tussen lijsten en geen geneste lijsten. Jij beheert de state: onReorder geeft de nieuwe volgorde, bewaar die zelf. Test met een echte schermlezer voor je live gaat: aankondigingen worden hier alleen als tekst gecontroleerd.",
    },
    files: ["blocks/sortable-list/sortable-list.tsx", "blocks/sortable-list/sortable-list.css"],
    needs: [],
    core: ["announcer"],
  },
  contract: {
    component: "sortable-list",
    pattern: "Keyboard reordering with a handle button and live announcements",
    behaviours: [
      { id: "structure", title: "A named list whose items each have a labelled handle button", kind: "static", axe: true, expect: [{ ref: `${demo} ul`, attr: { "aria-label": "Priorities" } }, { sel: `${demo} li`, count: 4 }, { ref: handle(0), attr: { "aria-label": "Reorder Design", "aria-pressed": "false" } }] },
      { id: "grab", title: "Space picks an item up and marks it", kind: "keyboard", steps: [{ focus: handle(1) }, { key: " " }], expect: [{ ref: handle(1), attr: { "aria-pressed": "true" } }, { ref: item(1), attr: { "data-lb-grabbed": "true" } }] },
      { id: "move-down", title: "Arrow down moves the picked-up item one place and keeps focus on its handle", kind: "keyboard", steps: [{ focus: handle(0) }, { key: " " }, { key: "ArrowDown" }, { wait: 60 }], expect: [{ ref: `${demo} .lb-sortable__content@1`, text: "Design" }, { ref: handle(1), focused: true }] },
      { id: "arrows-ignored", title: "Arrows do nothing until an item is picked up", kind: "keyboard", steps: [{ focus: handle(0) }, { key: "ArrowDown" }], expect: [{ ref: `${demo} .lb-sortable__content@0`, text: "Design" }] },
      { id: "drop", title: "Space again drops the item where it is", kind: "keyboard", steps: [{ focus: handle(0) }, { key: " " }, { key: "ArrowDown" }, { key: " " }, { wait: 40 }], expect: [{ ref: handle(1), attr: { "aria-pressed": "false" } }, { ref: `${demo} .lb-sortable__content@1`, text: "Design" }] },
      { id: "escape", title: "Escape puts the item back where it started", kind: "keyboard", steps: [{ focus: handle(0) }, { key: " " }, { key: "ArrowDown" }, { key: "ArrowDown" }, { key: "Escape" }, { wait: 60 }], expect: [{ ref: `${demo} .lb-sortable__content@0`, text: "Design" }, { ref: handle(0), attr: { "aria-pressed": "false" } }] },
      { id: "end-stops", title: "An item at the end cannot be moved past it", kind: "keyboard", steps: [{ focus: handle(3) }, { key: " " }, { key: "ArrowDown" }, { wait: 40 }], expect: [{ ref: `${demo} .lb-sortable__content@3`, text: "Launch" }] },
    ],
  },
};
