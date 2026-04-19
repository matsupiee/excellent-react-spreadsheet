---
layout: home

hero:
  name: excellent-react-spreadsheet
  text: Headless spreadsheet for React
  tagline: Controlled, TypeScript-first, under 30 kB gzipped. Built-in undo/redo, copy & paste, and row virtualization.
  image:
    src: /logo.svg
    alt: excellent-react-spreadsheet logo
  actions:
    - theme: brand
      text: Quick Start
      link: /guide/quick-start
    - theme: alt
      text: Why another grid?
      link: /comparison
    - theme: alt
      text: View on GitHub
      link: https://github.com/matsupiee/excellent-react-spreadsheet

features:
  - icon: 🧩
    title: Headless first
    details: A single useSpreadsheet hook exposes everything. Drop your own Chakra, MUI, or shadcn cell editors in via renderEditor. No wrestling with portals.
  - icon: 📐
    title: Controlled by design
    details: Rows, selection, active cell, and column widths are all controlled. One source of truth — no shadow state fights with your reducer or form library.
  - icon: ⏪
    title: Undo/Redo built in
    details: JSON-patch history with coalescing. Continuous typing merges into one entry; paste operations become a single step. 200 entries by default.
  - icon: 📋
    title: TSV / CSV clipboard
    details: Copy/paste interoperates with Excel, Numbers, and Sheets. Column serializers round-trip typed values back to typed values.
  - icon: 🪶
    title: Tiny and fast
    details: Core ≤ 30 kB gzipped. 10,000-row virtualization baked in. Zero runtime dependencies besides React.
  - icon: 🎨
    title: Tailwind preset
    details: Brings CSS variables and a Tailwind preset so themes plug into your existing design system — or ignore it and style with your own CSS.
---

## Try it

Interactive demo. Click a cell and start typing, press `Enter` to commit, `⌘Z` / `⌘⇧Z` to undo/redo, `⌘C` / `⌘V` to copy and paste.

<ClientOnly>
  <ReactIsland :component="() => import('./demos/HeroDemo')" />
</ClientOnly>

## 30-second code sample

```tsx
import { useState } from 'react';
import { useSpreadsheet, textColumn, intColumn, type ColumnDef } from 'excellent-react-spreadsheet';

type Person = { id: string; name: string; age: number };

const columns: ColumnDef<Person>[] = [
  textColumn<Person, 'name'>({ key: 'name', title: 'Name' }),
  intColumn<Person, 'age'>({ key: 'age', title: 'Age', min: 0 }) as ColumnDef<Person>,
];

export function TeamGrid() {
  const [rows, setRows] = useState<Person[]>([
    { id: '1', name: 'Aiko', age: 30 },
    { id: '2', name: 'Bruno', age: 25 },
  ]);

  const grid = useSpreadsheet({
    value: rows,
    onChange: setRows,
    columns,
    getRowKey: (row) => row.id,
  });

  // grid.applyPatches, grid.undo(), grid.paste(), and grid.copy()
  // are yours to wire into any UI you want.
  return <YourGridRenderer {...grid} />;
}
```

> The `<Spreadsheet>` pre-styled component is on the [roadmap](/roadmap). Today the library ships **headless** — you own the markup, we own the state.

## Who is this for?

- Teams building **internal tools / admin SaaS** that need Excel-like editing but also need Chakra/MUI integration.
- Apps migrating off `react-datasheet-grid` that hit its ceiling on Select widgets, height handling, and undo.
- Anyone who wants **TypeScript-first** column definitions that infer row types for you.

See the [comparison](/comparison) for the design decisions behind each of these.
