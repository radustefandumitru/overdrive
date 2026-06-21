'use strict';

// Task 5.6 — MILESTONE CLOSE cascade  (r3 §7.6 steps 7–10)
//
// Triggered when the recursive close reaches a milestone and the user approves.
// Cascade (each stage distinct — FM #2, do not merge):
//   LEARNINGS EXTRACT → RELEASE PREP (if release milestone) → ARCHIVE → summary
//
// Pattern-1: the learnings narrative + release-prep checklist are agent-side
// (PLAN surfaces the computed signals + asks for them); COMMIT persists the
// summary report and moves the milestone subtree to the archive section.
//
// ARCHIVE preserves the subtree VERBATIM (Q5.6 / hard rule 7 — no summarization):
// it re-serializes via the canonical writer.writeNode (Pattern 2) — lossless, all
// statuses/annotations/children retained — and appends to the existing archive
// section without disturbing prior archived content.

const fs = require('fs');
const path = require('path');

const { openState, commitState } = require('./deliberation-state');
const { flattenNodes, isLeaf } = require('./noderef');
const { isNodeClosed } = require('./cache');
const { writeNode } = require('./writer');
const { ovdPath } = require('./fs');

const STATUS = 'log';
const DISPOSITIONS = ['done', 'abandoned'];

function nowIso(opts) {
  return (opts && opts.now) || new Date().toISOString();
}

function isReleaseMilestone(node) {
  const r = node && node.annotations ? node.annotations.release : undefined;
  return r === true || (typeof r === 'string' && r.trim() !== '');
}

function milestoneLeaves(milestone) {
  return flattenNodes(milestone).filter((n) => isLeaf(n));
}

function iterationCount(leaf) {
  const it = leaf.annotations ? leaf.annotations.iterations : undefined;
  if (Array.isArray(it)) return it.length;
  if (typeof it === 'number') return it;
  return 0;
}

function countSkillDeltaMentions(rootDir) {
  let count = 0;
  const dir = ovdPath(rootDir, 'sessions');
  let files;
  try { files = fs.readdirSync(dir); } catch (_) { return 0; }
  for (const f of files) {
    if (!f.endsWith('.md')) continue;
    try {
      const content = fs.readFileSync(path.join(dir, f), 'utf8');
      if (/skill[-_ ]?delta/i.test(content)) count += 1;
    } catch (_) { /* skip */ }
  }
  return count;
}

function gatherSignals(rootDir, milestone) {
  const leaves = milestoneLeaves(milestone);
  const statusCounts = {};
  let totalIterations = 0;
  for (const leaf of leaves) {
    const s = leaf.status || 'pending';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
    totalIterations += iterationCount(leaf);
  }
  return {
    leafCount: leaves.length,
    statusCounts,
    totalIterations,
    skillDeltaSessions: countSkillDeltaMentions(rootDir),
    allClosed: leaves.length > 0 && leaves.every(isNodeClosed)
  };
}

// ---------------------------------------------------------------------------
// Resolve milestone (depth-1 container)
// ---------------------------------------------------------------------------
function findMilestone(tree, id) {
  const want = typeof id === 'string' ? id.trim() : '';
  if (!want) return { ok: false, reason: 'missing-milestone-id', text: 'A milestone id is required.' };
  const node = (tree.children || []).find((c) => c.id === want);
  if (!node) return { ok: false, reason: 'milestone-not-found', text: `No milestone with id "${id}" at the top level.` };
  if (!node.children || node.children.length === 0) {
    return { ok: false, reason: 'not-a-milestone', text: `${id} is a leaf, not a milestone (top-level container).` };
  }
  return { ok: true, node };
}

