/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockEntry } from "../../catalog-types";

const demo = '[data-demo="combobox"]';
const input = "#cb-input";
const option = (i: number) => `${demo} [role=option]@${i}`;

export const entry: BlockEntry = {
  meta: {
    slug: "combobox",
    tier: "advanced",
    title: { en: "Combobox", nl: "Combobox" },
    summary: {
      en: "Type to filter a list of options, with focus staying in the input: arrows move through the options, Enter chooses, Escape closes, results are announced, and loading and empty states are real states.",
      nl: "Typ om een lijst met opties te filteren terwijl de focus in het invoerveld blijft: pijlen lopen door de opties, Enter kiest, Escape sluit, resultaten worden aangekondigd en laden en leeg zijn echte staten.",
    },
    native: {
      en: "A native <select> is better for a short list of fixed options. Use a combobox when the list is long, when people know what to type, or when the options come from a server.",
      nl: "Een native <select> is beter voor een korte lijst met vaste opties. Gebruik een combobox als de lijst lang is, als mensen weten wat ze moeten typen of als de opties van een server komen.",
    },
    limits: {
      en: "It chooses from the list only (no free text). For server-side search pass onInputChange and update options as results arrive; cancel stale requests yourself.",
      nl: "Het kiest alleen uit de lijst (geen vrije tekst). Geef voor zoeken op een server onInputChange mee en werk de opties bij als resultaten binnenkomen; annuleer verouderde verzoeken zelf.",
    },
    files: ["blocks/combobox/combobox.tsx", "blocks/combobox/combobox.css"],
    needs: [],
    core: ["announcer", "roving", "use"],
  },
  contract: {
    component: "combobox",
    pattern: "APG: combobox with listbox popup (list autocomplete)",
    behaviours: [
      { id: "closed-roles", title: "A labelled combobox that announces list autocomplete and is collapsed", kind: "static", expect: [{ ref: `label[for="cb-input"]`, text: "City" }, { ref: input, attr: { role: "combobox", "aria-autocomplete": "list", "aria-expanded": "false" } }, { sel: `${demo} [role=listbox]`, count: 0 }] },
      { id: "typing-filters", title: "Typing opens the list and filters it, ignoring case and accents", kind: "keyboard", axe: true, steps: [{ focus: input }, { type: "BE" }], expect: [{ ref: input, attr: { "aria-expanded": "true", "aria-controls": "*" } }, { sel: `${demo} [role=option]`, count: 2 }, { ref: option(0), text: "Bergen" }] },
      { id: "no-results", title: "When nothing matches there is a status message, not an empty list", kind: "keyboard", steps: [{ focus: input }, { type: "zz" }], expect: [{ ref: `${demo} [role=status]`, text: "No cities found" }, { sel: `${demo} [role=listbox]`, count: 0 }] },
      { id: "arrow-opens", title: "Arrow down opens the list and makes the first option active, without moving focus", kind: "keyboard", steps: [{ focus: input }, { key: "ArrowDown" }], expect: [{ ref: input, attr: { "aria-expanded": "true", "aria-activedescendant": "*" } }, { ref: input, focused: true }, { ref: option(0), attr: { "data-lb-active": "true" } }] },
      { id: "arrow-moves", title: "Arrow down moves the active option", kind: "keyboard", steps: [{ focus: input }, { key: "ArrowDown" }, { key: "ArrowDown" }], expect: [{ ref: option(1), attr: { "data-lb-active": "true" } }, { ref: option(0), attr: { "data-lb-active": null } }] },
      { id: "enter-chooses", title: "Enter chooses the active option, closes the list and fills the field", kind: "keyboard", steps: [{ focus: input }, { type: "br" }, { key: "ArrowDown" }, { key: "Enter" }], expect: [{ ref: input, value: "Brussels" }, { sel: `${demo} [role=listbox]`, count: 0 }, { ref: "#cb-result", text: "brussels" }] },
      { id: "skips-disabled", title: "A disabled option cannot be chosen and is skipped by the arrows", kind: "keyboard", steps: [{ focus: input }, { type: "co" }, { key: "ArrowDown" }, { key: "Enter" }], expect: [{ ref: input, value: "Copenhagen" }] },
      { id: "escape-closes", title: "Escape closes the list and keeps what was typed", kind: "keyboard", steps: [{ focus: input }, { type: "b" }, { key: "Escape" }], expect: [{ sel: `${demo} [role=listbox]`, count: 0 }, { ref: input, value: "b" }] },
      { id: "click-chooses", title: "Clicking an option chooses it", kind: "pointer", steps: [{ focus: input }, { type: "be" }, { click: option(1) }], expect: [{ ref: input, value: "Berlin" }, { sel: `${demo} [role=listbox]`, count: 0 }] },
      { id: "loading", title: "A combobox whose options are loading says so", kind: "keyboard", steps: [{ focus: "#cb-loading" }, { type: "a" }], expect: [{ ref: '[data-demo="loading"] [role=status]', text: "Loading cities" }] },
    ],
  },
};
