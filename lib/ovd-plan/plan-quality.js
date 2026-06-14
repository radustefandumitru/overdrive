'use strict';

const fs = require('fs');
const path = require('path');
const { openState } = require('./deliberation-state');

// ---------------------------------------------------------------------------
// Task 3.8 — Plan-quality check (Stage 6 Verify)
//
// Three sub-checks per r3 §5.3 Stage 6 + impl plan §5 Task 3.8 + readiness
// brief §"Task 3.8":
//   1. Coverage — every functional requirement in `.overdrive/requirements.md`
//      traces to ≥1 leaf in the proposed/committed tree. Agent-side reasoning
//      via Pattern 1 dispatch; CLI persists verdict per Q3.8 lock.
//   2. Leaf completeness — every leaf has description, scope.{in,out},
//      success[], verify.{method,fallback,review_required:boolean}, deps[],
//      skills[], confidence ∈ {high,medium,low}, rationale, considered[].
//      Pure CLI check; no agent needed. pending_skill_resolution=true is a
//      distinct failure_kind ('skill-resolution-skipped') per Q3.8.5 amplify.
//   3. Goal-backward — per-milestone agent verdict ∈ {pass,gap,reroute}.
//      Agent-side reasoning via Pattern 1 dispatch; CLI persists verbatim.
//
// Coverage is enforced only on Functional[] per Q3.8.3 lock (non-functional
// is cross-cutting; out-of-scope is informational). All three categories are
// REPORTED in the envelope for transparency.
//
// Tree source: proposed_tree-first-fallback-to-committed per Q3.8.4 lock.
// Dispatch shape: bundled (one plan dispatch + one commit payload carry both
// agent-side checks) per Q3.8.8 lock.
//
// NO subcommand route at index.js, NO new STAGES entry, NO deliberate.js
// wiring — those are Slice C territory. Task 3.8 exports
// `runPlanQualityCheck(rootDir, opts)` only.
// ---------------------------------------------------------------------------

const STATUS = 'plan-quality';
const SESSIONS_REL = path.join('.overdrive', 'sessions');
const REPORT_FILENAME_PREFIX = 'plan-quality';

const REQUIREMENTS_REL = path.join('.overdrive', 'requirements.md');
const REQUIREMENT_CATEGORIES = [
  { key: 'functional', header: 'Functional' },
  { key: 'nonFunctional', header: 'Non-functional' },
  { key: 'outOfScope', header: 'Out of scope' }
];

const VALID_CONFIDENCE = new Set(['high', 'medium', 'low']);
const VALID_VERDICTS = new Set(['pass', 'gap', 'reroute']);

const REQUIRED_LEAF_FIELDS = [
  'description',
  'scope',
  'success',
  'verify',
  'deps',
  'skills',
  'confidence',
  'rationale',
  'considered'
];

// ---------------------------------------------------------------------------
// Requirements file parsing
// ---------------------------------------------------------------------------

function nowIso(opts) {
  return (opts && opts.now) || new Date().toISOString();
}

function envelope(payload) {
  return Object.assign({ status: STATUS }, payload);
}

function readFileSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return null;
  }
}

// Parse `.overdrive/requirements.md` (Phase 2 Task 2.5 format: `## Functional`,
// `## Non-functional`, `## Out of scope` sections, each with `- item` bullets).
// Returns {functional, nonFunctional, outOfScope} arrays of trimmed strings, or
// null if the file is missing/empty. Missing sections yield empty arrays.
function parseRequirements(rootDir) {
  const filePath = path.join(rootDir, REQUIREMENTS_REL);
  const content = readFileSafe(filePath);
  if (!content) return null;
  const result = {};
  for (const cat of REQUIREMENT_CATEGORIES) {
    result[cat.key] = extractBullets(content, cat.header);
  }
  return result;
}