// ---------------------------------------------------------------------------
// PLAN
// ---------------------------------------------------------------------------
function buildMilestoneClosePlan(rootDir, opts = {}) {
  const opened = openState(rootDir);
  if (!opened.ok) return { ok: false, status: STATUS, reason: opened.reason, text: opened.text };
  const found = findMilestone(opened.parsed.tree, opts.milestoneId);
  if (!found.ok) return { ok: false, status: STATUS, reason: found.reason, text: found.text };

  const milestone = found.node;
  const signals = gatherSignals(rootDir, milestone);
  const isRelease = isReleaseMilestone(milestone);
  const abandonedCandidate = signals.leafCount > 0 && !(signals.statusCounts.done > 0);

  const lines = [];
  lines.push(`MILESTONE CLOSE — ${milestone.id} ${milestone.title || ''}`.trimEnd());
  lines.push('');
  lines.push('Signals (computed):');
  lines.push(`  - Leaves: ${signals.leafCount} (${Object.entries(signals.statusCounts).map(([k, v]) => `${k}: ${v}`).join(', ') || 'none'})`);
  lines.push(`  - Total iterations: ${signals.totalIterations}`);
  lines.push(`  - Sessions mentioning skill-delta: ${signals.skillDeltaSessions}`);
  lines.push('');

  if (abandonedCandidate) {
    lines.push('All leaves are blocked/skipped — none done. This looks like an ABANDONED milestone, not a normal close.');
    lines.push('');
    lines.push('  (1) close as abandoned — archive with an abandoned marker.');
    lines.push('  (2) replan — adjust the milestone before closing.');
    lines.push('  (3) hold — defer closure.');
    lines.push('  (4) other — describe what you want.');
    lines.push('');
  }

  lines.push('Produce LEARNINGS for this milestone: what worked, friction, skill accuracy, notes.');
  if (isRelease) {
    lines.push('');
    lines.push('RELEASE PREP (this is a release milestone): run `pre-launch-checklist` and `jack-seo-launch-audit` if available; otherwise produce a pre-release checklist. Include the results.');
  }
  lines.push('');
  lines.push('Then re-invoke with --entries-json:');
  lines.push('  {');
  lines.push('    "learnings": { "what_worked": ["..."], "friction": ["..."], "skill_accuracy": "...", "notes": ["..."] },');
  if (isRelease) lines.push('    "release_prep": { "checklist": ["item: status"], "notes": "..." },');
  lines.push(`    "disposition": "${abandonedCandidate ? 'abandoned' : 'done'}"`);
  lines.push('  }');
  lines.push('');
  lines.push('ARCHIVE preserves the milestone subtree verbatim (no summarization). The summary report is the retrospective.');

  return {
    ok: true,
    status: STATUS,
    mode: 'plan',
    milestone_id: milestone.id,
    is_release: isRelease,
    abandoned_candidate: abandonedCandidate,
    signals,
    text: lines.join('\n')
  };
}

// ---------------------------------------------------------------------------
// NORMALIZE
// ---------------------------------------------------------------------------
function coerceArray(v) {
  if (Array.isArray(v)) return v.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim());
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}

function normalizeMilestoneEntries(entries) {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return { ok: false, reason: 'invalid-entries', text: 'milestone-close commit requires a JSON object.' };
  }
  const l = (entries.learnings && typeof entries.learnings === 'object' && !Array.isArray(entries.learnings)) ? entries.learnings : {};
  const learnings = {
    what_worked: coerceArray(l.what_worked),
    friction: coerceArray(l.friction),
    skill_accuracy: typeof l.skill_accuracy === 'string' ? l.skill_accuracy.trim() : '',
    notes: coerceArray(l.notes)
  };
  let release_prep = null;
  if (entries.release_prep && typeof entries.release_prep === 'object' && !Array.isArray(entries.release_prep)) {
    release_prep = {
      checklist: coerceArray(entries.release_prep.checklist),
      notes: typeof entries.release_prep.notes === 'string' ? entries.release_prep.notes.trim() : ''
    };
  }
  let disposition = 'done';
  if (entries.disposition !== undefined) {
    if (!DISPOSITIONS.includes(entries.disposition)) return { ok: false, reason: 'invalid-disposition', text: `disposition must be one of ${DISPOSITIONS.join(' / ')}.` };
    disposition = entries.disposition;
  }
  return { ok: true, learnings, release_prep, disposition };
}

// ---------------------------------------------------------------------------
// COMMIT
// ---------------------------------------------------------------------------
function serializeSubtree(node) {
  const lines = [];
  (function walk(n, isRoot) {
    lines.push(writeNode(n, isRoot));
    for (const child of n.children || []) {
      lines.push('');
      walk(child, false);
    }
  })(node, false);
  return lines.join('\n');
}

