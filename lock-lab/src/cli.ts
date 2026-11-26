/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { analyze, RULES, type Finding, type Level, type RuleId } from "./analyze";
import { lockLabCopy } from "./copy";
import { saferMigration } from "./safe";

export type CliIo = { readFile(path: string): string; out(text: string): void; err(text: string): void };

const USAGE = `Usage: lock-lab <migration.sql> [<migration.sql> ...] [options]

Checks Postgres migrations with the Lythos Labs Lock lab rules: which lock each statement takes and what it blocks.
Nothing is run and nothing is sent anywhere.

Options:
  --format text|json|github      Output format (default text)
  --fail-on fail|warn|info|none  Lowest level that gives exit code 1 (default fail)
  --disable <id,id>              Switch rules off by id (see --list-rules)
  --no-transaction               The runner does not wrap each file in a transaction
  --safer                        Print the safer version of each file
  --list-rules                   Print every rule id with its level and title
  -h, --help                     Show this help

Exit codes: 0 nothing at or above --fail-on, 1 findings at or above it, 2 usage, read or parse error.`;

const RANK: Record<Level | "none", number> = { fail: 0, warn: 1, info: 2, none: 3 };
const en = lockLabCopy.en;

/** Workflow commands: the message must not be able to start a new command or property. */
export function escapeGithub(text: string): string {
  return text.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}
const escapeProperty = (text: string) => escapeGithub(text).replace(/:/g, "%3A").replace(/,/g, "%2C");
const message = (f: Finding) => en.rules[f.id].what({ table: f.table, detail: f.detail });

type Options = { files: string[]; format: "text" | "json" | "github"; failOn: Level | "none"; disable: RuleId[]; wrap: boolean; safer: boolean; listRules: boolean; help: boolean };

function parseArgs(argv: string[]): Options | string {
  const o: Options = { files: [], format: "text", failOn: "fail", disable: [], wrap: true, safer: false, listRules: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => argv[++i];
    if (a === "-h" || a === "--help") o.help = true;
    else if (a === "--no-transaction") o.wrap = false;
    else if (a === "--safer") o.safer = true;
    else if (a === "--list-rules") o.listRules = true;
    else if (a === "--format") {
      const v = value();
      if (v !== "text" && v !== "json" && v !== "github") return `--format must be text, json or github (got ${v ?? "nothing"})`;
      o.format = v;
    } else if (a === "--fail-on") {
      const v = value();
      if (v !== "fail" && v !== "warn" && v !== "info" && v !== "none") return `--fail-on must be fail, warn, info or none (got ${v ?? "nothing"})`;
      o.failOn = v;
    } else if (a === "--disable") {
      for (const id of (value() ?? "").split(",").filter(Boolean)) {
        if (!(id in RULES)) return `unknown rule id: ${id.slice(0, 60)} (see --list-rules)`;
        o.disable.push(id as RuleId);
      }
    } else if (a.startsWith("-")) return `unknown option: ${a.slice(0, 40)}`;
    else o.files.push(a);
  }
  return o;
}

/** Runs the command line and returns the exit code. `io` is injected so it can be tested without a file system. */
export function runCli(argv: string[], io: CliIo): number {
  const o = parseArgs(argv);
  if (typeof o === "string") {
    io.err(`lock-lab: ${o}\n${USAGE}\n`);
    return 2;
  }
  if (o.help) {
    io.out(`${USAGE}\n`);
    return 0;
  }
  if (o.listRules) {
    for (const id of Object.keys(RULES) as RuleId[]) io.out(`${id.padEnd(28)} ${RULES[id].padEnd(4)}  ${en.rules[id].title}\n`);
    return 0;
  }
  if (!o.files.length) {
    io.err(`${USAGE}\n`);
    return 2;
  }

  const results: { file: string; findings: Finding[]; safer?: string }[] = [];
  for (const file of o.files) {
    let text: string;
    try {
      text = io.readFile(file);
    } catch {
      io.err(`lock-lab: cannot read ${file}\n`);
      return 2;
    }
    const r = analyze(text, { wrap: o.wrap });
    if (!r.ok) {
      if (r.error.code === "empty") {
        results.push({ file, findings: [] });
        continue;
      }
      io.err(`lock-lab: ${file}: ${en.errors[r.error.code](r.error)}\n`);
      return 2;
    }
    results.push({
      file,
      findings: r.analysis.findings.filter((f) => !o.disable.includes(f.id)),
      safer: o.safer ? saferMigration(text, r.analysis, en.safe).sql : undefined,
    });
  }

  const summary = { fail: 0, warn: 0, info: 0 };
  for (const r of results) for (const f of r.findings) summary[f.level]++;

  if (o.format === "json") {
    io.out(
      JSON.stringify(
        { files: results.map((r) => ({ file: r.file, findings: r.findings.map((f) => ({ id: f.id, level: f.level, line: f.line, table: f.table, message: message(f) })), ...(r.safer ? { safer: r.safer } : {}) })), summary },
        null,
        2,
      ) + "\n",
    );
  } else if (o.format === "github") {
    for (const r of results)
      for (const f of r.findings) {
        const command = f.level === "fail" ? "error" : f.level === "warn" ? "warning" : "notice";
        io.out(`::${command} file=${escapeProperty(r.file)},line=${f.line},title=${escapeProperty(f.id)}::${escapeGithub(message(f))}\n`);
      }
  } else {
    for (const r of results) {
      io.out(`${r.file}\n`);
      if (!r.findings.length) io.out("  No findings.\n");
      for (const f of r.findings) io.out(`  ${String(f.line).padStart(4)}  ${f.level.padEnd(4)}  ${f.id}  ${message(f)}\n`);
      if (r.safer) io.out(`\n${r.safer}\n`);
    }
    io.out(`\n${en.summary(summary.fail, summary.warn, summary.info)}\n`);
  }

  const failing = o.failOn !== "none" && results.some((r) => r.findings.some((f) => RANK[f.level] <= RANK[o.failOn]));
  return failing ? 1 : 0;
}
