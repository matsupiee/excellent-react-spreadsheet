import { act, fireEvent, render } from '@testing-library/react';
import { useCallback, useState, type ReactElement } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { Spreadsheet } from './Spreadsheet.js';
import { checkboxColumn } from './columns/checkboxColumn.js';
import { defineColumns } from './columns/defineColumns.js';
import { textColumn } from './columns/textColumn.js';
import type { ChangeEvent, ColumnDef } from './types.js';

type Row = {
  id: string;
  name: string;
};

const columns: ColumnDef<Row>[] = [
  {
    key: 'name',
    title: 'Name',
    getValue: (row) => row.name,
    setValue: (row, value) => ({ ...row, name: value as string }),
    deserialize: (text) => text,
    serialize: (value) => String(value),
  },
];

type MultiRow = {
  id: string;
  name: string;
  note: string;
};

const multiColumns = defineColumns<MultiRow>()(
  textColumn<MultiRow, 'name'>({ key: 'name', title: 'Name' }),
  textColumn<MultiRow, 'note'>({ key: 'note', title: 'Note' }),
);

const makeMultiRows = (count: number): MultiRow[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `id-${String(i)}`,
    name: `Row ${String(i)}`,
    note: `note-${String(i)}`,
  }));

type MultiHarnessProps = { initial: MultiRow[]; viewportHeight: number };

function MultiHarness({ initial, viewportHeight }: MultiHarnessProps): ReactElement {
  const [rows, setRows] = useState<MultiRow[]>(initial);
  const onChange = useCallback((next: MultiRow[], _e: ChangeEvent<MultiRow>) => {
    setRows(next);
  }, []);
  return (
    <Spreadsheet<MultiRow>
      value={rows}
      onChange={onChange}
      columns={multiColumns}
      getRowKey={(row) => row.id}
      rowHeight={28}
      maxHeight={viewportHeight}
    />
  );
}

const makeRows = (count: number): Row[] =>
  Array.from({ length: count }, (_, i) => ({ id: `id-${String(i)}`, name: `Row ${String(i)}` }));

type HarnessProps = {
  initial: Row[];
  viewportHeight: number;
  rowHeight: number;
};

function Harness({ initial, viewportHeight, rowHeight }: HarnessProps): ReactElement {
  const [rows, setRows] = useState<Row[]>(initial);
  const onChange = useCallback((next: Row[], _e: ChangeEvent<Row>) => {
    setRows(next);
  }, []);
  return (
    <Spreadsheet<Row>
      value={rows}
      onChange={onChange}
      columns={columns}
      getRowKey={(row) => row.id}
      rowHeight={rowHeight}
      maxHeight={viewportHeight}
    />
  );
}

/**
 * jsdom doesn't compute layout, so `clientHeight` on every element defaults
 * to 0. We patch the prototype getter so the root `<div>` reports the
 * harness-configured viewport size, which is what the virtualizer reads.
 * We also patch `scrollTop` so that `fireEvent.scroll` with a target scrollTop
 * is reflected back when the component reads `e.currentTarget.scrollTop`.
 */
const scrollTopStore = new WeakMap<Element, number>();
const originalClientHeight = Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight');
const originalScrollTop = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');

let mockedViewportHeight = 200;

beforeAll(() => {
  Object.defineProperty(Element.prototype, 'clientHeight', {
    configurable: true,
    get(): number {
      if ((this as HTMLElement).getAttribute('role') === 'grid') {
        return mockedViewportHeight;
      }
      return 0;
    },
  });
  Object.defineProperty(Element.prototype, 'scrollTop', {
    configurable: true,
    get(): number {
      return scrollTopStore.get(this as Element) ?? 0;
    },
    set(value: number): void {
      scrollTopStore.set(this as Element, value);
    },
  });
});

