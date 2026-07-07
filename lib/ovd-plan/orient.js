'use strict';

const fs = require('fs');
const path = require('path');

const { OVD_PLAN_FILE } = require('./fs');
const { parseOverdriveMd, ParseError } = require('./parser');
const {
  analyzeTree,
  findActiveNode,
  getProjectTitle
} = require('./display');

// ---------------------------------------------------------------------------
// Task 4.1 — `/ovd-go` ORIENT default behavior (r3 §6.1 + §6.2).
//
// Bare `/ovd-go` is an orient-and-continue command: it does NOT execute. It reads
// OVERDRIVE.md + the most recent session/handoff capture + surfaces the active
// node's scoped files, then renders an orientation with explicit numbered
// action paths (Pattern 7 — never silently continue; Q7 lock). The host agent
// reads the scoped codebase files; the CLI only surfaces which files are in
// scope (Pattern 1 — CLI does no LLM work, dumps no file contents).
//
// Tree analysis is reused from display.js (Pattern 2 — analyzeTree / findActiveNode
// / getProjectTitle). The action-path render here is ORIENT-specific (5-6 options
// keyed on active-node status per r3 §6.2), richer than DISPLAY's 4-option matrix.
// ---------------------------------------------------------------------------

const STATUS = 'go';
const SESSIONS_REL = path.join('.overdrive', 'sessions');
const HANDOFFS_REL = path.join('.overdrive', 'handoffs');

// Generic "latest file in a directory by mtime" (optionally pattern-filtered).
// No canonical exported primitive exists for this; reentry.js has a private,
// plan-quality-specific variant. Kept focused here; extract on rule-of-three.
function findLatestFile(dir, pattern) {
  if (!fs.existsSync(dir)) return null;
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch (err) {
    return null;
  }
  let latest = null;
  let latestMs = -Infinity;
  for (const f of entries) {
    if (pattern && !pattern.test(f)) continue;
    try {
      const stat = fs.statSync(path.join(dir, f));
      if (stat.isFile() && stat.mtimeMs > latestMs) {
        latest = f;
        latestMs = stat.mtimeMs;
      }
    } catch (err) { /* ignore unreadable entry */ }
  }
  return latest;
}

// Extract a terse summary from a session/handoff markdown file: the first few
// non-empty, non-heading, non-frontmatter content lines. Bounded — orientation
// stays brief (Principle 6: plain, short user surface).
function extractCaptureSummary(content, maxLines) {
  if (typeof content !== 'string' || content.length === 0) return [];
  const cap = typeof maxLines === 'number' ? maxLines : 3;
  const lines = content.split('\n');
  const out = [];
  let inFrontmatter = false;
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const line = raw.trim();
    if (i === 0 && line === '---') { inFrontmatter = true; continue; }
    if (inFrontmatter) {
      if (line === '---') inFrontmatter = false;
      continue;
    }
    if (line === '') continue;
    if (line.startsWith('#')) continue;
    if (line.startsWith('<!--')) continue;
    out.push(line.replace(/^[-*+]\s+/, ''));
    if (out.length >= cap) break;
  }
  return out;
}

// Read the most recent capture from a directory; returns { file, summary[] } or null.
function readLatestCapture(rootDir, rel) {
  const dir = path.join(rootDir, rel);
  const file = findLatestFile(dir);
  if (!file) return null;
  let content;
  try {
    content = fs.readFileSync(path.join(dir, file), 'utf8');
  } catch (err) {
    return { file, summary: [] };
  }
  return { file, summary: extractCaptureSummary(content) };
}

// Find the milestone (depth-1) ancestor of a node by id-prefix on the tree.
// The active node may be a leaf (II.2.a); its milestone is the depth-1 node
// whose id is the first hierarchical segment (II).
function findActiveMilestone(tree, activeNode) {
  if (!activeNode || !tree || !Array.isArray(tree.children)) return null;
  let found = null;
  function walk(node, milestone) {
    for (const child of node.children || []) {
      const asMilestone = milestone || (child.depth === 2 ? child : null);
      if (child === activeNode) { found = asMilestone || child; return true; }
      if (walk(child, asMilestone)) return true;
    }
    return false;
  }
  walk(tree, null);
  return found;
}

