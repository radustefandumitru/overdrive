'use strict';

const { openState, commitState } = require('./deliberation-state');
const { readCalibration } = require('./calibrate');
const { appendDecision } = require('./decisions-log');
const { appendUnderHeader } = require('./migrate');

const STATUS = 'idea';
const ACTIONS = ['approved', 'continue', 'research', 'reject'];

// Decision-row node identifier: 'IDEA: <word-boundary-truncated text>'.
// Per Q3.5 lock, IDEA decisions get a synthetic node identifier (not a real
// tree node ID) so the decisions table stays searchable / groupable when
// filtering for ideation history.
const NODE_PREFIX = 'IDEA: ';
const NODE_MAX_LEN = 80;
const INBOX_HEADER_IDEA_REJECTED = 'Ideas considered but not adopted (rejected)';

function envelope(payload) {
  return Object.assign({ status: STATUS }, payload);
}

function nowIso(opts) {
  return (opts && opts.now) || new Date().toISOString();
}

// Word-boundary truncation: slice at the last whitespace before maxLen-1,
// then append an ellipsis (mid-word truncation reads as malformed in the
// decisions.md table). If the last space is too early (would leave less than
// 1/3 of maxLen as body), hard-truncate the single very-long word instead.
function truncateAtWordBoundary(text, maxLen) {
  if (typeof text !== 'string') return '';
  if (text.length <= maxLen) return text;
  const slice = text.slice(0, maxLen - 1);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace < Math.floor(maxLen / 3)) return slice + '…';
  return slice.slice(0, lastSpace) + '…';
}

function nodeIdentifierFromIdea(ideaText) {
  const norm = String(ideaText || '').replace(/\s+/g, ' ').trim();
  const maxBodyLen = NODE_MAX_LEN - NODE_PREFIX.length;
  const body = truncateAtWordBoundary(norm, maxBodyLen);
  return NODE_PREFIX + body;
}

// Tree summary for plan-mode context: proposed_tree-first-fallback-to-committed
// per Q3.8.4 precedent (plan-quality.js:125). Returns terse one-liners suitable
// for the agent's impact-analysis prompt.
function summarizeProposedTree(opened) {
  if (!opened || !opened.ok) return { source: null, lines: [] };
  const inner = opened.innerObj || {};
  const proposed = inner.proposed_tree;
  if (proposed && Array.isArray(proposed.milestones) && proposed.milestones.length > 0) {
    return {
      source: 'proposed',
      lines: proposed.milestones.map((m) => `  ${m.id || '?'} ${m.title || '(untitled)'}`)
    };
  }
  const parsedTree = opened.parsed && opened.parsed.tree;
  if (parsedTree && Array.isArray(parsedTree.children) && parsedTree.children.length > 0) {
    const milestones = parsedTree.children.filter((c) => c && c.depth === 2);
    if (milestones.length > 0) {
      return {
        source: 'committed',
        lines: milestones.map((m) => `  ${m.id || '?'} ${m.title || '(untitled)'}`)
      };
    }
  }
  return { source: null, lines: [] };
}

