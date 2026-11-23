"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useEffect, useState, type RefObject } from "react";
import { onAnnounce, announcementLog } from "../core/announcer";
import type { Announcement } from "../core/announce-queue";
import { a11yTree, accessibleName, fromElement, tabOrder, type NodeIndex, type TreeRow } from "../harness/a11y";
import type { LabCopy } from "./copy";
import styles from "./lab.module.css";

export type Stop = { n: number; x: number; y: number; w: number; h: number; label: string };

/** Reads the live example: the tab order (with positions for the overlay) and the accessibility tree. Recomputed when the example changes. */
export function useLensData(stage: HTMLElement | null, wrap: RefObject<HTMLElement | null>, active: boolean) {
  const [data, setData] = useState<{ stops: Stop[]; rows: TreeRow[] }>({ stops: [], rows: [] });
  useEffect(() => {
    if (!stage || !active) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const index: NodeIndex = { els: new Map(), ids: new Map() };
      const root = fromElement(stage, index);
      const base = wrap.current?.getBoundingClientRect();
      const stops = tabOrder([root]).flatMap((node, i) => {
        const el = index.els.get(node);
        if (!el || !base) return [];
        const r = el.getBoundingClientRect();
        return [{ n: i + 1, x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height, label: accessibleName(node, (id) => index.ids.get(id)) }];
      });
      setData({ stops, rows: a11yTree([root], (id) => index.ids.get(id)) });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    const observer = new MutationObserver(schedule);
    observer.observe(stage, { subtree: true, childList: true, attributes: true, characterData: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("focusin", schedule);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      document.removeEventListener("focusin", schedule);
      cancelAnimationFrame(frame);
    };
  }, [stage, wrap, active]);
  return data;
}

export function useAnnouncements(active: boolean) {
  const [log, setLog] = useState<Announcement[]>([]);
  useEffect(() => {
    if (!active) return;
    setLog(announcementLog().slice(-20));
    return onAnnounce(() => setLog(announcementLog().slice(-20)));
  }, [active]);
  return log;
}

/** Numbered badges over the example, in the order Tab visits things. They never take pointer events. */
export function FocusOverlay({ stops }: { stops: Stop[] }) {
  return (
    <div className={styles.lensLayer} aria-hidden="true" data-lb-lens="focus-order">
      {stops.map((s) => (
        <span key={s.n} className={styles.lensBox} style={{ left: s.x, top: s.y, width: s.w, height: s.h }}>
          <span className={styles.lensBadge}>{s.n}</span>
        </span>
      ))}
    </div>
  );
}

export function TreePanel({ rows, t }: { rows: TreeRow[]; t: LabCopy }) {
  return (
    <div className={styles.lensPanel} data-lb-lens="tree">
      <h3>{t.lensTree}</h3>
      <p className={styles.small}>{t.lensApprox}</p>
      <ul className={styles.tree}>
        {rows.map((r, i) => (
          <li key={i} style={{ paddingInlineStart: `${r.depth * 16}px` }}>
            <code>{r.role}</code> {r.name ? <q>{r.name}</q> : <span className={styles.small}>{t.lensNoName}</span>} {r.state.length ? <span className={styles.small}>({r.state.join(", ")})</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AnnouncePanel({ log, t }: { log: Announcement[]; t: LabCopy }) {
  return (
    <div className={styles.lensPanel} data-lb-lens="announcements">
      <h3>{t.lensAnnouncements}</h3>
      {log.length ? (
        <ul className={styles.tree}>
          {log.map((a, i) => (
            <li key={i}>
              <code>{a.politeness}</code> <q>{a.message}</q>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.small}>{t.lensNoAnnouncements}</p>
      )}
    </div>
  );
}
