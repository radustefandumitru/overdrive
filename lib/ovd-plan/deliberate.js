'use strict';

const {
  openState,
  commitState,
  readDeliberationState
} = require('./deliberation-state');
const { readCalibration } = require('./calibrate');

const STAGES = ['elicit', 'spec', 'blind_spot', 'plan', 'present', 'commit', 'committed'];
const STAGE_SET = new Set(STAGES);

const STATE_KEYS = [
  'calibration',
  'stage',
  'turn_count',
  'answered_questions',
  'open_threads',
  'proposed_tree',
  'blind_spot_inserted',
  'current_proposal_revision',
  'last_action'
];

const LEAF_REQUIRED_FIELDS = ['id', 'title', 'description', 'scope', 'success', 'verify', 'deps'];

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

function currentStage(innerObj) {
  if (!innerObj || !innerObj.stage) return 'elicit';
  if (!STAGE_SET.has(innerObj.stage)) return 'elicit';
  return innerObj.stage;
}

function currentTurn(innerObj) {
  if (!innerObj || typeof innerObj.turn_count !== 'number') return 0;
  return innerObj.turn_count;
}

function lastQuestion(innerObj) {
  if (!innerObj || !Array.isArray(innerObj.answered_questions) || innerObj.answered_questions.length === 0) {
    return null;
  }
  const last = innerObj.answered_questions[innerObj.answered_questions.length - 1];
  return last && last.question ? last.question : null;
}

function openThreads(innerObj) {
  if (!innerObj || !Array.isArray(innerObj.open_threads)) return [];
  return innerObj.open_threads.slice();
}

function proposedTree(innerObj) {
  if (!innerObj || !innerObj.proposed_tree) return null;
  return innerObj.proposed_tree;
}

function nowIso(opts) {
  return (opts && opts.now) || new Date().toISOString();
}

function reorderInner(innerObj) {
  const out = {};
  for (const key of STATE_KEYS) {
    if (key in innerObj) out[key] = innerObj[key];
  }
  for (const key of Object.keys(innerObj)) {
    if (!(key in out)) out[key] = innerObj[key];
  }
  return out;
}

function envelope(status, payload) {
  return Object.assign({ status }, payload);
}

// ---------------------------------------------------------------------------
// Stage 2 — Elicit
// ---------------------------------------------------------------------------

function buildElicitTurn(rootDir, opts = {}) {
  const opened = openState(rootDir);
  if (!opened.ok) {
    return envelope('deliberate', {
      ok: false,
      reason: opened.reason,
      text: opened.text
    });
  }
  const inner = opened.innerObj;
  const calibration = (inner && inner.calibration) || readCalibration(rootDir) || null;
  const turn = currentTurn(inner);
  const last = lastQuestion(inner);
  const threads = openThreads(inner);
  const lines = [];
  lines.push('Stage 2 — Elicit (one high-leverage question per turn)');
  lines.push('======================================================');
  lines.push('');
  lines.push(`Turn: ${turn + 1}`);
  if (!calibration) {
    lines.push('');
    lines.push('Calibration: NONE recorded yet.');
    lines.push('');
    lines.push('Action paths (pick one before continuing):');
    lines.push('  (1) Run /ovd-plan calibrate first to set domain / technical / scope axes (recommended).');
    lines.push('  (2) Proceed without calibration — questions will default to medium across all axes.');
    lines.push('  (3) Describe other (or describe what you want).');
  } else {
    lines.push('');
    lines.push('Calibration:');
    if (calibration.domain) lines.push(`  domain:    ${calibration.domain}`);
    if (calibration.technical) lines.push(`  technical: ${calibration.technical}`);
    if (calibration.scope) lines.push(`  scope:     ${calibration.scope}`);
    if (calibration.override) lines.push(`  override:  ${calibration.override}`);
  }
  lines.push('');
  if (last) {
    lines.push(`Last question: ${last}`);
  } else {
    lines.push('Last question: (none — this is the first elicit turn)');
  }
  lines.push('');
  if (threads.length > 0) {
    lines.push('Open threads (user-mentioned topics not yet asked about):');
    for (const t of threads) lines.push(`  - ${t}`);
  } else {
    lines.push('Open threads: (none)');
  }
  lines.push('');
  lines.push('Instructions for the agent:');
  lines.push('  - Ask ONE high-leverage question. Pick from open_threads if present, otherwise from your conversation memory.');
  lines.push('  - Match question depth to the calibration. domain=low keeps the question concrete; scope=high allows broader framing.');
  lines.push('  - Surface tradeoffs proactively when stakes are high ("X gets you Y but loses Z. Which matters more?").');
  lines.push('  - Per Q1 stopping rule: do NOT ask a question whose answer is not load-bearing for any future leaf contract.');
  lines.push('  - When you are confident the spec is ready (Q1 stopping rule satisfied), commit with transition: "spec".');
  lines.push('');
  lines.push('Commit syntax (after the user answers):');
  lines.push('  overdrive plan deliberate --entries-json \'{"answer":"<verbatim user reply>","turn_id":' + (turn + 1) + ',"classification":{"followup_questions":[],"branch_signal":null},"transition":null}\'');
  lines.push('');
  lines.push('To advance to Stage 4 (Spec), set "transition":"spec" on commit.');
  return envelope('deliberate', {
    ok: true,
    mode: 'plan',
    stage: 'elicit',
    turn: turn + 1,
    calibration,
    lastQuestion: last,
    openThreads: threads,
    expectedPayload: { answer: 'string', turn_id: 'number', classification: { followup_questions: 'string[]', branch_signal: 'string|null' }, transition: 'null|"spec"' },
    text: lines.join('\n')
  });
}

