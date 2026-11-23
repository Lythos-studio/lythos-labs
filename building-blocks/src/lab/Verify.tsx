"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { createElement, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { BlockEntry } from "../catalog-types";
import { runBehaviour, runContract, type Mounted } from "../harness/run";
import type { BehaviourResult } from "../harness/types";
import { themeVars, type ThemeState } from "../theme/theme-vars";
import { fixtures } from "./fixtures";
import { registerTestHook } from "./hooks";
import styles from "./lab.module.css";
import type { LabCopy } from "./copy";

/** Mounts a fresh, isolated copy of the fixture (off screen but fully rendered), so one behaviour cannot disturb the next. */
export async function mountFixture(slug: string, theme: ThemeState): Promise<Mounted> {
  const mod = await fixtures[slug]();
  const host = document.createElement("div");
  host.className = "lb-root";
  host.setAttribute("data-lb-verify-host", "");
  for (const [k, v] of Object.entries(themeVars(theme.settings, theme.mode))) host.style.setProperty(k, v);
  Object.assign(host.style, { position: "fixed", left: "-10000px", top: "0", width: "900px" });
  document.body.appendChild(host);
  const root = createRoot(host);
  flushSync(() => root.render(createElement(mod.Fixture)));
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  return {
    root: host,
    unmount() {
      root.unmount();
      host.remove();
    },
  };
}

export function Verify({ entry, theme, t }: { entry: BlockEntry; theme: ThemeState; t: LabCopy }) {
  const { contract, meta } = entry;
  const [results, setResults] = useState<Record<string, BehaviourResult>>({});
  const [running, setRunning] = useState(false);

  useEffect(
    () =>
      registerTestHook("run", async (slug, behaviours) => {
        const out: BehaviourResult[] = [];
        for (const b of behaviours) {
          const m = await mountFixture(slug, theme);
          try {
            out.push(await runBehaviour(m.root, b));
          } finally {
            m.unmount();
          }
        }
        return out;
      }),
    [theme],
  );

  async function run() {
    setRunning(true);
    setResults({});
    const out = await runContract(contract, () => mountFixture(meta.slug, theme));
    setResults(Object.fromEntries(out.map((r) => [r.id, r])));
    setRunning(false);
  }

  const done = Object.values(results);
  const pass = done.filter((r) => r.status === "pass").length;
  const fail = done.filter((r) => r.status === "fail").length;
  const checked = contract.behaviours.filter((b) => b.kind !== "native").length;

  return (
    <section className={styles.section} aria-labelledby={`verify-${meta.slug}`}>
      <div className={styles.sectionHead}>
        <h2 id={`verify-${meta.slug}`}>{t.verifyTitle}</h2>
        <button type="button" className={styles.primary} onClick={run} disabled={running} data-lb-verify="">
          {running ? t.verifyRunning : t.verifyRun}
        </button>
      </div>
      <p className={styles.lead}>{t.verifyIntro}</p>
      <p role="status" className={styles.small} data-lb-summary="">
        {done.length ? t.verifySummary(pass, fail, checked) : ""}
      </p>
      <ul className={styles.contract}>
        {contract.behaviours.map((b) => {
          const r = results[b.id];
          const state = b.kind === "native" ? "native" : (r?.status ?? "idle");
          return (
            <li key={b.id} data-lb-behaviour={b.id} data-lb-result={r?.status ?? (b.kind === "native" ? "skipped" : "idle")}>
              <span className={styles.kind}>{t.kinds[b.kind]}</span>
              <span>{b.title}</span>
              <span className={`${styles.state} ${styles[`state_${state}`]}`}>{t.states[state as keyof typeof t.states]}</span>
              {r?.status === "fail" && r.reason ? <span className={styles.reason}>{r.reason}</span> : null}
              {b.kind === "native" && b.note ? <span className={styles.reason}>{b.note}</span> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
