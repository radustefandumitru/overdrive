#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const verify = require('../lib/ovd-plan/verify');
const {
  STATUS,
  ALWAYS_AVAILABLE,
  KNOWN_METHODS,
  RESULTS,
  verifySpec,
  buildVerifyPlan,
  normalizeVerifyEntries,
  applyVerifyResult,
  runVerify
} = verify;

const ovdPlan = require('../lib/ovd-plan');
const { parseOverdriveMd } = require('../lib/ovd-plan/parser');
const { findLeaf } = require('../lib/ovd-plan/execute');

const verbose = process.argv.includes('--verbose');
let passed = 0;
const failures = [];
function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    if (verbose) console.log(`PASS ${label}`);
  } else {
    failures.push(detail ? `${label}: ${detail}` : label);
    console.log(`FAIL ${label}`);
  }
}

function makeTempProject(name) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-verify-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
  return { projectDir, tmpRoot };
}
function cleanup(tmpRoot) { fs.rmSync(tmpRoot, { recursive: true, force: true }); }
function writePlan(projectDir, content) { fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), content); }

const FENCE = '```yaml ovd-plan';
const FRONT = '---\novd-plan: true\nversion: 3\nproject: "Test Project"\n---\n\n';
// Positional leaves I.1 (full verify), I.2 (no annotation → defaults), I.3 (review_required false), I.4 (non-standard method).
const FIXTURE = `${FRONT}# Test Project

## I. Foundation [in-progress]

### I.1 Widget layout [in-progress]

${FENCE}
success:
  - renders at 3 breakpoints
verify:
  method: playwright_visual_regression
  fallback: agent_self_check_against_success_criteria
  review_required: true
\`\`\`

### I.2 Plain leaf [pending]

### I.3 Trivial leaf [pending]

${FENCE}
verify:
  method: api_response_check
  review_required: false
\`\`\`

### I.4 Custom leaf [pending]

${FENCE}
verify:
  method: playwright_full_dashboard_check
\`\`\`
`;
const FIXTURE_MIGRATION = '---\novd-plan: true\nversion: 3\nproject: "Migrated"\nactive_node: ""\n---\n\n# Migrated\n';
const NOW = '2026-06-19T13:00:00.000Z';

// ---------------------------------------------------------------------------
// 1. Module surface
// ---------------------------------------------------------------------------
console.log('Module surface');
check('STATUS === "go"', STATUS === 'go');
check('ALWAYS_AVAILABLE', ALWAYS_AVAILABLE === 'agent_self_check_against_success_criteria');
check('KNOWN_METHODS includes always-available', KNOWN_METHODS.includes(ALWAYS_AVAILABLE));
check('KNOWN_METHODS has v1 set', KNOWN_METHODS.includes('playwright_visual_regression') && KNOWN_METHODS.includes('react-doctor') && KNOWN_METHODS.includes('unit_test_run'));
check('RESULTS = pass/fail', JSON.stringify(RESULTS) === JSON.stringify(['pass', 'fail']));
for (const fn of ['verifySpec', 'buildVerifyPlan', 'normalizeVerifyEntries', 'applyVerifyResult', 'runVerify']) {
  check(`${fn} exported`, typeof verify[fn] === 'function');
}
check('ovdPlan.verify namespace', ovdPlan.verify === verify);
check('ovdPlan.runVerify wired', ovdPlan.runVerify === runVerify);

// ---------------------------------------------------------------------------
// 2. verifySpec (r3 §5.6 defaults)
// ---------------------------------------------------------------------------
console.log('verifySpec');
{
  const tree = parseOverdriveMd(FIXTURE).tree;
  const s1 = verifySpec(findLeaf(tree, 'I.1'));
  check('I.1 method', s1.method === 'playwright_visual_regression');
  check('I.1 fallback', s1.fallback === 'agent_self_check_against_success_criteria');
  check('I.1 review_required true', s1.review_required === true);
  check('I.1 success carried', s1.success[0] === 'renders at 3 breakpoints');
  const s2 = verifySpec(findLeaf(tree, 'I.2'));
  check('I.2 no-annotation → default method', s2.method === ALWAYS_AVAILABLE);
  check('I.2 default fallback', s2.fallback === ALWAYS_AVAILABLE);
  check('I.2 default review_required true', s2.review_required === true);
  check('I.2 empty success', s2.success.length === 0);
  const s3 = verifySpec(findLeaf(tree, 'I.3'));
  check('I.3 method api_response_check', s3.method === 'api_response_check');
  check('I.3 review_required false honored', s3.review_required === false);
  check('I.3 fallback defaults', s3.fallback === ALWAYS_AVAILABLE);
}

