/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockEntry } from "../../catalog-types";

const demo = '[data-demo="timeline"]';


export const entry: BlockEntry = {
  meta: {
    slug: "timeline",
    tier: "signature",
    title: { en: "Timeline", nl: "Tijdlijn" },
    summary: {
      en: "Events in time order as an ordered list: real time elements, every status written as text, formatted for the locale, and a long list that can be shortened with a toggle that says what it will do.",
      nl: "Gebeurtenissen in tijdsvolgorde als geordende lijst: echte time-elementen, elke status als tekst, opgemaakt voor de taal en een lange lijst die met een schakelaar kan worden ingekort die zegt wat hij gaat doen.",
    },
    native: {
      en: "It is an <ol> of <li> with <time>, which is all a timeline needs. The block adds locale formatting, status text and the show more toggle, not new semantics.",
      nl: "Het is een <ol> van <li> met <time>, en dat is alles wat een tijdlijn nodig heeft. Het blok voegt opmaak per taal, statustekst en de toon-meer-schakelaar toe, geen nieuwe semantiek.",
    },
    limits: {
      en: "Vertical only and in the order you pass. Dates are formatted in UTC so server and browser agree; convert to a time zone yourself if the hour matters. No lazy loading: paginate server-side for very long histories.",
      nl: "Alleen verticaal en in de volgorde die je meegeeft. Data worden in UTC opgemaakt zodat server en browser overeenkomen; reken zelf om naar een tijdzone als het uur ertoe doet. Geen lazy loading: pagineer op de server voor zeer lange geschiedenissen.",
    },
    files: ["blocks/timeline/timeline.tsx", "blocks/timeline/timeline.css"],
    needs: [],
    core: ["announcer"],
  },
  contract: {
    component: "timeline",
    pattern: "Ordered list with time elements",
    behaviours: [
      { id: "structure", title: "A named ordered list whose items have a real time element", kind: "static", axe: true, expect: [{ ref: `${demo} ol`, attr: { "aria-label": "Order history" } }, { sel: `${demo} li`, count: 3 }, { ref: `${demo} time`, attr: { datetime: "2026-11-02" } }] },
      { id: "status-text", title: "Every status is written out, not only coloured", kind: "static", expect: [{ ref: `${demo} li@0`, text: "Done" }, { ref: `${demo} li@1`, text: "In progress" }, { ref: `${demo} li@2`, text: "Failed" }] },
      { id: "locale-format", title: "Dates are formatted for the language", kind: "static", expect: [{ ref: `${demo} time`, text: "Nov 2, 2026" }] },
      { id: "shortened", title: "A long list is shortened and the toggle says how many are hidden", kind: "static", expect: [{ sel: '[data-demo="long"] li', count: 2 }, { ref: '[data-demo="long"] button', text: "Show 3 more" }, { ref: '[data-demo="long"] button', attr: { "aria-expanded": "false", "aria-controls": "*" } }] },
      { id: "show-all", title: "The toggle shows every item and keeps focus", kind: "keyboard", steps: [{ focus: '[data-demo="long"] button' }, { key: "Enter" }], expect: [{ sel: '[data-demo="long"] li', count: 5 }, { ref: '[data-demo="long"] button', attr: { "aria-expanded": "true" } }, { ref: '[data-demo="long"] button', focused: true }] },
      { id: "show-less", title: "Pressing it again shortens the list", kind: "keyboard", steps: [{ focus: '[data-demo="long"] button' }, { key: "Enter" }, { key: "Enter" }], expect: [{ sel: '[data-demo="long"] li', count: 2 }, { ref: '[data-demo="long"] button', text: "Show 3 more" }] },
    ],
  },
};
