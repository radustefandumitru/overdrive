'use strict';

const fs = require('fs');

const { openState, commitState } = require('./deliberation-state');
const { appendDecision } = require('./decisions-log');
const { cachePath } = require('./cache');

const STATUS = 'edit';
const KINDS = ['patch', 'add_milestone', 'add_leaf', 'remove', 'reorder'];
const STRUCTURAL_KINDS = new Set(['add_milestone', 'add_leaf', 'remove', 'reorder']);

// Fields agents may write via `patch`. id is excluded by design — use
// remove + add for re-keying.
const PATCH_ALLOWED_FIELDS = [
  'title', 'description', 'scope', 'success', 'deps', 'verify', 'skills', 'ambiguity_score'
];

function envelope(payload) {
  return Object.assign({ status: STATUS }, payload);
}

function nowIso(opts) {
  return (opts && opts.now) || new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Tree source resolution (per Q3.6.6 — proposed_tree first, committed fallback;
// same precedence as plan-quality.js:125 / Q3.8.4).
//
// treeCtx.milestones is a *reference* to the live array in either
// `inner.proposed_tree.milestones` or `parsed.tree.children` — mutating it
// propagates through commitState's writeback. For committed source the root
// children are all depth-2 milestones (parser invariant), so the reference
// works without filtering.
// ---------------------------------------------------------------------------

function resolveTreeSource(opened) {
  const inner = opened.innerObj || {};
  const proposed = inner.proposed_tree;
  if (proposed && Array.isArray(proposed.milestones) && proposed.milestones.length > 0) {
    return { source: 'proposed', milestones: proposed.milestones, root: null };
  }
  const parsedTree = opened.parsed && opened.parsed.tree;
  if (parsedTree && Array.isArray(parsedTree.children) && parsedTree.children.length > 0) {
    return { source: 'committed', milestones: parsedTree.children, root: parsedTree };
  }
  return { source: null, milestones: [], root: null };
}

function findNodeInMilestones(milestones, targetId) {
  for (const m of milestones) {
    if (m && m.id === targetId) return { kind: 'milestone', node: m, milestone: m };
    const children = (m && m.children) || [];
    for (const leaf of children) {
      if (leaf && leaf.id === targetId) return { kind: 'leaf', node: leaf, milestone: m };
    }
  }
  return null;
}

function collectAllIds(milestones) {
  const ids = new Set();
  for (const m of milestones) {
    if (m && m.id) ids.add(m.id);
    for (const leaf of ((m && m.children) || [])) {
      if (leaf && leaf.id) ids.add(leaf.id);
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Per-operation validation. The atomic batch validates against the pre-mutation
// tree only — chained ops (e.g. add_milestone + add_leaf-under-it) in one
// batch are NOT supported by design. Split into two edit calls instead.
// ---------------------------------------------------------------------------

function validateOperation(op, idx, treeCtx) {
  if (!op || typeof op !== 'object' || Array.isArray(op)) {
    return `operations[${idx}] must be an object with { kind, ... }.`;
  }
  if (!KINDS.includes(op.kind)) {
    return `operations[${idx}].kind must be one of: ${KINDS.join(', ')} (got "${op.kind}").`;
  }

  switch (op.kind) {
    case 'patch': {
      if (typeof op.target_id !== 'string' || !op.target_id.trim()) {
        return `operations[${idx}] (patch) requires target_id (string).`;
      }
      if (!treeCtx.idSet.has(op.target_id)) {
        return `operations[${idx}] (patch) target_id "${op.target_id}" not found in tree.`;
      }
      if (!op.body || typeof op.body !== 'object' || Array.isArray(op.body)) {
        return `operations[${idx}] (patch) requires body (object).`;
      }
      if ('id' in op.body) {
        return `operations[${idx}] (patch) cannot rewrite id (use remove + add).`;
      }
      const unknownFields = Object.keys(op.body).filter((k) => !PATCH_ALLOWED_FIELDS.includes(k));
      if (unknownFields.length > 0) {
        return `operations[${idx}] (patch) body contains unsupported field(s): ${unknownFields.join(', ')}. Allowed: ${PATCH_ALLOWED_FIELDS.join(', ')}.`;
      }
      return null;
    }
    case 'add_milestone': {
      if (!op.body || typeof op.body !== 'object' || Array.isArray(op.body)) {
        return `operations[${idx}] (add_milestone) requires body (object).`;
      }
      if (typeof op.body.id !== 'string' || !op.body.id.trim()) {
        return `operations[${idx}] (add_milestone) requires body.id (string).`;
      }
      if (treeCtx.idSet.has(op.body.id)) {
        return `operations[${idx}] (add_milestone) body.id "${op.body.id}" already exists in tree.`;
      }
      if (typeof op.body.title !== 'string' || !op.body.title.trim()) {
        return `operations[${idx}] (add_milestone) requires body.title (string).`;
      }
      return null;
    }
    case 'add_leaf': {
      if (!op.body || typeof op.body !== 'object' || Array.isArray(op.body)) {
        return `operations[${idx}] (add_leaf) requires body (object).`;
      }
      if (typeof op.body.id !== 'string' || !op.body.id.trim()) {
        return `operations[${idx}] (add_leaf) requires body.id (string).`;
      }
      if (treeCtx.idSet.has(op.body.id)) {
        return `operations[${idx}] (add_leaf) body.id "${op.body.id}" already exists in tree.`;
      }
      if (typeof op.body.parent_milestone_id !== 'string' || !op.body.parent_milestone_id.trim()) {
        return `operations[${idx}] (add_leaf) requires body.parent_milestone_id (string).`;
      }
      const parent = findNodeInMilestones(treeCtx.milestones, op.body.parent_milestone_id);
      if (!parent || parent.kind !== 'milestone') {
        return `operations[${idx}] (add_leaf) parent_milestone_id "${op.body.parent_milestone_id}" not found (or not a milestone).`;
      }
      if (typeof op.body.title !== 'string' || !op.body.title.trim()) {
        return `operations[${idx}] (add_leaf) requires body.title (string).`;
      }
      return null;
    }
    case 'remove': {
      if (typeof op.target_id !== 'string' || !op.target_id.trim()) {
        return `operations[${idx}] (remove) requires target_id (string).`;
      }
      if (!treeCtx.idSet.has(op.target_id)) {
        return `operations[${idx}] (remove) target_id "${op.target_id}" not found in tree.`;
      }
      return null;
    }
    case 'reorder': {
      if (!op.body || typeof op.body !== 'object' || Array.isArray(op.body)) {
        return `operations[${idx}] (reorder) requires body (object).`;
      }
      if (!Array.isArray(op.body.ordered_ids) || op.body.ordered_ids.length === 0) {
        return `operations[${idx}] (reorder) requires body.ordered_ids (non-empty array of strings).`;
      }
      let currentChildrenIds;
      if (op.body.parent_id != null) {
        if (typeof op.body.parent_id !== 'string') {
          return `operations[${idx}] (reorder) body.parent_id must be a string when provided.`;
        }
        const parent = findNodeInMilestones(treeCtx.milestones, op.body.parent_id);
        if (!parent || parent.kind !== 'milestone') {
          return `operations[${idx}] (reorder) parent_id "${op.body.parent_id}" not found (or not a milestone).`;
        }
        currentChildrenIds = (parent.node.children || [])
          .map((c) => c && c.id)
          .filter((id) => typeof id === 'string');
      } else {
        currentChildrenIds = treeCtx.milestones
          .map((m) => m && m.id)
          .filter((id) => typeof id === 'string');
      }
      if (op.body.ordered_ids.length !== currentChildrenIds.length) {
        return `operations[${idx}] (reorder) body.ordered_ids must contain exactly the current children IDs (got ${op.body.ordered_ids.length}, expected ${currentChildrenIds.length}: ${currentChildrenIds.join(', ')}).`;
      }
      const currentSet = new Set(currentChildrenIds);
      for (const id of op.body.ordered_ids) {
        if (!currentSet.has(id)) {
          return `operations[${idx}] (reorder) body.ordered_ids contains unknown id "${id}". Current: ${currentChildrenIds.join(', ')}.`;
        }
      }
      if ((new Set(op.body.ordered_ids)).size !== op.body.ordered_ids.length) {
        return `operations[${idx}] (reorder) body.ordered_ids must not contain duplicates.`;
      }
      return null;
    }
    default:
      return `operations[${idx}] kind "${op.kind}" not implemented.`;
  }
}

function normalizeEditEntries(rawEntries, treeCtx) {
  if (!rawEntries || typeof rawEntries !== 'object' || Array.isArray(rawEntries)) {
    return { ok: false, reason: 'invalid-shape', errors: ['entries must be a JSON object with { operations }'] };
  }
  if (!Array.isArray(rawEntries.operations) || rawEntries.operations.length === 0) {
    return { ok: false, reason: 'no-operations', errors: ['entries.operations must be a non-empty array'] };
  }

  const errors = [];
  for (let i = 0; i < rawEntries.operations.length; i++) {
    const err = validateOperation(rawEntries.operations[i], i, treeCtx);
    if (err) errors.push(err);
  }
  if (errors.length > 0) {
    return { ok: false, reason: 'invalid-operation', errors };
  }

  const out = {
    operations: rawEntries.operations,
    confirm: rawEntries.confirm === true
  };
  if (typeof rawEntries.rationale === 'string' && rawEntries.rationale.trim()) {
    out.rationale = rawEntries.rationale.trim();
  }
  return { ok: true, entries: out };
}

// ---------------------------------------------------------------------------
// Narrative diff render (Q3.6.3 lock — NOT unified diff; narrative + bullets).
// One-line per operation; fixed-shape per kind.
// ---------------------------------------------------------------------------

function describePatchChange(op, found) {
  const fields = Object.keys(op.body || {});
  if (fields.length === 0) return '(no-op)';
  if (fields.length === 1 && fields[0] === 'title') {
    const oldTitle = found ? found.node.title : '(unknown)';
    return `rename: "${oldTitle}" → "${op.body.title}"`;
  }
  return `update fields: ${fields.join(', ')}`;
}

function renderOperationLine(op, treeCtx) {
  switch (op.kind) {
    case 'patch': {
      const found = findNodeInMilestones(treeCtx.milestones, op.target_id);
      const kindLabel = found && found.kind === 'milestone' ? 'milestone' : 'leaf';
      const title = found ? found.node.title : '(unknown)';
      return `Patch ${kindLabel} ${op.target_id} "${title}" — ${describePatchChange(op, found)}`;
    }
    case 'add_milestone':
      return `Add milestone ${op.body.id} "${op.body.title}"`;
    case 'add_leaf':
      return `Add leaf ${op.body.id} "${op.body.title}" (under milestone ${op.body.parent_milestone_id})`;
    case 'remove': {
      const found = findNodeInMilestones(treeCtx.milestones, op.target_id);
      const kindLabel = found && found.kind === 'milestone' ? 'milestone' : 'leaf';
      const title = found ? found.node.title : '(unknown)';
      return `Remove ${kindLabel} ${op.target_id} "${title}"`;
    }
    case 'reorder': {
      const parentLabel = op.body.parent_id || '(top-level)';
      return `Reorder children of ${parentLabel} → [${op.body.ordered_ids.join(', ')}]`;
    }
    default:
      return `(unsupported op: ${op.kind})`;
  }
}

function renderNarrativeDiff(operations, treeCtx) {
  const structural = operations.filter((op) => STRUCTURAL_KINDS.has(op.kind)).length;
  const nonStructural = operations.length - structural;

  const lines = [];
  lines.push(`EDIT preview (${operations.length} operation${operations.length === 1 ? '' : 's'} on the ${treeCtx.source} tree):`);
  lines.push('');
  for (const op of operations) {
    lines.push(`  • ${renderOperationLine(op, treeCtx)}`);
  }
  lines.push('');
  if (structural > 0) {
    lines.push(`Structural: ${structural} (will be logged to .overdrive/decisions.md).`);
  }
  if (nonStructural > 0) {
    lines.push(`Non-structural: ${nonStructural} (not logged).`);
  }
  if (structural > 0) {
    lines.push('Cache will be invalidated on apply (.overdrive/cache.json deleted).');
  }
  lines.push('');
  lines.push('Action paths:');
  lines.push('  (1) apply — execute the operations and write OVERDRIVE.md.');
  lines.push('  (2) adjust — describe what to change, then re-emit edit operations.');
  lines.push('  (3) cancel — abort; no changes made.');
  lines.push('');
  lines.push('Commit syntax — apply:');
  lines.push('  overdrive plan edit --entries-json \'{"operations":[...],"confirm":true,"rationale":"..."}\'');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Apply (atomic). Order matters: validation already ran on the pre-state, so
// each op operates on the live mutated structure.
// ---------------------------------------------------------------------------

function applyPatchOp(op, treeCtx) {
  const found = findNodeInMilestones(treeCtx.milestones, op.target_id);
  // For committed-source leaves, contract fields land in annotations (parser
  // convention); title + description stay on the top-level node.
  const writeToAnnotations = treeCtx.source === 'committed' && found.kind === 'leaf';
  if (writeToAnnotations) {
    if (!found.node.annotations || typeof found.node.annotations !== 'object') {
      found.node.annotations = {};
    }
    for (const [field, value] of Object.entries(op.body)) {
      if (field === 'title' || field === 'description') {
        found.node[field] = value;
      } else {
        found.node.annotations[field] = value;
      }
    }
  } else {
    Object.assign(found.node, op.body);
  }
}

function applyAddMilestoneOp(op, treeCtx) {
  const newMilestone = {
    id: op.body.id,
    title: op.body.title,
    description: op.body.description || '',
    children: []
  };
  if (typeof op.body.ambiguity_score === 'number') {
    newMilestone.ambiguity_score = op.body.ambiguity_score;
  }
  if (treeCtx.source === 'committed') {
    newMilestone.depth = 2;
    newMilestone.status = 'pending';
    newMilestone.annotations = null;
  }
  treeCtx.milestones.push(newMilestone);
}

function applyAddLeafOp(op, treeCtx) {
  const parent = findNodeInMilestones(treeCtx.milestones, op.body.parent_milestone_id);
  const newLeaf = {
    id: op.body.id,
    title: op.body.title,
    description: op.body.description || ''
  };
  if (treeCtx.source === 'committed') {
    newLeaf.depth = 3;
    newLeaf.status = 'pending';
    newLeaf.children = [];
    const annotationFields = {};
    for (const f of ['scope', 'success', 'deps', 'verify', 'skills']) {
      if (op.body[f] !== undefined) annotationFields[f] = op.body[f];
    }
    newLeaf.annotations = Object.keys(annotationFields).length > 0 ? annotationFields : null;
  } else {
    for (const f of ['scope', 'success', 'deps', 'verify', 'skills']) {
      if (op.body[f] !== undefined) newLeaf[f] = op.body[f];
    }
  }
  if (!parent.node.children) parent.node.children = [];
  parent.node.children.push(newLeaf);
}

function applyRemoveOp(op, treeCtx) {
  const found = findNodeInMilestones(treeCtx.milestones, op.target_id);
  if (!found) return;
  if (found.kind === 'milestone') {
    const idx = treeCtx.milestones.findIndex((m) => m && m.id === op.target_id);
    if (idx >= 0) treeCtx.milestones.splice(idx, 1);
  } else {
    found.milestone.children = (found.milestone.children || []).filter((c) => c && c.id !== op.target_id);
  }
}

function applyReorderOp(op, treeCtx) {
  if (op.body.parent_id != null) {
    const parent = findNodeInMilestones(treeCtx.milestones, op.body.parent_id);
    const order = op.body.ordered_ids;
    const byId = new Map((parent.node.children || []).map((c) => [c.id, c]));
    parent.node.children = order.map((id) => byId.get(id));
  } else {
    const order = op.body.ordered_ids;
    const byId = new Map(treeCtx.milestones.map((m) => [m.id, m]));
    const reordered = order.map((id) => byId.get(id));
    // Mutate in place to preserve the array reference shared with inner.proposed_tree.milestones
    // or parsed.tree.children.
    treeCtx.milestones.length = 0;
    for (const m of reordered) treeCtx.milestones.push(m);
  }
}

const OP_APPLIERS = {
  patch: applyPatchOp,
  add_milestone: applyAddMilestoneOp,
  add_leaf: applyAddLeafOp,
  remove: applyRemoveOp,
  reorder: applyReorderOp
};

function applyAllOps(operations, treeCtx) {
  for (const op of operations) {
    OP_APPLIERS[op.kind](op, treeCtx);
  }
}

// ---------------------------------------------------------------------------
// Decisions log (Q3.6.5 — structural-only)
// ---------------------------------------------------------------------------

function describeStructuralOpForDecisions(op) {
  switch (op.kind) {
    case 'add_milestone':
      return { node: op.body.id, decision: `Added milestone "${op.body.title}".` };
    case 'add_leaf':
      return { node: op.body.id, decision: `Added leaf "${op.body.title}" under milestone ${op.body.parent_milestone_id}.` };
    case 'remove':
      return { node: op.target_id, decision: `Removed node ${op.target_id}.` };
    case 'reorder':
      return { node: op.body.parent_id || '(top-level)', decision: `Reordered children → [${op.body.ordered_ids.join(', ')}].` };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Cache invalidation (Q3.6.7 — delete-and-lazy-regenerate)
// ---------------------------------------------------------------------------

function invalidateCache(rootDir) {
  try {
    const cp = cachePath(rootDir);
    if (fs.existsSync(cp)) {
      fs.unlinkSync(cp);
      return { ok: true, deleted: true, path: cp };
    }
    return { ok: true, deleted: false, path: cp };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Plan-mode (always emits guidance; agent calls back with operations)
// ---------------------------------------------------------------------------

function buildEditPlan(rootDir, opts = {}) {
  const opened = openState(rootDir);
  if (!opened.ok) {
    return envelope({ ok: false, mode: 'plan', reason: opened.reason, text: opened.text });
  }
  const treeCtx = resolveTreeSource(opened);
  if (!treeCtx.source) {
    return envelope({
      ok: false, mode: 'plan', reason: 'no-tree',
      text: 'EDIT requires either a proposed_tree (mid-deliberation) or a committed tree (post-Stage-8). Run /ovd-plan deliberate first.'
    });
  }

  const lines = [];
  lines.push(`EDIT — structural tree mutations (${treeCtx.source} tree)`);
  lines.push('================================================');
  lines.push('');
  lines.push(`Tree source: ${treeCtx.source} (${treeCtx.milestones.length} milestone(s))`);
  if (opts.text) {
    lines.push('');
    lines.push(`Edit direction: ${opts.text}`);
  }
  lines.push('');
  lines.push('Current tree:');
  for (const m of treeCtx.milestones) {
    lines.push(`  ${m.id || '?'}  ${m.title || '(untitled)'}`);
    for (const leaf of (m.children || [])) {
      lines.push(`    ${leaf.id || '?'}  ${leaf.title || '(untitled)'}`);
    }
  }
  lines.push('');
  lines.push('Supported operation kinds:');
  lines.push('  • patch — non-structural: rename title / update description / update scope+success+deps+verify+skills.');
  lines.push('  • add_milestone — structural: append a new milestone (body.id + body.title required).');
  lines.push('  • add_leaf — structural: append a new leaf under a milestone (body.id + body.parent_milestone_id + body.title required).');
  lines.push('  • remove — structural: remove node by target_id (cascades to children).');
  lines.push('  • reorder — structural: change sibling order under a parent (body.ordered_ids = exact set of current children).');
  lines.push('');
  lines.push('Two-phase commit (per Q3.6.3 narrative-diff lock):');
  lines.push('  1. Emit operations WITHOUT confirm=true → receive narrative diff preview.');
  lines.push('  2. Re-emit identical operations WITH confirm=true → atomic apply + writeback.');
  lines.push('');
  lines.push('Atomic-batch constraint: ops do NOT see each other in the same batch.');
  lines.push('  To add milestone III and add a leaf under it, use two separate edit calls.');
  lines.push('');
  lines.push('Commit syntax — preview (Phase 1):');
  lines.push('  overdrive plan edit --entries-json \'{"operations":[{"kind":"patch","target_id":"II.1","body":{"title":"New"}}]}\'');
  lines.push('Commit syntax — apply (Phase 2):');
  lines.push('  overdrive plan edit --entries-json \'{"operations":[...],"confirm":true,"rationale":"why"}\'');

  return envelope({
    ok: true,
    mode: 'plan',
    tree_source: treeCtx.source,
    milestone_count: treeCtx.milestones.length,
    text: lines.join('\n')
  });
}

// ---------------------------------------------------------------------------
// Commit-mode (preview or apply)
// ---------------------------------------------------------------------------

function commitEdit(rootDir, rawEntries, opts = {}) {
  const opened = openState(rootDir);
  if (!opened.ok) {
    return envelope({ ok: false, mode: 'commit', reason: opened.reason, text: opened.text });
  }
  const treeCtx = resolveTreeSource(opened);
  if (!treeCtx.source) {
    return envelope({
      ok: false, mode: 'commit', reason: 'no-tree',
      text: 'EDIT requires either a proposed_tree (mid-deliberation) or a committed tree (post-Stage-8). Run /ovd-plan deliberate first.'
    });
  }
  treeCtx.idSet = collectAllIds(treeCtx.milestones);

  const normalized = normalizeEditEntries(rawEntries, treeCtx);
  if (!normalized.ok) {
    return envelope({
      ok: false, mode: 'commit', reason: normalized.reason, errors: normalized.errors,
      text: `EDIT entries rejected: ${normalized.errors.join('; ')}`
    });
  }
  const entries = normalized.entries;

  // Phase 1 — preview only (Q3.6.3 diff-before-apply)
  if (!entries.confirm) {
    return envelope({
      ok: true, mode: 'commit', phase: 'preview', applied: false,
      operations: entries.operations,
      tree_source: treeCtx.source,
      text: renderNarrativeDiff(entries.operations, treeCtx)
    });
  }

  // Phase 2 — atomic apply
  const now = nowIso(opts);

  // Render operation lines BEFORE mutation so we capture pre-state titles
  // for patch/remove descriptions (post-mutation the old title is gone).
  const operationLines = entries.operations.map((op) => renderOperationLine(op, treeCtx));

  applyAllOps(entries.operations, treeCtx);

  // Bump revision when mutating proposed_tree (mirrors Stage 7 precedent)
  if (treeCtx.source === 'proposed') {
    const proposed = opened.innerObj.proposed_tree;
    proposed.last_revision = (proposed.last_revision || 1) + 1;
    opened.innerObj.current_proposal_revision = proposed.last_revision;
  }
  opened.innerObj.last_action = now;

  const committed = commitState(rootDir, opened);
  if (!committed.ok) {
    return envelope({ ok: false, mode: 'commit', reason: committed.reason, text: committed.text });
  }

  // Log structural ops to decisions.md
  const structuralOps = entries.operations.filter((op) => STRUCTURAL_KINDS.has(op.kind));
  const today = now.slice(0, 10);
  const decisionsAppended = [];
  for (const op of structuralOps) {
    const desc = describeStructuralOpForDecisions(op);
    if (!desc) continue;
    const result = appendDecision(rootDir, {
      date: today,
      node: desc.node,
      decision: desc.decision,
      rationale: entries.rationale || `EDIT ${op.kind}`
    });
    if (result.ok) decisionsAppended.push({ node: desc.node, row: result.row });
  }

  // Cache invalidation when any structural op ran
  let cacheInvalidation = null;
  if (structuralOps.length > 0) {
    cacheInvalidation = invalidateCache(rootDir);
  }

  const lines = [];
  lines.push(`EDIT applied (${entries.operations.length} operation${entries.operations.length === 1 ? '' : 's'} on the ${treeCtx.source} tree).`);
  lines.push('');
  for (const line of operationLines) {
    lines.push(`  ✓ ${line}`);
  }
  lines.push('');
  if (structuralOps.length > 0) {
    lines.push(`Structural: ${structuralOps.length} logged to .overdrive/decisions.md.`);
    if (cacheInvalidation && cacheInvalidation.ok && cacheInvalidation.deleted) {
      lines.push('Cache invalidated (.overdrive/cache.json deleted).');
    }
  }
  if (treeCtx.source === 'proposed') {
    lines.push(`Proposal revision bumped to ${opened.innerObj.proposed_tree.last_revision}.`);
  }
  lines.push('');
  // FU-1 (2026-06-22, locked design — impl-plan §6.1): after a committed EDIT,
  // lead with doc propagation via /ovd-log (which owns the DOC UPDATE internal
  // state, runDocUpdate — Pattern 2, no fork). Do NOT recommend re-running the
  // codebase mappers (/ovd-workflow refresh): mappers run once to understand the
  // codebase; project docs are propagated by /ovd-log, /ovd-plan, /ovd-go.
  lines.push('Next — propagate this edit (action paths):');
  lines.push('  (1) /ovd-log — capture this edit and surgically update affected docs (README / architecture). [recommended]');
  lines.push('  (2) keep editing — make further structural changes; one /ovd-log at the end captures them all.');
  lines.push('  (3) other — describe what you want.');

  return envelope({
    ok: true, mode: 'commit', phase: 'apply', applied: true,
    tree_source: treeCtx.source,
    operations_count: entries.operations.length,
    structural_count: structuralOps.length,
    decisions_appended: decisionsAppended,
    cache_invalidation: cacheInvalidation,
    text: lines.join('\n')
  });
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

function runEdit(rootDir, opts = {}) {
  const isCommit = opts.mode === 'commit' || !!opts.entries;
  if (!isCommit) {
    return buildEditPlan(rootDir, opts);
  }
  return commitEdit(rootDir, opts.entries, opts);
}

function formatPlan(result) { return (result && result.text) || '(no plan text)'; }
function formatCommit(result) { return (result && result.text) || '(no commit text)'; }

module.exports = {
  STATUS,
  KINDS,
  STRUCTURAL_KINDS,
  PATCH_ALLOWED_FIELDS,
  envelope,
  resolveTreeSource,
  findNodeInMilestones,
  collectAllIds,
  validateOperation,
  normalizeEditEntries,
  describePatchChange,
  renderOperationLine,
  renderNarrativeDiff,
  applyPatchOp,
  applyAddMilestoneOp,
  applyAddLeafOp,
  applyRemoveOp,
  applyReorderOp,
  applyAllOps,
  describeStructuralOpForDecisions,
  invalidateCache,
  buildEditPlan,
  commitEdit,
  runEdit,
  formatPlan,
  formatCommit
};
