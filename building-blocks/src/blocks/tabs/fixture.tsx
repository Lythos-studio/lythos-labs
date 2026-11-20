"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { PlaygroundDef } from "../../lab/types";
import { Tabs, type TabItem } from "./tabs";

const items: TabItem[] = [
  { value: "overview", label: "Overview", panel: <p>Overview content</p> },
  { value: "details", label: "Details", panel: <p>Details content</p> },
  { value: "archive", label: "Archive", panel: <p>Archive content</p>, disabled: true },
  { value: "settings", label: "Settings", panel: <p>Settings content</p> },
];

export function Fixture() {
  return (
    <div className="lb-demo-stack">
      <div data-demo="auto">
        <Tabs label="Automatic activation" items={items} />
      </div>
      <div data-demo="manual">
        <Tabs label="Manual activation" items={items} activation="manual" />
      </div>
      <div data-demo="vertical">
        <Tabs label="Vertical" items={items} orientation="vertical" />
      </div>
    </div>
  );
}

export const playground: PlaygroundDef = {
  controls: [
    { name: "activation", label: { en: "Activation", nl: "Activatie" }, kind: "select", options: ["auto", "manual"], default: "auto" },
    { name: "orientation", label: { en: "Orientation", nl: "Richting" }, kind: "select", options: ["horizontal", "vertical"], default: "horizontal" },
  ],
  render: (v) => <Tabs label="Example" items={items} activation={v.activation as "auto"} orientation={v.orientation as "horizontal"} />,
  code: (v) =>
    `<Tabs\n  label="Example"\n  items={items}${v.activation !== "auto" ? `\n  activation="${v.activation}"` : ""}${v.orientation !== "horizontal" ? `\n  orientation="${v.orientation}"` : ""}\n/>`,
};
