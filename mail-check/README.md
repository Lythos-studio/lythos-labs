# Mail check

The logic of a mail check for a domain: it reads MX, SPF, DMARC, DKIM, MTA-STS, TLS-RPT and BIMI records through DNS-over-HTTPS and returns a verdict per check. There is no page yet; this package is the part that can be tested without a browser.

Status: in development. A live page at labs.lythos.nl comes later.

- **Runs in the browser.** DNS questions go from the visitor's browser to Cloudflare's DNS-over-HTTPS service (`cloudflare-dns.com`), not to a Lythos server.
- **Verdicts, not scores.** Each check is `ok`, `warn`, `fail`, `info` or `unknown`, with a language-independent code. A failed lookup is `unknown`, never a green tick.
- **Careful with strangers' data.** Input must be a plain public domain name. DNS answers are treated as untrusted text, size-limited, and a name taken from an SPF record is only queried when it is a valid DNS name.
- **Bounded.** One run makes at most 40 DNS requests (default), each with a time-out.

## What it can and cannot tell

It reads public DNS records. It does not contact mail servers, so it cannot tell whether mail is delivered. DKIM selectors are guessed from a list of common ones: finding a key proves it exists, finding none proves nothing. SPF lookups are counted the way RFC 7208 does, up to its limit of 10.

## Use

```ts
import { makeLookup, parseDomain, runChecks } from "@lythos-labs/mail-check";

const domain = parseDomain(input); // null when it is not a plain public domain
if (domain) {
  const checks = await runChecks(domain, makeLookup(), { onCheck: (c) => console.log(c.id, c.finding) });
}
```

The pure judges (`judgeSpf`, `judgeDmarc`, `judgeDkim`, `judgeMx`, `judgeOptional`) take record text and return a finding; they need no network.

## Develop

```bash
npm install
npm test
npm run typecheck
```

## License

[Mozilla Public License 2.0](LICENSE). The Lythos name and logo are not covered by this license.
