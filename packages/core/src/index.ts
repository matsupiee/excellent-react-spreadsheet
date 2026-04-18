export const VERSION = '0.0.0';

export type {
  CellAddress,
  CellContext,
  CellPatch,
  CellRange,
  ChangeEvent,
  ChangeReason,
  ColumnDef,
  ColumnMeta,
  ColumnWidth,
  EditorContext,
  RowMeta,
  Selection,
  SpreadsheetRef,
  UseSpreadsheetProps,
  UseSpreadsheetReturn,
} from './types.js';

export { useSpreadsheet } from './useSpreadsheet.js';

export { textColumn } from './columns/textColumn.js';
export type { TextColumnKey, TextColumnOptions } from './columns/textColumn.js';
