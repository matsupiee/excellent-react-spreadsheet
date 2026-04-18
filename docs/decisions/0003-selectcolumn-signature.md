# ADR 0003: `selectColumn` のシグネチャを静的 enum 用途に絞る

- **Status**: Accepted
- **Date**: 2026-04-18
- **Deciders**: Claude Code + 人間ユーザ（承認済み）

## Context

`api-draft.md` §2.1 の `selectColumn` は当初、次のような高機能シグネチャで構想されていた。

```ts
selectColumn<Row, Option>({
  key, title, width?,
  options: Option[] | ((row: Row) => Option[]),
  getOptionLabel: (opt: Option) => string,
  getOptionValue: (opt: Option) => string,
  renderEditor?: (ctx: SelectEditorContext<Option>) => ReactNode, // Chakra / MUI 差し込み
});
```

一方、`packages/core/src/columns/selectColumn.tsx` の現状実装は次の通り簡素化されている。

- `options` は `ReadonlyArray<{ value: Value; label: string }>` 固定（関数形式を受け付けない）
- `getOptionLabel` / `getOptionValue` を持たず、`label` と `String(value)` を使った逆引きで `deserialize` を賄う
- プリセット自身の `renderEditor` 差し替え口はなく、ネイティブ `<select>` のみ描画する

プロトタイプフェーズで本ライブラリが置き換え対象としている `react-datasheet-grid` の利用箇所（`rush/prizePool`, `oripa/draft/edit` 等）を確認した結果、`selectColumn` の実利用はほぼすべて「静的 enum（定数配列）+ ラベル逆引き」であり、行依存の動的 options やデザインシステム連携 editor を要求するケースは v1.0 の要件には含まれない。加えて `ColumnDef<Row, Value>` は既に public API であり、行依存 options や独自 editor は custom column として記述可能な脱出口が既に存在する。

## Decision

- v1.0 の `selectColumn` は `options: ReadonlyArray<SelectOption<Value>>` 固定とし、api-draft.md §2.1 の full-featured シグネチャ（関数形式 options / `getOptionLabel` / `getOptionValue` / プリセット自身の `renderEditor` 差し替え）は採用しない。
- 行依存 options や独自 editor が必要な利用者は、公開済みの `ColumnDef<Row, Value>` を直接書いて custom column として実装する（`ColumnDef.renderEditor` が同じ目的を果たす）。
- v1.1 以降で行依存 options や renderEditor 差し込みの具体ニーズが確定した時点で、public API を拡張する選択肢を残す。

## Consequences

### Good

- 型シグネチャが単純になり、`Value extends Row[K]` の推論がそのまま効く。
- 実装・テスト・ドキュメントのサイズが小さく、v1.0 に間に合う。
- `ColumnDef` という既存の一次エスケープハッチの存在感が増し、CLAUDE.md §5.5「Escape Hatch 完備」の方針と整合する。

### Bad

- 行依存 options を使いたい利用者はプリセットを使えず、custom column を書く必要がある。v1.0 の典型ユースケースにはないが、Issue として上がった際は v1.1 以降で検討する。
- Chakra / MUI などデザインシステム editor を差し込みたい場合も custom column に降りる必要がある。`ColumnDef.renderEditor` で同じことができるのでドキュメントで導線を示す。

### Neutral

- api-draft.md §2.1 の記述と実装が乖離したままになる。本 ADR を参照として api-draft.md を後続の編集で同期する。

## Alternatives considered

### 案 A（採用）: `options` 静的配列のみ

本 ADR の内容。最小 surface で v1.0 を締める。

### 案 B: api-draft.md 通りの full-featured シグネチャ

`options: Option[] | ((row: Row) => Option[])`、`getOptionLabel` / `getOptionValue`、プリセット自身の `renderEditor` 差し替えまで実装する。現時点では YAGNI、かつ型が複雑化する（`Row` と `Option` の両方を総称しつつ `Value extends Row[K]` を維持する必要がある）ので却下。

### 案 C: `options` のみ関数形式も受ける

`options: ReadonlyArray<SelectOption<Value>> | ((row: Row) => ReadonlyArray<SelectOption<Value>>)` とする妥協案。型が複雑化するわりに v1.0 の典型ユースケースに対する追加価値が薄く、custom column で同じことが書けるので却下。

### 案 D: プリセット自身が `renderEditor` を受ける

`ColumnDef.renderEditor` で同じことができ、プリセット側に同名プロパティを作ると二重の差し込み口ができて利用者を混乱させる。却下。

## References

- `CLAUDE.md` §5（設計原則）/ §6（列プリセットの作り方）
- `api-draft.md` §2.1（`selectColumn` の当初案）
- `requirements.md` §5.1（必須の列プリセット一覧）
- `packages/core/src/columns/selectColumn.tsx`（現状実装）
- 関連 ADR: ADR-0002（空セル `null` 正規化）
