"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { ReactNode } from "react";
import { announce } from "../../core/announcer";
import { useControllable } from "../../core/use";

export type Step = { id: string; label: string; description?: string };

export type StepperProps = {
  steps: Step[];
  /** Index of the current step. */
  current: number;
  label?: string;
  /** Spoken to assistive tech for each step state. Translate these. */
  stateLabels?: { done: string; current: string; upcoming: string };
  className?: string;
};

/** A progress list: an ordered list where the current step has aria-current="step" and every state is text, not just colour. */
export function Stepper({ steps, current, label = "Progress", stateLabels = { done: "Completed", current: "Current step", upcoming: "Not started" }, className }: StepperProps) {
  return (
    <nav aria-label={label} className={className ? `lb-stepper ${className}` : "lb-stepper"}>
      <ol className="lb-stepper__list">
        {steps.map((step, i) => {
          const state = i < current ? "done" : i === current ? "current" : "upcoming";
          return (
            <li key={step.id} className="lb-stepper__item" data-state={state} aria-current={state === "current" ? "step" : undefined}>
              <span className="lb-stepper__marker" aria-hidden="true">
                {state === "done" ? "\u2713" : i + 1}
              </span>
              <span className="lb-stepper__text">
                <span className="lb-stepper__label">{step.label}</span>
                <span className="lb-sr-only">{`, ${stateLabels[state]}`}</span>
                {step.description ? <span className="lb-stepper__description">{step.description}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export type WizardProps = {
  /** Prefix for the ids of the Back and Next buttons (`${id}-back`, `${id}-next`). */
  id?: string;
  steps: (Step & { content: ReactNode })[];
  step?: number;
  defaultStep?: number;
  onStepChange?: (step: number) => void;
  /** Return false to stop the user from leaving a step (for example while it has errors). */
  canLeave?: (step: number) => boolean;
  onFinish?: () => void;
  label?: string;
  backLabel?: string;
  nextLabel?: string;
  finishLabel?: string;
  /** Spoken when the step changes: `Step 2 of 3: Details`. */
  stepAnnouncement?: (n: number, total: number, label: string) => string;
};

/** A Stepper with Back and Next. Moving on announces the step and puts focus on the new step's heading. */
export function Wizard({ id = "lb-wizard", steps, step, defaultStep = 0, onStepChange, canLeave, onFinish, label = "Progress", backLabel = "Back", nextLabel = "Next", finishLabel = "Finish", stepAnnouncement = (n, t, l) => `Step ${n} of ${t}: ${l}` }: WizardProps) {
  const [current, setCurrent] = useControllable<number>(step, defaultStep, onStepChange);
  const last = current === steps.length - 1;

  function go(to: number) {
    setCurrent(to);
    announce(stepAnnouncement(to + 1, steps.length, steps[to].label));
    requestAnimationFrame(() => document.getElementById(`lb-wizard-heading-${steps[to].id}`)?.focus());
  }

  return (
    <div className="lb-wizard">
      <Stepper steps={steps} current={current} label={label} />
      <section className="lb-wizard__panel" aria-labelledby={`lb-wizard-heading-${steps[current].id}`}>
        <h3 id={`lb-wizard-heading-${steps[current].id}`} tabIndex={-1} className="lb-wizard__heading">
          {steps[current].label}
        </h3>
        {steps[current].content}
      </section>
      <div className="lb-wizard__actions">
        <button type="button" id={`${id}-back`} className="lb-wizard__btn" disabled={current === 0} onClick={() => go(current - 1)}>
          {backLabel}
        </button>
        <button
          type="button"
          id={`${id}-next`}
          className="lb-wizard__btn lb-wizard__btn--primary"
          onClick={() => {
            if (canLeave && !canLeave(current)) return;
            if (last) onFinish?.();
            else go(current + 1);
          }}
        >
          {last ? finishLabel : nextLabel}
        </button>
      </div>
    </div>
  );
}
