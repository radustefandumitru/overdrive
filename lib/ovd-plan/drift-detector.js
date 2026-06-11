'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const codebaseMapper = require('./codebase-mapper');
const { MAPPER_KEYS, tagsPath, readTagsFile } = codebaseMapper;

// Top-level entries excluded from the file-tree signature. We want the signature
// to track meaningful structural drift (new/removed source-tree dirs), not the
// noise of regenerated artifacts. Anything in this set is filtered before hashing.
const IGNORED_TOP_LEVEL = new Set([
  '.git',
  '.gitignore',
  '.gitattributes',
  '.overdrive',
  '.DS_Store',
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  '.next',
  '.nuxt',
  '.cache',
  '.turbo',
  '.parcel-cache',
  '__pycache__',
  '.venv',
  'venv',
  'target',
  '.idea',
  '.vscode'
]);

function normalizePosix(p) {
  if (typeof p !== 'string') return '';
  return p.replace(/\\/g, '/').trim().replace(/^\.\//, '');
}

function immediateParent(posixPath) {
  const dir = path.posix.dirname(posixPath);
  return dir === '.' ? '' : dir;
}

function computeFileTreeSignature(rootDir) {
  let entries;
  try {
    entries = fs.readdirSync(rootDir);
  } catch (_e) {
    return null;
  }
  const filtered = entries
    .filter((name) => !IGNORED_TOP_LEVEL.has(name))
    .sort();
  const hash = crypto.createHash('sha1').update(filtered.join('\n')).digest('hex');
  return {
    algorithm: 'sha1',
    hash,
    entries: filtered
  };
}

// Idempotent narrow write: ONLY touches the `fileTreeSignature` field. Refuses to
// create a _tags.json from scratch (that's Task 2.3's responsibility). Returns
// true if the file changed on disk, false otherwise.
function writeSignatureToTags(rootDir, signature) {
  const file = tagsPath(rootDir);
  if (!fs.existsSync(file)) return false;
  let current;
  try {
    current = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_e) {
    return false;
  }
  if (!current || typeof current !== 'object' || Array.isArray(current)) return false;
  const prior = current.fileTreeSignature;
  if (prior && prior.hash === signature.hash) return false;
  current.fileTreeSignature = signature;
  fs.writeFileSync(file, JSON.stringify(current, null, 2) + '\n');
  return true;
}

function normalizeChangedPaths(raw) {
  if (raw === undefined || raw === null) return { ok: true, normalized: [] };
  if (!Array.isArray(raw)) {
    return { ok: false, reason: 'changedPaths must be an array of strings' };
  }
  const out = [];
  for (const item of raw) {
    if (typeof item !== 'string') {
      return { ok: false, reason: 'changedPaths entries must be strings' };
    }
    const cleaned = normalizePosix(item);
    if (cleaned.length > 0) out.push(cleaned);
  }
  return { ok: true, normalized: out };
}

function flagAllResult({ reason, summary, signals }) {
  return {
    ok: true,
    status: 'drift-detect',
    needsRefresh: MAPPER_KEYS.slice(),
    reason,
    signals,
    perMapperReasons: MAPPER_KEYS.reduce((acc, k) => {
      acc[k] = [reason];
      return acc;
    }, {}),
    summary
  };
}

function detectDrift(rootDir, opts = {}) {
  if (!rootDir) {
    return {
      ok: false,
      status: 'drift-detect',
      reason: 'no rootDir resolved',
      text: 'Could not resolve a project directory.'
    };
  }
  const resolvedRoot = path.resolve(rootDir);

  const norm = normalizeChangedPaths(opts.changedPaths);
  if (!norm.ok) {
    return {
      ok: false,
      status: 'drift-detect',
      reason: norm.reason,
      text: `Could not run drift detection: ${norm.reason}`
    };
  }
  const changedPaths = norm.normalized;

  const tags = readTagsFile(resolvedRoot);
  const currentSignature = computeFileTreeSignature(resolvedRoot);

  // First-run behavior (Q4 lock): no _tags.json on disk → flag everything.
  if (!tags) {
    const result = flagAllResult({
      reason: 'first run (no _tags.json on disk; nothing to diff against)',
      summary: 'drift: first run; flagging all 5 mappers',
      signals: { firstRun: true, fileTreeChanged: false, signatureWritten: false, changedPathsCount: changedPaths.length }
    });
    result.rootDir = resolvedRoot;
    result.text = formatResult(result);
    return result;
  }

  // Secondary signal (r3 §4.4): file-tree signature drift.
  const storedSignature = tags.fileTreeSignature || null;
  let fileTreeChanged = false;
  let fileTreeReason = null;
  if (currentSignature) {
    if (!storedSignature) {
      fileTreeChanged = true;
      fileTreeReason = 'no prior file-tree signature recorded';
    } else if (storedSignature.hash !== currentSignature.hash) {
      const prevEntries = Array.isArray(storedSignature.entries) ? storedSignature.entries : [];
      const added = currentSignature.entries.filter((e) => !prevEntries.includes(e));
      const removed = prevEntries.filter((e) => !currentSignature.entries.includes(e));
      const parts = [];
      if (added.length > 0) parts.push(`added [${added.join(', ')}]`);
      if (removed.length > 0) parts.push(`removed [${removed.join(', ')}]`);
      fileTreeReason = `top-level changed: ${parts.length > 0 ? parts.join('; ') : 'hash mismatch with no entry diff'}`;
      fileTreeChanged = true;
    }
  }

  // Narrow side-effect: persist current signature if it changed (idempotent if same).
  let signatureWritten = false;
  if (currentSignature) {
    signatureWritten = writeSignatureToTags(resolvedRoot, currentSignature);
  }

  if (fileTreeChanged) {
    const result = flagAllResult({
      reason: fileTreeReason,
      summary: `drift: file-tree changed (${fileTreeReason}); flagging all 5 mappers`,
      signals: { firstRun: false, fileTreeChanged: true, signatureWritten, changedPathsCount: changedPaths.length }
    });
    result.rootDir = resolvedRoot;
    result.text = formatResult(result);
    return result;
  }

  // Primary signal (r3 §4.4): per-mapper touched-path overlap.
  // Match semantics (Q2 lock): exact path OR shared IMMEDIATE-parent directory.
  // Sharing a higher ancestor (e.g., both under `lib/`) does NOT flag — too loose.
  const touchedMappers = new Set();
  const perMapperReasons = {};
  for (const changedPath of changedPaths) {
    const changedParent = immediateParent(changedPath);
    for (const key of MAPPER_KEYS) {
      const mapperEntry = tags.mappers && tags.mappers[key];
      const sources = mapperEntry && Array.isArray(mapperEntry.sources) ? mapperEntry.sources : [];
      let matched = null;
      for (const source of sources) {
        const sourcePosix = normalizePosix(source);
        if (sourcePosix === changedPath) {
          matched = { kind: 'exact', source };
          break;
        }
        const sourceParent = immediateParent(sourcePosix);
        if (sourceParent !== '' && sourceParent === changedParent) {
          matched = { kind: 'same-dir', source };
          break;
        }
      }
      if (matched) {
        touchedMappers.add(key);
        if (!perMapperReasons[key]) perMapperReasons[key] = [];
        perMapperReasons[key].push(
          matched.kind === 'exact'
            ? `exact: ${changedPath}`
            : `same-dir: ${changedPath} (recorded ${matched.source})`
        );
      }
    }
  }

  const needsRefresh = Array.from(touchedMappers).sort((a, b) => MAPPER_KEYS.indexOf(a) - MAPPER_KEYS.indexOf(b));
  let reason;
  if (needsRefresh.length === 0) {
    reason = changedPaths.length > 0
      ? `no overlap (${changedPaths.length} changed path(s) examined; none matched a recorded source or its immediate parent)`
      : 'no changed paths supplied; nothing to diff';
  } else {
    reason = `${changedPaths.length} changed path(s) flagged ${needsRefresh.length} mapper(s): ${needsRefresh.join(', ')}`;
  }

  const result = {
    ok: true,
    status: 'drift-detect',
    rootDir: resolvedRoot,
    needsRefresh,
    reason,
    signals: {
      firstRun: false,
      fileTreeChanged: false,
      signatureWritten,
      changedPathsCount: changedPaths.length
    },
    perMapperReasons,
    summary: needsRefresh.length === 0
      ? 'drift: no mappers flagged'
      : `drift: ${needsRefresh.length} mapper(s) flagged (${needsRefresh.join(', ')})`
  };
  result.text = formatResult(result);
  return result;
}

function formatResult(result) {
  const lines = [];
  lines.push('Overdrive (ovd-plan) — /ovd-workflow drift');
  lines.push('');
  if (!result.ok) {
    lines.push(`Drift detection failed: ${result.reason || 'unknown'}`);
    return lines.join('\n');
  }
  lines.push(result.summary);
  lines.push('');
  lines.push(`Reason: ${result.reason}`);
  if (result.signals) {
    const s = result.signals;
    lines.push('');
    lines.push(`Signals:`);
    lines.push(`  - first run: ${s.firstRun ? 'yes' : 'no'}`);
    lines.push(`  - file-tree changed: ${s.fileTreeChanged ? 'yes' : 'no'}`);
    lines.push(`  - changed paths supplied: ${s.changedPathsCount}`);
    lines.push(`  - file-tree signature written: ${s.signatureWritten ? 'yes' : 'no'}`);
  }
  if (Array.isArray(result.needsRefresh) && result.needsRefresh.length > 0) {
    lines.push('');
    lines.push('Mappers flagged for refresh:');
    for (const key of result.needsRefresh) {
      const reasons = (result.perMapperReasons && result.perMapperReasons[key]) || [];
      lines.push(`  - ${key}: ${reasons.length > 0 ? reasons.join('; ') : 'flagged'}`);
    }
    lines.push('');
    lines.push('Next: run `overdrive workflow map` for a full re-run, or use Task 2.8 `MAP REFRESH` to re-run only the flagged mappers.');
  } else {
    lines.push('');
    lines.push('No mappers flagged. Codebase analysis is current.');
  }
  return lines.join('\n');
}

module.exports = {
  IGNORED_TOP_LEVEL,
  normalizePosix,
  immediateParent,
  computeFileTreeSignature,
  writeSignatureToTags,
  normalizeChangedPaths,
  detectDrift,
  formatResult
};
