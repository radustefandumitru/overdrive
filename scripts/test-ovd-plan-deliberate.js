#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const deliberate = require('../lib/ovd-plan/deliberate');
const {
  STAGES,
  STATE_KEYS,
  LEAF_REQUIRED_FIELDS,
  currentStage,
  currentTurn,
  lastQuestion,
  openThreads,
  proposedTree,
  buildElicitTurn,
  applyElicitTurn,
  buildSpecTurn,
  applySpecTurn,
  buildPlanTurn,
  applyPlanTurn,
  buildPresentTurn,
  applyPresentTurn,
  buildCommitTurn,
  applyCommitTurn,
  runDeliberate,
  formatPlan,
  formatCommit,
  validateLeaf,
  findNodeById,
  buildLeafAnnotations,
  buildMilestoneNode,
  renderProposedTree,
  reorderInner
} = deliberate;

const ovdPlan = require('../lib/ovd-plan');
const { parseOverdriveMd } = require('../lib/ovd-plan/parser');
const { readDeliberationState } = require('../lib/ovd-plan/deliberation-state');

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
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-deliberate-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
  return { projectDir, tmpRoot };
}
function cleanup(tmpRoot) { fs.rmSync(tmpRoot, { recursive: true, force: true }); }
function writePlan(projectDir, content) { fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), content); }
function readPlan(projectDir) { return fs.readFileSync(path.join(projectDir, 'OVERDRIVE.md'), 'utf8'); }

// Test-internal helper: skip blind_spot stage by direct state mutation.
// Blind-spot module owns its own tests for the full Stage 3 cycle (insert + prune);
// deliberate's tests use this skip to exercise the rest of the state machine in isolation.
// Per spec resolution (Q3.4.1-followup): blind_spot sits between spec and plan in STAGES,
// so this helper transitions blind_spot → plan (not blind_spot → spec).
function skipBlindSpot(projectDir) {
  const { openState, commitState } = require('../lib/ovd-plan/deliberation-state');
  const opened = openState(projectDir);
  opened.innerObj.stage = 'plan';
  if (opened.innerObj.blind_spot_inserted !== undefined) delete opened.innerObj.blind_spot_inserted;
  commitState(projectDir, opened);
}

const FIXED_NOW = '2026-06-13T11:00:00.000Z';
const FIXED_NOW_2 = '2026-06-13T11:05:00.000Z';

const FRONT = '---\novd-plan: true\nversion: 3\nproject: "Test Project"\n---\n\n';
const FIXTURE_FRESH = `${FRONT}# Test Project
`;
const FIXTURE_WITH_CAL = `${FRONT}# Test Project

<!-- ovd-plan:deliberation-state:start -->
calibration:
  domain: medium
  technical: high
  scope: low
  override: none
  updated: "2026-06-13T10:00:00.000Z"
<!-- ovd-plan:deliberation-state:end -->
`;

function freshLeaf(id, title) {
  return {
    id, title,
    description: `Description for ${title}`,
    scope: { in: ['src/'], out: ['build/'] },
    success: [`${title} works`],
    verify: { method: 'vitest', fallback: 'agent_self_check_against_success', review_required: true },
    deps: []
  };
}

// ===========================================================================
// Module surface
// ===========================================================================
console.log('module surface');
check('exports STAGES (array)', Array.isArray(STAGES));
check('STAGES contains elicit', STAGES.includes('elicit'));
check('STAGES contains blind_spot', STAGES.includes('blind_spot'));
check('STAGES contains spec', STAGES.includes('spec'));
check('STAGES contains plan', STAGES.includes('plan'));
check('STAGES contains present', STAGES.includes('present'));
check('STAGES contains commit', STAGES.includes('commit'));
check('STAGES contains committed', STAGES.includes('committed'));
check('STAGES has 7 entries', STAGES.length === 7);
check('STAGES order: elicit before spec', STAGES.indexOf('elicit') < STAGES.indexOf('spec'));
check('STAGES order: spec before blind_spot', STAGES.indexOf('spec') < STAGES.indexOf('blind_spot'));
check('STAGES order: blind_spot before plan', STAGES.indexOf('blind_spot') < STAGES.indexOf('plan'));
check('exports STATE_KEYS', Array.isArray(STATE_KEYS) && STATE_KEYS.length >= 8);
check('STATE_KEYS includes calibration', STATE_KEYS.includes('calibration'));
check('STATE_KEYS includes stage', STATE_KEYS.includes('stage'));
check('STATE_KEYS includes turn_count', STATE_KEYS.includes('turn_count'));
check('STATE_KEYS includes answered_questions', STATE_KEYS.includes('answered_questions'));
check('STATE_KEYS includes proposed_tree', STATE_KEYS.includes('proposed_tree'));
check('STATE_KEYS includes open_threads', STATE_KEYS.includes('open_threads'));
check('STATE_KEYS includes current_proposal_revision', STATE_KEYS.includes('current_proposal_revision'));
check('STATE_KEYS includes last_action', STATE_KEYS.includes('last_action'));
check('exports LEAF_REQUIRED_FIELDS', Array.isArray(LEAF_REQUIRED_FIELDS) && LEAF_REQUIRED_FIELDS.length >= 7);
const stageHandlers = ['Elicit', 'Spec', 'Plan', 'Present', 'Commit'];
for (const s of stageHandlers) {
  check(`build${s}Turn is a function`, typeof deliberate[`build${s}Turn`] === 'function');
  check(`apply${s}Turn is a function`, typeof deliberate[`apply${s}Turn`] === 'function');
}
check('runDeliberate function', typeof runDeliberate === 'function');
check('formatPlan function', typeof formatPlan === 'function');
check('formatCommit function', typeof formatCommit === 'function');
check('currentStage helper', typeof currentStage === 'function');
check('currentTurn helper', typeof currentTurn === 'function');
check('lastQuestion helper', typeof lastQuestion === 'function');
check('openThreads helper', typeof openThreads === 'function');
check('proposedTree helper', typeof proposedTree === 'function');
check('validateLeaf helper', typeof validateLeaf === 'function');
check('findNodeById helper', typeof findNodeById === 'function');
check('buildLeafAnnotations helper', typeof buildLeafAnnotations === 'function');
check('buildMilestoneNode helper', typeof buildMilestoneNode === 'function');
check('renderProposedTree helper', typeof renderProposedTree === 'function');
check('reorderInner helper', typeof reorderInner === 'function');

