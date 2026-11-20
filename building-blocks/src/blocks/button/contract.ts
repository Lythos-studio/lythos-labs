/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockEntry } from "../../catalog-types";

const demo = '[data-demo="button"]';

export const entry: BlockEntry = {
  meta: {
    slug: "button",
    tier: "core",
    title: { en: "Button", nl: "Knop" },
    summary: {
      en: "A native button with four variants, three sizes, a loading state that keeps focus, and an icon button that cannot be unlabeled.",
      nl: "Een native knop met vier varianten, drie maten, een laadstaat die de focus behoudt en een icoonknop die niet zonder naam kan.",
    },
    native: {
      en: "It is a real <button>, so Enter, Space, form submission and the disabled state come from the browser. Reach for this only for the styling and the loading and icon behaviour.",
      nl: "Het is een echte <button>, dus Enter, Spatie, formulierverzending en de uitgeschakelde staat komen van de browser. Gebruik dit alleen voor de opmaak en het laad- en icoongedrag.",
    },
    limits: {
      en: "Loading uses aria-busy and aria-disabled so focus is kept; assistive technology is not told when loading ends unless you announce it.",
      nl: "Laden gebruikt aria-busy en aria-disabled zodat de focus blijft; hulptechnologie hoort niet dat laden klaar is, tenzij je dat aankondigt.",
    },
    files: ["blocks/button/button.tsx", "blocks/button/button.css"],
    needs: [],
    core: [],
  },
  contract: {
    component: "button",
    pattern: "APG: button (native <button>)",
    behaviours: [
      { id: "native-element", title: "Every button is a real <button> with type=button by default", kind: "static", expect: [{ ref: `${demo} button`, attr: { type: "button" } }, { sel: `${demo} div[role=button]`, count: 0 }] },
      { id: "icon-name", title: "The icon button has an accessible name from aria-label", kind: "static", expect: [{ ref: `${demo} .lb-button--icon`, attr: { "aria-label": "Close" } }] },
      { id: "loading-state", title: "A loading button is busy and aria-disabled, but not disabled, so it stays focusable", kind: "static", expect: [{ ref: "#loading-btn", attr: { "aria-busy": "true", "aria-disabled": "true", disabled: null } }] },
      { id: "enter-activates", title: "Enter activates the focused button", kind: "keyboard", steps: [{ focus: `${demo} button@0` }, { key: "Enter" }], expect: [{ ref: "#btn-count", text: "1" }] },
      { id: "space-activates", title: "Space activates the focused button", kind: "keyboard", steps: [{ focus: `${demo} button@0` }, { key: " " }], expect: [{ ref: "#btn-count", text: "1" }] },
      { id: "click-activates", title: "A click activates the button", kind: "pointer", steps: [{ click: `${demo} button@0` }, { click: `${demo} button@0` }], expect: [{ ref: "#btn-count", text: "2" }] },
      { id: "loading-ignores-click", title: "A click on a loading button does nothing and keeps focus on it", kind: "pointer", steps: [{ focus: "#loading-btn" }, { click: "#loading-btn" }], expect: [{ ref: "#btn-count", text: "0" }, { ref: "#loading-btn", focused: true }] },
      { id: "disabled-not-activated", title: "A disabled button cannot be activated", kind: "pointer", steps: [{ click: "#disabled-btn" }], expect: [{ ref: "#btn-count", text: "0" }, { ref: "#disabled-btn", attr: { disabled: "*" } }] },
      { id: "tab-order", title: "Tab moves from button to button and skips the disabled one", kind: "native", note: "Tab order is browser behaviour; checked with the real keyboard." },
    ],
  },
};
