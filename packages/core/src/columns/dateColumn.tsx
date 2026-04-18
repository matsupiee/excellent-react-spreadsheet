import type { ReactNode } from 'react';

import type { CellContext, ColumnDef, ColumnWidth, EditorContext } from '../types.js';

export type DateKeysOf<Row> = {
  [K in keyof Row]: Row[K] extends Date | null | undefined
    ? Date extends Extract<Row[K], Date>
      ? K
      : never
    : never;
}[keyof Row] &
  string;

export type DateColumnOptions<Row, K extends DateKeysOf<Row>> = {
  key: K;
  title: ReactNode;
  width?: ColumnWidth;
  format?: 'yyyy-MM-dd';
  min?: Date;
  max?: Date;
};

const clampDate = (value: Date, min: Date | undefined, max: Date | undefined): Date => {
  let next = value;
  if (min !== undefined && next.getTime() < min.getTime()) next = min;
  if (max !== undefined && next.getTime() > max.getTime()) next = max;
  return next;
};

const pad = (n: number): string => (n < 10 ? `0${n}` : String(n));

const formatIsoDate = (value: Date): string =>
  `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;

export const parseDateInput = (
  raw: string,
  min: Date | undefined,
  max: Date | undefined,
): { ok: true; value: Date | null } | { ok: false } => {
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: true, value: null };
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return { ok: false };
  return { ok: true, value: clampDate(parsed, min, max) };
};

function renderDateCell<Row>({ value }: CellContext<Row, Date | null>): ReactNode {
  return <span>{value === null ? '' : formatIsoDate(value)}</span>;
}

function renderDateEditor<Row>(
  ctx: EditorContext<Row, Date | null>,
  min: Date | undefined,
  max: Date | undefined,
): ReactNode {
  const display = ctx.value === null ? '' : formatIsoDate(ctx.value);
  return (
    <input
      type="date"
      autoFocus
      defaultValue={display}
      min={min !== undefined ? formatIsoDate(min) : undefined}
      max={max !== undefined ? formatIsoDate(max) : undefined}
      onChange={(event) => {
        const parsed = parseDateInput(event.target.value, min, max);
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

export function dateColumn<Row, K extends DateKeysOf<Row>>(
  options: DateColumnOptions<Row, K>,
): ColumnDef<Row, Date | null> {
  const { key, title, width, min, max } = options;

  const column: ColumnDef<Row, Date | null> = {
    key,
    title,
    getValue: (row) => {
      const raw = row[key] as Date | null | undefined;
      return raw === undefined ? null : raw;
    },
    setValue: (row, value) => ({
      ...row,
      [key]: value,
    }),
    renderCell: (ctx) => renderDateCell(ctx),
    renderEditor: (ctx) => renderDateEditor(ctx, min, max),
    serialize: (value) => (value === null ? '' : formatIsoDate(value)),
    deserialize: (text) => {
      const parsed = parseDateInput(text, min, max);
      return parsed.ok ? parsed.value : null;
    },
  };

  if (width !== undefined) {
    column.width = width;
  }

  return column;
}