function buildIdeaPlan(rootDir, opts = {}) {
  const ideaText = (opts.text || '').trim();

  if (!ideaText) {
    return envelope({
      ok: false,
      mode: 'plan',
      reason: 'missing-idea-text',
      text: 'Idea text is required. Invocation: overdrive plan idea "<your idea>".'
    });
  }

  // IDEA is tolerant of a missing plan (early-stage brainstorming with no
  // OVERDRIVE.md yet). Tree summary + calibration are best-effort.
  let treeSummary = { source: null, lines: [] };
  let calibration = null;

  const opened = openState(rootDir);
  if (opened.ok) {
    treeSummary = summarizeProposedTree(opened);
    try {
      calibration = readCalibration(rootDir);
    } catch (_err) {
      calibration = null;
    }
  }

  const lines = [];
  lines.push('IDEA — lightweight DELIBERATE + RESEARCH (per Q8)');
  lines.push('=================================================');
  lines.push('');
  lines.push(`Idea: ${ideaText}`);
  lines.push('');

  if (calibration) {
    lines.push('Calibration:');
    if (calibration.domain) lines.push(`  domain: ${calibration.domain}`);
    if (calibration.technical) lines.push(`  technical: ${calibration.technical}`);
    if (calibration.scope) lines.push(`  scope: ${calibration.scope}`);
    if (calibration.override) lines.push(`  override: ${calibration.override}`);
    lines.push('');
  }

  if (treeSummary.source) {
    lines.push(`Current tree (${treeSummary.source}):`);
    for (const l of treeSummary.lines) lines.push(l);
    lines.push('');
  } else {
    lines.push('No current tree found — early-stage idea (no impact-on-existing-nodes analysis).');
    lines.push('');
  }

  lines.push('Internal analysis (architect-level rigor, terse external render — per Q9 dual-presentation):');
  lines.push('  1. ANALYSE IMPACT (lightweight DELIBERATE):');
  lines.push('     - Affected existing nodes (if tree present)');
  lines.push('     - Addition / modification / removal classification');
  lines.push('     - Effort + risk estimate');
  lines.push('     - Dependencies / blockers');
  lines.push('     - Skills it would need');
  lines.push('  2. SURFACE TRADEOFFS (lightweight RESEARCH):');
  lines.push('     - Plain-language pros/cons');
  lines.push('     - Brief alternatives if applicable');
  lines.push('     - Suggested route (with reasoning)');
  lines.push('');
  lines.push('External render to user (per r3 §5.2 step 4):');
  lines.push(`  "Here's my read on \\"${ideaText}\\":`);
  lines.push('     <one-line impact summary>');
  lines.push('     <one-line tradeoff summary>');
  lines.push('     <suggested route, one line>');
  lines.push('');
  lines.push('   I can see four ways to proceed:');
  lines.push('   (1) approved — integrate as proposed. I\'ll record the decision and');
  lines.push('       recommend starting a fresh conversation with /ovd-plan edit.');
  lines.push('   (2) continue — keep deliberating; describe what\'s missing.');
  lines.push('   (3) research — needs deeper investigation; route to /ovd-plan research.');
  lines.push('   (4) other — describe what you want.');
  lines.push('');
  lines.push('   Reply with 1–4 or a custom direction."');
  lines.push('');
  lines.push('Note (Q3.10 sketch sub-state): sketch sub-state is Phase 6 — if this idea');
  lines.push("involves UI sketching, it will be recorded as an idea only; sketches won't");
  lines.push('be generated yet.');
  lines.push('');
  lines.push('Commit syntax (substitute the user-chosen action):');
  lines.push('  overdrive plan idea --entries-json \'{"action":"approved","idea_text":"...","impact_summary":"...","tradeoffs":"...","suggested_route":"...","decision_rationale":"..."}\'');
  lines.push('  overdrive plan idea --entries-json \'{"action":"continue","idea_text":"..."}\'');
  lines.push('  overdrive plan idea --entries-json \'{"action":"research","idea_text":"..."}\'');
  lines.push('  overdrive plan idea --entries-json \'{"action":"reject","idea_text":"...","rejection_reason":"..."}\'');

  return envelope({
    ok: true,
    mode: 'plan',
    idea_text: ideaText,
    tree_source: treeSummary.source,
    calibration,
    text: lines.join('\n')
  });
}

function normalizeIdeaEntries(rawEntries) {
  if (!rawEntries || typeof rawEntries !== 'object' || Array.isArray(rawEntries)) {
    return {
      ok: false,
      reason: 'invalid-shape',
      errors: ['entries must be a JSON object with at least { action, idea_text }']
    };
  }

  const errors = [];
  const out = {};

  if (!ACTIONS.includes(rawEntries.action)) {
    errors.push(`action must be one of: ${ACTIONS.join(', ')} (got "${rawEntries.action}")`);
  } else {
    out.action = rawEntries.action;
  }

  if (typeof rawEntries.idea_text !== 'string' || !rawEntries.idea_text.trim()) {
    errors.push('idea_text must be a non-empty string');
  } else {
    out.idea_text = rawEntries.idea_text.trim();
  }

  if (out.action === 'approved') {
    for (const field of ['impact_summary', 'tradeoffs', 'suggested_route']) {
      if (typeof rawEntries[field] !== 'string' || !rawEntries[field].trim()) {
        errors.push(`${field} must be a non-empty string when action="approved"`);
      } else {
        out[field] = rawEntries[field].trim();
      }
    }
    if (rawEntries.decision_rationale !== undefined) {
      if (typeof rawEntries.decision_rationale !== 'string') {
        errors.push('decision_rationale must be a string when present');
      } else if (rawEntries.decision_rationale.trim()) {
        out.decision_rationale = rawEntries.decision_rationale.trim();
      }
    }
  } else if (out.action === 'reject') {
    if (typeof rawEntries.rejection_reason !== 'string' || !rawEntries.rejection_reason.trim()) {
      errors.push('rejection_reason must be a non-empty string when action="reject"');
    } else {
      out.rejection_reason = rawEntries.rejection_reason.trim();
    }
  }
  // For 'continue' / 'research', only action + idea_text are required.

  if (errors.length > 0) {
    return { ok: false, reason: 'invalid-values', errors };
  }
  return { ok: true, entries: out };
}

