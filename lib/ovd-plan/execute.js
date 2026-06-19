'use strict';

const fs = require('fs');
const path = require('path');

const { openState, commitState } = require('./deliberation-state');
const { flattenNodes, isLeaf } = require('./noderef');
const { isoToFilenameSafe } = require('./research');
const { loadCatalogSkills } = require('./skill-router');

// ---------------------------------------------------------------------------
// Task 4.2 — LEAF EXECUTE with pre-resolved skills (r3 §6.3, §11.2/.5/.6).
//
// Pattern-1 dispatch. PLAN mode reads the leaf's pre-resolved annotations and
// emits an execution plan carrying the prior_set (leaf.skills) + prior_confidence
// (leaf.confidence). Per r3 §11.1 there is NO code-level router to call — the
// annotation IS the prior; the agent loads the named SKILL.md files and executes.
// No router consultation on the canonical path (confidence high); SKILL DELTA is
// the exception (empty/low annotation, or a need outside the prior).
//
// COMMIT mode takes the agent's results via --entries-json: validates (Pattern 4),
// transitions the leaf status via the writer round-trip (Pattern 2: openState/
// commitState), captures any skill_delta to a session file (NEVER rewrites the
// leaf annotation — that's Phase 5 LEARNINGS EXTRACT), and WARNS (never blocks)
// on files written outside scope.in (a potential DECISION POINT, Task 4.10).
// ---------------------------------------------------------------------------

const STATUS = 'go';
const SESSIONS_REL = path.join('.overdrive', 'sessions');
// Statuses a LEAF EXECUTE commit may land. awaiting-review is normally reached
// via verify (Task 4.4) but accepted if the agent ran verify inline.
const EXECUTE_STATUS_VALUES = ['in-progress', 'awaiting-review', 'blocked'];
// Catalog ships with the overdrive install (not the user project).
const INSTALL_ROOT = path.join(__dirname, '..', '..');

function findLeaf(tree, leafId) {
  const want = typeof leafId === 'string' ? leafId.trim().toLowerCase() : '';
  if (!want) return null;
  return flattenNodes(tree).find((n) => (n.id || '').toLowerCase() === want) || null;
}

// Pull execution-relevant annotation fields with defensive defaults (writer-
// canonical names per Q3.3A.10: scope.in/out/read_only, success, verify, deps).
function leafContract(node) {
  const a = node.annotations || {};
  const scope = (a.scope && typeof a.scope === 'object') ? a.scope : {};
  return {
    skills: Array.isArray(a.skills) ? a.skills : [],
    confidence: typeof a.confidence === 'string' ? a.confidence : null,
    scope: {
      in: Array.isArray(scope.in) ? scope.in : [],
      out: Array.isArray(scope.out) ? scope.out : [],
      read_only: Array.isArray(scope.read_only) ? scope.read_only : []
    },
    success: Array.isArray(a.success) ? a.success : [],
    verify: (a.verify && typeof a.verify === 'object') ? a.verify : null,
    deps: Array.isArray(a.deps) ? a.deps : []
  };
}

// r3 §11.5 confidence → execution skill mode.
function skillMode(contract) {
  if (!contract.skills.length) return 'reconsult';        // §11.6 empty → reconsult
  if (contract.confidence === 'high') return 'canonical';  // use as-is
  if (contract.confidence === 'low') return 'reconsult';   // advisory → re-resolve
  return 'starting-point';                                 // medium / unset → may add 1-2
}

// Best-effort §11.6 check: split prior skills into known/unknown against the
// shipped catalog. If the catalog can't be loaded, skip (return all as known).
function partitionSkills(skills, opts) {
  const root = (opts && opts.repoRoot) || INSTALL_ROOT;
  let known;
  try {
    known = loadCatalogSkills(root);
  } catch (err) {
    known = [];
  }
  if (!Array.isArray(known) || known.length === 0) {
    return { known: skills.slice(), unknown: [], catalogAvailable: false };
  }
  const set = new Set(known);
  return {
    known: skills.filter((s) => set.has(s)),
    unknown: skills.filter((s) => !set.has(s)),
    catalogAvailable: true
  };
}

// True if `file` is covered by any scope.in entry (exact, or under a dir entry).
function isWithinScope(file, scopeIn) {
  if (typeof file !== 'string' || !file) return false;
  return scopeIn.some((entry) => {
    if (typeof entry !== 'string' || !entry) return false;
    if (file === entry) return true;
    const dir = entry.endsWith('/') ? entry : entry + '/';
    return file.startsWith(dir);
  });
}

