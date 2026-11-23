/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockEntry } from "../../catalog-types";

const demo = '[data-demo="inline"]';
const editBtn = `${demo} .lb-inline__edit`;
const input = `${demo} input`;

export const entry: BlockEntry = {
  meta: {
    slug: "inline-edit",
    tier: "signature",
    title: { en: "Inline edit", nl: "Ter plekke bewerken" },
    summary: {
      en: "Text you change in place: plain text with an Edit button, then a real input with Save and Cancel. Enter saves, Escape cancels, validation keeps the field open, and focus always goes somewhere sensible.",
      nl: "Tekst die je ter plekke wijzigt: gewone tekst met een Bewerk-knop, daarna een echt invoerveld met Opslaan en Annuleren. Enter slaat op, Escape annuleert, validatie houdt het veld open en de focus gaat altijd naar een logische plek.",
    },
    native: {
      en: "contenteditable is tempting and nearly always worse: no label, no validation, odd paste behaviour. A button that swaps text for a real input is simple and robust. For forms, a normal always-visible input is usually better than inline edit.",
      nl: "contenteditable is verleidelijk en bijna altijd slechter: geen label, geen validatie, vreemd plakgedrag. Een knop die tekst verwisselt voor een echt invoerveld is eenvoudig en robuust. In formulieren is een gewoon zichtbaar invoerveld meestal beter dan ter plekke bewerken.",
    },
    limits: {
      en: "Single-line text only. It does not save to a server: onValueChange fires on Save and you handle failures, for example by reverting the value you pass in and showing a message.",
      nl: "Alleen tekst op een regel. Het slaat niets op een server op: onValueChange wordt aangeroepen bij Opslaan en jij handelt fouten af, bijvoorbeeld door de waarde die je meegeeft terug te zetten en een melding te tonen.",
    },
    files: ["blocks/inline-edit/inline-edit.tsx", "blocks/inline-edit/inline-edit.css"],
    needs: [],
    core: ["announcer", "use"],
  },
  contract: {
    component: "inline-edit",
    pattern: "Text with an Edit button that swaps to a real input",
    behaviours: [
      { id: "reading", title: "Reading mode shows the value as text with a named Edit button", kind: "static", axe: true, expect: [{ ref: `${demo} .lb-inline__value`, text: "Launch plan" }, { ref: editBtn, text: "Edit Project title" }, { sel: input, count: 0 }] },
      { id: "edit-opens", title: "Edit swaps in a labelled input with focus and the text selected", kind: "keyboard", steps: [{ focus: editBtn }, { key: "Enter" }, { wait: 40 }], expect: [{ ref: input, focused: true }, { ref: input, value: "Launch plan" }, { ref: `${demo} label`, text: "Project title" }] },
      { id: "enter-saves", title: "Enter saves, returns to reading mode and puts focus back on Edit", kind: "keyboard", steps: [{ focus: editBtn }, { key: "Enter" }, { wait: 40 }, { type: "X" }, { key: "Enter" }, { wait: 40 }], expect: [{ ref: `${demo} .lb-inline__value`, text: "X" }, { ref: editBtn, focused: true }] },
      { id: "escape-cancels", title: "Escape discards the change and returns focus to Edit", kind: "keyboard", steps: [{ focus: editBtn }, { key: "Enter" }, { wait: 40 }, { type: "Zzz" }, { key: "Escape" }, { wait: 40 }], expect: [{ ref: `${demo} .lb-inline__value`, text: "Launch plan" }, { ref: editBtn, focused: true }] },
      { id: "cancel-button", title: "The Cancel button discards the change like Escape does", kind: "pointer", steps: [{ click: editBtn }, { type: "Q" }, { click: `${demo} .lb-inline__btn@1` }, { wait: 40 }], expect: [{ ref: `${demo} .lb-inline__value`, text: "Launch plan" }, { sel: input, count: 0 }] },
      { id: "validation", title: "A refused value keeps the field open, with the error tied to the input", kind: "keyboard", steps: [{ focus: editBtn }, { key: "Enter" }, { wait: 40 }, { type: "!" }, { key: "Enter" }, { wait: 40 }], expect: [{ ref: input, attr: { "aria-invalid": "true", "aria-describedby": "*" } }, { ref: `${demo} [data-lb-error]`, text: "cannot contain" }, { sel: input, count: 1 }] },
    ],
  },
};
