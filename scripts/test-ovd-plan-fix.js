#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const fix = require('../lib/ovd-plan/fix');
const {
  STATUS,
  MAX_ATTEMPTS,
  FIX_RESULTS,
  ESCALATION_DECISIONS,
  getFixAttempts,
  renderEscalation,
  buildFixPlan,
  normalizeFixEntries,
  applyFixAttempt,
  applyEscalationDecision,
  runFix
} = fix;

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
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-fix-${name}-`));
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

### I.1 Auth [in-progress]

${FENCE}
success:
  - login works
\`\`\`
`;
const FIXTURE_MIGRATION = '---\novd-plan: true\nversion: 3\nproject: "Migrated"\nactive_node: ""\n---\n\n# Migrated\n';

// ---------------------------------------------------------------------------
// 1. Module surface
// ---------------------------------------------------------------------------
console.log('Module surface');
check('STATUS === "go"', STATUS === 'go');
check('MAX_ATTEMPTS === 2', MAX_ATTEMPTS === 2);
check('FIX_RESULTS = pass/fail', JSON.stringify(FIX_RESULTS) === JSON.stringify(['pass', 'fail']));
check('ESCALATION_DECISIONS', JSON.stringify(ESCALATION_DECISIONS) === JSON.stringify(['try-once-more', 'replan', 'skip']));
for (const fn of ['getFixAttempts', 'renderEscalation', 'buildFixPlan', 'normalizeFixEntries', 'applyFixAttempt', 'applyEscalationDecision', 'runFix']) {
  check(`${fn} exported`, typeof fix[fn] === 'function');
}
check('ovdPlan.fix namespace', ovdPlan.fix === fix);
check('ovdPlan.runFix wired', ovdPlan.runFix === runFix);

// ---------------------------------------------------------------------------
// 2. getFixAttempts + renderEscalation
// ---------------------------------------------------------------------------
console.log('getFixAttempts + renderEscalation');
check('no annotations → []', getFixAttempts({ annotations: null }).length === 0);
check('non-array → []', getFixAttempts({ annotations: { fix_attempts: 'x' } }).length === 0);
{
  const node = { id: 'I.1', title: 'Auth' };
  const attempts = [{ attempt: 1, approach: 'null check', error: '500' }, { attempt: 2, approach: 'rewrite', error: 'still 500' }];
  const txt = renderEscalation(node, attempts, 'upstream API contract changed');
  check('escalation: failing-after-2', /still failing after 2 fix attempts/.test(txt));
  check('escalation: lists attempts', /attempt 1: approach="null check"/.test(txt) && /attempt 2: approach="rewrite"/.test(txt));
  check('escalation: hypothesis', /Hypothesis: upstream API contract changed/.test(txt));
  check('escalation: try-once-more', /\(1\) try-once-more/.test(txt));
  check('escalation: replan', /\(2\) replan/.test(txt));
  check('escalation: skip', /\(3\) skip/.test(txt));
  check('escalation: other', /\(4\) other/.test(txt));
}

