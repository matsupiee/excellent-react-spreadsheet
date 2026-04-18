# excellent-react-spreadsheet 要件定義書

> React向け Excel ライクなスプレッドシートコンポーネントライブラリ
> — `react-datasheet-grid` の「微妙に使いにくい」を解消する後継ライブラリ

---

## 1. 背景とモチベーション

既存の React 向けスプレッドシートライブラリ（特に `react-datasheet-grid`）には以下の構造的な問題がある：

| # | 既存の痛点 | 本ライブラリで解決したい形 |
|---|---|---|
| 1 | カスタム Select が Chakra UI/MUI 等と統合できず、Portal・外部クリック検出・キーボード操作を全部自前実装する必要がある | 任意の UI ライブラリのコンポーネントをそのまま埋め込める「ヘッドレス」なセルエディタ API |
| 2 | `rowClassName` 等のコールバックで最新 state が取れず `Ref` コピーの workaround が必要 | 普通の React の props/closure で最新値が参照できる設計 |
| 3 | `height` 必須で `ResizeObserver` を使った高さ自動計算を各呼び出し側で書く必要 | `height="auto"` / 親コンテナ追従をデフォルト提供 |
| 4 | `floatColumn` / `intColumn` 相当がなく、`formatBlurredInput` / `parseUserInput` を毎回手書き | 数値・float・int・date・select・checkbox 等の型付きプリセット列を標準同梱 |
| 5 | Undo/Redo が無く、JSON ディープコピーによる手動 history 管理が必要 | ビルトイン history（差分ベース） |
| 6 | セル範囲選択のキーボード拡張が capture フェーズ介入でしか実現できない | `onKeyDown` / `useSelection` で拡張可能な公式 API |
| 7 | 行 key 管理が曖昧で、強制再マウントのハックが必要 | `getRowKey` を明示指定する安定キー戦略 |

---

## 2. ターゲットユーザー

- **プライマリ**: 業務 SaaS・管理画面を React + TypeScript で作るフロントエンド開発者
- **セカンダリ**: Chakra UI / MUI / shadcn/ui など既存のデザインシステムを持つチーム
- 想定規模: 〜 10,000 行 × 〜 50 列程度までを快適に扱える

## 3. コアバリュー（肝）

1. **軽量** — コア本体 ≤ 30 kB gzipped（フォーミュラエンジンは別パッケージ化して opt-in）
2. **サクサク** — 10,000 行でも 60 fps でスクロール・編集可能
3. **統合しやすい** — 5 分で既存 React プロジェクトに組み込める。Chakra/MUI 等のコンポーネントをそのまま cell エディタに差し込める

## 3.1 ライセンス・配布

- **ライセンス**: MIT
- **パッケージ名（npm）**: `excellent-react-spreadsheet`（コア）
- **サブパッケージ構成**（モノレポ想定）:
  - `excellent-react-spreadsheet` — コア（グリッド、編集、selection、undo、列プリセット）
  - `excellent-react-spreadsheet/formula` — フォーミュラエンジン（opt-in import）
  - `excellent-react-spreadsheet/tailwind` — Tailwind preset（`tailwind.config.ts` に spread して使う）

---

## 4. 設計原則

- **Headless First**: ロジック層（フック）とスタイル層（既定スタイル）を分離。`useSpreadsheet()` だけで独自 UI を組める
- **React-Native な Reactivity**: すべてのコールバックは最新の closure を参照する。`Ref` 回避を強制しない
- **Controlled State**: 列幅・選択範囲・ソート・行データは全て controlled。初期値を渡すだけの "uncontrolled" モードは提供しない（state 源の二重化を避ける）
- **Escape Hatch 完備**: ビルトインで足りない場合、低レベル API（imperative ref, hooks）へ段階的に降りられる
- **TypeScript-First**: 列定義から行型を推論、`any` 不使用
- **Zero Config**: `height`, `getRowKey`, `columns`, `value`, `onChange` だけで動く

---

## 5. 機能要件

### 5.1 必須機能（v1.0）

