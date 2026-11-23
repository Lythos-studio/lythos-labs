"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { catalog } from "../catalog";
import { labCopy, type LabLocale } from "./copy";
import styles from "./lab.module.css";
import { blockHref } from "./paths";

export function Overview({ locale, base = "" }: { locale: LabLocale; base?: string }) {
  const t = labCopy[locale];
  return (
    <div className={styles.lab}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>{t.eyebrow}</p>
        <h1>{t.overviewTitle}</h1>
        <p>{t.overviewIntro}</p>
      </header>
      <section className={styles.section} aria-labelledby="all-blocks">
        <h2 id="all-blocks">{t.blocksTitle}</h2>
        <ul className={styles.grid}>
          {catalog.map(({ meta }) => (
            <li key={meta.slug}>
              <a className={styles.card} href={`${base}${blockHref(locale, meta.slug)}`}>
                <span className={styles.tier}>{t.tiers[meta.tier]}</span>
                <h3>{meta.title[locale]}</h3>
                <p>{meta.summary[locale]}</p>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
