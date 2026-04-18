# Benchmarks

> 非機能要件（`requirements.md` §6）の計測方針と回帰検出ライン。
> v1.0 までに各値の実測を入れ、CI で閾値超過を warning として出す。

---

## 対象シナリオ

1. **初回描画（1000 行 × 10 列）** — 目標 ≤ 100 ms
2. **スクロール FPS（10,000 行 × 10 列）** — 目標 ≥ 55 fps（P95）
3. **1 セル編集 → 再レンダ** — 目標 ≤ 8 ms（1000 行）
4. **Undo → 再レンダ** — 目標 ≤ 8 ms
5. **フォーミュラ 1000 式 1 セル変更再計算** — 目標 ≤ 16 ms

## 計測方法

- `apps/storybook/stories/bench/*.stories.tsx` にベンチ専用 story を置く
- Playwright スクリプトで Chromium を起動し、`performance.mark` / `performance.measure` で計測
- 各シナリオ 5 回実行して median を記録
- 結果は `bench-results/` に JSON で保存（git 追跡外）

## CI

- main への push で計測
- 前回との diff をコメント出力
- 閾値超過は warning（ブロックしない）— 人間判断

## 記録フォーマット

```json
{
  "timestamp": "2026-04-18T12:00:00Z",
  "scenario": "scroll-fps-10k",
  "median": 58.2,
  "p95": 55.1,
  "unit": "fps",
  "threshold": 55,
  "pass": true
}
```
