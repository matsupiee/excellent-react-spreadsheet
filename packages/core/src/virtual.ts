import { useMemo } from 'react';

/**
 * Options for {@link computeRowVirtualization} and {@link useRowVirtualizer}.
 *
 * The virtualizer is **headless**: it does not measure the DOM. The caller is
 * responsible for providing the current `viewportHeight` and `scrollTop` (for
 * instance via a `ResizeObserver` + `onScroll` handler on the scroll container).
 */
export type RowVirtualizerOptions = {
  /** Total number of rows in the underlying dataset. */
  rowCount: number;
  /**
   * Height of each row in CSS pixels. When a number, all rows share the same
   * height and the visible window is computed in O(1). When a function, the
   * virtualizer builds a prefix-sum offset table and performs a binary search
   * on `scrollTop` (O(log n) after an O(n) setup).
   */
  rowHeight: number | ((index: number) => number);
  /** Height of the visible viewport in CSS pixels. */
  viewportHeight: number;
  /** Current vertical scroll offset of the container in CSS pixels. */
  scrollTop: number;
  /**
   * Extra rows to render above and below the visible band for smoother
   * scrolling. Defaults to `4`.
   */
  overscan?: number;
};

/**
 * Output of the row virtualizer. Callers render rows in the index range
 * `[startIndex, endIndex]` inclusive and reserve `paddingTop` / `paddingBottom`
 * pixels of whitespace so that the scroll container reports the correct
 * `totalHeight`.
 */
export type RowVirtualizerResult = {
  /** First row index (inclusive) in the rendered slice. Includes overscan. */
  startIndex: number;
  /** Last row index (inclusive) in the rendered slice. Includes overscan. */
  endIndex: number;
  /** Pixel offset to place before the first rendered row. */
  paddingTop: number;
  /** Pixel offset to place after the last rendered row. */
  paddingBottom: number;
  /** Total scrollable height in CSS pixels. Equals the sum of every row height. */
  totalHeight: number;
  /**
   * Per-row offsets for variable-height grids. `rowOffsets[i]` is the
   * top-offset of row `i` (and `rowOffsets[rowCount]` is `totalHeight`).
   * `null` when rows are uniform (use `index * rowHeight` instead).
   */
  rowOffsets: readonly number[] | null;
};

const DEFAULT_OVERSCAN = 4;

const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

const emptyResult = (): RowVirtualizerResult => ({
  startIndex: 0,
  endIndex: 0,
  paddingTop: 0,
  paddingBottom: 0,
  totalHeight: 0,
  rowOffsets: null,
});

/**
 * Build the prefix-sum offset array for variable heights.
 * Length is `rowCount + 1`; the final entry equals the total height.
 */
const buildOffsets = (rowCount: number, heightOf: (index: number) => number): number[] => {
  const offsets = new Array<number>(rowCount + 1);
  offsets[0] = 0;
  let acc = 0;
  for (let i = 0; i < rowCount; i += 1) {
    const h = heightOf(i);
    // Guard against NaN / negative heights — treat as 0 to keep the array monotonic.
    acc += h > 0 ? h : 0;
    offsets[i + 1] = acc;
  }
  return offsets;
};

/**
 * Find the first row whose bottom edge is strictly greater than `scrollTop`.
 * Returns `rowCount - 1` when `scrollTop` exceeds the end (so the last row is
 * kept in the window). Assumes `offsets` is monotonically non-decreasing.
 */
const findStartIndex = (
  offsets: readonly number[],
  rowCount: number,
  scrollTop: number,
): number => {
  if (rowCount <= 0) return 0;
  if (scrollTop <= 0) return 0;
  // Binary search on the range `[0, rowCount]`, looking for the smallest `i`
  // with `offsets[i + 1] > scrollTop` (i.e. the row that covers `scrollTop`).
  let lo = 0;
  let hi = rowCount - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const bottom = offsets[mid + 1] ?? 0;
    if (bottom > scrollTop) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return lo;
};

/**
 * Find the last row whose top edge is strictly less than `scrollBottom`.
 * Mirror of {@link findStartIndex}.
 */
const findEndIndex = (
  offsets: readonly number[],
  rowCount: number,
  scrollBottom: number,
): number => {
  if (rowCount <= 0) return 0;
  // Largest `i` with `offsets[i] < scrollBottom`.
  let lo = 0;
  let hi = rowCount - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    const top = offsets[mid] ?? 0;
    if (top < scrollBottom) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
};