function applyElicitTurn(rootDir, entries, opts = {}) {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return envelope('deliberate', {
      ok: false,
      reason: 'invalid-shape',
      text: 'Elicit commit requires a JSON object with at least { answer, turn_id }.'
    });
  }
  if (typeof entries.answer !== 'string' || !entries.answer.trim()) {
    return envelope('deliberate', {
      ok: false,
      reason: 'missing-answer',
      text: 'Elicit commit requires entries.answer (string).'
    });
  }
  if (typeof entries.turn_id !== 'number' || !Number.isInteger(entries.turn_id)) {
    return envelope('deliberate', {
      ok: false,
      reason: 'missing-turn-id',
      text: 'Elicit commit requires entries.turn_id (integer).'
    });
  }
  if (entries.transition !== undefined && entries.transition !== null && entries.transition !== 'spec') {
    return envelope('deliberate', {
      ok: false,
      reason: 'invalid-transition',
      text: 'Elicit transition must be null or "spec".'
    });
  }
  const opened = openState(rootDir);
  if (!opened.ok) {
    return envelope('deliberate', { ok: false, reason: opened.reason, text: opened.text });
  }
  const stage = currentStage(opened.innerObj);
  if (stage !== 'elicit') {
    return envelope('deliberate', {
      ok: false,
      reason: 'stage-mismatch',
      text: `Cannot apply elicit-turn while stage is "${stage}".`
    });
  }
  const now = nowIso(opts);
  const inner = opened.innerObj;
  const turnCount = currentTurn(inner);
  if (entries.turn_id !== turnCount + 1) {
    return envelope('deliberate', {
      ok: false,
      reason: 'turn-id-mismatch',
      text: `Expected turn_id ${turnCount + 1}, got ${entries.turn_id}.`
    });
  }
  // Apply mutations
  inner.stage = entries.transition === 'spec' ? 'spec' : 'elicit';
  inner.turn_count = turnCount + 1;
  if (!Array.isArray(inner.answered_questions)) inner.answered_questions = [];
  const last = lastQuestion(inner);
  inner.answered_questions.push({
    turn_id: entries.turn_id,
    question: last || '(initial elicit — no prior question)',
    answer: entries.answer,
    stage_at_turn: 'elicit',
    timestamp: now,
    classification: entries.classification || null
  });
  // Open threads: append followup_questions, drop the one that was just asked if recognised
  if (!Array.isArray(inner.open_threads)) inner.open_threads = [];
  if (entries.classification && Array.isArray(entries.classification.followup_questions)) {
    for (const q of entries.classification.followup_questions) {
      if (typeof q === 'string' && q.trim()) inner.open_threads.push(q.trim());
    }
  }
  inner.last_action = now;
  opened.innerObj = reorderInner(inner);
  const committed = commitState(rootDir, opened);
  if (!committed.ok) {
    return envelope('deliberate', { ok: false, reason: committed.reason, text: committed.text });
  }
  return envelope('deliberate', {
    ok: true,
    mode: 'commit',
    stage: inner.stage,
    turn_count: inner.turn_count,
    transitioned: entries.transition === 'spec',
    text: entries.transition === 'spec'
      ? `Answer recorded (turn ${entries.turn_id}). Transitioning to Stage 4 (Spec).`
      : `Answer recorded (turn ${entries.turn_id}). Continue with another /ovd-plan deliberate turn.`
  });
}

// ---------------------------------------------------------------------------
// Stage 4 — Spec
// ---------------------------------------------------------------------------

function buildSpecTurn(rootDir, opts = {}) {
  const opened = openState(rootDir);
  if (!opened.ok) {
    return envelope('deliberate', { ok: false, reason: opened.reason, text: opened.text });
  }
  const inner = opened.innerObj;
  const answers = Array.isArray(inner.answered_questions) ? inner.answered_questions : [];
  const lines = [];
  lines.push('Stage 4 — Spec (ambiguity scoring per milestone)');
  lines.push('================================================');
  lines.push('');
  lines.push(`Elicit turns consumed: ${answers.length}`);
  if (answers.length > 0) {
    lines.push('Summary of answers:');
    for (const a of answers) {
      lines.push(`  - Q${a.turn_id}: ${a.question}`);
      lines.push(`    A: ${a.answer}`);
    }
  }
  lines.push('');
  lines.push('Instructions for the agent:');
  lines.push('  - Draft the milestone-level scope based on the accumulated answers.');
  lines.push('  - For each milestone, score ambiguity 1-5:');
  lines.push('      1 = unambiguous + atomic;');
  lines.push('      2 = mostly clear, one interpretation drift point;');
  lines.push('      3 = several interpretation paths but unambiguous goal;');
  lines.push('      4 = goal underspecified;');
  lines.push('      5 = blocks further planning — needs more Stage 2 elicit.');
  lines.push('  - If any milestone scores > 3, surface to the user before committing.');
  lines.push('  - Use hierarchical IDs (per Q10): milestones are uppercase Roman (I, II, III, ...).');
  lines.push('');
  lines.push('Commit syntax:');
  lines.push('  overdrive plan deliberate --entries-json \'{"milestones":[{"id":"I","title":"Foundation","description":"...","ambiguity_score":2}]}\'');
  lines.push('');
  lines.push('Set "transition":"blind_spot" to advance to Stage 3 (Blind-spot expansion); omit to iterate Spec (e.g. re-elicit on high-ambiguity milestones).');
  return envelope('deliberate', {
    ok: true,
    mode: 'plan',
    stage: 'spec',
    answeredQuestions: answers,
    expectedPayload: { milestones: 'array', transition: 'null|"blind_spot"' },
    text: lines.join('\n')
  });
}

