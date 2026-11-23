"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useState } from "react";
import type { PlaygroundDef } from "../../lab/types";
import { Menu, type MenuItem } from "./menu";

export function Fixture() {
  const [result, setResult] = useState("none");
  const items: MenuItem[] = [
    { id: "rename", label: "Rename", onSelect: () => setResult("Rename") },
    { id: "duplicate", label: "Duplicate", onSelect: () => setResult("Duplicate") },
    { id: "archive", label: "Archive", disabled: true },
    { id: "delete", label: "Delete", danger: true, separatorBefore: true, onSelect: () => setResult("Delete") },
  ];
  return (
    <div data-demo="menu" className="lb-demo-stack" style={{ minHeight: "14rem" }}>
      <p>
        Chosen: <output id="menu-result">{result}</output>
      </p>
      <div>
        <Menu label="Actions" items={items} />
      </div>
    </div>
  );
}

export const playground: PlaygroundDef = {
  controls: [
    { name: "label", label: { en: "Button", nl: "Knop" }, kind: "text", default: "Actions" },
    { name: "align", label: { en: "Align", nl: "Uitlijning" }, kind: "select", options: ["start", "end"], default: "start" },
  ],
  render: (v) => (
    <div style={{ minHeight: "12rem" }}>
      <Menu label={String(v.label)} align={v.align as "start"} items={[{ id: "a", label: "Rename" }, { id: "b", label: "Duplicate" }, { id: "c", label: "Delete", danger: true, separatorBefore: true }]} />
    </div>
  ),
  code: (v) => `<Menu label="${v.label}"${v.align !== "start" ? ` align="${v.align}"` : ""} items={items} />`,
};