// The active node's in-scope files (writer-canonical `scope.in` per Q3.3A.10).
function activeScopeFiles(activeNode) {
  if (!activeNode || !activeNode.annotations) return [];
  const scope = activeNode.annotations.scope;
  if (!scope || !Array.isArray(scope.in)) return [];
  return scope.in.filter((p) => typeof p === 'string' && p.length > 0);
}

// ORIENT action paths — keyed on active-node status per r3 §6.2. Every branch
// ends with an "Other — describe" escape (Pattern 7). The awaiting-review branch
// matches the r3 §6.2 worked example (6 options).
function renderOrientActionPaths(state) {
  const lines = ['How would you like to continue?', ''];
  const active = state.activeNode;
  const id = active ? active.id : '';
  switch (state.kind) {
    case 'active-awaiting-review':
      lines.push(`  (1) Iterate on ${id} — describe the change and re-present.`);
      lines.push(`  (2) Mark ${id} 'approved' and advance to the next leaf.`);
      lines.push('  (3) Switch focus to a different node — name or describe it.');
      lines.push('  (4) Review the broader plan — show where things stand.');
      lines.push('  (5) Replan — adjust the tree before continuing.');
      lines.push('  (6) Other — describe what you want.');
      break;
    case 'active-in-progress':
      lines.push(`  (1) Continue work on ${id}.`);
      lines.push('  (2) Switch focus to a different node — name or describe it.');
      lines.push('  (3) Review the broader plan — show where things stand.');
      lines.push('  (4) Replan — adjust the tree before continuing.');
      lines.push('  (5) /ovd-log — checkpoint current state.');
      lines.push('  (6) Other — describe what you want.');
      break;
    case 'active-blocked':
      lines.push(`  (1) Resolve the blocker on ${id} — route to /ovd-plan edit.`);
      lines.push('  (2) Switch focus to a different node — name or describe it.');
      lines.push('  (3) Review the broader plan — show where things stand.');
      lines.push('  (4) /ovd-log — checkpoint current state.');
      lines.push('  (5) Other — describe what you want.');
      break;
    case 'active-other':
      lines.push(`  (1) Work on the active node ${id}.`);
      lines.push('  (2) Switch focus to a different node — name or describe it.');
      lines.push('  (3) Review the broader plan — show where things stand.');
      lines.push('  (4) Replan — adjust the tree before continuing.');
      lines.push('  (5) Other — describe what you want.');
      break;
    case 'pending-no-active':
      lines.push('  (1) Start work on the next pending leaf.');
      lines.push('  (2) Target a specific node — name or describe it.');
      lines.push('  (3) Review the broader plan — show where things stand.');
      lines.push('  (4) /ovd-log — checkpoint current state.');
      lines.push('  (5) Other — describe what you want.');
      break;
    case 'all-closed':
      lines.push('  (1) /ovd-log handoff — wrap up and prepare a handoff.');
      lines.push('  (2) /ovd-plan idea "<description>" — propose a new direction.');
      lines.push('  (3) /ovd-plan edit — extend the plan.');
      lines.push('  (4) Other — describe what you want.');
      break;
    case 'empty':
    default:
      lines.push('  (1) /ovd-plan deliberate — build a plan from scratch.');
      lines.push('  (2) /ovd-plan import "<path>" — import an existing plan document.');
      lines.push('  (3) /ovd-plan idea "<description>" — capture an early idea.');
      lines.push('  (4) Other — describe what you want.');
      break;
  }
  return lines.join('\n');
}

