import { useMemo, useState } from 'react';

import {
  checkboxColumn,
  customColumn,
  dateColumn,
  floatColumn,
  intColumn,
  selectColumn,
  textColumn,
  type ColumnDef,
} from 'excellent-react-spreadsheet';

import { asColumn, MiniGrid } from './_MiniGrid.js';

type Product = {
  id: string;
  sku: string;
  category: 'book' | 'game' | 'music' | 'other';
  stock: number;
  price: number;
  released: Date;
  active: boolean;
};

const CATEGORY_OPTIONS = [
  { label: 'Book', value: 'book' as const },
  { label: 'Game', value: 'game' as const },
  { label: 'Music', value: 'music' as const },
  { label: 'Other', value: 'other' as const },
];

const INITIAL_ROWS: Product[] = [
  {
    id: 'p1',
    sku: 'SKU-0001',
    category: 'book',
    stock: 42,
    price: 19.99,
    released: new Date('2025-09-01'),
    active: true,
  },
  {
    id: 'p2',
    sku: 'SKU-0002',
    category: 'game',
    stock: 7,
    price: 59.0,
    released: new Date('2026-01-20'),
    active: true,
  },
  {
    id: 'p3',
    sku: 'SKU-0003',
    category: 'music',
    stock: 0,
    price: 9.49,
    released: new Date('2024-06-14'),
    active: false,
  },
];

export default function ColumnGallery() {
  const [rows, setRows] = useState<Product[]>(INITIAL_ROWS);

  const columns = useMemo<ColumnDef<Product>[]>(
    () => [
      asColumn(textColumn<Product, 'sku'>({ key: 'sku', title: 'SKU', width: 120 })),
      asColumn(
        selectColumn<Product, 'category', Product['category']>({
          key: 'category',
          title: 'Category',
          width: 120,
          options: CATEGORY_OPTIONS,
        }),
      ),
      asColumn(
        intColumn<Product, 'stock'>({
          key: 'stock',
          title: 'Stock',
          width: 90,
          min: 0,
        }),
      ),
      asColumn(
        floatColumn<Product, 'price'>({
          key: 'price',
          title: 'Price (USD)',
          width: 120,
          min: 0,
          precision: 2,
        }),
      ),
      asColumn(
        dateColumn<Product, 'released'>({
          key: 'released',
          title: 'Released',
          width: 140,
        }),
      ),
      asColumn(checkboxColumn<Product, 'active'>({ key: 'active', title: 'Active', width: 90 })),
      asColumn(
        customColumn<Product, string>({
          key: 'status',
          title: 'Status',
          width: 110,
          getValue: (row: Product): string =>
            row.stock === 0 ? 'out of stock' : row.active ? 'live' : 'paused',
          setValue: (row: Product): Product => row,
          readOnly: true,
          renderCell: ({ value }: { value: string }) => (
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 999,
                background:
                  value === 'live'
                    ? 'rgba(16, 185, 129, 0.15)'
                    : value === 'paused'
                      ? 'rgba(234, 179, 8, 0.15)'
                      : 'rgba(239, 68, 68, 0.15)',
                color: value === 'live' ? '#065f46' : value === 'paused' ? '#713f12' : '#7f1d1d',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {value}
            </span>
          ),
        }),
      ),
    ],
    [],
  );

  return (
    <div className="ers-demo-frame">
      <MiniGrid<Product>
        value={rows}
        onChange={setRows}
        columns={columns}
        getRowKey={(row) => row.id}
        status={<span>All six column presets, plus a read-only customColumn badge.</span>}
      />
    </div>
  );
}
