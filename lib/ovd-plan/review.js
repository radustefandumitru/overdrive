'use strict';

const { openState, commitState } = require('./deliberation-state');
const { isLeaf } = require('./noderef');
const { findLeaf, leafContract } = require('./execute');

// ---------------------------------------------------------------------------
// Task 4.4 — AWAITING REVIEW + approval-signal classifier (r3 §6.4, §10.3).
//
// The first place v1 does fuzzy NLP at a real semantic boundary. Hybrid design
// (reconciles impl-plan §5 Task 4.4 with brief-13's "agent classifies"):
//   - classifyUserResponse(response) is a DETERMINISTIC first-pass (word-lists +
//     a contradiction heuristic). Clear signals → approved / defer / iterate;
//     near-misses ("looks good but…") → ambiguous. Unit-testable.
//   - The HOST AGENT (which has conversational context the CLI lacks) is
//     AUTHORITATIVE: when the commit carries an explicit `classification`, it
//     wins over the first-pass.
//   - Status transitions ALWAYS go through the writer round-trip (FM #4). Only an
//     explicit approval promotes to `done` (§10.3 / hard rule 8); ambiguous never
//     auto-promotes — it re-prompts with numbered options.
// ---------------------------------------------------------------------------

const STATUS = 'go';
const CLASSIFICATIONS = ['approved', 'iterate', 'defer', 'ambiguous'];

// Approval signals (r3 §6.4 / §10.3). Multi-word entries match as substrings;
// single words match on word boundaries (so "next" matches but "context" doesn't).
const APPROVAL_TOKENS = ['approved', 'approve', 'ship it', 'lgtm', 'looks good', 'good to go', 'done', 'next', 'perfect', '👍'];
const DEFER_TOKENS = ['defer', 'come back to this', 'come back later', 'blocked on', 'skip for now', 'set aside', 'park this', 'not now', 'hold off'];
// A contradiction after an approval flips it to iteration ("looks good BUT…",
// "approve ONCE Y is changed", "done EXCEPT…").
const CONTRADICTION_TOKENS = ['but', 'except', 'however', 'though', 'although', 'once', 'unless', 'aside from', 'other than'];
// Change-describing indicators (imperative / corrective).
const CHANGE_TOKENS = ['change', 'make it', 'add ', 'remove', 'delete', 'fix', 'adjust', 'increase', 'decrease', 'reduce', 'rename', 'smaller', 'bigger', 'larger', 'darker', 'lighter', 'instead', 'should be', 'too ', 'more ', 'less ', 'wrong', 'broken', 'redo'];

function matchAny(text, tokens) {
  const matched = [];
  for (const token of tokens) {
    if (/\s/.test(token) || /[^a-z]/.test(token)) {
      if (text.includes(token)) matched.push(token);
    } else {
      const re = new RegExp(`\\b${token}\\b`);
      if (re.test(text)) matched.push(token);
    }
  }
  return matched;
}

// Deterministic first-pass classifier. Returns { classification, evidence }.
function classifyUserResponse(response) {
  if (typeof response !== 'string' || response.trim() === '') {
    return { classification: 'ambiguous', evidence: { rule: 'empty', matched: [] } };
  }
  const text = response.trim().toLowerCase();
  const approval = matchAny(text, APPROVAL_TOKENS);
  const defer = matchAny(text, DEFER_TOKENS);
  const contradiction = matchAny(text, CONTRADICTION_TOKENS);
  const change = matchAny(text, CHANGE_TOKENS);

  if (defer.length) {
    return { classification: 'defer', evidence: { rule: 'defer-token', matched: defer } };
  }
  if (approval.length && !contradiction.length && !change.length) {
    return { classification: 'approved', evidence: { rule: 'clean-approval', matched: approval } };
  }
  if (approval.length && (contradiction.length || change.length)) {
    // approval-but-change: the requested change wins (FM #5 near-miss).
    return { classification: 'iterate', evidence: { rule: 'approval-with-change', matched: approval.concat(contradiction, change) } };
  }
  if (change.length && !approval.length) {
    return { classification: 'iterate', evidence: { rule: 'change-request', matched: change } };
  }
  return { classification: 'ambiguous', evidence: { rule: 'no-clear-signal', matched: [] } };
}

