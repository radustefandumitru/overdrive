#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  CALIBRATION_AXES,
  AXIS_LEVELS,
  OVERRIDE_KINDS,
  DELIBERATION_STATE_KEY,
  CALIBRATION_FIELD,
  readCalibration,
  buildCalibrationPlan,
  normalizeCalibration,
  applyCalibration,
  presentForCalibration,
  runCalibrate,
  formatPlan,
  formatCommit
} = require('../lib/ovd-plan/calibrate');

const ovdPlan = require('../lib/ovd-plan');
const calibrateModule = require('../lib/ovd-plan/calibrate');
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
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-calibrate-${name}-`));
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

function readPlan(projectDir) {
  return fs.readFileSync(path.join(projectDir, 'OVERDRIVE.md'), 'utf8');
}

const FIXED_NOW = '2026-06-13T10:30:00.000Z';

const FRONT = '---\novd-plan: true\nversion: 3\nproject: "Test Project"\n---\n\n';

const FIXTURE_NO_BLOCK = `${FRONT}# Test Project

## I. Foundation [pending]
`;

const FIXTURE_BLOCK_NO_CAL = `${FRONT}# Test Project

## I. Foundation [pending]

<!-- ovd-plan:deliberation-state:start -->
stage: elicit
last_question: "What's the primary user journey?"
<!-- ovd-plan:deliberation-state:end -->
`;

const FIXTURE_BLOCK_WITH_CAL = `${FRONT}# Test Project

## I. Foundation [pending]

<!-- ovd-plan:deliberation-state:start -->
stage: elicit
calibration:
  domain: low
  technical: medium
  scope: high
  override: none
  rationale: "Initial assessment"
  updated: "2026-06-12T08:00:00.000Z"
