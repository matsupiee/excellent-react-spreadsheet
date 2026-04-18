import { describe, expect, it } from 'vitest';

import { buildPastePatches, parseClipboard, serializeRange } from './clipboard.js';
import type { CellPatch, CellRange, ColumnDef } from './types.js';

type Row = {
  id: string;
  name: string;
  note: string;
};

const stringColumns: ColumnDef<Row>[] = [
  {
    key: 'name',
    title: 'Name',
    getValue: (r) => r.name,
    setValue: (r, v) => ({ ...r, name: v as string }),
    serialize: (v) => (typeof v === 'string' ? v : ''),
    deserialize: (t) => t,
  },
  {
    key: 'note',
    title: 'Note',
    getValue: (r) => r.note,
    setValue: (r, v) => ({ ...r, note: v as string }),
    serialize: (v) => (typeof v === 'string' ? v : ''),
    deserialize: (t) => t,
  },
];

const makeRows = (count: number): Row[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `id-${i}`,
    name: `Name ${i}`,
    note: `Note ${i}`,
  }));

const fullRange = (height: number, width: number): CellRange => ({
  start: { row: 0, col: 0 },
  end: { row: height - 1, col: width - 1 },
});

describe('serializeRange', () => {
  it('emits TSV with \\n between rows and tabs between cells', () => {
    const rows = makeRows(2);
    const out = serializeRange({ rows, columns: stringColumns, range: fullRange(2, 2) });
    expect(out.text).toBe('Name 0\tNote 0\nName 1\tNote 1');
  });

  it('quotes fields containing tabs, newlines, or double quotes per Excel rules', () => {
    const rows: Row[] = [{ id: 'r', name: 'a\tb', note: 'line1\nline2' }];
    const out = serializeRange({ rows, columns: stringColumns, range: fullRange(1, 2) });
    expect(out.text).toBe('"a\tb"\t"line1\nline2"');

    const quoted: Row[] = [{ id: 'r', name: 'she said "hi"', note: 'ok' }];
    const q = serializeRange({ rows: quoted, columns: stringColumns, range: fullRange(1, 2) });
    expect(q.text).toBe('"she said ""hi"""\tok');
  });

  it('falls back to String() when a column omits serialize', () => {
    const columns: ColumnDef<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        getValue: (r) => r.name,
        setValue: (r, v) => ({ ...r, name: v as string }),
      },
    ];
    const rows: Row[] = [{ id: 'r', name: 'plain', note: '' }];
    const out = serializeRange({ rows, columns, range: fullRange(1, 1) });
    expect(out.text).toBe('plain');
  });

  it('emits a minimal HTML <table> mirror with escaped content', () => {
    const rows: Row[] = [{ id: 'r', name: '<b>bold</b>', note: 'a & b' }];
    const out = serializeRange({ rows, columns: stringColumns, range: fullRange(1, 2) });
    expect(out.html).toBe(
      '<table><tr><td>&lt;b&gt;bold&lt;/b&gt;</td><td>a &amp; b</td></tr></table>',
    );
  });
});

