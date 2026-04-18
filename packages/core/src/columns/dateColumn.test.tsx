import '@testing-library/jest-dom/vitest';

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { CellAddress, CellContext } from '../types.js';
import { dateColumn } from './dateColumn.js';

type Row = {
  id: string;
  due: Date;
  completedAt: Date | null;
};

const makeRow = (overrides: Partial<Row> = {}): Row => ({
  id: 'id-0',
  due: new Date('2026-01-15T00:00:00Z'),
  completedAt: null,
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

describe('dateColumn', () => {
  it('reads the Date value from the row via the configured key', () => {
    const column = dateColumn<Row, 'due'>({ key: 'due', title: 'Due' });
    const d = new Date('2026-05-01T00:00:00Z');
    expect(column.getValue(makeRow({ due: d }))).toEqual(d);
  });

  it('returns a new row on setValue (immutable update)', () => {
    const column = dateColumn<Row, 'completedAt'>({ key: 'completedAt', title: 'Completed' });
    const row = makeRow({ completedAt: null });
    const d = new Date('2026-04-18T00:00:00Z');
    const next = column.setValue(row, d);
    expect(next).not.toBe(row);
    expect(next.completedAt).toEqual(d);
    expect(row.completedAt).toBeNull();
  });

  it('deserializes empty string to null', () => {
    const column = dateColumn<Row, 'completedAt'>({ key: 'completedAt', title: 'Completed' });
    const deserialize = getDeserialize(column);
    expect(deserialize('')).toBeNull();
    expect(deserialize('   ')).toBeNull();
  });

  it('parses ISO 8601 date strings and ISO datetime strings', () => {
    const column = dateColumn<Row, 'due'>({ key: 'due', title: 'Due' });
    const deserialize = getDeserialize(column);
    const parsed = deserialize('2026-04-18');
    expect(parsed).toBeInstanceOf(Date);
    expect((parsed as Date).toISOString().slice(0, 10)).toBe('2026-04-18');

    const withTime = deserialize('2026-04-18T12:34:56Z');
    expect(withTime).toBeInstanceOf(Date);
  });

  it('returns null for unparseable input (paste safety)', () => {
    const column = dateColumn<Row, 'due'>({ key: 'due', title: 'Due' });
    const deserialize = getDeserialize(column);
    expect(deserialize('not-a-date')).toBeNull();
    expect(deserialize('2026-13-40')).toBeNull();
  });

  it('clamps to min/max on deserialize', () => {
    const min = new Date('2026-01-01T00:00:00Z');
    const max = new Date('2026-12-31T00:00:00Z');
    const column = dateColumn<Row, 'due'>({ key: 'due', title: 'Due', min, max });
    const deserialize = getDeserialize(column);
    const before = deserialize('2025-06-01');
    expect(before).toEqual(min);
    const after = deserialize('2027-06-01');
    expect(after).toEqual(max);
    const within = deserialize('2026-06-15');
    expect((within as Date).toISOString().slice(0, 10)).toBe('2026-06-15');
  });

  it('round-trips dates through serialize/deserialize at day precision', () => {
    const column = dateColumn<Row, 'due'>({ key: 'due', title: 'Due' });
    const serialize = getSerialize<Date | null>(column);
    const deserialize = getDeserialize(column);
    const values = [
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-04-18T00:00:00Z'),
      new Date('1999-12-31T00:00:00Z'),
    ];
    for (const v of values) {
      const roundTripped = deserialize(serialize(v));
      expect((roundTripped as Date).toISOString().slice(0, 10)).toBe(v.toISOString().slice(0, 10));
    }
    expect(serialize(null)).toBe('');
    expect(deserialize(serialize(null))).toBeNull();
  });

  it('renders yyyy-MM-dd for a date cell, empty span for null', () => {
    const column = dateColumn<Row, 'completedAt'>({ key: 'completedAt', title: 'Completed' });
    const renderCell = column.renderCell;
    if (renderCell === undefined) throw new Error('renderCell missing');

    const d = new Date('2026-04-18T00:00:00Z');
    const withValue: CellContext<Row, Date | null> = {
      value: d,
      row: makeRow({ completedAt: d }),
      rowIndex: 0,
      address,
    };
    const { container, rerender } = render(<>{renderCell(withValue)}</>);
    expect(container.querySelector('span')?.textContent).toBe('2026-04-18');

    const nullCtx: CellContext<Row, Date | null> = {
      value: null,
      row: makeRow({ completedAt: null }),
      rowIndex: 0,
      address,
    };
    rerender(<>{renderCell(nullCtx)}</>);
    expect(container.querySelector('span')?.textContent).toBe('');
  });
});