// Assemble the full orientation text per r3 §6.2.
function buildOrientation(parsed, rootDir, opts) {
  const title = getProjectTitle(parsed);
  const state = analyzeTree(parsed);
  const active = state.activeNode;
  const milestone = findActiveMilestone(parsed.tree, active);
  const session = readLatestCapture(rootDir, SESSIONS_REL);
  const handoff = readLatestCapture(rootDir, HANDOFFS_REL);
  const scopeFiles = activeScopeFiles(active);

  const lines = [`Project: ${title}`];
  if (milestone) {
    lines.push(`Milestone: ${milestone.id} ${milestone.title || ''}`.trimEnd());
  }
  if (active) {
    lines.push(`Active leaf: ${active.id} ${active.title || ''} [${active.status || 'pending'}]`.replace(/\s+\[/, ' ['));
  } else if (!state.isEmpty) {
    lines.push('Active leaf: (none set)');
  }

  const lastCapture = session || handoff;
  if (lastCapture) {
    const which = session ? 'session' : 'handoff';
    lines.push('', `Last ${which} summary (${lastCapture.file}):`);
    if (lastCapture.summary.length > 0) {
      for (const s of lastCapture.summary) lines.push(`  ${s}`);
    } else {
      lines.push('  (no summary content extracted)');
    }
  }

  const awaiting = state.counts.awaitingReview;
  if (awaiting > 0) {
    lines.push('', `Awaiting your review: ${awaiting} leaf${awaiting === 1 ? '' : 'ves'}.`);
  }

  if (scopeFiles.length > 0) {
    lines.push('', 'Active node scope (files to load):');
    for (const f of scopeFiles) {
      const exists = fs.existsSync(path.join(rootDir, f));
      lines.push(`  - ${f}${exists ? '' : ' (not found)'}`);
    }
  }

  lines.push('', renderOrientActionPaths(state));

  return {
    text: lines.join('\n'),
    kind: state.kind,
    activeNode: active || null,
    milestone: milestone || null,
    awaitingReview: awaiting,
    scopeFiles,
    counts: state.counts,
    lastSession: session ? session.file : null,
    lastHandoff: handoff ? handoff.file : null
  };
}

// Entry point — bare `/ovd-go` (ORIENT). Shortcut forms (`continue`, `<node-ref>`)
// bypass this and route directly (wired in Tasks 4.2 / 4.11).
function runGoDefault(rootDir, opts) {
  if (!rootDir || typeof rootDir !== 'string') {
    return { ok: false, status: STATUS, reason: 'invalid-project-dir', text: 'runGoDefault requires a project directory string.' };
  }
  const planPath = path.join(rootDir, OVD_PLAN_FILE);
  if (!fs.existsSync(planPath)) {
    return {
      ok: false,
      status: STATUS,
      reason: 'missing-plan',
      text: `OVERDRIVE.md not found at ${planPath}. Run /ovd-workflow init first, or /ovd-plan deliberate to start a plan.`
    };
  }
  let content;
  try {
    content = fs.readFileSync(planPath, 'utf8');
  } catch (err) {
    return { ok: false, status: STATUS, reason: 'read-error', text: `Could not read ${planPath}: ${err.message}` };
  }
  let parsed;
  try {
    parsed = parseOverdriveMd(content);
  } catch (err) {
    const isParse = err instanceof ParseError;
    return {
      ok: false,
      status: STATUS,
      reason: isParse ? 'parse-error' : 'unknown-error',
      text: `OVERDRIVE.md could not be parsed: ${err.message}`
    };
  }
  const built = buildOrientation(parsed, rootDir, opts);
  return {
    ok: true,
    status: STATUS,
    mode: 'orient',
    route: 'orient',
    text: built.text,
    kind: built.kind,
    activeNode: built.activeNode,
    milestone: built.milestone,
    awaitingReview: built.awaitingReview,
    scopeFiles: built.scopeFiles,
    counts: built.counts,
    lastSession: built.lastSession,
    lastHandoff: built.lastHandoff
  };
}

module.exports = {
  STATUS,
  SESSIONS_REL,
  HANDOFFS_REL,
  findLatestFile,
  extractCaptureSummary,
  readLatestCapture,
  findActiveMilestone,
  activeScopeFiles,
  renderOrientActionPaths,
  buildOrientation,
  runGoDefault
};
