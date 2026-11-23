/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

export type LabLocale = "en" | "nl";

const en = {
  eyebrow: "Prototype",
  overviewTitle: "Building blocks",
  overviewIntro: "Accessible React building blocks you can see, prove and take with you.",
  blocksTitle: "All blocks",
  tiers: { core: "Core", advanced: "Advanced", signature: "Signature" },
  back: "All blocks",
  pattern: "Pattern",
  stageTitle: "Live example",
  theme: "Theme",
  light: "Light",
  dark: "Dark",
  nativeTitle: "When to use the platform instead",
  limitsTitle: "Known limits",
  verifyTitle: "Verify in your browser",
  verifyRun: "Run the checks",
  verifyRunning: "Running...",
  verifyIntro:
    "These checks run against a fresh copy of the example in your browser. Keyboard behaviour is simulated with synthetic events. Behaviour that only the real browser can prove (such as Tab order) is marked native and is proven in the end-to-end tests with a real keyboard.",
  verifySummary: (pass: number, fail: number, total: number) => `${pass} of ${total} checks passed${fail ? `, ${fail} failed` : ""}.`,
  kinds: { static: "Roles and states", keyboard: "Keyboard", pointer: "Pointer", native: "Native" },
  states: { idle: "Not run", pass: "Passed", fail: "Failed", skipped: "Not run here", native: "Real browser only" },
};

export type LabCopy = typeof en;

const nl: LabCopy = {
  eyebrow: "Prototype",
  overviewTitle: "Bouwstenen",
  overviewIntro: "Toegankelijke React-onderdelen die je kunt zien, bewijzen en meenemen.",
  blocksTitle: "Alle onderdelen",
  tiers: { core: "Kern", advanced: "Geavanceerd", signature: "Signatuur" },
  back: "Alle onderdelen",
  pattern: "Patroon",
  stageTitle: "Live voorbeeld",
  theme: "Thema",
  light: "Licht",
  dark: "Donker",
  nativeTitle: "Wanneer je beter het platform gebruikt",
  limitsTitle: "Bekende beperkingen",
  verifyTitle: "Controleer in je browser",
  verifyRun: "Voer de controles uit",
  verifyRunning: "Bezig...",
  verifyIntro:
    "Deze controles draaien op een verse kopie van het voorbeeld in je browser. Toetsenbordgedrag wordt nagebootst met synthetische events. Gedrag dat alleen de echte browser kan bewijzen (zoals de Tab-volgorde) staat als native aangemerkt en is in de end-to-end-tests met een echt toetsenbord bewezen.",
  verifySummary: (pass, fail, total) => `${pass} van ${total} controles geslaagd${fail ? `, ${fail} mislukt` : ""}.`,
  kinds: { static: "Rollen en staten", keyboard: "Toetsenbord", pointer: "Aanwijzer", native: "Native" },
  states: { idle: "Niet uitgevoerd", pass: "Geslaagd", fail: "Mislukt", skipped: "Hier niet uitgevoerd", native: "Alleen echte browser" },
};

export const labCopy: Record<LabLocale, LabCopy> = { en, nl };