// ===========================================================================
// State helpers
// ===========================================================================
console.log('state helpers');
check('currentStage default to elicit on empty', currentStage({}) === 'elicit');
check('currentStage default to elicit on null', currentStage(null) === 'elicit');
check('currentStage returns stored stage if valid', currentStage({ stage: 'plan' }) === 'plan');
check('currentStage default on invalid stage', currentStage({ stage: 'invalid-stage' }) === 'elicit');
check('currentTurn default 0', currentTurn({}) === 0);
check('currentTurn returns turn_count if number', currentTurn({ turn_count: 3 }) === 3);
check('currentTurn 0 on non-number', currentTurn({ turn_count: 'three' }) === 0);
check('lastQuestion null on empty', lastQuestion({}) === null);
check('lastQuestion null on missing array', lastQuestion({ answered_questions: 'not array' }) === null);
check('lastQuestion returns last answered question text',
  lastQuestion({ answered_questions: [{ question: 'first' }, { question: 'second' }] }) === 'second');
check('openThreads empty default', JSON.stringify(openThreads({})) === '[]');
check('openThreads returns copy of array',
  JSON.stringify(openThreads({ open_threads: ['a', 'b'] })) === '["a","b"]');
check('proposedTree null default', proposedTree({}) === null);
check('proposedTree returns object', proposedTree({ proposed_tree: { milestones: [] } }).milestones.length === 0);
{
  const reordered = reorderInner({ extra_field: true, stage: 'elicit', calibration: { d: 1 } });
  const keys = Object.keys(reordered);
  check('reorderInner: calibration before stage', keys.indexOf('calibration') < keys.indexOf('stage'));
  check('reorderInner: stage before extra_field', keys.indexOf('stage') < keys.indexOf('extra_field'));
  check('reorderInner preserves unknown keys', 'extra_field' in reordered);
}

// ===========================================================================
// Stage 2 Elicit — plan mode
// ===========================================================================
console.log('Stage 2 Elicit — plan');
{
  // No file at all
  const { projectDir, tmpRoot } = makeTempProject('elicit-plan-missing');
  const r = buildElicitTurn(projectDir);
  check('elicit-plan missing: ok=false', r.ok === false);
  check('elicit-plan missing: reason=missing-plan', r.reason === 'missing-plan');
  cleanup(tmpRoot);
}
{
  // Fresh project, no calibration, no prior state
  const { projectDir, tmpRoot } = makeTempProject('elicit-plan-fresh');
  writePlan(projectDir, FIXTURE_FRESH);
  const r = buildElicitTurn(projectDir);
  check('elicit-plan fresh: ok=true', r.ok === true);
  check('elicit-plan fresh: stage=elicit', r.stage === 'elicit');
  check('elicit-plan fresh: turn=1', r.turn === 1);
  check('elicit-plan fresh: calibration null', r.calibration === null);
  check('elicit-plan fresh: text mentions no calibration', /Calibration: NONE/.test(r.text));
  check('elicit-plan fresh: text presents action paths', /\(1\).*calibrate.*\(2\).*proceed.*\(3\).*describe other/is.test(r.text));
  check('elicit-plan fresh: lastQuestion null', r.lastQuestion === null);
  check('elicit-plan fresh: openThreads empty', Array.isArray(r.openThreads) && r.openThreads.length === 0);
  check('elicit-plan fresh: text mentions commit syntax', /--entries-json/.test(r.text));
  cleanup(tmpRoot);
}
{
  // With calibration, no prior state
  const { projectDir, tmpRoot } = makeTempProject('elicit-plan-with-cal');
  writePlan(projectDir, FIXTURE_WITH_CAL);
  const r = buildElicitTurn(projectDir);
  check('elicit-plan-cal: ok=true', r.ok === true);
  check('elicit-plan-cal: calibration present', r.calibration && r.calibration.domain === 'medium');
  check('elicit-plan-cal: text renders domain', /domain:.*medium/.test(r.text));
  check('elicit-plan-cal: text renders technical', /technical:.*high/.test(r.text));
  check('elicit-plan-cal: text renders scope', /scope:.*low/.test(r.text));
  cleanup(tmpRoot);
}