function applySpecTurn(rootDir, entries, opts = {}) {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return envelope('deliberate', { ok: false, reason: 'invalid-shape', text: 'Spec commit requires a JSON object with milestones[].' });
  }
  if (!Array.isArray(entries.milestones) || entries.milestones.length === 0) {
    return envelope('deliberate', { ok: false, reason: 'no-milestones', text: 'Spec commit requires non-empty milestones[].' });
  }
  if (entries.transition !== undefined && entries.transition !== null && entries.transition !== 'blind_spot') {
    return envelope('deliberate', { ok: false, reason: 'invalid-transition', text: 'Spec transition must be null or "blind_spot".' });
  }
  const validated = [];
  const highAmbiguity = [];
  for (let i = 0; i < entries.milestones.length; i += 1) {
    const m = entries.milestones[i];
    if (!m || typeof m !== 'object') {
      return envelope('deliberate', { ok: false, reason: 'invalid-milestone', text: `Milestone at index ${i} must be an object.` });
    }
    if (typeof m.id !== 'string' || !m.id.trim()) {
      return envelope('deliberate', { ok: false, reason: 'invalid-milestone', text: `Milestone at index ${i} requires id (string).` });
    }
    if (typeof m.title !== 'string' || !m.title.trim()) {
      return envelope('deliberate', { ok: false, reason: 'invalid-milestone', text: `Milestone ${m.id} requires title (string).` });
    }
    if (typeof m.description !== 'string' || !m.description.trim()) {
      return envelope('deliberate', { ok: false, reason: 'invalid-milestone', text: `Milestone ${m.id} requires description (string).` });
    }
    if (typeof m.ambiguity_score !== 'number' || !Number.isInteger(m.ambiguity_score) || m.ambiguity_score < 1 || m.ambiguity_score > 5) {
      return envelope('deliberate', { ok: false, reason: 'invalid-ambiguity-score', text: `Milestone ${m.id} requires ambiguity_score (integer 1-5).` });
    }
    if (m.ambiguity_score > 3) highAmbiguity.push(m.id);
    validated.push({ id: m.id, title: m.title, description: m.description, ambiguity_score: m.ambiguity_score, children: [] });
  }
  const opened = openState(rootDir);
  if (!opened.ok) {
    return envelope('deliberate', { ok: false, reason: opened.reason, text: opened.text });
  }
  const stage = currentStage(opened.innerObj);
  if (stage !== 'spec') {
    return envelope('deliberate', { ok: false, reason: 'stage-mismatch', text: `Cannot apply spec-turn while stage is "${stage}".` });
  }
  const now = nowIso(opts);
  const inner = opened.innerObj;
  inner.stage = entries.transition === 'blind_spot' ? 'blind_spot' : 'spec';
  inner.proposed_tree = { milestones: validated, last_revision: 1 };
  inner.current_proposal_revision = 1;
  inner.last_action = now;
  opened.innerObj = reorderInner(inner);
  const committed = commitState(rootDir, opened);
  if (!committed.ok) {
    return envelope('deliberate', { ok: false, reason: committed.reason, text: committed.text });
  }
  const warnLines = [];
  if (highAmbiguity.length > 0) {
    warnLines.push('');
    warnLines.push(`Warning: milestones with ambiguity_score > 3: ${highAmbiguity.join(', ')}`);
    warnLines.push('Action paths:');
    warnLines.push('  (1) Re-elicit on the high-ambiguity milestones (stay in Spec).');
    warnLines.push('  (2) Accept and proceed to Stage 5 (Plan).');
    warnLines.push('  (3) Describe other (or describe what you want).');
  }
  return envelope('deliberate', {
    ok: true,
    mode: 'commit',
    stage: inner.stage,
    transitioned: entries.transition === 'blind_spot',
    milestonesWritten: validated.length,
    highAmbiguity,
    text: `Spec recorded. ${validated.length} milestone(s) written to proposed_tree.${entries.transition === 'blind_spot' ? ' Transitioning to Stage 3 (Blind-spot expansion).' : ''}${warnLines.join('\n')}`
  });
}

// ---------------------------------------------------------------------------
// Stage 5 — Plan (partial; no RESOLVE SKILLS — Slice B)
// ---------------------------------------------------------------------------

