import type { ReactNode } from 'react';

import type { ColumnDef } from 'excellent-react-spreadsheet';

export type GalleryColumn<Row> = {
  key: string;
  title: ReactNode;
  render: (row: Row, rowIndex: number, colIndex: number) => ReactNode;
};

/**
 * Lift a ColumnDef<Row, V> into a display-only GalleryColumn<Row>. Doing the V-erasure
 * inside a generic function lets each column keep its own Value at the call site.
 */
export function toGalleryColumn<Row, V>(column: ColumnDef<Row, V>): GalleryColumn<Row> {
  const { renderCell } = column;
  return {
    key: column.key,
    title: column.title,
    render: (row, rowIndex, colIndex) => {
      const value = column.getValue(row);
      if (renderCell !== undefined) {
        return renderCell({ value, row, rowIndex, address: { row: rowIndex, col: colIndex } });
      }
      return String(value);
    },
  };
}

type GalleryTableProps<Row> = {
  columns: ReadonlyArray<GalleryColumn<Row>>;
  rows: ReadonlyArray<Row>;
  getRowKey: (row: Row, index: number) => string;
};

const container = { padding: 24, fontFamily: 'system-ui, sans-serif' } as const;
const table = {
  borderCollapse: 'collapse' as const,
  border: '1px solid #d4d4d8',
  fontSize: 14,
  background: '#fff',
};
const th = {
  border: '1px solid #d4d4d8',
  padding: '6px 10px',
  background: '#f4f4f5',
  textAlign: 'left' as const,
  fontWeight: 600,
};
const td = { border: '1px solid #e4e4e7', padding: '6px 10px', verticalAlign: 'top' as const };

export function GalleryTable<Row>({ columns, rows, getRowKey }: GalleryTableProps<Row>) {
  return (
    <div style={container}>
      <table style={table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} style={th}>
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={getRowKey(row, rowIndex)}>
              {columns.map((column, colIndex) => (
                <td key={column.key} style={td}>
                  {column.render(row, rowIndex, colIndex)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