// ===========================================================================
// Stage 2 Elicit — commit (happy + transitions + sibling preserve)
// ===========================================================================
console.log('Stage 2 Elicit — commit');
{
  // Happy path: write one elicit answer; no transition
  const { projectDir, tmpRoot } = makeTempProject('elicit-commit-happy');
  writePlan(projectDir, FIXTURE_WITH_CAL);
  // Plan first to seed "current question". With no last question, applyElicitTurn records a default.
  const r = applyElicitTurn(projectDir, { answer: 'A test answer.', turn_id: 1 }, { now: FIXED_NOW });
  check('elicit-commit happy: ok=true', r.ok === true);
  check('elicit-commit happy: stage=elicit (no transition)', r.stage === 'elicit');
  check('elicit-commit happy: turn_count=1', r.turn_count === 1);
  // Verify persisted state
  const persisted = readDeliberationState(projectDir);
  check('persisted: stage=elicit', persisted.stage === 'elicit');
  check('persisted: turn_count=1', persisted.turn_count === 1);
  check('persisted: answered_questions length=1', persisted.answered_questions.length === 1);
  check('persisted: answer recorded', persisted.answered_questions[0].answer === 'A test answer.');
  check('persisted: timestamp set', persisted.answered_questions[0].timestamp === FIXED_NOW);
  // Sibling preservation: calibration block still intact
  check('persisted: calibration sibling preserved', persisted.calibration && persisted.calibration.domain === 'medium');
  cleanup(tmpRoot);
}
{
  // Transition to spec (Stage 4)
  const { projectDir, tmpRoot } = makeTempProject('elicit-commit-transition');
  writePlan(projectDir, FIXTURE_WITH_CAL);
  applyElicitTurn(projectDir, { answer: 'Answer 1', turn_id: 1 }, { now: FIXED_NOW });
  const r = applyElicitTurn(projectDir, { answer: 'Answer 2', turn_id: 2, transition: 'spec' }, { now: FIXED_NOW_2 });
  check('elicit-transition: stage=spec', r.stage === 'spec');
  check('elicit-transition: transitioned=true', r.transitioned === true);
  check('elicit-transition: text mentions Stage 4', /Stage 4|Spec/.test(r.text));
  const persisted = readDeliberationState(projectDir);
  check('persisted: stage advanced to spec', persisted.stage === 'spec');
  check('persisted: turn_count=2', persisted.turn_count === 2);
  cleanup(tmpRoot);
}
{
  // Classification with followup_questions feeds open_threads
  const { projectDir, tmpRoot } = makeTempProject('elicit-followups');
  writePlan(projectDir, FIXTURE_WITH_CAL);
  const r = applyElicitTurn(projectDir, {
    answer: 'A',
    turn_id: 1,
    classification: { followup_questions: ['What about offline?', 'What is the auth provider?'], branch_signal: null }
  }, { now: FIXED_NOW });
  check('elicit-followups: ok', r.ok === true);
  const persisted = readDeliberationState(projectDir);
  check('open_threads populated (2)', Array.isArray(persisted.open_threads) && persisted.open_threads.length === 2);
  check('open_threads has first', persisted.open_threads[0] === 'What about offline?');
  check('open_threads has second', persisted.open_threads[1] === 'What is the auth provider?');
  cleanup(tmpRoot);
}
{
  // Validation rejections
  const { projectDir, tmpRoot } = makeTempProject('elicit-reject');
  writePlan(projectDir, FIXTURE_WITH_CAL);
  let r;
  r = applyElicitTurn(projectDir, null);
  check('elicit reject null', r.ok === false && r.reason === 'invalid-shape');
  r = applyElicitTurn(projectDir, []);
  check('elicit reject array', r.ok === false && r.reason === 'invalid-shape');
  r = applyElicitTurn(projectDir, { turn_id: 1 });
  check('elicit reject missing answer', r.ok === false && r.reason === 'missing-answer');
  r = applyElicitTurn(projectDir, { answer: '   ', turn_id: 1 });
  check('elicit reject whitespace answer', r.ok === false && r.reason === 'missing-answer');
  r = applyElicitTurn(projectDir, { answer: 'A' });
  check('elicit reject missing turn_id', r.ok === false && r.reason === 'missing-turn-id');
  r = applyElicitTurn(projectDir, { answer: 'A', turn_id: 'one' });
  check('elicit reject string turn_id', r.ok === false && r.reason === 'missing-turn-id');
  r = applyElicitTurn(projectDir, { answer: 'A', turn_id: 1.5 });
  check('elicit reject non-integer turn_id', r.ok === false && r.reason === 'missing-turn-id');
  r = applyElicitTurn(projectDir, { answer: 'A', turn_id: 1, transition: 'plan' });
  check('elicit reject invalid transition (plan)', r.ok === false && r.reason === 'invalid-transition');
  r = applyElicitTurn(projectDir, { answer: 'A', turn_id: 1, transition: 'blind_spot' });
  check('elicit reject invalid transition (blind_spot — only via spec)', r.ok === false && r.reason === 'invalid-transition');
  r = applyElicitTurn(projectDir, { answer: 'A', turn_id: 5 });
  check('elicit reject turn-id-mismatch', r.ok === false && r.reason === 'turn-id-mismatch');
  cleanup(tmpRoot);
}
{
  // Stage mismatch: try to elicit when stage='spec' (post-transition)
  const { projectDir, tmpRoot } = makeTempProject('elicit-stage-mismatch');
  writePlan(projectDir, FIXTURE_WITH_CAL);
  applyElicitTurn(projectDir, { answer: 'A', turn_id: 1, transition: 'spec' }, { now: FIXED_NOW });
  const r = applyElicitTurn(projectDir, { answer: 'B', turn_id: 2 }, { now: FIXED_NOW_2 });
  check('elicit stage-mismatch (now spec)', r.ok === false && r.reason === 'stage-mismatch');
  cleanup(tmpRoot);
}

