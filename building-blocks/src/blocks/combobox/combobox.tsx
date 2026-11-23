"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { announce } from "../../core/announcer";
import { nextIndex } from "../../core/roving";
import { useControllable } from "../../core/use";

export type ComboOption = { value: string; label: string; disabled?: boolean };

export type ComboboxProps = {
  label: string;
  options: ComboOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string | undefined) => void;
  placeholder?: string;
  hint?: string;
  /** Shown instead of the list when nothing matches. Translate it. */
  emptyLabel?: string;
  /** Shows a loading message instead of options, for options that come from a server. */
  loading?: boolean;
  loadingLabel?: string;
  /** Spoken when the list opens or changes: `${n} results`. Translate it. */
  resultsLabel?: (count: number) => string;
  /** Called with the typed text, for options that are filtered on a server. Without it the options are filtered here. */
  onInputChange?: (text: string) => void;
  id?: string;
  className?: string;
};

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * The WAI-ARIA combobox with a listbox: type to filter, arrows move through the options (focus stays in the input),
 * Enter chooses, Escape closes (and, when closed, clears), and the number of results is announced.
 */
export function Combobox({
  label, options, value, defaultValue, onValueChange, placeholder, hint, emptyLabel = "No results", loading = false, loadingLabel = "Loading",
  resultsLabel = (n) => `${n} results`, onInputChange, id: idProp, className,
}: ComboboxProps) {
  const auto = useId();
  const id = idProp ?? `${auto}-combo`;
  const [selected, setSelected] = useControllable<string | undefined>(value, defaultValue, onValueChange);
  const labelOf = (v: string | undefined) => options.find((o) => o.value === v)?.label ?? "";
  const [text, setText] = useState(labelOf(selected));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);

  // Typing filters; just after choosing, the whole list stays available.
  const filtered = useMemo(() => {
    if (onInputChange || text === labelOf(selected)) return options;
    return options.filter((o) => plain(o.label).includes(plain(text)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, text, selected, onInputChange]);
  const enabled = (i: number) => !filtered[i]?.disabled;
  const firstEnabled = () => filtered.findIndex((o) => !o.disabled);

  useEffect(() => {
    if (open && !loading) announce(filtered.length ? resultsLabel(filtered.length) : emptyLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filtered.length, loading]);

  function choose(index: number) {
    const option = filtered[index];
    if (!option || option.disabled) return;
    setSelected(option.value);
    setText(option.label);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        const start = filtered.findIndex((o) => o.value === selected && !o.disabled);
        setActive(start >= 0 ? start : event.key === "ArrowDown" ? firstEnabled() : filtered.map((_, i) => i).filter(enabled).at(-1) ?? -1);
        return;
      }
      setActive(nextIndex(active, event.key, filtered.length, { orientation: "vertical", skip: (i) => !enabled(i) }));
    } else if (event.key === "Enter" && open && active >= 0) {
      event.preventDefault();
      choose(active);
    } else if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
        setActive(-1);
      } else if (text) {
        event.preventDefault();
        setText("");
        setSelected(undefined);
      }
    } else if (event.key === "Tab") setOpen(false);
  }

  const listId = `${id}-list`;
  return (
    <div className={className ? `lb-combobox ${className}` : "lb-combobox"}>
      <label htmlFor={id} className="lb-combobox__label">
        {label}
      </label>
      <input
        ref={input}
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
        placeholder={placeholder}
        value={text}
        className="lb-combobox__input"
        onChange={(event) => {
          setText(event.target.value);
          onInputChange?.(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          setOpen(false);
          setActive(-1);
          // Leaving the field with text that is not a choice goes back to the last choice.
          if (!filtered.some((o) => o.label === text) || text !== labelOf(selected)) setText(labelOf(selected));
        }}
      />
      {hint ? (
        <p id={`${id}-hint`} className="lb-combobox__hint">
          {hint}
        </p>
      ) : null}
      {open ? (
        <div className="lb-combobox__popup">
          {loading ? (
            <p role="status" className="lb-combobox__status">
              {loadingLabel}
            </p>
          ) : filtered.length === 0 ? (
            <p role="status" className="lb-combobox__status">
              {emptyLabel}
            </p>
          ) : (
            <ul id={listId} role="listbox" aria-label={label} className="lb-combobox__list">
              {filtered.map((option, index) => (
                <li
                  key={option.value}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={option.value === selected}
                  aria-disabled={option.disabled || undefined}
                  data-lb-active={index === active ? "true" : undefined}
                  className="lb-combobox__option"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(index)}
                >
                  {option.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
