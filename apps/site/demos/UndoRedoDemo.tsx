import { useMemo, useState } from 'react';

import { intColumn, textColumn, type ColumnDef } from 'excellent-react-spreadsheet';

import { asColumn, MiniGrid } from './_MiniGrid.js';

type Task = {
  id: string;
  title: string;
  priority: number;
};

const INITIAL_ROWS: Task[] = [
  { id: 't1', title: 'Refactor auth middleware', priority: 1 },
  { id: 't2', title: 'Add retry to webhook', priority: 2 },
  { id: 't3', title: 'Audit feature flags', priority: 3 },
  { id: 't4', title: 'Fix flaky login e2e', priority: 2 },
];

export default function UndoRedoDemo() {
  const [rows, setRows] = useState<Task[]>(INITIAL_ROWS);

  const columns = useMemo<ColumnDef<Task>[]>(
    () => [
      asColumn(textColumn<Task, 'title'>({ key: 'title', title: 'Task' })),
      asColumn(
        intColumn<Task, 'priority'>({
          key: 'priority',
          title: 'Priority',
          width: 110,
          min: 1,
          max: 5,
        }),
      ),
    ],
    [],
  );

  return (
    <div className="ers-demo-frame">
      <MiniGrid<Task>
        value={rows}
        onChange={setRows}
        columns={columns}
        getRowKey={(row) => row.id}
        status={
          <span>
            Edit a cell then press <kbd>⌘Z</kbd> to undo, <kbd>⌘⇧Z</kbd> to redo. Continuous typing
            in one cell coalesces into a single history entry.
          </span>
        }
      />
    </div>
  );
}
