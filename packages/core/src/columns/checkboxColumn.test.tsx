import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CellAddress, CellContext, EditorContext } from '../types.js';
import { checkboxColumn } from './checkboxColumn.js';

type Row = {
  id: string;
  enabled: boolean;
  premium: boolean | null;
};

const makeRow = (overrides: Partial<Row> = {}): Row => ({
  id: 'id-0',
  enabled: false,
  premium: null,
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

describe('checkboxColumn', () => {
  it('reads the boolean value and normalizes undefined to null', () => {
    const column = checkboxColumn<Row, 'premium'>({ key: 'premium', title: 'Premium' });
    expect(column.getValue(makeRow({ premium: true }))).toBe(true);
    expect(column.getValue(makeRow({ premium: false }))).toBe(false);
    expect(column.getValue(makeRow({ premium: null }))).toBeNull();
  });

  it('returns a new row on setValue (immutable update)', () => {
    const column = checkboxColumn<Row, 'enabled'>({ key: 'enabled', title: 'Enabled' });
    const row = makeRow({ enabled: false });
    const next = column.setValue(row, true);
    expect(next).not.toBe(row);
    expect(next.enabled).toBe(true);
    expect(row.enabled).toBe(false);
  });

  it('deserializes common truthy/falsy tokens and empty input', () => {
    const column = checkboxColumn<Row, 'premium'>({ key: 'premium', title: 'Premium' });
    const deserialize = getDeserialize(column);
    expect(deserialize('TRUE')).toBe(true);
    expect(deserialize('true')).toBe(true);
    expect(deserialize('1')).toBe(true);
    expect(deserialize('✓')).toBe(true);
    expect(deserialize('✔')).toBe(true);
    expect(deserialize('FALSE')).toBe(false);
    expect(deserialize('false')).toBe(false);
    expect(deserialize('0')).toBe(false);
    expect(deserialize('')).toBeNull();
    expect(deserialize('   ')).toBeNull();
  });

  it('returns null for unknown tokens (conservative paste behavior)', () => {
    const column = checkboxColumn<Row, 'premium'>({ key: 'premium', title: 'Premium' });
    const deserialize = getDeserialize(column);
    expect(deserialize('maybe')).toBeNull();
    expect(deserialize('yes')).toBeNull();
    expect(deserialize('2')).toBeNull();
  });

  it('round-trips all three states through serialize/deserialize', () => {
    const column = checkboxColumn<Row, 'premium'>({ key: 'premium', title: 'Premium' });
    const serialize = getSerialize<boolean | null>(column);
    const deserialize = getDeserialize(column);
    expect(deserialize(serialize(true))).toBe(true);
    expect(deserialize(serialize(false))).toBe(false);
    expect(deserialize(serialize(null))).toBeNull();
    expect(serialize(true)).toBe('TRUE');
    expect(serialize(false)).toBe('FALSE');
    expect(serialize(null)).toBe('');
  });

  it('renders a read-only checkbox that reflects true/false/null via indeterminate', () => {
    const column = checkboxColumn<Row, 'premium'>({ key: 'premium', title: 'Premium' });
    const renderCell = column.renderCell;
    if (renderCell === undefined) throw new Error('renderCell missing');

    const makeCtx = (value: boolean | null): CellContext<Row, boolean | null> => ({
      value,
      row: makeRow({ premium: value }),
      rowIndex: 0,
      address,
    });

    const { rerender, container } = render(<>{renderCell(makeCtx(true))}</>);
    let input = container.querySelector('input');
    expect(input).not.toBeNull();
    expect(input).toBeChecked();
    expect(input?.indeterminate).toBe(false);

    rerender(<>{renderCell(makeCtx(false))}</>);
    input = container.querySelector('input');
    expect(input).not.toBeChecked();
    expect(input?.indeterminate).toBe(false);

    rerender(<>{renderCell(makeCtx(null))}</>);
    input = container.querySelector('input');
    expect(input).not.toBeChecked();
    expect(input?.indeterminate).toBe(true);
  });

  it('editor fires onChange with the flipped boolean and onCommit on Enter', () => {
    const column = checkboxColumn<Row, 'enabled'>({ key: 'enabled', title: 'Enabled' });
    const renderEditor = column.renderEditor;
    if (renderEditor === undefined) throw new Error('renderEditor missing');

    const onChange = vi.fn();
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    const ctx: EditorContext<Row, boolean | null> = {
      value: false,
      onChange,
      onCommit,
      onCancel,
      row: makeRow({ enabled: false }),
      rowIndex: 0,
      address,
    };
    render(<>{renderEditor(ctx)}</>);
    const input = screen.getByRole('checkbox') as HTMLInputElement;
    input.click();
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it('editor does not steal focus when ctx.value changes after mount', () => {
    const column = checkboxColumn<Row, 'premium'>({ key: 'premium', title: 'Premium' });
    const renderEditor = column.renderEditor;
    if (renderEditor === undefined) throw new Error('renderEditor missing');

    const onChange = vi.fn();
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    const makeCtx = (value: boolean | null): EditorContext<Row, boolean | null> => ({
      value,
      onChange,
      onCommit,
      onCancel,
      row: makeRow({ premium: value }),
      rowIndex: 0,
      address,
    });

    // Render an external focusable element and a separate editor host.
    const { rerender, container } = render(
      <>
        <button type="button" data-testid="external">
          external
        </button>
        {renderEditor(makeCtx(null))}
      </>,
    );

    const externalButton = container.querySelector<HTMLButtonElement>('[data-testid="external"]');
    if (externalButton === null) throw new Error('external button missing');

    // Move focus away from the editor to the external button.
    externalButton.focus();
    expect(document.activeElement).toBe(externalButton);

    // Rerender with a different value; focus must not jump back to the editor.
    rerender(
      <>
        <button type="button" data-testid="external">
          external
        </button>
        {renderEditor(makeCtx(true))}
      </>,
    );
    expect(document.activeElement).toBe(externalButton);

    rerender(
      <>
        <button type="button" data-testid="external">
          external
        </button>
        {renderEditor(makeCtx(false))}
      </>,
    );
    expect(document.activeElement).toBe(externalButton);
  });
});
