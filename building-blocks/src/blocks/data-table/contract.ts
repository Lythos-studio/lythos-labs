/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockEntry } from "../../catalog-types";

const demo = '[data-demo="table"]';
const sortBtn = (i: number) => `${demo} th button@${i}`;
const rowCell = (r: number) => `${demo} tbody th@${r}`;

export const entry: BlockEntry = {
  meta: {
    slug: "data-table",
    tier: "advanced",
    title: { en: "Data table", nl: "Datatabel" },
    summary: {
      en: "A real table with a caption, header scopes, sortable columns that announce their order, optional row selection with a select-all, pagination, and honest loading and empty states.",
      nl: "Een echte tabel met bijschrift, kopscopes, sorteerbare kolommen die hun volgorde aankondigen, optionele rijselectie met alles selecteren, paginering en eerlijke laad- en legestaten.",
    },
    native: {
      en: "It is a native <table>, which is what screen readers navigate best. It is not a grid: arrow keys do not move between cells. If you need spreadsheet-style editing, that is a different pattern with a lot more to get right.",
      nl: "Het is een native <table>, wat schermlezers het best kunnen navigeren. Het is geen grid: pijltjestoetsen verplaatsen niet tussen cellen. Voor bewerken zoals in een spreadsheet is een ander patroon nodig, met veel meer om goed te krijgen.",
    },
    limits: {
      en: "Sorting and paging are done in the browser on the rows you pass. For server data, control sort and page yourself and pass the rows you get back. There is no virtualisation, so keep a page to a few hundred rows.",
      nl: "Sorteren en pagineren gebeurt in de browser op de rijen die je meegeeft. Voor serverdata beheer je sortering en pagina zelf en geef je de rijen mee die je terugkrijgt. Er is geen virtualisatie, dus houd een pagina op enkele honderden rijen.",
    },
    files: ["blocks/data-table/data-table.tsx", "blocks/data-table/data-table.css"],
    needs: [],
    core: ["announcer", "use"],
  },
  contract: {
    component: "data-table",
    pattern: "APG: sortable table, with a native table",
    behaviours: [
      { id: "structure", title: "A captioned table with column headers, row headers and a sortable column marked with aria-sort", kind: "static", axe: true, expect: [{ ref: `${demo} caption`, text: "Projects" }, { sel: `${demo} thead th[scope=col]`, count: 5 }, { sel: `${demo} tbody th[scope=row]`, count: 4 }, { ref: `${demo} th[aria-sort]@0`, attr: { "aria-sort": "none" } }] },
      { id: "sort-ascending", title: "Activating a column header sorts ascending and says so", kind: "keyboard", steps: [{ focus: sortBtn(0) }, { key: "Enter" }], expect: [{ ref: `${demo} th[aria-sort]@0`, attr: { "aria-sort": "ascending" } }, { ref: rowCell(0), text: "Atlas" }] },
      { id: "sort-descending", title: "Activating it again sorts descending", kind: "keyboard", steps: [{ focus: sortBtn(0) }, { key: "Enter" }, { key: "Enter" }], expect: [{ ref: `${demo} th[aria-sort]@0`, attr: { "aria-sort": "descending" } }, { ref: rowCell(0), text: "Zephyr" }] },
      { id: "sort-number", title: "Numbers sort as numbers, not as text", kind: "keyboard", steps: [{ focus: sortBtn(1) }, { key: "Enter" }], expect: [{ ref: rowCell(0), text: "Borealis" }, { ref: rowCell(3), text: "Zephyr" }] },
      { id: "select-row", title: "A row checkbox selects the row and the count is announced", kind: "keyboard", steps: [{ focus: `${demo} tbody input@0` }, { key: " " }], expect: [{ ref: `${demo} tbody tr@0`, attr: { "aria-selected": "true" } }, { ref: `${demo} thead input`, attr: { "aria-label": "Select all projects" } }] },
      { id: "select-all", title: "Select all selects every row", kind: "keyboard", steps: [{ focus: `${demo} thead input` }, { key: " " }], expect: [{ sel: `${demo} tbody tr[aria-selected=true]`, count: 4 }] },
      { id: "empty", title: "A table with no rows says so inside the table", kind: "static", expect: [{ ref: '[data-demo="empty"] td', text: "No projects yet" }] },
      { id: "loading", title: "A loading table is busy and says so", kind: "static", expect: [{ ref: '[data-demo="loading"] table', attr: { "aria-busy": "true" } }, { ref: '[data-demo="loading"] [role=status]', text: "Loading projects" }] },
      { id: "pagination", title: "Pagination moves between pages, disables the ends and speaks the page", kind: "keyboard", steps: [{ focus: `${demo} nav button@1` }, { key: "Enter" }], expect: [{ ref: `${demo} nav span`, text: "Page 2 of 2" }, { ref: `${demo} nav button@1`, attr: { disabled: "" } }, { ref: rowCell(0), text: "Cobalt" }] },
    ],
  },
};
