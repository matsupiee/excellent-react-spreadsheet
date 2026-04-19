# ADR 0004: `defineColumns` で列プリセットの Value 型分散を束ねる

- **Status**: Accepted
- **Date**: 2026-04-19
- **Deciders**: Claude Code + 人間ユーザ（承認済み）

## Context

`api-draft.md` §2.1 は公開 API として `columns: ColumnDef<Row>[]`（= `ColumnDef<Row, unknown>[]`）を約束している。一方で：

- `packages/core/src/types.ts` の `ColumnDef<Row, Value = unknown>` は `setValue: (row, value: Value) => Row`、`renderCell: (ctx: CellContext<Row, Value>) => ReactNode`、`renderEditor: (ctx: EditorContext<Row, Value>) => ReactNode`、`serialize: (value: Value) => string` を持つ。これらは **`Value` に対して反変** である（`renderEditor` の `ctx` には `onChange: (v: Value) => void` が入っており、`Value` が関数引数位置に露出する）。
- `tsconfig.base.json` は `strict: true` + `exactOptionalPropertyTypes: true` を要求しており、`strictFunctionTypes` の下では `ColumnDef<Row, string>` は `ColumnDef<Row, unknown>` に代入できない。
- 結果、ユーザが `textColumn<Row>(...)`（`ColumnDef<Row, string>` を返す）と `intColumn<Row>(...)`（`ColumnDef<Row, number>` を返す）を `[...]` で並べた瞬間、配列全体が `ColumnDef<Row>[]` に推論されず、`UseSpreadsheetProps.columns` への引き渡しで型エラーになる。
- `apps/storybook/stories/Playground.stories.tsx` のような現実のユースケースで列プリセットを混在できないと、ライブラリのヘッドレス設計（§5.1）と Zero Config 原則（§5.4）が成立しない。
- `CLAUDE.md` §7 は `any` / `@ts-ignore` を禁じており、ユーザにキャストを強要する解決策は採れない。

## Decision

- `packages/core/src/columns/defineColumns.ts` に **カリー化ヘルパ** `defineColumns<Row>()(col1, col2, ...)` を導入する。
- 外側の呼び出しで `Row` を明示的にピン止めし、内側の可変長引数でタプル `T extends ReadonlyArray<unknown>` を受け、**mapped tuple** `{ [K in keyof T]: ColumnDef<Row, T[K]> }` で各列の `Value` を個別に推論させる。
- 関数ボディで **1 回だけ** `as unknown as ColumnDef<Row>[]` を行い、分散の消去をこの境界だけに閉じ込める。呼び出し側・プリセット側はいずれもキャストを書かない。

```ts
export const defineColumns =
  <Row>() =>
  <T extends ReadonlyArray<unknown>>(
    ...columns: { [K in keyof T]: ColumnDef<Row, T[K]> }
  ): ColumnDef<Row>[] =>
    columns as unknown as ColumnDef<Row>[];
```

- 使用側はこうなる：

```ts
const columns = defineColumns<Row>()(
  textColumn<Row, 'name'>({ key: 'name', accessor: 'name' }),
  intColumn<Row, 'age'>({ key: 'age', accessor: 'age' }),
);
```

## Consequences

### Good

- ユーザは `as unknown as` を一切書かずに異種プリセットを合成できる。`api-draft.md` §2.1 の約束どおり `ColumnDef<Row>[]` が得られる。
- 列ごとの `Value` 推論は外側 `defineColumns<Row>()` の時点では失わない。`textColumn<Row, K>` の `K` / `accessor` の型整合は従来どおり各プリセット呼び出しで検出される（配列の境界まで遅延しない）。
- `as unknown as` がライブラリ内の 1 行に限定されるため、監査範囲が狭く、`CLAUDE.md` §7「`any` 禁止」の精神にも反しない（`unknown` 経由、かつ局所）。
- 実行時の安全性は保たれる：`useSpreadsheet` は `getValue` / `deserialize` で同じ列から取り出した値しか `setValue` / `renderEditor` に渡さないため、消去された `Value` が round-trip で食い違うことはない。

