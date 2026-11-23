/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockEntry } from "../../catalog-types";

const demo = '[data-demo="feedback"]';

export const entry: BlockEntry = {
  meta: {
    slug: "feedback",
    tier: "core",
    title: { en: "Alert, badge, progress and loading", nl: "Melding, badge, voortgang en laden" },
    summary: {
      en: "Alert and callout, status badge, native progress bar, spinner and skeleton placeholders: the right roles, tones that never rely on colour alone, and motion that stops on request.",
      nl: "Melding en callout, statusbadge, native voortgangsbalk, spinner en skeleton-plaatshouders: de juiste rollen, tonen die niet alleen op kleur steunen en beweging die stopt op verzoek.",
    },
    native: {
      en: "Progress uses the native <progress> element. For a message that appears after an action, a Toast confirms it; an Alert stays in the page for something people need to read and act on.",
      nl: "Voortgang gebruikt het native <progress>-element. Voor een melding na een handeling bevestigt een Toast het; een Alert blijft in de pagina voor iets dat mensen moeten lezen en waar ze iets mee moeten doen.",
    },
    limits: {
      en: "Skeletons are hidden from assistive technology on purpose, so always tell the visitor what is loading some other way (a Spinner label or a status message).",
      nl: "Skeletons zijn bewust verborgen voor hulptechnologie, dus vertel de bezoeker altijd op een andere manier wat er laadt (een Spinner-label of een statusmelding).",
    },
    files: ["blocks/feedback/feedback.tsx", "blocks/feedback/feedback.css"],
    needs: [],
    core: [],
  },
  contract: {
    component: "feedback",
    pattern: "APG: alert; native progress",
    behaviours: [
      { id: "alert-roles", title: "Urgent alerts use role=alert, calmer ones role=status", kind: "static", expect: [{ sel: `${demo} [role=alert]`, count: 2 }, { sel: `${demo} [role=status].lb-alert`, count: 2 }] },
      { id: "tone-in-text", title: "The tone is also given as text, not only by colour", kind: "static", expect: [{ ref: `${demo} .lb-alert[data-lb-tone=danger]`, text: "Error:" }, { ref: `${demo} .lb-alert[data-lb-tone=success]`, text: "Success:" }] },
      { id: "badge-text", title: "A badge says its meaning in words", kind: "static", expect: [{ ref: `${demo} .lb-badge[data-lb-tone=success]`, text: "Paid" }, { ref: `${demo} .lb-badge[data-lb-tone=danger]`, text: "Overdue" }] },
      { id: "progress-named", title: "The progress bar has a name and a value, and the indeterminate one has no value", kind: "static", expect: [{ ref: `${demo} progress@0`, attr: { "aria-label": "Uploading", value: "40" } }, { ref: `${demo} progress@1`, attr: { value: null } }] },
      { id: "spinner-label", title: "The spinner has a status role and a text for screen readers", kind: "static", expect: [{ ref: `${demo} .lb-spinner`, attr: { role: "status" } }, { ref: `${demo} .lb-spinner .lb-sr-only`, text: "Loading results" }] },
      { id: "skeleton-hidden", title: "Skeleton shapes are hidden from assistive technology, and the loading region says it is busy", kind: "static", expect: [{ ref: `${demo} .lb-skeleton-lines`, attr: { "aria-hidden": "true" } }, { ref: `${demo} [aria-busy=true]`, exists: true }] },
      { id: "dismiss-alert", title: "A dismissible alert has a named close button that removes it", kind: "pointer", steps: [{ click: `${demo} .lb-alert__dismiss` }], expect: [{ ref: `${demo} .lb-alert__dismiss`, exists: false }] },
      { id: "callout-heading", title: "A callout has its own heading", kind: "static", expect: [{ ref: `${demo} aside h3`, text: "Good to know" }] },
    ],
  },
};
