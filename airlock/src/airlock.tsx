"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useMemo, useState } from "react";
import { payloadFor, TECHNIQUES, type TechniqueId } from "./attacks";
import { airlockCopy, type Locale } from "./copy";
import { FlowGraph } from "./graph";
import { isTrusted, shown, type Val } from "./model";
import { depth, prove, staticReport, type DepthRow, type Proof } from "./prove";
import { POLICY_KEYS, runAgent, STRICT, type Entry, type Policy, type RunResult, type Scenario } from "./run";
import { benignAttack, benignText, scenarios, SCENARIO_IDS, worstCaseReader, type ScenarioId } from "./scenarios";
import styles from "./airlock.module.css";

const WORLDS = 2000;
const short = (s: string, n = 64) => {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n - 1)}...` : one;
};

function tone(v: Val): "trusted" | "untrusted" | "private" {
  return !isTrusted(v.label) ? "untrusted" : v.label.readers ? "private" : "trusted";
}

function CallCard({ entry, locale, side, onApprove }: { entry: Entry; locale: Locale; side: "naive" | "airlock"; onApprove?: (key: string) => void }) {
  const t = airlockCopy[locale];
  // Free text stays readable; addresses, accounts and links show hidden or lookalike characters.
  const show = (k: string, v: string) => (["body", "text", "summary", "subject"].includes(k) ? v : shown(v));
  const values = Object.fromEntries(Object.entries(entry.args).map(([k, v]) => [k, short(show(k, v.v), 40)]));
  const statusClass = styles[`st_${entry.status}`];
  return (
    <li className={`${styles.call} ${entry.harm.length ? styles.harmful : ""}`}>
      <div className={styles.callHead}>
        <span className={`${styles.badge} ${statusClass}`}>{t.status[entry.status]}</span>
        <strong>{t.calls[entry.tool](values)}</strong>
        {entry.injected ? <span className={styles.injected}>{t.addedByText}</span> : null}
      </div>
      {entry.tool !== "extract" && Object.keys(entry.args).length ? (
        <ul className={styles.args}>
          {Object.entries(entry.args).map(([name, v]) => (
            <li key={name} className={styles[`tone_${tone(v)}`]}>
              <span className={styles.argName}>{name}</span> {short(show(name, v.v), 48)}{" "}
              <span className={styles.argTone}>
                {t.legend[tone(v)]}
                {tone(v) === "untrusted" && v.label.readers ? `, ${t.legend.private}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {entry.harm.length ? (
        <ul className={styles.harms}>
          {entry.harm.map((h) => (
            <li key={h}>{t.harms[h]}</li>
          ))}
        </ul>
      ) : null}
      {entry.reasons.length && (side === "airlock" || entry.status === "run") ? (
        <div className={styles.reasons}>
          {side === "naive" ? <span className={styles.small}>{t.wouldStop}</span> : null}
          {entry.reasons.map((r, i) => (
            <p key={i}>{t.reason(r)}</p>
          ))}
        </div>
      ) : null}
      {side === "airlock" && entry.status === "ask" && onApprove ? (
        <button type="button" className={styles.ghost} onClick={() => onApprove(entry.key)}>
          {t.approve}
        </button>
      ) : null}
    </li>
  );
}

function Column({ title, note, run, locale, side, onApprove }: { title: string; note: string; run: RunResult; locale: Locale; side: "naive" | "airlock"; onApprove?: (key: string) => void }) {
  const t = airlockCopy[locale];
  return (
    <section className={`${styles.column} ${side === "airlock" ? styles.columnSafe : ""}`} aria-label={title}>
      <h3>{title}</h3>
      <p className={styles.small}>{note}</p>
      <p className={`${styles.verdict} ${run.harms ? styles.verdictBad : styles.verdictGood}`} aria-live="polite">
        {t.harmful(run.harms)}
      </p>
      <ol className={styles.calls}>
        {run.entries.map((e, i) => (
          <CallCard key={i} entry={e} locale={locale} side={side} onApprove={onApprove} />
        ))}
      </ol>
    </section>
  );
}

