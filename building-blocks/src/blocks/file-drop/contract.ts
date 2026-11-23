/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockEntry } from "../../catalog-types";

const demo = '[data-demo="drop"]';
const input = `${demo} input[type=file]`;

export const entry: BlockEntry = {
  meta: {
    slug: "file-drop",
    tier: "advanced",
    title: { en: "File drop", nl: "Bestanden neerzetten" },
    summary: {
      en: "A real file input you can also drop files on, with type, size and count rules checked by a pure function, problems written out in words, and a list with a remove button per file.",
      nl: "Een echt bestandsveld waar je ook bestanden op kunt neerzetten, met regels voor type, grootte en aantal die een pure functie controleert, problemen in woorden en een lijst met een verwijderknop per bestand.",
    },
    native: {
      en: "<input type=\"file\"> does the real work here, so keyboard and screen readers behave as they always do. Dragging is an extra, never the only way. Always validate again on the server: the accept rules are a convenience, not security.",
      nl: "<input type=\"file\"> doet hier het echte werk, dus toetsenbord en schermlezers werken zoals altijd. Slepen is een extra, nooit de enige weg. Valideer altijd opnieuw op de server: de accept-regels zijn gemak, geen beveiliging.",
    },
    limits: {
      en: "There is no upload: you get File objects and send them yourself. Progress, retries and resumable uploads are your transport's job. Folder drops are not handled.",
      nl: "Er is geen upload: je krijgt File-objecten en verstuurt ze zelf. Voortgang, opnieuw proberen en hervatbare uploads zijn de taak van je transportlaag. Mappen neerzetten wordt niet afgehandeld.",
    },
    files: ["blocks/file-drop/file-drop.tsx", "blocks/file-drop/file-drop.css"],
    needs: [],
    core: ["announcer"],
  },
  contract: {
    component: "file-drop",
    pattern: "Native file input with a drop target",
    behaviours: [
      { id: "native-input", title: "A real labelled file input is in the page and reachable by keyboard", kind: "static", axe: true, expect: [{ ref: input, attr: { type: "file", "aria-describedby": "*" } }, { ref: `${demo} label[for]`, text: "choose files" }] },
      { id: "accepts-valid", title: "A valid file is listed with its size", kind: "keyboard", steps: [{ upload: input, files: [{ name: "brief.pdf", type: "application/pdf", size: 2048 }] }], expect: [{ ref: `${demo} .lb-filedrop__file`, text: "brief.pdf" }, { ref: `${demo} .lb-filedrop__file`, text: "2 kB" }, { sel: `${demo} [role=alert]`, count: 0 }] },
      { id: "rejects-type", title: "A file of the wrong type is rejected in words", kind: "keyboard", steps: [{ upload: input, files: [{ name: "virus.exe", type: "application/x-msdownload", size: 100 }] }], expect: [{ ref: `${demo} [role=alert]`, text: "virus.exe is not an allowed type" }, { sel: `${demo} .lb-filedrop__file`, count: 0 }] },
      { id: "rejects-size", title: "A file that is too large is rejected in words", kind: "keyboard", steps: [{ upload: input, files: [{ name: "big.pdf", type: "application/pdf", size: 9000000 }] }], expect: [{ ref: `${demo} [role=alert]`, text: "big.pdf is too large" }] },
      { id: "rejects-count", title: "Files over the limit are rejected in words and the rest are kept", kind: "keyboard", steps: [{ upload: input, files: [1, 2, 3, 4].map((n) => ({ name: `f${n}.pdf`, type: "application/pdf", size: 10 })) }], expect: [{ sel: `${demo} .lb-filedrop__file`, count: 3 }, { ref: `${demo} [role=alert]`, text: "f4.pdf was not added: too many files" }] },
      { id: "remove", title: "Remove takes a file out of the list", kind: "keyboard", steps: [{ upload: input, files: [{ name: "a.pdf", type: "application/pdf", size: 10 }] }, { focus: `${demo} .lb-filedrop__remove` }, { key: "Enter" }], expect: [{ sel: `${demo} .lb-filedrop__file`, count: 0 }] },
    ],
  },
};
