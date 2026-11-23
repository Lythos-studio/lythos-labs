"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { announce } from "../../core/announcer";
import { nextIndex } from "../../core/roving";
import { useControllable } from "../../core/use";

export type Command = { id: string; label: string; hint?: string; group?: string; onSelect: () => void };

export type CommandPaletteProps = {
  commands: Command[];
  /** The name of the dialog. Translate it. */
  label?: string;
  placeholder?: string;
  emptyLabel?: string;
  resultsLabel?: (count: number) => string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Ctrl+K (Cmd+K on a Mac) and openCommandPalette() control this palette. Use on one palette per page. */
  shortcut?: boolean;
};

/** Opens the palette from a button elsewhere on the page. */
export const openCommandPalette = () => window.dispatchEvent(new Event("lb:command-palette"));

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** A searchable list of actions in a native modal dialog. Focus stays in the search field while arrows move through the results. */
export function CommandPalette({ commands, label = "Command palette", placeholder = "Type a command", emptyLabel = "No matching commands", resultsLabel = (n) => `${n} results`, open, defaultOpen = false, onOpenChange, shortcut = true }: CommandPaletteProps) {
  const base = useId();
  const [isOpen, setOpen] = useControllable(open, defaultOpen, onOpenChange);
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const results = useMemo(() => commands.filter((c) => plain(`${c.label} ${c.hint ?? ""} ${c.group ?? ""}`).includes(plain(text))), [commands, text]);
  const groups = useMemo(() => {
    const out: { name: string; items: { command: Command; index: number }[] }[] = [];
    results.forEach((command, index) => {
      const name = command.group ?? "";
      const group = out.find((g) => g.name === name) ?? (out.push({ name, items: [] }), out[out.length - 1]);
      group.items.push({ command, index });
    });
    return out;
  }, [results]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (isOpen && !d.open) {
      setText("");
      setActive(0);
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      d.showModal();
      input.current?.focus();
    } else if (!isOpen && d.open) d.close();
    if (!isOpen) opener.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(!isOpen);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("lb:command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("lb:command-palette", onOpen);
    };
  }, [shortcut, isOpen, setOpen]);

  useEffect(() => {
    if (isOpen) announce(results.length ? resultsLabel(results.length) : emptyLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, results.length]);

  function run(index: number) {
    const command = results[index];
    if (!command) return;
    setOpen(false);
    command.onSelect();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActive(nextIndex(active, event.key, results.length, { orientation: "vertical" }));
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(active);
    }
  }

  return (
    <dialog
      ref={dialog}
      role="dialog"
      aria-label={label}
      className="lb-palette"
      onClose={(event) => event.target === event.currentTarget && isOpen && setOpen(false)}
      onClick={(event) => event.target === event.currentTarget && setOpen(false)}
    >
      <div className="lb-palette__box">
        <input
          ref={input}
          type="text"
          role="combobox"
          aria-label={placeholder}
          aria-expanded={results.length > 0}
          aria-controls={`${base}-list`}
          aria-autocomplete="list"
          aria-activedescendant={results.length ? `${base}-option-${active}` : undefined}
          autoComplete="off"
          placeholder={placeholder}
          value={text}
          className="lb-palette__input"
          onChange={(event) => {
            setText(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        {results.length ? (
          <div id={`${base}-list`} role="listbox" aria-label={label} className="lb-palette__list">
            {groups.map((group) => (
              <div key={group.name} role="group" aria-label={group.name || undefined} className="lb-palette__group">
                {group.name ? (
                  <div className="lb-palette__group-name" aria-hidden="true">
                    {group.name}
                  </div>
                ) : null}
                {group.items.map(({ command, index }) => (
                  <div
                    key={command.id}
                    id={`${base}-option-${index}`}
                    role="option"
                    aria-selected={index === active}
                    className="lb-palette__option"
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseMove={() => setActive(index)}
                    onClick={() => run(index)}
                  >
                    <span>{command.label}</span>
                    {command.hint ? <span className="lb-palette__hint">{command.hint}</span> : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <p role="status" className="lb-palette__empty">
            {emptyLabel}
          </p>
        )}
      </div>
    </dialog>
  );
}
