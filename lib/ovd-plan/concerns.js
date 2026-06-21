'use strict';

// Task 5.4 — /ovd-log concerns [<node-ref>]  (r3 §7.2)
//
// Structured review across 7 dimensions on the active node (or a specified one).
// Pattern-1 dispatch: PLAN emits the node + scope + dimensions and asks the agent
// to assess each (severity + finding + recommendation); COMMIT persists the
// findings to the node's `concerns` annotation (the key already exists in
// parser/writer ANNOTATION_KEY_ORDER — additive per Q5.4, zero migration impact).
// High-severity findings produce an explicit `/ovd-plan idea` recommendation.
//
// A review REPLACES the node's prior concerns (the field reflects the current
// assessment; each entry is stamped recorded_at). Historical reviews live in the
// session capture, not the annotation, so the field stays bounded.

const { openState, commitState } = require('./deliberation-state');
const { flattenNodes } = require('./noderef');

const STATUS = 'log';

// r3 §7.2 — the seven concern dimensions (key, display label).
const DIMENSIONS = [
  ['security', 'Security'],
  ['performance', 'Performance'],
  ['persistence', 'Persistence / data integrity'],
  ['fault_tolerance', 'Fault tolerance'],
  ['accessibility', 'Accessibility'],
  ['observability', 'Observability'],
  ['scalability', 'Scalability']
];
const DIMENSION_KEYS = DIMENSIONS.map(([k]) => k);
const SEVERITIES = ['high', 'medium', 'low', 'n/a'];

function nowIso(opts) {
  return (opts && opts.now) || new Date().toISOString();
}

function findNodeById(tree, id) {
  const want = typeof id === 'string' ? id.trim() : '';
  if (!want) return null;
  if (tree && tree.id === want) return tree;
  return flattenNodes(tree).find((n) => n.id === want) || null;
}

function resolveTarget(tree, nodeId) {
  if (nodeId && String(nodeId).trim()) {
    const node = findNodeById(tree, nodeId);
    if (!node) return { ok: false, reason: 'node-not-found', text: `No node with id "${nodeId}".` };
    return { ok: true, node };
  }
  const active = flattenNodes(tree).find((n) => n.active);
  if (!active) return { ok: false, reason: 'no-active-node', text: 'No active node set. Specify a node: /ovd-log concerns <node-ref>.' };
  return { ok: true, node: active };
}

// ---------------------------------------------------------------------------
// PLAN
// ---------------------------------------------------------------------------
function buildConcernsPlan(rootDir, opts = {}) {
  const opened = openState(rootDir);
  if (!opened.ok) return { ok: false, status: STATUS, reason: opened.reason, text: opened.text };
  const target = resolveTarget(opened.parsed.tree, opts.nodeId);
  if (!target.ok) return { ok: false, status: STATUS, reason: target.reason, text: target.text };

  const node = target.node;
  const scope = (node.annotations && node.annotations.scope && Array.isArray(node.annotations.scope.in)) ? node.annotations.scope.in : [];
  const lines = [];
  lines.push(`CONCERNS REVIEW — ${node.id} ${node.title || ''}`.trimEnd());
  lines.push('');
  if (scope.length) {
    lines.push('Scope (files to consider):');
    for (const f of scope) lines.push(`  - ${f}`);
    lines.push('');
  }
  lines.push('Assess each dimension. For each: severity (high/medium/low/n/a), a one-line finding, and a recommendation.');
  for (const [key, label] of DIMENSIONS) lines.push(`  - ${label} (${key})`);
  lines.push('');
  lines.push('Then re-invoke with --entries-json:');
  lines.push('  {');
  lines.push(`    "node_id": "${node.id}",`);
  lines.push('    "concerns": [');
  lines.push('      { "dimension": "<key>", "severity": "high|medium|low|n/a", "finding": "...", "recommendation": "..." }');
  lines.push('    ]');
  lines.push('  }');
  lines.push('');
  lines.push('Mark dimensions with no concern as severity "n/a". High-severity findings will be flagged for /ovd-plan idea remediation.');
  return { ok: true, status: STATUS, mode: 'plan', node_id: node.id, dimensions: DIMENSION_KEYS, text: lines.join('\n') };
}

