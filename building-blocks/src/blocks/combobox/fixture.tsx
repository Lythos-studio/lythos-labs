"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useState } from "react";
import type { PlaygroundDef } from "../../lab/types";
import { Combobox, type ComboOption } from "./combobox";

const cities: ComboOption[] = [
  { value: "amsterdam", label: "Amsterdam" },
  { value: "bergen", label: "Bergen" },
  { value: "berlin", label: "Berlin" },
  { value: "brussels", label: "Brussels" },
  { value: "cologne", label: "Cologne", disabled: true },
  { value: "copenhagen", label: "Copenhagen" },
  { value: "dublin", label: "Dúblin" },
];

export function Fixture() {
  const [chosen, setChosen] = useState("none");
  return (
    <div className="lb-demo-stack" style={{ maxWidth: "22rem", minHeight: "18rem" }}>
      <div data-demo="combobox">
        <Combobox id="cb-input" label="City" options={cities} emptyLabel="No cities found" hint="Start typing." onValueChange={(v) => setChosen(v ?? "none")} />
        <p>
          Chosen: <output id="cb-result">{chosen}</output>
        </p>
      </div>
      <div data-demo="loading">
        <Combobox id="cb-loading" label="Search places" options={[]} loading loadingLabel="Loading cities" />
      </div>
    </div>
  );
}

export const playground: PlaygroundDef = {
  controls: [
    { name: "label", label: { en: "Label", nl: "Label" }, kind: "text", default: "City" },
    { name: "loading", label: { en: "Loading", nl: "Laden" }, kind: "boolean", default: false },
  ],
  render: (v) => (
    <div style={{ minHeight: "14rem", maxWidth: "20rem" }}>
      <Combobox label={String(v.label)} options={cities} loading={v.loading === true} />
    </div>
  ),
  code: (v) => `<Combobox label="${v.label}" options={options}${v.loading ? " loading" : ""} />`,
};