function buildPlanTurn(rootDir, opts = {}) {
  const opened = openState(rootDir);
  if (!opened.ok) {
    return envelope('deliberate', { ok: false, reason: opened.reason, text: opened.text });
  }
  const inner = opened.innerObj;
  const tree = proposedTree(inner);
  if (!tree || !Array.isArray(tree.milestones)) {
    return envelope('deliberate', { ok: false, reason: 'no-proposed-tree', text: 'Stage 5 requires a proposed_tree from Stage 4.' });
  }
  const pending = tree.milestones.filter((m) => !Array.isArray(m.children) || m.children.length === 0);
  const lines = [];
  lines.push('Stage 5 — Plan (per-leaf scope/success/deps/verify)');
  lines.push('===================================================');
  lines.push('');
  lines.push(`Milestones in proposed_tree: ${tree.milestones.length}`);
  lines.push(`Milestones still needing leaves: ${pending.length}`);
  for (const m of tree.milestones) {
    const leafCount = Array.isArray(m.children) ? m.children.length : 0;
    lines.push(`  - ${m.id} ${m.title} — ${leafCount} leaf(es)`);
  }
  lines.push('');
  lines.push('Instructions for the agent:');
  lines.push('  - For each milestone still pending, emit leaves with: id, title, description, scope.{in,out,read_only?}, success[], verify.{method,fallback,review_required}, deps[].');
  lines.push('  - Per Q3.3A.3 / Q3.3A.10: writer-canonical field names (scope.in, scope.out, success, verify, deps).');
  lines.push('  - Slice A does NOT resolve skills. The CLI writes placeholder skills:[] + confidence:"low" + pending_skill_resolution:true per leaf for Slice B to fill.');
  lines.push('  - Use hierarchical IDs: milestone I → leaves I.1, I.2; milestone II → leaves II.1, II.2; nested leaves use I.1.a, I.1.b.');
  lines.push('  - Per Q1 stopping rule: each leaf must be executable by a competent agent reading only the leaf spec + (Slice B-resolved) skills + scoped codebase files.');
  lines.push('');
  lines.push('Commit syntax (per-milestone — repeat for each):');
  lines.push('  overdrive plan deliberate --entries-json \'{"milestone_id":"I","leaves":[{"id":"I.1","title":"...","description":"...","scope":{"in":["src/auth/"],"out":["src/admin/"]},"success":["criterion 1"],"verify":{"method":"vitest","fallback":"agent_self_check_against_success","review_required":true},"deps":[]}]}\'');
  lines.push('');
  lines.push('Set "transition":"present" on the final commit (when all milestones have leaves) to advance to Stage 7.');
  return envelope('deliberate', {
    ok: true,
    mode: 'plan',
    stage: 'plan',
    milestones: tree.milestones.map((m) => ({ id: m.id, title: m.title, leafCount: Array.isArray(m.children) ? m.children.length : 0 })),
    pendingMilestoneIds: pending.map((m) => m.id),
    expectedPayload: { milestone_id: 'string', leaves: 'array', transition: 'null|"present"' },
    text: lines.join('\n')
  });
}

function validateLeaf(leaf, milestoneId, index) {
  if (!leaf || typeof leaf !== 'object' || Array.isArray(leaf)) {
    return `Leaf at index ${index} of milestone ${milestoneId} must be an object.`;
  }
  for (const field of LEAF_REQUIRED_FIELDS) {
    if (leaf[field] === undefined) {
      return `Leaf at index ${index} of milestone ${milestoneId} missing required field: ${field}.`;
    }
  }
  if (typeof leaf.id !== 'string' || !leaf.id.trim()) {
    return `Leaf at index ${index} of milestone ${milestoneId} requires id (string).`;
  }
  if (typeof leaf.title !== 'string' || !leaf.title.trim()) {
    return `Leaf ${leaf.id} requires title (string).`;
  }
  if (typeof leaf.description !== 'string' || !leaf.description.trim()) {
    return `Leaf ${leaf.id} requires description (string).`;
  }
  if (!leaf.scope || typeof leaf.scope !== 'object' || Array.isArray(leaf.scope)) {
    return `Leaf ${leaf.id} requires scope (object).`;
  }
  if (!Array.isArray(leaf.scope.in)) return `Leaf ${leaf.id} requires scope.in (array).`;
  if (!Array.isArray(leaf.scope.out)) return `Leaf ${leaf.id} requires scope.out (array).`;
  if (leaf.scope.read_only !== undefined && !Array.isArray(leaf.scope.read_only)) {
    return `Leaf ${leaf.id} scope.read_only must be an array when present.`;
  }
  if (!Array.isArray(leaf.success) || leaf.success.length === 0) {
    return `Leaf ${leaf.id} requires success (non-empty array of criterion strings).`;
  }
  if (!leaf.verify || typeof leaf.verify !== 'object' || Array.isArray(leaf.verify)) {
    return `Leaf ${leaf.id} requires verify (object).`;
  }
  if (typeof leaf.verify.method !== 'string' || !leaf.verify.method.trim()) {
    return `Leaf ${leaf.id} requires verify.method (string).`;
  }
  if (typeof leaf.verify.fallback !== 'string' || !leaf.verify.fallback.trim()) {
    return `Leaf ${leaf.id} requires verify.fallback (string).`;
  }
  if (typeof leaf.verify.review_required !== 'boolean') {
    return `Leaf ${leaf.id} requires verify.review_required (boolean).`;
  }
  if (!Array.isArray(leaf.deps)) return `Leaf ${leaf.id} requires deps (array).`;
  return null;
}

