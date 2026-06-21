'use strict';

// Task 5.2 — /ovd-log handoff — full 11-step pipeline  (r3 §7.6)
//
// The 11-step ordering is the CONTRACT (hard rule 6): steps are never combined or
// reordered; conditional steps (7–10) run only when the recursive close reaches a
// milestone the user approves; step 11 is always offered but user-gated.
//
//   1 SUMMARISE  2 STATE UPDATE  3 FOLLOW-UPS  4 DOC UPDATE  5 WRITE HANDOFF FILE
//   6 RECURSIVE CLOSE CHECK  7 MILESTONE CLOSE  8 LEARNINGS  9 RELEASE PREP
//   10 ARCHIVE  11 COMMIT
//
// Pattern-1: SUMMARISE / FOLLOW-UPS narratives are agent-side (carried in
// --entries-json); the CLI persists them and orchestrates the steps. Pattern-2
// reuse throughout: log-default.applyStateUpdate (state), appendDecision,
// runDocUpdate (5.7), runRecursiveCloseCheck (5.5), runMilestoneClose (5.6),
// runCommit (5.8). No step logic is forked.
//
// Slice A implements steps 1–5 (this commit). Slices B (6–10) and C (11) extend
// applyHandoff. Step boundaries are commit-safe: a failure in an early step
// aborts before later persistence (Q5.2 — re-invocation resumes cleanly).

const fs = require('fs');
const path = require('path');

const { normalizeState, applyStateUpdate } = require('./log-default');
const { appendDecision } = require('./decisions-log');
const { runDocUpdate } = require('./doc-update');
const { runRecursiveCloseCheck } = require('./closure');
const { runMilestoneClose } = require('./milestone-close');
const { formatStamp } = require('./log-capture');
const { ovdPath } = require('./fs');

const STATUS = 'log';

const STEPS = [
  'SUMMARISE SESSION',
  'STATE UPDATE',
  'IDENTIFY FOLLOW-UPS',
  'DOC UPDATE',
  'WRITE HANDOFF FILE',
  'RECURSIVE CLOSE CHECK',
  'MILESTONE CLOSE',
  'LEARNINGS EXTRACT',
  'RELEASE PREP',
  'ARCHIVE',
  'COMMIT'
];

function nowIso(opts) {
  return (opts && opts.now) || new Date().toISOString();
}

function coerceArray(v) {
  if (Array.isArray(v)) return v.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim());
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}

