import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { CellAddress, CellContext, EditorContext } from '../types.js';
import { textColumn } from './textColumn.js';

type Person = {
  id: string;
  name: string;
  age: number;
};

const makePerson = (overrides: Partial<Person> = {}): Person => ({
  id: 'id-0',
  name: 'Alice',
  age: 30,
  ...overrides,
});

const address: CellAddress = { row: 0, col: 0 };

describe('textColumn', () => {
  it('reads the string value from the row via the configured key', () => {
    const column = textColumn<Person, 'name'>({ key: 'name', title: 'Name' });
    expect(column.getValue(makePerson({ name: 'Bob' }))).toBe('Bob');
  });

  it('returns a new row object when setValue is called (immutable update)', () => {
    const column = textColumn<Person, 'name'>({ key: 'name', title: 'Name' });
    const row = makePerson();
    const next = column.setValue(row, 'Carol');

    expect(next).not.toBe(row);
    expect(next.name).toBe('Carol');
    expect(row.name).toBe('Alice');
    expect(next.age).toBe(row.age);
  });

  it('round-trips values through serialize and deserialize', () => {
    const column = textColumn<Person, 'name'>({ key: 'name', title: 'Name' });
    const serialize = column.serialize;
    const deserialize = column.deserialize;
    if (serialize === undefined || deserialize === undefined) {
      throw new Error('textColumn must expose serialize/deserialize');
    }

    const cases = ['plain', '', 'tab\there', 'unicode 日本語'];
    for (const input of cases) {
      expect(deserialize(serialize(input))).toBe(input);
    }
  });

  it('trims pasted values to maxLength on deserialize and on setValue', () => {
    const column = textColumn<Person, 'name'>({ key: 'name', title: 'Name', maxLength: 3 });
    const deserialize = column.deserialize;
    if (deserialize === undefined) throw new Error('deserialize missing');

    expect(deserialize('abcdef')).toBe('abc');
    expect(deserialize('ab')).toBe('ab');

    const next = column.setValue(makePerson(), 'abcdef');
    expect(next.name).toBe('abc');
  });

  it('renders the cell value as text', () => {
    const column = textColumn<Person, 'name'>({ key: 'name', title: 'Name' });
    const renderCell = column.renderCell;
    if (renderCell === undefined) throw new Error('renderCell missing');

    const ctx: CellContext<Person, string> = {
      value: 'Hello',
      row: makePerson({ name: 'Hello' }),
      rowIndex: 0,
      address,
    };
    render(<>{renderCell(ctx)}</>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('renders the placeholder span when value is empty and placeholder is set', () => {
    const column = textColumn<Person, 'name'>({
      key: 'name',
      title: 'Name',
      placeholder: 'Enter name',
    });
    const renderCell = column.renderCell;
    if (renderCell === undefined) throw new Error('renderCell missing');

    const ctx: CellContext<Person, string> = {
      value: '',
      row: makePerson({ name: '' }),
      rowIndex: 0,
      address,
    };
    render(<>{renderCell(ctx)}</>);
    expect(screen.getByText('Enter name')).toHaveAttribute('data-ers-placeholder', 'true');
  });

  it('renders an editor input that reflects current value and fires onChange/onCommit/onCancel', async () => {
    const column = textColumn<Person, 'name'>({
      key: 'name',
      title: 'Name',
      placeholder: 'ph',
      maxLength: 4,
    });
    const renderEditor = column.renderEditor;
    if (renderEditor === undefined) throw new Error('renderEditor missing');

    const onChange = vi.fn();
    const onCommit = vi.fn();
    const onCancel = vi.fn();

    const ctx: EditorContext<Person, string> = {
      value: 'ab',
      onChange,
      onCommit,
      onCancel,
      row: makePerson({ name: 'ab' }),
      rowIndex: 0,
      address,
    };
    render(<>{renderEditor(ctx)}</>);

    const input = screen.getByPlaceholderText('ph');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('maxlength', '4');
    expect(input).toHaveValue('ab');

    const user = userEvent.setup();
    await user.type(input, 'c');
    expect(onChange).toHaveBeenLastCalledWith('abc');

    await user.keyboard('{Enter}');
    expect(onCommit).toHaveBeenCalledTimes(1);

    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