// Render the AWAITING REVIEW prompt per r3 §6.4. `changes`/`verifyResult` are
// provided by the orchestrating agent (which has the execution context); the CLI
// renders the skeleton + the canonical approval prompt.
function presentForReview(node, changes, verifyResult) {
  const c = leafContract(node);
  const lines = [];
  lines.push(`${node.id} ${node.title || ''} — implementation complete.`.replace(/\s+—/, ' —'));
  lines.push('');
  if (Array.isArray(changes) && changes.length) {
    lines.push('Changes:');
    changes.forEach((ch) => lines.push(`  - ${ch}`));
    lines.push('');
  }
  if (verifyResult && typeof verifyResult === 'object') {
    lines.push(`Verification (${verifyResult.method || 'agent_self_check_against_success_criteria'}): ${verifyResult.result || 'pending'}`);
    if (Array.isArray(verifyResult.findings) && verifyResult.findings.length) {
      verifyResult.findings.forEach((f) => lines.push(`  - ${f}`));
    }
    lines.push('');
  }
  if (c.success.length) {
    lines.push('Success criteria:');
    c.success.forEach((s, i) => lines.push(`  [${i}] ${s}`));
    lines.push('');
  }
  lines.push("Reply 'approved' to mark this done, or describe changes to iterate.");
  lines.push("Other options: 'defer' (come back later), 'replan' (this needs rethinking).");
  return lines.join('\n');
}

// PLAN mode — set the leaf to awaiting-review and emit the review prompt.
function buildReviewPlan(rootDir, leafId, opts) {
  const opened = openState(rootDir);
  if (!opened.ok) return { ok: false, status: STATUS, reason: opened.reason, text: opened.text };
  if (typeof leafId !== 'string' || leafId.trim() === '') {
    return { ok: false, status: STATUS, reason: 'missing-ref', text: 'AWAITING REVIEW requires a leaf id (e.g. /ovd-go review II.2.a).' };
  }
  const node = findLeaf(opened.parsed.tree, leafId);
  if (!node) return { ok: false, status: STATUS, reason: 'leaf-not-found', text: `No node with id "${leafId}".` };
  if (!isLeaf(node)) return { ok: false, status: STATUS, reason: 'not-a-leaf', text: `${node.id} is a container, not a leaf.` };

  node.status = 'awaiting-review';
  const committed = commitState(rootDir, opened);
  if (!committed.ok) return { ok: false, status: STATUS, reason: committed.reason, text: committed.text };

  const prompt = presentForReview(node, (opts && opts.changes) || null, (opts && opts.verifyResult) || null);
  const text = [
    prompt,
    '',
    'When the user replies, classify and call back:',
    `  overdrive go review ${node.id} --entries-json '{"leaf_id":"${node.id}","classification":"approved|iterate|defer|ambiguous","evidence":"<the user's words>"}'`,
    '  (Or pass {"response":"<raw user text>"} to use the deterministic first-pass classifier.)'
  ].join('\n');
  return { ok: true, status: STATUS, mode: 'review-plan', leaf_id: node.id, title: node.title || '', text };
}

// COMMIT mode — classify (agent-authoritative if `classification` given, else the
// first-pass over `response`) and transition status accordingly.
function normalizeReviewEntries(entries) {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return { ok: false, reason: 'invalid-entries', text: 'review commit requires a JSON object.' };
  }
  if (typeof entries.leaf_id !== 'string' || entries.leaf_id.trim() === '') {
    return { ok: false, reason: 'missing-leaf-id', text: 'review entries require a non-empty leaf_id.' };
  }
  let classification = null;
  let evidence = typeof entries.evidence === 'string' ? entries.evidence : null;
  let source;
  if (entries.classification != null) {
    if (!CLASSIFICATIONS.includes(entries.classification)) {
      return { ok: false, reason: 'invalid-classification', text: `classification must be one of ${CLASSIFICATIONS.join(' / ')}.` };
    }
    classification = entries.classification;
    source = 'agent';
  } else if (typeof entries.response === 'string') {
    const first = classifyUserResponse(entries.response);
    classification = first.classification;
    evidence = evidence || `${first.evidence.rule}: ${first.evidence.matched.join(', ')}`;
    source = 'first-pass';
  } else {
    return { ok: false, reason: 'missing-signal', text: 'review entries require either a classification (agent-authoritative) or a raw response (first-pass).' };
  }
  return { ok: true, leaf_id: entries.leaf_id.trim(), classification, evidence, source };
}

