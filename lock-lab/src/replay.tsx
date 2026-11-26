"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useEffect, useMemo, useRef, useState } from "react";
import type { Step } from "./analyze";
import { lockLabCopy, type Locale } from "./copy";
import { blocksReads, blocksWrites, MODES } from "./locks";
import type { Dot, Lane, SimResult } from "./simulate";
import styles from "./lock-lab.module.css";

const COLORS = { read: "#8fa2ff", write: "#5fd3a0", late: "#ff7b72", amber: "#ffc861", red: "#ff6b6b", line: "#222a4a", muted: "#9aa3c4", text: "#e9edff", slow: "#7d86a8" };
const APPROACH = 1800;
const EXIT = 1500;
const STRIP = 70;
const LANE = 76;

export const fmtSeconds = (ms: number, locale: Locale) =>
  `${new Intl.NumberFormat(locale === "nl" ? "nl-NL" : "en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(ms / 1000)} s`;
export const fmtClock = (ms: number) => {
  const s = Math.max(0, ms) / 1000;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
};
export const fmtCount = (n: number, locale: Locale) => new Intl.NumberFormat(locale === "nl" ? "nl-NL" : "en-GB").format(Math.round(n));
/** 4M, 400k, 2.5M; written out by hand so server and browser agree (compact Intl output differs per ICU version). */
export const fmtRows = (n: number, locale: Locale) => {
  const [v, unit] = n >= 1e9 ? [n / 1e9, "B"] : n >= 1e6 ? [n / 1e6, "M"] : n >= 1e3 ? [n / 1e3, "k"] : [n, ""];
  const text = String(Math.round(v * 10) / 10);
  return `${locale === "nl" ? text.replace(".", ",") : text}${unit}`;
};

