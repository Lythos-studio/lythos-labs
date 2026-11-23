"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useMemo, type CSSProperties, type ReactNode } from "react";
import { themeVars, type ThemeState } from "../theme/theme-vars";
import styles from "./lab.module.css";

/** A themed surface for blocks: every --lb-* variable comes from the brand. */
export function ThemedBox({ theme, children, className }: { theme: ThemeState; children: ReactNode; className?: string }) {
  const vars = useMemo(() => themeVars(theme.settings, theme.mode) as CSSProperties, [theme]);
  return (
    <div className={`lb-root lb-stage ${styles.stageWrap}${className ? ` ${className}` : ""}`} style={vars} data-lb-mode={theme.mode}>
      {children}
    </div>
  );
}
