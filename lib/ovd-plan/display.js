'use strict';

const fs = require('fs');
const path = require('path');

const { OVD_PLAN_FILE } = require('./fs');
const { parseOverdriveMd, ParseError } = require('./parser');

const STATUS_SYMBOLS = {
  'done':            '✓',
  'pending':         '·',
  'in-progress':     '~',
  'awaiting-review': '?',
  'blocked':         '⚠',
  'skipped':         '—',
  'mixed':           '≈'
};

const ACTIVE_TRAILER = '   → ACTIVE';
const FALLBACK_SYMBOL = '?';
const RESET_CODE = '\x1b[0m';

const COLOR_CODES = {
  'done':            '\x1b[32m',
  'pending':         '\x1b[37m',
  'in-progress':     '\x1b[36m',
  'awaiting-review': '\x1b[33m',
  'blocked':         '\x1b[31m',
  'skipped':         '\x1b[90m',
  'mixed':           '\x1b[35m'
};

const RECOMMENDATION_KINDS = [
  'empty',
  'active-awaiting-review',
  'active-in-progress',
  'active-blocked',
  'active-other',
  'pending-no-active',
  'all-closed'
];

const COUNTED_STATUSES = ['done', 'pending', 'in-progress', 'awaiting-review', 'blocked', 'skipped', 'mixed'];
const CLOSED_STATUSES = new Set(['done', 'skipped']);

function symbolFor(status, opts) {
  const symbol = STATUS_SYMBOLS[status] || FALLBACK_SYMBOL;
  if (opts && opts.color && COLOR_CODES[status]) {
    return `${COLOR_CODES[status]}${symbol}${RESET_CODE}`;
  }
  return symbol;
}

function aggregateCounts(tree) {
  const counts = {
    total: 0,
    done: 0,
    pending: 0,
    inProgress: 0,
    awaitingReview: 0,
    blocked: 0,
    skipped: 0,
    mixed: 0
  };
  function walk(node) {
    for (const child of node.children || []) {
      counts.total += 1;
      switch (child.status) {
        case 'done': counts.done += 1; break;
        case 'pending': counts.pending += 1; break;
        case 'in-progress': counts.inProgress += 1; break;
        case 'awaiting-review': counts.awaitingReview += 1; break;
        case 'blocked': counts.blocked += 1; break;
        case 'skipped': counts.skipped += 1; break;
        case 'mixed': counts.mixed += 1; break;
        default: counts.pending += 1; break;
      }
      walk(child);
    }
  }
  walk(tree);
  return counts;
}

function formatCounts(counts) {
  const parts = [`${counts.total} nodes`];
  if (counts.done) parts.push(`${counts.done} done`);
  if (counts.inProgress) parts.push(`${counts.inProgress} in-progress`);
  if (counts.awaitingReview) parts.push(`${counts.awaitingReview} awaiting-review`);
  if (counts.pending) parts.push(`${counts.pending} pending`);
  if (counts.blocked) parts.push(`${counts.blocked} blocked`);
  if (counts.skipped) parts.push(`${counts.skipped} skipped`);
  if (counts.mixed) parts.push(`${counts.mixed} mixed`);
  return parts.join(' · ');
}

function findActiveNode(tree) {
  function walk(node) {
    for (const child of node.children || []) {
      if (child.active) return child;
      const deeper = walk(child);
      if (deeper) return deeper;
    }
    return null;
  }
  return walk(tree);
}

function isAgentInserted(node) {
  return !!(node.annotations && node.annotations.inserted_by === 'agent');
}

function isNodeClosed(node) {
  if (CLOSED_STATUSES.has(node.status)) return true;
  if (!node.children || node.children.length === 0) {
    return CLOSED_STATUSES.has(node.status);
  }
  return node.children.every(isNodeClosed);
}

function analyzeTree(parsed) {
  const tree = parsed.tree;
  const counts = aggregateCounts(tree);
  const activeNode = findActiveNode(tree);

  if (counts.total === 0) {
    return { kind: 'empty', activeNode: null, counts, isEmpty: true };
  }

  if (activeNode) {
    let kind;
    switch (activeNode.status) {
      case 'awaiting-review': kind = 'active-awaiting-review'; break;
      case 'in-progress':     kind = 'active-in-progress'; break;
      case 'blocked':         kind = 'active-blocked'; break;
      default:                kind = 'active-other'; break;
    }
    return { kind, activeNode, counts, isEmpty: false };
  }

  const allClosed = (tree.children || []).every(isNodeClosed);
  if (allClosed) {
    return { kind: 'all-closed', activeNode: null, counts, isEmpty: false };
  }

  return { kind: 'pending-no-active', activeNode: null, counts, isEmpty: false };
}

