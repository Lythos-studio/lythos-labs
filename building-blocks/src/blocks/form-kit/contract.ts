/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockEntry } from "../../catalog-types";

const demo = '[data-demo="form"]';
const summary = `${demo} [role=alert]`;

export const entry: BlockEntry = {
  meta: {
    slug: "form-kit",
    tier: "signature",
    title: { en: "Form validation", nl: "Formuliervalidatie" },
    summary: {
      en: "A pure validate function and the error summary pattern: after a failed submit a summary takes focus, counts the problems and links each one to its field, while the fields keep their own inline error.",
      nl: "Een pure validate-functie en het foutsamenvattingspatroon: na een mislukte verzending krijgt een samenvatting de focus, telt de problemen en linkt elk naar zijn veld, terwijl de velden hun eigen foutmelding houden.",
    },
    native: {
      en: "Use native constraint validation (required, type, pattern) where its messages and timing are acceptable. This is for when you need your own wording, consistent messages across browsers, and a summary people who use assistive technology can start from.",
      nl: "Gebruik native constraint-validatie (required, type, pattern) als de meldingen en timing acceptabel zijn. Dit is voor als je eigen formuleringen wilt, consistente meldingen in alle browsers en een samenvatting waar mensen met hulptechnologie mee kunnen beginnen.",
    },
    limits: {
      en: "Validation is for helping people, not for security: always validate again on the server. Rules cover required, length, pattern and your own function; cross-field and async rules are yours to add as custom checks.",
      nl: "Validatie is om mensen te helpen, niet voor beveiliging: valideer altijd opnieuw op de server. Regels dekken verplicht, lengte, patroon en je eigen functie; regels over meerdere velden en asynchrone regels voeg je zelf toe als custom controle.",
    },
    files: ["blocks/form-kit/form-kit.tsx", "blocks/form-kit/form-kit.css"],
    needs: [],
    core: [],
  },
  contract: {
    component: "form-kit",
    pattern: "Error summary pattern with inline errors",
    behaviours: [
      { id: "no-errors-initially", title: "There is no summary before the first submit", kind: "static", expect: [{ sel: summary, count: 0 }] },
      { id: "summary-appears", title: "A failed submit shows a summary that counts the problems and takes focus", kind: "pointer", axe: true, steps: [{ click: "#form-submit" }, { wait: 60 }], expect: [{ ref: summary, focused: true }, { ref: `${summary} h2`, text: "There are 2 problems" }, { sel: `${summary} a`, count: 2 }] },
      { id: "links-focus-fields", title: "Each summary link moves focus to its field", kind: "pointer", steps: [{ click: "#form-submit" }, { click: `${summary} a@0` }], expect: [{ ref: "#form-name", focused: true }] },
      { id: "inline-errors", title: "The fields show their own error, tied to the input", kind: "pointer", steps: [{ click: "#form-submit" }], expect: [{ ref: "#form-name", attr: { "aria-invalid": "true", "aria-describedby": "*" } }, { ref: `${demo} [data-lb-error]@0`, text: "Enter a name" }] },
      { id: "valid-submits", title: "A valid form submits and shows no summary", kind: "keyboard", steps: [{ focus: "#form-name" }, { type: "Ada" }, { focus: "#form-email" }, { type: "ada@example.com" }, { click: "#form-submit" }, { wait: 40 }], expect: [{ sel: summary, count: 0 }, { ref: "#form-result", text: "Sent" }] },
      { id: "custom-rule", title: "A custom rule can fail a value that passes the pattern", kind: "keyboard", steps: [{ focus: "#form-name" }, { type: "Ada" }, { focus: "#form-email" }, { type: "x@test.invalid" }, { click: "#form-submit" }, { wait: 40 }], expect: [{ ref: `${summary} li`, text: "not accepted" }] },
    ],
  },
};
