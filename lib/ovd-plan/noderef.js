'use strict';

const fs = require('fs');
const path = require('path');

const { OVD_PLAN_FILE } = require('./fs');
const { parseOverdriveMd, ParseError } = require('./parser');
const { findActiveNode } = require('./display');
const { findActiveMilestone } = require('./orient');

// ---------------------------------------------------------------------------
// Task 4.11 — Node-ref fuzzy matching (r3 §6.8).
//
// `resolveNodeRef(tree, ref)` is a PURE matcher: hierarchical ID (II.2.a, exact,
// case-insensitive) OR fuzzy title (case-insensitive substring). On >1 fuzzy
// match it applies the Q4.10 tie-break (leaves > containers → active milestone →
// pending status); if still ambiguous it surfaces a numbered disambiguation.
//
// Q4.10 amendment (Pattern 7): an auto-resolved single pick MUST be announced
// with a cancel option before execution. Extended at Task-4.11 pre-flight to ALL
// fuzzy-derived single picks (title-single + tie-broken); exact-id matches were
// explicit, so they skip the announce. The matcher exposes `autoResolved`; the
// render emits the announce/cancel or numbered prompt; execution itself is a
// separate dispatch (Task 4.2). CLI does no LLM work (Pattern 1).
// ---------------------------------------------------------------------------

const STATUS = 'go';
const MATCH_TYPES = ['id-exact', 'title-single', 'tie-broken', 'ambiguous', 'none'];

function isLeaf(node) {
  return !node.children || node.children.length === 0;
}

// Flatten all addressable nodes (depth >= 2; excludes the depth-1 root/project).
function flattenNodes(tree) {
  const out = [];
  function walk(node) {
    for (const child of node.children || []) {
      out.push(child);
      walk(child);
    }
  }
  if (tree) walk(tree);
  return out;
}

function normalize(s) {
  return typeof s === 'string' ? s.trim().toLowerCase() : '';
}

// Q4.10 tie-break: progressive narrowing. Returns { node } when narrowed to one,
// or { pool } when still ambiguous. `trace` records which filters fired.
function applyTieBreak(candidates, tree) {
  const trace = [];
  let pool = candidates.slice();

  // 1. prefer leaves over containers
  const leaves = pool.filter(isLeaf);
  if (leaves.length >= 1 && leaves.length < pool.length) { pool = leaves; trace.push('prefer-leaves'); }
  if (pool.length === 1) return { node: pool[0], trace };

  // 2. prefer nodes in the active milestone
  const activeNode = findActiveNode(tree);
  const activeMilestone = activeNode ? findActiveMilestone(tree, activeNode) : null;
  if (activeMilestone) {
    const inActive = pool.filter((n) => {
      const ms = findActiveMilestone(tree, n);
      return ms && ms.id === activeMilestone.id;
    });
    if (inActive.length >= 1 && inActive.length < pool.length) { pool = inActive; trace.push('prefer-active-milestone'); }
    if (pool.length === 1) return { node: pool[0], trace };
  }

  // 3. prefer pending status
  const pending = pool.filter((n) => n.status === 'pending');
  if (pending.length >= 1 && pending.length < pool.length) { pool = pending; trace.push('prefer-pending'); }
  if (pool.length === 1) return { node: pool[0], trace };

  return { pool, trace };
}

// Pure matcher. Returns:
//   { matchType, matches: Node[], ambiguous: bool, autoResolved: bool, tieBreak: string[], reason? }
function resolveNodeRef(tree, ref) {
  const needle = normalize(ref);
  if (!needle) {
    return { matchType: 'none', matches: [], ambiguous: false, autoResolved: false, tieBreak: [], reason: 'empty-ref' };
  }
  const nodes = flattenNodes(tree);

  // Exact hierarchical ID match (case-insensitive). Explicit → no announce.
  const idMatch = nodes.find((n) => normalize(n.id) === needle);
  if (idMatch) {
    return { matchType: 'id-exact', matches: [idMatch], ambiguous: false, autoResolved: false, tieBreak: [] };
  }

  // Fuzzy title match (case-insensitive substring).
  const candidates = nodes.filter((n) => normalize(n.title).includes(needle));
  if (candidates.length === 0) {
    return { matchType: 'none', matches: [], ambiguous: false, autoResolved: false, tieBreak: [], reason: 'no-match' };
  }
  if (candidates.length === 1) {
    return { matchType: 'title-single', matches: [candidates[0]], ambiguous: false, autoResolved: true, tieBreak: [] };
  }

  const broken = applyTieBreak(candidates, tree);
  if (broken.node) {
    return { matchType: 'tie-broken', matches: [broken.node], ambiguous: false, autoResolved: true, tieBreak: broken.trace };
  }
  return { matchType: 'ambiguous', matches: broken.pool, ambiguous: true, autoResolved: false, tieBreak: broken.trace, reason: 'ambiguous' };
}