function renderRecommendation(state) {
  const lines = ['Next steps:'];
  const activeId = state.activeNode ? state.activeNode.id : '';
  switch (state.kind) {
    case 'empty':
      lines.push('  (1) /ovd-plan deliberate — start a Socratic planning session');
      lines.push('  (2) /ovd-plan import "<path>" — import an existing plan document');
      lines.push('  (3) /ovd-plan idea "<description>" — capture an early idea');
      lines.push('  (4) describe other (or describe what you want)');
      break;
    case 'active-awaiting-review':
      lines.push(`  (1) /ovd-go verify ${activeId} — run the verification step`);
      lines.push(`  (2) /ovd-go ${activeId} — continue iterating`);
      lines.push('  (3) /ovd-log — checkpoint current state');
      lines.push('  (4) describe other (or describe what you want)');
      break;
    case 'active-in-progress':
      lines.push(`  (1) /ovd-go ${activeId} — continue work on the active node`);
      lines.push('  (2) /ovd-plan edit — adjust the plan');
      lines.push('  (3) /ovd-log — checkpoint current state');
      lines.push('  (4) describe other (or describe what you want)');
      break;
    case 'active-blocked':
      lines.push(`  (1) /ovd-plan edit — resolve the blocker on ${activeId}`);
      lines.push('  (2) /ovd-go next — work on a different node');
      lines.push('  (3) /ovd-log — checkpoint current state');
      lines.push('  (4) describe other (or describe what you want)');
      break;
    case 'active-other':
      lines.push(`  (1) /ovd-go ${activeId} — work on the active node`);
      lines.push('  (2) /ovd-plan edit — adjust the plan');
      lines.push('  (3) /ovd-log — checkpoint current state');
      lines.push('  (4) describe other (or describe what you want)');
      break;
    case 'pending-no-active':
      lines.push('  (1) /ovd-go — start work on the next available node');
      lines.push('  (2) /ovd-plan edit — adjust the plan first');
      lines.push('  (3) /ovd-log — checkpoint current state');
      lines.push('  (4) describe other (or describe what you want)');
      break;
    case 'all-closed':
      lines.push('  (1) /ovd-log handoff — wrap up and prepare handoff');
      lines.push('  (2) /ovd-plan idea "<description>" — propose a new direction');
      lines.push('  (3) /ovd-plan edit — extend the plan');
      lines.push('  (4) describe other (or describe what you want)');
      break;
    default:
      lines.push('  (1) /ovd-go — continue the work');
      lines.push('  (2) /ovd-plan edit — adjust the plan');
      lines.push('  (3) /ovd-log — checkpoint current state');
      lines.push('  (4) describe other (or describe what you want)');
      break;
  }
  return lines.join('\n');
}

function renderTreeBody(tree, opts) {
  const useColor = !!(opts && opts.color);
  const lines = [];
  function walk(node) {
    for (const child of node.children || []) {
      const indent = ' '.repeat((child.depth - 2) * 2);
      const symbol = symbolFor(child.status, { color: useColor });
      const id = child.id || child.explicitId || '';
      const title = child.title || '';
      const agentTag = isAgentInserted(child) ? ' [agent]' : '';
      const activeTrailer = child.active ? ACTIVE_TRAILER : '';
      lines.push(`${indent}${symbol} ${id}  ${title}${agentTag}${activeTrailer}`);
      walk(child);
    }
  }
  walk(tree);
  return lines.join('\n');
}

function getProjectTitle(parsed) {
  if (parsed.tree && parsed.tree.title) return parsed.tree.title;
  if (parsed.frontmatter && parsed.frontmatter.project) return parsed.frontmatter.project;
  return 'Untitled';
}

function buildDisplay(parsed, opts) {
  const title = getProjectTitle(parsed);
  const separator = '─'.repeat(title.length);
  const state = analyzeTree(parsed);
  const countsLine = formatCounts(state.counts);
  const treeBody = renderTreeBody(parsed.tree, opts);
  const activeNode = state.activeNode;
  const activeLine = activeNode
    ? `Active: ${activeNode.id} ${activeNode.title || ''} (${activeNode.status || 'pending'})`.replace(/\s+\(/, ' (')
    : 'Active: (none)';
  const recommendation = renderRecommendation(state);

  const sections = [title, separator, countsLine, ''];
  if (treeBody) {
    sections.push(treeBody, '');
  }
  sections.push(activeLine, '', recommendation);

  return {
    ok: true,
    text: sections.join('\n'),
    counts: state.counts,
    recommendation: state.kind,
    activeNode: activeNode || null
  };
}

function runDisplay(projectDir, opts) {
  if (!projectDir || typeof projectDir !== 'string') {
    return {
      ok: false,
      status: 'display',
      reason: 'invalid-project-dir',
      text: 'runDisplay requires a project directory string.'
    };
  }
  const planPath = path.join(projectDir, OVD_PLAN_FILE);
  if (!fs.existsSync(planPath)) {
    return {
      ok: false,
      status: 'display',
      reason: 'missing-plan',
      text: `OVERDRIVE.md not found at ${planPath}. Run /ovd-workflow init first, or /ovd-plan deliberate to start a fresh plan.`
    };
  }
  let content;
  try {
    content = fs.readFileSync(planPath, 'utf8');
  } catch (err) {
    return {
      ok: false,
      status: 'display',
      reason: 'read-error',
      text: `Could not read ${planPath}: ${err.message}`
    };
  }
  let parsed;
  try {
    parsed = parseOverdriveMd(content);
  } catch (err) {
    const isParse = err instanceof ParseError;
    return {
      ok: false,
      status: 'display',
      reason: isParse ? 'parse-error' : 'unknown-error',
      text: `OVERDRIVE.md could not be parsed: ${err.message}`
    };
  }
  const built = buildDisplay(parsed, opts);
  return {
    ok: true,
    status: 'display',
    text: built.text,
    counts: built.counts,
    recommendation: built.recommendation,
    activeNode: built.activeNode
  };
}

module.exports = {
  STATUS_SYMBOLS,
  ACTIVE_TRAILER,
  FALLBACK_SYMBOL,
  RESET_CODE,
  COLOR_CODES,
  RECOMMENDATION_KINDS,
  COUNTED_STATUSES,
  symbolFor,
  aggregateCounts,
  formatCounts,
  findActiveNode,
  isAgentInserted,
  isNodeClosed,
  analyzeTree,
  renderRecommendation,
  renderTreeBody,
  getProjectTitle,
  buildDisplay,
  runDisplay
};
