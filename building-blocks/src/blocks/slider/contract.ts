/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockEntry } from "../../catalog-types";

export const entry: BlockEntry = {
  meta: {
    slug: "slider",
    tier: "advanced",
    title: { en: "Slider", nl: "Schuifregelaar" },
    summary: {
      en: "A native range input with a visible label, a visible value, and the value spoken in words. Arrows, Home, End and Page Up and Down come from the browser.",
      nl: "Een native bereikveld met een zichtbaar label, een zichtbare waarde en de waarde in woorden uitgesproken. Pijlen, Home, End en Page Up en Down komen van de browser.",
    },
    native: {
      en: "This is <input type=\"range\">. It is the right element for a single value; for a range with two handles there is no good native element, and that is not covered here.",
      nl: "Dit is <input type=\"range\">. Het is het juiste element voor één waarde; voor een bereik met twee handvatten bestaat geen goed native element en dat valt hier niet onder.",
    },
    limits: {
      en: "Sliders are hard to use precisely. If people need an exact number, offer a number field next to it.",
      nl: "Schuifregelaars zijn lastig precies te gebruiken. Moeten mensen een exact getal kunnen invullen, bied dan een getalveld ernaast aan.",
    },
    files: ["blocks/slider/slider.tsx", "blocks/slider/slider.css"],
    needs: [],
    core: [],
  },
  contract: {
    component: "slider",
    pattern: "APG: slider (native range input)",
    behaviours: [
      { id: "label", title: "The slider has a visible label tied to it", kind: "static", expect: [{ ref: 'label[for="sl-volume"]', text: "Volume" }, { ref: "#sl-volume", attr: { type: "range", min: "0", max: "100", step: "1" } }] },
      { id: "value-text", title: "The value is spoken in words (aria-valuetext) and shown in an output", kind: "static", expect: [{ ref: "#sl-volume", attr: { "aria-valuetext": "30 dB" } }, { ref: 'output[for="sl-volume"]', text: "30 dB" }] },
      { id: "initial-value", title: "It starts at its default value", kind: "static", expect: [{ ref: "#sl-volume", prop: { value: "30" } }] },
      { id: "disabled", title: "A disabled slider cannot be used", kind: "static", expect: [{ ref: "#sl-off", prop: { disabled: true } }] },
      { id: "step", title: "A step other than 1 is respected", kind: "static", expect: [{ ref: "#sl-step", attr: { step: "10" } }, { ref: "#sl-step", prop: { value: "50" } }] },
      { id: "arrow-right", title: "Arrow right raises the value by one step and updates the text", kind: "native", note: "Range keyboard handling is browser behaviour; checked with the real keyboard.", steps: [{ focus: "#sl-volume" }, { key: "ArrowRight" }], expect: [{ ref: "#sl-volume", prop: { value: "31" } }, { ref: "#sl-volume", attr: { "aria-valuetext": "31 dB" } }, { ref: 'output[for="sl-volume"]', text: "31 dB" }] },
      { id: "home-end", title: "End jumps to the maximum and Home to the minimum", kind: "native", note: "Range keyboard handling is browser behaviour; checked with the real keyboard.", steps: [{ focus: "#sl-volume" }, { key: "End" }, { key: "Home" }], expect: [{ ref: "#sl-volume", prop: { value: "0" } }] },
      { id: "page-up", title: "Page Up raises the value by a larger step", kind: "native", note: "Range keyboard handling is browser behaviour; checked with the real keyboard.", steps: [{ focus: "#sl-volume" }, { key: "PageUp" }], expect: [{ ref: "#sl-volume", prop: { value: "40" } }] },
    ],
  },
};
