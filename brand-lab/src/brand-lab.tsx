"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from "react";
import {
  RADIUS,
  STEPS,
  TYPE,
  checks,
  contrast,
  decodeSettings,
  encodeSettings,
  exportCss,
  exportJson,
  exportTailwind,
  palette,
  parseHex,
  roles,
  type Mode,
  type Radius,
  type Scale,
  type Settings,
  type TypeStyle,
} from "./tokens";
import { logoColor } from "./logo-color";
import { typeScale } from "./scales";
import { AccentField } from "./accent-field";
import { CvdFilters } from "./cvd-filters";
import { CVD_KINDS, type Cvd } from "./cvd";
import { ImportSection } from "./import-section";
import { MatrixSection } from "./matrix-section";
import { ScalesSection } from "./scales-section";
import { brandLabCopy, type Locale } from "./copy";
import styles from "./brand-lab.module.css";

const DEFAULTS: Settings = { color: "#2449df", radius: "soft", type: "editorial" };
const EXAMPLES = ["#2449df", "#e4572e", "#0f9d74", "#8b5cf6", "#ffcc00", "#111827"];
const SCALES = ["primary", "neutral", "success", "warning", "danger"] as const;
const cvdOptionKeys = CVD_KINDS;
const FORMATS = [
  { id: "css", label: "CSS", file: "brand-tokens.css", type: "text/css", make: exportCss },
  { id: "tailwind", label: "Tailwind", file: "brand-theme.css", type: "text/css", make: exportTailwind },
  { id: "json", label: "JSON", file: "brand-tokens.json", type: "application/json", make: exportJson },
] as const;

function track(event: string) {
  (window as unknown as { umami?: { track: (e: string) => void } }).umami?.track(event);
}

