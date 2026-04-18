import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { CellAddress, CellContext } from '../types.js';
import { floatColumn } from './floatColumn.js';

type Row = {
  id: string;
  price: number;
  ratio: number | null;
};

const makeRow = (overrides: Partial<Row> = {}): Row => ({
  id: 'id-0',
  price: 9.99,
  ratio: null,
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

describe('floatColumn', () => {
  it('reads and writes the float value', () => {
    const column = floatColumn<Row, 'price'>({ key: 'price', title: 'Price' });
    expect(column.getValue(makeRow({ price: 12.5 }))).toBe(12.5);

    const next = column.setValue(makeRow(), 3.14);
    expect(next.price).toBe(3.14);
  });

  it('deserializes empty string to null', () => {
    const column = floatColumn<Row, 'ratio'>({ key: 'ratio', title: 'Ratio' });
    const deserialize = getDeserialize(column);
    expect(deserialize('')).toBeNull();
    expect(deserialize('   ')).toBeNull();
  });

  it('parses decimal strings', () => {
    const column = floatColumn<Row, 'price'>({ key: 'price', title: 'Price' });
    const deserialize = getDeserialize(column);
    expect(deserialize('3.14')).toBe(3.14);
    expect(deserialize('-0.5')).toBe(-0.5);
    expect(deserialize('  2.0  ')).toBe(2);
  });

  it('returns null for non-numeric text (paste safety)', () => {
    const column = floatColumn<Row, 'price'>({ key: 'price', title: 'Price' });
    const deserialize = getDeserialize(column);
    expect(deserialize('abc')).toBeNull();
  });

  it('clamps to min/max on deserialize', () => {
    const column = floatColumn<Row, 'price'>({
      key: 'price',
      title: 'Price',
      min: 0,
      max: 10,
    });
    const deserialize = getDeserialize(column);
    expect(deserialize('-1.5')).toBe(0);
    expect(deserialize('15.3')).toBe(10);
    expect(deserialize('5.5')).toBe(5.5);
  });

  it('renders precision-formatted display without mutating the stored value', () => {
    const column = floatColumn<Row, 'price'>({ key: 'price', title: 'Price', precision: 2 });
    const renderCell = column.renderCell;
    if (renderCell === undefined) throw new Error('renderCell missing');

    const ctx: CellContext<Row, number | null> = {
      value: 3.14159,
      row: makeRow({ price: 3.14159 }),
      rowIndex: 0,
      address,
    };
    render(<>{renderCell(ctx)}</>);
    const el = screen.getByText('3.14');
    expect(el).toHaveStyle({ textAlign: 'right' });

    // Stored value stays full precision.
    const next = column.setValue(makeRow(), 3.14159);
    expect(next.price).toBe(3.14159);
  });

  it('renders empty for null, right-aligned span', () => {
    const column = floatColumn<Row, 'ratio'>({ key: 'ratio', title: 'Ratio', precision: 3 });
    const renderCell = column.renderCell;
    if (renderCell === undefined) throw new Error('renderCell missing');

    const ctx: CellContext<Row, number | null> = {
      value: null,
      row: makeRow({ ratio: null }),
      rowIndex: 0,
      address,
    };
    const { container } = render(<>{renderCell(ctx)}</>);
    const span = container.querySelector('span');
    expect(span).not.toBeNull();
    expect(span?.textContent).toBe('');
  });

  it('round-trips float values through serialize/deserialize', () => {
    const column = floatColumn<Row, 'price'>({ key: 'price', title: 'Price' });
    const serialize = getSerialize<number | null>(column);
    const deserialize = getDeserialize(column);

    for (const value of [0, 1.5, -2.25, 100, -0.0001]) {
      expect(deserialize(serialize(value))).toBe(value);
    }
    expect(serialize(null)).toBe('');
    expect(deserialize(serialize(null))).toBeNull();
  });
});
