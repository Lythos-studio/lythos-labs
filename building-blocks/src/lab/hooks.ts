/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { Behaviour, BehaviourResult, Expect } from "../harness/types";

type TestHooks = {
  /** Runs the expectation checker on the live stage. */
  check?: (expects: Expect[]) => (string | null)[];
  /** Runs behaviours on fresh copies of a block's fixture, like the Verify panel does. */
  run?: (slug: string, behaviours: Behaviour[]) => Promise<BehaviourResult[]>;
};

declare global {
  interface Window {
    /** Test hooks for the end-to-end tests. They only expose what the page already does. */
    __lb?: TestHooks;
  }
}

export function registerTestHook<K extends keyof TestHooks>(key: K, fn: NonNullable<TestHooks[K]>): () => void {
  window.__lb = { ...window.__lb, [key]: fn };
  return () => {
    if (window.__lb) delete window.__lb[key];
  };
}