// ---------------------------------------------------------------------------
// 3. buildVerifyPlan
// ---------------------------------------------------------------------------
console.log('buildVerifyPlan');
{
  const { projectDir, tmpRoot } = makeTempProject('plan');
  writePlan(projectDir, FIXTURE);
  const r = buildVerifyPlan(projectDir, 'I.1', {});
  check('plan ok', r.ok === true && r.mode === 'verify-plan');
  check('plan leaf_id', r.leaf_id === 'I.1');
  check('plan method', r.method === 'playwright_visual_regression');
  check('plan methodKnown', r.methodKnown === true);
  check('plan text: Method line', /Method: playwright_visual_regression/.test(r.text));
  check('plan text: Fallback line', /Fallback: agent_self_check_against_success_criteria/.test(r.text));
  check('plan text: review_required', /review_required: true/.test(r.text));
  check('plan text: success criteria', /renders at 3 breakpoints/.test(r.text));
  check('plan text: transparent fallback instruction (Q4.2)', /fall back to/.test(r.text) && /never fail hard/.test(r.text));
  check('plan text: callback syntax', /overdrive go verify I\.1 --entries-json/.test(r.text));
  // non-standard method
  const r4 = buildVerifyPlan(projectDir, 'I.4', {});
  check('I.4 non-standard method flagged', r4.methodKnown === false && /non-standard/.test(r4.text));
  // default method when no annotation
  const r2 = buildVerifyPlan(projectDir, 'I.2', {});
  check('I.2 default method in plan', r2.method === ALWAYS_AVAILABLE);
  // errors
  check('not-a-leaf', buildVerifyPlan(projectDir, 'I', {}).reason === 'not-a-leaf');
  check('leaf-not-found', buildVerifyPlan(projectDir, 'Z.9', {}).reason === 'leaf-not-found');
  check('missing-ref', buildVerifyPlan(projectDir, '', {}).reason === 'missing-ref');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('noplan');
  check('missing-plan', buildVerifyPlan(projectDir, 'I.1', {}).reason === 'missing-plan');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 4. normalizeVerifyEntries (Pattern 4)
// ---------------------------------------------------------------------------
console.log('normalizeVerifyEntries');
check('null → invalid', normalizeVerifyEntries(null).ok === false);
check('array → invalid', normalizeVerifyEntries([]).ok === false);
check('missing leaf_id', normalizeVerifyEntries({ result: 'pass' }).reason === 'missing-leaf-id');
check('invalid result', normalizeVerifyEntries({ leaf_id: 'I.1', result: 'maybe' }).reason === 'invalid-result');
check('missing result invalid', normalizeVerifyEntries({ leaf_id: 'I.1' }).reason === 'invalid-result');
check('valid pass', normalizeVerifyEntries({ leaf_id: 'I.1', result: 'pass' }).ok === true);
check('findings filtered to strings', JSON.stringify(normalizeVerifyEntries({ leaf_id: 'I.1', result: 'fail', findings: ['a', 1, null, 'b'] }).findings) === JSON.stringify(['a', 'b']));
check('fallback_used coerced', normalizeVerifyEntries({ leaf_id: 'I.1', result: 'pass', fallback_used: true }).fallback_used === true);
check('fallback_used default false', normalizeVerifyEntries({ leaf_id: 'I.1', result: 'pass' }).fallback_used === false);
check('method_used carried', normalizeVerifyEntries({ leaf_id: 'I.1', result: 'pass', method_used: 'x' }).method_used === 'x');

// ---------------------------------------------------------------------------
// 5. applyVerifyResult
// ---------------------------------------------------------------------------
console.log('applyVerifyResult');
{
  const { projectDir, tmpRoot } = makeTempProject('pass');
  writePlan(projectDir, FIXTURE);
  const r = applyVerifyResult(projectDir, { leaf_id: 'I.1', result: 'pass', method_used: 'playwright_visual_regression', findings: ['all 3 breakpoints ok'] }, { now: NOW });
  check('pass ok', r.ok === true && r.mode === 'verify-commit');
  check('pass result', r.result === 'pass');
  check('pass text PASSED', /verification PASSED/.test(r.text));
  check('pass findings rendered', /all 3 breakpoints ok/.test(r.text));
  check('pass review_required → approve+advance', /approved — mark I\.1 done and advance/.test(r.text));
  check('pass re-verify option', /\/ovd-go verify I\.1 — re-verify/.test(r.text));
  check('pass session file written', typeof r.session_file === 'string' && fs.existsSync(path.join(projectDir, r.session_file)));
  const body = fs.readFileSync(path.join(projectDir, r.session_file), 'utf8');
  check('session report result line', /result: pass/.test(body));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('fail');
  writePlan(projectDir, FIXTURE);
  const r = applyVerifyResult(projectDir, { leaf_id: 'I.1', result: 'fail', findings: ['contrast too low'] }, { now: NOW });
  check('fail result', r.result === 'fail');
  check('fail text FAILED', /verification FAILED/.test(r.text));
  check('fail action: fix', /\(1\) fix/.test(r.text));
  check('fail action: replan', /\(2\) replan/.test(r.text));
  check('fail action: skip', /\(3\) skip/.test(r.text));
  check('fail action: Other escape', /Other —/i.test(r.text));
  check('fail references §6.9', /r3 §6\.9/.test(r.text));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('review-false');
  writePlan(projectDir, FIXTURE);
  const r = applyVerifyResult(projectDir, { leaf_id: 'I.3', result: 'pass' }, { now: NOW });
  check('review_required false → auto-advance note', /review_required:false/.test(r.text) && /may auto-advance/.test(r.text));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('fallback');
  writePlan(projectDir, FIXTURE);
  const r = applyVerifyResult(projectDir, { leaf_id: 'I.1', result: 'pass', method_used: 'agent_self_check_against_success_criteria', fallback_used: true }, { now: NOW });
  check('fallback_used noted in text', /\(fallback: agent_self_check_against_success_criteria\)/.test(r.text));
  check('fallback_used in result', r.fallback_used === true);
  const body = fs.readFileSync(path.join(projectDir, r.session_file), 'utf8');
  check('session fallback_used line', /fallback_used: true/.test(body));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('commit-err');
  writePlan(projectDir, FIXTURE);
  check('leaf-not-found commit', applyVerifyResult(projectDir, { leaf_id: 'Z.9', result: 'pass' }, { now: NOW }).reason === 'leaf-not-found');
  check('not-a-leaf commit', applyVerifyResult(projectDir, { leaf_id: 'I', result: 'pass' }, { now: NOW }).reason === 'not-a-leaf');
  check('invalid result commit', applyVerifyResult(projectDir, { leaf_id: 'I.1', result: 'x' }, { now: NOW }).reason === 'invalid-result');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 6. runVerify dispatch + ovdPlan.runGo verify
// ---------------------------------------------------------------------------
console.log('runVerify + dispatch');
check('invalid dir', runVerify(null, {}).reason === 'invalid-project-dir');
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch');
  writePlan(projectDir, FIXTURE);
  check('runVerify plan', runVerify(projectDir, { mode: 'plan', leafId: 'I.1' }).mode === 'verify-plan');
  check('runVerify commit', runVerify(projectDir, { mode: 'commit', entries: { leaf_id: 'I.1', result: 'pass' }, now: NOW }).mode === 'verify-commit');
  const viaPlan = ovdPlan.runGo({ projectDir, subcommand: 'verify', text: 'I.1' }, process.env);
  check('runGo verify plan', viaPlan.ok === true && viaPlan.mode === 'verify-plan');
  const viaCommit = ovdPlan.runGo({ projectDir, subcommand: 'verify', text: 'I.1', entriesJson: JSON.stringify({ leaf_id: 'I.1', result: 'pass' }) }, process.env);
  check('runGo verify commit', viaCommit.ok === true && viaCommit.mode === 'verify-commit');
  const badJson = ovdPlan.runGo({ projectDir, subcommand: 'verify', text: 'I.1', entriesJson: '{bad' }, process.env);
  check('runGo verify bad JSON guard', badJson.ok === false && /not valid JSON/.test(badJson.reason));
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 7. Migration-compat seam (Pattern 5)
// ---------------------------------------------------------------------------
console.log('Migration-compat seam (Pattern 5)');
{
  const { projectDir, tmpRoot } = makeTempProject('migration');
  writePlan(projectDir, FIXTURE_MIGRATION);
  check('migration-shape plan → leaf-not-found, no crash', buildVerifyPlan(projectDir, 'I.1', {}).reason === 'leaf-not-found');
  check('migration-shape commit → leaf-not-found, no crash', applyVerifyResult(projectDir, { leaf_id: 'I.1', result: 'pass' }, { now: NOW }).reason === 'leaf-not-found');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 8. Edge cases
// ---------------------------------------------------------------------------
console.log('Edge cases');
check('verifySpec null annotations → defaults', (() => { const s = verifySpec({ annotations: null }); return s.method === ALWAYS_AVAILABLE && s.review_required === true && s.fallback === ALWAYS_AVAILABLE; })());
{
  const { projectDir, tmpRoot } = makeTempProject('known-method');
  writePlan(projectDir, FIXTURE);
  check('I.3 api_response_check is methodKnown', buildVerifyPlan(projectDir, 'I.3', {}).methodKnown === true);
  // pass with no findings → no Findings section
  const r = applyVerifyResult(projectDir, { leaf_id: 'I.2', result: 'pass' }, { now: NOW });
  check('pass no findings → no Findings header', !/Findings:/.test(r.text));
  check('session file names verify-<id>', /verify-I\.2\.md$/.test(r.session_file));
  // runVerify default mode (no mode, no entries) → plan path (missing-ref here)
  check('runVerify default → plan (missing-ref)', runVerify(projectDir, {}).reason === 'missing-ref');
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