function applyPlanTurn(rootDir, entries, opts = {}) {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return envelope('deliberate', { ok: false, reason: 'invalid-shape', text: 'Plan commit requires a JSON object with { milestone_id, leaves }.' });
  }
  if (typeof entries.milestone_id !== 'string' || !entries.milestone_id.trim()) {
    return envelope('deliberate', { ok: false, reason: 'missing-milestone-id', text: 'Plan commit requires entries.milestone_id (string).' });
  }
  if (!Array.isArray(entries.leaves) || entries.leaves.length === 0) {
    return envelope('deliberate', { ok: false, reason: 'no-leaves', text: 'Plan commit requires non-empty leaves[].' });
  }
  if (entries.transition !== undefined && entries.transition !== null && entries.transition !== 'present') {
    return envelope('deliberate', { ok: false, reason: 'invalid-transition', text: 'Plan transition must be null or "present".' });
  }
  for (let i = 0; i < entries.leaves.length; i += 1) {
    const err = validateLeaf(entries.leaves[i], entries.milestone_id, i);
    if (err) return envelope('deliberate', { ok: false, reason: 'invalid-leaf', text: err });
  }
  const opened = openState(rootDir);
  if (!opened.ok) {
    return envelope('deliberate', { ok: false, reason: opened.reason, text: opened.text });
  }
  const stage = currentStage(opened.innerObj);
  if (stage !== 'plan') {
    return envelope('deliberate', { ok: false, reason: 'stage-mismatch', text: `Cannot apply plan-turn while stage is "${stage}".` });
  }
  const inner = opened.innerObj;
  const tree = proposedTree(inner);
  if (!tree || !Array.isArray(tree.milestones)) {
    return envelope('deliberate', { ok: false, reason: 'no-proposed-tree', text: 'Stage 5 requires a proposed_tree from Stage 4.' });
  }
  const target = tree.milestones.find((m) => m.id === entries.milestone_id);
  if (!target) {
    return envelope('deliberate', { ok: false, reason: 'unknown-milestone', text: `Milestone ${entries.milestone_id} not found in proposed_tree.` });
  }
  // Stage 5 Slice A: write leaves with placeholders for Slice B fill.
  const annotated = entries.leaves.map((leaf) => Object.assign({}, leaf, {
    skills: Array.isArray(leaf.skills) ? leaf.skills : [],
    confidence: typeof leaf.confidence === 'string' ? leaf.confidence : 'low',
    pending_skill_resolution: true
  }));
  // Per Task 3.4 spec resolution: preserve agent-inserted children (from blind-spot)
  // and append user-planned leaves. Agent-inserted children carry inserted_by:'agent'
  // at the top level of the proposed_tree node (annotations are built at Stage 8 commit).
  const blindSpotInserted = (target.children || []).filter((c) => c && c.inserted_by === 'agent');
  target.children = blindSpotInserted.concat(annotated);
  tree.last_revision = (tree.last_revision || 1) + 1;
  inner.current_proposal_revision = tree.last_revision;
  inner.stage = entries.transition === 'present' ? 'present' : 'plan';
  inner.last_action = nowIso(opts);
  opened.innerObj = reorderInner(inner);
  const committed = commitState(rootDir, opened);
  if (!committed.ok) {
    return envelope('deliberate', { ok: false, reason: committed.reason, text: committed.text });
  }
  const remaining = tree.milestones.filter((m) => !Array.isArray(m.children) || m.children.length === 0);
  return envelope('deliberate', {
    ok: true,
    mode: 'commit',
    stage: inner.stage,
    transitioned: entries.transition === 'present',
    milestoneId: entries.milestone_id,
    leavesWritten: annotated.length,
    milestonesRemaining: remaining.map((m) => m.id),
    text: `Plan recorded for milestone ${entries.milestone_id} (${annotated.length} leaf/leaves; pending_skill_resolution=true). ${remaining.length === 0 ? 'All milestones have leaves.' : `Remaining: ${remaining.map((m) => m.id).join(', ')}.`}${entries.transition === 'present' ? ' Transitioning to Stage 7 (Present + iterate).' : ''}`
  });
}

// ---------------------------------------------------------------------------
// Stage 7 — Present + iterate
// ---------------------------------------------------------------------------

function renderProposedTree(tree) {
  const lines = [];
  for (const m of tree.milestones) {
    lines.push(`  ${m.id}  ${m.title} (ambiguity=${m.ambiguity_score || 1})`);
    for (const leaf of (m.children || [])) {
      lines.push(`    ${leaf.id}  ${leaf.title}`);
    }
  }
  return lines.join('\n');
}

function buildPresentTurn(rootDir, opts = {}) {
  const opened = openState(rootDir);
  if (!opened.ok) {
    return envelope('deliberate', { ok: false, reason: opened.reason, text: opened.text });
  }
  const inner = opened.innerObj;
  const tree = proposedTree(inner);
  if (!tree || !Array.isArray(tree.milestones)) {
    return envelope('deliberate', { ok: false, reason: 'no-proposed-tree', text: 'Stage 7 requires a proposed_tree.' });
  }
  const rev = inner.current_proposal_revision || tree.last_revision || 1;
  const lines = [];
  lines.push('Stage 7 — Present + iterate');
  lines.push('===========================');
  lines.push('');
  lines.push(`Proposal revision: ${rev}`);
  lines.push('');
  lines.push('Proposed tree:');
  lines.push(renderProposedTree(tree));
  lines.push('');
  lines.push('Action paths:');
  lines.push('  (1) Approve — transition to Stage 8 (Commit), where final review happens before OVERDRIVE.md is written.');
  lines.push('  (2) Iterate — apply a scoped patch (rename / re-scope / delete a single node).');
  lines.push('  (3) Replace — full re-emit of one milestone (back to Stage 5 for that milestone).');
  lines.push('  (4) Describe other (or describe what you want).');
  lines.push('');
  lines.push('Commit syntax — approve:');
  lines.push('  overdrive plan deliberate --entries-json \'{"kind":"approve"}\'');
  lines.push('Commit syntax — patch:');
  lines.push('  overdrive plan deliberate --entries-json \'{"kind":"patch","target_id":"I.1","body":{"title":"New title","description":"..."}}\'');
  lines.push('Commit syntax — replace milestone:');
  lines.push('  overdrive plan deliberate --entries-json \'{"kind":"replace","target_id":"I","body":{"reset_children":true}}\' (then re-run Stage 5 plan for that milestone)');
  return envelope('deliberate', {
    ok: true,
    mode: 'plan',
    stage: 'present',
    revision: rev,
    proposedTree: tree,
    expectedPayload: { kind: '"approve"|"patch"|"replace"', target_id: 'string (for patch/replace)', body: 'object (for patch/replace)' },
    text: lines.join('\n')
  });
}

