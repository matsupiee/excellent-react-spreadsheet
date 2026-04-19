# Row virtualizer

Headless row virtualization math, available as a pure function and as a memoized React hook.

```ts
import {
  computeRowVirtualization,
  useRowVirtualizer,
  type RowVirtualizerOptions,
  type RowVirtualizerResult,
} from 'excellent-react-spreadsheet';
```

## `RowVirtualizerOptions`

```ts
type RowVirtualizerOptions = {
  rowCount: number;
  rowHeight: number | ((index: number) => number);
  viewportHeight: number;
  scrollTop: number;
  overscan?: number; // default 4
};
```

- **Uniform heights**: pass a number. Window computation is O(1).
- **Variable heights**: pass a function. The virtualizer builds a prefix-sum offset table and binary-searches `scrollTop`.

::: warning Function identity matters
The `rowHeight` function's identity is part of the memoization key. If you recreate the function every render, the prefix-sum table rebuilds every render. Stabilize it with `useCallback` or pass a number.
:::

## `RowVirtualizerResult`

```ts
type RowVirtualizerResult = {
  startIndex: number; // inclusive, with overscan
  endIndex: number; // inclusive, with overscan
  paddingTop: number; // pixels to insert before the first rendered row
  paddingBottom: number; // pixels to insert after the last rendered row
  totalHeight: number; // full scrollable height
  rowOffsets: readonly number[] | null;
};
```

`rowOffsets` is populated only for variable-height layouts; the array has length `rowCount + 1` with `rowOffsets[i]` being the top of row `i`.

## `computeRowVirtualization(options)`

Pure function, safe to call in render, workers, or tests. Handles:

- `rowCount === 0` → empty result.
- Negative `scrollTop` (overscroll bounce) → clamped to 0.
- `rowHeight === 0` → degenerate but defined: renders a 1-row slice.
- `scrollTop >= totalHeight` → anchors on the last row.

## `useRowVirtualizer(options)`

React hook. Wraps `computeRowVirtualization` in `useMemo`, keyed on `rowCount`, `rowHeight`, `viewportHeight`, `scrollTop`, and `overscan`. Returns the same `RowVirtualizerResult`.

## Usage

```tsx
function VirtualList({ rows }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const viewportHeight = 480;

  const virt = useRowVirtualizer({
    rowCount: rows.length,
    rowHeight: 32,
    viewportHeight,
    scrollTop,
    overscan: 6,
  });

  return (
    <div
      ref={viewportRef}
      style={{ height: viewportHeight, overflow: 'auto' }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: virt.totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${virt.paddingTop}px)` }}>
          {rows.slice(virt.startIndex, virt.endIndex + 1).map((row) => (
            <Row key={row.id} row={row} />
          ))}
        </div>
      </div>
    </div>
  );
}
```
