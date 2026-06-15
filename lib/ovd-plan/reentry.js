'use strict';

const fs = require('fs');
const path = require('path');
const { openState, commitState } = require('./deliberation-state');

// ---------------------------------------------------------------------------
// Task 3.9 — Multi-session deliberation re-entry (r3 §5.7 + Q12 lock).
//
// Always summary → user confirmation → continue. Never silent resume. This
// module owns the re-entry intercept that runs at the top of runDeliberate.
// Two detection paths, evaluated in order:
//
//   (1) detectStaleState — proposed_tree milestone IDs vs committed tree IDs.
//       Drift fires a "reconcile / restart / describe other" envelope. Per the
//       Q3.9.4' lock, detection scope is stage <= plan_skills + proposed_tree
//       present + committed tree present. Conservative on purpose.
//
//   (2) detectReentry — last_action timestamp older than THRESHOLD_MS (default
//       1 hour). Per the Q3.9.1' lock + the orchestrator's null-guard
//       refinement, last_action must be a parseable ISO string for the
//       predicate to fire; a missing/null last_action means "no prior activity
//       to summarize" — re-entry does not trigger.
//
// State machine:
//   - buildReentryTurn / buildStaleTurn persist `pending_reentry: true` to
//     deliberation-state. Subsequent commit-mode runDeliberate calls route
//     through applyReentryTurn (not the existing stage switch) until the
//     pending flag is cleared by an approved/review/reconcile/restart action.
//   - On restart kind without `confirm`, set `awaiting_restart_confirm: true`
//     and emit the confirmation prompt (destructive operation per r3 §5.7).
//     The second commit `{kind:'restart', confirm:true}` actually clears the
//     deliberation state. The explicit cancel branch `{kind:'restart',
//     confirm:false}` clears awaiting_restart_confirm distinctly from any
//     non-confirm commit (per Q3.9.6' refinement).
//
// State-key additions (ride through writer.reorderObject's unknown-key
// tolerance — no writer.js modification needed):
//   - pending_reentry: bool — set when re-entry summary is presented; cleared
//     when user commits an action.
//   - awaiting_restart_confirm: bool — set on first restart commit; cleared
//     on confirm:true OR confirm:false OR any other action.
//
// ---------------------------------------------------------------------------

const STATUS = 'reentry';
const THRESHOLD_MS_DEFAULT = 60 * 60 * 1000; // 1 hour (Q3.9.1' lock)
const REENTRY_KINDS = ['approved', 'review', 'restart', 'reconcile'];
const STALE_DETECTION_STAGES = new Set(['elicit', 'spec', 'blind_spot', 'plan', 'plan_skills']);
const SESSIONS_REL = path.join('.overdrive', 'sessions');
const PLAN_QUALITY_REPORT_PATTERN = /-plan-quality-.*\.md$/;

function nowMs(opts) {
  if (opts && typeof opts.now === 'number') return opts.now;
  if (opts && typeof opts.now === 'string') {
    const parsed = Date.parse(opts.now);
    return Number.isFinite(parsed) ? parsed : Date.now();
  }
  return Date.now();
}

function nowIsoFromOpts(opts) {
  const ms = nowMs(opts);
  return new Date(ms).toISOString();
}