function findNodeById(tree, targetId) {
  for (const m of tree.milestones) {
    if (m.id === targetId) return { kind: 'milestone', node: m };
    if (Array.isArray(m.children)) {
      for (const leaf of m.children) {
        if (leaf.id === targetId) return { kind: 'leaf', node: leaf, milestone: m };
      }
    }
  }
  return null;
}

function applyPresentTurn(rootDir, entries, opts = {}) {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return envelope('deliberate', { ok: false, reason: 'invalid-shape', text: 'Present commit requires a JSON object with { kind, ... }.' });
  }
  const kind = entries.kind;
  if (kind !== 'approve' && kind !== 'patch' && kind !== 'replace') {
    return envelope('deliberate', { ok: false, reason: 'invalid-kind', text: 'Present commit kind must be one of approve / patch / replace.' });
  }
  const opened = openState(rootDir);
  if (!opened.ok) {
    return envelope('deliberate', { ok: false, reason: opened.reason, text: opened.text });
  }
  const stage = currentStage(opened.innerObj);
  if (stage !== 'present') {
    return envelope('deliberate', { ok: false, reason: 'stage-mismatch', text: `Cannot apply present-turn while stage is "${stage}".` });
  }
  const inner = opened.innerObj;
  const tree = proposedTree(inner);
  if (!tree || !Array.isArray(tree.milestones)) {
    return envelope('deliberate', { ok: false, reason: 'no-proposed-tree', text: 'Stage 7 requires a proposed_tree.' });
  }
  const now = nowIso(opts);
  if (kind === 'approve') {
    inner.stage = 'commit';
    inner.last_action = now;
    opened.innerObj = reorderInner(inner);
    const committed = commitState(rootDir, opened);
    if (!committed.ok) return envelope('deliberate', { ok: false, reason: committed.reason, text: committed.text });
    return envelope('deliberate', {
      ok: true, mode: 'commit', stage: 'commit', transitioned: true,
      text: 'Proposal approved. Transitioning to Stage 8 (Commit). Next /ovd-plan deliberate will show the final review.'
    });
  }
  if (typeof entries.target_id !== 'string' || !entries.target_id.trim()) {
    return envelope('deliberate', { ok: false, reason: 'missing-target-id', text: `${kind} requires entries.target_id (string).` });
  }
  const found = findNodeById(tree, entries.target_id);
  if (!found) {
    return envelope('deliberate', { ok: false, reason: 'unknown-target', text: `target_id ${entries.target_id} not found in proposed_tree.` });
  }
  if (!entries.body || typeof entries.body !== 'object' || Array.isArray(entries.body)) {
    return envelope('deliberate', { ok: false, reason: 'invalid-body', text: `${kind} requires entries.body (object).` });
  }
  if (kind === 'patch') {
    // Shallow merge body onto found.node; do not allow id rewrite via patch (use replace instead).
    if ('id' in entries.body && entries.body.id !== found.node.id) {
      return envelope('deliberate', { ok: false, reason: 'id-rewrite-forbidden', text: 'patch cannot rewrite id. Use replace.' });
    }
    Object.assign(found.node, entries.body);
  } else { // replace
    if (found.kind !== 'milestone') {
      return envelope('deliberate', { ok: false, reason: 'replace-leaf-forbidden', text: 'replace is only allowed on milestones (use patch on leaves).' });
    }
    if (entries.body.reset_children) {
      found.node.children = [];
      // Transition back to plan so the agent re-emits leaves for this milestone
      inner.stage = 'plan';
    }
    // Allow milestone-level field updates (title/description/ambiguity_score)
    for (const f of ['title', 'description', 'ambiguity_score']) {
      if (f in entries.body) found.node[f] = entries.body[f];
    }
  }
  tree.last_revision = (tree.last_revision || 1) + 1;
  inner.current_proposal_revision = tree.last_revision;
  inner.last_action = now;
  opened.innerObj = reorderInner(inner);
  const committed = commitState(rootDir, opened);
  if (!committed.ok) return envelope('deliberate', { ok: false, reason: committed.reason, text: committed.text });
  return envelope('deliberate', {
    ok: true, mode: 'commit', stage: inner.stage, transitioned: inner.stage !== 'present',
    revision: tree.last_revision,
    text: `${kind} applied to ${entries.target_id} (revision ${tree.last_revision}). ${inner.stage === 'plan' ? 'Replace reset children — re-run /ovd-plan deliberate to emit new leaves for the milestone.' : 'Run /ovd-plan deliberate again to re-render the proposed_tree.'}`
  });
}

// ---------------------------------------------------------------------------
// Stage 8 — Commit (final review + write tree to OVERDRIVE.md)
// ---------------------------------------------------------------------------

