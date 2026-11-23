"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useState } from "react";
import type { PlaygroundDef } from "../../lab/types";
import { Button } from "../button/button";
import { CommandPalette, openCommandPalette, type Command } from "./command-palette";

export function Fixture() {
  const [result, setResult] = useState("nothing yet");
  const commands: Command[] = [
    { id: "client", label: "New client", hint: "Create", group: "Create", onSelect: () => setResult("New client") },
    { id: "invoice", label: "New invoice", hint: "Create", group: "Create", onSelect: () => setResult("New invoice") },
    { id: "settings", label: "Open settings", group: "Go to", onSelect: () => setResult("Open settings") },
    { id: "reports", label: "Open reports", group: "Go to", onSelect: () => setResult("Open reports") },
    { id: "help", label: "Help and support", group: "Go to", onSelect: () => setResult("Help and support") },
  ];
  return (
    <div className="lb-demo-row">
      <Button id="open-palette" onClick={openCommandPalette}>
        Search commands
      </Button>
      <span>Press Ctrl or Cmd plus K</span>
      <span>
        Ran: <output id="cmd-result">{result}</output>
      </span>
      <CommandPalette commands={commands} label="Commands" placeholder="Type a command" emptyLabel="No matching commands" />
    </div>
  );
}

export const playground: PlaygroundDef = {
  controls: [{ name: "placeholder", label: { en: "Placeholder", nl: "Plaatshouder" }, kind: "text", default: "Type a command" }],
  render: (v) => <Play placeholder={String(v.placeholder)} />,
  code: (v) => `<CommandPalette\n  commands={commands}\n  placeholder="${v.placeholder}"\n/>`,
};

function Play({ placeholder }: { placeholder: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lb-demo-row">
      <Button onClick={() => setOpen(true)}>Open palette</Button>
      <CommandPalette shortcut={false} open={open} onOpenChange={setOpen} label="Playground commands" placeholder={placeholder} commands={[{ id: "a", label: "New invoice", onSelect: () => undefined }, { id: "b", label: "Open settings", onSelect: () => undefined }]} />
    </div>
  );
}
