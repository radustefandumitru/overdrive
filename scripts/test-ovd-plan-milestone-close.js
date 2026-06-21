#!/usr/bin/env node
'use strict';

// Task 5.6 — MILESTONE CLOSE cascade (r3 §7.6 steps 7–10).
// LEARNINGS EXTRACT → RELEASE PREP (if release) → ARCHIVE (verbatim) → summary.
// Pattern-1: the learnings narrative is agent-side; the CLI computes signals,
// persists the summary, and moves the subtree to the archive section.

const fs = require('fs');
const os = require('os');
const path = require('path');

const mc = require('../lib/ovd-plan/milestone-close');
const {
  STATUS,
  isReleaseMilestone,
  gatherSignals,
  buildMilestoneClosePlan,
  normalizeMilestoneEntries,
  applyMilestoneClose,
  runMilestoneClose
} = mc;

const { parseOverdriveMd } = require('../lib/ovd-plan/parser');

const verbose = process.argv.includes('--verbose');
let passed = 0;
const failures = [];
function check(label, condition, detail) {
  if (condition) { passed += 1; if (verbose) console.log(`PASS ${label}`); }
  else { failures.push(detail ? `${label}: ${detail}` : label); console.log(`FAIL ${label}`); }
}

const FRONT = '---\novd-plan: true\nversion: 3\nproject: "Test Project"\n---\n\n';
function fixture({ release = false, dispositions } = {}) {
  const d = dispositions || { 'II.1': 'done', 'II.2': 'done' };
  const rel = release ? '\n```yaml ovd-plan\nrelease: true\n```\n' : '';
  return `${FRONT}# Test Project

## I. Foundation [done]

### I.1 Setup [done]

## II. Dashboard [done]${rel}
### II.1 Data [${d['II.1']}]
\`\`\`yaml ovd-plan
iterations:
  - n: 1
  - n: 2
\`\`\`

### II.2 Stats [${d['II.2']}]
\`\`\`yaml ovd-plan
iterations:
  - n: 1
\`\`\`
`;
}

function makeProject(name, content) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-mc-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), content === undefined ? fixture() : content);
  return { projectDir, tmpRoot };
}
function cleanup(tmpRoot) { fs.rmSync(tmpRoot, { recursive: true, force: true }); }
function readPlan(p) { return fs.readFileSync(path.join(p, 'OVERDRIVE.md'), 'utf8'); }
function tree(p) { return parseOverdriveMd(readPlan(p)).tree; }
function findNode(p, id) {
  const flat = [];
  (function walk(n) { for (const c of n.children || []) { flat.push(c); walk(c); } })(tree(p));
  return flat.find((x) => x.id === id) || null;
}
function reportPath(p, n) { return path.join(p, '.overdrive', 'reports', `milestone-${n}-summary.md`); }

// --- isReleaseMilestone -------------------------------------------------
(function () {
  check('release:true detected', isReleaseMilestone({ annotations: { release: true } }) === true);
  check('release:"v2" detected', isReleaseMilestone({ annotations: { release: 'v2.0' } }) === true);
  check('no release → false', isReleaseMilestone({ annotations: {} }) === false);
  check('release:false → false', isReleaseMilestone({ annotations: { release: false } }) === false);
  check('no annotations → false', isReleaseMilestone({}) === false);
})();

// --- gatherSignals ------------------------------------------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('signals');
  const milestone = findNode(projectDir, 'II');
  const sig = gatherSignals(projectDir, milestone);
  check('signals leaf count 2', sig.leafCount === 2, String(sig.leafCount));
  check('signals done count 2', sig.statusCounts.done === 2, JSON.stringify(sig.statusCounts));
  check('signals total iterations 3', sig.totalIterations === 3, String(sig.totalIterations));
  check('signals all closed', sig.allClosed === true);
  cleanup(tmpRoot);
})();

