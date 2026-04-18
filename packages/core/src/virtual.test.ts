import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { computeRowVirtualization, useRowVirtualizer } from './virtual.js';

describe('computeRowVirtualization — uniform row heights', () => {
  it('renders the full viewport from scrollTop=0 with zero overscan', () => {
    const result = computeRowVirtualization({
      rowCount: 100,
      rowHeight: 30,
      viewportHeight: 300,
      scrollTop: 0,
      overscan: 0,
    });

    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(9);
    expect(result.paddingTop).toBe(0);
    expect(result.paddingBottom).toBe((100 - 10) * 30);
    expect(result.totalHeight).toBe(100 * 30);
    expect(result.rowOffsets).toBeNull();
  });

  it('accounts for scrollTop and overscan when picking the window', () => {
    // rowHeight=30, viewportHeight=300, scrollTop=150 → first visible row is 5.
    // 10 visible rows → endIndex=14. overscan=2 expands both sides by 2.
    const result = computeRowVirtualization({
      rowCount: 100,
      rowHeight: 30,
      viewportHeight: 300,
      scrollTop: 150,
      overscan: 2,
    });

    expect(result.startIndex).toBe(3);
    expect(result.endIndex).toBe(16);
    expect(result.paddingTop).toBe(3 * 30);
    expect(result.paddingBottom).toBe((100 - 1 - 16) * 30);
    expect(result.totalHeight).toBe(100 * 30);
  });

  it('clamps overscan at the top boundary (no negative startIndex)', () => {
    const result = computeRowVirtualization({
      rowCount: 20,
      rowHeight: 25,
      viewportHeight: 100,
      scrollTop: 0,
      overscan: 10,
    });

    expect(result.startIndex).toBe(0);
    expect(result.paddingTop).toBe(0);
    expect(result.endIndex).toBeGreaterThanOrEqual(3);
    expect(result.endIndex).toBeLessThanOrEqual(19);
  });

  it('clamps endIndex at the bottom boundary (no overshoot past rowCount - 1)', () => {
    const result = computeRowVirtualization({
      rowCount: 10,
      rowHeight: 40,
      viewportHeight: 400,
      scrollTop: 0,
      overscan: 25,
    });

    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(9);
    expect(result.paddingBottom).toBe(0);
  });

  it('clamps a negative scrollTop to 0', () => {
    const result = computeRowVirtualization({
      rowCount: 50,
      rowHeight: 20,
      viewportHeight: 200,
      scrollTop: -500,
      overscan: 0,
    });

    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(9);
    expect(result.paddingTop).toBe(0);
  });

  it('anchors the window on the last row when scrollTop exceeds totalHeight', () => {
    const result = computeRowVirtualization({
      rowCount: 50,
      rowHeight: 20,
      viewportHeight: 200,
      scrollTop: 1_000_000,
      overscan: 0,
    });

    expect(result.endIndex).toBe(49);
    expect(result.startIndex).toBeLessThanOrEqual(49);
  });

  it('renders at least one row when viewportHeight is 0', () => {
    const result = computeRowVirtualization({
      rowCount: 10,
      rowHeight: 30,
      viewportHeight: 0,
      scrollTop: 60,
      overscan: 0,
    });

    expect(result.endIndex).toBeGreaterThanOrEqual(result.startIndex);
    expect(result.startIndex).toBe(2);
    expect(result.endIndex).toBe(2);
  });

  it('renders at least one row when viewportHeight is negative', () => {
    const result = computeRowVirtualization({
      rowCount: 10,
      rowHeight: 30,
      viewportHeight: -50,
      scrollTop: 0,
      overscan: 0,
    });

    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(0);
  });
});

describe('computeRowVirtualization — edge cases', () => {
  it('returns sensible zeros when rowCount is 0', () => {
    const result = computeRowVirtualization({
      rowCount: 0,
      rowHeight: 30,
      viewportHeight: 300,
      scrollTop: 0,
    });

    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(0);
    expect(result.paddingTop).toBe(0);
    expect(result.paddingBottom).toBe(0);
    expect(result.totalHeight).toBe(0);
    expect(result.rowOffsets).toBeNull();
  });

  it('returns sensible zeros when rowCount is 0 and rowHeight is a function', () => {
    const result = computeRowVirtualization({
      rowCount: 0,
      rowHeight: () => 30,
      viewportHeight: 300,
      scrollTop: 0,
    });

    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(0);
    expect(result.totalHeight).toBe(0);
  });

  it('applies the default overscan of 4 when omitted', () => {
    const withDefault = computeRowVirtualization({
      rowCount: 1000,
      rowHeight: 30,
      viewportHeight: 300,
      scrollTop: 600,
    });
    const withExplicit = computeRowVirtualization({
      rowCount: 1000,
      rowHeight: 30,
      viewportHeight: 300,
      scrollTop: 600,
      overscan: 4,
    });

    expect(withDefault.startIndex).toBe(withExplicit.startIndex);
    expect(withDefault.endIndex).toBe(withExplicit.endIndex);
  });
});

