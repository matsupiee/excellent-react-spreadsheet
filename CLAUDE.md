# CLAUDE.md — excellent-react-spreadsheet

> このファイルは **Claude Code が自走して開発する前提** で書かれています。
> OpenAI の Harness Engineering 方式に倣い、ここがエージェントの一次コンテキストです。
> 人間向けの README は別途 `README.md` に用意します（v1.0 リリース前は雛形のみ）。

---

## 1. ミッション

React 向けの Excel ライクなスプレッドシートコンポーネントライブラリ `excellent-react-spreadsheet` を v1.0 まで完成させる。

**完成の定義（v1.0 Done Criteria）:**

1. `requirements.md` §5.1 の必須機能がすべて動作する
2. 自社プロジェクト（`rush/prizePool`, `oripa/draft/edit`）の `react-datasheet-grid` を置換可能
3. 非機能要件（§6）を満たす：
   - core ≤ 30 kB gzipped
   - 10,000 行で ≥ 55 fps
   - TypeScript `strict: true` で警告ゼロ
4. `pnpm verify` が全緑
5. `apps/storybook` で全コンポーネントと列プリセットが visual catalog として動く

---

## 2. 作業ループ（MUST）

**1 タスクの定常ループは次の通り。逸脱しないこと。**

```
1. タスク着手前に `docs/workflow.md` を読み、関連する requirements.md / api-draft.md の該当節も確認する
2. 実装または変更を行う
3. `pnpm verify` を実行する（lint + typecheck + test + build + size-limit）
4. 失敗したら原因を特定し、2 に戻る（失敗メッセージを黙殺しない）
5. 影響のあるテスト・Storybook story を追加/更新する
6. 変更を small commit（単一の論理変更）にまとめる
7. 完了条件を満たしたら次のタスクへ
```

- **pnpm verify が通らない状態で完了報告をしない**。通らなければタスクは未完了。
- テスト不要の変更は原則存在しない。ドキュメント修正のみ例外。
- CI が落ちた場合、ローカルで再現して直す。`--no-verify` 等で回避しない。

---

## 3. 技術スタック（確定事項）

| レイヤ | 採用 | 備考 |
|---|---|---|
| パッケージマネージャ | **pnpm** | v9.x |
| モノレポ | **Turborepo** | `turbo` で lint/test/build をオーケストレーション |
| 言語 | **TypeScript** `strict: true` | `any` 禁止（`unknown` を使う） |
| UI | **React** 18.x / 19.x peerDep | 19 を primary target |
| 単体テスト | **Vitest** | `@testing-library/react` 併用 |
| E2E | **Playwright** | コピペ・キーボード操作・Undo を重点的に |
| Visual catalog | **Storybook 8** | ベンチマーク story も兼ねる |
| スタイル | **Tailwind preset**（`packages/tailwind`）+ CSS variables | 非 Tailwind 向けに `styles.css` も同梱 |
| バンドラ | **tsup**（packages） / **Vite**（Storybook） | ESM + CJS 両対応 |
| サイズ検証 | **size-limit** | core ≤ 30kB, formula ≤ 15kB gzipped |
| lint | **ESLint** + **@typescript-eslint** | `eslint.config.js`（flat config） |
| format | **Prettier** | 100 cols, single quote, trailing comma |
| hooks | **Husky** + **lint-staged** | pre-commit で lint/format |

- フォーミュラは**自前実装**。`hyperformula`, `mathjs`, `formula-parser` 等の既存ライブラリに依存しない。
- Undo 差分は `CellPatch[]` + coalescing。command パターンは採用しない。

---

## 4. パッケージ構成

