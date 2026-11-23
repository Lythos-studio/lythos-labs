"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useEffect, useState } from "react";
import type { BlockEntry } from "../catalog-types";
import type { ThemeState } from "../theme/theme-vars";
import type { LabCopy, LabLocale } from "./copy";
import { fixtures } from "./fixtures";
import styles from "./lab.module.css";
import { ThemedBox } from "./ThemedBox";
import type { PlaygroundDef, PlaygroundValues } from "./types";

export function Playground({ entry, theme, t, locale }: { entry: BlockEntry; theme: ThemeState; t: LabCopy; locale: LabLocale }) {
  const [def, setDef] = useState<PlaygroundDef | null | undefined>(undefined);
  const [values, setValues] = useState<PlaygroundValues>({});
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let alive = true;
    fixtures[entry.meta.slug]?.().then((m) => {
      if (!alive) return;
      setDef(m.playground ?? null);
      if (m.playground) setValues(Object.fromEntries(m.playground.controls.map((c) => [c.name, c.default])));
    });
    return () => {
      alive = false;
    };
  }, [entry.meta.slug]);
  if (!def) return null;
  const code = def.code(values);
  return (
    <section className={styles.section} aria-labelledby="playground-title">
      <h2 id="playground-title">{t.playgroundTitle}</h2>
      <p className={styles.lead}>{t.playgroundIntro}</p>
      <div className={styles.playground}>
        <div className={styles.controls}>
          {def.controls.map((c) => (
            <label key={c.name}>
              <span>{c.label[locale]}</span>
              {c.kind === "select" ? (
                <select value={String(values[c.name])} onChange={(e) => setValues({ ...values, [c.name]: e.target.value })}>
                  {c.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : c.kind === "boolean" ? (
                <input type="checkbox" checked={values[c.name] === true} onChange={(e) => setValues({ ...values, [c.name]: e.target.checked })} />
              ) : (
                <input type="text" value={String(values[c.name] ?? "")} onChange={(e) => setValues({ ...values, [c.name]: e.target.value })} />
              )}
            </label>
          ))}
        </div>
        <div className={styles.section}>
          <div className={styles.stageWrap}>
            <ThemedBox theme={theme}>{def.render(values)}</ThemedBox>
          </div>
          <pre className={styles.code} tabIndex={0} aria-label={t.codeTitle}>
            <code>{code}</code>
          </pre>
          <div className={styles.toolbar}>
            <button
              type="button"
              className={styles.ghost}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  // Clipboard blocked: the code stays selectable.
                }
              }}
            >
              {copied ? t.copied : t.codeCopy}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
