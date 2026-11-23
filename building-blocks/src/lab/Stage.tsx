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
import type { FixtureModule } from "./types";

/** The live, themed instance of a block's fixture. Real input (and the real keyboard in the tests) goes here. */
export function Stage({ slug, theme, className }: { slug: string; theme: ThemeState; className?: string }) {
  const [mod, setMod] = useState<FixtureModule | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const vars = useMemo(() => themeVars(theme.settings, theme.mode) as CSSProperties, [theme]);

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

  return (
    <div
      ref={ref}
      className={className ? `lb-root lb-stage ${className}` : "lb-root lb-stage"}
      style={vars}
      data-lb-stage=""
      data-lb-mode={theme.mode}
      data-lb-ready={mod ? "true" : undefined}
    >
      {mod ? <mod.Fixture /> : <p className="lb-stage__loading">Loading...</p>}
    </div>
  );
}
