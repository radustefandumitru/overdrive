#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const iterate = require('../lib/ovd-plan/iterate');
const {
  STATUS,
  getIterations,
  appendIteration,
  renderIterationHistory,
  buildIteratePlan,
  normalizeIterateEntries,
  iterateOnLeaf,
  runIterate
} = iterate;

const ovdPlan = require('../lib/ovd-plan');
const { parseOverdriveMd } = require('../lib/ovd-plan/parser');
const { findLeaf } = require('../lib/ovd-plan/execute');

const verbose = process.argv.includes('--verbose');
let passed = 0;
const failures = [];
function check(label, condition, detail) {
  if (condition) { passed += 1; if (verbose) console.log(`PASS ${label}`); }
  else { failures.push(detail ? `${label}: ${detail}` : label); console.log(`FAIL ${label}`); }
}

function makeTempProject(name) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-iterate-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
  return { projectDir, tmpRoot };
}
function cleanup(tmpRoot) { fs.rmSync(tmpRoot, { recursive: true, force: true }); }
function writePlan(projectDir, content) { fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), content); }
function readPlan(projectDir) { return fs.readFileSync(path.join(projectDir, 'OVERDRIVE.md'), 'utf8'); }
function leaf(projectDir, id) { return findLeaf(parseOverdriveMd(readPlan(projectDir)).tree, id); }

const FENCE = '```yaml ovd-plan';
const FRONT = '---\novd-plan: true\nversion: 3\nproject: "Test Project"\n---\n\n';
const FIXTURE = `${FRONT}# Test Project

## I. Foundation [in-progress]

### I.1 Widget layout [awaiting-review]

${FENCE}
skills: [alpha]
confidence: high
scope:
  in:
    - src/widget/
success:
  - renders at 3 breakpoints
\`\`\`
`;
const FIXTURE_MIGRATION = '---\novd-plan: true\nversion: 3\nproject: "Migrated"\nactive_node: ""\n---\n\n# Migrated\n';
const NOW = '2026-06-20T10:00:00.000Z';
const NOW2 = '2026-06-20T11:00:00.000Z';

// ---------------------------------------------------------------------------
// 1. Module surface
// ---------------------------------------------------------------------------
console.log('Module surface');
check('STATUS === "go"', STATUS === 'go');
for (const fn of ['getIterations', 'appendIteration', 'renderIterationHistory', 'buildIteratePlan', 'normalizeIterateEntries', 'iterateOnLeaf', 'runIterate']) {
  check(`${fn} exported`, typeof iterate[fn] === 'function');
}
check('ovdPlan.iterate namespace', ovdPlan.iterate === iterate);
check('ovdPlan.runIterate wired', ovdPlan.runIterate === runIterate);

// ---------------------------------------------------------------------------
// 2. getIterations + appendIteration
// ---------------------------------------------------------------------------
console.log('getIterations + appendIteration');
check('no annotations → []', getIterations({ annotations: null }).length === 0);
check('non-array iterations → []', getIterations({ annotations: { iterations: 'x' } }).length === 0);
{
  const node = { id: 'I.1', annotations: null };
  const r1 = appendIteration(node, 'too big', null, NOW);
  check('creates annotations + iterations', Array.isArray(node.annotations.iterations));
  check('count 1', r1.count === 1);
  check('entry session', r1.entry.session === NOW);
  check('entry feedback', r1.entry.feedback === 'too big');
  check('delta_applied defaults pending', r1.entry.delta_applied === 'pending');
  const r2 = appendIteration(node, 'now too small', 'set to 16px', NOW2);
  check('count 2', r2.count === 2);
  check('explicit delta_applied honored', r2.entry.delta_applied === 'set to 16px');
  check('iterations accumulate', node.annotations.iterations.length === 2);
}

// ---------------------------------------------------------------------------
// 3. renderIterationHistory
// ---------------------------------------------------------------------------
console.log('renderIterationHistory');
check('empty history', renderIterationHistory({ annotations: null }) === '(no iterations yet)');
{
  const node = { annotations: { iterations: [{ session: NOW, feedback: 'fix contrast', delta_applied: 'pending' }] } };
  const txt = renderIterationHistory(node);
  check('renders feedback', /fix contrast/.test(txt));
  check('renders delta_applied', /delta_applied: pending/.test(txt));
}

