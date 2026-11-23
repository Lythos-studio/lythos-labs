"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { catalog } from "../catalog";
import evidence from "../generated/evidence.json";
import { BrandWall } from "./BrandWall";
import { labCopy, type LabLocale } from "./copy";
import styles from "./lab.module.css";
import { blockHref, kitPath, principlesPath } from "./paths";
import { ThemeBar } from "./ThemeBar";
import { useThemeHash } from "./use-theme";
import type { Tier } from "../catalog-types";

const TIERS: Tier[] = ["core", "advanced", "signature"];

export function Overview({ locale, base = "" }: { locale: LabLocale; base?: string }) {
  const t = labCopy[locale];
  const [theme, setTheme] = useThemeHash();
  const blocks = (evidence as { blocks: Record<string, { behaviours: number; realKeyboardPassed: number; axeStates: number; axeViolations: number }> }).blocks;
  const sum = (f: (b: (typeof blocks)[string]) => number) => Object.values(blocks).reduce((n, b) => n + f(b), 0);
  const href = (slug: string) => `${base}${blockHref(locale, slug)}`;
  return (
    <div className={styles.lab}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>{t.eyebrow}</p>
        <h1>{t.overviewTitle}</h1>
        <p>{t.overviewIntro}</p>
      </header>

      <section className={styles.section} aria-labelledby="brand-title">
        <h2 id="brand-title">{t.themeTitle}</h2>
        <p className={styles.lead}>{t.themeIntro}</p>
        <ThemeBar theme={theme} onChange={setTheme} t={t} locale={locale} base={base} />
      </section>

      <section className={styles.section} aria-labelledby="wall-title">
        <h2 id="wall-title">{t.wallTitle}</h2>
        <p className={styles.lead}>{t.wallIntro}</p>
        <div className={styles.wall}>
          <BrandWall theme={theme} />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="stats-title">
        <h2 id="stats-title">{t.statsTitle}</h2>
        <p className={styles.lead}>{t.stats(catalog.length, sum((b) => b.behaviours), sum((b) => b.realKeyboardPassed), sum((b) => b.axeStates) - sum((b) => b.axeViolations))}</p>
        <p className={styles.small}>{t.statsNote}</p>
      </section>

      {TIERS.map((tier) => {
        const entries = catalog.filter((e) => e.meta.tier === tier);
        if (!entries.length) return null;
        return (
          <section key={tier} className={styles.section} aria-labelledby={`tier-${tier}`}>
            <h2 id={`tier-${tier}`}>{t.tiers[tier]}</h2>
            <ul className={styles.grid}>
              {entries.map(({ meta }) => (
                <li key={meta.slug}>
                  <a className={styles.card} href={href(meta.slug)}>
                    <h3>{meta.title[locale]}</h3>
                    <p>{meta.summary[locale]}</p>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section className={styles.section} aria-labelledby="more-title">
        <h2 id="more-title">{t.kitTitle}</h2>
        <p className={styles.lead}>{t.kitIntro}</p>
        <div className={styles.toolbar}>
          <a className={styles.primary} href={`${base}${kitPath[locale]}`}>
            {t.kitOpen}
          </a>
          <a className={styles.ghost} href={`${base}${principlesPath[locale]}`}>
            {t.principlesOpen}
          </a>
        </div>
      </section>
    </div>
  );
}
