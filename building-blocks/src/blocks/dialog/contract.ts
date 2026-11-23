/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockEntry } from "../../catalog-types";

const open = "dialog[open]";

export const entry: BlockEntry = {
  meta: {
    slug: "dialog",
    tier: "core",
    title: { en: "Dialog, confirm and drawer", nl: "Dialoog, bevestiging en zijpaneel" },
    summary: {
      en: "Modal dialogs on the native <dialog> element: a named dialog, an alert dialog that asks for a decision with Cancel focused, and a drawer from the side. Focus is trapped and returned, scroll is locked, nesting works.",
      nl: "Modale dialogen op het native <dialog>-element: een benoemde dialoog, een waarschuwingsdialoog die om een beslissing vraagt met Annuleren gefocust, en een zijpaneel. Focus wordt gevangen en teruggegeven, scrollen is vergrendeld en nesten werkt.",
    },
    native: {
      en: "The browser does the hard parts: top layer, inert background, focus trap, Escape and focus return. This block adds the name, close button, scroll lock, backdrop click and placements. For a plain message with no choices, a toast is often kinder than a dialog.",
      nl: "De browser doet het moeilijke werk: bovenste laag, inerte achtergrond, focusvanger, Escape en focus terug. Dit blok voegt naam, sluitknop, scrollvergrendeling, klik op de achtergrond en plaatsingen toe. Voor een gewone melding zonder keuze is een toast vaak vriendelijker dan een dialoog.",
    },
    limits: {
      en: "Only open a dialog from a user action. The initial focus defaults to the first focusable element, which is the close button; set initialFocus when another element is the better start.",
      nl: "Open een dialoog alleen vanuit een handeling van de gebruiker. De beginfocus is standaard het eerste focusbare element, de sluitknop; stel initialFocus in als een ander element een betere start is.",
    },
    files: ["blocks/dialog/dialog.tsx", "blocks/dialog/dialog.css"],
    needs: ["button"],
    core: [],
  },
  contract: {
    component: "dialog",
    pattern: "APG: dialog (modal) and alertdialog",
    behaviours: [
      { id: "closed-by-default", title: "No dialog is open at first", kind: "static", expect: [{ sel: open, count: 0 }, { sel: "dialog", count: 4 }] },
      { id: "opens-named", title: "Opening shows a dialog with a name (aria-labelledby) and its title", kind: "pointer", axe: true, steps: [{ click: "#open-dialog" }], expect: [{ sel: open, count: 1 }, { ref: open, attr: { role: "dialog", "aria-labelledby": "*", "aria-describedby": "*" } }, { ref: `${open} h2`, text: "Edit profile" }] },
      { id: "focus-moves-in", title: "Focus moves into the dialog when it opens", kind: "pointer", steps: [{ click: "#open-dialog" }], expect: [{ ref: open, focused: true }] },
      { id: "close-button", title: "The close button has a name and closes the dialog", kind: "pointer", steps: [{ click: "#open-dialog" }, { click: `${open} .lb-dialog__close` }], expect: [{ sel: open, count: 0 }] },
      { id: "nested", title: "A dialog can open another dialog on top of it", kind: "pointer", steps: [{ click: "#open-dialog" }, { click: "#nested-open" }], expect: [{ sel: open, count: 2 }] },
      { id: "alert-focus", title: "An alert dialog is announced as alertdialog and starts on Cancel", kind: "pointer", axe: true, steps: [{ click: "#open-confirm" }], expect: [{ ref: open, attr: { role: "alertdialog" } }, { ref: "[data-lb-cancel]", focused: true }] },
      { id: "confirm-acts", title: "Confirm runs the action and closes", kind: "pointer", steps: [{ click: "#open-confirm" }, { click: `${open} .lb-button@1` }], expect: [{ ref: "#confirm-result", text: "confirmed" }, { sel: open, count: 0 }] },
      { id: "cancel-does-not-act", title: "Cancel closes without running the action", kind: "pointer", steps: [{ click: "#open-confirm" }, { click: "[data-lb-cancel]" }], expect: [{ ref: "#confirm-result", text: "nothing yet" }, { sel: open, count: 0 }] },
      { id: "drawer-placement", title: "A drawer sits against the end edge", kind: "pointer", axe: true, steps: [{ click: "#open-drawer" }], expect: [{ ref: open, attr: { "data-lb-placement": "end" } }] },
      { id: "escape-closes-and-returns-focus", title: "Escape closes the dialog and focus returns to the button that opened it", kind: "native", note: "Escape, focus trap and focus return are browser behaviour of <dialog>; checked with the real keyboard.", steps: [{ click: "#open-dialog" }, { key: "Escape" }], expect: [{ sel: open, count: 0 }, { ref: "#open-dialog", focused: true }] },
      { id: "tab-stays-inside", title: "Tab stays inside an open modal dialog", kind: "native", note: "The focus trap is native behaviour; checked with the real keyboard.", steps: [{ click: "#open-dialog" }, { key: "Tab" }, { key: "Tab" }, { key: "Tab" }, { key: "Tab" }], expect: [{ ref: open, focused: true }] },
      { id: "escape-closes-top-only", title: "Escape closes only the topmost of two dialogs", kind: "native", note: "Native behaviour; checked with the real keyboard.", steps: [{ click: "#open-dialog" }, { click: "#nested-open" }, { key: "Escape" }], expect: [{ sel: open, count: 1 }] },
    ],
  },
};
