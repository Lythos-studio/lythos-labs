"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { LabLocale } from "./copy";
import styles from "./lab.module.css";

const content = {
  en: {
    title: "Principles and installation",
    intro: "How these blocks are built, and how to use them.",
    principles: [
      ["Native first", "Use the platform where it does the job: <dialog>, popover, <details>, <input>, <button>. Custom code only where the platform has nothing."],
      ["The ARIA Authoring Practices", "Every interactive block follows its pattern from the WAI-ARIA Authoring Practices and says where it differs and why."],
      ["The contract is the truth", "Each block lists its keyboard and role behaviour as data. The documentation, the Verify panel and the tests all come from that list, so they cannot disagree."],
      ["Evidence, not claims", "Every number on these pages comes from a test run. We do not claim WCAG conformance. Testing with screen readers and with people is manual work and is marked as not done until it is."],
      ["Ownership", "React is the only dependency. The blocks are plain files you copy; there is no runtime to install and no lock-in."],
      ["Themeable", "Everything reads --lb-* variables. They come from the Brand lab: colour, corners and typography, with text colours chosen for contrast."],
    ],
    installTitle: "Installation",
    install: [
      "Open the starter kit, choose the blocks and download the .zip. Or copy a single block from its Code section.",
      "Put the files in your project. Import styles.css once, and give the element around the blocks className=\"lb-root\".",
      "Import the components, for example import { Button } from \"./index\".",
      "Your brand is in tokens.css. Change the variables or generate them again from the theme bar.",
    ],
    themingTitle: "Theming",
    theming: "Set data-lb-mode=\"dark\" on .lb-root for dark mode. To change one block, override its --lb-* variables on that element. The blocks never set colours directly.",
    licence: "Licence: Mozilla Public License 2.0. Changes to these files must be shared under the same licence; using them in a closed product is fine. The Lythos name and logo are not covered.",
  },
  nl: {
    title: "Principes en installatie",
    intro: "Hoe deze onderdelen zijn gebouwd, en hoe je ze gebruikt.",
    principles: [
      ["Native eerst", "Gebruik het platform waar het de klus klaart: <dialog>, popover, <details>, <input>, <button>. Eigen code alleen waar het platform niets heeft."],
      ["De ARIA Authoring Practices", "Elk interactief onderdeel volgt zijn patroon uit de WAI-ARIA Authoring Practices en zegt waar het afwijkt en waarom."],
      ["Het contract is de waarheid", "Elk onderdeel somt zijn toetsenbord- en rolgedrag op als data. De documentatie, het Verify-paneel en de tests komen uit die lijst, dus ze kunnen elkaar niet tegenspreken."],
      ["Bewijs, geen beweringen", "Elk getal op deze pagina's komt uit een testrun. We beweren geen WCAG-conformiteit. Testen met schermlezers en met mensen is handwerk en staat als niet gedaan tot het gedaan is."],
      ["Eigenaarschap", "React is de enige afhankelijkheid. De onderdelen zijn gewone bestanden die je kopieert; er is geen runtime om te installeren en geen lock-in."],
      ["Thematiseerbaar", "Alles leest --lb-*-variabelen. Die komen uit Merklab: kleur, hoeken en typografie, met tekstkleuren gekozen op contrast."],
    ],
    installTitle: "Installatie",
    install: [
      "Open de starterkit, kies de onderdelen en download de .zip. Of kopieer één onderdeel uit zijn sectie Code.",
      "Zet de bestanden in je project. Importeer styles.css één keer en geef het element om de onderdelen className=\"lb-root\".",
      "Importeer de componenten, bijvoorbeeld import { Button } from \"./index\".",
      "Jouw merk staat in tokens.css. Pas de variabelen aan of genereer ze opnieuw met de themabalk.",
    ],
    themingTitle: "Thematisering",
    theming: "Zet data-lb-mode=\"dark\" op .lb-root voor de donkere modus. Wil je één onderdeel aanpassen, overschrijf dan zijn --lb-*-variabelen op dat element. De onderdelen zetten nooit rechtstreeks kleuren.",
    licence: "Licentie: Mozilla Public License 2.0. Wijzigingen in deze bestanden moeten onder dezelfde licentie gedeeld worden; gebruik in een gesloten product mag. De naam en het logo van Lythos vallen er niet onder.",
  },
};

export function Principles({ locale }: { locale: LabLocale }) {
  const c = content[locale];
  return (
    <div className={styles.lab}>
      <header className={styles.intro}>
        <h1>{c.title}</h1>
        <p>{c.intro}</p>
      </header>
      <section className={styles.section} aria-labelledby="pr">
        <h2 id="pr">{locale === "nl" ? "Principes" : "Principles"}</h2>
        <dl className={styles.facts}>
          {c.principles.map(([term, body]) => (
            <div key={term} style={{ display: "contents" }}>
              <dt>{term}</dt>
              <dd>{body}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className={styles.section} aria-labelledby="inst">
        <h2 id="inst">{c.installTitle}</h2>
        <ol className={styles.lead} style={{ paddingInlineStart: "1.2em", display: "grid", gap: 8 }}>
          {c.install.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <h2 className={styles.h2small}>{c.themingTitle}</h2>
        <p className={styles.lead}>{c.theming}</p>
        <p className={styles.small}>{c.licence}</p>
      </section>
    </div>
  );
}
