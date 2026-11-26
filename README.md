# Lythos Labs

Small, working experiments by [Lythos](https://lythos.nl), an independent Dutch software studio. Try them at [labs.lythos.nl](https://labs.lythos.nl).

| Experiment | What it does | Status |
| --- | --- | --- |
| [Brand lab](brand-lab) | One brand colour or a logo becomes an accessible design system with OKLCH palettes, WCAG-checked light and dark roles, and CSS, Tailwind or JSON export. | Works |
| [Mail check](mail-check) | Type a domain and see how its email is set up: MX, SPF, DMARC, DKIM, MTA-STS, TLS-RPT and BIMI, read over DNS-over-HTTPS in your browser, with fixes in plain language. | Prototype |
| [Compose lab](compose-lab) | Paste a `docker-compose.yml` and see the stack as a living diagram, with explained rules for security, reliability and structure. Runs in your browser. | Prototype |
| [MCP](mcp) | Every experiment as Model Context Protocol tools for your AI assistant, plus an Airlock demo server that protects its own tools against prompt injection. Runs locally. | Prototype |
| [Airlock](airlock) | A defence against prompt injection for AI agents: untrusted text can never choose what the agent does or where your data goes. Play the attacker, then let a prover try thousands of attacks. Runs in your browser. | Prototype |
| [Phantom](phantom) | Images that only exist while they move: every frame is pure noise, yet you see a turning 3D shape, your words or your drawing. WebGL2, runs in your browser. | Prototype |
| [Lock lab](lock-lab) | Paste a Postgres migration and watch its locks hit live traffic in a replay of the Postgres lock queue, next to a safer version written for you. Also a command line for CI. Runs in your browser. | Prototype |
| [Building blocks](building-blocks) | Twenty-seven accessible React components with a checked contract, a stress lab and a starter kit builder. | Prototype |

Every experiment is a self-contained package with its own README, tests and license. To work on one:

```bash
cd brand-lab
npm install
npm test
```

## How this repository works

This repository is a read-only mirror of the `packages/labs` folder in the private Lythos monorepo, where the Labs website itself lives. It is updated automatically when that folder changes. Issues and pull requests are welcome here; accepted changes are applied in the monorepo and come back with the next sync, credited to their author.

## License

The source code is licensed under the [Mozilla Public License 2.0](LICENSE): you can use it in closed products, and changes to these files must be shared under the same license. The Lythos name and logo are trademarks of Lythos and are not covered by this license.
