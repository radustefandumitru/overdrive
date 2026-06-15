'use strict';

const fs = require('fs');
const path = require('path');
const { openState, commitState } = require('./deliberation-state');
const { appendUnderHeader } = require('./migrate');
const { resolvePriorSet } = require('./skill-router');
const deliberate = require('./deliberate');

// ---------------------------------------------------------------------------
// Slice B — RESOLVE SKILLS sub-step (r3 §5.3.5 + §11.2 canonical planning-time flow).
//
// Stage 5.5 (`plan_skills` in STAGES). For each leaf in proposed_tree with
// pending_skill_resolution === true, dispatch the skill-router helper's routing
// prompt to the host agent (plan mode), parse + validate the agent's response
// (commit mode), persist { skills, confidence, rationale, considered } to the leaf,
// clear pending_skill_resolution. When no leaves remain pending, implicitly
// transition stage → 'verify' (Slice C — Stage 6 plan-quality audit precedes Stage 7 Present).
//
// Per Q3.11 lock (readiness brief): one-call-per-leaf is canonical; batching is
// Phase 7 polish optimisation. Per Q3.3B.5 lock: codebaseContext concatenates
// both `.overdrive/codebase/patterns.md` + `.overdrive/codebase/tech-stack.md`
// when present. Per Q3.3B.7-bis lock: catalog-empty / parse-failed / validation-
// failed envelopes from the helper surface to the user verbatim (r3 §11.6 fail-fast).
// ---------------------------------------------------------------------------

const STATUS = 'plan-skills';
const INBOX_HEADER_UNKNOWN = 'Plan-skills unknown skills (agent referenced; not in catalog)';
const CODEBASE_PATTERNS_REL = path.join('.overdrive', 'codebase', 'patterns.md');
const CODEBASE_TECH_STACK_REL = path.join('.overdrive', 'codebase', 'tech-stack.md');

function nowIso(opts) {
  return (opts && opts.now) || new Date().toISOString();
}

function envelope(payload) {
  return Object.assign({ status: STATUS }, payload);
}

// Read both Phase 2 codebase context files; concatenate present ones with
// labeled headers. Returns null if neither file is readable or non-empty.
// Missing-file is non-fatal — patterns.md or tech-stack.md may not exist
// (fresh project; codebase map not yet run).
function readCodebaseContext(rootDir) {
  const parts = [];
  const candidates = [
    { rel: CODEBASE_PATTERNS_REL, label: 'Codebase patterns' },
    { rel: CODEBASE_TECH_STACK_REL, label: 'Tech stack' }
  ];
  for (const c of candidates) {
    try {
      const full = path.join(rootDir, c.rel);
      if (fs.existsSync(full)) {
        const body = fs.readFileSync(full, 'utf8').trim();
        if (body) parts.push(`## ${c.label}\n${body}`);
      }
    } catch (err) {
      // ignore — fail open; absence is treated identically to missing-file.
    }
  }
  return parts.length > 0 ? parts.join('\n\n') : null;
}

// Walk proposed_tree.milestones[*].children[*]; collect every leaf with
// pending_skill_resolution === true. Returns [{ milestone_id, leaf }, ...].
// Order preserved as they appear in the tree — matches Slice A + Task 3.4 emit order.
function findPendingLeaves(tree) {
  if (!tree || !Array.isArray(tree.milestones)) return [];
  const out = [];
  for (const m of tree.milestones) {
    if (!Array.isArray(m.children)) continue;
    for (const leaf of m.children) {
      if (leaf && leaf.pending_skill_resolution === true) {
        out.push({ milestone_id: m.id, leaf });
      }
    }
  }
  return out;
}

