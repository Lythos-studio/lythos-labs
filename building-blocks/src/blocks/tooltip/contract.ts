/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockEntry } from "../../catalog-types";

const save = '[data-demo="tooltip"] button@0';
const help = '[data-demo="tooltip"] button@1';

export const entry: BlockEntry = {
  meta: {
    slug: "tooltip",
    tier: "core",
    title: { en: "Tooltip", nl: "Tooltip" },
    summary: {
      en: "A short hint on focus and hover that is the element's description while open, can be dismissed with Escape, and stays open when the pointer moves onto it.",
      nl: "Een korte hint bij focus en hover die de beschrijving van het element is zolang hij open staat, met Escape gesloten kan worden en open blijft als de aanwijzer erheen beweegt.",
    },
    native: {
      en: "The title attribute is a poor substitute: it is not shown on keyboard focus and not on touch. Never put information in a tooltip that people need to complete a task; put it on the page.",
      nl: "Het title-attribuut is een slecht alternatief: het verschijnt niet bij toetsenbordfocus en niet op touch. Zet nooit informatie in een tooltip die mensen nodig hebben om een taak af te maken; zet die op de pagina.",
    },
    limits: {
      en: "Touch screens have no hover, so a tooltip only appears on focus there. The tooltip is for supplementary hints only.",
      nl: "Touchschermen hebben geen hover, dus daar verschijnt een tooltip alleen bij focus. De tooltip is alleen voor aanvullende hints.",
    },
    files: ["blocks/tooltip/tooltip.tsx", "blocks/tooltip/tooltip.css"],
    needs: [],
    core: ["position"],
  },
  contract: {
    component: "tooltip",
    pattern: "APG: tooltip",
    behaviours: [
      { id: "hidden-by-default", title: "No tooltip is in the page until it is wanted", kind: "static", expect: [{ sel: "[role=tooltip]", count: 0 }] },
      { id: "focus-shows", title: "Focusing the button shows the tooltip and makes it the button's description", kind: "keyboard", axe: true, steps: [{ focus: save }], expect: [{ sel: "[role=tooltip]", count: 1 }, { ref: "[role=tooltip]", text: "Saves your changes" }, { ref: save, attr: { "aria-describedby": "*" } }] },
      { id: "escape-hides", title: "Escape hides the tooltip while focus stays on the button", kind: "keyboard", steps: [{ focus: save }, { key: "Escape" }], expect: [{ sel: "[role=tooltip]", count: 0 }, { ref: save, focused: true }] },
      { id: "blur-hides", title: "Moving focus away hides the tooltip", kind: "keyboard", steps: [{ focus: save }, { focus: help }], expect: [{ sel: "[role=tooltip]", count: 1 }, { ref: "[role=tooltip]", text: "What is this?" }] },
      { id: "hover-shows-after-delay", title: "Hovering shows the tooltip after the delay", kind: "pointer", steps: [{ hover: save }, { wait: 450 }], expect: [{ sel: "[role=tooltip]", count: 1 }, { ref: save, attr: { "aria-describedby": "*" } }] },
      { id: "no-description-when-closed", title: "When closed the button has no dangling aria-describedby", kind: "static", expect: [{ ref: save, attr: { "aria-describedby": null } }] },
    ],
  },
};
