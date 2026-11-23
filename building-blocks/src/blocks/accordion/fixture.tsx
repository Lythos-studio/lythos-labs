"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { PlaygroundDef } from "../../lab/types";
import { Accordion, type AccordionItem } from "./accordion";

const items: AccordionItem[] = [
  { value: "shipping", title: "Shipping", content: <p>We ship within two working days.</p> },
  { value: "returns", title: "Returns", content: <p>Return anything within thirty days.</p> },
  { value: "legal", title: "Legal", content: <p>Not available.</p>, disabled: true },
];

export function Fixture() {
  return (
    <div className="lb-demo-stack">
      <div data-demo="single">
        <Accordion items={items} defaultValue={["shipping"]} />
      </div>
      <div data-demo="multiple">
        <Accordion items={items} type="multiple" />
      </div>
    </div>
  );
}

export const playground: PlaygroundDef = {
  controls: [
    { name: "type", label: { en: "Type", nl: "Soort" }, kind: "select", options: ["single", "multiple"], default: "single" },
    { name: "collapsible", label: { en: "Collapsible", nl: "Inklapbaar" }, kind: "boolean", default: true },
  ],
  render: (v) => <Accordion items={items} type={v.type as "single"} collapsible={v.collapsible === true} defaultValue={["shipping"]} />,
  code: (v) => `<Accordion\n  items={items}${v.type !== "single" ? `\n  type="${v.type}"` : ""}${v.collapsible ? "" : "\n  collapsible={false}"}\n/>`,
};
