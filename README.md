# Lythos Labs

Small, working experiments by [Lythos](https://lythos.nl), an independent Dutch software studio. Try them at [labs.lythos.nl](https://labs.lythos.nl).

| Experiment | What it does | Status |
| --- | --- | --- |
| [Brand lab](brand-lab) | One brand colour or a logo becomes an accessible design system with OKLCH palettes, WCAG-checked light and dark roles, and CSS, Tailwind or JSON export. | Works |
| [Mail check](mail-check) | The logic that reads a domain's MX, SPF, DMARC, DKIM, MTA-STS, TLS-RPT and BIMI records over DNS-over-HTTPS and explains what is missing. No page yet. | In development |

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
