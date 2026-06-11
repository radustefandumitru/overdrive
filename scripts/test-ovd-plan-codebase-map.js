#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
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
} = require('../lib/ovd-plan/codebase-mapper');

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
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-map-test-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.mkdirSync(path.join(projectDir, '.overdrive', 'codebase'), { recursive: true });
  return { projectDir, tmpRoot };
}

function cleanup(tmpRoot) {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

console.log('ovd-plan codebase-mapper tests');

// --- 0. Module surface ---
{
  check('MAPPERS has 5 entries', Array.isArray(MAPPERS) && MAPPERS.length === 5);
  check('MAPPER_KEYS matches r3 §4.3', ['architecture', 'patterns', 'techStack', 'quality', 'concerns'].every((k) => MAPPER_KEYS.includes(k)));
  check('MAPPER_HEADERS.architecture = Architecture', MAPPER_HEADERS.architecture === 'Architecture');
  check('MAPPER_HEADERS.techStack = "Tech stack"', MAPPER_HEADERS.techStack === 'Tech stack');
  check('MAPPER_FILENAMES.architecture = architecture.md', MAPPER_FILENAMES.architecture === 'architecture.md');
  check('MAPPER_FILENAMES.techStack = tech-stack.md (hyphenated)', MAPPER_FILENAMES.techStack === 'tech-stack.md');
  check('MAPPER_FILENAMES.concerns = concerns.md', MAPPER_FILENAMES.concerns === 'concerns.md');
  check('CODEBASE_DIR_NAME = codebase', CODEBASE_DIR_NAME === 'codebase');
  check('TAGS_FILENAME = _tags.json', TAGS_FILENAME === '_tags.json');
  check('every mapper has key + header + filename + focus + prompt', MAPPERS.every((m) =>
    typeof m.key === 'string' &&
    typeof m.header === 'string' &&
    typeof m.filename === 'string' && /\.md$/.test(m.filename) &&
    typeof m.focus === 'string' && m.focus.length > 0 &&
    typeof m.prompt === 'string' && m.prompt.length > 200));
  check('every mapper prompt mentions Overview / Components / Evidence / Risks', MAPPERS.every((m) =>
    /## Overview/.test(m.prompt) &&
    /## Components/.test(m.prompt) &&
    /## Evidence/.test(m.prompt) &&
    /## Risks/.test(m.prompt)));
  check('every mapper prompt mentions Insufficient evidence (sparse handling)', MAPPERS.every((m) => /## Insufficient evidence/.test(m.prompt)));
  check('every mapper prompt mentions the commit payload key', MAPPERS.every((m) => m.prompt.includes(`\`${m.key}.sources\``)));
}

// --- 1. Path helpers ---
{
  check('codebaseDir: ends with .overdrive/codebase', /\.overdrive[\\/]+codebase$/.test(codebaseDir('/tmp/x')));
  check('tagsPath: ends with .overdrive/codebase/_tags.json', /\.overdrive[\\/]+codebase[\\/]+_tags\.json$/.test(tagsPath('/tmp/x')));
  check('mapperPath(architecture) ends with architecture.md', /\.overdrive[\\/]+codebase[\\/]+architecture\.md$/.test(mapperPath('/tmp/x', 'architecture')));
  check('mapperPath(techStack) uses hyphenated tech-stack.md', /\.overdrive[\\/]+codebase[\\/]+tech-stack\.md$/.test(mapperPath('/tmp/x', 'techStack')));
  check('mapperPath(unknown) returns null', mapperPath('/tmp/x', 'bogus') === null);
}

// --- 2. detectMapperState ---
{
  const { projectDir, tmpRoot } = makeTempProject('detect-empty');
  try {
    const state = detectMapperState(projectDir);
    check('detectMapperState: all missing when codebase/ is empty', MAPPER_KEYS.every((k) => state[k] === 'missing'));
  } finally {
    cleanup(tmpRoot);
  }
}
{
  const { projectDir, tmpRoot } = makeTempProject('detect-populated');
  try {
    fs.writeFileSync(path.join(projectDir, '.overdrive', 'codebase', 'architecture.md'), '# Architecture\n\n## Overview\n\nSomething here.\n');
    fs.writeFileSync(path.join(projectDir, '.overdrive', 'codebase', 'patterns.md'), '# Patterns\n');
    fs.writeFileSync(path.join(projectDir, '.overdrive', 'codebase', 'concerns.md'), '# Concerns\n\n## Insufficient evidence\n\nTiny project; nothing to report.\n');
    const state = detectMapperState(projectDir);
    check('detectMapperState: architecture=populated when sections exist', state.architecture === 'populated');
    check('detectMapperState: patterns=placeholder when only heading', state.patterns === 'placeholder');
    check('detectMapperState: techStack=missing when file absent', state.techStack === 'missing');
    check('detectMapperState: concerns=insufficient-evidence', state.concerns === 'insufficient-evidence');
    check('detectMapperState: quality=missing when file absent', state.quality === 'missing');
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 3. buildPlan: shape ---
{
  const { projectDir, tmpRoot } = makeTempProject('plan-fresh');
  try {
    const plan = buildPlan(projectDir);
    check('plan: mode=plan', plan.mode === 'plan');
    check('plan: dir ends with codebase', /codebase$/.test(plan.dir));
    check('plan: tagsPath ends with _tags.json', /_tags\.json$/.test(plan.tagsPath));
    check('plan: tagsExist=false on fresh project', plan.tagsExist === false);
    check('plan: 5 mappers', plan.mappers.length === 5);
    check('plan: every mapper has key/header/filename/path/focus/prompt/currentState', plan.mappers.every((m) =>
      typeof m.key === 'string' &&
      typeof m.header === 'string' &&
      typeof m.filename === 'string' &&
      typeof m.path === 'string' &&
      typeof m.focus === 'string' &&
      typeof m.prompt === 'string' &&
      typeof m.currentState === 'string'));
    check('plan: every mapper currentState=missing on fresh project', plan.mappers.every((m) => m.currentState === 'missing'));
    check('plan: instructions array non-empty', Array.isArray(plan.instructions) && plan.instructions.length >= 4);
    check('plan: instructions mention parallel dispatch via task tool', plan.instructions.some((l) => /parallel/i.test(l) && /task tool/i.test(l)));
    check('plan: instructions mention commit --entries-json', plan.instructions.some((l) => /commit\b.*--entries-json/.test(l)));
    check('plan: instructions mention drift detection (Task 2.7)', plan.instructions.some((l) => /Task 2\.7/.test(l)));
    check('plan: instructions mention re-run semantics (full overwrite)', plan.instructions.some((l) => /overwrite/i.test(l) || /full re-run/i.test(l)));
  } finally {
    cleanup(tmpRoot);
  }
}
{
  const { projectDir, tmpRoot } = makeTempProject('plan-with-tags');
  try {
    const codebase = path.join(projectDir, '.overdrive', 'codebase');
    fs.writeFileSync(path.join(codebase, '_tags.json'), JSON.stringify({ scannedAt: '2026-06-10T00:00:00.000Z', mappers: { architecture: { file: 'architecture.md', sources: ['src/a.js'] } } }));
    const plan = buildPlan(projectDir);
    check('plan-with-tags: tagsExist=true when _tags.json present', plan.tagsExist === true);
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 4. normalizeEntries: happy path ---
{
  const result = normalizeEntries({
    architecture: { sources: ['src/a.js', 'src/b.js'] },
    patterns: { sources: ['src/c.js'] },
    techStack: { sources: ['package.json'] },
    quality: { sources: ['__tests__/x.test.js'] },
    concerns: { sources: [] }
  });
  check('normalize(happy): ok=true', result.ok === true);
  check('normalize(happy): architecture.sources length 2', result.normalized.architecture.sources.length === 2);
  check('normalize(happy): patterns.sources length 1', result.normalized.patterns.sources.length === 1);
  check('normalize(happy): concerns.sources empty', result.normalized.concerns.sources.length === 0);
  check('normalize(happy): unknownCategories empty', result.unknownCategories.length === 0);
}

// --- 5. normalizeEntries: tolerance ---
{
  const r = normalizeEntries({
    architecture: { sources: 'src/a.js' }, // string promotes to single-item array
    patterns: { sources: ['  src/c.js  ', '', '  '] } // trim + filter empties
  });
  check('normalize(tolerance): string sources promoted to single-item array', r.ok === true && r.normalized.architecture.sources.length === 1 && r.normalized.architecture.sources[0] === 'src/a.js');
  check('normalize(tolerance): whitespace trimmed + empty filtered', r.normalized.patterns.sources.length === 1 && r.normalized.patterns.sources[0] === 'src/c.js');
  check('normalize(tolerance): missing keys default to empty sources', r.normalized.techStack.sources.length === 0 && r.normalized.quality.sources.length === 0);
}
{
  const r = normalizeEntries({
    architecture: { sources: null },
    patterns: null
  });
  check('normalize(null mapper): becomes empty sources', r.ok === true && r.normalized.architecture.sources.length === 0 && r.normalized.patterns.sources.length === 0);
}

// --- 6. normalizeEntries: validation errors ---
{
  check('normalize(null): ok=false', normalizeEntries(null).ok === false);
  check('normalize(undefined): ok=false', normalizeEntries(undefined).ok === false);
  check('normalize(array): ok=false', normalizeEntries(['x']).ok === false);
  check('normalize(string): ok=false', normalizeEntries('x').ok === false);

  const r1 = normalizeEntries({ architecture: 'not an object' });
  check('normalize(non-object mapper value): ok=false', r1.ok === false && /must be an object/.test(r1.reason));

  const r2 = normalizeEntries({ architecture: { sources: [123, 'src/a.js'] } });
  check('normalize(non-string source): ok=false', r2.ok === false && /must be strings/.test(r2.reason));

  const r3 = normalizeEntries({ architecture: { sources: 42 } });
  check('normalize(numeric sources): ok=false', r3.ok === false);

  const r4 = normalizeEntries({ bogus: { sources: ['x'] }, architecture: { sources: ['y'] } });
  check('normalize(unknown mapper key): recorded but not failing', r4.ok === true && r4.unknownCategories.includes('bogus') && r4.normalized.architecture.sources[0] === 'y');
}

// --- 7. applyEntries: writes _tags.json with correct shape ---
{
  const { projectDir, tmpRoot } = makeTempProject('apply-fresh');
  try {
    const writeResult = applyEntries(projectDir, {
      architecture: { sources: ['lib/a.js'] },
      patterns: { sources: ['lib/b.js'] },
      techStack: { sources: ['package.json'] },
      quality: { sources: [] },
      concerns: { sources: ['lib/c.js'] }
    });
    check('apply: path is _tags.json', /_tags\.json$/.test(writeResult.path));
    check('apply: file written', fs.existsSync(writeResult.path));
    check('apply: totalSources counts non-empty sources', writeResult.totalSources === 4);
    const raw = JSON.parse(fs.readFileSync(writeResult.path, 'utf8'));
    check('apply: scannedAt is ISO string', typeof raw.scannedAt === 'string' && /\d{4}-\d{2}-\d{2}T/.test(raw.scannedAt));
    check('apply: mappers.architecture.sources matches input', JSON.stringify(raw.mappers.architecture.sources) === JSON.stringify(['lib/a.js']));
    check('apply: mappers.architecture.file = architecture.md', raw.mappers.architecture.file === 'architecture.md');
    check('apply: mappers.techStack.file = tech-stack.md', raw.mappers.techStack.file === 'tech-stack.md');
    check('apply: mappers.quality.sources is empty array', Array.isArray(raw.mappers.quality.sources) && raw.mappers.quality.sources.length === 0);
    check('apply: every mapper key present even if not in input', MAPPER_KEYS.every((k) => raw.mappers[k] && Array.isArray(raw.mappers[k].sources)));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 8. applyEntries: overwrites prior tags (always-re-run semantics) ---
{
  const { projectDir, tmpRoot } = makeTempProject('apply-overwrite');
  try {
    fs.writeFileSync(tagsPath(projectDir), JSON.stringify({ scannedAt: '2020-01-01T00:00:00.000Z', mappers: { architecture: { file: 'architecture.md', sources: ['stale.js'] } } }));
    applyEntries(projectDir, { architecture: { sources: ['fresh.js'] } });
    const raw = JSON.parse(fs.readFileSync(tagsPath(projectDir), 'utf8'));
    check('apply(overwrite): stale sources replaced', JSON.stringify(raw.mappers.architecture.sources) === JSON.stringify(['fresh.js']));
    check('apply(overwrite): scannedAt advanced past stale timestamp', new Date(raw.scannedAt).getTime() > new Date('2020-01-01').getTime());
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 9. runCodebaseMap: plan mode ---
{
  const { projectDir, tmpRoot } = makeTempProject('run-plan');
  try {
    const r = runCodebaseMap(projectDir, {});
    check('run plan: ok=true', r.ok === true);
    check('run plan: status=codebase-map', r.status === 'codebase-map');
    check('run plan: mode=plan', r.mode === 'plan');
    check('run plan: no stub flag', r.stub !== true);
    check('run plan: plan present', r.plan && Array.isArray(r.plan.mappers) && r.plan.mappers.length === 5);
    check('run plan: summary mentions 5 mappers', /5 mappers/.test(r.summary));
    check('run plan: text starts with command label', /Overdrive.*\/ovd-workflow map \(plan\)/.test(r.text));
    check('run plan: text lists all 5 mapper keys', MAPPER_KEYS.every((k) => r.text.includes(`[${k}]`)));
    check('run plan: text includes commit example', /map commit --entries-json/.test(r.text));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 10. runCodebaseMap: commit mode ---
{
  const { projectDir, tmpRoot } = makeTempProject('run-commit');
  try {
    // Pre-create a couple mapper files so the missing-files warning doesn't fire.
    const codebase = path.join(projectDir, '.overdrive', 'codebase');
    for (const m of MAPPERS) {
      fs.writeFileSync(path.join(codebase, m.filename), `# ${m.header}\n\n## Overview\nlive content\n`);
    }
    const r = runCodebaseMap(projectDir, {
      mode: 'commit',
      entries: {
        architecture: { sources: ['lib/a.js'] },
        patterns: { sources: ['lib/b.js'] },
        techStack: { sources: ['package.json'] },
        quality: { sources: ['__tests__/x.test.js'] },
        concerns: { sources: ['lib/c.js'] }
      }
    });
    check('run commit: ok=true', r.ok === true);
    check('run commit: status=codebase-map', r.status === 'codebase-map');
    check('run commit: mode=commit', r.mode === 'commit');
    check('run commit: path points to _tags.json', /_tags\.json$/.test(r.path));
    check('run commit: totalSources=5', r.totalSources === 5);
    check('run commit: perMapper has every key', MAPPER_KEYS.every((k) => typeof r.perMapper[k] === 'number'));
    check('run commit: mapperState has every key', MAPPER_KEYS.every((k) => typeof r.mapperState[k] === 'string'));
    check('run commit: missingFiles empty when files pre-created', r.missingFiles.length === 0);
    check('run commit: summary mentions 5 source paths', /5 source paths/.test(r.summary));
    check('run commit: text mentions tags file', r.text.includes('Tags file:'));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 11. runCodebaseMap: commit mode warns when mapper files missing ---
{
  const { projectDir, tmpRoot } = makeTempProject('run-commit-missing');
  try {
    // Only architecture.md exists; the others should show up in missingFiles.
    fs.writeFileSync(mapperPath(projectDir, 'architecture'), '# Architecture\n\n## Overview\nfoo\n');
    const r = runCodebaseMap(projectDir, {
      mode: 'commit',
      entries: { architecture: { sources: ['lib/a.js'] } }
    });
    check('commit-missing: ok=true (warning, not failure)', r.ok === true);
    check('commit-missing: missingFiles lists the 4 absent files', r.missingFiles.length === 4 && r.missingFiles.includes('patterns.md') && r.missingFiles.includes('tech-stack.md') && r.missingFiles.includes('quality.md') && r.missingFiles.includes('concerns.md'));
    check('commit-missing: text contains WARNING', /WARNING/.test(r.text));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 12. runCodebaseMap: commit mode with malformed entries ---
{
  const { projectDir, tmpRoot } = makeTempProject('run-commit-bad');
  try {
    const r = runCodebaseMap(projectDir, { mode: 'commit', entries: 'not an object' });
    check('commit-bad: ok=false', r.ok === false);
    check('commit-bad: status=codebase-map', r.status === 'codebase-map');
    check('commit-bad: reason mentions object', /must be an object/.test(r.reason));
    check('commit-bad: text starts with "Could not record"', /Could not record codebase tags:/.test(r.text));
    check('commit-bad: no _tags.json written', !fs.existsSync(tagsPath(projectDir)));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 13. runCodebaseMap: null rootDir ---
{
  const r = runCodebaseMap(null, {});
  check('null rootDir: ok=false', r.ok === false);
  check('null rootDir: status=codebase-map', r.status === 'codebase-map');
  check('null rootDir: text non-empty', typeof r.text === 'string' && r.text.length > 0);
}

// --- 14. Dispatch routing: subcommand=map → runCodebaseMap (plan) ---
{
  const ovdPlan = require('../lib/ovd-plan');
  const { projectDir, tmpRoot } = makeTempProject('dispatch-plan');
  try {
    const r = ovdPlan.runWorkflow({ projectDir, subcommand: 'map' }, process.env);
    check('dispatch(map plan): status=codebase-map', r.status === 'codebase-map');
    check('dispatch(map plan): mode=plan', r.mode === 'plan');
    check('dispatch(map plan): plan has 5 mappers', r.plan.mappers.length === 5);
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 15. Dispatch routing: subcommand=map + --entries-json → commit ---
{
  const ovdPlan = require('../lib/ovd-plan');
  const { projectDir, tmpRoot } = makeTempProject('dispatch-commit');
  try {
    const json = JSON.stringify({
      architecture: { sources: ['lib/a.js'] },
      patterns: { sources: ['lib/b.js'] }
    });
    const r = ovdPlan.runWorkflow({ projectDir, subcommand: 'map', entriesJson: json }, process.env);
    check('dispatch(map commit): status=codebase-map', r.status === 'codebase-map');
    check('dispatch(map commit): mode=commit', r.mode === 'commit');
    check('dispatch(map commit): ok=true', r.ok === true);
    check('dispatch(map commit): _tags.json was written', fs.existsSync(tagsPath(projectDir)));
    const raw = readTagsFile(projectDir);
    check('dispatch(map commit): persisted sources', raw.mappers.architecture.sources[0] === 'lib/a.js' && raw.mappers.patterns.sources[0] === 'lib/b.js');
    check('dispatch(map commit): missing keys defaulted to empty arrays', raw.mappers.techStack.sources.length === 0 && raw.mappers.quality.sources.length === 0 && raw.mappers.concerns.sources.length === 0);
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 16. Dispatch routing: malformed --entries-json → JSON parse guard ---
{
  const ovdPlan = require('../lib/ovd-plan');
  const { projectDir, tmpRoot } = makeTempProject('dispatch-bad-json');
  try {
    const r = ovdPlan.runWorkflow({ projectDir, subcommand: 'map', entriesJson: '{not valid json' }, process.env);
    check('dispatch(map bad-json): ok=false', r.ok === false);
    check('dispatch(map bad-json): status=codebase-map', r.status === 'codebase-map');
    check('dispatch(map bad-json): text mentions Invalid --entries-json', /Invalid --entries-json/.test(r.text));
    check('dispatch(map bad-json): no _tags.json written', !fs.existsSync(tagsPath(projectDir)));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 17. Dispatch routing: step=commit positional with empty entries works ---
{
  const ovdPlan = require('../lib/ovd-plan');
  const { projectDir, tmpRoot } = makeTempProject('dispatch-step-commit');
  try {
    const r = ovdPlan.runWorkflow({ projectDir, subcommand: 'map', step: 'commit' }, process.env);
    check('dispatch(map step=commit, no entries): ok=false (null entries fails normalize)', r.ok === false);
    check('dispatch(map step=commit, no entries): mode=commit', r.mode === 'commit');
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 18. Namespace + top-level exports ---
{
  const ovdPlan = require('../lib/ovd-plan');
  check('exports: codebaseMapper namespace exists', typeof ovdPlan.codebaseMapper === 'object' && ovdPlan.codebaseMapper !== null);
  check('exports: runCodebaseMap is the same function as namespace', ovdPlan.runCodebaseMap === ovdPlan.codebaseMapper.runCodebaseMap);
  check('exports: codebaseMapper.MAPPERS matches direct import', ovdPlan.codebaseMapper.MAPPERS === MAPPERS);
}

// --- 19. formatPlan / formatCommit output shape ---
{
  const { projectDir, tmpRoot } = makeTempProject('format');
  try {
    const planText = formatPlan({ plan: buildPlan(projectDir) });
    check('formatPlan: starts with command label', /Overdrive.*\(plan\)/.test(planText));
    check('formatPlan: lists every mapper', MAPPER_KEYS.every((k) => planText.includes(`[${k}]`)));
    check('formatPlan: shows directory + tags file lines', /Directory:/.test(planText) && /Tags file:/.test(planText));

    const commitText = formatCommit({
      path: tagsPath(projectDir),
      totalSources: 3,
      perMapper: { architecture: 2, patterns: 1, techStack: 0, quality: 0, concerns: 0 },
      mapperState: { architecture: 'populated', patterns: 'placeholder', techStack: 'missing', quality: 'missing', concerns: 'missing' },
      missingFiles: ['tech-stack.md', 'quality.md', 'concerns.md'],
      unknownCategories: []
    });
    check('formatCommit: starts with command label', /Overdrive.*\(commit\)/.test(commitText));
    check('formatCommit: shows per-mapper counts', /architecture: 2 source\(s\)/.test(commitText));
    check('formatCommit: shows mapper state on each line', /file populated/.test(commitText));
    check('formatCommit: WARNING shown when missing files present', /WARNING/.test(commitText));
    check('formatCommit: mentions Task 2.7', /Task 2\.7/.test(commitText));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 20. End-to-end roundtrip: plan → simulate subagent writes → commit ---
{
  const { projectDir, tmpRoot } = makeTempProject('roundtrip');
  try {
    // Plan emission first
    const plan = runCodebaseMap(projectDir, {});
    check('roundtrip(plan): mappers all currentState=missing initially', plan.plan.mappers.every((m) => m.currentState === 'missing'));

    // Simulate 5 subagents writing their files (what the host agent does after dispatch)
    fs.writeFileSync(mapperPath(projectDir, 'architecture'), '# Architecture\n\n## Overview\nA CLI tool.\n## Components\n- bin/overdrive.js\n## Evidence\n- bin/overdrive.js:1-5 — entry point\n## Risks\n- None observed.\n');
    fs.writeFileSync(mapperPath(projectDir, 'patterns'), '# Patterns\n\n## Insufficient evidence\nTiny project; only one file in the source tree.\n');
    fs.writeFileSync(mapperPath(projectDir, 'techStack'), '# Tech stack\n\n## Overview\nNode.js CLI.\n## Components\n- node\n## Evidence\n- package.json:1-3 — name only\n## Risks\n- None.\n');
    fs.writeFileSync(mapperPath(projectDir, 'quality'), '# Quality\n\n## Insufficient evidence\nNo tests yet.\n');
    fs.writeFileSync(mapperPath(projectDir, 'concerns'), '# Concerns\n\n## Insufficient evidence\nProject too small.\n');

    // Commit
    const commit = runCodebaseMap(projectDir, {
      mode: 'commit',
      entries: {
        architecture: { sources: ['bin/overdrive.js'] },
        patterns: { sources: ['bin/overdrive.js'] },
        techStack: { sources: ['package.json'] },
        quality: { sources: [] },
        concerns: { sources: [] }
      }
    });
    check('roundtrip(commit): ok=true', commit.ok === true);
    check('roundtrip(commit): no missing files (all simulated)', commit.missingFiles.length === 0);
    check('roundtrip(commit): mapperState.architecture=populated', commit.mapperState.architecture === 'populated');
    check('roundtrip(commit): mapperState.patterns=insufficient-evidence', commit.mapperState.patterns === 'insufficient-evidence');
    check('roundtrip(commit): mapperState.quality=insufficient-evidence', commit.mapperState.quality === 'insufficient-evidence');

    // Re-plan: previously populated should now show up
    const replan = runCodebaseMap(projectDir, {});
    const replanState = replan.plan.mappers.reduce((acc, m) => { acc[m.key] = m.currentState; return acc; }, {});
    check('roundtrip(replan): architecture=populated', replanState.architecture === 'populated');
    check('roundtrip(replan): patterns=insufficient-evidence', replanState.patterns === 'insufficient-evidence');
    check('roundtrip(replan): tagsExist=true', replan.plan.tagsExist === true);
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 21. Migration-compat: pre-existing user-written codebase/*.md is not deleted by commit ---
{
  const { projectDir, tmpRoot } = makeTempProject('migration-compat');
  try {
    // Simulate a user (or prior migration) having written architecture.md by hand.
    const archPath = mapperPath(projectDir, 'architecture');
    const userContent = '# Architecture\n\n## Overview\nUser-written notes that must survive a map commit.\n';
    fs.writeFileSync(archPath, userContent);
    runCodebaseMap(projectDir, {
      mode: 'commit',
      entries: { architecture: { sources: ['lib/a.js'] } }
    });
    const after = fs.readFileSync(archPath, 'utf8');
    check('migration-compat: existing architecture.md preserved verbatim (commit only writes _tags.json)', after === userContent);
    check('migration-compat: _tags.json written alongside', fs.existsSync(tagsPath(projectDir)));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 22. readTagsFile: nominal + corrupt JSON ---
{
  const { projectDir, tmpRoot } = makeTempProject('read-tags');
  try {
    check('readTagsFile: null when absent', readTagsFile(projectDir) === null);
    fs.writeFileSync(tagsPath(projectDir), '{ this is not valid json');
    check('readTagsFile: null on corrupt JSON (no throw)', readTagsFile(projectDir) === null);
    fs.writeFileSync(tagsPath(projectDir), JSON.stringify({ scannedAt: 'x', mappers: {} }));
    const parsed = readTagsFile(projectDir);
    check('readTagsFile: returns parsed object', parsed && parsed.scannedAt === 'x');
  } finally {
    cleanup(tmpRoot);
  }
}

// --- summary ---
if (failures.length > 0) {
  console.log(`\n${failures.length} failure(s):`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`\n${passed} checks passed.`);