#### 編集・操作
- [ ] セル編集（Enter / F2 / ダブルクリック / 直接入力）
- [ ] セル範囲選択（ドラッグ / Shift+矢印 / Cmd+Shift+矢印）
- [ ] コピー&ペースト（TSV / CSV / Excel 互換）
- [ ] 行の追加・削除・複製・並べ替え（ドラッグ）
- [ ] Undo / Redo（Cmd+Z / Cmd+Shift+Z）— **ビルトイン**
- [ ] フィルコピー（選択範囲の右下ハンドル）

#### 列プリセット（標準同梱）
- [ ] `textColumn`
- [ ] `intColumn` / `floatColumn`（フォーマッタ・パーサ込み）
- [ ] `checkboxColumn`
- [ ] `dateColumn`
- [ ] `selectColumn`（**UI ライブラリ非依存**、`renderEditor` で差し替え可能）
- [ ] `customColumn`（任意の React コンポーネントをエディタ/ビューアとして指定）

#### レイアウト
- [ ] 仮想スクロール（行方向、列方向は v1.1 以降）
- [ ] `height="auto"` / `maxHeight` / `parentFill` モード
- [ ] 列幅リサイズ
- [ ] ヘッダー固定 / 左端列固定（sticky）

#### 統合
- [ ] `getRowKey: (row, index) => string` を必須プロップに
- [ ] `onChange(rows, operations)` — 差分情報も受け取れる
- [ ] `onKeyDown`, `onSelectionChange`, `onCellBlur` などのフック
- [ ] `ref.focus()`, `ref.setSelection()`, `ref.undo()` などの命令型 API

#### フォーミュラ（v1.0 スコープ）
- [ ] セル参照（`=A1`, `=A1+B1`）
- [ ] 範囲参照（`=SUM(A1:A10)`）
- [ ] 基本関数: `SUM` / `AVERAGE` / `MIN` / `MAX` / `COUNT` / `IF` / `AND` / `OR` / `ROUND`
- [ ] 循環参照検出、エラー表示（`#REF!` / `#DIV/0!` 等）
- [ ] **別エントリポイント**（`excellent-react-spreadsheet/formula`）で import し、未使用時はコアに含めない
- [ ] 依存関係グラフによる増分再計算（全セル再評価しない）

### 5.2 v1.1+ で検討

- 列の仮想化、複数行ヘッダー、セル結合、ピン留め列（右側）
- バリデーション（列単位 / セル単位）とエラー表示
- フォーミュラの拡張関数セット（文字列系・日付系・統計系）
- カスタム関数登録 API

### 5.3 スコープ外（非目標）

- Excel 100% 互換のフォーミュラ仕様（独自サブセットに留める）
- サーバーサイドデータ fetch の抽象化
- ピボットテーブル / グラフ描画
- モバイルタッチ最適化（v1.0 ではデスクトップ優先）

---

## 6. 非機能要件

| 項目 | 目標値 |
|---|---|
| バンドルサイズ（core, gzipped） | ≤ 30 kB |
| バンドルサイズ（formula, gzipped） | ≤ 15 kB 追加 |
| ランタイム依存 | `react` / `react-dom` のみ（peer）。formula も zero-dep |
| 初回描画（1000 行 × 10 列） | ≤ 100 ms |
| スクロール FPS（10,000 行） | ≥ 55 fps |
| フォーミュラ再計算（1,000 式・1 セル変更） | ≤ 16 ms |
| 型安全性 | `strict: true` で警告ゼロ |
| ブラウザ対応 | 最新 Chrome / Safari / Firefox / Edge の直近 2 バージョン |
| React 対応 | 18.x / 19.x |
| ツリーシェイカブル | 列プリセット・フォーミュラは個別 import で分割可能 |

### 6.1 スタイリング戦略

- **Tailwind preset** を正とする（`excellent-react-spreadsheet/tailwind`）
  - `tailwind.config.ts` で `presets: [ersPreset]` と書くだけでデザイントークン・コンポーネントクラスが使える
  - カラーパレット・境界・selection ハイライトは CSS variables で露出し、ユーザー側で上書き可能
- Tailwind を使わない利用者向けに、最小限の `excellent-react-spreadsheet/styles.css` を同梱（同じ CSS variables を使う）
- コンポーネントは `className` プロップで上書き可能

### 6.2 開発・テスト環境

