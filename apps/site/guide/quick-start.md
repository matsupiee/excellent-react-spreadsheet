# Quick Start

This page builds a minimal spreadsheet from scratch. The full result is the [Hero demo](/) on the landing page.

## 1. Define your row type

```ts
type Teammate = {
  id: string;
  name: string;
  role: 'engineer' | 'designer' | 'pm';
  focus: number;
  active: boolean;
};
```

## 2. Build the column set

Each column factory infers `Row` from a generic parameter. Pair the `Row` type with the property key that the column edits.

```tsx
import {
  checkboxColumn,
  intColumn,
  selectColumn,
  textColumn,
  type ColumnDef,
} from 'excellent-react-spreadsheet';

const ROLE_OPTIONS = [
  { label: 'Engineer', value: 'engineer' as const },
  { label: 'Designer', value: 'designer' as const },
  { label: 'PM', value: 'pm' as const },
];

// A tiny helper that widens ColumnDef<Row, V> so presets with different
// Value types can live in one array. See the tip below.
const asColumn = <Row, V>(col: ColumnDef<Row, V>): ColumnDef<Row> =>
  col as unknown as ColumnDef<Row>;

const columns: ColumnDef<Teammate>[] = [
  asColumn(textColumn<Teammate, 'name'>({ key: 'name', title: 'Name' })),
  asColumn(
    selectColumn<Teammate, 'role', Teammate['role']>({
      key: 'role',
      title: 'Role',
      options: ROLE_OPTIONS,
    }),
  ),
  asColumn(intColumn<Teammate, 'focus'>({ key: 'focus', title: 'Focus', min: 0, max: 100 })),
  asColumn(checkboxColumn<Teammate, 'active'>({ key: 'active', title: 'Active' })),
];
```

::: tip Why the `asColumn` helper?
`intColumn` returns `ColumnDef<Row, number | null>` while `checkboxColumn` returns `ColumnDef<Row, boolean | null>`. To put them in a single array typed `ColumnDef<Row>[]` (= `ColumnDef<Row, unknown>[]`), each must be widened. The `setValue` parameter is contravariant, so TypeScript needs an explicit cast. The hook erases `Value` at the boundary and re-narrows it inside each column closure, so the cast is sound.
:::

## 3. Wire the hook

```tsx
import { useState } from 'react';
import { useSpreadsheet } from 'excellent-react-spreadsheet';

export function TeamGrid() {
  const [rows, setRows] = useState<Teammate[]>([
    { id: 'r1', name: 'Aiko', role: 'engineer', focus: 85, active: true },
    { id: 'r2', name: 'Bruno', role: 'designer', focus: 70, active: true },
  ]);

  const grid = useSpreadsheet<Teammate>({
    value: rows,
    onChange: setRows,
    columns,
    getRowKey: (row) => row.id,
  });

  return <YourGridRenderer grid={grid} />;
}
```

`grid` is an object containing:

- `rows`, `columns`, `rowMeta`, `columnMeta` — snapshots you render from
- `selection`, `activeCell` — controlled or internal, depending on whether you passed those props
- `setSelection`, `setActiveCell` — imperative movers
- `applyPatches`, `undo`, `redo`, `canUndo`, `canRedo`, `clearHistory`
- `copy`, `paste`, `cut`

See [API / useSpreadsheet](/api/use-spreadsheet) for the full shape.

## 4. Render whatever you like

The headless approach means you decide the DOM. The smallest possible renderer is a plain table:

```tsx
function YourGridRenderer({ grid }) {
  return (
    <table>
      <thead>
        <tr>
          {grid.columns.map((column) => (
            <th key={column.key}>{column.title}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {grid.rows.map((row, rowIndex) => (
          <tr key={grid.rowMeta[rowIndex].key}>
            {grid.columns.map((column, colIndex) => (
              <td
                key={column.key}
                onClick={() =>
                  grid.setSelection({
                    start: { row: rowIndex, col: colIndex },
                    end: { row: rowIndex, col: colIndex },
                  })
                }
              >
                {column.renderCell?.({
                  value: column.getValue(row),
                  row,
                  rowIndex,
                  address: { row: rowIndex, col: colIndex },
                }) ?? String(column.getValue(row))}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

For a more complete renderer that handles editing, keyboard nav, and clipboard, see the [Recipes](/guide/recipes).

## Next steps

- [Columns](/guide/columns) — every preset, live
- [Undo / Redo](/guide/undo-redo) — history & coalescing
- [Copy & Paste](/guide/copy-paste) — clipboard semantics
- [Virtualization](/guide/virtualization) — 10,000-row demo