function readActiveLeafId(rootDir) {
  try {
    const { parseOverdriveMd } = require('./parser');
    const { flattenNodes } = require('./noderef');
    const parsed = parseOverdriveMd(fs.readFileSync(path.join(rootDir, 'OVERDRIVE.md'), 'utf8'));
    const active = flattenNodes(parsed.tree).find((n) => n.active);
    return active ? active.id : null;
  } catch (_) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// PLAN
// ---------------------------------------------------------------------------
function buildHandoffPlan(rootDir, opts = {}) {
  const activeId = readActiveLeafId(rootDir);
  const lines = [];
  lines.push('HANDOFF — full end-of-session pipeline (11 steps, in order):');
  lines.push('');
  STEPS.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
  lines.push('');
  lines.push(activeId ? `Active leaf: ${activeId}` : 'Active leaf: (none set)');
  lines.push('');
  lines.push('Distill the session (step 1) + follow-ups (step 3), then re-invoke with --entries-json:');
  lines.push('  {');
  lines.push('    "summary": { "highlights": ["..."], "decisions": ["..."], "plan_adjustments": ["..."], "new_nodes": ["..."], "concerns": ["..."], "iteration_counts": [{ "id": "<leaf>", "count": <n> }] },');
  lines.push('    "state": { "active_node": "<id>", "status_changes": [{ "id": "<node>", "status": "<status>" }], "decisions": [{ "node": "<id>", "decision": "...", "rationale": "..." }] },');
  lines.push('    "follow_ups": { "awaiting_review": ["..."], "needs_testing": ["..."], "deferred_edits": ["..."], "open_questions": ["..."], "concerns_followup": ["..."] },');
  lines.push('    "docs": { "updates": [{ "doc": "<rel>", "heading": "<section>", "body": "<new>" }] },');
  lines.push('    "closed_leaf": "<leaf just completed, for the close check, or omit>",');
  lines.push('    "milestone_close": { "learnings": { ... }, "release_prep": { ... }, "disposition": "done" },');
  lines.push('    "commit": { "confirm": false, "message": "<optional>" }');
  lines.push('  }');
  lines.push('');
  lines.push('Steps 6–10 run only if the close check reaches a milestone you approve. Step 11 (commit) is always user-gated.');
  return { ok: true, status: STATUS, mode: 'plan', active_leaf: activeId, steps: STEPS, text: lines.join('\n') };
}

// ---------------------------------------------------------------------------
// NORMALIZE
// ---------------------------------------------------------------------------
function normalizeSummary(raw) {
  const s = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  const iteration_counts = Array.isArray(s.iteration_counts)
    ? s.iteration_counts
      .filter((x) => x && typeof x === 'object' && typeof x.id === 'string' && x.id.trim())
      .map((x) => ({ id: x.id.trim(), count: Number.isFinite(x.count) ? x.count : 0 }))
    : [];
  return {
    highlights: coerceArray(s.highlights),
    decisions: coerceArray(s.decisions),
    plan_adjustments: coerceArray(s.plan_adjustments),
    new_nodes: coerceArray(s.new_nodes),
    concerns: coerceArray(s.concerns),
    iteration_counts
  };
}

function normalizeFollowUps(raw) {
  const f = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  return {
    awaiting_review: coerceArray(f.awaiting_review),
    needs_testing: coerceArray(f.needs_testing),
    deferred_edits: coerceArray(f.deferred_edits),
    open_questions: coerceArray(f.open_questions),
    concerns_followup: coerceArray(f.concerns_followup)
  };
}

function normalizeHandoffEntries(entries) {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return { ok: false, reason: 'invalid-entries', text: '/ovd-log handoff commit requires a JSON object.' };
  }
  const state = normalizeState(entries.state);
  if (!state.ok) return state;
  return {
    ok: true,
    summary: normalizeSummary(entries.summary),
    state: { active_node: state.active_node, status_changes: state.status_changes, decisions: state.decisions },
    follow_ups: normalizeFollowUps(entries.follow_ups),
    docs: (entries.docs && typeof entries.docs === 'object') ? entries.docs : null,
    closed_leaf: (typeof entries.closed_leaf === 'string' && entries.closed_leaf.trim()) ? entries.closed_leaf.trim() : null,
    milestone_close: (entries.milestone_close && typeof entries.milestone_close === 'object') ? entries.milestone_close : null,
    commit: (entries.commit && typeof entries.commit === 'object') ? entries.commit : null
  };
}

// ---------------------------------------------------------------------------
// HANDOFF FILE (step 5)
// ---------------------------------------------------------------------------
function renderHandoffFile(summary, followUps, stamp) {
  const lines = [`# Handoff ${stamp.display}`, ''];
  const section = (label, items) => {
    if (items && items.length) {
      lines.push(`### ${label}`, '');
      for (const i of items) lines.push(`- ${i}`);
      lines.push('');
    }
  };
  lines.push('## Session summary', '');
  section('Highlights', summary.highlights);
  section('Decisions', summary.decisions);
  section('Plan adjustments', summary.plan_adjustments);
  section('New nodes', summary.new_nodes);
  section('Concerns', summary.concerns);
  if (summary.iteration_counts.length) {
    lines.push('### Iteration counts', '');
    for (const ic of summary.iteration_counts) lines.push(`- ${ic.id}: ${ic.count}`);
    lines.push('');
  }
  lines.push('## Follow-ups', '');
  section('Awaiting review', followUps.awaiting_review);
  section('Needs testing', followUps.needs_testing);
  section('Deferred edits', followUps.deferred_edits);
  section('Open questions', followUps.open_questions);
  section('Concerns for follow-up', followUps.concerns_followup);
  return lines.join('\n').replace(/\s+$/, '') + '\n';
}

