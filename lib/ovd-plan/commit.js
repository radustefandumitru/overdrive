'use strict';

// Task 5.8 — COMMIT integration  (r3 §7.6 step 11; auto-memory feedback_git_commits.md)
//
// HARD RULE (non-negotiable, from the user's locked git feedback): commits are
// ALWAYS user-approved. This handler enforces it structurally:
//   - PLAN mode assembles the message + file list + a numbered action-path and
//     executes NOTHING.
//   - COMMIT mode runs git ONLY when `confirm` is set — and `confirm` is set by
//     the slash-command body solely after the user picks "(1) commit". The CLI
//     never auto-commits.
//   - NEVER `--no-verify`, NEVER `--no-gpg-sign` — hooks/signing are honored.
//
// git is invoked through an injectable runner (`opts.runGit`) so tests use a mock
// and never touch a real repo. Message convention is Q5.7's three-form scheme.

const { spawnSync } = require('child_process');

const STATUS = 'log';

// Q5.7 — three-form commit convention.
function buildCommitMessage(opts = {}) {
  if (typeof opts.message === 'string' && opts.message.trim()) return opts.message.trim();
  const summary = (typeof opts.summary === 'string' && opts.summary.trim()) ? opts.summary.trim() : 'session checkpoint';
  switch (opts.context) {
    case 'handoff':
      return opts.phase != null ? `ovd-plan(phase-${opts.phase}.handoff): ${summary}` : `ovd-plan: handoff — ${summary}`;
    case 'milestone-close':
      return opts.milestone != null ? `ovd-plan(milestone-${opts.milestone}.close): ${summary}` : `ovd-plan: milestone close — ${summary}`;
    default:
      return `ovd-plan: checkpoint — ${summary}`;
  }
}

function normalizeFiles(files) {
  return Array.isArray(files) ? files.filter((f) => typeof f === 'string' && f.trim()).map((f) => f.trim()) : [];
}

function defaultRunGit(rootDir) {
  return (args) => {
    const r = spawnSync('git', args, { cwd: rootDir, encoding: 'utf8' });
    if (r.error) return { ok: false, code: null, stdout: '', stderr: r.error.message };
    return { ok: r.status === 0, code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
  };
}

// ---------------------------------------------------------------------------
// PLAN — propose the commit; execute nothing.
// ---------------------------------------------------------------------------
function buildCommitPlan(rootDir, opts = {}) {
  const message = buildCommitMessage(opts);
  const files = normalizeFiles(opts.files);
  const lines = [];
  lines.push('COMMIT (user approval required — nothing is committed until you choose).');
  lines.push('');
  lines.push(`Message: ${message}`);
  lines.push('');
  if (files.length) {
    lines.push('Files to stage:');
    for (const f of files) lines.push(`  - ${f}`);
  } else {
    lines.push('Files: (commit currently-staged changes)');
  }
  lines.push('');
  lines.push('  (1) commit as proposed — stage the files and commit (hooks run; no --no-verify).');
  lines.push('  (2) amend message — provide a new message and re-propose.');
  lines.push('  (3) skip commit — finish without committing; you can commit manually.');
  lines.push('  (4) other — describe what you want.');
  return { ok: true, status: STATUS, mode: 'plan', message, files, text: lines.join('\n') };
}

// ---------------------------------------------------------------------------
// COMMIT — execute only with explicit confirm.
// ---------------------------------------------------------------------------
function applyCommit(rootDir, opts = {}) {
  // An explicitly-provided-but-blank message is a caller error — reject rather
  // than silently substituting the convention default (which would hide intent).
  if (typeof opts.message === 'string' && !opts.message.trim()) {
    return { ok: false, status: STATUS, mode: 'commit', reason: 'empty-message', text: 'Commit message is empty.' };
  }
  const message = buildCommitMessage(opts);
  if (!message || !message.trim()) {
    return { ok: false, status: STATUS, mode: 'commit', reason: 'empty-message', text: 'Commit message is empty.' };
  }
  const files = normalizeFiles(opts.files);

  if (!opts.confirm) {
    // Re-surface the proposal; do not execute (never auto-commit).
    const plan = buildCommitPlan(rootDir, opts);
    return Object.assign({}, plan, { needs_confirm: true });
  }

  const runGit = typeof opts.runGit === 'function' ? opts.runGit : defaultRunGit(rootDir);

  if (files.length) {
    const add = runGit(['add', ...files]);
    if (!add.ok) {
      return { ok: false, status: STATUS, mode: 'commit', reason: 'git-add-failed', text: `git add failed: ${add.stderr || `exit ${add.code}`}` };
    }
  }
  // No --no-verify / --no-gpg-sign — hooks and signing are honored (hard rule).
  const result = runGit(['commit', '-m', message]);
  if (!result.ok) {
    return { ok: false, status: STATUS, mode: 'commit', reason: 'git-commit-failed', text: `git commit failed: ${result.stderr || `exit ${result.code}`}` };
  }
  return {
    ok: true,
    status: STATUS,
    mode: 'commit-done',
    message,
    files,
    text: `Committed: ${message}${files.length ? ` (${files.length} file(s))` : ''}.`
  };
}

function runCommit(rootDir, opts = {}) {
  if (!rootDir || typeof rootDir !== 'string') {
    return { ok: false, status: STATUS, reason: 'invalid-project-dir', text: 'runCommit requires a project directory string.' };
  }
  const mode = opts.mode || (opts.confirm ? 'commit' : 'plan');
  if (mode === 'commit') return applyCommit(rootDir, opts);
  return buildCommitPlan(rootDir, opts);
}

module.exports = {
  STATUS,
  buildCommitMessage,
  normalizeFiles,
  buildCommitPlan,
  applyCommit,
  runCommit
};
