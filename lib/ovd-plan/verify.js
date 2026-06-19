'use strict';

const fs = require('fs');
const path = require('path');

const { openState } = require('./deliberation-state');
const { isLeaf } = require('./noderef');
const { findLeaf, leafContract } = require('./execute');
const { isoToFilenameSafe } = require('./research');

// ---------------------------------------------------------------------------
// Task 4.3 — LEAF VERIFY dispatch by verification.method (r3 §5.6, §6.6, §6.9).
//
// Pattern-1 dispatch. PLAN reads the leaf's verify.{method,fallback,review_required}
// + success_criteria and emits a verify plan instructing the agent to run the
// method, falling back transparently to agent_self_check_against_success_criteria
// if the method's tool/skill is unavailable (Q4.2 — never fail hard). Availability
// is agent/runtime-side (the CLI can't know if playwright/react-doctor is installed),
// so the CLI declares method+fallback and the agent reports method_used/fallback_used.
//
// COMMIT validates the agent's verdict (Pattern 4), persists a verify report to a
// session capture file, and returns pass/fail + the recommended action paths
// (pass → approve/re-verify; fail → fix/replan/skip per r3 §6.9). Report-only:
// status transitions belong to AWAITING REVIEW (Task 4.4) / FIX (Task 4.9).
// Iteration-history persistence (r3 §10.6) wires in with Task 4.5.
// ---------------------------------------------------------------------------

const STATUS = 'go';
const SESSIONS_REL = path.join('.overdrive', 'sessions');
const ALWAYS_AVAILABLE = 'agent_self_check_against_success_criteria';
// v1 minimum method set (brief-13 Task 4.3). Non-listed methods are accepted and
// passed through to the agent ("run it or fall back").
const KNOWN_METHODS = [
  ALWAYS_AVAILABLE,
  'playwright_visual_regression',
  'security-review',
  'react-doctor',
  'api_response_check',
  'unit_test_run'
];
const RESULTS = ['pass', 'fail'];

// Resolve the leaf's verification spec with r3 §5.6 defaults.
function verifySpec(node) {
  const c = leafContract(node);
  const v = c.verify || {};
  return {
    method: typeof v.method === 'string' && v.method ? v.method : ALWAYS_AVAILABLE,
    fallback: typeof v.fallback === 'string' && v.fallback ? v.fallback : ALWAYS_AVAILABLE,
    review_required: v.review_required === false ? false : true,
    success: c.success
  };
}

// ---------------------------------------------------------------------------
// PLAN mode
// ---------------------------------------------------------------------------
function buildVerifyPlan(rootDir, leafId, opts) {
  const opened = openState(rootDir);
  if (!opened.ok) {
    return { ok: false, status: STATUS, reason: opened.reason, text: opened.text };
  }
  if (typeof leafId !== 'string' || leafId.trim() === '') {
    return { ok: false, status: STATUS, reason: 'missing-ref', text: 'LEAF VERIFY requires a leaf id (e.g. /ovd-go verify II.2.a).' };
  }
  const node = findLeaf(opened.parsed.tree, leafId);
  if (!node) {
    return { ok: false, status: STATUS, reason: 'leaf-not-found', text: `No node with id "${leafId}". Run /ovd-go to orient or /ovd-plan display for the tree.` };
  }
  if (!isLeaf(node)) {
    return { ok: false, status: STATUS, reason: 'not-a-leaf', text: `${node.id} is a container. LEAF VERIFY targets leaves; cluster verification aggregates child results during recursive close (Task 4.6 / /ovd-go).` };
  }

  const spec = verifySpec(node);
  const methodKnown = KNOWN_METHODS.includes(spec.method);
  const lines = [];
  lines.push(`LEAF VERIFY — ${node.id} ${node.title || ''}`.trimEnd());
  lines.push('');
  lines.push(`Method: ${spec.method}${methodKnown ? '' : ' (non-standard — run it or fall back)'}`);
  lines.push(`Fallback: ${spec.fallback}`);
  lines.push(`review_required: ${spec.review_required}`);
  lines.push('');
  lines.push('Success criteria:');
  if (spec.success.length) spec.success.forEach((s, i) => lines.push(`  [${i}] ${s}`));
  else lines.push('  (none specified — self-check against the leaf description)');
  lines.push('');
  lines.push('Instructions:');
  lines.push(`  Run ${spec.method}. If its tool/skill is unavailable in this runtime, fall back to`);
  lines.push(`  ${spec.fallback} and set fallback_used:true (Q4.2 — transparent fallback, never fail hard).`);
  lines.push('  Return pass/fail with structured findings.');
  lines.push('');
  lines.push('Callback:');
  lines.push(`  overdrive go verify ${node.id} --entries-json '{"leaf_id":"${node.id}","result":"pass","method_used":"${spec.method}","findings":[],"fallback_used":false}'`);

  return {
    ok: true,
    status: STATUS,
    mode: 'verify-plan',
    leaf_id: node.id,
    title: node.title || '',
    method: spec.method,
    fallback: spec.fallback,
    review_required: spec.review_required,
    methodKnown,
    success: spec.success,
    text: lines.join('\n')
  };
}

