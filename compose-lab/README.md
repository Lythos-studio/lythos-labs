# Compose lab

Paste a `docker-compose.yml` and see the stack as a living diagram, with rules that explain what a careful reviewer would raise.

Try it at [labs.lythos.nl/compose-lab](https://labs.lythos.nl/compose-lab) (Dutch: [/nl/compose-lab](https://labs.lythos.nl/nl/compose-lab)). Status: works.

- **A diagram you can move.** Services are cards, `depends_on` is an arrow, and dashes flow from the outside to every service that publishes a port. Drag cards, select one to see only its findings, export as SVG or PNG. Animation stops with `prefers-reduced-motion`, and a service list carries the same information for screen readers and small screens.
- **Twenty-eight explained rules** in three groups: security (open database ports, privileged containers, the Docker socket, secrets written into the file, unpinned images), reliability (healthchecks, `depends_on` conditions, restart policy, limits) and structure (missing services, duplicate host ports, unused networks). Each rule says why it matters and when it is fine, and offers a snippet to fix it. New in 0.2: no-new-privileges, risky bind mounts (the whole host, /etc, /root), a proxy that shares a network with a database, Traefik checks (router without entrypoint, `traefik.enable` missing, a published port next to a router), `env_file` notes, and a note for override files.
- **Fewer false alarms.** Several files separated by `---` are merged as a base and overrides. A file that looks like an override (services without `image` or `build`) does not get alarms about things defined elsewhere. Jobs (`restart: no`, `profiles`, names such as `migrate`, `backup`, `verify`) are not asked for health checks, restart policy or limits.
- **An improved file.** Safe, mechanical changes (remove `version:`, restart policy, log limits, database ports on `127.0.0.1`, optionally `no-new-privileges`) are made as small text edits at exact positions, so comments, quotes, blank lines, line endings and flow style stay byte for byte. You see a diff and choose each change.
- **Rules on or off.** The choice goes into the link (`#off=rule-id,...`). The file never does.
- **Your file stays yours.** Everything runs in the browser; nothing is uploaded, stored or put in the address bar. Environment values are hidden by default and never appear in the diagram, the findings or the exports. The address bar only ever carries your choice of rules, never the file, because a link with a compose file in it could share secrets.
- **Bounded input.** At most 256 kB, 200 services and 100 YAML aliases, and every failure is a message, not a crash.

## Command line and CI

```bash
npx tsx bin/compose-lab.ts docker-compose.yml                       # text report, exit code 1 on a fail
npx tsx bin/compose-lab.ts compose.yml compose.prod.yml --format github --fail-on warn
npx tsx bin/compose-lab.ts compose.yml --diff                       # show the recommended automatic changes
npx tsx bin/compose-lab.ts compose.yml --fix                        # write them to the file
npx tsx bin/compose-lab.ts --list-rules
```

Exit codes: 0 nothing at or above `--fail-on` (default `fail`), 1 findings at or above it, 2 usage, read or parse error. Values of environment variables are never printed. A GitHub Actions step:

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with: { node-version: 22 }
- run: npm ci
- run: npx tsx packages/labs/compose-lab/bin/compose-lab.ts compose.yml --format github --fail-on fail
```

## What it cannot tell

Nothing is run and no image is inspected, so it cannot know whether a container runs as root or what a healthcheck really tests. `${VAR}` is not filled in, `.env` files, `include` and `extends` are not followed, and merging of `---` separated files covers the common cases (mappings merge, lists are appended, other values are replaced; no `!reset` or `!override`). It is an opinion with reasons, not a security audit.

## Use

```ts
import { parseCompose, evaluate, layout } from "@lythos-labs/compose-lab";

const parsed = parseCompose(text); // { ok: true, compose } or { ok: false, error }
if (parsed.ok) {
  const findings = evaluate(parsed.compose); // sorted, worst first
  const positions = layout(parsed.compose); // fixed layered layout
}
```

`ComposeLab` is a React 19 client component with English and Dutch copy (`<ComposeLab locale="en" />`). Its styles are a CSS module, so use a bundler that supports CSS modules. It makes no network requests, so the host page needs no extra Content-Security-Policy entry. It reads `--max`, `--gutter` and `--font-mono` from its surroundings and is designed for a dark page. The only dependency is [`yaml`](https://github.com/eemeli/yaml) (ISC).

The examples in `src/examples.ts` are invented and describe no real infrastructure.

## Develop

```bash
npm install
npm test
npm run typecheck
```

## License

[Mozilla Public License 2.0](LICENSE). The Lythos name and logo are not covered by this license.