afterAll(() => {
  // jsdom always provides these descriptors; restore the originals unconditionally.
  if (originalClientHeight !== undefined) {
    Object.defineProperty(Element.prototype, 'clientHeight', originalClientHeight);
  }
  if (originalScrollTop !== undefined) {
    Object.defineProperty(Element.prototype, 'scrollTop', originalScrollTop);
  }
});

const getDataRows = (container: HTMLElement): HTMLTableRowElement[] =>
  Array.from(container.querySelectorAll('tr[data-row-index]'));

describe('<Spreadsheet> virtualization', () => {
  it('renders only a small window out of 1000 rows', () => {
    mockedViewportHeight = 200;
    const { container } = render(
      <Harness initial={makeRows(1000)} viewportHeight={200} rowHeight={20} />,
    );

    const dataRows = getDataRows(container);
    // 200 / 20 = 10 visible, plus 4 overscan on each side bounded at the top edge.
    // Expect far fewer than 1000 rendered.
    expect(dataRows.length).toBeGreaterThan(0);
    expect(dataRows.length).toBeLessThan(30);
    expect(dataRows.length).toBeLessThan(1000);
  });

  it('shifts the visible range when scrolling', () => {
    mockedViewportHeight = 200;
    const { container } = render(
      <Harness initial={makeRows(1000)} viewportHeight={200} rowHeight={20} />,
    );

    const initialIndices = getDataRows(container).map((tr) => tr.getAttribute('data-row-index'));
    expect(initialIndices[0]).toBe('0');

    const root = container.querySelector('[role="grid"]');
    expect(root).not.toBeNull();
    if (root === null) throw new Error('no grid root');

    // Simulate scrolling 400px down. 400 / 20 = row 20 as the first visible index.
    act(() => {
      (root as HTMLElement).scrollTop = 400;
      fireEvent.scroll(root, { target: { scrollTop: 400 } });
    });

    const scrolledIndices = getDataRows(container).map((tr) => tr.getAttribute('data-row-index'));
    expect(scrolledIndices[0]).not.toBe(initialIndices[0]);
    const firstAsNum = Number(scrolledIndices[0] ?? '-1');
    expect(firstAsNum).toBeGreaterThanOrEqual(16); // 20 - overscan(4)
    expect(firstAsNum).toBeLessThanOrEqual(20);
    // Sanity: still windowed, not a full 1000 render.
    expect(scrolledIndices.length).toBeLessThan(30);
  });

  it('renders spacer rows that together preserve totalHeight', () => {
    mockedViewportHeight = 200;
    const { container } = render(
      <Harness initial={makeRows(500)} viewportHeight={200} rowHeight={20} />,
    );

    const topSpacer = container.querySelector('tr[data-spacer="top"]');
    const bottomSpacer = container.querySelector('tr[data-spacer="bottom"]');
    // At scrollTop=0 there is no top spacer; bottom spacer should cover the tail.
    expect(topSpacer).toBeNull();
    expect(bottomSpacer).not.toBeNull();
    const bottomHeight = Number(
      (bottomSpacer as HTMLElement | null)?.style.height.replace('px', '') ?? '0',
    );
    // 500 rows * 20 = 10000 total; ~14 rendered means ~9720 spacer. Loose check: > 8000.
    expect(bottomHeight).toBeGreaterThan(8000);
  });

  it('scrolls the container when ArrowDown moves the active cell past the visible band', () => {
    mockedViewportHeight = 200;
    const { container } = render(
      <Harness initial={makeRows(1000)} viewportHeight={200} rowHeight={20} />,
    );

    const root = container.querySelector('[role="grid"]');
    expect(root).not.toBeNull();
    if (root === null) throw new Error('no grid root');
    const rootEl = root as HTMLElement;

    // Click the first cell to set activeCell = (0, 0).
    const firstCell = container.querySelector('td[role="gridcell"]');
    expect(firstCell).not.toBeNull();
    if (firstCell === null) throw new Error('no first cell');

    act(() => {
      fireEvent.mouseDown(firstCell);
    });

    // Press ArrowDown many times to drive activeCell past the visible band.
    // The layout effect should update scrollTop to keep the active cell visible.
    for (let i = 0; i < 40; i += 1) {
      act(() => {
        fireEvent.keyDown(rootEl, { key: 'ArrowDown' });
      });
    }

    expect(rootEl.scrollTop).toBeGreaterThan(0);
  });
});

