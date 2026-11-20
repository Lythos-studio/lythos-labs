"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { brandLabCopy, type Locale } from "./copy";
import { harmonyNote, suggestAccent, type HarmonyKind } from "./harmony";
import { parseHex } from "./tokens";
import { useEffect, useState } from "react";
import styles from "./brand-lab.module.css";

const KINDS: HarmonyKind[] = ["analogous", "complementary", "triad"];

export function AccentField({ value, brand, locale, onChange }: { value?: string; brand: string; locale: Locale; onChange: (hex?: string) => void }) {
  const t = brandLabCopy[locale];
  const [text, setText] = useState(value ?? "");
  // A shared link restores the accent after the first render.
  useEffect(() => {
    if (value && parseHex(text) !== value) setText(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const set = (hex?: string) => {
    setText(hex ?? "");
    onChange(hex);
  };
  const typed = (v: string) => {
    setText(v);
    const hex = parseHex(v);
    if (hex) onChange(hex);
  };
  const invalid = text !== "" && !parseHex(text);
  return (
    <fieldset className={styles.accentField}>
      <legend>{t.accentTitle}</legend>
      <div className={styles.colorRow}>
        <input type="color" aria-label={t.accentColor} className={styles.swatchInput} value={value ?? brand} onChange={(e) => set(e.target.value)} />
        <input
          aria-label={t.accentHex}
          className={styles.text}
          value={text}
          placeholder={t.accentOff}
          onChange={(e) => typed(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={invalid ? true : undefined}
        />
      </div>
      {invalid ? <p className={styles.error}>{t.hexInvalid}</p> : null}
      <div className={styles.accentSuggest} role="group" aria-label={t.accentSuggestLegend}>
        {KINDS.map((kind) => (
          <button key={kind} type="button" className={styles.ghost} onClick={() => set(suggestAccent(brand, kind))}>
            {t.accentSuggest[kind]}
          </button>
        ))}
        <button type="button" className={styles.ghost} onClick={() => set(undefined)} disabled={!value}>
          {t.accentOff}
        </button>
      </div>
      {value && harmonyNote(brand, value) === "too-close" ? (
        <p role="status" className={styles.small}>
          {t.harmonyTooClose}
        </p>
      ) : null}
    </fieldset>
  );
}
