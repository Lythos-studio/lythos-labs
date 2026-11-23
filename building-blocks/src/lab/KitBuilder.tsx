"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useEffect, useMemo, useState } from "react";
import { catalog } from "../catalog";
import { buildKitFiles, kitZip } from "./kit/build";
import { resolveClosure } from "./kit/resolve";
import { labCopy, type LabLocale } from "./copy";
import styles from "./lab.module.css";
import { ThemeBar } from "./ThemeBar";
import { useThemeHash } from "./use-theme";

export function KitBuilder({ locale, base = "" }: { locale: LabLocale; base?: string }) {
  const t = labCopy[locale];
  const [theme, setTheme] = useThemeHash();
  const [picked, setPicked] = useState<string[]>([]);
  const [sources, setSources] = useState<Record<string, string> | null>(null);
  const metas = useMemo(() => catalog.map((e) => e.meta), []);

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("blocks")?.split(",") ?? [];
    setPicked(wanted.filter((s) => metas.some((m) => m.slug === s)));
    let alive = true;
    import("../generated/sources").then((m) => alive && setSources(m.sources));
    return () => {
      alive = false;
    };
  }, [metas]);

  const closure = useMemo(() => (sources && picked.length ? resolveClosure(picked, metas, sources) : []), [sources, picked, metas]);
  const extra = useMemo(() => [...new Set(closure.map((f) => f.path.split("/")).filter((p) => p[0] === "blocks").map((p) => p[1]))].filter((s) => !picked.includes(s)), [closure, picked]);

  function download() {
    if (!sources || !picked.length) return;
    const files = buildKitFiles(picked, metas, sources, theme, sources["styles/base.css"]);
    const bytes = kitZip(files);
    const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: "application/zip" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "lythos-blocks.zip";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className={styles.lab}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>{t.eyebrow}</p>
        <h1>{t.kitPageTitle}</h1>
        <p>{t.kitIntro}</p>
      </header>
      <section className={styles.section} aria-labelledby="kit-brand">
        <h2 id="kit-brand">{t.themeTitle}</h2>
        <ThemeBar theme={theme} onChange={setTheme} t={t} locale={locale} base={base} />
        <p className={styles.small}>{t.kitBrandNote}</p>
      </section>
      <section className={styles.section} aria-labelledby="kit-pick">
        <div className={styles.sectionHead}>
          <h2 id="kit-pick">{t.kitPick}</h2>
          <div className={styles.toolbar}>
            <button type="button" className={styles.ghost} onClick={() => setPicked(metas.map((m) => m.slug))}>
              {t.kitAll}
            </button>
            <button type="button" className={styles.ghost} onClick={() => setPicked([])}>
              {t.kitNone}
            </button>
          </div>
        </div>
        <ul className={styles.kitList}>
          {catalog.map(({ meta }) => (
            <li key={meta.slug}>
              <label className={styles.check}>
                <input type="checkbox" checked={picked.includes(meta.slug)} onChange={(e) => setPicked(e.target.checked ? [...picked, meta.slug] : picked.filter((s) => s !== meta.slug))} />
                <span>{meta.title[locale]}</span>
              </label>
            </li>
          ))}
        </ul>
        {extra.length ? <p className={styles.small}>{t.kitNeeded(extra.join(", "))}</p> : null}
      </section>
      <section className={styles.section} aria-labelledby="kit-files">
        <div className={styles.sectionHead}>
          <h2 id="kit-files">{t.kitContents}</h2>
          <button type="button" className={styles.primary} onClick={download} disabled={!picked.length || !sources} data-lb-kit-download="">
            {t.kitDownload}
          </button>
        </div>
        {picked.length ? (
          <>
            <p className={styles.small} role="status">
              {t.kitFiles(closure.length + 5)}
            </p>
            <ul className={styles.tree} data-lb-kit-files="">
              {[...closure.map((f) => f.path), "base.css", "tokens.css", "styles.css", "index.ts", "README.md"].map((p) => (
                <li key={p}>
                  <code>{p}</code>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className={styles.lead}>{t.kitEmpty}</p>
        )}
      </section>
    </div>
  );
}
