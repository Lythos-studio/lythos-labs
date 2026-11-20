"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useEffect, useRef, useState, type FormEvent } from "react";
import { runChecks, type Check, type CheckId } from "./checks";
import { diffChecks, forgetRuns, loadRuns, saveRun, toStored, type Change, type StorageLike } from "./compare";
import { mailCheckCopy, type Locale } from "./copy";
import { makeLookup } from "./dns";
import { parseDomains } from "./domain";
import { dkimHosts, fixesFor } from "./fixes";
import { detectProvider, PROVIDERS } from "./provider";
import { DKIM_SELECTORS } from "./records";
import { reportMarkdown } from "./report";
import { dmarcRollout } from "./rollout";
import styles from "./mail-check.module.css";

const ORDER: CheckId[] = ["mx", "spf", "dmarc", "dkim", "mta-sts", "tls-rpt", "bimi"];
const SELECTOR = /^[a-z0-9_-]{1,63}$/i;
const REMEMBER_KEY = "lythos-mail-check-remember";
const PAUSE_MS = 300;

type Run = { domain: string; checks: Check[]; running: boolean; compare?: { at: string; changes: Change[] } | null };

/** Browser storage can be missing or blocked (private mode); everything works without it. */
function store(): StorageLike | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

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

function Report({ run, locale }: { run: Run; locale: Locale }) {
  const t = mailCheckCopy[locale];
  const { domain, checks, running } = run;
  const mx = checks.find((c) => c.id === "mx");
  const hosts = mx?.data?.mx ?? [];
  const providerId = detectProvider(hosts.map((h) => `10 ${h}`));
  const provider = providerId ? PROVIDERS[providerId] : null;
  const ctx = { provider: providerId, nullMx: mx?.finding.code === "mx-null", mx: hosts };
  const done = checks.length === ORDER.length && !running;
  const count = (level: string) => checks.filter((c) => c.finding.level === level).length;
  const next = ORDER[checks.length];
  const nf = locale === "nl" ? "nl-NL" : "en-GB";

  const markdown = () =>
    reportMarkdown({
      heading: t.reportHeading,
      domain,
      date: new Date().toISOString().slice(0, 10),
      provider: provider?.name,
      summary: t.summary(count("fail"), count("warn"), count("unknown")),
      labels: { date: t.reportDate, provider: t.reportProvider, host: t.recordHost, file: t.fileLabel },
      rows: ORDER.flatMap((id) => {
        const c = checks.find((x) => x.id === id);
        if (!c) return [];
        return [{ name: t.names[id], level: t.levels[c.finding.level], message: t.messages[c.finding.code]?.(c.finding.detail) ?? "", fixes: fixesFor(c.finding.code, domain, ctx) }];
      }),
      footer: t.reportFooter,
    });

  return (
    <section className={styles.report} aria-labelledby={`mc-report-${domain}`}>
      <h2 id={`mc-report-${domain}`}>{domain}</h2>
      <p className={styles.small} role="status" aria-live="polite">
        {running ? t.progress(checks.length, ORDER.length) : ""}
      </p>
      {mx && hosts.length > 0 ? (
        <p className={styles.small}>{provider ? t.providerDetected(provider.name) : t.providerUnknown}</p>
      ) : null}
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
          const fixes = fixesFor(code, domain, ctx);
          const dkim = code === "dkim-none-found" && provider ? dkimHosts(domain, providerId) : [];
          const rollout = id === "dmarc" ? dmarcRollout(domain, code, detail) : null;
          return (
            <li key={id} className={`${styles.card} ${styles[level]}`}>
              <div className={styles.cardHead}>
                <h3>{t.names[id]}</h3>
                <span className={styles.badge}>{t.levels[level]}</span>
              </div>
              <p>{t.messages[code]?.(detail) ?? ""}</p>
              {fixes.length > 0 && (
                <div className={styles.fix}>
                  <p className={styles.small}>{t.notes[code]}</p>
                  {fixes.map((fix) => (
                    <div key={`${fix.kind}-${fix.host}`} className={styles.fixItem}>
                      <p className={styles.small}>
                        {fix.kind === "file" ? t.fileLabel : t.recordHost}: <code>{fix.host}</code>
                        {fix.kind === "file" ? "" : ` (${t.recordType})`}
                      </p>
                      <div className={styles.record}>
                        {fix.kind === "file" ? <pre>{fix.value}</pre> : <code>{fix.value}</code>}
                        <CopyButton value={fix.value} label={t.copyRecord} done={t.copied} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {dkim.length > 0 && provider && (
                <div className={styles.fix}>
                  <p className={styles.small}>{t.dkimEnable(provider.name)}</p>
                  <ul className={styles.hostList}>
                    {dkim.map((h) => (
                      <li key={h}>
                        <code>{h}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {rollout && (
                <div className={styles.fix}>
                  <h4 className={styles.rolloutTitle}>{t.rolloutTitle}</h4>
                  {rollout.current === null ? (
                    <p className={styles.small}>{t.rolloutFirst}</p>
                  ) : (
                    <>
                      <p className={styles.small}>{t.rolloutIntro}</p>
                      <ol className={styles.rollout}>
                        {rollout.steps.map((step, i) => (
                          <li key={step.record} className={rollout.current === i + 1 ? styles.current : undefined} aria-current={rollout.current === i + 1 ? "step" : undefined}>
                            <span>
                              {t.rolloutSteps[i]}
                              {rollout.current === i + 1 ? <strong> ({t.youAreHere})</strong> : null}
                            </span>
                            <div className={styles.record}>
                              <code>{step.record}</code>
                              <CopyButton value={step.record} label={t.copyRecord} done={t.copied} />
                            </div>
                          </li>
                        ))}
                      </ol>
                    </>
                  )}
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
          {run.compare ? (
            <div>
              <h4 className={styles.rolloutTitle}>{t.compareTitle(new Date(run.compare.at).toLocaleDateString(nf))}</h4>
              {run.compare.changes.length === 0 ? (
                <p className={styles.small}>{t.compareNone}</p>
              ) : (
                <ul className={styles.hostList}>
                  {run.compare.changes.map((c) => (
                    <li key={c.id}>
                      {t.names[c.id as CheckId]}: {t.compareDirection[c.direction]}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
          <div className={`${styles.actions} ${styles.noPrint}`}>
            <CopyButton value={typeof location === "undefined" ? "" : location.href} label={t.copyLink} done={t.copied} />
            <CopyButton value={markdown()} label={t.copyReport} done={t.copied} />
            <button type="button" className={styles.ghost} onClick={() => window.print()}>
              {t.print}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export function MailCheck({ locale }: { locale: Locale }) {
  const t = mailCheckCopy[locale];
  const [input, setInput] = useState("");
  const [selector, setSelector] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState<Run[]>([]);
  const [remember, setRemember] = useState(false);
  const [forgotten, setForgotten] = useState(false);
  const current = useRef(0);
  const rememberRef = useRef(false);

  useEffect(() => {
    try {
      const on = store()?.getItem(REMEMBER_KEY) === "1";
      setRemember(on);
      rememberRef.current = on;
    } catch {
      // Without storage the choice is simply off.
    }
  }, []);

  function toggleRemember(on: boolean) {
    setRemember(on);
    rememberRef.current = on;
    setForgotten(false);
    try {
      if (on) store()?.setItem(REMEMBER_KEY, "1");
      else store()?.removeItem(REMEMBER_KEY);
    } catch {
      // The choice only lasts for this visit then.
    }
  }

  function forget() {
    forgetRuns(store());
    setForgotten(true);
  }

  async function start(text: string, custom: string) {
    const parsed = parseDomains(text);
    if (!parsed.domains.length) return setError(t.invalid);
    if (custom && !SELECTOR.test(custom)) return setError(t.invalidSelector);
    setError("");
    setNote([parsed.tooMany ? t.tooMany : "", parsed.invalid.length ? t.invalidSome(parsed.invalid.slice(0, 5).join(", ")) : ""].filter(Boolean).join(" "));
    setInput(parsed.domains.join(", "));
    setRuns(parsed.domains.map((domain) => ({ domain, checks: [], running: true })));
    setRunning(true);
    try {
      history.replaceState(null, "", `#${parsed.domains.join(",")}`);
    } catch {
      // The address bar is only a convenience.
    }
    const id = ++current.current;
    const selectors = custom ? [custom.toLowerCase(), ...DKIM_SELECTORS] : DKIM_SELECTORS;
    const update = (domain: string, patch: (r: Run) => Run) => id === current.current && setRuns((all) => all.map((r) => (r.domain === domain ? patch(r) : r)));
    for (const [i, domain] of parsed.domains.entries()) {
      if (id !== current.current) return;
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
      const checks = await runChecks(domain, makeLookup(), {
        selectors,
        onCheck: (check) => update(domain, (r) => ({ ...r, checks: [...r.checks, check] })),
      });
      let compare: Run["compare"] = null;
      if (rememberRef.current) {
        const storage = store();
        const previous = loadRuns(storage)[domain];
        compare = previous ? { at: previous.at, changes: diffChecks(previous, checks) } : null;
        saveRun(domain, toStored(checks, new Date()), storage);
      }
      update(domain, (r) => ({ ...r, running: false, compare }));
    }
    if (id === current.current) setRunning(false);
  }

  useEffect(() => {
    // A shared link carries the domain, or several separated by commas, after the #.
    let fromLink = "";
    try {
      fromLink = decodeURIComponent(location.hash.slice(1));
    } catch {
      // A broken escape in the address is ignored.
    }
    if (fromLink && parseDomains(fromLink).domains.length) void start(fromLink, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    void start(input, selector.trim());
  }

  return (
    <div className={styles.lab}>
      <header className={`${styles.intro} ${styles.noPrint}`}>
        <p className={styles.eyebrow}>{t.eyebrow}</p>
        <h1>{t.heading}</h1>
        <p>{t.intro}</p>
      </header>

      <form className={`${styles.form} ${styles.noPrint}`} onSubmit={submit} noValidate>
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
        <div className={styles.field}>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={remember} onChange={(e) => toggleRemember(e.target.checked)} />
            <span>{t.rememberLabel}</span>
          </label>
          <p className={styles.small}>{t.rememberHint}</p>
          {remember ? (
            <button type="button" className={styles.ghost} onClick={forget}>
              {forgotten ? t.forgotten : t.forget}
            </button>
          ) : null}
        </div>
        <button type="submit" className={styles.primary} disabled={running}>
          {running ? t.running : t.submit}
        </button>
        <p id="mc-error" className={styles.error} role="alert">
          {error}
        </p>
        {note ? (
          <p className={styles.small} role="status">
            {note}
          </p>
        ) : null}
      </form>

      {runs.map((run) => (
        <Report key={run.domain} run={run} locale={locale} />
      ))}

      <section className={`${styles.notes} ${styles.noPrint}`}>
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
