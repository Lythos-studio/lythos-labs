/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/** A reference to an element inside the fixture: a CSS selector, optionally "selector@index" (default 0). */
export type Ref = string | { sel: string; index?: number };

export type Step =
  | { focus: Ref }
  | { key: string }
  | { click: Ref }
  | { hover: Ref }
  | { type: string }
  | { wait: number };

export type Expect =
  | { ref: Ref; attr: Record<string, string | null> }
  | { ref: Ref; prop: Record<string, string | number | boolean> }
  | { ref: Ref; focused: boolean }
  | { ref: Ref; text: string }
  | { ref: Ref; value: string }
  | { ref: Ref; visible: boolean }
  | { ref: Ref; exists: boolean }
  | { sel: string; count: number };

/**
 * static: roles, names and states; keyboard and pointer: behaviour the component implements itself.
 * native: what only the real browser does (Tab order, native dialog focus trap). It has steps and expectations for the end-to-end tests, which use the real keyboard; the in-page checks skip it.
 */
export type Behaviour = {
  id: string;
  title: string;
  kind: "static" | "keyboard" | "pointer" | "native";
  steps?: Step[];
  expect?: Expect[];
  note?: string;
};

export type Contract = {
  component: string;
  /** The ARIA Authoring Practices pattern, or a short description when it is not one. */
  pattern: string;
  behaviours: Behaviour[];
};

export type BehaviourResult = { id: string; status: "pass" | "fail" | "skipped"; reason?: string };
