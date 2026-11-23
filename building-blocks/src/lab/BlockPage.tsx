"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useRef, useState } from "react";
import type { BlockEntry } from "../catalog-types";
import { CodeView } from "./CodeView";
import { labCopy, type LabLocale } from "./copy";
import { EvidencePanel } from "./EvidencePanel";
import { AnnouncePanel, FocusOverlay, TreePanel, useAnnouncements, useLensData } from "./Lens";
import styles from "./lab.module.css";
import { blocksPaths } from "./paths";
import { Playground } from "./Playground";
import { Stage } from "./Stage";
import { NO_STRESS, type Stress } from "./stress";
import { StressPanel } from "./StressPanel";
import { ThemeBar } from "./ThemeBar";
import { useThemeHash } from "./use-theme";
import { Verify } from "./Verify";

export function BlockPage({ entry, locale, base = "" }: { entry: BlockEntry; locale: LabLocale; base?: string }) {
  const t = labCopy[locale];
  const { meta, contract } = entry;
  const [theme, setTheme] = useThemeHash();
  const [stress, setStress] = useState<Stress>(NO_STRESS);
  const [focusOrder, setFocusOrder] = useState(false);
  const [tree, setTree] = useState(false);
  const [announce, setAnnounce] = useState(false);
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const lens = useLensData(stage, wrap, focusOrder || tree);
  const log = useAnnouncements(announce);

  return (
    <div className={styles.lab}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>
          <a href={`${base}${blocksPaths.overview[locale]}`} className={styles.backLink}>
            {t.back}
          </a>{" "}
          / {t.tiers[meta.tier]}
        </p>
        <h1>{meta.title[locale]}</h1>
        <p>{meta.summary[locale]}</p>
        <p className={styles.small}>
          {t.pattern}: {contract.pattern}
        </p>
      </header>

      <details className={styles.themeDetails}>
        <summary>{t.themeTitle}</summary>
        <ThemeBar theme={theme} onChange={setTheme} t={t} locale={locale} base={base} />
      </details>

      <Playground entry={entry} theme={theme} t={t} locale={locale} />

      <section className={styles.section} aria-labelledby="stage-title">
        <h2 id="stage-title">{t.stageTitle}</h2>
        <div className={styles.toolbar} role="group" aria-label={t.lensTitle}>
          <label className={styles.check}>
            <input type="checkbox" checked={focusOrder} onChange={(e) => setFocusOrder(e.target.checked)} data-lb-toggle="focus-order" />
            <span>{t.lensFocus}</span>
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={tree} onChange={(e) => setTree(e.target.checked)} data-lb-toggle="tree" />
            <span>{t.lensTreeToggle}</span>
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={announce} onChange={(e) => setAnnounce(e.target.checked)} data-lb-toggle="announcements" />
            <span>{t.lensAnnounceToggle}</span>
          </label>
        </div>
        <div className={`${styles.stageWrap} ${styles.stageOuter}`} ref={wrap}>
          <Stage slug={meta.slug} theme={theme} stress={stress} onElement={setStage} />
          {focusOrder ? <FocusOverlay stops={lens.stops} /> : null}
        </div>
        <details className={styles.themeDetails}>
          <summary>{t.stressTitle}</summary>
          <StressPanel stress={stress} onChange={setStress} t={t} />
        </details>
        {tree || announce ? (
          <div className={styles.lensGrid}>
            {tree ? <TreePanel rows={lens.rows} t={t} /> : null}
            {announce ? <AnnouncePanel log={log} t={t} /> : null}
          </div>
        ) : null}
      </section>

      <Verify entry={entry} theme={theme} t={t} />
      <CodeView entry={entry} t={t} locale={locale} base={base} />
      <EvidencePanel entry={entry} t={t} locale={locale} />

      <section className={styles.section} aria-labelledby="native-title">
        <h2 id="native-title">{t.nativeTitle}</h2>
        <p className={styles.lead}>{meta.native[locale]}</p>
        <h2 className={styles.h2small}>{t.limitsTitle}</h2>
        <p className={styles.lead}>{meta.limits[locale]}</p>
      </section>
    </div>
  );
}
