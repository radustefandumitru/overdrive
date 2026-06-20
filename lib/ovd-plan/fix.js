'use strict';

const { openState, commitState } = require('./deliberation-state');
const { isLeaf } = require('./noderef');
const { findLeaf } = require('./execute');

// ---------------------------------------------------------------------------
// Task 4.9 — Two-attempt FIX escalation (r3 §6.9, Q11).
//
// When LEAF VERIFY fails (Task 4.3), the FIX loop runs: attempt 1 (targeted fix),
// re-verify; if still failing, attempt 2 (a DIFFERENT approach — the plan cites
// attempt 1's approach + result per Q4.8 so the agent doesn't repeat it); if
// attempt 2 also fails, ESCALATE to the user with a structured diagnosis + the
// §6.9 action-path (try-once-more / replan / skip / other). Cap is 2 attempts.
//
// Pattern-1 dispatch: the agent does the diagnosis + fix + re-verify; the CLI
// tracks attempts in the leaf's `fix_attempts[]` annotation (writer round-trip,
// so the 2-cap survives context clears), enforces the cap, and emits the
// escalation report. FM #7: verify is the truth, not agent confidence — a fix
// "succeeds" only when the agent reports result:pass (the re-verify passed).
// FM #8: `skip` is allowed but transitions to `blocked` only on explicit user
// choice via the escalation action-path.
// ---------------------------------------------------------------------------

const STATUS = 'go';
const MAX_ATTEMPTS = 2;
const FIX_RESULTS = ['pass', 'fail'];
const ESCALATION_DECISIONS = ['try-once-more', 'replan', 'skip'];

function getFixAttempts(node) {
  const a = node.annotations || {};
  return Array.isArray(a.fix_attempts) ? a.fix_attempts : [];
}

function renderEscalation(node, attempts, hypothesis) {
  const lines = [];
  lines.push(`${node.id} — verification still failing after ${attempts.length} fix attempts.`);
  lines.push('');
  lines.push('Diagnosis:');
  attempts.forEach((at) => {
    lines.push(`  attempt ${at.attempt}: approach="${at.approach || '(unspecified)'}"`);
    if (at.error) lines.push(`    error: ${at.error}`);
    if (at.log_excerpt) lines.push(`    log: ${at.log_excerpt}`);
  });
  if (hypothesis) { lines.push(''); lines.push(`Hypothesis: ${hypothesis}`); }
  lines.push('');
  lines.push('Options (r3 §6.9):');
  lines.push('  (1) try-once-more — describe what to try; resets the fix attempt count.');
  lines.push(`  (2) replan — this leaf needs a rethink; route to /ovd-plan edit ${node.id}.`);
  lines.push(`  (3) skip — mark ${node.id} blocked and advance.`);
  lines.push('  (4) other — describe what you want.');
  return lines.join('\n');
}

// PLAN — emit the next FIX attempt plan, or the escalation if the cap is hit.
function buildFixPlan(rootDir, leafId, opts) {
  const opened = openState(rootDir);
  if (!opened.ok) return { ok: false, status: STATUS, reason: opened.reason, text: opened.text };
  if (typeof leafId !== 'string' || leafId.trim() === '') {
    return { ok: false, status: STATUS, reason: 'missing-ref', text: 'FIX requires a leaf id (e.g. /ovd-go fix II.2.a).' };
  }
  const node = findLeaf(opened.parsed.tree, leafId);
  if (!node) return { ok: false, status: STATUS, reason: 'leaf-not-found', text: `No node with id "${leafId}".` };
  if (!isLeaf(node)) return { ok: false, status: STATUS, reason: 'not-a-leaf', text: `${node.id} is a container, not a leaf.` };

  const attempts = getFixAttempts(node);
  const failureSummary = (opts && opts.failureSummary) || '(provide the verify failure signature)';

  if (attempts.length >= MAX_ATTEMPTS) {
    return {
      ok: true, status: STATUS, mode: 'fix-escalate', leaf_id: node.id, attempts,
      text: renderEscalation(node, attempts, opts && opts.hypothesis)
    };
  }

  const nextAttempt = attempts.length + 1;
  const lines = [];
  lines.push(`FIX attempt ${nextAttempt}/${MAX_ATTEMPTS} — ${node.id} ${node.title || ''}`.trimEnd());
  lines.push('');
  lines.push(`Verify failure: ${failureSummary}`);
  lines.push('');
  if (nextAttempt === 1) {
    lines.push('Diagnose the failure and apply a targeted fix within scope, then re-verify.');
  } else {
    const prior = attempts[attempts.length - 1];
    lines.push(`Attempt 1 already tried: approach="${prior.approach || '(unspecified)'}" → produced: ${prior.error || 'still failing'}.`);
    lines.push('Try a DIFFERENT approach this time (do not repeat attempt 1), then re-verify.');
  }
  lines.push('');
  lines.push('FM #7: verify is the truth — report result:pass only if the re-verify actually passed.');
  lines.push('');
  lines.push('Record the attempt:');
  lines.push(`  overdrive go fix ${node.id} --entries-json '{"leaf_id":"${node.id}","approach":"<what you tried>","result":"pass|fail","error":"<if fail>","log_excerpt":"<optional>"}'`);

  return { ok: true, status: STATUS, mode: 'fix-plan', leaf_id: node.id, attempt: nextAttempt, max_attempts: MAX_ATTEMPTS, text: lines.join('\n') };
}