// ===========================================================================
// Stage 4 Spec — plan + commit
// ===========================================================================
console.log('Stage 4 Spec');
function seedToSpec(projectDir) {
  writePlan(projectDir, FIXTURE_WITH_CAL);
  applyElicitTurn(projectDir, { answer: 'Need login.', turn_id: 1, transition: 'spec' }, { now: FIXED_NOW });
}
{
  const { projectDir, tmpRoot } = makeTempProject('spec-plan');
  seedToSpec(projectDir);
  const r = buildSpecTurn(projectDir);
  check('spec-plan: ok', r.ok === true);
  check('spec-plan: stage=spec', r.stage === 'spec');
  check('spec-plan: lists answered question', /Q1: \(initial elicit/.test(r.text) || /Need login/.test(r.text));
  check('spec-plan: instructions include 1-5 rubric', /1 = unambiguous/.test(r.text) && /5 = blocks/.test(r.text));
  cleanup(tmpRoot);
}
{
  // Happy commit
  const { projectDir, tmpRoot } = makeTempProject('spec-commit');
  seedToSpec(projectDir);
  const r = applySpecTurn(projectDir, {
    milestones: [
      { id: 'I', title: 'Foundation', description: 'Auth + DB.', ambiguity_score: 2 },
      { id: 'II', title: 'Dashboard', description: 'Stats widgets.', ambiguity_score: 3 }
    ],
    transition: 'blind_spot'
  }, { now: FIXED_NOW_2 });
  check('spec-commit happy ok', r.ok === true);
  check('spec-commit stage=blind_spot', r.stage === 'blind_spot');
  check('spec-commit transitioned', r.transitioned === true);
  check('spec-commit text mentions Stage 3', /Stage 3|Blind-spot/.test(r.text));
  check('spec-commit milestonesWritten=2', r.milestonesWritten === 2);
  const persisted = readDeliberationState(projectDir);
  check('persisted proposed_tree has 2 milestones', persisted.proposed_tree.milestones.length === 2);
  check('persisted milestone[0].id', persisted.proposed_tree.milestones[0].id === 'I');
  check('persisted milestone[0].ambiguity_score', persisted.proposed_tree.milestones[0].ambiguity_score === 2);
  check('persisted milestone[0].children empty (Slice A)', persisted.proposed_tree.milestones[0].children.length === 0);
  check('persisted last_revision=1', persisted.proposed_tree.last_revision === 1);
  check('persisted current_proposal_revision=1', persisted.current_proposal_revision === 1);
  // Sibling preservation
  check('calibration sibling preserved on spec commit', persisted.calibration && persisted.calibration.domain === 'medium');
  cleanup(tmpRoot);
}
{
  // High-ambiguity warning
  const { projectDir, tmpRoot } = makeTempProject('spec-high-ambig');
  seedToSpec(projectDir);
  const r = applySpecTurn(projectDir, {
    milestones: [{ id: 'I', title: 'Vague', description: 'Vague.', ambiguity_score: 4 }]
  }, { now: FIXED_NOW_2 });
  check('high-ambig commit ok (no transition)', r.ok === true);
  check('high-ambig stage stays spec', r.stage === 'spec');
  check('high-ambig list contains I', r.highAmbiguity.includes('I'));
  check('high-ambig text mentions warning', /Warning|warning|ambiguity_score > 3/i.test(r.text));
  check('high-ambig text mentions action paths', /\(1\).*Re-elicit/.test(r.text));
  cleanup(tmpRoot);
}
{
  // Rejections
  const { projectDir, tmpRoot } = makeTempProject('spec-reject');
  seedToSpec(projectDir);
  let r;
  r = applySpecTurn(projectDir, null);
  check('spec reject null', r.ok === false && r.reason === 'invalid-shape');
  r = applySpecTurn(projectDir, { milestones: [] });
  check('spec reject empty', r.ok === false && r.reason === 'no-milestones');
  r = applySpecTurn(projectDir, { milestones: [{ title: 'No id', description: 'd', ambiguity_score: 1 }] });
  check('spec reject missing id', r.ok === false && r.reason === 'invalid-milestone');
  r = applySpecTurn(projectDir, { milestones: [{ id: 'I', description: 'd', ambiguity_score: 1 }] });
  check('spec reject missing title', r.ok === false && r.reason === 'invalid-milestone');
  r = applySpecTurn(projectDir, { milestones: [{ id: 'I', title: 't', ambiguity_score: 1 }] });
  check('spec reject missing description', r.ok === false && r.reason === 'invalid-milestone');
  r = applySpecTurn(projectDir, { milestones: [{ id: 'I', title: 't', description: 'd', ambiguity_score: 0 }] });
  check('spec reject ambig too low', r.ok === false && r.reason === 'invalid-ambiguity-score');
  r = applySpecTurn(projectDir, { milestones: [{ id: 'I', title: 't', description: 'd', ambiguity_score: 6 }] });
  check('spec reject ambig too high', r.ok === false && r.reason === 'invalid-ambiguity-score');
  r = applySpecTurn(projectDir, { milestones: [{ id: 'I', title: 't', description: 'd', ambiguity_score: 1 }], transition: 'plan' });
  check('spec reject invalid transition (plan — must go via blind_spot)', r.ok === false && r.reason === 'invalid-transition');
  r = applySpecTurn(projectDir, { milestones: [{ id: 'I', title: 't', description: 'd', ambiguity_score: 1 }], transition: 'present' });
  check('spec reject invalid transition (present)', r.ok === false && r.reason === 'invalid-transition');
  cleanup(tmpRoot);
}

// ===========================================================================
// Stage 5 Plan
// ===========================================================================
console.log('Stage 5 Plan');
function seedToPlan(projectDir) {
  seedToSpec(projectDir);
  applySpecTurn(projectDir, {
    milestones: [
      { id: 'I', title: 'Foundation', description: 'Auth + DB.', ambiguity_score: 2 },
      { id: 'II', title: 'Dashboard', description: 'Stats widgets.', ambiguity_score: 2 }
    ],
    transition: 'blind_spot'
  }, { now: FIXED_NOW_2 });
  // Per spec resolution (Q3.4.1-followup): blind_spot sits between spec and plan;
  // deliberate's tests skip the Stage 3 cycle to reach Plan (blind-spot.js owns its own tests).
  skipBlindSpot(projectDir);
}
{
  const { projectDir, tmpRoot } = makeTempProject('plan-mode');
  seedToPlan(projectDir);
  const r = buildPlanTurn(projectDir);
  check('plan-mode ok', r.ok === true);
  check('plan-mode stage=plan', r.stage === 'plan');
  check('plan-mode lists 2 milestones', r.milestones.length === 2);
  check('plan-mode pendingMilestoneIds = [I, II]', JSON.stringify(r.pendingMilestoneIds) === '["I","II"]');
  check('plan-mode text mentions writer-canonical names', /scope\.in|scope\.out|success|verify|deps/.test(r.text));
  check('plan-mode text references Slice A placeholders', /pending_skill_resolution|placeholder/.test(r.text));
  cleanup(tmpRoot);
}
{
  // Happy commit for milestone I
  const { projectDir, tmpRoot } = makeTempProject('plan-commit');
  seedToPlan(projectDir);
  const r = applyPlanTurn(projectDir, {
    milestone_id: 'I',
    leaves: [freshLeaf('I.1', 'Scaffolding'), freshLeaf('I.2', 'Schema')]
  }, { now: FIXED_NOW_2 });
  check('plan-commit ok', r.ok === true);
  check('plan-commit stage=plan (no transition)', r.stage === 'plan');
  check('plan-commit milestoneId=I', r.milestoneId === 'I');
  check('plan-commit leavesWritten=2', r.leavesWritten === 2);
  check('plan-commit remaining=[II]', JSON.stringify(r.milestonesRemaining) === '["II"]');
  const persisted = readDeliberationState(projectDir);
  check('persisted milestone I has 2 children', persisted.proposed_tree.milestones[0].children.length === 2);
  check('persisted leaf I.1 has scope.in', Array.isArray(persisted.proposed_tree.milestones[0].children[0].scope.in));
  check('persisted leaf I.1 has placeholder skills:[]', Array.isArray(persisted.proposed_tree.milestones[0].children[0].skills) && persisted.proposed_tree.milestones[0].children[0].skills.length === 0);
  check('persisted leaf I.1 has placeholder confidence:low', persisted.proposed_tree.milestones[0].children[0].confidence === 'low');
  check('persisted leaf I.1 has pending_skill_resolution:true', persisted.proposed_tree.milestones[0].children[0].pending_skill_resolution === true);
  check('persisted last_revision=2', persisted.proposed_tree.last_revision === 2);
  cleanup(tmpRoot);
}
{
  // Final commit (second milestone) with transition
  const { projectDir, tmpRoot } = makeTempProject('plan-commit-final');
  seedToPlan(projectDir);
  applyPlanTurn(projectDir, { milestone_id: 'I', leaves: [freshLeaf('I.1', 'L1')] }, { now: FIXED_NOW });
  const r = applyPlanTurn(projectDir, {
    milestone_id: 'II',
    leaves: [freshLeaf('II.1', 'D1')],
    transition: 'present'
  }, { now: FIXED_NOW_2 });
  check('plan-final stage=present', r.stage === 'present');
  check('plan-final transitioned', r.transitioned === true);
  const persisted = readDeliberationState(projectDir);
  check('persisted stage=present', persisted.stage === 'present');
  check('persisted current_proposal_revision=3', persisted.current_proposal_revision === 3);
  cleanup(tmpRoot);
}
{
  // Leaf rejections
  const { projectDir, tmpRoot } = makeTempProject('plan-reject');
  seedToPlan(projectDir);
  let r;
  r = applyPlanTurn(projectDir, null);
  check('plan reject null', r.ok === false && r.reason === 'invalid-shape');
  r = applyPlanTurn(projectDir, { leaves: [freshLeaf('I.1', 'L')] });
  check('plan reject missing milestone_id', r.ok === false && r.reason === 'missing-milestone-id');
  r = applyPlanTurn(projectDir, { milestone_id: 'I', leaves: [] });
  check('plan reject empty leaves', r.ok === false && r.reason === 'no-leaves');
  r = applyPlanTurn(projectDir, { milestone_id: 'I', leaves: [{ id: 'I.1' }] });
  check('plan reject missing leaf fields', r.ok === false && r.reason === 'invalid-leaf');
  r = applyPlanTurn(projectDir, { milestone_id: 'XX', leaves: [freshLeaf('XX.1', 'L')] });
  check('plan reject unknown milestone', r.ok === false && r.reason === 'unknown-milestone');
  r = applyPlanTurn(projectDir, { milestone_id: 'I', leaves: [freshLeaf('I.1', 'L')], transition: 'committed' });
  check('plan reject invalid transition', r.ok === false && r.reason === 'invalid-transition');
  // Leaf field-by-field validation
  const baseLeaf = freshLeaf('I.1', 'L');
  const noScopeIn = Object.assign({}, baseLeaf, { scope: { out: ['x'] } });
  r = applyPlanTurn(projectDir, { milestone_id: 'I', leaves: [noScopeIn] });
  check('plan reject scope missing in', r.ok === false && r.reason === 'invalid-leaf');
  const noSuccess = Object.assign({}, baseLeaf, { success: [] });
  r = applyPlanTurn(projectDir, { milestone_id: 'I', leaves: [noSuccess] });
  check('plan reject empty success', r.ok === false && r.reason === 'invalid-leaf');
  const noVerify = Object.assign({}, baseLeaf, { verify: { method: 'x', fallback: 'y' } });
  r = applyPlanTurn(projectDir, { milestone_id: 'I', leaves: [noVerify] });
  check('plan reject verify missing review_required', r.ok === false && r.reason === 'invalid-leaf');
  const badDeps = Object.assign({}, baseLeaf, { deps: 'not array' });
  r = applyPlanTurn(projectDir, { milestone_id: 'I', leaves: [badDeps] });
  check('plan reject deps not array', r.ok === false && r.reason === 'invalid-leaf');
  cleanup(tmpRoot);
}
{
  // Stage mismatch
  const { projectDir, tmpRoot } = makeTempProject('plan-stage-mismatch');
  writePlan(projectDir, FIXTURE_WITH_CAL);
  const r = applyPlanTurn(projectDir, { milestone_id: 'I', leaves: [freshLeaf('I.1', 'L')] });
  check('plan-stage-mismatch', r.ok === false && r.reason === 'stage-mismatch');
  cleanup(tmpRoot);
}

// ===========================================================================
// Stage 7 Present
// ===========================================================================
console.log('Stage 7 Present');
function seedToPresent(projectDir) {
  seedToPlan(projectDir);
  applyPlanTurn(projectDir, { milestone_id: 'I', leaves: [freshLeaf('I.1', 'L1')] }, { now: FIXED_NOW });
  applyPlanTurn(projectDir, { milestone_id: 'II', leaves: [freshLeaf('II.1', 'D1')], transition: 'present' }, { now: FIXED_NOW_2 });
}
{
  const { projectDir, tmpRoot } = makeTempProject('present-plan');
  seedToPresent(projectDir);
  const r = buildPresentTurn(projectDir);
  check('present-plan ok', r.ok === true);
  check('present-plan stage=present', r.stage === 'present');
  check('present-plan revision is number', typeof r.revision === 'number');
  check('present-plan text shows tree', /Foundation/.test(r.text) && /Dashboard/.test(r.text));
  check('present-plan action paths present', /\(1\) Approve/.test(r.text));
  check('present-plan describe-other escape', /describe other/i.test(r.text));
  cleanup(tmpRoot);
}
{
  // Approve transitions to commit
  const { projectDir, tmpRoot } = makeTempProject('present-approve');
  seedToPresent(projectDir);
  const r = applyPresentTurn(projectDir, { kind: 'approve' }, { now: FIXED_NOW });
  check('present approve: ok', r.ok === true);
  check('present approve: stage=commit', r.stage === 'commit');
  const persisted = readDeliberationState(projectDir);
  check('persisted stage=commit', persisted.stage === 'commit');
  cleanup(tmpRoot);
}
{
  // Patch a leaf title
  const { projectDir, tmpRoot } = makeTempProject('present-patch');
  seedToPresent(projectDir);
  const before = readDeliberationState(projectDir).proposed_tree.last_revision;
  const r = applyPresentTurn(projectDir, { kind: 'patch', target_id: 'I.1', body: { title: 'New title' } }, { now: FIXED_NOW });
  check('present patch ok', r.ok === true);
  check('present patch stays present', r.stage === 'present');
  check('present patch revision incremented', r.revision === before + 1);
  const persisted = readDeliberationState(projectDir);
  check('patch applied: I.1 title', persisted.proposed_tree.milestones[0].children[0].title === 'New title');
  cleanup(tmpRoot);
}
{
  // Patch rejects id rewrite
  const { projectDir, tmpRoot } = makeTempProject('present-patch-id');
  seedToPresent(projectDir);
  const r = applyPresentTurn(projectDir, { kind: 'patch', target_id: 'I.1', body: { id: 'I.99' } });
  check('patch reject id rewrite', r.ok === false && r.reason === 'id-rewrite-forbidden');
  cleanup(tmpRoot);
}
{
  // Replace milestone with reset_children
  const { projectDir, tmpRoot } = makeTempProject('present-replace');
  seedToPresent(projectDir);
  const r = applyPresentTurn(projectDir, { kind: 'replace', target_id: 'I', body: { reset_children: true, title: 'Renamed Foundation' } }, { now: FIXED_NOW });
  check('present replace ok', r.ok === true);
  check('present replace returns to plan', r.stage === 'plan');
  const persisted = readDeliberationState(projectDir);
  check('replace cleared I children', persisted.proposed_tree.milestones[0].children.length === 0);
  check('replace renamed I', persisted.proposed_tree.milestones[0].title === 'Renamed Foundation');
  cleanup(tmpRoot);
}
{
  // Replace rejects on leaf target
  const { projectDir, tmpRoot } = makeTempProject('present-replace-leaf');
  seedToPresent(projectDir);
  const r = applyPresentTurn(projectDir, { kind: 'replace', target_id: 'I.1', body: { title: 'X' } });
  check('replace reject on leaf', r.ok === false && r.reason === 'replace-leaf-forbidden');
  cleanup(tmpRoot);
}
{
  // Present validation rejections
  const { projectDir, tmpRoot } = makeTempProject('present-reject');
  seedToPresent(projectDir);
  let r;
  r = applyPresentTurn(projectDir, null);
  check('present reject null', r.ok === false && r.reason === 'invalid-shape');
  r = applyPresentTurn(projectDir, { kind: 'something' });
  check('present reject invalid kind', r.ok === false && r.reason === 'invalid-kind');
  r = applyPresentTurn(projectDir, { kind: 'patch' });
  check('present patch reject missing target_id', r.ok === false && r.reason === 'missing-target-id');
  r = applyPresentTurn(projectDir, { kind: 'patch', target_id: 'XX', body: { title: 'X' } });
  check('present patch reject unknown target', r.ok === false && r.reason === 'unknown-target');
  r = applyPresentTurn(projectDir, { kind: 'patch', target_id: 'I.1' });
  check('present patch reject missing body', r.ok === false && r.reason === 'invalid-body');
  cleanup(tmpRoot);
}

// ===========================================================================
// Stage 8 Commit
// ===========================================================================
console.log('Stage 8 Commit');
function seedToCommit(projectDir) {
  seedToPresent(projectDir);
  applyPresentTurn(projectDir, { kind: 'approve' }, { now: FIXED_NOW });
}
{
  const { projectDir, tmpRoot } = makeTempProject('commit-plan');
  seedToCommit(projectDir);
  const r = buildCommitTurn(projectDir);
  check('commit-plan ok', r.ok === true);
  check('commit-plan stage=commit', r.stage === 'commit');
  check('commit-plan milestonesCount=2', r.milestonesCount === 2);
  check('commit-plan leavesCount=2', r.leavesCount === 2);
  check('commit-plan text mentions OVERDRIVE.md', /OVERDRIVE\.md/.test(r.text));
  check('commit-plan action paths present', /\(1\) Commit/.test(r.text));
  check('commit-plan mentions placeholders', /placeholder|pending_skill_resolution/.test(r.text));
  cleanup(tmpRoot);
}
{
  // Back transitions to present
  const { projectDir, tmpRoot } = makeTempProject('commit-back');
  seedToCommit(projectDir);
  const r = applyCommitTurn(projectDir, { kind: 'back' }, { now: FIXED_NOW });
  check('commit back ok', r.ok === true);
  check('commit back stage=present', r.stage === 'present');
  const persisted = readDeliberationState(projectDir);
  check('persisted stage=present', persisted.stage === 'present');
  cleanup(tmpRoot);
}
{
  // Final commit: writes tree to OVERDRIVE.md, clears proposed_tree, stage=committed
  const { projectDir, tmpRoot } = makeTempProject('commit-final');
  seedToCommit(projectDir);
  const r = applyCommitTurn(projectDir, { kind: 'commit' }, { now: FIXED_NOW_2 });
  check('commit final ok', r.ok === true);
  check('commit final stage=committed', r.stage === 'committed');
  check('commit final milestonesWritten=2', r.milestonesWritten === 2);
  // Tree was actually written to OVERDRIVE.md
  const parsed = parseOverdriveMd(readPlan(projectDir));
  check('tree.children count=2', parsed.tree.children.length === 2);
  check('tree milestone[0].id=I', parsed.tree.children[0].id === 'I');
  check('tree milestone[0].title=Foundation', parsed.tree.children[0].title === 'Foundation');
  check('tree milestone[0].children count=1', parsed.tree.children[0].children.length === 1);
  check('tree milestone[0] leaf I.1', parsed.tree.children[0].children[0].id === 'I.1');
  check('tree milestone[0] leaf has scope.in', Array.isArray(parsed.tree.children[0].children[0].annotations.scope.in));
  check('tree milestone[0] leaf has success', Array.isArray(parsed.tree.children[0].children[0].annotations.success));
  check('tree milestone[0] leaf has verify.method', parsed.tree.children[0].children[0].annotations.verify.method === 'vitest');
  check('tree milestone[0] leaf has deps', Array.isArray(parsed.tree.children[0].children[0].annotations.deps));
  check('tree milestone[0] leaf has pending_skill_resolution', parsed.tree.children[0].children[0].annotations.pending_skill_resolution === true);
  check('frontmatter current_milestone=I', parsed.frontmatter.current_milestone === 'I');
  // proposed_tree cleared from deliberation-state
  const persisted = readDeliberationState(projectDir);
  check('persisted: proposed_tree cleared', !persisted.proposed_tree);
  check('persisted: stage=committed', persisted.stage === 'committed');
  // Calibration sibling preserved end-to-end
  check('calibration sibling preserved end-to-end', persisted.calibration && persisted.calibration.domain === 'medium');
  cleanup(tmpRoot);
}
{
  // Commit validation rejections
  const { projectDir, tmpRoot } = makeTempProject('commit-reject');
  seedToCommit(projectDir);
  let r;
  r = applyCommitTurn(projectDir, null);
  check('commit reject null', r.ok === false && r.reason === 'invalid-shape');
  r = applyCommitTurn(projectDir, { kind: 'something' });
  check('commit reject invalid kind', r.ok === false && r.reason === 'invalid-kind');
  cleanup(tmpRoot);
}

// ===========================================================================
// runDeliberate dispatch + committed state handling
// ===========================================================================
console.log('runDeliberate dispatch');
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-bare-fresh');
  writePlan(projectDir, FIXTURE_WITH_CAL);
  const r = runDeliberate(projectDir);
  check('dispatch bare fresh: routes to elicit plan', r.stage === 'elicit' && r.mode === 'plan');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-bare-spec');
  writePlan(projectDir, FIXTURE_WITH_CAL);
  applyElicitTurn(projectDir, { answer: 'A', turn_id: 1, transition: 'spec' }, { now: FIXED_NOW });
  const r = runDeliberate(projectDir);
  check('dispatch bare at spec: routes to spec plan', r.stage === 'spec' && r.mode === 'plan');
  cleanup(tmpRoot);
}
{
  // dispatch routes to blind-spot module when stage='blind_spot' (post Spec transition)
  const { projectDir, tmpRoot } = makeTempProject('dispatch-bare-blind-spot');
  writePlan(projectDir, FIXTURE_WITH_CAL);
  applyElicitTurn(projectDir, { answer: 'A', turn_id: 1, transition: 'spec' }, { now: FIXED_NOW });
  applySpecTurn(projectDir, { milestones: [{ id: 'I', title: 'Foundation', description: 'Auth.', ambiguity_score: 2 }], transition: 'blind_spot' }, { now: FIXED_NOW });
  const r = runDeliberate(projectDir);
  check('dispatch bare at blind_spot: ok=true (delegates to blind-spot module)', r.ok === true);
  check('dispatch bare at blind_spot: plan mode', r.mode === 'plan');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-commit-elicit');
  writePlan(projectDir, FIXTURE_WITH_CAL);
  const r = runDeliberate(projectDir, { mode: 'commit', entries: { answer: 'A', turn_id: 1 }, now: FIXED_NOW });
  check('dispatch commit at elicit: applies', r.ok === true);
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-committed-plan');
  writePlan(projectDir, FIXTURE_WITH_CAL);
  // Force state to committed
  const { openState, commitState } = require('../lib/ovd-plan/deliberation-state');
  const opened = openState(projectDir);
  opened.innerObj.stage = 'committed';
  commitState(projectDir, opened);
  const r = runDeliberate(projectDir);
  check('dispatch committed bare: ok with committed message', r.ok === true && /committed/i.test(r.text));
  const r2 = runDeliberate(projectDir, { mode: 'commit', entries: { kind: 'commit' } });
  check('dispatch committed commit: rejects already-committed', r2.ok === false && r2.reason === 'already-committed');
  cleanup(tmpRoot);
}

