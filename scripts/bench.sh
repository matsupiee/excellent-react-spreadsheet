#!/usr/bin/env bash
# bench.sh — ベンチマーク計測のエントリポイント（雛形）
# Storybook を立ち上げて Playwright bench スクリプトを実行する想定。
# v1.0 までに計測対象の story / しきい値を決定する。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "bench: not implemented yet — see docs/benchmarks.md"
exit 0
