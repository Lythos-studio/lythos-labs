/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockEntry } from "../../catalog-types";

const demo = '[data-demo="choice"]';

export const entry: BlockEntry = {
  meta: {
    slug: "choice",
    tier: "core",
    title: { en: "Checkbox, radio and switch", nl: "Selectievakje, keuzerondje en schakelaar" },
    summary: {
      en: "Native checkbox (with indeterminate), a radio group in a fieldset with a legend, and a switch that is a real checkbox with role=switch.",
      nl: "Een native selectievakje (met tussenstand), een groep keuzerondjes in een fieldset met legend, en een schakelaar die een echt selectievakje met role=switch is.",
    },
    native: {
      en: "All three are native inputs, so the keyboard, form submission and screen reader support come from the browser. This block adds the label wiring, the group semantics and the styling.",
      nl: "Alle drie zijn native invoervelden, dus toetsenbord, formulierverzending en schermlezerondersteuning komen van de browser. Dit blok voegt de labelkoppeling, de groepssemantiek en de opmaak toe.",
    },
    limits: {
      en: "The switch is for settings that take effect at once. If the change needs a Save button, use a checkbox.",
      nl: "De schakelaar is voor instellingen die direct ingaan. Heeft de wijziging een Opslaan-knop nodig, gebruik dan een selectievakje.",
    },
    files: ["blocks/choice/choice.tsx", "blocks/choice/choice.css"],
    needs: [],
    core: [],
  },
  contract: {
    component: "choice",
    pattern: "APG: checkbox, radio group, switch (native inputs)",
    behaviours: [
      { id: "checkbox-label", title: "A checkbox has a label that toggles it and a hint that is read with it", kind: "static", expect: [{ ref: 'label[for="c-news"]', text: "Send me the newsletter" }, { ref: "#c-news", attr: { "aria-describedby": "*" } }] },
      { id: "indeterminate", title: "An indeterminate checkbox reports the mixed state", kind: "static", expect: [{ ref: "#c-all", prop: { indeterminate: true, checked: false } }] },
      { id: "switch-role", title: "The switch is a checkbox with role=switch", kind: "static", expect: [{ ref: "#s-notify", attr: { role: "switch", type: "checkbox" } }] },
      { id: "radio-group", title: "The radio group is a fieldset with a legend, and its radios share one name", kind: "static", expect: [{ ref: `${demo} fieldset legend`, text: "Plan" }, { sel: 'input[type="radio"][name="plan"]', count: 3 }, { ref: 'input[type="radio"]@0', prop: { checked: true } }] },
      { id: "space-toggles-checkbox", title: "Space toggles the focused checkbox", kind: "keyboard", steps: [{ focus: "#c-news" }, { key: " " }], expect: [{ ref: "#c-news", prop: { checked: true } }] },
      { id: "space-toggles-switch", title: "Space toggles the focused switch", kind: "keyboard", steps: [{ focus: "#s-notify" }, { key: " " }], expect: [{ ref: "#s-notify", prop: { checked: true } }] },
      { id: "click-label", title: "Clicking the label toggles the checkbox", kind: "pointer", steps: [{ click: 'label[for="c-news"]' }], expect: [{ ref: "#c-news", prop: { checked: true } }] },
      { id: "click-radio", title: "Choosing a radio unchecks the others", kind: "pointer", steps: [{ click: 'label[for$="-team"]' }], expect: [{ ref: 'input[type="radio"]@1', prop: { checked: true } }, { ref: 'input[type="radio"]@0', prop: { checked: false } }] },
      { id: "disabled-radio", title: "A disabled radio cannot be chosen", kind: "pointer", steps: [{ click: 'label[for$="-enterprise"]' }], expect: [{ ref: 'input[type="radio"]@2', prop: { checked: false, disabled: true } }] },
      { id: "radio-arrows", title: "Arrow down moves to the next radio and checks it (one tab stop for the group)", kind: "native", note: "Arrow keys in a radio group are browser behaviour; checked with the real keyboard.", steps: [{ focus: 'input[type="radio"]@0' }, { key: "ArrowDown" }], expect: [{ ref: 'input[type="radio"]@1', prop: { checked: true } }, { ref: 'input[type="radio"]@1', focused: true }] },
    ],
  },
};
