"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { composeLabCopy, type Locale } from "./copy";
import { encodeDisabled } from "./config";
import { RULES, type Group, type RuleId } from "./rules";
import { CopyButton } from "./ui";
import styles from "./compose-lab.module.css";

const GROUPS: Group[] = ["security", "reliability", "structure"];

export function RulesSection({ locale, disabled, onChange }: { locale: Locale; disabled: RuleId[]; onChange: (next: RuleId[]) => void }) {
  const t = composeLabCopy[locale];
  const link = () => {
    const fragment = encodeDisabled(disabled);
    return `${window.location.href.split("#")[0]}${fragment ? `#${fragment}` : ""}`;
  };
  return (
    <section className={styles.block} aria-labelledby="cl-rules">
      <div className={styles.blockHead}>
        <h2 id="cl-rules">{t.rulesTitle}</h2>
        <p className={styles.small} role="status">
          {t.rulesOff(disabled.length)}
        </p>
      </div>
      <p className={styles.small}>{t.rulesIntro}</p>
      <details open={disabled.length > 0}>
        <summary>{t.rulesTitle}</summary>
        {GROUPS.map((group) => (
          <fieldset key={group} className={styles.ruleGroup}>
            <legend>{t.groups[group]}</legend>
            {(Object.keys(RULES) as RuleId[])
              .filter((id) => RULES[id] === group)
              .map((id) => (
                <label key={id} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={!disabled.includes(id)}
                    onChange={(e) => onChange(e.target.checked ? disabled.filter((x) => x !== id) : [...disabled, id])}
                  />
                  <span>{t.rules[id].title}</span>
                </label>
              ))}
          </fieldset>
        ))}
      </details>
      <div className={styles.actions}>
        <button type="button" className={styles.ghost} onClick={() => onChange([])} disabled={disabled.length === 0}>
          {t.rulesAllOn}
        </button>
        <CopyButton value={link()} label={t.shareRules} done={t.copied} />
      </div>
    </section>
  );
}
