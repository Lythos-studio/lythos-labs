"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { PlaygroundDef } from "../../lab/types";
import { SplitPane } from "./split-pane";

export function Fixture() {
  return (
    <div data-demo="split">
      <SplitPane label="Sidebar width" defaultSize={40} first={<p>Folders</p>} second={<p>Messages</p>} />
    </div>
  );
}

export const playground: PlaygroundDef = {
  controls: [
    { name: "orientation", label: { en: "Direction", nl: "Richting" }, kind: "select", options: ["horizontal", "vertical"], default: "horizontal" },
    { name: "size", label: { en: "Start size", nl: "Startgrootte" }, kind: "select", options: ["30", "50", "70"], default: "50" },
  ],
  render: (v) => (
    <SplitPane label="Playground split" orientation={v.orientation === "vertical" ? "vertical" : "horizontal"} defaultSize={Number(v.size)} first={<p>First</p>} second={<p>Second</p>} />
  ),
  code: (v) => `<SplitPane\n  label="Panel"\n  orientation="${v.orientation}"\n  defaultSize={${v.size}}\n  first={<Folders />}\n  second={<Messages />}\n/>`,
};
