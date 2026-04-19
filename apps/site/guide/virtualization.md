# Virtualization

Rendering 10,000 rows at once kills React. The virtualizer computes which rows belong in the visible window (plus a small overscan band) so you only render the ones that are actually on screen.

<ClientOnly>
  <ReactIsland :component="() => import('../demos/VirtualizationDemo')" />
</ClientOnly>

## Hook usage

```tsx
import { useRowVirtualizer } from 'excellent-react-spreadsheet';

const virt = useRowVirtualizer({
  rowCount: rows.length,
  rowHeight: 28, // number — uniform heights, O(1) window
  viewportHeight: 320,
  scrollTop,
  overscan: 4,
});

// virt.startIndex, virt.endIndex, virt.paddingTop, virt.paddingBottom, virt.totalHeight
```

The hook is **headless**: it does not measure the DOM. You are responsible for tracking `scrollTop` (via `onScroll`) and `viewportHeight` (via `ResizeObserver`, or a fixed number).

## Variable row heights

Pass a function for `rowHeight`:

```ts
useRowVirtualizer({
  rowCount,
  rowHeight: (index) => (index % 5 === 0 ? 56 : 28),
  viewportHeight,
  scrollTop,
});
```

The virtualizer builds a prefix-sum offset table and uses binary search on `scrollTop`. The function's identity is part of the memo key — stabilize it with `useCallback`, or switch to a number, or the table rebuilds every render.

## Rendering pattern

```tsx
<div
  style={{ height: viewport, overflow: 'auto' }}
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
```

`virt.totalHeight` holds the scroll container's scrollable height constant, so the scrollbar thumb stays correctly sized even when most rows are unmounted. `virt.paddingTop` offsets the visible slice into position.

## Performance targets

| Metric                             | Target         |
| ---------------------------------- | -------------- |
| Scroll FPS on 10,000 rows          | ≥ 55 fps       |
| Initial render (1,000 × 10 cells)  | ≤ 100 ms       |
| Formula recompute (1,000 formulas) | ≤ 16 ms (v1.0) |

These targets are enforced by size and benchmark checks in CI.

## Pure helper

If you need the math outside of React (a Web Worker that pre-computes slices, an SSR helper), call the pure function:

```ts
import { computeRowVirtualization } from 'excellent-react-spreadsheet';

computeRowVirtualization({ rowCount, rowHeight: 28, viewportHeight, scrollTop });
```

See [API / virtualizer](/api/virtualizer) for the complete option / result shape.
