/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/** Everything without React or CSS, for Node: the command line, servers and tests. */

export { parseDomain, isDnsName, parseDomains, MAX_DOMAINS } from "./domain";
export { makeLookup, type Lookup } from "./dns";
export { runChecks, type Check, type CheckId } from "./checks";
export { mailCheckCopy, type Locale } from "./copy";
export { fixesFor, type Fix } from "./fixes";
export { detectProvider, mxHosts } from "./provider";
export type { Finding, Level } from "./types";
