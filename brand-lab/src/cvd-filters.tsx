/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { CVD_KINDS, cvdFilterValues } from "./cvd";

/** Hidden SVG filters. The preview points at them with `filter: url(#cvd-<kind>)`; no script is involved. */
export function CvdFilters() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute" }}>
      {CVD_KINDS.filter((k) => k !== "none").map((kind) => (
        <filter key={kind} id={`cvd-${kind}`} colorInterpolationFilters="linearRGB">
          <feColorMatrix type="matrix" values={cvdFilterValues(kind)} />
        </filter>
      ))}
    </svg>
  );
}