function nodeLabel(n) {
  return `${n.id} ${n.title || ''}`.trimEnd() + ` [${n.status || 'pending'}]`;
}

// Render the resolution per match type. Auto-resolved picks get the Q4.10
// announce + cancel; ambiguous gets a numbered disambiguation; both honor
// Pattern 7 (numbered options + describe-other escape).
function renderNodeRefResolution(result, ref) {
  const lines = [];
  switch (result.matchType) {
    case 'id-exact': {
      const n = result.matches[0];
      lines.push(`Resolved ${ref} → ${nodeLabel(n)}.`);
      break;
    }
    case 'title-single':
    case 'tie-broken': {
      const n = result.matches[0];
      lines.push(`Matched ${nodeLabel(n)}.`);
      if (result.matchType === 'tie-broken' && result.tieBreak.length > 0) {
        lines.push(`  (auto-selected by: ${result.tieBreak.join(' → ')})`);
      }
      lines.push('');
      lines.push("  (1) continue — proceed with this node.");
      lines.push('  (2) Pick a different node — describe or name it.');
      lines.push('  (3) Other — describe what you want.');
      break;
    }
    case 'ambiguous': {
      lines.push(`Multiple nodes match "${ref}":`);
      lines.push('');
      result.matches.forEach((n, i) => lines.push(`  (${i + 1}) ${nodeLabel(n)}`));
      lines.push(`  (${result.matches.length + 1}) Other — describe what you want.`);
      lines.push('');
      lines.push('Reply with a number or describe the node.');
      break;
    }
    case 'none':
    default:
      lines.push(`No node matches "${ref}". Run /ovd-go to see the plan, or /ovd-plan display for the full tree.`);
      break;
  }
  return lines.join('\n');
}

// Entry point — `/ovd-go <node-ref>`. Reads + parses OVERDRIVE.md, resolves the
// ref, renders. Execution of the resolved node is a separate dispatch (Task 4.2);
// this surfaces the resolution + announce/disambiguation envelope.
function runGoNodeRef(rootDir, ref, opts) {
  if (!rootDir || typeof rootDir !== 'string') {
    return { ok: false, status: STATUS, reason: 'invalid-project-dir', text: 'runGoNodeRef requires a project directory string.' };
  }
  if (typeof ref !== 'string' || ref.trim() === '') {
    return { ok: false, status: STATUS, reason: 'missing-ref', text: 'runGoNodeRef requires a node reference (id or title fragment).' };
  }
  const planPath = path.join(rootDir, OVD_PLAN_FILE);
  if (!fs.existsSync(planPath)) {
    return { ok: false, status: STATUS, reason: 'missing-plan', text: `OVERDRIVE.md not found at ${planPath}. Run /ovd-workflow init first, or /ovd-plan deliberate to start a plan.` };
  }
  let content;
  try {
    content = fs.readFileSync(planPath, 'utf8');
  } catch (err) {
    return { ok: false, status: STATUS, reason: 'read-error', text: `Could not read ${planPath}: ${err.message}` };
  }
  let parsed;
  try {
    parsed = parseOverdriveMd(content);
  } catch (err) {
    const isParse = err instanceof ParseError;
    return { ok: false, status: STATUS, reason: isParse ? 'parse-error' : 'unknown-error', text: `OVERDRIVE.md could not be parsed: ${err.message}` };
  }
  const result = resolveNodeRef(parsed.tree, ref);
  return {
    ok: true,
    status: STATUS,
    mode: 'noderef',
    matchType: result.matchType,
    ambiguous: result.ambiguous,
    autoResolved: result.autoResolved,
    tieBreak: result.tieBreak,
    matches: result.matches.map((n) => ({ id: n.id, title: n.title || '', status: n.status || 'pending' })),
    reason: result.reason || null,
    text: renderNodeRefResolution(result, ref)
  };
}

module.exports = {
  STATUS,
  MATCH_TYPES,
  isLeaf,
  flattenNodes,
  applyTieBreak,
  resolveNodeRef,
  nodeLabel,
  renderNodeRefResolution,
  runGoNodeRef
};