function extractBullets(content, headerText) {
  const headerPattern = new RegExp(`^##\\s+${headerText}\\s*$`, 'm');
  const match = content.match(headerPattern);
  if (!match) return [];
  const startIdx = match.index + match[0].length;
  const remainder = content.slice(startIdx);
  const nextHeader = remainder.search(/^##\s+/m);
  const section = nextHeader === -1 ? remainder : remainder.slice(0, nextHeader);
  const items = [];
  for (const raw of section.split(/\r?\n/)) {
    const line = raw.replace(/\r$/, '');
    const m = line.match(/^\s*-\s+(.+)$/);
    if (m && m[1].trim()) items.push(m[1].trim());
  }
  return items;
}

// ---------------------------------------------------------------------------
// Tree source resolution (proposed_tree-first-fallback-to-committed per Q3.8.4)
// ---------------------------------------------------------------------------

// Returns { source: 'proposed' | 'committed' | null, milestones: array,
// leaves: [{ milestone_id, leaf }], tree_revision: int }.
// proposed_tree (from deliberation-state) wins when present — that's the
// deliberation-flow source. committed tree (parsed.tree.children depth-2
// milestones with depth-3 leaves as children) is the fallback for the
// retrospective audit use case (post-Stage-8 /ovd-plan verify; Slice C).
function resolveTreeFromOpened(opened) {
  const inner = opened.innerObj || {};
  if (inner.proposed_tree && Array.isArray(inner.proposed_tree.milestones) && inner.proposed_tree.milestones.length > 0) {
    return {
      source: 'proposed',
      milestones: inner.proposed_tree.milestones,
      revision: inner.proposed_tree.last_revision || inner.current_proposal_revision || 1
    };
  }
  const root = (opened.parsed && opened.parsed.tree) ? opened.parsed.tree : null;
  if (root && Array.isArray(root.children) && root.children.length > 0) {
    // Map committed tree to the proposed_tree shape used by the rest of this module:
    // depth-2 milestone has {id, title, description, children: [depth-3 leaves with
    // annotations rolled up to the leaf object's own keys]}.
    const milestones = root.children
      .filter((m) => m && m.depth === 2)
      .map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description || '',
        children: Array.isArray(m.children)
          ? m.children
              .filter((l) => l && l.depth === 3)
              .map((l) => rollUpCommittedLeaf(l))
          : []
      }));
    if (milestones.length === 0) return { source: null, milestones: [], revision: 0 };
    return { source: 'committed', milestones, revision: 0 };
  }
  return { source: null, milestones: [], revision: 0 };
}

// Committed tree: leaves carry annotations (writer.js ANNOTATION_KEY_ORDER).
// Roll annotations up to the leaf object so leaf-completeness sees a uniform
// shape regardless of source.
function rollUpCommittedLeaf(leafNode) {
  const ann = (leafNode.annotations && typeof leafNode.annotations === 'object') ? leafNode.annotations : {};
  const out = {
    id: leafNode.id,
    title: leafNode.title,
    description: leafNode.description || ''
  };
  // Slice A + Slice B + Task 3.4 fields that ride through annotations.
  for (const field of ['skills', 'confidence', 'rationale', 'considered', 'scope', 'success', 'deps', 'verify', 'pending_skill_resolution', 'inserted_by', 'inserted_reason', 'category', 'internal_analysis']) {
    if (ann[field] !== undefined) out[field] = ann[field];
  }
  return out;
}

