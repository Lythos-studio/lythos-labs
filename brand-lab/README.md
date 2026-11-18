# Brand lab

Turn one brand colour, or the main colour of a logo, into an accessible design system.

Try it at [labs.lythos.nl/brand-lab](https://labs.lythos.nl/brand-lab) (Dutch: [/nl/merklab](https://labs.lythos.nl/nl/merklab)).

- **Palettes in OKLCH.** Primary, neutral, success, warning and danger, eleven steps each at fixed perceptual lightness, so palettes from different brands line up.
- **Contrast you can rely on.** Text, muted text, links, status colours and button text are chosen by measuring WCAG 2.x contrast (4.5:1, AA), in light and dark. A brand colour that cannot carry readable text is never used for text.
- **Logo colour.** The main colour is read from an image in the browser. Nothing is uploaded.
- **Export.** CSS custom properties (with a dark mode media query), a Tailwind v4 `@theme` block, or JSON in the [Design Tokens Community Group format](https://tr.designtokens.org/format/).
- **Shareable.** Settings live in the URL hash, so a link restores a result without a server.

## Use the colour engine

The engine in `src/tokens.ts` is plain TypeScript without dependencies or DOM access.

```ts
import { palette, roles, checks, exportCss } from "@lythos-labs/brand-lab/tokens";

const p = palette("#2449df");
const light = roles(p, "light"); // { background, text, primary, onPrimary, link, ... }
checks(light).every((c) => c.ratio >= c.min); // true
exportCss({ color: "#2449df", radius: "soft", type: "editorial" });
```

## Use the component

`BrandLab` is a React 19 client component with English and Dutch copy. Its styles are a CSS module, so use a bundler that supports CSS modules (Next.js, Vite).

```tsx
import { BrandLab } from "@lythos-labs/brand-lab";

export default function Page() {
  return <BrandLab locale="en" />;
}
```

It is designed for a dark page and reads these optional custom properties from its surroundings: `--max`, `--gutter`, `--ease` and `--font-mono`. Headings use `Newsreader Variable` when the page loads it, and fall back to Georgia.

## Develop

```bash
npm install
npm test
npm run typecheck
```

## How the colours are made

1. The brand colour is converted to OKLCH (lightness, chroma, hue).
2. Each scale keeps the brand hue and uses fixed lightness steps from 0.975 (50) to 0.22 (950). Chroma peaks in the middle of the scale and tapers towards white and black, and colours outside sRGB are brought into gamut by lowering chroma, which keeps hue and lightness.
3. Roles walk a scale from the background towards stronger colours and take the first step that reaches the required contrast.

## Contributing

Issues and pull requests are welcome. This repository is a mirror of the `packages/labs` folder in the Lythos monorepo. Accepted changes are applied there and appear here with the next sync, credited to their author.

## License

The source code is licensed under the [Mozilla Public License 2.0](LICENSE). You can use it in closed products; changes to these files must be shared under the same license.

The Lythos name and logo are trademarks of Lythos and are not covered by this license.
