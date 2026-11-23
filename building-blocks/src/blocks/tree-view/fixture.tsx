"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useState } from "react";
import type { PlaygroundDef } from "../../lab/types";
import { TreeView, type TreeNode } from "./tree-view";

const nodes: TreeNode[] = [
  { id: "src", label: "src", children: [{ id: "src-index", label: "index.ts" }, { id: "src-app", label: "app.tsx" }] },
  { id: "docs", label: "docs", children: [{ id: "docs-intro", label: "intro.md" }] },
  { id: "readme", label: "README.md" },
];

export function Fixture() {
  const [picked, setPicked] = useState("none");
  return (
    <div data-demo="tree" style={{ maxWidth: "22rem" }}>
      <TreeView label="Files" nodes={nodes} defaultExpanded={["src"]} onSelect={setPicked} />
      <p>
        Selected: <output id="tree-result">{picked}</output>
      </p>
    </div>
  );
}

export const playground: PlaygroundDef = {
  controls: [{ name: "open", label: { en: "Start open", nl: "Start open" }, kind: "boolean", default: true }],
  render: (v) => <TreeView key={String(v.open)} label="Playground files" nodes={nodes} defaultExpanded={v.open ? ["src", "docs"] : []} />,
  code: () => `<TreeView\n  label="Files"\n  nodes={nodes}\n  onSelect={(id) => open(id)}\n/>`,
};
