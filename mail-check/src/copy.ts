/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { CheckId } from "./checks";
import type { Level } from "./types";

/** Languages Mail check ships with. */
export type Locale = "en" | "nl";

type Messages = Record<string, (detail?: string) => string>;

const en = {
  title: "Mail check",
  description:
    "Type a domain and see how its email is set up: MX, SPF, DMARC, DKIM and more, with fixes in plain language. Runs in your browser.",
  eyebrow: "Prototype",
  heading: "Is your domain's email set up right?",
  intro:
    "Type a domain. Mail check reads its public DNS records and tells you what is fine, what could be better and what to add. Your browser asks a public DNS service directly; nothing goes to Lythos.",
  label: "Domain",
  placeholder: "example.com",
  selectorLabel: "DKIM selector (optional)",
  selectorHint: "If your mail provider uses its own selector, enter it here. We also try the common ones.",
  submit: "Check",
  running: "Checking...",
  invalid: "Enter a plain domain name such as example.com, without https:// or a path.",
  invalidSelector: "A selector may only contain letters, numbers, hyphens and underscores.",
  progress: (done: number, total: number) => `Check ${done} of ${total} done`,
  checking: "Checking now",
  waiting: "Waiting",
  summaryTitle: "Result",
  summary: (fail: number, warn: number, unknown: number) => {
    if (!fail && !warn && !unknown) return "Nothing to fix here. The checks we can make from outside all look in order.";
    const parts = [
      fail ? `${fail} to fix` : "",
      warn ? `${warn} to improve` : "",
      unknown ? `${unknown} could not be checked` : "",
    ].filter(Boolean);
    return parts.join(", ") + ".";
  },
  copyLink: "Copy link to this result",
  copied: "Copied",
  copyRecord: "Copy",
  addRecord: "Add this",
  recordHost: "Host",
  recordType: "TXT record",
  levels: { ok: "In order", warn: "Could be better", fail: "Needs fixing", info: "Not set", unknown: "Could not check" } as Record<Level, string>,
  names: {
    mx: "Receiving mail (MX)",
    spf: "Allowed senders (SPF)",
    dmarc: "Policy and reports (DMARC)",
    dkim: "Signatures (DKIM)",
    "mta-sts": "Encrypted delivery (MTA-STS)",
    "tls-rpt": "Encryption reports (TLS-RPT)",
    bimi: "Logo in mail apps (BIMI)",
  } as Record<CheckId, string>,
  messages: {
    "mx-ok": (d) => `Mail can be delivered to ${d} mail servers.`,
    "mx-null": () => "This domain says it accepts no mail (a null MX). That is right if it is only used for a website.",
    "mx-single": () => "Only one mail server is listed. That works, but there is no fallback while it is down.",
    "mx-fallback": () => "There is no MX record, but the domain has an address record, so some senders will try that. A clear MX record is better.",
    "mx-missing": () => "There is no MX record and no address record, so nobody can send mail to this domain.",
    "spf-ok": (d) => `One SPF record that ends strictly, using ${d} of the 10 allowed DNS lookups.`,
    "spf-missing": () => "No SPF record. Receivers cannot check which servers may send mail for this domain.",
    "spf-multiple": () => "More than one SPF record. Receivers treat that as an error, so SPF fails. Merge them into one record.",
    "spf-too-many-lookups": () => "The SPF record needs more than 10 DNS lookups. Receivers stop at 10 and treat SPF as broken. Remove services you no longer use.",
    "spf-no-all": () => "The SPF record has no ending. End it with ~all, or -all when you are sure about every sender.",
    "spf-open-all": () => "The SPF record ends in ?all, +all or a bare all, which lets any server pass. Use ~all or -all.",
    "spf-near-limit": (d) => `The SPF record uses ${d} of the 10 allowed DNS lookups. Adding one more service may break it.`,
    "dmarc-ok": (d) => `DMARC is set to ${d} and reports are requested.`,
    "dmarc-missing": () => "No DMARC record. Without it, receivers decide alone what to do with mail that fails the checks, and you get no reports.",
    "dmarc-multiple": () => "More than one DMARC record. Receivers ignore all of them. Keep one.",
    "dmarc-invalid": () => "The DMARC record has no valid policy. Use p=none, p=quarantine or p=reject.",
    "dmarc-monitoring-only": () => "DMARC only watches (p=none). That is a good start, but mail that fails is still delivered.",
    "dmarc-no-rua": (d) => `DMARC is set to ${d}, but there is no report address (rua), so you cannot see who sends mail as your domain.`,
    "dkim-ok": (d) => `DKIM keys found for: ${d}.`,
    "dkim-none-signed": () => "Every selector we tried has an empty key. The domain says it signs no mail, which is right for a domain that sends none.",
    "dkim-revoked": (d) => `The key for ${d} is empty, which means it was withdrawn. Mail signed with it fails.`,
    "dkim-none-found": () => "No DKIM key found under the common selectors. That does not mean DKIM is missing: your provider may use its own selector. Enter it above and check again.",
    "mta-sts-present": () => "An MTA-STS record exists, so senders can require encrypted delivery. The policy file itself is not checked here.",
    "mta-sts-missing": () => "No MTA-STS record. Senders may deliver without enforced encryption. This is optional and mostly useful for larger domains.",
    "tls-rpt-present": () => "A TLS-RPT record exists, so senders can report encryption problems.",
    "tls-rpt-missing": () => "No TLS-RPT record, so you get no reports about failed encrypted delivery. This is optional.",
    "bimi-present": () => "A BIMI record exists. Supporting mail apps can show your logo.",
    "bimi-missing": () => "No BIMI record. This is optional and only needed to show a logo in some mail apps.",
    "lookup-failed": (d) => `The lookup failed (${d}). That says nothing about your domain. Try again.`,
  } as Messages,
  notes: {
    "spf-missing": "A safe starting point, not a final answer: it allows the servers behind your mail provider and ends softly. Add an include: for every other service that sends mail for you. A domain that sends no mail at all uses v=spf1 -all.",
    "spf-no-all": "Add this ending to your SPF record, as the last part:",
    "mta-sts-missing": "Optional. Add this TXT record, then publish the policy file below at that address (it needs a web server for mta-sts.<your domain> with a valid certificate). It starts in testing mode, so nothing is refused yet.",
    "spf-open-all": "Replace the ending of your SPF record with:",
    "dmarc-missing": "Add this TXT record. Use a mailbox you read instead of dmarc@. Start with p=none and move to quarantine once the reports look right.",
    "dmarc-monitoring-only": "When the reports show that only your own mail passes, change p=none into:",
    "dmarc-no-rua": "Add this tag to your DMARC record, with a mailbox you read:",
    "tls-rpt-missing": "Optional. Add this TXT record, with a mailbox you read:",
  } as Record<string, string>,
  howTitle: "How it works",
  how: [
    "Your browser asks Cloudflare's public DNS-over-HTTPS service for the records of the domain you type. The domain goes from your browser to that service, not to Lythos, and we store nothing.",
    "Each answer is read as plain text and judged by fixed rules. SPF lookups are counted the way RFC 7208 does, up to its limit of 10.",
    "A shared link keeps the domain after the # sign, so it never reaches a server log. Opening such a link runs the check at once.",
  ],
  limitsTitle: "Limits",
  limits: [
    "We read public DNS only. No mail server is contacted, so this cannot tell whether mail is actually delivered.",
    "DKIM selectors are guessed from common ones. Finding a key proves it exists; finding none proves nothing.",
    "DNS caches can lag behind a change you just made by minutes or hours.",
    "This is a hint, not a legal, security or compliance opinion.",
  ],
};