// COMMIT — record a fix attempt result.
function normalizeFixEntries(entries) {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return { ok: false, reason: 'invalid-entries', text: 'fix commit requires a JSON object.' };
  }
  if (typeof entries.leaf_id !== 'string' || entries.leaf_id.trim() === '') {
    return { ok: false, reason: 'missing-leaf-id', text: 'fix entries require a non-empty leaf_id.' };
  }
  if (!FIX_RESULTS.includes(entries.result)) {
    return { ok: false, reason: 'invalid-result', text: `result must be one of ${FIX_RESULTS.join(' / ')}.` };
  }
  return {
    ok: true,
    leaf_id: entries.leaf_id.trim(),
    approach: typeof entries.approach === 'string' ? entries.approach : '',
    result: entries.result,
    error: typeof entries.error === 'string' ? entries.error : null,
    log_excerpt: typeof entries.log_excerpt === 'string' ? entries.log_excerpt : null
  };
}

function applyFixAttempt(rootDir, entries, opts) {
  const norm = normalizeFixEntries(entries);
  if (!norm.ok) return { ok: false, status: STATUS, mode: 'commit', reason: norm.reason, text: norm.text };
  const opened = openState(rootDir);
  if (!opened.ok) return { ok: false, status: STATUS, mode: 'commit', reason: opened.reason, text: opened.text };
  const node = findLeaf(opened.parsed.tree, norm.leaf_id);
  if (!node) return { ok: false, status: STATUS, mode: 'commit', reason: 'leaf-not-found', text: `No node with id "${norm.leaf_id}".` };
  if (!isLeaf(node)) return { ok: false, status: STATUS, mode: 'commit', reason: 'not-a-leaf', text: `${node.id} is a container, not a leaf.` };

  const attempts = getFixAttempts(node);
  if (attempts.length >= MAX_ATTEMPTS) {
    return { ok: false, status: STATUS, mode: 'commit', reason: 'cap-reached', text: `${node.id} already has ${MAX_ATTEMPTS} fix attempts. Resolve via the escalation action-path (try-once-more / replan / skip).` };
  }

  if (!node.annotations || typeof node.annotations !== 'object') node.annotations = {};
  if (!Array.isArray(node.annotations.fix_attempts)) node.annotations.fix_attempts = [];
  const attemptNum = node.annotations.fix_attempts.length + 1;
  node.annotations.fix_attempts.push({ attempt: attemptNum, approach: norm.approach, error: norm.error, log_excerpt: norm.log_excerpt });

  let out;
  if (norm.result === 'pass') {
    node.status = 'awaiting-review';
    out = [
      `${node.id} — fix succeeded on attempt ${attemptNum}${attemptNum > 1 ? ` (required ${attemptNum} fix attempts)` : ''}. Re-verify passed → AWAITING REVIEW.`,
      '',
      'Next:',
      `  (1) /ovd-go review ${node.id} — present for approval.`,
      '  (2) Other — describe what you want.'
    ].join('\n');
  } else if (attemptNum < MAX_ATTEMPTS) {
    out = [
      `${node.id} — fix attempt ${attemptNum} failed. ${MAX_ATTEMPTS - attemptNum} attempt left.`,
      '',
      `Next: /ovd-go fix ${node.id} — attempt ${attemptNum + 1} with a DIFFERENT approach.`
    ].join('\n');
  } else {
    out = renderEscalation(node, node.annotations.fix_attempts, opts && opts.hypothesis);
  }

  const committed = commitState(rootDir, opened);
  if (!committed.ok) return { ok: false, status: STATUS, mode: 'commit', reason: committed.reason, text: committed.text };

  return {
    ok: true,
    status: STATUS,
    mode: norm.result === 'pass' ? 'fix-passed' : (attemptNum < MAX_ATTEMPTS ? 'fix-retry' : 'fix-escalate'),
    leaf_id: node.id,
    attempt: attemptNum,
    result: norm.result,
    status_after: node.status,
    escalated: norm.result === 'fail' && attemptNum >= MAX_ATTEMPTS,
    text: out
  };
}