function flattenLeaves(milestones) {
  const out = [];
  for (const m of milestones) {
    if (!Array.isArray(m.children)) continue;
    for (const leaf of m.children) {
      if (leaf && typeof leaf === 'object') {
        out.push({ milestone_id: m.id, leaf });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Leaf completeness — pure CLI check (no agent reasoning)
// ---------------------------------------------------------------------------

// Returns { ok, failure_kind, message, missing_fields?, invalid_field? }.
// Q3.8.5 amplify: pending_skill_resolution: true is a distinct failure_kind
// (Slice B was skipped) — surfaces root cause, not symptom.
function checkLeafCompleteness(leaf) {
  if (!leaf || typeof leaf !== 'object' || Array.isArray(leaf)) {
    return { ok: false, failure_kind: 'invalid-leaf', message: 'leaf must be an object' };
  }
  if (leaf.pending_skill_resolution === true) {
    return {
      ok: false,
      failure_kind: 'skill-resolution-skipped',
      message: 'pending_skill_resolution=true — Stage 5.5 (RESOLVE SKILLS) did not complete. Run /ovd-plan deliberate to fill skills/confidence/rationale/considered before plan-quality can pass.'
    };
  }
  const missing = [];
  for (const field of REQUIRED_LEAF_FIELDS) {
    if (leaf[field] === undefined) missing.push(field);
  }
  if (missing.length > 0) {
    return {
      ok: false,
      failure_kind: 'missing-fields',
      missing_fields: missing,
      message: `Missing required field(s): ${missing.join(', ')}`
    };
  }
  // Type / shape validation per writer-canonical names (Q3.3A.10 precedent).
  if (typeof leaf.description !== 'string' || !leaf.description.trim()) {
    return { ok: false, failure_kind: 'invalid-fields', invalid_field: 'description', message: 'description must be a non-empty string' };
  }
  if (!leaf.scope || typeof leaf.scope !== 'object' || Array.isArray(leaf.scope)) {
    return { ok: false, failure_kind: 'invalid-fields', invalid_field: 'scope', message: 'scope must be an object' };
  }
  if (!Array.isArray(leaf.scope.in)) {
    return { ok: false, failure_kind: 'invalid-fields', invalid_field: 'scope.in', message: 'scope.in must be an array' };
  }
  if (!Array.isArray(leaf.scope.out)) {
    return { ok: false, failure_kind: 'invalid-fields', invalid_field: 'scope.out', message: 'scope.out must be an array' };
  }
  if (!Array.isArray(leaf.success) || leaf.success.length === 0) {
    return { ok: false, failure_kind: 'invalid-fields', invalid_field: 'success', message: 'success must be a non-empty array' };
  }
  if (!leaf.verify || typeof leaf.verify !== 'object' || Array.isArray(leaf.verify)) {
    return { ok: false, failure_kind: 'invalid-fields', invalid_field: 'verify', message: 'verify must be an object' };
  }
  if (typeof leaf.verify.method !== 'string' || !leaf.verify.method.trim()) {
    return { ok: false, failure_kind: 'invalid-fields', invalid_field: 'verify.method', message: 'verify.method must be a non-empty string' };
  }
  if (typeof leaf.verify.fallback !== 'string' || !leaf.verify.fallback.trim()) {
    return { ok: false, failure_kind: 'invalid-fields', invalid_field: 'verify.fallback', message: 'verify.fallback must be a non-empty string' };
  }
  if (typeof leaf.verify.review_required !== 'boolean') {
    return { ok: false, failure_kind: 'invalid-fields', invalid_field: 'verify.review_required', message: 'verify.review_required must be a boolean' };
  }
  if (!Array.isArray(leaf.deps)) {
    return { ok: false, failure_kind: 'invalid-fields', invalid_field: 'deps', message: 'deps must be an array' };
  }
  if (!Array.isArray(leaf.skills)) {
    return { ok: false, failure_kind: 'invalid-fields', invalid_field: 'skills', message: 'skills must be an array' };
  }
  if (typeof leaf.confidence !== 'string' || !VALID_CONFIDENCE.has(leaf.confidence)) {
    return { ok: false, failure_kind: 'invalid-fields', invalid_field: 'confidence', message: 'confidence must be "high" | "medium" | "low"' };
  }
  if (typeof leaf.rationale !== 'string') {
    return { ok: false, failure_kind: 'invalid-fields', invalid_field: 'rationale', message: 'rationale must be a string' };
  }
  if (!Array.isArray(leaf.considered)) {
    return { ok: false, failure_kind: 'invalid-fields', invalid_field: 'considered', message: 'considered must be an array' };
  }
  return { ok: true };
}

function runLeafCompleteness(milestones) {
  const flat = flattenLeaves(milestones);
  const passed = [];
  const failed = [];
  for (const entry of flat) {
    const result = checkLeafCompleteness(entry.leaf);
    if (result.ok) {
      passed.push(entry.leaf.id);
    } else {
      const failureEntry = { leaf_id: entry.leaf.id, milestone_id: entry.milestone_id, failure_kind: result.failure_kind, message: result.message };
      if (result.missing_fields) failureEntry.missing_fields = result.missing_fields;
      if (result.invalid_field) failureEntry.invalid_field = result.invalid_field;
      failed.push(failureEntry);
    }
  }
  return { passed_leaf_ids: passed, failed };
}

// ---------------------------------------------------------------------------
// Plan mode — emit bundled dispatch artifact (coverage + goal-backward)
// ---------------------------------------------------------------------------

function buildPlanQualityTurn(rootDir, opts = {}) {
  const opened = openState(rootDir);
  if (!opened.ok) {
    return envelope({ ok: false, reason: opened.reason, text: opened.text });
  }
  const treeInfo = resolveTreeFromOpened(opened);
  if (!treeInfo.source) {
    return envelope({
      ok: false,
      reason: 'no-tree',
      text: 'Plan-quality check requires a proposed_tree (in deliberation-state) OR a committed tree (post-Stage-8). Run /ovd-plan deliberate through Stage 8 commit first, or initiate a deliberation pass via /ovd-plan deliberate.'
    });
  }
  const requirements = parseRequirements(rootDir);
  if (!requirements) {
    return envelope({
      ok: false,
      reason: 'no-requirements',
      text: 'Plan-quality check requires `.overdrive/requirements.md` (produced by /ovd-workflow requirements). Run requirements draft first.'
    });
  }
  const milestones = treeInfo.milestones;
  const flat = flattenLeaves(milestones);

  // Pre-compute leaf-completeness at plan-mode time (no agent needed for this check).
  const completenessReport = runLeafCompleteness(milestones);

  // Project leaf shape for the agent dispatch (avoid embedding internal_analysis etc.).
  const leavesForDispatch = flat.map(({ milestone_id, leaf }) => ({
    id: leaf.id,
    milestone_id,
    title: leaf.title,
    description: leaf.description || '',
    scope: leaf.scope || { in: [], out: [] },
    success: leaf.success || []
  }));
  const milestonesForDispatch = milestones.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description || '',
    children_success_criteria: (m.children || []).flatMap((c) => Array.isArray(c.success) ? c.success : [])
  }));

  const lines = [];
  lines.push('Stage 6 — Plan-quality check (coverage + leaf-completeness + goal-backward)');
  lines.push('===========================================================================');
  lines.push('');
  lines.push(`Tree source: ${treeInfo.source} (revision ${treeInfo.revision})`);
  lines.push(`Milestones: ${milestones.length}; leaves: ${flat.length}`);
  lines.push('');
  lines.push('## Requirements (from .overdrive/requirements.md)');
  lines.push(`Functional (${requirements.functional.length}; coverage check ENFORCED):`);
  requirements.functional.forEach((r, i) => lines.push(`  [${i}] ${r}`));
  if (requirements.functional.length === 0) lines.push('  (none — coverage trivially satisfied)');
  lines.push('');
  lines.push(`Non-functional (${requirements.nonFunctional.length}; reported for transparency, NOT trace-enforced):`);
  requirements.nonFunctional.forEach((r, i) => lines.push(`  [${i}] ${r}`));
  if (requirements.nonFunctional.length === 0) lines.push('  (none)');
  lines.push('');
  lines.push(`Out of scope (${requirements.outOfScope.length}; reported for transparency, NOT trace-enforced):`);
  requirements.outOfScope.forEach((r, i) => lines.push(`  [${i}] ${r}`));
  if (requirements.outOfScope.length === 0) lines.push('  (none)');
  lines.push('');
  lines.push('## Leaf-completeness (pre-computed CLI check)');
  lines.push(`Passed: ${completenessReport.passed_leaf_ids.length} leaf/leaves.`);
  if (completenessReport.failed.length > 0) {
    lines.push(`Failed: ${completenessReport.failed.length} leaf/leaves:`);
    for (const f of completenessReport.failed) {
      const detail = f.missing_fields ? ` (missing: ${f.missing_fields.join(', ')})` : f.invalid_field ? ` (invalid: ${f.invalid_field})` : '';
      lines.push(`  - ${f.leaf_id}: ${f.failure_kind}${detail} — ${f.message}`);
    }
  } else {
    lines.push('Failed: 0 (all leaves complete).');
  }
  lines.push('');
  lines.push('## Coverage + goal-backward (agent reasoning required)');
  lines.push('');
  lines.push('Instructions for the agent:');
  lines.push('  - For each functional requirement above, identify which leaf id(s) trace to it. Use semantic match');
  lines.push('    against the leaf description + success criteria + scope. Per r3 §5.3 Stage 6 + Q3.8 lock, this is');
  lines.push('    agent-side reasoning — CLI persists your verdict but does not grade it.');
  lines.push('  - A requirement may be covered by multiple leaves; a leaf may cover multiple requirements.');
  lines.push('  - A requirement with NO covering leaf goes in uncovered_indices.');
  lines.push('  - For each milestone, judge: working backward from the milestone\'s children leaves\' success_criteria,');
  lines.push('    does the milestone\'s stated goal logically result?');
  lines.push('      pass    = goal is reached by the leaves;');
  lines.push('      gap     = leaves are insufficient or underspecified;');
  lines.push('      reroute = leaves don\'t ladder to the goal; the milestone needs different children.');
  lines.push('  - Provide a one-line `notes` per milestone explaining the verdict (required, non-empty).');
  lines.push('');
  lines.push('Leaves available for trace (by milestone):');
  for (const m of milestonesForDispatch) {
    lines.push(`  ${m.id} ${m.title}`);
    const childs = leavesForDispatch.filter((l) => l.milestone_id === m.id);
    if (childs.length === 0) {
      lines.push('    (no leaves)');
    } else {
      for (const l of childs) {
        lines.push(`    ${l.id} ${l.title}`);
      }
    }
  }
  lines.push('');
  lines.push('Action paths:');
  lines.push('  (1) Accept and commit — emit trace + milestone_verdicts and run the commit (writes report to .overdrive/sessions/).');
  lines.push('  (2) Iterate — review and adjust the proposed tree via /ovd-plan deliberate (no quality check landed yet).');
  lines.push('  (3) Describe other (or describe what you want).');
  lines.push('');
  lines.push('Commit syntax (accept and commit):');
  const exampleTrace = requirements.functional.length > 0
    ? `{"0":["${flat[0] ? flat[0].leaf.id : 'I.1'}"]${requirements.functional.length > 1 ? ',"1":[]' : ''}}`
    : '{}';
  const exampleUncovered = requirements.functional.length > 1 ? '[1]' : '[]';
  const exampleVerdicts = milestonesForDispatch.map((m) => `{"milestone_id":"${m.id}","verdict":"pass","notes":"goal reached"}`).join(',');
  lines.push(`  overdrive plan-quality commit --entries-json '{"trace":${exampleTrace},"uncovered_indices":${exampleUncovered},"milestone_verdicts":[${exampleVerdicts}]}'`);

  return envelope({
    ok: true,
    mode: 'plan',
    tree_source: treeInfo.source,
    tree_revision: treeInfo.revision,
    requirements,
    milestones: milestonesForDispatch,
    leaves: leavesForDispatch,
    leaf_completeness: completenessReport,
    expectedPayload: {
      trace: 'object (keys = stringified functional req indices, values = string[] of leaf ids)',
      uncovered_indices: 'integer[] (functional req indices not covered)',
      milestone_verdicts: '[{ milestone_id: string, verdict: "pass"|"gap"|"reroute", notes: string }]'
    },
    text: lines.join('\n')
  });
}

// ---------------------------------------------------------------------------
// Commit mode — validate payload, compute report, write to sessions/
// ---------------------------------------------------------------------------

function validateTrace(trace, functionalLen, leafIds) {
  if (!trace || typeof trace !== 'object' || Array.isArray(trace)) {
    return { ok: false, reason: 'invalid-shape', message: 'trace must be an object (keys = stringified functional req indices)' };
  }
  for (const rawKey of Object.keys(trace)) {
    // Q3.8.10 amplify: keys MUST stringify-equal valid array indices.
    if (!/^[0-9]+$/.test(rawKey)) {
      return { ok: false, reason: 'invalid-trace-key', message: `trace key "${rawKey}" is not a valid stringified non-negative integer` };
    }
    const idx = Number(rawKey);
    if (idx < 0 || idx >= functionalLen) {
      return { ok: false, reason: 'invalid-trace-key', message: `trace key "${rawKey}" is out of range [0, ${functionalLen})` };
    }
    const leafs = trace[rawKey];
    if (!Array.isArray(leafs)) {
      return { ok: false, reason: 'invalid-trace-value', message: `trace["${rawKey}"] must be an array of leaf ids` };
    }
    for (let i = 0; i < leafs.length; i += 1) {
      const id = leafs[i];
      if (typeof id !== 'string' || !id.trim()) {
        return { ok: false, reason: 'invalid-trace-value', message: `trace["${rawKey}"][${i}] must be a non-empty string` };
      }
      if (!leafIds.has(id)) {
        return { ok: false, reason: 'unknown-leaf-id', message: `trace["${rawKey}"] references unknown leaf id "${id}"` };
      }
    }
  }
  return { ok: true };
}

function validateUncovered(uncovered, functionalLen) {
  if (!Array.isArray(uncovered)) {
    return { ok: false, reason: 'invalid-shape', message: 'uncovered_indices must be an array' };
  }
  const seen = new Set();
  for (let i = 0; i < uncovered.length; i += 1) {
    const v = uncovered[i];
    if (!Number.isInteger(v) || v < 0 || v >= functionalLen) {
      return { ok: false, reason: 'invalid-uncovered-index', message: `uncovered_indices[${i}] must be an integer in [0, ${functionalLen})` };
    }
    if (seen.has(v)) {
      return { ok: false, reason: 'duplicate-uncovered-index', message: `uncovered_indices contains duplicate ${v}` };
    }
    seen.add(v);
  }
  return { ok: true };
}

function validateMilestoneVerdicts(verdicts, milestoneIds) {
  if (!Array.isArray(verdicts)) {
    return { ok: false, reason: 'invalid-shape', message: 'milestone_verdicts must be an array' };
  }
  const seen = new Set();
  for (let i = 0; i < verdicts.length; i += 1) {
    const v = verdicts[i];
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      return { ok: false, reason: 'invalid-verdict', message: `milestone_verdicts[${i}] must be an object` };
    }
    if (typeof v.milestone_id !== 'string' || !v.milestone_id.trim()) {
      return { ok: false, reason: 'invalid-verdict', message: `milestone_verdicts[${i}].milestone_id must be a non-empty string` };
    }
    if (!milestoneIds.has(v.milestone_id)) {
      return { ok: false, reason: 'unknown-milestone-id', message: `milestone_verdicts[${i}] references unknown milestone "${v.milestone_id}"` };
    }
    if (seen.has(v.milestone_id)) {
      return { ok: false, reason: 'duplicate-milestone-verdict', message: `milestone_verdicts contains two entries for "${v.milestone_id}"` };
    }
    seen.add(v.milestone_id);
    if (typeof v.verdict !== 'string' || !VALID_VERDICTS.has(v.verdict)) {
      return { ok: false, reason: 'invalid-verdict', message: `milestone_verdicts[${i}].verdict must be one of: pass, gap, reroute (got "${v.verdict}")` };
    }
    if (typeof v.notes !== 'string' || !v.notes.trim()) {
      return { ok: false, reason: 'invalid-verdict', message: `milestone_verdicts[${i}].notes must be a non-empty string` };
    }
  }
  // Coverage assertion: every tree milestone must have a verdict.
  const missing = [];
  for (const id of milestoneIds) {
    if (!seen.has(id)) missing.push(id);
  }
  if (missing.length > 0) {
    return { ok: false, reason: 'incomplete-verdict-coverage', message: `milestone_verdicts missing entries for: ${missing.join(', ')}` };
  }
  return { ok: true };
}

