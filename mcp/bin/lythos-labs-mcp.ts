#!/usr/bin/env -S npx tsx
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLabsServer } from "../src/labs-server";

// stdout carries the protocol, so nothing else may be printed there.
await createLabsServer().connect(new StdioServerTransport());
