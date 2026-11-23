"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useEffect, useId, useRef, useState } from "react";
import { announce } from "../../core/announcer";
import { useControllable } from "../../core/use";

export type InlineEditProps = {
  /** Name of the value, e.g. "Project title". Used for the input label and the Edit button. */
  label: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Return an error message to refuse a value; the field stays open. */
  validate?: (value: string) => string | undefined;
  placeholder?: string;
  messages?: { edit: (label: string) => string; save: string; cancel: string; saved: (label: string) => string; cancelled: string; empty: string };
  className?: string;
};

const defaults = { edit: (l: string) => `Edit ${l}`, save: "Save", cancel: "Cancel", saved: (l: string) => `${l} saved`, cancelled: "Edit cancelled", empty: "Not set" };

/**
 * Text you can change in place. Reading mode is plain text plus an Edit button; editing mode is a real input with
 * Save and Cancel. Enter saves, Escape cancels, and focus always lands somewhere sensible afterwards.
 */
export function InlineEdit({ label, value, defaultValue = "", onValueChange, validate, placeholder, messages = defaults, className }: InlineEditProps) {
  const id = useId();
  const [saved, setSaved] = useControllable<string>(value, defaultValue, onValueChange);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(saved);
  const [error, setError] = useState<string | undefined>();
  const input = useRef<HTMLInputElement>(null);
  const edit = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  useEffect(() => {
    if (editing) {
      input.current?.focus();
      input.current?.select();
    } else if (wasEditing.current) edit.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  function commit() {
    const problem = validate?.(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setSaved(draft);
    setError(undefined);
    setEditing(false);
    announce(messages.saved(label));
  }

  function cancel() {
    setDraft(saved);
    setError(undefined);
    setEditing(false);
    announce(messages.cancelled);
  }

  if (!editing) {
    return (
      <div className={className ? `lb-inline ${className}` : "lb-inline"}>
        <span className="lb-inline__value" data-empty={saved ? undefined : "true"}>
          {saved || placeholder || messages.empty}
        </span>
        <button
          ref={edit}
          type="button"
          className="lb-inline__edit"
          onClick={() => {
            setDraft(saved);
            setEditing(true);
          }}
        >
          {messages.edit(label)}
        </button>
      </div>
    );
  }

  return (
    <form
      className={className ? `lb-inline lb-inline--editing ${className}` : "lb-inline lb-inline--editing"}
      onSubmit={(event) => {
        event.preventDefault();
        commit();
      }}
    >
      <label htmlFor={`${id}-input`} className="lb-sr-only">
        {label}
      </label>
      <input
        ref={input}
        id={`${id}-input`}
        className="lb-inline__input"
        value={draft}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            cancel();
          }
        }}
      />
      <button type="submit" className="lb-inline__btn lb-inline__btn--primary">
        {messages.save}
      </button>
      <button type="button" className="lb-inline__btn" onClick={cancel}>
        {messages.cancel}
      </button>
      {error ? (
        <p id={`${id}-error`} className="lb-inline__error" data-lb-error="">
          {error}
        </p>
      ) : null}
    </form>
  );
}
