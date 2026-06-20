'use strict';

const { appendDecision } = require('./decisions-log');

// ---------------------------------------------------------------------------
// Task 4.10 — DECISION POINT (r3 §6.3, §6.4; Q4.9).
//
// When ambiguity surfaces mid-leaf (out-of-scope file needed, ambiguous spec,
// missing dependency, contract conflict), execution pauses and the agent surfaces
// a decision: the ambiguity + a RECOMMENDED option with reasoning + alternatives
// + a describe-other escape (Pattern 7 — options are never presented as equal;
// there is always a recommendation). The CLI enforces that discipline (a payload
// without a `recommended` option is rejected).
//
// DECISION POINT does NOT mutate the tree — it is a render + a decisions.md log
// append. SURFACE renders the agent's payload (Pattern 1 — the agent has the
// execution context the CLI lacks). RESOLVE records the user's choice via the
// canonical appendDecision (Pattern 2/6), embedding the kind tag so Phase 5
// LEARNINGS EXTRACT can aggregate common decision-point patterns (Q4.9).
// ---------------------------------------------------------------------------

const STATUS = 'go';
const KINDS = ['scope-overflow', 'ambiguous-spec', 'missing-dependency', 'contract-conflict', 'other'];

function renderDecisionPrompt(payload) {
  const lines = [];
  lines.push(`DECISION POINT — ${payload.leaf_id} [${payload.kind}]`);
  lines.push('');
  lines.push(payload.ambiguity);
  lines.push('');
  lines.push(`  (1) ${payload.recommended.label} — ${payload.recommended.reasoning}  [recommended]`);
  let n = 2;
  for (const alt of payload.alternatives) {
    lines.push(`  (${n}) ${alt.label}`);
    n += 1;
  }
  lines.push(`  (${n}) other — describe what you want.`);
  lines.push('');
  lines.push('Reply with a number or describe.');
  return lines.join('\n');
}

// Validate the SURFACE payload. recommended.{label,reasoning} is REQUIRED
// (Pattern 7 — there must always be a recommendation with reasoning).
function normalizeDecisionPayload(entries) {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return { ok: false, reason: 'invalid-entries', text: 'decision surface requires a JSON object.' };
  }
  if (typeof entries.leaf_id !== 'string' || entries.leaf_id.trim() === '') {
    return { ok: false, reason: 'missing-leaf-id', text: 'decision entries require a non-empty leaf_id.' };
  }
  if (!KINDS.includes(entries.kind)) {
    return { ok: false, reason: 'invalid-kind', text: `kind must be one of ${KINDS.join(' / ')}.` };
  }
  if (typeof entries.ambiguity !== 'string' || entries.ambiguity.trim() === '') {
    return { ok: false, reason: 'missing-ambiguity', text: 'decision entries require a non-empty ambiguity description.' };
  }
  const rec = entries.recommended;
  if (!rec || typeof rec !== 'object' || typeof rec.label !== 'string' || !rec.label.trim() || typeof rec.reasoning !== 'string' || !rec.reasoning.trim()) {
    return { ok: false, reason: 'missing-recommended', text: 'decision entries require a recommended option with { label, reasoning } (Pattern 7 — never present options as equal).' };
  }
  const alternatives = Array.isArray(entries.alternatives)
    ? entries.alternatives.filter((a) => a && typeof a === 'object' && typeof a.label === 'string' && a.label.trim()).map((a) => ({ label: a.label.trim() }))
    : [];
  return {
    ok: true,
    leaf_id: entries.leaf_id.trim(),
    kind: entries.kind,
    ambiguity: entries.ambiguity.trim(),
    recommended: { label: rec.label.trim(), reasoning: rec.reasoning.trim() },
    alternatives
  };
}

// SURFACE — render the standardized decision prompt (pure; no tree read/write).
function surfaceDecisionPoint(entries) {
  const norm = normalizeDecisionPayload(entries);
  if (!norm.ok) return { ok: false, status: STATUS, mode: 'surface', reason: norm.reason, text: norm.text };
  return {
    ok: true,
    status: STATUS,
    mode: 'decision-surface',
    leaf_id: norm.leaf_id,
    kind: norm.kind,
    option_count: norm.alternatives.length + 2,
    text: renderDecisionPrompt(norm)
  };
}

// RESOLVE — record the user's choice to decisions.md (kind tag → LEARNINGS).
function normalizeResolution(entries) {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return { ok: false, reason: 'invalid-entries', text: 'decision resolve requires a JSON object.' };
  }
  if (typeof entries.leaf_id !== 'string' || entries.leaf_id.trim() === '') {
    return { ok: false, reason: 'missing-leaf-id', text: 'decision resolve requires a non-empty leaf_id.' };
  }
  if (!KINDS.includes(entries.kind)) {
    return { ok: false, reason: 'invalid-kind', text: `kind must be one of ${KINDS.join(' / ')}.` };
  }
  if (typeof entries.chosen !== 'string' || entries.chosen.trim() === '') {
    return { ok: false, reason: 'missing-chosen', text: 'decision resolve requires a non-empty chosen option.' };
  }
  return {
    ok: true,
    leaf_id: entries.leaf_id.trim(),
    kind: entries.kind,
    chosen: entries.chosen.trim(),
    rationale: typeof entries.rationale === 'string' ? entries.rationale.trim() : ''
  };
}

function resolveDecisionPoint(rootDir, entries, opts) {
  const norm = normalizeResolution(entries);
  if (!norm.ok) return { ok: false, status: STATUS, mode: 'resolve', reason: norm.reason, text: norm.text };
  const now = (opts && opts.now) || new Date().toISOString();
  const date = now.slice(0, 10);
  const result = appendDecision(rootDir, {
    date,
    node: norm.leaf_id,
    decision: `DECISION POINT [${norm.kind}]: ${norm.chosen}`,
    rationale: norm.rationale
  });
  if (!result || result.ok === false) {
    return { ok: false, status: STATUS, mode: 'resolve', reason: (result && result.reason) || 'decision-log-error', text: (result && result.text) || 'Could not append the decision.' };
  }
  return {
    ok: true,
    status: STATUS,
    mode: 'decision-resolve',
    leaf_id: norm.leaf_id,
    kind: norm.kind,
    chosen: norm.chosen,
    text: [
      `Recorded DECISION POINT [${norm.kind}] for ${norm.leaf_id}: ${norm.chosen}.`,
      '',
      `Resuming execution. Run /ovd-go execute ${norm.leaf_id} to continue with this decision applied.`
    ].join('\n')
  };
}

function runDecision(rootDir, opts = {}) {
  if (!rootDir || typeof rootDir !== 'string') {
    return { ok: false, status: STATUS, reason: 'invalid-project-dir', text: 'runDecision requires a project directory string.' };
  }
  const entries = opts.entries;
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return { ok: false, status: STATUS, reason: 'missing-entries', text: 'DECISION POINT requires --entries-json (surface payload or resolution).' };
  }
  // chosen present → RESOLVE; else → SURFACE.
  if (entries.chosen != null) return resolveDecisionPoint(rootDir, entries, opts);
  return surfaceDecisionPoint(entries);
}

module.exports = {
  STATUS,
  KINDS,
  renderDecisionPrompt,
  normalizeDecisionPayload,
  surfaceDecisionPoint,
  normalizeResolution,
  resolveDecisionPoint,
  runDecision
};
