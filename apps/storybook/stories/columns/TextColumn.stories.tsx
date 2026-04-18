import type { Meta, StoryObj } from '@storybook/react';
import { textColumn } from 'excellent-react-spreadsheet';

import { GalleryTable, toGalleryColumn } from './_GalleryTable.js';

type Row = {
  id: string;
  name: string;
  note: string;
};

const columns = [
  toGalleryColumn(textColumn<Row, 'name'>({ key: 'name', title: 'Name' })),
  toGalleryColumn(
    textColumn<Row, 'note'>({ key: 'note', title: 'Note', placeholder: '(empty)', maxLength: 40 }),
  ),
];

const rows: Row[] = [
  { id: 'r1', name: 'Alice', note: 'First contributor' },
  { id: 'r2', name: 'Bob', note: '' },
  { id: 'r3', name: '山田 太郎', note: '日本語テキストも表示できる' },
  { id: 'r4', name: '', note: 'Name is empty string on purpose' },
  {
    id: 'r5',
    name: 'Very long display name that still fits',
    note: 'Over-limit text gets truncated by setValue but the renderer trusts the value',
  },
];

const meta: Meta<typeof GalleryTable<Row>> = {
  title: 'Columns/TextColumn',
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