function applyReviewResponse(rootDir, entries, opts) {
  const norm = normalizeReviewEntries(entries);
  if (!norm.ok) return { ok: false, status: STATUS, mode: 'commit', reason: norm.reason, text: norm.text };
  const opened = openState(rootDir);
  if (!opened.ok) return { ok: false, status: STATUS, mode: 'commit', reason: opened.reason, text: opened.text };
  const node = findLeaf(opened.parsed.tree, norm.leaf_id);
  if (!node) return { ok: false, status: STATUS, mode: 'commit', reason: 'leaf-not-found', text: `No node with id "${norm.leaf_id}".` };
  if (!isLeaf(node)) return { ok: false, status: STATUS, mode: 'commit', reason: 'not-a-leaf', text: `${node.id} is a container, not a leaf.` };

  // Ambiguous → NEVER transition; re-prompt with numbered options (hard rule 8).
  if (norm.classification === 'ambiguous') {
    const text = [
      `I'm not sure how to read that for ${node.id}. Pick one:`,
      '',
      '  (1) approve as-is — mark it done.',
      '  (2) describe the change — iterate.',
      '  (3) defer — come back to this later.',
      '  (4) Other — describe what you want.'
    ].join('\n');
    return { ok: true, status: STATUS, mode: 'review-commit', leaf_id: node.id, classification: 'ambiguous', transitioned: false, status_after: node.status || 'awaiting-review', source: norm.source, text };
  }

  let statusAfter;
  let out;
  if (norm.classification === 'approved') {
    statusAfter = 'done';
    out = [
      `${node.id} approved → marked done.`,
      '',
      'Next:',
      `  (1) /ovd-go — check whether closing ${node.id} closes its parent (recursive close).`,
      '  (2) /ovd-go continue — move to the next leaf.',
      '  (3) Other — describe what you want.'
    ].join('\n');
  } else if (norm.classification === 'iterate') {
    statusAfter = 'in-progress';
    out = [
      `${node.id} → iterating (status in-progress). Feedback captured: ${norm.evidence || '(see conversation)'}.`,
      '',
      'Next:',
      `  (1) /ovd-go execute ${node.id} — re-execute applying the feedback as a delta.`,
      '  (2) Other — describe what you want.'
    ].join('\n');
  } else { // defer
    statusAfter = node.status || 'awaiting-review';
    out = [
      `${node.id} deferred — left as ${statusAfter}; not promoted.`,
      '',
      'Next:',
      '  (1) /ovd-go — orient and pick a different node.',
      '  (2) /ovd-log — checkpoint.',
      '  (3) Other — describe what you want.'
    ].join('\n');
  }

  const transitioned = statusAfter !== node.status;
  if (transitioned) {
    node.status = statusAfter;
    const committed = commitState(rootDir, opened);
    if (!committed.ok) return { ok: false, status: STATUS, mode: 'commit', reason: committed.reason, text: committed.text };
  }

  return { ok: true, status: STATUS, mode: 'review-commit', leaf_id: node.id, classification: norm.classification, transitioned, status_after: statusAfter, source: norm.source, evidence: norm.evidence, text: out };
}

function runReview(rootDir, opts = {}) {
  if (!rootDir || typeof rootDir !== 'string') {
    return { ok: false, status: STATUS, reason: 'invalid-project-dir', text: 'runReview requires a project directory string.' };
  }
  const mode = opts.mode || (opts.entries ? 'commit' : 'plan');
  if (mode === 'commit') return applyReviewResponse(rootDir, opts.entries, opts);
  return buildReviewPlan(rootDir, opts.leafId || opts.ref || null, opts);
}

module.exports = {
  STATUS,
  CLASSIFICATIONS,
  APPROVAL_TOKENS,
  DEFER_TOKENS,
  CONTRADICTION_TOKENS,
  CHANGE_TOKENS,
  matchAny,
  classifyUserResponse,
  presentForReview,
  buildReviewPlan,
  normalizeReviewEntries,
  applyReviewResponse,
  runReview
};
