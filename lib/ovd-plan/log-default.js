'use strict';

// Task 5.1 — /ovd-log DEFAULT (lightweight save)  (r3 §7.1, §7.4, §7.5)
//
// Pattern-1 dispatch (CONVO CAPTURE is agent-side — the CLI never composes the
// summary). PLAN emits the dimensions to distill + the --entries-json shape;
// COMMIT persists the agent's distilled capture:
//
//   STATE UPDATE → SESSION FILE → DOC UPDATE (stub) → RECURSIVE CLOSE CHECK → print
//
// Pattern 2 reuse: openState/commitState (writer round-trip), appendDecision,
// closure.recursiveCloseFlow (the SAME shared util /ovd-go uses — no fork), and
// the session-file primitives from log-capture (ensureSessionFile/formatStamp).
//
// Q5.9: a lightweight sentinel lock (.overdrive/_log.lock) guards the state-
// writing critical section; a second concurrent /ovd-log fails fast with an
// explicit recovery action (delete the lock). No TTL/PID auto-recovery (Phase 7).

const fs = require('fs');
const path = require('path');

const { openState, commitState } = require('./deliberation-state');
const { flattenNodes } = require('./noderef');
const { appendDecision } = require('./decisions-log');
const { recursiveCloseFlow } = require('./closure');
const { ovdPath } = require('./fs');
const { formatStamp, ensureSessionFile } = require('./log-capture');

const STATUS = 'log';
const STATUS_VALUES = ['pending', 'in-progress', 'awaiting-review', 'done', 'blocked', 'skipped'];

// r3 §7.4 — the eight CONVO CAPTURE dimensions (key, display label).
const DIMENSIONS = [
  ['modifications', 'Modifications'],
  ['user_responses', 'User responses'],
  ['new_alignment', 'New alignment'],
  ['new_criteria', 'New criteria'],
  ['new_discoveries', 'New discoveries'],
  ['decisions', 'Decisions'],
  ['open_threads', 'Open threads'],
  ['interrupted', 'What was interrupted']
];

const LOCK_REL = path.join('.overdrive', '_log.lock');

function nowIso(opts) {
  return (opts && opts.now) || new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Sentinel lock (Q5.9)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// PLAN
// ---------------------------------------------------------------------------
function readActiveLeafId(rootDir) {
  try {
    const content = fs.readFileSync(path.join(rootDir, 'OVERDRIVE.md'), 'utf8');
    const { parseOverdriveMd } = require('./parser');
    const parsed = parseOverdriveMd(content);
    const active = flattenNodes(parsed.tree).find((n) => n.active);
    return active ? active.id : null;
  } catch (_) {
    return null;
  }
}

function buildLogDefaultPlan(rootDir, opts = {}) {
  const activeId = readActiveLeafId(rootDir);
  const lines = [];
  lines.push('LIGHTWEIGHT SAVE (/ovd-log) — distill the active conversation, then commit.');
  lines.push('');
  lines.push(activeId ? `Active leaf: ${activeId}` : 'Active leaf: (none set)');
  lines.push('');
  lines.push('Summarise the conversation since the last save across these dimensions:');
  for (const [key, label] of DIMENSIONS) {
    lines.push(`  - ${label} (${key})`);
  }
  lines.push('');
  lines.push('Then re-invoke with --entries-json carrying:');
  lines.push('  {');
  lines.push('    "capture": { "<dimension>": ["..."], "interrupted": "..." },');
  lines.push('    "state": {');
  lines.push('      "active_node": "<id or omit>",');
  lines.push('      "status_changes": [{ "id": "<node>", "status": "<' + STATUS_VALUES.join('|') + '>" }],');
  lines.push('      "decisions": [{ "node": "<id>", "decision": "...", "rationale": "..." }]');
  lines.push('    },');
  lines.push('    "closed_leaf": "<leaf just completed, to drive the recursive close check, or omit>"');
  lines.push('  }');
  lines.push('');
  lines.push('Sparse conversations are fine — omit empty dimensions; the save still records the checkpoint.');
  return { ok: true, status: STATUS, mode: 'plan', active_leaf: activeId, text: lines.join('\n') };
}

// ---------------------------------------------------------------------------
// NORMALIZE (Pattern 4 guard)
// ---------------------------------------------------------------------------
function coerceStringArray(val) {
  if (Array.isArray(val)) return val.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim());
  if (typeof val === 'string' && val.trim()) return [val.trim()];
  return [];
}

