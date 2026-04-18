import type { ReactNode } from 'react';

import type { CellContext, ColumnDef, ColumnWidth, EditorContext } from '../types.js';

export type CustomColumnOptions<Row, Value> = {
  key: string;
  title: ReactNode;
  width?: ColumnWidth;
  frozen?: 'left' | 'right';
  readOnly?: boolean | ((row: Row) => boolean);
  renderCell: (ctx: CellContext<Row, Value>) => ReactNode;
  renderEditor?: (ctx: EditorContext<Row, Value>) => ReactNode;
  serialize?: (value: Value) => string;
  deserialize?: (text: string) => Value;
  getValue?: (row: Row) => Value;
  setValue?: (row: Row, value: Value) => Row;
};

// Safe typed read: treat the row as an index-signature record, then narrow via unknown → Value.
const defaultGetValue = <Row, Value>(key: string) => {
  return (row: Row): Value => {
    const record = row as unknown as Record<string, unknown>;
    return record[key] as Value;
  };
};

const defaultSetValue = <Row, Value>(key: string) => {
  return (row: Row, value: Value): Row => {
    const record = row as unknown as Record<string, unknown>;
    return { ...record, [key]: value } as unknown as Row;
  };
};

export function customColumn<Row, Value>(
  options: CustomColumnOptions<Row, Value>,
): ColumnDef<Row, Value> {
  const {
    key,
    title,
    width,
    frozen,
    readOnly,
    renderCell,
    renderEditor,
    serialize,
    deserialize,
    getValue,
    setValue,
  } = options;

  const column: ColumnDef<Row, Value> = {
    key,
    title,
    getValue: getValue ?? defaultGetValue<Row, Value>(key),
    setValue: setValue ?? defaultSetValue<Row, Value>(key),
    renderCell,
  };

  if (width !== undefined) {
    column.width = width;
  }
  if (frozen !== undefined) {
    column.frozen = frozen;
  }
  if (readOnly !== undefined) {
    column.readOnly = readOnly;
  }
  if (renderEditor !== undefined) {
    column.renderEditor = renderEditor;
  }
  // Intentionally do not default serialize/deserialize — leave undefined so the
  // core can decide behavior later (see api-draft.md §2.2).
  if (serialize !== undefined) {
    column.serialize = serialize;
  }
  if (deserialize !== undefined) {
    column.deserialize = deserialize;
  }

  return column;
}
