#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const decision = require('../lib/ovd-plan/decision');
const {
  STATUS,
  KINDS,
  renderDecisionPrompt,
  normalizeDecisionPayload,
  surfaceDecisionPoint,
  normalizeResolution,
  resolveDecisionPoint,
  runDecision
} = decision;

const ovdPlan = require('../lib/ovd-plan');

const verbose = process.argv.includes('--verbose');
let passed = 0;
const failures = [];
function check(label, condition, detail) {
  if (condition) { passed += 1; if (verbose) console.log(`PASS ${label}`); }
  else { failures.push(detail ? `${label}: ${detail}` : label); console.log(`FAIL ${label}`); }
}

function makeTempProject(name) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-decision-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
  return { projectDir, tmpRoot };
}
function cleanup(tmpRoot) { fs.rmSync(tmpRoot, { recursive: true, force: true }); }
function readDecisions(projectDir) {
  const p = path.join(projectDir, '.overdrive', 'decisions.md');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

const PAYLOAD = {
  leaf_id: 'II.2.a',
  kind: 'scope-overflow',
  ambiguity: 'This needs to touch src/shared/api.ts, which is outside the leaf scope.',
  recommended: { label: 'Expand scope to include api.ts', reasoning: 'the change requires the shared client and no other leaf owns it' },
  alternatives: [{ label: 'Stub the call and defer the integration' }, { label: 'Split into a new leaf' }]
};
const RESOLUTION = { leaf_id: 'II.2.a', kind: 'scope-overflow', chosen: 'Expand scope to include api.ts', rationale: 'shared client needed now' };
const NOW = '2026-06-20T14:00:00.000Z';

// ---------------------------------------------------------------------------
// 1. Module surface
// ---------------------------------------------------------------------------
console.log('Module surface');
check('STATUS === "go"', STATUS === 'go');
check('KINDS has 5 (Q4.9)', KINDS.length === 5 && KINDS.includes('scope-overflow') && KINDS.includes('ambiguous-spec') && KINDS.includes('missing-dependency') && KINDS.includes('contract-conflict') && KINDS.includes('other'));
for (const fn of ['renderDecisionPrompt', 'normalizeDecisionPayload', 'surfaceDecisionPoint', 'normalizeResolution', 'resolveDecisionPoint', 'runDecision']) {
  check(`${fn} exported`, typeof decision[fn] === 'function');
}
check('ovdPlan.decision namespace', ovdPlan.decision === decision);
check('ovdPlan.runDecision wired', ovdPlan.runDecision === runDecision);

// ---------------------------------------------------------------------------
// 2. renderDecisionPrompt (Pattern 7)
// ---------------------------------------------------------------------------
console.log('renderDecisionPrompt');
{
  const norm = normalizeDecisionPayload(PAYLOAD);
  const txt = renderDecisionPrompt(norm);
  check('header with kind', /DECISION POINT — II\.2\.a \[scope-overflow\]/.test(txt));
  check('ambiguity shown', /outside the leaf scope/.test(txt));
  check('recommended is option 1 with reasoning + tag', /\(1\) Expand scope to include api\.ts — the change requires the shared client.*\[recommended\]/.test(txt));
  check('alternative 2', /\(2\) Stub the call and defer the integration/.test(txt));
  check('alternative 3', /\(3\) Split into a new leaf/.test(txt));
  check('other escape numbered after alternatives', /\(4\) other — describe what you want\./.test(txt));
  check('reply line', /Reply with a number or describe\./.test(txt));
}

// ---------------------------------------------------------------------------
// 3. normalizeDecisionPayload (Pattern 7 enforcement)
// ---------------------------------------------------------------------------
console.log('normalizeDecisionPayload');
check('null → invalid', normalizeDecisionPayload(null).ok === false);
check('missing leaf_id', normalizeDecisionPayload({ kind: 'other', ambiguity: 'x', recommended: { label: 'a', reasoning: 'b' } }).reason === 'missing-leaf-id');
check('invalid kind', normalizeDecisionPayload({ leaf_id: 'I.1', kind: 'weird', ambiguity: 'x', recommended: { label: 'a', reasoning: 'b' } }).reason === 'invalid-kind');
check('missing ambiguity', normalizeDecisionPayload({ leaf_id: 'I.1', kind: 'other', recommended: { label: 'a', reasoning: 'b' } }).reason === 'missing-ambiguity');
check('missing recommended (Pattern 7)', normalizeDecisionPayload({ leaf_id: 'I.1', kind: 'other', ambiguity: 'x' }).reason === 'missing-recommended');
check('recommended without reasoning rejected', normalizeDecisionPayload({ leaf_id: 'I.1', kind: 'other', ambiguity: 'x', recommended: { label: 'a' } }).reason === 'missing-recommended');
check('recommended without label rejected', normalizeDecisionPayload({ leaf_id: 'I.1', kind: 'other', ambiguity: 'x', recommended: { reasoning: 'b' } }).reason === 'missing-recommended');
check('valid', normalizeDecisionPayload(PAYLOAD).ok === true);
check('alternatives filtered (drop malformed)', normalizeDecisionPayload(Object.assign({}, PAYLOAD, { alternatives: [{ label: 'ok' }, { nope: 1 }, 'bad', { label: '' }] })).alternatives.length === 1);
check('no alternatives → []', normalizeDecisionPayload(Object.assign({}, PAYLOAD, { alternatives: undefined })).alternatives.length === 0);

// ---------------------------------------------------------------------------
// 4. surfaceDecisionPoint
// ---------------------------------------------------------------------------
console.log('surfaceDecisionPoint');
{
  const r = surfaceDecisionPoint(PAYLOAD);
  check('surface ok', r.ok === true && r.mode === 'decision-surface');
  check('surface leaf_id + kind', r.leaf_id === 'II.2.a' && r.kind === 'scope-overflow');
  check('option_count = 2 alts + 2', r.option_count === 4);
  check('surface text has recommended', /\[recommended\]/.test(r.text));
  check('surface missing-recommended rejected', surfaceDecisionPoint({ leaf_id: 'I.1', kind: 'other', ambiguity: 'x' }).reason === 'missing-recommended');
}

// ---------------------------------------------------------------------------
// 5. normalizeResolution
// ---------------------------------------------------------------------------
console.log('normalizeResolution');
check('null → invalid', normalizeResolution(null).ok === false);
check('missing leaf_id', normalizeResolution({ kind: 'other', chosen: 'x' }).reason === 'missing-leaf-id');
check('invalid kind', normalizeResolution({ leaf_id: 'I.1', kind: 'weird', chosen: 'x' }).reason === 'invalid-kind');
check('missing chosen', normalizeResolution({ leaf_id: 'I.1', kind: 'other' }).reason === 'missing-chosen');
check('valid', normalizeResolution(RESOLUTION).ok === true);
check('rationale default empty', normalizeResolution({ leaf_id: 'I.1', kind: 'other', chosen: 'x' }).rationale === '');

// ---------------------------------------------------------------------------
// 6. resolveDecisionPoint → decisions.md
// ---------------------------------------------------------------------------
console.log('resolveDecisionPoint');
{
  const { projectDir, tmpRoot } = makeTempProject('resolve');
  const r = resolveDecisionPoint(projectDir, RESOLUTION, { now: NOW });
  check('resolve ok', r.ok === true && r.mode === 'decision-resolve');
  check('resolve chosen + kind', r.chosen === 'Expand scope to include api.ts' && r.kind === 'scope-overflow');
  check('resume hint', /\/ovd-go execute II\.2\.a/.test(r.text));
  const dec = readDecisions(projectDir);
  check('decisions.md created', typeof dec === 'string' && dec.length > 0);
  check('decisions.md has kind-tagged decision (LEARNINGS)', /DECISION POINT \[scope-overflow\]: Expand scope to include api\.ts/.test(dec));
  check('decisions.md has node II.2.a', /II\.2\.a/.test(dec));
  check('decisions.md has rationale', /shared client needed now/.test(dec));
  check('decisions.md has date', /2026-06-20/.test(dec));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('resolve-err');
  check('resolve missing chosen', resolveDecisionPoint(projectDir, { leaf_id: 'I.1', kind: 'other' }, { now: NOW }).reason === 'missing-chosen');
  check('resolve invalid kind', resolveDecisionPoint(projectDir, { leaf_id: 'I.1', kind: 'x', chosen: 'y' }, { now: NOW }).reason === 'invalid-kind');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 7. runDecision dispatch + ovdPlan.runGo decision
// ---------------------------------------------------------------------------
console.log('runDecision + dispatch');
check('invalid dir', runDecision(null, {}).reason === 'invalid-project-dir');
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch');
  check('no entries → missing-entries', runDecision(projectDir, {}).reason === 'missing-entries');
  check('surface (no chosen)', runDecision(projectDir, { entries: PAYLOAD }).mode === 'decision-surface');
  check('resolve (chosen present)', runDecision(projectDir, { entries: RESOLUTION, now: NOW }).mode === 'decision-resolve');
  const viaSurface = ovdPlan.runGo({ projectDir, subcommand: 'decision', entriesJson: JSON.stringify(PAYLOAD) }, process.env);
  check('runGo decision surface', viaSurface.ok === true && viaSurface.mode === 'decision-surface');
  const viaResolve = ovdPlan.runGo({ projectDir, subcommand: 'decision', entriesJson: JSON.stringify(RESOLUTION) }, process.env);
  check('runGo decision resolve', viaResolve.ok === true && viaResolve.mode === 'decision-resolve');
  const badJson = ovdPlan.runGo({ projectDir, subcommand: 'decision', entriesJson: '{bad' }, process.env);
  check('runGo decision bad JSON guard', badJson.ok === false && /not valid JSON/.test(badJson.reason));
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 8. Migration-compat seam (Pattern 5) — resolve on a fresh project creates decisions.md
// ---------------------------------------------------------------------------
console.log('Migration-compat seam (Pattern 5)');
{
  const { projectDir, tmpRoot } = makeTempProject('migration');
  // no OVERDRIVE.md, no decisions.md — decision resolve must still record cleanly
  const r = resolveDecisionPoint(projectDir, RESOLUTION, { now: NOW });
  check('resolve on bare project → ok', r.ok === true);
  check('decisions.md created on bare project', readDecisions(projectDir) !== null);
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 9. All 5 kinds accepted (Q4.9) + edge cases
// ---------------------------------------------------------------------------
console.log('All kinds + edge cases');
for (const k of KINDS) {
  check(`payload kind ${k} accepted`, normalizeDecisionPayload({ leaf_id: 'I.1', kind: k, ambiguity: 'a', recommended: { label: 'l', reasoning: 'r' } }).ok === true);
  check(`resolution kind ${k} accepted`, normalizeResolution({ leaf_id: 'I.1', kind: k, chosen: 'c' }).ok === true);
}
{
  // zero alternatives → other becomes option 2
  const norm = normalizeDecisionPayload({ leaf_id: 'I.1', kind: 'other', ambiguity: 'a', recommended: { label: 'l', reasoning: 'r' }, alternatives: [] });
  const txt = renderDecisionPrompt(norm);
  check('no-alts: recommended is (1)', /\(1\) l — r/.test(txt));
  check('no-alts: other is (2)', /\(2\) other —/.test(txt));
  check('no-alts: surface option_count 2', surfaceDecisionPoint({ leaf_id: 'I.1', kind: 'other', ambiguity: 'a', recommended: { label: 'l', reasoning: 'r' } }).option_count === 2);
}
check('resolution rationale carried', normalizeResolution({ leaf_id: 'I.1', kind: 'other', chosen: 'c', rationale: 'because' }).rationale === 'because');
check('payload leaf_id trimmed', normalizeDecisionPayload({ leaf_id: '  I.1  ', kind: 'other', ambiguity: 'a', recommended: { label: 'l', reasoning: 'r' } }).leaf_id === 'I.1');
{
  // empty rationale still records; two resolutions append two rows
  const { projectDir, tmpRoot } = makeTempProject('multi');
  resolveDecisionPoint(projectDir, { leaf_id: 'I.1', kind: 'ambiguous-spec', chosen: 'A' }, { now: NOW });
  resolveDecisionPoint(projectDir, { leaf_id: 'I.2', kind: 'missing-dependency', chosen: 'B' }, { now: NOW });
  const dec = readDecisions(projectDir);
  check('two decisions recorded', /\[ambiguous-spec\]: A/.test(dec) && /\[missing-dependency\]: B/.test(dec));
  check('both nodes present', /I\.1/.test(dec) && /I\.2/.test(dec));
  cleanup(tmpRoot);
}
check('runDecision array entries → missing-entries', (() => { const { projectDir, tmpRoot } = makeTempProject('arr'); const r = runDecision(projectDir, { entries: [] }); cleanup(tmpRoot); return r.reason === 'missing-entries'; })());
check('surface missing leaf_id', surfaceDecisionPoint({ kind: 'other', ambiguity: 'a', recommended: { label: 'l', reasoning: 'r' } }).reason === 'missing-leaf-id');
check('surface invalid kind', surfaceDecisionPoint({ leaf_id: 'I.1', kind: 'x', ambiguity: 'a', recommended: { label: 'l', reasoning: 'r' } }).reason === 'invalid-kind');
check('surface missing ambiguity', surfaceDecisionPoint({ leaf_id: 'I.1', kind: 'other', recommended: { label: 'l', reasoning: 'r' } }).reason === 'missing-ambiguity');
check('ambiguity trimmed', normalizeDecisionPayload({ leaf_id: 'I.1', kind: 'other', ambiguity: '  a  ', recommended: { label: 'l', reasoning: 'r' } }).ambiguity === 'a');
check('chosen trimmed', normalizeResolution({ leaf_id: 'I.1', kind: 'other', chosen: '  pick  ' }).chosen === 'pick');
check('resolve returns leaf_id', (() => { const { projectDir, tmpRoot } = makeTempProject('rl'); const r = resolveDecisionPoint(projectDir, RESOLUTION, { now: NOW }); cleanup(tmpRoot); return r.leaf_id === 'II.2.a'; })());

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
