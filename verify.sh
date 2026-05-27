#!/usr/bin/env bash
set -euo pipefail

KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "node is required. Install Node.js 18+ and rerun this script." >&2
  exit 1
fi

AGENTIC_SUPERCHARGE_KIT_DIR="$KIT_DIR" node "$KIT_DIR/bin/agentic-supercharge.js" verify "$@"
node "$KIT_DIR/scripts/check-consistency.js"
node "$KIT_DIR/scripts/evaluate-router.js"
node "$KIT_DIR/scripts/test-as-workflow.js"
