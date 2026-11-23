"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { BlockEntry } from "../catalog-types";
import evidence from "../generated/evidence.json";
import sizes from "../generated/sizes.json";
import type { LabCopy, LabLocale } from "./copy";
import styles from "./lab.module.css";

type Evidence = { behaviours: number; native: number; realKeyboardPassed: number; inPagePassed: number; axeStates: number; axeViolations: number; verifiedAt: string | null };

/** Only measured facts, taken from files the tests wrote. Anything that has not been measured says so. */
export function EvidencePanel({ entry, t, locale }: { entry: BlockEntry; t: LabCopy; locale: LabLocale }) {
  const e = (evidence as { blocks: Record<string, Evidence> }).blocks[entry.meta.slug];
  const size = (sizes as Record<string, { gzip: number }>)[entry.meta.slug];
  const uses = [...entry.meta.needs.map((n) => n), ...entry.meta.core.map((c) => `core/${c}`)];
  const inPageTotal = e ? e.behaviours - e.native : 0;
  return (
    <section className={styles.section} aria-labelledby={`evidence-${entry.meta.slug}`}>
      <h2 id={`evidence-${entry.meta.slug}`}>{t.evidenceTitle}</h2>
      {e && size ? (
        <dl className={styles.facts}>
          <dt>{t.evSizeLabel}</dt>
          <dd>{t.evSize(size.gzip)}</dd>
          <dt>{t.evDeps}</dt>
          <dd>{t.evDepsNone}{uses.length ? ` + ${uses.join(", ")} (${locale === "nl" ? "meegeleverd" : "included"})` : ""}</dd>
          <dt>{t.evContract}</dt>
          <dd>{t.evContractValue(e.behaviours, e.native)}</dd>
          <dt>{t.evKeyboard}</dt>
          <dd>{t.evKeyboardValue(e.realKeyboardPassed, e.behaviours)}</dd>
          <dt>{t.evInPage}</dt>
          <dd>{t.evInPageValue(e.inPagePassed, inPageTotal)}</dd>
          <dt>{t.evAxe}</dt>
          <dd>{t.evAxeValue(e.axeViolations, e.axeStates)}</dd>
          <dt>{t.evVerified}</dt>
          <dd>{e.verifiedAt ? new Date(e.verifiedAt).toLocaleDateString(locale === "nl" ? "nl-NL" : "en-GB") : "-"}</dd>
          <dt>{t.evSr}</dt>
          <dd>{t.evSrValue}</dd>
        </dl>
      ) : (
        <p className={styles.lead}>{t.evNone}</p>
      )}
      <p className={styles.small}>{t.evNote}</p>
    </section>
  );
}