// ---------------------------------------------------------------------------
// NORMALIZE (Pattern 4 guard)
// ---------------------------------------------------------------------------
function normalizeConcernsEntries(entries) {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return { ok: false, reason: 'invalid-entries', text: 'concerns commit requires a JSON object.' };
  }
  if (typeof entries.node_id !== 'string' || !entries.node_id.trim()) {
    return { ok: false, reason: 'missing-node-id', text: 'concerns entries require a non-empty node_id.' };
  }
  if (!Array.isArray(entries.concerns) || entries.concerns.length === 0) {
    return { ok: false, reason: 'no-concerns', text: 'concerns entries require a non-empty concerns[].' };
  }
  const out = [];
  for (const c of entries.concerns) {
    if (!c || typeof c !== 'object' || Array.isArray(c)) return { ok: false, reason: 'invalid-concern', text: 'each concern must be an object.' };
    if (!DIMENSION_KEYS.includes(c.dimension)) return { ok: false, reason: 'invalid-dimension', text: `dimension must be one of ${DIMENSION_KEYS.join(' / ')}.` };
    if (!SEVERITIES.includes(c.severity)) return { ok: false, reason: 'invalid-severity', text: `severity must be one of ${SEVERITIES.join(' / ')}.` };
    if (typeof c.finding !== 'string' || !c.finding.trim()) return { ok: false, reason: 'missing-finding', text: 'each concern requires a non-empty finding.' };
    out.push({
      dimension: c.dimension,
      severity: c.severity,
      finding: c.finding.trim(),
      recommendation: typeof c.recommendation === 'string' ? c.recommendation.trim() : ''
    });
  }
  return { ok: true, node_id: entries.node_id.trim(), concerns: out };
}

// ---------------------------------------------------------------------------
// COMMIT
// ---------------------------------------------------------------------------
function applyConcerns(rootDir, entries, opts = {}) {
  const norm = normalizeConcernsEntries(entries);
  if (!norm.ok) return { ok: false, status: STATUS, mode: 'commit', reason: norm.reason, text: norm.text };

  const opened = openState(rootDir);
  if (!opened.ok) return { ok: false, status: STATUS, mode: 'commit', reason: opened.reason, text: opened.text };
  const node = findNodeById(opened.parsed.tree, norm.node_id);
  if (!node) return { ok: false, status: STATUS, mode: 'commit', reason: 'node-not-found', text: `No node with id "${norm.node_id}".` };

  const recorded_at = nowIso(opts);
  if (!node.annotations || typeof node.annotations !== 'object') node.annotations = {};
  node.annotations.concerns = norm.concerns.map((c) => ({
    dimension: c.dimension,
    severity: c.severity,
    finding: c.finding,
    recommendation: c.recommendation,
    recorded_at
  }));

  const committed = commitState(rootDir, opened);
  if (!committed.ok) return { ok: false, status: STATUS, mode: 'commit', reason: committed.reason, text: committed.text };

  const high = norm.concerns.filter((c) => c.severity === 'high');
  const lines = [];
  lines.push(`Concerns recorded on ${node.id}: ${norm.concerns.length} finding(s) across ${new Set(norm.concerns.map((c) => c.dimension)).size} dimension(s).`);
  const counts = SEVERITIES.map((s) => `${s}=${norm.concerns.filter((c) => c.severity === s).length}`).join(', ');
  lines.push(`Severity: ${counts}.`);
  if (high.length) {
    lines.push('');
    lines.push(`${high.length} high-severity finding(s):`);
    for (const c of high) lines.push(`  - [${c.dimension}] ${c.finding}${c.recommendation ? ` → ${c.recommendation}` : ''}`);
    lines.push('');
    lines.push('Recommend: /ovd-plan idea "<remediation>" to plan the fix(es).');
  }
  return {
    ok: true,
    status: STATUS,
    mode: 'concerns-commit',
    node_id: node.id,
    concerns: node.annotations.concerns,
    high_count: high.length,
    text: lines.join('\n')
  };
}

function runLogConcerns(rootDir, opts = {}) {
  if (!rootDir || typeof rootDir !== 'string') {
    return { ok: false, status: STATUS, reason: 'invalid-project-dir', text: 'runLogConcerns requires a project directory string.' };
  }
  const mode = opts.mode || (opts.entries ? 'commit' : 'plan');
  if (mode === 'commit') return applyConcerns(rootDir, opts.entries, opts);
  return buildConcernsPlan(rootDir, opts);
}

module.exports = {
  STATUS,
  DIMENSIONS,
  DIMENSION_KEYS,
  SEVERITIES,
  findNodeById,
  buildConcernsPlan,
  normalizeConcernsEntries,
  applyConcerns,
  runLogConcerns
};