function normalizeCapture(raw) {
  const cap = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  const out = {};
  for (const [key] of DIMENSIONS) {
    if (key === 'interrupted') {
      out.interrupted = (typeof cap.interrupted === 'string') ? cap.interrupted.trim() : '';
    } else {
      out[key] = coerceStringArray(cap[key]);
    }
  }
  return out;
}

function normalizeState(raw) {
  const st = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  const active_node = (typeof st.active_node === 'string' && st.active_node.trim()) ? st.active_node.trim() : null;

  const status_changes = [];
  const rawChanges = Array.isArray(st.status_changes) ? st.status_changes : [];
  for (const sc of rawChanges) {
    if (!sc || typeof sc !== 'object') return { ok: false, reason: 'invalid-status-change', text: 'each status_change must be an object { id, status }.' };
    if (typeof sc.id !== 'string' || !sc.id.trim()) return { ok: false, reason: 'missing-status-id', text: 'each status_change requires a non-empty id.' };
    if (!STATUS_VALUES.includes(sc.status)) return { ok: false, reason: 'invalid-status', text: `status must be one of ${STATUS_VALUES.join(' / ')}.` };
    status_changes.push({ id: sc.id.trim(), status: sc.status });
  }

  // Decisions are permissive: drop malformed entries rather than failing the save.
  const decisions = [];
  const rawDec = Array.isArray(st.decisions) ? st.decisions : [];
  for (const d of rawDec) {
    if (d && typeof d === 'object' && typeof d.decision === 'string' && d.decision.trim()) {
      decisions.push({
        node: typeof d.node === 'string' ? d.node.trim() : '',
        decision: d.decision.trim(),
        rationale: typeof d.rationale === 'string' ? d.rationale.trim() : ''
      });
    }
  }
  return { ok: true, active_node, status_changes, decisions };
}

function normalizeLogDefaultEntries(entries) {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return { ok: false, reason: 'invalid-entries', text: '/ovd-log commit requires a JSON object.' };
  }
  const state = normalizeState(entries.state);
  if (!state.ok) return state;
  const closed_leaf = (typeof entries.closed_leaf === 'string' && entries.closed_leaf.trim()) ? entries.closed_leaf.trim() : null;
  return {
    ok: true,
    capture: normalizeCapture(entries.capture),
    state: { active_node: state.active_node, status_changes: state.status_changes, decisions: state.decisions },
    closed_leaf
  };
}