function buildCommitTurn(rootDir, opts = {}) {
  const opened = openState(rootDir);
  if (!opened.ok) {
    return envelope('deliberate', { ok: false, reason: opened.reason, text: opened.text });
  }
  const inner = opened.innerObj;
  const tree = proposedTree(inner);
  if (!tree || !Array.isArray(tree.milestones)) {
    return envelope('deliberate', { ok: false, reason: 'no-proposed-tree', text: 'Stage 8 requires a proposed_tree.' });
  }
  let totalLeaves = 0;
  for (const m of tree.milestones) {
    totalLeaves += Array.isArray(m.children) ? m.children.length : 0;
  }
  const lines = [];
  lines.push('Stage 8 — Commit (final review before writing OVERDRIVE.md tree)');
  lines.push('=================================================================');
  lines.push('');
  lines.push(`Proposal revision: ${inner.current_proposal_revision || tree.last_revision || 1}`);
  lines.push(`Milestones: ${tree.milestones.length}`);
  lines.push(`Leaves: ${totalLeaves}`);
  lines.push('');
  lines.push('Tree to be written:');
  lines.push(renderProposedTree(tree));
  lines.push('');
  lines.push('Note: leaves carry placeholder skills:[] + confidence:"low" + pending_skill_resolution:true. Slice B (RESOLVE SKILLS) will fill these.');
  lines.push('');
  lines.push('Action paths:');
  lines.push('  (1) Commit — write the tree to OVERDRIVE.md and mark deliberation as committed.');
  lines.push('  (2) Back — return to Stage 7 (Present) to iterate further.');
  lines.push('  (3) Describe other (or describe what you want).');
  lines.push('');
  lines.push('Commit syntax — commit:');
  lines.push('  overdrive plan deliberate --entries-json \'{"kind":"commit"}\'');
  lines.push('Commit syntax — back to Present:');
  lines.push('  overdrive plan deliberate --entries-json \'{"kind":"back"}\'');
  return envelope('deliberate', {
    ok: true, mode: 'plan', stage: 'commit',
    revision: inner.current_proposal_revision || tree.last_revision || 1,
    milestonesCount: tree.milestones.length,
    leavesCount: totalLeaves,
    expectedPayload: { kind: '"commit"|"back"' },
    text: lines.join('\n')
  });
}

function buildLeafAnnotations(leaf) {
  const ann = {};
  // Writer key order: inserted_by, inserted_reason, skills, confidence, rationale, considered, scope, success, deps, verify, references, cluster_verification.
  // Per r3 §10.4 + Task 3.4: inserted_by + inserted_reason are first-class annotation keys.
  // Per Q3.4.7 (purely additive): category + internal_analysis ride along as unknown keys
  // (writer.reorderObject appends unknown keys at end of dump in insertion order; round-trip preserved).
  if (leaf.inserted_by === 'agent') ann.inserted_by = 'agent';
  if (typeof leaf.inserted_reason === 'string') ann.inserted_reason = leaf.inserted_reason;
  ann.skills = Array.isArray(leaf.skills) ? leaf.skills : [];
  ann.confidence = typeof leaf.confidence === 'string' ? leaf.confidence : 'low';
  ann.scope = {
    in: Array.isArray(leaf.scope && leaf.scope.in) ? leaf.scope.in : [],
    out: Array.isArray(leaf.scope && leaf.scope.out) ? leaf.scope.out : []
  };
  if (leaf.scope && Array.isArray(leaf.scope.read_only)) ann.scope.read_only = leaf.scope.read_only;
  ann.success = Array.isArray(leaf.success) ? leaf.success : [];
  ann.deps = Array.isArray(leaf.deps) ? leaf.deps : [];
  ann.verify = {
    method: (leaf.verify && leaf.verify.method) || 'agent_self_check_against_success',
    fallback: (leaf.verify && leaf.verify.fallback) || 'agent_self_check_against_success',
    review_required: (leaf.verify && typeof leaf.verify.review_required === 'boolean') ? leaf.verify.review_required : true
  };
  if (leaf.pending_skill_resolution) ann.pending_skill_resolution = true;
  if (typeof leaf.category === 'string') ann.category = leaf.category;
  if (typeof leaf.internal_analysis === 'string') ann.internal_analysis = leaf.internal_analysis;
  return ann;
}

function buildMilestoneNode(milestone, depthRoot) {
  const milestoneDepth = depthRoot + 1;
  // Per r3 §10.4 + Task 3.4: blind-spot-inserted milestones carry inserted_by:'agent'
  // + inserted_reason in annotations. Unknown keys (category, internal_analysis) ride along.
  const annotations = {};
  if (milestone.inserted_by === 'agent') annotations.inserted_by = 'agent';
  if (typeof milestone.inserted_reason === 'string') annotations.inserted_reason = milestone.inserted_reason;
  if (typeof milestone.category === 'string') annotations.category = milestone.category;
  if (typeof milestone.internal_analysis === 'string') annotations.internal_analysis = milestone.internal_analysis;
  const node = {
    depth: milestoneDepth,
    id: milestone.id,
    title: milestone.title,
    description: milestone.description || '',
    status: 'pending',
    annotations,
    children: [],
    active: false
  };
  if (Array.isArray(milestone.children)) {
    for (const leaf of milestone.children) {
      node.children.push({
        depth: milestoneDepth + 1,
        id: leaf.id,
        title: leaf.title,
        description: leaf.description || '',
        status: 'pending',
        annotations: buildLeafAnnotations(leaf),
        children: [],
        active: false
      });
    }
  }
  return node;
}