function parseDateMs(iso) {
  if (typeof iso !== 'string' || !iso.trim()) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function envelope(payload) {
  return Object.assign({ status: STATUS }, payload);
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

function detectStaleState(opened) {
  if (!opened || !opened.ok || !opened.innerObj || !opened.parsed) {
    return { drifted: false, reason: 'invalid-open' };
  }
  const inner = opened.innerObj;
  const stage = (typeof inner.stage === 'string') ? inner.stage : 'elicit';
  if (!STALE_DETECTION_STAGES.has(stage)) {
    return { drifted: false, reason: 'out-of-scope-stage', stage };
  }
  const proposed = inner.proposed_tree;
  if (!proposed || !Array.isArray(proposed.milestones) || proposed.milestones.length === 0) {
    return { drifted: false, reason: 'no-proposed-tree' };
  }
  const parsedTree = opened.parsed.tree;
  const committedChildren = (parsedTree && Array.isArray(parsedTree.children)) ? parsedTree.children : [];
  if (committedChildren.length === 0) {
    return { drifted: false, reason: 'no-committed-tree' };
  }
  const proposedIds = proposed.milestones.map((m) => m && m.id).filter((id) => typeof id === 'string');
  const committedIds = committedChildren.map((c) => c && c.id).filter((id) => typeof id === 'string');
  const pSet = new Set(proposedIds);
  const cSet = new Set(committedIds);
  if (pSet.size !== cSet.size) {
    return { drifted: true, reason: 'milestone-count-mismatch', proposedIds, committedIds };
  }
  for (const id of pSet) {
    if (!cSet.has(id)) {
      return { drifted: true, reason: 'milestone-id-mismatch', proposedIds, committedIds };
    }
  }
  return { drifted: false, reason: 'in-sync' };
}

function detectReentry(opened, opts = {}) {
  if (!opened || !opened.ok || !opened.innerObj) {
    return { needsReentry: false, reason: 'invalid-open' };
  }
  const inner = opened.innerObj;
  if (inner.pending_reentry === true) {
    return { needsReentry: true, reason: 'pending' };
  }
  const stage = (typeof inner.stage === 'string') ? inner.stage : 'elicit';
  if (stage === 'committed') {
    return { needsReentry: false, reason: 'committed' };
  }
  // Q3.9.1' refinement: null/missing last_action means "no prior activity to
  // summarize" — re-entry does not fire.
  if (inner.last_action == null) {
    return { needsReentry: false, reason: 'no-prior-activity' };
  }
  const lastMs = parseDateMs(inner.last_action);
  if (lastMs === null) {
    return { needsReentry: false, reason: 'unparseable-last-action' };
  }
  const threshold = (typeof opts.reentryThresholdMs === 'number') ? opts.reentryThresholdMs : THRESHOLD_MS_DEFAULT;
  const elapsed = nowMs(opts) - lastMs;
  if (elapsed <= threshold) {
    return { needsReentry: false, reason: 'recent-activity', elapsedMs: elapsed };
  }
  return { needsReentry: true, reason: 'pause-exceeds-threshold', elapsedMs: elapsed };
}

// ---------------------------------------------------------------------------
// Summary rendering (stage-aware + calibration-aware per Q3.9.2' lock)
// ---------------------------------------------------------------------------

function findLatestPlanQualityReport(rootDir) {
  const dir = path.join(rootDir, SESSIONS_REL);
  if (!fs.existsSync(dir)) return null;
  let latest = null;
  let latestMs = -Infinity;
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch (err) {
    return null;
  }
  for (const f of entries) {
    if (!PLAN_QUALITY_REPORT_PATTERN.test(f)) continue;
    try {
      const stat = fs.statSync(path.join(dir, f));
      if (stat.mtimeMs > latestMs) {
        latest = f;
        latestMs = stat.mtimeMs;
      }
    } catch (err) { /* ignore */ }
  }
  return latest;
}

function renderCalibrationRecap(inner) {
  const c = inner && inner.calibration;
  if (!c || typeof c !== 'object') return 'Calibration: not yet established.';
  const override = c.override || 'none';
  if (override === 'plain') {
    return 'Calibration: plain verbosity override.';
  }
  const axes = `domain=${c.domain || '?'}, technical=${c.technical || '?'}, scope=${c.scope || '?'}, override=${override}`;
  if (override === 'detailed' && c.rationale) {
    return `Calibration: ${axes}\n  Rationale: ${c.rationale}`;
  }
  return `Calibration: ${axes}.`;
}

function renderPosition(inner, rootDir) {
  const stage = (inner && typeof inner.stage === 'string') ? inner.stage : 'elicit';
  const lines = [];
  if (stage === 'elicit') {
    const tc = (typeof inner.turn_count === 'number') ? inner.turn_count : 0;
    const aq = Array.isArray(inner.answered_questions) ? inner.answered_questions : [];
    const last = aq.length > 0 ? aq[aq.length - 1] : null;
    lines.push(`Position: Stage 2 (Elicit) — ${tc} turn(s) so far.`);
    if (last && typeof last.question === 'string') {
      lines.push(`Last question: "${last.question}"`);
    }
  } else if (stage === 'spec' || stage === 'blind_spot' || stage === 'plan' || stage === 'plan_skills') {
    const milestones = (inner.proposed_tree && Array.isArray(inner.proposed_tree.milestones)) ? inner.proposed_tree.milestones : [];
    let leaves = 0;
    for (const m of milestones) leaves += Array.isArray(m.children) ? m.children.length : 0;
    const stageLabel = {
      spec: 'Stage 4 (Spec)',
      blind_spot: 'Stage 3 (Blind-spot expansion)',
      plan: 'Stage 5 (Plan)',
      plan_skills: 'Stage 5.5 (RESOLVE SKILLS)'
    }[stage];
    const rev = inner.current_proposal_revision || (inner.proposed_tree && inner.proposed_tree.last_revision) || 1;
    lines.push(`Position: ${stageLabel} — proposal revision ${rev}, ${milestones.length} milestone(s), ${leaves} leaf/leaves proposed.`);
  } else if (stage === 'verify') {
    const latestReport = findLatestPlanQualityReport(rootDir);
    lines.push('Position: Stage 6 (Verify) — plan-quality audit in progress.');
    if (latestReport) {
      lines.push(`Last plan-quality report on disk: ${path.join('.overdrive', 'sessions', latestReport)}`);
    } else {
      lines.push('No plan-quality report on disk yet — audit has not been committed in this session.');
    }
  } else if (stage === 'present' || stage === 'commit') {
    const milestones = (inner.proposed_tree && Array.isArray(inner.proposed_tree.milestones)) ? inner.proposed_tree.milestones : [];
    let leaves = 0;
    for (const m of milestones) leaves += Array.isArray(m.children) ? m.children.length : 0;
    const stageLabel = stage === 'present' ? 'Stage 7 (Present + iterate)' : 'Stage 8 (Commit — final review)';
    const rev = inner.current_proposal_revision || (inner.proposed_tree && inner.proposed_tree.last_revision) || 1;
    lines.push(`Position: ${stageLabel} — proposed_tree revision ${rev}, ${milestones.length} milestone(s), ${leaves} leaf/leaves.`);
  } else {
    lines.push(`Position: stage "${stage}" — no specific recap.`);
  }
  return lines.join('\n');
}

function renderOpenThreads(inner) {
  const t = Array.isArray(inner && inner.open_threads) ? inner.open_threads : [];
  if (t.length === 0) return 'Open threads: none.';
  const lines = ['Open threads:'];
  for (const x of t) {
    lines.push(`  - ${typeof x === 'string' ? x : JSON.stringify(x)}`);
  }
  return lines.join('\n');
}

function renderSummary(opened, rootDir) {
  const inner = (opened && opened.innerObj) || {};
  const lines = [];
  lines.push('Resuming deliberation — multi-session re-entry (r3 §5.7).');
  lines.push('');
  lines.push(renderCalibrationRecap(inner));
  lines.push('');
  lines.push(renderPosition(inner, rootDir));
  lines.push('');
  lines.push(renderOpenThreads(inner));
  if (typeof inner.last_action === 'string' && inner.last_action) {
    lines.push('');
    lines.push(`Last activity: ${inner.last_action}.`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Plan-mode dispatchers (Pattern 1 — agent picks an action; CLI persists)
// ---------------------------------------------------------------------------

function renderRestartConfirmPrompt(inner) {
  const counts = {
    turn_count: (typeof inner.turn_count === 'number') ? inner.turn_count : 0,
    answered: Array.isArray(inner.answered_questions) ? inner.answered_questions.length : 0,
    milestones: (inner.proposed_tree && Array.isArray(inner.proposed_tree.milestones)) ? inner.proposed_tree.milestones.length : 0
  };
  const lines = [];
  lines.push('Restart confirmation required (destructive).');
  lines.push('');
  lines.push('This will discard:');
  lines.push(`  - ${counts.turn_count} elicitation turn(s)`);
  lines.push(`  - ${counts.answered} answered question(s)`);
  lines.push(`  - ${counts.milestones} proposed milestone(s)`);
  lines.push('  Calibration WILL be preserved (recalibration is its own axis).');
  lines.push('');
  lines.push('Action paths:');
  lines.push('  (1) confirm — proceed with the restart.');
  lines.push('  (2) cancel — withdraw the restart request, keep current state.');
  lines.push('  (3) describe other.');
  lines.push('');
  lines.push('Commit syntax — confirm:');
  lines.push('  overdrive plan deliberate --entries-json \'{"kind":"restart","confirm":true}\'');
  lines.push('Commit syntax — cancel:');
  lines.push('  overdrive plan deliberate --entries-json \'{"kind":"restart","confirm":false}\'');
  return { text: lines.join('\n'), counts };
}

function buildReentryTurn(rootDir, opts = {}) {
  const opened = openState(rootDir);
  if (!opened.ok) {
    return envelope({ ok: false, reason: opened.reason, text: opened.text });
  }
  const inner = opened.innerObj;
  inner.pending_reentry = true;
  // Do NOT update last_action — Q3.9.1' lock: trigger predicate stays true
  // across repeated plan-mode invocations until user commits an action.
  const deliberate = require('./deliberate');
  opened.innerObj = deliberate.reorderInner(inner);
  const committed = commitState(rootDir, opened);
  if (!committed.ok) {
    return envelope({ ok: false, reason: committed.reason, text: committed.text });
  }

  // Mid-restart-confirm re-entry: if the user paused after the first restart
  // commit (awaiting_restart_confirm=true), a bare /ovd-plan deliberate should
  // re-emit the restart prompt, NOT the high-level summary. Idempotent.
  if (inner.awaiting_restart_confirm === true) {
    const prompt = renderRestartConfirmPrompt(inner);
    return envelope({
      ok: true,
      mode: 'plan',
      kind: 'restart-confirm-resume',
      pending_reentry: true,
      awaiting_confirm: true,
      counts: prompt.counts,
      expectedPayload: {
        kind: '"restart"',
        confirm: 'boolean (true → execute, false → cancel)'
      },
      text: prompt.text
    });
  }

  const lines = [];
  lines.push(renderSummary(opened, rootDir));
  lines.push('');
  lines.push('Action paths (r3 §5.7):');
  lines.push('  (1) approved — resume where we left off.');
  lines.push('  (2) review — walk through what\'s already decided before continuing.');
  lines.push('  (3) restart — reset deliberation (destructive; preserves calibration; double-confirm required).');
  lines.push('  (4) describe other (or describe what you want).');
  lines.push('');
  lines.push('Commit syntax — approved:');
  lines.push('  overdrive plan deliberate --entries-json \'{"kind":"approved"}\'');
  lines.push('Commit syntax — review:');
  lines.push('  overdrive plan deliberate --entries-json \'{"kind":"review"}\'');
  lines.push('Commit syntax — restart (first confirmation prompt):');
  lines.push('  overdrive plan deliberate --entries-json \'{"kind":"restart"}\'');
  lines.push('Commit syntax — restart confirm (destructive):');
  lines.push('  overdrive plan deliberate --entries-json \'{"kind":"restart","confirm":true}\'');

  return envelope({
    ok: true,
    mode: 'plan',
    kind: 'reentry-summary',
    summary_stage: (typeof inner.stage === 'string') ? inner.stage : 'elicit',
    pending_reentry: true,
    expectedPayload: {
      kind: '"approved" | "review" | "restart"',
      confirm: 'optional boolean (for restart: true → execute, false → cancel)'
    },
    text: lines.join('\n')
  });
}

function buildStaleTurn(rootDir, drift, opts = {}) {
  const opened = openState(rootDir);
  if (!opened.ok) {
    return envelope({ ok: false, reason: opened.reason, text: opened.text });
  }
  const inner = opened.innerObj;
  inner.pending_reentry = true;
  const deliberate = require('./deliberate');
  opened.innerObj = deliberate.reorderInner(inner);
  const committed = commitState(rootDir, opened);
  if (!committed.ok) {
    return envelope({ ok: false, reason: committed.reason, text: committed.text });
  }

  const lines = [];
  lines.push('Tree drift detected — proposed_tree in deliberation-state does not match committed tree.');
  lines.push('');
  lines.push(`Drift reason: ${drift.reason}.`);
  lines.push(`Proposed milestone IDs:  [${(drift.proposedIds || []).join(', ')}]`);
  lines.push(`Committed milestone IDs: [${(drift.committedIds || []).join(', ')}]`);
  lines.push('');
  lines.push('Action paths:');
  lines.push('  (1) reconcile — discard proposed_tree; re-deliberate from committed tree (preserves calibration + answered_questions).');
  lines.push('  (2) restart — clear deliberation state entirely (destructive; preserves calibration; double-confirm required).');
  lines.push('  (3) describe other.');
  lines.push('');
  lines.push('Commit syntax — reconcile:');
  lines.push('  overdrive plan deliberate --entries-json \'{"kind":"reconcile"}\'');
  lines.push('Commit syntax — restart (first confirmation):');
  lines.push('  overdrive plan deliberate --entries-json \'{"kind":"restart"}\'');

  return envelope({
    ok: true,
    mode: 'plan',
    kind: 'stale-state',
    drift_reason: drift.reason,
    proposed_milestone_ids: drift.proposedIds || [],
    committed_milestone_ids: drift.committedIds || [],
    pending_reentry: true,
    expectedPayload: {
      kind: '"reconcile" | "restart"',
      confirm: 'optional boolean (for restart)'
    },
    text: lines.join('\n')
  });
}

// ---------------------------------------------------------------------------
// Commit-mode dispatcher (4 kinds: approved / review / restart / reconcile)
// ---------------------------------------------------------------------------

function applyReentryTurn(rootDir, entries, opts = {}) {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return envelope({
      ok: false,
      reason: 'invalid-shape',
      text: 'Re-entry commit requires a JSON object with { kind, ... }.'
    });
  }
  const kind = entries.kind;
  if (!REENTRY_KINDS.includes(kind)) {
    return envelope({
      ok: false,
      reason: 'invalid-kind',
      text: `Re-entry commit kind must be one of: ${REENTRY_KINDS.join(' | ')}.`
    });
  }
  const opened = openState(rootDir);
  if (!opened.ok) {
    return envelope({ ok: false, reason: opened.reason, text: opened.text });
  }
  const inner = opened.innerObj;
  if (inner.pending_reentry !== true) {
    return envelope({
      ok: false,
      reason: 'no-pending-reentry',
      text: 'No pending re-entry. Run /ovd-plan deliberate first to trigger the re-entry summary, then commit.'
    });
  }
  const deliberate = require('./deliberate');
  const nowIso = nowIsoFromOpts(opts);

  if (kind === 'approved') {
    delete inner.pending_reentry;
    delete inner.awaiting_restart_confirm;
    inner.last_action = nowIso;
    opened.innerObj = deliberate.reorderInner(inner);
    const c = commitState(rootDir, opened);
    if (!c.ok) return envelope({ ok: false, reason: c.reason, text: c.text });
    return envelope({
      ok: true,
      mode: 'commit',
      kind,
      resumed_stage: (typeof inner.stage === 'string') ? inner.stage : 'elicit',
      text: `Approved. Resuming deliberation at stage "${inner.stage || 'elicit'}". Run /ovd-plan deliberate again to render the next stage prompt.`
    });
  }

  if (kind === 'review') {
    delete inner.pending_reentry;
    delete inner.awaiting_restart_confirm;
    inner.last_action = nowIso;
    opened.innerObj = deliberate.reorderInner(inner);
    const c = commitState(rootDir, opened);
    if (!c.ok) return envelope({ ok: false, reason: c.reason, text: c.text });
    const aq = Array.isArray(inner.answered_questions) ? inner.answered_questions : [];
    const lines = [];
    lines.push(`Review — walking through ${aq.length} answered question(s):`);
    lines.push('');
    if (aq.length === 0) {
      lines.push('  (no answered questions recorded yet)');
    } else {
      aq.forEach((q, i) => {
        const qStage = (q && q.stage) ? q.stage : '?';
        const question = (q && q.question) ? q.question : '(no question recorded)';
        const answer = (q && q.answer) ? q.answer : '(no answer recorded)';
        lines.push(`Q${i + 1} [${qStage}]: ${question}`);
        lines.push(`  → A: ${answer}`);
        if (q && q.classification != null) {
          const cls = typeof q.classification === 'object' ? JSON.stringify(q.classification) : String(q.classification);
          lines.push(`  classification: ${cls}`);
        }
      });
    }
    lines.push('');
    lines.push(`Resuming at stage "${inner.stage || 'elicit'}" — run /ovd-plan deliberate to render the next prompt.`);
    return envelope({
      ok: true,
      mode: 'commit',
      kind,
      resumed_stage: (typeof inner.stage === 'string') ? inner.stage : 'elicit',
      answered_count: aq.length,
      text: lines.join('\n')
    });
  }

  if (kind === 'reconcile') {
    // Discard proposed_tree; reset stage to elicit; preserve calibration +
    // answered_questions (the user's prior elicitation work stays).
    delete inner.pending_reentry;
    delete inner.awaiting_restart_confirm;
    delete inner.proposed_tree;
    delete inner.blind_spot_inserted;
    delete inner.current_proposal_revision;
    inner.stage = 'elicit';
    inner.last_action = nowIso;
    opened.innerObj = deliberate.reorderInner(inner);
    const c = commitState(rootDir, opened);
    if (!c.ok) return envelope({ ok: false, reason: c.reason, text: c.text });
    return envelope({
      ok: true,
      mode: 'commit',
      kind,
      resumed_stage: 'elicit',
      text: 'Reconcile applied. Proposed tree discarded; deliberation reset to Stage 2 (Elicit). Calibration + prior answered_questions preserved.'
    });
  }

  // kind === 'restart' — double-confirm flow per Q3.9.6'.
  if (entries.confirm === true) {
    if (inner.awaiting_restart_confirm !== true) {
      return envelope({
        ok: false,
        reason: 'no-pending-restart',
        text: 'No pending restart confirmation. Send {"kind":"restart"} first to receive the confirmation prompt, then re-send with "confirm":true.'
      });
    }
    const counts = {
      turn_count: (typeof inner.turn_count === 'number') ? inner.turn_count : 0,
      answered: Array.isArray(inner.answered_questions) ? inner.answered_questions.length : 0,
      milestones: (inner.proposed_tree && Array.isArray(inner.proposed_tree.milestones)) ? inner.proposed_tree.milestones.length : 0
    };
    const calibration = inner.calibration;
    for (const key of Object.keys(inner)) {
      if (key !== 'calibration') delete inner[key];
    }
    if (calibration) inner.calibration = calibration;
    inner.stage = 'elicit';
    inner.turn_count = 0;
    inner.answered_questions = [];
    inner.open_threads = [];
    inner.last_action = nowIso;
    opened.innerObj = deliberate.reorderInner(inner);
    const c = commitState(rootDir, opened);
    if (!c.ok) return envelope({ ok: false, reason: c.reason, text: c.text });
    return envelope({
      ok: true,
      mode: 'commit',
      kind: 'restart',
      confirmed: true,
      cleared_counts: counts,
      text: `Restart confirmed. Deliberation cleared (${counts.turn_count} turn(s), ${counts.answered} answered question(s), ${counts.milestones} milestone(s) discarded). Calibration preserved. Stage reset to Stage 2 (Elicit).`
    });
  }

  if (entries.confirm === false) {
    // Q3.9.6' refinement: explicit cancel branch.
    delete inner.awaiting_restart_confirm;
    delete inner.pending_reentry;
    inner.last_action = nowIso;
    opened.innerObj = deliberate.reorderInner(inner);
    const c = commitState(rootDir, opened);
    if (!c.ok) return envelope({ ok: false, reason: c.reason, text: c.text });
    return envelope({
      ok: true,
      mode: 'commit',
      kind: 'restart',
      confirmed: false,
      cancelled: true,
      text: 'Restart cancelled. Deliberation state preserved. Run /ovd-plan deliberate to continue from where you left off.'
    });
  }

  // First-confirmation: set awaiting_restart_confirm, keep pending_reentry,
  // emit confirmation prompt.
  inner.awaiting_restart_confirm = true;
  inner.last_action = nowIso;
  opened.innerObj = deliberate.reorderInner(inner);
  const c = commitState(rootDir, opened);
  if (!c.ok) return envelope({ ok: false, reason: c.reason, text: c.text });
  const prompt = renderRestartConfirmPrompt(inner);
  return envelope({
    ok: true,
    mode: 'commit',
    kind: 'restart',
    confirmed: null,
    awaiting_confirm: true,
    counts: prompt.counts,
    text: prompt.text
  });
}

function runReentry(rootDir, opts = {}) {
  const isCommit = opts.mode === 'commit' || !!opts.entries;
  if (isCommit) return applyReentryTurn(rootDir, opts.entries, opts);
  return buildReentryTurn(rootDir, opts);
}

function formatPlan(result) { return (result && result.text) || '(no plan text)'; }
function formatCommit(result) { return (result && result.text) || '(no commit text)'; }

module.exports = {
  STATUS,
  THRESHOLD_MS_DEFAULT,
  REENTRY_KINDS,
  STALE_DETECTION_STAGES,
  SESSIONS_REL,
  PLAN_QUALITY_REPORT_PATTERN,
  parseDateMs,
  nowMs,
  nowIsoFromOpts,
  detectStaleState,
  detectReentry,
  findLatestPlanQualityReport,
  renderCalibrationRecap,
  renderPosition,
  renderOpenThreads,
  renderSummary,
  renderRestartConfirmPrompt,
  buildReentryTurn,
  buildStaleTurn,
  applyReentryTurn,
  runReentry,
  formatPlan,
  formatCommit
};
