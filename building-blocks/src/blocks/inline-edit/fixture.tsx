"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { PlaygroundDef } from "../../lab/types";
import { InlineEdit } from "./inline-edit";

export function Fixture() {
  return (
    <div data-demo="inline">
      <InlineEdit label="Project title" defaultValue="Launch plan" validate={(v) => (v.includes("!") ? "The title cannot contain an exclamation mark" : undefined)} />
    </div>
  );
}

export const playground: PlaygroundDef = {
  controls: [{ name: "value", label: { en: "Value", nl: "Waarde" }, kind: "text", default: "Quarterly report" }],
  render: (v) => <InlineEdit key={String(v.value)} label="Playground title" defaultValue={String(v.value)} validate={(x) => (x.trim() ? undefined : "The title cannot be empty")} />,
  code: () => `<InlineEdit\n  label="Project title"\n  value={title}\n  onValueChange={setTitle}\n  validate={(v) => (v.trim() ? undefined : "Required")}\n/>`,
};
