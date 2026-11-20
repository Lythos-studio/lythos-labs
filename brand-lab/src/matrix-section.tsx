"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useState } from "react";
import { apca, apcaLevel } from "./apca";
import { brandLabCopy, type Locale } from "./copy";
import { MATRIX_BACKGROUNDS, MATRIX_FOREGROUNDS, matrix, type WcagClass } from "./matrix";
import type { Roles } from "./tokens";
import styles from "./brand-lab.module.css";

/** Written marks next to the class label, so the result never relies on colour alone. */
const MARK: Record<WcagClass, string> = { aaa: "++", aa: "+", "aa-large": "~", fail: "!" };

export function MatrixSection({ roles, tint, locale }: { roles: Roles; tint: string; locale: Locale }) {
  const t = brandLabCopy[locale];
  const [showApca, setShowApca] = useState(false);
  const rows = matrix(roles, tint);
  const nf = new Intl.NumberFormat(locale === "nl" ? "nl-NL" : "en-GB", { maximumFractionDigits: 1 });
  return (
    <section className={styles.block} aria-labelledby="matrix-title">
      <h2 id="matrix-title">{t.matrixTitle}</h2>
      <p className={styles.lead}>{t.matrixIntro}</p>
      <label className={styles.checkRow}>
        <input type="checkbox" checked={showApca} onChange={(e) => setShowApca(e.target.checked)} />
        <span>{t.apcaToggle}</span>
      </label>
      {showApca ? <p className={styles.small}>{t.apcaNote}</p> : null}
      <div className={styles.tableWrap} role="region" aria-label={t.matrixTitle} tabIndex={0}>
        <table className={styles.matrix}>
          <caption className={styles.visuallyHidden}>{t.matrixTitle}</caption>
          <thead>
            <tr>
              <th scope="col">{t.matrixFg}</th>
              {MATRIX_BACKGROUNDS.map((bg) => (
                <th key={bg} scope="col">
                  {t.matrixBg}: {t.roleNames[bg]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={MATRIX_FOREGROUNDS[i]}>
                <th scope="row">{t.roleNames[MATRIX_FOREGROUNDS[i]]}</th>
                {row.map((cell, j) => (
                  <td key={MATRIX_BACKGROUNDS[j]}>
                    <span className={styles.cellSample} style={{ background: cell.bg, color: cell.fg, borderColor: cell.fg }} aria-hidden="true">
                      Aa
                    </span>
                    <span className={styles.ratio}>{nf.format(cell.ratio)}:1</span>
                    <span className={cell.wcag === "fail" ? styles.fail : styles.ok}>
                      {MARK[cell.wcag]} {t.wcagClasses[cell.wcag]}
                    </span>
                    {showApca ? (
                      <span className={styles.small}>
                        Lc {nf.format(Math.abs(apca(cell.fg, cell.bg)))}, {t.apcaLevels[apcaLevel(apca(cell.fg, cell.bg))]}
                      </span>
                    ) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
