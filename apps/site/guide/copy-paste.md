# Copy & Paste

The clipboard engine is Excel-compatible TSV + a matching HTML table. Values round-trip through each column's `serialize` / `deserialize` so typed data stays typed.

<ClientOnly>
  <ReactIsland :component="() => import('../demos/CopyPasteDemo')" />
</ClientOnly>

## What gets copied

`grid.copy()` returns `{ text, html }` where `text` is TSV (tab-separated, Excel-compatible quoting) and `html` is a minimal `<table>` mirror. Both are written onto the clipboard event in the demo above via:

```tsx
function handleCopy(event: React.ClipboardEvent) {
  const payload = grid.copy();
  if (payload === null) return;
  event.preventDefault();
  event.clipboardData.setData('text/plain', payload.text);
  event.clipboardData.setData('text/html', payload.html);
}
```

Columns without an explicit `serialize` fall back to `String(value)` — for typed columns this is usually wrong, so every preset ships a serializer.

## What gets pasted

`grid.paste(text)` auto-detects TSV vs CSV, parses the matrix, and maps it across the current selection. Three behaviors to know about:

- **Tiling**: if the selection is an exact integer multiple of the matrix in both dimensions, the matrix tiles (Google Sheets behavior). Otherwise it pastes once at the top-left.
- **Read-only columns are skipped**: `readOnly: true` (or a function returning `true`) prevents writes. The paste still succeeds for the other columns.
- **Non-string columns require `deserialize`**: if a column's `Value` is not a string and it lacks `deserialize`, paste skips that cell rather than silently coercing `"42"` to a number. Every preset ships `deserialize` — `customColumn` is on you.

## Typed round-trip

The critical property: copy from any column, paste into another of the same shape, values stay typed.

- `dateColumn` copies `"2025-09-01"`, deserializes back to a `Date` instance.
- `floatColumn` copies `"19.99"`, deserializes back to `19.99` (number).
- `checkboxColumn` copies `"TRUE"` / `"FALSE"`, deserializes to `true` / `false` / `null`.
- `selectColumn` copies the option `label`, deserializes to the matched option `value`.

Paste a range from Excel, Numbers, or Google Sheets directly into the grid — the TSV parser handles quoted fields and embedded newlines.

## Cut

`grid.cut()` returns the same payload as `copy()` and then clears the cells (sets each to the empty string, then deserialized per column). The clear is a single history entry so `⌘Z` restores the range in one step.

## DOM-free helpers

If you need to run clipboard logic outside of a React tree — a worker, an SSR function, a server-side import — use the pure helpers directly:

```ts
import { serializeRange, parseClipboard, buildPastePatches } from 'excellent-react-spreadsheet';

const { text } = serializeRange({ rows, columns, range });
const matrix = parseClipboard(text);
const patches = buildPastePatches({ rows, columns, range, matrix });
```

The hook uses these under the hood.

See [API / clipboard](/api/clipboard) for full signatures.
