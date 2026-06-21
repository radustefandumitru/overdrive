#!/usr/bin/env node
'use strict';

// Task 5.1 — /ovd-log DEFAULT (lightweight save). Pattern-1 dispatch.
// PLAN emits the convo-capture dimensions; COMMIT persists state + session
// file + recursive close check. r3 §7.1, §7.4, §7.5.

const fs = require('fs');
const os = require('os');
const path = require('path');

const logDefault = require('../lib/ovd-plan/log-default');
const {
  STATUS,
  STATUS_VALUES,
  DIMENSIONS,
  buildLogDefaultPlan,
  normalizeLogDefaultEntries,
  renderSaveBlock,
  acquireLogLock,
  releaseLogLock,
  applyLogDefault,
  runLogDefault
} = logDefault;

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

function makeTempProject(name, content) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-log-default-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), content === undefined ? FIXTURE : content);
  return { projectDir, tmpRoot };
}
function cleanup(tmpRoot) { fs.rmSync(tmpRoot, { recursive: true, force: true }); }
function sdir(p) { return path.join(p, '.overdrive', 'sessions'); }
function listSessions(p) { const d = sdir(p); return fs.existsSync(d) ? fs.readdirSync(d).sort() : []; }
function readSession(p, n) { return fs.readFileSync(path.join(sdir(p), n), 'utf8'); }
function readPlan(p) { return fs.readFileSync(path.join(p, 'OVERDRIVE.md'), 'utf8'); }
function nodeBy(p, id) {
  const flat = [];
  (function walk(n) { for (const c of n.children || []) { flat.push(c); walk(c); } })(parseOverdriveMd(readPlan(p)).tree);
  return flat.find((x) => x.id === id) || null;
}

// --- constants ----------------------------------------------------------
(function () {
  check('STATUS is log', STATUS === 'log');
  check('STATUS_VALUES has six statuses', Array.isArray(STATUS_VALUES) && STATUS_VALUES.length === 6, STATUS_VALUES.join(','));
  check('STATUS_VALUES includes done', STATUS_VALUES.includes('done'));
  check('STATUS_VALUES includes awaiting-review', STATUS_VALUES.includes('awaiting-review'));
  check('DIMENSIONS has 8 entries', Array.isArray(DIMENSIONS) && DIMENSIONS.length === 8, String(DIMENSIONS && DIMENSIONS.length));
  const keys = DIMENSIONS.map((d) => d[0]);
  for (const k of ['modifications', 'user_responses', 'new_alignment', 'new_criteria', 'new_discoveries', 'decisions', 'open_threads', 'interrupted']) {
    check(`DIMENSIONS includes ${k}`, keys.includes(k));
  }
})();

// --- PLAN mode ----------------------------------------------------------
(function () {
  const { projectDir, tmpRoot } = makeTempProject('plan');
  const res = buildLogDefaultPlan(projectDir, {});
  check('plan ok', res.ok === true, JSON.stringify(res));
  check('plan mode', res.mode === 'plan');
  check('plan status log', res.status === 'log');
  check('plan names active leaf II.2.a', /II\.2\.a/.test(res.text), res.text);
  check('plan instructs --entries-json', /--entries-json/.test(res.text));
  for (const [, label] of DIMENSIONS) {
    check(`plan lists dimension "${label}"`, res.text.includes(label));
  }
  cleanup(tmpRoot);
})();

(function () {
  // PLAN tolerates a missing plan file (still emits dispatch instructions).
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ovd-plan-log-default-noplan-'));
  const projectDir = path.join(tmpRoot, 'p');
  fs.mkdirSync(projectDir, { recursive: true });
  const res = buildLogDefaultPlan(projectDir, {});
  check('plan ok without OVERDRIVE.md', res.ok === true);
  check('plan no-active note when no plan', /none|no active|not set/i.test(res.text));
  cleanup(tmpRoot);
})();

