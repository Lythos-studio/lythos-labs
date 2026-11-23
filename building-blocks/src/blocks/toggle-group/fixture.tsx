"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { PlaygroundDef } from "../../lab/types";
import { ToggleGroup } from "./toggle-group";

export function Fixture() {
  return (
    <div className="lb-demo-stack">
      <div data-demo="single">
        <ToggleGroup label="View" defaultValue={["list"]} options={[{ value: "list", label: "List" }, { value: "board", label: "Board" }, { value: "grid", label: "Grid", disabled: true }]} />
      </div>
      <div data-demo="multiple">
        <ToggleGroup label="Filters" type="multiple" options={[{ value: "open", label: "Open" }, { value: "mine", label: "Mine" }, { value: "late", label: "Late" }]} />
      </div>
    </div>
  );
}

export const playground: PlaygroundDef = {
  controls: [{ name: "type", label: { en: "Type", nl: "Soort" }, kind: "select", options: ["single", "multiple"], default: "single" }],
  render: (v) => <ToggleGroup label="Playground view" type={v.type as "single"} defaultValue={["a"]} options={[{ value: "a", label: "Day" }, { value: "b", label: "Week" }, { value: "c", label: "Month" }]} />,
  code: (v) => `<ToggleGroup\n  label="View"${v.type !== "single" ? '\n  type="multiple"' : ""}\n  options={options}\n/>`,
};
