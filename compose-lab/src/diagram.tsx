/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useRef, type Ref } from "react";
import { CARD, type Layout } from "./layout";
import type { Compose, Port, Service } from "./model";
import type { Finding, Level } from "./rules";
import styles from "./compose-lab.module.css";

/** Colours as attributes, so the exported SVG looks like the screen without any stylesheet. */
const TONE: Record<Level | "ok", string> = { ok: "#5fd3a0", warn: "#f5b94a", fail: "#ff8f8f", info: "#9aa3c4" };
const INK = "#ffffff";
const MUTED = "#c3cbe6";
const FAINT = "#9aa3c4";
const LINE = "#3a4677";
const PANEL = "#0f1530";
const BACKDROP = "#0b1022";

export type Positions = Record<string, { x: number; y: number }>;
const NET_W = 124;
const NET_H = 44;

const cut = (text: string, n: number) => (text.length > n ? `${text.slice(0, n - 1)}...` : text);
const portLabel = (p: Port) => `${p.published ?? ""}${p.published ? ":" : ""}${p.target}${p.protocol === "tcp" ? "" : `/${p.protocol}`}`;
const imageLabel = (s: Service) => (s.image ? `${s.image.name.split("/").pop()}${s.image.tag ? `:${s.image.tag}` : s.image.digest ? "@digest" : ""}` : s.hasBuild ? "build" : "");

/** The shape says the level as well as the colour: circle, triangle, diamond, ring. */
function Mark({ level, x, y }: { level: Level | "ok"; x: number; y: number }) {
  const c = TONE[level];
  if (level === "ok") return <circle cx={x} cy={y} r={5} fill={c} />;
  if (level === "warn") return <polygon points={`${x},${y - 6} ${x + 6},${y + 5} ${x - 6},${y + 5}`} fill={c} />;
  if (level === "fail") return <rect x={x - 5} y={y - 5} width={10} height={10} fill={c} transform={`rotate(45 ${x} ${y})`} />;
  return <circle cx={x} cy={y} r={5} fill="none" stroke={c} strokeWidth={2} />;
}

export const worst = (findings: Finding[]): Level | "ok" =>
  findings.some((f) => f.level === "fail") ? "fail" : findings.some((f) => f.level === "warn") ? "warn" : findings.length ? "info" : "ok";

type Props = {
  compose: Compose;
  layout: Layout;
  positions: Positions;
  findings: Finding[];
  selected: string | null;
  labels: { internet: string; alt: string; levels: Record<Level | "ok", string> };
  svgRef?: Ref<SVGSVGElement>;
  onSelect: (name: string | null) => void;
  onMove: (name: string, x: number, y: number) => void;
};

