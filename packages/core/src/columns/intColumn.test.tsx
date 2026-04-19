import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { CellAddress, CellContext } from '../types.js';
import { intColumn } from './intColumn.js';

type Row = {
  id: string;
  age: number;
  score: number | null;
};

const makeRow = (overrides: Partial<Row> = {}): Row => ({
  id: 'id-0',
  age: 30,
  score: null,
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

describe('intColumn', () => {
  it('reads the number value from the row via the configured key', () => {
    const column = intColumn<Row, 'age'>({ key: 'age', title: 'Age' });
    expect(column.getValue(makeRow({ age: 42 }))).toBe(42);
  });

  it('returns a new row on setValue (immutable update)', () => {
    const column = intColumn<Row, 'age'>({ key: 'age', title: 'Age' });
    const row = makeRow();
    const next = column.setValue(row, 99);

    expect(next).not.toBe(row);
    expect(next.age).toBe(99);
    expect(row.age).toBe(30);
  });

  it('deserializes empty string to null', () => {
    const column = intColumn<Row, 'score'>({ key: 'score', title: 'Score' });
    const deserialize = getDeserialize(column);
    expect(deserialize('')).toBeNull();
    expect(deserialize('   ')).toBeNull();
  });

  it('parses integer strings', () => {
    const column = intColumn<Row, 'age'>({ key: 'age', title: 'Age' });
    const deserialize = getDeserialize(column);
    expect(deserialize('42')).toBe(42);
    expect(deserialize('-7')).toBe(-7);
    expect(deserialize('  12  ')).toBe(12);
  });

  it('truncates decimal inputs toward zero', () => {
    const column = intColumn<Row, 'age'>({ key: 'age', title: 'Age' });
    const deserialize = getDeserialize(column);
    // Number.parseInt already drops the fractional part.
    expect(deserialize('3.9')).toBe(3);
    expect(deserialize('-3.9')).toBe(-3);
  });

  it('returns null for non-numeric text via deserialize (preserves caller choice)', () => {
    const column = intColumn<Row, 'age'>({ key: 'age', title: 'Age' });
    const deserialize = getDeserialize(column);
    // deserialize receives text from paste: unparsable → null per serialize contract.
    expect(deserialize('abc')).toBeNull();
  });

  it('clamps values to min/max via deserialize', () => {
    const column = intColumn<Row, 'age'>({ key: 'age', title: 'Age', min: 0, max: 100 });
    const deserialize = getDeserialize(column);
    expect(deserialize('-5')).toBe(0);
    expect(deserialize('250')).toBe(100);
    expect(deserialize('50')).toBe(50);
  });

  it('round-trips integer values through serialize/deserialize', () => {
    const column = intColumn<Row, 'age'>({ key: 'age', title: 'Age' });
    const serialize = getSerialize<number | null>(column);
    const deserialize = getDeserialize(column);

    for (const value of [0, 1, -1, 42, -100, 2147483647]) {
      expect(deserialize(serialize(value))).toBe(value);
    }
    expect(serialize(null)).toBe('');
    expect(deserialize(serialize(null))).toBeNull();
  });

  it('renders the cell right-aligned with numeric text', () => {
    const column = intColumn<Row, 'age'>({ key: 'age', title: 'Age' });
    const renderCell = column.renderCell;
    if (renderCell === undefined) throw new Error('renderCell missing');

    const ctx: CellContext<Row, number | null> = {
      value: 42,
      row: makeRow({ age: 42 }),
      rowIndex: 0,
      address,
    };
    render(<>{renderCell(ctx)}</>);
    const el = screen.getByText('42');
    expect(el).toHaveStyle({ textAlign: 'right' });
  });

  it('editor input uses size=1 + width:100% so narrow columns do not widen on edit', () => {
    const column = intColumn<Row, 'age'>({ key: 'age', title: 'Age' });
    const renderEditor = column.renderEditor;
    if (renderEditor === undefined) throw new Error('renderEditor missing');

    const { container } = render(
      <>
        {renderEditor({
          value: 5,
          row: makeRow({ age: 5 }),
          rowIndex: 0,
          address,
          onChange: () => {},
          onCommit: () => {},
          onCancel: () => {},
        })}
      </>,
    );
    const input = container.querySelector('input');
    expect(input).not.toBeNull();
    expect(input?.getAttribute('size')).toBe('1');
    expect(input).toHaveStyle({ width: '100%', minWidth: '0', boxSizing: 'border-box' });
  });

  it('renders an empty span when value is null', () => {
    const column = intColumn<Row, 'score'>({ key: 'score', title: 'Score' });
    const renderCell = column.renderCell;
    if (renderCell === undefined) throw new Error('renderCell missing');

    const ctx: CellContext<Row, number | null> = {
      value: null,
      row: makeRow({ score: null }),
      rowIndex: 0,
      address,
    };
    const { container } = render(<>{renderCell(ctx)}</>);
    const span = container.querySelector('span');
    expect(span).not.toBeNull();
    expect(span?.textContent).toBe('');
  });
});
