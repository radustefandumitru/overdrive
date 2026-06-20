'use strict';

const fs = require('fs');
const path = require('path');

const { openState, commitState } = require('./deliberation-state');
const { isLeaf } = require('./noderef');
const { findLeaf, buildExecutePlan } = require('./execute');
const { isoToFilenameSafe } = require('./research');

// ---------------------------------------------------------------------------
// Task 4.5 — ITERATION LOOP (r3 §6.4, §10.6, §8.1).
//
// When an AWAITING REVIEW response classifies as `iterate` (Task 4.4), the
// feedback is captured to the leaf's `iterations[]` annotation (r3 §10.6:
// { session, feedback, delta_applied }), the status goes back to `in-progress`,
// and a re-execute plan is emitted carrying the delta (prior iterations + current
// feedback) so the agent applies ONLY the delta, not a full redo (brief-13
// delta-not-redo discipline — enforced by prompt structure; the writer preserves
// prior state for diffing). iterations[] round-trips via the semantic writer so
// the exact iteration state survives context clears (r3 §8.1 resume case).
// ---------------------------------------------------------------------------

const STATUS = 'go';
const SESSIONS_REL = path.join('.overdrive', 'sessions');

function getIterations(node) {
  const a = node.annotations || {};
  return Array.isArray(a.iterations) ? a.iterations : [];
}

// Append an iteration entry to the leaf annotation (mutates node in place).
function appendIteration(node, feedback, deltaApplied, now) {
  if (!node.annotations || typeof node.annotations !== 'object') node.annotations = {};
  if (!Array.isArray(node.annotations.iterations)) node.annotations.iterations = [];
  const entry = {
    session: now,
    feedback,
    delta_applied: (typeof deltaApplied === 'string' && deltaApplied) ? deltaApplied : 'pending'
  };
  node.annotations.iterations.push(entry);
  return { entry, count: node.annotations.iterations.length };
}

function renderIterationHistory(node) {
  const iters = getIterations(node);
  if (!iters.length) return '(no iterations yet)';
  return iters.map((it, i) => {
    const fb = it.feedback || '(no feedback recorded)';
    const da = it.delta_applied || 'pending';
    return `  [${i + 1}] ${it.session || '(no timestamp)'}\n      feedback: ${fb}\n      delta_applied: ${da}`;
  }).join('\n');
}

// PLAN mode — show iteration history + how to iterate.
function buildIteratePlan(rootDir, leafId) {
  const opened = openState(rootDir);
  if (!opened.ok) return { ok: false, status: STATUS, reason: opened.reason, text: opened.text };
  if (typeof leafId !== 'string' || leafId.trim() === '') {
    return { ok: false, status: STATUS, reason: 'missing-ref', text: 'ITERATION LOOP requires a leaf id (e.g. /ovd-go iterate II.2.a).' };
  }
  const node = findLeaf(opened.parsed.tree, leafId);
  if (!node) return { ok: false, status: STATUS, reason: 'leaf-not-found', text: `No node with id "${leafId}".` };
  if (!isLeaf(node)) return { ok: false, status: STATUS, reason: 'not-a-leaf', text: `${node.id} is a container, not a leaf.` };

  const iters = getIterations(node);
  const text = [
    `ITERATION LOOP — ${node.id} ${node.title || ''}`.trimEnd(),
    '',
    `Iterations so far: ${iters.length}`,
    renderIterationHistory(node),
    '',
    'To iterate, capture the feedback:',
    `  overdrive go iterate ${node.id} --entries-json '{"leaf_id":"${node.id}","feedback":"<what to change>"}'`
  ].join('\n');
  return { ok: true, status: STATUS, mode: 'iterate-plan', leaf_id: node.id, iteration_count: iters.length, text };
}

// COMMIT mode — capture feedback, set in-progress, emit re-execute-with-delta plan.
function normalizeIterateEntries(entries) {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return { ok: false, reason: 'invalid-entries', text: 'iterate commit requires a JSON object.' };
  }
  if (typeof entries.leaf_id !== 'string' || entries.leaf_id.trim() === '') {
    return { ok: false, reason: 'missing-leaf-id', text: 'iterate entries require a non-empty leaf_id.' };
  }
  if (typeof entries.feedback !== 'string' || entries.feedback.trim() === '') {
    return { ok: false, reason: 'missing-feedback', text: 'iterate entries require non-empty feedback describing the change.' };
  }
  return {
    ok: true,
    leaf_id: entries.leaf_id.trim(),
    feedback: entries.feedback.trim(),
    delta_applied: typeof entries.delta_applied === 'string' ? entries.delta_applied : null
  };
}

