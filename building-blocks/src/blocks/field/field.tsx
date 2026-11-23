"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

type Shared = {
  label: string;
  hint?: string;
  /** Shown under the field and announced with it. Setting it also marks the field invalid. */
  error?: string;
  /** Read by assistive technology before the error text. Translate it for your language. */
  errorPrefix?: string;
};

function describedBy(...ids: (string | false | undefined)[]) {
  const list = ids.filter(Boolean).join(" ");
  return list || undefined;
}

function Frame({ label, required, id, hint, hintId, error, errorId, errorPrefix = "Error:", extra, children }: Shared & { required?: boolean; id: string; hintId: string; errorId: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div className="lb-field" data-lb-invalid={error ? "true" : undefined}>
      <label htmlFor={id} className="lb-field__label">
        {label}
        {required ? (
          <span aria-hidden="true" className="lb-field__required">
            {" "}
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint ? (
        <p id={hintId} className="lb-field__hint">
          {hint}
        </p>
      ) : null}
      {extra}
      {error ? (
        <p id={errorId} className="lb-field__error" data-lb-error="">
          <span className="lb-sr-only">{errorPrefix} </span>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & Shared & { id?: string; revealLabels?: { show: string; hide: string } };

/** A labelled text input. A password field gets a Show/Hide button; the label, hint and error are all tied to the input. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, errorPrefix, id: idProp, required, type = "text", revealLabels = { show: "Show", hide: "Hide" }, className, ...rest },
  ref,
) {
  const auto = useId();
  const id = idProp ?? `${auto}-field`;
  const [shown, setShown] = useState(false);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const reveal = type === "password";
  return (
    <Frame {...{ label, hint, error, errorPrefix, required, id, hintId, errorId }}>
      <div className="lb-field__row">
        <input
          {...rest}
          ref={ref}
          id={id}
          type={reveal && shown ? "text" : type}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(hint && hintId, error && errorId)}
          className={className ? `lb-field__control ${className}` : "lb-field__control"}
        />
        {reveal ? (
          <button type="button" className="lb-field__reveal" aria-pressed={shown} aria-controls={id} onClick={() => setShown((s) => !s)}>
            {shown ? revealLabels.hide : revealLabels.show}
          </button>
        ) : null}
      </div>
    </Frame>
  );
});

export type TextAreaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & Shared & { id?: string; showCount?: boolean };

/** A labelled textarea with an optional character counter (kept out of the live region so it does not chatter). */
export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField(
  { label, hint, error, errorPrefix, id: idProp, required, showCount, maxLength, onChange, className, ...rest },
  ref,
) {
  const auto = useId();
  const id = idProp ?? `${auto}-field`;
  const [length, setLength] = useState(String(rest.defaultValue ?? rest.value ?? "").length);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const countId = `${id}-count`;
  const counting = showCount && maxLength !== undefined;
  return (
    <Frame
      {...{ label, hint, error, errorPrefix, required, id, hintId, errorId }}
      extra={counting ? <p id={countId} className="lb-field__count" data-lb-count="">{`${length} / ${maxLength}`}</p> : null}
    >
      <textarea
        {...rest}
        ref={ref}
        id={id}
        required={required}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint && hintId, counting && countId, error && errorId)}
        className={className ? `lb-field__control ${className}` : "lb-field__control"}
        onChange={(event) => {
          setLength(event.target.value.length);
          onChange?.(event);
        }}
      />
    </Frame>
  );
});

export type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & Shared & { id?: string };

/** A labelled native <select>. Prefer this over a custom listbox unless you need search or rich options. */
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, hint, error, errorPrefix, id: idProp, required, className, children, ...rest },
  ref,
) {
  const auto = useId();
  const id = idProp ?? `${auto}-field`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <Frame {...{ label, hint, error, errorPrefix, required, id, hintId, errorId }}>
      <select
        {...rest}
        ref={ref}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint && hintId, error && errorId)}
        className={className ? `lb-field__control ${className}` : "lb-field__control"}
      >
        {children}
      </select>
    </Frame>
  );
});
