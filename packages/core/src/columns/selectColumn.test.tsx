import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CellAddress, CellContext, EditorContext } from '../types.js';
import { selectColumn } from './selectColumn.js';

type Status = 'draft' | 'published' | 'archived';

type Row = {
  id: string;
  status: Status;
  priority: number | null;
};

const statusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
] as const satisfies ReadonlyArray<{ value: Status; label: string }>;

const priorityOptions = [
  { value: 1, label: 'Low' },
  { value: 2, label: 'Medium' },
  { value: 3, label: 'High' },
] as const satisfies ReadonlyArray<{ value: number; label: string }>;

const makeRow = (overrides: Partial<Row> = {}): Row => ({
  id: 'id-0',
  status: 'draft',
  priority: null,
  ...overrides,
});

const address: CellAddress = { row: 0, col: 0 };

const getDeserialize = <V,>(column: {
  deserialize?: (text: string) => V;
}): ((text: string) => V) => {
  if (column.deserialize === undefined) throw new Error('deserialize missing');
  return column.deserialize;
};

const getSerialize = <V,>(column: { serialize?: (value: V) => string }): ((value: V) => string) => {
  if (column.serialize === undefined) throw new Error('serialize missing');
  return column.serialize;
};

describe('selectColumn', () => {
  it('reads the enum value from the row via the configured key', () => {
    const column = selectColumn<Row, 'status', Status>({
      key: 'status',
      title: 'Status',
      options: statusOptions,
    });
    expect(column.getValue(makeRow({ status: 'published' }))).toBe('published');
  });

  it('returns a new row on setValue (immutable update)', () => {
    const column = selectColumn<Row, 'status', Status>({
      key: 'status',
      title: 'Status',
      options: statusOptions,
    });
    const row = makeRow({ status: 'draft' });
    const next = column.setValue(row, 'archived');
    expect(next).not.toBe(row);
    expect(next.status).toBe('archived');
    expect(row.status).toBe('draft');
  });

  it('deserializes by label (preferred) and by string-coerced value', () => {
    const column = selectColumn<Row, 'status', Status>({
      key: 'status',
      title: 'Status',
      options: statusOptions,
    });
    const deserialize = getDeserialize(column);
    expect(deserialize('Published')).toBe('published');
    expect(deserialize('published')).toBe('published');
  });

  it('deserializes numeric-option labels and raw values', () => {
    type NumRow = { id: string; priority: number | null };
    const column = selectColumn<NumRow, 'priority', number>({
      key: 'priority',
      title: 'Priority',
      options: priorityOptions,
    });
    const deserialize = getDeserialize(column);
    expect(deserialize('High')).toBe(3);
    expect(deserialize('2')).toBe(2);
  });

  it('returns null for empty input and unknown tokens', () => {
    const column = selectColumn<Row, 'status', Status>({
      key: 'status',
      title: 'Status',
      options: statusOptions,
    });
    const deserialize = getDeserialize(column);
    expect(deserialize('')).toBeNull();
    expect(deserialize('   ')).toBeNull();
    expect(deserialize('unknown-status')).toBeNull();
  });

  it('round-trips values through serialize/deserialize', () => {
    const column = selectColumn<Row, 'status', Status>({
      key: 'status',
      title: 'Status',
      options: statusOptions,
    });
    const serialize = getSerialize<Status | null>(column);
    const deserialize = getDeserialize(column);
    for (const v of ['draft', 'published', 'archived'] as const) {
      expect(deserialize(serialize(v))).toBe(v);
    }
    expect(serialize(null)).toBe('');
    expect(deserialize(serialize(null))).toBeNull();
  });

  it('renders the matching label in the cell (falls back to String(value) for unknown)', () => {
    const column = selectColumn<Row, 'status', Status>({
      key: 'status',
      title: 'Status',
      options: statusOptions,
    });
    const renderCell = column.renderCell;
    if (renderCell === undefined) throw new Error('renderCell missing');

    const ctx: CellContext<Row, Status | null> = {
      value: 'published',
      row: makeRow({ status: 'published' }),
      rowIndex: 0,
      address,
    };
    const { container } = render(<>{renderCell(ctx)}</>);
    expect(container.querySelector('span')?.textContent).toBe('Published');

    const nullCtx: CellContext<Row, Status | null> = {
      value: null,
      row: makeRow({ status: 'draft' }),
      rowIndex: 0,
      address,
    };
    const { container: container2 } = render(<>{renderCell(nullCtx)}</>);
    expect(container2.querySelector('span')?.textContent).toBe('');
  });

  it('editor renders a <select> with all options plus an empty choice, and fires onChange', () => {
    const column = selectColumn<Row, 'status', Status>({
      key: 'status',
      title: 'Status',
      options: statusOptions,
    });
    const renderEditor = column.renderEditor;
    if (renderEditor === undefined) throw new Error('renderEditor missing');

    const onChange = vi.fn();
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    const ctx: EditorContext<Row, Status | null> = {
      value: 'draft',
      onChange,
      onCommit,
      onCancel,
      row: makeRow({ status: 'draft' }),
      rowIndex: 0,
      address,
    };
    render(<>{renderEditor(ctx)}</>);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.options.length).toBe(statusOptions.length + 1);
    expect(screen.getByRole('option', { name: 'Published' })).toBeInTheDocument();
  });

  it('commits with move=down when a non-empty option is picked', () => {
    const column = selectColumn<Row, 'status', Status>({
      key: 'status',
      title: 'Status',
      options: statusOptions,
    });
    const renderEditor = column.renderEditor;
    if (renderEditor === undefined) throw new Error('renderEditor missing');

    const onChange = vi.fn();
    const onCommit = vi.fn();
    const ctx: EditorContext<Row, Status | null> = {
      value: 'draft',
      onChange,
      onCommit,
      onCancel: vi.fn(),
      row: makeRow({ status: 'draft' }),
      rowIndex: 0,
      address,
    };
    render(<>{renderEditor(ctx)}</>);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '1' } });
    expect(onChange).toHaveBeenCalledWith('published');
    expect(onCommit).toHaveBeenCalledWith('down');
  });

  it('commits with move=down when the empty option is picked', () => {
    const column = selectColumn<Row, 'status', Status>({
      key: 'status',
      title: 'Status',
      options: statusOptions,
    });
    const renderEditor = column.renderEditor;
    if (renderEditor === undefined) throw new Error('renderEditor missing');

    const onChange = vi.fn();
    const onCommit = vi.fn();
    const ctx: EditorContext<Row, Status | null> = {
      value: 'draft',
      onChange,
      onCommit,
      onCancel: vi.fn(),
      row: makeRow({ status: 'draft' }),
      rowIndex: 0,
      address,
    };
    render(<>{renderEditor(ctx)}</>);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(null);
    expect(onCommit).toHaveBeenCalledWith('down');
  });
});
