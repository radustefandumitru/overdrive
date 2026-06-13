#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  STATUS_SYMBOLS,
  ACTIVE_TRAILER,
  FALLBACK_SYMBOL,
  RECOMMENDATION_KINDS,
  symbolFor,
  aggregateCounts,
  formatCounts,
  findActiveNode,
  analyzeTree,
  renderRecommendation,
  renderTreeBody,
  buildDisplay,
  runDisplay
} = require('../lib/ovd-plan/display');

const ovdPlan = require('../lib/ovd-plan');
const displayModule = require('../lib/ovd-plan/display');
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
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-display-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
  return { projectDir, tmpRoot };
}

function cleanup(tmpRoot) {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

function writePlan(projectDir, content) {
  fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), content);
}

function makeNode(opts) {
  return {
    id: opts.id || '',
    depth: opts.depth || 1,
    explicitId: opts.explicitId || null,
    title: opts.title || null,
    status: opts.status || null,
    active: !!opts.active,
    description: opts.description || null,
    annotations: opts.annotations || null,
    children: opts.children || [],
    lineNumber: 0
  };
}

function makeRoot(title, children) {
  return makeNode({ id: '', depth: 1, title, children: children || [] });
}

// --- Inline fixtures ---

const FRONT = '---\novd-plan: true\nversion: 3\nproject: "Test Project"\n---\n\n';

const FIXTURE_STUB = `${FRONT}# Test Project\n`;

const FIXTURE_SIMPLE = `${FRONT}# Test Project

## I. Foundation [done]
## II. Dashboard [pending]
`;

const FIXTURE_ACTIVE = `${FRONT}# Test Project

## I. Foundation [in-progress]

### I.1 Scaffolding [done]
### I.2 Migrations [awaiting-review] ← ACTIVE

\`\`\`yaml ovd-plan
skills: [planning-first]
\`\`\`
`;

const FIXTURE_ALL_STATUSES = `${FRONT}# Test Project

## I. Done milestone [done]
## II. In-progress milestone [in-progress]
## III. Awaiting review milestone [awaiting-review]
## IV. Pending milestone [pending]
## V. Blocked milestone [blocked]
## VI. Skipped milestone [skipped]
## VII. Mixed milestone [mixed]
`;

const FIXTURE_AGENT_INSERTED = `${FRONT}# Test Project

## I. Foundation [done]

### I.1 Auth middleware [done]

\`\`\`yaml ovd-plan
inserted_by: agent
inserted_reason: required for protected routes
\`\`\`

### I.2 Accessibility pass [pending]

\`\`\`yaml ovd-plan
inserted_by: agent
inserted_reason: WCAG AA required
\`\`\`
`;

const FIXTURE_DEEP = `${FRONT}# Deep

## I. Level two [in-progress]

### I.1 Level three [in-progress]

#### I.1.a Level four [pending] ← ACTIVE
##### I.1.a.i Level five [pending]
`;

const FIXTURE_ALL_DONE = `${FRONT}# Test Project

## I. Foundation [done]
## II. Dashboard [done]
## III. Launch [done]
`;

const FIXTURE_BLOCKED_ACTIVE = `${FRONT}# Test Project

## I. Foundation [in-progress]

### I.1 Migrations [blocked] ← ACTIVE
### I.2 Seeds [pending]
`;

console.log('ovd-plan display tests');

// --- 0. Module surface ---
{
  check('STATUS_SYMBOLS is an object', typeof STATUS_SYMBOLS === 'object' && STATUS_SYMBOLS !== null);
  check('ACTIVE_TRAILER is a non-empty string', typeof ACTIVE_TRAILER === 'string' && ACTIVE_TRAILER.length > 0);
  check('FALLBACK_SYMBOL is a non-empty string', typeof FALLBACK_SYMBOL === 'string' && FALLBACK_SYMBOL.length > 0);
  check('RECOMMENDATION_KINDS is an array', Array.isArray(RECOMMENDATION_KINDS));
  check('symbolFor is a function', typeof symbolFor === 'function');
  check('aggregateCounts is a function', typeof aggregateCounts === 'function');
  check('formatCounts is a function', typeof formatCounts === 'function');
  check('findActiveNode is a function', typeof findActiveNode === 'function');
  check('analyzeTree is a function', typeof analyzeTree === 'function');
  check('renderRecommendation is a function', typeof renderRecommendation === 'function');
  check('renderTreeBody is a function', typeof renderTreeBody === 'function');
  check('buildDisplay is a function', typeof buildDisplay === 'function');
  check('runDisplay is a function', typeof runDisplay === 'function');
}

