#!/usr/bin/env bash
# Runs every check a contributor runs before pushing. Fails on the first problem
# and never hides an exit code behind a pipe.
set -euo pipefail
cd "$(dirname "$0")/.."
npx next typegen >/dev/null
npx tsc --noEmit -p .
npx eslint .
npx vitest run --reporter=dot
echo "checks passed"