### Bad

- 構文に `()` が 1 段余分に増える（`defineColumns<Row>()(...)`）。単一呼び出しに畳めないのは、`Row` と `T` を同じ関数で推論させると TS が `Row` を `unknown` に widening してしまい、列ごとの narrowing が効かなくなるため。ドキュメントで意図を明示する。
- `ColumnDef<Row>[]` は `Value` を消してあるので、以降 `columns.forEach(c => c.setValue(row, ???))` のような外側コードは `unknown` としか扱えない。ただしこれは hook 内部の事情で、公開 API としては意図どおり。

### Neutral

- 列定義の合成はこのヘルパ経由に一本化する。生の配列リテラル `[textColumn(...), intColumn(...)]` は今後も型エラーになる。README / Storybook ではヘルパ利用を標準形として案内する。

## Alternatives considered

### 案 A（採用）: カリー化ヘルパ + 関数内 1 回の `as unknown as`

本 ADR の決定内容。

### 案 B: `ColumnDef` のメソッドを method-shorthand 構文にする

`setValue(row: Row, value: Value): Row` のように method shorthand で書くと、その位置だけ `strictFunctionTypes` の対象外となり bivariant になる。しかし `renderCell` / `renderEditor` の `Value` は引数オブジェクト型 `CellContext<Row, Value>` / `EditorContext<Row, Value>` を経由しており、`EditorContext` 内の `onChange: (v: Value) => void` が依然として反変位置に残る。実装中に実測した結果、method shorthand 化しても `ColumnDef<Row, string>` → `ColumnDef<Row, unknown>` の代入は通らなかった。根本解決にならず却下。

### 案 C: `columns: ColumnDef<Row, any>[]`

`any` 解禁で即座に通るが、`CLAUDE.md` §7 で明示的に禁止されており、`@typescript-eslint/no-explicit-any` が error レベルで落ちる。却下。

### 案 D: `ColumnDef` を invariant-Value にし、各プリセットが内部でランタイム型ガードする

`setValue` / `renderEditor` のシグネチャを常に `unknown` 受けにして、各プリセット実装側で `typeof value === 'string'` 等で narrowing する案。型的には最もクリーンだが：

- すべての列プリセットに runtime guard のボイラープレートが必要になる。
- 30 kB gzipped の core 予算（§6）にランタイムチェックが積み上がる。
- 型の嘘（型だけ narrow、実態 unknown）を各プリセットで個別に再現することになり、監査箇所が `defineColumns` の 1 行よりむしろ増える。

採用コストが大きく却下。

### 案 E: 呼び出し側で都度 `as unknown as ColumnDef<Row>`

ユーザに毎回キャストを書かせる案。動くが、ライブラリ設計としてユーザをキャストに慣れさせるのは悪習。`CLAUDE.md` §7 の精神にも反し、却下。

## Future direction

- TS に existential types（`exists V. ColumnDef<Row, V>`）が入れば、ヘルパを使わず素の配列リテラルで型付けできる可能性がある。言語側の進展を待つ。
- 将来ランタイム検証層（Zod 等）を正式に入れる場合は、案 D の再評価もあり得る。その際は改めて ADR を起こす。

## References

- `CLAUDE.md` §5（設計原則 / TypeScript-First）、§7（`any` 禁止）
- `api-draft.md` §2.1（`columns: ColumnDef<Row>[]`）
- `packages/core/src/types.ts`（`ColumnDef<Row, Value>` 定義）
- `packages/core/src/columns/defineColumns.ts`（実装）
- `apps/storybook/stories/Playground.stories.tsx`（使用例）
- `docs/decisions/0001-selection-hybrid-controlled.md`（hybrid controlled パターン — 本 ADR とは独立だが、同様に「設計原則と型システムの実際の挙動が食い違うときにどこで折り合いを付けるか」の先例として参照）