function Segmented<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: Record<T, string>;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className={styles.segmented}>
      <legend>{legend}</legend>
      <div>
        {(Object.keys(options) as T[]).map((key) => (
          <label key={key}>
            <input type="radio" name={name} value={key} checked={value === key} onChange={() => onChange(key)} />
            <span>{options[key]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function BrandLab({ locale }: { locale: Locale }) {
  const t = brandLabCopy[locale];
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [hexText, setHexText] = useState(DEFAULTS.color);
  const [mode, setMode] = useState<Mode>("light");
  const [cvd, setCvd] = useState<Cvd>("none");
  const [format, setFormat] = useState<(typeof FORMATS)[number]["id"]>("css");
  const [logoState, setLogoState] = useState<{ kind: "idle" | "busy" | "ok" | "error"; text: string }>({ kind: "idle", text: "" });
  const [flash, setFlash] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const loaded = useRef(false);

  // Restore a shared result from the URL hash once, then keep the hash in step (no server involved).
  useEffect(() => {
    const restored = decodeSettings(window.location.hash, DEFAULTS);
    setSettings(restored);
    setHexText(restored.color);
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    const id = setTimeout(() => history.replaceState(null, "", `#${encodeSettings(settings)}`), 250);
    return () => clearTimeout(id);
  }, [settings]);

  const p = useMemo(() => palette(settings.color, settings.accent), [settings.color, settings.accent]);
  const r = useMemo(() => roles(p, mode), [p, mode]);
  const results = useMemo(() => checks(r), [r]);
  const current = FORMATS.find((f) => f.id === format)!;
  const code = useMemo(() => current.make(settings), [current, settings]);

  const setColor = (hex: string) => {
    setSettings((s) => ({ ...s, color: hex }));
    setHexText(hex);
  };

  const onHexText = (value: string) => {
    setHexText(value);
    const hex = parseHex(value);
    if (hex) setSettings((s) => ({ ...s, color: hex }));
  };

  const readLogo = async (file: File | undefined) => {
    if (!file) return;
    setLogoState({ kind: "busy", text: t.logoReading });
    try {
      const hex = await logoColor(file);
      if (hex) {
        setColor(hex);
        setLogoState({ kind: "ok", text: t.logoFound(hex) });
        track("brand-lab-logo");
      } else setLogoState({ kind: "error", text: t.logoNone });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      setLogoState({ kind: "error", text: reason === "type" ? t.logoType : reason === "size" ? t.logoSize : t.logoError });
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void readLogo(e.dataTransfer.files[0]);
  };

  const showFlash = (text: string) => {
    setFlash(text);
    setTimeout(() => setFlash(null), 2000);
  };

  const copyText = async (text: string, done: string, event: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showFlash(done);
      track(event);
    } catch {
      showFlash(t.copy);
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([code], { type: current.type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = current.file;
    a.click();
    URL.revokeObjectURL(url);
    track(`brand-lab-download-${current.id}`);
  };

  const tint = mode === "light" ? p.primary[100] : p.primary[900];
  const visionFilter = cvd === "none" ? undefined : `url(#cvd-${cvd})`;
  const scaleNames = p.accent ? ([...SCALES, "accent"] as const) : SCALES;

  const themed = {
    "--bg": r.background,
    "--surface": r.surface,
    "--text": r.text,
    "--muted": r.muted,
    "--border": r.border,
    "--primary": r.primary,
    "--on-primary": r.onPrimary,
    "--link": r.link,
    "--success": r.success,
    "--warning": r.warning,
    "--danger": r.danger,
    "--tint": tint,
    "--accent": r.accent ?? r.link,
    "--accent-tint": r.accent ? (mode === "light" ? p.accent![100] : p.accent![900]) : tint,
    "--track": mode === "light" ? p.neutral[200] : p.neutral[800],
    "--radius": `${RADIUS[settings.radius]}px`,
    "--heading": TYPE[settings.type].heading,
    "--body": TYPE[settings.type].body,
    "--fs-hero": typeScale(settings.type)["3xl"].size,
    "--fs-sub": typeScale(settings.type).lg.size,
    "--fs-body": typeScale(settings.type).base.size,
    filter: visionFilter,
  } as CSSProperties;

  const s = t.sample;

  return (
    <div className={styles.lab}>
      <CvdFilters />
      <section className={styles.intro} aria-labelledby="brand-lab-title">
        <p className={styles.eyebrow}>{t.eyebrow}</p>
        <h1 id="brand-lab-title">{t.heading}</h1>
        <p>{t.intro}</p>
      </section>

      <div className={styles.workspace}>
        <section className={styles.controls} aria-label={t.controls}>
          <div className={styles.field}>
            <label htmlFor="brand-color">{t.color}</label>
            <div className={styles.colorRow}>
              <input
                id="brand-color"
                type="color"
                value={settings.color}
                onChange={(e) => setColor(e.target.value)}
                className={styles.swatchInput}
              />
              <input
                aria-label={t.hex}
                className={styles.text}
                value={hexText}
                onChange={(e) => onHexText(e.target.value)}
                spellCheck={false}
                autoComplete="off"
                aria-invalid={parseHex(hexText) ? undefined : true}
                aria-describedby={parseHex(hexText) ? undefined : "hex-error"}
              />
            </div>
            {parseHex(hexText) ? null : (
              <p id="hex-error" className={styles.error}>
                {t.hexInvalid}
              </p>
            )}
          </div>

          <fieldset className={styles.examples}>
            <legend>{t.examples}</legend>
            <div>
              {EXAMPLES.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  aria-label={t.exampleNames[hex]}
                  aria-pressed={settings.color === hex}
                  title={t.exampleNames[hex]}
                  style={{ background: hex }}
                  onClick={() => setColor(hex)}
                />
              ))}
            </div>
          </fieldset>

          <div
            className={`${styles.drop} ${dragging ? styles.dragging : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <span className={styles.dropTitle}>{t.logo}</span>
            <label className={styles.ghost}>
              {t.logoChoose}
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
                className={styles.visuallyHidden}
                onChange={(e) => void readLogo(e.target.files?.[0])}
              />
            </label>
            <span className={styles.small}>{t.logoHint}</span>
            <p
              role="status"
              className={logoState.kind === "error" ? styles.error : styles.small}
              aria-busy={logoState.kind === "busy"}
            >
              {logoState.text}
            </p>
          </div>

          <Segmented<Radius>
            legend={t.radius}
            name="radius"
            value={settings.radius}
            options={t.radiusOptions}
            onChange={(radius) => setSettings((x) => ({ ...x, radius }))}
          />
          <Segmented<TypeStyle>
            legend={t.type}
            name="type"
            value={settings.type}
            options={t.typeOptions}
            onChange={(type) => setSettings((x) => ({ ...x, type }))}
          />
          <Segmented<Mode> legend={t.mode} name="mode" value={mode} options={t.modeOptions} onChange={setMode} />
          <AccentField
            value={settings.accent}
            brand={settings.color}
            locale={locale}
            onChange={(accent) => setSettings((x) => ({ ...x, accent }))}
          />
          <div className={styles.field}>
            <label htmlFor="cvd-select">{t.cvdLegend}</label>
            <select id="cvd-select" className={styles.select} value={cvd} onChange={(e) => setCvd(e.target.value as Cvd)}>
              {cvdOptionKeys.map((kind) => (
                <option key={kind} value={kind}>
                  {t.cvdOptions[kind]}
                </option>
              ))}
            </select>
            {cvd !== "none" ? <span className={styles.small}>{t.cvdNote}</span> : null}
          </div>

          <button
            type="button"
            className={styles.ghost}
            onClick={() => void copyText(window.location.href.split("#")[0] + `#${encodeSettings(settings)}`, t.shared, "brand-lab-share")}
          >
            {t.share}
          </button>
        </section>

        <section className={styles.preview} aria-label={t.previewTitle} style={themed}>
          <div className={`${styles.mock} ${styles.site}`}>
            <div className={styles.siteNav}>
              <strong className={styles.mockBrand}>
                <span aria-hidden="true" />
                {s.brand}
              </strong>
              <span className={styles.siteLinks} aria-hidden="true">
                {s.nav.map((n) => (
                  <span key={n}>{n}</span>
                ))}
              </span>
            </div>
            <span className={styles.badge}>{s.badge}</span>
            <h2 className={styles.mockHeading}>{s.heroTitle}</h2>
            <p className={styles.mockBody}>
              {s.heroBody} <span className={styles.mockLink}>{s.readMore}</span>
            </p>
            {/* Sample controls are pictures of buttons, not working ones. */}
            <div className={styles.buttons} aria-hidden="true">
              <span className={styles.mockPrimary}>{s.primary}</span>
              <span className={styles.mockSecondary}>{s.secondary}</span>
            </div>
          </div>

          <div className={styles.mockRow}>
            <div className={`${styles.mock} ${styles.panel}`}>
              <h3 className={styles.mockSubheading}>{s.listTitle}</h3>
              <ul className={styles.list}>
                {s.items.map(([name, status, tone]) => (
                  <li key={name}>
                    <span>{name}</span>
                    <span className={styles.pill} style={{ color: `var(--${tone})`, borderColor: `var(--${tone})` }}>
                      {status}
                    </span>
                  </li>
                ))}
              </ul>
              <div className={styles.progress}>
                <span className={styles.muted}>{s.progress}</span>
                <span className={styles.bar} aria-hidden="true">
                  <span />
                </span>
              </div>
              <div className={styles.toggleRow}>
                <span>{s.notify}</span>
                <span className={styles.toggle} aria-hidden="true">
                  <span />
                </span>
              </div>
            </div>

            <div className={styles.phone}>
              <div className={styles.phoneScreen}>
                <h3 className={styles.mockSubheading}>{s.appTitle}</h3>
                <div className={styles.appCard}>
                  <span className={styles.muted}>{s.appCard}</span>
                  <strong>{s.appTask}</strong>
                  <span className={styles.mockPrimary} aria-hidden="true">
                    {s.primary}
                  </span>
                </div>
                <div className={styles.skeleton} aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <nav className={styles.tabs} aria-hidden="true">
                  {s.tabs.map((tab, i) => (
                    <span key={tab} className={i === 0 ? styles.tabActive : undefined}>
                      <i />
                      {tab}
                    </span>
                  ))}
                </nav>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className={styles.block} aria-labelledby="palettes-title">
        <h2 id="palettes-title">{t.paletteTitle}</h2>
        <div className={styles.scales} style={{ filter: visionFilter }}>
          {scaleNames.map((name) => (
            <div key={name} className={styles.scale}>
              <h3>{t.scaleNames[name]}</h3>
              <ol>
                {STEPS.map((step, i) => {
                  const hex = (p[name] as Scale)[step];
                  const ink = contrast(hex, "#ffffff") >= contrast(hex, "#0b1022") ? "#ffffff" : "#0b1022";
                  return (
                    <li key={step} style={{ background: hex, color: ink, transitionDelay: `${i * 25}ms` }}>
                      <span>{step}</span>
                      <code>{hex}</code>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.twoUp}>
        <section className={styles.block} aria-labelledby="checks-title">
          <h2 id="checks-title">{t.checksTitle}</h2>
          <p className={styles.lead}>{t.checksIntro}</p>
          <ul className={styles.checks}>
            {results.map((c) => (
              <li key={c.label}>
                <span className={styles.sample} style={{ background: c.bg, color: c.fg, borderColor: c.fg }}>
                  Aa
                </span>
                <span>{t.checkLabels[c.label]}</span>
                <span className={styles.ratio}>
                  {c.ratio.toLocaleString(locale === "nl" ? "nl-NL" : "en-GB", { maximumFractionDigits: 1 })}:1
                </span>
                <span className={c.ratio >= c.min ? styles.ok : styles.fail}>{c.ratio >= c.min ? t.pass : "!"}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.block} aria-labelledby="export-title">
          <h2 id="export-title">{t.exportTitle}</h2>
          <p className={styles.lead}>{t.exportIntro}</p>
          <div className={styles.exportBar}>
            <div className={styles.formats} role="group" aria-label={t.exportTitle}>
              {FORMATS.map((f) => (
                <button key={f.id} type="button" aria-pressed={format === f.id} onClick={() => setFormat(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className={styles.exportActions}>
              <button type="button" className={styles.ghost} onClick={() => void copyText(code, t.copied, `brand-lab-copy-${format}`)}>
                {t.copy}
              </button>
              <button type="button" className={styles.primaryAction} onClick={download}>
                {t.download}
              </button>
            </div>
          </div>
          <pre className={styles.code} tabIndex={0} aria-label={`${t.exportTitle}: ${current.label}`}>
            <code>{code}</code>
          </pre>
        </section>
      </div>

      <MatrixSection roles={r} tint={tint} locale={locale} />
      <ScalesSection style={settings.type} locale={locale} />
      <ImportSection locale={locale} onUseBrand={setColor} />

      <section className={`${styles.block} ${styles.how}`} aria-labelledby="how-title">
        <h2 id="how-title">{t.how}</h2>
        <p>{t.howBody}</p>
      </section>

      <p className={styles.flash} role="status" aria-live="polite">
        {flash}
      </p>
    </div>
  );
}