function applyCommitTurn(rootDir, entries, opts = {}) {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return envelope('deliberate', { ok: false, reason: 'invalid-shape', text: 'Stage 8 commit requires a JSON object with { kind }.' });
  }
  if (entries.kind !== 'commit' && entries.kind !== 'back') {
    return envelope('deliberate', { ok: false, reason: 'invalid-kind', text: 'Stage 8 commit kind must be "commit" or "back".' });
  }
  const opened = openState(rootDir);
  if (!opened.ok) {
    return envelope('deliberate', { ok: false, reason: opened.reason, text: opened.text });
  }
  const stage = currentStage(opened.innerObj);
  if (stage !== 'commit') {
    return envelope('deliberate', { ok: false, reason: 'stage-mismatch', text: `Cannot apply commit-turn while stage is "${stage}".` });
  }
  const inner = opened.innerObj;
  const tree = proposedTree(inner);
  if (!tree || !Array.isArray(tree.milestones)) {
    return envelope('deliberate', { ok: false, reason: 'no-proposed-tree', text: 'Stage 8 requires a proposed_tree.' });
  }
  const now = nowIso(opts);
  if (entries.kind === 'back') {
    inner.stage = 'present';
    inner.last_action = now;
    opened.innerObj = reorderInner(inner);
    const committed = commitState(rootDir, opened);
    if (!committed.ok) return envelope('deliberate', { ok: false, reason: committed.reason, text: committed.text });
    return envelope('deliberate', {
      ok: true, mode: 'commit', stage: 'present', transitioned: true,
      text: 'Returned to Stage 7 (Present). Run /ovd-plan deliberate again to iterate.'
    });
  }
  // kind === 'commit': convert proposed_tree → parsed.tree.children, clear proposed_tree, set committed
  const rootTree = opened.parsed.tree;
  const rootDepth = (rootTree && rootTree.depth) || 1;
  rootTree.children = tree.milestones.map((m) => buildMilestoneNode(m, rootDepth));
  // Frontmatter: set current_milestone to the first milestone's id
  if (!opened.parsed.frontmatter || typeof opened.parsed.frontmatter !== 'object') {
    opened.parsed.frontmatter = {};
  }
  if (tree.milestones[0]) {
    opened.parsed.frontmatter.current_milestone = tree.milestones[0].id;
  }
  // Inner: clear proposed_tree, set stage='committed'
  delete inner.proposed_tree;
  inner.stage = 'committed';
  inner.last_action = now;
  opened.innerObj = reorderInner(inner);
  const committed = commitState(rootDir, opened);
  if (!committed.ok) return envelope('deliberate', { ok: false, reason: committed.reason, text: committed.text });
  return envelope('deliberate', {
    ok: true, mode: 'commit', stage: 'committed', transitioned: true,
    milestonesWritten: rootTree.children.length,
    text: `Tree written to OVERDRIVE.md (${rootTree.children.length} milestone(s)). Deliberation committed. Next: /ovd-plan display to view, /ovd-go to start execution, or /ovd-plan edit to modify.`
  });
}

// ---------------------------------------------------------------------------
// Top-level orchestrator
// ---------------------------------------------------------------------------

function runDeliberate(rootDir, opts = {}) {
  const innerObj = readDeliberationState(rootDir) || {};
  const stage = currentStage(innerObj);
  const isCommit = opts.mode === 'commit' || !!opts.entries;

  if (isCommit) {
    switch (stage) {
      case 'elicit':     return applyElicitTurn(rootDir, opts.entries, opts);
      case 'blind_spot': return require('./blind-spot').runBlindSpot(rootDir, opts);
      case 'spec':       return applySpecTurn(rootDir, opts.entries, opts);
      case 'plan':       return applyPlanTurn(rootDir, opts.entries, opts);
      case 'present':    return applyPresentTurn(rootDir, opts.entries, opts);
      case 'commit':     return applyCommitTurn(rootDir, opts.entries, opts);
      case 'committed':  return envelope('deliberate', {
        ok: false,
        reason: 'already-committed',
        text: 'Deliberation has already been committed. Use /ovd-plan display, /ovd-plan edit, or /ovd-go.'
      });
    }
  }

  switch (stage) {
    case 'elicit':     return buildElicitTurn(rootDir, opts);
    case 'blind_spot': return require('./blind-spot').runBlindSpot(rootDir, opts);
    case 'spec':       return buildSpecTurn(rootDir, opts);
    case 'plan':       return buildPlanTurn(rootDir, opts);
    case 'present':    return buildPresentTurn(rootDir, opts);
    case 'commit':     return buildCommitTurn(rootDir, opts);
    case 'committed':  return envelope('deliberate', {
      ok: true,
      mode: 'plan',
      stage: 'committed',
      text: 'Deliberation already committed. Use /ovd-plan display to render the tree, /ovd-plan edit to modify, or /ovd-go to execute.'
    });
  }
}

function formatPlan(result) {
  if (result && result.text) return result.text;
  return '(no plan text)';
}

function formatCommit(result) {
  if (result && result.text) return result.text;
  return '(no commit text)';
}

module.exports = {
  STAGES,
  STATE_KEYS,
  LEAF_REQUIRED_FIELDS,
  currentStage,
  currentTurn,
  lastQuestion,
  openThreads,
  proposedTree,
  buildElicitTurn,
  applyElicitTurn,
  buildSpecTurn,
  applySpecTurn,
  buildPlanTurn,
  applyPlanTurn,
  buildPresentTurn,
  applyPresentTurn,
  buildCommitTurn,
  applyCommitTurn,
  runDeliberate,
  formatPlan,
  formatCommit,
  // exposed for testing only
  validateLeaf,
  findNodeById,
  buildLeafAnnotations,
  buildMilestoneNode,
  renderProposedTree,
  reorderInner
};
