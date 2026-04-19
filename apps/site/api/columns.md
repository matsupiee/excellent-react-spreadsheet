# Column factories

All factories return a `ColumnDef<Row, Value>`. When storing a heterogeneous array, cast to `ColumnDef<Row>` (which widens `Value` to `unknown`).

## `textColumn`

```ts
function textColumn<Row, K extends TextColumnKey<Row>>(options: {
  key: K;
  title: ReactNode;
  width?: ColumnWidth;
  placeholder?: string;
  maxLength?: number;
}): ColumnDef<Row, string>;
```

- Restricts `K` to `Row` keys whose value type is `string`.
- Enforces `maxLength` on both editor input and paste.
- Renders `placeholder` text when the value is the empty string.

## `intColumn`

```ts
function intColumn<Row, K extends IntegerKeysOf<Row>>(options: {
  key: K;
  title: ReactNode;
  width?: ColumnWidth;
  min?: number;
  max?: number;
}): ColumnDef<Row, number | null>;
```

- Parses with `parseInt`, truncates, then clamps to `[min, max]`.
- Invalid input is rejected (editor refuses the change); blank commits `null`.
- Serializes to the decimal string; deserializes back.

## `floatColumn`

```ts
function floatColumn<Row, K extends FloatKeysOf<Row>>(options: {
  key: K;
  title: ReactNode;
  width?: ColumnWidth;
  min?: number;
  max?: number;
  precision?: number;
  formatBlurred?: (value: number) => string;
}): ColumnDef<Row, number | null>;
```

- `precision` sets the number of fractional digits when displaying.
- `formatBlurred` wins over `precision` when both are set — useful for currency, percentages, etc.

## `checkboxColumn`

```ts
function checkboxColumn<Row, K extends BooleanKeysOf<Row>>(options: {
  key: K;
  title: ReactNode;
  width?: ColumnWidth;
}): ColumnDef<Row, boolean | null>;
```

- Three-state: `true`, `false`, and `null` (indeterminate).
- Serializes to `"TRUE"` / `"FALSE"` / `""`.
- Paste accepts `true/false/1/0/✓/✔` (case-insensitive).

## `dateColumn`

```ts
function dateColumn<Row, K extends DateKeysOf<Row>>(options: {
  key: K;
  title: ReactNode;
  width?: ColumnWidth;
  min?: Date;
  max?: Date;
}): ColumnDef<Row, Date | null>;
```

- Uses a native `<input type="date">` editor (UTC ISO format).
- Clamps to `[min, max]`.
- Serializes to `"YYYY-MM-DD"` (UTC).

## `selectColumn`

```ts
function selectColumn<Row, K extends keyof Row, Value extends Row[K]>(options: {
  key: K & string;
  title: ReactNode;
  width?: ColumnWidth;
  options: ReadonlyArray<{ value: Value; label: string }>;
}): ColumnDef<Row, Value | null>;
```

- Static option list today. Row-dependent options are planned (v1.1).
- Serializes via `label`, deserializes by matching `label` _or_ `String(value)`.

## `customColumn`

```ts
function customColumn<Row, Value>(options: {
  key: string;
  title: ReactNode;
  width?: ColumnWidth;
  frozen?: 'left' | 'right';
  readOnly?: boolean | ((row: Row) => boolean);
  renderCell: (ctx: CellContext<Row, Value>) => ReactNode;
  renderEditor?: (ctx: EditorContext<Row, Value>) => ReactNode;
  serialize?: (value: Value) => string;
  deserialize?: (text: string) => Value;
  getValue?: (row: Row) => Value;
  setValue?: (row: Row, value: Value) => Row;
}): ColumnDef<Row, Value>;
```

- `renderCell` is required.
- If `getValue` / `setValue` are omitted, the column reads/writes `row[key]` untyped.
- `serialize` / `deserialize` are _not_ defaulted — provide them to participate in copy/paste safely.

## Shared types

```ts
type ColumnWidth = number | `${number}fr`;

type CellContext<Row, Value> = {
  value: Value;
  row: Row;
  rowIndex: number;
  address: CellAddress;
};

type EditorContext<Row, Value> = {
  value: Value;
  onChange: (next: Value) => void;
  onCommit: () => void;
  onCancel: () => void;
  row: Row;
  rowIndex: number;
  address: CellAddress;
};
```
