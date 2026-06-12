'use strict';

const fs = require('fs');
const path = require('path');

const codebaseMapper = require('./codebase-mapper');
const driftDetector = require('./drift-detector');

const {
  MAPPERS,
  MAPPER_KEYS,
  MAPPER_FILENAMES,
  codebaseDir,
  tagsPath,
  mapperPath,
  readTagsFile,
  detectMapperState
} = codebaseMapper;

const REFRESH_PROMPT_SUFFIX =
  '\n\n' +
  'REFRESH MODE — preserve discovered content:\n' +
  '  1. Read the existing `.md` file at the target path if present.\n' +
  '  2. If it has a `## Discovered during execution` section (or any other `## Discovered ...` section appended by prior /ovd-go runs), copy that section VERBATIM into your output.\n' +
  '  3. Then rewrite the four standard sections (Overview / Components / Evidence / Risks) with current analysis.\n' +
  '  4. Keep the discovered-content section ABOVE or BELOW the four standard sections — your call — but never delete or paraphrase it. Phase 4 will append to it again later.\n' +
  '  5. If the existing file does NOT have a discovered section, behave exactly like a fresh /ovd-workflow map run for this mapper.';

function isStringArray(x) {
  return Array.isArray(x) && x.every((s) => typeof s === 'string');
}

function determineNeedsRefresh(rootDir, opts = {}) {
  const mappersProvided = opts.mappers !== undefined && opts.mappers !== null;
  const changedProvided = Array.isArray(opts.changedPaths) && opts.changedPaths.length > 0;

  if (mappersProvided && changedProvided) {
    return {
      ok: false,
      reason: 'pass either { mappers } or { changedPaths }, not both'
    };
  }

  if (mappersProvided) {
    if (!Array.isArray(opts.mappers)) {
      return { ok: false, reason: 'mappers must be an array of strings' };
    }
    if (!isStringArray(opts.mappers)) {
      return { ok: false, reason: 'mappers must be an array of strings' };
    }
    const invalid = opts.mappers.filter((k) => !MAPPER_KEYS.includes(k));
    if (invalid.length > 0) {
      return {
        ok: false,
        reason: `unknown mapper key(s): ${invalid.join(', ')}. Valid: ${MAPPER_KEYS.join(', ')}`
      };
    }
    const dedup = Array.from(new Set(opts.mappers))
      .sort((a, b) => MAPPER_KEYS.indexOf(a) - MAPPER_KEYS.indexOf(b));
    return {
      ok: true,
      needsRefresh: dedup,
      reason: dedup.length === 0
        ? 'no mapper keys supplied'
        : `caller specified ${dedup.length} mapper(s): ${dedup.join(', ')}`,
      source: 'explicit'
    };
  }

  // Either changedPaths supplied, or nothing supplied → both delegate to drift.
  const drift = driftDetector.detectDrift(rootDir, {
    changedPaths: Array.isArray(opts.changedPaths) ? opts.changedPaths : []
  });
  if (!drift.ok) {
    return { ok: false, reason: drift.reason };
  }
  return {
    ok: true,
    needsRefresh: drift.needsRefresh,
    reason: drift.reason,
    source: 'drift',
    driftSignals: drift.signals
  };
}

function buildRefreshPlan(rootDir, needsRefresh, refreshReason) {
  const refreshMappers = MAPPERS.filter((m) => needsRefresh.includes(m.key));
  const skipped = MAPPERS.filter((m) => !needsRefresh.includes(m.key)).map((m) => m.key);
  const mapperState = detectMapperState(rootDir);
  const existingTags = readTagsFile(rootDir);

  return {
    mode: 'plan',
    dir: codebaseDir(rootDir),
    tagsPath: tagsPath(rootDir),
    tagsExist: existingTags !== null,
    refreshReason,
    mappers: refreshMappers.map((m) => ({
      key: m.key,
      header: m.header,
      filename: m.filename,
      path: mapperPath(rootDir, m.key),
      focus: m.focus,
      prompt: m.prompt + REFRESH_PROMPT_SUFFIX,
      currentState: mapperState[m.key]
    })),
    skipped,
    instructions: [
      `Dispatch ${refreshMappers.length} mapper(s) in parallel via the host agent's subagent/task tool: ${needsRefresh.join(', ')}.`,
      skipped.length > 0
        ? `${skipped.length} mapper(s) skipped: ${skipped.join(', ')}. Their .md files + _tags.json sources are preserved verbatim.`
        : 'No mappers skipped — all 5 are being refreshed.',
      'Each subagent reads the existing .md file (if present), preserves any `## Discovered during execution` section verbatim, and rewrites the four standard sections (Overview / Components / Evidence / Risks) with current analysis.',
      'Evidence requirement (file paths + line ranges) and sparse-codebase rules (`## Insufficient evidence` stub) carry over from /ovd-workflow map (Task 2.3).',
      'When all refreshed subagents complete, batch their source lists into a JSON payload (only the refreshed mappers, NOT every key) and call:',
      '  overdrive workflow refresh commit --entries-json \'{"architecture":{"sources":[...]}}\'',
      'Refresh commit MERGES into _tags.json: it replaces `sources` only for refreshed mappers, leaves untouched mappers verbatim, advances `scannedAt`, and preserves `fileTreeSignature` set by Task 2.7.'
    ]
  };
}