// ---------------------------------------------------------------------------
// PLAN mode — emit the execution dispatch artifact.
// ---------------------------------------------------------------------------
function buildExecutePlan(rootDir, leafId, opts) {
  const opened = openState(rootDir);
  if (!opened.ok) {
    return { ok: false, status: STATUS, reason: opened.reason, text: opened.text };
  }
  if (typeof leafId !== 'string' || leafId.trim() === '') {
    return { ok: false, status: STATUS, reason: 'missing-ref', text: 'LEAF EXECUTE requires a leaf id (e.g. /ovd-go execute II.2.a).' };
  }
  const node = findLeaf(opened.parsed.tree, leafId);
  if (!node) {
    return { ok: false, status: STATUS, reason: 'leaf-not-found', text: `No node with id "${leafId}". Run /ovd-go to orient or /ovd-plan display for the tree.` };
  }
  if (!isLeaf(node)) {
    return { ok: false, status: STATUS, reason: 'not-a-leaf', text: `${node.id} is a container, not a leaf. LEAF EXECUTE targets leaves; target a child leaf or run /ovd-go verify ${node.id} for cluster verification.` };
  }

  const contract = leafContract(node);
  const mode = skillMode(contract);
  const parts = partitionSkills(contract.skills, opts);

  const lines = [];
  lines.push(`LEAF EXECUTE — ${node.id} ${node.title || ''}`.trimEnd());
  lines.push('='.repeat(Math.min(60, (`LEAF EXECUTE — ${node.id} ${node.title || ''}`).length)));
  lines.push('');
  lines.push(`Status: ${node.status || 'pending'} → (will set in-progress on commit)`);
  lines.push('');
  lines.push('Scope (write within scope.in; out-of-scope writes are a DECISION POINT):');
  lines.push(`  in:        ${contract.scope.in.length ? contract.scope.in.join(', ') : '(none specified)'}`);
  if (contract.scope.read_only.length) lines.push(`  read_only: ${contract.scope.read_only.join(', ')}`);
  if (contract.scope.out.length) lines.push(`  out:       ${contract.scope.out.join(', ')}`);
  lines.push('');
  lines.push('Success criteria:');
  if (contract.success.length) contract.success.forEach((s, i) => lines.push(`  [${i}] ${s}`));
  else lines.push('  (none specified — agent-self-check against the leaf description)');
  lines.push('');
  if (contract.deps.length) { lines.push(`Dependencies: ${contract.deps.join(', ')}`); lines.push(''); }

  lines.push(`Skills (prior set, confidence=${contract.confidence || 'unset'}, mode=${mode}):`);
  if (mode === 'canonical') {
    lines.push('  Load these SKILL.md files and execute. Confidence is high — the prior is canonical;');
    lines.push('  do NOT re-route. A skill needed OUTSIDE this set is a SKILL DELTA (record it, do not rewrite the leaf).');
  } else if (mode === 'starting-point') {
    lines.push('  Load these as the starting point. You may add 1-2 skills as complexity emerges;');
    lines.push('  capture any addition as a SKILL DELTA in the commit entries.');
  } else {
    lines.push('  Prior is empty or low-confidence → re-resolve skills for this leaf using your skill-router');
    lines.push('  knowledge against current context, and record the result as a SKILL DELTA (planner vs runtime).');
  }
  if (parts.known.length) lines.push(`  prior: ${parts.known.join(', ')}`);
  if (parts.unknown.length) lines.push(`  ⚠ not in catalog (skip these slots, continue): ${parts.unknown.join(', ')}`);
  if (mode !== 'reconsult' && !parts.known.length && !parts.unknown.length) lines.push('  prior: (none)');
  lines.push('');
  if (contract.verify) {
    lines.push(`Verification (on completion, run /ovd-go verify ${node.id}): method=${contract.verify.method || 'agent_self_check_against_success_criteria'}, fallback=${contract.verify.fallback || 'agent_self_check_against_success_criteria'}`);
    lines.push('');
  }
  lines.push('When done, call back with:');
  lines.push(`  overdrive go execute ${node.id} --entries-json '{"leaf_id":"${node.id}","files_touched":["..."],"summary":"<one line>","status":"in-progress","skill_delta":{"planner":[],"runtime":[]}}'`);
  lines.push('  (skill_delta optional — include only if you used skills outside the prior.)');

  return {
    ok: true,
    status: STATUS,
    mode: 'execute-plan',
    leaf_id: node.id,
    title: node.title || '',
    skills: contract.skills,
    confidence: contract.confidence,
    skillMode: mode,
    unknownSkills: parts.unknown,
    scope: contract.scope,
    success: contract.success,
    verify: contract.verify,
    deps: contract.deps,
    text: lines.join('\n')
  };
}

