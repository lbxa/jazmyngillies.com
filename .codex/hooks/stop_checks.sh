#!/usr/bin/env bash
set -euo pipefail

commands=(
  "uv run --package email_agent python -m compileall apps/email_agent/app"
  "cargo check --workspace"
  "cargo test --workspace"
  "bun turbo run build check-types test"
  "uv run --package email_agent pytest apps/email_agent/tests"
)

for command in "${commands[@]}"; do
  if ! bash -lc "$command" 1>&2; then
    printf '%s\n' '{"decision":"block","reason":"Stop hook checks failed. Resolve failures and continue."}'
    exit 0
  fi
done

printf '%s\n' '{"continue":true}'
