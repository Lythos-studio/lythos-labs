/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockEntry } from "../../catalog-types";

const toast = "[data-lb-toast]";

export const entry: BlockEntry = {
  meta: {
    slug: "toast",
    tier: "core",
    title: { en: "Toast", nl: "Toast" },
    summary: {
      en: "Notifications that do not steal focus, are announced through a live region that already exists, pause while you read them, and stay when they carry an action.",
      nl: "Meldingen die de focus niet afpakken, worden voorgelezen via een live-regio die al bestaat, pauzeren terwijl je ze leest en blijven staan als ze een actie hebben.",
    },
    native: {
      en: "There is no native toast. Anything people must see or act on should not be a toast: use an inline Alert or a Dialog. A toast is for confirming something that already happened.",
      nl: "Er is geen native toast. Alles wat mensen moeten zien of waar ze iets mee moeten doen hoort geen toast te zijn: gebruik een Alert in de pagina of een Dialog. Een toast bevestigt iets dat al gebeurd is.",
    },
    limits: {
      en: "Messages come and go, so keep the text short and never hide the only record of an error in a toast. Timeouts count from when the pointer and focus leave.",
      nl: "Meldingen komen en gaan, dus houd de tekst kort en verberg nooit het enige spoor van een fout in een toast. De tijd loopt weer door als aanwijzer en focus weggaan.",
    },
    files: ["blocks/toast/toast.tsx", "blocks/toast/toast.css"],
    needs: [],
    core: ["announcer"],
  },
  contract: {
    component: "toast",
    pattern: "Live region (APG: alert) with pause on hover and focus",
    behaviours: [
      { id: "region", title: "A named notifications region is on the page from the start", kind: "static", expect: [{ ref: "[data-lb-toasts]", attr: { "aria-label": "*" } }, { sel: toast, count: 0 }] },
      { id: "shows", title: "Showing a toast adds it to the region without moving focus", kind: "pointer", axe: true, steps: [{ focus: "#t-success" }, { click: "#t-success" }], expect: [{ sel: toast, count: 1 }, { ref: toast, text: "Saved" }, { ref: "#t-success", focused: true }] },
      { id: "dismiss-button", title: "The dismiss button has a name and removes the toast", kind: "pointer", steps: [{ click: "#t-success" }, { click: ".lb-toast__dismiss" }], expect: [{ sel: toast, count: 0 }, { ref: ".lb-toast__dismiss", exists: false }] },
      { id: "auto-dismiss", title: "A toast goes away by itself after its time", kind: "pointer", steps: [{ click: "#t-short" }, { wait: 1000 }], expect: [{ sel: toast, count: 0 }] },
      { id: "pause-on-focus", title: "A toast stays while focus is inside it", kind: "keyboard", steps: [{ click: "#t-short" }, { focus: ".lb-toast__dismiss" }, { wait: 1000 }], expect: [{ sel: toast, count: 1 }] },
      { id: "pause-on-hover", title: "A toast stays while the pointer is over it", kind: "pointer", steps: [{ click: "#t-short" }, { hover: toast }, { wait: 1000 }], expect: [{ sel: toast, count: 1 }] },
      { id: "action-stays", title: "A toast with an action does not disappear by itself", kind: "pointer", steps: [{ click: "#t-undo" }, { wait: 1000 }], expect: [{ sel: toast, count: 1 }, { ref: ".lb-toast__action", text: "Undo" }] },
      { id: "action-runs", title: "The action runs and closes the toast", kind: "pointer", steps: [{ click: "#t-undo" }, { click: ".lb-toast__action" }], expect: [{ ref: "#toast-result", text: "undone" }, { sel: toast, count: 0 }] },
      { id: "stacking", title: "Several toasts stack, newest last", kind: "pointer", steps: [{ click: "#t-success" }, { click: "#t-undo" }], expect: [{ sel: toast, count: 2 }] },
    ],
  },
};