function buildSummary(milestone, signals, norm, isRelease, now) {
  const lines = [];
  lines.push(`# Milestone ${milestone.id} — ${milestone.title || ''} — Retrospective`.trimEnd());
  lines.push('');
  lines.push(`Closed: ${now} · Disposition: ${norm.disposition}`);
  lines.push('');
  lines.push('## Signals (computed)');
  lines.push(`- Leaves: ${signals.leafCount} (${Object.entries(signals.statusCounts).map(([k, v]) => `${k}: ${v}`).join(', ') || 'none'})`);
  lines.push(`- Total iterations: ${signals.totalIterations}`);
  lines.push(`- Sessions mentioning skill-delta: ${signals.skillDeltaSessions}`);
  lines.push('');
  lines.push('## What worked');
  if (norm.learnings.what_worked.length) for (const i of norm.learnings.what_worked) lines.push(`- ${i}`); else lines.push('- (none recorded)');
  lines.push('');
  lines.push('## Friction');
  if (norm.learnings.friction.length) for (const i of norm.learnings.friction) lines.push(`- ${i}`); else lines.push('- (none recorded)');
  lines.push('');
  lines.push('## Skill accuracy');
  lines.push(norm.learnings.skill_accuracy || '(not assessed)');
  if (norm.learnings.notes.length) {
    lines.push('');
    lines.push('## Notes');
    for (const i of norm.learnings.notes) lines.push(`- ${i}`);
  }
  if (isRelease) {
    lines.push('');
    lines.push('## Release prep');
    if (norm.release_prep && norm.release_prep.checklist.length) {
      for (const i of norm.release_prep.checklist) lines.push(`- ${i}`);
    } else {
      lines.push('- (no release-prep results recorded)');
    }
    if (norm.release_prep && norm.release_prep.notes) { lines.push(''); lines.push(norm.release_prep.notes); }
  }
  lines.push('');
  return lines.join('\n');
}

function applyMilestoneClose(rootDir, opts = {}) {
  const norm = normalizeMilestoneEntries(opts.entries);
  if (!norm.ok) return { ok: false, status: STATUS, mode: 'commit', reason: norm.reason, text: norm.text };

  const opened = openState(rootDir);
  if (!opened.ok) return { ok: false, status: STATUS, mode: 'commit', reason: opened.reason, text: opened.text };
  const found = findMilestone(opened.parsed.tree, opts.milestoneId);
  if (!found.ok) return { ok: false, status: STATUS, mode: 'commit', reason: found.reason, text: found.text };

  const milestone = found.node;
  const signals = gatherSignals(rootDir, milestone);
  const isRelease = isReleaseMilestone(milestone);
  const now = nowIso(opts);

  // ARCHIVE — re-serialize verbatim, append to the archive section, remove from tree.
  const subtree = serializeSubtree(milestone);
  const archiveBlock = `## Archived: ${milestone.id} ${milestone.title || ''} — closed ${now} (${norm.disposition})\n\n${subtree}`.replace(/ +\n/g, '\n');
  const priorArchive = opened.sections.archive || '';
  opened.sections.archive = priorArchive ? `${priorArchive.replace(/\s+$/, '')}\n\n${archiveBlock}` : archiveBlock;
  opened.parsed.tree.children = (opened.parsed.tree.children || []).filter((c) => c !== milestone);

  const committed = commitState(rootDir, opened);
  if (!committed.ok) return { ok: false, status: STATUS, mode: 'commit', reason: committed.reason, text: committed.text };

  // SUMMARY — write the retrospective report.
  const summary = buildSummary(milestone, signals, norm, isRelease, now);
  const reportsDir = ovdPath(rootDir, 'reports');
  const reportRel = path.join('.overdrive', 'reports', `milestone-${milestone.id}-summary.md`);
  let reportWritten = null;
  try {
    fs.mkdirSync(reportsDir, { recursive: true });
    fs.writeFileSync(ovdPath(rootDir, 'reports', `milestone-${milestone.id}-summary.md`), summary);
    reportWritten = reportRel;
  } catch (err) {
    reportWritten = null;
  }

  const out = [];
  out.push(`Milestone ${milestone.id} closed (${norm.disposition}) and archived verbatim.`);
  if (reportWritten) out.push(`Retrospective: ${reportRel}`);
  if (isRelease) out.push('Release milestone — release-prep results captured in the summary.');
  return {
    ok: true,
    status: STATUS,
    mode: 'milestone-close',
    milestone_id: milestone.id,
    disposition: norm.disposition,
    is_release: isRelease,
    archived: true,
    report: reportWritten,
    text: out.join('\n')
  };
}

function runMilestoneClose(rootDir, opts = {}) {
  if (!rootDir || typeof rootDir !== 'string') {
    return { ok: false, status: STATUS, reason: 'invalid-project-dir', text: 'runMilestoneClose requires a project directory string.' };
  }
  const mode = opts.mode || (opts.entries ? 'commit' : 'plan');
  if (mode === 'commit') return applyMilestoneClose(rootDir, opts);
  return buildMilestoneClosePlan(rootDir, opts);
}

module.exports = {
  STATUS,
  DISPOSITIONS,
  isReleaseMilestone,
  gatherSignals,
  findMilestone,
  serializeSubtree,
  buildMilestoneClosePlan,
  normalizeMilestoneEntries,
  applyMilestoneClose,
  runMilestoneClose
};
