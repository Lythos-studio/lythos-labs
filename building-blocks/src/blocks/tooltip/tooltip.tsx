"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { cloneElement, useEffect, useId, useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactElement, type ReactNode } from "react";
import { computePosition, type Placement } from "../../core/position";

export type TooltipProps = {
  /** The text of the tooltip. Keep it short and never put essential information only here. */
  content: ReactNode;
  /** One focusable element: a button, a link or an input. */
  children: ReactElement<HTMLAttributes<HTMLElement>>;
  /** Milliseconds before a hover opens it. Focus opens it at once. */
  delay?: number;
  placement?: Placement;
};

/**
 * The WAI-ARIA tooltip: shown on focus and on hover, dismissed with Escape, and hoverable (moving the pointer onto the
 * tooltip keeps it open), as WCAG 1.4.13 asks. While open it is the description of the element.
 */
export function Tooltip({ content, children, delay = 300, placement = "top" }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const later = (next: boolean, ms: number) => {
    clearTimeout(timer.current);
    if (ms <= 0) setOpen(next);
    else timer.current = setTimeout(() => setOpen(next), ms);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  useLayoutEffect(() => {
    if (!open || !wrap.current || !tip.current) return;
    const pos = computePosition(wrap.current.getBoundingClientRect(), tip.current.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight }, placement);
    tip.current.style.left = `${pos.x}px`;
    tip.current.style.top = `${pos.y}px`;
    tip.current.style.visibility = "visible";
  }, [open, placement]);

  return (
    <span
      ref={wrap}
      className="lb-tooltip-wrap"
      onMouseEnter={() => later(true, delay)}
      onMouseLeave={() => later(false, 150)}
      onFocus={() => later(true, 0)}
      onBlur={() => later(false, 0)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          later(false, 0);
          event.stopPropagation();
        }
      }}
    >
      {cloneElement(children, { "aria-describedby": open ? id : children.props["aria-describedby"] })}
      {open ? (
        <span ref={tip} role="tooltip" id={id} className="lb-tooltip" style={{ visibility: "hidden" }}>
          {content}
        </span>
      ) : null}
    </span>
  );
}
