"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useState } from "react";
import type { PlaygroundDef } from "../../lab/types";
import { Stepper, Wizard } from "./stepper";

export function Fixture() {
  const [note, setNote] = useState("");
  const [step, setStep] = useState(1);
  return (
    <div data-demo="wizard" style={{ maxWidth: "36rem" }}>
      <Wizard
        id="wiz"
        label="Order progress"
        step={step}
        onStepChange={setStep}
        canLeave={(s) => {
          // The first step has to be left by the Back button here; the demo blocks Next on step 0 until a name exists.
          if (s === 0) {
            setNote("Fill in the name first");
            return false;
          }
          setNote("");
          return true;
        }}
        steps={[
          { id: "details", label: "Details", content: <p>Who is the order for?</p> },
          { id: "options", label: "Options", content: <p>Choose a delivery option.</p> },
          { id: "confirm", label: "Confirm", content: <p>Check everything and finish.</p> },
        ]}
      />
      <p id="wiz-note" role="status">
        {note}
      </p>
    </div>
  );
}

export const playground: PlaygroundDef = {
  controls: [{ name: "current", label: { en: "Current step", nl: "Huidige stap" }, kind: "select", options: ["0", "1", "2"], default: "1" }],
  render: (v) => <Stepper label="Playground steps" current={Number(v.current)} steps={[{ id: "a", label: "Details" }, { id: "b", label: "Options" }, { id: "c", label: "Confirm" }]} />,
  code: (v) => `<Stepper\n  current={${v.current}}\n  steps={steps}\n/>`,
};
