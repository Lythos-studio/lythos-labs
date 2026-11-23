"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { announce } from "../../core/announcer";

export type SortableItem = { id: string; label: string };

export type SortableListProps<T extends SortableItem> = {
  items: T[];
  onReorder: (items: T[]) => void;
  /** Name of the list. */
  label: string;
  renderItem?: (item: T) => ReactNode;
  /** Spoken words. Translate them. */
  messages?: {
    grabbed: (label: string, position: number, total: number) => string;
    moved: (label: string, position: number, total: number) => string;
    dropped: (label: string, position: number, total: number) => string;
    cancelled: (label: string) => string;
    handle: (label: string) => string;
    instructions: string;
  };
  className?: string;
};

const defaultMessages = {
  grabbed: (l: string, p: number, t: number) => `${l} picked up, position ${p} of ${t}. Use the arrow keys to move, Space to drop, Escape to cancel.`,
  moved: (l: string, p: number, t: number) => `${l} moved to position ${p} of ${t}`,
  dropped: (l: string, p: number, t: number) => `${l} dropped at position ${p} of ${t}`,
  cancelled: (l: string) => `Move cancelled, ${l} is back where it was`,
  handle: (l: string) => `Reorder ${l}`,
  instructions: "Press Space on a handle to pick an item up, then use the arrow keys.",
};

export function move<T>(list: T[], from: number, to: number): T[] {
  if (from === to || to < 0 || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * A reorderable list that works without a pointer. Each item has a handle button: Space picks it up, arrows move it,
 * Space drops it, Escape puts it back, and every step is announced. Dragging the handle with a pointer does the same.
 */
export function SortableList<T extends SortableItem>({ items, onReorder, label, renderItem, messages = defaultMessages, className }: SortableListProps<T>) {
  const [grabbed, setGrabbed] = useState<string | null>(null);
  const original = useRef<T[]>([]);
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const list = useRef<HTMLUListElement>(null);
  const dragging = useRef<string | null>(null);

  const indexOf = (id: string) => items.findIndex((i) => i.id === id);

  function reorder(next: T[], id: string, spoken?: "moved") {
    onReorder(next);
    if (spoken) announce(messages.moved(items[indexOf(id)].label, next.findIndex((i) => i.id === id) + 1, next.length));
    requestAnimationFrame(() => refs.current.get(id)?.focus());
  }

  function onKeyDown(event: KeyboardEvent, item: T) {
    const i = indexOf(item.id);
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (grabbed === item.id) {
        setGrabbed(null);
        announce(messages.dropped(item.label, i + 1, items.length));
      } else {
        original.current = items;
        setGrabbed(item.id);
        announce(messages.grabbed(item.label, i + 1, items.length));
      }
    } else if (grabbed === item.id && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      const next = move(items, i, i + (event.key === "ArrowUp" ? -1 : 1));
      if (next !== items) reorder(next, item.id, "moved");
    } else if (grabbed === item.id && (event.key === "Home" || event.key === "End")) {
      event.preventDefault();
      const next = move(items, i, event.key === "Home" ? 0 : items.length - 1);
      if (next !== items) reorder(next, item.id, "moved");
    } else if (grabbed === item.id && event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onReorder(original.current);
      setGrabbed(null);
      announce(messages.cancelled(item.label));
      requestAnimationFrame(() => refs.current.get(item.id)?.focus());
    } else if (event.key === "Tab" && grabbed) {
      setGrabbed(null);
    }
  }

  function onPointerDown(event: PointerEvent, item: T) {
    if (event.button !== 0) return;
    dragging.current = item.id;
    original.current = items;
    event.currentTarget.setPointerCapture(event.pointerId);
    setGrabbed(item.id);
  }

  function onPointerMove(event: PointerEvent) {
    const id = dragging.current;
    if (!id || !list.current) return;
    const rows = Array.from(list.current.children) as HTMLElement[];
    let target = rows.findIndex((row) => {
      const r = row.getBoundingClientRect();
      return event.clientY >= r.top && event.clientY <= r.bottom;
    });
    if (target < 0) target = event.clientY < rows[0].getBoundingClientRect().top ? 0 : rows.length - 1;
    const from = indexOf(id);
    if (target !== from) onReorder(move(items, from, target));
  }

  function onPointerUp() {
    const id = dragging.current;
    dragging.current = null;
    if (id) {
      setGrabbed(null);
      announce(messages.dropped(items[indexOf(id)].label, indexOf(id) + 1, items.length));
    }
  }

  return (
    <div className={className ? `lb-sortable ${className}` : "lb-sortable"}>
      <p id={`lb-sortable-${label.replace(/\W+/g, "-")}`} className="lb-sr-only">
        {messages.instructions}
      </p>
      <ul ref={list} aria-label={label} className="lb-sortable__list">
        {items.map((item) => (
          <li key={item.id} data-lb-grabbed={grabbed === item.id || undefined} className="lb-sortable__item">
            <button
              ref={(el) => {
                if (el) refs.current.set(item.id, el);
                else refs.current.delete(item.id);
              }}
              type="button"
              className="lb-sortable__handle"
              aria-label={messages.handle(item.label)}
              aria-pressed={grabbed === item.id}
              aria-describedby={`lb-sortable-${label.replace(/\W+/g, "-")}`}
              onKeyDown={(event) => onKeyDown(event, item)}
              onPointerDown={(event) => onPointerDown(event, item)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onBlur={() => !dragging.current && setGrabbed(null)}
            >
              <span aria-hidden="true">{"⋮⋮"}</span>
            </button>
            <div className="lb-sortable__content">{renderItem ? renderItem(item) : item.label}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
