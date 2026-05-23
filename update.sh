#!/usr/bin/env bash
set -euo pipefail

KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Updating AI skills from approved upstream sources..."
"$KIT_DIR/install.sh" --scope global --tools auto --conflict replace-managed-only --yes
echo
echo "Verifying installation..."
"$KIT_DIR/verify.sh"
echo
echo "Update complete. Restart your coding agents so they re-index skills."
