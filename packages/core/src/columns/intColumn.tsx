import type { ReactNode } from 'react';

import type { CellContext, ColumnDef, ColumnWidth, EditorContext } from '../types.js';
import { clamp, isBlank } from './numeric.js';

export type IntegerKeysOf<Row> = {
  [K in keyof Row]: Row[K] extends number | null | undefined
    ? number extends Extract<Row[K], number>
      ? K
      : never
    : never;
}[keyof Row] &
  string;

export type IntColumnOptions<Row, K extends IntegerKeysOf<Row>> = {
  key: K;
  title: ReactNode;
  width?: ColumnWidth;
  min?: number;
  max?: number;
  step?: number;
};

const rightAlign = { textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const };

export const parseIntegerInput = (
  raw: string,
  min: number | undefined,
  max: number | undefined,
): { ok: true; value: number | null } | { ok: false } => {
  if (isBlank(raw)) return { ok: true, value: null };
  const parsed = Number.parseInt(raw.trim(), 10);
  if (Number.isNaN(parsed)) return { ok: false };
  return { ok: true, value: clamp(Math.trunc(parsed), min, max) };
};

function renderIntCell<Row>({ value }: CellContext<Row, number | null>): ReactNode {
  return (
    <span style={rightAlign}>{value === null || value === undefined ? '' : String(value)}</span>
  );
}

function renderIntEditor<Row>(
  ctx: EditorContext<Row, number | null>,
  min: number | undefined,
  max: number | undefined,
): ReactNode {
  const display = ctx.value === null || ctx.value === undefined ? '' : String(ctx.value);
  return (
    <input
      type="text"
      inputMode="numeric"
      autoFocus
      defaultValue={display}
      style={rightAlign}
      onChange={(event) => {
        const parsed = parseIntegerInput(event.target.value, min, max);
        if (parsed.ok) ctx.onChange(parsed.value);
      }}
      onBlur={() => {
        ctx.onCommit();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          ctx.onCommit();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          ctx.onCancel();
        }
      }}
    />
  );
}

export function intColumn<Row, K extends IntegerKeysOf<Row>>(
  options: IntColumnOptions<Row, K>,
): ColumnDef<Row, number | null> {
  const { key, title, width, min, max } = options;

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
    renderCell: (ctx) => renderIntCell(ctx),
    renderEditor: (ctx) => renderIntEditor(ctx, min, max),
    serialize: (value) => (value === null ? '' : String(value)),
    deserialize: (text) => {
      const parsed = parseIntegerInput(text, min, max);
      return parsed.ok ? parsed.value : null;
    },
  };

  if (width !== undefined) {
    column.width = width;
  }

  return column;
}
