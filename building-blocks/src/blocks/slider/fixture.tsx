"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { PlaygroundDef } from "../../lab/types";
import { Slider } from "./slider";

export function Fixture() {
  return (
    <div className="lb-demo-stack" style={{ maxWidth: "28rem" }}>
      <Slider id="sl-volume" label="Volume" defaultValue={30} formatValue={(v) => `${v} dB`} />
      <Slider id="sl-step" label="Budget" defaultValue={50} step={10} formatValue={(v) => `€${v}`} />
      <Slider id="sl-off" label="Locked" defaultValue={20} disabled />
    </div>
  );
}

export const playground: PlaygroundDef = {
  controls: [
    { name: "label", label: { en: "Label", nl: "Label" }, kind: "text", default: "Volume" },
    { name: "step", label: { en: "Step", nl: "Stap" }, kind: "select", options: ["1", "5", "10"], default: "1" },
    { name: "disabled", label: { en: "Disabled", nl: "Uitgeschakeld" }, kind: "boolean", default: false },
  ],
  render: (v) => <Slider label={String(v.label)} step={Number(v.step)} disabled={v.disabled === true} defaultValue={30} />,
  code: (v) => `<Slider label="${v.label}"${v.step !== "1" ? ` step={${v.step}}` : ""}${v.disabled ? " disabled" : ""} />`,
};
