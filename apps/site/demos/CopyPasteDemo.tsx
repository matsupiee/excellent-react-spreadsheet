import { useMemo, useState } from 'react';

import { dateColumn, floatColumn, textColumn, type ColumnDef } from 'excellent-react-spreadsheet';

import { asColumn, MiniGrid } from './_MiniGrid.js';

type Expense = {
  id: string;
  label: string;
  amount: number;
  incurred: Date;
};

const INITIAL_ROWS: Expense[] = [
  { id: 'e1', label: 'AWS — prod', amount: 1234.56, incurred: new Date('2026-03-01') },
  { id: 'e2', label: 'Datadog', amount: 412, incurred: new Date('2026-03-02') },
  { id: 'e3', label: 'Vercel', amount: 80, incurred: new Date('2026-03-05') },
  { id: 'e4', label: 'Notion', amount: 48, incurred: new Date('2026-03-10') },
];

export default function CopyPasteDemo() {
  const [rows, setRows] = useState<Expense[]>(INITIAL_ROWS);

  const columns = useMemo<ColumnDef<Expense>[]>(
    () => [
      asColumn(textColumn<Expense, 'label'>({ key: 'label', title: 'Label', width: 180 })),
      asColumn(
        floatColumn<Expense, 'amount'>({
          key: 'amount',
          title: 'Amount',
          width: 120,
          precision: 2,
        }),
      ),
      asColumn(
        dateColumn<Expense, 'incurred'>({
          key: 'incurred',
          title: 'Incurred',
          width: 140,
        }),
      ),
    ],
    [],
  );

  return (
    <div className="ers-demo-frame">
      <MiniGrid<Expense>
        value={rows}
        onChange={setRows}
        columns={columns}
        getRowKey={(row) => row.id}
        status={
          <span>
            Select a cell, <kbd>⌘C</kbd>, move to another cell, <kbd>⌘V</kbd>. Try pasting a range
            from Excel or Numbers too.
          </span>
        }
      />
    </div>
  );
}
