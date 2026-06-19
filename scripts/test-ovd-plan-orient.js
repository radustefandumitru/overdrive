#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const orient = require('../lib/ovd-plan/orient');
const {
  STATUS,
  SESSIONS_REL,
  HANDOFFS_REL,
  findLatestFile,
  extractCaptureSummary,
  readLatestCapture,
  findActiveMilestone,
  activeScopeFiles,
  renderOrientActionPaths,
  buildOrientation,
  runGoDefault
} = orient;

const ovdPlan = require('../lib/ovd-plan');
const { parseOverdriveMd } = require('../lib/ovd-plan/parser');

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
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-orient-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
  return { projectDir, tmpRoot };
}
function cleanup(tmpRoot) { fs.rmSync(tmpRoot, { recursive: true, force: true }); }
function writePlan(projectDir, content) { fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), content); }
function seedCapture(projectDir, rel, name, content) {
  const dir = path.join(projectDir, rel);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), content);
}

const FENCE = '```yaml ovd-plan';
const FRONT = '---\novd-plan: true\nversion: 3\nproject: "Test Project"\n---\n\n';

// Positional ids: milestone I (Foundation), milestone II (Dashboard);
// under II → cluster II.1 (Data layer), II.2 (Stats widgets); under II.2 →
// leaf II.2.a. Parser computes ids from position, so the structure (not the
// heading text) must yield II.2.a / II.
const FIXTURE_AWAITING = `${FRONT}# Test Project

## I. Foundation [done]

### I.1 Setup [done]

## II. Dashboard [in-progress]

### II.1 Data layer [done]
### II.2 Stats widgets [in-progress]

#### II.2.a Widget layout design [awaiting-review] ← ACTIVE

${FENCE}
scope:
  in:
    - src/components/Grid.tsx
    - src/styles/grid.css
  out: []
success:
  - renders at 3 breakpoints
\`\`\`
`;

const FIXTURE_IN_PROGRESS = `${FRONT}# Test Project

## I. Foundation [in-progress]

### I.1 Scaffolding [in-progress] ← ACTIVE
`;

const FIXTURE_BLOCKED = `${FRONT}# Test Project

## I. Foundation [in-progress]

### I.1 Auth [blocked] ← ACTIVE
`;

const FIXTURE_PENDING_NO_ACTIVE = `${FRONT}# Test Project

## I. Foundation [pending]
## II. Dashboard [pending]
`;

const FIXTURE_ALL_CLOSED = `${FRONT}# Test Project

## I. Foundation [done]
## II. Dashboard [skipped]
`;

const FIXTURE_EMPTY = `${FRONT}# Test Project\n`;

// Phase-2-migrated layout: frontmatter + root only, no tree.
const FIXTURE_MIGRATION = '---\novd-plan: true\nversion: 3\nproject: "Migrated"\nactive_node: ""\n---\n\n# Migrated\n';

// Malformed annotation YAML (unclosed flow sequence) → parser throws ParseError.
const FIXTURE_BAD = `${FRONT}# Test Project

## I. Foundation [pending]

### I.1 Leaf [pending]

${FENCE}
scope: [unclosed bracket
\`\`\`
`;

// ---------------------------------------------------------------------------
// 1. Module surface
// ---------------------------------------------------------------------------
console.log('Module surface');
check('STATUS === "go"', STATUS === 'go');
check('SESSIONS_REL set', typeof SESSIONS_REL === 'string' && SESSIONS_REL.includes('sessions'));
check('HANDOFFS_REL set', typeof HANDOFFS_REL === 'string' && HANDOFFS_REL.includes('handoffs'));
for (const fn of ['findLatestFile', 'extractCaptureSummary', 'readLatestCapture', 'findActiveMilestone', 'activeScopeFiles', 'renderOrientActionPaths', 'buildOrientation', 'runGoDefault']) {
  check(`${fn} exported`, typeof orient[fn] === 'function');
}
check('ovdPlan.orient namespace', ovdPlan.orient === orient);
check('ovdPlan.runGoDefault wired', ovdPlan.runGoDefault === runGoDefault);

