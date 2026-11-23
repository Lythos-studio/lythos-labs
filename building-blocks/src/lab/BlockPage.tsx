"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockEntry } from "../catalog-types";
import { labCopy, type LabLocale } from "./copy";
import styles from "./lab.module.css";
import { blocksPaths } from "./paths";
import { Stage } from "./Stage";
import { useThemeHash } from "./use-theme";
import { Verify } from "./Verify";

export function BlockPage({ entry, locale, base = "" }: { entry: BlockEntry; locale: LabLocale; base?: string }) {
  const t = labCopy[locale];
  const { meta, contract } = entry;
  const [theme, setTheme] = useThemeHash();
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

      <section className={styles.section} aria-labelledby="stage-title">
        <div className={styles.sectionHead}>
          <h2 id="stage-title">{t.stageTitle}</h2>
          <fieldset className={styles.modeSwitch}>
            <legend className={styles.srOnly}>{t.theme}</legend>
            {(["light", "dark"] as const).map((mode) => (
              <label key={mode}>
                <input type="radio" name="mode" checked={theme.mode === mode} onChange={() => setTheme({ ...theme, mode })} />
                <span>{t[mode]}</span>
              </label>
            ))}
          </fieldset>
        </div>
        <div className={styles.stageWrap}>
          <Stage slug={meta.slug} theme={theme} />
        </div>
      </section>

      <Verify entry={entry} theme={theme} t={t} />

      <section className={styles.section} aria-labelledby="native-title">
        <h2 id="native-title">{t.nativeTitle}</h2>
        <p className={styles.lead}>{meta.native[locale]}</p>
        <h2 className={styles.h2small}>{t.limitsTitle}</h2>
        <p className={styles.lead}>{meta.limits[locale]}</p>
      </section>
    </div>
  );
}
