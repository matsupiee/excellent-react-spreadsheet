import type { Meta, StoryObj } from '@storybook/react';
import { checkboxColumn, textColumn } from 'excellent-react-spreadsheet';

import { GalleryTable, toGalleryColumn } from './_GalleryTable.js';

type Row = {
  id: string;
  task: string;
  done: boolean | null;
  archived: boolean | null;
};

const columns = [
  toGalleryColumn(textColumn<Row, 'task'>({ key: 'task', title: 'Task' })),
  toGalleryColumn(checkboxColumn<Row, 'done'>({ key: 'done', title: 'Done' })),
  toGalleryColumn(checkboxColumn<Row, 'archived'>({ key: 'archived', title: 'Archived' })),
];

const rows: Row[] = [
  { id: 'r1', task: 'Ship column presets', done: true, archived: false },
  { id: 'r2', task: 'Write Storybook gallery', done: false, archived: false },
  { id: 'r3', task: 'Unknown state (null = indeterminate)', done: null, archived: null },
  { id: 'r4', task: 'Archived + done', done: true, archived: true },
];

const meta: Meta<typeof GalleryTable<Row>> = {
  title: 'Columns/CheckboxColumn',
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
