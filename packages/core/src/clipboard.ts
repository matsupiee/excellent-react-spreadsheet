import type { CellPatch, CellRange, ColumnDef } from './types.js';

/**
 * Pure, DOM-less clipboard helpers for the spreadsheet engine.
 *
 * - `serializeRange` emits Excel-compatible TSV plus a minimal HTML <table>
 *   mirror for rich-paste consumers.
 * - `parseClipboard` auto-detects TSV vs CSV and handles quoted fields with
 *   embedded newlines and escaped quotes.
 * - `buildPastePatches` tiles a parsed matrix across the selection and emits
 *   `CellPatch[]` that the hook can forward to `applyPatches`.
 *
 * DOM wiring (navigator.clipboard / execCommand / keyboard events) lives in
 * `<Spreadsheet>`; this module is intentionally side-effect free.
 */

type SerializeRangeArgs<Row> = {
  rows: Row[];
  columns: ColumnDef<Row>[];
  range: CellRange;
};

export type SerializedRange = {
  text: string;
  html: string;
};

type BuildPastePatchesArgs<Row> = {
  rows: Row[];
  columns: ColumnDef<Row>[];
  range: CellRange;
  matrix: string[][];
};

const normalizeRange = (range: CellRange): CellRange => {
  const startRow = Math.min(range.start.row, range.end.row);
  const endRow = Math.max(range.start.row, range.end.row);
  const startCol = Math.min(range.start.col, range.end.col);
  const endCol = Math.max(range.start.col, range.end.col);
  return {
    start: { row: startRow, col: startCol },
    end: { row: endRow, col: endCol },
  };
};

const defaultStringify = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return String(value);
};

