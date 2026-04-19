# Clipboard helpers

Three pure, DOM-less functions powering copy/paste. The hook uses these under the hood; you can call them directly from workers, tests, or SSR code.

```ts
import {
  serializeRange,
  parseClipboard,
  buildPastePatches,
  type SerializedRange,
} from 'excellent-react-spreadsheet';
```

## `serializeRange`

```ts
function serializeRange<Row>(args: {
  rows: Row[];
  columns: ColumnDef<Row>[];
  range: CellRange;
}): SerializedRange;

type SerializedRange = { text: string; html: string };
```

- `text` is Excel-compatible TSV. Fields containing tab, CR, LF, or `"` are quoted, with `""` escapes.
- `html` is a minimal `<table>` mirror for clipboards that prefer `text/html`.
- Columns without `serialize` fall back to `String(value)` (empty string for `null` / `undefined`).

## `parseClipboard`

```ts
function parseClipboard(text: string): string[][];
```

- Auto-detects TSV vs CSV by sniffing unquoted tabs.
- Handles `\r\n`, `\n`, and bare `\r` line endings.
- Handles quoted fields with embedded tabs/newlines and `""` escapes.

## `buildPastePatches`

```ts
function buildPastePatches<Row>(args: {
  rows: Row[];
  columns: ColumnDef<Row>[];
  range: CellRange;
  matrix: string[][];
}): CellPatch[];
```

### Tiling rules

- If the selection is an **exact integer multiple** of the matrix in both dimensions, the matrix tiles (Google Sheets behavior).
- Otherwise the matrix is pasted once at `range.start`.

### Safety rules

- `readOnly` columns are skipped (the function form is evaluated per row).
- Cells beyond the row/column array are skipped — paste does **not** grow the table.
- A column without `deserialize` whose `Value` is not string-compatible (sampled from the first row) is skipped. The rule prevents silent coercion of `"42"` into a `number`.

### Return shape

Returns an array of `{ op: 'set', address, prev, next }` patches, ready to feed into `applyPatches`. The length may be shorter than `matrix.length * matrix[0].length` due to the skip rules above.

## `CellRange`

```ts
type CellRange = {
  start: CellAddress;
  end: CellAddress;
};
```

The helpers normalize `start`/`end` internally, so `{ start: { row: 3, col: 0 }, end: { row: 0, col: 1 } }` behaves the same as `{ start: { row: 0, col: 0 }, end: { row: 3, col: 1 } }`.
