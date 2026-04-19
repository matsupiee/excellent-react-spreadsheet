import { useMemo, useState } from 'react';

import {
  checkboxColumn,
  intColumn,
  selectColumn,
  textColumn,
  type ColumnDef,
} from 'excellent-react-spreadsheet';

import { asColumn, MiniGrid } from './_MiniGrid.js';

type Teammate = {
  id: string;
  name: string;
  role: 'engineer' | 'designer' | 'pm';
  focus: number;
  active: boolean;
};

const ROLE_OPTIONS = [
  { label: 'Engineer', value: 'engineer' as const },
  { label: 'Designer', value: 'designer' as const },
  { label: 'PM', value: 'pm' as const },
];

const INITIAL_ROWS: Teammate[] = [
  { id: 'r1', name: 'Aiko', role: 'engineer', focus: 85, active: true },
  { id: 'r2', name: 'Bruno', role: 'designer', focus: 70, active: true },
  { id: 'r3', name: 'Chiaki', role: 'pm', focus: 60, active: false },
  { id: 'r4', name: 'Diego', role: 'engineer', focus: 90, active: true },
  { id: 'r5', name: 'Emi', role: 'designer', focus: 50, active: true },
];

export default function HeroDemo() {
  const [rows, setRows] = useState<Teammate[]>(INITIAL_ROWS);

  const columns = useMemo<ColumnDef<Teammate>[]>(
    () => [
      asColumn(textColumn<Teammate, 'name'>({ key: 'name', title: 'Name', width: 160 })),
      asColumn(
        selectColumn<Teammate, 'role', Teammate['role']>({
          key: 'role',
          title: 'Role',
          width: 140,
          options: ROLE_OPTIONS,
        }),
      ),
      asColumn(
        intColumn<Teammate, 'focus'>({
          key: 'focus',
          title: 'Focus',
          width: 110,
          min: 0,
          max: 100,
        }),
      ),
      asColumn(checkboxColumn<Teammate, 'active'>({ key: 'active', title: 'Active', width: 90 })),
    ],
    [],
  );

  return (
    <div className="ers-demo-frame">
      <MiniGrid<Teammate>
        value={rows}
        onChange={setRows}
        columns={columns}
        getRowKey={(row) => row.id}
        status={<span>{rows.length} rows · click a cell, then type or press Enter</span>}
      />
    </div>
  );
}
