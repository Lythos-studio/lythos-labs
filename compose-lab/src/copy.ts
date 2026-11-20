/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { ParseError } from "./model";
import type { Group, Level, RuleId } from "./rules";

/** Languages Compose lab ships with. */
export type Locale = "en" | "nl";

type Ctx = { services: string; detail: string };
type RuleText = { title: string; what: (c: Ctx) => string; why: string; fine: string };

const en = {
  title: "Compose lab",
  description:
    "Paste a docker-compose.yml and see the stack as a living diagram, with explained rules for security, reliability and structure. Runs in your browser.",
  eyebrow: "Prototype",
  heading: "Paste a compose file. See the stack.",
  intro:
    "Paste a docker-compose.yml, or drop the file. Compose lab draws the services and what they depend on, shows what is open to the outside, and explains what a careful reviewer would raise. Nothing is sent anywhere: the file is read in your browser and forgotten when you close the page.",
  inputLabel: "docker-compose.yml",
  placeholder: "services:\n  web:\n    image: nginx:1.27\n    ports:\n      - \"80:80\"",
  tryExample: "Try an example",
  examples: { tidy: "A tidy stack", messy: "A messy stack" } as Record<string, string>,
  clear: "Clear",
  dropHint: "Or drop a file here",
  errors: {
    empty: () => "",
    "too-large": () => "This file is larger than 256 kB. Paste only the services you want to look at.",
    "too-many-services": () => "More than 200 services. Paste a smaller file.",
    "too-many-files": () => "More than 10 files separated by ---. Paste fewer.",
    "yaml-error": (e: ParseError) => `This is not valid YAML${e.line ? ` (line ${e.line})` : ""}${e.detail ? `, ${e.detail}` : ""}. Check the indentation and the quotes.`,
    "alias-limit": () => "This file uses too many YAML aliases to be read safely.",
    "not-a-mapping": () => "A compose file is a YAML mapping with a services: section. This looks like a list or a single value.",
    "no-services": () => "No services found. A compose file needs a services: section with at least one service.",
    "parse-failed": () => "This file could not be read. Try a smaller piece of it.",
  } as Record<ParseError["code"], (e: ParseError) => string>,
  diagramTitle: "The stack",
  diagramHint: "Drag a card to move it. Select a card to see only its findings.",
  diagramAlt: "Diagram of the services, what they depend on and which ports are open to the outside. The same information is in the service list below.",
  internet: "Internet",
  noDiagram: "The diagram needs a wider screen. The service list below has the same information.",
  export: "Export",
  exportSvg: "Download SVG",
  exportPng: "Download PNG",
  exportNote: "Exports show names, images and ports, never environment values.",
  summaryTitle: "Findings",
  summary: (fail: number, warn: number, info: number) => {
    if (!fail && !warn && !info) return "Nothing to raise. Every rule we check came out fine.";
    const parts = [fail ? `${fail} to fix` : "", warn ? `${warn} to look at` : "", info ? `${info} hint${info === 1 ? "" : "s"}` : ""].filter(Boolean);
    return parts.join(", ") + ".";
  },
  levels: { fail: "Fix", warn: "Look at", info: "Hint", ok: "In order" } as Record<Level | "ok", string>,
  groups: { security: "Security", reliability: "Reliability", structure: "Structure" } as Record<Group, string>,
  showing: (name: string) => `Showing findings for ${name}`,
  showAll: "Show all",
  why: "Why it matters",
  fine: "When this is fine",
  fix: "A way to fix it",
  copy: "Copy",
  copied: "Copied",
  listTitle: "Service list",
  columns: { service: "Service", image: "Image", ports: "Ports", depends: "Depends on", networks: "Networks", volumes: "Volumes", env: "Environment", findings: "Findings" },
  none: "none",
  showValues: "Show environment values",
  valuesWarning: "Values may contain secrets. They are shown only in this list, never in the diagram or the exports.",
  keysOnly: "Only the names of the variables are shown.",
  howTitle: "How it works",
  how: [
    "The file is read in your browser with a standard YAML parser. Nothing is uploaded, stored or put in the address bar, so there is no share link: a link with a compose file in it could share secrets.",
    "Each rule is a fixed check on the parsed file. A rule says what it found, why it can matter and when it is fine. It is an opinion with reasons, not a verdict.",
    "The diagram puts what nobody depends on on the left and its dependencies to the right. Exports and the diagram never contain environment values.",
  ],
  limitsTitle: "Limits",
  limits: [
    "Nothing is run and no image is inspected, so we cannot know whether a container runs as root or what a healthcheck really tests.",
    "Variables such as ${VAR} are not filled in, and .env files, include, extends and several -f files are not merged.",
    "Profiles are shown together. Services that only exist behind a profile appear as normal services.",
    "This is not a security audit. Use an image scanner and a review next to it.",
  ],
  rules: {
    "db-port-public": {
      title: "A database port is open to the outside",
      what: (c) => `${c.services} publishes ${c.detail} on all network interfaces, so anyone who can reach the host can reach the database.`,
      why: "Databases and caches are scanned for constantly. Even with a password, an open port is an attack surface and a place for mistakes.",
      fine: "A database on a private network that is closed off by a firewall, or a throwaway local setup. Binding to 127.0.0.1 keeps it local.",
    },
    "port-all-interfaces": {
      title: "A port is published on all interfaces",
      what: (c) => `${c.services} publishes ${c.detail} on all network interfaces.`,
      why: "Without a host IP, Docker listens on every interface, and it can bypass a host firewall such as ufw. Services behind a proxy usually do not need a public port at all.",
      fine: "A service that is meant to be public, such as a web server, or a host behind a firewall that you control.",
    },
    privileged: {
      title: "Privileged container",
      what: (c) => `${c.services} runs privileged or with a very broad capability (ALL or SYS_ADMIN).`,
      why: "A privileged container is close to root on the host. If it is compromised, so is the machine.",
      fine: "Tools that really manage the host, such as some network or storage agents. Then give it as little as the tool needs.",
    },
    "docker-socket": {
      title: "Docker socket is mounted",
      what: (c) => `${c.services} mounts the Docker socket.`,
      why: "Whoever can talk to the socket can start containers and so control the host. Read-only does not change much.",
      fine: "A reverse proxy or a monitoring tool that must see containers. Keep it to one service, and consider a socket proxy that limits what it may ask.",
    },
    "host-network": {
      title: "Host networking",
      what: (c) => `${c.services} uses network_mode: host.`,
      why: "The container shares the host's network: no isolation, no port mapping, and every port it opens is on the host.",
      fine: "Some network tools and very latency-sensitive services. Most services work fine with a normal network.",
    },
    "secret-in-env": {
      title: "A secret is written into the file",
      what: (c) => `${c.services} sets ${c.detail} to a fixed value in the file (the value is not shown here).`,
      why: "Compose files end up in repositories, logs and chats. A secret in the file is a secret that spreads.",
      fine: "A clearly fake value for local development. For anything real, use an .env file that is not committed, or Docker secrets.",
    },
    "latest-tag": {
      title: "No pinned image version",
      what: (c) => `${c.services} uses an image without a version, or with latest.`,
      why: "A rebuild can pull a different image than the one you tested. Rollbacks and reviews need to know exactly what runs.",
      fine: "A quick experiment. For anything that stays, pin a version, or better a digest.",
    },
    "runs-as-root": {
      title: "Does not set a user",
      what: (c) => `${c.services} opens a port and does not set user:.`,
      why: "Many images run as root by default. If a service that listens on a port is compromised, root inside the container makes everything easier. This is only a hint: we cannot see what the image does.",
      fine: "Images that already switch to a non-root user themselves. Check the image documentation.",
    },
    "no-healthcheck": {
      title: "No healthcheck",
      what: (c) => `${c.services} has no healthcheck, although it listens on a port or other services depend on it.`,
      why: "Without a healthcheck, Docker only knows the process is running, not that it works. Dependents start too early and a stuck service is never noticed.",
      fine: "One-off jobs. A service that cannot be checked from inside its own container.",
    },
    "depends-without-condition": {
      title: "Waits for started, not for healthy",
      what: (c) => `${c.services} depends on ${c.detail}, which has a healthcheck, but does not wait for it to be healthy.`,
      why: "The short form of depends_on only waits until the container has started. A database that is still starting then refuses the first connections.",
      fine: "When the dependent retries by itself and a short failure at startup does not matter.",
    },
    "no-restart-policy": {
      title: "No restart policy",
      what: (c) => `${c.services} has no restart policy.`,
      why: "After a crash or a reboot the service stays down until someone starts it.",
      fine: "Jobs that run once, or a setup where something else restarts services.",
    },
    "no-memory-limit": {
      title: "No memory limit",
      what: (c) => `No memory limit is set for: ${c.services}.`,
      why: "One service with a leak can take all memory and push everything else out.",
      fine: "A single service on a machine of its own. A limit that is too tight is also a risk, so measure first.",
    },
    "unbounded-logs": {
      title: "Logs can grow without limit",
      what: (c) => `No log size limit is set for: ${c.services}.`,
      why: "The default json-file driver keeps all output. A chatty service can fill the disk.",
      fine: "When the daemon already sets limits for all containers, or when logs go to another system.",
    },
    "depends-on-missing": {
      title: "Depends on a service that does not exist",
      what: (c) => `${c.services} depends on ${c.detail}, which is not defined in this file.`,
      why: "Compose refuses to start. It is often a typo or a service that was renamed.",
      fine: "When the service is defined in another file that you start together with this one (docker compose -f a.yml -f b.yml). Paste the files in that order with a line containing --- between them, and the check sees them as one stack.",
    },
    "duplicate-host-port": {
      title: "The same host port is used twice",
      what: (c) => `Host port ${c.detail} is published by ${c.services}.`,
      why: "Only one container can own a host port, so one of them will fail to start.",
      fine: "Different host IPs or protocols are fine and are not reported.",
    },
    "network-undeclared": {
      title: "Uses a network that is not declared",
      what: (c) => `${c.services} uses the network ${c.detail}, which is not declared under networks:.`,
      why: "Compose refuses to start with an undefined network.",
      fine: "When the network is declared in another file that you start together with this one. Paste the files with a line containing --- between them.",
    },
    "network-unused": {
      title: "A declared network is not used",
      what: (c) => `The network ${c.detail} is declared but no service uses it.`,
      why: "Leftovers make a file harder to read and give a false picture of how services are separated.",
      fine: "A network that another compose project attaches to.",
    },
    "volume-unused": {
      title: "A declared volume is not used",
      what: (c) => `The volume ${c.detail} is declared but no service mounts it.`,
      why: "A forgotten volume may still hold data that nobody looks after.",
      fine: "A volume that another compose project uses.",
    },
    "container-name-set": {
      title: "Fixed container name",
      what: (c) => `container_name is set for: ${c.services}.`,
      why: "A fixed name blocks scaling a service and running two copies of the project side by side.",
      fine: "A service that other tools find by that name and that always runs once.",
    },
    "version-obsolete": {
      title: "Obsolete version field",
      what: () => "The file starts with version:.",
      why: "The current Compose specification ignores it, and newer Compose versions warn about it.",
      fine: "A file that must still work with the old docker-compose 1.x.",
    },
    "partial-file": {
      title: "This looks like an override file",
      what: (c) => `${c.services} has no image or build, so this file probably adds to another compose file.`,
      why: "Whatever the base file defines (healthchecks, restart policy, networks, the services it depends on) is not visible here, so those checks are skipped to avoid false alarms.",
      fine: "Overrides are normal. To check the whole stack, paste the base file first, then a line with ---, then the override.",
    },
  } as Record<RuleId, RuleText>,
};

