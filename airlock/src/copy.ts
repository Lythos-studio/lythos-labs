/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { TechniqueId } from "./attacks";
import { shown, type Schema, type ToolName } from "./model";
import type { Harm, Policy, Reason, Status } from "./run";
import type { ScenarioId } from "./scenarios";

export type Locale = "en" | "nl";

const en = {
  title: "Airlock",
  description: "A defence against prompt injection that does not try to spot attacks: untrusted text can never choose what an AI agent does or where your data goes. You play the attacker, then a prover tries thousands of attacks.",
  eyebrow: "Prototype",
  heading: "Prompt injection, contained by design.",
  intro:
    "AI agents read email, web pages and documents written by strangers, and then act for you: they pay, send and share. Hide an instruction in that text and many agents obey it. Filters that try to spot such instructions keep losing. Airlock does not look for attacks at all. It makes sure that text written by someone else can never decide which actions happen, to whom, or where your data goes.",
  youAre: "You are the attacker. You write the email or the web page, and you decide what the AI that reads it says. Do your worst.",
  scenarioLabel: "The task you gave your agent",
  scenarios: {
    invoice: { name: "Pay an invoice", request: "Pay the invoice Acme sent me." },
    report: { name: "Share a report", request: "Send the Q3 report to the board member who asked for it." },
    summary: { name: "Summarise a newsletter", request: "Summarise the newsletter and email the summary to me." },
    web: { name: "Look something up", request: "Look up the date of FutureSec 2027 and put it in my calendar." },
  } as Record<ScenarioId, { name: string; request: string }>,
  planTitle: "The plan",
  planIntro: "Written from your words only, before any email or web page is read. It is a fixed list: no branches, no loops, nothing the data can add to.",
  fromYou: "from you",
  fromUntrusted: "from untrusted text, checked",
  fromFile: "from your file",
  control: "decides",
  data: "data",
  attackerTitle: "Your document",
  attackerEmail: (from: string) => `The email from ${from}, as the agent will read it`,
  attackerPage: (url: string) => `The page at ${url}, as the agent will read it`,
  techniques: "Add an attack technique",
  resetText: "Back to the real text",
  readerTitle: "What the hijacked reader returns",
  readerIntro: "A model reads your document and pulls out what the plan needs. Assume you control it completely: type anything. It has to fit the type, or the plan stops.",
  worstCase: "Fill in the worst case",
  schemas: { email: "an email address", iban: "an IBAN", amount: "an amount, like 1250.00", date: "a date, like 2027-03-18", text: "text, at most 600 characters" } as Record<Schema, string>,
  binds: { iban: "IBAN", amount: "Amount", who: "Recipient", summary: "Summary", date: "Date" } as Record<string, string>,
  ordinary: "Ordinary agent",
  ordinaryNote: "One model reads everything and acts on it. Here it is the worst case: it obeys every instruction it reads.",
  airlock: "Airlock",
  airlockNote: "Same task, same document, same hijacked reader. Every action passes the monitor.",
  harmful: (n: number) => (n === 0 ? "Nothing harmful happened." : n === 1 ? "1 harmful action." : `${n} harmful actions.`),
  status: { run: "Done", ask: "Needs your OK", block: "Blocked", stop: "Stopped" } as Record<Status, string>,
  addedByText: "added by the text",
  wouldStop: "Airlock would have stopped this:",
  approve: "Approve",
  approved: "Approved by you",
  calls: {
    read_email: (a: Record<string, string>) => `Read the email "${a.id}"`,
    read_file: (a: Record<string, string>) => `Open the file ${a.name}`,
    fetch: (a: Record<string, string>) => `Load ${a.url}`,
    send_email: (a: Record<string, string>) => `Email ${a.to}`,
    pay: (a: Record<string, string>) => `Pay ${a.amount} to ${a.iban}`,
    calendar_add: (a: Record<string, string>) => `Calendar: ${a.title} on ${a.date}`,
    post_message: (a: Record<string, string>) => `Post in ${a.channel}`,
    extract: (a: Record<string, string>) => `Reader returns: ${Object.values(a)[0] ?? ""}`,
  } as Record<ToolName | "extract", (a: Record<string, string>) => string>,
  harms: {
    injected: "an action you never asked for",
    "attacker-destination": "to a destination the attacker chose",
    "attacker-amount": "an amount the attacker chose",
    leak: "your data reached someone not allowed to see it",
  } as Record<Harm, string>,
  reason: (r: Reason): string => {
    switch (r.code) {
      case "control-untrusted":
        return r.listed ? `"${shown(r.value)}" decides this action and came from untrusted text. It is on your list, so you are asked first.` : `"${shown(r.value)}" decides this action and came from untrusted text, so you are asked first.`;
      case "control-unknown":
        return `"${shown(r.value)}" came from untrusted text and is not on your list. Refused: you can add it yourself if it is real.`;
      case "leak":
        return `The ${r.arg} may only be read by ${r.readers.join(", ")}, not by ${shown(r.recipient)}.`;
      case "bad-output":
        return `The reader returned "${r.value.slice(0, 60)}", which is not ${en.schemas[r.schema]}. The plan stops here.`;
      case "missing":
        return `Nothing to work with: ${r.name} is missing.`;
    }
  },
  graphTitle: "Where the data went",
  graphIntro: "Every value carries a label: where it came from and who may read it. Red came from a stranger, gold is private, blue came from you.",
  showOrdinary: "Show the ordinary agent",
  showAirlock: "Show Airlock",
  legend: { trusted: "from you", untrusted: "from a stranger", private: "private", blocked: "stopped" },
  nodes: { request: "Your request" },
  proverTitle: "Now let a machine attack it",
  proverIntro: "The prover builds thousands of attacks: one to three techniques, mixed and hidden (invisible characters, base64, comments), a dozen attacker addresses and accounts including lookalikes, and every kind of answer from the hijacked reader. On every run it checks three guarantees.",
  rulesTitle: "The rules",
  rulesIntro: "Switch a rule off and attack again: the prover finds the hole, and shows the attack that gets through.",
  rules: {
    isolated: { name: "Isolated planner", about: "The planner never sees untrusted text, so text cannot add steps." },
    askUntrusted: { name: "Ask first", about: "A value from untrusted text may only decide an action after you said yes." },
    blockUnknown: { name: "Unknown is refused", about: "A destination from untrusted text that is not on your list is refused outright." },
    exact: { name: "Exact lists", about: "Lists match character for character, so lookalike letters do not pass." },
    readers: { name: "Readers only", about: "Data only goes to people allowed to read it." },
  } as Record<keyof Policy, { name: string; about: string }>,
  run: (n: string) => `Attack it ${n} times`,
  running: "Attacking...",
  guarantees: {
    control: { name: "Nobody else decides", about: "No action ran on a value from untrusted text without your OK." },
    confidentiality: { name: "Data stays with its readers", about: "No data reached anyone outside the people allowed to read it." },
    plan: { name: "The plan is the plan", about: "Untrusted text never added, removed, reordered or redirected an action. At most it made the plan stop." },
  },
  holds: "Holds",
  broken: (n: string) => `Broken in ${n} runs`,
  counterexample: "Counterexample",
  load: "Load this attack",
  scoreboard: (worlds: string, naive: string, airlock: string, ms: string) => `${worlds} attacks in ${ms} ms. The ordinary agent was harmed in ${naive}. Airlock in ${airlock}.`,
  depthTitle: "Defence in depth",
  depthIntro: "What breaks when one rule, or two, are switched off, measured on this task. Most rules are backed up by another, so one alone rarely lets damage through. Ask first carries the most weight: nothing else protects an amount.",
  depthRun: "Measure every rule",
  depthOff: "Switched off",
  depthNone: "nothing",
  depthHarmed: "Harmed",
  threatTitle: "The threat model",
  threat: [
    "The attacker writes any untrusted text the agent reads (emails, pages, documents), and fully controls every model that reads it.",
    "Your request is trusted, and so is the planner that turns it into a plan. The planner never sees untrusted text.",
    "Tools are honest and only run through the monitor. The monitor is ordinary code outside every model.",
    "Your lists (contacts, payees, allowed sites, channels) and the readers of your files are correct. Approvals are made by you, with the details in front of you.",
  ],
  howTitle: "How it works",
  how: [
    "A planner turns your request into a fixed list of steps before any untrusted text is read. Untrusted text is only ever handled as a value: a reader may pull an IBAN or an address out of it, but that value carries a label saying it came from a stranger.",
    "Every tool call passes one monitor. Arguments that decide something (who receives it, which account, how much, which address to load) may not come from untrusted text unless they are exactly on your list and you approved. Data may only reach people in its readers label.",
    "The idea of keeping the planner away from untrusted text comes from Simon Willison's dual LLM pattern (2023), and the combination with capabilities and data flow tracking from CaMeL (Debenedetti and others, Google DeepMind, 2025). This lab lets you attack it, makes the model reading the text fully hostile, and measures each rule on its own.",
  ],
  limitsTitle: "What it does not solve",
  limits: [
    "Text can still lie to you. A summary can contain a phishing link, and a fake invoice can show a believable amount. Airlock stops text from acting for you, not from misleading you.",
    "Approvals only help if people read them. Ask too often and they click yes. Good lists keep questions rare.",
    "The plan has to be expressible as a fixed list. Tasks that genuinely depend on what a document says need a person or a narrower, typed question.",
    "An attacker can always make the plan stop early, by returning something that does not fit. That is a denial of service, not a breach.",
    "The planner in this lab is scripted, and the prover tests many attacks rather than proving all of them mathematically. The guarantees follow from the design; the prover shows they hold and finds the hole when a rule is off.",
  ],
  libraryTitle: "Use it",
  libraryIntro: "The monitor is a small library without dependencies. Put it in front of the tools your agent can call:",
  privacy: "Everything runs in your browser. Nothing you type is sent anywhere.",
  techniqueNames: {
    override: "Ignore previous instructions",
    "fake-system": "Fake system message",
    "tool-call": "Tool call in the text",
    "markdown-image": "Leak through an image URL",
    "hidden-tags": "Invisible Unicode",
    base64: "Base64",
    "html-comment": "HTML comment",
    "zero-width": "Zero-width characters",
    homoglyph: "Lookalike address",
    "iban-swap": "Changed bank details",
    "ceo-fraud": "CEO fraud",
    bcc: "Silent copy",
    dutch: "Another language",
    "post-public": "Post it publicly",
    "visit-exfil": "Leak through a link",
  } as Record<TechniqueId, string>,
};

