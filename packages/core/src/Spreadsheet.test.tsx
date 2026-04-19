import { act, fireEvent, render } from '@testing-library/react';
import { useCallback, useState, type ReactElement } from 'react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Spreadsheet } from './Spreadsheet.js';
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
  },
];

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
