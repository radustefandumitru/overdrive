#!/usr/bin/env node
'use strict';

// Task 5.5 — runRecursiveCloseCheck shared utility (r3 §7.5, §6.5).
// The single recursive-close entry both /ovd-log DEFAULT and HANDOFF call.
// Must produce IDENTICAL walks to the underlying recursiveCloseFlow (and to the
// /ovd-go `runClose` plan entry) — no fork (FM #2).

const fs = require('fs');
const os = require('os');
const path = require('path');

const closure = require('../lib/ovd-plan/closure');
const {
  recursiveCloseFlow,
  runRecursiveCloseCheck,
  deriveJustClosedFromState,
  runClose
} = closure;

const verbose = process.argv.includes('--verbose');
let passed = 0;
const failures = [];
function check(label, condition, detail) {
  if (condition) { passed += 1; if (verbose) console.log(`PASS ${label}`); }
  else { failures.push(detail ? `${label}: ${detail}` : label); console.log(`FAIL ${label}`); }
}

const FRONT = '---\novd-plan: true\nversion: 3\nproject: "Test Project"\n---\n\n';
// Closing II.2.a leaves II.2 with all children done (II.2.b already done) →
// II.2 eligible; II has open sibling II.3 → walk stops at II.2.
function fixture(activeLine) {
  return `${FRONT}# Test Project

## I. Foundation [done]

### I.1 Setup [done]

## II. Dashboard [in-progress]

### II.1 Data [done]

### II.2 Stats [in-progress]

#### II.2.a Widget [done]${activeLine === 'II.2.a' ? ' ← ACTIVE' : ''}

#### II.2.b Chart [done]

### II.3 Profile [pending]${activeLine === 'II.3' ? ' ← ACTIVE' : ''}
`;
}

function makeProject(name, activeLine) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-rclose-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), fixture(activeLine));
  return { projectDir, tmpRoot };
}
function cleanup(tmpRoot) { fs.rmSync(tmpRoot, { recursive: true, force: true }); }

// Compare the walk-relevant fields between two flow results.
function sameWalk(a, b) {
  if (!a || !b) return false;
  if (a.mode !== b.mode) return false;
  if (a.text !== b.text) return false;
  const ai = (a.current && a.current.id) || null;
  const bi = (b.current && b.current.id) || null;
  if (ai !== bi) return false;
  const al = (a.closures || []).map((c) => c.id).join(',');
  const bl = (b.closures || []).map((c) => c.id).join(',');
  return al === bl;
}

// --- explicit justClosed === recursiveCloseFlow (identical walk) --------
(function () {
  const { projectDir, tmpRoot } = makeProject('explicit', 'II.3');
  const wrapped = runRecursiveCloseCheck(projectDir, { justClosed: 'II.2.a' });
  const direct = recursiveCloseFlow(projectDir, 'II.2.a', {});
  check('wrapper ok', wrapped.ok === true, JSON.stringify(wrapped));
  check('wrapper is closure-prompt', wrapped.mode === 'closure-prompt', wrapped.mode);
  check('wrapper current is II.2', wrapped.current && wrapped.current.id === 'II.2');
  check('wrapper text mentions II.2', /II\.2\b/.test(wrapped.text));
  check('wrapper walk identical to recursiveCloseFlow', sameWalk(wrapped, direct), `${wrapped.text}\n---\n${direct.text}`);
  cleanup(tmpRoot);
})();

// --- identical to the /ovd-go runClose plan entry -----------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('go-parity', 'II.3');
  const wrapped = runRecursiveCloseCheck(projectDir, { justClosed: 'II.2.a' });
  const goPlan = runClose(projectDir, { leafId: 'II.2.a' }); // /ovd-go close <ref> PLAN
  check('go-parity: same walk as /ovd-go runClose', sameWalk(wrapped, goPlan), `${wrapped.text}\n---\n${goPlan.text}`);
  cleanup(tmpRoot);
})();

// --- derive-from-state fallback: active node is itself closed ------------
(function () {
  const { projectDir, tmpRoot } = makeProject('derive', 'II.2.a'); // II.2.a done AND active
  check('derive finds the closed active leaf', deriveJustClosedFromState(projectDir) === 'II.2.a');
  const noArg = runRecursiveCloseCheck(projectDir, {});
  const explicit = runRecursiveCloseCheck(projectDir, { justClosed: 'II.2.a' });
  check('derive: no-arg call equals explicit call', sameWalk(noArg, explicit), noArg.mode);
  check('derive: surfaces II.2 closure', noArg.mode === 'closure-prompt' && noArg.current.id === 'II.2');
  cleanup(tmpRoot);
})();

// --- no-closure: active node not closed, no justClosed ------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('noclose', 'II.3'); // II.3 pending + active
  check('derive returns null when active not closed', deriveJustClosedFromState(projectDir) === null);
  const res = runRecursiveCloseCheck(projectDir, {});
  check('no-closure ok', res.ok === true);
  check('no-closure mode', res.mode === 'no-closure', res.mode);
  check('no-closure reason nothing-closed', res.reason === 'nothing-closed');
  check('no-closure has empty closures', Array.isArray(res.closures) && res.closures.length === 0);
  check('no-closure text explains', /nothing to close/i.test(res.text));
  cleanup(tmpRoot);
})();

// --- empty-string justClosed treated as absent --------------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('emptystr', 'II.3');
  const res = runRecursiveCloseCheck(projectDir, { justClosed: '   ' });
  check('blank justClosed → derive/no-closure (not error)', res.ok === true && res.mode === 'no-closure', res.mode);
  cleanup(tmpRoot);
})();

// --- invalid project dir ------------------------------------------------
(function () {
  const bad = runRecursiveCloseCheck(null, { justClosed: 'II.2.a' });
  check('invalid project dir not ok', bad.ok === false);
  check('invalid project dir reason', bad.reason === 'invalid-project-dir');
})();

// --- unknown node id flows through recursiveCloseFlow's handling --------
(function () {
  const { projectDir, tmpRoot } = makeProject('unknown', 'II.3');
  const wrapped = runRecursiveCloseCheck(projectDir, { justClosed: 'ZZZ.9' });
  const direct = recursiveCloseFlow(projectDir, 'ZZZ.9', {});
  check('unknown id: wrapper matches direct', sameWalk(wrapped, direct), `${wrapped.text}\n---\n${direct.text}`);
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