function applyIdeaApproved(rootDir, entries, opts = {}) {
  const node = nodeIdentifierFromIdea(entries.idea_text);
  const decision = entries.suggested_route;
  const rationale = entries.decision_rationale || entries.impact_summary;
  const date = opts.now ? String(opts.now).slice(0, 10) : undefined;

  const result = appendDecision(rootDir, { date, node, decision, rationale });
  if (!result.ok) {
    return envelope({
      ok: false,
      mode: 'commit',
      action: 'approved',
      reason: result.reason || 'decision-append-failed',
      text: `Could not append decision: ${result.reason || 'unknown error'}`
    });
  }

  const handoff = [
    `Approved. Decision recorded to ${result.path}.`,
    '',
    'Recommend: start a fresh conversation and run /ovd-plan edit to integrate.',
    'Optionally run /ovd-log first to save current state.',
    '',
    `Decision row: ${node} → ${decision}`
  ].join('\n');

  return envelope({
    ok: true,
    mode: 'commit',
    action: 'approved',
    decision_node: node,
    decision_path: result.path,
    decision_row: result.row,
    text: handoff
  });
}

function applyIdeaContinue(_rootDir, entries) {
  const text = [
    'Continuing. Refine the idea direction:',
    `  "${entries.idea_text}"`,
    '',
    'Re-run /ovd-plan idea "<refined>" with what\'s missing, or describe the missing piece.'
  ].join('\n');
  return envelope({ ok: true, mode: 'commit', action: 'continue', text });
}

function applyIdeaResearch(_rootDir, entries) {
  const text = [
    'Routing to RESEARCH for deeper investigation.',
    `  Idea: "${entries.idea_text}"`,
    '',
    `Recommend: /ovd-plan research "${entries.idea_text}"`,
    '',
    '(After research lands, return here with /ovd-plan idea or escalate to /ovd-plan edit per r3 §5.5.)'
  ].join('\n');
  return envelope({ ok: true, mode: 'commit', action: 'research', text });
}

function applyIdeaReject(rootDir, entries, opts = {}) {
  // Reject requires an OVERDRIVE.md (inbox section lives there). For early-stage
  // IDEA against a no-plan project, reject surfaces missing-plan and asks the
  // user to initialize first.
  const opened = openState(rootDir);
  if (!opened.ok) {
    return envelope({
      ok: false,
      mode: 'commit',
      action: 'reject',
      reason: opened.reason,
      text: opened.text
    });
  }

  const now = nowIso(opts);
  const safeReason = entries.rejection_reason.replace(/[\r\n]+/g, ' ');
  const safeIdea = entries.idea_text.replace(/[\r\n]+/g, ' ');
  const bodyLine = `- [considered-but-not-adopted: idea-rejected: ${safeReason}] ${safeIdea} (${now})`;

  opened.sections.inbox = appendUnderHeader(
    opened.sections.inbox || '',
    INBOX_HEADER_IDEA_REJECTED,
    bodyLine
  );

  const committed = commitState(rootDir, opened);
  if (!committed.ok) {
    return envelope({
      ok: false,
      mode: 'commit',
      action: 'reject',
      reason: committed.reason,
      text: committed.text
    });
  }

  const text = [
    `Idea rejected. Logged to inbox under "${INBOX_HEADER_IDEA_REJECTED}".`,
    `  Idea: "${entries.idea_text}"`,
    `  Reason: ${entries.rejection_reason}`
  ].join('\n');

  return envelope({
    ok: true,
    mode: 'commit',
    action: 'reject',
    inbox_header: INBOX_HEADER_IDEA_REJECTED,
    text
  });
}

function applyIdeaAction(rootDir, entries, opts = {}) {
  switch (entries.action) {
    case 'approved': return applyIdeaApproved(rootDir, entries, opts);
    case 'continue': return applyIdeaContinue(rootDir, entries);
    case 'research': return applyIdeaResearch(rootDir, entries);
    case 'reject': return applyIdeaReject(rootDir, entries, opts);
    default: return envelope({
      ok: false,
      mode: 'commit',
      reason: 'invalid-action',
      text: `Unknown action: "${entries.action}"`
    });
  }
}

function runIdea(rootDir, opts = {}) {
  const isCommit = opts.mode === 'commit' || !!opts.entries;

  if (!isCommit) {
    return buildIdeaPlan(rootDir, opts);
  }

  const normalized = normalizeIdeaEntries(opts.entries);
  if (!normalized.ok) {
    return envelope({
      ok: false,
      mode: 'commit',
      reason: normalized.reason,
      errors: normalized.errors,
      text: `IDEA entries rejected: ${normalized.errors.join('; ')}`
    });
  }

  return applyIdeaAction(rootDir, normalized.entries, opts);
}

function formatPlan(result) { return (result && result.text) || '(no plan text)'; }
function formatCommit(result) { return (result && result.text) || '(no commit text)'; }

module.exports = {
  STATUS,
  ACTIONS,
  NODE_PREFIX,
  NODE_MAX_LEN,
  INBOX_HEADER_IDEA_REJECTED,
  truncateAtWordBoundary,
  nodeIdentifierFromIdea,
  summarizeProposedTree,
  buildIdeaPlan,
  normalizeIdeaEntries,
  applyIdeaApproved,
  applyIdeaContinue,
  applyIdeaResearch,
  applyIdeaReject,
  applyIdeaAction,
  runIdea,
  formatPlan,
  formatCommit
};
