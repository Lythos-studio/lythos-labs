/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/** Everything without React or CSS, for Node: the command line, servers and tests. */

export { airlockCopy, type Locale } from "./copy";
export { check, runAgent, signature, STRICT, POLICY_KEYS, type Policy, type Reason, type Status, type Entry, type RunResult, type Scenario, type Attack, type Harm } from "./run";
export { join, isTrusted, recipients, onList, ibanValid, fitsSchema, lenient, shown, hostOf, TOOLS, type Label, type Val, type World, type Step, type Expr, type ToolName, type Schema } from "./model";
export { prove, depth, staticReport, randomAttack, type Proof, type Guarantee, type Counterexample, type DepthRow } from "./prove";
export { injectedCalls, reveal, hiddenParts, toTags, toBase64, type Injected } from "./inject";
export { TECHNIQUES, payloadFor, type TechniqueId } from "./attacks";
export { scenarios, SCENARIO_IDS, worstCaseReader, benignAttack, ACME_IBAN, ATTACKER_IBAN, ATTACKER_EMAIL, ATTACKER_URL, type ScenarioId } from "./scenarios";
export { createGuard, explain, resultText, type Guard, type GuardOptions, type GuardVerdict, type GuardReason, type GuardEvent, type ToolPolicy } from "./guard";
