import type { Meta, StoryObj } from '@storybook/react';
import { floatColumn, textColumn } from 'excellent-react-spreadsheet';

import { GalleryTable, toGalleryColumn } from './_GalleryTable.js';

type Row = {
  id: string;
  label: string;
  price: number | null;
  ratio: number | null;
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const columns = [
  toGalleryColumn(textColumn<Row, 'label'>({ key: 'label', title: 'Label' })),
  toGalleryColumn(
    floatColumn<Row, 'price'>({
      key: 'price',
      title: 'Price (USD)',
      precision: 2,
      formatBlurred: (value: number) => currencyFormatter.format(value),
    }),
  ),
  toGalleryColumn(
    floatColumn<Row, 'ratio'>({
      key: 'ratio',
      title: 'Ratio (0..1)',
      min: 0,
      max: 1,
      precision: 3,
    }),
  ),
];

const rows: Row[] = [
  { id: 'r1', label: 'Normal', price: 19.99, ratio: 0.25 },
  { id: 'r2', label: 'Zero', price: 0, ratio: 0 },
  { id: 'r3', label: 'Null', price: null, ratio: null },
  { id: 'r4', label: 'Boundary', price: 1234567.5, ratio: 1 },
  { id: 'r5', label: 'Tiny fraction', price: 0.01, ratio: 0.00125 },
];

const meta: Meta<typeof GalleryTable<Row>> = {
  title: 'Columns/FloatColumn',
  component: GalleryTable<Row>,
};

export default meta;

type Story = StoryObj<typeof GalleryTable<Row>>;

export const Default: Story = {
  args: {
    columns,
    rows,
    getRowKey: (row: Row) => row.id,
  },
};
