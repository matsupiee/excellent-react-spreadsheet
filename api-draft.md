# excellent-react-spreadsheet API ドラフト

> 要件定義書（`requirements.md`）から切り出した、公開 API の詳細案。
> 実装前の合意形成用。確定した API は `docs/` 配下の正式なリファレンスに移す。

---

## 0. 設計方針（要約）

- **Headless First**: `<Spreadsheet>` は `useSpreadsheet()` の上に載る薄いコンポーネント
- **Controlled**: 列幅・ソート・選択状態・行データはすべて props で注入、`on*` で通知（uncontrolled は提供しない）
- **TypeScript-First**: 列定義のジェネリクスから行型を推論
- **命令型 API は ref 経由**: `focus()` / `undo()` / `getSelection()` 等

---

## 1. `<Spreadsheet>` Props

```ts
type SpreadsheetProps<Row> = {
  // --- データ ---
  value: Row[];
  onChange: (rows: Row[], change: ChangeEvent<Row>) => void;
  columns: ColumnDef<Row>[];
  getRowKey: (row: Row, index: number) => string;

  // --- レイアウト（controlled） ---
  height?: number | `${number}px` | 'auto' | 'parent';
  maxHeight?: number;
  columnWidths?: Record<string, number>;         // controlled
  onColumnWidthsChange?: (w: Record<string, number>) => void;

  // --- 選択状態（controlled） ---
  selection?: Selection | null;
  onSelectionChange?: (s: Selection | null) => void;
  activeCell?: CellAddress | null;
  onActiveCellChange?: (c: CellAddress | null) => void;

  // --- 機能トグル ---
  undoRedo?: boolean;                             // default: true
  copyPaste?: boolean;                            // default: true
  rowReorder?: boolean;                           // default: false
  addRows?: boolean | { onAdd: (count: number) => void };

  // --- イベント ---
  onKeyDown?: (e: SpreadsheetKeyEvent<Row>) => void;
  onCellEdit?: (edit: CellEdit<Row>) => void;
  onPaste?: (e: PasteEvent<Row>) => void | Promise<void>;

  // --- フォーミュラ（opt-in） ---
  formula?: FormulaEngine;                        // from 'excellent-react-spreadsheet/formula'

  // --- スタイル ---
  className?: string;
  classNames?: Partial<Record<SlotName, string>>; // header, cell, row, selection, etc.
};
```

---

## 2. 列定義

### 2.1 ビルトインプリセット

```ts
textColumn<Row>({ key, title, width?, placeholder?, maxLength? })
intColumn<Row>({ key, title, width?, min?, max?, step? })
floatColumn<Row>({ key, title, width?, min?, max?, precision?, formatBlurred? })
checkboxColumn<Row>({ key, title, width? })
dateColumn<Row>({ key, title, width?, format?, min?, max? })
selectColumn<Row, Option>({
  key, title, width?,
  options: Option[] | ((row: Row) => Option[]),
  getOptionLabel: (opt: Option) => string,
  getOptionValue: (opt: Option) => string,
  renderEditor?: (ctx: SelectEditorContext<Option>) => ReactNode,  // ここで Chakra/MUI を差し込む
})
```

### 2.2 完全カスタム列

```ts
type ColumnDef<Row, Value = unknown> = {
  key: string;
  title: ReactNode;
  width?: number | `${number}fr`;
  frozen?: 'left' | 'right';
  readOnly?: boolean | ((row: Row) => boolean);

  // 値の読み書き
  getValue: (row: Row) => Value;
  setValue: (row: Row, value: Value) => Row;

  // 表示・編集
  renderCell: (ctx: CellContext<Row, Value>) => ReactNode;
  renderEditor?: (ctx: EditorContext<Row, Value>) => ReactNode;

  // シリアライズ（コピペ・フォーミュラ用）
  serialize?: (value: Value) => string;
  deserialize?: (text: string) => Value;
};
```

### 2.3 エディタコンテキスト

