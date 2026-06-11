'use strict';

const fs = require('fs');
const path = require('path');

const fsHelpers = require('./fs');

// Mapper schema per r3 §4.3. Each mapper produces one .overdrive/codebase/<file>.md
// with a consistent shape (Overview / Components / Evidence / Risks). Pattern 1
// dispatch (Q1 / 2026-06-09): the CLI emits a structured plan; the host agent
// runs 5 subagents in parallel via its task tool; each subagent writes its file
// and reports the sources it analyzed; the CLI's commit mode records those
// sources to .overdrive/codebase/_tags.json for drift detection (Task 2.7).
//
//   key          — JS-friendly identifier; used in entries payloads.
//   header       — `# <Header>` text rendered at the top of the mapper's file.
//   filename     — actual filename on disk (note `tech-stack.md` is hyphenated).
//   focus        — one-line description of what this mapper analyzes.
//   prompt       — focused subagent prompt; embeds focus, output sections,
//                  evidence requirement, scope hint, sparse-handling rule.
const MAPPERS = [
  {
    key: 'architecture',
    header: 'Architecture',
    filename: 'architecture.md',
    focus: 'System structure, module boundaries, data flow.',
    prompt:
      'Analyze this codebase\'s system structure, module boundaries, and data flow.\n' +
      'Write `.overdrive/codebase/architecture.md` with this exact shape:\n' +
      '  # Architecture\n' +
      '  ## Overview — one paragraph: what kind of system this is, the dominant pattern, the top-level structure.\n' +
      '  ## Components — each major module/package/area, its purpose, its inbound/outbound dependencies.\n' +
      '  ## Evidence — cite source files as `- path/to/file.js:42-89 — describes X`. Every claim must trace to a file.\n' +
      '  ## Risks — coupling hotspots, hidden contracts, architectural debt.\n' +
      'Scope: source tree (lib/, src/, app/, packages/ — whichever exists). Skip node_modules, dist, build, .git.\n' +
      'Sparse codebase: if there is not enough evidence to write a full file, replace the four sections with `## Insufficient evidence` and a one-paragraph reason.\n' +
      'Token budget: ~2-4k output. Be terse; no narrative fluff.\n' +
      'Report the list of source paths you actually read (relative to project root) — these become `architecture.sources` in the commit payload.'
  },
  {
    key: 'patterns',
    header: 'Patterns',
    filename: 'patterns.md',
    focus: 'Recurring idioms, conventions, abstraction patterns.',
    prompt:
      'Analyze this codebase\'s recurring patterns, idioms, and conventions.\n' +
      'Write `.overdrive/codebase/patterns.md` with this exact shape:\n' +
      '  # Patterns\n' +
      '  ## Overview — one paragraph: the dominant style (functional / OO / mixed), language conventions, formatting posture.\n' +
      '  ## Components — distinct patterns observed (e.g., "result-object error returns", "module-singleton state", "options-bag function signatures"). For each: where it appears, what problem it solves.\n' +
      '  ## Evidence — file paths + line ranges for representative instances of each pattern.\n' +
      '  ## Risks — patterns the codebase mixes inconsistently; patterns nearing end-of-life; anti-patterns to flag.\n' +
      'Scope: source tree; sample widely; do not exhaustively enumerate every file.\n' +
      'Sparse codebase: if there is not enough evidence, replace the four sections with `## Insufficient evidence` and a reason.\n' +
      'Token budget: ~2-4k output. Be terse.\n' +
      'Report the list of source paths you actually read — these become `patterns.sources` in the commit payload.'
  },
  {
    key: 'techStack',
    header: 'Tech stack',
    filename: 'tech-stack.md',
    focus: 'Frameworks, libraries, versions, build chain, deploy.',
    prompt:
      'Inventory this codebase\'s technology stack.\n' +
      'Write `.overdrive/codebase/tech-stack.md` with this exact shape:\n' +
      '  # Tech stack\n' +
      '  ## Overview — one paragraph: primary language(s), runtime(s), package manager(s), top-level toolchain.\n' +
      '  ## Components — each significant dependency category: runtime, frameworks, libraries (notable only), build tools, test runner, lint/format, deploy/CI. Include versions where known.\n' +
      '  ## Evidence — cite manifest files (package.json, lockfiles, pyproject.toml, Cargo.toml, etc.) with paths + line ranges; cite config files for build chain.\n' +
      '  ## Risks — outdated majors, unmaintained packages, fragile lockfile pinning, mismatched runtimes.\n' +
      'Scope: manifest + lockfiles + config files at the repo root and per-package. Read package contents only when versions or scripts matter.\n' +
      'Sparse codebase: if there is not enough evidence, replace the four sections with `## Insufficient evidence` and a reason.\n' +
      'Token budget: ~2-4k output.\n' +
      'Report the list of source paths you actually read — these become `techStack.sources` in the commit payload.'
  },
  {
    key: 'quality',
    header: 'Quality',
    filename: 'quality.md',
    focus: 'Test coverage, type discipline, lint posture, CI gates.',
    prompt:
      'Assess this codebase\'s quality posture.\n' +
      'Write `.overdrive/codebase/quality.md` with this exact shape:\n' +
      '  # Quality\n' +
      '  ## Overview — one paragraph: testing maturity, type discipline (strict / loose / none), lint posture, CI presence.\n' +
      '  ## Components — testing (frameworks, kinds present: unit/integration/e2e, approximate coverage shape), types (TS/JSDoc/typed Python/etc. and strictness level), lint/format (rules, autoformat), CI (which gates run on commit/PR).\n' +
      '  ## Evidence — paths to test directories, type config (tsconfig.json, mypy.ini, etc.), lint config, CI workflow files; line ranges for notable settings.\n' +
      '  ## Risks — untested critical paths, type-coverage gaps, lint rules disabled site-wide, missing CI gates.\n' +
      'Scope: tests/, __tests__/, spec/, *.test.*, *.spec.*; type/lint configs; CI workflow files.\n' +
      'Sparse codebase: if there is not enough evidence, replace the four sections with `## Insufficient evidence` and a reason.\n' +
      'Token budget: ~2-4k output.\n' +
      'Report the list of source paths you actually read — these become `quality.sources` in the commit payload.'
  },
  {
    key: 'concerns',
    header: 'Concerns',
    filename: 'concerns.md',
    focus: 'Pre-existing risks: security, performance, debt, drift.',
    prompt:
      'Surface this codebase\'s pre-existing risks and concerns.\n' +
      'Write `.overdrive/codebase/concerns.md` with this exact shape:\n' +
      '  # Concerns\n' +
      '  ## Overview — one paragraph: the overall risk posture. Are concerns load-bearing or peripheral?\n' +
      '  ## Components — security (auth, secrets, validation, surface area), performance (hot paths, N+1, allocation), debt (legacy modules, deprecated APIs, dead code), drift (documentation vs. code, comments vs. behavior).\n' +
      '  ## Evidence — concrete file paths + line ranges for each concern. Do not speculate; only what you can cite.\n' +
      '  ## Risks — top 3-5 concerns ranked by likely impact, with a one-line "if we touched this, watch for X" for each.\n' +
      'Scope: scan widely but cite narrowly; this mapper exists to surface concrete observed issues, not theoretical worries.\n' +
      'Sparse codebase: if there is not enough evidence, replace the four sections with `## Insufficient evidence` and a reason.\n' +
      'Token budget: ~2-4k output.\n' +
      'Report the list of source paths you actually read — these become `concerns.sources` in the commit payload.'
  }
];