- **Storybook 8**: 全コンポーネント・列プリセットの visual catalog
- **Playwright**: E2E（コピペ / キーボード操作 / Undo / フォーミュラ計算）
- **Vitest**: unit テスト（フォーミュラパーサ、selection ロジック等）
- **Benchmark ハーネス**: 10,000 行シナリオを Storybook story として常設し、CI で FPS / メモリを計測

---

## 7. 公開 API

詳細は **[`api-draft.md`](./api-draft.md)** を参照（別文書に切り出し）。

要点:
- `<Spreadsheet>` / `useSpreadsheet()` の 2 層構成
- 列プリセット: `textColumn` / `intColumn` / `floatColumn` / `checkboxColumn` / `dateColumn` / `selectColumn` / 完全カスタム
- フォーミュラは `excellent-react-spreadsheet/formula` から `createFormulaEngine()` を import して props に渡す（opt-in）
- 命令型操作は `ref` 経由（`focus` / `undo` / `setSelection` 等）

---

## 8. 成功指標（v1.0 リリース時）

- [ ] 自社プロジェクト（`rush/prizePool`, `oripa/draft/edit`）の `react-datasheet-grid` を本ライブラリに全置換できる
- [ ] 置換後、Chakra Select を使ったカラムが **自前 Portal 実装ゼロ** で動作する
- [ ] 置換後、Undo/Redo の手動実装コードが削除できる
- [ ] 高さ計算用の `useGridHeight` 相当のフックが不要になる
- [ ] GitHub Star 100 / 週次 DL 1,000（参考目標）

---

## 9. 決定事項（2026-04-18）

| 項目 | 決定 |
|---|---|
| ライセンス | MIT |
| パッケージ名 | `excellent-react-spreadsheet` |
| スタイリング | Tailwind preset を正とする（非 Tailwind 向けには CSS ファイル同梱） |
| フォーミュラ対応 | **対応する**（v1.0 スコープ内 / 別エントリポイントで opt-in） |
| テスト・ベンチマーク | Storybook + Playwright + Vitest |
| 移行ガイド | 同梱しない |
| モノレポ構成 | **Turborepo**（pnpm workspaces + `turbo` でタスクオーケストレーション） |
| フォーミュラパーサ | **自前実装（小さく保つ）** — hyperformula 等の既存ライブラリには依存しない |
| Undo 差分表現 | **JSON Patch ライクな patch 配列 + coalescing**（詳細は §9.1） |
| UI state | **controlled のみ**（uncontrolled モードは提供しない） |
| API 詳細 | [`api-draft.md`](./api-draft.md) に切り出し済み |

### 9.1 Undo 差分表現を patch 形式に決めた理由

| 観点 | patch 形式（採用） | command パターン |
|---|---|---|
| メモリ | ◎ 変更セルのみ保持。既存の `JSON.parse(JSON.stringify(rows))` 痛点を直接解消 | △ コマンドの引数とクロージャ次第で膨らむ |
| 連続入力の統合 | ◎ 同一セル patch を coalesce するだけ | △ コマンドのマージ規則を個別設計 |
| ペースト・フィルコピー | ◎ 複数 patch を 1 エントリにまとめるだけ | ○ BatchCommand を作る必要 |
| シリアライズ（永続化・サーバー同期） | ◎ 値の差分そのものなので JSON 化容易 | △ コマンドの再構築が必要 |
| フォーミュラ依存グラフ連携 | ◎ セル単位の値変更として統一的に扱える | △ フォーミュラ用コマンドを別立て |
| 実装量 | ○ 小さく書ける | ✕ コマンドごとにクラス/関数が必要 |

→ スプレッドシートの編集は「セル値の変更」が支配的なので、patch 形式が素直かつ軽量。

---

## 10. 次フェーズのアクション

- [ ] Turborepo スケルトン作成（`apps/storybook`, `packages/core`, `packages/formula`, `packages/tailwind`）
- [ ] [`api-draft.md`](./api-draft.md) の未決論点（§7）を解消
- [ ] フォーミュラの独自 BNF 定義とテストケース列挙
- [ ] ベンチマーク story の仕様策定（10,000 行 × 10 列）