last_question: "What's the primary user journey?"
<!-- ovd-plan:deliberation-state:end -->
`;

console.log('ovd-plan calibrate tests');

// --- 0. Module surface ---
{
  check('CALIBRATION_AXES is the 3-axis array', Array.isArray(CALIBRATION_AXES) && CALIBRATION_AXES.length === 3);
  check('CALIBRATION_AXES = [domain, technical, scope]',
    CALIBRATION_AXES[0] === 'domain' && CALIBRATION_AXES[1] === 'technical' && CALIBRATION_AXES[2] === 'scope');
  check('AXIS_LEVELS = [low, medium, high]',
    Array.isArray(AXIS_LEVELS) && AXIS_LEVELS.join(',') === 'low,medium,high');
  check('OVERRIDE_KINDS includes Q3.2-locked verbosity options',
    Array.isArray(OVERRIDE_KINDS) && ['none', 'plain', 'detailed'].every((k) => OVERRIDE_KINDS.includes(k)));
  check('DELIBERATION_STATE_KEY = "deliberation-state"', DELIBERATION_STATE_KEY === 'deliberation-state');
  check('CALIBRATION_FIELD = "calibration"', CALIBRATION_FIELD === 'calibration');
  check('readCalibration is a function', typeof readCalibration === 'function');
  check('buildCalibrationPlan is a function', typeof buildCalibrationPlan === 'function');
  check('normalizeCalibration is a function', typeof normalizeCalibration === 'function');
  check('applyCalibration is a function', typeof applyCalibration === 'function');
  check('presentForCalibration is a function', typeof presentForCalibration === 'function');
  check('runCalibrate is a function', typeof runCalibrate === 'function');
  check('formatPlan is a function', typeof formatPlan === 'function');
  check('formatCommit is a function', typeof formatCommit === 'function');
}

// --- 1. readCalibration ---
{
  const { projectDir, tmpRoot } = makeTempProject('read-no-file');
  check('readCalibration: returns null when OVERDRIVE.md missing', readCalibration(projectDir) === null);
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('read-no-block');
  writePlan(projectDir, FIXTURE_NO_BLOCK);
  check('readCalibration: returns null when no deliberation-state block', readCalibration(projectDir) === null);
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('read-no-cal-field');
  writePlan(projectDir, FIXTURE_BLOCK_NO_CAL);
  check('readCalibration: returns null when block has no calibration field', readCalibration(projectDir) === null);
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('read-existing');
  writePlan(projectDir, FIXTURE_BLOCK_WITH_CAL);
  const cal = readCalibration(projectDir);
  check('readCalibration: returns object when present', cal !== null && typeof cal === 'object');
  check('readCalibration: domain = low', cal && cal.domain === 'low');
  check('readCalibration: technical = medium', cal && cal.technical === 'medium');
  check('readCalibration: scope = high', cal && cal.scope === 'high');
  check('readCalibration: override = none', cal && cal.override === 'none');
  cleanup(tmpRoot);
}

// --- 2. buildCalibrationPlan ---
{
  const { projectDir, tmpRoot } = makeTempProject('plan-fresh');
  writePlan(projectDir, FIXTURE_NO_BLOCK);
  const plan = buildCalibrationPlan(projectDir, {});
  check('buildCalibrationPlan: ok = true', plan.ok === true);
  check('buildCalibrationPlan: mode = "plan"', plan.mode === 'plan');
  check('buildCalibrationPlan: status = "calibrate"', plan.status === 'calibrate');
  check('buildCalibrationPlan: axes array has 3 entries', Array.isArray(plan.axes) && plan.axes.length === 3);
  check('buildCalibrationPlan: each axis has rubric + signals',
    plan.axes.every((a) => typeof a.axis === 'string' && typeof a.prompt === 'string' && a.levelRubric && Array.isArray(a.exampleSignals)));
  check('buildCalibrationPlan: every axis covers low/medium/high in rubric',
    plan.axes.every((a) => a.levelRubric.low && a.levelRubric.medium && a.levelRubric.high));
  check('buildCalibrationPlan: instructions[] present', Array.isArray(plan.instructions) && plan.instructions.length >= 3);
  check('buildCalibrationPlan: instructions mention observation-driven (not questionnaire)',
    plan.instructions.some((s) => /observ|infer|do not ask/i.test(s)));
  check('buildCalibrationPlan: currentCalibration is null when none', plan.currentCalibration === null);
  check('buildCalibrationPlan: commitSyntax present', typeof plan.commitSyntax === 'string' && plan.commitSyntax.includes('--entries-json'));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('plan-with-prior');
  writePlan(projectDir, FIXTURE_BLOCK_WITH_CAL);
  const plan = buildCalibrationPlan(projectDir, {});
  check('buildCalibrationPlan(prior exists): currentCalibration is the prior',
    plan.currentCalibration && plan.currentCalibration.domain === 'low');
  check('buildCalibrationPlan(prior): instructions hint at delta-only updates',
    plan.instructions.some((s) => /drift|delta|change|update/i.test(s)));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('plan-no-file');
  const plan = buildCalibrationPlan(projectDir, {});
  check('buildCalibrationPlan(no OVERDRIVE.md): ok = false', plan.ok === false);
  check('buildCalibrationPlan(no OVERDRIVE.md): reason = missing-plan', plan.reason === 'missing-plan');
  cleanup(tmpRoot);
}

// --- 3. normalizeCalibration ---
{
  const full = normalizeCalibration({ domain: 'medium', technical: 'high', scope: 'low' });
  check('normalizeCalibration(full): ok = true', full.ok === true);
  check('normalizeCalibration(full): calibration captured',
    full.calibration && full.calibration.domain === 'medium' && full.calibration.technical === 'high' && full.calibration.scope === 'low');

  const overrideOnly = normalizeCalibration({ override: 'plain' });
  check('normalizeCalibration(override-only): ok = true (partial allowed)', overrideOnly.ok === true);
  check('normalizeCalibration(override-only): override captured', overrideOnly.calibration.override === 'plain');

  const withRationale = normalizeCalibration({ domain: 'medium', technical: 'medium', scope: 'medium', rationale: 'observed reasoning' });
  check('normalizeCalibration: rationale preserved', withRationale.calibration.rationale === 'observed reasoning');

  const bad = normalizeCalibration({ domain: 'expert' });
  check('normalizeCalibration(invalid level): ok = false', bad.ok === false);
  check('normalizeCalibration(invalid level): errors mention "expert"',
    bad.errors && bad.errors.some((e) => /expert/.test(e)));

  const badOverride = normalizeCalibration({ override: 'verbose' });
  check('normalizeCalibration(invalid override): ok = false', badOverride.ok === false);

  const notObject = normalizeCalibration('hello');
  check('normalizeCalibration(string): ok = false', notObject.ok === false);

  const empty = normalizeCalibration({});
  check('normalizeCalibration({}): ok = false (must specify at least one field)', empty.ok === false);

  const arrayInput = normalizeCalibration([]);
  check('normalizeCalibration(array): ok = false', arrayInput.ok === false);

  const nullInput = normalizeCalibration(null);
  check('normalizeCalibration(null): ok = false', nullInput.ok === false);

  const overrideNone = normalizeCalibration({ override: 'none' });
  check('normalizeCalibration(override:none): ok = true', overrideNone.ok === true);
  check('normalizeCalibration(override:none): override = none', overrideNone.calibration.override === 'none');
}

// --- 4. applyCalibration (block writer) ---
{
  // Fresh: no block exists yet → creates one
  const { projectDir, tmpRoot } = makeTempProject('apply-fresh');
  writePlan(projectDir, FIXTURE_NO_BLOCK);
  const result = applyCalibration(projectDir, { domain: 'medium', technical: 'high', scope: 'low' }, { now: FIXED_NOW });
  check('applyCalibration(fresh): ok = true', result.ok === true);

  const after = readCalibration(projectDir);
  check('applyCalibration(fresh): readCalibration returns the new values',
    after && after.domain === 'medium' && after.technical === 'high' && after.scope === 'low');
  check('applyCalibration(fresh): updated timestamp = FIXED_NOW', after && after.updated === FIXED_NOW);
  cleanup(tmpRoot);
}
{
  // Block exists with sibling fields → calibration added; siblings preserved
  const { projectDir, tmpRoot } = makeTempProject('apply-preserve');
  writePlan(projectDir, FIXTURE_BLOCK_NO_CAL);
  applyCalibration(projectDir, { domain: 'low', technical: 'low', scope: 'low' }, { now: FIXED_NOW });

  const content = readPlan(projectDir);
  check('applyCalibration(preserve): siblings still present (stage: elicit)', content.includes('stage: elicit'));
  check('applyCalibration(preserve): siblings still present (last_question)',
    content.includes('What\'s the primary user journey?') || content.includes("What's the primary user journey?"));
  check('applyCalibration(preserve): calibration field added', content.includes('calibration:'));

  const cal = readCalibration(projectDir);
  check('applyCalibration(preserve): calibration values stored',
    cal && cal.domain === 'low' && cal.technical === 'low' && cal.scope === 'low');
  cleanup(tmpRoot);
}
{
  // Block already has prior calibration → updated; not duplicated
  const { projectDir, tmpRoot } = makeTempProject('apply-update');
  writePlan(projectDir, FIXTURE_BLOCK_WITH_CAL);
  applyCalibration(projectDir, { domain: 'high', technical: 'high', scope: 'medium' }, { now: FIXED_NOW });

  const cal = readCalibration(projectDir);
  check('applyCalibration(update): domain updated', cal && cal.domain === 'high');
  check('applyCalibration(update): technical updated', cal && cal.technical === 'high');
  check('applyCalibration(update): scope updated', cal && cal.scope === 'medium');
  check('applyCalibration(update): updated timestamp advanced', cal && cal.updated === FIXED_NOW);

  const content = readPlan(projectDir);
  check('applyCalibration(update): no duplicate calibration: keys', (content.match(/calibration:/g) || []).length === 1);
  cleanup(tmpRoot);
}
{
  // Override-only update preserves axes
  const { projectDir, tmpRoot } = makeTempProject('apply-override');
  writePlan(projectDir, FIXTURE_BLOCK_WITH_CAL);
  applyCalibration(projectDir, { override: 'plain' }, { now: FIXED_NOW });

  const cal = readCalibration(projectDir);
  check('applyCalibration(override-only): override set to plain', cal && cal.override === 'plain');
  check('applyCalibration(override-only): domain preserved from prior', cal && cal.domain === 'low');
  check('applyCalibration(override-only): technical preserved', cal && cal.technical === 'medium');
  check('applyCalibration(override-only): scope preserved', cal && cal.scope === 'high');
  cleanup(tmpRoot);
}
{
  // Idempotence with fixed `now`
  const { projectDir, tmpRoot } = makeTempProject('apply-idempotent');
  writePlan(projectDir, FIXTURE_NO_BLOCK);
  applyCalibration(projectDir, { domain: 'medium', technical: 'medium', scope: 'medium' }, { now: FIXED_NOW });
  const first = readPlan(projectDir);
  applyCalibration(projectDir, { domain: 'medium', technical: 'medium', scope: 'medium' }, { now: FIXED_NOW });
  const second = readPlan(projectDir);
  check('applyCalibration: idempotent with same input + same `now` → byte-equal file', first === second);
  cleanup(tmpRoot);
}
{
  // Missing OVERDRIVE.md → ok:false missing-plan
  const { projectDir, tmpRoot } = makeTempProject('apply-no-file');
  const result = applyCalibration(projectDir, { domain: 'medium', technical: 'medium', scope: 'medium' }, { now: FIXED_NOW });
  check('applyCalibration(no file): ok = false', result.ok === false);
  check('applyCalibration(no file): reason = missing-plan', result.reason === 'missing-plan');
  cleanup(tmpRoot);
}
{
  // Malformed YAML in deliberation-state block → ok:false, no clobber
  const malformedBlock = `${FRONT}# Test

