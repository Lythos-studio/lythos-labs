"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { PlaygroundDef } from "../../lab/types";
import { Button } from "../button/button";
import { Avatar, AvatarGroup, Card, EmptyState } from "./card";

const PIXEL = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><rect width='40' height='40' fill='%23c9d1e4'/></svg>";

export function Fixture() {
  return (
    <div className="lb-demo-stack" data-demo="card">
      <div className="lb-demo-grid">
        <Card title="Quarterly report" footer={<Button size="sm">Open</Button>}>
          A summary of the quarter, in plain words.
        </Card>
        <Card title="Team notes" footer={<Button size="sm">Open</Button>}>
          Shared notes for the whole team.
        </Card>
      </div>
      <EmptyState title="No invoices yet" description="Invoices you send will show up here, with their status." action={<Button variant="primary">Create an invoice</Button>} />
      <div className="lb-demo-row">
        <Avatar name="Sanne de Vries" />
        <Avatar name="Bram Jansen" src={PIXEL} />
        <AvatarGroup label="Project members" people={[{ name: "Sanne de Vries" }, { name: "Bram Jansen" }, { name: "Lotte Smit" }, { name: "Daan Bos" }, { name: "Eva Mulder" }]} />
      </div>
    </div>
  );
}

export const playground: PlaygroundDef = {
  controls: [
    { name: "title", label: { en: "Title", nl: "Titel" }, kind: "text", default: "Quarterly report" },
    { name: "text", label: { en: "Text", nl: "Tekst" }, kind: "text", default: "A summary of the quarter, in plain words." },
  ],
  render: (v) => <Card title={String(v.title)}>{String(v.text)}</Card>,
  code: (v) => `<Card title="${v.title}">\n  ${v.text}\n</Card>`,
};
