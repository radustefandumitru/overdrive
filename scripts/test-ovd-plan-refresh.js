#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  REFRESH_PROMPT_SUFFIX,
  determineNeedsRefresh,
  buildRefreshPlan,
  normalizeRefreshEntries,
  applyRefreshEntries,
  runRefreshMap,
  formatPlan,
  formatCommit
} = require('../lib/ovd-plan/codebase-refresh');

const codebaseMapper = require('../lib/ovd-plan/codebase-mapper');
const { MAPPER_KEYS, MAPPERS, tagsPath, mapperPath } = codebaseMapper;
const driftDetector = require('../lib/ovd-plan/drift-detector');

const verbose = process.argv.includes('--verbose');
let passed = 0;
const failures = [];

function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    if (verbose) console.log(`PASS ${label}`);
  } else {
    const message = detail ? `${label}: ${detail}` : label;
    failures.push(message);
    console.log(`FAIL ${message}`);
  }
}

function makeTempProject(name) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-refresh-test-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.mkdirSync(path.join(projectDir, '.overdrive', 'codebase'), { recursive: true });
  return { projectDir, tmpRoot };
}

function writeTags(projectDir, overrides = {}) {
  const defaultTags = {
    scannedAt: '2026-06-10T00:00:00.000Z',
    mappers: {
      architecture: { file: 'architecture.md', sources: [] },
      patterns: { file: 'patterns.md', sources: [] },
      techStack: { file: 'tech-stack.md', sources: [] },
      quality: { file: 'quality.md', sources: [] },
      concerns: { file: 'concerns.md', sources: [] }
    }
  };
  const merged = { ...defaultTags, ...overrides };
  if (overrides.mappers) {
    merged.mappers = { ...defaultTags.mappers, ...overrides.mappers };
  }
  fs.writeFileSync(tagsPath(projectDir), JSON.stringify(merged, null, 2) + '\n');
  return merged;
}

