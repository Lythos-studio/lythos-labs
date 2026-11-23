"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { forwardRef, useEffect, useId, useRef, type InputHTMLAttributes, type ReactNode } from "react";

type Shared = { label: ReactNode; hint?: string };

/** A native checkbox with a clickable label. `indeterminate` is a property of the DOM element, so it is set in an effect. */
export const Checkbox = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & Shared & { indeterminate?: boolean }>(function Checkbox(
  { label, hint, indeterminate = false, id: idProp, className, ...rest },
  forwarded,
) {
  const auto = useId();
  const id = idProp ?? `${auto}-check`;
  const inner = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (inner.current) inner.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <div className={className ? `lb-choice ${className}` : "lb-choice"}>
      <input
        {...rest}
        id={id}
        type="checkbox"
        ref={(el) => {
          inner.current = el;
          if (typeof forwarded === "function") forwarded(el);
          else if (forwarded) forwarded.current = el;
        }}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="lb-choice__input"
      />
      <label htmlFor={id} className="lb-choice__label">
        {label}
        {hint ? (
          <span id={`${id}-hint`} className="lb-choice__hint">
            {hint}
          </span>
        ) : null}
      </label>
    </div>
  );
});

/** A switch: a native checkbox with role="switch", so it toggles with Space and reports on/off, not checked/unchecked. */
export const Switch = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role"> & Shared>(function Switch(
  { label, hint, id: idProp, className, ...rest },
  ref,
) {
  const auto = useId();
  const id = idProp ?? `${auto}-switch`;
  return (
    <div className={className ? `lb-choice lb-choice--switch ${className}` : "lb-choice lb-choice--switch"}>
      <input {...rest} id={id} ref={ref} type="checkbox" role="switch" aria-describedby={hint ? `${id}-hint` : undefined} className="lb-choice__input" />
      <label htmlFor={id} className="lb-choice__label">
        {label}
        {hint ? (
          <span id={`${id}-hint`} className="lb-choice__hint">
            {hint}
          </span>
        ) : null}
      </label>
    </div>
  );
});

export type RadioOption = { value: string; label: ReactNode; hint?: string; disabled?: boolean };

/**
 * A group of native radio buttons in a fieldset with a legend. The arrow keys and the single tab stop come from the browser.
 * Give it `value` and `onValueChange` to control it, or `defaultValue` to let it manage itself.
 */
export function RadioGroup({
  legend,
  name,
  options,
  value,
  defaultValue,
  onValueChange,
  error,
  className,
}: {
  legend: string;
  name: string;
  options: RadioOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  error?: string;
  className?: string;
}) {
  const auto = useId();
  return (
    <fieldset className={className ? `lb-radiogroup ${className}` : "lb-radiogroup"} aria-describedby={error ? `${auto}-error` : undefined} aria-invalid={error ? true : undefined}>
      <legend className="lb-radiogroup__legend">{legend}</legend>
      {options.map((option) => {
        const id = `${auto}-${option.value}`;
        return (
          <div key={option.value} className="lb-choice">
            <input
              id={id}
              type="radio"
              name={name}
              value={option.value}
              disabled={option.disabled}
              checked={value === undefined ? undefined : value === option.value}
              defaultChecked={value === undefined ? defaultValue === option.value : undefined}
              onChange={() => onValueChange?.(option.value)}
              aria-describedby={option.hint ? `${id}-hint` : undefined}
              className="lb-choice__input"
            />
            <label htmlFor={id} className="lb-choice__label">
              {option.label}
              {option.hint ? (
                <span id={`${id}-hint`} className="lb-choice__hint">
                  {option.hint}
                </span>
              ) : null}
            </label>
          </div>
        );
      })}
      {error ? (
        <p id={`${auto}-error`} className="lb-radiogroup__error">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