// ---------------------------------------------------------------------------
// COMMIT mode
// ---------------------------------------------------------------------------
function normalizeVerifyEntries(entries) {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return { ok: false, reason: 'invalid-entries', text: 'verify commit requires a JSON object.' };
  }
  if (typeof entries.leaf_id !== 'string' || entries.leaf_id.trim() === '') {
    return { ok: false, reason: 'missing-leaf-id', text: 'verify entries require a non-empty leaf_id.' };
  }
  if (!RESULTS.includes(entries.result)) {
    return { ok: false, reason: 'invalid-result', text: `result must be one of ${RESULTS.join(' / ')}.` };
  }
  const findings = Array.isArray(entries.findings) ? entries.findings.filter((f) => typeof f === 'string' && f) : [];
  return {
    ok: true,
    leaf_id: entries.leaf_id.trim(),
    result: entries.result,
    method_used: typeof entries.method_used === 'string' ? entries.method_used : null,
    findings,
    fallback_used: entries.fallback_used === true
  };
}

function applyVerifyResult(rootDir, entries, opts) {
  const norm = normalizeVerifyEntries(entries);
  if (!norm.ok) {
    return { ok: false, status: STATUS, mode: 'commit', reason: norm.reason, text: norm.text };
  }
  const opened = openState(rootDir);
  if (!opened.ok) {
    return { ok: false, status: STATUS, mode: 'commit', reason: opened.reason, text: opened.text };
  }
  const node = findLeaf(opened.parsed.tree, norm.leaf_id);
  if (!node) {
    return { ok: false, status: STATUS, mode: 'commit', reason: 'leaf-not-found', text: `No node with id "${norm.leaf_id}".` };
  }
  if (!isLeaf(node)) {
    return { ok: false, status: STATUS, mode: 'commit', reason: 'not-a-leaf', text: `${node.id} is a container, not a leaf.` };
  }
  const spec = verifySpec(node);

  // Persist the verify report to a session capture file (report-only; no status
  // mutation — AWAITING REVIEW / FIX own transitions).
  const now = (opts && opts.now) || new Date().toISOString();
  const safeId = node.id.replace(/[^A-Za-z0-9.]/g, '-');
  const fileName = `${isoToFilenameSafe(now)}-verify-${safeId}.md`;
  const dir = path.join(rootDir, SESSIONS_REL);
  const rec = [
    `# LEAF VERIFY — ${node.id} ${node.title || ''}`.trimEnd(),
    '',
    `- timestamp: ${now}`,
    `- result: ${norm.result}`,
    `- method_used: ${norm.method_used || spec.method}`,
    `- fallback_used: ${norm.fallback_used}`,
    `- review_required: ${spec.review_required}`
  ];
  if (norm.findings.length) {
    rec.push('- findings:');
    norm.findings.forEach((f) => rec.push(`  - ${f}`));
  }
  rec.push('');
  let sessionFile = null;
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, fileName), rec.join('\n'));
    sessionFile = path.join(SESSIONS_REL, fileName);
  } catch (err) {
    sessionFile = null;
  }

  const out = [];
  const fallbackNote = norm.fallback_used ? ` (fallback: ${spec.fallback})` : '';
  if (norm.result === 'pass') {
    out.push(`${node.id} — verification PASSED (method: ${norm.method_used || spec.method})${fallbackNote}.`);
    if (norm.findings.length) { out.push(''); out.push('Findings:'); norm.findings.forEach((f) => out.push(`  - ${f}`)); }
    out.push('');
    out.push('Next:');
    if (spec.review_required) {
      out.push(`  (1) approved — mark ${node.id} done and advance (AWAITING REVIEW).`);
    } else {
      out.push(`  (1) approved — review_required:false, ${node.id} may auto-advance.`);
    }
    out.push(`  (2) /ovd-go verify ${node.id} — re-verify.`);
    out.push('  (3) Other — describe what you want.');
  } else {
    out.push(`${node.id} — verification FAILED (method: ${norm.method_used || spec.method})${fallbackNote}.`);
    if (norm.findings.length) { out.push(''); out.push('Findings:'); norm.findings.forEach((f) => out.push(`  - ${f}`)); }
    out.push('');
    out.push('Next (r3 §6.9):');
    out.push('  (1) fix — attempt a targeted fix and re-verify (cap: 2 attempts).');
    out.push('  (2) replan — route to /ovd-plan edit; this leaf needs a rethink.');
    out.push(`  (3) skip — mark ${node.id} blocked and advance.`);
    out.push('  (4) Other — describe what you want.');
  }

  return {
    ok: true,
    status: STATUS,
    mode: 'verify-commit',
    leaf_id: node.id,
    result: norm.result,
    method_used: norm.method_used || spec.method,
    fallback_used: norm.fallback_used,
    review_required: spec.review_required,
    findings: norm.findings,
    session_file: sessionFile,
    text: out.join('\n')
  };
}

function runVerify(rootDir, opts = {}) {
  if (!rootDir || typeof rootDir !== 'string') {
    return { ok: false, status: STATUS, reason: 'invalid-project-dir', text: 'runVerify requires a project directory string.' };
  }
  const mode = opts.mode || (opts.entries ? 'commit' : 'plan');
  if (mode === 'commit') {
    return applyVerifyResult(rootDir, opts.entries, opts);
  }
  return buildVerifyPlan(rootDir, opts.leafId || opts.ref || null, opts);
}

module.exports = {
  STATUS,
  SESSIONS_REL,
  ALWAYS_AVAILABLE,
  KNOWN_METHODS,
  RESULTS,
  verifySpec,
  buildVerifyPlan,
  normalizeVerifyEntries,
  applyVerifyResult,
  runVerify
};