// --- 1. STATUS_SYMBOLS mapping (orchestrator-locked Q3.1 + mixed) ---
{
  check('STATUS_SYMBOLS.done = ✓', STATUS_SYMBOLS.done === '✓');
  check('STATUS_SYMBOLS.pending = ·', STATUS_SYMBOLS.pending === '·');
  check('STATUS_SYMBOLS["in-progress"] = ~', STATUS_SYMBOLS['in-progress'] === '~');
  check('STATUS_SYMBOLS["awaiting-review"] = ?', STATUS_SYMBOLS['awaiting-review'] === '?');
  check('STATUS_SYMBOLS.blocked = ⚠', STATUS_SYMBOLS.blocked === '⚠');
  check('STATUS_SYMBOLS.skipped = —', STATUS_SYMBOLS.skipped === '—');
  check('STATUS_SYMBOLS.mixed = ≈', STATUS_SYMBOLS.mixed === '≈');
  check('STATUS_SYMBOLS covers all 7 r3 §10.1/§10.7 statuses',
    ['done', 'pending', 'in-progress', 'awaiting-review', 'blocked', 'skipped', 'mixed']
      .every((s) => typeof STATUS_SYMBOLS[s] === 'string' && STATUS_SYMBOLS[s].length > 0));
  check('ACTIVE_TRAILER ends with "ACTIVE"', /ACTIVE\s*$/.test(ACTIVE_TRAILER));
  check('ACTIVE_TRAILER contains the → glyph', ACTIVE_TRAILER.includes('→'));
}

// --- 2. symbolFor() ---
{
  check('symbolFor("done") = ✓', symbolFor('done') === '✓');
  check('symbolFor("pending") = ·', symbolFor('pending') === '·');
  check('symbolFor("mixed") = ≈', symbolFor('mixed') === '≈');
  check('symbolFor(unknown) falls back to FALLBACK_SYMBOL', symbolFor('not-a-status') === FALLBACK_SYMBOL);
  check('symbolFor(null) falls back', symbolFor(null) === FALLBACK_SYMBOL);
  check('symbolFor(undefined) falls back', symbolFor(undefined) === FALLBACK_SYMBOL);

  const colored = symbolFor('done', { color: true });
  check('symbolFor("done", {color:true}) wraps in ANSI', colored.includes('\x1b[') && colored.includes('✓') && colored.endsWith('\x1b[0m'));
  const plain = symbolFor('done', { color: false });
  check('symbolFor("done", {color:false}) is plain (no ANSI)', plain === '✓' && !plain.includes('\x1b['));
  const defaultPlain = symbolFor('done', {});
  check('symbolFor with empty opts defaults to no color', defaultPlain === '✓');
}

// --- 3. aggregateCounts() walks all non-root descendants ---
{
  const empty = aggregateCounts(makeRoot('Empty', []));
  check('aggregateCounts(empty tree): total = 0', empty.total === 0);
  check('aggregateCounts(empty tree): done = 0', empty.done === 0);

  const tree = parseOverdriveMd(FIXTURE_ALL_STATUSES).tree;
  const counts = aggregateCounts(tree);
  check('aggregateCounts(all-statuses): total = 7', counts.total === 7);
  check('aggregateCounts(all-statuses): done = 1', counts.done === 1);
  check('aggregateCounts(all-statuses): in-progress = 1', counts.inProgress === 1);
  check('aggregateCounts(all-statuses): awaiting-review = 1', counts.awaitingReview === 1);
  check('aggregateCounts(all-statuses): pending = 1', counts.pending === 1);
  check('aggregateCounts(all-statuses): blocked = 1', counts.blocked === 1);
  check('aggregateCounts(all-statuses): skipped = 1', counts.skipped === 1);
  check('aggregateCounts(all-statuses): mixed = 1', counts.mixed === 1);

  const deepTree = parseOverdriveMd(FIXTURE_DEEP).tree;
  const deepCounts = aggregateCounts(deepTree);
  check('aggregateCounts(deep): total = 4 (depths 2,3,4,5)', deepCounts.total === 4);
}