function cleanup(tmpRoot) {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

console.log('ovd-plan codebase-refresh tests');

// --- 0. Module surface ---
{
  check('REFRESH_PROMPT_SUFFIX is a string mentioning Discovered', typeof REFRESH_PROMPT_SUFFIX === 'string' && /Discovered during execution/i.test(REFRESH_PROMPT_SUFFIX));
  check('REFRESH_PROMPT_SUFFIX mentions REFRESH MODE', /REFRESH MODE/.test(REFRESH_PROMPT_SUFFIX));
  check('REFRESH_PROMPT_SUFFIX mentions preserve verbatim', /verbatim/i.test(REFRESH_PROMPT_SUFFIX));
  check('runRefreshMap is a function', typeof runRefreshMap === 'function');
  check('determineNeedsRefresh is a function', typeof determineNeedsRefresh === 'function');
}

// --- 1. determineNeedsRefresh: explicit mappers ---
{
  const { projectDir, tmpRoot } = makeTempProject('det-explicit');
  try {
    writeTags(projectDir);
    const r = determineNeedsRefresh(projectDir, { mappers: ['architecture', 'patterns'] });
    check('det-explicit: ok=true', r.ok === true);
    check('det-explicit: needsRefresh = [architecture, patterns]', JSON.stringify(r.needsRefresh) === JSON.stringify(['architecture', 'patterns']));
    check('det-explicit: source=explicit', r.source === 'explicit');
    check('det-explicit: reason mentions caller', /caller specified/i.test(r.reason));
  } finally {
    cleanup(tmpRoot);
  }
}
{
  // Deduplication + ordering
  const { projectDir, tmpRoot } = makeTempProject('det-dedup');
  try {
    writeTags(projectDir);
    const r = determineNeedsRefresh(projectDir, { mappers: ['patterns', 'architecture', 'patterns', 'concerns'] });
    check('det-dedup: dedup + mapper-key order', JSON.stringify(r.needsRefresh) === JSON.stringify(['architecture', 'patterns', 'concerns']));
  } finally {
    cleanup(tmpRoot);
  }
}
{
  // Unknown mapper key
  const r = determineNeedsRefresh('/tmp/x', { mappers: ['architecture', 'bogus'] });
  check('det-unknown-key: ok=false', r.ok === false);
  check('det-unknown-key: reason names the bad key', /bogus/.test(r.reason) && /unknown mapper/i.test(r.reason));
}
{
  const r = determineNeedsRefresh('/tmp/x', { mappers: 'not an array' });
  check('det-non-array-mappers: ok=false', r.ok === false && /must be an array/.test(r.reason));
}

// --- 2. determineNeedsRefresh: both mappers and changedPaths → error ---
{
  const r = determineNeedsRefresh('/tmp/x', { mappers: ['architecture'], changedPaths: ['lib/foo.js'] });
  check('det-both: ok=false', r.ok === false);
  check('det-both: reason mentions either/or', /either.*\{.*mappers.*\}.*or.*\{.*changedPaths.*\}/i.test(r.reason));
}

// --- 3. determineNeedsRefresh: changedPaths → delegates to drift ---
{
  const { projectDir, tmpRoot } = makeTempProject('det-drift');
  try {
    fs.mkdirSync(path.join(projectDir, 'lib'));
    const sig = driftDetector.computeFileTreeSignature(projectDir);
    writeTags(projectDir, {
      fileTreeSignature: sig,
      mappers: {
        architecture: { file: 'architecture.md', sources: ['lib/installer.js'] },
        patterns: { file: 'patterns.md', sources: [] },
        techStack: { file: 'tech-stack.md', sources: [] },
        quality: { file: 'quality.md', sources: [] },
        concerns: { file: 'concerns.md', sources: [] }
      }
    });
    const r = determineNeedsRefresh(projectDir, { changedPaths: ['lib/installer.js'] });
    check('det-drift: ok=true', r.ok === true);
    check('det-drift: source=drift', r.source === 'drift');
    check('det-drift: needsRefresh = [architecture]', JSON.stringify(r.needsRefresh) === JSON.stringify(['architecture']));
    check('det-drift: driftSignals included', r.driftSignals && typeof r.driftSignals.firstRun === 'boolean');
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 4. determineNeedsRefresh: empty opts → drift with empty changedPaths ---
{
  const { projectDir, tmpRoot } = makeTempProject('det-empty');
  try {
    fs.mkdirSync(path.join(projectDir, 'lib'));
    const sig = driftDetector.computeFileTreeSignature(projectDir);
    writeTags(projectDir, { fileTreeSignature: sig });
    const r = determineNeedsRefresh(projectDir, {});
    check('det-empty: ok=true', r.ok === true);
    check('det-empty: source=drift', r.source === 'drift');
    check('det-empty: needsRefresh empty (clean state)', r.needsRefresh.length === 0);
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 5. buildRefreshPlan: 1 mapper flagged ---
{
  const { projectDir, tmpRoot } = makeTempProject('plan-one');
  try {
    writeTags(projectDir);
    const plan = buildRefreshPlan(projectDir, ['architecture'], 'test reason');
    check('plan-one: 1 mapper to dispatch', plan.mappers.length === 1 && plan.mappers[0].key === 'architecture');
    check('plan-one: 4 skipped', plan.skipped.length === 4 && !plan.skipped.includes('architecture'));
    check('plan-one: prompt is base prompt + REFRESH_PROMPT_SUFFIX', plan.mappers[0].prompt.endsWith(REFRESH_PROMPT_SUFFIX));
    check('plan-one: prompt includes original 4-section structure', /## Overview/.test(plan.mappers[0].prompt) && /## Components/.test(plan.mappers[0].prompt));
    check('plan-one: refreshReason recorded', plan.refreshReason === 'test reason');
    check('plan-one: instructions mention dispatch count', plan.instructions.some((l) => /1 mapper\(s\) in parallel/.test(l)));
    check('plan-one: instructions mention skipped list', plan.instructions.some((l) => /4 mapper\(s\) skipped/.test(l)));
    check('plan-one: instructions mention preserve discovered', plan.instructions.some((l) => /Discovered during execution/i.test(l)));
    check('plan-one: instructions mention refresh commit', plan.instructions.some((l) => /refresh commit --entries-json/.test(l)));
    check('plan-one: instructions mention MERGE semantic', plan.instructions.some((l) => /MERGES/i.test(l)));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 6. buildRefreshPlan: all 5 mappers flagged ---
{
  const { projectDir, tmpRoot } = makeTempProject('plan-all');
  try {
    writeTags(projectDir);
    const plan = buildRefreshPlan(projectDir, MAPPER_KEYS.slice(), 'all flagged');
    check('plan-all: 5 mappers to dispatch', plan.mappers.length === 5);
    check('plan-all: 0 skipped', plan.skipped.length === 0);
    check('plan-all: instructions mention no mappers skipped', plan.instructions.some((l) => /No mappers skipped/i.test(l)));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 7. normalizeRefreshEntries: happy + tolerance ---
{
  const r = normalizeRefreshEntries({
    architecture: { sources: ['lib/foo.js', '  lib/bar.js  ', ''] },
    patterns: { sources: 'lib/baz.js' }
  });
  check('norm: ok=true', r.ok === true);
  check('norm: architecture trimmed + empty-filtered', JSON.stringify(r.normalized.architecture.sources) === JSON.stringify(['lib/foo.js', 'lib/bar.js']));
  check('norm: patterns string promoted to single-item array', JSON.stringify(r.normalized.patterns.sources) === JSON.stringify(['lib/baz.js']));
  check('norm: unknown empty', r.unknownCategories.length === 0);
}

// --- 8. normalizeRefreshEntries: validation errors ---
{
  check('norm(null): ok=false', normalizeRefreshEntries(null).ok === false);
  check('norm(array): ok=false', normalizeRefreshEntries(['x']).ok === false);
  check('norm(string): ok=false', normalizeRefreshEntries('x').ok === false);

  const r1 = normalizeRefreshEntries({ architecture: 'not an object' });
  check('norm(non-object value): ok=false', r1.ok === false && /must be an object/.test(r1.reason));

  const r2 = normalizeRefreshEntries({ architecture: { sources: [123, 'lib/foo.js'] } });
  check('norm(non-string source): ok=false', r2.ok === false && /must be strings/.test(r2.reason));

  const r3 = normalizeRefreshEntries({ bogus: { sources: ['x'] }, architecture: { sources: ['y'] } });
  check('norm(unknown key): recorded; valid keys still processed', r3.ok === true && r3.unknownCategories.includes('bogus') && r3.normalized.architecture.sources[0] === 'y');
}

// --- 9. normalizeRefreshEntries: allowedKeys (refresh-plan scope) ---
{
  const r = normalizeRefreshEntries(
    { architecture: { sources: ['x'] }, patterns: { sources: ['y'] }, concerns: { sources: ['z'] } },
    ['architecture', 'patterns']
  );
  check('norm(allowedKeys): only allowed keys make it into normalized', !r.normalized.concerns);
  check('norm(allowedKeys): disallowed reported', r.disallowedKeys.includes('concerns'));
  check('norm(allowedKeys): allowed keys present', r.normalized.architecture && r.normalized.patterns);
}

// --- 10. applyRefreshEntries: merge semantics (untouched preserved) ---
{
  const { projectDir, tmpRoot } = makeTempProject('apply-merge');
  try {
    writeTags(projectDir, {
      fileTreeSignature: { algorithm: 'sha1', hash: 'preserved-hash', entries: ['lib'] },
      mappers: {
        architecture: { file: 'architecture.md', sources: ['lib/old-arch.js'] },
        patterns: { file: 'patterns.md', sources: ['lib/old-pat.js'] },
        techStack: { file: 'tech-stack.md', sources: ['package.json'] },
        quality: { file: 'quality.md', sources: ['__tests__/x.test.js'] },
        concerns: { file: 'concerns.md', sources: ['docs/SEC.md'] }
      }
    });
    const before = fs.readFileSync(tagsPath(projectDir), 'utf8');
    const r = applyRefreshEntries(projectDir, {
      architecture: { sources: ['lib/new-arch.js', 'lib/new-arch2.js'] }
    });
    check('apply-merge: ok=true', r.ok === true);
    check('apply-merge: totalSources counts only refreshed', r.totalSources === 2);
    check('apply-merge: perMapper.architecture.action=refreshed', r.perMapper.architecture.action === 'refreshed');
    check('apply-merge: perMapper.patterns.action=preserved', r.perMapper.patterns.action === 'preserved');

    const raw = JSON.parse(fs.readFileSync(tagsPath(projectDir), 'utf8'));
    check('apply-merge: architecture.sources replaced', JSON.stringify(raw.mappers.architecture.sources) === JSON.stringify(['lib/new-arch.js', 'lib/new-arch2.js']));
    check('apply-merge: patterns.sources preserved verbatim', JSON.stringify(raw.mappers.patterns.sources) === JSON.stringify(['lib/old-pat.js']));
    check('apply-merge: techStack.sources preserved verbatim', JSON.stringify(raw.mappers.techStack.sources) === JSON.stringify(['package.json']));
    check('apply-merge: quality.sources preserved verbatim', JSON.stringify(raw.mappers.quality.sources) === JSON.stringify(['__tests__/x.test.js']));
    check('apply-merge: concerns.sources preserved verbatim', JSON.stringify(raw.mappers.concerns.sources) === JSON.stringify(['docs/SEC.md']));
    check('apply-merge: fileTreeSignature preserved verbatim', raw.fileTreeSignature && raw.fileTreeSignature.hash === 'preserved-hash');
    check('apply-merge: scannedAt advanced past 2026-06-10', new Date(raw.scannedAt).getTime() > new Date('2026-06-10T00:00:00.000Z').getTime());
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 11. applyRefreshEntries: missing _tags.json → error ---
{
  const { projectDir, tmpRoot } = makeTempProject('apply-no-tags');
  try {
    const r = applyRefreshEntries(projectDir, { architecture: { sources: ['x'] } });
    check('apply-no-tags: ok=false', r.ok === false && /run \/ovd-workflow map/.test(r.reason));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 12. applyRefreshEntries: corrupt _tags.json → error ---
{
  const { projectDir, tmpRoot } = makeTempProject('apply-corrupt');
  try {
    fs.writeFileSync(tagsPath(projectDir), '{not valid json');
    const r = applyRefreshEntries(projectDir, { architecture: { sources: [] } });
    check('apply-corrupt: ok=false', r.ok === false && /could not be parsed/i.test(r.reason));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 13. runRefreshMap: plan mode, explicit mappers ---
{
  const { projectDir, tmpRoot } = makeTempProject('run-plan-explicit');
  try {
    writeTags(projectDir);
    const r = runRefreshMap(projectDir, { mappers: ['architecture', 'concerns'] });
    check('run-plan-explicit: ok=true', r.ok === true);
    check('run-plan-explicit: status=refresh', r.status === 'refresh');
    check('run-plan-explicit: mode=plan', r.mode === 'plan');
    check('run-plan-explicit: 2 mappers needRefresh', r.needsRefresh.length === 2);
    check('run-plan-explicit: 3 skipped', r.skipped.length === 3);
    check('run-plan-explicit: text mentions architecture + concerns', /\[architecture\]/.test(r.text) && /\[concerns\]/.test(r.text));
    check('run-plan-explicit: text shows skipped', /Skipped/.test(r.text));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 14. runRefreshMap: plan mode, changedPaths → drift ---
{
  const { projectDir, tmpRoot } = makeTempProject('run-plan-changed');
  try {
    fs.mkdirSync(path.join(projectDir, 'lib'));
    const sig = driftDetector.computeFileTreeSignature(projectDir);
    writeTags(projectDir, {
      fileTreeSignature: sig,
      mappers: {
        architecture: { file: 'architecture.md', sources: ['lib/installer.js'] },
        patterns: { file: 'patterns.md', sources: ['scripts/x.js'] },
        techStack: { file: 'tech-stack.md', sources: ['package.json'] },
        quality: { file: 'quality.md', sources: ['__tests__/x.test.js'] },
        concerns: { file: 'concerns.md', sources: ['docs/SEC.md'] }
      }
    });
    const r = runRefreshMap(projectDir, { changedPaths: ['lib/installer.js'] });
    check('run-plan-changed: 1 mapper flagged', r.needsRefresh.length === 1 && r.needsRefresh[0] === 'architecture');
    check('run-plan-changed: 4 skipped', r.skipped.length === 4);
    check('run-plan-changed: determination.source=drift', r.determination && r.determination.source === 'drift');
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 15. runRefreshMap: plan mode, empty needsRefresh → no-op plan ---
{
  const { projectDir, tmpRoot } = makeTempProject('run-plan-noop');
  try {
    fs.mkdirSync(path.join(projectDir, 'lib'));
    const sig = driftDetector.computeFileTreeSignature(projectDir);
    writeTags(projectDir, { fileTreeSignature: sig });
    const r = runRefreshMap(projectDir, { changedPaths: [] });
    check('run-plan-noop: ok=true', r.ok === true);
    check('run-plan-noop: needsRefresh empty', r.needsRefresh.length === 0);
    check('run-plan-noop: skipped is all 5', r.skipped.length === 5);
    check('run-plan-noop: summary mentions nothing flagged', /nothing flagged/i.test(r.summary));
    check('run-plan-noop: plan exists with empty mappers + instructions present', r.plan && r.plan.mappers.length === 0 && r.plan.instructions.length >= 2);
    check('run-plan-noop: text mentions current', /current/i.test(r.text));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 16. runRefreshMap: plan mode, both mappers + changedPaths → error ---
{
  const { projectDir, tmpRoot } = makeTempProject('run-plan-conflict');
  try {
    writeTags(projectDir);
    const r = runRefreshMap(projectDir, { mappers: ['architecture'], changedPaths: ['lib/foo.js'] });
    check('run-plan-conflict: ok=false', r.ok === false);
    check('run-plan-conflict: reason mentions either/or', /either.*or/i.test(r.reason));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 17. runRefreshMap: plan mode, unknown mapper key → error ---
{
  const { projectDir, tmpRoot } = makeTempProject('run-plan-bad-key');
  try {
    writeTags(projectDir);
    const r = runRefreshMap(projectDir, { mappers: ['bogus'] });
    check('run-plan-bad-key: ok=false', r.ok === false);
    check('run-plan-bad-key: reason names bogus', /bogus/.test(r.reason));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 18. runRefreshMap: null rootDir ---
{
  const r = runRefreshMap(null, {});
  check('run-null: ok=false', r.ok === false);
  check('run-null: status=refresh', r.status === 'refresh');
  check('run-null: text non-empty', typeof r.text === 'string' && r.text.length > 0);
}

// --- 19. runRefreshMap: commit mode, merge semantics ---
{
  const { projectDir, tmpRoot } = makeTempProject('run-commit-merge');
  try {
    writeTags(projectDir, {
      fileTreeSignature: { algorithm: 'sha1', hash: 'must-survive', entries: ['lib'] },
      mappers: {
        architecture: { file: 'architecture.md', sources: ['lib/old.js'] },
        patterns: { file: 'patterns.md', sources: ['lib/pat.js'] },
        techStack: { file: 'tech-stack.md', sources: ['package.json'] },
        quality: { file: 'quality.md', sources: [] },
        concerns: { file: 'concerns.md', sources: ['docs/SEC.md'] }
      }
    });
    const r = runRefreshMap(projectDir, {
      mode: 'commit',
      entries: { architecture: { sources: ['lib/new.js'] } }
    });
    check('run-commit-merge: ok=true', r.ok === true);
    check('run-commit-merge: mode=commit', r.mode === 'commit');
    check('run-commit-merge: refreshedKeys=[architecture]', JSON.stringify(r.refreshedKeys) === JSON.stringify(['architecture']));
    check('run-commit-merge: summary mentions 1 mapper updated', /1 mapper\(s\) updated/.test(r.summary));

    const raw = JSON.parse(fs.readFileSync(tagsPath(projectDir), 'utf8'));
    check('run-commit-merge: architecture refreshed', JSON.stringify(raw.mappers.architecture.sources) === JSON.stringify(['lib/new.js']));
    check('run-commit-merge: patterns preserved verbatim', JSON.stringify(raw.mappers.patterns.sources) === JSON.stringify(['lib/pat.js']));
    check('run-commit-merge: concerns preserved verbatim', JSON.stringify(raw.mappers.concerns.sources) === JSON.stringify(['docs/SEC.md']));
    check('run-commit-merge: fileTreeSignature preserved verbatim', raw.fileTreeSignature && raw.fileTreeSignature.hash === 'must-survive');
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 20. runRefreshMap: commit mode rejects bad entries ---
{
  const { projectDir, tmpRoot } = makeTempProject('run-commit-bad');
  try {
    writeTags(projectDir);
    const r = runRefreshMap(projectDir, { mode: 'commit', entries: 'not an object' });
    check('run-commit-bad: ok=false', r.ok === false);
    check('run-commit-bad: reason mentions object', /must be an object/.test(r.reason));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 21. runRefreshMap: commit without _tags.json → error ---
{
  const { projectDir, tmpRoot } = makeTempProject('run-commit-no-tags');
  try {
    const r = runRefreshMap(projectDir, { mode: 'commit', entries: { architecture: { sources: [] } } });
    check('run-commit-no-tags: ok=false', r.ok === false);
    check('run-commit-no-tags: reason mentions run /ovd-workflow map', /run \/ovd-workflow map/i.test(r.reason));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 22. Dispatch routing via index.js ---
{
  const ovdPlan = require('../lib/ovd-plan');
  const { projectDir, tmpRoot } = makeTempProject('dispatch-plan-explicit');
  try {
    writeTags(projectDir);
    const r = ovdPlan.runWorkflow({
      projectDir,
      subcommand: 'refresh',
      entriesJson: JSON.stringify({ mappers: ['architecture'] })
    }, process.env);
    check('dispatch(refresh plan-explicit): status=refresh', r.status === 'refresh');
    check('dispatch(refresh plan-explicit): needsRefresh=[architecture]', r.needsRefresh.length === 1 && r.needsRefresh[0] === 'architecture');
  } finally {
    cleanup(tmpRoot);
  }
}
{
  const ovdPlan = require('../lib/ovd-plan');
  const { projectDir, tmpRoot } = makeTempProject('dispatch-plan-default');
  try {
    fs.mkdirSync(path.join(projectDir, 'lib'));
    const sig = driftDetector.computeFileTreeSignature(projectDir);
    writeTags(projectDir, { fileTreeSignature: sig });
    // No entriesJson → drift with empty changedPaths → clean state
    const r = ovdPlan.runWorkflow({ projectDir, subcommand: 'refresh' }, process.env);
    check('dispatch(refresh default): ok=true', r.ok === true);
    check('dispatch(refresh default): needsRefresh empty', r.needsRefresh.length === 0);
  } finally {
    cleanup(tmpRoot);
  }
}
{
  const ovdPlan = require('../lib/ovd-plan');
  const { projectDir, tmpRoot } = makeTempProject('dispatch-commit');
  try {
    writeTags(projectDir, {
      mappers: {
        architecture: { file: 'architecture.md', sources: ['lib/old.js'] },
        patterns: { file: 'patterns.md', sources: ['lib/pat.js'] },
        techStack: { file: 'tech-stack.md', sources: ['package.json'] },
        quality: { file: 'quality.md', sources: [] },
        concerns: { file: 'concerns.md', sources: ['docs/SEC.md'] }
      }
    });
    const r = ovdPlan.runWorkflow({
      projectDir,
      subcommand: 'refresh',
      step: 'commit',
      entriesJson: JSON.stringify({ architecture: { sources: ['lib/new.js'] } })
    }, process.env);
    check('dispatch(refresh commit): ok=true', r.ok === true);
    check('dispatch(refresh commit): mode=commit', r.mode === 'commit');
    const raw = JSON.parse(fs.readFileSync(tagsPath(projectDir), 'utf8'));
    check('dispatch(refresh commit): architecture refreshed', JSON.stringify(raw.mappers.architecture.sources) === JSON.stringify(['lib/new.js']));
    check('dispatch(refresh commit): patterns preserved', JSON.stringify(raw.mappers.patterns.sources) === JSON.stringify(['lib/pat.js']));
  } finally {
    cleanup(tmpRoot);
  }
}
{
  const ovdPlan = require('../lib/ovd-plan');
  const { projectDir, tmpRoot } = makeTempProject('dispatch-bad-json');
  try {
    const r = ovdPlan.runWorkflow({
      projectDir,
      subcommand: 'refresh',
      entriesJson: '{not valid json'
    }, process.env);
    check('dispatch(refresh bad JSON): ok=false', r.ok === false);
    check('dispatch(refresh bad JSON): status=refresh', r.status === 'refresh');
    check('dispatch(refresh bad JSON): text mentions Invalid --entries-json', /Invalid --entries-json/.test(r.text));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 23. End-to-end roundtrip: map → refresh plan → simulated subagents → refresh commit ---
{
  const { projectDir, tmpRoot } = makeTempProject('roundtrip');
  try {
    fs.mkdirSync(path.join(projectDir, 'lib'));
    // Initial map commit (simulating Task 2.3 having run)
    require('../lib/ovd-plan/codebase-mapper').runCodebaseMap(projectDir, {
      mode: 'commit',
      entries: {
        architecture: { sources: ['lib/installer.js'] },
        patterns: { sources: ['scripts/x.js'] },
        techStack: { sources: ['package.json'] },
        quality: { sources: ['__tests__/x.test.js'] },
        concerns: { sources: ['docs/SEC.md'] }
      }
    });
    // Bootstrap signature via a drift call
    driftDetector.detectDrift(projectDir, { changedPaths: [] });

    // Simulate a subagent having written the architecture.md file with a discovered section
    fs.writeFileSync(mapperPath(projectDir, 'architecture'),
      '# Architecture\n\n## Overview\nOld.\n## Components\nOld.\n## Evidence\n- lib/installer.js:1\n## Risks\nNone.\n\n## Discovered during execution\n- /ovd-go found that lib/installer.js calls into lib/ovd-plan/*.js\n');

    // Refresh plan with explicit architecture
    const plan = runRefreshMap(projectDir, { mappers: ['architecture'] });
    check('roundtrip(plan): architecture in needsRefresh', plan.needsRefresh.includes('architecture'));
    check('roundtrip(plan): prompt embeds preserve-discovered instruction', plan.plan.mappers[0].prompt.includes('Discovered during execution'));

    // Simulate the architecture subagent re-writing architecture.md preserving the discovered section
    fs.writeFileSync(mapperPath(projectDir, 'architecture'),
      '# Architecture\n\n## Overview\nRefreshed.\n## Components\nRefreshed.\n## Evidence\n- lib/installer.js:42-89\n## Risks\nNone.\n\n## Discovered during execution\n- /ovd-go found that lib/installer.js calls into lib/ovd-plan/*.js\n');

    // Refresh commit with only architecture
    const commit = runRefreshMap(projectDir, {
      mode: 'commit',
      entries: { architecture: { sources: ['lib/installer.js', 'lib/foo.js'] } }
    });
    check('roundtrip(commit): ok=true', commit.ok === true);
    check('roundtrip(commit): refreshedKeys=[architecture]', JSON.stringify(commit.refreshedKeys) === JSON.stringify(['architecture']));

    const raw = JSON.parse(fs.readFileSync(tagsPath(projectDir), 'utf8'));
    check('roundtrip: architecture.sources refreshed', JSON.stringify(raw.mappers.architecture.sources) === JSON.stringify(['lib/installer.js', 'lib/foo.js']));
    check('roundtrip: patterns.sources preserved verbatim', JSON.stringify(raw.mappers.patterns.sources) === JSON.stringify(['scripts/x.js']));
    check('roundtrip: techStack.sources preserved verbatim', JSON.stringify(raw.mappers.techStack.sources) === JSON.stringify(['package.json']));
    check('roundtrip: quality.sources preserved verbatim', JSON.stringify(raw.mappers.quality.sources) === JSON.stringify(['__tests__/x.test.js']));
    check('roundtrip: concerns.sources preserved verbatim', JSON.stringify(raw.mappers.concerns.sources) === JSON.stringify(['docs/SEC.md']));
    check('roundtrip: fileTreeSignature preserved across refresh commit', typeof raw.fileTreeSignature === 'object' && raw.fileTreeSignature !== null);

    // The architecture .md file the subagent wrote still has the discovered section
    const archContent = fs.readFileSync(mapperPath(projectDir, 'architecture'), 'utf8');
    check('roundtrip: architecture.md still has Discovered section (subagent-preserved)', /## Discovered during execution/.test(archContent));
    check('roundtrip: architecture.md has refreshed Overview', /Refreshed\./.test(archContent));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 24. Namespace + top-level exports ---
{
  const ovdPlan = require('../lib/ovd-plan');
  check('exports: codebaseRefresh namespace exists', typeof ovdPlan.codebaseRefresh === 'object' && ovdPlan.codebaseRefresh !== null);
  check('exports: runRefreshMap is the same function as namespace', ovdPlan.runRefreshMap === ovdPlan.codebaseRefresh.runRefreshMap);
}

// --- 25. formatPlan / formatCommit outputs ---
{
  const failPlan = formatPlan({ ok: false, reason: 'sample' });
  check('formatPlan: failure path readable', /failed/i.test(failPlan));
  const failCommit = formatCommit({
    ok: true,
    path: '/tmp/x/_tags.json',
    refreshedKeys: ['architecture'],
    totalSources: 0,
    perMapper: MAPPER_KEYS.reduce((acc, k) => { acc[k] = { count: 0, action: 'preserved' }; return acc; }, {}),
    mapperState: MAPPER_KEYS.reduce((acc, k) => { acc[k] = 'missing'; return acc; }, {})
  });
  check('formatCommit: text mentions Mappers refreshed', /Mappers refreshed:/.test(failCommit));
  check('formatCommit: text mentions preserved + scannedAt advanced', /preserved verbatim/.test(failCommit) && /scannedAt advanced/.test(failCommit));
}

// --- summary ---
if (failures.length > 0) {
  console.log(`\n${failures.length} failure(s):`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`\n${passed} checks passed.`);
