import { describe, expect, it } from 'vitest';

import { createHistory, invertPatch, invertPatches } from './history.js';
import type { CellPatch } from './types.js';

const setPatch = (row: number, col: number, prev: unknown, next: unknown): CellPatch => ({
  op: 'set',
  address: { row, col },
  prev,
  next,
});

describe('invertPatch', () => {
  it('swaps prev and next for set patches', () => {
    const patch = setPatch(0, 0, 'a', 'b');
    expect(invertPatch(patch)).toEqual({
      op: 'set',
      address: { row: 0, col: 0 },
      prev: 'b',
      next: 'a',
    });
  });

  it('turns insertRow into removeRow and vice versa', () => {
    const insert: CellPatch = { op: 'insertRow', at: 2, row: { id: 'x' } };
    expect(invertPatch(insert)).toEqual({ op: 'removeRow', at: 2, row: { id: 'x' } });
    const remove: CellPatch = { op: 'removeRow', at: 3, row: { id: 'y' } };
    expect(invertPatch(remove)).toEqual({ op: 'insertRow', at: 3, row: { id: 'y' } });
  });

  it('swaps from/to for moveRow', () => {
    const move: CellPatch = { op: 'moveRow', from: 1, to: 4 };
    expect(invertPatch(move)).toEqual({ op: 'moveRow', from: 4, to: 1 });
  });
});

describe('invertPatches', () => {
  it('reverses order so the last forward mutation is undone first', () => {
    const forward: CellPatch[] = [setPatch(0, 0, 'a', 'b'), setPatch(0, 1, 1, 2)];
    expect(invertPatches(forward)).toEqual([
      { op: 'set', address: { row: 0, col: 1 }, prev: 2, next: 1 },
      { op: 'set', address: { row: 0, col: 0 }, prev: 'b', next: 'a' },
    ]);
  });
});

describe('createHistory', () => {
  it('push + undo returns inverse patches and toggles canUndo/canRedo', () => {
    const history = createHistory();
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);

    history.push([setPatch(0, 0, 'a', 'b')]);
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);

    const inverse = history.undo();
    expect(inverse).toEqual([{ op: 'set', address: { row: 0, col: 0 }, prev: 'b', next: 'a' }]);
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);
  });

  it('redo replays the forward patches after an undo', () => {
    const history = createHistory();
    history.push([setPatch(1, 2, 10, 20)]);
    history.undo();

    const forward = history.redo();
    expect(forward).toEqual([setPatch(1, 2, 10, 20)]);
    expect(history.canRedo()).toBe(false);
    expect(history.canUndo()).toBe(true);
  });

  it('clears the redo stack when a new patch is pushed', () => {
    const history = createHistory();
    history.push([setPatch(0, 0, 'a', 'b')]);
    history.undo();
    expect(history.canRedo()).toBe(true);

    history.push([setPatch(0, 1, 'c', 'd')]);
    expect(history.canRedo()).toBe(false);
    expect(history.redo()).toBeNull();
  });

  it('coalesces consecutive pushes that share a key within the time window', () => {
    const history = createHistory({ coalesceMs: 500 });
    history.push([setPatch(0, 0, 'a', 'b')], { coalesceKey: 'cell-0-0', timestamp: 1000 });
    history.push([setPatch(0, 0, 'b', 'c')], { coalesceKey: 'cell-0-0', timestamp: 1300 });

    const entries = history.entries();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.patches).toHaveLength(2);

    const inverse = history.undo();
    // Inverse list is reversed: undo the latest write first.
    expect(inverse).toEqual([
      { op: 'set', address: { row: 0, col: 0 }, prev: 'c', next: 'b' },
      { op: 'set', address: { row: 0, col: 0 }, prev: 'b', next: 'a' },
    ]);
  });

  it('does not coalesce when the time window elapses', () => {
    const history = createHistory({ coalesceMs: 500 });
    history.push([setPatch(0, 0, 'a', 'b')], { coalesceKey: 'cell-0-0', timestamp: 1000 });
    history.push([setPatch(0, 0, 'b', 'c')], { coalesceKey: 'cell-0-0', timestamp: 2000 });

    expect(history.entries()).toHaveLength(2);
  });

  it('does not coalesce when coalesceKey differs', () => {
    const history = createHistory({ coalesceMs: 500 });
    history.push([setPatch(0, 0, 'a', 'b')], { coalesceKey: 'cell-0-0', timestamp: 1000 });
    history.push([setPatch(0, 1, 'x', 'y')], { coalesceKey: 'cell-0-1', timestamp: 1100 });

    expect(history.entries()).toHaveLength(2);
  });

  it('does not coalesce when no coalesceKey is provided', () => {
    const history = createHistory({ coalesceMs: 500 });
    history.push([setPatch(0, 0, 'a', 'b')], { timestamp: 1000 });
    history.push([setPatch(0, 0, 'b', 'c')], { timestamp: 1100 });

    expect(history.entries()).toHaveLength(2);
  });

  it('evicts the oldest entry once maxHistory is exceeded', () => {
    const history = createHistory({ maxHistory: 2 });
    history.push([setPatch(0, 0, 'a', 'b')]);
    history.push([setPatch(0, 1, 'c', 'd')]);
    history.push([setPatch(0, 2, 'e', 'f')]);

    const entries = history.entries();
    expect(entries).toHaveLength(2);
    expect(entries[0]?.patches[0]).toEqual(setPatch(0, 1, 'c', 'd'));
    expect(entries[1]?.patches[0]).toEqual(setPatch(0, 2, 'e', 'f'));
  });

  it('ignores empty patch arrays', () => {
    const history = createHistory();
    history.push([]);
    expect(history.canUndo()).toBe(false);
  });

  it('clear() empties both stacks', () => {
    const history = createHistory();
    history.push([setPatch(0, 0, 'a', 'b')]);
    history.undo();
    history.clear();
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
    expect(history.entries()).toHaveLength(0);
  });

  it('returns null when undoing or redoing an empty stack', () => {
    const history = createHistory();
    expect(history.undo()).toBeNull();
    expect(history.redo()).toBeNull();
  });

  it('produces inverses for row mutations', () => {
    const history = createHistory();
    const row = { id: 'row-1' };
    history.push([
      { op: 'insertRow', at: 1, row },
      { op: 'removeRow', at: 3, row: { id: 'row-3' } },
      { op: 'moveRow', from: 0, to: 4 },
    ]);

    const inverse = history.undo();
    expect(inverse).toEqual([
      { op: 'moveRow', from: 4, to: 0 },
      { op: 'insertRow', at: 3, row: { id: 'row-3' } },
      { op: 'removeRow', at: 1, row },
    ]);
  });
});
