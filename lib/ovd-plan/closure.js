'use strict';

const { openState, commitState } = require('./deliberation-state');
const { closureCheck, isNodeClosed } = require('./cache');
const { flattenNodes } = require('./noderef');

// ---------------------------------------------------------------------------
// Task 4.6 — Recursive close (r3 §6.5, §7.5, §8.2). SHARED utility (FM #2 —
// don't fork): the eligibility engine is cache.closureCheck (Task 1.4); this
// module adds the walk-and-prompt FLOW on top. Both /ovd-go (Phase 4) and
// /ovd-log (Phase 5 Task 5.5) import this — single implementation.
//
// Never auto-advances: one closure prompt per level, each requiring explicit
// user approval (r3 §7.5). PLAN presents the innermost eligible ancestor; COMMIT
// {node_id, decision} closes (→ status done, then present the next level), holds
// (stop), or routes to cluster verification first. Walk stops at the first
// ancestor with open siblings, or at root.
// ---------------------------------------------------------------------------

const STATUS = 'go';
const DECISIONS = ['close', 'hold', 'verify'];

function findNode(tree, id) {
  const want = typeof id === 'string' ? id.trim() : '';
  if (!want) return null;
  if (tree && tree.id === want) return tree;
  return flattenNodes(tree).find((n) => n.id === want) || null;
}

// Render the r3 §7.5 closure prompt for one eligible ancestor. `next` is the
// outer ancestor (closures[idx+1]) whose closure option 2 will check next.
function renderClosurePrompt(justClosedId, ancestor, next) {
  const nextNote = next ? ` and check ${next.id} closure` : '';
  return [
    `That closes ${justClosedId} — ${ancestor.id} (${ancestor.title || ''}) now has all children done.`.replace(/\s+\)/, ')'),
    '',
    `Before marking ${ancestor.id} as done:`,
    '',
    `  (1) verify — run /ovd-go verify ${ancestor.id} (cluster verification)`,
    `  (2) close — mark ${ancestor.id} done${nextNote}`,
    `  (3) hold — keep ${ancestor.id} open; continue working in this branch`,
    '  (4) other — describe what you want.'
  ].join('\n');
}

// PLAN — present the innermost eligible-to-close ancestor (if any).
function recursiveCloseFlow(rootDir, justClosedNodeId, opts) {
  const opened = openState(rootDir);
  if (!opened.ok) return { ok: false, status: STATUS, reason: opened.reason, text: opened.text };
  if (typeof justClosedNodeId !== 'string' || justClosedNodeId.trim() === '') {
    return { ok: false, status: STATUS, reason: 'missing-ref', text: 'Recursive close requires the just-closed node id (e.g. /ovd-go close II.2.a).' };
  }
  const result = closureCheck(opened.parsed.tree, justClosedNodeId.trim());
  // Root (id '(root)' / empty) is a terminal stop, not a closable node (r3 §7.5
  // "until root reached") — filter it out of the presentable closures.
  const rootEligible = result.closures.some((c) => !c.id || c.id === '(root)');
  const presentable = result.closures.filter((c) => c.id && c.id !== '(root)');

  if (!presentable.length) {
    // All milestones done → project complete (root reached), or genuinely nothing.
    if (rootEligible) {
      return { ok: true, status: STATUS, mode: 'project-complete', reason: 'reached-root', closures: [], stops_at: null, text: 'All milestones are done — the project tree is complete. Run /ovd-log handoff to wrap up.' };
    }
    let text;
    if (result.reason === 'open-siblings' && result.stops_at) {
      text = `Nothing to close up: ${result.stops_at.id} still has open siblings. Continue working, or /ovd-go to orient.`;
    } else if (result.reason === 'node-not-found') {
      text = `No node with id "${justClosedNodeId}".`;
    } else if (result.reason === 'no-parent') {
      text = `${justClosedNodeId} has no parent (root-level). Nothing to close up.`;
    } else {
      text = 'Nothing eligible to close.';
    }
    return { ok: true, status: STATUS, mode: 'no-closure', reason: result.reason, closures: [], stops_at: result.stops_at || null, text };
  }
  const current = presentable[0];
  const next = presentable[1] || null;
  return {
    ok: true,
    status: STATUS,
    mode: 'closure-prompt',
    just_closed: justClosedNodeId.trim(),
    current,
    next,
    closures: presentable,
    stops_at: result.stops_at || null,
    reason: result.reason,
    text: renderClosurePrompt(justClosedNodeId.trim(), current, next)
  };
}

