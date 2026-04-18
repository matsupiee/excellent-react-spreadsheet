# AGENTS.md — 役割別ガイド

> `CLAUDE.md` を先に読んでください。ここはその補足で、タスクの種類ごとに「どう動くか」を定義します。

---

## 共通プロトコル

1. タスク受領時に **タスクの種類を判定** する（下記セクションのどれか）。
2. 該当セクションのチェックリストを順に実行。
3. 完了前に必ず `pnpm verify` を通す。
4. 変更点を 1〜2 文で要約して報告。

---

## Role: Implementer（機能実装）

新機能・列プリセット・API の追加や変更を担当。

**入力:** requirements.md / api-draft.md のタスク項目
**出力:** 実装 + テスト + Storybook story + 型定義

チェックリスト:

- [ ] `api-draft.md` の該当節を読み、型シグネチャを確定
- [ ] 型を先に書く（TDD に近い順：types → test → impl）
- [ ] 実装は最小限で始める。将来の拡張は YAGNI
- [ ] 単体テストを書く（Vitest）
- [ ] Storybook story を追加（デフォルトケース + 代表的なエッジケース）
- [ ] `packages/*/src/index.ts` から公開
- [ ] `pnpm verify` 全緑
- [ ] API を変更した場合、`api-draft.md` を更新

---

## Role: Formula Engineer（フォーミュラ）

`packages/formula` の拡張・バグ修正。

**独立制約:**

- 外部ライブラリ依存を**一切追加しない**（zero-dep を維持）
- コア（`packages/core`）には依存しない（参照は型情報のみ）
- `docs/decisions/formula-grammar.md` の BNF を正とする

チェックリスト:

- [ ] 文法変更なら BNF を先に更新し、ADR を書く
- [ ] パーサ / 評価器 / 依存グラフの 3 層を分けて変更
- [ ] 循環参照検出が壊れないこと（既存テストで担保）
- [ ] 1000 式 1 セル変更で ≤ 16 ms のベンチを再実行
- [ ] 対応するエラー値（`#REF!`, `#DIV/0!`, `#NAME?`, `#VALUE!`）を意図通り返す

---

## Role: Tester（テスト追加・修正）

**基本方針:**

- 実装の「ふるまい」をテストする。内部実装詳細に密結合させない。
- `data-testid` は UI が不安定な時だけ使う（まず role / label で引く）
- 乱数は seed を固定する（`@faker-js/faker` なら `faker.seed(42)`）

種類別:

- **Unit（Vitest）**: `<file>.test.ts` を同階層に置く
- **Integration**: `packages/core/test/integration/` に集約
- **E2E（Playwright）**: `e2e/` 直下、ケース 1 ファイル 1 シナリオ

---

## Role: Refactorer（リファクタ・エントロピー管理）

**目的:** コードベースのエントロピーを下げる。AI 生成コードは冗長化しやすいため、定期的に回収する。

トリガ:

- 同種の重複が 3 箇所以上ある
- ファイルが 400 行を超えた
- テストが遅くなった（100ms → 閾値超過）

**やってよいこと:**

- 重複の抽出（ただし「3 回見たら抽象化」。2 回では抽象化しない）
- 型の整理・再利用
- 死んでいるコードの削除（grep で参照 0 を確認してから）

**やってはいけないこと:**

- public API の破壊的変更（メジャー番号上げる話に戻る）
- 抽象化のための抽象化（将来のために作る DI や interface）

---

## Role: Reviewer（セルフレビュー）

commit 前に以下を自問する：

- [ ] この変更は 1 つの論理的目的に絞られているか？
- [ ] `any` / `@ts-ignore` が混入していないか？
- [ ] テストは振る舞いを検証しているか、実装詳細を固定しているか？
- [ ] 公開 API を変更した？なら `api-draft.md` 更新した？
- [ ] コメントは「WHY」を説明しているか（WHAT を繰り返してないか）？
- [ ] 設計原則（CLAUDE.md §5）に反していないか？

---

## Role: Benchmarker（性能計測）

**単位:** `apps/storybook/stories/bench/*.stories.tsx` のベンチ story を使う。

計測項目:

- 初回描画時間（React Profiler）
- スクロール FPS（`performance.now()` + rAF）
- 1 セル変更 → 再レンダ時間
- フォーミュラ 1000 式・1 セル変更の再計算時間

**閾値:** `docs/benchmarks.md` に回帰検出ラインを記載（CI では warning のみ、人間判断）。
