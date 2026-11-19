#!/usr/bin/env bash
set -euo pipefail

KIT_DIR="${1:?kit directory required}"

if node - "$KIT_DIR" <<'NODE'
const kitDir = process.argv[2];
try {
  const installed = require(require.resolve('js-yaml/package.json', { paths: [kitDir] })).version;
  const range = require(require('path').join(kitDir, 'package.json')).dependencies['js-yaml'];
  const actual = /^(\d+)\.(\d+)\.(\d+)$/.exec(installed);
  const minimum = /^\^(\d+)\.(\d+)\.(\d+)$/.exec(range);
  // Match the stable caret range for Overdrive's js-yaml dependency.
  const compatible = actual && minimum && actual[1] === minimum[1] &&
    (+actual[2] > +minimum[2] || (actual[2] === minimum[2] && +actual[3] >= +minimum[3]));
  process.exit(compatible ? 0 : 1);
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