<!-- ovd-plan:deliberation-state:start -->
this: is: invalid: yaml: : :
<!-- ovd-plan:deliberation-state:end -->
`;
  const { projectDir, tmpRoot } = makeTempProject('apply-malformed');
  writePlan(projectDir, malformedBlock);
  const before = readPlan(projectDir);
  const result = applyCalibration(projectDir, { domain: 'medium', technical: 'medium', scope: 'medium' }, { now: FIXED_NOW });
  check('applyCalibration(malformed block): ok = false', result.ok === false);
  check('applyCalibration(malformed block): reason = deliberation-state-malformed', result.reason === 'deliberation-state-malformed');
  check('applyCalibration(malformed block): file unchanged (no clobber)', readPlan(projectDir) === before);
  cleanup(tmpRoot);
}

// --- 5. presentForCalibration (Q3.2 verbosity-only) ---
{
  const text = 'This is the first sentence. This is the second sentence with more detail.\n\n- bullet one\n- bullet two\n  - nested';

  const noneResult = presentForCalibration(text, { override: 'none' });
  check('presentForCalibration(override=none): returns text unchanged', noneResult === text);

  const detailedResult = presentForCalibration(text, { override: 'detailed' });
  check('presentForCalibration(override=detailed): returns text unchanged', detailedResult === text);

  const plainResult = presentForCalibration(text, { override: 'plain' });
  check('presentForCalibration(override=plain): returns shorter or equal length', plainResult.length <= text.length);
  check('presentForCalibration(override=plain): drops nested bullets',
    !plainResult.includes('nested') || plainResult.length < text.length);

  const missingOverride = presentForCalibration(text, { domain: 'medium' });
  check('presentForCalibration(no override): defaults to unchanged', missingOverride === text);

  const nullCal = presentForCalibration(text, null);
  check('presentForCalibration(null calibration): returns unchanged', nullCal === text);

  // Q3.2 lock: domain/technical/scope axes do NOT affect verbosity
  const highDomain = presentForCalibration(text, { domain: 'high', technical: 'high', scope: 'high', override: 'none' });
  check('presentForCalibration(high axes, override=none): verbosity-only Q3.2 lock = no change', highDomain === text);
}

// --- 6. runCalibrate plan mode ---
{
  const { projectDir, tmpRoot } = makeTempProject('run-plan');
  writePlan(projectDir, FIXTURE_NO_BLOCK);
  const result = runCalibrate(projectDir, { mode: 'plan' });
  check('runCalibrate(plan): ok = true', result.ok === true);
  check('runCalibrate(plan): mode = plan', result.mode === 'plan');
  check('runCalibrate(plan): status = calibrate', result.status === 'calibrate');
  check('runCalibrate(plan): axes present', Array.isArray(result.axes) && result.axes.length === 3);
  cleanup(tmpRoot);
}

// --- 7. runCalibrate commit mode ---
{
  const { projectDir, tmpRoot } = makeTempProject('run-commit');
  writePlan(projectDir, FIXTURE_NO_BLOCK);
  const result = runCalibrate(projectDir, { mode: 'commit', entries: { domain: 'high', technical: 'low', scope: 'medium' }, now: FIXED_NOW });
  check('runCalibrate(commit): ok = true', result.ok === true);
  check('runCalibrate(commit): mode = commit', result.mode === 'commit');
  check('runCalibrate(commit): calibration applied',
    readCalibration(projectDir).domain === 'high');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('run-commit-bad');
  writePlan(projectDir, FIXTURE_NO_BLOCK);
  const result = runCalibrate(projectDir, { mode: 'commit', entries: { domain: 'expert' }, now: FIXED_NOW });
  check('runCalibrate(commit, invalid level): ok = false', result.ok === false);
  cleanup(tmpRoot);
}

// --- 8. Dispatch routing through ovdPlan.runPlan ---
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-plan');
  writePlan(projectDir, FIXTURE_NO_BLOCK);
  const result = ovdPlan.runPlan({ subcommand: 'calibrate', projectDir, projectDirProvided: true }, process.env);
  check('runPlan(calibrate, no entries): plan mode, ok = true', result.ok === true && result.mode === 'plan');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-commit');
  writePlan(projectDir, FIXTURE_NO_BLOCK);
  const entriesJson = JSON.stringify({ domain: 'medium', technical: 'medium', scope: 'low' });
  const result = ovdPlan.runPlan({ subcommand: 'calibrate', entriesJson, projectDir, projectDirProvided: true }, process.env);
  check('runPlan(calibrate, --entries-json): commit mode, ok = true', result.ok === true && result.mode === 'commit');
  check('runPlan(calibrate, --entries-json): calibration written', readCalibration(projectDir).domain === 'medium');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-bad-json');
  writePlan(projectDir, FIXTURE_NO_BLOCK);
  const result = ovdPlan.runPlan({ subcommand: 'calibrate', entriesJson: '{not json', projectDir, projectDirProvided: true }, process.env);
  check('runPlan(calibrate, bad JSON): ok = false', result.ok === false);
  check('runPlan(calibrate, bad JSON): reason mentions JSON', result.reason && /JSON/i.test(result.reason));
  check('runPlan(calibrate, bad JSON): NO file write occurred (Pattern 4)', readCalibration(projectDir) === null);
  cleanup(tmpRoot);
}

// --- 9. Migration-compat seam (Pattern 5) ---
{
  // Migration-shape OVERDRIVE.md (frontmatter + root only, no tree, no deliberation-state).
  // Calibration must work on it without crashing.
  const migrationLike = `---
