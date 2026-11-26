#!/usr/bin/env -S npx tsx
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { readFileSync } from "node:fs";
import { runCli } from "../src/cli";

// A closed pipe (for example `| head`) is not an error.
process.stdout.on("error", (e: NodeJS.ErrnoException) => {
  if (e.code !== "EPIPE") throw e;
});

process.exitCode = runCli(process.argv.slice(2), {
  readFile: (path) => readFileSync(path, "utf8"),
  out: (text) => void process.stdout.write(text),
  err: (text) => void process.stderr.write(text),
});
