import { useEffect, useRef, type ReactNode } from 'react';

import type { CellContext, ColumnDef, ColumnWidth, EditorContext } from '../types.js';

export type BooleanKeysOf<Row> = {
  [K in keyof Row]: Row[K] extends boolean | null | undefined
    ? boolean extends Extract<Row[K], boolean>
      ? K
      : never
    : never;
}[keyof Row] &
  string;

export type CheckboxColumnOptions<Row, K extends BooleanKeysOf<Row>> = {
  key: K;
  title: ReactNode;
  width?: ColumnWidth;
};

const centerAlign = { textAlign: 'center' as const };

const TRUE_TOKENS = new Set(['true', '1', '✓', '✔']);
const FALSE_TOKENS = new Set(['false', '0']);

export const parseCheckboxInput = (raw: string): boolean | null => {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const lowered = trimmed.toLowerCase();
  if (TRUE_TOKENS.has(lowered)) return true;
  if (FALSE_TOKENS.has(lowered)) return false;
  return null;
};

export const serializeCheckbox = (value: boolean | null): string => {
  if (value === true) return 'TRUE';
  if (value === false) return 'FALSE';
  return '';
};

function CheckboxDisplay({ value }: { value: boolean | null }): ReactNode {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (ref.current !== null) {
      ref.current.indeterminate = value === null;
    }
  }, [value]);
  return (
    <span style={centerAlign}>
      <input ref={ref} type="checkbox" checked={value === true} readOnly tabIndex={-1} />
    </span>
  );
}

function renderCheckboxCell<Row>({ value }: CellContext<Row, boolean | null>): ReactNode {
  return <CheckboxDisplay value={value} />;
}

function CheckboxEditor<Row>({ ctx }: { ctx: EditorContext<Row, boolean | null> }): ReactNode {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  useEffect(() => {
    if (ref.current !== null) {
      ref.current.indeterminate = ctx.value === null;
    }
  }, [ctx.value]);
  return (
    <span style={centerAlign}>
      <input
        ref={ref}
        type="checkbox"
        checked={ctx.value === true}
        onChange={(event) => {
          ctx.onChange(event.target.checked);
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
    </span>
  );
}

function renderCheckboxEditor<Row>(ctx: EditorContext<Row, boolean | null>): ReactNode {
  return <CheckboxEditor ctx={ctx} />;
}

export function checkboxColumn<Row, K extends BooleanKeysOf<Row>>(
  options: CheckboxColumnOptions<Row, K>,
): ColumnDef<Row, boolean | null> {
  const { key, title, width } = options;

  const column: ColumnDef<Row, boolean | null> = {
    key,
    title,
    getValue: (row) => {
      const raw = row[key] as boolean | null | undefined;
      return raw === undefined ? null : raw;
    },
    setValue: (row, value) => ({
      ...row,
      [key]: value,
    }),
    renderCell: (ctx) => renderCheckboxCell(ctx),
    renderEditor: (ctx) => renderCheckboxEditor(ctx),
    serialize: serializeCheckbox,
    deserialize: parseCheckboxInput,
  };

  if (width !== undefined) {
    column.width = width;
  }

  return column;
}
