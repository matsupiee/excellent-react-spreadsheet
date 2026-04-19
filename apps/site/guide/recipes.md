# Recipes

Short, self-contained examples for common patterns. Each recipe is a snippet you can paste into your app; none of them depend on the others.

## 1. Keyboard-driven cell editing

Hook up `Enter`, `F2`, arrow keys, and printable-character-starts-editing on a root wrapper:

```tsx
<div
  tabIndex={0}
  onKeyDown={(event) => {
    const { key } = event;
    const meta = event.metaKey || event.ctrlKey;
    if (meta && key.toLowerCase() === 'z') {
      event.preventDefault();
      event.shiftKey ? grid.redo() : grid.undo();
      return;
    }
    if (key === 'ArrowUp') grid.setSelection(move(grid.selection, -1, 0));
    if (key === 'ArrowDown') grid.setSelection(move(grid.selection, 1, 0));
    if (key === 'ArrowLeft') grid.setSelection(move(grid.selection, 0, -1));
    if (key === 'ArrowRight' || key === 'Tab') grid.setSelection(move(grid.selection, 0, 1));
  }}
>
  {/* ... render cells ... */}
</div>
```

## 2. Embed a Chakra `<Select>` as a cell editor

```tsx
import { selectColumn } from 'excellent-react-spreadsheet';
import { Select } from '@chakra-ui/react';

selectColumn<Row, 'role', Role>({
  key: 'role',
  title: 'Role',
  options: ROLE_OPTIONS,
  renderEditor: (ctx) => (
    <Select
      autoFocus
      value={ctx.value ?? ''}
      onChange={(event) => ctx.onChange(event.target.value as Role)}
      onBlur={ctx.onCommit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') ctx.onCommit();
        if (event.key === 'Escape') ctx.onCancel();
      }}
    >
      {ROLE_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </Select>
  ),
});
```

## 3. Add a row

```tsx
grid.applyPatches([{ op: 'insertRow', at: rows.length, row: emptyRow() }], {
  reason: 'edit',
  label: 'add row',
});
```

`insertRow` patches serialize into history just like `set` patches — undo will remove the row, redo will re-insert it.

## 4. Remove the selected row

```tsx
const selected = grid.selection?.start;
if (selected !== undefined) {
  const row = rows[selected.row];
  if (row !== undefined) {
    grid.applyPatches([{ op: 'removeRow', at: selected.row, row }], {
      reason: 'edit',
      label: 'remove row',
    });
  }
}
```

## 5. Read-only columns per row

```tsx
intColumn<Order, 'invoiceTotal'>({
  key: 'invoiceTotal',
  title: 'Total',
  // readOnly is evaluated for each row and each paste cell
  readOnly: (row) => row.status === 'paid',
});
```

## 6. Reset the history when the record changes

When navigating between records, clear history so `⌘Z` doesn't undo changes from the previous record:

```tsx
useEffect(() => {
  grid.clearHistory();
}, [recordId]);
```

## 7. Persist the grid as JSON

```tsx
const snapshot = {
  rows,
  history: undoStack, // if you want to persist history
};
```

Because patches are plain JSON-Patch-like objects, a history entry round-trips cleanly through `JSON.stringify` / `JSON.parse`.

## 8. Virtualize + edit

Combine the virtualizer with the editing pattern:

```tsx
const virt = useRowVirtualizer({
  rowCount: rows.length,
  rowHeight: 32,
  viewportHeight,
  scrollTop,
});

return rows.slice(virt.startIndex, virt.endIndex + 1).map((row, offset) => {
  const rowIndex = virt.startIndex + offset;
  return <GridRow key={row.id} row={row} rowIndex={rowIndex} columns={columns} grid={grid} />;
});
```

No special affordance is needed — the virtualizer is orthogonal to editing; only the rows that exist in the DOM can receive focus, which is fine.
