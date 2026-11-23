"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useState } from "react";
import type { PlaygroundDef } from "../../lab/types";
import { SortableList, type SortableItem } from "./sortable-list";

const start: SortableItem[] = [
  { id: "design", label: "Design" },
  { id: "build", label: "Build" },
  { id: "test", label: "Test" },
  { id: "launch", label: "Launch" },
];

export function Fixture() {
  const [items, setItems] = useState(start);
  return (
    <div data-demo="sortable" style={{ maxWidth: "24rem" }}>
      <SortableList label="Priorities" items={items} onReorder={setItems} />
    </div>
  );
}

export const playground: PlaygroundDef = {
  controls: [],
  render: () => <Play />,
  code: () => `const [items, setItems] = useState(initial);\n\n<SortableList\n  label="Priorities"\n  items={items}\n  onReorder={setItems}\n/>`,
};

function Play() {
  const [items, setItems] = useState(start);
  return <SortableList label="Playground priorities" items={items} onReorder={setItems} />;
}
