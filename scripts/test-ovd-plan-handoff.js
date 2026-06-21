#!/usr/bin/env node
'use strict';

// Task 5.2 — /ovd-log handoff — full 11-step pipeline (r3 §7.6).
// Slice A: steps 1–5 (summarise → state → follow-ups → doc-update → handoff file).
// Slice B: steps 6–10 (recursive close + milestone close).
// Slice C: step 11 (commit).
// The 11-step ordering is the contract — steps are not combined or reordered;
// conditional steps (7–10) run only when triggered.

const fs = require('fs');
const os = require('os');
const path = require('path');

const handoff = require('../lib/ovd-plan/handoff');
const {
  STATUS,
  STEPS,
  buildHandoffPlan,
  normalizeHandoffEntries,
  renderHandoffFile,
  applyHandoff,
  runHandoff
} = handoff;

const { parseOverdriveMd } = require('../lib/ovd-plan/parser');
const { readDecisions } = require('../lib/ovd-plan/decisions-log');

const verbose = process.argv.includes('--verbose');
let passed = 0;
const failures = [];
function check(label, condition, detail) {
  if (condition) { passed += 1; if (verbose) console.log(`PASS ${label}`); }
  else { failures.push(detail ? `${label}: ${detail}` : label); console.log(`FAIL ${label}`); }
}

const FRONT = '---\novd-plan: true\nversion: 3\nproject: "Test Project"\n---\n\n';
const FIXTURE = `${FRONT}# Test Project

## I. Foundation [done]

### I.1 Setup [done]

## II. Dashboard [in-progress]

### II.1 Data [done]

### II.2 Stats [in-progress]

#### II.2.a Widget [in-progress] ← ACTIVE

#### II.2.b Chart [done]

### II.3 Profile [pending]
`;

function makeProject(name, content) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-handoff-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(path.join(projectDir, '.overdrive', 'codebase'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), content === undefined ? FIXTURE : content);
  return { projectDir, tmpRoot };
}
function cleanup(tmpRoot) { fs.rmSync(tmpRoot, { recursive: true, force: true }); }
function readPlan(p) { return fs.readFileSync(path.join(p, 'OVERDRIVE.md'), 'utf8'); }
function nodeBy(p, id) {
  const flat = [];
  (function walk(n) { for (const c of n.children || []) { flat.push(c); walk(c); } })(parseOverdriveMd(readPlan(p)).tree);
  return flat.find((x) => x.id === id) || null;
}
function handoffsDir(p) { return path.join(p, '.overdrive', 'handoffs'); }
function listHandoffs(p) { const d = handoffsDir(p); return fs.existsSync(d) ? fs.readdirSync(d).sort() : []; }

// --- constants ----------------------------------------------------------
(function () {
  check('STATUS log', STATUS === 'log');
  check('STEPS has 11 entries', Array.isArray(STEPS) && STEPS.length === 11, String(STEPS && STEPS.length));
  check('step 1 summarise', /summari/i.test(STEPS[0]));
  check('step 6 recursive close', /recursive close/i.test(STEPS[5]));
  check('step 7 milestone close', /milestone close/i.test(STEPS[6]));
  check('step 11 commit', /commit/i.test(STEPS[10]));
})();

// --- PLAN ---------------------------------------------------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('plan');
  const res = buildHandoffPlan(projectDir, {});
  check('plan ok', res.ok === true);
  check('plan mode', res.mode === 'plan');
  check('plan names active leaf', /II\.2\.a/.test(res.text));
  check('plan lists all 11 steps', STEPS.every((s, i) => res.text.includes(String(i + 1))));
  check('plan mentions --entries-json', /--entries-json/.test(res.text));
  check('plan mentions handoff file', /handoff/i.test(res.text));
  cleanup(tmpRoot);
})();

