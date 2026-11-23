"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { PlaygroundDef } from "../../lab/types";
import { Popover } from "./popover";

export function Fixture() {
  return (
    <div data-demo="popover" className="lb-demo-stack">
      <p>Popovers keep small extras next to the thing they belong to.</p>
      <div className="lb-demo-row">
        <Popover trigger="Share" label="Share this page">
          <label>
            Link <input defaultValue="https://example.nl/page" readOnly style={{ width: "100%" }} />
          </label>
        </Popover>
      </div>
    </div>
  );
}

export const playground: PlaygroundDef = {
  controls: [
    { name: "placement", label: { en: "Placement", nl: "Plaatsing" }, kind: "select", options: ["bottom", "top", "left", "right"], default: "bottom" },
    { name: "trigger", label: { en: "Button", nl: "Knop" }, kind: "text", default: "Share" },
  ],
  render: (v) => (
    <Popover trigger={String(v.trigger)} label="Example" placement={v.placement as "bottom"}>
      <p>Anything small goes here.</p>
    </Popover>
  ),
  code: (v) => `<Popover trigger="${v.trigger}" label="Example"${v.placement !== "bottom" ? ` placement="${v.placement}"` : ""}>\n  ...\n</Popover>`,
};