const jitter = (a: number) => {
  const x = Math.sin(a * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/** Index of the last dot that arrived at or before t (dots are sorted by arrival). */
function upper(dots: Dot[], t: number) {
  let lo = 0;
  let hi = dots.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (dots[mid].a <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function totalWaiting(sim: SimResult): Int32Array {
  const n = Math.max(0, ...sim.lanes.map((l) => l.waiting.length));
  const out = new Int32Array(n);
  for (const l of sim.lanes) for (let i = 0; i < l.waiting.length; i++) out[i] += l.waiting[i];
  return out;
}

export const waitingAt = (lane: Lane, t: number, bucketMs: number) => lane.waiting[Math.min(lane.waiting.length - 1, Math.max(0, Math.floor(t / bucketMs)))] ?? 0;

type PanelProps = { sim: SimResult; steps: Step[]; t: number; endMs: number; yMax: number; locale: Locale; label: string };

function draw(canvas: HTMLCanvasElement, width: number, p: PanelProps) {
  const copy = lockLabCopy[p.locale];
  const { sim, t, endMs } = p;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const height = STRIP + 10 + sim.lanes.length * LANE;
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.height = `${height}px`;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const narrow = width < 520;
  const labelW = narrow ? 84 : 132;
  const right = width - 10;
  const x = (ms: number) => labelW + (Math.min(ms, endMs) / endMs) * (right - labelW);
  const font = (px: number, weight = 400) => `${weight} ${px}px Inter, system-ui, sans-serif`;
  const stepOf = (i: number) => p.steps[i];

  // Timeline strip: queries waiting over time, the slow query, and each attempt of each statement.
  const total = totalWaiting(sim);
  const top = 8;
  const base = STRIP - 22;
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(labelW, base + 0.5);
  ctx.lineTo(right, base + 0.5);
  ctx.stroke();
  if (p.yMax > 0) {
    ctx.beginPath();
    ctx.moveTo(x(0), base);
    for (let i = 0; i < total.length; i++) ctx.lineTo(x(i * sim.bucketMs), base - (total[i] / p.yMax) * (base - top));
    ctx.lineTo(x(endMs), base);
    ctx.closePath();
    ctx.fillStyle = "rgba(255, 107, 107, 0.28)";
    ctx.fill();
    ctx.strokeStyle = COLORS.red;
    ctx.lineWidth = 1.25;
    ctx.stroke();
  }
  if (sim.slow) {
    ctx.fillStyle = COLORS.slow;
    ctx.fillRect(x(sim.slow.from), STRIP - 17, Math.max(2, x(sim.slow.to) - x(sim.slow.from)), 3);
  }
  for (const a of sim.attempts) {
    const s = stepOf(a.step);
    if (!s) continue;
    const yy = STRIP - 11;
    const waitEnd = a.granted ?? a.to;
    if (waitEnd > a.from) {
      ctx.fillStyle = "rgba(255, 200, 97, 0.35)";
      ctx.fillRect(x(a.from), yy, Math.max(1.5, x(waitEnd) - x(a.from)), 7);
    }
    if (a.granted !== null && a.to > a.granted) {
      const reads = s.locks.some((l) => blocksReads(l.mode));
      const writes = s.locks.some((l) => blocksWrites(l.mode) || l.rows);
      ctx.fillStyle = reads ? COLORS.red : writes ? COLORS.amber : COLORS.write;
      ctx.fillRect(x(a.granted), yy, Math.max(2, x(a.to) - x(a.granted)), 7);
    }
    if (a.outcome === "lock-timeout" || a.outcome === "statement-timeout") {
      ctx.strokeStyle = COLORS.text;
      ctx.lineWidth = 1.5;
      const cx = x(a.to);
      ctx.beginPath();
      ctx.moveTo(cx - 3, yy);
      ctx.lineTo(cx + 3, yy + 7);
      ctx.moveTo(cx + 3, yy);
      ctx.lineTo(cx - 3, yy + 7);
      ctx.stroke();
    }
  }
  const nowWaiting = total[Math.min(total.length - 1, Math.floor(t / sim.bucketMs))] ?? 0;
  ctx.font = font(11, 600);
  ctx.fillStyle = nowWaiting > 0 ? COLORS.red : COLORS.muted;
  ctx.textBaseline = "top";
  ctx.fillText(copy.waiting(fmtCount(nowWaiting, p.locale)), 8, top);
  ctx.fillStyle = COLORS.muted;
  ctx.font = font(11);
  ctx.fillText(fmtClock(t), 8, top + 16);

  // Lanes: one per table, with a gate in the middle.
  sim.lanes.forEach((lane, li) => {
    const y0 = STRIP + 10 + li * LANE;
    const mid = y0 + LANE / 2;
    const gx = labelW + (right - labelW) * 0.58;
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y0 + 0.5);
    ctx.lineTo(width, y0 + 0.5);
    ctx.stroke();
    ctx.fillStyle = COLORS.text;
    ctx.font = font(13, 600);
    ctx.textBaseline = "middle";
    const name = lane.table.length > (narrow ? 10 : 16) ? `${lane.table.slice(0, narrow ? 9 : 15)}...` : lane.table;
    ctx.fillText(name, 8, mid - 8);
    ctx.fillStyle = COLORS.muted;
    ctx.font = font(11);
    ctx.fillText(fmtRows(lane.rows, p.locale), 8, mid + 9);

    ctx.strokeStyle = "rgba(143, 162, 255, 0.12)";
    ctx.beginPath();
    ctx.moveTo(labelW, mid + 0.5);
    ctx.lineTo(right, mid + 0.5);
    ctx.stroke();

    // Gate state now: a held lock, or a migration waiting in the queue (which closes the gate just the same).
    let state: { reads: boolean; writes: boolean; held: boolean; label: string } | null = null;
    for (const iv of sim.locks) {
      if (iv.table !== lane.table || t < iv.from || t >= iv.to) continue;
      const held = iv.granted !== null && t >= iv.granted;
      const reads = blocksReads(iv.mode);
      const writes = iv.rows || blocksWrites(iv.mode);
      if (!reads && !writes) continue;
      const line = stepOf(iv.step)?.line ?? 0;
      const label = held ? copy.lockHeld(iv.rows ? `${MODES[iv.mode]} + rows` : MODES[iv.mode], line) : copy.lockWaiting(MODES[iv.mode], line);
      if (!state || (reads && !state.reads) || (held && !state.held)) state = { reads, writes, held, label };
    }
    const slowHere = sim.slow && sim.slow.table === lane.table && t >= sim.slow.from && t < sim.slow.to;
    if (slowHere) {
      ctx.fillStyle = "rgba(125, 134, 168, 0.35)";
      ctx.beginPath();
      ctx.roundRect(gx - 6, mid - 7, Math.min(right - gx, narrow ? 70 : 130), 14, 7);
      ctx.fill();
      ctx.fillStyle = COLORS.text;
      ctx.font = font(10, 600);
      ctx.fillText(copy.slowRunning, gx + 8, mid);
    }
    const gateTop = y0 + 8;
    const gateH = LANE - 16;
    // Text is drawn last, on a dark backing, so the pile of dots never hides it.
    const labels: [string, number, number, string, number][] = [];
    if (state) {
      const color = state.reads ? COLORS.red : COLORS.amber;
      if (state.held) {
        ctx.fillStyle = color;
        ctx.fillRect(gx - 3, gateTop, 6, gateH);
      } else {
        ctx.strokeStyle = color;
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 2;
        ctx.strokeRect(gx - 3, gateTop, 6, gateH);
        ctx.setLineDash([]);
      }
      const text = state.label;
      ctx.font = font(10, 600);
      const tw = ctx.measureText(text).width;
      // Where it does not fit next to the gate (narrow screens), the label goes to the bottom edge of the lane.
      if (gx + 8 + tw <= right) labels.push([text, gx + 8, y0 + 4, color, 10]);
      else labels.push([text, Math.max(labelW + 4, right - tw), y0 + LANE - 14, color, 10]);
    } else {
      ctx.fillStyle = "rgba(233, 237, 255, 0.25)";
      ctx.fillRect(gx - 1, gateTop, 2, gateH);
    }

    const waitingNow = waitingAt(lane, t, sim.bucketMs);
    if (waitingNow > 0) labels.push([copy.waiting(fmtCount(waitingNow, p.locale)), labelW + 6, y0 + 4, COLORS.red, 11]);

    // Dots: approaching, waiting in a pile in front of the gate, or leaving.
    const dots = lane.dots;
    const hi = upper(dots, t + APPROACH);
    const queue: Dot[] = [];
    const rowsPerCol = Math.max(3, Math.floor((LANE - 24) / 6));
    const minA = t - lane.maxWaitMs - EXIT - 1000;
    for (let i = hi - 1; i >= 0; i--) {
      const d = dots[i];
      if (d.a < minA) break;
      if (d.a > t) {
        const k = 1 - (d.a - t) / APPROACH;
        ctx.globalAlpha = Math.min(1, k * 2);
        ctx.fillStyle = d.write ? COLORS.write : COLORS.read;
        ctx.beginPath();
        ctx.arc(labelW + 6 + k * (gx - 14 - labelW), mid + (jitter(d.a) - 0.5) * (LANE - 28), 2.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (t < d.s) queue.push(d);
      else if (d.failed) {
        const k = (t - d.s) / 900;
        if (k < 1) {
          ctx.globalAlpha = 1 - k;
          ctx.fillStyle = COLORS.late;
          ctx.fillRect(gx - 14 - jitter(d.a) * 60, mid + (jitter(d.a + 1) - 0.5) * (LANE - 28) + k * 10, 3, 3);
        }
      } else {
        const k = (t - d.s) / EXIT;
        if (k < 1) {
          ctx.globalAlpha = k > 0.75 ? (1 - k) * 4 : 1;
          ctx.fillStyle = d.s - d.a >= 1000 ? COLORS.late : d.write ? COLORS.write : COLORS.read;
          ctx.beginPath();
          ctx.arc(gx + 8 + k * (right - gx - 14), mid + (jitter(d.a) - 0.5) * (LANE - 28), 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
    // The pile: oldest next to the gate, colour turning red the longer a query waits.
    queue.reverse();
    queue.forEach((d, q) => {
      const col = Math.floor(q / rowsPerCol);
      const row = q % rowsPerCol;
      const px = Math.max(labelW + 4, gx - 10 - col * 5.5);
      const wait = t - d.a;
      ctx.fillStyle = wait >= 1000 ? COLORS.late : d.write ? COLORS.write : COLORS.read;
      ctx.fillRect(px - 2, y0 + 12 + row * 6, 4, 4);
    });
    ctx.textBaseline = "top";
    for (const [text, lx, ly, color, size] of labels) {
      ctx.font = font(size, 700);
      ctx.fillStyle = "rgba(11, 16, 34, 0.85)";
      ctx.fillRect(lx - 3, ly - 2, ctx.measureText(text).width + 6, size + 5);
      ctx.fillStyle = color;
      ctx.fillText(text, lx, ly);
    }
    ctx.textBaseline = "middle";
  });

  // Playhead.
  ctx.strokeStyle = "rgba(233, 237, 255, 0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x(t) + 0.5, top);
  ctx.lineTo(x(t) + 0.5, STRIP - 2);
  ctx.stroke();
}

function Panel(props: PanelProps & { title: string; note?: string; summary: string; stats: [string, string][] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (canvas.current && width) draw(canvas.current, width, props);
  });
  return (
    <section className={styles.panel} aria-label={props.title}>
      <div className={styles.panelHead}>
        <h3>{props.title}</h3>
        {props.note ? <p className={styles.small}>{props.note}</p> : null}
      </div>
      <p className={styles.verdict}>{props.summary}</p>
      <div ref={wrap} className={styles.canvasWrap}>
        <canvas ref={canvas} role="img" aria-label={`${props.title}. ${props.summary}`} />
      </div>
      <dl className={styles.stats}>
        {props.stats.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function verdict(sim: SimResult, locale: Locale): string {
  const v = lockLabCopy[locale].verdict;
  if (sim.outcome === "cut") return v.cut;
  if (sim.outcome === "failed") return v.failed;
  const worst = [...sim.lanes].sort((a, b) => b.maxWaitMs - a.maxWaitMs)[0];
  if (!worst || worst.maxWaitMs < 1000) return v.fine(fmtSeconds(sim.totals.maxWaitMs, locale));
  const readsStuck = sim.lanes.some((l) => l.dots.some((d) => !d.write && d.s - d.a >= 1000));
  return readsStuck ? v.stalled(worst.table, fmtSeconds(worst.maxWaitMs, locale)) : v.writesOnly(worst.table, fmtSeconds(worst.maxWaitMs, locale));
}

function statsFor(sim: SimResult, locale: Locale, timeoutS: number): [string, string][] {
  const t = lockLabCopy[locale];
  const timeouts = sim.attempts.filter((a) => a.outcome !== "done" && a.outcome !== "cut").length;
  const migration =
    sim.outcome === "done" && sim.finishedAt !== null
      ? `${t.finishedAt(fmtClock(sim.finishedAt))}${t.tries(timeouts + 1)}`
      : sim.outcome === "failed"
        ? t.failedAt(fmtClock(sim.attempts[sim.attempts.length - 1]?.to ?? 0))
        : t.stillRunning(fmtClock(sim.endMs));
  return [
    [t.stats.delayed, fmtCount(sim.totals.delayed, locale)],
    [`${t.stats.timedOut}${timeoutS ? ` (${timeoutS} s)` : ""}`, fmtCount(sim.totals.timedOut, locale)],
    [t.stats.longest, fmtSeconds(sim.totals.maxWaitMs, locale)],
    [t.stats.finished, migration],
  ];
}

/** The side-by-side replay: the migration as written and the safer version, on one clock. */
export function Replay({ a, b, stepsA, stepsB, locale, timeoutS }: { a: SimResult; b: SimResult | null; stepsA: Step[]; stepsB: Step[]; locale: Locale; timeoutS: number }) {
  const t = lockLabCopy[locale];
  const endMs = Math.max(a.endMs, b?.endMs ?? 0);
  const yMax = useMemo(() => Math.max(1, ...totalWaiting(a), ...(b ? totalWaiting(b) : [])), [a, b]);
  const peak = useMemo(() => {
    const total = totalWaiting(a);
    let at = 0;
    for (let i = 1; i < total.length; i++) if (total[i] > total[at]) at = i;
    return total[at] > 0 ? at * a.bucketMs : Math.min(endMs, a.startMs + 4000);
  }, [a, endMs]);
  const [time, setTime] = useState(0);
  const timeRef = useRef(0);
  timeRef.current = time;
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const root = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  // Reduced motion: no autoplay; show the worst moment instead, so the still frame tells the story.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setTime(peak);
      return;
    }
    const el = root.current;
    if (!el || started.current) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !started.current) {
        started.current = true;
        setTime(0);
        setPlaying(true);
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [peak]);

  useEffect(() => {
    if (time > endMs) setTime(endMs);
  }, [endMs, time]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      const next = Math.min(endMs, timeRef.current + dt * speed);
      timeRef.current = next;
      setTime(next);
      if (next >= endMs) setPlaying(false);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, endMs]);

  const atEnd = time >= endMs;
  return (
    <div ref={root} className={styles.replay}>
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.primary}
          onClick={() => {
            if (atEnd) setTime(0);
            setPlaying(!playing || atEnd);
          }}
        >
          {playing ? t.pause : atEnd ? t.replay : t.play}
        </button>
        <label className={styles.scrub}>
          <span className={styles.visuallyHidden}>{t.time}</span>
          <input
            type="range"
            min={0}
            max={Math.round(endMs)}
            step={50}
            value={Math.round(time)}
            aria-valuetext={fmtClock(time)}
            onChange={(e) => {
              setPlaying(false);
              setTime(Number(e.target.value));
            }}
          />
        </label>
        <output className={styles.clock} aria-live="off">
          {fmtClock(time)} / {fmtClock(endMs)}
        </output>
        <label className={styles.speed}>
          {t.speed}
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            {[1, 2, 5, 10].map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className={styles.small}>
        <span className={`${styles.key} ${styles.keyRead}`} /> SELECT <span className={`${styles.key} ${styles.keyWrite}`} /> INSERT, UPDATE, DELETE{" "}
        <span className={`${styles.key} ${styles.keyLate}`} /> &gt; 1 s. {t.dotIs(a.lanes[0]?.perDot ?? 1)}
      </p>
      <div className={styles.panels}>
        <Panel sim={a} steps={stepsA} t={time} endMs={endMs} yMax={yMax} locale={locale} label="a" title={t.asWritten} summary={verdict(a, locale)} stats={statsFor(a, locale, timeoutS)} />
        {b ? (
          <Panel sim={b} steps={stepsB} t={time} endMs={endMs} yMax={yMax} locale={locale} label="b" title={t.safer} note={t.saferNote} summary={verdict(b, locale)} stats={statsFor(b, locale, timeoutS)} />
        ) : null}
      </div>
    </div>
  );
}