// --- normalize ----------------------------------------------------------
(function () {
  check('normalize rejects array', normalizeLogDefaultEntries([]).ok === false);
  check('normalize rejects null', normalizeLogDefaultEntries(null).ok === false);
  check('normalize rejects string', normalizeLogDefaultEntries('x').ok === false);

  const empty = normalizeLogDefaultEntries({});
  check('normalize accepts empty object', empty.ok === true);
  check('normalize empty capture has all dim keys', DIMENSIONS.every(([k]) => k in empty.capture));
  check('normalize empty status_changes is array', Array.isArray(empty.state.status_changes) && empty.state.status_changes.length === 0);
  check('normalize empty active_node null', empty.state.active_node === null);

  const full = normalizeLogDefaultEntries({
    capture: { modifications: ['m1', 'm2'], interrupted: 'mid font tweak', open_threads: ['t1'] },
    state: { active_node: 'II.3', status_changes: [{ id: 'II.2.a', status: 'done' }], decisions: [{ node: 'II.2.a', decision: 'ship', rationale: 'ok' }] },
    closed_leaf: 'II.2.a'
  });
  check('normalize coerces modifications to array', Array.isArray(full.capture.modifications) && full.capture.modifications.length === 2);
  check('normalize keeps interrupted string', full.capture.interrupted === 'mid font tweak');
  check('normalize active_node', full.state.active_node === 'II.3');
  check('normalize status_changes', full.state.status_changes[0].status === 'done');
  check('normalize decisions', full.state.decisions[0].decision === 'ship');
  check('normalize closed_leaf', full.closed_leaf === 'II.2.a');

  // capture coercion of a stray scalar into [] / string
  const coerced = normalizeLogDefaultEntries({ capture: { modifications: 'one thing', new_criteria: ['c', '', 42] } });
  check('normalize coerces scalar modifications to single-item array', Array.isArray(coerced.capture.modifications) && coerced.capture.modifications[0] === 'one thing');
  check('normalize drops empty/non-string capture items', coerced.capture.new_criteria.length === 1 && coerced.capture.new_criteria[0] === 'c');

  // bad status rejected
  const bad = normalizeLogDefaultEntries({ state: { status_changes: [{ id: 'II.2.a', status: 'frobnicate' }] } });
  check('normalize rejects invalid status', bad.ok === false && /status/.test(bad.reason || ''), JSON.stringify(bad));
  const noId = normalizeLogDefaultEntries({ state: { status_changes: [{ status: 'done' }] } });
  check('normalize rejects status_change without id', noId.ok === false);
})();

