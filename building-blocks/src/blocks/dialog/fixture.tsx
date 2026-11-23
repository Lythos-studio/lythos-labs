"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useState } from "react";
import type { PlaygroundDef } from "../../lab/types";
import { Button } from "../button/button";
import { ConfirmDialog, Dialog, Drawer } from "./dialog";

export function Fixture() {
  const [main, setMain] = useState(false);
  const [nested, setNested] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [result, setResult] = useState("nothing yet");
  return (
    <div className="lb-demo-row">
      <Button id="open-dialog" onClick={() => setMain(true)}>
        Edit profile
      </Button>
      <Button id="open-confirm" variant="danger" onClick={() => setConfirm(true)}>
        Delete project
      </Button>
      <Button id="open-drawer" onClick={() => setDrawer(true)}>
        Open filters
      </Button>
      <span>
        Result: <output id="confirm-result">{result}</output>
      </span>

      <Dialog open={main} onOpenChange={setMain} title="Edit profile" description="Changes are saved when you press Save." footer={<Button variant="primary" onClick={() => setMain(false)}>Save</Button>}>
        <p>Update how your name appears to your team.</p>
        <Button id="nested-open" onClick={() => setNested(true)}>
          More options
        </Button>
        <Dialog open={nested} onOpenChange={setNested} title="More options" footer={<Button onClick={() => setNested(false)}>Done</Button>}>
          <p>Nested dialogs sit on top of each other.</p>
        </Dialog>
      </Dialog>

      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Delete this project?" message="This cannot be undone." confirmLabel="Delete" tone="danger" onConfirm={() => setResult("confirmed")} />

      <Drawer open={drawer} onOpenChange={setDrawer} title="Filters" footer={<Button variant="primary" onClick={() => setDrawer(false)}>Apply</Button>}>
        <p>Narrow the list down.</p>
      </Drawer>
    </div>
  );
}

export const playground: PlaygroundDef = {
  controls: [
    { name: "placement", label: { en: "Placement", nl: "Plaatsing" }, kind: "select", options: ["center", "end", "start", "bottom"], default: "center" },
    { name: "title", label: { en: "Title", nl: "Titel" }, kind: "text", default: "Edit profile" },
  ],
  render: function Demo(v) {
    return <PlaygroundDemo placement={v.placement as "center"} title={String(v.title)} />;
  },
  code: (v) => `<Dialog\n  open={open}\n  onOpenChange={setOpen}\n  title="${v.title}"${v.placement !== "center" ? `\n  placement="${v.placement}"` : ""}\n>\n  ...\n</Dialog>`,
};

function PlaygroundDemo({ placement, title }: { placement: "center" | "end" | "start" | "bottom"; title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open dialog</Button>
      <Dialog open={open} onOpenChange={setOpen} title={title} placement={placement}>
        <p>Content goes here.</p>
      </Dialog>
    </>
  );
}
