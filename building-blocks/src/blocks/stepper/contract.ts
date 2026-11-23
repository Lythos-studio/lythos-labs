/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockEntry } from "../../catalog-types";

const demo = '[data-demo="wizard"]';
const item = (i: number) => `${demo} li@${i}`;

export const entry: BlockEntry = {
  meta: {
    slug: "stepper",
    tier: "advanced",
    title: { en: "Stepper and wizard", nl: "Stappen en wizard" },
    summary: {
      en: "A progress list where every state is text and aria-current marks the step, plus a wizard that announces each step, moves focus to its heading and can block leaving a step with errors.",
      nl: "Een voortgangslijst waarin elke staat tekst is en aria-current de stap markeert, plus een wizard die elke stap aankondigt, de focus naar de kop verplaatst en kan voorkomen dat je een stap met fouten verlaat.",
    },
    native: {
      en: "There is no native stepper. An ordered list in a nav is the honest semantics. Keep multi-step forms short: every step is a place where people drop off.",
      nl: "Er is geen native stappenbalk. Een geordende lijst in een nav is de eerlijke semantiek. Houd formulieren met meerdere stappen kort: elke stap is een plek waar mensen afhaken.",
    },
    limits: {
      en: "Steps are linear: there is no jumping ahead. Keep field values in your own state so Back never loses what was typed.",
      nl: "Stappen zijn lineair: vooruit springen kan niet. Houd veldwaarden in je eigen state zodat Terug nooit iets kwijtraakt.",
    },
    files: ["blocks/stepper/stepper.tsx", "blocks/stepper/stepper.css"],
    needs: [],
    core: ["announcer", "use"],
  },
  contract: {
    component: "stepper",
    pattern: "Ordered list in a labelled nav with aria-current=step",
    behaviours: [
      { id: "structure", title: "An ordered list in a named nav; the current step has aria-current=step and states are spoken", kind: "static", axe: true, expect: [{ ref: `${demo} nav`, attr: { "aria-label": "Order progress" } }, { sel: `${demo} ol > li`, count: 3 }, { ref: item(0), attr: { "aria-current": null } }, { ref: item(1), attr: { "aria-current": "step" } }, { ref: item(0), text: "Completed" }, { ref: item(2), text: "Not started" }] },
      { id: "state-in-text", title: "The state of a step is in text for screen readers, and the number marker is decoration", kind: "static", expect: [{ ref: `${demo} .lb-stepper__marker@0`, attr: { "aria-hidden": "true" } }, { ref: `${demo} .lb-sr-only@1`, text: "Current step" }] },
      { id: "next", title: "Next moves to the following step and focuses its heading", kind: "keyboard", steps: [{ focus: "#wiz-next" }, { key: "Enter" }, { wait: 80 }], expect: [{ ref: item(2), attr: { "aria-current": "step" } }, { ref: `${demo} h3`, focused: true }, { ref: `${demo} h3`, text: "Confirm" }] },
      { id: "back", title: "Back returns to the previous step and is disabled on the first", kind: "keyboard", steps: [{ focus: "#wiz-back" }, { key: "Enter" }, { wait: 80 }], expect: [{ ref: item(0), attr: { "aria-current": "step" } }, { ref: "#wiz-back", attr: { disabled: "" } }] },
      { id: "can-leave", title: "A step can refuse to be left until it is valid", kind: "keyboard", steps: [{ focus: "#wiz-back" }, { key: "Enter" }, { wait: 60 }, { focus: "#wiz-next" }, { key: "Enter" }, { wait: 60 }], expect: [{ ref: item(0), attr: { "aria-current": "step" } }, { ref: "#wiz-note", text: "Fill in the name first" }] },
      { id: "finish", title: "The last step offers Finish instead of Next", kind: "keyboard", steps: [{ focus: "#wiz-next" }, { key: "Enter" }, { wait: 60 }], expect: [{ ref: "#wiz-next", text: "Finish" }] },
    ],
  },
};
