#!/usr/bin/env bash
# verify.sh — Claude Code / CI が使う単一検証コマンド
# 失敗したら pipeline を止める。緑になるまで次のタスクに進まない。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
ok()  { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }

log "format:check"
pnpm format:check
ok "format"

log "lint"
pnpm lint
ok "lint"

log "typecheck"
pnpm typecheck
ok "typecheck"

log "test (vitest)"
pnpm test
ok "test"

log "build"
pnpm build
ok "build"

log "size-limit"
pnpm size
ok "size-limit"

printf '\n\033[1;32m✅ verify: all green\033[0m\n'
