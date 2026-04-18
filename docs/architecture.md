# Architecture — excellent-react-spreadsheet

> コードベースの地図。新しい機能を足す前に「どこに置くか」をここで確認する。
> 構造が変わったら必ずこのファイルも更新する（Stale を避ける）。

---

## 全体像

```
┌─────────────────────────────────────────────────────┐
│  apps/storybook                                      │
│   ├── visual catalog（列プリセット / Spreadsheet）    │
│   └── benchmark story（10,000 行シナリオ）            │
└──────────────────────┬──────────────────────────────┘
                       │ depends on
           ┌───────────▼──────────────┐
           │  packages/core            │
           │  `excellent-react-...`    │
           │                           │
           │  ・useSpreadsheet()       │
           │  ・<Spreadsheet>          │
           │  ・列プリセット          │
           │  ・Undo/Redo (CellPatch)  │
           │  ・Selection             │
           │  ・仮想スクロール         │
           └───────────┬──────────────┘
                       │ accepts via props (opt-in)
           ┌───────────▼──────────────┐
           │  packages/formula         │
           │  zero-dep formula engine  │
           │                           │
           │  ・parser（独自 BNF）     │
           │  ・evaluator              │
           │  ・dependency graph       │
           └───────────────────────────┘

           ┌───────────────────────────┐
           │  packages/tailwind        │
           │  Tailwind preset          │
           │  + CSS variables          │
           └───────────────────────────┘
```

**依存ルール（破らないこと）:**

- `packages/core` は `packages/formula` に**依存しない**（型インターフェース経由で opt-in）
- `packages/formula` は `packages/core` に**依存しない**（完全独立）
- `packages/tailwind` は他のパッケージに依存しない
- `apps/storybook` が唯一、すべてを統合する場

---

## packages/core 内部構造（計画）

```
packages/core/src/
├── index.ts                  # 公開 API 集約
├── types.ts                  # CellAddress, Selection, ColumnDef, Row 等
│
├── useSpreadsheet/           # ロジック層（Headless）
│   ├── index.ts
│   ├── state.ts              # reducer / 状態機械
│   ├── selection.ts          # 選択範囲計算
│   └── keyboard.ts           # キーイベント → アクション変換
│
├── Spreadsheet/              # デフォルト DOM 層
│   ├── Spreadsheet.tsx
│   ├── Header.tsx
│   ├── Row.tsx
│   ├── Cell.tsx
│   └── styles.css
│
├── columns/                  # 列プリセット
│   ├── textColumn.ts
│   ├── intColumn.ts
│   ├── floatColumn.ts
│   ├── checkboxColumn.ts
│   ├── dateColumn.ts
│   └── selectColumn.ts
│
├── history/                  # Undo/Redo（CellPatch）
│   ├── patch.ts              # CellPatch 型 + apply/invert
│   ├── coalesce.ts
│   └── store.ts
│
├── clipboard/                # Copy / Paste（TSV）
│   └── tsv.ts
│
└── virtual/                  # 仮想スクロール
    └── useVirtualRows.ts
```

---

## packages/formula 内部構造（計画）

```
packages/formula/src/
├── index.ts                  # createFormulaEngine()
├── lexer.ts                  # トークナイザ
├── parser.ts                 # BNF → AST
├── ast.ts                    # AST 型
├── evaluator.ts              # AST → 値
├── dependencies.ts           # 依存グラフ（topological）
├── errors.ts                 # #REF! / #DIV/0! / #NAME? / #VALUE!
└── functions/                # 組み込み関数
    ├── sum.ts
    ├── average.ts
    ├── min.ts
    ├── max.ts
    ├── count.ts
    ├── if.ts
    ├── and.ts
    ├── or.ts
    └── round.ts
```

---

## 公開 API との対応

要件 `api-draft.md` の各節 → 実装ファイル：

| api-draft 節                   | 実装箇所                                                    |
| ------------------------------ | ----------------------------------------------------------- |
| §1 `<Spreadsheet>` Props       | `Spreadsheet/Spreadsheet.tsx` + `types.ts`                  |
| §2.1 列プリセット              | `columns/*.ts`                                              |
| §2.2 カスタム列（`ColumnDef`） | `types.ts`                                                  |
| §3 Undo/Redo                   | `history/*.ts`                                              |
| §4 選択範囲 / キーボード       | `useSpreadsheet/selection.ts`, `useSpreadsheet/keyboard.ts` |
| §5 フォーミュラ API            | `packages/formula/src/index.ts`                             |
| §6 Headless フック             | `useSpreadsheet/index.ts`                                   |

---

## ビルド・配布

- 各 package は `tsup` で ESM + CJS + d.ts を出力
- ツリーシェイカブルにするため `sideEffects: false`
- 列プリセットは named export のみ（default export しない）
- `styles.css` は core のビルド成果物に含め、`excellent-react-spreadsheet/styles.css` として解決できるようにする
