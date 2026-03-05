#!/bin/bash

# Claude Code PreToolUse hook — runs before git commit
# Blocks commit if lint, type-check, or tests fail

TOOL_INPUT=$(cat)
COMMAND=$(echo "$TOOL_INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

# Only intercept git commit commands
if ! echo "$COMMAND" | grep -qE 'git\s+commit'; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" || exit 1

FAILURES=()

# 1. Lint
echo "=== Running lint ===" >&2
if ! pnpm lint 2>&1 | tail -20 >&2; then
  FAILURES+=("Lint failed")
fi

# 2. Type check
echo "=== Running type-check ===" >&2
if ! pnpm type-check 2>&1 | tail -20 >&2; then
  FAILURES+=("Type-check failed")
fi

# 3. Tests
echo "=== Running API tests ===" >&2
if ! pnpm --filter @jake/api test 2>&1 | tail -20 >&2; then
  FAILURES+=("API tests failed")
fi

echo "=== Running Web tests ===" >&2
if ! pnpm --filter @jake/web test 2>&1 | tail -20 >&2; then
  FAILURES+=("Web tests failed")
fi

# Result
if [ ${#FAILURES[@]} -gt 0 ]; then
  echo "" >&2
  echo "BLOCKED: Pre-commit checks failed:" >&2
  printf '  - %s\n' "${FAILURES[@]}" >&2
  echo "Fix the issues before committing." >&2
  exit 2
fi

echo "All pre-commit checks passed!" >&2
exit 0