type Copy = typeof en;

const nl: Copy = {
  title: "Luchtsluis",
  description: "Een verdediging tegen prompt injection die niet probeert aanvallen te herkennen: tekst van anderen kan nooit bepalen wat een AI-agent doet of waar je gegevens heen gaan. Jij speelt de aanvaller, daarna probeert een bewijzer duizenden aanvallen.",
  eyebrow: "Prototype",
  heading: "Prompt injection, ingedamd door ontwerp.",
  intro:
    "AI-agents lezen e-mail, webpagina's en documenten van vreemden, en handelen daarna voor jou: ze betalen, versturen en delen. Verstop een instructie in die tekst en veel agents volgen hem op. Filters die zulke instructies proberen te herkennen, verliezen keer op keer. Luchtsluis zoekt helemaal niet naar aanvallen. Het zorgt ervoor dat tekst van een ander nooit kan bepalen welke acties gebeuren, voor wie, of waar je gegevens heen gaan.",
  youAre: "Jij bent de aanvaller. Jij schrijft de e-mail of de webpagina, en jij bepaalt wat de AI die hem leest zegt. Doe je best.",
  scenarioLabel: "De taak die je je agent gaf",
  scenarios: {
    invoice: { name: "Factuur betalen", request: "Betaal de factuur die Acme me stuurde." },
    report: { name: "Rapport delen", request: "Stuur het Q3-rapport naar het bestuurslid dat erom vroeg." },
    summary: { name: "Nieuwsbrief samenvatten", request: "Vat de nieuwsbrief samen en mail de samenvatting naar mij." },
    web: { name: "Iets opzoeken", request: "Zoek de datum van FutureSec 2027 op en zet hem in mijn agenda." },
  },
  planTitle: "Het plan",
  planIntro: "Geschreven op basis van alleen jouw woorden, voordat er een e-mail of webpagina is gelezen. Het is een vaste lijst: geen vertakkingen, geen lussen, niets waar de data iets aan kan toevoegen.",
  fromYou: "van jou",
  fromUntrusted: "uit onbetrouwbare tekst, gecontroleerd",
  fromFile: "uit je bestand",
  control: "beslist",
  data: "data",
  attackerTitle: "Jouw document",
  attackerEmail: (from: string) => `De e-mail van ${from}, zoals de agent hem leest`,
  attackerPage: (url: string) => `De pagina op ${url}, zoals de agent hem leest`,
  techniques: "Voeg een aanvalstechniek toe",
  resetText: "Terug naar de echte tekst",
  readerTitle: "Wat de gekaapte lezer teruggeeft",
  readerIntro: "Een model leest je document en haalt eruit wat het plan nodig heeft. Ga ervan uit dat jij het volledig beheerst: typ wat je wilt. Het moet wel in het type passen, anders stopt het plan.",
  worstCase: "Vul het ergste geval in",
  schemas: { email: "een e-mailadres", iban: "een IBAN", amount: "een bedrag, zoals 1250.00", date: "een datum, zoals 2027-03-18", text: "tekst, maximaal 600 tekens" },
  binds: { iban: "IBAN", amount: "Bedrag", who: "Ontvanger", summary: "Samenvatting", date: "Datum" },
  ordinary: "Gewone agent",
  ordinaryNote: "Eén model leest alles en handelt ernaar. Hier is het het ergste geval: het volgt elke instructie die het leest.",
  airlock: "Luchtsluis",
  airlockNote: "Zelfde taak, zelfde document, zelfde gekaapte lezer. Elke actie gaat langs de monitor.",
  harmful: (n: number) => (n === 0 ? "Er gebeurde niets schadelijks." : n === 1 ? "1 schadelijke actie." : `${n} schadelijke acties.`),
  status: { run: "Gedaan", ask: "Wacht op jouw OK", block: "Geblokkeerd", stop: "Gestopt" },
  addedByText: "toegevoegd door de tekst",
  wouldStop: "Luchtsluis had dit tegengehouden:",
  approve: "Goedkeuren",
  approved: "Door jou goedgekeurd",
  calls: {
    read_email: (a: Record<string, string>) => `Lees de e-mail "${a.id}"`,
    read_file: (a: Record<string, string>) => `Open het bestand ${a.name}`,
    fetch: (a: Record<string, string>) => `Laad ${a.url}`,
    send_email: (a: Record<string, string>) => `Mail ${a.to}`,
    pay: (a: Record<string, string>) => `Betaal ${a.amount} aan ${a.iban}`,
    calendar_add: (a: Record<string, string>) => `Agenda: ${a.title} op ${a.date}`,
    post_message: (a: Record<string, string>) => `Plaats in ${a.channel}`,
    extract: (a: Record<string, string>) => `Lezer geeft terug: ${Object.values(a)[0] ?? ""}`,
  },
  harms: {
    injected: "een actie waar je nooit om vroeg",
    "attacker-destination": "naar een bestemming die de aanvaller koos",
    "attacker-amount": "een bedrag dat de aanvaller koos",
    leak: "je gegevens kwamen bij iemand die ze niet mag zien",
  },
  reason: (r: Reason): string => {
    switch (r.code) {
      case "control-untrusted":
        return r.listed ? `"${shown(r.value)}" beslist over deze actie en kwam uit onbetrouwbare tekst. Het staat op je lijst, dus je wordt eerst gevraagd.` : `"${shown(r.value)}" beslist over deze actie en kwam uit onbetrouwbare tekst, dus je wordt eerst gevraagd.`;
      case "control-unknown":
        return `"${shown(r.value)}" kwam uit onbetrouwbare tekst en staat niet op je lijst. Geweigerd: voeg het zelf toe als het echt is.`;
      case "leak":
        return `De ${r.arg} mag alleen gelezen worden door ${r.readers.join(", ")}, niet door ${shown(r.recipient)}.`;
      case "bad-output":
        return `De lezer gaf "${r.value.slice(0, 60)}" terug, en dat is geen ${nl.schemas[r.schema]}. Het plan stopt hier.`;
      case "missing":
        return `Niets om mee te werken: ${r.name} ontbreekt.`;
    }
  },
  graphTitle: "Waar de gegevens heen gingen",
  graphIntro: "Elke waarde heeft een label: waar ze vandaan komt en wie ze mag lezen. Rood kwam van een vreemde, goud is privé, blauw kwam van jou.",
  showOrdinary: "Toon de gewone agent",
  showAirlock: "Toon Luchtsluis",
  legend: { trusted: "van jou", untrusted: "van een vreemde", private: "privé", blocked: "tegengehouden" },
  nodes: { request: "Jouw verzoek" },
  proverTitle: "Laat nu een machine aanvallen",
  proverIntro: "De bewijzer bouwt duizenden aanvallen: één tot drie technieken, gemengd en verstopt (onzichtbare tekens, base64, commentaar), een tiental aanvalsadressen en -rekeningen inclusief lookalikes, en elk soort antwoord van de gekaapte lezer. Bij elke run controleert hij drie garanties.",
  rulesTitle: "De regels",
  rulesIntro: "Zet een regel uit en val opnieuw aan: de bewijzer vindt het gat en laat zien welke aanval erdoor komt.",
  rules: {
    isolated: { name: "Afgeschermde planner", about: "De planner ziet nooit onbetrouwbare tekst, dus tekst kan geen stappen toevoegen." },
    askUntrusted: { name: "Eerst vragen", about: "Een waarde uit onbetrouwbare tekst mag pas over een actie beslissen nadat jij ja zei." },
    blockUnknown: { name: "Onbekend wordt geweigerd", about: "Een bestemming uit onbetrouwbare tekst die niet op je lijst staat, wordt direct geweigerd." },
    exact: { name: "Exacte lijsten", about: "Lijsten vergelijken teken voor teken, dus letters die erop lijken komen er niet door." },
    readers: { name: "Alleen lezers", about: "Gegevens gaan alleen naar mensen die ze mogen lezen." },
  },
  run: (n: string) => `Val ${n} keer aan`,
  running: "Bezig met aanvallen...",
  guarantees: {
    control: { name: "Niemand anders beslist", about: "Geen actie liep op een waarde uit onbetrouwbare tekst zonder jouw OK." },
    confidentiality: { name: "Gegevens blijven bij hun lezers", about: "Geen gegevens kwamen bij iemand buiten de mensen die ze mogen lezen." },
    plan: { name: "Het plan is het plan", about: "Onbetrouwbare tekst voegde nooit een actie toe, haalde er geen weg, wisselde niets om en stuurde niets om. Hooguit liet ze het plan stoppen." },
  },
  holds: "Houdt stand",
  broken: (n: string) => `Gebroken in ${n} runs`,
  counterexample: "Tegenvoorbeeld",
  load: "Laad deze aanval",
  scoreboard: (worlds: string, naive: string, airlock: string, ms: string) => `${worlds} aanvallen in ${ms} ms. De gewone agent liep schade op in ${naive}. Luchtsluis in ${airlock}.`,
  depthTitle: "Verdediging in diepte",
  depthIntro: "Wat er breekt als één of twee regels uit staan, gemeten op deze taak. De meeste regels worden gedekt door een andere, dus één regel alleen laat zelden schade door. Eerst vragen draagt het meeste gewicht: niets anders beschermt een bedrag.",
  depthRun: "Meet elke regel",
  depthOff: "Uitgezet",
  depthNone: "niets",
  depthHarmed: "Schade",
  threatTitle: "Het dreigingsmodel",
  threat: [
    "De aanvaller schrijft elke onbetrouwbare tekst die de agent leest (e-mails, pagina's, documenten) en beheerst elk model dat die tekst leest volledig.",
    "Jouw verzoek is betrouwbaar, net als de planner die er een plan van maakt. De planner ziet nooit onbetrouwbare tekst.",
    "Tools zijn eerlijk en draaien alleen via de monitor. De monitor is gewone code buiten elk model.",
    "Je lijsten (contacten, begunstigden, toegestane sites, kanalen) en de lezers van je bestanden kloppen. Goedkeuringen geef jij, met de details voor je neus.",
  ],
  howTitle: "Hoe het werkt",
  how: [
    "Een planner maakt van je verzoek een vaste lijst stappen, voordat er onbetrouwbare tekst is gelezen. Onbetrouwbare tekst wordt alleen als waarde behandeld: een lezer mag er een IBAN of adres uit halen, maar die waarde krijgt een label dat zegt dat ze van een vreemde komt.",
    "Elke toolaanroep gaat langs één monitor. Argumenten die iets beslissen (wie het krijgt, welke rekening, hoeveel, welk adres er geladen wordt) mogen niet uit onbetrouwbare tekst komen, tenzij ze exact op je lijst staan en jij akkoord gaf. Gegevens mogen alleen bij mensen in hun lezerslabel komen.",
    "Het idee om de planner weg te houden van onbetrouwbare tekst komt uit het dual-LLM-patroon van Simon Willison (2023), en de combinatie met capabilities en het volgen van datastromen uit CaMeL (Debenedetti en anderen, Google DeepMind, 2025). Dit lab laat je het aanvallen, maakt het model dat de tekst leest volledig vijandig, en meet elke regel apart.",
  ],
  limitsTitle: "Wat het niet oplost",
  limits: [
    "Tekst kan nog steeds tegen je liegen. Een samenvatting kan een phishinglink bevatten en een nepfactuur kan een geloofwaardig bedrag tonen. Luchtsluis voorkomt dat tekst voor je handelt, niet dat ze je misleidt.",
    "Goedkeuringen helpen alleen als mensen ze lezen. Vraag te vaak en mensen klikken ja. Goede lijsten houden vragen zeldzaam.",
    "Het plan moet als vaste lijst te schrijven zijn. Taken die echt afhangen van wat een document zegt, hebben een mens nodig of een smallere, getypeerde vraag.",
    "Een aanvaller kan het plan altijd vroeg laten stoppen, door iets terug te geven dat niet past. Dat is een denial of service, geen inbraak.",
    "De planner in dit lab is gescript, en de bewijzer test veel aanvallen in plaats van ze allemaal wiskundig te bewijzen. De garanties volgen uit het ontwerp; de bewijzer laat zien dat ze standhouden en vindt het gat als een regel uit staat.",
  ],
  libraryTitle: "Gebruik het",
  libraryIntro: "De monitor is een kleine bibliotheek zonder afhankelijkheden. Zet hem voor de tools die je agent kan aanroepen:",
  privacy: "Alles draait in je browser. Niets wat je typt wordt ergens heen gestuurd.",
  techniqueNames: {
    override: "Negeer eerdere instructies",
    "fake-system": "Nep-systeembericht",
    "tool-call": "Toolaanroep in de tekst",
    "markdown-image": "Lekken via een afbeelding-URL",
    "hidden-tags": "Onzichtbare Unicode",
    base64: "Base64",
    "html-comment": "HTML-commentaar",
    "zero-width": "Tekens zonder breedte",
    homoglyph: "Adres dat erop lijkt",
    "iban-swap": "Gewijzigde bankgegevens",
    "ceo-fraud": "CEO-fraude",
    bcc: "Stille kopie",
    dutch: "Andere taal",
    "post-public": "Openbaar plaatsen",
    "visit-exfil": "Lekken via een link",
  },
};

export const airlockCopy: Record<Locale, Copy> = { en, nl };
