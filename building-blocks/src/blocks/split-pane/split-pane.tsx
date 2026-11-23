"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useId, useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { announce } from "../../core/announcer";
import { useControllable } from "../../core/use";

export type SplitPaneProps = {
  first: ReactNode;
  second: ReactNode;
  /** Size of the first pane as a percentage, 0 to 100. */
  size?: number;
  defaultSize?: number;
  onSizeChange?: (size: number) => void;
  min?: number;
  max?: number;
  /** Name of the separator, and of the first pane it controls. Required. */
  label: string;
  orientation?: "horizontal" | "vertical";
  step?: number;
  /** Spoken as the separator moves: `${size} percent`. */
  valueText?: (size: number) => string;
  className?: string;
};

/**
 * Two panes with a separator you can move: it is a focusable `separator` with aria-valuenow, so arrows resize it,
 * Home and End go to the limits, Enter collapses and restores, and a pointer can drag it.
 */
export function SplitPane({ first, second, size, defaultSize = 50, onSizeChange, min = 15, max = 85, label, orientation = "horizontal", step = 5, valueText = (n) => `${Math.round(n)} percent`, className }: SplitPaneProps) {
  const id = useId();
  const [value, setValue] = useControllable<number>(size, defaultSize, onSizeChange);
  const box = useRef<HTMLDivElement>(null);
  const before = useRef<number | null>(null);
  const vertical = orientation === "vertical";
  const set = (n: number) => setValue(Math.min(max, Math.max(min, n)));

  function onKeyDown(event: KeyboardEvent) {
    const grow = vertical ? "ArrowDown" : "ArrowRight";
    const shrink = vertical ? "ArrowUp" : "ArrowLeft";
    if (event.key === grow) set(value + step);
    else if (event.key === shrink) set(value - step);
    else if (event.key === "Home") set(min);
    else if (event.key === "End") set(max);
    else if (event.key === "Enter") {
      if (before.current === null) {
        before.current = value;
        set(min);
        announce(valueText(min));
      } else {
        set(before.current);
        announce(valueText(before.current));
        before.current = null;
      }
    } else return;
    event.preventDefault();
  }

  function onPointerMove(event: PointerEvent) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || !box.current) return;
    const r = box.current.getBoundingClientRect();
    set(vertical ? ((event.clientY - r.top) / r.height) * 100 : ((event.clientX - r.left) / r.width) * 100);
  }

  const template = `${value}% auto 1fr`;
  return (
    <div ref={box} className={className ? `lb-split ${className}` : "lb-split"} data-orientation={orientation} style={vertical ? { gridTemplateRows: template } : { gridTemplateColumns: template }}>
      <div id={`${id}-first`} className="lb-split__pane" role="region" aria-label={label}>
        {first}
      </div>
      <div
        role="separator"
        tabIndex={0}
        aria-orientation={vertical ? "horizontal" : "vertical"}
        aria-controls={`${id}-first`}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(value)}
        aria-valuetext={valueText(value)}
        className="lb-split__bar"
        onKeyDown={onKeyDown}
        onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
        onPointerMove={onPointerMove}
      />
      <div className="lb-split__pane">{second}</div>
    </div>
  );
}
