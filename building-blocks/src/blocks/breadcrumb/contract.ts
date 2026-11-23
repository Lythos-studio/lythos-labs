/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockEntry } from "../../catalog-types";

const short = '[data-demo="short"]';
const long = '[data-demo="long"]';

export const entry: BlockEntry = {
  meta: {
    slug: "breadcrumb",
    tier: "advanced",
    title: { en: "Breadcrumb", nl: "Kruimelpad" },
    summary: {
      en: "A path of links to where you are: a named navigation landmark with an ordered list, the current page marked, and a long path folded behind one button that keeps focus in the right place.",
      nl: "Een pad van links naar waar je bent: een benoemd navigatielandmark met een geordende lijst, de huidige pagina gemarkeerd en een lang pad ingeklapt achter één knop die de focus op de goede plek houdt.",
    },
    native: {
      en: "It is a plain nav, ol and links; there is no JavaScript apart from the fold. The separators are drawn with CSS so a screen reader does not read a slash between every link.",
      nl: "Het is een gewone nav, ol en links; er is geen JavaScript behalve het inklappen. De scheidingstekens zijn met CSS getekend, zodat een schermlezer niet bij elke link een schuine streep voorleest.",
    },
    limits: {
      en: "The folded levels are removed from the page until expanded, so they are not reachable before that.",
      nl: "De ingeklapte niveaus zijn uit de pagina gehaald tot ze worden uitgeklapt, dus daarvoor zijn ze niet bereikbaar.",
    },
    files: ["blocks/breadcrumb/breadcrumb.tsx", "blocks/breadcrumb/breadcrumb.css"],
    needs: [],
    core: [],
  },
  contract: {
    component: "breadcrumb",
    pattern: "APG: breadcrumb",
    behaviours: [
      { id: "landmark", title: "A navigation landmark with a name, holding an ordered list", kind: "static", expect: [{ ref: `${short} nav`, attr: { "aria-label": "Breadcrumb" } }, { sel: `${short} nav > ol > li`, count: 3 }] },
      { id: "current", title: "The last item is the current page and is not a link", kind: "static", expect: [{ ref: `${short} [aria-current=page]`, text: "Invoice 2026-014" }, { sel: `${short} a`, count: 2 }] },
      { id: "no-separator-text", title: "Separators are not in the markup, so they are not read out", kind: "static", expect: [{ sel: `${short} li`, count: 3 }, { sel: `${short} [aria-hidden=true]`, count: 0 }] },
      { id: "folds", title: "A long path folds the middle levels behind a button with a name that says how many", kind: "static", expect: [{ sel: `${long} nav > ol > li`, count: 4 }, { ref: `${long} .lb-breadcrumb__more`, attr: { "aria-label": "Show all levels (3)" } }] },
      { id: "expand-click", title: "Clicking the button shows every level and removes the button", kind: "pointer", steps: [{ click: `${long} .lb-breadcrumb__more` }], expect: [{ sel: `${long} nav > ol > li`, count: 6 }, { ref: `${long} .lb-breadcrumb__more`, exists: false }] },
      { id: "expand-enter", title: "Enter on the button does the same", kind: "keyboard", steps: [{ focus: `${long} .lb-breadcrumb__more` }, { key: "Enter" }], expect: [{ sel: `${long} nav > ol > li`, count: 6 }] },
      { id: "expand-focus", title: "After expanding, focus moves to the first level that was hidden", kind: "pointer", steps: [{ click: `${long} .lb-breadcrumb__more` }, { wait: 80 }], expect: [{ ref: `${long} a@1`, focused: true }] },
      { id: "tab-through-links", title: "Tab goes through the links in order", kind: "native", note: "Tab order is browser behaviour; checked with the real keyboard.", steps: [{ focus: `${short} a@0` }, { key: "Tab" }], expect: [{ ref: `${short} a@1`, focused: true }] },
    ],
  },
};
