#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const closure = require('../lib/ovd-plan/closure');
const {
  STATUS,
  DECISIONS,
  findNode,
  renderClosurePrompt,
  recursiveCloseFlow,
  normalizeClosureEntries,
  applyClosureDecision,
  runClose
} = closure;

const ovdPlan = require('../lib/ovd-plan');
const { parseOverdriveMd } = require('../lib/ovd-plan/parser');

const verbose = process.argv.includes('--verbose');
let passed = 0;
const failures = [];
function check(label, condition, detail) {
  if (condition) { passed += 1; if (verbose) console.log(`PASS ${label}`); }
  else { failures.push(detail ? `${label}: ${detail}` : label); console.log(`FAIL ${label}`); }
}

function makeTempProject(name) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-closure-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
  return { projectDir, tmpRoot };
}
function cleanup(tmpRoot) { fs.rmSync(tmpRoot, { recursive: true, force: true }); }
function writePlan(projectDir, content) { fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), content); }
function readPlan(projectDir) { return fs.readFileSync(path.join(projectDir, 'OVERDRIVE.md'), 'utf8'); }
function nodeStatus(projectDir, id) {
  const flat = [];
  (function walk(n) { for (const c of n.children || []) { flat.push(c); walk(c); } })(parseOverdriveMd(readPlan(projectDir)).tree);
  const n = flat.find((x) => x.id === id);
  return n ? n.status : null;
}

const FRONT = '---\novd-plan: true\nversion: 3\nproject: "Test Project"\n---\n\n';
// Closing II.2.a/.b makes II.2 closed-via-children → II eligible (II.1 done); root
// blocked by I pending. Chain: II.2 → II, stops at root (open sibling I).
const FIXTURE_CHAIN = `${FRONT}# Test Project

## I. Foundation [pending]

### I.1 Setup [pending]

## II. Dashboard [in-progress]

### II.1 Data [done]
### II.2 Widgets [in-progress]

#### II.2.a Layout [done]
#### II.2.b Legend [done]
`;
// Closing I.1 leaves I.2 open → no closure (open-siblings).
const FIXTURE_SIBLINGS = `${FRONT}# Test Project

## I. Milestone [in-progress]

### I.1 Alpha [done]
### I.2 Beta [pending]
`;
const FIXTURE_MIGRATION = '---\novd-plan: true\nversion: 3\nproject: "Migrated"\nactive_node: ""\n---\n\n# Migrated\n';

// ---------------------------------------------------------------------------
// 1. Module surface
// ---------------------------------------------------------------------------
console.log('Module surface');
check('STATUS === "go"', STATUS === 'go');
check('DECISIONS = close/hold/verify', JSON.stringify(DECISIONS) === JSON.stringify(['close', 'hold', 'verify']));
for (const fn of ['findNode', 'renderClosurePrompt', 'recursiveCloseFlow', 'normalizeClosureEntries', 'applyClosureDecision', 'runClose']) {
  check(`${fn} exported`, typeof closure[fn] === 'function');
}
check('ovdPlan.closure namespace', ovdPlan.closure === closure);
check('ovdPlan.runClose wired', ovdPlan.runClose === runClose);

// ---------------------------------------------------------------------------
// 2. findNode
// ---------------------------------------------------------------------------
console.log('findNode');
{
  const tree = parseOverdriveMd(FIXTURE_CHAIN).tree;
  check('finds container', findNode(tree, 'II.2') && findNode(tree, 'II.2').title === 'Widgets');
  check('finds leaf', findNode(tree, 'II.2.a') !== null);
  check('not found → null', findNode(tree, 'Z.9') === null);
  check('empty → null', findNode(tree, '') === null);
}