function applyPlanQualityTurn(rootDir, entries, opts = {}) {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return envelope({
      ok: false,
      reason: 'invalid-shape',
      text: 'Plan-quality commit requires a JSON object with { trace, uncovered_indices, milestone_verdicts }.'
    });
  }
  const opened = openState(rootDir);
  if (!opened.ok) {
    return envelope({ ok: false, reason: opened.reason, text: opened.text });
  }
  const treeInfo = resolveTreeFromOpened(opened);
  if (!treeInfo.source) {
    return envelope({ ok: false, reason: 'no-tree', text: 'Plan-quality commit requires a tree (proposed or committed).' });
  }
  const requirements = parseRequirements(rootDir);
  if (!requirements) {
    return envelope({ ok: false, reason: 'no-requirements', text: 'Plan-quality commit requires `.overdrive/requirements.md`.' });
  }
  const flat = flattenLeaves(treeInfo.milestones);
  const leafIds = new Set(flat.map(({ leaf }) => leaf.id));
  const milestoneIds = new Set(treeInfo.milestones.map((m) => m.id));
  const functionalLen = requirements.functional.length;

  const traceCheck = validateTrace(entries.trace, functionalLen, leafIds);
  if (!traceCheck.ok) {
    return envelope({ ok: false, reason: traceCheck.reason, text: `Plan-quality commit rejected: ${traceCheck.message}.` });
  }
  const uncoveredCheck = validateUncovered(entries.uncovered_indices, functionalLen);
  if (!uncoveredCheck.ok) {
    return envelope({ ok: false, reason: uncoveredCheck.reason, text: `Plan-quality commit rejected: ${uncoveredCheck.message}.` });
  }
  // Coverage assertion: every functional req index appears in exactly one of trace
  // (covered) or uncovered_indices. Forces explicit handling — no silent gaps.
  const coveredSet = new Set();
  for (const k of Object.keys(entries.trace)) coveredSet.add(Number(k));
  const uncoveredSet = new Set(entries.uncovered_indices);
  for (const idx of coveredSet) {
    if (uncoveredSet.has(idx)) {
      return envelope({ ok: false, reason: 'covered-and-uncovered', text: `Plan-quality commit rejected: requirement index ${idx} appears in both trace and uncovered_indices.` });
    }
  }
  const missingIndices = [];
  for (let i = 0; i < functionalLen; i += 1) {
    if (!coveredSet.has(i) && !uncoveredSet.has(i)) missingIndices.push(i);
  }
  if (missingIndices.length > 0) {
    return envelope({
      ok: false,
      reason: 'incomplete-coverage',
      text: `Plan-quality commit rejected: every functional requirement must appear in trace or uncovered_indices. Missing: [${missingIndices.join(', ')}].`
    });
  }
  const verdictCheck = validateMilestoneVerdicts(entries.milestone_verdicts, milestoneIds);
  if (!verdictCheck.ok) {
    return envelope({ ok: false, reason: verdictCheck.reason, text: `Plan-quality commit rejected: ${verdictCheck.message}.` });
  }

  // Re-run leaf-completeness at commit time (state may have changed since plan dispatch).
  const completenessReport = runLeafCompleteness(treeInfo.milestones);
  const now = nowIso(opts);
  const filename = `${now.replace(/[:.]/g, '-')}-${REPORT_FILENAME_PREFIX}-${treeInfo.revision}.md`;
  const reportPath = path.join(rootDir, SESSIONS_REL, filename);
  const reportBody = renderReport({
    timestamp: now,
    treeInfo,
    requirements,
    coverage: {
      trace: entries.trace,
      uncovered_indices: entries.uncovered_indices.slice(),
      covered_indices: Array.from(coveredSet).sort((a, b) => a - b)
    },
    leaf_completeness: completenessReport,
    goal_backward: entries.milestone_verdicts
  });

  try {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, reportBody, 'utf8');
  } catch (err) {
    return envelope({ ok: false, reason: 'write-failed', text: `Plan-quality commit failed to write report: ${err.message}` });
  }

  const passCount = completenessReport.passed_leaf_ids.length;
  const failCount = completenessReport.failed.length;
  const coveredCount = coveredSet.size;
  const uncoveredCount = uncoveredSet.size;
  const passMilestones = entries.milestone_verdicts.filter((v) => v.verdict === 'pass').length;
  const gapMilestones = entries.milestone_verdicts.filter((v) => v.verdict === 'gap').length;
  const rerouteMilestones = entries.milestone_verdicts.filter((v) => v.verdict === 'reroute').length;

  const summary = `coverage: ${coveredCount}/${functionalLen} functional reqs traced (${uncoveredCount} uncovered); leaf completeness: ${passCount} passed / ${failCount} failed; goal-backward: ${passMilestones} pass / ${gapMilestones} gap / ${rerouteMilestones} reroute across ${entries.milestone_verdicts.length} milestone(s).`;

  return envelope({
    ok: true,
    mode: 'commit',
    tree_source: treeInfo.source,
    tree_revision: treeInfo.revision,
    coverage: {
      covered_requirement_indices: Array.from(coveredSet).sort((a, b) => a - b),
      uncovered_requirement_indices: entries.uncovered_indices.slice(),
      leaf_trace: entries.trace
    },
    leaf_completeness: completenessReport,
    goal_backward: entries.milestone_verdicts,
    report_path: reportPath,
    summary,
    text: `Plan-quality report written to ${path.relative(rootDir, reportPath)}.\n${summary}`
  });
}

