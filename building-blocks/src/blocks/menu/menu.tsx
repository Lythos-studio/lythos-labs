"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { nextIndex } from "../../core/roving";
import { createTypeahead } from "../../core/typeahead";

export type MenuItem = { id: string; label: string; onSelect?: () => void; disabled?: boolean; separatorBefore?: boolean; danger?: boolean };

export type MenuProps = {
  /** The text of the button that opens the menu. */
  label: string;
  items: MenuItem[];
  align?: "start" | "end";
  className?: string;
};

/**
 * The WAI-ARIA menu button. Arrow keys, Home, End and typing a letter move through the items, Enter and Space choose,
 * Escape closes and returns focus to the button, and a click outside closes it.
 */
export function Menu({ label, items, align = "start", className }: MenuProps) {
  const base = useId();
  const [open, setOpen] = useState(false);
  const intent = useRef<"first" | "last">("first");
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const typeahead = useRef(createTypeahead());
  const skip = (i: number) => !!items[i]?.disabled;

  function show(which: "first" | "last") {
    intent.current = which;
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const order = items.map((_, i) => i).filter((i) => !skip(i));
    const target = intent.current === "first" ? order[0] : order[order.length - 1];
    refs.current[target]?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function choose(item: MenuItem) {
    setOpen(false);
    button.current?.focus();
    item.onSelect?.();
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = refs.current.findIndex((el) => el === document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      button.current?.focus();
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    const moved = nextIndex(current, event.key, items.length, { orientation: "vertical", skip });
    if (moved !== current) {
      event.preventDefault();
      refs.current[moved]?.focus();
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && event.key !== " ") {
      const found = typeahead.current.type(event.key, items.map((i) => (i.disabled ? "" : i.label)), current);
      if (found >= 0) {
        event.preventDefault();
        refs.current[found]?.focus();
      }
    }
  }

  return (
    <div ref={root} className={className ? `lb-menu ${className}` : "lb-menu"} data-lb-align={align}>
      <button
        ref={button}
        type="button"
        id={`${base}-button`}
        className="lb-menu__button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${base}-menu` : undefined}
        onClick={() => (open ? setOpen(false) : show("first"))}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            show("first");
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            show("last");
          }
        }}
      >
        {label}
        <span className="lb-menu__chevron" aria-hidden="true" />
      </button>
      {open ? (
        <div id={`${base}-menu`} role="menu" aria-labelledby={`${base}-button`} className="lb-menu__list" onKeyDown={onMenuKeyDown}>
          {items.map((item, index) => (
            <div key={item.id} role="presentation" className="lb-menu__row">
              {item.separatorBefore ? <div role="separator" className="lb-menu__separator" /> : null}
              <button
                ref={(el) => void (refs.current[index] = el)}
                type="button"
                role="menuitem"
                tabIndex={-1}
                disabled={item.disabled}
                data-lb-danger={item.danger ? "true" : undefined}
                className="lb-menu__item"
                onClick={() => choose(item)}
              >
                {item.label}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
