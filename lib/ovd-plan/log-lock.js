'use strict';

// Q5.9 — shared sentinel lock for /ovd-log state-writing critical sections.
//
// Both DEFAULT (log-default.js) and HANDOFF (handoff.js) acquire this single
// lock around their state-writing sections so two concurrent /ovd-log
// invocations cannot interleave writes to OVERDRIVE.md / sessions / handoffs.
// Defining it once (Pattern 2 — no fork) keeps the lock semantics + the recovery
// message identical across every /ovd-log path.
//
// Lightweight by design: an atomic lockfile via fs.openSync(..., 'wx'); no
// TTL/PID auto-recovery (scoped to Phase 7). On contention the caller surfaces
// an explicit recovery action (delete the lockfile and retry).

const fs = require('fs');
const path = require('path');

const { ovdPath } = require('./fs');

const STATUS = 'log';
const LOCK_REL = path.join('.overdrive', '_log.lock');

function acquireLogLock(rootDir) {
  const lockPath = ovdPath(rootDir, '_log.lock');
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  try {
    const fd = fs.openSync(lockPath, 'wx');
    return { ok: true, fd, lockPath };
  } catch (err) {
    if (err && err.code === 'EEXIST') return { ok: false, reason: 'locked', lockPath };
    throw err;
  }
}

function releaseLogLock(lock) {
  if (!lock || !lock.ok) return;
  try { fs.closeSync(lock.fd); } catch (_) { /* already closed */ }
  try { fs.unlinkSync(lock.lockPath); } catch (_) { /* already gone */ }
}

function lockedResult() {
  return {
    ok: false,
    status: STATUS,
    mode: 'commit',
    reason: 'locked',
    text: [
      'Another /ovd-log is in progress.',
      `If you are sure no other instance is running (e.g. a previous run crashed), delete \`${LOCK_REL}\` and retry.`
    ].join(' ')
  };
}

module.exports = {
  LOCK_REL,
  acquireLogLock,
  releaseLogLock,
  lockedResult
};
