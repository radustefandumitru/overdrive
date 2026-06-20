'use strict';

const { openState } = require('./deliberation-state');
const { isLeaf } = require('./noderef');
const { findLeaf, leafContract } = require('./execute');

// ---------------------------------------------------------------------------
// Tasks 4.7 + 4.8 — `--small` auto-detection + scope-growth (r3 §6.7, Q4.6/Q4.7).
//
// The only place v1 auto-detects a mode switch. Discipline (FM #6): TRANSPARENT
// recommendation, NEVER a silent switch. Both functions are pure assessors —
// they read state + return a recommendation; they do NOT mutate the tree or flip
// modes. The slash-command body renders the recommendation and the user picks.
//
// 4.7 assessScope: before executing, recommend --small when scope is genuinely
//     narrow (Q4.6: files_touched <= 1 AND no shared-contract files).
// 4.8 monitorSmallScope: during --small execution, detect when the change has
//     grown beyond what --small justifies (Q4.7: >2-3 files OR a shared contract
//     touched) and surface the switch prompt.
// ---------------------------------------------------------------------------

const STATUS = 'go';
const SMALL_FILE_CAP = 1;          // 4.7: recommend --small only at <= 1 file
const GROWTH_FILE_THRESHOLD = 3;   // 4.8: scope-growth trips above this
// Shared-contract detection (Q4.7 allow-list): a change touching these is NOT small.
const SHARED_CONTRACT_PATTERNS = [
  /\.d\.ts$/,
  /\.proto$/,
  /(^|\/)interfaces\//,
  /(^|\/)contracts\//,
  /(^|\/)types\//,
  /schema/i
];

function isSharedContract(filePath) {
  if (typeof filePath !== 'string' || !filePath) return false;
  return SHARED_CONTRACT_PATTERNS.some((re) => re.test(filePath));
}

function sharedContractFiles(files) {
  return (Array.isArray(files) ? files : []).filter((f) => isSharedContract(f));
}

// --- 4.7: assessScope (pre-execution recommendation) ---------------------

// Pure scope assessment from a candidate file set. Returns { recommend_small, reason }.
function assessScopeFiles(files) {
  const list = (Array.isArray(files) ? files : []).filter((f) => typeof f === 'string' && f);
  const shared = sharedContractFiles(list);
  if (shared.length > 0) {
    return { recommend_small: false, reason: `touches shared contract(s): ${shared.join(', ')} — use full mode.` };
  }
  if (list.length > SMALL_FILE_CAP) {
    return { recommend_small: false, reason: `touches ${list.length} files (> ${SMALL_FILE_CAP}) — use full mode.` };
  }
  return { recommend_small: true, reason: list.length === 0 ? 'no files in scope yet; narrow change likely.' : `single file (${list[0]}), no shared contract.` };
}

// Read a leaf's scope.in (writer-canonical) and assess. `changeDescription` is
// optional context the agent may pass; the heuristic is file-based per Q4.6.
function assessScope(rootDir, leafId, opts) {
  const opened = openState(rootDir);
  if (!opened.ok) return { ok: false, status: STATUS, reason: opened.reason, text: opened.text };
  if (typeof leafId !== 'string' || leafId.trim() === '') {
    return { ok: false, status: STATUS, reason: 'missing-ref', text: 'assessScope requires a leaf id (e.g. /ovd-go assess II.2.a).' };
  }
  const node = findLeaf(opened.parsed.tree, leafId);
  if (!node) return { ok: false, status: STATUS, reason: 'leaf-not-found', text: `No node with id "${leafId}".` };
  if (!isLeaf(node)) return { ok: false, status: STATUS, reason: 'not-a-leaf', text: `${node.id} is a container, not a leaf.` };

  const contract = leafContract(node);
  const assessment = assessScopeFiles(contract.scope.in);
  const lines = [];
  if (assessment.recommend_small) {
    lines.push(`This change looks small — ${assessment.reason}`);
    lines.push(`Recommending /ovd-go --small ${node.id} to skip the full skill load + remap.`);
    lines.push('');
    lines.push('  (1) approved — use --small mode.');
    lines.push('  (2) full — use full mode anyway (slower, more thorough).');
    lines.push('  (3) other — describe what you want.');
  } else {
    lines.push(`Full mode recommended for ${node.id} — ${assessment.reason}`);
    lines.push('');
    lines.push('  (1) approved — use full mode.');
    lines.push('  (2) --small — force small mode anyway (you accept the narrower scope).');
    lines.push('  (3) other — describe what you want.');
  }
  return {
    ok: true,
    status: STATUS,
    mode: 'assess-scope',
    leaf_id: node.id,
    recommend_small: assessment.recommend_small,
    reason: assessment.reason,
    scope_files: contract.scope.in,
    text: lines.join('\n')
  };
}

// --- 4.8: monitorSmallScope (during --small execution) -------------------

// Pure growth assessment from a session-state payload. Returns { exceeded, evidence }.
function evaluateGrowth(sessionState) {
  const ss = (sessionState && typeof sessionState === 'object' && !Array.isArray(sessionState)) ? sessionState : {};
  const files = (Array.isArray(ss.files_touched) ? ss.files_touched : []).filter((f) => typeof f === 'string' && f);
  const shared = sharedContractFiles(files);
  if (shared.length > 0) {
    return { exceeded: true, evidence: `now touching shared contract(s): ${shared.join(', ')}`, files_touched: files.length, shared_contracts: shared };
  }
  if (files.length > GROWTH_FILE_THRESHOLD) {
    return { exceeded: true, evidence: `now touching ${files.length} files (> ${GROWTH_FILE_THRESHOLD})`, files_touched: files.length, shared_contracts: [] };
  }
  return { exceeded: false, evidence: `${files.length} file(s), no shared contract — still within --small scope`, files_touched: files.length, shared_contracts: [] };
}

function monitorSmallScope(sessionState) {
  const growth = evaluateGrowth(sessionState);
  const lines = [];
  if (growth.exceeded) {
    lines.push(`This --small iteration has grown — ${growth.evidence}.`);
    lines.push('Recommend switching to full mode for the rest:');
    lines.push('');
    lines.push('  (1) switch — continue in full mode (loads skill set, remaps if needed).');
    lines.push('  (2) keep --small — proceed but with caveats noted.');
    lines.push('  (3) replan — this needs a tree adjustment.');
    lines.push('  (4) other — describe what you want.');
  } else {
    lines.push(`--small scope OK — ${growth.evidence}.`);
  }
  return {
    ok: true,
    status: STATUS,
    mode: 'monitor-small',
    exceeded: growth.exceeded,
    evidence: growth.evidence,
    files_touched: growth.files_touched,
    shared_contracts: growth.shared_contracts,
    text: lines.join('\n')
  };
}

module.exports = {
  STATUS,
  SMALL_FILE_CAP,
  GROWTH_FILE_THRESHOLD,
  SHARED_CONTRACT_PATTERNS,
  isSharedContract,
  sharedContractFiles,
  assessScopeFiles,
  assessScope,
  evaluateGrowth,
  monitorSmallScope
};
