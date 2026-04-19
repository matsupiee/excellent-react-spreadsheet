import { useCallback, useMemo, useState, type ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import {
  Spreadsheet,
  checkboxColumn,
  dateColumn,
  defineColumns,
  floatColumn,
  intColumn,
  selectColumn,
  textColumn,
  type ChangeEvent,
  type ColumnDef,
} from 'excellent-react-spreadsheet';

type Status = 'draft' | 'review' | 'published';

type Row = {
  id: string;
  name: string;
  qty: number | null;
  price: number | null;
  inStock: boolean | null;
  dueDate: Date | null;
  status: Status | null;
  note: string;
};

const statusOptions = [
  { value: 'draft' as const, label: 'Draft' },
  { value: 'review' as const, label: 'In review' },
  { value: 'published' as const, label: 'Published' },
];

const columns = defineColumns<Row>()(
  textColumn<Row, 'name'>({ key: 'name', title: 'Name', width: 180 }),
  intColumn<Row, 'qty'>({ key: 'qty', title: 'Qty', width: 80, min: 0 }),
  floatColumn<Row, 'price'>({ key: 'price', title: 'Price', width: 100, min: 0, precision: 2 }),
  checkboxColumn<Row, 'inStock'>({ key: 'inStock', title: 'In stock', width: 90 }),
  dateColumn<Row, 'dueDate'>({ key: 'dueDate', title: 'Due', width: 140 }),
  selectColumn<Row, 'status', Status>({
    key: 'status',
    title: 'Status',
    width: 140,
    options: statusOptions,
  }),
  textColumn<Row, 'note'>({ key: 'note', title: 'Note', width: 240, placeholder: '(empty)' }),
);

const initialRows: Row[] = [
  {
    id: 'r1',
    name: 'Widget A',
    qty: 12,
    price: 9.9,
    inStock: true,
    dueDate: new Date(Date.UTC(2026, 3, 24)),
    status: 'review',
    note: 'ダブルクリックまたは Enter で編集',
  },
  {
    id: 'r2',
    name: 'Widget B',
    qty: 0,
    price: 14.5,
    inStock: false,
    dueDate: new Date(Date.UTC(2026, 4, 1)),
    status: 'draft',
    note: 'Cmd+C / Cmd+V でコピペ、Cmd+Z で Undo',
  },
  {
    id: 'r3',
    name: 'Widget C',
    qty: 3,
    price: 120,
    inStock: true,
    dueDate: null,
    status: 'published',
    note: 'Delete で選択範囲クリア',
  },
  {
    id: 'r4',
    name: 'Gadget X',
    qty: null,
    price: null,
    inStock: null,
    dueDate: new Date(Date.UTC(2026, 5, 15)),
    status: null,
    note: '',
  },
  {
    id: 'r5',
    name: 'Gadget Y',
    qty: 7,
    price: 3.75,
    inStock: true,
    dueDate: new Date(Date.UTC(2026, 2, 30)),
    status: 'review',
    note: '矢印キーで移動、Shift+矢印で範囲選択',
  },
];

function PlaygroundDemo(): ReactElement {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [log, setLog] = useState<string[]>([]);

  const onChange = useCallback((next: Row[], change: ChangeEvent<Row>) => {
    setRows(next);
    setLog((prev) =>
      [`${change.reason}: ${String(change.patches.length)} patch(es)`, ...prev].slice(0, 6),
    );
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ marginTop: 0 }}>Interactive Spreadsheet</h2>
      <p style={{ color: '#52525b', marginTop: 4 }}>
        クリックで選択、ダブルクリック/Enter で編集、Cmd+Z で Undo、Cmd+C/V でコピペ、Delete
        で消去。
      </p>
      <Spreadsheet<Row>
        value={rows}
        onChange={onChange}
        columns={columns}
        getRowKey={(row) => row.id}
        maxHeight={320}
      />
      <section style={{ marginTop: 16 }}>
        <strong>Change log</strong>
        <ol
          style={{
            marginTop: 8,
            padding: '8px 16px',
            background: '#fafafa',
            border: '1px solid #e4e4e7',
            borderRadius: 4,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 12,
            minHeight: 48,
          }}
        >
          {log.length === 0 ? <li style={{ color: '#a1a1aa' }}>(no changes yet)</li> : null}
          {log.map((entry, i) => (
            <li key={`${String(i)}-${entry}`}>{entry}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}

type BigRow = {
  id: string;
  index: number;
  label: string;
  qty: number | null;
  price: number | null;
};

const bigColumns: ColumnDef<BigRow>[] = defineColumns<BigRow>()(
  intColumn<BigRow, 'index'>({ key: 'index', title: '#', width: 80 }),
  textColumn<BigRow, 'label'>({ key: 'label', title: 'Label', width: 200 }),
  intColumn<BigRow, 'qty'>({ key: 'qty', title: 'Qty', width: 100, min: 0 }),
  floatColumn<BigRow, 'price'>({ key: 'price', title: 'Price', width: 120, min: 0, precision: 2 }),
);

const ROW_COUNT = 10_000;

const makeBigRows = (count: number): BigRow[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `row-${String(i)}`,
    index: i,
    label: `Item ${String(i).padStart(5, '0')}`,
    qty: i % 17,
    price: Math.round(((i * 13) % 10_000) / 100) + 0.99,
  }));

function LargeDatasetDemo(): ReactElement {
  // Generate once per demo mount. The controlled value is lifted into state so
  // edits persist round-trips through the hook + virtualizer.
  const initial = useMemo(() => makeBigRows(ROW_COUNT), []);
  const [rows, setRows] = useState<BigRow[]>(initial);

  const onChange = useCallback((next: BigRow[], _change: ChangeEvent<BigRow>) => {
    setRows(next);
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ marginTop: 0 }}>Large Dataset ({ROW_COUNT.toLocaleString()} rows)</h2>
      <p style={{ color: '#52525b', marginTop: 4 }}>
        10,000 行の仮想スクロール。スクロール・矢印キー・編集がレンダリング行数と無関係に
        軽快に動作することを確認してください。
      </p>
      <Spreadsheet<BigRow>
        value={rows}
        onChange={onChange}
        columns={bigColumns}
        getRowKey={(row) => row.id}
        rowHeight={24}
        maxHeight={480}
      />
    </div>
  );
}

const meta: Meta<typeof PlaygroundDemo> = {
  title: 'Playground/Spreadsheet',
  component: PlaygroundDemo,
};

export default meta;

export const Default: StoryObj<typeof PlaygroundDemo> = {};

export const LargeDataset: StoryObj<typeof LargeDatasetDemo> = {
  render: () => <LargeDatasetDemo />,
};
