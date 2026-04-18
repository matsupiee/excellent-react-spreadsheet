import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CellAddress, CellContext, EditorContext } from '../types.js';
import { customColumn } from './customColumn.js';

type Row = {
  id: string;
  name: string;
  tags: string[];
  readonlyFlag: boolean;
};

const makeRow = (overrides: Partial<Row> = {}): Row => ({
  id: 'id-0',
  name: 'Alice',
  tags: ['a', 'b'],
  readonlyFlag: false,
  ...overrides,
});

const address: CellAddress = { row: 0, col: 0 };

describe('customColumn', () => {
  it('uses a default getValue that reads row[key] when none is provided', () => {
    const column = customColumn<Row, string>({
      key: 'name',
      title: 'Name',
      renderCell: (ctx) => <span>{ctx.value}</span>,
    });
    expect(column.getValue(makeRow({ name: 'Bob' }))).toBe('Bob');
  });

  it('uses a default setValue that returns a new row with the key updated', () => {
    const column = customColumn<Row, string>({
      key: 'name',
      title: 'Name',
      renderCell: (ctx) => <span>{ctx.value}</span>,
    });
    const row = makeRow();
    const next = column.setValue(row, 'Carol');

    expect(next).not.toBe(row);
    expect(next.name).toBe('Carol');
    expect(row.name).toBe('Alice');
    expect(next.tags).toBe(row.tags);
  });

  it('uses the caller-provided getValue override instead of the default', () => {
    const column = customColumn<Row, string>({
      key: 'tags',
      title: 'Tags',
      getValue: (row) => row.tags.join(','),
      renderCell: (ctx) => <span>{ctx.value}</span>,
    });
    expect(column.getValue(makeRow({ tags: ['x', 'y', 'z'] }))).toBe('x,y,z');
  });

  it('uses the caller-provided setValue override instead of the default', () => {
    const column = customColumn<Row, string>({
      key: 'tags',
      title: 'Tags',
      getValue: (row) => row.tags.join(','),
      setValue: (row, value) => ({ ...row, tags: value.split(',') }),
      renderCell: (ctx) => <span>{ctx.value}</span>,
    });
    const row = makeRow({ tags: ['a'] });
    const next = column.setValue(row, 'p,q');
    expect(next).not.toBe(row);
    expect(next.tags).toEqual(['p', 'q']);
    expect(row.tags).toEqual(['a']);
  });

  it('passes readOnly through as a boolean', () => {
    const column = customColumn<Row, string>({
      key: 'name',
      title: 'Name',
      readOnly: true,
      renderCell: (ctx) => <span>{ctx.value}</span>,
    });
    expect(column.readOnly).toBe(true);
  });

  it('passes readOnly through as a predicate function', () => {
    const predicate = (row: Row): boolean => row.readonlyFlag;
    const column = customColumn<Row, string>({
      key: 'name',
      title: 'Name',
      readOnly: predicate,
      renderCell: (ctx) => <span>{ctx.value}</span>,
    });
    expect(column.readOnly).toBe(predicate);
    if (typeof column.readOnly !== 'function') {
      throw new Error('expected readOnly to be a function');
    }
    expect(column.readOnly(makeRow({ readonlyFlag: true }))).toBe(true);
    expect(column.readOnly(makeRow({ readonlyFlag: false }))).toBe(false);
  });

  it('leaves serialize and deserialize undefined when the caller does not supply them', () => {
    const column = customColumn<Row, string>({
      key: 'name',
      title: 'Name',
      renderCell: (ctx) => <span>{ctx.value}</span>,
    });
    expect(column.serialize).toBeUndefined();
    expect(column.deserialize).toBeUndefined();
  });

  it('round-trips values through caller-supplied serialize / deserialize', () => {
    const column = customColumn<Row, string[]>({
      key: 'tags',
      title: 'Tags',
      renderCell: (ctx) => <span>{ctx.value.join(',')}</span>,
      serialize: (value) => value.join('|'),
      deserialize: (text) => (text === '' ? [] : text.split('|')),
    });

    const serialize = column.serialize;
    const deserialize = column.deserialize;
    if (serialize === undefined || deserialize === undefined) {
      throw new Error('serialize/deserialize should be defined when provided');
    }

    for (const input of [[], ['one'], ['a', 'b', 'c'], ['日本語', 'emoji']]) {
      expect(deserialize(serialize(input))).toEqual(input);
    }
  });

  it('passes through width and frozen when provided', () => {
    const column = customColumn<Row, string>({
      key: 'name',
      title: 'Name',
      width: 200,
      frozen: 'left',
      renderCell: (ctx) => <span>{ctx.value}</span>,
    });
    expect(column.width).toBe(200);
    expect(column.frozen).toBe('left');
  });

  it('omits width and frozen from the column when not provided', () => {
    const column = customColumn<Row, string>({
      key: 'name',
      title: 'Name',
      renderCell: (ctx) => <span>{ctx.value}</span>,
    });
    expect(column.width).toBeUndefined();
    expect(column.frozen).toBeUndefined();
    expect(column.readOnly).toBeUndefined();
  });

  it('invokes the caller-provided renderCell as-is', () => {
    const renderCell = vi.fn((ctx: CellContext<Row, string>) => (
      <span data-testid="custom-cell">{`!${ctx.value}!`}</span>
    ));
    const column = customColumn<Row, string>({
      key: 'name',
      title: 'Name',
      renderCell,
    });
    if (column.renderCell === undefined) throw new Error('renderCell missing');

    const ctx: CellContext<Row, string> = {
      value: 'Hello',
      row: makeRow({ name: 'Hello' }),
      rowIndex: 0,
      address,
    };
    render(<>{column.renderCell(ctx)}</>);

    expect(renderCell).toHaveBeenCalledWith(ctx);
    expect(screen.getByTestId('custom-cell')).toHaveTextContent('!Hello!');
  });

  it('invokes the caller-provided renderEditor as-is', () => {
    const renderEditor = vi.fn((ctx: EditorContext<Row, string>) => (
      <input
        data-testid="custom-editor"
        value={ctx.value}
        onChange={(event) => {
          ctx.onChange(event.target.value);
        }}
      />
    ));
    const column = customColumn<Row, string>({
      key: 'name',
      title: 'Name',
      renderCell: (ctx) => <span>{ctx.value}</span>,
      renderEditor,
    });
    if (column.renderEditor === undefined) throw new Error('renderEditor missing');

    const ctx: EditorContext<Row, string> = {
      value: 'Hi',
      onChange: vi.fn(),
      onCommit: vi.fn(),
      onCancel: vi.fn(),
      row: makeRow({ name: 'Hi' }),
      rowIndex: 0,
      address,
    };
    render(<>{column.renderEditor(ctx)}</>);

    expect(renderEditor).toHaveBeenCalledWith(ctx);
    expect(screen.getByTestId('custom-editor')).toHaveValue('Hi');
  });

  it('leaves renderEditor undefined when the caller does not supply one', () => {
    const column = customColumn<Row, string>({
      key: 'name',
      title: 'Name',
      renderCell: (ctx) => <span>{ctx.value}</span>,
    });
    expect(column.renderEditor).toBeUndefined();
  });
});
