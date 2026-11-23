"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { PlaygroundDef } from "../../lab/types";
import { Breadcrumb } from "./breadcrumb";

const path = [
  { label: "Home", href: "#home" },
  { label: "Clients", href: "#clients" },
  { label: "Studio Noord", href: "#studio" },
  { label: "Projects", href: "#projects" },
  { label: "Website", href: "#website" },
  { label: "Invoice 2026-014" },
];

export function Fixture() {
  return (
    <div className="lb-demo-stack">
      <div data-demo="short">
        <Breadcrumb items={[path[0], path[1], path[5]]} />
      </div>
      <div data-demo="long">
        <Breadcrumb items={path} label="Long path" />
      </div>
    </div>
  );
}

export const playground: PlaygroundDef = {
  controls: [{ name: "max", label: { en: "Max items", nl: "Max items" }, kind: "select", options: ["3", "4", "6"], default: "4" }],
  render: (v) => <Breadcrumb items={path} label="Playground path" maxItems={Number(v.max)} />,
  code: (v) => `<Breadcrumb items={items} maxItems={${v.max}} />`,
};
