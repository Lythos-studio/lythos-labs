/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { airlockCopy, type Locale } from "./copy";
import type { GraphEdge, GraphNode, RunResult } from "./run";
import styles from "./airlock.module.css";

const COL_X = [8, 296, 584];
const NODE_W = 168;
const NODE_H = 44;
const ROW = 60;
const TONE: Record<GraphEdge["tone"], string> = { trusted: "#8fa2ff", untrusted: "#ff7b72", private: "#ffc861" };
const STATUS: Record<string, string> = { run: "#5fd3a0", ask: "#ffc861", block: "#ff6b6b", stop: "#7d86a8" };

const column = (n: GraphNode) => (n.kind === "value" ? 1 : n.kind === "call" ? 2 : 0);
const cut = (s: string, n = 22) => (s.length > n ? `${s.slice(0, n - 1)}...` : s);

/** The data flow of one run: where each value came from and which action it reached, stopped flows dashed. */
export function FlowGraph({ run, locale, title }: { run: RunResult; locale: Locale; title: string }) {
  const t = airlockCopy[locale];
  const cols: GraphNode[][] = [[], [], []];
  for (const n of run.nodes) cols[column(n)].push(n);
  const pos = new Map<string, { x: number; y: number }>();
  cols.forEach((list, c) => list.forEach((n, i) => pos.set(n.id, { x: COL_X[c], y: 10 + i * ROW })));
  const height = Math.max(1, ...cols.map((c) => c.length)) * ROW + 10;

  const label = (n: GraphNode) => {
    if (n.kind === "request") return t.nodes.request;
    if (n.kind === "call") {
      const entry = run.entries[Number(n.id.slice(5))];
      const args = Object.fromEntries(Object.entries(entry?.args ?? {}).map(([k, v]) => [k, v.v]));
      return t.calls[entry?.tool ?? "fetch"](args);
    }
    if (n.kind === "value") return t.binds[n.label] ?? n.label;
    return n.label;
  };
  const sub = (n: GraphNode) =>
    n.kind === "call" ? `${t.status[n.status ?? "run"]}${n.injected ? `, ${t.addedByText}` : ""}` : n.kind === "file" || n.private ? t.legend.private : n.untrusted || n.kind === "email" || n.kind === "page" ? t.legend.untrusted : t.legend.trusted;
  const stroke = (n: GraphNode) => (n.kind === "call" ? STATUS[n.status ?? "run"] : n.kind === "file" || n.private ? TONE.private : n.untrusted || n.kind === "email" || n.kind === "page" ? TONE.untrusted : TONE.trusted);

  return (
    <div className={styles.graphWrap}>
      <svg viewBox={`0 0 760 ${height}`} width="100%" role="img" aria-label={title}>
        {run.edges.map((e, i) => {
          const a = pos.get(e.from);
          const b = pos.get(e.to);
          if (!a || !b) return null;
          const x1 = a.x + NODE_W;
          const y1 = a.y + NODE_H / 2;
          const x2 = b.x - (e.blocked ? 10 : 2);
          const y2 = b.y + NODE_H / 2;
          const back = x2 < x1;
          const d = back ? `M${b.x + NODE_W} ${y2} C${b.x + NODE_W + 60} ${y2} ${a.x - 60} ${y1} ${a.x} ${y1}` : `M${x1} ${y1} C${x1 + 70} ${y1} ${x2 - 70} ${y2} ${x2} ${y2}`;
          return (
            <g key={i}>
              <path d={d} fill="none" stroke={TONE[e.tone]} strokeWidth={e.blocked ? 1.5 : 2} strokeDasharray={e.blocked ? "3 5" : "6 6"} opacity={e.blocked ? 0.7 : 0.95} className={e.blocked ? undefined : styles.flow} />
              {e.blocked && !back ? <rect x={x2 + 2} y={y2 - 9} width="4" height="18" rx="1" fill="#ff6b6b" /> : null}
            </g>
          );
        })}
        {run.nodes.map((n) => {
          const p = pos.get(n.id)!;
          return (
            <g key={n.id} transform={`translate(${p.x} ${p.y})`}>
              <rect width={NODE_W} height={NODE_H} rx="8" fill="#0f1530" stroke={stroke(n)} strokeWidth="1.5" strokeDasharray={n.injected ? "4 3" : undefined} />
              <text x="10" y="18" className={styles.nodeLabel}>
                {cut(label(n), 26)}
              </text>
              <text x="10" y="34" className={styles.nodeSub} fill={stroke(n)}>
                {cut(sub(n), 30)}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className={styles.legend}>
        {(["trusted", "untrusted", "private"] as const).map((k) => (
          <li key={k}>
            <span className={`${styles.swatch} ${styles[`sw_${k}`]}`} aria-hidden="true" />
            {t.legend[k]}
          </li>
        ))}
        <li>
          <span className={`${styles.swatch} ${styles.sw_blocked}`} aria-hidden="true" />
          {t.legend.blocked}
        </li>
      </ul>
    </div>
  );
}
