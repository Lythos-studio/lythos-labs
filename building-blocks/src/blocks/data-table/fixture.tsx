"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useState } from "react";
import type { PlaygroundDef } from "../../lab/types";
import { DataTable, Pagination, type Column } from "./data-table";

type Project = { id: string; name: string; hours: number; status: string };
const all: Project[] = [
  { id: "1", name: "Zephyr", hours: 120, status: "Active" },
  { id: "2", name: "Atlas", hours: 80, status: "Active" },
  { id: "3", name: "Nimbus", hours: 40, status: "Paused" },
  { id: "4", name: "Borealis", hours: 15, status: "Done" },
  { id: "5", name: "Cobalt", hours: 60, status: "Done" },
];
const columns: Column<Project>[] = [
  { key: "name", header: "Project", cell: (r) => r.name, sortValue: (r) => r.name },
  { key: "hours", header: "Hours", cell: (r) => r.hours, sortValue: (r) => r.hours, align: "end" },
  { key: "status", header: "Status", cell: (r) => r.status },
  { key: "id", header: "Reference", cell: (r) => `P-${r.id}` },
];

export function Fixture() {
  const [page, setPage] = useState(1);
  const rows = page === 1 ? all.slice(0, 4) : all.slice(4);
  return (
    <div className="lb-demo-stack">
      <div data-demo="table">
        <DataTable caption="Projects" columns={columns} rows={rows} rowKey={(r) => r.id} selectable selectAllLabel="Select all projects" selectRowLabel={(r) => `Select ${r.name}`} />
        <Pagination page={page} pageCount={2} onPageChange={setPage} label="Projects pages" />
      </div>
      <div data-demo="empty">
        <DataTable caption="Archived projects" columns={columns.slice(0, 2)} rows={[]} rowKey={(r) => r.id} emptyLabel="No projects yet" />
      </div>
      <div data-demo="loading">
        <DataTable caption="Incoming projects" columns={columns.slice(0, 2)} rows={[]} rowKey={(r) => r.id} loading loadingLabel="Loading projects" />
      </div>
    </div>
  );
}

export const playground: PlaygroundDef = {
  controls: [
    { name: "selectable", label: { en: "Selectable", nl: "Selecteerbaar" }, kind: "boolean", default: true },
    { name: "loading", label: { en: "Loading", nl: "Laden" }, kind: "boolean", default: false },
    { name: "empty", label: { en: "No rows", nl: "Geen rijen" }, kind: "boolean", default: false },
  ],
  render: (v) => <DataTable caption="Playground projects" columns={columns} rows={v.empty ? [] : all} rowKey={(r) => r.id} selectable={v.selectable === true} loading={v.loading === true} />,
  code: (v) => `<DataTable\n  caption="Projects"\n  columns={columns}\n  rows={rows}\n  rowKey={(r) => r.id}${v.selectable ? "\n  selectable" : ""}${v.loading ? "\n  loading" : ""}\n/>`,
};