// --- renderSaveBlock ----------------------------------------------------
(function () {
  const block = renderSaveBlock({ modifications: ['changed font 24→18'], interrupted: 'pending approval', user_responses: [], new_alignment: [], new_criteria: [], new_discoveries: [], decisions: [], open_threads: [] }, { display: '2026-06-21 16:00' });
  check('saveblock has Save header with stamp', block.includes('## Save 2026-06-21 16:00'));
  check('saveblock has Modifications subsection', /###\s+Modifications/.test(block));
  check('saveblock lists modification item', block.includes('- changed font 24→18'));
  check('saveblock has interrupted', /What was interrupted/i.test(block) && block.includes('pending approval'));
  check('saveblock omits empty dimensions', !/User responses/i.test(block));

  const sparse = renderSaveBlock({ modifications: [], user_responses: [], new_alignment: [], new_criteria: [], new_discoveries: [], decisions: [], open_threads: [], interrupted: '' }, { display: '2026-06-21 16:00' });
  check('sparse saveblock still has header', sparse.includes('## Save 2026-06-21 16:00'));
  check('sparse saveblock notes no detail', /no detail captured/i.test(sparse));
})();

// --- COMMIT: full happy path (state + session + decisions + closure) ----
(function () {
  const { projectDir, tmpRoot } = makeTempProject('commit-full');
  const res = applyLogDefault(projectDir, {
    capture: { modifications: ['m1'], open_threads: ['follow up on II.3'] },
    state: {
      active_node: 'II.3',
      status_changes: [{ id: 'II.2.a', status: 'done' }],
      decisions: [{ node: 'II.2.a', decision: 'approved widget', rationale: 'meets criteria' }]
    },
    closed_leaf: 'II.2.a'
  }, { now: '2026-06-21T16:00:00.000Z' });

  check('commit ok', res.ok === true, JSON.stringify(res));
  check('commit mode log-commit', res.mode === 'log-commit', res.mode);

  // STATE UPDATE — status change persisted
  check('II.2.a status now done', nodeBy(projectDir, 'II.2.a').status === 'done');
  // active marker moved II.2.a → II.3
  check('II.3 is now active', nodeBy(projectDir, 'II.3').active === true);
  check('II.2.a no longer active', nodeBy(projectDir, 'II.2.a').active !== true);
  check('exactly one active node', readPlan(projectDir).match(/← ACTIVE/g).length === 1, readPlan(projectDir));

  // SESSION FILE — structured save block
  const files = listSessions(projectDir);
  check('session file written', files.length === 1, files.join(','));
  const body = readSession(projectDir, files[0]);
  check('session has Save block', body.includes('## Save 2026-06-21 16:00'));
  check('session has modification', body.includes('- m1'));
  check('session has open thread', body.includes('follow up on II.3'));

  // DECISIONS — appended to decisions.md
  const decisions = readDecisions(projectDir);
  const decText = JSON.stringify(decisions);
  check('decision logged to decisions.md', /approved widget/.test(decText), decText);

  // RECURSIVE CLOSE CHECK — II.2 closure candidate surfaced
  check('closure mode is closure-prompt', res.closure === 'closure-prompt', res.closure);
  check('closure prompt mentions II.2', /II\.2\b/.test(res.text), res.text);
  check('result reports session_file', typeof res.session_file === 'string' && res.session_file.includes('sessions'));
  check('result reports active_node II.3', res.active_node === 'II.3');
  cleanup(tmpRoot);
})();

// --- COMMIT: no closure when nothing closed -----------------------------
(function () {
  const { projectDir, tmpRoot } = makeTempProject('commit-noclose');
  const res = applyLogDefault(projectDir, {
    capture: { modifications: ['tweak'] },
    state: { status_changes: [{ id: 'II.2.a', status: 'awaiting-review' }] }
  }, { now: '2026-06-21T16:00:00.000Z' });
  check('noclose ok', res.ok === true);
  check('II.2.a awaiting-review', nodeBy(projectDir, 'II.2.a').status === 'awaiting-review');
  check('no closure prompt', res.closure === 'no-closure' || res.closure === 'none', res.closure);
  check('text recommends next', /\/ovd-go|\/ovd-log/.test(res.text));
  cleanup(tmpRoot);
})();

// --- COMMIT: sparse capture, no state -----------------------------------
(function () {
  const { projectDir, tmpRoot } = makeTempProject('commit-sparse');
  const res = applyLogDefault(projectDir, {}, { now: '2026-06-21T16:00:00.000Z' });
  check('sparse ok', res.ok === true);
  const body = readSession(projectDir, listSessions(projectDir)[0]);
  check('sparse session has save block', body.includes('## Save 2026-06-21 16:00'));
  check('sparse session notes no detail', /no detail captured/i.test(body));
  check('sparse made no status changes (II.2.a still in-progress)', nodeBy(projectDir, 'II.2.a').status === 'in-progress');
  cleanup(tmpRoot);
})();

// --- COMMIT: atomic on bad refs (no partial write) ----------------------
(function () {
  const { projectDir, tmpRoot } = makeTempProject('commit-badref');
  const before = readPlan(projectDir);
  const res = applyLogDefault(projectDir, {
    state: { status_changes: [{ id: 'NOPE.9', status: 'done' }] }
  }, { now: '2026-06-21T16:00:00.000Z' });
  check('bad status ref → not ok', res.ok === false, JSON.stringify(res));
  check('bad status ref → reason node-not-found', /not-found|not found/.test(res.reason || res.text || ''));
  check('bad status ref → OVERDRIVE.md unchanged', readPlan(projectDir) === before);
  check('bad status ref → no session file written', listSessions(projectDir).length === 0);

  const res2 = applyLogDefault(projectDir, {
    state: { active_node: 'GHOST.1' }
  }, { now: '2026-06-21T16:00:00.000Z' });
  check('bad active ref → not ok', res2.ok === false);
  check('bad active ref → OVERDRIVE.md unchanged', readPlan(projectDir) === before);
  cleanup(tmpRoot);
})();

// --- DOC UPDATE stub present --------------------------------------------
(function () {
  const { projectDir, tmpRoot } = makeTempProject('docstub');
  const res = applyLogDefault(projectDir, { capture: { modifications: ['x'] } }, { now: '2026-06-21T16:00:00.000Z' });
  check('result carries doc_update field', res.doc_update && typeof res.doc_update === 'object');
  check('doc_update is a deferred stub', res.doc_update.applied === false);
  check('doc_update references Task 5.7', /5\.7|runDocUpdate/.test(res.doc_update.note || ''));
  cleanup(tmpRoot);
})();

// --- sentinel lock (Q5.9) -----------------------------------------------
(function () {
  const { projectDir, tmpRoot } = makeTempProject('lock');
  const lock = acquireLogLock(projectDir);
  check('lock acquired', lock.ok === true);
  check('lock file exists', fs.existsSync(path.join(projectDir, '.overdrive', '_log.lock')));
  const second = acquireLogLock(projectDir);
  check('second lock fails', second.ok === false);
  // a commit while locked returns recovery message, no write
  const res = applyLogDefault(projectDir, { capture: { modifications: ['x'] } }, { now: '2026-06-21T16:00:00.000Z' });
  check('locked commit not ok', res.ok === false);
  check('locked commit reason locked', res.reason === 'locked', res.reason);
  check('locked commit surfaces recovery action', /_log\.lock/.test(res.text) && /delete/i.test(res.text), res.text);
  check('locked commit wrote no session', listSessions(projectDir).length === 0);
  releaseLogLock(lock);
  check('lock file removed after release', !fs.existsSync(path.join(projectDir, '.overdrive', '_log.lock')));
  // now a commit succeeds (lock released)
  const res2 = applyLogDefault(projectDir, { capture: { modifications: ['x'] } }, { now: '2026-06-21T16:00:00.000Z' });
  check('commit after release ok', res2.ok === true);
  check('lock released by commit too', !fs.existsSync(path.join(projectDir, '.overdrive', '_log.lock')));
  cleanup(tmpRoot);
})();

// --- runLogDefault dispatch (plan vs commit) ----------------------------
(function () {
  const { projectDir, tmpRoot } = makeTempProject('dispatch');
  const plan = runLogDefault(projectDir, {});
  check('dispatch bare → plan', plan.mode === 'plan');
  const commit = runLogDefault(projectDir, { entries: { capture: { modifications: ['y'] } }, now: '2026-06-21T16:00:00.000Z' });
  check('dispatch entries → commit', commit.mode === 'log-commit');
  check('dispatch invalid project dir', runLogDefault(null, {}).ok === false);
  cleanup(tmpRoot);
})();

// --- migration-compat seam (Pattern 5) ----------------------------------
// A migrated layout has legacy artifacts in sessions/. DEFAULT save must work,
// create a fresh session file, and not clobber migrated files or break parse.
(function () {
  const { projectDir, tmpRoot } = makeTempProject('migrate-seam');
  const d = sdir(projectDir);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, '_research_legacy.md'), 'legacy research\n');
  fs.writeFileSync(path.join(d, '2026-06-09T00-00-00.000Z-legacy-state.md'), 'legacy state\n');
  const res = applyLogDefault(projectDir, {
    capture: { modifications: ['post-migration save'] },
    state: { status_changes: [{ id: 'II.2.a', status: 'awaiting-review' }] }
  }, { now: '2026-06-21T16:00:00.000Z' });
  check('migrate-seam ok', res.ok === true, JSON.stringify(res));
  check('migrate-seam created fresh session file', fs.existsSync(path.join(d, '2026-06-21-16-00.md')));
  check('migrate-seam did not clobber legacy research', fs.readFileSync(path.join(d, '_research_legacy.md'), 'utf8') === 'legacy research\n');
  check('migrate-seam did not clobber legacy state', fs.readFileSync(path.join(d, '2026-06-09T00-00-00.000Z-legacy-state.md'), 'utf8') === 'legacy state\n');
  check('migrate-seam status applied', nodeBy(projectDir, 'II.2.a').status === 'awaiting-review');
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
