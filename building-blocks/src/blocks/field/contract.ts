/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockEntry } from "../../catalog-types";

const demo = '[data-demo="field"]';

export const entry: BlockEntry = {
  meta: {
    slug: "field",
    tier: "core",
    title: { en: "Fields", nl: "Velden" },
    summary: {
      en: "Text input, textarea and select with a real label, a hint, an error that is announced with the field, a character counter and a password Show/Hide button.",
      nl: "Tekstveld, tekstvak en keuzelijst met een echt label, een hint, een fout die samen met het veld wordt voorgelezen, een tekenteller en een Toon/Verberg-knop voor wachtwoorden.",
    },
    native: {
      en: "These are the native inputs with their labels wired up correctly. The wiring (for, aria-describedby, aria-invalid) is the value; the browser still does validation, autofill and the keyboard.",
      nl: "Dit zijn de native invoervelden met correct gekoppelde labels. De koppeling (for, aria-describedby, aria-invalid) is de waarde; de browser doet nog steeds validatie, automatisch invullen en het toetsenbord.",
    },
    limits: {
      en: "Errors are not announced the moment they appear unless you move focus to the field or use the FormKit error summary. The counter is not a live region on purpose.",
      nl: "Fouten worden niet voorgelezen op het moment dat ze verschijnen, tenzij je de focus naar het veld verplaatst of de foutsamenvatting van FormKit gebruikt. De teller is bewust geen live-regio.",
    },
    files: ["blocks/field/field.tsx", "blocks/field/field.css"],
    needs: [],
    core: [],
  },
  contract: {
    component: "field",
    pattern: "Native form controls with APG-style labelling",
    behaviours: [
      { id: "label-linked", title: "Every field has a visible label tied to the input with for and id", kind: "static", expect: [{ ref: 'label[for="f-email"]', text: "Email" }, { ref: "#f-email", exists: true }, { ref: 'label[for="f-bio"]', text: "About you" }, { ref: 'label[for="f-country"]', text: "Country" }] },
      { id: "hint-linked", title: "The hint is read with the field (aria-describedby)", kind: "static", expect: [{ ref: "#f-email", attr: { "aria-describedby": "*" } }, { ref: `${demo} .lb-field__hint`, text: "We never share it." }] },
      { id: "required", title: "A required field is marked required for the browser and visually, and the star is hidden from screen readers", kind: "static", expect: [{ ref: "#f-email", attr: { required: "" } }, { ref: ".lb-field__required", attr: { "aria-hidden": "true" } }] },
      { id: "error-linked", title: "An error marks the field invalid and is tied to it, with a spoken Error: prefix", kind: "static", expect: [{ ref: "#f-name", attr: { "aria-invalid": "true", "aria-describedby": "*" } }, { ref: "[data-lb-error]", text: "Enter your name" }, { ref: "[data-lb-error] .lb-sr-only", text: "Error:" }] },
      { id: "typing", title: "Typing goes into the field", kind: "keyboard", steps: [{ focus: "#f-email" }, { type: "a@b.nl" }], expect: [{ ref: "#f-email", value: "a@b.nl" }] },
      { id: "counter", title: "The counter follows what is typed", kind: "keyboard", steps: [{ focus: "#f-bio" }, { type: "hello" }], expect: [{ ref: "[data-lb-count]", text: "5 / 40" }] },
      { id: "reveal-toggles", title: "Show reveals the password and Hide hides it again", kind: "pointer", steps: [{ click: ".lb-field__reveal" }], expect: [{ ref: "#f-pass", attr: { type: "text" } }, { ref: ".lb-field__reveal", attr: { "aria-pressed": "true" } }, { ref: ".lb-field__reveal", text: "Hide" }] },
      { id: "reveal-twice", title: "Pressing the button again hides the password", kind: "pointer", steps: [{ click: ".lb-field__reveal" }, { click: ".lb-field__reveal" }], expect: [{ ref: "#f-pass", attr: { type: "password" } }, { ref: ".lb-field__reveal", attr: { "aria-pressed": "false" } }] },
      { id: "tab-to-reveal", title: "Tab goes from the password input to its Show button", kind: "native", note: "Tab order is browser behaviour; checked with the real keyboard.", steps: [{ focus: "#f-pass" }, { key: "Tab" }], expect: [{ ref: ".lb-field__reveal", focused: true }] },
    ],
  },
};
