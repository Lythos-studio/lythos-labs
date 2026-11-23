"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useId, useMemo, useState, type ReactNode } from "react";
import { announce } from "../../core/announcer";
import { useControllable } from "../../core/use";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Return a comparable value to make the column sortable. */
  sortValue?: (row: T) => string | number;
  align?: "start" | "end";
};

export type SortState = { key: string; direction: "ascending" | "descending" } | null;

export type DataTableProps<T> = {
  /** The table's name. Required: a table without a caption has no accessible name. */
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  sort?: SortState;
  defaultSort?: SortState;
  onSortChange?: (sort: SortState) => void;
  selectable?: boolean;
  selected?: string[];
  defaultSelected?: string[];
  onSelectedChange?: (keys: string[]) => void;
  /** Shown when there are no rows. Translate it. */
  emptyLabel?: string;
  loading?: boolean;
  loadingLabel?: string;
  selectAllLabel?: string;
  selectRowLabel?: (row: T) => string;
  sortedLabel?: (header: string, direction: "ascending" | "descending") => string;
  selectedCountLabel?: (count: number) => string;
  className?: string;
};

/**
 * A real <table>: caption, column headers with scope, sortable columns as buttons with aria-sort,
 * optional row selection with a select-all checkbox, and honest loading and empty states.
 */
export function DataTable<T>({
  caption, columns, rows, rowKey, sort, defaultSort = null, onSortChange, selectable, selected, defaultSelected = [], onSelectedChange,
  emptyLabel = "No rows", loading = false, loadingLabel = "Loading", selectAllLabel = "Select all rows", selectRowLabel = () => "Select row",
  sortedLabel = (h, d) => `Sorted by ${h}, ${d}`, selectedCountLabel = (n) => `${n} selected`, className,
}: DataTableProps<T>) {
  const id = useId();
  const [current, setSort] = useControllable<SortState>(sort, defaultSort, onSortChange);
  const [keys, setKeys] = useControllable<string[]>(selected, defaultSelected, onSelectedChange);
  const [, force] = useState(0);

  const sorted = useMemo(() => {
    if (!current) return rows;
    const col = columns.find((c) => c.key === current.key);
    if (!col?.sortValue) return rows;
    const sv = col.sortValue;
    const dir = current.direction === "ascending" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = sv(a);
      const y = sv(b);
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * dir;
    });
  }, [rows, columns, current]);

  function toggleSort(col: Column<T>) {
    const direction = current?.key === col.key && current.direction === "ascending" ? "descending" : "ascending";
    setSort({ key: col.key, direction });
    announce(sortedLabel(col.header, direction));
  }

  const allKeys = rows.map(rowKey);
  const allOn = allKeys.length > 0 && allKeys.every((k) => keys.includes(k));
  const some = keys.length > 0 && !allOn;
  const setSelection = (next: string[]) => {
    setKeys(next);
    announce(selectedCountLabel(next.length));
    force((n) => n + 1);
  };

  const span = columns.length + (selectable ? 1 : 0);
  return (
    <div className={className ? `lb-table-wrap ${className}` : "lb-table-wrap"}>
      <table className="lb-table" aria-busy={loading || undefined}>
        <caption className="lb-table__caption">{caption}</caption>
        <thead>
          <tr>
            {selectable ? (
              <th scope="col" className="lb-table__check">
                <input
                  type="checkbox"
                  aria-label={selectAllLabel}
                  checked={allOn}
                  ref={(el) => {
                    if (el) el.indeterminate = some;
                  }}
                  onChange={() => setSelection(allOn ? [] : allKeys)}
                />
              </th>
            ) : null}
            {columns.map((col) => {
              const active = current?.key === col.key ? current.direction : undefined;
              return (
                <th key={col.key} scope="col" aria-sort={col.sortValue ? active ?? "none" : undefined} data-align={col.align}>
                  {col.sortValue ? (
                    <button type="button" className="lb-table__sort" onClick={() => toggleSort(col)}>
                      {col.header}
                      <span aria-hidden="true" className="lb-table__arrow">
                        {active === "ascending" ? "↑" : active === "descending" ? "↓" : "↕"}
                      </span>
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={span} className="lb-table__status" role="status">
                {loadingLabel}
              </td>
            </tr>
          ) : sorted.length === 0 ? (
            <tr>
              <td colSpan={span} className="lb-table__status">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            sorted.map((row) => {
              const key = rowKey(row);
              const on = keys.includes(key);
              return (
                <tr key={key} aria-selected={selectable ? on : undefined} data-selected={on || undefined}>
                  {selectable ? (
                    <td className="lb-table__check">
                      <input type="checkbox" aria-label={selectRowLabel(row)} checked={on} onChange={() => setSelection(on ? keys.filter((k) => k !== key) : [...keys, key])} />
                    </td>
                  ) : null}
                  {columns.map((col, i) =>
                    i === 0 ? (
                      <th key={col.key} scope="row" data-align={col.align} id={`${id}-${key}`}>
                        {col.cell(row)}
                      </th>
                    ) : (
                      <td key={col.key} data-align={col.align}>
                        {col.cell(row)}
                      </td>
                    ),
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export type PaginationProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  label?: string;
  previousLabel?: string;
  nextLabel?: string;
  pageLabel?: (page: number, count: number) => string;
};

/** Previous and next with the current page spoken. A nav landmark with its own name. */
export function Pagination({ page, pageCount, onPageChange, label = "Pagination", previousLabel = "Previous", nextLabel = "Next", pageLabel = (p, c) => `Page ${p} of ${c}` }: PaginationProps) {
  return (
    <nav aria-label={label} className="lb-pagination">
      <button type="button" className="lb-pagination__btn" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        {previousLabel}
      </button>
      <span className="lb-pagination__status" aria-live="polite" aria-atomic="true">
        {pageLabel(page, pageCount)}
      </span>
      <button type="button" className="lb-pagination__btn" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
        {nextLabel}
      </button>
    </nav>
  );
}
