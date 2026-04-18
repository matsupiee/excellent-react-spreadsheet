# Development Workflow

> `CLAUDE.md` §2 の作業ループの詳細版。

---

## 1. セットアップ（初回のみ）

```bash
pnpm install
pnpm exec playwright install --with-deps chromium  # apps/storybook の E2E 用
```

## 2. 日常のコマンド

| 目的 | コマンド |
|---|---|
| 全検証（コミット前に実行） | `pnpm verify` |
| 単体テスト（watch） | `pnpm test:watch` |
| 単一パッケージのテスト | `pnpm --filter excellent-react-spreadsheet test` |
| 型チェックのみ | `pnpm typecheck` |
| lint | `pnpm lint` |
| lint 自動修正 | `pnpm lint:fix` |
| format | `pnpm format` |
| Storybook 起動 | `pnpm storybook` |
| E2E（ローカル） | `pnpm --filter @excellent-react-spreadsheet/storybook test:e2e` |
| バンドルサイズ確認 | `pnpm size` |

## 3. タスクの粒度

- **1 PR = 1 論理変更**。大きい機能は issue で分割して進める。
- 1 PR のラインチェンジはおおむね 400 行以内を目安。越えそうなら分割できないか検討。
- マイルストーン（列プリセット一括追加など）は feature ブランチで複数 PR を束ねてもよい。

## 4. 型先行 TDD フロー

1. `api-draft.md` を見て型シグネチャを決める
2. `types.ts` に型を追加
3. Vitest でテスト（振る舞い）を書く → 赤
4. 実装する → 緑
5. リファクタ → 緑維持
6. Storybook story を追加（目視確認）
7. `pnpm verify`

## 5. 詰まったときの降り口

- **型が通らない**: `api-draft.md` の該当節と矛盾がないか再確認。矛盾なら ADR を書く。
- **テストが曖昧**: 「ユーザが画面で何をするか」の粒度に戻る。内部実装詳細のアサートを避ける。
- **設計判断が必要**: `docs/decisions/` に ADR（`NNNN-title.md`）を作成。ユーザに確認を取る。
- **バンドルが太った**: `size-limit` の出力を見て、意図せず依存が増えていないか調べる（`react` 以外を import していないか）。

## 6. コミットメッセージ規約

Conventional Commits を採用：

```
<type>(<scope>): <subject>

<optional body>
```

type:
- `feat`: 新機能
- `fix`: バグ修正
- `refactor`: 振る舞い不変の構造変更
- `docs`: ドキュメントのみ
- `test`: テスト追加・修正のみ
- `chore`: ビルド / 設定 / 依存

scope 例: `core`, `formula`, `tailwind`, `storybook`, `harness`

例:
- `feat(core): add intColumn preset`
- `fix(formula): handle circular reference in SUM`
- `docs(harness): document verify.sh behavior`

## 7. Claude Code 自走時の追加ルール

- 迷ったら**小さく・可逆的に**動く。破壊的操作（force push, reset --hard, branch 削除）は必ずユーザ確認。
- `pnpm verify` 赤のまま完了報告しない。
- 一貫性のない型変更を見つけたら、そのタスク内で直すか、別タスクとして記録する（放置しない）。
- 3 回連続で同じ種類の lint / type エラーを踏んだら、パターンを `docs/decisions/` に ADR として記録してから続ける。