// --- 4. formatCounts() ---
{
  const allZero = formatCounts({ total: 0, done: 0, pending: 0, inProgress: 0, awaitingReview: 0, blocked: 0, skipped: 0, mixed: 0 });
  check('formatCounts(all-zero): includes "0 nodes"', allZero.includes('0 nodes'));
  check('formatCounts(all-zero): suppresses 0-count categories',
    !allZero.includes('0 done') && !allZero.includes('0 pending'));

  const mixed = formatCounts({ total: 7, done: 3, pending: 2, inProgress: 1, awaitingReview: 1, blocked: 0, skipped: 0, mixed: 0 });
  check('formatCounts(mixed): "7 nodes"', mixed.includes('7 nodes'));
  check('formatCounts(mixed): "3 done"', mixed.includes('3 done'));
  check('formatCounts(mixed): "1 in-progress"', mixed.includes('1 in-progress'));
  check('formatCounts(mixed): suppresses zero blocked', !mixed.includes('0 blocked'));
  check('formatCounts(mixed): separator is " · "', mixed.includes(' · '));
}

// --- 5. findActiveNode() ---
{
  const noActive = findActiveNode(parseOverdriveMd(FIXTURE_SIMPLE).tree);
  check('findActiveNode(no active): returns null', noActive === null);

  const activeTree = parseOverdriveMd(FIXTURE_ACTIVE).tree;
  const found = findActiveNode(activeTree);
  check('findActiveNode(active depth-3): finds the node', found !== null);
  check('findActiveNode(active depth-3): correct id', found && found.id === 'I.2');
  check('findActiveNode(active depth-3): correct status', found && found.status === 'awaiting-review');

  const deepActive = findActiveNode(parseOverdriveMd(FIXTURE_DEEP).tree);
  check('findActiveNode(deep depth-4): finds the deep node', deepActive && deepActive.id === 'I.1.a');
}

// --- 6. analyzeTree() recommendation kinds ---
{
  const empty = analyzeTree(parseOverdriveMd(FIXTURE_STUB));
  check('analyzeTree(stub): kind = empty', empty.kind === 'empty');
  check('analyzeTree(stub): isEmpty = true', empty.isEmpty === true);

  const active = analyzeTree(parseOverdriveMd(FIXTURE_ACTIVE));
  check('analyzeTree(active awaiting-review): kind = active-awaiting-review', active.kind === 'active-awaiting-review');
  check('analyzeTree(active awaiting-review): activeNode.id = I.2', active.activeNode && active.activeNode.id === 'I.2');

  const blocked = analyzeTree(parseOverdriveMd(FIXTURE_BLOCKED_ACTIVE));
  check('analyzeTree(active blocked): kind = active-blocked', blocked.kind === 'active-blocked');

  const noActive = analyzeTree(parseOverdriveMd(FIXTURE_SIMPLE));
  check('analyzeTree(no active, has pending): kind = pending-no-active', noActive.kind === 'pending-no-active');

  const allDone = analyzeTree(parseOverdriveMd(FIXTURE_ALL_DONE));
  check('analyzeTree(all done): kind = all-closed', allDone.kind === 'all-closed');
}

