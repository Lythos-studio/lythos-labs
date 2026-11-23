"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useEffect, useState } from "react";
import { catalog } from "../catalog";
import type { BlockEntry } from "../catalog-types";
import type { LabCopy } from "./copy";
import { resolveClosure } from "./kit/resolve";
import styles from "./lab.module.css";
import { kitPath } from "./paths";
import type { LabLocale } from "./copy";

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function CodeView({ entry, t, locale, base = "" }: { entry: BlockEntry; t: LabCopy; locale: LabLocale; base?: string }) {
  const [sources, setSources] = useState<Record<string, string> | null>(null);
  const [file, setFile] = useState(entry.meta.files[0]);
  const [done, setDone] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    import("../generated/sources").then((m) => alive && setSources(m.sources));
    return () => {
      alive = false;
    };
  }, []);

  const flash = (key: string) => {
    setDone(key);
    setTimeout(() => setDone(null), 2000);
  };

  return (
    <section className={styles.section} aria-labelledby={`code-${entry.meta.slug}`}>
      <h2 id={`code-${entry.meta.slug}`}>{t.codeTitle}</h2>
      <p className={styles.lead}>{t.codeIntro}</p>
      <div className={styles.fileTabs} role="group" aria-label={t.codeTitle}>
        {entry.meta.files.map((f) => (
          <button key={f} type="button" aria-pressed={file === f} onClick={() => setFile(f)}>
            {f.split("/").pop()}
          </button>
        ))}
      </div>
      {sources ? (
        <pre className={styles.code} tabIndex={0} aria-label={file} data-lb-code="">
          <code>{sources[file]}</code>
        </pre>
      ) : (
        <p className={styles.small}>{t.codeLoading}</p>
      )}
      <div className={styles.toolbar}>
        <button type="button" className={styles.ghost} disabled={!sources} onClick={async () => sources && (await copy(sources[file])) && flash("one")}>
          {done === "one" ? t.copied : t.codeCopy}
        </button>
        <button
          type="button"
          className={styles.ghost}
          disabled={!sources}
          onClick={async () => {
            if (!sources) return;
            const files = resolveClosure([entry.meta.slug], catalog.map((e) => e.meta), sources);
            if (await copy(files.map((f) => `/* ${f.path} */\n${f.content}`).join("\n\n"))) flash("all");
          }}
        >
          {done === "all" ? t.copied : t.codeCopyAll}
        </button>
        <a className={styles.ghost} href={`${base}${kitPath[locale]}?blocks=${entry.meta.slug}`}>
          {t.codeOpenKit}
        </a>
      </div>
    </section>
  );
}
