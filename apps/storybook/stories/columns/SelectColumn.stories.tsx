import type { Meta, StoryObj } from '@storybook/react';
import { selectColumn, textColumn } from 'excellent-react-spreadsheet';

import { GalleryTable, toGalleryColumn } from './_GalleryTable.js';

type Status = 'open' | 'in_progress' | 'done';
type Priority = 1 | 2 | 3;

type Row = {
  id: string;
  title: string;
  status: Status | null;
  priority: Priority | null;
};

const statusOptions = [
  { value: 'open' as const, label: 'Open' },
  { value: 'in_progress' as const, label: 'In progress' },
  { value: 'done' as const, label: 'Done' },
];

const priorityOptions = [
  { value: 1 as const, label: 'P1 — urgent' },
  { value: 2 as const, label: 'P2 — normal' },
  { value: 3 as const, label: 'P3 — low' },
];

const columns = [
  toGalleryColumn(textColumn<Row, 'title'>({ key: 'title', title: 'Title' })),
  toGalleryColumn(
    selectColumn<Row, 'status', Status>({
      key: 'status',
      title: 'Status',
      options: statusOptions,
    }),
  ),
  toGalleryColumn(
    selectColumn<Row, 'priority', Priority>({
      key: 'priority',
      title: 'Priority',
      options: priorityOptions,
    }),
  ),
];

const rows: Row[] = [
  { id: 'r1', title: 'Design API', status: 'done', priority: 1 },
  { id: 'r2', title: 'Implement presets', status: 'in_progress', priority: 2 },
  { id: 'r3', title: 'Write gallery stories', status: 'open', priority: 3 },
  { id: 'r4', title: 'Unassigned yet', status: null, priority: null },
];

const meta: Meta<typeof GalleryTable<Row>> = {
  title: 'Columns/SelectColumn',
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