// --- 7. renderRecommendation() per kind ---
{
  const empty = renderRecommendation({ kind: 'empty' });
  check('renderRecommendation(empty): includes "/ovd-plan deliberate"', empty.includes('/ovd-plan deliberate'));
  check('renderRecommendation(empty): includes (1)', empty.includes('(1)'));
  check('renderRecommendation(empty): includes (4) describe other', empty.includes('(4) describe other'));
  check('renderRecommendation(empty): starts with "Next steps:"', empty.startsWith('Next steps:'));

  const awaiting = renderRecommendation({ kind: 'active-awaiting-review', activeNode: { id: 'II.2.a' } });
  check('renderRecommendation(awaiting): includes "/ovd-go verify II.2.a"', awaiting.includes('/ovd-go verify II.2.a'));
  check('renderRecommendation(awaiting): includes describe other', awaiting.includes('describe other'));

  const blocked = renderRecommendation({ kind: 'active-blocked', activeNode: { id: 'I.1' } });
  check('renderRecommendation(blocked): includes "/ovd-plan edit"', blocked.includes('/ovd-plan edit'));
  check('renderRecommendation(blocked): references blocked id', blocked.includes('I.1'));

  const allClosed = renderRecommendation({ kind: 'all-closed' });
  check('renderRecommendation(all-closed): includes "/ovd-log handoff"', allClosed.includes('/ovd-log handoff'));

  const pending = renderRecommendation({ kind: 'pending-no-active' });
  check('renderRecommendation(pending-no-active): includes "/ovd-go"', pending.includes('/ovd-go'));

  const inProgress = renderRecommendation({ kind: 'active-in-progress', activeNode: { id: 'II.2' } });
  check('renderRecommendation(active-in-progress): includes "/ovd-go II.2"', inProgress.includes('/ovd-go II.2'));
}

// --- 8. renderTreeBody() ---
{
  const simple = renderTreeBody(parseOverdriveMd(FIXTURE_SIMPLE).tree);
  check('renderTreeBody(simple): contains "I"', simple.includes('I '));
  check('renderTreeBody(simple): contains "II"', simple.includes('II '));
  check('renderTreeBody(simple): contains done symbol ✓', simple.includes('✓'));
  check('renderTreeBody(simple): contains pending symbol ·', simple.includes('·'));
  check('renderTreeBody(simple): contains titles', simple.includes('Foundation') && simple.includes('Dashboard'));
  check('renderTreeBody(simple): no ANSI by default', !simple.includes('\x1b['));

  const active = renderTreeBody(parseOverdriveMd(FIXTURE_ACTIVE).tree);
  check('renderTreeBody(active): renders ACTIVE_TRAILER on active node',
    active.includes('I.2') && active.split('\n').some((l) => l.includes('I.2') && l.includes(ACTIVE_TRAILER)));
  check('renderTreeBody(active): non-active nodes do NOT have ACTIVE_TRAILER',
    active.split('\n').filter((l) => l.includes(ACTIVE_TRAILER)).length === 1);

  const agentTree = renderTreeBody(parseOverdriveMd(FIXTURE_AGENT_INSERTED).tree);
  check('renderTreeBody(agent-inserted): includes "[agent]" tag', agentTree.includes('[agent]'));
  check('renderTreeBody(agent-inserted): tag count matches 2 inserted nodes',
    (agentTree.match(/\[agent\]/g) || []).length === 2);

  const deep = renderTreeBody(parseOverdriveMd(FIXTURE_DEEP).tree);
  const deepLines = deep.split('\n').filter((l) => l.trim());
  check('renderTreeBody(deep): nests with increasing indent',
    deepLines.length === 4 &&
    deepLines[0].search(/\S/) < deepLines[1].search(/\S/) &&
    deepLines[1].search(/\S/) < deepLines[2].search(/\S/) &&
    deepLines[2].search(/\S/) < deepLines[3].search(/\S/));
  check('renderTreeBody(deep): depth-2 indent = 0', deepLines[0].search(/\S/) === 0);
  check('renderTreeBody(deep): depth-3 indent = 2', deepLines[1].search(/\S/) === 2);
  check('renderTreeBody(deep): depth-4 indent = 4', deepLines[2].search(/\S/) === 4);
  check('renderTreeBody(deep): depth-5 indent = 6', deepLines[3].search(/\S/) === 6);

  const allStatuses = renderTreeBody(parseOverdriveMd(FIXTURE_ALL_STATUSES).tree);
  for (const sym of ['✓', '·', '~', '?', '⚠', '—', '≈']) {
    check(`renderTreeBody(all-statuses): contains "${sym}"`, allStatuses.includes(sym));
  }

  const colored = renderTreeBody(parseOverdriveMd(FIXTURE_SIMPLE).tree, { color: true });
  check('renderTreeBody({color:true}): emits ANSI escapes', colored.includes('\x1b['));
  check('renderTreeBody({color:true}): includes RESET', colored.includes('\x1b[0m'));

  const empty = renderTreeBody(makeRoot('Stub', []));
  check('renderTreeBody(empty children): returns empty string', empty === '');
}

