"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { LabCopy } from "./copy";
import styles from "./lab.module.css";
import { NO_STRESS, type Stress } from "./stress";

function Select<K extends keyof Stress>({ label, name, value, options, onChange }: { label: string; name: K; value: Stress[K]; options: [Stress[K], string][]; onChange: (v: Stress[K]) => void }) {
  return (
    <label className={styles.stressField}>
      <span>{label}</span>
      <select value={String(value)} onChange={(e) => onChange((options.find(([v]) => String(v) === e.target.value) as [Stress[K], string])[0])} data-lb-stress={name}>
        {options.map(([v, text]) => (
          <option key={String(v)} value={String(v)}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

export function StressPanel({ stress, onChange, t }: { stress: Stress; onChange: (next: Stress) => void; t: LabCopy }) {
  const set = <K extends keyof Stress>(k: K) => (v: Stress[K]) => onChange({ ...stress, [k]: v });
  return (
    <div className={styles.lensPanel} data-lb-lens="stress">
      <h3>{t.stressTitle}</h3>
      <p className={styles.small}>{t.stressIntro}</p>
      <div className={styles.stressGrid}>
        <Select label={t.stressText} name="textScale" value={stress.textScale} onChange={set("textScale")} options={[[1, "100%"], [1.5, "150%"], [2, "200%"]]} />
        <Select label={t.stressLength} name="length" value={stress.length} onChange={set("length")} options={[["normal", t.stressNormal], ["plus40", "+40%"], ["long", t.stressLong]]} />
        <Select label={t.stressDir} name="dir" value={stress.dir} onChange={set("dir")} options={[["ltr", "LTR"], ["rtl", "RTL"]]} />
        <Select label={t.stressMotion} name="motion" value={stress.motion} onChange={set("motion")} options={[["on", t.stressMotionOn], ["off", t.stressMotionOff]]} />
        <Select label={t.stressWidth} name="width" value={stress.width} onChange={set("width")} options={[["full", t.stressFull], ["768", "768 px"], ["480", "480 px"], ["320", "320 px"]]} />
      </div>
      <button type="button" className={styles.ghost} onClick={() => onChange(NO_STRESS)}>
        {t.stressReset}
      </button>
      <p className={styles.small}>{t.stressLimit}</p>
    </div>
  );
}