export type MailCheckCopy = typeof en;

const nl: MailCheckCopy = {
  title: "Mail-check",
  description:
    "Typ een domein en zie hoe de mail is ingericht: MX, SPF, DMARC, DKIM en meer, met herstelstappen in gewone taal. Draait in je browser.",
  eyebrow: "Prototype",
  heading: "Staat de mail van je domein goed ingesteld?",
  intro:
    "Typ een domein. Mail-check leest de openbare DNS-records en vertelt wat goed is, wat beter kan en wat je moet toevoegen. Je browser vraagt het rechtstreeks aan een openbare DNS-dienst; er gaat niets naar Lythos.",
  label: "Domein",
  placeholder: "voorbeeld.nl",
  selectorLabel: "DKIM-selector (optioneel)",
  selectorHint: "Gebruikt je mailprovider een eigen selector, vul die hier in. We proberen ook de gangbare.",
  submit: "Controleer",
  running: "Bezig met controleren...",
  invalid: "Vul een gewone domeinnaam in, zoals voorbeeld.nl, zonder https:// of pad.",
  invalidSelector: "Een selector mag alleen letters, cijfers, streepjes en underscores bevatten.",
  progress: (done, total) => `Controle ${done} van ${total} klaar`,
  checking: "Wordt nu gecontroleerd",
  waiting: "Wacht",
  summaryTitle: "Uitkomst",
  summary: (fail, warn, unknown) => {
    if (!fail && !warn && !unknown) return "Hier valt niets te herstellen. De controles die we van buitenaf kunnen doen, zien er in orde uit.";
    const parts = [
      fail ? `${fail} te herstellen` : "",
      warn ? `${warn} te verbeteren` : "",
      unknown ? `${unknown} niet te controleren` : "",
    ].filter(Boolean);
    return parts.join(", ") + ".";
  },
  copyLink: "Kopieer link naar deze uitkomst",
  copied: "Gekopieerd",
  copyRecord: "Kopieer",
  addRecord: "Voeg dit toe",
  recordHost: "Host",
  recordType: "TXT-record",
  levels: { ok: "In orde", warn: "Kan beter", fail: "Moet hersteld", info: "Niet ingesteld", unknown: "Niet te controleren" },
  names: {
    mx: "Mail ontvangen (MX)",
    spf: "Toegestane afzenders (SPF)",
    dmarc: "Beleid en rapporten (DMARC)",
    dkim: "Handtekeningen (DKIM)",
    "mta-sts": "Versleutelde bezorging (MTA-STS)",
    "tls-rpt": "Versleutelingsrapporten (TLS-RPT)",
    bimi: "Logo in mailapps (BIMI)",
  },
  messages: {
    "mx-ok": (d) => `Mail kan bezorgd worden bij ${d} mailservers.`,
    "mx-null": () => "Dit domein geeft aan geen mail te accepteren (een null-MX). Dat klopt als het alleen voor een website dient.",
    "mx-single": () => "Er staat één mailserver in. Dat werkt, maar er is geen terugval als die uitvalt.",
    "mx-fallback": () => "Er is geen MX-record, maar wel een adresrecord, dus sommige afzenders proberen dat. Een duidelijk MX-record is beter.",
    "mx-missing": () => "Er is geen MX-record en geen adresrecord, dus niemand kan mail naar dit domein sturen.",
    "spf-ok": (d) => `Eén SPF-record met een strikt einde, met ${d} van de 10 toegestane DNS-opzoekingen.`,
    "spf-missing": () => "Geen SPF-record. Ontvangers kunnen niet nagaan welke servers voor dit domein mogen mailen.",
    "spf-multiple": () => "Meer dan één SPF-record. Ontvangers zien dat als een fout, dus SPF faalt. Voeg ze samen tot één record.",
    "spf-too-many-lookups": () => "Het SPF-record heeft meer dan 10 DNS-opzoekingen nodig. Ontvangers stoppen bij 10 en beschouwen SPF als kapot. Haal diensten weg die je niet meer gebruikt.",
    "spf-no-all": () => "Het SPF-record heeft geen einde. Sluit af met ~all, of -all als je alle afzenders zeker kent.",
    "spf-open-all": () => "Het SPF-record eindigt op ?all, +all of een kale all, waardoor elke server slaagt. Gebruik ~all of -all.",
    "spf-near-limit": (d) => `Het SPF-record gebruikt ${d} van de 10 toegestane DNS-opzoekingen. Nog één dienst erbij kan het breken.`,
    "dmarc-ok": (d) => `DMARC staat op ${d} en rapporten zijn aangevraagd.`,
    "dmarc-missing": () => "Geen DMARC-record. Zonder beslissen ontvangers zelf wat ze met mail doen die de controles niet haalt, en krijg je geen rapporten.",
    "dmarc-multiple": () => "Meer dan één DMARC-record. Ontvangers negeren ze allemaal. Houd er één over.",
    "dmarc-invalid": () => "Het DMARC-record heeft geen geldig beleid. Gebruik p=none, p=quarantine of p=reject.",
    "dmarc-monitoring-only": () => "DMARC kijkt alleen mee (p=none). Dat is een goed begin, maar mail die faalt wordt nog steeds bezorgd.",
    "dmarc-no-rua": (d) => `DMARC staat op ${d}, maar er is geen rapportadres (rua), dus je ziet niet wie mail namens je domein verstuurt.`,
    "dkim-ok": (d) => `DKIM-sleutels gevonden voor: ${d}.`,
    "dkim-none-signed": () => "Elke geprobeerde selector heeft een lege sleutel. Het domein geeft aan geen mail te ondertekenen, wat klopt voor een domein dat niet mailt.",
    "dkim-revoked": (d) => `De sleutel voor ${d} is leeg, dus ingetrokken. Mail die ermee is ondertekend faalt.`,
    "dkim-none-found": () => "Geen DKIM-sleutel gevonden onder de gangbare selectors. Dat betekent niet dat DKIM ontbreekt: je provider kan een eigen selector gebruiken. Vul die hierboven in en controleer opnieuw.",
    "mta-sts-present": () => "Er is een MTA-STS-record, dus afzenders kunnen versleutelde bezorging eisen. Het beleidsbestand zelf controleren we hier niet.",
    "mta-sts-missing": () => "Geen MTA-STS-record. Afzenders kunnen bezorgen zonder afgedwongen versleuteling. Optioneel en vooral nuttig voor grotere domeinen.",
    "tls-rpt-present": () => "Er is een TLS-RPT-record, dus afzenders kunnen problemen met versleuteling melden.",
    "tls-rpt-missing": () => "Geen TLS-RPT-record, dus je krijgt geen rapporten over mislukte versleutelde bezorging. Optioneel.",
    "bimi-present": () => "Er is een BIMI-record. Ondersteunende mailapps kunnen je logo tonen.",
    "bimi-missing": () => "Geen BIMI-record. Optioneel en alleen nodig om een logo in sommige mailapps te tonen.",
    "lookup-failed": (d) => `De opzoeking mislukte (${d}). Dat zegt niets over je domein. Probeer het opnieuw.`,
  },
  notes: {
    "spf-missing": "Een veilig beginpunt, geen eindoplossing: het staat de servers achter je mailprovider toe en eindigt zacht. Voeg een include: toe voor elke andere dienst die mail voor je verstuurt. Een domein dat helemaal geen mail verstuurt gebruikt v=spf1 -all.",
    "spf-no-all": "Voeg deze afsluiting toe aan je SPF-record, als laatste onderdeel:",
    "mta-sts-missing": "Optioneel. Voeg dit TXT-record toe en publiceer daarna het beleidsbestand hieronder op dat adres (daarvoor is een webserver voor mta-sts.<je domein> met een geldig certificaat nodig). Het begint in testmodus, dus er wordt nog niets geweigerd.",
    "spf-open-all": "Vervang het einde van je SPF-record door:",
    "dmarc-missing": "Voeg dit TXT-record toe. Gebruik een mailbox die je leest in plaats van dmarc@. Begin met p=none en zet het op quarantine als de rapporten er goed uitzien.",
    "dmarc-monitoring-only": "Als de rapporten laten zien dat alleen je eigen mail slaagt, verander p=none in:",
    "dmarc-no-rua": "Voeg deze tag toe aan je DMARC-record, met een mailbox die je leest:",
    "tls-rpt-missing": "Optioneel. Voeg dit TXT-record toe, met een mailbox die je leest:",
  },
  howTitle: "Hoe het werkt",
  how: [
    "Je browser vraagt de records van het domein dat je typt aan de openbare DNS-over-HTTPS-dienst van Cloudflare. Het domein gaat van je browser naar die dienst, niet naar Lythos, en wij bewaren niets.",
    "Elk antwoord wordt als gewone tekst gelezen en met vaste regels beoordeeld. SPF-opzoekingen tellen we zoals RFC 7208 voorschrijft, tot de grens van 10.",
    "Een gedeelde link houdt het domein achter het #-teken, dus het komt nooit in een serverlog. Open je zo'n link, dan start de controle meteen.",
  ],
  limitsTitle: "Beperkingen",
  limits: [
    "We lezen alleen openbare DNS. Er wordt geen mailserver benaderd, dus we kunnen niet zeggen of mail echt aankomt.",
    "DKIM-selectors raden we uit gangbare namen. Een gevonden sleutel bewijst dat hij bestaat; geen sleutel bewijst niets.",
    "DNS-caches kunnen minuten tot uren achterlopen op een wijziging die je net deed.",
    "Dit is een aanwijzing, geen juridisch, beveiligings- of nalevingsoordeel.",
  ],
};

export const mailCheckCopy: Record<Locale, MailCheckCopy> = { en, nl };
