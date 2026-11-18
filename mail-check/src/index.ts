/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

export { parseDomain, isDnsName } from "./domain";
export { makeLookup, readAnswer, txtValue, type Lookup, type RecordType } from "./dns";
export { runChecks, type Check, type CheckId } from "./checks";
export * from "./records";
export type { Finding, Level } from "./types";
export { MailCheck } from "./mail-check";
export { mailCheckCopy, type Locale } from "./copy";
export { fixFor, type Fix } from "./fixes";
