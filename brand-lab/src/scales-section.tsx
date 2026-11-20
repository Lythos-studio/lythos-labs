"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { brandLabCopy, type Locale } from "./copy";
import { SPACE_STEPS, TEXT_STEPS, WEIGHTS, spacing, typeScale } from "./scales";
import type { TypeStyle } from "./tokens";
import styles from "./brand-lab.module.css";

export function ScalesSection({ style, locale }: { style: TypeStyle; locale: Locale }) {
  const t = brandLabCopy[locale];
  const scale = typeScale(style);
  const space = spacing();
  return (
    <section className={styles.block} aria-labelledby="scales-title">
      <h2 id="scales-title">{t.scalesTitle}</h2>
      <p className={styles.lead}>{t.scalesIntro}</p>
      <div className={styles.twoUp}>
        <ul className={styles.checks}>
          {TEXT_STEPS.map((step) => (
            <li key={step} className={styles.scaleRow}>
              <code>{step}</code>
              <span style={{ fontSize: scale[step].size, lineHeight: scale[step].line, fontWeight: WEIGHTS[style].heading }}>Aa</span>
              <span className={styles.ratio}>
                {scale[step].size} / {scale[step].line}
              </span>
            </li>
          ))}
        </ul>
        <ul className={styles.checks}>
          {SPACE_STEPS.map((step) => (
            <li key={step} className={styles.scaleRow}>
              <code>{step}</code>
              <span className={styles.spaceBar} style={{ width: space[step] }} aria-hidden="true" />
              <span className={styles.ratio}>{space[step]}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