// ---------------------------------------------------------------------------
// 3. buildFixPlan
// ---------------------------------------------------------------------------
console.log('buildFixPlan');
{
  const { projectDir, tmpRoot } = makeTempProject('plan');
  writePlan(projectDir, FIXTURE);
  const r = buildFixPlan(projectDir, 'I.1', { failureSummary: 'login returns 500' });
  check('attempt 1 plan', r.ok === true && r.mode === 'fix-plan' && r.attempt === 1);
  check('plan shows failure summary', /login returns 500/.test(r.text));
  check('plan attempt 1 = targeted fix', /targeted fix/.test(r.text));
  check('plan FM#7 verify-is-truth', /verify is the truth/.test(r.text));
  check('plan callback syntax', /overdrive go fix I\.1 --entries-json/.test(r.text));
  check('not-a-leaf', buildFixPlan(projectDir, 'I', {}).reason === 'not-a-leaf');
  check('leaf-not-found', buildFixPlan(projectDir, 'Z.9', {}).reason === 'leaf-not-found');
  check('missing-ref', buildFixPlan(projectDir, '', {}).reason === 'missing-ref');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('plan-noplan');
  check('missing-plan', buildFixPlan(projectDir, 'I.1', {}).reason === 'missing-plan');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 4. normalizeFixEntries (Pattern 4)
// ---------------------------------------------------------------------------
console.log('normalizeFixEntries');
check('null → invalid', normalizeFixEntries(null).ok === false);
check('missing leaf_id', normalizeFixEntries({ result: 'pass' }).reason === 'missing-leaf-id');
check('invalid result', normalizeFixEntries({ leaf_id: 'I.1', result: 'maybe' }).reason === 'invalid-result');
check('missing result', normalizeFixEntries({ leaf_id: 'I.1' }).reason === 'invalid-result');
check('valid', normalizeFixEntries({ leaf_id: 'I.1', result: 'fail', approach: 'x', error: 'e' }).ok === true);
check('approach default empty', normalizeFixEntries({ leaf_id: 'I.1', result: 'pass' }).approach === '');

// ---------------------------------------------------------------------------
// 5. applyFixAttempt — the attempt sequence
// ---------------------------------------------------------------------------
console.log('applyFixAttempt');
{
  // attempt 1 pass → awaiting-review
  const { projectDir, tmpRoot } = makeTempProject('pass1');
  writePlan(projectDir, FIXTURE);
  const r = applyFixAttempt(projectDir, { leaf_id: 'I.1', approach: 'add guard', result: 'pass' }, {});
  check('attempt1 pass → fix-passed', r.mode === 'fix-passed' && r.attempt === 1);
  check('attempt1 pass → awaiting-review (persisted)', leaf(projectDir, 'I.1').status === 'awaiting-review');
  check('attempt1 pass → fix_attempts[1] persisted', leaf(projectDir, 'I.1').annotations.fix_attempts.length === 1);
  check('attempt1 pass → review hint', /\/ovd-go review I\.1/.test(r.text));
  cleanup(tmpRoot);
}
{
  // attempt 1 fail → retry
  const { projectDir, tmpRoot } = makeTempProject('fail1');
  writePlan(projectDir, FIXTURE);
  const r = applyFixAttempt(projectDir, { leaf_id: 'I.1', approach: 'null check', result: 'fail', error: 'still 500' }, {});
  check('attempt1 fail → fix-retry', r.mode === 'fix-retry');
  check('attempt1 fail → 1 left text', /1 attempt left/.test(r.text));
  check('attempt1 fail → status stays in-progress', leaf(projectDir, 'I.1').status === 'in-progress');
  // buildFixPlan now → attempt 2 different-approach citing prior
  const p2 = buildFixPlan(projectDir, 'I.1', {});
  check('plan attempt 2', p2.attempt === 2);
  check('plan attempt2 cites prior approach', /Attempt 1 already tried: approach="null check"/.test(p2.text));
  check('plan attempt2 = different approach', /DIFFERENT approach/.test(p2.text));
  cleanup(tmpRoot);
}
{
  // attempt 1 fail, attempt 2 fail → escalate
  const { projectDir, tmpRoot } = makeTempProject('escalate');
  writePlan(projectDir, FIXTURE);
  applyFixAttempt(projectDir, { leaf_id: 'I.1', approach: 'a1', result: 'fail', error: 'e1' }, {});
  const r2 = applyFixAttempt(projectDir, { leaf_id: 'I.1', approach: 'a2', result: 'fail', error: 'e2' }, { hypothesis: 'API contract drift' });
  check('attempt2 fail → fix-escalate', r2.mode === 'fix-escalate' && r2.escalated === true);
  check('escalate text after 2 attempts', /still failing after 2 fix attempts/.test(r2.text));
  check('escalate lists both attempts', /attempt 1: approach="a1"/.test(r2.text) && /attempt 2: approach="a2"/.test(r2.text));
  check('escalate hypothesis', /Hypothesis: API contract drift/.test(r2.text));
  // cap reached: 3rd attempt rejected
  const r3 = applyFixAttempt(projectDir, { leaf_id: 'I.1', approach: 'a3', result: 'pass' }, {});
  check('cap-reached on 3rd attempt', r3.ok === false && r3.reason === 'cap-reached');
  // buildFixPlan at cap → escalation
  check('buildFixPlan at cap → fix-escalate', buildFixPlan(projectDir, 'I.1', {}).mode === 'fix-escalate');
  cleanup(tmpRoot);
}
{
  // attempt 1 fail, attempt 2 pass → "required 2 attempts"
  const { projectDir, tmpRoot } = makeTempProject('fail-then-pass');
  writePlan(projectDir, FIXTURE);
  applyFixAttempt(projectDir, { leaf_id: 'I.1', approach: 'a1', result: 'fail', error: 'e1' }, {});
  const r2 = applyFixAttempt(projectDir, { leaf_id: 'I.1', approach: 'a2', result: 'pass' }, {});
  check('attempt2 pass → fix-passed', r2.mode === 'fix-passed' && r2.attempt === 2);
  check('attempt2 pass → required 2 attempts note', /required 2 fix attempts/.test(r2.text));
  check('attempt2 pass → awaiting-review', leaf(projectDir, 'I.1').status === 'awaiting-review');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('commit-err');
  writePlan(projectDir, FIXTURE);
  check('leaf-not-found', applyFixAttempt(projectDir, { leaf_id: 'Z.9', result: 'pass' }, {}).reason === 'leaf-not-found');
  check('not-a-leaf', applyFixAttempt(projectDir, { leaf_id: 'I', result: 'pass' }, {}).reason === 'not-a-leaf');
  check('invalid result', applyFixAttempt(projectDir, { leaf_id: 'I.1', result: 'x' }, {}).reason === 'invalid-result');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 6. applyEscalationDecision (skip / replan / try-once-more)
// ---------------------------------------------------------------------------
console.log('applyEscalationDecision');
function seedEscalated(projectDir) {
  applyFixAttempt(projectDir, { leaf_id: 'I.1', approach: 'a1', result: 'fail', error: 'e1' }, {});
  applyFixAttempt(projectDir, { leaf_id: 'I.1', approach: 'a2', result: 'fail', error: 'e2' }, {});
}
{
  const { projectDir, tmpRoot } = makeTempProject('skip');
  writePlan(projectDir, FIXTURE);
  seedEscalated(projectDir);
  const r = applyEscalationDecision(projectDir, { leaf_id: 'I.1', escalation_decision: 'skip' }, {});
  check('skip → blocked (persisted)', r.ok === true && r.status_after === 'blocked' && leaf(projectDir, 'I.1').status === 'blocked');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('replan');
  writePlan(projectDir, FIXTURE);
  seedEscalated(projectDir);
  const r = applyEscalationDecision(projectDir, { leaf_id: 'I.1', escalation_decision: 'replan' }, {});
  check('replan → route text', /\/ovd-plan edit/.test(r.text));
  check('replan → status unchanged', leaf(projectDir, 'I.1').status === 'in-progress');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('once-more');
  writePlan(projectDir, FIXTURE);
  seedEscalated(projectDir);
  const r = applyEscalationDecision(projectDir, { leaf_id: 'I.1', escalation_decision: 'try-once-more' }, {});
  check('try-once-more → reset text', /reset/.test(r.text));
  check('try-once-more → fix_attempts cleared', getFixAttempts(leaf(projectDir, 'I.1')).length === 0);
  // a fresh attempt is now allowed
  check('fresh attempt allowed after reset', buildFixPlan(projectDir, 'I.1', {}).attempt === 1);
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('esc-err');
  writePlan(projectDir, FIXTURE);
  check('invalid decision', applyEscalationDecision(projectDir, { leaf_id: 'I.1', escalation_decision: 'nuke' }, {}).reason === 'invalid-decision');
  check('missing leaf_id', applyEscalationDecision(projectDir, { escalation_decision: 'skip' }, {}).reason === 'missing-leaf-id');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 7. runFix dispatch + ovdPlan.runGo fix
// ---------------------------------------------------------------------------
console.log('runFix + dispatch');
check('invalid dir', runFix(null, {}).reason === 'invalid-project-dir');
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch');
  writePlan(projectDir, FIXTURE);
  check('runFix plan', runFix(projectDir, { mode: 'plan', leafId: 'I.1' }).mode === 'fix-plan');
  check('runFix attempt commit', runFix(projectDir, { entries: { leaf_id: 'I.1', result: 'fail', approach: 'x', error: 'e' } }).mode === 'fix-retry');
  // escalation decision routed correctly
  check('runFix routes escalation_decision', runFix(projectDir, { entries: { leaf_id: 'I.1', escalation_decision: 'replan' } }).escalation_decision === 'replan');
  const viaPlan = ovdPlan.runGo({ projectDir, subcommand: 'fix', text: 'I.1' }, process.env);
  check('runGo fix plan', viaPlan.ok === true && viaPlan.mode === 'fix-plan');
  const badJson = ovdPlan.runGo({ projectDir, subcommand: 'fix', text: 'I.1', entriesJson: '{bad' }, process.env);
  check('runGo fix bad JSON guard', badJson.ok === false && /not valid JSON/.test(badJson.reason));
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 8. Migration-compat seam (Pattern 5)
// ---------------------------------------------------------------------------
console.log('Migration-compat seam (Pattern 5)');
{
  const { projectDir, tmpRoot } = makeTempProject('migration');
  writePlan(projectDir, FIXTURE_MIGRATION);
  check('migration plan → leaf-not-found, no crash', buildFixPlan(projectDir, 'I.1', {}).reason === 'leaf-not-found');
  check('migration commit → leaf-not-found, no crash', applyFixAttempt(projectDir, { leaf_id: 'I.1', result: 'fail' }, {}).reason === 'leaf-not-found');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 9. Edge cases
// ---------------------------------------------------------------------------
console.log('Edge cases');
check('renderEscalation no hypothesis → no Hypothesis line', !/Hypothesis:/.test(renderEscalation({ id: 'I.1' }, [{ attempt: 1, approach: 'a' }], null)));
check('normalizeFixEntries error/log carried', (() => { const n = normalizeFixEntries({ leaf_id: 'I.1', result: 'fail', error: 'e', log_excerpt: 'l' }); return n.error === 'e' && n.log_excerpt === 'l'; })());
check('normalizeFixEntries null defaults', (() => { const n = normalizeFixEntries({ leaf_id: 'I.1', result: 'pass' }); return n.error === null && n.log_excerpt === null; })());
{
  const { projectDir, tmpRoot } = makeTempProject('edge');
  writePlan(projectDir, FIXTURE);
  check('getFixAttempts real leaf (none) → []', getFixAttempts(leaf(projectDir, 'I.1')).length === 0);
  const r = applyFixAttempt(projectDir, { leaf_id: 'I.1', approach: 'x', result: 'fail', error: 'e' }, {});
  check('fail status_after in-progress', r.status_after === 'in-progress');
  check('buildFixPlan attempt 2 max_attempts field', buildFixPlan(projectDir, 'I.1', {}).max_attempts === 2);
  check('runFix default → plan (missing-ref)', runFix(projectDir, {}).reason === 'missing-ref');
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
