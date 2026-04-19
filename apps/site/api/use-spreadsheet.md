# `useSpreadsheet`

The headless hook. Owns rows, selection, active cell, history, and clipboard. You own the DOM.

```ts
const grid = useSpreadsheet<Row>(props: UseSpreadsheetProps<Row>): UseSpreadsheetReturn<Row>;
```

## Props

```ts
type UseSpreadsheetProps<Row> = {
  value: Row[];
  onChange: (rows: Row[], change: ChangeEvent<Row>) => void;
  columns: ColumnDef<Row>[];
  getRowKey: (row: Row, index: number) => string;

  selection?: Selection | null;
  onSelectionChange?: (selection: Selection | null) => void;

  activeCell?: CellAddress | null;
  onActiveCellChange?: (address: CellAddress | null) => void;

  maxHistory?: number;
};
```

| Prop                 | Required | Description                                                                                           |
| -------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `value`              | ✅       | The controlled row array. The library never mutates it.                                               |
| `onChange`           | ✅       | Called on every mutation. The `change` argument carries the patches, the reason, and both row arrays. |
| `columns`            | ✅       | Column definitions. Order matters — index is the column coordinate.                                   |
| `getRowKey`          | ✅       | Stable key per row. Required because row re-ordering must not force remounts.                         |
| `selection`          | —        | Controlled selection. Omit for internal (hybrid) state.                                               |
| `onSelectionChange`  | —        | Fires whenever the selection changes, whether controlled or internal.                                 |
| `activeCell`         | —        | Controlled active cell. Usually derived from `selection`; set explicitly when they diverge.           |
| `onActiveCellChange` | —        | Fires whenever the active cell changes.                                                               |
| `maxHistory`         | —        | History ring size. Defaults to `200`.                                                                 |

`selection` and `activeCell` follow the **hybrid controlled** pattern: if you don't pass them, the hook falls back to internal state; if you do, the hook treats the prop as truth. Never mix (don't pass `selection` but omit `onSelectionChange`).

See [ADR 0001](https://github.com/matsupiee/excellent-react-spreadsheet/blob/main/docs/decisions/0001-selection-hybrid-controlled.md) for the reasoning.

## Return value

```ts
type UseSpreadsheetReturn<Row> = {
  rows: Row[];
  columns: ColumnDef<Row>[];
  rowMeta: RowMeta[];
  columnMeta: ColumnMeta[];

  selection: Selection | null;
  setSelection: (selection: Selection | null) => void;
  activeCell: CellAddress | null;
  setActiveCell: (address: CellAddress | null) => void;

  startEdit: (address?: CellAddress) => void;
  commitEdit: () => void;
  cancelEdit: () => void;

  applyPatches: (patches: CellPatch[], opts?: ApplyPatchesOptions) => void;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;

  copy: () => ClipboardPayload | null;
  paste: (text: string) => void;
  cut: () => ClipboardPayload | null;
};
```

### Snapshots

`rows`, `columns`, `rowMeta`, `columnMeta` are the immutable snapshots you render from. `rowMeta[i].key` is `getRowKey(rows[i], i)` — use it as the React key.

### Mutations

Everything goes through `applyPatches`. See [Undo / Redo](/guide/undo-redo) for why.

```ts
type ApplyPatchesOptions = {
  reason?: ChangeReason; // 'edit' | 'paste' | 'fill' | 'undo' | 'redo' | 'delete'
  label?: string; // user-visible string for the history entry
  coalesceKey?: string; // same key + < 500ms → merge with prior entry
  skipHistory?: boolean; // don't push onto the history stack
};
```

### Edit placeholders

`startEdit` / `commitEdit` / `cancelEdit` are placeholder methods today — they do nothing until the `<Spreadsheet>` component lands. Continue driving editing from your own renderer.

### Clipboard

`copy()` returns `{ text, html }` or `null` if no selection. `paste(text)` parses the incoming string and applies the resulting patches. `cut()` returns the payload and clears the selected cells in one history entry.

## Internal refs

The hook keeps `value`, `columns`, `onChange`, and `selection` on refs so that `applyPatches`, `undo`, etc. stay stable across renders. You can safely reference them from effects without the linter yelling.