export function Airlock({ locale }: { locale: Locale }) {
  const t = airlockCopy[locale];
  const all = useMemo(() => scenarios(locale), [locale]);
  const fmt = (n: number) => new Intl.NumberFormat(locale === "nl" ? "nl-NL" : "en-GB").format(n);

  const [id, setId] = useState<ScenarioId>("invoice");
  const s: Scenario = all[id];
  const [text, setText] = useState(() => benignText(all.invoice));
  const [reader, setReader] = useState<Record<string, string>>(() => benignAttack(all.invoice).reader);
  const [policy, setPolicy] = useState<Policy>(STRICT);
  const [approvals, setApprovals] = useState<Set<string>>(new Set());
  const [graphSide, setGraphSide] = useState<"airlock" | "naive">("airlock");
  const [proof, setProof] = useState<Proof | null>(null);
  const [proving, setProving] = useState(false);
  const [rows, setRows] = useState<DepthRow[] | null>(null);
  const [measuring, setMeasuring] = useState(false);

  function choose(next: ScenarioId) {
    setId(next);
    setText(benignText(all[next]));
    setReader(benignAttack(all[next]).reader);
    setApprovals(new Set());
    setProof(null);
    setRows(null);
  }
  function addTechnique(tech: TechniqueId) {
    const next = `${text}\n\n${payloadFor(tech)}`;
    setText(next);
    setReader(worstCaseReader(s, next));
    setApprovals(new Set());
  }
  function changePolicy(key: keyof Policy, on: boolean) {
    setPolicy((p) => ({ ...p, [key]: on }));
    setProof(null);
  }

  const naive = useMemo(() => runAgent(s, { text, reader }, { mode: "naive" }), [s, text, reader]);
  const safe = useMemo(() => runAgent(s, { text, reader }, { mode: "airlock", policy, approvals }), [s, text, reader, policy, approvals]);
  const plan = useMemo(() => staticReport(s), [s]);
  const extracts = s.plan.filter((p): p is Extract<Scenario["plan"][number], { kind: "extract" }> => p.kind === "extract");
  const target = s.target.kind === "email" ? t.attackerEmail(s.world.emails[s.target.id].from) : t.attackerPage(s.target.id);

  function runProver() {
    setProving(true);
    // Let the button show its busy state before the work starts.
    setTimeout(() => {
      setProof(prove(s, policy, WORLDS, 1));
      setProving(false);
    }, 30);
  }
  function runDepth() {
    setMeasuring(true);
    setTimeout(() => {
      setRows(depth(s, STRICT, 300, 5));
      setMeasuring(false);
    }, 30);
  }

  return (
    <div className={styles.lab}>
      <section className={styles.intro} aria-labelledby="airlock-title">
        <p className={styles.eyebrow}>{t.eyebrow}</p>
        <h1 id="airlock-title">{t.heading}</h1>
        <p>{t.intro}</p>
        <p className={styles.callout}>{t.youAre}</p>
      </section>

      <section className={styles.block} aria-labelledby="airlock-task">
        <h2 id="airlock-task">{t.scenarioLabel}</h2>
        <div className={styles.pills} role="group" aria-label={t.scenarioLabel}>
          {SCENARIO_IDS.map((sid) => (
            <button key={sid} type="button" className={styles.pill} aria-pressed={sid === id} onClick={() => choose(sid)}>
              {t.scenarios[sid].name}
            </button>
          ))}
        </div>
        <blockquote className={styles.request}>{t.scenarios[id].request}</blockquote>
        <div className={styles.plan}>
          <h3>{t.planTitle}</h3>
          <p className={styles.small}>{t.planIntro}</p>
          <ol>
            {s.plan.map((step, i) => {
              const call = plan.find((c) => c.step === i);
              return (
                <li key={i}>
                  <code>{step.kind === "extract" ? `${step.bind} = read(${step.from}, ${step.schema})` : `${step.bind ? `${step.bind} = ` : ""}${step.tool}(${Object.keys(step.args).join(", ")})`}</code>
                  {call ? (
                    <span className={styles.planArgs}>
                      {call.args.map((a) => (
                        <span key={a.name} className={`${styles.planArg} ${styles[`tone_${a.from === "you" ? "trusted" : a.from === "file" ? "private" : "untrusted"}`]}`}>
                          {a.name}: {a.role === "control" ? t.control : t.data}, {a.from === "you" ? t.fromYou : a.from === "file" ? t.fromFile : t.fromUntrusted}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className={styles.workbench} aria-label={t.attackerTitle}>
        <div className={styles.attacker}>
          <h2>{t.attackerTitle}</h2>
          <label htmlFor="airlock-doc" className={styles.small}>
            {target}
          </label>
          <textarea id="airlock-doc" className={styles.textarea} value={text} spellCheck={false} onChange={(e) => setText(e.target.value)} />
          <div className={styles.row}>
            <button type="button" className={styles.ghost} onClick={() => setReader(worstCaseReader(s, text))}>
              {t.worstCase}
            </button>
            <button
              type="button"
              className={styles.ghost}
              onClick={() => {
                setText(benignText(s));
                setReader(benignAttack(s).reader);
                setApprovals(new Set());
              }}
            >
              {t.resetText}
            </button>
          </div>
          <h3 className={styles.subhead}>{t.techniques}</h3>
          <div className={styles.techniques}>
            {TECHNIQUES.map((tech) => (
              <button key={tech.id} type="button" className={styles.chip} onClick={() => addTechnique(tech.id)}>
                {t.techniqueNames[tech.id]}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.reader}>
          <h2>{t.readerTitle}</h2>
          <p className={styles.small}>{t.readerIntro}</p>
          {extracts.map((step) => (
            <label key={step.bind} className={styles.field}>
              <span>
                {t.binds[step.bind] ?? step.bind} <span className={styles.small}>({t.schemas[step.schema]})</span>
              </span>
              {step.schema === "text" ? (
                <textarea className={styles.textareaSmall} value={reader[step.bind] ?? ""} onChange={(e) => setReader({ ...reader, [step.bind]: e.target.value })} />
              ) : (
                <input className={styles.input} value={reader[step.bind] ?? ""} spellCheck={false} onChange={(e) => setReader({ ...reader, [step.bind]: e.target.value })} />
              )}
            </label>
          ))}
        </div>
      </section>

      <section className={styles.versus} aria-label={`${t.ordinary} / ${t.airlock}`}>
        <Column title={t.ordinary} note={t.ordinaryNote} run={naive} locale={locale} side="naive" />
        <Column title={t.airlock} note={t.airlockNote} run={safe} locale={locale} side="airlock" onApprove={(key) => setApprovals(new Set([...approvals, key]))} />
      </section>

      <section className={styles.block} aria-labelledby="airlock-graph">
        <div className={styles.blockHead}>
          <h2 id="airlock-graph">{t.graphTitle}</h2>
          <button type="button" className={styles.ghost} onClick={() => setGraphSide(graphSide === "airlock" ? "naive" : "airlock")}>
            {graphSide === "airlock" ? t.showOrdinary : t.showAirlock}
          </button>
        </div>
        <p className={styles.small}>{t.graphIntro}</p>
        <FlowGraph run={graphSide === "airlock" ? safe : naive} locale={locale} title={`${t.graphTitle}: ${graphSide === "airlock" ? t.airlock : t.ordinary}`} />
      </section>

      <section className={styles.block} aria-labelledby="airlock-prover">
        <h2 id="airlock-prover">{t.proverTitle}</h2>
        <p className={styles.small}>{t.proverIntro}</p>
        <fieldset className={styles.rules}>
          <legend>{t.rulesTitle}</legend>
          <p className={styles.small}>{t.rulesIntro}</p>
          {POLICY_KEYS.map((key) => (
            <label key={key} className={styles.rule}>
              <input type="checkbox" checked={policy[key]} onChange={(e) => changePolicy(key, e.target.checked)} />
              <span>
                <strong>{t.rules[key].name}</strong>
                <span className={styles.small}>{t.rules[key].about}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className={styles.row}>
          <button type="button" className={styles.primary} onClick={runProver} disabled={proving}>
            {proving ? t.running : t.run(fmt(WORLDS))}
          </button>
        </div>
        <div aria-live="polite">
          {proof ? (
            <>
              <p className={styles.score}>{t.scoreboard(fmt(proof.worlds), fmt(proof.naiveHarmed), fmt(proof.airlockHarmed), fmt(proof.ms))}</p>
              <div className={styles.guarantees}>
                {(["control", "confidentiality", "plan"] as const).map((g) => {
                  const r = proof[g];
                  return (
                    <div key={g} className={`${styles.guarantee} ${r.holds ? styles.ok : styles.bad}`}>
                      <span className={styles.badge}>{r.holds ? t.holds : t.broken(fmt(r.violations))}</span>
                      <h3>{t.guarantees[g].name}</h3>
                      <p className={styles.small}>{t.guarantees[g].about}</p>
                      {r.example ? (
                        <div className={styles.counter}>
                          <strong>{t.counterexample}</strong>
                          <p>{r.example.techniques.map((x) => t.techniqueNames[x]).join(" + ")}</p>
                          <p>
                            {t.calls[r.example.entry.tool](Object.fromEntries(Object.entries(r.example.entry.args).map(([k, v]) => [k, short(shown(v.v), 40)])))}
                            {r.example.entry.harm.length ? `: ${r.example.entry.harm.map((h) => t.harms[h]).join(", ")}` : ""}
                          </p>
                          <button
                            type="button"
                            className={styles.ghost}
                            onClick={() => {
                              setText(r.example!.attack.text);
                              setReader(r.example!.attack.reader);
                              setApprovals(new Set());
                            }}
                          >
                            {t.load}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      </section>

      <section className={styles.block} aria-labelledby="airlock-depth">
        <h2 id="airlock-depth">{t.depthTitle}</h2>
        <p className={styles.small}>{t.depthIntro}</p>
        <div className={styles.row}>
          <button type="button" className={styles.ghost} onClick={runDepth} disabled={measuring}>
            {measuring ? t.running : t.depthRun}
          </button>
        </div>
        {rows ? (
          <div className={styles.tableWrap}>
            <table className={styles.depth}>
              <thead>
                <tr>
                  <th scope="col">{t.depthOff}</th>
                  <th scope="col">{t.guarantees.control.name}</th>
                  <th scope="col">{t.guarantees.confidentiality.name}</th>
                  <th scope="col">{t.guarantees.plan.name}</th>
                  <th scope="col">{t.depthHarmed}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.off.join("+") || "none"}>
                    <th scope="row">{r.off.length ? r.off.map((k) => t.rules[k].name).join(" + ") : t.depthNone}</th>
                    {[r.control, r.confidentiality, r.plan, r.harmed].map((n, i) => (
                      <td key={i} className={n ? (i === 3 ? styles.cellHarm : styles.cellWarn) : styles.cellOk}>
                        {n ? `${fmt(n)} / ${fmt(r.worlds)}` : "0"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className={styles.notes}>
        <div>
          <h2>{t.threatTitle}</h2>
          <ul>
            {t.threat.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
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
          <h2>{t.libraryTitle}</h2>
          <p>{t.libraryIntro}</p>
          <pre className={styles.code}>
            <code>{`import { check, STRICT } from "@lythos-labs/airlock";

// args carry labels: where each value came from, who may read it
const verdict = check("send_email", args, world, STRICT);
if (verdict.status === "run") await tools.send_email(args);
else if (verdict.status === "ask") await askUser(verdict.reasons);
else log("blocked", verdict.reasons);`}</code>
          </pre>
          <p>{t.privacy}</p>
        </div>
      </section>
    </div>
  );
}
