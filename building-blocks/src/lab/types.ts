/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { ComponentType, ReactNode } from "react";
import type { Localized } from "../catalog-types";

export type Control =
  | { name: string; label: Localized; kind: "select"; options: string[]; default: string }
  | { name: string; label: Localized; kind: "boolean"; default: boolean }
  | { name: string; label: Localized; kind: "text"; default: string };

export type PlaygroundValues = Record<string, string | boolean>;
export type PlaygroundDef = { controls: Control[]; render(values: PlaygroundValues): ReactNode; code(values: PlaygroundValues): string };
export type FixtureModule = { Fixture: ComponentType; playground?: PlaygroundDef };