```
excellent-react-spreadsheet/
├── CLAUDE.md                 ← これ
├── AGENTS.md                 ← 役割別ガイド
├── requirements.md           ← 要件定義（正）
├── api-draft.md              ← 公開 API 案（実装の真）
├── docs/
│   ├── architecture.md       ← コード構造の地図
│   ├── workflow.md           ← 開発ループの手順詳細
│   └── decisions/            ← ADR（意思決定記録）
├── scripts/
│   ├── verify.sh             ← `pnpm verify` の実体
│   └── bench.sh              ← ベンチマーク実行
├── packages/
│   ├── core/                 ← `excellent-react-spreadsheet`
│   ├── formula/              ← `excellent-react-spreadsheet/formula`
│   └── tailwind/             ← `excellent-react-spreadsheet/tailwind`
├── apps/
│   └── storybook/            ← visual catalog + benchmark
├── .github/workflows/
│   └── ci.yml
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

---

## 5. 設計原則（絶対に破らない）

1. **Headless First**: `useSpreadsheet()` フックだけで動き、`<Spreadsheet>` は薄い DOM を被せた層。
2. **Controlled only**: `value` / `selection` / `columnWidths` はすべて controlled。uncontrolled モードは**提供しない**（state の二重化を避けるため）。
3. **TypeScript-First**: 列定義から行型を推論。`any` は使わない。`as` キャストは最小限。
4. **Zero Config で動く**: `value` / `onChange` / `columns` / `getRowKey` の 4 つだけで基本動作する。
5. **Escape Hatch 完備**: 詰まったら命令型 API（`ref.focus()` 等）や `useSpreadsheet` 直接利用に降りられる。
6. **ツリーシェイカブル**: 列プリセットは個別 import 可能。formula は別エントリポイント。

**逸脱が必要になったら、`docs/decisions/` に ADR を書き、ユーザの確認を取ってから進める**。

---

## 6. よくある作業パターン

### 新しい列プリセットを追加する
1. `packages/core/src/columns/<name>Column.ts` を作る
2. `api-draft.md` §2.1 のシグネチャに合わせる（逸脱時は ADR）
3. Vitest で単体テスト（value の read/write, serialize/deserialize）
4. `apps/storybook/stories/columns/<Name>Column.stories.tsx` を作る
5. `packages/core/src/index.ts` から export

### フォーミュラ関数を追加する
1. `packages/formula/src/functions/<NAME>.ts` を作る
2. BNF との整合を確認（`docs/decisions/formula-grammar.md` 参照）
3. Vitest でケース追加（正常系 + `#REF!` / `#DIV/0!` 系）
4. 依存グラフの increment 再計算が壊れないこと

### Undo 周りの変更
1. `CellPatch` 型を崩さない（§3.1 参照）
2. coalescing のタイムウィンドウ（500ms / blur）は変えない
3. `maxHistory` のデフォルト（200）を変える場合は ADR

---

## 7. やってはいけないこと

- ❌ uncontrolled モードの追加（`defaultValue` 的な props）
- ❌ `any` / `// @ts-ignore` / `// @ts-expect-error` の使用（テストコードでも避ける）
- ❌ フォーミュラに外部ライブラリ依存を足す
- ❌ `pnpm verify` が赤いまま commit
- ❌ コミットメッセージなしの巨大コミット
- ❌ 要件定義書 §5.3（スコープ外）の機能を勝手に足す
- ❌ `--no-verify` / pre-commit hook バイパス
- ❌ 人間に確認せず破壊的操作（force push / branch 削除 / reset --hard）

---

## 8. 現在のフェーズ

- [x] 要件定義 / API ドラフト作成（`requirements.md`, `api-draft.md`）
- [x] Harness（本ドキュメント含む）の初期構築
- [ ] **Turborepo スケルトン実装** ← 次
- [ ] `packages/core` の `useSpreadsheet` プロトタイプ
- [ ] 列プリセット（text → int → float → checkbox → date → select → custom）
- [ ] Undo/Redo 実装
- [ ] Copy/Paste
- [ ] 仮想スクロール
- [ ] フォーミュラエンジン
- [ ] Storybook visual catalog
- [ ] E2E (Playwright)
- [ ] ベンチマーク（10,000 行シナリオ）
- [ ] v1.0 リリース

進捗は各サブパッケージの `README.md` と `docs/decisions/` で追跡する。