describe('computeRowVirtualization — variable row heights', () => {
  // Rows: heights=[20, 30, 40, 50, 60], cumulative offsets=[0,20,50,90,140,200].
  const heights = [20, 30, 40, 50, 60];
  const heightOf = (i: number): number => heights[i] ?? 0;

  it('finds the correct start index via prefix-sum binary search', () => {
    // scrollTop=50 → first row whose bottom exceeds 50 is row 2 (bottom at 90).
    const result = computeRowVirtualization({
      rowCount: 5,
      rowHeight: heightOf,
      viewportHeight: 100,
      scrollTop: 50,
      overscan: 0,
    });

    expect(result.startIndex).toBe(2);
    // Visible band [50, 150]. Row 4 top=140 is inside the band, so it's included.
    expect(result.endIndex).toBe(4);
    expect(result.paddingTop).toBe(50);
    expect(result.paddingBottom).toBe(0);
    expect(result.totalHeight).toBe(200);
    expect(result.rowOffsets).toEqual([0, 20, 50, 90, 140, 200]);
  });

  it('handles scrollTop=0 (first row visible) correctly', () => {
    const result = computeRowVirtualization({
      rowCount: 5,
      rowHeight: heightOf,
      viewportHeight: 100,
      scrollTop: 0,
      overscan: 0,
    });

    expect(result.startIndex).toBe(0);
    // 20 + 30 + 40 = 90 < 100; 90 + 50 = 140 > 100 → include row 3.
    expect(result.endIndex).toBe(3);
    expect(result.paddingTop).toBe(0);
  });

  it('handles scrollTop exactly at a row boundary', () => {
    // offsets=[0,20,50,90,140,200]; scrollTop=50 hits the top of row 2.
    const result = computeRowVirtualization({
      rowCount: 5,
      rowHeight: heightOf,
      viewportHeight: 40,
      scrollTop: 50,
      overscan: 0,
    });

    expect(result.startIndex).toBe(2);
  });

  it('anchors on the last row when scrollTop exceeds totalHeight', () => {
    const result = computeRowVirtualization({
      rowCount: 5,
      rowHeight: heightOf,
      viewportHeight: 100,
      scrollTop: 10_000,
      overscan: 0,
    });

    expect(result.endIndex).toBe(4);
    expect(result.paddingBottom).toBe(0);
    expect(result.totalHeight).toBe(200);
  });

  it('clamps overscan at the top boundary (variable heights)', () => {
    const result = computeRowVirtualization({
      rowCount: 5,
      rowHeight: heightOf,
      viewportHeight: 40,
      scrollTop: 20,
      overscan: 10,
    });

    expect(result.startIndex).toBe(0);
    expect(result.paddingTop).toBe(0);
  });

  it('clamps overscan at the bottom boundary (variable heights)', () => {
    const result = computeRowVirtualization({
      rowCount: 5,
      rowHeight: heightOf,
      viewportHeight: 100,
      scrollTop: 50,
      overscan: 10,
    });

    expect(result.endIndex).toBe(4);
    expect(result.paddingBottom).toBe(0);
  });

  it('totalHeight matches the sum of all row heights', () => {
    const result = computeRowVirtualization({
      rowCount: 5,
      rowHeight: heightOf,
      viewportHeight: 100,
      scrollTop: 0,
      overscan: 0,
    });

    expect(result.totalHeight).toBe(heights.reduce((a, b) => a + b, 0));
  });

  it('returns a prefix-sum offset array of length rowCount + 1', () => {
    const result = computeRowVirtualization({
      rowCount: 5,
      rowHeight: heightOf,
      viewportHeight: 100,
      scrollTop: 0,
      overscan: 0,
    });

    expect(result.rowOffsets).not.toBeNull();
    expect(result.rowOffsets).toHaveLength(6);
    expect(result.rowOffsets?.[0]).toBe(0);
    expect(result.rowOffsets?.[5]).toBe(200);
  });
});

describe('useRowVirtualizer', () => {
  it('memoizes the result across renders with stable inputs', () => {
    const { result, rerender } = renderHook(
      ({ scrollTop }: { scrollTop: number }) =>
        useRowVirtualizer({
          rowCount: 100,
          rowHeight: 30,
          viewportHeight: 300,
          scrollTop,
          overscan: 2,
        }),
      { initialProps: { scrollTop: 60 } },
    );

    const first = result.current;
    rerender({ scrollTop: 60 });
    expect(result.current).toBe(first);
  });

  it('recomputes when scrollTop changes', () => {
    const { result, rerender } = renderHook(
      ({ scrollTop }: { scrollTop: number }) =>
        useRowVirtualizer({
          rowCount: 100,
          rowHeight: 30,
          viewportHeight: 300,
          scrollTop,
          overscan: 0,
        }),
      { initialProps: { scrollTop: 0 } },
    );

    expect(result.current.startIndex).toBe(0);
    rerender({ scrollTop: 300 });
    expect(result.current.startIndex).toBe(10);
  });

  it('returns the same calculation as the pure function', () => {
    const opts = {
      rowCount: 50,
      rowHeight: 40,
      viewportHeight: 400,
      scrollTop: 200,
      overscan: 3,
    };
    const { result } = renderHook(() => useRowVirtualizer(opts));
    expect(result.current).toEqual(computeRowVirtualization(opts));
  });
});