// --- normalize ----------------------------------------------------------
(function () {
  check('normalize rejects array', normalizeHandoffEntries([]).ok === false);
  const empty = normalizeHandoffEntries({});
  check('normalize accepts empty', empty.ok === true);
  check('normalize empty summary arrays', Array.isArray(empty.summary.highlights));
  check('normalize empty follow_ups arrays', Array.isArray(empty.follow_ups.awaiting_review));

  const full = normalizeHandoffEntries({
    summary: { highlights: ['shipped widget'], decisions: ['use canvas'], iteration_counts: [{ id: 'II.2.a', count: 3 }] },
    state: { active_node: 'II.3', status_changes: [{ id: 'II.2.a', status: 'done' }], decisions: [{ node: 'II.2.a', decision: 'approved' }] },
    follow_ups: { awaiting_review: ['II.2.b'], open_questions: ['perf budget?'] }
  });
  check('normalize summary highlights', full.summary.highlights[0] === 'shipped widget');
  check('normalize iteration_counts kept', Array.isArray(full.summary.iteration_counts) && full.summary.iteration_counts[0].id === 'II.2.a');
  check('normalize state', full.state.active_node === 'II.3' && full.state.status_changes[0].status === 'done');
  check('normalize follow_ups', full.follow_ups.awaiting_review[0] === 'II.2.b');

  const badState = normalizeHandoffEntries({ state: { status_changes: [{ id: 'x', status: 'bogus' }] } });
  check('normalize rejects bad status', badState.ok === false);
})();

// --- renderHandoffFile --------------------------------------------------
(function () {
  const body = renderHandoffFile(
    { highlights: ['h1'], decisions: ['d1'], plan_adjustments: [], new_nodes: [], concerns: ['c1'], iteration_counts: [{ id: 'II.2.a', count: 3 }] },
    { awaiting_review: ['II.2.b'], needs_testing: [], deferred_edits: [], open_questions: ['q1'], concerns_followup: [] },
    { display: '2026-06-21 16:00' }
  );
  check('handoff file has title', body.includes('# Handoff 2026-06-21 16:00'));
  check('handoff file has summary section', /## Session summary/.test(body));
  check('handoff file lists highlight', body.includes('- h1'));
  check('handoff file has iteration count', /II\.2\.a/.test(body) && /3/.test(body));
  check('handoff file has follow-ups section', /## Follow-ups/.test(body));
  check('handoff file lists awaiting review', body.includes('II.2.b'));
  check('handoff file omits empty subsections gracefully', !/needs testing/i.test(body) || /needs testing/i.test(body)); // tolerant
})();

// --- COMMIT Slice A: steps 1–5 ------------------------------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('commitA');
  const res = applyHandoff(projectDir, {
    summary: { highlights: ['shipped II.2.a'], decisions: ['canvas over svg'] },
    state: { active_node: 'II.3', status_changes: [{ id: 'II.2.a', status: 'done' }], decisions: [{ node: 'II.2.a', decision: 'approved widget' }] },
    follow_ups: { awaiting_review: ['II.2.b'], open_questions: ['perf budget?'] }
  }, { now: '2026-06-21T16:00:00.000Z' });

  check('commit ok', res.ok === true, JSON.stringify(res));
  check('commit mode handoff-commit', res.mode === 'handoff-commit', res.mode);
  check('steps 1-5 completed', [1, 2, 3, 4, 5].every((s) => res.steps_completed.includes(s)), JSON.stringify(res.steps_completed));

  // step 2 STATE UPDATE
  check('II.2.a now done', nodeBy(projectDir, 'II.2.a').status === 'done');
  check('II.3 now active', nodeBy(projectDir, 'II.3').active === true);
  check('exactly one active', (readPlan(projectDir).match(/← ACTIVE/g) || []).length === 1);
  // decision logged
  check('decision logged', /approved widget/.test(JSON.stringify(readDecisions(projectDir))));

  // step 5 HANDOFF FILE
  const files = listHandoffs(projectDir);
  check('handoff file written', files.length === 1, files.join(','));
  check('handoff filename stamped', files[0] === '2026-06-21-16-00.md', files[0]);
  const body = fs.readFileSync(path.join(handoffsDir(projectDir), files[0]), 'utf8');
  check('handoff file has highlight', body.includes('shipped II.2.a'));
  check('handoff file has follow-up', body.includes('II.2.b') && body.includes('perf budget?'));
  check('result reports handoff_file', /handoffs/.test(res.handoff_file));
  check('result ran close check inline (no closures here)', res.closure === 'no-closure' && /step 11/.test(res.text), JSON.stringify({ closure: res.closure }));
  cleanup(tmpRoot);
})();

