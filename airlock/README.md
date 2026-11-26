# Airlock

A defence against prompt injection that does not try to spot attacks. Untrusted text (an email, a web page, a document) can never decide which actions an AI agent takes, to whom, or where your data goes. You play the attacker; then a prover tries thousands of attacks and shows the hole as soon as you switch a rule off.

Try it at [labs.lythos.nl/airlock](https://labs.lythos.nl/airlock) (Dutch: [/nl/luchtsluis](https://labs.lythos.nl/nl/luchtsluis)). Status: prototype.

## The idea

Filters that look for injected instructions lose, because an attacker only has to get through once. Airlock instead changes what an injection *can* do:

1. **The planner never sees untrusted text.** It turns your request into a fixed list of steps (no branches, no loops) before anything is read. Text cannot add, remove or reorder steps.
2. **Untrusted text is only ever a value with a label.** A reader (a model) may pull an IBAN, an address or a date out of it, but the result is labelled as coming from a stranger, and has to fit a type or the plan stops. The reader is assumed to be **fully controlled by the attacker**.
3. **One monitor sees every tool call.** Arguments that decide something (recipient, account, amount, address to load, channel) may not come from untrusted text unless they are exactly on your lists and you approved. Data only goes to people in its readers label: a confidential report labelled "you and the board" cannot be mailed anywhere else, whoever asks.

The pattern builds on Simon Willison's dual LLM pattern (2023) and CaMeL (Debenedetti and others, Google DeepMind, 2025), which combines a privileged planner, a quarantined reader and capability-based data flow policies. This lab makes the reader fully hostile, lets you attack it directly, and measures every rule on its own.

## What the lab does

- **Four tasks**: pay an invoice, share a confidential report, summarise a newsletter, look a date up on the web.
- **You are the attacker**: you write the email or the page, add any of fifteen techniques (instruction override, fake system messages, tool calls in text, markdown image exfiltration, invisible Unicode tag characters, base64, HTML comments, zero-width splits, lookalike addresses, changed bank details, CEO fraud, silent copies, another language, public posting, exfiltration links), and type whatever the hijacked reader returns.
- **Side by side**: an ordinary agent, modelled as the worst case (it obeys every instruction it reads, including hidden ones), next to Airlock on the same task, document and reader output. Every action shows its arguments with their origin, what harm it does, and why the monitor allowed, asked or refused it. Approve a question to see it run.
- **Where the data went**: a flow graph from sources (your request, the email, your files) through extracted values to actions, coloured by label, with stopped flows dashed.
- **The prover**: 2,000 generated attacks per run (one to three techniques, mixed, hidden with tag characters, base64, comments or zero-width characters, a dozen attacker addresses and accounts including lookalikes, and arbitrary reader output). On every run it checks three guarantees:
  - **Nobody else decides**: no action ran on a value from untrusted text without your OK.
  - **Data stays with its readers**: no data reached anyone outside its readers.
  - **The plan is the plan**: the calls attempted, with their trusted arguments, are a prefix of the plan's calls. Untrusted text can make the plan stop early, never change it.
  It also counts how often the ordinary agent was harmed. Switch a rule off and it shows a counterexample you can load.
- **Defence in depth**: every single rule and every pair switched off, 300 attacks each, showing which guarantee breaks and whether real harm gets through.

Measured on these four tasks (seed 1, 2,000 attacks each): the ordinary agent was harmed in 1,939 to 1,989 runs per task; Airlock in 0, with all three guarantees holding. With *Ask first* off, the prover finds a changed amount paid to the real payee; with the planner not isolated, it finds extra steps (stopped by the other rules, but the plan changed).

## Threat model

- The attacker writes any untrusted text the agent reads and fully controls every model that reads it.
- Your request and the planner are trusted; the planner never sees untrusted text.
- Tools are honest and only reachable through the monitor, which is ordinary code outside every model.
- Your lists and file readers are correct; approvals are made by you, with the details in front of you.

## What it does not solve

Text can still lie to you (a summary with a phishing link, a believable fake invoice): Airlock stops text from acting for you, not from misleading you. Approvals only help if people read them. Tasks must be expressible as a fixed plan. An attacker can always make the plan stop early (denial of service, not a breach). The planner here is scripted, and the prover tests many attacks rather than proving all of them: the guarantees follow from the design, and the prover shows they hold and finds the hole when a rule is off. Side channels (which step failed, timing) are not modelled.

## Use

```ts
import { check, STRICT } from "@lythos-labs/airlock";

// args carry labels: where each value came from, who may read it
const verdict = check("send_email", args, world, STRICT);
if (verdict.status === "run") await tools.send_email(args);
else if (verdict.status === "ask") await askUser(verdict.reasons);
else log("blocked", verdict.reasons);
```

Also exported: `runAgent` (run a plan in either mode), `prove` and `depth` (the prover), `injectedCalls` and `reveal` (the worst-case model), `TECHNIQUES`, and `Airlock`, a React 19 client component with English and Dutch copy (`<Airlock locale="en" />`). No runtime dependencies besides React; no network requests; no inline style attributes.

The people, companies, addresses and IBANs in the scenarios are invented; the IBANs are valid in form only and use made-up bank codes.

## Develop

```bash
npm install
npm test
npm run typecheck
```

## License

[Mozilla Public License 2.0](LICENSE). The Lythos name and logo are not covered by this license.