// ---------------------------------------------------------------------------
// COMMIT mode — validate + persist the agent's execution result.
// ---------------------------------------------------------------------------
function normalizeExecuteEntries(entries) {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return { ok: false, reason: 'invalid-entries', text: 'execute commit requires a JSON object.' };
  }
  if (typeof entries.leaf_id !== 'string' || entries.leaf_id.trim() === '') {
    return { ok: false, reason: 'missing-leaf-id', text: 'execute entries require a non-empty leaf_id.' };
  }
  const files = Array.isArray(entries.files_touched) ? entries.files_touched.filter((f) => typeof f === 'string' && f) : [];
  let status = 'in-progress';
  if (typeof entries.status === 'string') {
    if (!EXECUTE_STATUS_VALUES.includes(entries.status)) {
      return { ok: false, reason: 'invalid-status', text: `status must be one of ${EXECUTE_STATUS_VALUES.join(' / ')}.` };
    }
    status = entries.status;
  }
  let skillDelta = null;
  if (entries.skill_delta != null) {
    const d = entries.skill_delta;
    if (typeof d !== 'object' || Array.isArray(d)) {
      return { ok: false, reason: 'invalid-skill-delta', text: 'skill_delta must be an object { planner: [], runtime: [] }.' };
    }
    skillDelta = {
      planner: Array.isArray(d.planner) ? d.planner.filter((s) => typeof s === 'string') : [],
      runtime: Array.isArray(d.runtime) ? d.runtime.filter((s) => typeof s === 'string') : []
    };
  }
  return {
    ok: true,
    leaf_id: entries.leaf_id.trim(),
    files_touched: files,
    summary: typeof entries.summary === 'string' ? entries.summary : '',
    status,
    skill_delta: skillDelta
  };
}

function applyExecuteResult(rootDir, entries, opts) {
  const norm = normalizeExecuteEntries(entries);
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

  const contract = leafContract(node);
  const scopeWarnings = norm.files_touched.filter((f) => !isWithinScope(f, contract.scope.in));

  // Persist status transition via the writer round-trip (Pattern 2).
  node.status = norm.status;
  const committed = commitState(rootDir, opened);
  if (!committed.ok) {
    return { ok: false, status: STATUS, mode: 'commit', reason: committed.reason, text: committed.text };
  }

  // Capture the execution record + any skill_delta to a session file. The leaf
  // annotation is NEVER rewritten (r3 §11.2 — planner improvement is LEARNINGS EXTRACT).
  const now = (opts && opts.now) || new Date().toISOString();
  const safeId = node.id.replace(/[^A-Za-z0-9.]/g, '-');
  const fileName = `${isoToFilenameSafe(now)}-execute-${safeId}.md`;
  const dir = path.join(rootDir, SESSIONS_REL);
  const recordLines = [
    `# LEAF EXECUTE — ${node.id} ${node.title || ''}`.trimEnd(),
    '',
    `- timestamp: ${now}`,
    `- status_after: ${norm.status}`,
    `- files_touched: ${norm.files_touched.length ? norm.files_touched.join(', ') : '(none reported)'}`
  ];
  if (norm.summary) recordLines.push(`- summary: ${norm.summary}`);
  if (scopeWarnings.length) recordLines.push(`- out-of-scope files (warning): ${scopeWarnings.join(', ')}`);
  if (norm.skill_delta) {
    recordLines.push(`- skill-delta: planner=[${norm.skill_delta.planner.join(', ')}], runtime=[${norm.skill_delta.runtime.join(', ')}]`);
  }
  recordLines.push('');
  let sessionFile = null;
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, fileName), recordLines.join('\n'));
    sessionFile = path.join(SESSIONS_REL, fileName);
  } catch (err) {
    // Non-fatal: status already persisted; report capture failure in the result.
    sessionFile = null;
  }

  const out = [];
  out.push(`${node.id} — execution recorded. Status → ${norm.status}.`);
  if (scopeWarnings.length) {
    out.push('');
    out.push(`⚠ ${scopeWarnings.length} file(s) written outside scope.in: ${scopeWarnings.join(', ')}`);
    out.push('  If this widened the leaf, surface a DECISION POINT (/ovd-go) before continuing.');
  }
  if (norm.skill_delta) {
    out.push('');
    out.push(`Skill delta captured to session (leaf annotation unchanged): planner=[${norm.skill_delta.planner.join(', ')}], runtime=[${norm.skill_delta.runtime.join(', ')}].`);
  }
  out.push('');
  out.push('Next:');
  out.push(`  (1) /ovd-go verify ${node.id} — run verification.`);
  out.push('  (2) /ovd-log — checkpoint.');
  out.push('  (3) Other — describe what you want.');

  return {
    ok: true,
    status: STATUS,
    mode: 'execute-commit',
    leaf_id: node.id,
    status_after: norm.status,
    scope_warnings: scopeWarnings,
    skill_delta_logged: !!norm.skill_delta,
    session_file: sessionFile,
    text: out.join('\n')
  };
}

function runExecuteLeaf(rootDir, opts = {}) {
  if (!rootDir || typeof rootDir !== 'string') {
    return { ok: false, status: STATUS, reason: 'invalid-project-dir', text: 'runExecuteLeaf requires a project directory string.' };
  }
  const mode = opts.mode || (opts.entries ? 'commit' : 'plan');
  if (mode === 'commit') {
    return applyExecuteResult(rootDir, opts.entries, opts);
  }
  return buildExecutePlan(rootDir, opts.leafId || opts.ref || null, opts);
}

module.exports = {
  STATUS,
  SESSIONS_REL,
  EXECUTE_STATUS_VALUES,
  findLeaf,
  leafContract,
  skillMode,
  partitionSkills,
  isWithinScope,
  buildExecutePlan,
  normalizeExecuteEntries,
  applyExecuteResult,
  runExecuteLeaf
};