function normalizeRefreshEntries(rawEntries, allowedKeys) {
  if (!rawEntries || typeof rawEntries !== 'object' || Array.isArray(rawEntries)) {
    return { ok: false, reason: 'entries must be an object keyed by mapper' };
  }
  const normalized = {};
  const unknown = [];
  const disallowed = [];
  for (const key of Object.keys(rawEntries)) {
    if (!MAPPER_KEYS.includes(key)) {
      unknown.push(key);
      continue;
    }
    if (allowedKeys && !allowedKeys.includes(key)) {
      disallowed.push(key);
      continue;
    }
    const raw = rawEntries[key];
    if (raw === null || raw === undefined) {
      normalized[key] = { sources: [] };
      continue;
    }
    if (typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, reason: `entries.${key} must be an object with a sources array` };
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
          return { ok: false, reason: `entries.${key}.sources must be strings` };
        }
        const trimmed = item.trim();
        if (trimmed.length > 0) cleaned.push(trimmed);
      }
      normalized[key] = { sources: cleaned };
      continue;
    }
    return { ok: false, reason: `entries.${key}.sources must be a string or array of strings` };
  }
  return {
    ok: true,
    normalized,
    unknownCategories: unknown,
    disallowedKeys: disallowed
  };
}

function applyRefreshEntries(rootDir, entries) {
  const filePath = tagsPath(rootDir);
  if (!fs.existsSync(filePath)) {
    return { ok: false, reason: 'no _tags.json on disk; run /ovd-workflow map first' };
  }
  let current;
  try {
    current = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return { ok: false, reason: `_tags.json could not be parsed: ${e.message}` };
  }
  if (!current || typeof current !== 'object' || Array.isArray(current)) {
    return { ok: false, reason: '_tags.json root is not an object' };
  }
  if (!current.mappers || typeof current.mappers !== 'object') {
    current.mappers = {};
  }

  const refreshedKeys = Object.keys(entries);
  let totalSources = 0;
  const perMapper = {};
  for (const key of MAPPER_KEYS) {
    if (entries[key]) {
      const sources = entries[key].sources || [];
      const filename = MAPPER_FILENAMES[key];
      current.mappers[key] = { file: filename, sources: sources.slice() };
      perMapper[key] = { count: sources.length, action: 'refreshed' };
      totalSources += sources.length;
    } else if (current.mappers[key]) {
      perMapper[key] = { count: (current.mappers[key].sources || []).length, action: 'preserved' };
    } else {
      perMapper[key] = { count: 0, action: 'absent' };
    }
  }
  current.scannedAt = new Date().toISOString();

  fs.writeFileSync(filePath, JSON.stringify(current, null, 2) + '\n');
  return {
    ok: true,
    path: filePath,
    totalSources,
    perMapper,
    refreshedKeys,
    mapperState: detectMapperState(rootDir)
  };
}

function runRefreshMap(rootDir, opts = {}) {
  if (!rootDir) {
    return {
      ok: false,
      status: 'refresh',
      reason: 'no rootDir resolved',
      text: 'Could not resolve a project directory.'
    };
  }
  const resolvedRoot = path.resolve(rootDir);
  const mode = opts.mode === 'commit' ? 'commit' : 'plan';

  if (mode === 'plan') {
    const determination = determineNeedsRefresh(resolvedRoot, opts);
    if (!determination.ok) {
      const result = {
        ok: false,
        status: 'refresh',
        mode: 'plan',
        reason: determination.reason
      };
      result.text = `Could not build refresh plan: ${determination.reason}`;
      return result;
    }
    const needsRefresh = determination.needsRefresh;
    if (needsRefresh.length === 0) {
      const result = {
        ok: true,
        status: 'refresh',
        mode: 'plan',
        rootDir: resolvedRoot,
        needsRefresh: [],
        skipped: MAPPER_KEYS.slice(),
        plan: {
          mode: 'plan',
          dir: codebaseDir(resolvedRoot),
          tagsPath: tagsPath(resolvedRoot),
          refreshReason: determination.reason,
          mappers: [],
          skipped: MAPPER_KEYS.slice(),
          instructions: [
            'No mappers flagged. Codebase analysis is current.',
            'No subagents to dispatch. Skip to the next step in your workflow.'
          ]
        },
        determination,
        summary: 'refresh: nothing flagged; codebase analysis is current.'
      };
      result.text = formatPlan(result);
      return result;
    }
    const plan = buildRefreshPlan(resolvedRoot, needsRefresh, determination.reason);
    const result = {
      ok: true,
      status: 'refresh',
      mode: 'plan',
      rootDir: resolvedRoot,
      needsRefresh,
      skipped: plan.skipped,
      plan,
      determination,
      summary: `refresh plan emitted (${needsRefresh.length} mapper(s) flagged; ${plan.skipped.length} preserved)`
    };
    result.text = formatPlan(result);
    return result;
  }

  // mode === 'commit'
  const refreshedKeys = Array.isArray(opts.refreshedKeys) ? opts.refreshedKeys : null;
  const norm = normalizeRefreshEntries(opts.entries, refreshedKeys);
  if (!norm.ok) {
    return {
      ok: false,
      status: 'refresh',
      mode: 'commit',
      reason: norm.reason,
      text: `Could not commit refresh: ${norm.reason}`
    };
  }
  const applied = applyRefreshEntries(resolvedRoot, norm.normalized);
  if (!applied.ok) {
    return {
      ok: false,
      status: 'refresh',
      mode: 'commit',
      reason: applied.reason,
      text: `Could not commit refresh: ${applied.reason}`
    };
  }
  const result = {
    ok: true,
    status: 'refresh',
    mode: 'commit',
    rootDir: resolvedRoot,
    path: applied.path,
    totalSources: applied.totalSources,
    refreshedKeys: applied.refreshedKeys,
    perMapper: applied.perMapper,
    mapperState: applied.mapperState,
    unknownCategories: norm.unknownCategories,
    disallowedKeys: norm.disallowedKeys,
    summary: `refresh commit: ${applied.refreshedKeys.length} mapper(s) updated (${applied.refreshedKeys.join(', ') || 'none'}); ${MAPPER_KEYS.length - applied.refreshedKeys.length} preserved`
  };
  result.text = formatCommit(result);
  return result;
}

