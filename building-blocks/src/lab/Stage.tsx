"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { checkExpect } from "../harness/check";
import type { Expect } from "../harness/types";
import { themeVars, type ThemeState } from "../theme/theme-vars";
import { fixtures } from "./fixtures";
import { registerTestHook } from "./hooks";
import { NO_STRESS, expandText, scaleTextVars, type Stress } from "./stress";
import type { FixtureModule } from "./types";

/** Changes the text of the live example in place (never its structure, so React stays in charge) to stress the layout. */
function useTextStress(el: HTMLElement | null, mode: Stress["length"], loaded: boolean) {
  useEffect(() => {
    if (!el || !loaded) return;
    const originals = new WeakMap<Text, string>();
    const applied = new WeakMap<Text, string>();
    const apply = () => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
        const parent = n.parentElement;
        if (!parent || /^(SCRIPT|STYLE)$/.test(parent.tagName) || parent.closest(".lb-sr-only")) continue;
        // If React changed the text since we last touched it, that new text is the original now.
        if (!originals.has(n) || applied.get(n) !== n.data) originals.set(n, n.data);
        const next = expandText(originals.get(n)!, mode);
        if (n.data !== next) n.data = next;
        applied.set(n, next);
      }
    };
    apply();
    if (mode === "normal") return;
    const observer = new MutationObserver(apply);
    observer.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
        const original = originals.get(n);
        if (original !== undefined && applied.get(n) === n.data) n.data = original;
      }
    };
  }, [el, mode, loaded]);
}

/** The live, themed instance of a block's fixture. Real input (and the real keyboard in the tests) goes here. */
export function Stage({ slug, theme, stress = NO_STRESS, className, onElement }: { slug: string; theme: ThemeState; stress?: Stress; className?: string; onElement?: (el: HTMLElement | null) => void }) {
  const [mod, setMod] = useState<FixtureModule | null>(null);
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  const vars = useMemo(() => scaleTextVars(themeVars(theme.settings, theme.mode), stress.textScale) as CSSProperties, [theme, stress.textScale]);

  useEffect(() => {
    let alive = true;
    fixtures[slug]?.().then((m) => alive && setMod(m));
    return () => {
      alive = false;
    };
  }, [slug]);

  useEffect(() => {
    return registerTestHook("check", (expects: Expect[]) => expects.map((e) => checkExpect(ref.current ?? document, e)));
  }, []);

  useTextStress(el, stress.length, !!mod);

  return (
    <div
      ref={(node) => {
        ref.current = node;
        setEl(node);
        onElement?.(node);
      }}
      className={className ? `lb-root lb-stage ${className}` : "lb-root lb-stage"}
      style={{ ...vars, maxWidth: stress.width === "full" ? undefined : `${stress.width}px` }}
      dir={stress.dir}
      data-lb-stage=""
      data-lb-mode={theme.mode}
      data-lb-motion={stress.motion === "off" ? "off" : undefined}
      data-lb-ready={mod ? "true" : undefined}
    >
      {mod ? <mod.Fixture /> : <p className="lb-stage__loading">Loading...</p>}
    </div>
  );
}