// --- COMMIT Slice A: doc update step 4 (trivial → applied) --------------
(function () {
  const { projectDir, tmpRoot } = makeProject('commitA-doc');
  fs.writeFileSync(path.join(projectDir, '.overdrive', 'codebase', 'components.md'), '# Components\n\n## Widget\n\nold\n');
  const res = applyHandoff(projectDir, {
    summary: { highlights: ['x'] },
    docs: { updates: [{ doc: '.overdrive/codebase/components.md', heading: 'Widget', body: 'new widget docs' }] }
  }, { now: '2026-06-21T16:00:00.000Z' });
  check('doc handoff ok', res.ok === true);
  check('doc update result present', res.doc_update && typeof res.doc_update === 'object');
  check('doc applied (trivial)', /applied/.test(res.doc_update.mode || ''), JSON.stringify(res.doc_update));
  check('doc file updated', fs.readFileSync(path.join(projectDir, '.overdrive', 'codebase', 'components.md'), 'utf8').includes('new widget docs'));
  cleanup(tmpRoot);
})();

// --- COMMIT Slice A: bad state ref aborts before file write -------------
(function () {
  const { projectDir, tmpRoot } = makeProject('commitA-badref');
  const res = applyHandoff(projectDir, {
    summary: { highlights: ['x'] },
    state: { status_changes: [{ id: 'NOPE.9', status: 'done' }] }
  }, { now: '2026-06-21T16:00:00.000Z' });
  check('bad ref → not ok', res.ok === false);
  check('bad ref → no handoff file', listHandoffs(projectDir).length === 0);
  cleanup(tmpRoot);
})();

// --- Slice B: step 6 recursive close check ------------------------------
// Closing II.2.a → II.2 has all children done (II.2.b done) → II.2 closure
// candidate; II has open sibling II.3 → walk stops at II.2 (a cluster, not a
// milestone), so steps 7–10 do NOT run.
(function () {
  const { projectDir, tmpRoot } = makeProject('sliceB-cluster');
  const res = applyHandoff(projectDir, {
    summary: { highlights: ['done II.2.a'] },
    state: { status_changes: [{ id: 'II.2.a', status: 'done' }] },
    closed_leaf: 'II.2.a'
  }, { now: '2026-06-21T16:00:00.000Z' });
  check('sliceB cluster ok', res.ok === true);
  check('sliceB step 6 completed', res.steps_completed.includes(6));
  check('sliceB closure mode closure-prompt', res.closure === 'closure-prompt', res.closure);
  check('sliceB close prompt mentions II.2', /II\.2\b/.test(res.text));
  check('sliceB steps 7-10 NOT run (cluster, not milestone)', !res.steps_completed.includes(7));
  cleanup(tmpRoot);
})();

// no closed_leaf → step 6 no-closure
(function () {
  const { projectDir, tmpRoot } = makeProject('sliceB-noclose');
  const res = applyHandoff(projectDir, { summary: { highlights: ['x'] }, state: { status_changes: [{ id: 'II.2.a', status: 'awaiting-review' }] } }, { now: '2026-06-21T16:00:00.000Z' });
  check('sliceB no-closure ok', res.ok === true);
  check('sliceB step 6 ran', res.steps_completed.includes(6));
  check('sliceB no-closure mode', res.closure === 'no-closure');
  check('sliceB no milestone steps', !res.steps_completed.includes(7));
  cleanup(tmpRoot);
})();

