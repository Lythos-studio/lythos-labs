/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockEntry } from "../../catalog-types";

const demo = '[data-demo="split"]';
const bar = `${demo} [role=separator]`;

export const entry: BlockEntry = {
  meta: {
    slug: "split-pane",
    tier: "signature",
    title: { en: "Split pane", nl: "Gesplitst paneel" },
    summary: {
      en: "Two panes with a draggable separator that is also a keyboard control: arrows resize, Home and End jump to the limits, Enter collapses and restores, and the position is spoken as a value.",
      nl: "Twee panelen met een versleepbare scheiding die ook een toetsenbordbediening is: pijlen wijzigen de grootte, Home en End springen naar de grenzen, Enter klapt in en terug en de positie wordt als waarde uitgesproken.",
    },
    native: {
      en: "CSS can make a resizable box (resize: both) but not a shared divider with a value. The WAI-ARIA window splitter is the pattern: a focusable separator with aria-valuenow, which is what this is.",
      nl: "CSS kan een vergrootbaar vak maken (resize: both) maar geen gedeelde scheiding met een waarde. De WAI-ARIA window splitter is het patroon: een focusbare separator met aria-valuenow, en dat is dit.",
    },
    limits: {
      en: "Two panes only; for more, nest them. Sizes are percentages of the container, not pixels. Below a narrow width you will usually want to stack the panes instead, which is your layout's decision.",
      nl: "Alleen twee panelen; nest ze voor meer. Groottes zijn percentages van de container, geen pixels. Onder een smalle breedte wil je de panelen meestal stapelen, en dat is een keuze van je layout.",
    },
    files: ["blocks/split-pane/split-pane.tsx", "blocks/split-pane/split-pane.css"],
    needs: [],
    core: ["announcer", "use"],
  },
  contract: {
    component: "split-pane",
    pattern: "APG: window splitter (separator with a value)",
    behaviours: [
      { id: "roles", title: "A focusable separator with a value, limits, a name and the pane it controls", kind: "static", axe: true, expect: [{ ref: bar, attr: { tabindex: "0", "aria-valuenow": "40", "aria-valuemin": "15", "aria-valuemax": "85", "aria-orientation": "vertical", "aria-controls": "*", "aria-label": "Sidebar width" } }, { ref: bar, attr: { "aria-valuetext": "40 percent" } }] },
      { id: "arrow-grows", title: "Arrow right makes the first pane wider", kind: "keyboard", steps: [{ focus: bar }, { key: "ArrowRight" }], expect: [{ ref: bar, attr: { "aria-valuenow": "45" } }] },
      { id: "arrow-shrinks", title: "Arrow left makes it narrower", kind: "keyboard", steps: [{ focus: bar }, { key: "ArrowLeft" }], expect: [{ ref: bar, attr: { "aria-valuenow": "35" } }] },
      { id: "limits", title: "End and Home go to the limits and never past them", kind: "keyboard", steps: [{ focus: bar }, { key: "End" }, { key: "ArrowRight" }], expect: [{ ref: bar, attr: { "aria-valuenow": "85" } }] },
      { id: "home", title: "Home goes to the minimum", kind: "keyboard", steps: [{ focus: bar }, { key: "Home" }], expect: [{ ref: bar, attr: { "aria-valuenow": "15" } }] },
      { id: "collapse", title: "Enter collapses the pane to its minimum and Enter again restores it", kind: "keyboard", steps: [{ focus: bar }, { key: "Enter" }, { key: "Enter" }], expect: [{ ref: bar, attr: { "aria-valuenow": "40" } }] },
    ],
  },
};
