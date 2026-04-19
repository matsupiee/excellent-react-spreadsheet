# Undo / Redo

Undo is not an optional feature you bolt on later. The library stores every change as a `CellPatch` and maintains a history ring per spreadsheet instance.

<ClientOnly>
  <ReactIsland :component="() => import('../demos/UndoRedoDemo')" />
</ClientOnly>

## How patches work

Every edit produces one or more patches. The base shape is:

```ts
type CellPatch =
  | { op: 'set'; address: CellAddress; prev: unknown; next: unknown }
  | { op: 'insertRow'; at: number; row: unknown }
  | { op: 'removeRow'; at: number; row: unknown }
  | { op: 'moveRow'; from: number; to: number };
```

When you call `grid.applyPatches(patches)`, the patches are applied in order (via each column's `setValue` for `set`), pushed onto the undo stack, and cleared from the redo stack.

`undo()` pops the top entry, inverts the patches, and re-applies them. `redo()` re-pushes the forward entry.

## Coalescing

Continuous typing into a single cell should produce **one** history entry, not one per keystroke. Pass a `coalesceKey` when you call `applyPatches`:

```ts
grid.applyPatches(patches, {
  reason: 'edit',
  coalesceKey: `${address.row}:${address.col}`,
});
```

Entries with the same `coalesceKey` merge when they arrive within **500 ms** of each other. Changing the coalesce key (for instance, by moving to a different cell) opens a new entry.

The same mechanism is used for paste operations — `grid.paste(text)` wraps the resulting patches into one history entry labeled `"paste N cells"`.

## Imperative API

From anywhere in your renderer:

```ts
grid.undo(); // returns boolean — whether an entry was popped
grid.redo();
grid.canUndo();
grid.canRedo();
grid.clearHistory();
```

The hook binds the common shortcuts automatically only if you wire them — the library does not attach global keyboard listeners. A typical root handler:

```tsx
function handleKeyDown(event: React.KeyboardEvent) {
  const meta = event.metaKey || event.ctrlKey;
  if (meta && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    if (event.shiftKey) grid.redo();
    else grid.undo();
  }
}
```

## Configuration

```ts
useSpreadsheet({
  // ...
  maxHistory: 500, // defaults to 200
});
```

The history engine evicts oldest entries when the limit is reached. There is no pruning by byte count — if an individual entry is large (say, a paste of 10,000 cells), it still counts as one entry.

Want to inspect history? Import the engine directly:

```ts
import { createHistory } from 'excellent-react-spreadsheet';

const history = createHistory({ maxHistory: 1000 });
history.push(patches, { label: 'bulk import' });
history.entries(); // readonly HistoryEntry[]
```

See [API / history](/api/history) for the full engine API.
