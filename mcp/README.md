# Lythos Labs MCP

Every Lythos Labs experiment as [Model Context Protocol](https://modelcontextprotocol.io) tools, so an AI assistant can check your compose file, read your Postgres migration or build a palette while you work. Plus a demo server that protects its own tools with [Airlock](../airlock), for trying to hijack your own agent.

Both run locally over stdio. Nothing is uploaded; only `mail_check` goes online (DNS-over-HTTPS to Cloudflare, with Google as reserve).

## Tools

| Tool | Experiment | What it does |
| --- | --- | --- |
| `labs_list` | all | The experiments and tools. |
| `compose_check` | Compose lab | Explained security, reliability and structure findings for a docker-compose file, with fixes. Environment values are never echoed. |
| `compose_improve` | Compose lab | Safe, mechanical improvements as small text edits, with a diff. |
| `migration_check` | Lock lab | Per statement: the table locks it takes, what they stop, the work under them, and findings. |
| `migration_safer` | Lock lab | The migration rewritten the careful way. |
| `migration_simulate` | Lock lab | The lock queue simulated against live traffic, as written and the safer version. |
| `brand_palette` | Brand lab | OKLCH scales, light and dark roles chosen on contrast, and their checks. |
| `contrast_check` | Brand lab | WCAG ratio and class, APCA, and the nearest passing colour. |
| `mail_check` | Mail check | MX, SPF, DMARC, DKIM, MTA-STS, TLS-RPT and BIMI, with records to add. |
| `blocks_list`, `block_get` | Building blocks | The accessible components and their behaviour contracts. |
| `prompt_injection_reveal` | Airlock | What is hidden in a text (tag characters, base64, comments, zero-width characters) and what an obedient model would do with it. A diagnostic, not a defence. |

Phantom is visual only and has no tool. Every tool is read-only and changes nothing anywhere.

## Connect

Clone the [lythos-labs](https://github.com/Lythos-Studio/lythos-labs) repository and run `npm install` in this folder. Then:

Claude Code:

```bash
claude mcp add lythos-labs -- npx tsx /path/to/lythos-labs/mcp/bin/lythos-labs-mcp.ts
```

Claude Desktop, Cursor and other clients (`mcpServers` in their settings):

```json
{
  "mcpServers": {
    "lythos-labs": { "command": "npx", "args": ["tsx", "/path/to/lythos-labs/mcp/bin/lythos-labs-mcp.ts"] }
  }
}
```

## The Airlock demo server

`airlock-demo` is a pretend inbox, file store and bank. Four of its emails and one web page try to hijack your agent: changed bank details, CEO fraud, an instruction hidden in invisible Unicode, an image link that leaks your API key, and a lookalike board address. Every tool goes through the Airlock guard:

- An address, IBAN or link that appears in text from a stranger is refused, or needs your approval when it is on your list.
- Payments always need your approval, and only go to listed payees.
- Your private files (a confidential report, an API key) can only go to their readers, also when they are pasted into a message or a link.
- Approval is asked through MCP elicitation: your client asks you, not the model. A client that cannot ask gets a refusal.

```bash
claude mcp add airlock-demo -- npx tsx /path/to/lythos-labs/mcp/bin/airlock-demo-mcp.ts
```

Then ask your agent normal things ("pay the Acme invoice", "summarise my inbox and email me the summary", "send the board the Q3 report they asked for") and check the `outbox` tool afterwards: it shows what was really sent, paid or loaded, and every Airlock decision. Nothing is real: no mail leaves, no money moves.

To protect your own MCP server, see the guard in [Airlock](../airlock#protect-your-own-mcp-server).

## Develop

```bash
npm install
npm test
npm run typecheck
```

The tests talk to both servers with a real MCP client over an in-memory transport, including a client that answers approval questions with yes, with no, or cannot ask at all.

## License

[Mozilla Public License 2.0](LICENSE). The Lythos name and logo are not covered by this license.