// ===========================================================================
// Dispatch routing via ovdPlan.runPlan (Pattern 4 JSON guard)
// ===========================================================================
console.log('ovdPlan.runPlan dispatch');
{
  const { projectDir, tmpRoot } = makeTempProject('runPlan-bare');
  writePlan(projectDir, FIXTURE_WITH_CAL);
  const r = ovdPlan.runPlan({ subcommand: 'deliberate', projectDir });
  check('runPlan deliberate (no entries): ok plan', r.ok === true && r.mode === 'plan');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('runPlan-commit');
  writePlan(projectDir, FIXTURE_WITH_CAL);
  const r = ovdPlan.runPlan({
    subcommand: 'deliberate',
    projectDir,
    entriesJson: JSON.stringify({ answer: 'A', turn_id: 1 })
  });
  check('runPlan deliberate (entries): ok commit', r.ok === true && r.mode === 'commit');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('runPlan-bad-json');
  writePlan(projectDir, FIXTURE_WITH_CAL);
  const before = readPlan(projectDir);
  const r = ovdPlan.runPlan({ subcommand: 'deliberate', projectDir, entriesJson: '{not json' });
  check('runPlan deliberate bad JSON: rejected', r.ok === false);
  check('runPlan deliberate bad JSON: status=deliberate', r.status === 'deliberate');
  check('runPlan deliberate bad JSON: reason mentions JSON', /JSON|json/.test(r.reason));
  // Pattern 4: no write
  const after = readPlan(projectDir);
  check('Pattern 4: no write on bad JSON', before === after);
  cleanup(tmpRoot);
}

