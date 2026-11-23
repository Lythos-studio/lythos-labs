"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useState } from "react";
import type { PlaygroundDef } from "../../lab/types";
import { Calendar, DatePicker } from "./date-picker";

export function Fixture() {
  const [chosen, setChosen] = useState("2026-11-20");
  return (
    <div className="lb-demo-stack">
      <div data-demo="calendar">
        <Calendar label="Delivery date calendar" value={chosen} onValueChange={setChosen} today="2026-11-18" />
        <p>
          Chosen: <output id="cal-result">{chosen}</output>
        </p>
      </div>
      <div data-demo="picker" style={{ maxWidth: "24rem" }}>
        <DatePicker label="Start date" min="2026-11-10" max="2026-11-25" today="2026-11-18" />
      </div>
    </div>
  );
}

export const playground: PlaygroundDef = {
  controls: [
    { name: "locale", label: { en: "Language", nl: "Taal" }, kind: "select", options: ["en", "nl", "de", "ja"], default: "en" },
  ],
  render: (v) => <Calendar label="Playground calendar" locale={String(v.locale)} defaultValue="2026-11-20" today="2026-11-18" />,
  code: (v) => `<Calendar\n  locale="${v.locale}"\n  value={value}\n  onValueChange={setValue}\n/>`,
};