function formatPlan(result) {
  const lines = [];
  lines.push('Overdrive (ovd-plan) — /ovd-workflow refresh (plan)');
  lines.push('');
  if (!result.ok) {
    lines.push(`Refresh plan failed: ${result.reason || 'unknown'}`);
    return lines.join('\n');
  }
  const plan = result.plan;
  lines.push(`Directory: ${plan.dir}`);
  lines.push(`Tags file: ${plan.tagsPath} (${plan.tagsExist === false ? 'missing — run /ovd-workflow map first' : 'exists'})`);
  lines.push('');
  lines.push(`Why: ${plan.refreshReason}`);
  lines.push('');
  if (result.needsRefresh.length === 0) {
    lines.push(result.summary);
    lines.push('');
    lines.push('No subagents to dispatch. Codebase analysis is current.');
    return lines.join('\n');
  }
  lines.push(`Dispatch these ${result.needsRefresh.length} mapper(s) in parallel:`);
  for (const m of plan.mappers) {
    lines.push(`  [${m.key}] (${m.filename}) — ${m.currentState}`);
    lines.push(`    Focus: ${m.focus}`);
  }
  lines.push('');
  if (plan.skipped.length > 0) {
    lines.push(`Skipped (preserved verbatim): ${plan.skipped.join(', ')}.`);
    lines.push('');
  }
  lines.push('Each subagent must preserve any `## Discovered during execution` content in the existing file.');
  lines.push('');
  lines.push('When refreshed subagents complete, commit only their source lists with:');
  lines.push("  overdrive workflow refresh commit --entries-json '{\"<key>\":{\"sources\":[...]}}'");
  return lines.join('\n');
}

function formatCommit(result) {
  const lines = [];
  lines.push('Overdrive (ovd-plan) — /ovd-workflow refresh (commit)');
  lines.push('');
  lines.push(`Tags file: ${result.path}`);
  lines.push(`Mappers refreshed: ${result.refreshedKeys.length > 0 ? result.refreshedKeys.join(', ') : 'none'}`);
  lines.push(`Total source paths in refreshed mappers: ${result.totalSources}`);
  lines.push('');
  lines.push('Per mapper:');
  for (const key of MAPPER_KEYS) {
    const entry = result.perMapper[key] || { count: 0, action: 'absent' };
    const state = result.mapperState[key] || 'missing';
    lines.push(`  ${key}: ${entry.count} source(s) [${entry.action}]; file ${state}`);
  }
  if (result.unknownCategories && result.unknownCategories.length > 0) {
    lines.push('');
    lines.push(`Unknown mappers ignored: ${result.unknownCategories.join(', ')}`);
  }
  if (result.disallowedKeys && result.disallowedKeys.length > 0) {
    lines.push('');
    lines.push(`Disallowed mappers ignored: ${result.disallowedKeys.join(', ')} (not in the refresh plan).`);
  }
  lines.push('');
  lines.push('Untouched mappers\' sources preserved verbatim; fileTreeSignature preserved; scannedAt advanced.');
  return lines.join('\n');
}

module.exports = {
  REFRESH_PROMPT_SUFFIX,
  determineNeedsRefresh,
  buildRefreshPlan,
  normalizeRefreshEntries,
  applyRefreshEntries,
  runRefreshMap,
  formatPlan,
  formatCommit
};
