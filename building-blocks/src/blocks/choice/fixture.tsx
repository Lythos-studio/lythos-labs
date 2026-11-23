"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { PlaygroundDef } from "../../lab/types";
import { Checkbox, RadioGroup, Switch } from "./choice";

export function Fixture() {
  return (
    <div className="lb-demo-stack" data-demo="choice">
      <div className="lb-demo-stack">
        <Checkbox id="c-news" label="Send me the newsletter" hint="Once a month, no more." />
        <Checkbox id="c-all" label="Select all" indeterminate />
        <Checkbox id="c-off" label="Not available" disabled />
        <Switch id="s-notify" label="Email notifications" hint="Takes effect at once." />
      </div>
      <RadioGroup
        legend="Plan"
        name="plan"
        defaultValue="solo"
        options={[
          { value: "solo", label: "Solo", hint: "One person" },
          { value: "team", label: "Team", hint: "Up to ten people" },
          { value: "enterprise", label: "Enterprise", disabled: true },
        ]}
      />
    </div>
  );
}

export const playground: PlaygroundDef = {
  controls: [
    { name: "label", label: { en: "Label", nl: "Label" }, kind: "text", default: "Email notifications" },
    { name: "kind", label: { en: "Kind", nl: "Soort" }, kind: "select", options: ["checkbox", "switch"], default: "switch" },
    { name: "disabled", label: { en: "Disabled", nl: "Uitgeschakeld" }, kind: "boolean", default: false },
  ],
  render: (v) => (v.kind === "switch" ? <Switch label={String(v.label)} disabled={v.disabled === true} /> : <Checkbox label={String(v.label)} disabled={v.disabled === true} />),
  code: (v) => `<${v.kind === "switch" ? "Switch" : "Checkbox"} label="${v.label}"${v.disabled ? " disabled" : ""} />`,
};
