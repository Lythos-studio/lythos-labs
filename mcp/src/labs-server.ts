/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { hiddenParts, injectedCalls, type World } from "@lythos-labs/airlock/core";
import { apca, apcaLevel, checks, contrast, palette, parseHex, repairColor, roles, wcagClass } from "@lythos-labs/brand-lab/core";
import { catalog, bySlug } from "@lythos-labs/building-blocks/registry";
import { composeLabCopy, diffLines, evaluate, fixFor, improve, IMPROVE_DEFAULT_ON, maskSecretLine, parseCompose, type ImproveId } from "@lythos-labs/compose-lab/core";
import { analyze, blocksReads, blocksWrites, DEFAULT_ROWS, DEFAULT_TRAFFIC, lockLabCopy, MODES, saferMigration, simulate } from "@lythos-labs/lock-lab/core";
import { detectProvider, fixesFor, mailCheckCopy, makeLookup, mxHosts, parseDomain, runChecks } from "@lythos-labs/mail-check/core";

export const SERVER_NAME = "lythos-labs";
export const SERVER_VERSION = "0.1.0";

const locale = z.enum(["en", "nl"]).default("en").describe("Language of messages: en or nl.");
const MAX_TEXT = 256 * 1024;

/** Tool results as JSON text (what every client shows) and as structured content (what newer clients use). */
const ok = (data: Record<string, unknown>) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data });
const fail = (message: string) => ({ content: [{ type: "text" as const, text: message }], isError: true });

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

/** Every tool, with its experiment, for labs_list and the README. */
export const TOOL_LIST = [
  ["labs_list", "all", "List the experiments and the tools of this server."],
  ["compose_check", "compose-lab", "Check a docker-compose file against explained security, reliability and structure rules."],
  ["compose_improve", "compose-lab", "Make safe, mechanical improvements to a docker-compose file and show the diff."],
  ["migration_check", "lock-lab", "Read a Postgres migration: which lock each statement takes, what it blocks, and what to fix."],
  ["migration_safer", "lock-lab", "Rewrite a Postgres migration the careful way (lock_timeout, CONCURRENTLY, NOT VALID plus VALIDATE)."],
  ["migration_simulate", "lock-lab", "Simulate a migration against live traffic, as written and the safer version."],
  ["brand_palette", "brand-lab", "Turn one brand colour into an accessible palette with light and dark roles and contrast checks."],
  ["contrast_check", "brand-lab", "WCAG contrast and APCA for two colours, with the nearest passing colour when it fails."],
  ["mail_check", "mail-check", "Check a domain's email setup (MX, SPF, DMARC, DKIM, MTA-STS, TLS-RPT, BIMI) over DNS-over-HTTPS."],
  ["blocks_list", "building-blocks", "List the accessible building blocks."],
  ["block_get", "building-blocks", "Details and the behaviour contract of one building block."],
  ["prompt_injection_reveal", "airlock", "Show what is hidden in a text and what a model that obeys everything would do with it."],
] as const;

