"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useMemo, useState } from "react";
import { composeLabCopy, type Locale } from "./copy";
import { diffLines, improve, IMPROVE_DEFAULT_ON, maskSecretLine, type ImproveId } from "./improve";
import { CopyButton, download } from "./ui";
import styles from "./compose-lab.module.css";

const CONTEXT = 2;

export function ImproveSection({ locale, text }: { locale: Locale; text: string }) {
  const t = composeLabCopy[locale];
  const [choice, setChoice] = useState<ImproveId[]>([...IMPROVE_DEFAULT_ON]);
  const result = useMemo(() => improve(text, choice), [text, choice]);
  const chosen = result.ok ? result.changes.filter((c) => choice.includes(c.id)) : [];
  const lines = useMemo(() => (result.ok && result.output !== text ? diffLines(text, result.output) : []), [result, text]);
  // Show the changed lines with a little context, and a gap marker between far-apart changes.
  const shown = useMemo(() => {
    const keep = lines.map((l, i) => l.kind !== "same" || lines.slice(Math.max(0, i - CONTEXT), i + CONTEXT + 1).some((n) => n.kind !== "same"));
    return lines.flatMap((l, i) => (keep[i] ? [{ ...l, gap: false }] : keep[i - 1] === true && keep[i + 1] !== true ? [{ kind: "same" as const, text: "...", gap: true }] : []));
  }, [lines]);

  return (
    <section className={styles.block} aria-labelledby="cl-improve">
      <h2 id="cl-improve">{t.improveTitle}</h2>
      <p className={styles.small}>{t.improveIntro}</p>
      {!result.ok && result.reason === "multiple-files" && <p className={styles.small}>{t.improveMultiple}</p>}
      {result.ok && result.changes.length === 0 && <p className={styles.small}>{t.improveNone}</p>}
      {result.ok && result.changes.length > 0 && (
        <>
          <ul className={styles.changeList}>
            {result.changes.map((c) => (
              <li key={c.id}>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={choice.includes(c.id)}
                    onChange={(e) => setChoice((all) => (e.target.checked ? [...all, c.id] : all.filter((x) => x !== c.id)))}
                  />
                  <span>
                    <strong>{t.improveChanges[c.id].title}</strong>
                    {c.services.length ? ` (${t.improveIn(c.services.join(", "))})` : ""}
                    {!IMPROVE_DEFAULT_ON.includes(c.id) ? ` - ${t.improveOffByDefault}` : ""}
                    <br />
                    <span className={styles.small}>{t.improveChanges[c.id].detail}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <h3>{t.diffTitle}</h3>
          {chosen.length === 0 ? (
            <p className={styles.small}>{t.diffNone}</p>
          ) : (
            <>
              <pre className={styles.diff} tabIndex={0} aria-label={t.diffTitle}>
                {shown.map((l, i) => (
                  <span key={i} className={l.kind === "added" ? styles.added : l.kind === "removed" ? styles.removed : undefined}>
                    <span className={styles.visuallyHidden}>{l.kind === "added" ? `${t.diffAdded}: ` : l.kind === "removed" ? `${t.diffRemoved}: ` : ""}</span>
                    {l.kind === "added" ? "+ " : l.kind === "removed" ? "- " : "  "}
                    {maskSecretLine(l.text)}
                  </span>
                ))}
              </pre>
              <div className={styles.actions}>
                <CopyButton value={result.output} label={t.improveCopy} done={t.copied} />
                <button type="button" className={styles.ghost} onClick={() => download("docker-compose.improved.yml", new Blob([result.output], { type: "text/yaml" }))}>
                  {t.improveDownload}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
