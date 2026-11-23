"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useRef, useState } from "react";
import { encodeSettings, parseHex, type Radius, type TypeStyle } from "@lythos-labs/brand-lab/tokens";
import { logoColor } from "@lythos-labs/brand-lab/logo-color";
import type { ThemeState } from "../theme/theme-vars";
import type { LabCopy, LabLocale } from "./copy";
import styles from "./lab.module.css";

const MERKLAB: Record<LabLocale, string> = { en: "/brand-lab", nl: "/nl/merklab" };

/** The brand controls: colour (or a logo), corners, typography and mode. Same settings as Merklab, kept in the address after the #. */
export function ThemeBar({ theme, onChange, t, locale, base = "" }: { theme: ThemeState; onChange: (next: ThemeState) => void; t: LabCopy; locale: LabLocale; base?: string }) {
  const [text, setText] = useState(theme.settings.color);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const settings = theme.settings;
  const set = (patch: Partial<typeof settings>) => onChange({ ...theme, settings: { ...settings, ...patch } });
  // Keep the text field in step when the colour changes from elsewhere (the colour picker, a logo, the address).
  if (parseHex(text) !== settings.color && parseHex(text) !== null && document.activeElement?.id !== "lb-hex") setText(settings.color);

  async function readLogo(f: File | undefined) {
    if (!f) return;
    setNote("");
    try {
      const hex = await logoColor(f);
      if (hex) {
        set({ color: hex });
        setText(hex);
        setNote(t.logoFound(hex));
      } else setNote(t.logoNone);
    } catch {
      setNote(t.logoError);
    } finally {
      if (file.current) file.current.value = "";
    }
  }

  return (
    <div className={styles.themeBar} role="group" aria-label={t.themeTitle}>
      <label>
        <span>{t.color}</span>
        <input type="color" value={settings.color} onChange={(e) => (set({ color: e.target.value }), setText(e.target.value))} />
      </label>
      <label>
        <span>{t.hex}</span>
        <input
          id="lb-hex"
          type="text"
          value={text}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={parseHex(text) ? undefined : true}
          onChange={(e) => {
            setText(e.target.value);
            const hex = parseHex(e.target.value);
            if (hex) set({ color: hex });
          }}
        />
        {parseHex(text) ? null : <span className={styles.error}>{t.hexInvalid}</span>}
      </label>
      <label>
        <span>{t.radiusLabel}</span>
        <select value={settings.radius} onChange={(e) => set({ radius: e.target.value as Radius })}>
          {(Object.keys(t.radius) as Radius[]).map((k) => (
            <option key={k} value={k}>
              {t.radius[k]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{t.typeLabel}</span>
        <select value={settings.type} onChange={(e) => set({ type: e.target.value as TypeStyle })}>
          {(Object.keys(t.type) as TypeStyle[]).map((k) => (
            <option key={k} value={k}>
              {t.type[k]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{t.modeLabel}</span>
        <select value={theme.mode} onChange={(e) => onChange({ ...theme, mode: e.target.value === "dark" ? "dark" : "light" })}>
          <option value="light">{t.light}</option>
          <option value="dark">{t.dark}</option>
        </select>
      </label>
      <div className={styles.themeActions}>
        <label className={styles.ghost}>
          {t.logoChoose}
          <input ref={file} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif" className={styles.srOnly} onChange={(e) => void readLogo(e.target.files?.[0])} />
        </label>
        <a className={styles.ghost} href={`${base}${MERKLAB[locale]}#${encodeSettings(settings)}`}>
          {t.openMerklab}
        </a>
        <button
          type="button"
          className={styles.ghost}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // Clipboard blocked: the address bar already has the link.
            }
          }}
        >
          {copied ? t.copied : t.copyLink}
        </button>
      </div>
      <p role="status" className={styles.small} style={{ gridColumn: "1 / -1" }}>
        {note}
      </p>
    </div>
  );
}
