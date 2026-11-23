/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockEntry } from "../../catalog-types";

const single = '[data-demo="single"]';
const multi = '[data-demo="multiple"]';
const btn = (scope: string, i: number) => `${scope} .lb-accordion__button@${i}`;

export const entry: BlockEntry = {
  meta: {
    slug: "accordion",
    tier: "core",
    title: { en: "Accordion", nl: "Accordeon" },
    summary: {
      en: "Headings that contain buttons, with aria-expanded and linked regions. Single or multiple open, collapsible or not, with Up, Down, Home and End between titles.",
      nl: "Koppen die knoppen bevatten, met aria-expanded en gekoppelde regio's. Een of meerdere tegelijk open, inklapbaar of niet, met Omhoog, Omlaag, Home en End tussen de titels.",
    },
    native: {
      en: "For simple show-and-hide, the native <details> and <summary> elements are often enough and need no JavaScript. Use this when you need single-open behaviour, controlled state or consistent styling across browsers.",
      nl: "Voor eenvoudig tonen en verbergen volstaan de native elementen <details> en <summary> vaak en is er geen JavaScript nodig. Gebruik dit als je gedrag met een open item tegelijk, bestuurde staat of consistente opmaak in alle browsers nodig hebt.",
    },
    limits: {
      en: "Panels stay in the DOM when closed (hidden), so their content is not searchable with find-in-page until opened in some browsers.",
      nl: "Panelen blijven gesloten in de DOM (verborgen), dus de inhoud is in sommige browsers pas doorzoekbaar met zoeken-in-pagina als ze open zijn.",
    },
    files: ["blocks/accordion/accordion.tsx", "blocks/accordion/accordion.css"],
    needs: [],
    core: ["roving", "use"],
  },
  contract: {
    component: "accordion",
    pattern: "APG: accordion",
    behaviours: [
      { id: "structure", title: "Each title is a heading with a button that controls a labelled region", kind: "static", expect: [{ sel: `${single} h3 > button`, count: 3 }, { ref: btn(single, 0), attr: { "aria-expanded": "true", "aria-controls": "*" } }, { ref: `${single} [role=region]@0`, attr: { "aria-labelledby": "*" } }] },
      { id: "closed-hidden", title: "Closed panels are hidden from everyone", kind: "static", expect: [{ sel: `${single} [role=region]:not([hidden])`, count: 1 }, { ref: btn(single, 1), attr: { "aria-expanded": "false" } }] },
      { id: "click-opens", title: "Clicking a title opens its panel", kind: "pointer", steps: [{ click: btn(single, 1) }], expect: [{ ref: btn(single, 1), attr: { "aria-expanded": "true" } }, { ref: `${single} [role=region]@1`, visible: true }] },
      { id: "single-closes-others", title: "In single mode, opening one closes the other", kind: "pointer", steps: [{ click: btn(single, 1) }], expect: [{ ref: btn(single, 0), attr: { "aria-expanded": "false" } }] },
      { id: "collapsible", title: "In single mode, the open title can be closed again", kind: "pointer", steps: [{ click: btn(single, 0) }], expect: [{ sel: `${single} [role=region]:not([hidden])`, count: 0 }] },
      { id: "multiple-stays-open", title: "In multiple mode, items open independently", kind: "pointer", steps: [{ click: btn(multi, 0) }, { click: btn(multi, 1) }], expect: [{ ref: btn(multi, 0), attr: { "aria-expanded": "true" } }, { ref: btn(multi, 1), attr: { "aria-expanded": "true" } }] },
      { id: "enter-toggles", title: "Enter on a title toggles it", kind: "keyboard", steps: [{ focus: btn(single, 1) }, { key: "Enter" }], expect: [{ ref: btn(single, 1), attr: { "aria-expanded": "true" } }] },
      { id: "arrow-down", title: "Arrow down moves focus to the next title and skips a disabled one", kind: "keyboard", steps: [{ focus: btn(single, 1) }, { key: "ArrowDown" }], expect: [{ ref: btn(single, 0), focused: true }] },
      { id: "end-home", title: "End moves to the last enabled title and Home to the first", kind: "keyboard", steps: [{ focus: btn(single, 0) }, { key: "End" }], expect: [{ ref: btn(single, 1), focused: true }] },
    ],
  },
};
