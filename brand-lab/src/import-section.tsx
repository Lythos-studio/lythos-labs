"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useMemo, useState } from "react";
import { brandLabCopy, type Locale } from "./copy";
import { IMPORT_LIMIT, ROLE_KEYS, detectMode, mapRoleNames, parseImport, type ImportResult, type RoleKey } from "./import";
import { auditRoles } from "./repair";
import styles from "./brand-lab.module.css";

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

function save(name: string, type: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportSection({ locale, onUseBrand }: { locale: Locale; onUseBrand: (hex: string) => void }) {
  const t = brandLabCopy[locale];
  const [text, setText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [assign, setAssign] = useState<Partial<Record<RoleKey, string>>>({});
  const [status, setStatus] = useState("");

  const colors = result?.ok ? result.colors : {};
  const map = useMemo(() => {
    const out: Partial<Record<RoleKey, string>> = {};
    for (const role of ROLE_KEYS) {
      const name = assign[role];
      if (name && colors[name]) out[role] = colors[name];
    }
    return out;
  }, [assign, colors]);
  const rows = useMemo(() => auditRoles(map), [map]);

  const run = (input: string) => {
    const r = parseImport(input);
    setResult(r);
    setStatus("");
    if (r.ok) {
      const names = mapRoleNames(r.colors);
      setAssign(names);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > IMPORT_LIMIT * 4) return setResult({ ok: false, error: "too-large" });
    const content = await file.text();
    setText(content.slice(0, IMPORT_LIMIT + 1));
    run(content);
  };

  const corrected = useMemo(() => {
    const out: Partial<Record<RoleKey, string>> = { ...map };
    for (const row of rows) if (row.fix) out[row.label.split("/")[0] as RoleKey] = row.fix.hex;
    return out;
  }, [map, rows]);
  const css = () => `:root {\n${Object.entries(corrected).map(([k, v]) => `  --color-${kebab(k)}: ${v};`).join("\n")}\n}\n`;
  const json = () =>
    JSON.stringify({ color: Object.fromEntries(Object.entries(corrected).map(([k, v]) => [kebab(k), { $type: "color", $value: v }])) }, null, 2) + "\n";
  const nf = new Intl.NumberFormat(locale === "nl" ? "nl-NL" : "en-GB", { maximumFractionDigits: 1 });

  return (
    <section className={styles.block} aria-labelledby="import-title">
      <h2 id="import-title">{t.importTitle}</h2>
      <p className={styles.lead}>{t.importIntro}</p>
      <div className={styles.field}>
        <label htmlFor="import-text">{t.importPaste}</label>
        <textarea
          id="import-text"
          className={styles.textarea}
          value={text}
          maxLength={IMPORT_LIMIT}
          rows={8}
          spellCheck={false}
          onChange={(e) => setText(e.target.value)}
          placeholder={":root {\n  --background: #ffffff;\n  --foreground: #111111;\n  --primary: #2449df;\n}"}
        />
      </div>
      <div className={styles.suggestRow}>
        <button type="button" className={styles.primaryAction} onClick={() => run(text)}>
          {t.importRun}
        </button>
        <label className={styles.ghost}>
          {t.importFile}
          <input type="file" accept=".css,.json,.txt,text/*,application/json" className={styles.visuallyHidden} onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>
      </div>
      <div role="status" aria-live="polite">
        {result && !result.ok ? <p className={styles.error}>{t.importErrors[result.error]}</p> : null}
        {result?.ok ? (
          <>
            <p className={styles.small}>{t.importModeDetected[detectMode(map)]}</p>
            {result.notes.map((n) => (
              <p key={n} className={styles.small}>
                {t.importNotes[n]}
              </p>
            ))}
            {result.skipped.length ? (
              <p className={styles.small}>
                {t.importSkipped}: {result.skipped.slice(0, 20).join(", ")}
              </p>
            ) : null}
            {status ? <p className={styles.small}>{status}</p> : null}
          </>
        ) : null}
      </div>

      {result?.ok ? (
        <>
          <fieldset className={styles.mapping}>
            <legend>{t.importMapping}</legend>
            {ROLE_KEYS.map((role) => (
              <label key={role}>
                <span>{t.roleNames[role] ?? role}</span>
                <select value={assign[role] ?? ""} onChange={(e) => setAssign((a) => ({ ...a, [role]: e.target.value || undefined }))}>
                  <option value="">{t.importMappingNone}</option>
                  {Object.keys(result.colors).map((name) => (
                    <option key={name} value={name}>
                      {name} ({result.colors[name]})
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </fieldset>

          <div className={styles.tableWrap} role="region" aria-label={t.importTitle} tabIndex={0}>
            <table className={styles.matrix}>
              <thead>
                <tr>
                  <th scope="col">{t.importTitle}</th>
                  <th scope="col">{t.importNow}</th>
                  <th scope="col">{t.importFixed}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{t.importRows[row.label] ?? row.label}</th>
                    <td>
                      <span className={styles.cellSample} style={{ background: row.bg, color: row.fg, borderColor: row.fg }} aria-hidden="true">
                        Aa
                      </span>
                      <span className={styles.ratio}>
                        {row.fg} / {nf.format(row.ratio)}:1
                      </span>
                      <span className={row.pass ? styles.ok : styles.fail}>{row.pass ? "+" : "!"}</span>
                    </td>
                    <td>
                      {row.fix ? (
                        <>
                          <span className={styles.cellSample} style={{ background: row.bg, color: row.fix.hex, borderColor: row.fix.hex }} aria-hidden="true">
                            Aa
                          </span>
                          <span className={styles.ratio}>
                            {row.fix.hex} / {nf.format(row.fix.ratio)}:1
                          </span>
                          {row.fix.reached ? null : <span className={styles.small}>{t.importNotReached}</span>}
                        </>
                      ) : (
                        <span className={styles.small}>{t.importOk}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.suggestRow}>
            <button
              type="button"
              className={styles.ghost}
              onClick={() => void navigator.clipboard.writeText(css()).then(() => setStatus(t.copied), () => setStatus(t.copy))}
            >
              {t.importApply}
            </button>
            <button type="button" className={styles.ghost} onClick={() => save("brand-corrected.json", "application/json", json())}>
              {t.importExport}
            </button>
            {map.primary ? (
              <button type="button" className={styles.ghost} onClick={() => onUseBrand(map.primary!)}>
                {t.importUseBrand}
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
