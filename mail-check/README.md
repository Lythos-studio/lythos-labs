# Mail check

Check how a domain is set up for email. It reads MX, SPF, DMARC, DKIM, MTA-STS, TLS-RPT and BIMI records through DNS-over-HTTPS and gives a verdict per check, with a record to copy where that helps.

Try it at [labs.lythos.nl/mail-check](https://labs.lythos.nl/mail-check) (Dutch: [/nl/mailcheck](https://labs.lythos.nl/nl/mailcheck)). Status: prototype.

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

`MailCheck` is a React 19 client component with English and Dutch copy (`<MailCheck locale="en" />`). Its styles are a CSS module, so use a bundler that supports CSS modules. The page that hosts it must allow `https://cloudflare-dns.com` in `connect-src`. It reads `--max`, `--gutter` and `--font-mono` from its surroundings and is designed for a dark page.

## Develop

```bash
npm install
npm test
npm run typecheck
```

## License

[Mozilla Public License 2.0](LICENSE). The Lythos name and logo are not covered by this license.