const MAPPER_KEYS = MAPPERS.map((m) => m.key);
const MAPPER_HEADERS = MAPPERS.reduce((acc, m) => {
  acc[m.key] = m.header;
  return acc;
}, {});
const MAPPER_FILENAMES = MAPPERS.reduce((acc, m) => {
  acc[m.key] = m.filename;
  return acc;
}, {});

const CODEBASE_DIR_NAME = 'codebase';
const TAGS_FILENAME = '_tags.json';

function codebaseDir(rootDir) {
  return fsHelpers.ovdPath(rootDir, CODEBASE_DIR_NAME);
}

function tagsPath(rootDir) {
  return path.join(codebaseDir(rootDir), TAGS_FILENAME);
}

function mapperPath(rootDir, key) {
  const filename = MAPPER_FILENAMES[key];
  if (!filename) return null;
  return path.join(codebaseDir(rootDir), filename);
}

function readTagsFile(rootDir) {
  const p = tagsPath(rootDir);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_e) {
    return null;
  }
}

function detectMapperState(rootDir) {
  const result = {};
  for (const m of MAPPERS) {
    const p = mapperPath(rootDir, m.key);
    if (!fs.existsSync(p)) {
      result[m.key] = 'missing';
      continue;
    }
    let content;
    try {
      content = fs.readFileSync(p, 'utf8');
    } catch (_e) {
      result[m.key] = 'missing';
      continue;
    }
    const body = content.replace(/^#[^\n]*\n?/, '').trim();
    if (body.length === 0) {
      result[m.key] = 'placeholder';
    } else if (/^##\s+Insufficient evidence\b/m.test(content)) {
      result[m.key] = 'insufficient-evidence';
    } else {
      result[m.key] = 'populated';
    }
  }
  return result;
}

function buildPlan(rootDir) {
  const mapperState = detectMapperState(rootDir);
  const existingTags = readTagsFile(rootDir);
  return {
    mode: 'plan',
    dir: codebaseDir(rootDir),
    tagsPath: tagsPath(rootDir),
    tagsExist: existingTags !== null,
    mappers: MAPPERS.map((m) => ({
      key: m.key,
      header: m.header,
      filename: m.filename,
      path: mapperPath(rootDir, m.key),
      focus: m.focus,
      prompt: m.prompt,
      currentState: mapperState[m.key]
    })),
    instructions: [
      'Dispatch all 5 mappers in parallel via the host agent\'s subagent/task tool — one subagent per mapper above.',
      'Each subagent receives its `prompt` and writes its own `.overdrive/codebase/<filename>.md` directly. The CLI does not write the mapper files.',
      'Each subagent must cite evidence with file paths + line ranges; no claim without a citation.',
      'If a mapper has insufficient evidence (tiny codebase, missing manifests, etc.), it writes only `## Insufficient evidence` with a one-paragraph reason. The file still exists; the 5-file contract per r3 §4.3 is preserved.',
      'Each subagent reports the list of source paths it actually read. When all 5 complete, batch the source lists into a single JSON payload and call:',
      '  overdrive workflow map commit --entries-json \'{"architecture":{"sources":[...]},"patterns":{"sources":[...]},"techStack":{"sources":[...]},"quality":{"sources":[...]},"concerns":{"sources":[...]}}\'',
      'The commit step records `.overdrive/codebase/_tags.json` (scannedAt + per-mapper sources) for drift detection (Task 2.7).',
      'Re-runs always overwrite the mapper files and the tags file. Incremental refresh is the separate `MAP REFRESH` command (Task 2.8); /ovd-workflow map is the explicit full re-run.'
    ]
  };
}

function normalizeEntries(rawEntries) {
  if (!rawEntries || typeof rawEntries !== 'object' || Array.isArray(rawEntries)) {
    return { ok: false, reason: 'entries must be an object keyed by mapper', normalized: null };
  }
  const normalized = {};
  const unknown = [];
  for (const key of Object.keys(rawEntries)) {
    if (!MAPPER_KEYS.includes(key)) {
      unknown.push(key);
      continue;
    }
    const raw = rawEntries[key];
    if (raw === null || raw === undefined) {
      normalized[key] = { sources: [] };
      continue;
    }
    if (typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, reason: `entries.${key} must be an object with a sources array`, normalized: null };
    }
    const rawSources = raw.sources;
    if (rawSources === null || rawSources === undefined) {
      normalized[key] = { sources: [] };
      continue;
    }
    if (typeof rawSources === 'string') {
      const trimmed = rawSources.trim();
      normalized[key] = { sources: trimmed.length > 0 ? [trimmed] : [] };
      continue;
    }
    if (Array.isArray(rawSources)) {
      const cleaned = [];
      for (const item of rawSources) {
        if (typeof item !== 'string') {
          return { ok: false, reason: `entries.${key}.sources must be strings`, normalized: null };
        }
        const trimmed = item.trim();
        if (trimmed.length > 0) cleaned.push(trimmed);
      }
      normalized[key] = { sources: cleaned };
      continue;
    }
    return { ok: false, reason: `entries.${key}.sources must be a string or array of strings`, normalized: null };
  }
  for (const k of MAPPER_KEYS) {
    if (!(k in normalized)) normalized[k] = { sources: [] };
  }
  return { ok: true, normalized, unknownCategories: unknown };
}

