import type { ReactNode } from 'react';

export type CellAddress = {
  row: number;
  col: number;
};

export type CellRange = {
  start: CellAddress;
  end: CellAddress;
};

export type Selection = CellRange;

export type ChangeReason = 'edit' | 'paste' | 'fill' | 'undo' | 'redo' | 'delete';

export type CellPatch =
  | { op: 'set'; address: CellAddress; prev: unknown; next: unknown }
  | { op: 'insertRow'; at: number; row: unknown }
  | { op: 'removeRow'; at: number; row: unknown }
  | { op: 'moveRow'; from: number; to: number };

export type ChangeEvent<Row> = {
  reason: ChangeReason;
  patches: CellPatch[];
  prevRows: Row[];
  nextRows: Row[];
};

export type CellContext<Row, Value> = {
  value: Value;
  row: Row;
  rowIndex: number;
  address: CellAddress;
};

export type CommitMove = 'down' | 'up' | 'right' | 'left' | 'none';

export type EditorContext<Row, Value> = {
  value: Value;
  onChange: (next: Value) => void;
  /**
   * Commit the current draft. Optionally signals the host to move the active
   * cell after applying the patch — Google-Sheets-style: Enter→down,
   * Shift+Enter→up, Tab→right, Shift+Tab→left. `'none'` (or omitted) keeps
   * the active cell where it is, used for blur-driven commits.
   */
  onCommit: (move?: CommitMove) => void;
  onCancel: () => void;
  row: Row;
  rowIndex: number;
  address: CellAddress;
};

export type ColumnWidth = number | `${number}fr`;

export type ColumnDef<Row, Value = unknown> = {
  key: string;
  title: ReactNode;
  width?: ColumnWidth;
  frozen?: 'left' | 'right';
  readOnly?: boolean | ((row: Row) => boolean);
  getValue: (row: Row) => Value;
  setValue: (row: Row, value: Value) => Row;
  renderCell?: (ctx: CellContext<Row, Value>) => ReactNode;
  renderEditor?: (ctx: EditorContext<Row, Value>) => ReactNode;
  serialize?: (value: Value) => string;
  deserialize?: (text: string) => Value;
};

export type RowMeta = {
  index: number;
  key: string;
};

export type ColumnMeta = {
  index: number;
  key: string;
};

export type ApplyPatchesOptions = {
  reason?: ChangeReason;
  label?: string;
  coalesceKey?: string;
  skipHistory?: boolean;
};

export type UseSpreadsheetProps<Row> = {
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

export type ClipboardPayload = {
  text: string;
  html: string;
};

export type UseSpreadsheetReturn<Row> = {
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

export type SpreadsheetRef = {
  focus: () => void;
  undo: () => void;
  redo: () => void;
  setSelection: (selection: Selection | null) => void;
  getSelection: () => Selection | null;
};
