import type { ReactNode } from 'react';

import type { CellContext, ColumnDef, ColumnWidth, EditorContext } from '../types.js';
import { editorInputBaseStyle } from './editor.js';
import { clamp, isBlank } from './numeric.js';

export type FloatKeysOf<Row> = {
  [K in keyof Row]: Row[K] extends number | null | undefined
    ? number extends Extract<Row[K], number>
      ? K
      : never
    : never;
}[keyof Row] &
  string;

export type FloatColumnOptions<Row, K extends FloatKeysOf<Row>> = {
  key: K;
  title: ReactNode;
  width?: ColumnWidth;
  min?: number;
  max?: number;
  precision?: number;
  formatBlurred?: (value: number) => string;
};

const rightAlign = { textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const };

const editorInputStyle = { ...editorInputBaseStyle, ...rightAlign };

export const parseFloatInput = (
  raw: string,
  min: number | undefined,
  max: number | undefined,
): { ok: true; value: number | null } | { ok: false } => {
  if (isBlank(raw)) return { ok: true, value: null };
  const parsed = Number.parseFloat(raw.trim());
  if (Number.isNaN(parsed)) return { ok: false };
  return { ok: true, value: clamp(parsed, min, max) };
};

const formatDisplay = (
  value: number,
  precision: number | undefined,
  formatBlurred: ((value: number) => string) | undefined,
): string => {
  if (formatBlurred !== undefined) return formatBlurred(value);
  if (precision !== undefined) return value.toFixed(precision);
  return String(value);
};

function renderFloatCell<Row>(
  { value }: CellContext<Row, number | null>,
  precision: number | undefined,
  formatBlurred: ((value: number) => string) | undefined,
): ReactNode {
  return (
    <span style={rightAlign}>
      {value === null || value === undefined ? '' : formatDisplay(value, precision, formatBlurred)}
    </span>
  );
}

function renderFloatEditor<Row>(
  ctx: EditorContext<Row, number | null>,
  min: number | undefined,
  max: number | undefined,
): ReactNode {
  const display = ctx.value === null || ctx.value === undefined ? '' : String(ctx.value);
  return (
    <input
      type="text"
      inputMode="decimal"
      size={1}
      autoFocus
      value={display}
      style={editorInputStyle}
      onChange={(event) => {
        const parsed = parseFloatInput(event.target.value, min, max);
        if (parsed.ok) ctx.onChange(parsed.value);
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

export function floatColumn<Row, K extends FloatKeysOf<Row>>(
  options: FloatColumnOptions<Row, K>,
): ColumnDef<Row, number | null> {
  const { key, title, width, min, max, precision, formatBlurred } = options;

  const column: ColumnDef<Row, number | null> = {
    key,
    title,
    getValue: (row) => {
      const raw = row[key] as number | null | undefined;
      return raw === undefined ? null : raw;
    },
    setValue: (row, value) => ({
      ...row,
      [key]: value,
    }),
    renderCell: (ctx) => renderFloatCell(ctx, precision, formatBlurred),
    renderEditor: (ctx) => renderFloatEditor(ctx, min, max),
    serialize: (value) => (value === null ? '' : String(value)),
    deserialize: (text) => {
      const parsed = parseFloatInput(text, min, max);
      return parsed.ok ? parsed.value : null;
    },
  };

  if (width !== undefined) {
    column.width = width;
  }

  return column;
}
