"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { nextIndex } from "../../core/roving";
import { useControllable } from "../../core/use";

export type AccordionItem = { value: string; title: ReactNode; content: ReactNode; disabled?: boolean };

export type AccordionProps = {
  items: AccordionItem[];
  /** "single": opening one closes the others. "multiple": any number can be open. */
  type?: "single" | "multiple";
  /** With type "single": allow closing the open item. */
  collapsible?: boolean;
  /** Which items are open (controlled). */
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  /** The heading level of each title (2 to 6), so the page outline stays right. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  className?: string;
};

/** The WAI-ARIA accordion: each title is a heading containing a button. Up, Down, Home and End move between the titles. */
export function Accordion({ items, type = "single", collapsible = true, value, defaultValue, onValueChange, headingLevel = 3, className }: AccordionProps) {
  const base = useId();
  const [open, setOpen] = useControllable(value, defaultValue ?? [], onValueChange);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const Heading = `h${headingLevel}` as "h3";

  function toggle(itemValue: string) {
    const isOpen = open.includes(itemValue);
    if (type === "multiple") setOpen(isOpen ? open.filter((v) => v !== itemValue) : [...open, itemValue]);
    else setOpen(isOpen ? (collapsible ? [] : open) : [itemValue]);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = nextIndex(index, event.key, items.length, { orientation: "vertical", skip: (i) => !!items[i].disabled });
    if (next === index) return;
    event.preventDefault();
    buttons.current[next]?.focus();
  }

  return (
    <div className={className ? `lb-accordion ${className}` : "lb-accordion"}>
      {items.map((item, index) => {
        const isOpen = open.includes(item.value);
        const canClose = type === "multiple" || collapsible || !isOpen;
        return (
          <div key={item.value} className="lb-accordion__item" data-lb-open={isOpen ? "true" : "false"}>
            <Heading className="lb-accordion__heading">
              <button
                ref={(el) => void (buttons.current[index] = el)}
                type="button"
                id={`${base}-button-${item.value}`}
                className="lb-accordion__button"
                aria-expanded={isOpen}
                aria-controls={`${base}-panel-${item.value}`}
                aria-disabled={!canClose && isOpen ? true : undefined}
                disabled={item.disabled}
                onClick={() => toggle(item.value)}
                onKeyDown={(event) => onKeyDown(event, index)}
              >
                <span>{item.title}</span>
                <span className="lb-accordion__chevron" aria-hidden="true" />
              </button>
            </Heading>
            <div
              role="region"
              id={`${base}-panel-${item.value}`}
              aria-labelledby={`${base}-button-${item.value}`}
              hidden={!isOpen}
              className="lb-accordion__panel"
            >
              {item.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
