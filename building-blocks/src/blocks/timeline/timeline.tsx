"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useId, useState, type ReactNode } from "react";
import { announce } from "../../core/announcer";

export type TimelineItem = {
  id: string;
  /** ISO date or date-time. */
  time: string;
  title: string;
  description?: ReactNode;
  status?: "done" | "current" | "upcoming" | "failed";
};

export type TimelineProps = {
  items: TimelineItem[];
  label: string;
  /** Show only this many items until "Show all" is pressed. */
  limit?: number;
  locale?: string;
  /** Words for each status. They are read out, so the colour is never the only signal. Translate them. */
  statusLabels?: Record<NonNullable<TimelineItem["status"]>, string>;
  showAllLabel?: (hidden: number) => string;
  showLessLabel?: string;
  shownAnnouncement?: (count: number) => string;
  className?: string;
};

const defaultStatus = { done: "Done", current: "In progress", upcoming: "Planned", failed: "Failed" };

/** A list of events in time order. Times are real <time> elements, every status is text, and a long list can be shortened. */
export function Timeline({ items, label, limit, locale = "en", statusLabels = defaultStatus, showAllLabel = (n) => `Show ${n} more`, showLessLabel = "Show fewer", shownAnnouncement = (n) => `Showing ${n} events`, className }: TimelineProps) {
  const id = useId();
  const [all, setAll] = useState(false);
  const shown = limit && !all ? items.slice(0, limit) : items;
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", ...(items.some((i) => i.time.includes("T")) ? { timeStyle: "short" } : {}), timeZone: "UTC" });

  return (
    <div className={className ? `lb-timeline ${className}` : "lb-timeline"}>
      <ol id={`${id}-list`} aria-label={label} className="lb-timeline__list">
        {shown.map((item) => (
          <li key={item.id} className="lb-timeline__item" data-status={item.status}>
            <time dateTime={item.time} className="lb-timeline__time">
              {fmt.format(new Date(item.time.includes("T") ? item.time : `${item.time}T00:00:00Z`))}
            </time>
            <div className="lb-timeline__body">
              <span className="lb-timeline__title">{item.title}</span>
              {item.status ? <span className="lb-timeline__status">{statusLabels[item.status]}</span> : null}
              {item.description ? <div className="lb-timeline__description">{item.description}</div> : null}
            </div>
          </li>
        ))}
      </ol>
      {limit && items.length > limit ? (
        <button
          type="button"
          className="lb-timeline__more"
          aria-expanded={all}
          aria-controls={`${id}-list`}
          onClick={() => {
            const next = !all;
            setAll(next);
            announce(shownAnnouncement(next ? items.length : limit));
          }}
        >
          {all ? showLessLabel : showAllLabel(items.length - limit)}
        </button>
      ) : null}
    </div>
  );
}