describe('parseClipboard', () => {
  it('parses TSV when tabs are present', () => {
    expect(parseClipboard('a\tb\tc\nd\te\tf')).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ]);
  });

  it('parses CSV when no tabs are present', () => {
    expect(parseClipboard('a,b,c\nd,e,f')).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ]);
  });

  it('handles quoted CSV fields with embedded commas, newlines, and escaped quotes', () => {
    const input = '"a, b","line1\nline2","she said ""hi"""\nx,y,z';
    expect(parseClipboard(input)).toEqual([
      ['a, b', 'line1\nline2', 'she said "hi"'],
      ['x', 'y', 'z'],
    ]);
  });

  it('ignores tabs inside quoted fields when detecting delimiter (stays CSV)', () => {
    expect(parseClipboard('"a\tb",c\n"d\te",f')).toEqual([
      ['a\tb', 'c'],
      ['d\te', 'f'],
    ]);
  });

  it('round-trips TSV through serializeRange', () => {
    const rows: Row[] = [
      { id: 'r0', name: 'hello', note: 'world' },
      { id: 'r1', name: 'tab\there', note: 'line1\nline2' },
    ];
    const serialized = serializeRange({ rows, columns: stringColumns, range: fullRange(2, 2) });
    const parsed = parseClipboard(serialized.text);
    expect(parsed).toEqual([
      ['hello', 'world'],
      ['tab\there', 'line1\nline2'],
    ]);
  });

  it('normalizes CRLF row separators', () => {
    expect(parseClipboard('a\tb\r\nc\td')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('returns [] for empty input', () => {
    expect(parseClipboard('')).toEqual([]);
  });
});

describe('buildPastePatches', () => {
  it('pastes a single row/col matrix at range.start and emits one patch', () => {
    const rows = makeRows(3);
    const patches = buildPastePatches({
      rows,
      columns: stringColumns,
      range: { start: { row: 1, col: 0 }, end: { row: 1, col: 0 } },
      matrix: [['X']],
    });
    expect(patches).toEqual<CellPatch[]>([
      { op: 'set', address: { row: 1, col: 0 }, prev: 'Name 1', next: 'X' },
    ]);
  });

  it('tiles a 1x1 matrix across a 2x2 selection (Google Sheets style)', () => {
    const rows = makeRows(3);
    const patches = buildPastePatches({
      rows,
      columns: stringColumns,
      range: { start: { row: 0, col: 0 }, end: { row: 1, col: 1 } },
      matrix: [['Z']],
    });
    expect(patches).toHaveLength(4);
    expect(patches.map((p) => p.op === 'set' && p.address)).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 0 },
      { row: 1, col: 1 },
    ]);
    for (const p of patches) {
      expect(p.op).toBe('set');
      if (p.op === 'set') expect(p.next).toBe('Z');
    }
  });

  it('does not tile when selection is not an exact multiple — pastes once at start', () => {
    const rows = makeRows(4);
    const patches = buildPastePatches({
      rows,
      columns: stringColumns,
      range: { start: { row: 0, col: 0 }, end: { row: 2, col: 1 } }, // 3x2, matrix is 2x2
      matrix: [
        ['A', 'B'],
        ['C', 'D'],
      ],
    });
    // 3 is not a multiple of 2 → paste once: 2x2 patches
    expect(patches).toHaveLength(4);
    expect(patches[0]).toEqual({
      op: 'set',
      address: { row: 0, col: 0 },
      prev: 'Name 0',
      next: 'A',
    });
    expect(patches[3]).toEqual({
      op: 'set',
      address: { row: 1, col: 1 },
      prev: 'Note 1',
      next: 'D',
    });
  });

  it('skips cells in readOnly columns (boolean form)', () => {
    const rows = makeRows(2);
    const columns: ColumnDef<Row>[] = [
      { ...stringColumns[0]! },
      { ...stringColumns[1]!, readOnly: true },
    ];
    const patches = buildPastePatches({
      rows,
      columns,
      range: { start: { row: 0, col: 0 }, end: { row: 0, col: 1 } },
      matrix: [['X', 'Y']],
    });
    expect(patches).toHaveLength(1);
    expect(patches[0]).toMatchObject({ address: { row: 0, col: 0 }, next: 'X' });
  });

  it('skips cells in readOnly columns (function form) per row', () => {
    const rows = makeRows(2);
    const columns: ColumnDef<Row>[] = [
      { ...stringColumns[0]! },
      { ...stringColumns[1]!, readOnly: (r) => r.id === 'id-1' },
    ];
    const patches = buildPastePatches({
      rows,
      columns,
      range: { start: { row: 0, col: 0 }, end: { row: 1, col: 1 } },
      matrix: [
        ['A', 'B'],
        ['C', 'D'],
      ],
    });
    // row 0 col 1 writeable ('B'), row 1 col 1 readOnly (skipped)
    const addresses = patches.map((p) => (p.op === 'set' ? p.address : null));
    expect(addresses).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 0 },
    ]);
  });

  it('skips cells when deserialize is missing and column Value is not string', () => {
    type NumRow = { id: string; count: number };
    const numRows: NumRow[] = [{ id: 'r0', count: 10 }];
    const columns: ColumnDef<NumRow>[] = [
      {
        key: 'count',
        title: 'Count',
        // Intentionally no serialize/deserialize — Value is number.
        getValue: (r) => r.count,
        setValue: (r, v) => ({ ...r, count: v as number }),
      },
    ];
    const patches = buildPastePatches({
      rows: numRows,
      columns,
      range: { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } },
      matrix: [['42']],
    });
    expect(patches).toEqual([]);
  });

  it('uses raw string when deserialize is missing and Value is string-compatible', () => {
    const rows: Row[] = [{ id: 'r0', name: 'old', note: '' }];
    const columns: ColumnDef<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        getValue: (r) => r.name,
        setValue: (r, v) => ({ ...r, name: v as string }),
      },
    ];
    const patches = buildPastePatches({
      rows,
      columns,
      range: { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } },
      matrix: [['new']],
    });
    expect(patches).toEqual<CellPatch[]>([
      { op: 'set', address: { row: 0, col: 0 }, prev: 'old', next: 'new' },
    ]);
  });

  it('returns [] for empty matrix', () => {
    const rows = makeRows(1);
    expect(
      buildPastePatches({
        rows,
        columns: stringColumns,
        range: fullRange(1, 1),
        matrix: [],
      }),
    ).toEqual([]);
  });

  it('clips cells that fall outside the rows/columns arrays (no table growth)', () => {
    const rows = makeRows(2);
    const patches = buildPastePatches({
      rows,
      columns: stringColumns,
      range: { start: { row: 1, col: 1 }, end: { row: 1, col: 1 } },
      matrix: [
        ['A', 'B'],
        ['C', 'D'],
      ],
    });
    // Only (1,1) is in-bounds — row 2 is past rows.length, col 2 is past columns.length.
    expect(patches).toHaveLength(1);
    expect(patches[0]).toMatchObject({ address: { row: 1, col: 1 }, next: 'A' });
  });
});
