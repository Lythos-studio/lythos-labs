"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { announce } from "../../core/announcer";
import { addDays, addMonths, clamp, compare, fromIso, monthGrid, sameDay, toIso, type Ymd } from "../../core/date";
import { useControllable } from "../../core/use";

export type CalendarProps = {
  /** ISO date, YYYY-MM-DD. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  min?: string;
  max?: string;
  locale?: string;
  label?: string;
  previousMonthLabel?: string;
  nextMonthLabel?: string;
  /** For testing and demos: the date treated as today. */
  today?: string;
  className?: string;
};

const todayYmd = (): Ymd => {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
};

/**
 * A month grid you move through with the keyboard: arrows by day and week, Home and End within the week,
 * Page Up and Page Down by month (with Shift by year). One day is in the tab order at a time.
 */
export function Calendar({ value, defaultValue, onValueChange, min, max, locale = "en", label = "Calendar", previousMonthLabel = "Previous month", nextMonthLabel = "Next month", today, className }: CalendarProps) {
  const [chosen, setChosen] = useControllable<string>(value, defaultValue ?? "", onValueChange);
  const selected = fromIso(chosen);
  const minD = min ? fromIso(min) ?? undefined : undefined;
  const maxD = max ? fromIso(max) ?? undefined : undefined;
  const now = (today ? fromIso(today) : null) ?? todayYmd();
  const [focus, setFocus] = useState<Ymd>(selected ?? clamp(now, minD, maxD));
  const root = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const id = useId();

  const monthName = useMemo(() => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }), [locale]);
  const dayName = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }), [locale]);
  const weekdays = useMemo(() => {
    const short = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
    const long = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" });
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.UTC(2024, 0, 1 + i)); // 1 Jan 2024 is a Monday
      return { short: short.format(d), long: long.format(d) };
    });
  }, [locale]);

  const grid = monthGrid(focus.y, focus.m);
  const title = monthName.format(new Date(Date.UTC(focus.y, focus.m - 1, 1)));
  const disabled = (d: Ymd) => (minD && compare(d, minD) < 0) || (maxD && compare(d, maxD) > 0);

  useEffect(() => {
    if (moved.current) root.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
    moved.current = false;
  });

  function go(next: Ymd) {
    const target = clamp(next, minD, maxD);
    moved.current = true;
    if (target.m !== focus.m || target.y !== focus.y) announce(monthName.format(new Date(Date.UTC(target.y, target.m - 1, 1))));
    setFocus(target);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const week = (focus.d - 1 + new Date(Date.UTC(focus.y, focus.m - 1, 1)).getUTCDay() + 6) % 7;
    const next: Record<string, Ymd> = {
      ArrowLeft: addDays(focus, -1),
      ArrowRight: addDays(focus, 1),
      ArrowUp: addDays(focus, -7),
      ArrowDown: addDays(focus, 7),
      Home: addDays(focus, -(((focus.d - 1) + new Date(Date.UTC(focus.y, focus.m - 1, 1)).getUTCDay() + 6) % 7 === week ? week % 7 : 0)),
      End: addDays(focus, 6 - (week % 7)),
      PageUp: addMonths(focus, event.shiftKey ? -12 : -1),
      PageDown: addMonths(focus, event.shiftKey ? 12 : 1),
    };
    // Home and End are the first and last day of the week (Monday to Sunday).
    const weekday = (new Date(Date.UTC(focus.y, focus.m - 1, focus.d)).getUTCDay() + 6) % 7;
    next.Home = addDays(focus, -weekday);
    next.End = addDays(focus, 6 - weekday);
    if (next[event.key]) {
      event.preventDefault();
      go(next[event.key]);
    }
  }

  return (
    <div ref={root} className={className ? `lb-calendar ${className}` : "lb-calendar"} role="group" aria-label={label}>
      <div className="lb-calendar__bar">
        <button type="button" className="lb-calendar__nav" aria-label={previousMonthLabel} onClick={() => go(addMonths(focus, -1))}>
          <span aria-hidden="true">{"‹"}</span>
        </button>
        <div id={`${id}-title`} className="lb-calendar__title" aria-live="polite">
          {title}
        </div>
        <button type="button" className="lb-calendar__nav" aria-label={nextMonthLabel} onClick={() => go(addMonths(focus, 1))}>
          <span aria-hidden="true">{"›"}</span>
        </button>
      </div>
      <table role="grid" aria-labelledby={`${id}-title`} className="lb-calendar__grid" onKeyDown={onKeyDown}>
        <thead>
          <tr>
            {weekdays.map((w) => (
              <th key={w.long} scope="col" abbr={w.long}>
                {w.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((week, wi) => (
            <tr key={wi}>
              {week.map((day, di) =>
                day ? (
                  <td key={di} role="gridcell" aria-selected={sameDay(day, selected)}>
                    <button
                      type="button"
                      tabIndex={sameDay(day, focus) ? 0 : -1}
                      aria-label={dayName.format(new Date(Date.UTC(day.y, day.m - 1, day.d)))}
                      aria-current={sameDay(day, now) ? "date" : undefined}
                      aria-disabled={disabled(day) || undefined}
                      data-lb-today={sameDay(day, now) || undefined}
                      className="lb-calendar__day"
                      onClick={() => {
                        if (disabled(day)) return;
                        setChosen(toIso(day));
                        setFocus(day);
                      }}
                    >
                      {day.d}
                    </button>
                  </td>
                ) : (
                  <td key={di} role="gridcell" aria-hidden="true" />
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type DatePickerProps = Omit<CalendarProps, "label" | "className"> & {
  label: string;
  hint?: string;
  chooseLabel?: string;
  invalidLabel?: string;
  id?: string;
  className?: string;
};

/** A text field that takes YYYY-MM-DD, with a button that opens a Calendar. Typing always works; the calendar is a help. */
export function DatePicker({ label, hint = "Format: YYYY-MM-DD", chooseLabel = "Choose date", invalidLabel = "Enter a real date as YYYY-MM-DD", value, defaultValue, onValueChange, min, max, locale, today, previousMonthLabel, nextMonthLabel, id: idProp, className }: DatePickerProps) {
  const auto = useId();
  const id = idProp ?? `${auto}-date`;
  const [chosen, setChosen] = useControllable<string>(value, defaultValue ?? "", onValueChange);
  const [text, setText] = useState(chosen);
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const invalid = text !== "" && !fromIso(text);

  useEffect(() => setText(chosen), [chosen]);
  const popup = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) popup.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
  }, [open]);

  return (
    <div className={className ? `lb-datepicker ${className}` : "lb-datepicker"}>
      <label htmlFor={id} className="lb-datepicker__label">
        {label}
      </label>
      <div className="lb-datepicker__row">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="YYYY-MM-DD"
          value={text}
          aria-invalid={invalid || undefined}
          aria-describedby={`${id}-hint${invalid ? ` ${id}-error` : ""}`}
          className="lb-datepicker__input"
          onChange={(event) => {
            setText(event.target.value);
            const parsed = fromIso(event.target.value);
            if (parsed) setChosen(toIso(parsed));
          }}
        />
        <button ref={button} type="button" className="lb-datepicker__button" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}>
          {chooseLabel}
        </button>
      </div>
      <p id={`${id}-hint`} className="lb-datepicker__hint">
        {hint}
      </p>
      {invalid ? (
        <p id={`${id}-error`} className="lb-datepicker__error">
          {invalidLabel}
        </p>
      ) : null}
      {open ? (
        <div
          ref={popup}
          role="dialog"
          aria-label={label}
          className="lb-datepicker__popup"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setOpen(false);
              button.current?.focus();
            }
          }}
        >
          <Calendar
            label={`${label} calendar`}
            value={chosen}
            onValueChange={(v) => {
              setChosen(v);
              setOpen(false);
              button.current?.focus();
            }}
            min={min}
            max={max}
            locale={locale}
            today={today}
            previousMonthLabel={previousMonthLabel}
            nextMonthLabel={nextMonthLabel}
          />
        </div>
      ) : null}
    </div>
  );
}