export function createLabsServer(options: { fetch?: typeof fetch } = {}): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        "Tools from Lythos Labs (labs.lythos.nl): small, honest experiments. They analyse what you pass in and change nothing anywhere. Only mail_check goes online (DNS-over-HTTPS to Cloudflare, with Google as reserve); every other tool runs locally. Findings are opinions with reasons, not audits.",
    },
  );

  server.registerTool(
    "labs_list",
    { title: "Lythos Labs: experiments and tools", description: "List the Lythos Labs experiments available as tools, with a one-line description each. Phantom is visual only and has no tool.", inputSchema: {}, annotations: READ_ONLY },
    async () =>
      ok({
        site: "https://labs.lythos.nl",
        tools: TOOL_LIST.map(([name, experiment, about]) => ({ name, experiment, about })),
        visualOnly: ["phantom"],
      }),
  );

  // Compose lab
  server.registerTool(
    "compose_check",
    {
      title: "Compose lab: check a docker-compose file",
      description: "Check a docker-compose.yml (several files may be joined with a line containing ---; the first is the base, the rest are overrides). Returns findings, worst first, each with why it matters, when it is fine, and a snippet to fix it. Environment values are never echoed.",
      inputSchema: { yaml: z.string().max(MAX_TEXT).describe("The compose file text."), disabled: z.array(z.string()).max(50).optional().describe("Rule ids to switch off."), locale },
      annotations: READ_ONLY,
    },
    async ({ yaml, disabled, locale: l }) => {
      const t = composeLabCopy[l];
      const parsed = parseCompose(yaml);
      if (!parsed.ok) return fail(t.errors[parsed.error.code](parsed.error as never) || "The file is empty.");
      const findings = evaluate(parsed.compose, { disabled: (disabled ?? []) as never[] });
      return ok({
        services: parsed.compose.services.map((s) => s.name),
        summary: { fail: findings.filter((f) => f.level === "fail").length, warn: findings.filter((f) => f.level === "warn").length, info: findings.filter((f) => f.level === "info").length },
        findings: findings.map((f) => ({
          id: f.id,
          level: f.level,
          group: f.group,
          services: f.services,
          title: t.rules[f.id].title,
          message: t.rules[f.id].what({ services: f.services.join(", "), detail: f.detail ?? "" }),
          why: t.rules[f.id].why,
          fine: t.rules[f.id].fine,
          fix: fixFor(f, parsed.compose) ?? null,
        })),
      });
    },
  );

  server.registerTool(
    "compose_improve",
    {
      title: "Compose lab: improve a docker-compose file",
      description: "Apply safe, mechanical improvements as small text edits that keep comments and layout: remove-version, add-restart, add-log-limits, bind-db-localhost, add-no-new-privileges. Returns the improved file and a diff with secret values masked. Nothing is written anywhere.",
      inputSchema: {
        yaml: z.string().max(MAX_TEXT),
        changes: z.array(z.enum(["remove-version", "add-restart", "add-log-limits", "bind-db-localhost", "add-no-new-privileges"])).optional().describe("Which changes to make; default: all except add-no-new-privileges."),
      },
      annotations: READ_ONLY,
    },
    async ({ yaml, changes }) => {
      const result = improve(yaml, (changes ?? IMPROVE_DEFAULT_ON) as ImproveId[]);
      if (!result.ok) return fail(`Cannot improve this file: ${result.reason}.`);
      return ok({
        changed: result.output !== yaml,
        changes: result.changes,
        diff: diffLines(yaml, result.output)
          .filter((d) => d.kind !== "same")
          .map((d) => `${d.kind === "added" ? "+" : "-"} ${maskSecretLine(d.text)}`),
        output: result.output,
      });
    },
  );

  // Lock lab
  const migrationInput = {
    sql: z.string().max(MAX_TEXT).describe("The migration SQL."),
    wrap: z.boolean().default(true).describe("Whether the migration tool runs the whole file in one transaction (most do)."),
  };
  server.registerTool(
    "migration_check",
    {
      title: "Lock lab: check a Postgres migration",
      description: "For each statement: the table locks it takes (Postgres 12 and later), whether they stop reads or writes, the work done under the lock, and findings with reasons. Nothing is run against a database.",
      inputSchema: { ...migrationInput, locale },
      annotations: READ_ONLY,
    },
    async ({ sql, wrap, locale: l }) => {
      const t = lockLabCopy[l];
      const r = analyze(sql, { wrap });
      if (!r.ok) return fail(t.errors[r.error.code](r.error) || "The migration is empty.");
      const a = r.analysis;
      return ok({
        transaction: a.transaction,
        tables: a.tables,
        created: a.created,
        statements: a.steps.map((s) => ({
          line: s.line,
          kind: s.kind,
          actions: s.actions,
          inTransaction: s.tx !== null,
          locks: s.locks.map((k) => ({ table: k.table, mode: MODES[k.mode], blocksReads: blocksReads(k.mode), blocksWrites: blocksWrites(k.mode) || !!k.rows })),
          work: s.works,
        })),
        findings: a.findings.map((f) => ({ id: f.id, level: f.level, line: f.line, table: f.table, title: t.rules[f.id].title, message: t.rules[f.id].what({ table: f.table, detail: f.detail }), why: t.rules[f.id].why, fine: t.rules[f.id].fine })),
      });
    },
  );

  server.registerTool(
    "migration_safer",
    {
      title: "Lock lab: write a safer migration",
      description: "Rewrite the migration with lock_timeout, one statement per transaction, CREATE INDEX CONCURRENTLY, NOT VALID plus VALIDATE, the CHECK pattern for SET NOT NULL and unique indexes attached with USING INDEX. What cannot be rewritten safely stays as written, with a comment. Review before running.",
      inputSchema: { ...migrationInput, locale },
      annotations: READ_ONLY,
    },
    async ({ sql, wrap, locale: l }) => {
      const r = analyze(sql, { wrap });
      if (!r.ok) return fail(lockLabCopy[l].errors[r.error.code](r.error) || "The migration is empty.");
      const safer = saferMigration(sql, r.analysis, lockLabCopy[l].safe);
      return ok({ sql: safer.sql, rewrittenStatements: safer.rewritten.length, needYourDecision: safer.manual.length });
    },
  );

  server.registerTool(
    "migration_simulate",
    {
      title: "Lock lab: simulate a migration against live traffic",
      description: "Event simulation of the Postgres lock queue with steady reads and writes, optionally a slow query that is already running. Compares the migration as written with the safer version (retried after lock timeouts). Work times are rough estimates from row counts.",
      inputSchema: {
        ...migrationInput,
        rows: z.record(z.string(), z.number().int().min(0).max(5e9)).optional().describe(`Rows per table; default ${DEFAULT_ROWS}.`),
        readsPerSecond: z.number().min(0).max(5000).default(DEFAULT_TRAFFIC.readsPerSec),
        writesPerSecond: z.number().min(0).max(2000).default(DEFAULT_TRAFFIC.writesPerSec),
        slowQuerySeconds: z.number().min(0).max(120).default(DEFAULT_TRAFFIC.slowMs / 1000),
        appTimeoutSeconds: z.number().min(0).max(120).default(DEFAULT_TRAFFIC.appTimeoutMs / 1000),
      },
      annotations: READ_ONLY,
    },
    async ({ sql, wrap, rows, readsPerSecond, writesPerSecond, slowQuerySeconds, appTimeoutSeconds }) => {
      const r = analyze(sql, { wrap });
      if (!r.ok) return fail(lockLabCopy.en.errors[r.error.code](r.error) || "The migration is empty.");
      if (!r.analysis.tables.length) return ok({ note: "This migration takes no lock on an existing table, so there is no traffic to block." });
      const traffic = { ...DEFAULT_TRAFFIC, readsPerSec: readsPerSecond, writesPerSec: writesPerSecond, slowMs: slowQuerySeconds * 1000, appTimeoutMs: appTimeoutSeconds * 1000, rows: rows ?? {} };
      const safer = saferMigration(sql, r.analysis, lockLabCopy.en.safe);
      const sa = analyze(safer.sql, { wrap: false });
      const summary = (sim: ReturnType<typeof simulate>) => ({
        outcome: sim.outcome,
        finishedAtSeconds: sim.finishedAt === null ? null : Math.round(sim.finishedAt) / 1000,
        requests: sim.totals.requests,
        waitedOverOneSecond: sim.totals.delayed,
        gaveUp: sim.totals.timedOut,
        longestWaitSeconds: Math.round(sim.totals.maxWaitMs) / 1000,
        retries: sim.attempts.filter((x) => x.outcome === "lock-timeout" || x.outcome === "statement-timeout").length,
      });
      return ok({
        asWritten: summary(simulate(r.analysis, { traffic })),
        safer: sa.ok && sa.analysis.tables.length ? summary(simulate(sa.analysis, { traffic, retry: { attempts: 40, delayMs: 3000 } })) : null,
        assumptions: "Rough rows per second: scan 3M, foreign key check 1M, index build 750k, rewrite 300k, update of every row 80k. A model, not a measurement.",
      });
    },
  );

  // Brand lab
  const hex = z.string().max(32).describe("A colour as hex, for example #2449df.");
  server.registerTool(
    "brand_palette",
    {
      title: "Brand lab: palette from one colour",
      description: "Build OKLCH scales (50 to 950) from a brand colour (and optional accent), light and dark text and surface roles chosen on WCAG contrast, and the contrast checks of those roles.",
      inputSchema: { color: hex, accent: hex.optional() },
      annotations: READ_ONLY,
    },
    async ({ color, accent }) => {
      const brand = parseHex(color);
      if (!brand) return fail(`"${color}" is not a hex colour such as #2449df.`);
      const acc = accent ? parseHex(accent) : undefined;
      if (accent && !acc) return fail(`"${accent}" is not a hex colour.`);
      const p = palette(brand, acc ?? undefined);
      const light = roles(p, "light");
      const dark = roles(p, "dark");
      return ok({ palette: p, roles: { light, dark }, checks: { light: checks(light), dark: checks(dark) } });
    },
  );

  server.registerTool(
    "contrast_check",
    {
      title: "Brand lab: contrast of two colours",
      description: "WCAG 2 contrast ratio and class, APCA lightness contrast as extra guidance, and, when the ratio is below the minimum, the nearest colour (only lightness changed) that passes.",
      inputSchema: { foreground: hex, background: hex, minimum: z.number().min(1).max(21).default(4.5).describe("Required ratio: 4.5 for body text, 3 for large text.") },
      annotations: READ_ONLY,
    },
    async ({ foreground, background, minimum }) => {
      const fg = parseHex(foreground);
      const bg = parseHex(background);
      if (!fg || !bg) return fail("Both colours must be hex colours such as #2449df.");
      const ratio = contrast(fg, bg);
      const lc = apca(fg, bg);
      return ok({ ratio: Math.round(ratio * 100) / 100, wcag: wcagClass(ratio), passes: ratio >= minimum, apca: { lc: Math.round(lc * 10) / 10, level: apcaLevel(lc) }, fix: ratio >= minimum ? null : repairColor(fg, bg, minimum) });
    },
  );

  // Mail check
  server.registerTool(
    "mail_check",
    {
      title: "Mail check: email setup of a domain",
      description: "Look up MX, SPF (with the 10-lookup count), DMARC, DKIM (common selectors), MTA-STS, TLS-RPT and BIMI over DNS-over-HTTPS, with a verdict and records to add. The domain is sent to Cloudflare's DNS service (Google as reserve); nothing is sent to Lythos.",
      inputSchema: { domain: z.string().max(253).describe("A domain, for example example.com."), locale },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ domain, locale: l }) => {
      const name = parseDomain(domain);
      if (!name) return fail(`"${domain}" is not a domain name.`);
      const t = mailCheckCopy[l];
      try {
        const lookup = makeLookup({ fetch: options.fetch });
        const results = await runChecks(name, lookup);
        const mx = results.find((c) => c.id === "mx")?.data?.mx ?? [];
        const ctx = { provider: detectProvider(mxHosts(mx)), mx: mxHosts(mx) };
        return ok({
          domain: name,
          provider: ctx.provider,
          checks: results.map((c) => ({ id: c.id, name: t.names[c.id], level: c.finding.level, message: t.messages[c.finding.code]?.(c.finding.detail) ?? c.finding.code, fixes: fixesFor(c.finding.code, name, ctx) })),
        });
      } catch {
        return fail("The DNS-over-HTTPS services did not answer. Try again later.");
      }
    },
  );

  // Building blocks
  server.registerTool(
    "blocks_list",
    {
      title: "Building blocks: list",
      description: "The accessible React building blocks of Lythos Labs, with tier, summary and when the platform already does the job.",
      inputSchema: { tier: z.enum(["core", "advanced", "signature"]).optional(), locale },
      annotations: READ_ONLY,
    },
    async ({ tier, locale: l }) =>
      ok({
        blocks: catalog
          .filter((e) => !tier || e.meta.tier === tier)
          .map((e) => ({ slug: e.meta.slug, tier: e.meta.tier, title: e.meta.title[l], summary: e.meta.summary[l], url: `https://labs.lythos.nl${l === "nl" ? "/nl/bouwstenen" : "/blocks"}/${e.meta.slug}` })),
      }),
  );

  server.registerTool(
    "block_get",
    {
      title: "Building blocks: one block",
      description: "Details of one building block: summary, honest native alternative, limits, its files and the behaviour contract it is tested against.",
      inputSchema: { slug: z.string().max(60), locale },
      annotations: READ_ONLY,
    },
    async ({ slug, locale: l }) => {
      const e = bySlug(slug);
      if (!e) return fail(`No block "${slug}". Use blocks_list to see them.`);
      return ok({
        slug: e.meta.slug,
        tier: e.meta.tier,
        title: e.meta.title[l],
        summary: e.meta.summary[l],
        native: e.meta.native[l],
        limits: e.meta.limits[l],
        files: e.meta.files,
        needs: e.meta.needs,
        contract: { component: e.contract.component, pattern: e.contract.pattern, behaviours: e.contract.behaviours.map((b) => ({ id: b.id, title: b.title, kind: b.kind, note: b.note ?? null })) },
      });
    },
  );

  // Airlock
  const emptyWorld: World = { me: "", contacts: {}, payees: {}, domains: [], channels: {}, files: { "api-key": { text: "", readers: [] }, "q3-report": { text: "", readers: [] } }, emails: {}, pages: {} };
  server.registerTool(
    "prompt_injection_reveal",
    {
      title: "Airlock: what is hidden in this text",
      description:
        "Show what a model reads in a text that a person does not see (invisible Unicode tag characters, base64, HTML comments, zero-width characters), and which actions a model that obeys every instruction would take: send email, pay, load links, post. This is a diagnostic, not a defence: an empty result does not mean the text is safe. The defence is to keep untrusted text away from decisions (see Airlock).",
      inputSchema: { text: z.string().max(MAX_TEXT) },
      annotations: READ_ONLY,
    },
    async ({ text }) => {
      const hidden = hiddenParts(text);
      return ok({
        hidden: { tagText: hidden.tags, base64Text: hidden.base64, comments: hidden.comments, zeroWidthCharacters: hidden.zeroWidth },
        anObedientModelWould: injectedCalls(text, emptyWorld).map((c) => ({ action: c.tool, arguments: c.args, wantsYourFiles: c.attach.length > 0, via: c.via })),
      });
    },
  );

  return server;
}
