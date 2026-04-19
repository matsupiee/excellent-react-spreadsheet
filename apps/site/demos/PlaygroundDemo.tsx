import { useMemo, useState } from 'react';

import {
  checkboxColumn,
  dateColumn,
  floatColumn,
  intColumn,
  selectColumn,
  textColumn,
  type ColumnDef,
} from 'excellent-react-spreadsheet';

import { asColumn, MiniGrid } from './_MiniGrid.js';

type Item = {
  id: string;
  name: string;
  category: 'a' | 'b' | 'c';
  count: number;
  weight: number;
  due: Date;
  done: boolean;
};

type Preset = 'minimal' | 'numeric' | 'full';

const CATEGORY_OPTIONS = [
  { label: 'Alpha', value: 'a' as const },
  { label: 'Beta', value: 'b' as const },
  { label: 'Gamma', value: 'c' as const },
];

const INITIAL_ROWS: Item[] = [
  {
    id: 'i1',
    name: 'Ticket #142',
    category: 'a',
    count: 3,
    weight: 1.5,
    due: new Date('2026-05-01'),
    done: false,
  },
  {
    id: 'i2',
    name: 'Ticket #143',
    category: 'b',
    count: 12,
    weight: 4.2,
    due: new Date('2026-04-25'),
    done: true,
  },
  {
    id: 'i3',
    name: 'Ticket #144',
    category: 'c',
    count: 0,
    weight: 0.8,
    due: new Date('2026-06-10'),
    done: false,
  },
];

const PRESETS: Record<Preset, string> = {
  minimal: 'Minimal (2 cols)',
  numeric: 'Numeric (4 cols)',
  full: 'Full (7 cols)',
};

export default function PlaygroundDemo() {
  const [rows, setRows] = useState<Item[]>(INITIAL_ROWS);
  const [preset, setPreset] = useState<Preset>('full');

  const columns = useMemo<ColumnDef<Item>[]>(() => {
    const name = asColumn(textColumn<Item, 'name'>({ key: 'name', title: 'Name', width: 180 }));
    const category = asColumn(
      selectColumn<Item, 'category', Item['category']>({
        key: 'category',
        title: 'Category',
        width: 120,
        options: CATEGORY_OPTIONS,
      }),
    );
    const count = asColumn(
      intColumn<Item, 'count'>({
        key: 'count',
        title: 'Count',
        width: 90,
        min: 0,
      }),
    );
    const weight = asColumn(
      floatColumn<Item, 'weight'>({
        key: 'weight',
        title: 'Weight',
        width: 100,
        precision: 2,
      }),
    );
    const due = asColumn(
      dateColumn<Item, 'due'>({
        key: 'due',
        title: 'Due',
        width: 140,
      }),
    );
    const done = asColumn(checkboxColumn<Item, 'done'>({ key: 'done', title: 'Done', width: 80 }));

    if (preset === 'minimal') return [name, done];
    if (preset === 'numeric') return [name, count, weight, done];
    return [name, category, count, weight, due, done];
  }, [preset]);

  return (
    <div className="ers-demo-frame">
      <MiniGrid<Item>
        value={rows}
        onChange={setRows}
        columns={columns}
        getRowKey={(row) => row.id}
        extraToolbar={
          <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
            <span>Preset:</span>
            <select
              value={preset}
              onChange={(event) => setPreset(event.currentTarget.value as Preset)}
            >
              {(Object.keys(PRESETS) as Preset[]).map((key) => (
                <option key={key} value={key}>
                  {PRESETS[key]}
                </option>
              ))}
            </select>
          </label>
        }
        status={
          <span>
            {rows.length} rows · {columns.length} columns ({PRESETS[preset]})
          </span>
        }
      />
    </div>
  );
}
