import type { ReactNode } from 'react';

import type { CellContext, ColumnDef, ColumnWidth, EditorContext } from '../types.js';

export type SelectOption<Value> = { value: Value; label: string };

export type SelectColumnOptions<Row, K extends keyof Row, Value extends Row[K]> = {
  key: K & string;
  title: ReactNode;
  width?: ColumnWidth;
  options: ReadonlyArray<SelectOption<Value>>;
};

const findByRaw = <Value,>(
  options: ReadonlyArray<SelectOption<Value>>,
  raw: string,
): SelectOption<Value> | undefined =>
  options.find((o) => o.label === raw || String(o.value) === raw);

const findByValue = <Value,>(
  options: ReadonlyArray<SelectOption<Value>>,
  value: Value | null,
): SelectOption<Value> | undefined => {
  if (value === null) return undefined;
  return options.find((o) => o.value === value);
};

function renderSelectCell<Row, Value>(
  { value }: CellContext<Row, Value | null>,
  options: ReadonlyArray<SelectOption<Value>>,
): ReactNode {
  if (value === null) return <span />;
  const found = findByValue(options, value);
  return <span>{found !== undefined ? found.label : String(value)}</span>;
}

function renderSelectEditor<Row, Value>(
  ctx: EditorContext<Row, Value | null>,
  options: ReadonlyArray<SelectOption<Value>>,
): ReactNode {
  const currentIndex = ctx.value === null ? -1 : options.findIndex((o) => o.value === ctx.value);
  const selectValue = currentIndex === -1 ? '' : String(currentIndex);
  return (
    <select
      autoFocus
      value={selectValue}
      onChange={(event) => {
        const idx = event.target.value === '' ? -1 : Number.parseInt(event.target.value, 10);
        if (idx === -1 || Number.isNaN(idx)) {
          ctx.onChange(null);
          return;
        }
        const option = options[idx];
        if (option !== undefined) ctx.onChange(option.value);
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
    >
      <option value="" />
      {options.map((o, idx) => (
        <option key={String(o.value)} value={String(idx)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function selectColumn<Row, K extends keyof Row, Value extends Row[K]>(
  options: SelectColumnOptions<Row, K, Value>,
): ColumnDef<Row, Value | null> {
  const { key, title, width, options: opts } = options;

  const column: ColumnDef<Row, Value | null> = {
    key,
    title,
    getValue: (row) => {
      const raw = row[key] as Value | null | undefined;
      return raw === undefined ? null : raw;
    },
    setValue: (row, value) => ({
      ...row,
      [key]: value,
    }),
    renderCell: (ctx) => renderSelectCell(ctx, opts),
    renderEditor: (ctx) => renderSelectEditor(ctx, opts),
    serialize: (value) => {
      if (value === null) return '';
      const found = findByValue(opts, value);
      return found !== undefined ? found.label : String(value);
    },
    deserialize: (text) => {
      if (text.trim() === '') return null;
      const found = findByRaw(opts, text);
      return found !== undefined ? found.value : null;
    },
  };

  if (width !== undefined) {
    column.width = width;
  }

  return column;
}