// --- 9. buildDisplay() composition ---
{
  const parsed = parseOverdriveMd(FIXTURE_ACTIVE);
  const built = buildDisplay(parsed);
  check('buildDisplay: ok = true', built.ok === true);
  check('buildDisplay: text is non-empty string', typeof built.text === 'string' && built.text.length > 0);
  check('buildDisplay: text starts with project title "Test Project"', built.text.startsWith('Test Project'));
  check('buildDisplay: text contains separator line of ─',
    built.text.split('\n').some((l) => /^─+$/.test(l)));
  check('buildDisplay: includes counts line', built.text.includes('nodes') && built.text.includes(' · '));
  check('buildDisplay: includes "Active:" line', built.text.includes('Active:'));
  check('buildDisplay: includes "Next steps:"', built.text.includes('Next steps:'));
  check('buildDisplay: counts object present', built.counts && typeof built.counts.total === 'number');
  check('buildDisplay: recommendation kind = active-awaiting-review', built.recommendation === 'active-awaiting-review');
  check('buildDisplay: activeNode present', built.activeNode && built.activeNode.id === 'I.2');

  const stub = buildDisplay(parseOverdriveMd(FIXTURE_STUB));
  check('buildDisplay(stub): text includes "Active: (none)"', stub.text.includes('Active: (none)'));
  check('buildDisplay(stub): recommendation = empty', stub.recommendation === 'empty');

  const allDone = buildDisplay(parseOverdriveMd(FIXTURE_ALL_DONE));
  check('buildDisplay(all-done): recommendation = all-closed', allDone.recommendation === 'all-closed');
}

// --- 10. runDisplay() I/O wrapper ---
{
  const { projectDir, tmpRoot } = makeTempProject('run-active');
  writePlan(projectDir, FIXTURE_ACTIVE);
  const result = runDisplay(projectDir, {});
  check('runDisplay(active fixture): ok = true', result.ok === true);
  check('runDisplay: status = "display"', result.status === 'display');
  check('runDisplay: returns text', typeof result.text === 'string' && result.text.includes('Test Project'));
  check('runDisplay: returns counts', result.counts && result.counts.total === 3);
  check('runDisplay: returns activeNode', result.activeNode && result.activeNode.id === 'I.2');
  check('runDisplay: recommendation = active-awaiting-review', result.recommendation === 'active-awaiting-review');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('run-missing');
  const result = runDisplay(projectDir, {});
  check('runDisplay(no OVERDRIVE.md): ok = false', result.ok === false);
  check('runDisplay(no OVERDRIVE.md): reason = "missing-plan"', result.reason === 'missing-plan');
  check('runDisplay(no OVERDRIVE.md): text is helpful', typeof result.text === 'string' && result.text.includes('OVERDRIVE.md'));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('run-malformed');
  writePlan(projectDir, `${FRONT}# Test\n\n\`\`\`yaml ovd-plan\nbroken: : :\n\`\`\`\n`);
  const result = runDisplay(projectDir, {});
  check('runDisplay(malformed): ok = false', result.ok === false);
  check('runDisplay(malformed): reason = "parse-error"', result.reason === 'parse-error');
  check('runDisplay(malformed): text mentions parse', typeof result.text === 'string' && /parse|malformed|invalid/i.test(result.text));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('run-null');
  const nullResult = runDisplay(null, {});
  check('runDisplay(null rootDir): ok = false', nullResult.ok === false);
  cleanup(tmpRoot);
}

// --- 11. Dispatch routing through ovdPlan.runPlan ---
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-explicit');
  writePlan(projectDir, FIXTURE_ACTIVE);

  const result = ovdPlan.runPlan({ subcommand: 'display', projectDir, projectDirProvided: true }, process.env);
  check('runPlan(subcommand="display"): ok = true', result.ok === true);
  check('runPlan(subcommand="display"): status = "display"', result.status === 'display');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-bare-with-plan');
  writePlan(projectDir, FIXTURE_SIMPLE);
  const result = ovdPlan.runPlan({ projectDir, projectDirProvided: true }, process.env);
  check('runPlan(bare, OVERDRIVE.md exists): routes to display', result.ok === true && result.status === 'display');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-bare-no-plan');
  const result = ovdPlan.runPlan({ projectDir, projectDirProvided: true }, process.env);
  check('runPlan(bare, no OVERDRIVE.md): falls through to stub for Task 3.3 routing',
    result.status === 'stub' || (result.ok === false && result.reason === 'missing-plan'));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-color');
  writePlan(projectDir, FIXTURE_SIMPLE);
  const result = ovdPlan.runPlan({ subcommand: 'display', color: true, projectDir, projectDirProvided: true }, process.env);
  check('runPlan({color:true}): emits ANSI in text', result.ok === true && result.text.includes('\x1b['));
  cleanup(tmpRoot);
}

