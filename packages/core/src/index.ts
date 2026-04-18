export const VERSION = '0.0.0';

export type {
  ApplyPatchesOptions,
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

export { createHistory } from './history.js';
export type { HistoryEntry } from './history.js';

export { textColumn } from './columns/textColumn.js';
export type { TextColumnKey, TextColumnOptions } from './columns/textColumn.js';

export { intColumn } from './columns/intColumn.js';
export type { IntColumnOptions, IntegerKeysOf } from './columns/intColumn.js';

export { floatColumn } from './columns/floatColumn.js';
export type { FloatColumnOptions, FloatKeysOf } from './columns/floatColumn.js';

export { checkboxColumn } from './columns/checkboxColumn.js';
export type { BooleanKeysOf, CheckboxColumnOptions } from './columns/checkboxColumn.js';

export { dateColumn } from './columns/dateColumn.js';
export type { DateColumnOptions, DateKeysOf } from './columns/dateColumn.js';

export { selectColumn } from './columns/selectColumn.js';
export type { SelectColumnOptions, SelectOption } from './columns/selectColumn.js';

export { customColumn } from './columns/customColumn.js';
export type { CustomColumnOptions } from './columns/customColumn.js';
