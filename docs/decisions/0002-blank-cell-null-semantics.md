# ADR 0002: 空セルは `null` で正規化する

- **Status**: Accepted
- **Date**: 2026-04-18
- **Deciders**: Claude Code + 人間ユーザ（承認済み）

## Context

セルへの空入力（ユーザ手入力による backspace 全消去、および paste 経由の空セル流入）をどう扱うかを、列プリセット全体で一貫させる必要がある。

- `intColumn` / `floatColumn` は既に実装済みで、`parseIntegerInput` / `parseFloatInput` が空文字列を `{ ok: true, value: null }` に正規化している（`packages/core/src/columns/numeric.ts` の `isBlank`）。
- 残りの列プリセット `checkboxColumn` / `dateColumn` / `selectColumn` を実装するにあたり、空入力の扱い方をそれぞれ別々に決めると、値型ごとに振る舞いがバラつき、コピペ・Undo・フォーミュラ伝播の振る舞いが予測しづらくなる。
- `boolean` 列で「blank = false」にすると、Excel の 3 状態チェックボックス（true / false / 未設定）が表現できず、`react-datasheet-grid` で自社プロジェクトが踏んでいる痛点（空 = 偽と見なされて保存時に偽に固定される）を本ライブラリでも再現してしまう。
- `CLAUDE.md` §5.3 は「`any` を使わない」「型推論が効く」ことを求めており、`undefined` を空セル記号として採用すると TypeScript の optional プロパティ（`field?: T`）と衝突し、列定義の型で `T | null | undefined` と三つ組を扱うことになって利用者の認知負荷が上がる。

## Decision

- 列プリセットは**空入力を `null` に正規化**する。`undefined` は使わない。
- したがって値型を持つ列プリセットは `ColumnDef<Row, T | null>` を返す（`T` は `number`, `boolean`, `Date`, enum 値など）。`textColumn` だけは `string` の性質上 `''` と `null` を区別する必要がないため、例外として `ColumnDef<Row, string>` を返す（既存実装を維持）。
- `boolean` 列は「blank = false」ではなく「blank = null」とし、3 状態（true / false / 未設定）を表現する。チェックボックスの UI では `null` を indeterminate で描画する。
- 行型側のキー絞り込みユーティリティ（`IntegerKeysOf<Row>` / `FloatKeysOf<Row>` / 新設の `BooleanKeysOf<Row>` / `DateKeysOf<Row>`）は `Row[K] extends T | null | undefined` を許容する。`undefined` はユーザの行型定義 (`field?: T`) を受け入れるためだけに残し、列プリセット内部で値を取り出す時点で `null` に畳む。

## Consequences

### Good

- 空と偽、空とゼロ、空と「epoch」を区別できる。フォームで「未入力」を表現したい UX を素直に実装できる。
- パース失敗時の振る舞い（`'abc'` を int として受け取ったとき `null`）と空入力の振る舞いが揃い、ユーザが覚えるルールが 1 本になる。
- 既存の業務データベース設計（nullable column）との親和性が高い。`react-datasheet-grid` 置換時、DB の NULL をそのまま表示・保持できる。
- TypeScript で optional プロパティ（`field?: T`）と明示的な null (`field: T | null`) のどちらで行型を書いても、列プリセットを使い回せる。

### Bad

- 利用者は `row.count` が `number | null`、`row.enabled` が `boolean | null` であることを常に意識する必要がある。条件分岐で `=== null` の扱いを書く必要が出る。
- フォーミュラ計算時に「`null` をどう伝播するか」（`SUM` で無視する / `A1 + null` がどうなるか / 空セル参照が `0` 扱いかエラーか）を別途決める必要がある。本 ADR ではそのポリシーまでは確定しない（フォーミュラ実装フェーズで別 ADR として記録する）。
- チェックボックスの `null` 状態を「indeterminate」としてしか表現しないと、キーボード操作で「true → false → null」の 3 状態サイクルが必要か 2 状態サイクルで良いかの UX 判断が残る（v1.0 は 2 状態トグルとし、`null` は既存値としてのみ許容する）。

### Neutral

- `serialize(null)` は `''` を返す。Excel / TSV の空セルと往復可能。
- `textColumn` の非対称（`''` と `null` を区別しない）はドキュメントで明記する必要がある。

## Alternatives considered

### 案 A（採用）: 空 → `null`

本 ADR の内容。

### 案 B: 空 → `undefined`

TypeScript の optional プロパティ (`field?: T`) と区別できなくなる。`exactOptionalPropertyTypes` を有効化している利用者プロジェクトで列プリセットの型が噛み合わなくなるリスクがある。却下。

### 案 C: 空 → 型のデフォルト値（`0` / `false` / `new Date(0)`）

blank と「意図的に 0 / false / 1970-01-01 を入れた値」が区別できない。`react-datasheet-grid` の痛点そのものなので却下。

### 案 D: 列ごとに個別ポリシー

`checkboxColumn` は `false`、`dateColumn` は `null`、`intColumn` は `null` …のようなバラつきは利用者の認知負荷を上げ、コピペ・Undo の coalescing ルールも列ごとに特殊化する必要が生じる。却下。

## References

- `CLAUDE.md` §5（設計原則）/ §6（列プリセットの作り方）/ §7（禁止事項）
- `api-draft.md` §2.1（ビルトインプリセット）
- `requirements.md` §5.1（必須の列プリセット一覧）
- `packages/core/src/columns/numeric.ts`（`isBlank` / `clamp`）
- 関連 ADR: ADR-0001（controlled / hybrid の住み分け）
