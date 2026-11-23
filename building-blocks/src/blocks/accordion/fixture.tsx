"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { PlaygroundDef } from "../../lab/types";
import { Accordion, type AccordionItem } from "./accordion";

// Region names must be unique on a page (WCAG landmark rules), so each instance on the lab page has its own titles.
const items: AccordionItem[] = [
  { value: "shipping", title: "Shipping", content: <p>We ship within two working days.</p> },
  { value: "returns", title: "Returns", content: <p>Return anything within thirty days.</p> },
  { value: "legal", title: "Legal", content: <p>Not available.</p>, disabled: true },
];
const more: AccordionItem[] = [
  { value: "delivery", title: "Delivery times", content: <p>Two working days in the Netherlands.</p> },
  { value: "refunds", title: "Refunds", content: <p>Paid back within five days.</p> },
  { value: "terms", title: "Terms", content: <p>Not available.</p>, disabled: true },
];
const playgroundItems: AccordionItem[] = [
  { value: "pricing", title: "Pricing", content: <p>Simple, per project.</p> },
  { value: "support", title: "Support", content: <p>Answers within a day.</p> },
  { value: "privacy", title: "Privacy", content: <p>We keep little and say what.</p> },
];

export function Fixture() {
  return (
    <div className="lb-demo-stack">
      <div data-demo="single">
        <Accordion items={items} defaultValue={["shipping"]} />
      </div>
      <div data-demo="multiple">
        <Accordion items={more} type="multiple" />
      </div>
    </div>
  );
}

export const playground: PlaygroundDef = {
  controls: [
    { name: "type", label: { en: "Type", nl: "Soort" }, kind: "select", options: ["single", "multiple"], default: "single" },
    { name: "collapsible", label: { en: "Collapsible", nl: "Inklapbaar" }, kind: "boolean", default: true },
  ],
  render: (v) => <Accordion items={playgroundItems} type={v.type as "single"} collapsible={v.collapsible === true} defaultValue={["pricing"]} />,
  code: (v) => `<Accordion\n  items={items}${v.type !== "single" ? `\n  type="${v.type}"` : ""}${v.collapsible ? "" : "\n  collapsible={false}"}\n/>`,
};