function normalizeClosureEntries(entries) {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return { ok: false, reason: 'invalid-entries', text: 'close commit requires a JSON object.' };
  }
  if (typeof entries.node_id !== 'string' || entries.node_id.trim() === '') {
    return { ok: false, reason: 'missing-node-id', text: 'close entries require a non-empty node_id (the ancestor being decided).' };
  }
  if (!DECISIONS.includes(entries.decision)) {
    return { ok: false, reason: 'invalid-decision', text: `decision must be one of ${DECISIONS.join(' / ')}.` };
  }
  return { ok: true, node_id: entries.node_id.trim(), decision: entries.decision };
}

// COMMIT — act on a closure decision for one ancestor.
function applyClosureDecision(rootDir, entries, opts) {
  const norm = normalizeClosureEntries(entries);
  if (!norm.ok) return { ok: false, status: STATUS, mode: 'commit', reason: norm.reason, text: norm.text };
  const opened = openState(rootDir);
  if (!opened.ok) return { ok: false, status: STATUS, mode: 'commit', reason: opened.reason, text: opened.text };
  const node = findNode(opened.parsed.tree, norm.node_id);
  if (!node) return { ok: false, status: STATUS, mode: 'commit', reason: 'node-not-found', text: `No node with id "${norm.node_id}".` };
  if (!node.children || node.children.length === 0) {
    return { ok: false, status: STATUS, mode: 'commit', reason: 'not-a-container', text: `${node.id} is a leaf, not a closable container.` };
  }

  if (norm.decision === 'hold') {
    return { ok: true, status: STATUS, mode: 'closure-commit', node_id: node.id, decision: 'hold', closed: false, text: `Holding ${node.id} open. Continue working, or /ovd-go to orient.` };
  }
  if (norm.decision === 'verify') {
    return { ok: true, status: STATUS, mode: 'closure-commit', node_id: node.id, decision: 'verify', closed: false, text: `Run /ovd-go verify ${node.id} (cluster verification) first, then /ovd-go close ${node.id} to close it.` };
  }

  // decision === 'close' — re-confirm eligibility (children all closed) before persisting.
  if (!node.children.every(isNodeClosed)) {
    return { ok: false, status: STATUS, mode: 'commit', reason: 'children-open', text: `Cannot close ${node.id}: not all children are done/skipped yet.` };
  }
  node.status = 'done';
  const committed = commitState(rootDir, opened);
  if (!committed.ok) return { ok: false, status: STATUS, mode: 'commit', reason: committed.reason, text: committed.text };

  // Walk up: present the next eligible ancestor (never auto-advance — this is a
  // fresh prompt the user must approve).
  const nextFlow = recursiveCloseFlow(rootDir, node.id, opts);
  const lines = [`${node.id} marked done.`, ''];
  if (nextFlow.ok && nextFlow.mode === 'closure-prompt') {
    lines.push(nextFlow.text);
  } else {
    lines.push(nextFlow.text || 'Closure walk complete.');
    lines.push('');
    lines.push('Next: /ovd-go to continue, or /ovd-log handoff to end the session.');
  }
  return {
    ok: true,
    status: STATUS,
    mode: 'closure-commit',
    node_id: node.id,
    decision: 'close',
    closed: true,
    next_prompt: nextFlow.mode === 'closure-prompt' ? nextFlow.current : null,
    walk_complete: nextFlow.mode !== 'closure-prompt',
    text: lines.join('\n')
  };
}

function runClose(rootDir, opts = {}) {
  if (!rootDir || typeof rootDir !== 'string') {
    return { ok: false, status: STATUS, reason: 'invalid-project-dir', text: 'runClose requires a project directory string.' };
  }
  const mode = opts.mode || (opts.entries ? 'commit' : 'plan');
  if (mode === 'commit') return applyClosureDecision(rootDir, opts.entries, opts);
  return recursiveCloseFlow(rootDir, opts.leafId || opts.ref || null, opts);
}

module.exports = {
  STATUS,
  DECISIONS,
  findNode,
  renderClosurePrompt,
  recursiveCloseFlow,
  normalizeClosureEntries,
  applyClosureDecision,
  runClose
};