// ---------------------------------------------------------------------------
// 4. buildIteratePlan (history view)
// ---------------------------------------------------------------------------
console.log('buildIteratePlan');
{
  const { projectDir, tmpRoot } = makeTempProject('plan');
  writePlan(projectDir, FIXTURE);
  const r = buildIteratePlan(projectDir, 'I.1');
  check('plan ok', r.ok === true && r.mode === 'iterate-plan');
  check('plan iteration_count 0', r.iteration_count === 0);
  check('plan shows no iterations yet', /no iterations yet/.test(r.text));
  check('plan callback syntax', /overdrive go iterate I\.1 --entries-json/.test(r.text));
  check('not-a-leaf', buildIteratePlan(projectDir, 'I').reason === 'not-a-leaf');
  check('leaf-not-found', buildIteratePlan(projectDir, 'Z.9').reason === 'leaf-not-found');
  check('missing-ref', buildIteratePlan(projectDir, '').reason === 'missing-ref');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('plan-noplan');
  check('missing-plan', buildIteratePlan(projectDir, 'I.1').reason === 'missing-plan');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 5. normalizeIterateEntries (Pattern 4)
// ---------------------------------------------------------------------------
console.log('normalizeIterateEntries');
check('null → invalid', normalizeIterateEntries(null).ok === false);
check('array → invalid', normalizeIterateEntries([]).ok === false);
check('missing leaf_id', normalizeIterateEntries({ feedback: 'x' }).reason === 'missing-leaf-id');
check('missing feedback', normalizeIterateEntries({ leaf_id: 'I.1' }).reason === 'missing-feedback');
check('empty feedback', normalizeIterateEntries({ leaf_id: 'I.1', feedback: '  ' }).reason === 'missing-feedback');
check('valid', normalizeIterateEntries({ leaf_id: 'I.1', feedback: 'smaller' }).ok === true);
check('feedback trimmed', normalizeIterateEntries({ leaf_id: 'I.1', feedback: '  smaller  ' }).feedback === 'smaller');
check('delta_applied carried', normalizeIterateEntries({ leaf_id: 'I.1', feedback: 'x', delta_applied: 'done' }).delta_applied === 'done');

// ---------------------------------------------------------------------------
// 6. iterateOnLeaf (capture + transition + re-execute plan)
// ---------------------------------------------------------------------------
console.log('iterateOnLeaf');
{
  const { projectDir, tmpRoot } = makeTempProject('capture');
  writePlan(projectDir, FIXTURE);
  const r = iterateOnLeaf(projectDir, { leaf_id: 'I.1', feedback: 'make the title smaller' }, { now: NOW });
  check('ok', r.ok === true && r.mode === 'iterate-commit');
  check('iteration_count 1', r.iteration_count === 1);
  check('status_after in-progress', r.status_after === 'in-progress');
  // persisted
  const l = leaf(projectDir, 'I.1');
  check('status persisted in-progress', l.status === 'in-progress');
  check('iterations[] persisted', Array.isArray(l.annotations.iterations) && l.annotations.iterations.length === 1);
  check('iteration feedback persisted', l.annotations.iterations[0].feedback === 'make the title smaller');
  check('iteration delta_applied pending', l.annotations.iterations[0].delta_applied === 'pending');
  // re-execute plan with delta
  check('text: delta requested', /Delta requested: make the title smaller/.test(r.text));
  check('text: apply only the delta', /Apply ONLY this delta/.test(r.text));
  check('text: re-execute plan embedded', /--- Re-execute plan ---/.test(r.text) && /LEAF EXECUTE — I\.1/.test(r.text));
  check('session file written', typeof r.session_file === 'string' && fs.existsSync(path.join(projectDir, r.session_file)));
  cleanup(tmpRoot);
}
{
  // errors
  const { projectDir, tmpRoot } = makeTempProject('capture-err');
  writePlan(projectDir, FIXTURE);
  check('leaf-not-found', iterateOnLeaf(projectDir, { leaf_id: 'Z.9', feedback: 'x' }, { now: NOW }).reason === 'leaf-not-found');
  check('not-a-leaf', iterateOnLeaf(projectDir, { leaf_id: 'I', feedback: 'x' }, { now: NOW }).reason === 'not-a-leaf');
  check('missing feedback', iterateOnLeaf(projectDir, { leaf_id: 'I.1' }, { now: NOW }).reason === 'missing-feedback');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 7. Multi-iteration cycle + resume (FM #3 / r3 §8.1)
// ---------------------------------------------------------------------------
console.log('Multi-iteration + resume');
{
  const { projectDir, tmpRoot } = makeTempProject('multi');
  writePlan(projectDir, FIXTURE);
  const r1 = iterateOnLeaf(projectDir, { leaf_id: 'I.1', feedback: 'too big' }, { now: NOW });
  const r2 = iterateOnLeaf(projectDir, { leaf_id: 'I.1', feedback: 'now too small' }, { now: NOW2 });
  check('second iteration count 2', r2.iteration_count === 2);
  // resume: re-parse the persisted tree — both iterations survive
  const l = leaf(projectDir, 'I.1');
  check('both iterations persisted (resume)', l.annotations.iterations.length === 2);
  check('iteration order preserved', l.annotations.iterations[0].feedback === 'too big' && l.annotations.iterations[1].feedback === 'now too small');
  // second re-execute plan shows prior iteration as context (do-not-redo)
  check('prior iteration shown as context', /Prior iterations \(context/.test(r2.text) && /too big/.test(r2.text));
  // buildIteratePlan now shows history of 2
  const hist = buildIteratePlan(projectDir, 'I.1');
  check('history view shows 2', hist.iteration_count === 2);
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 8. runIterate dispatch + ovdPlan.runGo iterate
// ---------------------------------------------------------------------------
console.log('runIterate + dispatch');
check('invalid dir', runIterate(null, {}).reason === 'invalid-project-dir');
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch');
  writePlan(projectDir, FIXTURE);
  check('runIterate plan (no entries)', runIterate(projectDir, { mode: 'plan', leafId: 'I.1' }).mode === 'iterate-plan');
  check('runIterate commit', runIterate(projectDir, { mode: 'commit', entries: { leaf_id: 'I.1', feedback: 'x' }, now: NOW }).mode === 'iterate-commit');
  const viaPlan = ovdPlan.runGo({ projectDir, subcommand: 'iterate', text: 'I.1' }, process.env);
  check('runGo iterate plan', viaPlan.ok === true && viaPlan.mode === 'iterate-plan');
  const viaCommit = ovdPlan.runGo({ projectDir, subcommand: 'iterate', text: 'I.1', entriesJson: JSON.stringify({ leaf_id: 'I.1', feedback: 'smaller' }) }, process.env);
  check('runGo iterate commit', viaCommit.ok === true && viaCommit.mode === 'iterate-commit');
  const badJson = ovdPlan.runGo({ projectDir, subcommand: 'iterate', text: 'I.1', entriesJson: '{bad' }, process.env);
  check('runGo iterate bad JSON guard', badJson.ok === false && /not valid JSON/.test(badJson.reason));
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 9. Migration-compat seam (Pattern 5)
// ---------------------------------------------------------------------------
console.log('Migration-compat seam (Pattern 5)');
{
  const { projectDir, tmpRoot } = makeTempProject('migration');
  writePlan(projectDir, FIXTURE_MIGRATION);
  check('migration plan → leaf-not-found, no crash', buildIteratePlan(projectDir, 'I.1').reason === 'leaf-not-found');
  check('migration commit → leaf-not-found, no crash', iterateOnLeaf(projectDir, { leaf_id: 'I.1', feedback: 'x' }, { now: NOW }).reason === 'leaf-not-found');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 10. Edge cases
// ---------------------------------------------------------------------------
console.log('Edge cases');
{
  const tree = parseOverdriveMd(FIXTURE).tree;
  check('getIterations on real leaf (none) → []', getIterations(findLeaf(tree, 'I.1')).length === 0);
}
{
  // appendIteration preserves other annotation fields
  const node = { id: 'I.1', annotations: { skills: ['alpha'], confidence: 'high' } };
  appendIteration(node, 'fix', null, NOW);
  check('append preserves skills', JSON.stringify(node.annotations.skills) === JSON.stringify(['alpha']));
  check('append preserves confidence', node.annotations.confidence === 'high');
}
check('normalizeIterateEntries non-string feedback', normalizeIterateEntries({ leaf_id: 'I.1', feedback: 5 }).reason === 'missing-feedback');
check('renderIterationHistory multiple', (() => {
  const t = renderIterationHistory({ annotations: { iterations: [{ session: NOW, feedback: 'a', delta_applied: 'x' }, { session: NOW2, feedback: 'b', delta_applied: 'pending' }] } });
  return /\[1\]/.test(t) && /\[2\]/.test(t) && /feedback: a/.test(t) && /feedback: b/.test(t);
})());
{
  const { projectDir, tmpRoot } = makeTempProject('edge');
  writePlan(projectDir, FIXTURE);
  // explicit delta_applied at capture
  const r = iterateOnLeaf(projectDir, { leaf_id: 'I.1', feedback: 'smaller', delta_applied: 'reduced to 16px' }, { now: NOW });
  check('explicit delta_applied persisted', leaf(projectDir, 'I.1').annotations.iterations[0].delta_applied === 'reduced to 16px');
  check('session file names iterate-<id>', /iterate-I\.1\.md$/.test(r.session_file));
  // iterate preserves leaf skills annotation (no clobber)
  check('iterate preserves skills annotation', JSON.stringify(leaf(projectDir, 'I.1').annotations.skills) === JSON.stringify(['alpha']));
  // runIterate default mode (no mode, no entries) → plan path (missing-ref)
  check('runIterate default → plan (missing-ref)', runIterate(projectDir, {}).reason === 'missing-ref');
  cleanup(tmpRoot);
}
check('whitespace leaf_id → missing-leaf-id', normalizeIterateEntries({ leaf_id: '   ', feedback: 'x' }).reason === 'missing-leaf-id');
check('appendIteration empty delta → pending', appendIteration({ annotations: {} }, 'fb', '', NOW).entry.delta_applied === 'pending');
{
  const { projectDir, tmpRoot } = makeTempProject('first-iter');
  writePlan(projectDir, FIXTURE);
  const r = iterateOnLeaf(projectDir, { leaf_id: 'I.1', feedback: 'only one' }, { now: NOW });
  check('first iteration has no Prior-iterations block', !/Prior iterations/.test(r.text));
  check('status_after always in-progress', r.status_after === 'in-progress');
  // history view after one capture shows it
  const hist = buildIteratePlan(projectDir, 'I.1');
  check('history after capture shows feedback', /only one/.test(hist.text));
  check('history count 1', hist.iteration_count === 1);
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