// ---------------------------------------------------------------------------
// SESSION FILE — structured save block
// ---------------------------------------------------------------------------
function renderSaveBlock(capture, stamp) {
  const lines = ['', `## Save ${stamp.display}`, ''];
  let any = false;
  for (const [key, label] of DIMENSIONS) {
    if (key === 'interrupted') {
      if (capture.interrupted) {
        lines.push(`### ${label}`, '', capture.interrupted, '');
        any = true;
      }
    } else if (Array.isArray(capture[key]) && capture[key].length) {
      lines.push(`### ${label}`, '');
      for (const item of capture[key]) lines.push(`- ${item}`);
      lines.push('');
      any = true;
    }
  }
  if (!any) lines.push('(no detail captured this save)', '');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// COMMIT
// ---------------------------------------------------------------------------
function applyStateUpdate(rootDir, state) {
  // Single openState/commitState round-trip for all tree mutations (Pattern 2).
  if (!state.active_node && state.status_changes.length === 0) {
    return { ok: true, applied: false };
  }
  const opened = openState(rootDir);
  if (!opened.ok) return { ok: false, reason: opened.reason, text: opened.text };
  const flat = flattenNodes(opened.parsed.tree);
  const byId = (id) => flat.find((n) => n.id === id) || null;

  for (const sc of state.status_changes) {
    const node = byId(sc.id);
    if (!node) return { ok: false, reason: 'node-not-found', text: `No node with id "${sc.id}".` };
    node.status = sc.status;
  }
  if (state.active_node) {
    const target = byId(state.active_node);
    if (!target) return { ok: false, reason: 'active-node-not-found', text: `Cannot set active node: no node with id "${state.active_node}".` };
    for (const n of flat) n.active = false;
    target.active = true;
  }
  const committed = commitState(rootDir, opened);
  if (!committed.ok) return { ok: false, reason: committed.reason, text: committed.text };
  return { ok: true, applied: true };
}

function deriveJustClosed(closed_leaf, status_changes) {
  if (closed_leaf) return closed_leaf;
  // Otherwise the last leaf this save transitioned to `done`.
  const done = status_changes.filter((sc) => sc.status === 'done');
  return done.length ? done[done.length - 1].id : null;
}

function applyLogDefault(rootDir, entries, opts = {}) {
  const norm = normalizeLogDefaultEntries(entries);
  if (!norm.ok) return { ok: false, status: STATUS, mode: 'commit', reason: norm.reason, text: norm.text };

  const lock = acquireLogLock(rootDir);
  if (!lock.ok) return lockedResult();

  try {
    // 1. STATE UPDATE (validated; no partial write — bad ref aborts before commit).
    const stateRes = applyStateUpdate(rootDir, norm.state);
    if (!stateRes.ok) return { ok: false, status: STATUS, mode: 'commit', reason: stateRes.reason, text: stateRes.text };

    // 2. DECISION RECORD (decisions.md — separate file; permissive).
    for (const d of norm.state.decisions) {
      appendDecision(rootDir, { node: d.node, decision: d.decision, rationale: d.rationale });
    }

    // 3. SESSION FILE — append the structured save block to the current session.
    const stamp = formatStamp(nowIso(opts));
    const ensured = ensureSessionFile(rootDir, opts);
    fs.appendFileSync(ensured.file, renderSaveBlock(norm.capture, stamp));

    // 4. DOC UPDATE — stub. Task 5.7 wires runDocUpdate (Q3.6.1 dependency).
    const doc_update = { applied: false, note: 'DOC UPDATE deferred to Task 5.7 (runDocUpdate) — surgical propagation not yet wired.' };

    // 5. RECURSIVE CLOSE CHECK — shared util (no fork). Only if a leaf closed.
    const justClosed = deriveJustClosed(norm.closed_leaf, norm.state.status_changes);
    let closeFlow = { mode: 'no-closure', text: 'No leaf closed this save.' };
    if (justClosed) {
      const flow = recursiveCloseFlow(rootDir, justClosed, opts);
      if (flow && flow.ok) closeFlow = flow;
    }

    // 6. PRINT — confirmation + recommended next.
    const out = [];
    out.push(`Saved. Session: ${ensured.rel}.`);
    if (stateRes.applied) {
      if (norm.state.status_changes.length) out.push(`State: ${norm.state.status_changes.map((s) => `${s.id}→${s.status}`).join(', ')}.`);
      if (norm.state.active_node) out.push(`Active leaf: ${norm.state.active_node}.`);
    }
    out.push('');
    if (closeFlow.mode === 'closure-prompt') {
      out.push(closeFlow.text);
    } else if (closeFlow.mode === 'project-complete') {
      out.push(closeFlow.text);
    } else {
      out.push('Next: /ovd-go to continue, or /ovd-log handoff to end the session.');
    }

    return {
      ok: true,
      status: STATUS,
      mode: 'log-commit',
      session_file: ensured.rel,
      active_node: norm.state.active_node,
      status_changes: norm.state.status_changes,
      doc_update,
      closure: closeFlow.mode,
      text: out.join('\n')
    };
  } finally {
    releaseLogLock(lock);
  }
}

function runLogDefault(rootDir, opts = {}) {
  if (!rootDir || typeof rootDir !== 'string') {
    return { ok: false, status: STATUS, reason: 'invalid-project-dir', text: 'runLogDefault requires a project directory string.' };
  }
  const mode = opts.mode || (opts.entries ? 'commit' : 'plan');
  if (mode === 'commit') return applyLogDefault(rootDir, opts.entries, opts);
  return buildLogDefaultPlan(rootDir, opts);
}

module.exports = {
  STATUS,
  STATUS_VALUES,
  DIMENSIONS,
  acquireLogLock,
  releaseLogLock,
  buildLogDefaultPlan,
  normalizeLogDefaultEntries,
  renderSaveBlock,
  applyLogDefault,
  runLogDefault
};