// ---------------------------------------------------------------------------
// Report rendering (.overdrive/sessions/<ts>-plan-quality-<rev>.md)
// ---------------------------------------------------------------------------

function renderReport(input) {
  const { timestamp, treeInfo, requirements, coverage, leaf_completeness, goal_backward } = input;
  const lines = [];
  lines.push(`# Plan-quality check — ${timestamp}`);
  lines.push('');
  lines.push(`- Tree source: \`${treeInfo.source}\` (revision ${treeInfo.revision})`);
  lines.push(`- Milestones: ${treeInfo.milestones.length}`);
  lines.push('');
  lines.push('## Coverage (functional[] only — enforced)');
  lines.push('');
  if (requirements.functional.length === 0) {
    lines.push('No functional requirements; coverage trivially satisfied.');
  } else {
    for (let i = 0; i < requirements.functional.length; i += 1) {
      const req = requirements.functional[i];
      const isCovered = coverage.covered_indices.includes(i);
      const tracedLeaves = isCovered ? (coverage.trace[String(i)] || []) : [];
      if (isCovered) {
        lines.push(`- [pass] [${i}] ${req} → ${tracedLeaves.join(', ')}`);
      } else {
        lines.push(`- [GAP]  [${i}] ${req} — no covering leaf`);
      }
    }
  }
  lines.push('');
  lines.push('## Non-functional requirements (reported for transparency, NOT trace-enforced)');
  lines.push('');
  if (requirements.nonFunctional.length === 0) {
    lines.push('(none)');
  } else {
    for (let i = 0; i < requirements.nonFunctional.length; i += 1) {
      lines.push(`- [${i}] ${requirements.nonFunctional[i]}`);
    }
  }
  lines.push('');
  lines.push('## Out of scope (reported for transparency, NOT trace-enforced)');
  lines.push('');
  if (requirements.outOfScope.length === 0) {
    lines.push('(none)');
  } else {
    for (let i = 0; i < requirements.outOfScope.length; i += 1) {
      lines.push(`- [${i}] ${requirements.outOfScope[i]}`);
    }
  }
  lines.push('');
  lines.push('## Leaf completeness');
  lines.push('');
  lines.push(`Passed: ${leaf_completeness.passed_leaf_ids.length} leaf/leaves.`);
  if (leaf_completeness.passed_leaf_ids.length > 0) {
    for (const id of leaf_completeness.passed_leaf_ids) {
      lines.push(`- [pass] ${id}`);
    }
  }
  lines.push('');
  lines.push(`Failed: ${leaf_completeness.failed.length} leaf/leaves.`);
  if (leaf_completeness.failed.length > 0) {
    for (const f of leaf_completeness.failed) {
      const detail = f.missing_fields ? ` (missing: ${f.missing_fields.join(', ')})` : f.invalid_field ? ` (invalid: ${f.invalid_field})` : '';
      lines.push(`- [FAIL] ${f.leaf_id} (under ${f.milestone_id}): ${f.failure_kind}${detail} — ${f.message}`);
    }
  }
  lines.push('');
  lines.push('## Goal-backward (per milestone)');
  lines.push('');
  for (const v of goal_backward) {
    const tag = v.verdict === 'pass' ? '[pass]' : v.verdict === 'gap' ? '[GAP]' : '[REROUTE]';
    lines.push(`- ${tag} ${v.milestone_id}: ${v.notes}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('_Generated by /ovd-plan plan-quality check (Phase 3 Task 3.8). Plan-mode dispatched the requirements + leaves; agent returned the trace + verdicts; CLI persisted verbatim per Q3.8 lock (CLI is custodian, not grader)._');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

function runPlanQualityCheck(rootDir, opts = {}) {
  const isCommit = opts.mode === 'commit' || !!opts.entries;
  if (!isCommit) return buildPlanQualityTurn(rootDir, opts);
  return applyPlanQualityTurn(rootDir, opts.entries, opts);
}

function formatPlan(result) { return (result && result.text) || '(no plan text)'; }
function formatCommit(result) { return (result && result.text) || '(no commit text)'; }

module.exports = {
  STATUS,
  SESSIONS_REL,
  REPORT_FILENAME_PREFIX,
  REQUIREMENTS_REL,
  REQUIREMENT_CATEGORIES,
  VALID_CONFIDENCE,
  VALID_VERDICTS,
  REQUIRED_LEAF_FIELDS,
  parseRequirements,
  extractBullets,
  resolveTreeFromOpened,
  rollUpCommittedLeaf,
  flattenLeaves,
  checkLeafCompleteness,
  runLeafCompleteness,
  buildPlanQualityTurn,
  applyPlanQualityTurn,
  validateTrace,
  validateUncovered,
  validateMilestoneVerdicts,
  renderReport,
  runPlanQualityCheck,
  formatPlan,
  formatCommit
};
