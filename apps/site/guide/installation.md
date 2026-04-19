# Installation

## Package

The core is a single package:

::: code-group

```sh [pnpm]
pnpm add excellent-react-spreadsheet
```

```sh [npm]
npm install excellent-react-spreadsheet
```

```sh [yarn]
yarn add excellent-react-spreadsheet
```

:::

React 18 or 19 is required as a peer dependency:

```sh
pnpm add react@^19 react-dom@^19
```

## Optional subpackages

Install only what you use. All three sub-packages are independent — you can mix and match.

| Package                                 | Install when                                                 |
| --------------------------------------- | ------------------------------------------------------------ |
| `@excellent-react-spreadsheet/tailwind` | You want the Tailwind preset and CSS variables               |
| `@excellent-react-spreadsheet/formula`  | (Coming) you want formula support — not yet production-ready |

```sh
pnpm add @excellent-react-spreadsheet/tailwind
```

## Bundle size

The core is gated in CI at **30 kB gzipped**. Tree-shaking is fully supported — importing only `textColumn` leaves the rest of the column factories out of your bundle.

## TypeScript

The package is TypeScript-first and ships `.d.ts` files next to the JS output. No additional `@types/...` install is needed.

Our `tsconfig` is configured with `strict: true`, `exactOptionalPropertyTypes`, and `noUncheckedIndexedAccess`. Consumer code does **not** need those flags, but the library's types are designed to stay honest under them.

Next: [Quick Start](/guide/quick-start).
