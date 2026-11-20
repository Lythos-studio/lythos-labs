/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type Base = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and ignores clicks, but keeps focus (the button stays focusable, unlike `disabled`). */
  loading?: boolean;
};

/** A native <button>. `type` defaults to "button" so it never submits a form by accident. */
export const Button = forwardRef<HTMLButtonElement, Base & { children: ReactNode }>(function Button(
  { variant = "secondary", size = "md", loading = false, type = "button", onClick, className, children, ...rest },
  ref,
) {
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={className ? `lb-button ${className}` : "lb-button"}
      data-lb-variant={variant}
      data-lb-size={size}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={(event) => {
        if (loading) event.preventDefault();
        else onClick?.(event);
      }}
    >
      {loading ? <span className="lb-button__spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
});

/** A button with only an icon. The accessible name is required, so an unlabeled icon button does not compile. */
export const IconButton = forwardRef<HTMLButtonElement, Base & { label: string; children: ReactNode }>(function IconButton(
  { label, children, className, ...rest },
  ref,
) {
  return (
    <Button {...rest} ref={ref} aria-label={label} className={className ? `lb-button--icon ${className}` : "lb-button--icon"}>
      <span aria-hidden="true" className="lb-button__icon">
        {children}
      </span>
    </Button>
  );
});