// ===========================================================================
// Integration: full happy-path trace from initial through commit
// ===========================================================================
console.log('integration happy path');
{
  const { projectDir, tmpRoot } = makeTempProject('integration');
  writePlan(projectDir, FIXTURE_WITH_CAL);
  // 1. Elicit turn 1
  let r = applyElicitTurn(projectDir, { answer: 'Need login + dashboard.', turn_id: 1, classification: { followup_questions: ['What auth provider?'], branch_signal: null } }, { now: FIXED_NOW });
  check('int: elicit 1 ok', r.ok === true);
  // 2. Elicit turn 2 → transition spec
  r = applyElicitTurn(projectDir, { answer: 'Supabase auth.', turn_id: 2, transition: 'spec' }, { now: FIXED_NOW });
  check('int: elicit 2 → spec ok', r.ok === true && r.stage === 'spec');
  // 3. Spec → blind_spot (per Q3.4.1-followup spec resolution)
  r = applySpecTurn(projectDir, {
    milestones: [
      { id: 'I', title: 'Auth', description: 'Login with Supabase.', ambiguity_score: 2 },
      { id: 'II', title: 'Dashboard', description: 'Show stats.', ambiguity_score: 2 }
    ],
    transition: 'blind_spot'
  }, { now: FIXED_NOW });
  check('int: spec → blind_spot ok', r.ok === true && r.stage === 'blind_spot');
  // 3.5. Skip blind_spot (full Stage 3 cycle owned by blind-spot.js test)
  skipBlindSpot(projectDir);
  // 4. Plan milestone I
  r = applyPlanTurn(projectDir, { milestone_id: 'I', leaves: [freshLeaf('I.1', 'Setup auth')] }, { now: FIXED_NOW });
  check('int: plan I ok', r.ok === true);
  // 5. Plan milestone II → present
  r = applyPlanTurn(projectDir, { milestone_id: 'II', leaves: [freshLeaf('II.1', 'Stats widget')], transition: 'present' }, { now: FIXED_NOW });
  check('int: plan II → present ok', r.ok === true && r.stage === 'present');
  // 6. Present approve → commit
  r = applyPresentTurn(projectDir, { kind: 'approve' }, { now: FIXED_NOW });
  check('int: present approve → commit ok', r.ok === true && r.stage === 'commit');
  // 7. Commit commit → committed (writes tree)
  r = applyCommitTurn(projectDir, { kind: 'commit' }, { now: FIXED_NOW });
  check('int: commit → committed ok', r.ok === true && r.stage === 'committed');
  // 8. Verify final tree
  const parsed = parseOverdriveMd(readPlan(projectDir));
  check('int: tree has 2 milestones', parsed.tree.children.length === 2);
  check('int: tree milestone I leaf I.1 ok', parsed.tree.children[0].children[0].id === 'I.1');
  check('int: tree milestone II leaf II.1 ok', parsed.tree.children[1].children[0].id === 'II.1');
  check('int: calibration preserved through full trace', readDeliberationState(projectDir).calibration.domain === 'medium');
  check('int: proposed_tree cleared', !readDeliberationState(projectDir).proposed_tree);
  cleanup(tmpRoot);
}

