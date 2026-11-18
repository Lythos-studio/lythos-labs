"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useDeferredValue, useMemo, useRef, useState, type DragEvent } from "react";
import { composeLabCopy, type Locale } from "./copy";
import { Diagram, type Positions } from "./diagram";
import { EXAMPLES } from "./examples";
import { fixFor } from "./fixes";
import { layout as makeLayout } from "./layout";
import { LIMITS, type Compose, type Port } from "./model";
import { parseCompose } from "./parse";
import { evaluate, RULES, type Finding, type Group, type RuleId } from "./rules";
import styles from "./compose-lab.module.css";

const GROUPS: Group[] = ["security", "reliability", "structure"];
const portText = (p: Port) => `${p.hostIp ? `${p.hostIp}:` : ""}${p.published ? `${p.published}:` : ""}${p.target}${p.protocol === "tcp" ? "" : `/${p.protocol}`}`;

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

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ComposeLab({ locale }: { locale: Locale }) {
  const t = composeLabCopy[locale];
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [showValues, setShowValues] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [moved, setMoved] = useState<{ for: Compose | null; pos: Positions }>({ for: null, pos: {} });
  const svgRef = useRef<SVGSVGElement>(null);

  const deferred = useDeferredValue(text);
  const parsed = useMemo(() => parseCompose(deferred), [deferred]);
  const compose = parsed.ok ? parsed.compose : null;
  const findings = useMemo(() => (compose ? evaluate(compose) : []), [compose]);
  const base = useMemo(() => (compose ? makeLayout(compose) : null), [compose]);
  const positions: Positions = useMemo(() => {
    const start = Object.fromEntries((base?.nodes ?? []).map((n) => [n.name, { x: n.x, y: n.y }]));
    return { ...start, ...(moved.for === compose ? moved.pos : {}) };
  }, [base, compose, moved]);

  const counts = { fail: 0, warn: 0, info: 0 };
  for (const f of findings) counts[f.level]++;
  const active = selected && compose?.services.some((s) => s.name === selected) ? selected : null;
  const shown = active ? findings.filter((f) => f.services.includes(active)) : findings;

  const cards = useMemo(() => {
    const byRule = new Map<RuleId, Finding[]>();
    for (const f of shown) byRule.set(f.id, [...(byRule.get(f.id) ?? []), f]);
    return [...byRule.entries()];
  }, [shown]);

  async function load(file: File) {
    setText(await file.slice(0, LIMITS.chars + 1).text());
    setSelected(null);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void load(file);
  }

  function svgText() {
    const svg = svgRef.current;
    return svg ? new XMLSerializer().serializeToString(svg) : "";
  }

  function exportPng() {
    const svg = svgRef.current;
    if (!svg) return;
    const url = URL.createObjectURL(new Blob([svgText()], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = 2;
      canvas.width = svg.width.baseVal.value * scale;
      canvas.height = svg.height.baseVal.value * scale;
      const ctx = canvas.getContext("2d");
      ctx?.scale(scale, scale);
      ctx?.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => blob && download("compose-stack.png", blob));
    };
    img.src = url;
  }

  const nameOf = (c: string[]) => c.join(", ");

  return (
    <div className={styles.lab}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>{t.eyebrow}</p>
        <h1>{t.heading}</h1>
        <p>{t.intro}</p>
      </header>

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
          <label htmlFor="cl-text">{t.inputLabel}</label>
          <textarea
            id="cl-text"
            className={styles.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.placeholder}
            rows={12}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            aria-describedby="cl-hint"
          />
          <p id="cl-hint" className={styles.small}>
            {t.dropHint}
          </p>
        </div>
        <div className={styles.actions}>
          {EXAMPLES.map((e) => (
            <button
              key={e.id}
              type="button"
              className={styles.ghost}
              onClick={() => {
                setText(e.yaml);
                setSelected(null);
              }}
            >
              {t.tryExample}: {t.examples[e.id]}
            </button>
          ))}
          {text && (
            <button
              type="button"
              className={styles.ghost}
              onClick={() => {
                setText("");
                setSelected(null);
              }}
            >
              {t.clear}
            </button>
          )}
        </div>
        <p className={styles.error} role="alert">
          {!parsed.ok && parsed.error.code !== "empty" ? t.errors[parsed.error.code](parsed.error) : ""}
        </p>
      </section>

      {compose && base && (
        <>
          <section className={styles.block} aria-labelledby="cl-diagram">
            <div className={styles.blockHead}>
              <h2 id="cl-diagram">{t.diagramTitle}</h2>
              <div className={styles.actions}>
                <button type="button" className={styles.ghost} onClick={() => download("compose-stack.svg", new Blob([svgText()], { type: "image/svg+xml" }))}>
                  {t.exportSvg}
                </button>
                <button type="button" className={styles.ghost} onClick={exportPng}>
                  {t.exportPng}
                </button>
              </div>
            </div>
            <p className={`${styles.small} ${styles.onlyWide}`}>
              {t.diagramHint} {t.exportNote}
            </p>
            <p className={`${styles.small} ${styles.onlyNarrow}`}>{t.noDiagram}</p>
            <div className={`${styles.diagram} ${styles.onlyWide}`}>
              <Diagram
                compose={compose}
                layout={base}
                positions={positions}
                findings={findings}
                selected={active}
                svgRef={svgRef}
                labels={{ internet: t.internet, alt: t.diagramAlt, levels: t.levels }}
                onSelect={setSelected}
                onMove={(name, x, y) => setMoved((m) => ({ for: compose, pos: { ...(m.for === compose ? m.pos : {}), [name]: { x, y } } }))}
              />
            </div>
          </section>

          <section className={styles.block} aria-labelledby="cl-findings">
            <h2 id="cl-findings">{t.summaryTitle}</h2>
            <p className={styles.summary} role="status">
              {t.summary(counts.fail, counts.warn, counts.info)}
            </p>
            {active && (
              <p className={styles.filter}>
                {t.showing(active)}{" "}
                <button type="button" className={styles.ghost} onClick={() => setSelected(null)}>
                  {t.showAll}
                </button>
              </p>
            )}
            {GROUPS.map((group) => {
              const inGroup = cards.filter(([id]) => RULES[id] === group);
              if (!inGroup.length) return null;
              return (
                <div key={group} className={styles.group}>
                  <h3>{t.groups[group]}</h3>
                  <ul className={styles.rules}>
                    {inGroup.map(([id, list]) => {
                      const r = t.rules[id];
                      return (
                        <li key={id} className={`${styles.rule} ${styles[list[0].level]}`}>
                          <div className={styles.ruleHead}>
                            <h4>{r.title}</h4>
                            <span className={styles.badge}>{t.levels[list[0].level]}</span>
                          </div>
                          <ul className={styles.occurrences}>
                            {list.map((f, i) => {
                              const fix = fixFor(f, compose);
                              return (
                                <li key={i}>
                                  <p>{r.what({ services: nameOf(f.services), detail: f.detail ?? "" })}</p>
                                  {fix && (
                                    <div className={styles.fix}>
                                      <span className={styles.small}>{t.fix}</span>
                                      <div className={styles.record}>
                                        <pre>{fix}</pre>
                                        <CopyButton value={fix} label={t.copy} done={t.copied} />
                                      </div>
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                          <details>
                            <summary>
                              {t.why} / {t.fine}
                            </summary>
                            <p>
                              <strong>{t.why}.</strong> {r.why}
                            </p>
                            <p>
                              <strong>{t.fine}.</strong> {r.fine}
                            </p>
                          </details>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </section>

          <section className={styles.block} aria-labelledby="cl-list">
            <div className={styles.blockHead}>
              <h2 id="cl-list">{t.listTitle}</h2>
              <label className={styles.check}>
                <input type="checkbox" checked={showValues} onChange={(e) => setShowValues(e.target.checked)} />
                <span>{t.showValues}</span>
              </label>
            </div>
            <p className={styles.small}>{showValues ? t.valuesWarning : t.keysOnly}</p>
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    {Object.values(t.columns).map((c) => (
                      <th key={c} scope="col">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compose.services.map((s) => {
                    const mine = findings.filter((f) => f.services.includes(s.name));
                    return (
                      <tr key={s.name} className={s.name === active ? styles.activeRow : undefined}>
                        <th scope="row">{s.name}</th>
                        <td>{s.image?.raw ?? (s.hasBuild ? "build" : t.none)}</td>
                        <td>{s.ports.length ? s.ports.map(portText).join(", ") : t.none}</td>
                        <td>{s.dependsOn.length ? s.dependsOn.map((d) => d.name).join(", ") : t.none}</td>
                        <td>{s.networks.length ? s.networks.join(", ") : t.none}</td>
                        <td>{s.mounts.length ? s.mounts.map((m) => m.source ?? m.target).join(", ") : t.none}</td>
                        <td>
                          {s.env.length
                            ? s.env.map((e) => (showValues && e.value !== undefined ? `${e.key}=${e.value}` : e.key)).join(", ")
                            : t.none}
                        </td>
                        <td>{mine.length ? mine.map((f) => t.rules[f.id].title).join("; ") : t.levels.ok}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <section className={styles.notes}>
        <div>
          <h2>{t.howTitle}</h2>
          <ul>
            {t.how.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2>{t.limitsTitle}</h2>
          <ul>
            {t.limits.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