const TSV_SPECIAL = /[\t\r\n"]/;

/**
 * Quote a TSV field when it contains a tab, newline, CR, or double quote.
 * Double quotes are doubled per Excel convention so round-tripping is safe.
 */
const quoteTsvField = (raw: string): string => {
  if (!TSV_SPECIAL.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
};

const escapeHtml = (raw: string): string =>
  raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Build an Excel-compatible TSV payload plus a minimal HTML table mirror.
 * The column's `serialize` is used to stringify values; when absent we fall
 * back to `String(value)` (empty string for null/undefined) to stay predictable.
 */
export const serializeRange = <Row>({
  rows,
  columns,
  range,
}: SerializeRangeArgs<Row>): SerializedRange => {
  const norm = normalizeRange(range);
  const tsvLines: string[] = [];
  const htmlRows: string[] = [];

  for (let r = norm.start.row; r <= norm.end.row; r += 1) {
    const row = rows[r];
    const tsvCells: string[] = [];
    const htmlCells: string[] = [];
    for (let c = norm.start.col; c <= norm.end.col; c += 1) {
      const column = columns[c];
      let text = '';
      if (row !== undefined && column !== undefined) {
        const value = column.getValue(row);
        text = column.serialize !== undefined ? column.serialize(value) : defaultStringify(value);
      }
      tsvCells.push(quoteTsvField(text));
      htmlCells.push(`<td>${escapeHtml(text)}</td>`);
    }
    tsvLines.push(tsvCells.join('\t'));
    htmlRows.push(`<tr>${htmlCells.join('')}</tr>`);
  }

  return {
    text: tsvLines.join('\n'),
    html: `<table>${htmlRows.join('')}</table>`,
  };
};

/**
 * Detect whether the incoming text should be parsed as TSV or CSV.
 * Preference: if any row contains an unquoted tab, treat as TSV; otherwise CSV.
 * Quoted regions are skipped when sniffing so `"a,b\tc"` doesn't confuse us.
 */
const detectDelimiter = (text: string): '\t' | ',' => {
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (ch === '\t') return '\t';
  }
  return ',';
};

/**
 * Parse a TSV or CSV blob into a 2D matrix.
 *
 * Handles quoted fields, escaped quotes (`""` -> `"`), and embedded newlines
 * inside quoted fields. Line terminators `\r\n`, `\n`, and bare `\r` are
 * normalized to row boundaries.
 */
export const parseClipboard = (text: string): string[][] => {
  if (text === '') return [];
  const delim = detectDelimiter(text);
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  const pushField = (): void => {
    row.push(field);
    field = '';
  };
  const pushRow = (): void => {
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === delim) {
      pushField();
      i += 1;
      continue;
    }
    if (ch === '\r') {
      pushField();
      pushRow();
      if (text[i + 1] === '\n') i += 2;
      else i += 1;
      continue;
    }
    if (ch === '\n') {
      pushField();
      pushRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  // Always flush the trailing field/row so `a\tb` yields [["a","b"]] and a
  // dangling newline does not synthesize a phantom empty row.
  if (field !== '' || row.length > 0) {
    pushField();
    pushRow();
  }

  return rows;
};

const isReadOnly = <Row>(column: ColumnDef<Row>, row: Row): boolean => {
  const ro = column.readOnly;
  if (ro === undefined) return false;
  if (typeof ro === 'boolean') return ro;
  return ro(row);
};

/**
 * Detect whether a column's `Value` type is "string-compatible" by sniffing
 * a sample value from the first row the patch touches. When there is no row
 * to sample (empty table) or the cell value is `undefined`, we assume it is
 * string-compatible — the caller can override with an explicit `deserialize`.
 */
const columnAcceptsRawString = <Row>(
  column: ColumnDef<Row>,
  sampleRow: Row | undefined,
): boolean => {
  if (sampleRow === undefined) return true;
  const sample: unknown = column.getValue(sampleRow);
  if (sample === null || sample === undefined) return true;
  return typeof sample === 'string';
};

/**
 * Tile a parsed matrix into the selection and produce `set` patches.
 *
 * - If the selection is an exact integer multiple of the matrix dimensions,
 *   tile (Google Sheets behavior). Otherwise paste once at `range.start`.
 * - Cells outside the row/column array are skipped (no table growth here).
 * - `readOnly` columns are skipped (evaluating the function form per row).
 * - Columns missing `deserialize` whose `Value` is not string-compatible are
 *   skipped — we refuse to coerce a raw string into e.g. a number silently.
 */
export const buildPastePatches = <Row>({
  rows,
  columns,
  range,
  matrix,
}: BuildPastePatchesArgs<Row>): CellPatch[] => {
  if (matrix.length === 0) return [];
  const matrixHeight = matrix.length;
  const matrixWidth = matrix.reduce((max, r) => Math.max(max, r.length), 0);
  if (matrixWidth === 0) return [];

  const norm = normalizeRange(range);
  const selHeight = norm.end.row - norm.start.row + 1;
  const selWidth = norm.end.col - norm.start.col + 1;

  // Tile only when the selection is an exact multiple in BOTH dimensions;
  // otherwise paste once at the top-left. Mirrors Google Sheets.
  const tileRows =
    selHeight > matrixHeight && selHeight % matrixHeight === 0 ? selHeight / matrixHeight : 1;
  const tileCols =
    selWidth > matrixWidth && selWidth % matrixWidth === 0 ? selWidth / matrixWidth : 1;

  const totalRows = matrixHeight * tileRows;
  const totalCols = matrixWidth * tileCols;

  const patches: CellPatch[] = [];

  for (let dr = 0; dr < totalRows; dr += 1) {
    const targetRow = norm.start.row + dr;
    if (targetRow < 0 || targetRow >= rows.length) continue;
    const row = rows[targetRow];
    if (row === undefined) continue;
    const matrixRow = matrix[dr % matrixHeight];
    if (matrixRow === undefined) continue;

    for (let dc = 0; dc < totalCols; dc += 1) {
      const targetCol = norm.start.col + dc;
      if (targetCol < 0 || targetCol >= columns.length) continue;
      const column = columns[targetCol];
      if (column === undefined) continue;
      if (isReadOnly(column, row)) continue;
      const raw = matrixRow[dc % matrixWidth];
      if (raw === undefined) continue;

      const prev: unknown = column.getValue(row);
      let next: unknown;
      if (column.deserialize !== undefined) {
        next = column.deserialize(raw);
      } else {
        // Why: refuse to blindly coerce a string into a non-string Value. The
        // column must opt-in to paste semantics by providing `deserialize`.
        if (!columnAcceptsRawString(column, rows[0])) continue;
        next = raw;
      }
      patches.push({
        op: 'set',
        address: { row: targetRow, col: targetCol },
        prev,
        next,
      });
    }
  }

  return patches;
};
