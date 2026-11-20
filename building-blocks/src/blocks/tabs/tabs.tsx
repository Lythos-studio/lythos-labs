"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { nextIndex } from "../../core/roving";
import { useControllable } from "../../core/use";

export type TabItem = { value: string; label: ReactNode; panel: ReactNode; disabled?: boolean };

export type TabsProps = {
  items: TabItem[];
  /** Names the tab list for assistive technology. */
  label: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** "auto": moving focus selects the tab. "manual": Enter or Space selects it. */
  activation?: "auto" | "manual";
  orientation?: "horizontal" | "vertical";
  className?: string;
};

/** The WAI-ARIA tabs pattern: one tab stop, arrows move between tabs, Home and End jump, disabled tabs are skipped. */
export function Tabs({ items, label, value, defaultValue, onValueChange, activation = "auto", orientation = "horizontal", className }: TabsProps) {
  const base = useId();
  const firstEnabled = items.find((i) => !i.disabled)?.value ?? "";
  const [selected, setSelected] = useControllable(value, defaultValue ?? firstEnabled, onValueChange);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const list = useRef<HTMLDivElement>(null);
  const current = Math.max(0, items.findIndex((i) => i.value === selected));

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const rtl = !!list.current && getComputedStyle(list.current).direction === "rtl";
    const next = nextIndex(index, event.key, items.length, { orientation, rtl, skip: (i) => !!items[i].disabled });
    if (next === index) return;
    event.preventDefault();
    tabs.current[next]?.focus();
    if (activation === "auto") setSelected(items[next].value);
  }

  return (
    <div className={className ? `lb-tabs ${className}` : "lb-tabs"} data-orientation={orientation}>
      <div ref={list} role="tablist" aria-label={label} aria-orientation={orientation} className="lb-tabs__list">
        {items.map((item, index) => (
          <button
            key={item.value}
            ref={(el) => void (tabs.current[index] = el)}
            type="button"
            role="tab"
            id={`${base}-tab-${item.value}`}
            aria-selected={index === current}
            aria-controls={`${base}-panel-${item.value}`}
            tabIndex={index === current ? 0 : -1}
            disabled={item.disabled}
            className="lb-tabs__tab"
            onClick={() => setSelected(item.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {items.map((item, index) => (
        <div
          key={item.value}
          role="tabpanel"
          id={`${base}-panel-${item.value}`}
          aria-labelledby={`${base}-tab-${item.value}`}
          tabIndex={0}
          hidden={index !== current}
          className="lb-tabs__panel"
        >
          {item.panel}
        </div>
      ))}
    </div>
  );
}
