/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { composeLabCopy } from "./copy";
import { diffLines, improve, IMPROVE_DEFAULT_ON, maskSecretLine } from "./improve";
import { parseCompose } from "./parse";
import { evaluate, RULES, type Finding, type Level, type RuleId } from "./rules";

export type CliIo = {
  readFile(path: string): string;
  writeFile(path: string, content: string): void;
  out(text: string): void;
  err(text: string): void;
};

const USAGE = `Usage: compose-lab <file> [<override> ...] [options]

Checks docker-compose files with the Lythos Labs Compose lab rules. Several files are merged as a base and overrides.
Nothing is run and nothing is sent anywhere. Values of environment variables are never printed.

Options:
  --format text|json|github   Output format (default text)
  --fail-on fail|warn|info|none  Lowest level that gives exit code 1 (default fail)
  --disable <id,id>           Switch rules off by id (see --list-rules)
  --each                      Check each file on its own instead of merging them
  --diff                      Show the recommended automatic changes as a diff (one file)
  --fix                       Write the recommended automatic changes to the file (one file)
  --list-rules                Print every rule id with its title
  -h, --help                  Show this help

Exit codes: 0 nothing at or above --fail-on, 1 findings at or above it, 2 usage, read or parse error.`;

const RANK: Record<Level | "none", number> = { fail: 0, warn: 1, info: 2, none: 3 };
const en = composeLabCopy.en;

/** Workflow commands: the message must not be able to start a new command or property. */
export function escapeGithub(text: string): string {
  return text.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}
const escapeProperty = (text: string) => escapeGithub(text).replace(/:/g, "%3A").replace(/,/g, "%2C");

type Options = { files: string[]; format: "text" | "json" | "github"; failOn: Level | "none"; disable: RuleId[]; each: boolean; diff: boolean; fix: boolean; listRules: boolean; help: boolean };

function parseArgs(argv: string[]): Options | string {
  const o: Options = { files: [], format: "text", failOn: "fail", disable: [], each: false, diff: false, fix: false, listRules: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => argv[++i];
    if (a === "-h" || a === "--help") o.help = true;
    else if (a === "--each") o.each = true;
    else if (a === "--diff") o.diff = true;
    else if (a === "--fix") o.fix = true;
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

const message = (f: Finding) => en.rules[f.id].what({ services: f.services.join(", "), detail: f.detail ?? "" });

/** Runs the command line. Returns the exit code. `io` is injected so it can be tested without a file system. */
export function runCli(argv: string[], io: CliIo): number {
  const parsed = parseArgs(argv);
  if (typeof parsed === "string") {
    io.err(`compose-lab: ${parsed}\n${USAGE}\n`);
    return 2;
  }
  const o = parsed;
  if (o.help) {
    io.out(`${USAGE}\n`);
    return 0;
  }
  if (o.listRules) {
    for (const id of Object.keys(RULES) as RuleId[]) io.out(`${id.padEnd(30)} ${en.rules[id].title}\n`);
    return 0;
  }
  if (!o.files.length) {
    io.err(`${USAGE}\n`);
    return 2;
  }
  if ((o.diff || o.fix) && (o.files.length !== 1 || o.each)) {
    io.err("compose-lab: --diff and --fix work on exactly one file\n");
    return 2;
  }

  const read: { name: string; text: string }[] = [];
  for (const file of o.files) {
    try {
      read.push({ name: file, text: io.readFile(file) });
    } catch {
      io.err(`compose-lab: cannot read ${file}\n`);
      return 2;
    }
  }
  const targets = o.each ? read.map((r) => ({ name: r.name, text: r.text })) : [{ name: o.files.join(" + "), text: read.map((r) => r.text).join("\n---\n") }];

  const results: { file: string; annotate: string; findings: Finding[] }[] = [];
  for (const t of targets) {
    const result = parseCompose(t.text);
    if (!result.ok) {
      io.err(`compose-lab: ${t.name}: ${en.errors[result.error.code](result.error) || "the file is empty"}\n`);
      return 2;
    }
    results.push({ file: t.name, annotate: o.files[0], findings: evaluate(result.compose, { disabled: o.disable }) });
  }

  const summary = { fail: 0, warn: 0, info: 0 };
  for (const r of results) for (const f of r.findings) summary[f.level]++;

  if (o.format === "json") {
    io.out(
      JSON.stringify(
        { files: results.map((r) => ({ file: r.file, findings: r.findings.map((f) => ({ id: f.id, level: f.level, group: f.group, services: f.services, detail: f.detail ?? null, message: message(f) })) })), summary },
        null,
        2,
      ) + "\n",
    );
  } else if (o.format === "github") {
    for (const r of results)
      for (const f of r.findings) {
        const command = f.level === "fail" ? "error" : f.level === "warn" ? "warning" : "notice";
        io.out(`::${command} file=${escapeProperty(o.each ? r.file : r.annotate)},title=${escapeProperty(f.id)}::${escapeGithub(message(f))}\n`);
      }
  } else {
    for (const r of results) {
      io.out(`${r.file}\n`);
      if (!r.findings.length) io.out("  No findings.\n");
      for (const f of r.findings) io.out(`  ${f.level.padEnd(4)}  ${f.id}  ${message(f)}\n`);
    }
    io.out(`\n${summary.fail} to fix, ${summary.warn} to look at, ${summary.info} hints.\n`);
  }

  if (o.diff || o.fix) {
    const { name, text } = read[0];
    const improved = improve(text, [...IMPROVE_DEFAULT_ON]);
    if (!improved.ok) {
      io.err(`compose-lab: cannot improve ${name}: ${improved.reason}\n`);
      return 2;
    }
    if (improved.output === text) {
      io.out("\nNo automatic changes.\n");
    } else {
      if (o.diff) {
        io.out(`\n--- ${name}\n+++ ${name} (improved)\n`);
        for (const l of diffLines(text, improved.output).filter((x) => x.kind !== "same")) io.out(`${l.kind === "added" ? "+" : "-"} ${maskSecretLine(l.text)}\n`);
      }
      if (o.fix) {
        io.writeFile(name, improved.output);
        io.out(`\nWrote ${name} (${improved.changes.filter((c) => IMPROVE_DEFAULT_ON.includes(c.id)).map((c) => c.id).join(", ")}).\n`);
      }
    }
  }

  const failing = o.failOn !== "none" && results.some((r) => r.findings.some((f) => RANK[f.level] <= RANK[o.failOn]));
  return failing ? 1 : 0;
}