function applyEntries(rootDir, entries) {
  const dir = codebaseDir(rootDir);
  fs.mkdirSync(dir, { recursive: true });

  const mappersOut = {};
  let totalSources = 0;
  for (const m of MAPPERS) {
    const entry = entries[m.key] || { sources: [] };
    const sources = Array.isArray(entry.sources) ? entry.sources.slice() : [];
    mappersOut[m.key] = {
      file: m.filename,
      sources
    };
    totalSources += sources.length;
  }

  const payload = {
    scannedAt: new Date().toISOString(),
    mappers: mappersOut
  };

  const filePath = tagsPath(rootDir);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n');
  return {
    path: filePath,
    payload,
    totalSources,
    mapperState: detectMapperState(rootDir)
  };
}

function runCodebaseMap(rootDir, opts = {}) {
  if (!rootDir) {
    return {
      ok: false,
      status: 'codebase-map',
      reason: 'no rootDir resolved',
      text: 'Could not resolve a project directory.'
    };
  }
  const resolvedRoot = path.resolve(rootDir);
  const mode = opts.mode === 'commit' ? 'commit' : 'plan';

  if (mode === 'plan') {
    const plan = buildPlan(resolvedRoot);
    const populatedCount = plan.mappers.filter((m) => m.currentState === 'populated' || m.currentState === 'insufficient-evidence').length;
    const result = {
      ok: true,
      status: 'codebase-map',
      mode: 'plan',
      rootDir: resolvedRoot,
      plan,
      summary: `codebase-map plan emitted (5 mappers; ${populatedCount} previously populated; tags ${plan.tagsExist ? 'exist' : 'will be created on commit'})`
    };
    result.text = formatPlan(result);
    return result;
  }

  const norm = normalizeEntries(opts.entries);
  if (!norm.ok) {
    return {
      ok: false,
      status: 'codebase-map',
      mode: 'commit',
      reason: norm.reason,
      text: `Could not record codebase tags: ${norm.reason}`
    };
  }

  const writeResult = applyEntries(resolvedRoot, norm.normalized);
  const missingFiles = MAPPERS
    .filter((m) => writeResult.mapperState[m.key] === 'missing')
    .map((m) => m.filename);

  const result = {
    ok: true,
    status: 'codebase-map',
    mode: 'commit',
    rootDir: resolvedRoot,
    path: writeResult.path,
    totalSources: writeResult.totalSources,
    perMapper: Object.entries(writeResult.payload.mappers).reduce((acc, [k, v]) => {
      acc[k] = v.sources.length;
      return acc;
    }, {}),
    mapperState: writeResult.mapperState,
    missingFiles,
    unknownCategories: norm.unknownCategories,
    summary: `codebase-map commit: ${writeResult.totalSources} source paths across ${Object.values(writeResult.payload.mappers).filter((m) => m.sources.length > 0).length} mappers`
  };
  result.text = formatCommit(result);
  return result;
}

