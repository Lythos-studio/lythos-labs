"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { HTMLAttributes, ReactNode } from "react";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const TONE_WORDS: Record<Exclude<Tone, "neutral">, string> = { info: "Information", success: "Success", warning: "Warning", danger: "Error" };

/**
 * A message in the page. Urgent tones (warning, danger) use role="alert" so they are read out when they appear; the others use
 * role="status". The tone is also given as hidden text, so it does not depend on colour. Pass `toneLabel` to translate it.
 */
export function Alert({ tone = "info", title, children, toneLabel, onDismiss, dismissLabel = "Dismiss", className }: {
  tone?: Exclude<Tone, "neutral">;
  title?: string;
  children?: ReactNode;
  toneLabel?: string;
  onDismiss?: () => void;
  dismissLabel?: string;
  className?: string;
}) {
  return (
    <div className={className ? `lb-alert ${className}` : "lb-alert"} data-lb-tone={tone} role={tone === "danger" || tone === "warning" ? "alert" : "status"}>
      <span className="lb-alert__mark" aria-hidden="true" />
      <div className="lb-alert__body">
        <span className="lb-sr-only">{toneLabel ?? TONE_WORDS[tone]}: </span>
        {title ? <strong className="lb-alert__title">{title}</strong> : null}
        {children ? <div className="lb-alert__text">{children}</div> : null}
      </div>
      {onDismiss ? (
        <button type="button" className="lb-alert__dismiss" aria-label={dismissLabel} onClick={onDismiss}>
          <span aria-hidden="true">×</span>
        </button>
      ) : null}
    </div>
  );
}

/** A side note in the flow of the page: a landmark-free `aside` with its own heading. */
export function Callout({ title, headingLevel = 3, children, className }: { title: string; headingLevel?: 2 | 3 | 4 | 5 | 6; children: ReactNode; className?: string }) {
  const Heading = `h${headingLevel}` as "h3";
  return (
    <aside className={className ? `lb-callout ${className}` : "lb-callout"}>
      <Heading className="lb-callout__title">{title}</Heading>
      <div>{children}</div>
    </aside>
  );
}

/** A short status label. The tone changes the colour and the text says what it means, so colour is never the only signal. */
export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={className ? `lb-badge ${className}` : "lb-badge"} data-lb-tone={tone}>
      {children}
    </span>
  );
}

/** A native <progress> with a visible label. Leave out `value` for an indeterminate progress. */
export function Progress({ label, value, max = 100, showValue = true, className }: { label: string; value?: number; max?: number; showValue?: boolean; className?: string }) {
  const known = value !== undefined;
  return (
    <div className={className ? `lb-progress ${className}` : "lb-progress"}>
      <div className="lb-progress__head">
        <span className="lb-progress__label">{label}</span>
        {known && showValue ? <span className="lb-progress__value">{Math.round((value / max) * 100)}%</span> : null}
      </div>
      <progress className="lb-progress__bar" aria-label={label} value={known ? value : undefined} max={max} />
    </div>
  );
}

/** A spinning circle with a text for screen readers. The spin stops when the visitor asks for less motion. */
export function Spinner({ label = "Loading", className, ...rest }: { label?: string } & Omit<HTMLAttributes<HTMLSpanElement>, "children">) {
  return (
    <span {...rest} role="status" className={className ? `lb-spinner ${className}` : "lb-spinner"}>
      <span className="lb-spinner__circle" aria-hidden="true" />
      <span className="lb-sr-only">{label}</span>
    </span>
  );
}

/**
 * Placeholder shapes while content loads. They are hidden from assistive technology; put aria-busy="true" on the region that
 * is loading and tell the visitor with a Spinner label or a status message.
 */
export function Skeleton({ lines = 3, shape = "text", className }: { lines?: number; shape?: "text" | "circle" | "block"; className?: string }) {
  if (shape !== "text") return <span aria-hidden="true" className={className ? `lb-skeleton lb-skeleton--${shape} ${className}` : `lb-skeleton lb-skeleton--${shape}`} />;
  return (
    <span aria-hidden="true" className={className ? `lb-skeleton-lines ${className}` : "lb-skeleton-lines"}>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="lb-skeleton" style={{ width: i === lines - 1 ? "60%" : "100%" }} />
      ))}
    </span>
  );
}