// ---------------------------------------------------------------------------
// COMMIT — Slice A: steps 1–5
// ---------------------------------------------------------------------------
function applyHandoff(rootDir, entries, opts = {}) {
  const norm = normalizeHandoffEntries(entries);
  if (!norm.ok) return { ok: false, status: STATUS, mode: 'commit', reason: norm.reason, text: norm.text };

  const completed = [1]; // step 1 SUMMARISE — captured in entries, persisted at step 5

  // Step 2 — STATE UPDATE (reuse the DEFAULT primitive; no fork). Abort before
  // writing the handoff file if a ref is bad (commit-safe boundary).
  const stateRes = applyStateUpdate(rootDir, norm.state);
  if (!stateRes.ok) return { ok: false, status: STATUS, mode: 'commit', reason: stateRes.reason, text: stateRes.text, steps_completed: completed };
  completed.push(2);
  for (const d of norm.state.decisions) appendDecision(rootDir, { node: d.node, decision: d.decision, rationale: d.rationale });

  // Step 3 — IDENTIFY FOLLOW-UPS (data; persisted at step 5).
  completed.push(3);

  // Step 4 — DOC UPDATE (5.7). Respects the action-path threshold.
  let doc_update = { applied: false, note: 'no doc changes proposed' };
  if (norm.docs && Array.isArray(norm.docs.updates) && norm.docs.updates.length) {
    doc_update = runDocUpdate(rootDir, { entries: norm.docs, confirm: !!norm.docs.confirm });
  }
  completed.push(4);

  // Step 5 — WRITE HANDOFF FILE (committed artifact, not gitignored).
  const stamp = formatStamp(nowIso(opts));
  const dir = ovdPath(rootDir, 'handoffs');
  fs.mkdirSync(dir, { recursive: true });
  const fileName = `${stamp.file}.md`;
  fs.writeFileSync(path.join(dir, fileName), renderHandoffFile(norm.summary, norm.follow_ups, stamp));
  const handoff_file = path.join('.overdrive', 'handoffs', fileName);
  completed.push(5);

  // Step 6 — RECURSIVE CLOSE CHECK (5.5 shared util; never auto-advances).
  const closeFlow = runRecursiveCloseCheck(rootDir, { justClosed: norm.closed_leaf || undefined });
  completed.push(6);

  // Steps 7–10 — MILESTONE CLOSE cascade. Conditional (hard rule 6): runs ONLY
  // when the close check reaches a milestone the user pre-approved (i.e. the
  // handoff payload carried milestone_close entries). runMilestoneClose validates
  // the candidate is a top-level milestone — a cluster candidate is rejected and
  // 7–10 are skipped (the close prompt is surfaced for manual resolution).
  let milestone_close = null;
  if (norm.milestone_close && closeFlow.mode === 'closure-prompt' && closeFlow.current && closeFlow.current.id) {
    const mc = runMilestoneClose(rootDir, { milestoneId: closeFlow.current.id, entries: norm.milestone_close, now: nowIso(opts) });
    milestone_close = mc;
    if (mc.ok) completed.push(7, 8, 9, 10);
  }

  const out = [];
  out.push(`Handoff written: ${handoff_file}. Steps 1–5 complete.`);
  if (norm.state.status_changes.length) out.push(`State: ${norm.state.status_changes.map((s) => `${s.id}→${s.status}`).join(', ')}.`);
  out.push('');
  if (milestone_close && milestone_close.ok) {
    out.push(`Milestone ${milestone_close.milestone_id} closed (${milestone_close.disposition}) and archived — steps 7–10 complete.`);
    out.push('');
    out.push('Next: step 11 — commit (user-gated).');
  } else if (closeFlow.mode === 'closure-prompt') {
    out.push(closeFlow.text);
  } else if (closeFlow.mode === 'project-complete') {
    out.push(closeFlow.text);
  } else {
    out.push('No closures this session.');
    out.push('');
    out.push('Next: step 11 — commit (user-gated).');
  }

  return {
    ok: true,
    status: STATUS,
    mode: 'handoff-commit',
    steps_completed: completed,
    handoff_file,
    state: norm.state,
    doc_update,
    closure: closeFlow.mode,
    milestone_close,
    next_step: completed.includes(7) ? 11 : 6,
    text: out.join('\n')
  };
}

function runHandoff(rootDir, opts = {}) {
  if (!rootDir || typeof rootDir !== 'string') {
    return { ok: false, status: STATUS, reason: 'invalid-project-dir', text: 'runHandoff requires a project directory string.' };
  }
  const mode = opts.mode || (opts.entries ? 'commit' : 'plan');
  if (mode === 'commit') return applyHandoff(rootDir, opts.entries, opts);
  return buildHandoffPlan(rootDir, opts);
}

module.exports = {
  STATUS,
  STEPS,
  buildHandoffPlan,
  normalizeHandoffEntries,
  renderHandoffFile,
  applyHandoff,
  runHandoff
};
