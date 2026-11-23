"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { PlaygroundDef } from "../../lab/types";
import { SelectField, TextAreaField, TextField } from "./field";

export function Fixture() {
  return (
    <div className="lb-demo-grid" data-demo="field">
      <TextField id="f-email" label="Email" type="email" required hint="We never share it." autoComplete="email" />
      <TextField id="f-name" label="Name" error="Enter your name" />
      <TextField id="f-pass" label="Password" type="password" autoComplete="new-password" />
      <TextAreaField id="f-bio" label="About you" maxLength={40} showCount hint="A sentence or two." />
      <SelectField id="f-country" label="Country" defaultValue="nl">
        <option value="nl">Netherlands</option>
        <option value="be">Belgium</option>
        <option value="de">Germany</option>
      </SelectField>
    </div>
  );
}

export const playground: PlaygroundDef = {
  controls: [
    { name: "label", label: { en: "Label", nl: "Label" }, kind: "text", default: "Email" },
    { name: "hint", label: { en: "Hint", nl: "Hint" }, kind: "text", default: "We never share it." },
    { name: "error", label: { en: "Error", nl: "Fout" }, kind: "text", default: "" },
    { name: "required", label: { en: "Required", nl: "Verplicht" }, kind: "boolean", default: true },
  ],
  render: (v) => <TextField label={String(v.label)} hint={String(v.hint) || undefined} error={String(v.error) || undefined} required={v.required === true} />,
  code: (v) => `<TextField\n  label="${v.label}"${v.hint ? `\n  hint="${v.hint}"` : ""}${v.error ? `\n  error="${v.error}"` : ""}${v.required ? "\n  required" : ""}\n/>`,
};
