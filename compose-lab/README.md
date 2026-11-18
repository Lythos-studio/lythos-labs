# Compose lab

Paste a `docker-compose.yml` and see the stack as a living diagram, with rules that explain what a careful reviewer would raise.

Try it at [labs.lythos.nl/compose-lab](https://labs.lythos.nl/compose-lab) (Dutch: [/nl/compose-lab](https://labs.lythos.nl/nl/compose-lab)). Status: prototype.

- **A diagram you can move.** Services are cards, `depends_on` is an arrow, and dashes flow from the outside to every service that publishes a port. Drag cards, select one to see only its findings, export as SVG or PNG. Animation stops with `prefers-reduced-motion`, and a service list carries the same information for screen readers and small screens.
- **Twenty explained rules** in three groups: security (open database ports, privileged containers, the Docker socket, secrets written into the file, unpinned images), reliability (healthchecks, `depends_on` conditions, restart policy, limits) and structure (missing services, duplicate host ports, unused networks). Each rule says why it matters and when it is fine, and offers a snippet to fix it.
- **Your file stays yours.** Everything runs in the browser; nothing is uploaded, stored or put in the address bar. Environment values are hidden by default and never appear in the diagram, the findings or the exports. There is deliberately no share link, because a link with a compose file in it could share secrets.
- **Bounded input.** At most 256 kB, 200 services and 100 YAML aliases, and every failure is a message, not a crash.

## What it cannot tell

Nothing is run and no image is inspected, so it cannot know whether a container runs as root or what a healthcheck really tests. `${VAR}` is not filled in, and `.env` files, `include`, `extends` and several `-f` files are not merged. It is an opinion with reasons, not a security audit.

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