/** The stack as SVG: cards for services, arrows for depends_on, and flowing dashes from the outside to open ports. */
export function Diagram({ compose, layout, positions, findings, selected, labels, svgRef, onSelect, onMove }: Props) {
  const drag = useRef<{ name: string; px: number; py: number; x: number; y: number; moved: boolean } | null>(null);
  const at = (name: string) => positions[name] ?? { x: 0, y: 0 };
  const width = Math.max(layout.width, ...Object.values(positions).map((p) => p.x + CARD.w + CARD.pad));
  const height = Math.max(layout.height, ...Object.values(positions).map((p) => p.y + CARD.h + CARD.pad));
  const netY = height / 2 - NET_H / 2;
  const edge = (x1: number, y1: number, x2: number, y2: number) => `M${x1} ${y1} C${x1 + 70} ${y1} ${x2 - 70} ${y2} ${x2} ${y2}`;
  const known = new Set(compose.services.map((s) => s.name));

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="group"
      aria-label={labels.alt}
      fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
    >
      <defs>
        <marker id="mc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill={FAINT} />
        </marker>
      </defs>
      <rect width={width} height={height} fill={BACKDROP} />

      {compose.services.flatMap((s) =>
        s.dependsOn
          .filter((d) => known.has(d.name) && d.name !== s.name)
          .map((d) => {
            const a = at(s.name);
            const b = at(d.name);
            return <path key={`${s.name}>${d.name}`} d={edge(a.x + CARD.w, a.y + CARD.h / 2, b.x, b.y + CARD.h / 2)} fill="none" stroke={FAINT} strokeWidth={1.5} markerEnd="url(#mc-arrow)" opacity={0.85} />;
          }),
      )}

      {layout.internet &&
        compose.services
          .filter((s) => s.ports.length)
          .map((s) => {
            const b = at(s.name);
            const open = s.ports.some((p) => !p.hostIp || p.hostIp === "0.0.0.0" || p.hostIp === "::");
            return (
              <path
                key={`net>${s.name}`}
                className={styles.flow}
                d={edge(layout.internet!.x + NET_W, netY + NET_H / 2, b.x, b.y + CARD.h / 2)}
                fill="none"
                stroke={open ? TONE.warn : FAINT}
                strokeWidth={2}
                strokeDasharray="6 8"
                markerEnd="url(#mc-arrow)"
              />
            );
          })}

      {layout.internet && (
        <g>
          <rect x={layout.internet.x} y={netY} width={NET_W} height={NET_H} rx={22} fill={PANEL} stroke={LINE} strokeWidth={1.5} />
          <text x={layout.internet.x + NET_W / 2} y={netY + NET_H / 2 + 5} textAnchor="middle" fontSize={14} fontWeight={600} fill={INK}>
            {labels.internet}
          </text>
        </g>
      )}

      {compose.services.map((s) => {
        const p = at(s.name);
        const mine = findings.filter((f) => f.services.includes(s.name));
        const level = worst(mine);
        const isSelected = selected === s.name;
        const ports = s.ports.map(portLabel);
        return (
          <g
            key={s.name}
            className={styles.card}
            transform={`translate(${p.x} ${p.y})`}
            tabIndex={0}
            role="button"
            aria-pressed={isSelected}
            aria-label={`${s.name}, ${labels.levels[level]}${mine.length ? `, ${mine.length}` : ""}`}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { name: s.name, px: e.clientX, py: e.clientY, x: p.x, y: p.y, moved: false };
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d || d.name !== s.name) return;
              const dx = e.clientX - d.px;
              const dy = e.clientY - d.py;
              if (!d.moved && Math.hypot(dx, dy) < 4) return;
              d.moved = true;
              onMove(s.name, Math.max(0, d.x + dx), Math.max(0, d.y + dy));
            }}
            onPointerUp={() => {
              const d = drag.current;
              drag.current = null;
              if (d && !d.moved) onSelect(isSelected ? null : s.name);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(isSelected ? null : s.name);
              }
              if (e.key === "Escape") onSelect(null);
            }}
          >
            <title>{`${s.name}${s.image ? ` (${imageLabel(s)})` : ""}`}</title>
            <rect width={CARD.w} height={CARD.h} rx={10} fill={PANEL} stroke={isSelected ? "#8fa2ff" : LINE} strokeWidth={isSelected ? 2.5 : 1.5} />
            <rect width={5} height={CARD.h} rx={2} fill={TONE[level]} />
            <text x={18} y={26} fontSize={14} fontWeight={700} fill={INK}>
              {cut(s.name, 20)}
            </text>
            <text x={18} y={46} fontSize={12} fill={MUTED}>
              {cut(imageLabel(s), 26)}
            </text>
            <text x={18} y={66} fontSize={11} fill={FAINT}>
              {ports.length ? cut(ports.slice(0, 3).join(", ") + (ports.length > 3 ? ", ..." : ""), 28) : ""}
            </text>
            <Mark level={level} x={CARD.w - 18} y={20} />
            {mine.length > 0 && (
              <text x={CARD.w - 18} y={42} textAnchor="middle" fontSize={11} fontWeight={600} fill={TONE[level]}>
                {mine.length}
              </text>
            )}
            <circle cx={CARD.w - 18} cy={CARD.h - 16} r={5} fill={s.healthcheck === "set" ? TONE.ok : "none"} stroke={s.healthcheck === "set" ? TONE.ok : FAINT} strokeWidth={1.5} strokeDasharray={s.healthcheck === "set" ? undefined : "2 2"} />
          </g>
        );
      })}
    </svg>
  );
}
