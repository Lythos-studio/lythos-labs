"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useDeferredValue, useEffect, useMemo, useState, type DragEvent } from "react";
import { analyze, LIMITS, type Analysis, type Finding, type Step } from "./analyze";
import { lockLabCopy, type Locale } from "./copy";
import { EXAMPLES } from "./examples";
import { blocksReads, blocksWrites, conflicts, MODES, type Mode } from "./locks";
import { fmtRows, fmtSeconds, Replay } from "./replay";
import { saferMigration } from "./safe";
import { DEFAULT_ROWS, DEFAULT_TRAFFIC, simulate, workMs, type Traffic } from "./simulate";
import styles from "./lock-lab.module.css";

const CONTROL = new Set(["begin", "commit", "rollback"]);

function Slider({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string }) {
  return (
    <label className={styles.slider}>
      <span>
        {label} <output>{format(value)}</output>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} aria-valuetext={format(value)} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function CopyButton({ value, label, done }: { value: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={styles.ghost}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard blocked: the text stays selectable on the page.
        }
      }}
    >
      {copied ? done : label}
    </button>
  );
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/sql" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function StepItem({ step, findings, analysis, rows, locale }: { step: Step; findings: Finding[]; analysis: Analysis; rows: (t: string) => number; locale: Locale }) {
  const t = lockLabCopy[locale];
  const created = new Set(analysis.steps.slice(0, step.index).filter((s) => s.kind === "create-table").map((s) => s.table));
  const label = step.kind === "alter-table" && step.actions.length ? `${t.kinds[step.kind]}: ${step.actions.map((a) => t.actions[a]).join(", ")}` : t.kinds[step.kind];
  const ms = workMs(step, rows);
  const worst = findings[0]?.level;
  return (
    <li className={`${styles.step} ${worst ? styles[worst] : ""}`}>
      <div className={styles.stepHead}>
        <span className={styles.stepLine}>{t.line(step.line)}</span>
        <strong>{label}</strong>
        {step.tx !== null ? <span className={styles.chip}>{t.inTx}</span> : null}
      </div>
      <code className={styles.stepCode}>{step.text.replace(/\s+/g, " ").slice(0, 160)}</code>
      {step.locks.length ? (
        <ul className={styles.locks}>
          {step.locks.map((l) => {
            const isNew = created.has(l.table) || (step.kind === "create-table" && l.table === step.table);
            const reads = blocksReads(l.mode);
            const writes = blocksWrites(l.mode) || l.rows;
            return (
              <li key={l.table} className={isNew ? styles.lockQuiet : reads ? styles.lockRed : writes ? styles.lockAmber : styles.lockGreen}>
                <span>{l.table}</span>
                <span className={styles.mode}>{MODES[l.mode]}</span>
                <span>{isNew ? t.newTable : l.rows ? `${t.blocksWrites}, ${t.rowLocks}` : reads ? t.blocksBoth : writes ? t.blocksWrites : t.blocksNothing}</span>
              </li>
            );
          })}
          <li className={styles.lockQuiet}>
            <span>{step.works.length ? t.holdFor(fmtSeconds(ms, locale)) : t.instant}</span>
            {step.concurrent ? <span>{t.waitsForOld}</span> : null}
          </li>
        </ul>
      ) : null}
      {findings.map((f) => {
        const r = t.rules[f.id];
        return (
          <div key={`${f.id}-${f.table}`} className={`${styles.finding} ${styles[f.level]}`}>
            <div className={styles.findingHead}>
              <h4>{r.title}</h4>
              <span className={styles.badge}>{t.levels[f.level]}</span>
            </div>
            <p>{r.what({ table: f.table, detail: f.detail })}</p>
            <p>
              <strong>{t.why}:</strong> {r.why}
            </p>
            <p>
              <strong>{t.fine}:</strong> {r.fine}
            </p>
          </div>
        );
      })}
    </li>
  );
}

