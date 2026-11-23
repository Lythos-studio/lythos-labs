"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "../button/button";

let locks = 0;
function lockScroll(on: boolean) {
  locks += on ? 1 : -1;
  document.documentElement.style.overflow = locks > 0 ? "hidden" : "";
}

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The name of the dialog. Required: a dialog without a name is announced as just "dialog". */
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** "alertdialog" is for a message that needs a decision (confirmation). */
  role?: "dialog" | "alertdialog";
  /** Spoken name of the close button. Translate it. */
  closeLabel?: string;
  /** Clicking outside the box closes the dialog. */
  closeOnBackdrop?: boolean;
  placement?: "center" | "end" | "start" | "bottom";
  /** A selector for the element that should get focus when the dialog opens (default: the browser picks the first focusable). */
  initialFocus?: string;
  className?: string;
};

/**
 * A modal dialog on the native <dialog> element. The browser traps focus, makes the page behind it inert, closes on Escape
 * and returns focus to what opened it. This adds the name, the close button, scroll lock, backdrop click and placements.
 */
export function Dialog({
  open, onOpenChange, title, description, children, footer, role = "dialog", closeLabel = "Close", closeOnBackdrop = true, placement = "center", initialFocus, className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    if (!dialog.open) dialog.showModal();
    if (initialFocus) dialog.querySelector<HTMLElement>(initialFocus)?.focus();
    lockScroll(true);
    return () => {
      lockScroll(false);
      if (dialog.open) dialog.close();
    };
  }, [open, initialFocus]);

  return (
    <dialog
      ref={ref}
      role={role}
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
      className={className ? `lb-dialog ${className}` : "lb-dialog"}
      data-lb-placement={placement}
      // React lets a nested dialog's close event bubble to this one; only react to our own.
      onClose={(event) => event.target === event.currentTarget && open && onOpenChange(false)}
      onClick={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <div className="lb-dialog__box">
        <div className="lb-dialog__header">
          <h2 id={`${id}-title`} className="lb-dialog__title">
            {title}
          </h2>
          <button type="button" className="lb-dialog__close" aria-label={closeLabel} onClick={() => onOpenChange(false)}>
            <span aria-hidden="true">×</span>
          </button>
        </div>
        {description ? (
          <div id={`${id}-description`} className="lb-dialog__description">
            {description}
          </div>
        ) : null}
        <div className="lb-dialog__body">{children}</div>
        {footer ? <div className="lb-dialog__footer">{footer}</div> : null}
      </div>
    </dialog>
  );
}

/** A dialog that slides in from the side (or the bottom on small screens). */
export function Drawer(props: DialogProps) {
  return <Dialog {...props} placement={props.placement ?? "end"} />;
}

/** Asks for a decision. The least destructive button (Cancel) gets focus, and Escape or Cancel never confirms. */
export function ConfirmDialog({
  open, onOpenChange, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", tone = "default", onConfirm, closeLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  onConfirm: () => void;
  closeLabel?: string;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={message}
      role="alertdialog"
      closeLabel={closeLabel}
      closeOnBackdrop={false}
      initialFocus="[data-lb-cancel]"
      footer={
        <>
          <Button data-lb-cancel="" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