// ---------------------------------------------------------------------------
// 3. recursiveCloseFlow (PLAN)
// ---------------------------------------------------------------------------
console.log('recursiveCloseFlow');
{
  const { projectDir, tmpRoot } = makeTempProject('flow');
  writePlan(projectDir, FIXTURE_CHAIN);
  const r = recursiveCloseFlow(projectDir, 'II.2.a', {});
  check('closure-prompt mode', r.ok === true && r.mode === 'closure-prompt');
  check('current = innermost II.2', r.current.id === 'II.2');
  check('next = II', r.next && r.next.id === 'II');
  check('closures chain [II.2, II]', r.closures.map((c) => c.id).join(',') === 'II.2,II');
  check('prompt: verify option', /\(1\) verify — run \/ovd-go verify II\.2/.test(r.text));
  check('prompt: close option mentions next II', /\(2\) close — mark II\.2 done and check II closure/.test(r.text));
  check('prompt: hold option', /\(3\) hold/.test(r.text));
  check('prompt: other escape', /\(4\) other/.test(r.text));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('siblings');
  writePlan(projectDir, FIXTURE_SIBLINGS);
  const r = recursiveCloseFlow(projectDir, 'I.1', {});
  check('open-siblings → no-closure', r.mode === 'no-closure' && r.reason === 'open-siblings');
  check('open-siblings text', /still has open siblings/.test(r.text));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('notfound');
  writePlan(projectDir, FIXTURE_CHAIN);
  check('node-not-found → no-closure', recursiveCloseFlow(projectDir, 'Z.9', {}).reason === 'node-not-found');
  check('missing-ref', recursiveCloseFlow(projectDir, '', {}).reason === 'missing-ref');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('flow-noplan');
  check('missing-plan', recursiveCloseFlow(projectDir, 'II.2.a', {}).reason === 'missing-plan');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 4. normalizeClosureEntries (Pattern 4)
// ---------------------------------------------------------------------------
console.log('normalizeClosureEntries');
check('null → invalid', normalizeClosureEntries(null).ok === false);
check('missing node_id', normalizeClosureEntries({ decision: 'close' }).reason === 'missing-node-id');
check('invalid decision', normalizeClosureEntries({ node_id: 'II.2', decision: 'nuke' }).reason === 'invalid-decision');
check('missing decision', normalizeClosureEntries({ node_id: 'II.2' }).reason === 'invalid-decision');
check('valid', normalizeClosureEntries({ node_id: 'II.2', decision: 'close' }).ok === true);

// ---------------------------------------------------------------------------
// 5. applyClosureDecision — hold / verify / close
// ---------------------------------------------------------------------------
console.log('applyClosureDecision');
{
  const { projectDir, tmpRoot } = makeTempProject('hold');
  writePlan(projectDir, FIXTURE_CHAIN);
  const r = applyClosureDecision(projectDir, { node_id: 'II.2', decision: 'hold' }, {});
  check('hold → not closed', r.closed === false);
  check('hold → status unchanged', nodeStatus(projectDir, 'II.2') === 'in-progress');
  check('hold text', /Holding II\.2 open/.test(r.text));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('verify');
  writePlan(projectDir, FIXTURE_CHAIN);
  const r = applyClosureDecision(projectDir, { node_id: 'II.2', decision: 'verify' }, {});
  check('verify → not closed', r.closed === false);
  check('verify → cluster-verify hint', /Run \/ovd-go verify II\.2/.test(r.text));
  check('verify → status unchanged', nodeStatus(projectDir, 'II.2') === 'in-progress');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('close');
  writePlan(projectDir, FIXTURE_CHAIN);
  const r = applyClosureDecision(projectDir, { node_id: 'II.2', decision: 'close' }, {});
  check('close → closed', r.closed === true);
  check('close → II.2 persisted done', nodeStatus(projectDir, 'II.2') === 'done');
  check('close → presents next level II', r.next_prompt && r.next_prompt.id === 'II');
  check('close → walk not complete', r.walk_complete === false);
  check('close text shows next II prompt', /mark II done/.test(r.text) || /verify II /.test(r.text));
  cleanup(tmpRoot);
}
{
  // ineligible close (children open)
  const { projectDir, tmpRoot } = makeTempProject('ineligible');
  writePlan(projectDir, FIXTURE_SIBLINGS);
  const r = applyClosureDecision(projectDir, { node_id: 'I', decision: 'close' }, {});
  check('children-open → reject', r.ok === false && r.reason === 'children-open');
  check('ineligible → status unchanged', nodeStatus(projectDir, 'I') === 'in-progress');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('commit-err');
  writePlan(projectDir, FIXTURE_CHAIN);
  check('not-a-container (leaf)', applyClosureDecision(projectDir, { node_id: 'II.2.a', decision: 'close' }, {}).reason === 'not-a-container');
  check('node-not-found', applyClosureDecision(projectDir, { node_id: 'Z.9', decision: 'close' }, {}).reason === 'node-not-found');
  check('invalid decision', applyClosureDecision(projectDir, { node_id: 'II.2', decision: 'x' }, {}).reason === 'invalid-decision');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 6. Multi-level recursive walk (close II.2 → close II → walk complete)
// ---------------------------------------------------------------------------
console.log('Multi-level walk');
{
  const { projectDir, tmpRoot } = makeTempProject('walk');
  writePlan(projectDir, FIXTURE_CHAIN);
  const r1 = applyClosureDecision(projectDir, { node_id: 'II.2', decision: 'close' }, {});
  check('level 1: II.2 closed, next II', r1.closed === true && r1.next_prompt.id === 'II');
  const r2 = applyClosureDecision(projectDir, { node_id: 'II', decision: 'close' }, {});
  check('level 2: II closed', r2.closed === true && nodeStatus(projectDir, 'II') === 'done');
  check('level 2: walk complete (root blocked by I)', r2.walk_complete === true);
  check('walk complete text', /Closure walk complete|still has open siblings|continue/i.test(r2.text));
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 6b. renderClosurePrompt unit + deep nesting + project-complete (root terminal)
// ---------------------------------------------------------------------------
console.log('renderClosurePrompt + deep + project-complete');
check('render with next mentions next', /check II closure/.test(renderClosurePrompt('II.2.a', { id: 'II.2', title: 'W' }, { id: 'II' })));
check('render without next omits check-clause', !/check .* closure/.test(renderClosurePrompt('I.1.a', { id: 'I.1', title: 'C' }, null)));

const FIXTURE_DEEP = `${FRONT}# Test Project

## I. M [in-progress]

### I.1 Cluster [in-progress]

#### I.1.a Sub [in-progress]

##### I.1.a.i Leaf1 [done]
##### I.1.a.ii Leaf2 [done]
`;
{
  const { projectDir, tmpRoot } = makeTempProject('deep');
  writePlan(projectDir, FIXTURE_DEEP);
  const r = recursiveCloseFlow(projectDir, 'I.1.a.i', {});
  check('deep: closure-prompt', r.mode === 'closure-prompt');
  check('deep: 3 presentable levels (root excluded)', r.closures.length === 3);
  check('deep: chain I.1.a,I.1,I', r.closures.map((c) => c.id).join(',') === 'I.1.a,I.1,I');
  check('deep: current innermost I.1.a', r.current.id === 'I.1.a');
  // full walk up to project-complete
  const c1 = applyClosureDecision(projectDir, { node_id: 'I.1.a', decision: 'close' }, {});
  check('deep walk: close I.1.a → next I.1', c1.next_prompt.id === 'I.1');
  const c2 = applyClosureDecision(projectDir, { node_id: 'I.1', decision: 'close' }, {});
  check('deep walk: close I.1 → next I', c2.next_prompt.id === 'I');
  const c3 = applyClosureDecision(projectDir, { node_id: 'I', decision: 'close' }, {});
  check('deep walk: close I → walk complete', c3.walk_complete === true);
  check('deep walk: project-complete message', /project tree is complete/.test(c3.text));
  check('deep walk: I persisted done', nodeStatus(projectDir, 'I') === 'done');
  // root never presented as a closable node
  check('root never a close target', !/\(root\)/.test(c3.text));
  cleanup(tmpRoot);
}
{
  // recursiveCloseFlow directly returns project-complete when only root eligible
  const { projectDir, tmpRoot } = makeTempProject('proj-complete');
  writePlan(projectDir, `${FRONT}# Test Project\n\n## I. Only [in-progress]\n\n### I.1 Leaf [done]\n`);
  // close I first so root becomes the only eligible
  applyClosureDecision(projectDir, { node_id: 'I', decision: 'close' }, {});
  const r = recursiveCloseFlow(projectDir, 'I', {});
  check('only-root-eligible → project-complete', r.mode === 'project-complete');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 7. runClose dispatch + ovdPlan.runGo close
// ---------------------------------------------------------------------------
console.log('runClose + dispatch');
check('invalid dir', runClose(null, {}).reason === 'invalid-project-dir');
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch');
  writePlan(projectDir, FIXTURE_CHAIN);
  check('runClose plan', runClose(projectDir, { mode: 'plan', leafId: 'II.2.a' }).mode === 'closure-prompt');
  const viaPlan = ovdPlan.runGo({ projectDir, subcommand: 'close', text: 'II.2.a' }, process.env);
  check('runGo close plan', viaPlan.ok === true && viaPlan.mode === 'closure-prompt');
  const viaCommit = ovdPlan.runGo({ projectDir, subcommand: 'close', text: 'II.2.a', entriesJson: JSON.stringify({ node_id: 'II.2', decision: 'hold' }) }, process.env);
  check('runGo close commit', viaCommit.ok === true && viaCommit.mode === 'closure-commit');
  const badJson = ovdPlan.runGo({ projectDir, subcommand: 'close', text: 'II.2.a', entriesJson: '{bad' }, process.env);
  check('runGo close bad JSON guard', badJson.ok === false && /not valid JSON/.test(badJson.reason));
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 8. Migration-compat seam (Pattern 5)
// ---------------------------------------------------------------------------
console.log('Migration-compat seam (Pattern 5)');
{
  const { projectDir, tmpRoot } = makeTempProject('migration');
  writePlan(projectDir, FIXTURE_MIGRATION);
  check('migration plan → no-closure node-not-found, no crash', recursiveCloseFlow(projectDir, 'II.2.a', {}).reason === 'node-not-found');
  check('migration commit → node-not-found, no crash', applyClosureDecision(projectDir, { node_id: 'II.2', decision: 'close' }, {}).reason === 'node-not-found');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 9. Edge cases
// ---------------------------------------------------------------------------
console.log('Edge cases');
check('normalize hold valid', normalizeClosureEntries({ node_id: 'II.2', decision: 'hold' }).ok === true);
check('normalize verify valid', normalizeClosureEntries({ node_id: 'II.2', decision: 'verify' }).ok === true);
{
  const { projectDir, tmpRoot } = makeTempProject('stops');
  writePlan(projectDir, FIXTURE_CHAIN);
  const r = recursiveCloseFlow(projectDir, 'II.2.a', {});
  check('open-sibling root surfaced as stops_at', r.stops_at && r.stops_at.id === '(root)');
  const c = applyClosureDecision(projectDir, { node_id: 'II.2', decision: 'close' }, {});
  check('close decision echoed', c.decision === 'close');
  check('close next-prompt text has verify II option', /\(1\) verify — run \/ovd-go verify II/.test(c.text));
  cleanup(tmpRoot);
}
{
  // skipped sibling counts as closed → parent still closable
  const { projectDir, tmpRoot } = makeTempProject('skipped');
  writePlan(projectDir, `${FRONT}# T\n\n## I. M [in-progress]\n\n### I.1 a [done]\n### I.2 b [skipped]\n`);
  const r = recursiveCloseFlow(projectDir, 'I.1', {});
  check('skipped sibling → I presentable (closure-prompt)', r.mode === 'closure-prompt' && r.current.id === 'I');
  cleanup(tmpRoot);
}
{
  const tree = parseOverdriveMd(FIXTURE_DEEP).tree;
  check('findNode deep nested id', findNode(tree, 'I.1.a.i') !== null);
  check('findNode deep container', findNode(tree, 'I.1.a') && findNode(tree, 'I.1.a').children.length === 2);
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
