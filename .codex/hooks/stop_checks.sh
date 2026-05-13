#!/usr/bin/env bash
set -euo pipefail

commands=(
  "bun run build"
  "bun run check"
)

mode="${STOP_CHECKS_MODE:-codex}"

for command in "${commands[@]}"; do
  if ! bash -lc "$command" 1>&2; then
    if [[ "$mode" == "cursor" ]]; then
      exit 1
    fi

    printf '%s\n' '{"decision":"block","reason":"Stop hook checks failed. Resolve failures and continue."}'
    exit 0
  fi
done

if [[ "$mode" == "cursor" ]]; then
  exit 0
fi

printf '%s\n' '{"continue":true}'