function Matrix({ locale }: { locale: Locale }) {
  const t = lockLabCopy[locale];
  const [active, setActive] = useState<Mode | null>(null);
  return (
    <div className={styles.matrixWrap}>
      <table className={styles.matrix}>
        <caption className={styles.visuallyHidden}>{t.matrixCaption}</caption>
        <thead>
          <tr>
            <td />
            {MODES.map((m, i) => (
              <th key={m} scope="col" className={active === i ? styles.activeCell : undefined}>
                <abbr title={m}>{m.split(" ").map((w) => w[0]).join("")}</abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MODES.map((m, i) => (
            <tr key={m} className={active === i ? styles.activeRow : undefined}>
              <th scope="row">
                <button type="button" className={styles.modeButton} aria-pressed={active === i} onClick={() => setActive(active === i ? null : (i as Mode))}>
                  {m}
                </button>
              </th>
              {MODES.map((n, j) => {
                const hit = conflicts(i as Mode, j as Mode);
                return (
                  <td key={n} className={`${hit ? styles.hit : ""} ${active !== null && (active === i || active === j) && hit ? styles.hitActive : ""}`}>
                    <span aria-hidden="true">{hit ? "x" : ""}</span>
                    <span className={styles.visuallyHidden}>{hit ? t.conflict : t.noConflict}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LockLab({ locale }: { locale: Locale }) {
  const t = lockLabCopy[locale];
  // Starts with an example, so the replay shows what Lock lab does before anything is pasted.
  const [sql, setSql] = useState(EXAMPLES[0].sql);
  const [wrap, setWrap] = useState(EXAMPLES[0].wrap);
  const [rows, setRows] = useState<Record<string, number>>(EXAMPLES[0].rows);
  const [reads, setReads] = useState(DEFAULT_TRAFFIC.readsPerSec);
  const [writes, setWrites] = useState(DEFAULT_TRAFFIC.writesPerSec);
  const [slowS, setSlowS] = useState(DEFAULT_TRAFFIC.slowMs / 1000);
  const [timeoutS, setTimeoutS] = useState(DEFAULT_TRAFFIC.appTimeoutMs / 1000);
  const [dragging, setDragging] = useState(false);
  const [run, setRun] = useState(0);
  // The simulation runs in the browser only: it costs a few dozen milliseconds and the server has no use for it.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const text = useDeferredValue(sql);
  const result = useMemo(() => analyze(text, { wrap }), [text, wrap]);
  const analysis = result.ok ? result.analysis : null;
  const safer = useMemo(() => (analysis ? saferMigration(text, analysis, t.safe) : null), [analysis, text, t]);
  const saferAnalysis = useMemo(() => {
    if (!safer) return null;
    const r = analyze(safer.sql, { wrap: false });
    return r.ok ? r.analysis : null;
  }, [safer]);
  const traffic: Traffic = useMemo(() => ({ readsPerSec: reads, writesPerSec: writes, queryMs: DEFAULT_TRAFFIC.queryMs, slowMs: slowS * 1000, appTimeoutMs: timeoutS * 1000, rows }), [reads, writes, slowS, timeoutS, rows]);
  const deferredTraffic = useDeferredValue(traffic);
  const simA = useMemo(() => (mounted && analysis?.tables.length ? simulate(analysis, { traffic: deferredTraffic }) : null), [mounted, analysis, deferredTraffic]);
  const simB = useMemo(() => (mounted && saferAnalysis?.tables.length ? simulate(saferAnalysis, { traffic: deferredTraffic, retry: { attempts: 40, delayMs: 3000 } }) : null), [mounted, saferAnalysis, deferredTraffic]);
  const rowsOf = (table: string) => rows[table] ?? DEFAULT_ROWS;

  const counts = { fail: 0, warn: 0, info: 0 };
  for (const f of analysis?.findings ?? []) counts[f.level]++;

  function choose(id: string) {
    const ex = EXAMPLES.find((e) => e.id === id)!;
    setSql(ex.sql);
    setWrap(ex.wrap);
    setRows((r) => ({ ...r, ...ex.rows }));
    setRun((n) => n + 1);
  }
  async function load(file: File) {
    setSql(await file.slice(0, LIMITS.chars + 1).text());
    setRun((n) => n + 1);
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void load(file);
  }

  const errorText = !result.ok ? t.errors[result.error.code](result.error) : "";

  return (
    <div className={styles.lab}>
      <section className={styles.intro} aria-labelledby="lock-lab-title">
        <p className={styles.eyebrow}>{t.eyebrow}</p>
        <h1 id="lock-lab-title">{t.heading}</h1>
        <p>{t.intro}</p>
      </section>

      <section className={styles.input} aria-label={t.inputLabel}>
        <div
          className={`${styles.drop} ${dragging ? styles.dragging : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <label htmlFor="lock-lab-sql">{t.inputLabel}</label>
          <textarea
            id="lock-lab-sql"
            className={styles.textarea}
            value={sql}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            placeholder={t.placeholder}
            onChange={(e) => setSql(e.target.value)}
            aria-describedby="lock-lab-error lock-lab-privacy"
          />
          <p className={styles.small} id="lock-lab-privacy">
            {t.dropHint}. {t.privacy}
          </p>
          <p id="lock-lab-error" className={styles.error} role="alert">
            {errorText}
          </p>
        </div>
        <div className={styles.side}>
          <div className={styles.examples}>
            <span className={styles.small}>{t.examplesLabel}</span>
            <div className={styles.actions}>
              {EXAMPLES.map((ex) => (
                <button key={ex.id} type="button" className={styles.ghost} onClick={() => choose(ex.id)}>
                  {t.examples[ex.id]}
                </button>
              ))}
              <button type="button" className={styles.ghost} onClick={() => setSql("")}>
                {t.clear}
              </button>
            </div>
          </div>
          <label className={styles.check}>
            <input type="checkbox" checked={wrap} onChange={(e) => setWrap(e.target.checked)} />
            <span>
              {t.wrap}
              <span className={styles.small}>{analysis?.transaction === "explicit" ? t.explicitTx : t.wrapHint}</span>
            </span>
          </label>
          <fieldset className={styles.traffic}>
            <legend>{t.trafficTitle}</legend>
            <Slider label={t.reads} value={reads} min={0} max={2000} step={10} onChange={setReads} format={(v) => String(v)} />
            <Slider label={t.writes} value={writes} min={0} max={1000} step={5} onChange={setWrites} format={(v) => String(v)} />
            <Slider label={t.slow} value={slowS} min={0} max={60} step={1} onChange={setSlowS} format={(v) => (v ? `${v} s` : t.slowNone)} />
            <Slider label={t.appTimeout} value={timeoutS} min={0} max={60} step={1} onChange={setTimeoutS} format={(v) => (v ? `${v} s` : t.appTimeoutNever)} />
          </fieldset>
          {analysis?.tables.length ? (
            <fieldset className={styles.traffic}>
              <legend>{t.rowsTitle}</legend>
              <p className={styles.small}>{t.rowsHint}</p>
              <div className={styles.rows}>
                {analysis.tables.slice(0, 6).map((table) => (
                  <label key={table}>
                    <span>{table}</span>
                    <select
                      value={rowsOf(table)}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setRows((r) => ({ ...r, [table]: v }));
                      }}
                    >
                      {[...new Set([1_000, 100_000, 400_000, 1_000_000, 2_000_000, 3_000_000, 4_000_000, 6_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000, rowsOf(table)])]
                        .sort((x, y) => x - y)
                        .map((n) => (
                          <option key={n} value={n}>
                            {fmtRows(n, locale)}
                          </option>
                        ))}
                    </select>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
        </div>
      </section>

      {simA && analysis ? (
        <section className={styles.block} aria-labelledby="lock-lab-replay">
          <div className={styles.blockHead}>
            <h2 id="lock-lab-replay">{t.stageTitle}</h2>
          </div>
          <p className={styles.small}>{t.stageIntro}</p>
          <Replay key={run} a={simA} b={simB} stepsA={analysis.steps} stepsB={saferAnalysis?.steps ?? []} locale={locale} timeoutS={timeoutS} />
        </section>
      ) : null}

      {analysis ? (
        <section className={styles.block} aria-labelledby="lock-lab-steps">
          <h2 id="lock-lab-steps">{t.stepsTitle}</h2>
          <p className={styles.small}>{t.stepsIntro}</p>
          <p className={styles.summary}>{t.summary(counts.fail, counts.warn, counts.info)}</p>
          <ol className={styles.steps}>
            {analysis.steps
              .filter((s) => !CONTROL.has(s.kind))
              .map((s) => (
                <StepItem key={s.index} step={s} findings={analysis.findings.filter((f) => f.step === s.index)} analysis={analysis} rows={rowsOf} locale={locale} />
              ))}
          </ol>
        </section>
      ) : null}

      {safer ? (
        <section className={styles.block} aria-labelledby="lock-lab-safer">
          <div className={styles.blockHead}>
            <h2 id="lock-lab-safer">{t.saferTitle}</h2>
            <div className={styles.actions}>
              <CopyButton value={safer.sql} label={t.copy} done={t.copied} />
              <button type="button" className={styles.ghost} onClick={() => download("migration.safer.sql", safer.sql)}>
                {t.download}
              </button>
            </div>
          </div>
          <p className={styles.small}>
            {t.saferIntro} {t.saferRewritten(safer.rewritten.length, safer.manual.length)}
          </p>
          <pre className={styles.code}>
            <code>{safer.sql}</code>
          </pre>
        </section>
      ) : null}

      <section className={styles.block} aria-labelledby="lock-lab-matrix">
        <h2 id="lock-lab-matrix">{t.matrixTitle}</h2>
        <p className={styles.small}>{t.matrixIntro}</p>
        <Matrix locale={locale} />
      </section>

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