function findLeafById(tree, leafId) {
  if (!tree || !Array.isArray(tree.milestones)) return null;
  for (const m of tree.milestones) {
    if (!Array.isArray(m.children)) continue;
    for (const leaf of m.children) {
      if (leaf && leaf.id === leafId) {
        return { milestone_id: m.id, leaf };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Plan mode — emit per-leaf dispatch artifact
// ---------------------------------------------------------------------------

function buildPlanSkillsTurn(rootDir, opts = {}) {
  const opened = openState(rootDir);
  if (!opened.ok) {
    return envelope({ ok: false, reason: opened.reason, text: opened.text });
  }
  const inner = opened.innerObj;
  if (!inner.proposed_tree || !Array.isArray(inner.proposed_tree.milestones)) {
    return envelope({
      ok: false,
      reason: 'no-proposed-tree',
      text: 'RESOLVE SKILLS requires a proposed_tree from Stage 5 (Plan). Run /ovd-plan deliberate through Spec + Plan first.'
    });
  }
  const pending = findPendingLeaves(inner.proposed_tree);
  if (pending.length === 0) {
    return envelope({
      ok: false,
      reason: 'no-pending-leaves',
      text: 'No leaves with pending_skill_resolution=true. The RESOLVE SKILLS sub-step is complete; next /ovd-plan deliberate should be Stage 6 (Verify).'
    });
  }
  const target = pending[0];
  const leaf = target.leaf;
  const codebaseContext = readCodebaseContext(rootDir);

  // First call to the helper — no hostAgentAnswer; returns the routing prompt
  // (or a fail-fast envelope per r3 §11.6 if the catalog is unloadable).
  const helperResult = resolvePriorSet({
    repoRoot: rootDir,
    leafDescription: leaf.description,
    leafScope: leaf.scope,
    leafSuccessCriteria: leaf.success,
    codebaseContext
  });

  if (helperResult.ok === false && helperResult.reason !== 'requires-host-agent') {
    // catalog-empty (per r3 §11.6: planning blocks until resolved), or any other
    // non-requires-host-agent envelope — surface diagnostic; do NOT continue.
    return envelope({
      ok: false,
      reason: helperResult.reason,
      text: `RESOLVE SKILLS blocked: ${helperResult.message || helperResult.reason}. Per r3 §11.6, the catalog must be loadable before planning-time resolution can proceed.`
    });
  }

  const remainingIds = pending.map((p) => p.leaf.id);
  const lines = [];
  lines.push('Stage 5.5 — RESOLVE SKILLS (per-leaf planning-time routing)');
  lines.push('===========================================================');
  lines.push('');
  lines.push(`Leaves still pending skill resolution: ${pending.length}`);
  lines.push(`Resolving leaf: ${leaf.id} (under milestone ${target.milestone_id})`);
  if (remainingIds.length > 1) {
    lines.push(`After this leaf, remaining: ${remainingIds.slice(1).join(', ')}.`);
  } else {
    lines.push('This is the last pending leaf. Commit will transition stage → verify (Stage 6).');
  }
  lines.push(`Codebase context: ${codebaseContext ? 'present (.overdrive/codebase/patterns.md + tech-stack.md)' : 'absent (fresh project — neither file present)'}`);
  lines.push('');
  lines.push('Routing prompt (answer using your skill-router knowledge; end your response with a SINGLE JSON object on the LAST LINE — no fence, no trailing text):');
  lines.push('---');
  lines.push(helperResult.prompt);
  lines.push('---');
  lines.push('');
  lines.push('Instructions for the agent:');
  lines.push('  - Per r3 §11.2: this is the canonical planning-time call. Pick the narrowest skill set that applies.');
  lines.push('  - Confidence semantics (r3 §11.5):');
  lines.push('      high   = canonical prior; Phase 4 /ovd-go short-circuits cold routing.');
  lines.push('      medium = starting set; Phase 4 may add 1-2 deltas as complexity emerges.');
  lines.push('      low    = advisory; Phase 4 re-routes from scratch with live context.');
  lines.push('  - rationale is one-line reasoning. considered is the runner-up list (transparency, not a recommendation).');
  lines.push('  - Skills not in catalog → still persist them, but they will be logged to the inbox managed section for post-hoc review (non-fatal).');
  lines.push('');
  lines.push('Action paths:');
  lines.push('  (1) Resolve (recommended) — answer the routing prompt and commit.');
  lines.push('  (2) Skip-with-low-default — apply skills:[] + confidence:"low" + a rationale and move to the next leaf.');
  lines.push('  (3) Re-analyze — return to Stage 5 (Plan) to revise this leaf\'s scope/success before resolving (discards skill resolution progress on this leaf only).');
  lines.push('  (4) Describe other (or describe what you want).');
  lines.push('');
  lines.push('Commit syntax — resolve:');
  lines.push(`  overdrive plan deliberate --entries-json '{"leaf_id":"${leaf.id}","host_agent_response":"<verbatim agent response ending with a single JSON object>"}'`);
  lines.push('Commit syntax — skip:');
  lines.push(`  overdrive plan deliberate --entries-json '{"leaf_id":"${leaf.id}","kind":"skip","rationale":"<one line>"}'`);
  lines.push('Commit syntax — re-analyze (transitions back to Stage 5 Plan for this leaf\'s milestone):');
  lines.push(`  overdrive plan deliberate --entries-json '{"leaf_id":"${leaf.id}","kind":"reanalyze"}'`);

  return envelope({
    ok: true,
    mode: 'plan',
    stage: 'plan_skills',
    leaf_id: leaf.id,
    milestone_id: target.milestone_id,
    leaf_context: {
      description: leaf.description,
      scope: leaf.scope,
      success: leaf.success,
      codebase_patterns_summary: codebaseContext ? 'present' : 'absent'
    },
    remaining_leaf_ids: remainingIds,
    prompt: helperResult.prompt,
    expectedPayload: {
      leaf_id: 'string',
      host_agent_response: 'string (for kind="resolve", default)',
      kind: 'optional "resolve"|"skip"|"reanalyze"',
      rationale: 'string (for kind="skip")'
    },
    text: lines.join('\n')
  });
}

// ---------------------------------------------------------------------------
// Commit mode — apply resolved skills to a specific leaf
// ---------------------------------------------------------------------------

function applyPlanSkillsTurn(rootDir, entries, opts = {}) {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return envelope({
      ok: false,
      reason: 'invalid-shape',
      text: 'RESOLVE SKILLS commit requires a JSON object with { leaf_id, host_agent_response | kind, ... }.'
    });
  }
  if (typeof entries.leaf_id !== 'string' || !entries.leaf_id.trim()) {
    return envelope({ ok: false, reason: 'missing-leaf-id', text: 'RESOLVE SKILLS commit requires entries.leaf_id (string).' });
  }
  const kind = (typeof entries.kind === 'string' && entries.kind.trim()) ? entries.kind : 'resolve';
  if (kind !== 'resolve' && kind !== 'skip' && kind !== 'reanalyze') {
    return envelope({
      ok: false,
      reason: 'invalid-kind',
      text: 'RESOLVE SKILLS kind must be "resolve" | "skip" | "reanalyze" (default "resolve" when omitted).'
    });
  }
  if (kind === 'resolve' && (typeof entries.host_agent_response !== 'string' || !entries.host_agent_response.trim())) {
    return envelope({
      ok: false,
      reason: 'missing-host-agent-response',
      text: 'RESOLVE SKILLS resolve commit requires entries.host_agent_response (string ending with a single JSON object).'
    });
  }
  const opened = openState(rootDir);
  if (!opened.ok) {
    return envelope({ ok: false, reason: opened.reason, text: opened.text });
  }
  if (deliberate.currentStage(opened.innerObj) !== 'plan_skills') {
    return envelope({
      ok: false,
      reason: 'stage-mismatch',
      text: `Cannot apply plan-skills-turn while stage is "${deliberate.currentStage(opened.innerObj)}".`
    });
  }
  const inner = opened.innerObj;
  const tree = inner.proposed_tree;
  if (!tree || !Array.isArray(tree.milestones)) {
    return envelope({ ok: false, reason: 'no-proposed-tree', text: 'RESOLVE SKILLS requires a proposed_tree.' });
  }
  const found = findLeafById(tree, entries.leaf_id);
  if (!found) {
    return envelope({ ok: false, reason: 'unknown-leaf', text: `leaf_id "${entries.leaf_id}" not found in proposed_tree.` });
  }
  if (found.leaf.pending_skill_resolution !== true) {
    return envelope({
      ok: false,
      reason: 'already-resolved',
      text: `leaf "${entries.leaf_id}" is not pending_skill_resolution; cannot re-resolve in Slice B (runtime SKILL DELTA is Phase 4 /ovd-go per r3 §11.2).`
    });
  }

  const now = nowIso(opts);

  if (kind === 'reanalyze') {
    // Transition back to Stage 5 (Plan) for this leaf's milestone re-emit.
    // Does NOT touch the leaf — the user/agent uses replace+reset_children
    // on the milestone via Stage 7 patch shape after returning to plan.
    inner.stage = 'plan';
    inner.last_action = now;
    opened.innerObj = deliberate.reorderInner(inner);
    const committed = commitState(rootDir, opened);
    if (!committed.ok) {
      return envelope({ ok: false, reason: committed.reason, text: committed.text });
    }
    return envelope({
      ok: true,
      mode: 'commit',
      stage: 'plan',
      transitioned: true,
      leaf_id: entries.leaf_id,
      text: `Re-analyze requested for leaf ${entries.leaf_id}. Transitioning back to Stage 5 (Plan). Run /ovd-plan deliberate to re-emit leaves for milestone ${found.milestone_id} (typically via the replace+reset_children path at Stage 7 once re-emitted).`
    });
  }

  if (kind === 'skip') {
    // User-initiated skip: empty skills, low confidence, user-supplied (or default) rationale.
    const rationale = (typeof entries.rationale === 'string' && entries.rationale.trim())
      ? entries.rationale.trim()
      : 'skipped by user';
    found.leaf.skills = [];
    found.leaf.confidence = 'low';
    found.leaf.rationale = rationale;
    found.leaf.considered = [];
    delete found.leaf.pending_skill_resolution;
  } else {
    // kind === 'resolve' — second call to the helper with the agent's response.
    const codebaseContext = readCodebaseContext(rootDir);
    const helperResult = resolvePriorSet(
      {
        repoRoot: rootDir,
        leafDescription: found.leaf.description,
        leafScope: found.leaf.scope,
        leafSuccessCriteria: found.leaf.success,
        codebaseContext
      },
      { hostAgentAnswer: entries.host_agent_response }
    );
    if (!helperResult.ok) {
      // Per r3 §11.6 + Q3.3B.7-bis lock: surface diagnostic; do NOT write to leaf.
      const tail = (helperResult.reason === 'parse-failed' || helperResult.reason === 'validation-failed')
        ? ' Agent must end response with a single JSON object: {"skills":["..."],"confidence":"high|medium|low","rationale":"...","considered":["..."]}.'
        : '';
      return envelope({
        ok: false,
        reason: helperResult.reason,
        text: `RESOLVE SKILLS rejected: ${helperResult.message || helperResult.reason}.${tail}`
      });
    }
    // Persist verbatim per Q3.3B.6 lock (CLI is custodian, not grader).
    found.leaf.skills = helperResult.skills;
    found.leaf.confidence = helperResult.confidence;
    found.leaf.rationale = helperResult.rationale;
    found.leaf.considered = helperResult.considered;
    delete found.leaf.pending_skill_resolution;
    // Unknown skills → inbox log (non-fatal, per Q3.3B.7 lock).
    if (Array.isArray(helperResult.unknown_skills) && helperResult.unknown_skills.length > 0) {
      const body = `- [unknown-skills referenced at: ${now}] leaf ${entries.leaf_id}: ${helperResult.unknown_skills.join(', ')}`;
      opened.sections.inbox = appendUnderHeader(opened.sections.inbox || '', INBOX_HEADER_UNKNOWN, body);
    }
  }

  // Coverage assertion (Q3.3B.8 lock): when no leaves remain pending, implicitly
  // transition to 'verify' (Slice C — Stage 6 plan-quality audit precedes Stage 7 Present).
  // Structural enforcement — agent can't skip leaves.
  const remainingAfter = findPendingLeaves(tree);
  let transitioned = false;
  if (remainingAfter.length === 0) {
    inner.stage = 'verify';
    transitioned = true;
  }
  tree.last_revision = (tree.last_revision || 1) + 1;
  inner.current_proposal_revision = tree.last_revision;
  inner.last_action = now;
  opened.innerObj = deliberate.reorderInner(inner);
  const committed = commitState(rootDir, opened);
  if (!committed.ok) {
    return envelope({ ok: false, reason: committed.reason, text: committed.text });
  }

  const remainingIds = remainingAfter.map((p) => p.leaf.id);
  const skillsList = (Array.isArray(found.leaf.skills) && found.leaf.skills.length > 0) ? found.leaf.skills.join(', ') : '(none)';
  const transitionTail = transitioned
    ? ' All leaves resolved. Transitioning to Stage 6 (Verify).'
    : ` ${remainingIds.length} leaf/leaves remaining: ${remainingIds.join(', ')}.`;
  return envelope({
    ok: true,
    mode: 'commit',
    stage: inner.stage,
    transitioned,
    leaf_id: entries.leaf_id,
    skills: found.leaf.skills,
    confidence: found.leaf.confidence,
    rationale: found.leaf.rationale,
    considered: found.leaf.considered,
    remaining_leaf_ids: remainingIds,
    revision: tree.last_revision,
    text: `Resolved skills for ${entries.leaf_id}: [${skillsList}] (confidence=${found.leaf.confidence}; via ${kind === 'skip' ? 'user-skip' : 'router'}).${transitionTail}`
  });
}

// ---------------------------------------------------------------------------
// Orchestrator — plan/commit dispatch
// ---------------------------------------------------------------------------

function runPlanSkills(rootDir, opts = {}) {
  const isCommit = opts.mode === 'commit' || !!opts.entries;
  if (!isCommit) return buildPlanSkillsTurn(rootDir, opts);
  return applyPlanSkillsTurn(rootDir, opts.entries, opts);
}

function formatPlan(result) {
  return (result && result.text) || '(no plan text)';
}

function formatCommit(result) {
  return (result && result.text) || '(no commit text)';
}

module.exports = {
  STATUS,
  INBOX_HEADER_UNKNOWN,
  CODEBASE_PATTERNS_REL,
  CODEBASE_TECH_STACK_REL,
  readCodebaseContext,
  findPendingLeaves,
  findLeafById,
  buildPlanSkillsTurn,
  applyPlanSkillsTurn,
  runPlanSkills,
  formatPlan,
  formatCommit
};