// --- 12. Migration-compat seam (Pattern 5) ---
{
  // Phase 2 migration produces an OVERDRIVE.md with frontmatter + minimal/empty tree.
  // Display must not crash on any well-formed migrated layout.
  const migrationLike = `---
ovd-plan: true
version: 3
project: "Migrated"
active_node: ""
current_milestone: ""
---

# Migrated
`;
  const { projectDir, tmpRoot } = makeTempProject('migration-compat');
  writePlan(projectDir, migrationLike);
  const result = runDisplay(projectDir, {});
  check('runDisplay(migration-like layout): ok = true', result.ok === true);
  check('runDisplay(migration-like layout): recommendation = empty', result.recommendation === 'empty');
  check('runDisplay(migration-like layout): text mentions deliberate', result.text.includes('/ovd-plan deliberate'));
  cleanup(tmpRoot);
}
{
  // Future Task 3.9 deliberation-state block — should not crash even if the block exists alongside an empty tree.
  const withDeliberation = `---
ovd-plan: true
version: 3
project: "WithState"
deliberation_status: paused
---

# WithState

<!-- ovd-plan:deliberation-state:start -->
stage: elicit
last_question: "What's your domain?"
<!-- ovd-plan:deliberation-state:end -->
`;
  const { projectDir, tmpRoot } = makeTempProject('with-deliberation');
  writePlan(projectDir, withDeliberation);
  const result = runDisplay(projectDir, {});
  check('runDisplay(with deliberation-state block): ok = true', result.ok === true);
  cleanup(tmpRoot);
}

// --- 13. Namespace + top-level exports on the package index ---
{
  check('ovdPlan.display namespace exported', ovdPlan.display === displayModule);
  check('ovdPlan.runDisplay top-level exported', typeof ovdPlan.runDisplay === 'function');
  check('ovdPlan.runDisplay matches displayModule.runDisplay', ovdPlan.runDisplay === displayModule.runDisplay);
}

// --- 14. Snapshot equality (one canonical fixture) ---
{
  const parsed = parseOverdriveMd(`${FRONT}# Snapshot Project

## I. Foundation [done]

### I.1 Scaffolding [done]

## II. Dashboard [in-progress]

### II.1 Stats [awaiting-review] ← ACTIVE

\`\`\`yaml ovd-plan
inserted_by: agent
\`\`\`

### II.2 Nav [pending]
`);
  const text = buildDisplay(parsed).text;
  const expected = [
    'Snapshot Project',
    '────────────────',
    '5 nodes · 2 done · 1 in-progress · 1 awaiting-review · 1 pending',
    '',
    '✓ I  Foundation',
    '  ✓ I.1  Scaffolding',
    '~ II  Dashboard',
    '  ? II.1  Stats [agent]   → ACTIVE',
    '  · II.2  Nav',
    '',
    'Active: II.1 Stats (awaiting-review)',
    '',
    'Next steps:',
    '  (1) /ovd-go verify II.1 — run the verification step',
    '  (2) /ovd-go II.1 — continue iterating',
    '  (3) /ovd-log — checkpoint current state',
    '  (4) describe other (or describe what you want)'
  ].join('\n');
  check('buildDisplay snapshot matches expected text exactly', text === expected,
    `\n--- expected ---\n${expected}\n--- got ---\n${text}\n--- end ---`);
}

// --- Footer ---
if (failures.length === 0) {
  console.log(`\n${passed} checks passed.`);
  process.exit(0);
} else {
  console.log(`\n${failures.length} failure(s); ${passed} passed.`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
