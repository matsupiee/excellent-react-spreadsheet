# API Reference

A map of every public export in `excellent-react-spreadsheet`. All identifiers listed here are exported from the package root unless noted otherwise.

## Hook

| Export                                   | Kind | Notes                                                         |
| ---------------------------------------- | ---- | ------------------------------------------------------------- |
| [`useSpreadsheet`](/api/use-spreadsheet) | Hook | Controlled rows, selection, active cell, + imperative helpers |

## Column factories

| Export                                          | Kind    | Notes                                   |
| ----------------------------------------------- | ------- | --------------------------------------- |
| [`textColumn`](/api/columns#textcolumn)         | Factory | `string`-valued column                  |
| [`intColumn`](/api/columns#intcolumn)           | Factory | `number \| null` with clamping          |
| [`floatColumn`](/api/columns#floatcolumn)       | Factory | `number \| null`, precision + formatter |
| [`checkboxColumn`](/api/columns#checkboxcolumn) | Factory | `boolean \| null`                       |
| [`dateColumn`](/api/columns#datecolumn)         | Factory | `Date \| null`, ISO serialization       |
| [`selectColumn`](/api/columns#selectcolumn)     | Factory | Typed option set                        |
| [`customColumn`](/api/columns#customcolumn)     | Factory | Manual `renderCell` and `renderEditor`  |

## Engines

| Export                                         | Kind     | Notes                                              |
| ---------------------------------------------- | -------- | -------------------------------------------------- |
| [`createHistory`](/api/history)                | Factory  | Stand-alone patch-based undo engine                |
| [`serializeRange`](/api/clipboard)             | Function | Build TSV + HTML from a range                      |
| [`parseClipboard`](/api/clipboard)             | Function | TSV/CSV aware parser                               |
| [`buildPastePatches`](/api/clipboard)          | Function | Convert a parsed matrix into `CellPatch[]`         |
| [`useRowVirtualizer`](/api/virtualizer)        | Hook     | Memoized wrapper around `computeRowVirtualization` |
| [`computeRowVirtualization`](/api/virtualizer) | Function | Pure virtualization math                           |

## Types

Most of these are re-exported from the package root. Pick them up via `import type { ... }`.

```ts
import type {
  CellAddress,
  CellRange,
  CellPatch,
  CellContext,
  ChangeEvent,
  ChangeReason,
  ClipboardPayload,
  ColumnDef,
  ColumnMeta,
  ColumnWidth,
  EditorContext,
  RowMeta,
  Selection,
  SpreadsheetRef,
  UseSpreadsheetProps,
  UseSpreadsheetReturn,
} from 'excellent-react-spreadsheet';
```

## Version

```ts
import { VERSION } from 'excellent-react-spreadsheet';
// "0.0.0" until v1.0
```