// --- buildMilestoneClosePlan --------------------------------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('plan');
  const res = buildMilestoneClosePlan(projectDir, { milestoneId: 'II' });
  check('plan ok', res.ok === true, JSON.stringify(res));
  check('plan mode', res.mode === 'plan');
  check('plan milestone II', res.milestone_id === 'II');
  check('plan reports iteration signal', /iteration/i.test(res.text) && /3/.test(res.text));
  check('plan asks for learnings', /learnings/i.test(res.text));
  check('plan mentions --entries-json', /--entries-json/.test(res.text));
  check('plan not a release', res.is_release === false);
  cleanup(tmpRoot);
})();

(function () {
  const { projectDir, tmpRoot } = makeProject('plan-release', fixture({ release: true }));
  const res = buildMilestoneClosePlan(projectDir, { milestoneId: 'II' });
  check('release plan flagged', res.is_release === true);
  check('release plan mentions pre-launch-checklist', /pre-launch-checklist/i.test(res.text));
  check('release plan mentions release prep', /release prep/i.test(res.text));
  cleanup(tmpRoot);
})();

// --- Q5.11 empty/abandoned milestone ------------------------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('abandoned', fixture({ dispositions: { 'II.1': 'skipped', 'II.2': 'blocked' } }));
  const res = buildMilestoneClosePlan(projectDir, { milestoneId: 'II' });
  check('abandoned plan ok', res.ok === true);
  check('abandoned flagged', res.abandoned_candidate === true, JSON.stringify(res));
  check('abandoned offers numbered options', /\(1\)/.test(res.text) && /abandoned/i.test(res.text));
  check('abandoned offers replan', /replan/i.test(res.text));
  cleanup(tmpRoot);
})();

// --- unknown / non-milestone -------------------------------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('unknown');
  check('unknown milestone → not ok', buildMilestoneClosePlan(projectDir, { milestoneId: 'ZZ' }).ok === false);
  check('leaf as milestone → not ok', buildMilestoneClosePlan(projectDir, { milestoneId: 'II.1' }).ok === false);
  cleanup(tmpRoot);
})();

// --- normalize ----------------------------------------------------------
(function () {
  check('normalize rejects array', normalizeMilestoneEntries([]).ok === false);
  const ok = normalizeMilestoneEntries({ learnings: { what_worked: ['a'], friction: ['b'], skill_accuracy: 'good', notes: ['n'] } });
  check('normalize accepts learnings', ok.ok === true);
  check('normalize default disposition done', ok.disposition === 'done');
  const ab = normalizeMilestoneEntries({ disposition: 'abandoned', learnings: {} });
  check('normalize abandoned disposition', ab.disposition === 'abandoned');
  const bad = normalizeMilestoneEntries({ disposition: 'frobnicate' });
  check('normalize rejects bad disposition', bad.ok === false);
})();

// --- COMMIT: cascade (learnings + archive + summary) --------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('commit');
  const res = applyMilestoneClose(projectDir, {
    milestoneId: 'II',
    entries: {
      learnings: { what_worked: ['clean tree'], friction: ['skill ambiguity on II.2'], skill_accuracy: 'mostly accurate', notes: ['n1'] }
    }
  }, { now: '2026-06-21T16:00:00.000Z' });

  check('commit ok', res.ok === true, JSON.stringify(res));
  check('commit mode', res.mode === 'milestone-close', res.mode);

  // ARCHIVE: milestone removed from active tree
  check('milestone II removed from active tree', findNode(projectDir, 'II') === null);
  check('milestone I still present', findNode(projectDir, 'I') !== null);

  // ARCHIVE section contains the subtree verbatim (status + annotations preserved)
  const plan = readPlan(projectDir);
  check('archive section present', /<!-- ovd-plan:archive:start -->/.test(plan));
  check('archive contains Dashboard', /Dashboard/.test(plan.split('archive:start')[1] || ''));
  check('archive preserves leaf status [done]', /II\.1 Data \[done\]/.test(plan));
  check('archive preserves iterations annotation', /iterations:/.test(plan.split('archive:start')[1] || ''));

  // SUMMARY report
  const rp = reportPath(projectDir, 'II');
  check('summary report written', fs.existsSync(rp));
  const summary = fs.readFileSync(rp, 'utf8');
  check('summary has what worked', /clean tree/.test(summary));
  check('summary has friction', /skill ambiguity/.test(summary));
  check('summary has signals (iterations)', /iteration/i.test(summary) && /3/.test(summary));
  check('summary names milestone', /Dashboard/.test(summary));
  check('result references report path', /milestone-II-summary\.md/.test(res.text) || /reports/.test(res.text));
  cleanup(tmpRoot);
})();

