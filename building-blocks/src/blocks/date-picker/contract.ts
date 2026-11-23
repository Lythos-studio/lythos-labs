/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockEntry } from "../../catalog-types";

const cal = '[data-demo="calendar"]';
const day = (n: number) => `${cal} [role=gridcell] button@${n}`;
const field = '[data-demo="picker"]';

export const entry: BlockEntry = {
  meta: {
    slug: "date-picker",
    tier: "advanced",
    title: { en: "Date picker", nl: "Datumkiezer" },
    summary: {
      en: "A keyboard-first calendar grid plus a date field that always accepts typing: arrows by day and week, Page Up and Down by month, Home and End within the week, min and max, locale-aware names.",
      nl: "Een kalenderraster voor het toetsenbord plus een datumveld waarin typen altijd werkt: pijlen per dag en week, Page Up en Down per maand, Home en End binnen de week, min en max, namen per taal.",
    },
    native: {
      en: "<input type=\"date\"> is the right default in most forms: it is free, accessible and localised. Use this when you need a consistent look, a min and max with a visible calendar, or the same behaviour in every browser.",
      nl: "<input type=\"date\"> is in de meeste formulieren de juiste standaard: gratis, toegankelijk en vertaald. Gebruik dit als je een consistente look wilt, een min en max met zichtbare kalender, of in elke browser hetzelfde gedrag.",
    },
    limits: {
      en: "Single dates only (no ranges). Weeks start on Monday and the field takes ISO dates (YYYY-MM-DD); parse locale formats yourself. Dates are plain calendar days, with no time zones.",
      nl: "Alleen losse data (geen periodes). Weken beginnen op maandag en het veld neemt ISO-data (JJJJ-MM-DD); verwerk lokale notaties zelf. Data zijn gewone kalenderdagen, zonder tijdzones.",
    },
    files: ["core/date.ts", "blocks/date-picker/date-picker.tsx", "blocks/date-picker/date-picker.css"],
    needs: [],
    core: ["announcer", "date", "use"],
  },
  contract: {
    component: "date-picker",
    pattern: "APG: date picker dialog and grid",
    behaviours: [
      { id: "grid-structure", title: "A labelled grid with weekday headers, and today and the selected day marked", kind: "static", axe: true, expect: [{ ref: `${cal} [role=grid]`, attr: { "aria-labelledby": "*" } }, { sel: `${cal} thead th`, count: 7 }, { sel: `${cal} [role=gridcell] button`, count: 30 }, { ref: `${cal} [aria-current=date]`, text: "18" }, { sel: `${cal} [aria-selected=true]`, count: 1 }] },
      { id: "one-tab-stop", title: "Exactly one day is in the tab order, and it is the selected one", kind: "static", expect: [{ sel: `${cal} [role=gridcell] button[tabindex="0"]`, count: 1 }, { ref: `${cal} [role=gridcell] button[tabindex="0"]`, text: "20" }] },
      { id: "arrow-right", title: "Arrow right moves to the next day", kind: "keyboard", steps: [{ focus: `${cal} [role=gridcell] button[tabindex="0"]` }, { key: "ArrowRight" }], expect: [{ ref: day(20), focused: true }] },
      { id: "arrow-down", title: "Arrow down moves a week ahead", kind: "keyboard", steps: [{ focus: `${cal} [role=gridcell] button[tabindex="0"]` }, { key: "ArrowDown" }], expect: [{ ref: `${cal} [role=gridcell] button[tabindex="0"]`, text: "27" }] },
      { id: "home-end", title: "End goes to the last day of the week, Home to the first", kind: "keyboard", steps: [{ focus: `${cal} [role=gridcell] button[tabindex="0"]` }, { key: "End" }, { key: "Home" }], expect: [{ ref: `${cal} [role=gridcell] button[tabindex="0"]`, text: "16" }] },
      { id: "page-down", title: "Page Down moves to the same day next month and announces the month", kind: "keyboard", steps: [{ focus: `${cal} [role=gridcell] button[tabindex="0"]` }, { key: "PageDown" }], expect: [{ ref: `${cal} [aria-live]`, text: "December 2026" }, { ref: `${cal} [role=gridcell] button[tabindex="0"]`, text: "20" }] },
      { id: "enter-selects", title: "Enter selects the focused day", kind: "keyboard", steps: [{ focus: `${cal} [role=gridcell] button[tabindex="0"]` }, { key: "ArrowRight" }, { key: "Enter" }], expect: [{ ref: "#cal-result", text: "2026-11-21" }, { ref: `${cal} [aria-selected=true] button`, text: "21" }] },
      { id: "min-max", title: "A day outside min and max is marked disabled and cannot be chosen", kind: "pointer", steps: [{ click: `${field} button` }, { click: `${field} [role=gridcell] button@0` }], expect: [{ ref: `${field} [role=gridcell] button@0`, attr: { "aria-disabled": "true" } }, { ref: `${field} input`, value: "" }, { sel: `${field} [role=dialog]`, count: 1 }] },
      { id: "escape-returns", title: "Escape closes the calendar and returns focus to the button that opened it", kind: "keyboard", steps: [{ focus: `${field} button` }, { key: "Enter" }, { key: "Escape" }], expect: [{ sel: `${field} [role=dialog]`, count: 0 }, { ref: `${field} button`, focused: true }] },
      { id: "type-valid", title: "Typing a valid date is accepted without opening the calendar", kind: "keyboard", steps: [{ focus: `${field} input` }, { type: "2026-12-24" }], expect: [{ ref: `${field} input`, value: "2026-12-24" }, { ref: `${field} input`, attr: { "aria-invalid": null } }] },
      { id: "type-invalid", title: "Typing an impossible date marks the field invalid and says why", kind: "keyboard", steps: [{ focus: `${field} input` }, { type: "2026-02-30" }], expect: [{ ref: `${field} input`, attr: { "aria-invalid": "true" } }, { ref: `${field} .lb-datepicker__error`, text: "real date" }] },
    ],
  },
};
