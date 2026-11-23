"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useState } from "react";
import type { PlaygroundDef } from "../../lab/types";
import { Alert, Badge, Callout, Progress, Skeleton, Spinner } from "./feedback";

export function Fixture() {
  const [shown, setShown] = useState(true);
  return (
    <div className="lb-demo-stack" data-demo="feedback">
      <div className="lb-demo-stack">
        <Alert tone="info" title="Heads up">Maintenance is planned for Sunday.</Alert>
        <Alert tone="success" title="Payment received">Thank you.</Alert>
        <Alert tone="warning" title="Almost full">You have used 90% of your storage.</Alert>
        {shown ? (
          <Alert tone="danger" title="Could not save" onDismiss={() => setShown(false)}>
            Check your connection and try again.
          </Alert>
        ) : null}
      </div>
      <Callout title="Good to know">Callouts are for side notes that do not need an alert.</Callout>
      <div className="lb-demo-row">
        <Badge>Draft</Badge>
        <Badge tone="info">New</Badge>
        <Badge tone="success">Paid</Badge>
        <Badge tone="warning">Due soon</Badge>
        <Badge tone="danger">Overdue</Badge>
      </div>
      <div className="lb-demo-stack">
        <Progress label="Uploading" value={40} />
        <Progress label="Preparing" />
      </div>
      <div className="lb-demo-row">
        <Spinner label="Loading results" />
        <div aria-busy="true" style={{ flex: 1, minWidth: "12rem" }}>
          <Skeleton lines={3} />
        </div>
        <Skeleton shape="circle" />
      </div>
    </div>
  );
}

export const playground: PlaygroundDef = {
  controls: [
    { name: "tone", label: { en: "Tone", nl: "Toon" }, kind: "select", options: ["info", "success", "warning", "danger"], default: "warning" },
    { name: "title", label: { en: "Title", nl: "Titel" }, kind: "text", default: "Almost full" },
    { name: "text", label: { en: "Text", nl: "Tekst" }, kind: "text", default: "You have used 90% of your storage." },
  ],
  render: (v) => (
    <Alert tone={v.tone as "info"} title={String(v.title)}>
      {String(v.text)}
    </Alert>
  ),
  code: (v) => `<Alert tone="${v.tone}" title="${v.title}">\n  ${v.text}\n</Alert>`,
};