function formatPlan(result) {
  const plan = result.plan;
  const lines = [];
  lines.push('Overdrive (ovd-plan) — /ovd-workflow map (plan)');
  lines.push('');
  lines.push(`Directory: ${plan.dir}`);
  lines.push(`Tags file: ${plan.tagsPath} (${plan.tagsExist ? 'exists' : 'will be created on commit'})`);
  lines.push('');
  lines.push('Dispatch these 5 mappers in parallel via the host agent\'s subagent/task tool:');
  lines.push('');
  for (const m of plan.mappers) {
    lines.push(`  [${m.key}] (${m.filename}) — ${m.currentState}`);
    lines.push(`    Focus: ${m.focus}`);
  }
  lines.push('');
  lines.push('Each subagent writes its own .md file under .overdrive/codebase/ following the prompt embedded in `plan.mappers[].prompt`.');
  lines.push('');
  lines.push('When all 5 complete, commit the tags with:');
  lines.push("  overdrive workflow map commit --entries-json '{\"architecture\":{\"sources\":[...]},\"patterns\":{\"sources\":[...]},\"techStack\":{\"sources\":[...]},\"quality\":{\"sources\":[...]},\"concerns\":{\"sources\":[...]}}'");
  return lines.join('\n');
}

function formatCommit(result) {
  const lines = [];
  lines.push('Overdrive (ovd-plan) — /ovd-workflow map (commit)');
  lines.push('');
  lines.push(`Tags file: ${result.path}`);
  lines.push(`Total source paths recorded: ${result.totalSources}`);
  lines.push('');
  lines.push('Per mapper:');
  for (const m of MAPPERS) {
    const count = result.perMapper[m.key] || 0;
    const state = result.mapperState[m.key] || 'missing';
    lines.push(`  ${m.key}: ${count} source(s); file ${state}`);
  }
  if (result.missingFiles && result.missingFiles.length > 0) {
    lines.push('');
    lines.push(`WARNING: mapper file(s) not on disk: ${result.missingFiles.join(', ')}.`);
    lines.push('Re-run the subagents for missing files, then call map commit again.');
  }
  if (result.unknownCategories && result.unknownCategories.length > 0) {
    lines.push('');
    lines.push(`Unknown mappers ignored: ${result.unknownCategories.join(', ')}`);
  }
  lines.push('');
  lines.push('_tags.json updated. Task 2.7 (drift detection) will use the per-mapper sources to flag refresh candidates.');
  return lines.join('\n');
}

module.exports = {
  MAPPERS,
  MAPPER_KEYS,
  MAPPER_HEADERS,
  MAPPER_FILENAMES,
  CODEBASE_DIR_NAME,
  TAGS_FILENAME,
  codebaseDir,
  tagsPath,
  mapperPath,
  readTagsFile,
  detectMapperState,
  buildPlan,
  normalizeEntries,
  applyEntries,
  formatPlan,
  formatCommit,
  runCodebaseMap
};