// ===========================================================================
// Migration-compat seam (Phase 2-migrated layout: no deliberation-state block)
// ===========================================================================
console.log('migration-compat seam');
{
  const { projectDir, tmpRoot } = makeTempProject('migration');
  writePlan(projectDir, FIXTURE_FRESH); // No block at all (Phase 2 migrated layouts)
  const r = buildElicitTurn(projectDir);
  check('migration: elicit plan ok on no-block', r.ok === true);
  const r2 = applyElicitTurn(projectDir, { answer: 'A', turn_id: 1 }, { now: FIXED_NOW });
  check('migration: elicit commit ok on no-block', r2.ok === true);
  // The block now exists
  const persisted = readDeliberationState(projectDir);
  check('migration: state persisted', persisted && persisted.stage === 'elicit');
  cleanup(tmpRoot);
}

// ===========================================================================
// formatPlan / formatCommit
// ===========================================================================
console.log('formatPlan / formatCommit');
check('formatPlan returns text', formatPlan({ text: 'hello' }) === 'hello');
check('formatPlan default when missing', formatPlan(null) === '(no plan text)');
check('formatCommit returns text', formatCommit({ text: 'hi' }) === 'hi');
check('formatCommit default when missing', formatCommit({}) === '(no commit text)');

// ===========================================================================
// Helpers
// ===========================================================================
console.log('helpers');
{
  const e = validateLeaf({ id: 'L', title: 't', description: 'd', scope: { in: [], out: [] }, success: ['x'], verify: { method: 'm', fallback: 'f', review_required: true }, deps: [] }, 'I', 0);
  check('validateLeaf accepts valid leaf', e === null);
  const e2 = validateLeaf({ id: 'L' }, 'I', 0);
  check('validateLeaf rejects missing fields', typeof e2 === 'string');
}
{
  const tree = {
    milestones: [
      { id: 'I', title: 'F', children: [{ id: 'I.1', title: 'a' }] },
      { id: 'II', title: 'D', children: [] }
    ]
  };
  const m = findNodeById(tree, 'II');
  check('findNodeById finds milestone', m && m.kind === 'milestone');
  const l = findNodeById(tree, 'I.1');
  check('findNodeById finds leaf', l && l.kind === 'leaf' && l.milestone.id === 'I');
  check('findNodeById returns null on unknown', findNodeById(tree, 'XX') === null);
}
{
  const ann = buildLeafAnnotations(freshLeaf('I.1', 'L'));
  check('buildLeafAnnotations: skills:[]', Array.isArray(ann.skills) && ann.skills.length === 0);
  check('buildLeafAnnotations: confidence=low', ann.confidence === 'low');
  check('buildLeafAnnotations: scope.in array', Array.isArray(ann.scope.in));
  check('buildLeafAnnotations: scope.out array', Array.isArray(ann.scope.out));
  check('buildLeafAnnotations: verify object', ann.verify && ann.verify.method === 'vitest');
  check('buildLeafAnnotations: success preserved', ann.success.length === 1);
}
{
  const node = buildMilestoneNode({ id: 'I', title: 'F', description: 'desc', children: [freshLeaf('I.1', 'L')] }, 1);
  check('buildMilestoneNode: depth=2', node.depth === 2);
  check('buildMilestoneNode: id=I', node.id === 'I');
  check('buildMilestoneNode: status=pending', node.status === 'pending');
  check('buildMilestoneNode: 1 child', node.children.length === 1);
  check('buildMilestoneNode: child depth=3', node.children[0].depth === 3);
  check('buildMilestoneNode: child annotations', !!node.children[0].annotations.scope);
}
{
  const text = renderProposedTree({ milestones: [{ id: 'I', title: 'F', ambiguity_score: 2, children: [{ id: 'I.1', title: 'L' }] }] });
  check('renderProposedTree: includes milestone', /I.*F/.test(text));
  check('renderProposedTree: includes leaf', /I\.1.*L/.test(text));
}

// ===========================================================================
// Namespace + top-level exports via index.js
// ===========================================================================
console.log('namespace exports');
check('ovdPlan.deliberate namespace exists', !!ovdPlan.deliberate);
check('ovdPlan.deliberate.runDeliberate exists', typeof ovdPlan.deliberate.runDeliberate === 'function');
check('ovdPlan.runDeliberate top-level export', typeof ovdPlan.runDeliberate === 'function');
check('ovdPlan.deliberationState namespace', !!ovdPlan.deliberationState);
check('module identity: same deliberate', ovdPlan.deliberate === deliberate);

console.log('');
console.log(`${passed} checks passed.`);
if (failures.length) {
  console.log(`${failures.length} FAILURES`);
  process.exit(1);
}