/**
 * Pure row-virtualization calculation. Safe to call in render or worker code —
 * does not touch the DOM or any React internals.
 *
 * See {@link RowVirtualizerOptions} for the input contract and
 * {@link RowVirtualizerResult} for the output shape.
 */
export const computeRowVirtualization = (opts: RowVirtualizerOptions): RowVirtualizerResult => {
  const { rowCount, rowHeight, viewportHeight, scrollTop } = opts;
  const overscan = Math.max(0, opts.overscan ?? DEFAULT_OVERSCAN);

  if (rowCount <= 0) return emptyResult();

  // Clamp a negative scrollTop to 0. Overscroll-bounce or programmatic misuse
  // can produce negatives; treating them as 0 keeps the window anchored at the top.
  const clampedScrollTop = scrollTop < 0 ? 0 : scrollTop;
  // When viewportHeight is non-positive we still render at least one row so
  // selection / focus movement continues to scroll a visible cell into view.
  const effectiveViewport = viewportHeight > 0 ? viewportHeight : 0;

  if (typeof rowHeight === 'number') {
    const h = rowHeight > 0 ? rowHeight : 0;
    const totalHeight = h * rowCount;

    if (h === 0) {
      // All rows collapsed — degenerate but well-defined: render a 1-row slice.
      return {
        startIndex: 0,
        endIndex: 0,
        paddingTop: 0,
        paddingBottom: 0,
        totalHeight: 0,
        rowOffsets: null,
      };
    }

    const rawStart = Math.floor(clampedScrollTop / h);
    const visibleRows = effectiveViewport > 0 ? Math.ceil(effectiveViewport / h) : 1;
    const rawEnd = rawStart + Math.max(1, visibleRows) - 1;

    const startIndex = clamp(rawStart - overscan, 0, rowCount - 1);
    const endIndex = clamp(rawEnd + overscan, startIndex, rowCount - 1);

    const paddingTop = startIndex * h;
    const paddingBottom = (rowCount - 1 - endIndex) * h;

    return {
      startIndex,
      endIndex,
      paddingTop,
      paddingBottom,
      totalHeight,
      rowOffsets: null,
    };
  }

  const offsets = buildOffsets(rowCount, rowHeight);
  const totalHeight = offsets[rowCount] ?? 0;

  // scrollTop past the end — anchor on the last row so late-scroll still renders content.
  if (clampedScrollTop >= totalHeight) {
    const startIndex = clamp(rowCount - 1 - overscan, 0, rowCount - 1);
    const endIndex = rowCount - 1;
    const paddingTop = offsets[startIndex] ?? 0;
    const paddingBottom = 0;
    return { startIndex, endIndex, paddingTop, paddingBottom, totalHeight, rowOffsets: offsets };
  }

  const scrollBottom = clampedScrollTop + effectiveViewport;
  const rawStart = findStartIndex(offsets, rowCount, clampedScrollTop);
  const rawEnd = effectiveViewport > 0 ? findEndIndex(offsets, rowCount, scrollBottom) : rawStart; // Zero viewport → render at least the row under scrollTop.

  const startIndex = clamp(rawStart - overscan, 0, rowCount - 1);
  const endIndex = clamp(rawEnd + overscan, startIndex, rowCount - 1);

  const paddingTop = offsets[startIndex] ?? 0;
  const paddingBottom = totalHeight - (offsets[endIndex + 1] ?? totalHeight);

  return {
    startIndex,
    endIndex,
    paddingTop,
    paddingBottom,
    totalHeight,
    rowOffsets: offsets,
  };
};

/**
 * React hook wrapper around {@link computeRowVirtualization}. The result is
 * memoized across renders so list slices are referentially stable while
 * `scrollTop` / `viewportHeight` are unchanged.
 *
 * Why: when `rowHeight` is a function the memo key is its identity (plus
 * `rowCount`). Callers MUST stabilize the function with `useCallback` — or
 * switch to a `number` — otherwise every render rebuilds the prefix-sum array.
 */
export const useRowVirtualizer = (opts: RowVirtualizerOptions): RowVirtualizerResult => {
  const { rowCount, rowHeight, viewportHeight, scrollTop, overscan } = opts;

  return useMemo(() => {
    // Why: rebuild the options object so we only set `overscan` when explicitly
    // provided — the type uses `exactOptionalPropertyTypes: true`.
    const next: RowVirtualizerOptions = { rowCount, rowHeight, viewportHeight, scrollTop };
    if (overscan !== undefined) next.overscan = overscan;
    return computeRowVirtualization(next);
  }, [rowCount, rowHeight, viewportHeight, scrollTop, overscan]);
};
