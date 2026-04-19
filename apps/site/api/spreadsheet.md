# `<Spreadsheet>` (Coming soon)

::: warning Not yet shipped
The `<Spreadsheet>` component is part of the v1.0 scope but not exported yet. Today, build your own renderer on top of [`useSpreadsheet`](/api/use-spreadsheet). See [Recipes](/guide/recipes#_1-keyboard-driven-cell-editing).
:::

When released, the component will be a thin wrapper over the hook with default DOM, keyboard bindings, and layout modes.

## Planned props

The authoritative source is [`api-draft.md`](https://github.com/matsupiee/excellent-react-spreadsheet/blob/main/api-draft.md#1-spreadsheet-props) in the repo. Summary:

```ts
type SpreadsheetProps<Row> = {
  // Data
  value: Row[];
  onChange: (rows: Row[], change: ChangeEvent<Row>) => void;
  columns: ColumnDef<Row>[];
  getRowKey: (row: Row, index: number) => string;

  // Layout
  height?: number | `${number}px` | 'auto' | 'parent';
  maxHeight?: number;
  columnWidths?: Record<string, number>;
  onColumnWidthsChange?: (widths: Record<string, number>) => void;

  // Selection (controlled or hybrid)
  selection?: Selection | null;
  onSelectionChange?: (s: Selection | null) => void;
  activeCell?: CellAddress | null;
  onActiveCellChange?: (c: CellAddress | null) => void;

  // Feature toggles
  undoRedo?: boolean; // default: true
  copyPaste?: boolean; // default: true
  rowReorder?: boolean; // default: false
  addRows?: boolean | { onAdd: (count: number) => void };

  // Events
  onKeyDown?: (e: SpreadsheetKeyEvent<Row>) => void;
  onCellEdit?: (edit: CellEdit<Row>) => void;
  onPaste?: (e: PasteEvent<Row>) => void | Promise<void>;

  // Formula (opt-in, separate subpackage)
  formula?: FormulaEngine;

  // Styling
  className?: string;
  classNames?: Partial<Record<SlotName, string>>;
};
```

## Planned imperative handle

```ts
const ref = useRef<SpreadsheetRef>(null);

ref.current.focus();
ref.current.undo();
ref.current.redo();
ref.current.setSelection({ start: { row: 0, col: 0 }, end: { row: 0, col: 0 } });
ref.current.getSelection();
```

Track progress in the [roadmap](/roadmap).
