# History engine

The same engine powering `useSpreadsheet`'s built-in undo/redo is available stand-alone as `createHistory`.

```ts
import { createHistory, type HistoryEntry, type CellPatch } from 'excellent-react-spreadsheet';
```

## `createHistory(options?)`

```ts
type CreateHistoryOptions = {
  maxHistory?: number; // default 200
  coalesceMs?: number; // default 500
};

function createHistory(options?: CreateHistoryOptions): History;
```

Returns:

```ts
type History = {
  push: (patches: CellPatch[], opts?: PushOptions) => void;
  undo: () => CellPatch[] | null;
  redo: () => CellPatch[] | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
  entries: () => readonly HistoryEntry[];
};
```

### `push(patches, opts?)`

```ts
type PushOptions = {
  label?: string; // user-visible title ("paste 12 cells")
  coalesceKey?: string; // merge with the prior entry if the key matches
  timestamp?: number; // override Date.now() — useful in tests
};
```

- Empty patch arrays are ignored.
- Coalescing: if `coalesceKey` matches the top entry's key **and** the time delta ≤ `coalesceMs`, the patches are appended to the top entry instead of opening a new one.
- Any push clears the redo stack.

### `undo()`

Returns `invertPatches(topEntry.patches)` — a new patch list that, when applied, reverses the entry. Moves the entry onto the redo stack. Returns `null` if the undo stack is empty.

### `redo()`

Returns a fresh copy of `topRedo.patches`. Moves the entry back onto the undo stack. Returns `null` if the redo stack is empty.

## `invertPatches` and `invertPatch`

Exported helpers for building your own undo logic:

```ts
import { invertPatch, invertPatches } from 'excellent-react-spreadsheet';

invertPatch({ op: 'set', address, prev: 1, next: 2 });
// { op: 'set', address, prev: 2, next: 1 }

invertPatches([a, b, c]);
// reverse order + invert each
```

Rules:

- `set` swaps `prev` and `next`.
- `insertRow` ↔ `removeRow`.
- `moveRow` swaps `from` and `to`.

## `HistoryEntry`

```ts
type HistoryEntry = {
  id: string;
  timestamp: number;
  patches: CellPatch[];
  label?: string;
  coalesceKey?: string;
};
```

`id` is a `crypto.randomUUID()` when available, otherwise a monotonic fallback (safe for SSR).

## Memory

The engine holds entries in a plain array and evicts the oldest when `maxHistory` is exceeded. A paste of 10,000 cells produces **one** entry with 10,000 `set` patches — if you need a byte cap, enforce it upstream by chunking or recycling.