// COMMIT — resolve an escalation decision (try-once-more / replan / skip).
function applyEscalationDecision(rootDir, entries, opts) {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries) || typeof entries.leaf_id !== 'string' || !entries.leaf_id.trim()) {
    return { ok: false, status: STATUS, mode: 'commit', reason: 'missing-leaf-id', text: 'escalation decision requires a non-empty leaf_id.' };
  }
  if (!ESCALATION_DECISIONS.includes(entries.escalation_decision)) {
    return { ok: false, status: STATUS, mode: 'commit', reason: 'invalid-decision', text: `escalation_decision must be one of ${ESCALATION_DECISIONS.join(' / ')}.` };
  }
  const opened = openState(rootDir);
  if (!opened.ok) return { ok: false, status: STATUS, mode: 'commit', reason: opened.reason, text: opened.text };
  const node = findLeaf(opened.parsed.tree, entries.leaf_id.trim());
  if (!node) return { ok: false, status: STATUS, mode: 'commit', reason: 'leaf-not-found', text: `No node with id "${entries.leaf_id}".` };
  if (!isLeaf(node)) return { ok: false, status: STATUS, mode: 'commit', reason: 'not-a-leaf', text: `${node.id} is a container, not a leaf.` };

  const decision = entries.escalation_decision;
  if (decision === 'skip') {
    node.status = 'blocked';
    const committed = commitState(rootDir, opened);
    if (!committed.ok) return { ok: false, status: STATUS, mode: 'commit', reason: committed.reason, text: committed.text };
    return { ok: true, status: STATUS, mode: 'escalation-commit', leaf_id: node.id, escalation_decision: 'skip', status_after: 'blocked', text: `${node.id} skipped → marked blocked. Run /ovd-go to continue elsewhere.` };
  }
  if (decision === 'replan') {
    return { ok: true, status: STATUS, mode: 'escalation-commit', leaf_id: node.id, escalation_decision: 'replan', status_after: node.status, text: `Routing ${node.id} to replanning. Run /ovd-plan edit to rethink this leaf.` };
  }
  // try-once-more — reset the fix attempt count (user explicitly granted another attempt).
  if (node.annotations && Array.isArray(node.annotations.fix_attempts)) node.annotations.fix_attempts = [];
  const committed = commitState(rootDir, opened);
  if (!committed.ok) return { ok: false, status: STATUS, mode: 'commit', reason: committed.reason, text: committed.text };
  return { ok: true, status: STATUS, mode: 'escalation-commit', leaf_id: node.id, escalation_decision: 'try-once-more', status_after: node.status, text: `Fix attempt count reset for ${node.id}. Run /ovd-go fix ${node.id} for another attempt.` };
}

function runFix(rootDir, opts = {}) {
  if (!rootDir || typeof rootDir !== 'string') {
    return { ok: false, status: STATUS, reason: 'invalid-project-dir', text: 'runFix requires a project directory string.' };
  }
  const entries = opts.entries;
  if (entries && typeof entries === 'object' && !Array.isArray(entries) && entries.escalation_decision != null) {
    return applyEscalationDecision(rootDir, entries, opts);
  }
  const mode = opts.mode || (entries ? 'commit' : 'plan');
  if (mode === 'commit') return applyFixAttempt(rootDir, entries, opts);
  return buildFixPlan(rootDir, opts.leafId || opts.ref || null, opts);
}

module.exports = {
  STATUS,
  MAX_ATTEMPTS,
  FIX_RESULTS,
  ESCALATION_DECISIONS,
  getFixAttempts,
  renderEscalation,
  buildFixPlan,
  normalizeFixEntries,
  applyFixAttempt,
  applyEscalationDecision,
  runFix
};
