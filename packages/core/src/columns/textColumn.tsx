import type { ReactNode } from 'react';

import type { CellContext, ColumnDef, ColumnWidth, EditorContext } from '../types.js';
import { editorInputBaseStyle } from './editor.js';

export type TextColumnKey<Row> = {
  [K in keyof Row]: Row[K] extends string ? K : never;
}[keyof Row] &
  string;

export type TextColumnOptions<Row, K extends TextColumnKey<Row>> = {
  key: K;
  title: ReactNode;
  width?: ColumnWidth;
  placeholder?: string;
  maxLength?: number;
};

const applyMaxLength = (value: string, maxLength: number | undefined): string =>
  maxLength !== undefined && value.length > maxLength ? value.slice(0, maxLength) : value;

function renderTextCell<Row>(
  { value }: CellContext<Row, string>,
  placeholder: string | undefined,
): ReactNode {
  if (value === '' && placeholder !== undefined) {
    return <span data-ers-placeholder="true">{placeholder}</span>;
  }
  return value;
}

function renderTextEditor<Row>(
  ctx: EditorContext<Row, string>,
  placeholder: string | undefined,
  maxLength: number | undefined,
): ReactNode {
  return (
    <input
      type="text"
      size={1}
      autoFocus
      value={ctx.value}
      placeholder={placeholder}
      maxLength={maxLength}
      style={editorInputBaseStyle}
      onChange={(event) => {
        ctx.onChange(applyMaxLength(event.target.value, maxLength));
      }}
      onBlur={() => {
        ctx.onCommit('none');
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          ctx.onCommit(event.shiftKey ? 'up' : 'down');
        } else if (event.key === 'Tab') {
          event.preventDefault();
          ctx.onCommit(event.shiftKey ? 'left' : 'right');
        } else if (event.key === 'Escape') {
          event.preventDefault();
          ctx.onCancel();
        }
      }}
    />
  );
}

export function textColumn<Row, K extends TextColumnKey<Row>>(
  options: TextColumnOptions<Row, K>,
): ColumnDef<Row, string> {
  const { key, title, width, placeholder, maxLength } = options;

  const column: ColumnDef<Row, string> = {
    key,
    title,
    getValue: (row) => {
      // Row[K] constrained to string via TextColumnKey — the cast narrows the generic for TS.
      const raw = row[key] as Row[K] & string;
      return raw;
    },
    setValue: (row, value) => ({
      ...row,
      [key]: applyMaxLength(value, maxLength),
    }),
    renderCell: (ctx) => renderTextCell(ctx, placeholder),
    renderEditor: (ctx) => renderTextEditor(ctx, placeholder, maxLength),
    serialize: (value) => value,
    deserialize: (text) => applyMaxLength(text, maxLength),
  };

  if (width !== undefined) {
    column.width = width;
  }

  return column;
}
