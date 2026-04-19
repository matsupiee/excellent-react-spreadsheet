#!/usr/bin/env bash
# Stop hook: block completion when packages/*/src/**/*.{ts,tsx} changes
# lack a corresponding test change in the same package.
#
# Exclusions (no test required):
#   - *.d.ts                             type-only declarations
#   - *.stories.ts(x)                    Storybook stories
#   - *.css                              stylesheets
#   - */index.ts(x) with only re-exports (barrel files; no logic in diff)
#   - *.test.ts(x) / *.spec.ts(x)        the test files themselves
#
# Fires across both uncommitted changes and commits on the current branch vs main,
# so committing early does not bypass the check.
#
# Outputs {"decision":"block","reason":"..."} to send Claude back to add tests.

set -uo pipefail

# --- 1. Parse hook input, respect stop_hook_active to avoid infinite loops ---
input=$(cat 2>/dev/null || echo '{}')
if printf '%s' "$input" | python3 -c '
import json, sys
try:
    d = json.loads(sys.stdin.read() or "{}")
except Exception:
    sys.exit(1)
sys.exit(0 if d.get("stop_hook_active") else 1)
' 2>/dev/null; then
  exit 0
fi

# --- 2. Only run inside a git repo ---
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  exit 0
fi

# --- 3. Collect changed files: branch-vs-main commits + uncommitted + untracked ---
base=""
if git show-ref --verify --quiet refs/heads/main; then
  base=$(git merge-base HEAD main 2>/dev/null || true)
fi

changed_list=$(mktemp -t claude-rt-changed.XXXXXX)
src_list=$(mktemp -t claude-rt-src.XXXXXX)
test_list=$(mktemp -t claude-rt-test.XXXXXX)
missing_list=$(mktemp -t claude-rt-missing.XXXXXX)
trap 'rm -f "$changed_list" "$src_list" "$test_list" "$missing_list"' EXIT

{
  if [ -n "$base" ] && [ "$base" != "$(git rev-parse HEAD 2>/dev/null)" ]; then
    git diff --name-only "$base" HEAD 2>/dev/null || true
  fi
  git diff --name-only HEAD 2>/dev/null || true
  git ls-files --others --exclude-standard 2>/dev/null || true
} | sort -u > "$changed_list"

[ ! -s "$changed_list" ] && exit 0

# --- 4. is_reexport_only: true if the diff of an index.ts has no code logic ---
# Non-trivial code detected by presence of function/arrow/class/return/throw/control-flow.
# Pure re-exports (`export { X } from './x'`), type re-exports, string consts, and imports
# are considered exempt.
is_reexport_only() {
  local file=$1
  local diff_out
  diff_out=$(
    {
      if [ -n "$base" ]; then git diff "$base" HEAD -- "$file" 2>/dev/null || true; fi
      git diff HEAD -- "$file" 2>/dev/null || true
    }
  )
  local content
  if [ -n "$diff_out" ]; then
    content=$(printf '%s\n' "$diff_out" | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' | sed -E 's/^[+-]//')
  elif [ -f "$file" ]; then
    content=$(cat "$file")
  else
    return 1
  fi
  # Strip comments and blank lines, then scan for logic keywords
  local suspicious
  suspicious=$(printf '%s\n' "$content" \
    | grep -vE '^\s*(//|/\*|\*/?|$)' \
    | grep -E '(\bfunction\b|=>|\bclass\b|\breturn\b|\bthrow\b|\bif\s*\(|\bfor\s*\(|\bwhile\s*\(|\bawait\b|\basync\b)' \
    || true)
  [ -z "$suspicious" ]
}

# --- 5. Classify each changed file ---
while IFS= read -r f; do
  [ -z "$f" ] && continue

  # Must be under packages/*/src/
  case "$f" in
    packages/*/src/*) ;;
    *) continue ;;
  esac

  # Exempt: type declarations, stories, CSS
  case "$f" in
    *.d.ts|*.stories.ts|*.stories.tsx|*.css) continue ;;
  esac

  # Collect test files separately
  case "$f" in
    *.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx)
      echo "$f" >> "$test_list"
      continue
      ;;
  esac

  # Only .ts / .tsx files require tests
  case "$f" in
    *.ts|*.tsx) ;;
    *) continue ;;
  esac

  # Exempt: index.ts re-export-only
  case "$f" in
    */index.ts|*/index.tsx)
      if is_reexport_only "$f"; then
        continue
      fi
      ;;
  esac

  echo "$f" >> "$src_list"
done < "$changed_list"

[ ! -s "$src_list" ] && exit 0

# --- 6. For each src file, require a test file in the SAME package ---
while IFS= read -r src; do
  [ -z "$src" ] && continue
  pkg=$(printf '%s' "$src" | awk -F/ '{print $1"/"$2}')
  if ! grep -q "^${pkg}/" "$test_list" 2>/dev/null; then
    printf '  - %s\n' "$src" >> "$missing_list"
  fi
done < "$src_list"

[ ! -s "$missing_list" ] && exit 0

# --- 7. Emit block JSON ---
missing=$(cat "$missing_list")
reason="Code changes in packages/*/src are missing accompanying test changes in the same package:

${missing}

Per CLAUDE.md §2 の作業ループ: すべてのコード変更にはテスト追加/更新が必要です。
対応方法:
  1. 対応する *.test.ts(x) を追加または更新する
  2. pnpm verify を実行して緑を確認する
  3. commit に test ファイルを含める

本当にテスト不要な変更（純粋な型宣言・barrel re-export・CSS のみ等）であれば、
.claude/hooks/require-tests.sh の除外ルールに追加するか ADR で例外を明文化してください。"

python3 -c '
import json, sys
print(json.dumps({"decision": "block", "reason": sys.stdin.read()}))
' <<< "$reason"

exit 0
