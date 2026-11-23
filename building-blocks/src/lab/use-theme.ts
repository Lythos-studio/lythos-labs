"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_THEME, encodeThemeHash, parseThemeHash, type ThemeState } from "../theme/theme-vars";

/** The brand and mode, kept in the address after the # (same format as Merklab, plus m=dark). Nothing leaves the browser. */
export function useThemeHash(): [ThemeState, (next: ThemeState) => void] {
  const [state, setState] = useState<ThemeState>(DEFAULT_THEME);
  useEffect(() => {
    setState(parseThemeHash(window.location.hash));
    const onChange = () => setState(parseThemeHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  const update = useCallback((next: ThemeState) => {
    setState(next);
    try {
      history.replaceState(null, "", `#${encodeThemeHash(next)}`);
    } catch {
      // The address bar is only a convenience.
    }
  }, []);
  return [state, update];
}
