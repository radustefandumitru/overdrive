#!/usr/bin/env bash
set -euo pipefail

KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "node is required. Install Node.js 18+ and rerun this script." >&2
  exit 1
fi

"$KIT_DIR/scripts/ensure-runtime-deps.sh" "$KIT_DIR"

OVERDRIVE_KIT_DIR="$KIT_DIR" node "$KIT_DIR/bin/overdrive.js" uninstall "$@"