// ---------------------------------------------------------------------------
// 2. findLatestFile
// ---------------------------------------------------------------------------
console.log('findLatestFile');
{
  const { projectDir, tmpRoot } = makeTempProject('latest');
  const dir = path.join(projectDir, '.overdrive', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  check('missing dir → null', findLatestFile(path.join(projectDir, 'nope')) === null);
  fs.writeFileSync(path.join(dir, '2026-01-01-a.md'), 'a');
  // ensure distinct mtimes
  const later = path.join(dir, '2026-02-02-b.md');
  fs.writeFileSync(later, 'b');
  const future = Date.now() / 1000 + 100;
  fs.utimesSync(later, future, future);
  check('returns latest by mtime', findLatestFile(dir) === '2026-02-02-b.md');
  check('pattern filter excludes non-match', findLatestFile(dir, /^2026-01/) === '2026-01-01-a.md');
  check('pattern with no match → null', findLatestFile(dir, /zzz/) === null);
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 3. extractCaptureSummary
// ---------------------------------------------------------------------------
console.log('extractCaptureSummary');
check('non-string → []', Array.isArray(extractCaptureSummary(null)) && extractCaptureSummary(null).length === 0);
check('empty → []', extractCaptureSummary('').length === 0);
check('skips frontmatter', JSON.stringify(extractCaptureSummary('---\nx: 1\n---\nHello\nWorld')) === JSON.stringify(['Hello', 'World']));
check('skips headings + comments', JSON.stringify(extractCaptureSummary('# Title\n<!-- c -->\nBody line')) === JSON.stringify(['Body line']));
check('strips bullet markers', extractCaptureSummary('- first\n- second')[0] === 'first');
check('bounded to maxLines', extractCaptureSummary('a\nb\nc\nd\ne', 2).length === 2);
check('default cap is 3', extractCaptureSummary('a\nb\nc\nd\ne').length === 3);

// ---------------------------------------------------------------------------
// 4. readLatestCapture
// ---------------------------------------------------------------------------
console.log('readLatestCapture');
{
  const { projectDir, tmpRoot } = makeTempProject('capture');
  check('no dir → null', readLatestCapture(projectDir, SESSIONS_REL) === null);
  seedCapture(projectDir, SESSIONS_REL, '2026-06-19-x.md', '---\na: 1\n---\nReduced title font to 18px.\nContrast pending.');
  const cap = readLatestCapture(projectDir, SESSIONS_REL);
  check('returns file', cap && cap.file === '2026-06-19-x.md');
  check('returns summary array', cap && cap.summary[0] === 'Reduced title font to 18px.');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 5. findActiveMilestone
// ---------------------------------------------------------------------------
console.log('findActiveMilestone');
{
  const parsed = parseOverdriveMd(FIXTURE_AWAITING);
  const active = require('../lib/ovd-plan/display').findActiveNode(parsed.tree);
  check('active node found', active && active.id === 'II.2.a');
  const ms = findActiveMilestone(parsed.tree, active);
  check('milestone is depth-2 ancestor', ms && ms.id === 'II');
  check('milestone title', ms && /Dashboard/.test(ms.title));
  check('no active → null', findActiveMilestone(parsed.tree, null) === null);
  check('null tree → null', findActiveMilestone(null, active) === null);
}
{
  // active node that is itself a milestone (depth 2)
  const parsed = parseOverdriveMd(FIXTURE_PENDING_NO_ACTIVE);
  check('no active in pending tree', require('../lib/ovd-plan/display').findActiveNode(parsed.tree) === null);
}

// ---------------------------------------------------------------------------
// 6. activeScopeFiles
// ---------------------------------------------------------------------------
console.log('activeScopeFiles');
{
  const parsed = parseOverdriveMd(FIXTURE_AWAITING);
  const active = require('../lib/ovd-plan/display').findActiveNode(parsed.tree);
  const files = activeScopeFiles(active);
  check('reads scope.in array', files.length === 2 && files[0] === 'src/components/Grid.tsx');
  check('null node → []', activeScopeFiles(null).length === 0);
  check('no annotations → []', activeScopeFiles({ id: 'x' }).length === 0);
  check('non-array scope.in → []', activeScopeFiles({ annotations: { scope: { in: 'nope' } } }).length === 0);
  check('filters non-strings/empties', JSON.stringify(activeScopeFiles({ annotations: { scope: { in: ['a', '', null, 'b'] } } })) === JSON.stringify(['a', 'b']));
}

// ---------------------------------------------------------------------------
// 7. renderOrientActionPaths — all 7 kinds, Pattern 7 discipline
// ---------------------------------------------------------------------------
console.log('renderOrientActionPaths');
const KINDS = ['empty', 'active-awaiting-review', 'active-in-progress', 'active-blocked', 'active-other', 'pending-no-active', 'all-closed'];
for (const kind of KINDS) {
  const txt = renderOrientActionPaths({ kind, activeNode: kind.startsWith('active') ? { id: 'II.2.a' } : null });
  check(`${kind}: has numbered options`, /\(1\)/.test(txt) && /\(2\)/.test(txt));
  check(`${kind}: Pattern 7 "Other" escape`, /Other —/i.test(txt));
  check(`${kind}: asks how to continue or offers paths`, txt.includes('How would you like to continue?'));
}
{
  // awaiting-review matches r3 §6.2 worked example (6 options, iterate + approve+advance)
  const txt = renderOrientActionPaths({ kind: 'active-awaiting-review', activeNode: { id: 'II.2.a' } });
  check('awaiting-review: 6 options', /\(6\)/.test(txt) && !/\(7\)/.test(txt));
  check('awaiting-review: iterate option references active id', /Iterate on II\.2\.a/.test(txt));
  check('awaiting-review: approve+advance option', /Mark II\.2\.a 'approved'/.test(txt));
}
{
  const txt = renderOrientActionPaths({ kind: 'empty', activeNode: null });
  check('empty: routes to deliberate', /\/ovd-plan deliberate/.test(txt));
}

// ---------------------------------------------------------------------------
// 8. buildOrientation
// ---------------------------------------------------------------------------
console.log('buildOrientation');
{
  const { projectDir, tmpRoot } = makeTempProject('build');
  writePlan(projectDir, FIXTURE_AWAITING);
  seedCapture(projectDir, SESSIONS_REL, '2026-06-19-s.md', '---\nx: 1\n---\nReduced font to 18px.');
  // create one scope file so existence note differs
  fs.mkdirSync(path.join(projectDir, 'src', 'components'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'src', 'components', 'Grid.tsx'), '//');
  const parsed = parseOverdriveMd(FIXTURE_AWAITING);
  const o = buildOrientation(parsed, projectDir, {});
  check('text has Project line', /Project: Test Project/.test(o.text));
  check('text has Milestone line', /Milestone: II Dashboard/.test(o.text));
  check('text has Active leaf line', /Active leaf: II\.2\.a Widget layout design \[awaiting-review\]/.test(o.text));
  check('text has last session summary', /Last session summary \(2026-06-19-s\.md\)/.test(o.text) && /Reduced font to 18px\./.test(o.text));
  check('awaitingReview count = 1', o.awaitingReview === 1);
  check('text reports awaiting review', /Awaiting your review: 1 leaf\./.test(o.text));
  check('scopeFiles surfaced', o.scopeFiles.length === 2);
  check('text lists scope files', /src\/components\/Grid\.tsx/.test(o.text));
  check('existing file has no (not found)', /Grid\.tsx\n/.test(o.text) && !/Grid\.tsx \(not found\)/.test(o.text));
  check('missing file flagged (not found)', /grid\.css \(not found\)/.test(o.text));
  check('does NOT dump file contents (Pattern 1)', !o.text.includes('//') || o.text.indexOf('//') === o.text.lastIndexOf('//'));
  check('kind = active-awaiting-review', o.kind === 'active-awaiting-review');
  check('milestone returned', o.milestone && o.milestone.id === 'II');
  check('lastSession file', o.lastSession === '2026-06-19-s.md');
  cleanup(tmpRoot);
}
{
  // handoff fallback when no session
  const { projectDir, tmpRoot } = makeTempProject('handoff');
  writePlan(projectDir, FIXTURE_IN_PROGRESS);
  seedCapture(projectDir, HANDOFFS_REL, '2026-06-19-h.md', 'Handoff body line.');
  const parsed = parseOverdriveMd(FIXTURE_IN_PROGRESS);
  const o = buildOrientation(parsed, projectDir, {});
  check('falls back to handoff summary', /Last handoff summary \(2026-06-19-h\.md\)/.test(o.text));
  check('lastHandoff file', o.lastHandoff === '2026-06-19-h.md');
  cleanup(tmpRoot);
}
{
  // empty tree → no active leaf / milestone / awaiting line
  const parsed = parseOverdriveMd(FIXTURE_EMPTY);
  const o = buildOrientation(parsed, '/tmp/nonexistent-ovd', {});
  check('empty: kind empty', o.kind === 'empty');
  check('empty: no awaiting review', o.awaitingReview === 0 && !/Awaiting your review/.test(o.text));
  check('empty: action paths present', /How would you like to continue/.test(o.text));
}

// ---------------------------------------------------------------------------
// 9. runGoDefault — entry point + error paths
// ---------------------------------------------------------------------------
console.log('runGoDefault');
check('invalid project dir → ok=false', runGoDefault(null).ok === false && runGoDefault(null).reason === 'invalid-project-dir');
{
  const { projectDir, tmpRoot } = makeTempProject('missing');
  const r = runGoDefault(projectDir, {});
  check('missing plan → ok=false', r.ok === false);
  check('missing plan → reason', r.reason === 'missing-plan');
  check('missing plan → guidance text', /OVERDRIVE\.md not found/.test(r.text));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('parse');
  writePlan(projectDir, FIXTURE_BAD);
  const r = runGoDefault(projectDir, {});
  check('parse error → ok=false', r.ok === false);
  check('parse error → reason in {parse-error,unknown-error}', r.reason === 'parse-error' || r.reason === 'unknown-error');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('happy');
  writePlan(projectDir, FIXTURE_AWAITING);
  const r = runGoDefault(projectDir, {});
  check('happy → ok=true', r.ok === true);
  check('happy → status=go', r.status === 'go');
  check('happy → mode=orient', r.mode === 'orient');
  check('happy → route=orient', r.route === 'orient');
  check('happy → activeNode id', r.activeNode && r.activeNode.id === 'II.2.a');
  check('happy → milestone id', r.milestone && r.milestone.id === 'II');
  check('happy → awaitingReview 1', r.awaitingReview === 1);
  check('happy → text has action paths', /How would you like to continue/.test(r.text));
  check('happy → never auto-executes (orient only)', r.mode === 'orient' && !/Executing/.test(r.text));
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 10. Dispatch via ovdPlan.runGo (bare → ORIENT; subcommand → stub)
// ---------------------------------------------------------------------------
console.log('Dispatch via runGo');
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch');
  writePlan(projectDir, FIXTURE_PENDING_NO_ACTIVE);
  const r = ovdPlan.runGo({ projectDir }, process.env);
  check('bare runGo → orient', r.ok === true && r.mode === 'orient');
  check('bare runGo → pending-no-active kind', r.kind === 'pending-no-active');
  const stub = ovdPlan.runGo({ subcommand: '__unimplemented__', text: 'II.2.a' }, process.env);
  check('unrecognized subcommand → stub', stub.status === 'stub');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 11. Action-path kinds end-to-end (in-progress / blocked / all-closed)
// ---------------------------------------------------------------------------
console.log('Action-path kinds end-to-end');
for (const [name, fixture, expectKind] of [
  ['in-progress', FIXTURE_IN_PROGRESS, 'active-in-progress'],
  ['blocked', FIXTURE_BLOCKED, 'active-blocked'],
  ['all-closed', FIXTURE_ALL_CLOSED, 'all-closed']
]) {
  const { projectDir, tmpRoot } = makeTempProject(`k-${name}`);
  writePlan(projectDir, fixture);
  const r = runGoDefault(projectDir, {});
  check(`${name}: ok`, r.ok === true);
  check(`${name}: kind=${expectKind}`, r.kind === expectKind);
  check(`${name}: Pattern 7 Other escape`, /Other —/i.test(r.text));
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 12. Migration-compat seam (Pattern 5)
// ---------------------------------------------------------------------------
console.log('Migration-compat seam (Pattern 5)');
{
  const { projectDir, tmpRoot } = makeTempProject('migration-compat');
  writePlan(projectDir, FIXTURE_MIGRATION);
  const r = runGoDefault(projectDir, {});
  check('migration-shape → ok=true', r.ok === true);
  check('migration-shape → kind empty (no tree)', r.kind === 'empty');
  check('migration-shape → no crash, action paths present', /How would you like to continue/.test(r.text));
  check('migration-shape → project title from frontmatter', /Project: Migrated/.test(r.text));
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${passed} checks passed.`);
if (failures.length > 0) {
  console.log(`${failures.length} failure(s):`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
