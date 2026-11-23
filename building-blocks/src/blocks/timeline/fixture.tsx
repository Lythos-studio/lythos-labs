"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { PlaygroundDef } from "../../lab/types";
import { Timeline, type TimelineItem } from "./timeline";

const history: TimelineItem[] = [
  { id: "1", time: "2026-11-02", title: "Order placed", status: "done", description: "Confirmation sent." },
  { id: "2", time: "2026-11-05", title: "Packed", status: "current" },
  { id: "3", time: "2026-11-09", title: "Delivery attempt", status: "failed", description: "Nobody was home." },
];

const long: TimelineItem[] = [1, 2, 3, 4, 5].map((n) => ({ id: String(n), time: `2026-12-0${n}`, title: `Milestone ${n}`, status: "upcoming" as const }));

export function Fixture() {
  return (
    <div className="lb-demo-stack">
      <div data-demo="timeline">
        <Timeline label="Order history" items={history} />
      </div>
      <div data-demo="long">
        <Timeline label="Project milestones" items={long} limit={2} />
      </div>
    </div>
  );
}

export const playground: PlaygroundDef = {
  controls: [
    { name: "locale", label: { en: "Language", nl: "Taal" }, kind: "select", options: ["en", "nl", "de", "ja"], default: "en" },
    { name: "limit", label: { en: "Show first", nl: "Toon eerste" }, kind: "select", options: ["2", "3", "5"], default: "3" },
  ],
  render: (v) => <Timeline label="Playground history" locale={String(v.locale)} limit={Number(v.limit)} items={long} />,
  code: (v) => `<Timeline\n  label="History"\n  locale="${v.locale}"\n  limit={${v.limit}}\n  items={items}\n/>`,
};
