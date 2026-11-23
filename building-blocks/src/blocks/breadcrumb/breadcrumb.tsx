"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useRef, useState } from "react";

export type Crumb = { label: string; href?: string };

export type BreadcrumbProps = {
  items: Crumb[];
  /** The name of the navigation landmark. Translate it. */
  label?: string;
  /** The name of the button that shows the hidden levels. Translate it. */
  expandLabel?: string;
  /** With more levels than this, the middle ones fold into a button. */
  maxItems?: number;
  className?: string;
};

/** A path of links to where you are: a named nav with an ordered list, the current page marked with aria-current, and long paths folded behind one button. */
export function Breadcrumb({ items, label = "Breadcrumb", expandLabel = "Show all levels", maxItems = 4, className }: BreadcrumbProps) {
  const [expanded, setExpanded] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  const fold = !expanded && items.length > maxItems;
  const tail = Math.max(1, maxItems - 2);
  const visible = fold ? [items[0], null, ...items.slice(-tail)] : items;
  const hiddenCount = items.length - 1 - tail;

  return (
    <nav aria-label={label} className={className ? `lb-breadcrumb ${className}` : "lb-breadcrumb"}>
      <ol ref={list} className="lb-breadcrumb__list">
        {visible.map((item, i) => {
          if (item === null)
            return (
              <li key="more" className="lb-breadcrumb__item">
                <button
                  type="button"
                  className="lb-breadcrumb__more"
                  aria-label={`${expandLabel} (${hiddenCount})`}
                  onClick={() => {
                    setExpanded(true);
                    // The folded levels appear after the first one; send focus to the first of them.
                    requestAnimationFrame(() => list.current?.querySelectorAll<HTMLElement>("a, [aria-current]")[1]?.focus());
                  }}
                >
                  <span aria-hidden="true">…</span>
                </button>
              </li>
            );
          const last = item === items[items.length - 1] && i === visible.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="lb-breadcrumb__item">
              {last || !item.href ? (
                <span aria-current={last ? "page" : undefined} tabIndex={last ? -1 : undefined} className="lb-breadcrumb__current">
                  {item.label}
                </span>
              ) : (
                <a href={item.href} className="lb-breadcrumb__link">
                  {item.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