ovd-plan: true
version: 3
project: "Migrated"
active_node: ""
---

# Migrated
`;
  const { projectDir, tmpRoot } = makeTempProject('migration-compat');
  writePlan(projectDir, migrationLike);
  const result = applyCalibration(projectDir, { domain: 'medium', technical: 'medium', scope: 'medium' }, { now: FIXED_NOW });
  check('applyCalibration(migration-shape): ok = true', result.ok === true);
  check('applyCalibration(migration-shape): readback works', readCalibration(projectDir).domain === 'medium');
  cleanup(tmpRoot);
}

// --- 10. Namespace + top-level exports ---
{
  check('ovdPlan.calibrate namespace exported', ovdPlan.calibrate === calibrateModule);
  check('ovdPlan.runCalibrate top-level exported', typeof ovdPlan.runCalibrate === 'function');
  check('ovdPlan.runCalibrate matches module export', ovdPlan.runCalibrate === calibrateModule.runCalibrate);
}

// --- 11. formatPlan / formatCommit output ---
{
  const { projectDir, tmpRoot } = makeTempProject('format-plan');
  writePlan(projectDir, FIXTURE_NO_BLOCK);
  const plan = buildCalibrationPlan(projectDir, {});
  const text = formatPlan(plan);
  check('formatPlan: includes the 3 axis names', /domain/i.test(text) && /technical/i.test(text) && /scope/i.test(text));
  check('formatPlan: includes "low/medium/high"', text.includes('low') && text.includes('medium') && text.includes('high'));
  check('formatPlan: includes commit syntax hint', text.includes('--entries-json'));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('format-commit');
  writePlan(projectDir, FIXTURE_NO_BLOCK);
  const result = runCalibrate(projectDir, { mode: 'commit', entries: { domain: 'low', technical: 'high', scope: 'medium' }, now: FIXED_NOW });
  const text = formatCommit(result);
  check('formatCommit: includes "calibration written" or equivalent', /calibration|written|applied|saved/i.test(text));
  check('formatCommit: mentions axis values', text.includes('low') && text.includes('high') && text.includes('medium'));
  cleanup(tmpRoot);
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
