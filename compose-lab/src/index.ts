/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

export { ComposeLab } from "./compose-lab";
export { composeLabCopy, type Locale } from "./copy";
export { parseCompose } from "./parse";
export { evaluate, RULES, type Finding, type Group, type Level, type RuleId } from "./rules";
export { fixFor } from "./fixes";
export { layout } from "./layout";
export { EXAMPLES } from "./examples";
export { LIMITS, type Compose, type ParseError, type ParseResult, type Service } from "./model";
export { improve, diffLines, IMPROVE_DEFAULT_ON, type ImproveId, type ImproveChange, type ImproveResult, type DiffLine } from "./improve";
export { encodeDisabled, decodeDisabled } from "./config";
