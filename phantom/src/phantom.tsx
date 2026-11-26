"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { phantomCopy, type Locale, type Palette, type Subject } from "./copy";
import { decodeText, encodeText, MAX_TEXT, type FrameStats } from "./noise";
import { createRenderer, rotation, type Frame, type Renderer } from "./renderer";
import type { Shape } from "./shader";
import styles from "./phantom.module.css";

const SUBJECTS: Subject[] = ["torus", "gyroid", "bulb", "twist", "text", "draw"];
const PALETTES: Record<Palette, { c0: [number, number, number]; c1: [number, number, number] }> = {
  lythos: { c0: [0.043, 0.063, 0.133], c1: [0.79, 0.83, 1] },
  ink: { c0: [0, 0, 0], c1: [1, 1, 1] },
  ember: { c0: [0.086, 0.031, 0.02], c1: [1, 0.7, 0.42] },
  moss: { c0: [0.027, 0.078, 0.05], c1: [0.72, 0.94, 0.78] },
};
const ACCENT: [number, number, number] = [1, 0.42, 0.42];
type Stroke = [number, number][];

/** Draws the words big and bold into the mask, on as many lines as needed (at most three). */
function drawText(ctx: CanvasRenderingContext2D, text: string, w: number, h: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return;
  let best: { lines: string[]; size: number } = { lines: [words.join(" ")], size: 0 };
  for (let n = 1; n <= Math.min(3, words.length); n++) {
    const per = Math.ceil(words.length / n);
    const lines = Array.from({ length: n }, (_, i) => words.slice(i * per, (i + 1) * per).join(" ")).filter(Boolean);
    ctx.font = `900 100px Inter, "Arial Black", system-ui, sans-serif`;
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const size = Math.min((w * 0.9 * 100) / widest, (h * 0.8) / (lines.length * 1.05));
    if (size > best.size) best = { lines, size };
  }
  ctx.font = `900 ${best.size}px Inter, "Arial Black", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  const lh = best.size * 1.05;
  best.lines.forEach((line, i) => ctx.fillText(line, w / 2, h / 2 + (i - (best.lines.length - 1) / 2) * lh));
}

export function Phantom({ locale }: { locale: Locale }) {
  const t = phantomCopy[locale];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const renderer = useRef<Renderer | null>(null);
  const mask = useRef<HTMLCanvasElement | null>(null);
  const time = useRef(0);
  const turn = useRef({ yaw: 0.4, pitch: 0.25 });
  const strokes = useRef<Stroke[]>([]);
  const drag = useRef<{ x: number; y: number; drawing: boolean } | null>(null);
  const visible = useRef(true);

  const [subject, setSubject] = useState<Subject>("torus");
  const [text, setText] = useState(t.defaultText);
  const [playing, setPlaying] = useState(false);
  const [compare, setCompare] = useState(false);
  const [grain, setGrain] = useState(3);
  const [speed, setSpeed] = useState(1);
  const [palette, setPalette] = useState<Palette>("lythos");
  const [calm, setCalm] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [failed, setFailed] = useState(false);
  const [stats, setStats] = useState<FrameStats | null>(null);
  const [copied, setCopied] = useState(false);

  const shape: Shape = subject === "text" || subject === "draw" ? "mask" : subject;

  const frameAt = useCallback(
    (s: number): Frame => {
      const at = (x: number) => {
        const yaw = turn.current.yaw + x * 0.55;
        const pitch = turn.current.pitch + 0.35 * Math.sin(x * 0.4);
        return {
          rot: rotation(yaw, pitch, 0.2 * Math.sin(x * 0.27)),
          bg: (calm ? [0, 0] : [x * 6, x * 12]) as [number, number],
          fg: [0, -x * 20] as [number, number],
        };
      };
      const now = at(s);
      const prev = at(s - 0.1);
      return { shape, rot: now.rot, rotPrev: prev.rot, bg: now.bg, bgPrev: prev.bg, fg: now.fg, fgPrev: prev.fg, view: compare ? 2 : 0, ...PALETTES[palette], accent: ACCENT };
    },
    [shape, calm, compare, palette],
  );

  const render = useCallback(() => {
    if (renderer.current) renderer.current.draw(frameAt(time.current));
  }, [frameAt]);

  const paintMask = useCallback(() => {
    const r = renderer.current;
    if (!r) return;
    const width = canvasRef.current?.width ?? 1;
    const height = canvasRef.current?.height ?? 1;
    const c = (mask.current ??= document.createElement("canvas"));
    c.width = width;
    c.height = height;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
    if (subject === "text") drawText(ctx, text, width, height);
    if (subject === "draw") {
      ctx.strokeStyle = "#fff";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(5, Math.min(width, height) * 0.075);
      for (const s of strokes.current) {
        ctx.beginPath();
        s.forEach(([x, y], i) => (i ? ctx.lineTo(x * width, y * height) : ctx.moveTo(x * width, y * height)));
        if (s.length === 1) ctx.lineTo(s[0][0] * width + 0.01, s[0][1] * height);
        ctx.stroke();
      }
    }
    r.setMask(c);
  }, [subject, text]);

  // Set up WebGL once, size the grid to the stage, and start (unless the system asks for less motion).
  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    let r: Renderer | null = null;
    try {
      r = createRenderer(canvas, (Math.random() * 2 ** 32) >>> 0);
    } catch {
      r = null;
    }
    if (!r) {
      setFailed(true);
      return;
    }
    renderer.current = r;
    const fromHash = decodeText(window.location.hash);
    if (fromHash) {
      setSubject("text");
      setText(fromHash);
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(reduce);
    setPlaying(!reduce);
    const io = new IntersectionObserver((entries) => (visible.current = entries.some((e) => e.isIntersecting)));
    io.observe(stage);
    return () => {
      io.disconnect();
      r?.dispose();
      renderer.current = null;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !renderer.current) return;
    const ro = new ResizeObserver(() => {
      if (!renderer.current) return;
      renderer.current.resize(canvas.clientWidth, canvas.clientHeight, grain);
      paintMask();
      render();
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [grain, paintMask, render, failed]);

  useEffect(() => {
    paintMask();
    render();
  }, [paintMask, render]);

  // The clock only runs while playing; a paused frame is exactly the frame you saw.
  useEffect(() => {
    if (!playing) {
      render();
      return;
    }
    setStats(null);
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      time.current += dt * speed * (calm ? 0.5 : 1);
      if (visible.current) render();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, calm, render]);

  // Measure the frozen frame, so the claim on the page is checked on what you see.
  useEffect(() => {
    if (playing || compare || !renderer.current) return;
    setStats(renderer.current.measure(frameAt(time.current)));
  }, [playing, compare, frameAt, grain, text, subject]);

  useEffect(() => {
    try {
      if (subject === "text") history.replaceState(null, "", `#${encodeText(text)}`);
      else if (window.location.hash) history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch {
      // The address bar is only a convenience.
    }
  }, [subject, text]);

  function point(e: PointerEvent<HTMLCanvasElement>): [number, number] {
    const box = e.currentTarget.getBoundingClientRect();
    return [(e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height];
  }
  function onDown(e: PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, drawing: subject === "draw" };
    if (subject === "draw") {
      strokes.current.push([point(e)]);
      paintMask();
      render();
    }
  }
  function onMove(e: PointerEvent<HTMLCanvasElement>) {
    const d = drag.current;
    if (!d) return;
    if (d.drawing) {
      strokes.current[strokes.current.length - 1].push(point(e));
      paintMask();
    } else if (shape !== "mask") {
      turn.current.yaw += (e.clientX - d.x) * 0.01;
      turn.current.pitch += (e.clientY - d.y) * 0.01;
      d.x = e.clientX;
      d.y = e.clientY;
    }
    render();
  }
  function onUp() {
    drag.current = null;
    if (!playing && renderer.current) setStats(renderer.current.measure(frameAt(time.current)));
  }
  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    const step = 0.12;
    if (e.key === " ") setPlaying((p) => !p);
    else if (e.key === "ArrowLeft") turn.current.yaw -= step;
    else if (e.key === "ArrowRight") turn.current.yaw += step;
    else if (e.key === "ArrowUp") turn.current.pitch -= step;
    else if (e.key === "ArrowDown") turn.current.pitch += step;
    else return;
    e.preventDefault();
    render();
  }

  async function snapshot() {
    const blob = await renderer.current?.snapshot(frameAt(time.current), 3);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "phantom-frame.png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const pct = (n: number) => `${(n * 100).toFixed(1).replace(".", locale === "nl" ? "," : ".")}%`;

  return (
    <div className={styles.lab}>
      <section className={styles.intro} aria-labelledby="phantom-title">
        <p className={styles.eyebrow}>{t.eyebrow}</p>
        <h1 id="phantom-title">{t.heading}</h1>
        <p>{t.intro}</p>
        <p className={styles.small}>{t.warning}</p>
      </section>

      <section className={styles.stageBlock} aria-label={t.subjectsLabel}>
        <div className={styles.subjects} role="group" aria-label={t.subjectsLabel}>
          {SUBJECTS.map((s) => (
            <button key={s} type="button" className={styles.pill} aria-pressed={subject === s} onClick={() => setSubject(s)}>
              {t.subjects[s]}
            </button>
          ))}
        </div>

        {failed ? (
          <p className={styles.notice}>{t.noWebgl}</p>
        ) : (
          <div ref={stageRef} className={styles.stage} tabIndex={0} onKeyDown={onKey} aria-describedby="phantom-hint">
            <canvas
              ref={canvasRef}
              className={`${styles.canvas} ${subject === "draw" ? styles.drawing : ""}`}
              role="img"
              aria-label={t.stageLabel(subject === "text" ? `"${text}"` : t.subjects[subject])}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            />
            {!playing ? <p className={styles.paused}>{reduced && time.current === 0 ? t.reducedMotion : t.pausedNote}</p> : null}
          </div>
        )}
        <p id="phantom-hint" className={styles.small}>
          {subject === "draw" ? t.drawHint : subject === "text" ? t.textHint(MAX_TEXT) : t.dragHint}
        </p>

        <div className={styles.controls}>
          <button type="button" className={styles.primary} onClick={() => setPlaying(!playing)} disabled={failed}>
            {playing ? t.pause : t.play}
          </button>
          <button type="button" className={styles.ghost} onClick={() => void snapshot()} disabled={failed}>
            {t.snapshot}
          </button>
          <button type="button" className={styles.ghost} aria-pressed={compare} onClick={() => setCompare(!compare)} disabled={failed}>
            {compare ? t.computerOn : t.computer}
          </button>
          {subject === "draw" ? (
            <button
              type="button"
              className={styles.ghost}
              onClick={() => {
                strokes.current = [];
                paintMask();
                render();
              }}
            >
              {t.clearDrawing}
            </button>
          ) : null}
        </div>
        {compare ? <p className={styles.small}>{t.computerNote}</p> : null}

        {subject === "text" ? (
          <div className={styles.textRow}>
            <label htmlFor="phantom-text">{t.textLabel}</label>
            <input id="phantom-text" className={styles.input} value={text} maxLength={MAX_TEXT} onChange={(e) => setText(e.target.value)} autoComplete="off" spellCheck={false} />
            <button
              type="button"
              className={styles.ghost}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  // Clipboard blocked: the link is in the address bar.
                }
              }}
            >
              {copied ? t.copied : t.share}
            </button>
          </div>
        ) : null}

        <div className={styles.settings}>
          <label className={styles.slider}>
            <span>
              {t.grain} <output>{grain}px</output>
            </span>
            <input type="range" min={2} max={8} step={1} value={grain} onChange={(e) => setGrain(Number(e.target.value))} />
          </label>
          <label className={styles.slider}>
            <span>
              {t.speed} <output>{speed.toFixed(2)}x</output>
            </span>
            <input type="range" min={0.25} max={2} step={0.25} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
          </label>
          <label className={styles.select}>
            {t.palette}
            <select value={palette} onChange={(e) => setPalette(e.target.value as Palette)}>
              {(Object.keys(PALETTES) as Palette[]).map((p) => (
                <option key={p} value={p}>
                  {t.palettes[p]}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={calm} onChange={(e) => setCalm(e.target.checked)} />
            <span>
              {t.calm}
              <span className={styles.small}>{t.calmHint}</span>
            </span>
          </label>
        </div>
      </section>

      {!playing && !compare && stats ? (
        <section className={styles.proof} aria-labelledby="phantom-proof">
          <h2 id="phantom-proof">{t.proofTitle}</h2>
          {stats.inside < 20 ? (
            <p className={styles.small}>{t.proofEmpty}</p>
          ) : (
            <>
              <p className={styles.small}>{t.proofIntro}</p>
              <table className={styles.proofTable}>
                <thead>
                  <tr>
                    <td />
                    <th scope="col">{t.proofInside}</th>
                    <th scope="col">{t.proofOutside}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">{t.proofLight}</th>
                    <td>{pct(stats.insideLight)}</td>
                    <td>{pct(stats.outsideLight)}</td>
                  </tr>
                  <tr>
                    <th scope="row">{t.proofAlike}</th>
                    <td>{pct(stats.insideAlike)}</td>
                    <td>{pct(stats.outsideAlike)}</td>
                  </tr>
                </tbody>
              </table>
              <p>{t.proofVerdict}</p>
            </>
          )}
        </section>
      ) : null}

      <section className={styles.notes}>
        <div>
          <h2>{t.howTitle}</h2>
          {t.how.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <div>
          <h2>{t.limitsTitle}</h2>
          <ul>
            {t.limits.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p>{t.privacy}</p>
        </div>
      </section>
    </div>
  );
}