// --- COMMIT: release milestone runs release prep into summary -----------
(function () {
  const { projectDir, tmpRoot } = makeProject('commit-release', fixture({ release: true }));
  const res = applyMilestoneClose(projectDir, {
    milestoneId: 'II',
    entries: { learnings: { what_worked: ['x'] }, release_prep: { checklist: ['build: pass', 'changelog: updated'] } }
  }, { now: '2026-06-21T16:00:00.000Z' });
  check('release commit ok', res.ok === true);
  const summary = fs.readFileSync(reportPath(projectDir, 'II'), 'utf8');
  check('summary has release prep section', /release prep/i.test(summary));
  check('summary lists checklist item', /changelog: updated/.test(summary));
  cleanup(tmpRoot);
})();

// --- COMMIT: abandoned disposition --------------------------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('commit-abandoned', fixture({ dispositions: { 'II.1': 'skipped', 'II.2': 'blocked' } }));
  const res = applyMilestoneClose(projectDir, {
    milestoneId: 'II',
    entries: { disposition: 'abandoned', learnings: { notes: ['dropped scope'] } }
  }, { now: '2026-06-21T16:00:00.000Z' });
  check('abandoned commit ok', res.ok === true);
  const summary = fs.readFileSync(reportPath(projectDir, 'II'), 'utf8');
  check('summary marks abandoned', /abandoned/i.test(summary));
  check('abandoned still archived', /<!-- ovd-plan:archive:start -->/.test(readPlan(projectDir)));
  cleanup(tmpRoot);
})();

// --- COMMIT: unknown milestone → no write -------------------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('commit-unknown');
  const before = readPlan(projectDir);
  const res = applyMilestoneClose(projectDir, { milestoneId: 'ZZ', entries: { learnings: {} } }, {});
  check('unknown → not ok', res.ok === false);
  check('unknown → tree unchanged', readPlan(projectDir) === before);
  cleanup(tmpRoot);
})();

// --- dispatch -----------------------------------------------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('dispatch');
  const plan = runMilestoneClose(projectDir, { milestoneId: 'II' });
  check('dispatch → plan', plan.mode === 'plan');
  const commit = runMilestoneClose(projectDir, { milestoneId: 'II', entries: { learnings: { what_worked: ['x'] } }, now: '2026-06-21T16:00:00.000Z' });
  check('dispatch entries → commit', commit.mode === 'milestone-close');
  check('dispatch invalid project dir', runMilestoneClose(null, {}).ok === false);
  cleanup(tmpRoot);
})();

// --- migration-compat seam (Pattern 5) ----------------------------------
(function () {
  // Pre-existing archive content must be preserved when a new milestone is archived.
  const withArchive = fixture().replace(
    '\n## II. Dashboard',
    '\n<!-- ovd-plan:archive:start -->\n## Archived: Milestone Zero\n\nold archived content\n<!-- ovd-plan:archive:end -->\n\n## II. Dashboard'
  );
  const { projectDir, tmpRoot } = makeProject('migrate-seam', withArchive);
  const res = applyMilestoneClose(projectDir, { milestoneId: 'II', entries: { learnings: { what_worked: ['x'] } } }, { now: '2026-06-21T16:00:00.000Z' });
  check('migrate-seam ok', res.ok === true, JSON.stringify(res));
  const plan = readPlan(projectDir);
  check('migrate-seam preserved prior archive', /Milestone Zero/.test(plan) && /old archived content/.test(plan));
  check('migrate-seam appended new archive', /Dashboard/.test(plan.split('archive:start')[1] || ''));
  cleanup(tmpRoot);
})();

// --- summary ------------------------------------------------------------
if (failures.length) {
  console.log(`\n${failures.length} FAILURES:`);
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`\n${passed} checks passed, ${failures.length} failed.`);
  process.exit(1);
}
console.log(`${passed} checks passed.`);
