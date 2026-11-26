#!/usr/bin/env -S npx tsx
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { elicitConfirm } from "../src/confirm";
import { createAirlockDemoServer } from "../src/demo-server";

let confirm: ReturnType<typeof elicitConfirm> | undefined;
const demo = createAirlockDemoServer({
  confirm: (q) => confirm!(q),
  // Decisions go to stderr, which MCP clients show as the server log.
  onDecision: (e) => process.stderr.write(`airlock ${e.verdict.status}${e.approved === undefined ? "" : e.approved ? " approved" : " declined"}: ${e.tool}\n`),
});
confirm = elicitConfirm(demo.server);
await demo.server.connect(new StdioServerTransport());