function iterateOnLeaf(rootDir, entries, opts) {
  const norm = normalizeIterateEntries(entries);
  if (!norm.ok) return { ok: false, status: STATUS, mode: 'commit', reason: norm.reason, text: norm.text };
  const opened = openState(rootDir);
  if (!opened.ok) return { ok: false, status: STATUS, mode: 'commit', reason: opened.reason, text: opened.text };
  const node = findLeaf(opened.parsed.tree, norm.leaf_id);
  if (!node) return { ok: false, status: STATUS, mode: 'commit', reason: 'leaf-not-found', text: `No node with id "${norm.leaf_id}".` };
  if (!isLeaf(node)) return { ok: false, status: STATUS, mode: 'commit', reason: 'not-a-leaf', text: `${node.id} is a container, not a leaf.` };

  const now = (opts && opts.now) || new Date().toISOString();
  const { count } = appendIteration(node, norm.feedback, norm.delta_applied, now);
  node.status = 'in-progress';
  const committed = commitState(rootDir, opened);
  if (!committed.ok) return { ok: false, status: STATUS, mode: 'commit', reason: committed.reason, text: committed.text };

  // Session capture of the iteration.
  const safeId = node.id.replace(/[^A-Za-z0-9.]/g, '-');
  const dir = path.join(rootDir, SESSIONS_REL);
  let sessionFile = null;
  try {
    fs.mkdirSync(dir, { recursive: true });
    const fileName = `${isoToFilenameSafe(now)}-iterate-${safeId}.md`;
    fs.writeFileSync(path.join(dir, fileName), [
      `# ITERATION ${count} — ${node.id} ${node.title || ''}`.trimEnd(),
      '',
      `- timestamp: ${now}`,
      `- feedback: ${norm.feedback}`,
      `- delta_applied: ${norm.delta_applied || 'pending'}`,
      ''
    ].join('\n'));
    sessionFile = path.join(SESSIONS_REL, fileName);
  } catch (err) {
    sessionFile = null;
  }

  // Re-execute plan with the delta. Reuse buildExecutePlan (Pattern 2) for the
  // base contract; prepend the iteration delta context (apply only the delta).
  const execPlan = buildExecutePlan(rootDir, node.id, opts || {});
  const priorIters = getIterations(node);
  const deltaLines = [];
  deltaLines.push(`ITERATION ${count} — re-executing ${node.id} with a delta (status → in-progress).`);
  deltaLines.push('');
  deltaLines.push(`Delta requested: ${norm.feedback}`);
  if (priorIters.length > 1) {
    deltaLines.push('');
    deltaLines.push('Prior iterations (context — do NOT re-do these):');
    priorIters.slice(0, -1).forEach((it, i) => deltaLines.push(`  [${i + 1}] ${it.feedback} → ${it.delta_applied}`));
  }
  deltaLines.push('');
  deltaLines.push('Apply ONLY this delta — not a full re-do. When done, record delta_applied via the execute commit.');
  deltaLines.push('');
  deltaLines.push('--- Re-execute plan ---');
  deltaLines.push(execPlan.ok ? execPlan.text : `(execute plan unavailable: ${execPlan.reason})`);

  return {
    ok: true,
    status: STATUS,
    mode: 'iterate-commit',
    leaf_id: node.id,
    iteration_count: count,
    status_after: 'in-progress',
    feedback: norm.feedback,
    session_file: sessionFile,
    text: deltaLines.join('\n')
  };
}

function runIterate(rootDir, opts = {}) {
  if (!rootDir || typeof rootDir !== 'string') {
    return { ok: false, status: STATUS, reason: 'invalid-project-dir', text: 'runIterate requires a project directory string.' };
  }
  const mode = opts.mode || (opts.entries ? 'commit' : 'plan');
  if (mode === 'commit') return iterateOnLeaf(rootDir, opts.entries, opts);
  return buildIteratePlan(rootDir, opts.leafId || opts.ref || null);
}

module.exports = {
  STATUS,
  SESSIONS_REL,
  getIterations,
  appendIteration,
  renderIterationHistory,
  buildIteratePlan,
  normalizeIterateEntries,
  iterateOnLeaf,
  runIterate
};
