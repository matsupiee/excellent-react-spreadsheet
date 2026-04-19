# ADR 0005: `CellContext` に `onValueChange` を足して、表示モードのまま値を書き換えられるようにする

- **Status**: Accepted
- **Date**: 2026-04-19
- **Deciders**: Claude Code + 人間ユーザ（承認済み）

## Context

`checkboxColumn` の挙動について、ユーザから「セルにフォーカスが当たっていない状態でも、チェックボックスをクリックしたらチェックが入ったり外れたりしてほしい」という要望が出た。Google Sheets と同じ挙動である。

現状の実装（`packages/core/src/columns/checkboxColumn.tsx`）:

- `renderCell` は `readOnly` の `<input type="checkbox">` を返すだけで、クリックしても何も起こらない。
- 値を変更するには、セルをフォーカスして Enter / F2 で edit mode に入り、編集用の `<input>` をスペース等で操作して commit する必要がある。
- 1 クリックで値が変えられず、Google Sheets 的な使い勝手から外れている。

原因は、`CellContext` には `value` / `row` / `rowIndex` / `address` しかなく、**表示モードから値を commit するためのフックが無い**こと。現状で値を書き換えるには `renderEditor` 経由の edit mode しかない。

チェックボックスに限らず、スイッチ列、インライン ±1 カウンタ列、アクションボタンを持つ列など、「表示モードのまま 1 クリックで値を切り替える」列プリセットは今後も増えることが予想される。

## Decision

`CellContext<Row, Value>` に optional な `onValueChange?: (next: Value) => void` を追加する。

- `<Spreadsheet>` は `renderCell` 呼び出し時に、`applyPatches` でその場に `set` patch を発行するコールバックとして `onValueChange` を渡す。`reason` は `'edit'`、`coalesceKey` は他の編集系と同じ `edit:${row}:${col}` を使う（連続トグルを 1 エントリにまとめる）。
- **`ColumnDef.readOnly`（boolean / predicate）が真なら `onValueChange` を渡さない**（`undefined` のまま）。列プリセット側は「`onValueChange` が来ていれば対話的 UI、来ていなければ表示のみ」と素直に書ける。
- `checkboxColumn.renderCell` は `onValueChange` が渡ってきたら `<input type="checkbox">` を対話的に（`readOnly={false}` + `onChange`）レンダリングし、クリック時に `value !== true ? true : false` を書き込む（`null`（indeterminate）→ `true`、`false` → `true`、`true` → `false`。Google Sheets 準拠）。
- `<td>` の `onMouseDown`（セル選択 + root focus）はそのまま伝播させる。クリック 1 回でセル選択 + 値トグルの両方が起きる。これも Google Sheets の挙動と一致する。

## Consequences

### Good

- `checkboxColumn` が 1 クリックで切り替え可能になり、Google Sheets 相当のインタラクションが得られる（要件 §5.1 の列プリセット要件に沿う）。
- 列プリセット側の実装が単純化される：`onValueChange` の有無で「書き込める / 書き込めない」が判別でき、`readOnly` を列プリセットが自前で再評価しなくてよい。
- 将来のトグル系列（Switch, ±1 カウンタ, 星評価など）も同じ API で実装できる。
- Undo/Redo の仕組みとは矛盾しない：`applyPatches` を経由するので履歴にも乗る。coalescing キーを統一しているので連打はまとまる。

### Bad

- `CellContext` の表面積が 1 フィールド増え、`renderCell` の実装者が `onValueChange` の扱いで悩む余地が増える（optional である旨と readOnly との関係を docs/api-draft.md で明記する）。
- 同じセルに対して display-mode の `onValueChange` と edit-mode の `EditorContext.onChange` + `onCommit` の 2 系統が存在することになる。どちらを使うかは列プリセット次第。ドキュメントで使い分け指針を書く必要がある。

### Neutral

- `CellContext` は optional 追加なので既存列プリセット（`textColumn` など）に破壊的変更はない。
- `api-draft.md` §2 の `CellContext` 説明を追記で更新する。

## Alternatives considered

### 案 A（採用）: `CellContext.onValueChange` を optional で足す

本 ADR の決定内容。

### 案 B: `Spreadsheet` 側で checkbox 用の特別ハンドリングを入れる（mousedown の target が `input[type=checkbox]` なら toggle）

- プラガブルな列プリセット設計（§5.1「ビルトイン列は `ColumnDef` で書かれる」）に反する。checkbox を特別扱いすると「カスタム列で同じことをしたい」要望に応えられない。
- 却下。

### 案 C: `renderCell` が使える props を増やす代わりに、checkbox 専用の `renderToggle` API を新設

- 列タイプごとに API が分岐し、`ColumnDef` が肥大化する。checkbox 以外の toggle 系列（Switch, 星評価など）で再発明することになる。
- 却下。

### 案 D: edit mode を使って 1 クリックで commit する（`onClick` で startEdit → 値反転 → commit）

- 「クリックしたら edit mode に入って瞬時に出る」のは挙動として不自然で、ちらつきや focus の行き来が起きる。フォーミュラエンジン導入後は edit mode が重くなるので、避けたい。
- 却下。

## References

- `requirements.md` §5.1（列プリセット / checkbox）
- `api-draft.md` §2.2（`ColumnDef`）/ §2.3（`EditorContext` / `CellContext`）
- `packages/core/src/types.ts`（`CellContext`, `ColumnDef.readOnly`）
- `packages/core/src/Spreadsheet.tsx`（`applyPatches`, `handleCellMouseDown`）
- `packages/core/src/columns/checkboxColumn.tsx`
