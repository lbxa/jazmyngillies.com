#!/usr/bin/env bash
set -euo pipefail

commands=(
  "bun run build"
  "bun run check"
)

for command in "${commands[@]}"; do
  if ! bash -lc "$command" 1>&2; then
    printf '%s\n' '{"decision":"block","reason":"Stop hook checks failed. Resolve failures and continue."}'
    exit 0
  fi
done

printf '%s\n' '{"continue":true}'
