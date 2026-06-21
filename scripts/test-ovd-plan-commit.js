#!/usr/bin/env node
'use strict';

// Task 5.8 — COMMIT integration (r3 §7.6 step 11; auto-memory feedback_git_commits.md).
// ALWAYS user-approved. PLAN assembles message + file list + action-path; COMMIT
// executes git ONLY when confirm is set (= user approval), via an injectable
// runner. NEVER --no-verify / --no-gpg-sign; hooks honored.

const fs = require('fs');
const os = require('os');
const path = require('path');

const commit = require('../lib/ovd-plan/commit');
const {
  STATUS,
  buildCommitMessage,
  buildCommitPlan,
  applyCommit,
  runCommit
} = commit;

const verbose = process.argv.includes('--verbose');
let passed = 0;
const failures = [];
function check(label, condition, detail) {
  if (condition) { passed += 1; if (verbose) console.log(`PASS ${label}`); }
  else { failures.push(detail ? `${label}: ${detail}` : label); console.log(`FAIL ${label}`); }
}

function tmp() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ovd-plan-commit-'));
  fs.writeFileSync(path.join(root, 'package.json'), '{"name":"t"}\n');
  return root;
}
function cleanup(root) { fs.rmSync(root, { recursive: true, force: true }); }

// Mock git runner: records argv, returns success by default.
function mockGit(opts = {}) {
  const calls = [];
  const fn = (args) => {
    calls.push(args);
    if (opts.failOn && args[0] === opts.failOn) return { ok: false, code: 1, stdout: '', stderr: `${opts.failOn} failed` };
    return { ok: true, code: 0, stdout: opts.stdout || '', stderr: '' };
  };
  fn.calls = calls;
  return fn;
}

// --- buildCommitMessage convention (Q5.7) -------------------------------
(function () {
  check('default form', buildCommitMessage({ summary: 'tweaked widget' }) === 'ovd-plan: checkpoint — tweaked widget');
  check('handoff form', buildCommitMessage({ context: 'handoff', phase: 5, summary: 'session end' }) === 'ovd-plan(phase-5.handoff): session end');
  check('milestone-close form', buildCommitMessage({ context: 'milestone-close', milestone: 2, summary: 'dashboard done' }) === 'ovd-plan(milestone-2.close): dashboard done');
  check('explicit message wins', buildCommitMessage({ message: 'custom message', summary: 'ignored' }) === 'custom message');
  check('default summary fallback', /checkpoint —/.test(buildCommitMessage({})));
})();

// --- PLAN ---------------------------------------------------------------
(function () {
  const root = tmp();
  const res = buildCommitPlan(root, { summary: 'did stuff', files: ['OVERDRIVE.md', '.overdrive/handoffs/x.md'] });
  check('plan ok', res.ok === true);
  check('plan mode', res.mode === 'plan');
  check('plan shows message', res.message === 'ovd-plan: checkpoint — did stuff', res.message);
  check('plan lists files', /OVERDRIVE\.md/.test(res.text) && /handoffs\/x\.md/.test(res.text));
  check('plan numbered options', /\(1\)/.test(res.text) && /\(2\)/.test(res.text) && /\(3\)/.test(res.text));
  check('plan option 1 is commit', /\(1\)[^\n]*commit/i.test(res.text));
  check('plan option 2 amend', /\(2\)[^\n]*amend/i.test(res.text));
  check('plan option 3 skip', /\(3\)[^\n]*skip/i.test(res.text));
  check('plan offers other', /other/i.test(res.text));
  cleanup(root);
})();

// --- COMMIT requires confirm (never auto-commit) ------------------------
(function () {
  const root = tmp();
  const git = mockGit();
  const res = applyCommit(root, { summary: 's', files: ['a.txt'], runGit: git });
  check('no-confirm → not executed', res.mode !== 'commit-done', res.mode);
  check('no-confirm → needs_confirm', res.needs_confirm === true);
  check('no-confirm → git NOT called', git.calls.length === 0);
  cleanup(root);
})();

