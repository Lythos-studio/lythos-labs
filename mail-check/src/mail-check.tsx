"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useEffect, useRef, useState, type FormEvent } from "react";
import { runChecks, type Check, type CheckId } from "./checks";
import { mailCheckCopy, type Locale } from "./copy";
import { makeLookup } from "./dns";
import { parseDomain } from "./domain";
import { fixFor } from "./fixes";
import { DKIM_SELECTORS } from "./records";
import styles from "./mail-check.module.css";

const ORDER: CheckId[] = ["mx", "spf", "dmarc", "dkim", "mta-sts", "tls-rpt", "bimi"];
const SELECTOR = /^[a-z0-9_-]{1,63}$/i;

function CopyButton({ value, label, done }: { value: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={styles.ghost}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard blocked: the text stays selectable on the page.
        }
      }}
    >
      {copied ? done : label}
    </button>
  );
}

export function MailCheck({ locale }: { locale: Locale }) {
  const t = mailCheckCopy[locale];
  const [input, setInput] = useState("");
  const [selector, setSelector] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [domain, setDomain] = useState("");
  const [checks, setChecks] = useState<Check[]>([]);
  const run = useRef(0);

  function start(text: string, custom: string) {
    const name = parseDomain(text);
    if (!name) return setError(t.invalid);
    if (custom && !SELECTOR.test(custom)) return setError(t.invalidSelector);
    setError("");
    setInput(name);
    setDomain(name);
    setChecks([]);
    setRunning(true);
    try {
      history.replaceState(null, "", `#${name}`);
    } catch {
      // The address bar is only a convenience.
    }
    const id = ++run.current;
    runChecks(name, makeLookup(), {
      selectors: custom ? [custom.toLowerCase(), ...DKIM_SELECTORS] : DKIM_SELECTORS,
      onCheck: (check) => id === run.current && setChecks((all) => [...all, check]),
    }).finally(() => id === run.current && setRunning(false));
  }

  useEffect(() => {
    // A shared link carries the domain after the #.
    const fromLink = decodeURIComponent(location.hash.slice(1));
    if (fromLink && parseDomain(fromLink)) start(fromLink, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    start(input, selector.trim());
  }

  const done = checks.length === ORDER.length && !running;
  const count = (level: string) => checks.filter((c) => c.finding.level === level).length;
  const next = ORDER[checks.length];

  return (
    <div className={styles.lab}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>{t.eyebrow}</p>
        <h1>{t.heading}</h1>
        <p>{t.intro}</p>
      </header>

      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.field}>
          <label htmlFor="mc-domain">{t.label}</label>
          <input
            id="mc-domain"
            className={styles.text}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.placeholder}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="url"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "mc-error" : undefined}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="mc-selector">{t.selectorLabel}</label>
          <input
            id="mc-selector"
            className={styles.text}
            value={selector}
            onChange={(e) => setSelector(e.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-describedby="mc-selector-hint"
          />
          <p id="mc-selector-hint" className={styles.small}>
            {t.selectorHint}
          </p>
        </div>
        <button type="submit" className={styles.primary} disabled={running}>
          {running ? t.running : t.submit}
        </button>
        <p id="mc-error" className={styles.error} role="alert">
          {error}
        </p>
      </form>

      {domain && (
        <section className={styles.report} aria-labelledby="mc-report">
          <h2 id="mc-report">{domain}</h2>
          <p className={styles.small} role="status" aria-live="polite">
            {running ? t.progress(checks.length, ORDER.length) : ""}
          </p>
          <ol className={styles.cards}>
            {ORDER.map((id) => {
              const check = checks.find((c) => c.id === id);
              if (!check)
                return (
                  <li key={id} className={`${styles.card} ${styles.pending}`}>
                    <h3>{t.names[id]}</h3>
                    <p className={styles.small}>{running ? (id === next ? t.checking : t.waiting) : ""}</p>
                  </li>
                );
              const { level, code, detail } = check.finding;
              const fix = fixFor(code, domain);
              return (
                <li key={id} className={`${styles.card} ${styles[level]}`}>
                  <div className={styles.cardHead}>
                    <h3>{t.names[id]}</h3>
                    <span className={styles.badge}>{t.levels[level]}</span>
                  </div>
                  <p>{t.messages[code]?.(detail) ?? ""}</p>
                  {fix && (
                    <div className={styles.fix}>
                      <p className={styles.small}>{t.notes[code]}</p>
                      <p className={styles.small}>
                        {t.recordHost}: <code>{fix.host}</code> ({t.recordType})
                      </p>
                      <div className={styles.record}>
                        <code>{fix.value}</code>
                        <CopyButton value={fix.value} label={t.copyRecord} done={t.copied} />
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          {done && (
            <div className={styles.summary}>
              <h3>{t.summaryTitle}</h3>
              <p>{t.summary(count("fail"), count("warn"), count("unknown"))}</p>
              <CopyButton value={typeof location === "undefined" ? "" : location.href} label={t.copyLink} done={t.copied} />
            </div>
          )}
        </section>
      )}

      <section className={styles.notes}>
        <div>
          <h2>{t.howTitle}</h2>
          <ul>
            {t.how.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2>{t.limitsTitle}</h2>
          <ul>
            {t.limits.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