describe('<Spreadsheet> Google-Sheets-parity behaviour', () => {
  const setup = (rowCount = 5): { container: HTMLElement; root: HTMLElement } => {
    mockedViewportHeight = 200;
    const { container } = render(
      <MultiHarness initial={makeMultiRows(rowCount)} viewportHeight={200} />,
    );
    const root = container.querySelector('[role="grid"]');
    if (root === null) throw new Error('no grid root');
    return { container, root: root as HTMLElement };
  };

  const cellAt = (container: HTMLElement, row: number, col: number): HTMLElement => {
    const tr = container.querySelector(`tr[data-row-index="${String(row)}"]`);
    if (tr === null) throw new Error(`row ${String(row)} not rendered`);
    const cells = tr.querySelectorAll('td[role="gridcell"]');
    const cell = cells[col];
    if (!(cell instanceof HTMLElement)) throw new Error(`col ${String(col)} missing`);
    return cell;
  };

  const activeAddr = (container: HTMLElement): { row: number; col: number } => {
    const trs = Array.from(container.querySelectorAll('tr[data-row-index]'));
    for (const tr of trs) {
      const cells = Array.from(tr.querySelectorAll('td[role="gridcell"]'));
      for (let c = 0; c < cells.length; c += 1) {
        const cell = cells[c];
        if (cell instanceof HTMLElement && cell.style.boxShadow.includes('inset')) {
          return { row: Number(tr.getAttribute('data-row-index')), col: c };
        }
      }
    }
    throw new Error('no active cell found');
  };

  it('renders a row-number gutter', () => {
    const { container } = setup(3);
    const gutter = container.querySelectorAll('th[data-gutter="row-number"]');
    expect(gutter.length).toBe(3);
    expect(gutter[0]?.textContent).toBe('1');
    expect(gutter[2]?.textContent).toBe('3');
  });

  it('Cmd/Ctrl+A selects every cell', () => {
    const { container, root } = setup(4);
    act(() => {
      fireEvent.mouseDown(cellAt(container, 0, 0));
    });
    act(() => {
      fireEvent.keyDown(root, { key: 'a', metaKey: true });
    });
    // After select-all every body cell should fall inside the selection range
    // and therefore carry the selection background colour.
    const selected = container.querySelectorAll('td[aria-selected="true"]');
    expect(selected.length).toBe(4 * multiColumns.length);
  });

  it('Home moves to first column; Ctrl+Home moves to A1', () => {
    const { container, root } = setup(4);
    act(() => {
      fireEvent.mouseDown(cellAt(container, 2, 1));
    });
    act(() => {
      fireEvent.keyDown(root, { key: 'Home' });
    });
    expect(activeAddr(container)).toEqual({ row: 2, col: 0 });

    act(() => {
      fireEvent.mouseDown(cellAt(container, 2, 1));
    });
    act(() => {
      fireEvent.keyDown(root, { key: 'Home', metaKey: true });
    });
    expect(activeAddr(container)).toEqual({ row: 0, col: 0 });
  });

  it('End moves to last column; Ctrl+End moves to last cell', () => {
    const { container, root } = setup(4);
    act(() => {
      fireEvent.mouseDown(cellAt(container, 0, 0));
    });
    act(() => {
      fireEvent.keyDown(root, { key: 'End' });
    });
    expect(activeAddr(container)).toEqual({ row: 0, col: multiColumns.length - 1 });

    act(() => {
      fireEvent.keyDown(root, { key: 'End', metaKey: true });
    });
    expect(activeAddr(container)).toEqual({ row: 3, col: multiColumns.length - 1 });
  });

  it('Ctrl+ArrowDown jumps to the last row', () => {
    const { container, root } = setup(10);
    act(() => {
      fireEvent.mouseDown(cellAt(container, 0, 0));
    });
    act(() => {
      fireEvent.keyDown(root, { key: 'ArrowDown', metaKey: true });
    });
    expect(activeAddr(container)).toEqual({ row: 9, col: 0 });
  });

  it('typing a printable character starts edit with that character (overwrite)', async () => {
    const { container, root } = setup(3);
    act(() => {
      fireEvent.mouseDown(cellAt(container, 1, 0));
    });
    // The cell currently holds "Row 1". Typing "Z" should open the editor with
    // the typed character only, not "Row 1Z".
    act(() => {
      fireEvent.keyDown(root, { key: 'Z' });
    });
    const input = cellAt(container, 1, 0).querySelector('input');
    expect(input).not.toBeNull();
    expect((input as HTMLInputElement).value).toBe('Z');
  });

  it('Enter on a selected cell opens the editor with the existing value preserved', () => {
    const { container, root } = setup(3);
    act(() => {
      fireEvent.mouseDown(cellAt(container, 1, 0));
    });
    act(() => {
      fireEvent.keyDown(root, { key: 'Enter' });
    });
    const input = cellAt(container, 1, 0).querySelector('input');
    expect(input).not.toBeNull();
    expect((input as HTMLInputElement).value).toBe('Row 1');
  });

  it('Enter inside the editor commits and moves the active cell down', () => {
    const { container, root } = setup(3);
    act(() => {
      fireEvent.mouseDown(cellAt(container, 0, 0));
    });
    act(() => {
      fireEvent.keyDown(root, { key: 'Enter' });
    });
    const input = cellAt(container, 0, 0).querySelector('input');
    if (!(input instanceof HTMLInputElement)) throw new Error('editor not mounted');

    act(() => {
      fireEvent.change(input, { target: { value: 'updated' } });
    });
    act(() => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    expect(activeAddr(container)).toEqual({ row: 1, col: 0 });
    expect(cellAt(container, 0, 0).textContent).toBe('updated');
  });

  it('Tab inside the editor commits and moves the active cell right', () => {
    const { container, root } = setup(3);
    act(() => {
      fireEvent.mouseDown(cellAt(container, 0, 0));
    });
    act(() => {
      fireEvent.keyDown(root, { key: 'Enter' });
    });
    const input = cellAt(container, 0, 0).querySelector('input');
    if (!(input instanceof HTMLInputElement)) throw new Error('editor not mounted');

    act(() => {
      fireEvent.change(input, { target: { value: 'tabbed' } });
    });
    act(() => {
      fireEvent.keyDown(input, { key: 'Tab' });
    });

    expect(activeAddr(container)).toEqual({ row: 0, col: 1 });
    expect(cellAt(container, 0, 0).textContent).toBe('tabbed');
  });

  it('clicking the row-number gutter selects the entire row', () => {
    const { container } = setup(4);
    const rowHeader = container.querySelectorAll('th[data-gutter="row-number"]')[2];
    expect(rowHeader).toBeTruthy();
    act(() => {
      fireEvent.mouseDown(rowHeader as Element);
    });
    const selectedInRow2 = container
      .querySelector('tr[data-row-index="2"]')
      ?.querySelectorAll('td[aria-selected="true"]');
    expect(selectedInRow2?.length).toBe(multiColumns.length);
  });

  it('Shift+Enter inside the editor commits and moves up', () => {
    const { container, root } = setup(3);
    act(() => {
      fireEvent.mouseDown(cellAt(container, 2, 0));
    });
    act(() => {
      fireEvent.keyDown(root, { key: 'Enter' });
    });
    const input = cellAt(container, 2, 0).querySelector('input');
    if (!(input instanceof HTMLInputElement)) throw new Error('editor not mounted');
    act(() => {
      fireEvent.change(input, { target: { value: 'changed' } });
    });
    act(() => {
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    });
    expect(activeAddr(container)).toEqual({ row: 1, col: 0 });
    expect(cellAt(container, 2, 0).textContent).toBe('changed');
  });

  it('Shift+Tab inside the editor commits and moves left', () => {
    const { container, root } = setup(3);
    act(() => {
      fireEvent.mouseDown(cellAt(container, 0, 1));
    });
    act(() => {
      fireEvent.keyDown(root, { key: 'Enter' });
    });
    const input = cellAt(container, 0, 1).querySelector('input');
    if (!(input instanceof HTMLInputElement)) throw new Error('editor not mounted');
    act(() => {
      fireEvent.keyDown(input, { key: 'Tab', shiftKey: true });
    });
    expect(activeAddr(container)).toEqual({ row: 0, col: 0 });
  });

  it('Escape inside the editor cancels without moving or committing', () => {
    const { container, root } = setup(3);
    act(() => {
      fireEvent.mouseDown(cellAt(container, 1, 0));
    });
    act(() => {
      fireEvent.keyDown(root, { key: 'Enter' });
    });
    const input = cellAt(container, 1, 0).querySelector('input');
    if (!(input instanceof HTMLInputElement)) throw new Error('editor not mounted');
    act(() => {
      fireEvent.change(input, { target: { value: 'discarded' } });
    });
    act(() => {
      fireEvent.keyDown(input, { key: 'Escape' });
    });
    expect(activeAddr(container)).toEqual({ row: 1, col: 0 });
    expect(cellAt(container, 1, 0).textContent).toBe('Row 1');
  });

  it('Ctrl+ArrowRight jumps to the last column', () => {
    const { container, root } = setup(3);
    act(() => {
      fireEvent.mouseDown(cellAt(container, 1, 0));
    });
    act(() => {
      fireEvent.keyDown(root, { key: 'ArrowRight', metaKey: true });
    });
    expect(activeAddr(container)).toEqual({ row: 1, col: multiColumns.length - 1 });
  });

  it('PageDown moves the active cell roughly one viewport down', () => {
    // viewportHeight=200, rowHeight=28 → ~7 rows visible → page step ~6.
    mockedViewportHeight = 200;
    const { container } = render(<MultiHarness initial={makeMultiRows(50)} viewportHeight={200} />);
    const root = container.querySelector('[role="grid"]');
    if (root === null) throw new Error('no grid root');
    act(() => {
      fireEvent.mouseDown(cellAt(container, 0, 0));
    });
    act(() => {
      fireEvent.keyDown(root, { key: 'PageDown' });
    });
    const addr = activeAddr(container);
    expect(addr.col).toBe(0);
    expect(addr.row).toBeGreaterThanOrEqual(4);
    expect(addr.row).toBeLessThanOrEqual(8);
  });

  it('clicking the corner selects every cell', () => {
    const { container } = setup(3);
    const corner = container.querySelector('thead th'); // first <th> is corner
    expect(corner).toBeTruthy();
    act(() => {
      fireEvent.mouseDown(corner as Element);
    });
    const selected = container.querySelectorAll('td[aria-selected="true"]');
    expect(selected.length).toBe(3 * multiColumns.length);
  });

  it('active cell uses an inset box-shadow (not a 2px border) so layout is stable', () => {
    const { container } = setup(3);
    act(() => {
      fireEvent.mouseDown(cellAt(container, 0, 0));
    });
    const cell = cellAt(container, 0, 0);
    expect(cell.style.boxShadow).toContain('inset');
    // Border width remains the baseline 1px so column widths don't reflow.
    expect(cell.style.border).toContain('1px');
  });

  it('clicking a column header selects the entire column', () => {
    const { container } = setup(4);
    // The first <th> in <thead> is the corner; the column header for col 1 is
    // the third <th> child of the header row.
    const headerRow = container.querySelector('thead tr');
    const headers = headerRow?.querySelectorAll('th');
    const colHeader = headers?.[2];
    expect(colHeader).toBeTruthy();
    act(() => {
      fireEvent.mouseDown(colHeader as Element);
    });
    const selectedInCol1 = container.querySelectorAll(
      'tr[data-row-index] td[role="gridcell"]:nth-of-type(2)[aria-selected="true"]',
    );
    expect(selectedInCol1.length).toBe(4);
  });
});

describe('<Spreadsheet> + checkboxColumn click-to-toggle', () => {
  type CheckRow = { id: string; enabled: boolean | null };

  const checkColumns = defineColumns<CheckRow>()(
    checkboxColumn<CheckRow, 'enabled'>({ key: 'enabled', title: 'Enabled' }),
  );

  const readOnlyCheckColumns = defineColumns<CheckRow>()({
    ...checkboxColumn<CheckRow, 'enabled'>({ key: 'enabled', title: 'Enabled' }),
    readOnly: true,
  });

  type CheckHarnessProps = {
    initial: CheckRow[];
    columns: ColumnDef<CheckRow>[];
    onChange?: (rows: CheckRow[]) => void;
  };

  function CheckHarness({ initial, columns: cols, onChange }: CheckHarnessProps): ReactElement {
    const [rows, setRows] = useState<CheckRow[]>(initial);
    const handle = useCallback(
      (next: CheckRow[], _e: ChangeEvent<CheckRow>) => {
        setRows(next);
        if (onChange !== undefined) onChange(next);
      },
      [onChange],
    );
    return (
      <Spreadsheet<CheckRow>
        value={rows}
        onChange={handle}
        columns={cols}
        getRowKey={(row) => row.id}
        rowHeight={28}
        maxHeight={200}
      />
    );
  }

  const checkboxAt = (container: HTMLElement, row: number): HTMLInputElement => {
    const tr = container.querySelector(`tr[data-row-index="${String(row)}"]`);
    if (tr === null) throw new Error(`row ${String(row)} not rendered`);
    const input = tr.querySelector('input[type="checkbox"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('checkbox missing');
    return input;
  };

  it('toggles a checkbox in an unfocused cell on a single click (null → true → false)', () => {
    mockedViewportHeight = 200;
    const { container } = render(
      <CheckHarness
        initial={[
          { id: 'a', enabled: false },
          { id: 'b', enabled: true },
          { id: 'c', enabled: null },
        ]}
        columns={checkColumns}
      />,
    );

    // No cell is active yet — click the checkbox in row c (indeterminate).
    const inputC = checkboxAt(container, 2);
    expect(inputC.indeterminate).toBe(true);
    act(() => {
      inputC.click();
    });
    // null → true
    expect(checkboxAt(container, 2).checked).toBe(true);

    // Row b (true) → false on click, still without first focusing the cell.
    const inputB = checkboxAt(container, 1);
    expect(inputB.checked).toBe(true);
    act(() => {
      inputB.click();
    });
    expect(checkboxAt(container, 1).checked).toBe(false);

    // Row a (false) → true.
    act(() => {
      checkboxAt(container, 0).click();
    });
    expect(checkboxAt(container, 0).checked).toBe(true);
  });

  it('does not toggle when the column is readOnly', () => {
    mockedViewportHeight = 200;
    const onChange = vi.fn();
    const { container } = render(
      <CheckHarness
        initial={[{ id: 'a', enabled: false }]}
        columns={readOnlyCheckColumns}
        onChange={onChange}
      />,
    );

    const input = checkboxAt(container, 0);
    expect(input.readOnly).toBe(true);
    act(() => {
      input.click();
    });
    // No patch is applied — readOnly path never surfaces onValueChange.
    expect(onChange).not.toHaveBeenCalled();
  });
});