export type ComposeLabCopy = typeof en;

const nl: ComposeLabCopy = {
  title: "Compose-lab",
  description:
    "Plak een docker-compose.yml en zie de stack als levend diagram, met uitgelegde regels voor beveiliging, betrouwbaarheid en opzet. Draait in je browser.",
  eyebrow: "Prototype",
  heading: "Plak een compose-bestand. Zie de stack.",
  intro:
    "Plak een docker-compose.yml of sleep het bestand erin. Compose-lab tekent de services en waar ze van afhangen, laat zien wat openstaat naar buiten en legt uit wat een zorgvuldige reviewer zou aanstippen. Er wordt niets verstuurd: het bestand wordt in je browser gelezen en vergeten zodra je de pagina sluit.",
  inputLabel: "docker-compose.yml",
  placeholder: "services:\n  web:\n    image: nginx:1.27\n    ports:\n      - \"80:80\"",
  tryExample: "Probeer een voorbeeld",
  examples: { tidy: "Een nette stack", messy: "Een rommelige stack" },
  clear: "Wissen",
  dropHint: "Of sleep hier een bestand heen",
  errors: {
    empty: () => "",
    "too-large": () => "Dit bestand is groter dan 256 kB. Plak alleen de services die je wilt bekijken.",
    "too-many-services": () => "Meer dan 200 services. Plak een kleiner bestand.",
    "too-many-files": () => "Meer dan 10 bestanden gescheiden door ---. Plak er minder.",
    "yaml-error": (e) => `Dit is geen geldige YAML${e.line ? ` (regel ${e.line})` : ""}${e.detail ? `, ${e.detail}` : ""}. Controleer de inspringing en de aanhalingstekens.`,
    "alias-limit": () => "Dit bestand gebruikt te veel YAML-aliassen om veilig te lezen.",
    "not-a-mapping": () => "Een compose-bestand is een YAML-mapping met een services:-sectie. Dit lijkt een lijst of een losse waarde.",
    "no-services": () => "Geen services gevonden. Een compose-bestand heeft een services:-sectie met minstens één service nodig.",
    "parse-failed": () => "Dit bestand kon niet worden gelezen. Probeer een kleiner stuk.",
  },
  diagramTitle: "De stack",
  diagramHint: "Sleep een kaart om hem te verplaatsen. Kies een kaart om alleen zijn bevindingen te zien.",
  diagramAlt: "Diagram van de services, waar ze van afhangen en welke poorten openstaan naar buiten. Dezelfde informatie staat in de servicelijst hieronder.",
  internet: "Internet",
  noDiagram: "Het diagram heeft een breder scherm nodig. De servicelijst hieronder bevat dezelfde informatie.",
  export: "Exporteren",
  exportSvg: "Download SVG",
  exportPng: "Download PNG",
  exportNote: "Exports tonen namen, images en poorten, nooit omgevingswaarden.",
  summaryTitle: "Bevindingen",
  summary: (fail, warn, info) => {
    if (!fail && !warn && !info) return "Niets aan te merken. Elke regel die we controleren kwam goed uit.";
    const parts = [fail ? `${fail} te herstellen` : "", warn ? `${warn} om naar te kijken` : "", info ? `${info} ${info === 1 ? "tip" : "tips"}` : ""].filter(Boolean);
    return parts.join(", ") + ".";
  },
  levels: { fail: "Herstel", warn: "Kijk ernaar", info: "Tip", ok: "In orde" },
  groups: { security: "Beveiliging", reliability: "Betrouwbaarheid", structure: "Opzet" },
  showing: (name) => `Bevindingen voor ${name}`,
  showAll: "Toon alles",
  why: "Waarom het ertoe doet",
  fine: "Wanneer dit prima is",
  fix: "Een manier om het op te lossen",
  copy: "Kopieer",
  copied: "Gekopieerd",
  listTitle: "Servicelijst",
  columns: { service: "Service", image: "Image", ports: "Poorten", depends: "Hangt af van", networks: "Netwerken", volumes: "Volumes", env: "Omgeving", findings: "Bevindingen" },
  none: "geen",
  showValues: "Toon omgevingswaarden",
  valuesWarning: "Waarden kunnen geheimen bevatten. Ze staan alleen in deze lijst, nooit in het diagram of de exports.",
  keysOnly: "Alleen de namen van de variabelen worden getoond.",
  howTitle: "Hoe het werkt",
  how: [
    "Het bestand wordt in je browser gelezen met een standaard YAML-parser. Er wordt niets geüpload, opgeslagen of in de adresbalk gezet, dus er is geen deelbare link: een link met een compose-bestand erin kan geheimen delen.",
    "Elke regel is een vaste controle op het gelezen bestand. Een regel zegt wat hij vond, waarom het ertoe kan doen en wanneer het prima is. Het is een mening met redenen, geen oordeel.",
    "In het diagram staat links wat niemand nodig heeft en rechts waar het van afhangt. Het diagram en de exports bevatten nooit omgevingswaarden.",
  ],
  limitsTitle: "Beperkingen",
  limits: [
    "Er wordt niets uitgevoerd en geen image bekeken, dus we weten niet of een container als root draait of wat een healthcheck echt test.",
    "Variabelen zoals ${VAR} worden niet ingevuld, en .env-bestanden, include, extends en meerdere -f-bestanden worden niet samengevoegd.",
    "Profielen worden samen getoond. Services die alleen achter een profiel bestaan, staan er als gewone services bij.",
    "Dit is geen beveiligingsaudit. Gebruik daarnaast een image-scanner en een review.",
  ],
  rules: {
    "db-port-public": {
      title: "Een databasepoort staat open naar buiten",
      what: (c) => `${c.services} publiceert ${c.detail} op alle netwerkinterfaces, dus iedereen die bij de host kan, kan bij de database.`,
      why: "Databases en caches worden voortdurend gescand. Ook met een wachtwoord is een open poort een aanvalsvlak en een plek voor fouten.",
      fine: "Een database op een privénetwerk dat door een firewall is afgesloten, of een wegwerpopzet lokaal. Binden aan 127.0.0.1 houdt het lokaal.",
    },
    "port-all-interfaces": {
      title: "Een poort is op alle interfaces gepubliceerd",
      what: (c) => `${c.services} publiceert ${c.detail} op alle netwerkinterfaces.`,
      why: "Zonder host-IP luistert Docker op elke interface en kan het een host-firewall zoals ufw omzeilen. Services achter een proxy hebben meestal helemaal geen publieke poort nodig.",
      fine: "Een service die bedoeld is om publiek te zijn, zoals een webserver, of een host achter een firewall die jij beheert.",
    },
    privileged: {
      title: "Privileged container",
      what: (c) => `${c.services} draait privileged of met een heel brede capability (ALL of SYS_ADMIN).`,
      why: "Een privileged container zit dicht bij root op de host. Als hij wordt overgenomen, is de machine van de aanvaller.",
      fine: "Tools die echt de host beheren, zoals sommige netwerk- of opslagagents. Geef dan zo weinig als de tool nodig heeft.",
    },
    "docker-socket": {
      title: "De Docker-socket is gemount",
      what: (c) => `${c.services} mount de Docker-socket.`,
      why: "Wie met de socket kan praten, kan containers starten en dus de host besturen. Alleen-lezen verandert daar weinig aan.",
      fine: "Een reverse proxy of monitoringtool die containers moet zien. Beperk het tot één service en overweeg een socket-proxy die beperkt wat hij mag vragen.",
    },
    "host-network": {
      title: "Hostnetwerk",
      what: (c) => `${c.services} gebruikt network_mode: host.`,
      why: "De container deelt het netwerk van de host: geen isolatie, geen poortmapping en elke poort die hij opent staat op de host.",
      fine: "Sommige netwerktools en zeer latentiegevoelige services. De meeste services werken prima met een gewoon netwerk.",
    },
    "secret-in-env": {
      title: "Een geheim staat in het bestand",
      what: (c) => `${c.services} zet ${c.detail} op een vaste waarde in het bestand (de waarde tonen we hier niet).`,
      why: "Compose-bestanden belanden in repositories, logs en chats. Een geheim in het bestand is een geheim dat zich verspreidt.",
      fine: "Een duidelijk nepwaarde voor lokale ontwikkeling. Gebruik voor echt werk een .env-bestand dat niet wordt gecommit, of Docker secrets.",
    },
    "latest-tag": {
      title: "Geen vastgezette imageversie",
      what: (c) => `${c.services} gebruikt een image zonder versie, of met latest.`,
      why: "Een herbouw kan een ander image binnenhalen dan het geteste. Terugdraaien en reviewen vragen om precies te weten wat draait.",
      fine: "Een snel experiment. Zet voor alles wat blijft een versie vast, of beter een digest.",
    },
    "runs-as-root": {
      title: "Stelt geen gebruiker in",
      what: (c) => `${c.services} opent een poort en stelt geen user: in.`,
      why: "Veel images draaien standaard als root. Wordt een service die op een poort luistert overgenomen, dan maakt root in de container alles makkelijker. Dit is alleen een hint: we zien niet wat het image doet.",
      fine: "Images die zelf al naar een gewone gebruiker overschakelen. Lees de documentatie van het image.",
    },
    "no-healthcheck": {
      title: "Geen healthcheck",
      what: (c) => `${c.services} heeft geen healthcheck, terwijl hij op een poort luistert of andere services van hem afhangen.`,
      why: "Zonder healthcheck weet Docker alleen dat het proces draait, niet dat het werkt. Afhankelijke services starten te vroeg en een vastgelopen service valt niet op.",
      fine: "Taken die één keer draaien. Een service die je niet vanuit zijn eigen container kunt controleren.",
    },
    "depends-without-condition": {
      title: "Wacht op gestart, niet op gezond",
      what: (c) => `${c.services} hangt af van ${c.detail}, dat een healthcheck heeft, maar wacht niet tot het gezond is.`,
      why: "De korte vorm van depends_on wacht alleen tot de container gestart is. Een database die nog opstart weigert dan de eerste verbindingen.",
      fine: "Als de afhankelijke zelf opnieuw probeert en een korte fout bij het opstarten niet uitmaakt.",
    },
    "no-restart-policy": {
      title: "Geen herstartbeleid",
      what: (c) => `${c.services} heeft geen herstartbeleid.`,
      why: "Na een crash of herstart blijft de service uit tot iemand hem start.",
      fine: "Taken die één keer draaien, of een opzet waarin iets anders services herstart.",
    },
    "no-memory-limit": {
      title: "Geen geheugenlimiet",
      what: (c) => `Geen geheugenlimiet ingesteld voor: ${c.services}.`,
      why: "Eén service met een geheugenlek kan al het geheugen innemen en al het andere wegduwen.",
      fine: "Een enkele service op een eigen machine. Een te strakke limiet is ook een risico, dus meet eerst.",
    },
    "unbounded-logs": {
      title: "Logs kunnen onbeperkt groeien",
      what: (c) => `Geen limiet op de loggrootte voor: ${c.services}.`,
      why: "Het standaard json-file-stuurprogramma bewaart alle uitvoer. Een spraakzame service kan de schijf vullen.",
      fine: "Als de daemon al limieten voor alle containers instelt, of als logs naar een ander systeem gaan.",
    },
    "depends-on-missing": {
      title: "Hangt af van een service die niet bestaat",
      what: (c) => `${c.services} hangt af van ${c.detail}, dat niet in dit bestand staat.`,
      why: "Compose weigert te starten. Vaak een typefout of een service die is hernoemd.",
      fine: "Als de service in een ander bestand staat dat je samen met dit bestand start (docker compose -f a.yml -f b.yml). Plak de bestanden in die volgorde met een regel met --- ertussen, dan ziet de controle ze als één stack.",
    },
    "duplicate-host-port": {
      title: "Dezelfde hostpoort wordt twee keer gebruikt",
      what: (c) => `Hostpoort ${c.detail} wordt gepubliceerd door ${c.services}.`,
      why: "Maar één container kan een hostpoort hebben, dus één van de twee start niet.",
      fine: "Verschillende host-IP's of protocollen zijn prima en worden niet gemeld.",
    },
    "network-undeclared": {
      title: "Gebruikt een netwerk dat niet is gedeclareerd",
      what: (c) => `${c.services} gebruikt het netwerk ${c.detail}, dat niet onder networks: staat.`,
      why: "Compose weigert te starten met een niet-gedefinieerd netwerk.",
      fine: "Als het netwerk in een ander bestand staat dat je samen met dit bestand start. Plak de bestanden met een regel met --- ertussen.",
    },
    "network-unused": {
      title: "Een gedeclareerd netwerk wordt niet gebruikt",
      what: (c) => `Het netwerk ${c.detail} is gedeclareerd maar geen service gebruikt het.`,
      why: "Restanten maken een bestand lastiger te lezen en geven een onjuist beeld van hoe services gescheiden zijn.",
      fine: "Een netwerk waar een ander compose-project zich aan hecht.",
    },
    "volume-unused": {
      title: "Een gedeclareerd volume wordt niet gebruikt",
      what: (c) => `Het volume ${c.detail} is gedeclareerd maar geen service mount het.`,
      why: "Een vergeten volume kan nog data bevatten waar niemand naar omkijkt.",
      fine: "Een volume dat een ander compose-project gebruikt.",
    },
    "container-name-set": {
      title: "Vaste containernaam",
      what: (c) => `container_name is ingesteld voor: ${c.services}.`,
      why: "Een vaste naam blokkeert schalen en het naast elkaar draaien van twee kopieën van het project.",
      fine: "Een service die andere tools op die naam vinden en die altijd één keer draait.",
    },
    "version-obsolete": {
      title: "Verouderd versieveld",
      what: () => "Het bestand begint met version:.",
      why: "De huidige Compose-specificatie negeert het, en nieuwere Compose-versies waarschuwen ervoor.",
      fine: "Een bestand dat nog met het oude docker-compose 1.x moet werken.",
    },
    "partial-file": {
      title: "Dit lijkt een override-bestand",
      what: (c) => `${c.services} heeft geen image of build, dus dit bestand vult waarschijnlijk een ander compose-bestand aan.`,
      why: "Wat het basisbestand bepaalt (healthchecks, restart-beleid, netwerken, de services waarvan deze afhangt) is hier niet te zien, dus die controles worden overgeslagen om valse meldingen te voorkomen.",
      fine: "Overrides zijn normaal. Wil je de hele stack controleren, plak dan eerst het basisbestand, dan een regel met ---, en dan de override.",
    },
  },
};

export const composeLabCopy: Record<Locale, ComposeLabCopy> = { en, nl };
