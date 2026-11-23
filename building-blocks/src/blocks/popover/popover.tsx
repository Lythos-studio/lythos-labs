"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useId, useRef, useState, type ReactNode } from "react";
import { computePosition, type Placement } from "../../core/position";

export type PopoverProps = {
  /** The content of the button that opens the popover. */
  trigger: ReactNode;
  children: ReactNode;
  /** The name of the popover for assistive technology. */
  label: string;
  placement?: Placement;
  className?: string;
};

/**
 * A popover on the native `popover` attribute: the browser handles the top layer, light dismiss (click outside) and Escape.
 * This adds the button wiring (aria-expanded, aria-controls), positioning next to the button, and focus into and out of the popover.
 */
export function Popover({ trigger, children, label, placement = "bottom", className }: PopoverProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  function place() {
    const b = button.current;
    const p = panel.current;
    if (!b || !p) return;
    const anchor = b.getBoundingClientRect();
    const size = p.getBoundingClientRect();
    const pos = computePosition(anchor, size, { width: window.innerWidth, height: window.innerHeight }, placement, { align: "start" });
    p.style.left = `${pos.x}px`;
    p.style.top = `${pos.y}px`;
    p.setAttribute("data-lb-placed", "true");
  }

  return (
    <span className={className ? `lb-popover-root ${className}` : "lb-popover-root"}>
      <button ref={button} type="button" className="lb-popover__trigger" popoverTarget={id} aria-expanded={open} aria-controls={id} aria-haspopup="dialog">
        {trigger}
      </button>
      <div
        ref={panel}
        id={id}
        popover="auto"
        role="dialog"
        aria-label={label}
        className="lb-popover"
        onToggle={(event) => {
          const isOpen = (event as unknown as { newState: string }).newState === "open";
          setOpen(isOpen);
          if (isOpen) {
            place();
            panel.current?.querySelector<HTMLElement>("a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])")?.focus();
          } else panel.current?.removeAttribute("data-lb-placed");
        }}
      >
        {children}
      </div>
    </span>
  );
}
