import type { Meta, StoryObj } from '@storybook/react';
import { dateColumn, textColumn } from 'excellent-react-spreadsheet';

import { GalleryTable, toGalleryColumn } from './_GalleryTable.js';

type Row = {
  id: string;
  label: string;
  dueDate: Date | null;
  releasedAt: Date | null;
};

const columns = [
  toGalleryColumn(textColumn<Row, 'label'>({ key: 'label', title: 'Milestone' })),
  toGalleryColumn(
    dateColumn<Row, 'dueDate'>({
      key: 'dueDate',
      title: 'Due Date',
      min: new Date(Date.UTC(2024, 0, 1)),
      max: new Date(Date.UTC(2030, 11, 31)),
    }),
  ),
  toGalleryColumn(dateColumn<Row, 'releasedAt'>({ key: 'releasedAt', title: 'Released At' })),
];

const rows: Row[] = [
  {
    id: 'r1',
    label: 'Alpha',
    dueDate: new Date(Date.UTC(2025, 2, 15)),
    releasedAt: new Date(Date.UTC(2025, 3, 1)),
  },
  {
    id: 'r2',
    label: 'Beta (no release yet)',
    dueDate: new Date(Date.UTC(2026, 5, 30)),
    releasedAt: null,
  },
  { id: 'r3', label: 'Undecided', dueDate: null, releasedAt: null },
  {
    id: 'r4',
    label: 'At min boundary',
    dueDate: new Date(Date.UTC(2024, 0, 1)),
    releasedAt: new Date(Date.UTC(1999, 11, 31)),
  },
  {
    id: 'r5',
    label: 'At max boundary',
    dueDate: new Date(Date.UTC(2030, 11, 31)),
    releasedAt: new Date(Date.UTC(2099, 0, 1)),
  },
];

const meta: Meta<typeof GalleryTable<Row>> = {
  title: 'Columns/DateColumn',
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
