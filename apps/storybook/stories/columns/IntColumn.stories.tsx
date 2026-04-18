import type { Meta, StoryObj } from '@storybook/react';
import { intColumn, textColumn } from 'excellent-react-spreadsheet';

import { GalleryTable, toGalleryColumn } from './_GalleryTable.js';

type Row = {
  id: string;
  label: string;
  quantity: number | null;
  score: number | null;
};

const columns = [
  toGalleryColumn(textColumn<Row, 'label'>({ key: 'label', title: 'Label' })),
  toGalleryColumn(
    intColumn<Row, 'quantity'>({ key: 'quantity', title: 'Quantity', min: 0, max: 9999 }),
  ),
  toGalleryColumn(
    intColumn<Row, 'score'>({ key: 'score', title: 'Score (-100..100)', min: -100, max: 100 }),
  ),
];

const rows: Row[] = [
  { id: 'r1', label: 'Normal', quantity: 42, score: 88 },
  { id: 'r2', label: 'Zero', quantity: 0, score: 0 },
  { id: 'r3', label: 'Null', quantity: null, score: null },
  { id: 'r4', label: 'Negative (clamped on edit)', quantity: 0, score: -100 },
  { id: 'r5', label: 'At max boundary', quantity: 9999, score: 100 },
];

const meta: Meta<typeof GalleryTable<Row>> = {
  title: 'Columns/IntColumn',
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
