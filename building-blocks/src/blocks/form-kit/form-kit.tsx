"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useEffect, useRef } from "react";

export type Rule<V> = {
  required?: string;
  minLength?: [number, string];
  maxLength?: [number, string];
  pattern?: [RegExp, string];
  /** Return an error message, or undefined when the value is fine. */
  custom?: (value: V) => string | undefined;
};

export type FormError = { field: string; message: string };

/** Pure validation: values and rules in, a list of errors out (in the order of the rules). Safe to run on the server too. */
export function validate<T extends Record<string, string>>(values: T, rules: { [K in keyof T]?: Rule<string> }): FormError[] {
  const errors: FormError[] = [];
  for (const field of Object.keys(rules) as (keyof T & string)[]) {
    const rule = rules[field];
    if (!rule) continue;
    const value = (values[field] ?? "").trim();
    const fail = (message: string | undefined) => message && errors.push({ field, message });
    if (rule.required && !value) fail(rule.required);
    else if (value) {
      if (rule.minLength && value.length < rule.minLength[0]) fail(rule.minLength[1]);
      else if (rule.maxLength && value.length > rule.maxLength[0]) fail(rule.maxLength[1]);
      else if (rule.pattern && !rule.pattern[0].test(value)) fail(rule.pattern[1]);
      else if (rule.custom) fail(rule.custom(value));
    }
  }
  return errors;
}

export type ErrorSummaryProps = {
  errors: FormError[];
  /** Id of each field, by field name, so each message can link to its input. Defaults to the field name. */
  fieldIds?: Record<string, string>;
  title?: (count: number) => string;
  className?: string;
};

/**
 * The error summary pattern: after a failed submit, a summary at the top takes focus, says how many problems there are
 * and links each one to its field. The fields keep their own inline error for the person who is already there.
 */
export function ErrorSummary({ errors, fieldIds = {}, title = (n) => (n === 1 ? "There is 1 problem" : `There are ${n} problems`), className }: ErrorSummaryProps) {
  const box = useRef<HTMLDivElement>(null);
  const key = errors.map((e) => `${e.field}:${e.message}`).join("|");

  useEffect(() => {
    if (errors.length) box.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!errors.length) return null;
  return (
    <div ref={box} tabIndex={-1} role="alert" aria-labelledby="lb-errorsummary-title" className={className ? `lb-errorsummary ${className}` : "lb-errorsummary"}>
      <h2 id="lb-errorsummary-title" className="lb-errorsummary__title">
        {title(errors.length)}
      </h2>
      <ul className="lb-errorsummary__list">
        {errors.map((e) => (
          <li key={e.field}>
            <a
              href={`#${fieldIds[e.field] ?? e.field}`}
              onClick={(event) => {
                const el = document.getElementById(fieldIds[e.field] ?? e.field);
                if (el) {
                  event.preventDefault();
                  el.focus();
                }
              }}
            >
              {e.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