```ts
type EditorContext<Row, Value> = {
  value: Value;
  onChange: (next: Value) => void;  // コミット待ち
  onCommit: () => void;              // 値を確定し selection を次へ
  onCancel: () => void;              // 変更を破棄
  row: Row;
  rowIndex: number;
  address: CellAddress;
};
```

---

## 3. Undo/Redo API

### 3.1 差分表現

**採用: JSON Patch ライクな patch 配列 + 連続入力の coalescing**

```ts
type CellPatch =
  | { op: 'set'; address: CellAddress; prev: unknown; next: unknown }
  | { op: 'insertRow'; at: number; row: unknown }
  | { op: 'removeRow'; at: number; row: unknown }
  | { op: 'moveRow'; from: number; to: number };

type HistoryEntry = {
  id: string;
  timestamp: number;
  patches: CellPatch[];
  label?: string;  // "paste 5 cells" 等、UI 向けラベル
};
```

- **coalescing**: 同一セルへの連続入力は 500ms 以内 or 未 blur の間は 1 エントリに統合
- **batching**: ペースト・フィルコピー・行追加は複数 patch を 1 エントリにまとめる
- **メモリ**: 既定の履歴上限 200 エントリ。`maxHistory` prop で変更可

### 3.2 公開 API

```ts
const ref = useRef<SpreadsheetHandle<Row>>(null);

ref.current.undo();
ref.current.redo();
ref.current.canUndo();
ref.current.canRedo();
ref.current.clearHistory();
ref.current.getHistory(): HistoryEntry[];
```

---

## 4. 選択範囲 / キーボード API

### 4.1 型

```ts
type CellAddress = { row: number; col: number };
type Selection = { start: CellAddress; end: CellAddress };
```

### 4.2 命令型操作

```ts
ref.current.focus();
ref.current.setSelection(s: Selection | null);
ref.current.getSelection(): Selection | null;
ref.current.scrollTo(address: CellAddress);
ref.current.startEdit(address?: CellAddress);
ref.current.commitEdit();
ref.current.cancelEdit();
```

### 4.3 キーボード拡張

```tsx
<Spreadsheet
  onKeyDown={(e) => {
    // e.preventDefault() / e.stopPropagation() で標準動作を止められる
    // e.selection / e.activeCell / e.rows にアクセス可能
    if (e.key === 'Delete' && e.metaKey) { ... }
  }}
/>
```

---

## 5. フォーミュラ API

```ts
import { createFormulaEngine } from 'excellent-react-spreadsheet/formula';

const engine = createFormulaEngine({
  // 列名 → A1 記法の列アルファベット割当は自動（上書き可）
  columnLetters: ['A', 'B', 'C', ...],
  // 追加関数（v1.0 は固定セットのみ。v1.1+ で公開）
});

<Spreadsheet formula={engine} ... />
```

- 値が `'=...'` で始まるセルを式として評価
- 依存グラフは engine 内部で保持、1 セル変更 → 影響セルのみ再計算
- `engine.getValue(address)` / `engine.getFormula(address)` を公開

---

## 6. Headless フック

```ts
const {
  getRootProps,
  getHeaderProps,
  getRowProps,
  getCellProps,
  state: { selection, activeCell, editing },
  actions: { undo, redo, setSelection, startEdit, ... },
} = useSpreadsheet<Row>({
  value, onChange, columns, getRowKey, /* ... */
});
```

- `<Spreadsheet>` はこのフック + 既定の DOM ツリー
- レイアウトを完全に変えたい場合は `useSpreadsheet` を直接使う

---

## 7. 未決の API 論点

1. 仮想化のカスタマイズ（`overscan` / `estimateRowHeight`）をどこまで露出するか
2. `onChange` と `onCellEdit` の責務分離（冗長ではないか？）
3. フォーミュラの `A1` 参照で行が追加・削除されたときの参照追従ルール
4. controlled な `columnWidths` の初期値指定方法（`defaultColumnWidths` は作らない？）
5. Tailwind preset が提供する **クラス名の命名規則**（`ers-*` prefix？）
