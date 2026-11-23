"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { nextIndex } from "../../core/roving";
import { useControllable } from "../../core/use";

export type ToggleOption = { value: string; label: ReactNode; disabled?: boolean };

export type ToggleGroupProps = {
  /** Names the group for assistive technology. */
  label: string;
  options: ToggleOption[];
  /** "single" behaves like a radio group (one choice, arrows move and choose). "multiple" is a set of toggle buttons. */
  type?: "single" | "multiple";
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  className?: string;
};

/** A row of connected buttons. Single choice is the WAI-ARIA radio group pattern (one tab stop, arrows choose); multiple is a group of toggle buttons. */
export function ToggleGroup({ label, options, type = "single", value, defaultValue, onValueChange, className }: ToggleGroupProps) {
  const [selected, setSelected] = useControllable(value, defaultValue ?? [], onValueChange);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const single = type === "single";
  const checkedIndex = options.findIndex((o) => selected.includes(o.value));
  const stop = checkedIndex >= 0 ? checkedIndex : Math.max(0, options.findIndex((o) => !o.disabled));

  function choose(v: string) {
    if (single) setSelected([v]);
    else setSelected(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!single) return;
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const next = nextIndex(index, event.key, options.length, { orientation: "both", rtl, skip: (i) => !!options[i].disabled });
    if (next === index) return;
    event.preventDefault();
    buttons.current[next]?.focus();
    choose(options[next].value);
  }

  return (
    <div role={single ? "radiogroup" : "group"} aria-label={label} className={className ? `lb-toggles ${className}` : "lb-toggles"}>
      {options.map((option, index) => {
        const on = selected.includes(option.value);
        return (
          <button
            key={option.value}
            ref={(el) => void (buttons.current[index] = el)}
            type="button"
            role={single ? "radio" : undefined}
            aria-checked={single ? on : undefined}
            aria-pressed={single ? undefined : on}
            tabIndex={single ? (index === stop ? 0 : -1) : undefined}
            disabled={option.disabled}
            className="lb-toggles__button"
            onClick={() => choose(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
