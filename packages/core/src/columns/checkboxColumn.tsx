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

function CheckboxDisplay({
  value,
  onValueChange,
}: {
  value: boolean | null;
  onValueChange?: (next: boolean | null) => void;
}): ReactNode {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (ref.current !== null) {
      ref.current.indeterminate = value === null;
    }
  }, [value]);
  // When the host passes `onValueChange`, the checkbox is interactive: a
  // single click toggles the value without first entering edit mode (Google
  // Sheets behaviour). `null`/`false` → `true`, `true` → `false`. Without
  // `onValueChange` we render a read-only display (see ADR 0005).
  const interactive = onValueChange !== undefined;
  return (
    <span style={centerAlign}>
      <input
        ref={ref}
        type="checkbox"
        checked={value === true}
        tabIndex={-1}
        readOnly={!interactive}
        onChange={
          interactive
            ? () => {
                onValueChange(value !== true);
              }
            : undefined
        }
      />
    </span>
  );
}

function renderCheckboxCell<Row>(ctx: CellContext<Row, boolean | null>): ReactNode {
  // Forward `onValueChange` only when the host provided one — under
  // `exactOptionalPropertyTypes` we can't pass `undefined` through.
  if (ctx.onValueChange === undefined) {
    return <CheckboxDisplay value={ctx.value} />;
  }
  return <CheckboxDisplay value={ctx.value} onValueChange={ctx.onValueChange} />;
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
