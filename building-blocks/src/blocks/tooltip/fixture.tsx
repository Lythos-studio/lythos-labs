"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { PlaygroundDef } from "../../lab/types";
import { Button } from "../button/button";
import { Tooltip } from "./tooltip";

export function Fixture() {
  return (
    <div data-demo="tooltip" className="lb-demo-row" style={{ paddingBlock: "var(--lb-space-8)" }}>
      <Tooltip content="Saves your changes">
        <Button variant="primary">Save</Button>
      </Tooltip>
      <Tooltip content="What is this?" placement="bottom">
        <Button>Help</Button>
      </Tooltip>
    </div>
  );
}

export const playground: PlaygroundDef = {
  controls: [
    { name: "content", label: { en: "Text", nl: "Tekst" }, kind: "text", default: "Saves your changes" },
    { name: "placement", label: { en: "Placement", nl: "Plaatsing" }, kind: "select", options: ["top", "bottom", "left", "right"], default: "top" },
  ],
  render: (v) => (
    <div style={{ padding: "var(--lb-space-10)" }}>
      <Tooltip content={String(v.content)} placement={v.placement as "top"}>
        <Button>Hover or focus me</Button>
      </Tooltip>
    </div>
  ),
  code: (v) => `<Tooltip content="${v.content}"${v.placement !== "top" ? ` placement="${v.placement}"` : ""}>\n  <Button>Hover or focus me</Button>\n</Tooltip>`,
};
