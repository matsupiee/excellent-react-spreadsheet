# ADR 0001: `selection` / `activeCell` を hybrid controlled-uncontrolled にする

- **Status**: Accepted
- **Date**: 2026-04-18
- **Deciders**: Claude Code + 人間ユーザ（承認済み）

## Context

`CLAUDE.md` §5.2「Controlled only」は `value` / `selection` / `columnWidths` をすべて controlled only と規定している。一方で：

- `api-draft.md` の `UseSpreadsheetProps` では `selection?` / `activeCell?` が optional として定義されており、省略時の挙動が不明確。
- `CLAUDE.md` §5.4「Zero Config で動く」は `value` / `onChange` / `columns` / `getRowKey` の 4 つだけで基本動作することを要求しており、`selection` を必須にすると矛盾する。
- `packages/core/src/useSpreadsheet.ts` は既に `selectionProp === undefined` 時に内部 state にフォールバックする hybrid 実装になっており、設計原則と実装が乖離している。
- `selection` / `activeCell` は Undo 履歴にもフォーミュラ依存グラフにも乗らない純粋な UI state であり、`value` と同じ強い controlled 制約を掛ける技術的必然性がない。
- React 標準の `<input>`、TanStack Table、Radix UI 等も同じ hybrid パターンを採用しており、ライブラリ利用者にとっての学習コストが低い。

## Decision

- `value` と `columnWidths` は **controlled only** を維持する（state の二重化を避け、Undo / フォーミュラとの整合を保つため）。
- `selection` / `activeCell` は **hybrid** とする。props に値が渡っていれば controlled、`undefined` なら内部 state にフォールバックする。
- `on{Selection,ActiveCell}Change` は controlled / uncontrolled のいずれでも常に発火し、外側から観測可能にする。

## Consequences

### Good

- Zero Config（§5.4）の要求を満たせる。`value` / `onChange` / `columns` / `getRowKey` だけで selection も動く。
- React 標準 / TanStack Table / Radix UI と同じ慣例で、利用者の学習コストが低い。
- `selection` を外から制御したいケース（タブ切替で復元、プログラム的フォーカス等）も controlled として従来通り動く。

### Bad

- 内部 state を持つため、デバッグ時に props だけ追っても selection の真の値を追い切れない。利用者は `on{Selection,ActiveCell}Change` を仕込むか React DevTools で内部 state を確認する必要がある。
- controlled / uncontrolled の切替（途中で props に `null` を渡し始める等）の挙動は規約としてユーザーに禁じる必要がある（実装は `undefined` かどうかで判定）。

### Neutral

- `value` との非対称性が生まれる。ドキュメントで明示する必要がある。

## Alternatives considered

### 案 A（採用）: `selection` / `activeCell` のみ hybrid

本 ADR の決定内容。

### 案 B: `selection` を required に昇格

Zero Config 要件（§5.4）に反する。利用者は初期値として必ず `null` を渡して `useState` を初期化する必要があり、ボイラープレートが増える。

### 案 C: optional のまま常に `null` 扱い

`selection` を指定しない限り選択機能が一切動かなくなる。キーボード操作 / コピペ / Undo 対象範囲指定などコア機能が実質的に使えず、ライブラリとして成立しない。

### 案 D: `value` も含めて全部 hybrid

`value` を hybrid にすると Undo / フォーミュラ計算の source of truth が揺らぎ、`CellPatch` ベースの履歴設計（§3.1）と衝突する。却下。

## References

- `CLAUDE.md` §5.2（Controlled only → Controlled value, hybrid UI state に改訂）
- `CLAUDE.md` §5.4（Zero Config で動く）
- `api-draft.md` §`UseSpreadsheetProps`（`selection?` / `activeCell?`）
- `packages/core/src/useSpreadsheet.ts`（hybrid 実装）