// --- COMMIT with confirm executes add + commit, no --no-verify ----------
(function () {
  const root = tmp();
  const git = mockGit();
  const res = applyCommit(root, { summary: 'real commit', files: ['a.txt', 'b.txt'], confirm: true, runGit: git });
  check('confirm → commit-done', res.mode === 'commit-done', JSON.stringify(res));
  check('confirm → ok', res.ok === true);
  check('git add called with files', git.calls.some((c) => c[0] === 'add' && c.includes('a.txt') && c.includes('b.txt')));
  check('git commit called', git.calls.some((c) => c[0] === 'commit'));
  const commitCall = git.calls.find((c) => c[0] === 'commit');
  check('commit uses -m', commitCall.includes('-m'));
  check('commit message present', commitCall.includes('ovd-plan: checkpoint — real commit'));
  const allArgs = git.calls.flat();
  check('NEVER --no-verify', !allArgs.includes('--no-verify'));
  check('NEVER --no-gpg-sign', !allArgs.includes('--no-gpg-sign'));
  check('result reports message', res.message === 'ovd-plan: checkpoint — real commit');
  cleanup(root);
})();

// --- COMMIT with no files commits staged (no add) -----------------------
(function () {
  const root = tmp();
  const git = mockGit();
  const res = applyCommit(root, { summary: 'staged only', files: [], confirm: true, runGit: git });
  check('no-files → commit-done', res.mode === 'commit-done');
  check('no-files → no git add', !git.calls.some((c) => c[0] === 'add'));
  check('no-files → git commit still called', git.calls.some((c) => c[0] === 'commit'));
  cleanup(root);
})();

// --- git add failure aborts before commit -------------------------------
(function () {
  const root = tmp();
  const git = mockGit({ failOn: 'add' });
  const res = applyCommit(root, { summary: 's', files: ['a.txt'], confirm: true, runGit: git });
  check('add failure → not ok', res.ok === false);
  check('add failure → reason', /add/.test(res.reason || ''));
  check('add failure → commit NOT attempted', !git.calls.some((c) => c[0] === 'commit'));
  cleanup(root);
})();

// --- git commit failure (e.g. hook rejected) reported -------------------
(function () {
  const root = tmp();
  const git = mockGit({ failOn: 'commit' });
  const res = applyCommit(root, { summary: 's', files: ['a.txt'], confirm: true, runGit: git });
  check('commit failure → not ok', res.ok === false);
  check('commit failure → reason', /commit/.test(res.reason || ''));
  check('commit failure → surfaces stderr', /failed/.test(res.text || ''));
  cleanup(root);
})();

// --- empty message rejected ---------------------------------------------
(function () {
  const root = tmp();
  const git = mockGit();
  const res = applyCommit(root, { message: '   ', confirm: true, runGit: git });
  check('empty message → not ok', res.ok === false);
  check('empty message → git NOT called', git.calls.length === 0);
  cleanup(root);
})();

// --- amend path: new message re-proposed --------------------------------
(function () {
  const root = tmp();
  const plan = buildCommitPlan(root, { message: 'amended message', files: ['a.txt'] });
  check('amend re-plan shows new message', plan.message === 'amended message');
  cleanup(root);
})();

// --- runCommit dispatch -------------------------------------------------
(function () {
  const root = tmp();
  const git = mockGit();
  const plan = runCommit(root, { summary: 's', files: ['a.txt'] });
  check('dispatch → plan when no confirm', plan.mode === 'plan');
  const done = runCommit(root, { summary: 's', files: ['a.txt'], confirm: true, runGit: git });
  check('dispatch → commit when confirm', done.mode === 'commit-done');
  check('dispatch invalid project dir', runCommit(null, {}).ok === false);
  cleanup(root);
})();

// --- summary ------------------------------------------------------------
if (failures.length) {
  console.log(`\n${failures.length} FAILURES:`);
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`\n${passed} checks passed, ${failures.length} failed.`);
  process.exit(1);
}
console.log(`${passed} checks passed.`);
