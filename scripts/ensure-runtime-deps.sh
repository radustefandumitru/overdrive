#!/usr/bin/env bash
set -euo pipefail

KIT_DIR="${1:?kit directory required}"

if node - "$KIT_DIR" <<'NODE'
const kitDir = process.argv[2];
try {
  require.resolve('js-yaml/package.json', { paths: [kitDir] });
  process.exit(0);
} catch (_error) {
  process.exit(1);
}
NODE
then
  exit 0
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Overdrive needs npm to install its local runtime dependency js-yaml when run from a clone or zip." >&2
  echo "Install npm, or run from npx/npm where dependencies are installed automatically." >&2
  exit 1
fi

npm --prefix "$KIT_DIR" install --omit=dev --ignore-scripts --no-package-lock --silent
