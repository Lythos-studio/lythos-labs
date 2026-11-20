"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useState } from "react";
import type { PlaygroundDef } from "../../lab/types";
import { Button, IconButton } from "./button";

const Cross = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M3 3l10 10M13 3L3 13" />
  </svg>
);

export function Fixture() {
  const [count, setCount] = useState(0);
  return (
    <div className="lb-demo-row" data-demo="button">
      <Button variant="primary" onClick={() => setCount((c) => c + 1)}>
        Save changes
      </Button>
      <Button>Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Delete</Button>
      <Button size="sm">Small</Button>
      <Button size="lg">Large</Button>
      <Button id="disabled-btn" disabled onClick={() => setCount((c) => c + 10)}>
        Disabled
      </Button>
      <Button id="loading-btn" loading onClick={() => setCount((c) => c + 100)}>
        Saving
      </Button>
      <IconButton label="Close" onClick={() => setCount((c) => c + 1000)}>
        <Cross />
      </IconButton>
      <span>
        Clicks: <output id="btn-count">{count}</output>
      </span>
    </div>
  );
}

export const playground: PlaygroundDef = {
  controls: [
    { name: "variant", label: { en: "Variant", nl: "Variant" }, kind: "select", options: ["primary", "secondary", "ghost", "danger"], default: "primary" },
    { name: "size", label: { en: "Size", nl: "Maat" }, kind: "select", options: ["sm", "md", "lg"], default: "md" },
    { name: "loading", label: { en: "Loading", nl: "Laden" }, kind: "boolean", default: false },
    { name: "disabled", label: { en: "Disabled", nl: "Uitgeschakeld" }, kind: "boolean", default: false },
    { name: "label", label: { en: "Label", nl: "Tekst" }, kind: "text", default: "Save changes" },
  ],
  render: (v) => (
    <Button variant={v.variant as "primary"} size={v.size as "md"} loading={v.loading === true} disabled={v.disabled === true}>
      {String(v.label)}
    </Button>
  ),
  code: (v) =>
    `<Button variant="${v.variant}"${v.size !== "md" ? ` size="${v.size}"` : ""}${v.loading ? " loading" : ""}${v.disabled ? " disabled" : ""}>\n  ${String(v.label)}\n</Button>`,
};
