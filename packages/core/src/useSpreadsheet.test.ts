import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ColumnDef, Selection, UseSpreadsheetProps } from './types.js';
import { useSpreadsheet } from './useSpreadsheet.js';

type Person = {
  id: string;
  name: string;
  age: number;
};

const personColumns: ColumnDef<Person>[] = [
  {
    key: 'name',
    title: 'Name',
    getValue: (row) => row.name,
    setValue: (row, value) => ({ ...row, name: value as string }),
  },
  {
    key: 'age',
    title: 'Age',
    getValue: (row) => row.age,
    setValue: (row, value) => ({ ...row, age: value as number }),
  },
];

const makePeople = (count: number): Person[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `id-${i}`,
    name: `Person ${i}`,
    age: 20 + i,
  }));

const baseProps = (
  overrides: Partial<UseSpreadsheetProps<Person>> = {},
): UseSpreadsheetProps<Person> => ({
  value: makePeople(3),
  onChange: vi.fn(),
  columns: personColumns,
  getRowKey: (row) => row.id,
  ...overrides,
});

describe('useSpreadsheet', () => {
  it('reflects controlled value updates in the returned rows and rowMeta', () => {
    const { result, rerender } = renderHook(
      (props: UseSpreadsheetProps<Person>) => useSpreadsheet(props),
      {
        initialProps: baseProps(),
      },
    );

    expect(result.current.rows).toHaveLength(3);
    expect(result.current.rowMeta.map((m) => m.key)).toEqual(['id-0', 'id-1', 'id-2']);

    rerender(baseProps({ value: makePeople(5) }));

    expect(result.current.rows).toHaveLength(5);
    expect(result.current.rowMeta.map((m) => m.key)).toEqual([
      'id-0',
      'id-1',
      'id-2',
      'id-3',
      'id-4',
    ]);
  });

  it('updates selection and tracks activeCell via setSelection (uncontrolled selection)', () => {
    const { result } = renderHook(() => useSpreadsheet(baseProps()));

    expect(result.current.selection).toBeNull();
    expect(result.current.activeCell).toBeNull();

    const next: Selection = { start: { row: 1, col: 0 }, end: { row: 1, col: 1 } };
    act(() => {
      result.current.setSelection(next);
    });

    expect(result.current.selection).toEqual(next);
    expect(result.current.activeCell).toEqual({ row: 1, col: 0 });
  });

  it('honors controlled selection prop and notifies onSelectionChange without mutating internal state', () => {
    const onSelectionChange = vi.fn();
    const initialSelection: Selection = { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } };

    const { result, rerender } = renderHook(
      (props: UseSpreadsheetProps<Person>) => useSpreadsheet(props),
      {
        initialProps: baseProps({ selection: initialSelection, onSelectionChange }),
      },
    );

    expect(result.current.selection).toEqual(initialSelection);

    const proposed: Selection = { start: { row: 2, col: 1 }, end: { row: 2, col: 1 } };
    act(() => {
      result.current.setSelection(proposed);
    });

    expect(onSelectionChange).toHaveBeenCalledWith(proposed);
    expect(result.current.selection).toEqual(initialSelection);

    rerender(baseProps({ selection: proposed, onSelectionChange }));
    expect(result.current.selection).toEqual(proposed);
    expect(result.current.activeCell).toEqual({ row: 2, col: 1 });
  });

  it('invokes getRowKey for every row exactly once per render pass', () => {
    const getRowKey = vi.fn((row: Person) => row.id);
    renderHook(() => useSpreadsheet(baseProps({ getRowKey })));

    expect(getRowKey).toHaveBeenCalledTimes(3);
    expect(getRowKey.mock.calls.map(([row]) => row.id)).toEqual(['id-0', 'id-1', 'id-2']);
  });

  it('exposes column meta derived from the column definitions', () => {
    const { result } = renderHook(() => useSpreadsheet(baseProps()));

    expect(result.current.columnMeta).toEqual([
      { index: 0, key: 'name' },
      { index: 1, key: 'age' },
    ]);
  });
});
