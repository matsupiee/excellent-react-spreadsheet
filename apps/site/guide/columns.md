# Columns

Columns are the typed bridge between your row objects and the grid. Each preset factory returns a `ColumnDef<Row, Value>` with `getValue`, `setValue`, `renderCell`, `renderEditor`, and `serialize`/`deserialize` already wired for the target value type.

## Gallery

<ClientOnly>
  <ReactIsland :component="() => import('../demos/ColumnGallery')" />
</ClientOnly>

## Built-in presets

| Factory          | Value type        | Notes                                                             |
| ---------------- | ----------------- | ----------------------------------------------------------------- |
| `textColumn`     | `string`          | `placeholder`, `maxLength`                                        |
| `intColumn`      | `number \| null`  | `min`, `max` (clamped); blank input → `null`                      |
| `floatColumn`    | `number \| null`  | `min`, `max`, `precision`, `formatBlurred`                        |
| `checkboxColumn` | `boolean \| null` | tri-state (null → indeterminate)                                  |
| `dateColumn`     | `Date \| null`    | ISO UTC display, native `<input type="date">` editor, `min`/`max` |
| `selectColumn`   | `Value \| null`   | static options; `renderEditor` for design-system integration      |
| `customColumn`   | whatever you want | full manual control; wrap any React component as an editor        |

Each preset type-gates on a filtered key set. For example, `intColumn<Row, K>` requires `K` to be a property of `Row` whose type is `number` (nullable or not). You can't accidentally attach an `intColumn` to a `string` field.

```ts
type Person = { name: string; age: number };

// ✅ compiles
intColumn<Person, 'age'>({ key: 'age', title: 'Age' });

// ❌ "'name' is not assignable to IntegerKeysOf<Person>"
intColumn<Person, 'name'>({ key: 'name', title: 'Age' });
```

## Value shapes and round-tripping

Column serializers round-trip through the clipboard. When you copy a `dateColumn` cell, the TSV payload is an ISO date string; pasting that string back into another `dateColumn` produces a `Date` object, not a string. This is why columns need a `deserialize` function — without it, the library refuses to paste strings into non-string columns (see [Copy & Paste](/guide/copy-paste) for the rule).

## Custom columns

When none of the presets fit, reach for `customColumn`. You own both the renderer and the editor.

```tsx
import { customColumn } from 'excellent-react-spreadsheet';

customColumn<Product, string>({
  key: 'status',
  title: 'Status',
  readOnly: true,
  getValue: (row) => (row.stock === 0 ? 'out of stock' : row.active ? 'live' : 'paused'),
  setValue: (row) => row,
  renderCell: ({ value }) => <Pill tone={tone(value)}>{value}</Pill>,
});
```

`customColumn` does not default `serialize`/`deserialize`. If you want this column to participate in copy/paste, provide them explicitly.

## Bringing your own `<Select>`

The headless philosophy shines when you embed your design system's primitives. `selectColumn` supports `renderEditor` to override the native `<select>`:

```tsx
selectColumn<Row, 'role', Role>({
  key: 'role',
  title: 'Role',
  options: ROLE_OPTIONS,
  renderEditor: (ctx) => (
    <ChakraSelect
      value={ctx.value}
      onChange={(value) => ctx.onChange(value)}
      onClose={ctx.onCommit}
      onCancel={ctx.onCancel}
    />
  ),
});
```

The `EditorContext` gives you `onCommit` (commit + move selection) and `onCancel` (revert), so the library still owns the state machine while you own the visuals.

::: warning Not yet shipped
`selectColumn`'s `renderEditor` is planned for v1.0 but currently uses only the native `<select>`. Follow the [roadmap](/roadmap) for progress.
:::
