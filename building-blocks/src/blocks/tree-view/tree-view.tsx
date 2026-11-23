"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createTypeahead } from "../../core/typeahead";
import { useControllable } from "../../core/use";

export type TreeNode = { id: string; label: string; children?: TreeNode[]; disabled?: boolean };

export type TreeViewProps = {
  nodes: TreeNode[];
  label: string;
  selected?: string;
  defaultSelected?: string;
  onSelect?: (id: string) => void;
  expanded?: string[];
  defaultExpanded?: string[];
  onExpandedChange?: (ids: string[]) => void;
  className?: string;
};

type Row = { node: TreeNode; level: number; pos: number; size: number; parent: string | null };

function flatten(nodes: TreeNode[], open: string[], level = 1, parent: string | null = null, out: Row[] = []) {
  nodes.forEach((node, i) => {
    out.push({ node, level, pos: i + 1, size: nodes.length, parent });
    if (node.children?.length && open.includes(node.id)) flatten(node.children, open, level + 1, node.id, out);
  });
  return out;
}

/** The WAI-ARIA tree: one tab stop, arrows move and open, Left and Right go to the parent and first child, typing jumps to a name. */
export function TreeView({ nodes, label, selected, defaultSelected, onSelect, expanded, defaultExpanded = [], onExpandedChange, className }: TreeViewProps) {
  const [chosen, setChosen] = useControllable<string | undefined>(selected, defaultSelected, (v) => v && onSelect?.(v));
  const [open, setOpen] = useControllable<string[]>(expanded, defaultExpanded, onExpandedChange);
  const rows = useMemo(() => flatten(nodes, open), [nodes, open]);
  const [focusId, setFocusId] = useState<string>(chosen ?? nodes[0]?.id);
  const root = useRef<HTMLUListElement>(null);
  const type = useRef(createTypeahead());

  const current = rows.findIndex((r) => r.node.id === focusId);
  const at = current >= 0 ? current : 0;
  const move = (i: number) => {
    const row = rows[Math.max(0, Math.min(rows.length - 1, i))];
    setFocusId(row.node.id);
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(row.node.id)}"]`)?.focus());
  };
  const toggle = (id: string, on: boolean) => setOpen(on ? [...open, id] : open.filter((x) => x !== id));

  function onKeyDown(event: KeyboardEvent) {
    const row = rows[at];
    if (!row) return;
    const hasKids = !!row.node.children?.length;
    const isOpen = open.includes(row.node.id);
    switch (event.key) {
      case "ArrowDown": move(at + 1); break;
      case "ArrowUp": move(at - 1); break;
      case "Home": move(0); break;
      case "End": move(rows.length - 1); break;
      case "ArrowRight":
        if (hasKids && !isOpen) toggle(row.node.id, true);
        else if (hasKids) move(at + 1);
        break;
      case "ArrowLeft":
        if (hasKids && isOpen) toggle(row.node.id, false);
        else if (row.parent) move(rows.findIndex((r) => r.node.id === row.parent));
        break;
      case "Enter":
      case " ":
        if (!row.node.disabled) {
          setChosen(row.node.id);
          onSelect?.(row.node.id);
        }
        break;
      default: {
        if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
        const hit = type.current.type(event.key, rows.map((r) => r.node.label), at);
        if (hit >= 0) move(hit);
        return;
      }
    }
    event.preventDefault();
  }

  function renderLevel(list: TreeNode[], level: number): React.ReactNode {
    return list.map((node, i) => {
      const hasKids = !!node.children?.length;
      const isOpen = open.includes(node.id);
      return (
        <li
          key={node.id}
          role="treeitem"
          data-id={node.id}
          aria-level={level}
          aria-posinset={i + 1}
          aria-setsize={list.length}
          aria-expanded={hasKids ? isOpen : undefined}
          aria-selected={chosen === node.id}
          aria-disabled={node.disabled || undefined}
          tabIndex={rows[at]?.node.id === node.id ? 0 : -1}
          className="lb-tree__item"
          onFocus={(event) => event.target === event.currentTarget && setFocusId(node.id)}
          onClick={(event) => {
            event.stopPropagation();
            setFocusId(node.id);
            if (hasKids) toggle(node.id, !isOpen);
            if (!node.disabled) {
              setChosen(node.id);
              onSelect?.(node.id);
            }
          }}
        >
          <span className="lb-tree__label">
            {hasKids ? (
              <span aria-hidden="true" className="lb-tree__twisty">
                {isOpen ? "▾" : "▸"}
              </span>
            ) : null}
            {node.label}
          </span>
          {hasKids && isOpen ? (
            <ul role="group" className="lb-tree__group">
              {renderLevel(node.children!, level + 1)}
            </ul>
          ) : null}
        </li>
      );
    });
  }

  return (
    <ul ref={root} role="tree" aria-label={label} className={className ? `lb-tree ${className}` : "lb-tree"} onKeyDown={onKeyDown}>
      {renderLevel(nodes, 1)}
    </ul>
  );
}