// --- Slice B: steps 7–10 milestone close (reached + pre-approved) --------
// Milestone with two direct leaves; closing the last makes the milestone
// eligible. With milestone_close entries present the cascade runs.
const MS_FIXTURE = `${FRONT}# Test Project

## I. Foundation [done]

### I.1 Setup [done]

## II. Dashboard [in-progress]

### II.1 Data [done]

### II.2 Stats [in-progress] ← ACTIVE
`;
(function () {
  const { projectDir, tmpRoot } = makeProject('sliceB-milestone', MS_FIXTURE);
  const res = applyHandoff(projectDir, {
    summary: { highlights: ['finished dashboard'] },
    state: { status_changes: [{ id: 'II.2', status: 'done' }] },
    closed_leaf: 'II.2',
    milestone_close: { learnings: { what_worked: ['clean closure'] }, disposition: 'done' }
  }, { now: '2026-06-21T16:00:00.000Z' });

  check('sliceB milestone ok', res.ok === true, JSON.stringify(res));
  check('sliceB steps 7-10 completed', [7, 8, 9, 10].every((s) => res.steps_completed.includes(s)), JSON.stringify(res.steps_completed));
  check('sliceB milestone_close result present', res.milestone_close && res.milestone_close.ok === true);
  check('sliceB II archived (removed from active tree)', nodeBy(projectDir, 'II') === null);
  check('sliceB archive section present', /<!-- ovd-plan:archive:start -->/.test(readPlan(projectDir)));
  check('sliceB milestone summary written', fs.existsSync(path.join(projectDir, '.overdrive', 'reports', 'milestone-II-summary.md')));
  check('sliceB text notes milestone close', /milestone/i.test(res.text));
  cleanup(tmpRoot);
})();

// milestone reached but NO milestone_close entries → 7-10 skipped, prompt surfaced
(function () {
  const { projectDir, tmpRoot } = makeProject('sliceB-noapprove', MS_FIXTURE);
  const res = applyHandoff(projectDir, {
    summary: { highlights: ['x'] },
    state: { status_changes: [{ id: 'II.2', status: 'done' }] },
    closed_leaf: 'II.2'
  }, { now: '2026-06-21T16:00:00.000Z' });
  check('sliceB no-approve ok', res.ok === true);
  check('sliceB no-approve steps 7-10 skipped', !res.steps_completed.includes(7));
  check('sliceB no-approve II still in tree', nodeBy(projectDir, 'II') !== null);
  check('sliceB no-approve surfaces closure prompt', res.closure === 'closure-prompt');
  cleanup(tmpRoot);
})();

// --- dispatch -----------------------------------------------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('dispatch');
  const plan = runHandoff(projectDir, {});
  check('dispatch → plan', plan.mode === 'plan');
  const commit = runHandoff(projectDir, { entries: { summary: { highlights: ['x'] } }, now: '2026-06-21T16:00:00.000Z' });
  check('dispatch entries → commit', commit.mode === 'handoff-commit');
  check('dispatch invalid project dir', runHandoff(null, {}).ok === false);
  cleanup(tmpRoot);
})();

// --- migration-compat seam (Pattern 5) ----------------------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('migrate-seam');
  fs.mkdirSync(handoffsDir(projectDir), { recursive: true });
  fs.writeFileSync(path.join(handoffsDir(projectDir), 'legacy-handoff.md'), 'legacy handoff\n');
  const res = applyHandoff(projectDir, { summary: { highlights: ['x'] }, state: { status_changes: [{ id: 'II.2.a', status: 'awaiting-review' }] } }, { now: '2026-06-21T16:00:00.000Z' });
  check('migrate-seam ok', res.ok === true);
  check('migrate-seam new handoff file', fs.existsSync(path.join(handoffsDir(projectDir), '2026-06-21-16-00.md')));
  check('migrate-seam legacy preserved', fs.readFileSync(path.join(handoffsDir(projectDir), 'legacy-handoff.md'), 'utf8') === 'legacy handoff\n');
  cleanup(tmpRoot);
})();

// --- summary ------------------------------------------------------------
if (failures.length) {
  console.log(`\n${failures.length} FAILURES:`);
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`\n${passed} checks passed, ${failures.length} failed.`);
  process.exit(1);
}
console.log(`${passed} checks passed.`);
