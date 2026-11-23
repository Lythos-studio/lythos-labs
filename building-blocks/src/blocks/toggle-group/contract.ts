/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockEntry } from "../../catalog-types";

const single = '[data-demo="single"]';
const multi = '[data-demo="multiple"]';
const one = (i: number) => `${single} button@${i}`;
const many = (i: number) => `${multi} button@${i}`;

export const entry: BlockEntry = {
  meta: {
    slug: "toggle-group",
    tier: "advanced",
    title: { en: "Toggle group", nl: "Schakelgroep" },
    summary: {
      en: "Connected buttons: a radio group when one choice is allowed (one tab stop, arrows choose, right-to-left aware), or toggle buttons when several can be on.",
      nl: "Verbonden knoppen: een radiogroep als één keuze mag (één tab-stop, pijlen kiezen, bewust van rechts-naar-links), of schakelknoppen als er meer tegelijk aan mogen staan.",
    },
    native: {
      en: "For a plain choice between two or three options in a form, native radio buttons are simpler and need no JavaScript. Use this when the choice acts like a view switch or a filter.",
      nl: "Voor een gewone keuze tussen twee of drie opties in een formulier zijn native keuzerondjes eenvoudiger en is geen JavaScript nodig. Gebruik dit als de keuze werkt als een weergaveschakelaar of filter.",
    },
    limits: {
      en: "Not for navigation between pages (use links) and not for switching panels with content (use Tabs).",
      nl: "Niet voor navigatie tussen pagina's (gebruik links) en niet voor het wisselen van panelen met inhoud (gebruik Tabs).",
    },
    files: ["blocks/toggle-group/toggle-group.tsx", "blocks/toggle-group/toggle-group.css"],
    needs: [],
    core: ["roving", "use"],
  },
  contract: {
    component: "toggle-group",
    pattern: "APG: radio group; toggle button",
    behaviours: [
      { id: "single-roles", title: "A single-choice group is a named radiogroup of radios with one checked", kind: "static", expect: [{ ref: `${single} [role=radiogroup]`, attr: { "aria-label": "View" } }, { sel: `${single} [role=radio]`, count: 3 }, { ref: one(0), attr: { "aria-checked": "true", tabindex: "0" } }, { ref: one(1), attr: { "aria-checked": "false", tabindex: "-1" } }] },
      { id: "multiple-roles", title: "A multiple-choice group is a named group of toggle buttons with aria-pressed", kind: "static", expect: [{ ref: `${multi} [role=group]`, attr: { "aria-label": "Filters" } }, { ref: many(0), attr: { "aria-pressed": "false" } }, { ref: many(0), attr: { role: null } }] },
      { id: "arrow-chooses", title: "Arrow right moves to the next radio and chooses it", kind: "keyboard", steps: [{ focus: one(0) }, { key: "ArrowRight" }], expect: [{ ref: one(1), focused: true }, { ref: one(1), attr: { "aria-checked": "true" } }, { ref: one(0), attr: { "aria-checked": "false" } }] },
      { id: "wraps", title: "Arrow left on the first radio wraps to the last enabled one", kind: "keyboard", steps: [{ focus: one(0) }, { key: "ArrowLeft" }], expect: [{ ref: one(1), focused: true }] },
      { id: "skips-disabled", title: "Arrows skip a disabled option", kind: "keyboard", steps: [{ focus: one(1) }, { key: "ArrowRight" }], expect: [{ ref: one(0), focused: true }] },
      { id: "click-chooses", title: "Clicking an option chooses it", kind: "pointer", steps: [{ click: one(1) }], expect: [{ ref: one(1), attr: { "aria-checked": "true" } }] },
      { id: "multiple-toggle", title: "In multiple mode each button toggles on its own", kind: "pointer", steps: [{ click: many(0) }, { click: many(2) }], expect: [{ ref: many(0), attr: { "aria-pressed": "true" } }, { ref: many(1), attr: { "aria-pressed": "false" } }, { ref: many(2), attr: { "aria-pressed": "true" } }] },
      { id: "multiple-space", title: "Space toggles the focused button in multiple mode", kind: "keyboard", steps: [{ focus: many(1) }, { key: " " }], expect: [{ ref: many(1), attr: { "aria-pressed": "true" } }] },
      { id: "single-tab-stop", title: "A single-choice group is one Tab stop", kind: "native", note: "Tab order is browser behaviour; checked with the real keyboard.", steps: [{ focus: one(0) }, { key: "Tab" }], expect: [{ ref: many(0), focused: true }] },
    ],
  },
};
