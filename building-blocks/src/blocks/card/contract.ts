/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockEntry } from "../../catalog-types";

const demo = '[data-demo="card"]';

export const entry: BlockEntry = {
  meta: {
    slug: "card",
    tier: "core",
    title: { en: "Card, empty state and avatar", nl: "Kaart, lege staat en avatar" },
    summary: {
      en: "A card with a real heading, an empty state that says what is missing and what to do, and avatars that are always named, with initials as a fallback.",
      nl: "Een kaart met een echte kop, een lege staat die zegt wat ontbreekt en wat je kunt doen, en avatars die altijd een naam hebben, met initialen als terugval.",
    },
    native: {
      en: "A card is an <article> with a heading. If the whole card is a link, put the link on the heading text instead of wrapping everything in an anchor, so screen reader users hear a short link name.",
      nl: "Een kaart is een <article> met een kop. Is de hele kaart een link, zet de link dan op de koptekst in plaats van alles in een anker te wikkelen, zodat schermlezergebruikers een korte linknaam horen.",
    },
    limits: {
      en: "Avatar images must have the person's name as their text; decorative photos can use an empty alt, but then the avatar should not be the only thing that tells who it is.",
      nl: "Avatarafbeeldingen moeten de naam van de persoon als tekst hebben; decoratieve foto's mogen een lege alt hebben, maar dan mag de avatar niet het enige zijn dat zegt wie het is.",
    },
    files: ["blocks/card/card.tsx", "blocks/card/card.css"],
    needs: [],
    core: [],
  },
  contract: {
    component: "card",
    pattern: "Native article, heading and list semantics",
    behaviours: [
      { id: "card-heading", title: "A card is an article with a heading", kind: "static", expect: [{ sel: `${demo} article`, count: 2 }, { ref: `${demo} article h3`, text: "Quarterly report" }] },
      { id: "empty-state", title: "An empty state has a heading, an explanation and one action", kind: "static", expect: [{ ref: `${demo} .lb-empty h3`, text: "No invoices yet" }, { ref: `${demo} .lb-empty .lb-empty__text`, text: "Invoices you send" }, { sel: `${demo} .lb-empty button`, count: 1 }] },
      { id: "avatar-named", title: "An avatar with initials is still an image with a name", kind: "static", expect: [{ ref: `${demo} [role=img][aria-label="Sanne de Vries"]`, exists: true }, { ref: `${demo} [role=img][aria-label="Sanne de Vries"] span`, text: "SV" }] },
      { id: "avatar-photo", title: "An avatar with a photo uses the name as its alt text", kind: "static", expect: [{ ref: `${demo} img.lb-avatar`, attr: { alt: "Bram Jansen" } }] },
      { id: "group-label", title: "An avatar group is a labelled list and says how many are hidden", kind: "static", expect: [{ ref: `${demo} ul.lb-avatars`, attr: { "aria-label": "Project members" } }, { ref: `${demo} .lb-avatar--more`, attr: { "aria-label": "2 more" } }] },
      { id: "action-reachable", title: "The one action in an empty state can be focused with the keyboard", kind: "keyboard", steps: [{ focus: `${demo} .lb-empty button` }], expect: [{ ref: `${demo} .lb-empty button`, focused: true }] },
    ],
  },
};
