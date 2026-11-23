"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useState } from "react";
import type { PlaygroundDef } from "../../lab/types";
import { Button } from "../button/button";
import { ToastProvider, useToast } from "./toast";

function Buttons() {
  const { toast } = useToast();
  const [result, setResult] = useState("nothing yet");
  return (
    <div className="lb-demo-row" data-demo="toast">
      <Button id="t-success" onClick={() => toast({ title: "Saved", description: "Your changes are safe.", tone: "success" })}>
        Save
      </Button>
      <Button id="t-short" onClick={() => toast({ title: "Copied", duration: 600 })}>
        Copy
      </Button>
      <Button id="t-undo" onClick={() => toast({ title: "Item deleted", tone: "warning", action: { label: "Undo", onClick: () => setResult("undone") } })}>
        Delete
      </Button>
      <Button id="t-error" variant="danger" onClick={() => toast({ title: "Could not send", description: "Check your connection and try again.", tone: "danger" })}>
        Fail
      </Button>
      <span>
        Result: <output id="toast-result">{result}</output>
      </span>
    </div>
  );
}

export function Fixture() {
  return (
    <ToastProvider>
      <Buttons />
    </ToastProvider>
  );
}

function Demo({ tone, title }: { tone: "info" | "success" | "warning" | "danger"; title: string }) {
  const { toast } = useToast();
  return <Button onClick={() => toast({ title, tone })}>Show toast</Button>;
}

export const playground: PlaygroundDef = {
  controls: [
    { name: "tone", label: { en: "Tone", nl: "Toon" }, kind: "select", options: ["info", "success", "warning", "danger"], default: "success" },
    { name: "title", label: { en: "Title", nl: "Titel" }, kind: "text", default: "Saved" },
  ],
  render: (v) => (
    <ToastProvider>
      <Demo tone={v.tone as "info"} title={String(v.title)} />
    </ToastProvider>
  ),
  code: (v) => `const { toast } = useToast();\ntoast({ title: "${v.title}", tone: "${v.tone}" });`,
};
