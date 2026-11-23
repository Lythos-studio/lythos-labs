# Building blocks

Twenty-seven accessible React components with a verifiable contract. MPL-2.0. React is the only dependency.

Each block (`src/blocks/<slug>/`) has four files:

- `<slug>.tsx` and `<slug>.css`: the component and its styles (themed with `--lb-*` CSS variables, defaults in `src/styles/base.css`)
- `contract.ts`: pure data. Metadata (what the native alternative is, the honest limits) and the behaviours the block promises: keyboard, pointer and static checks with expectations
- `fixture.tsx`: the demo the contract runs against, and an optional playground

The contract is the single source of truth. It is rendered as documentation, run in the page by the Verify button (`src/harness`), replayed with the real keyboard by Playwright (`e2e/parity.spec.ts`), and scanned with axe in four themes (`e2e/axe.spec.ts`).

## Commands

- `npm test`: unit tests (core logic, contracts, size budgets, freshness of generated files, a starter kit compiled with strict TypeScript)
- `npm run typecheck`
- `npm run register`: after adding or removing a block, regenerate `src/catalog.ts` and `src/lab/fixtures.ts`
- `npm run e2e`: Playwright against a running site (see `e2e/playwright.config.ts`)
- `npm run gen` (`npx tsx scripts/gen.ts`): after changing a block and running the full e2e, regenerate `src/generated/` (sources, sizes, evidence). The tests fail when it is stale.

## Using a block

Copy a block with the starter kit builder on the site, or take `/blocks/registry.json`. A kit contains the chosen blocks, the core files they import, `tokens.css` and a README. Nothing else is included.

## What is and is not claimed

The checks show that each block does what its contract says in Chromium, with synthetic and real keyboard input and no axe violations in four themes. They do not replace a test with a real screen reader and are not an accessibility certification. See `docs/labs-building-blocks.md` in the Lythos repository.
