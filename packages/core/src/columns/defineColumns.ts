import type { ColumnDef } from '../types.js';

/**
 * Compose heterogeneous preset columns into a single `ColumnDef<Row>[]` that
 * `useSpreadsheet` / `<Spreadsheet>` accept.
 *
 * Preset columns carry narrow Value types (e.g. `ColumnDef<Row, string>`)
 * that are not assignable to `ColumnDef<Row, unknown>` directly due to
 * function-parameter contravariance on `setValue` / `renderEditor` / etc.
 * Without this helper, users would need an `as unknown as ColumnDef<Row>`
 * cast on every preset.
 *
 * The helper is curried (`defineColumns<Row>()(...)`) so that TypeScript can
 * pin `Row` from the explicit annotation and independently infer each
 * column's `Value` from the variadic tuple. Inferring both in a single
 * call makes TS widen `Row` to `unknown` and loses narrowing.
 *
 * Composition is sound in practice: the hook never synthesizes values it
 * hasn't first read from the same column via `getValue` or `deserialize`,
 * so each column only ever sees values of its own Value type at runtime.
 */
export const defineColumns =
  <Row>() =>
  <T extends ReadonlyArray<unknown>>(
    ...columns: { [K in keyof T]: ColumnDef<Row, T[K]> }
  ): ColumnDef<Row>[] =>
    // Why: the cast is isolated at this boundary — we intentionally forget
    // each column's specific Value type here. All downstream reads/writes
    // only pass values the column itself produced, so the erasure never
    // round-trips.
    columns as unknown as ColumnDef<Row>[];
