# Introduction

`excellent-react-spreadsheet` is a headless spreadsheet toolkit for React. It gives you a single hook, `useSpreadsheet`, plus a small kit of typed column factories, and lets you render any UI you like on top — a plain `<table>`, a CSS grid, a virtual list, your design system's primitives. The library owns the _state machine_ (selection, active cell, history, clipboard, virtualization math); you own the DOM.

## Why headless?

Most React grids hand you a full component and hope it fits. It never quite does — you end up fighting Portals to use your own `<Select>`, writing a `ResizeObserver` to size the grid, or deep-cloning rows to implement undo. Headless inverts that: the library gives you pure state + behavior, and you compose it with your own components.

## What ships today

- `useSpreadsheet<Row>(...)` — controlled rows, selection, active cell, plus imperative helpers for `applyPatches`, `undo`, `redo`, `copy`, `paste`, `cut`.
- Column presets — `textColumn`, `intColumn`, `floatColumn`, `dateColumn`, `selectColumn`, `checkboxColumn`, `customColumn`.
- JSON-patch history with coalescing (`createHistory`).
- Clipboard engine (`serializeRange`, `parseClipboard`, `buildPastePatches`).
- Headless row virtualization (`useRowVirtualizer`, `computeRowVirtualization`).
- Tailwind preset with CSS variables (`@excellent-react-spreadsheet/tailwind`).

## What is coming

A pre-styled `<Spreadsheet>` wrapper, drag-reorder rows, and the formula engine. See the [roadmap](/roadmap).

## Requirements

- React **18.x or 19.x**.
- TypeScript projects benefit most — typed row inference is a core selling point. Plain JS works too.
- No runtime dependencies outside of `react` / `react-dom` (both are `peerDependencies`).

Go to [Installation](/guide/installation) to add the package, or jump to [Quick Start](/guide/quick-start) for a full working example.
