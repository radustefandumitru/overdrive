#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const review = require('../lib/ovd-plan/review');
const {
  STATUS,
  CLASSIFICATIONS,
  matchAny,
  classifyUserResponse,
  presentForReview,
  buildReviewPlan,
  normalizeReviewEntries,
  applyReviewResponse,
  runReview
} = review;

const ovdPlan = require('../lib/ovd-plan');
const { parseOverdriveMd } = require('../lib/ovd-plan/parser');
const { findLeaf } = require('../lib/ovd-plan/execute');

const verbose = process.argv.includes('--verbose');
let passed = 0;
const failures = [];
function check(label, condition, detail) {
  if (condition) { passed += 1; if (verbose) console.log(`PASS ${label}`); }
  else { failures.push(detail ? `${label}: ${detail}` : label); console.log(`FAIL ${label}`); }
}

function makeTempProject(name) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-review-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
  return { projectDir, tmpRoot };
}
function cleanup(tmpRoot) { fs.rmSync(tmpRoot, { recursive: true, force: true }); }
function writePlan(projectDir, content) { fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), content); }
function readPlan(projectDir) { return fs.readFileSync(path.join(projectDir, 'OVERDRIVE.md'), 'utf8'); }
function leafStatus(projectDir, id) { return findLeaf(parseOverdriveMd(readPlan(projectDir)).tree, id).status; }

const FENCE = '```yaml ovd-plan';
const FRONT = '---\novd-plan: true\nversion: 3\nproject: "Test Project"\n---\n\n';
const FIXTURE = `${FRONT}# Test Project

## I. Foundation [in-progress]

### I.1 Widget layout [in-progress]

${FENCE}
success:
  - renders at 3 breakpoints
\`\`\`
`;
const FIXTURE_MIGRATION = '---\novd-plan: true\nversion: 3\nproject: "Migrated"\nactive_node: ""\n---\n\n# Migrated\n';

// ---------------------------------------------------------------------------
// 1. Module surface
// ---------------------------------------------------------------------------
console.log('Module surface');
check('STATUS === "go"', STATUS === 'go');
check('CLASSIFICATIONS = 4', JSON.stringify(CLASSIFICATIONS) === JSON.stringify(['approved', 'iterate', 'defer', 'ambiguous']));
for (const fn of ['matchAny', 'classifyUserResponse', 'presentForReview', 'buildReviewPlan', 'normalizeReviewEntries', 'applyReviewResponse', 'runReview']) {
  check(`${fn} exported`, typeof review[fn] === 'function');
}
check('ovdPlan.review namespace', ovdPlan.review === review);
check('ovdPlan.runReview wired', ovdPlan.runReview === runReview);
check('ovdPlan.classifyUserResponse wired', ovdPlan.classifyUserResponse === classifyUserResponse);

// ---------------------------------------------------------------------------
// 2. matchAny (word-boundary vs substring)
// ---------------------------------------------------------------------------
console.log('matchAny');
check('word-boundary match', matchAny('the next step', ['next']).length === 1);
check('no false substring (nextdoor)', matchAny('nextdoor neighbor', ['next']).length === 0);
check('multi-word substring', matchAny('please ship it now', ['ship it']).length === 1);
check('emoji substring', matchAny('great 👍', ['👍']).length === 1);
check('no match', matchAny('hello world', ['next', 'done']).length === 0);

// ---------------------------------------------------------------------------
// 3. classifyUserResponse — the fuzzy boundary (FM #5 near-misses)
// ---------------------------------------------------------------------------
console.log('classifyUserResponse');
const APPROVED = ['approved', 'approve', 'ship it', 'lgtm', 'looks good', 'good to go', 'done', 'next', 'perfect', '👍', 'Approved!', 'SHIP IT'];
const ITERATE = [
  'looks good but the color', 'approve once Y is changed', 'done, except the spacing',
  'lgtm though fix the title', 'looks good, make it smaller', 'make the title smaller',
  'increase the contrast', 'this is broken', 'add a tooltip', 'the font should be bigger',
  'reduce the padding', 'too cramped', 'redo the layout'
];
const DEFER = ['defer', 'come back to this', 'blocked on the API', 'skip for now', 'not now', 'set aside', 'hold off'];
const AMBIGUOUS = ['ok', 'yeah', 'hmm', 'yeah good', 'not sure', '', '   ', 'maybe'];
for (const s of APPROVED) check(`approved: "${s}"`, classifyUserResponse(s).classification === 'approved', classifyUserResponse(s).classification);
for (const s of ITERATE) check(`iterate: "${s}"`, classifyUserResponse(s).classification === 'iterate', classifyUserResponse(s).classification);
for (const s of DEFER) check(`defer: "${s}"`, classifyUserResponse(s).classification === 'defer', classifyUserResponse(s).classification);
for (const s of AMBIGUOUS) check(`ambiguous: "${s}"`, classifyUserResponse(s).classification === 'ambiguous', classifyUserResponse(s).classification);
check('evidence rule on clean approval', classifyUserResponse('approved').evidence.rule === 'clean-approval');
check('evidence rule on near-miss', classifyUserResponse('looks good but X').evidence.rule === 'approval-with-change');
check('non-string → ambiguous', classifyUserResponse(null).classification === 'ambiguous');

// ---------------------------------------------------------------------------
// 4. presentForReview
// ---------------------------------------------------------------------------
console.log('presentForReview');
{
  const node = findLeaf(parseOverdriveMd(FIXTURE).tree, 'I.1');
  const txt = presentForReview(node, ['src/Grid.tsx (new)'], { method: 'playwright_visual_regression', result: 'pass', findings: ['ok'] });
  check('shows id+title complete', /I\.1 Widget layout — implementation complete\./.test(txt));
  check('shows changes', /src\/Grid\.tsx \(new\)/.test(txt));
  check('shows verification', /Verification \(playwright_visual_regression\): pass/.test(txt));
  check('shows success criteria', /renders at 3 breakpoints/.test(txt));
  check("approval prompt 'approved'", /Reply 'approved' to mark this done/.test(txt));
  check('defer/replan options', /'defer'/.test(txt) && /'replan'/.test(txt));
}

// ---------------------------------------------------------------------------
// 5. buildReviewPlan (sets awaiting-review, persisted)
// ---------------------------------------------------------------------------
console.log('buildReviewPlan');
{
  const { projectDir, tmpRoot } = makeTempProject('plan');
  writePlan(projectDir, FIXTURE);
  const r = buildReviewPlan(projectDir, 'I.1', {});
  check('plan ok', r.ok === true && r.mode === 'review-plan');
  check('status set to awaiting-review (persisted)', leafStatus(projectDir, 'I.1') === 'awaiting-review');
  check('plan text has callback', /overdrive go review I\.1 --entries-json/.test(r.text));
  check('plan text mentions first-pass response option', /response/.test(r.text));
  check('not-a-leaf', buildReviewPlan(projectDir, 'I', {}).reason === 'not-a-leaf');
  check('leaf-not-found', buildReviewPlan(projectDir, 'Z.9', {}).reason === 'leaf-not-found');
  check('missing-ref', buildReviewPlan(projectDir, '', {}).reason === 'missing-ref');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('plan-noplan');
  check('missing-plan', buildReviewPlan(projectDir, 'I.1', {}).reason === 'missing-plan');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 6. normalizeReviewEntries
// ---------------------------------------------------------------------------
console.log('normalizeReviewEntries');
check('null → invalid', normalizeReviewEntries(null).ok === false);
check('missing leaf_id', normalizeReviewEntries({ classification: 'approved' }).reason === 'missing-leaf-id');
check('invalid classification', normalizeReviewEntries({ leaf_id: 'I.1', classification: 'maybe' }).reason === 'invalid-classification');
check('missing signal', normalizeReviewEntries({ leaf_id: 'I.1' }).reason === 'missing-signal');
check('agent classification authoritative', (() => { const n = normalizeReviewEntries({ leaf_id: 'I.1', classification: 'iterate' }); return n.ok && n.classification === 'iterate' && n.source === 'agent'; })());
check('response → first-pass', (() => { const n = normalizeReviewEntries({ leaf_id: 'I.1', response: 'approved' }); return n.ok && n.classification === 'approved' && n.source === 'first-pass'; })());
check('agent overrides first-pass (response approved, class iterate)', (() => { const n = normalizeReviewEntries({ leaf_id: 'I.1', classification: 'iterate', response: 'looks good' }); return n.classification === 'iterate' && n.source === 'agent'; })());

// ---------------------------------------------------------------------------
// 7. applyReviewResponse — transitions (hard rule 8)
// ---------------------------------------------------------------------------
console.log('applyReviewResponse');
{
  const { projectDir, tmpRoot } = makeTempProject('approved');
  writePlan(projectDir, FIXTURE);
  const r = applyReviewResponse(projectDir, { leaf_id: 'I.1', response: 'approved, ship it' });
  check('approved → ok', r.ok === true && r.classification === 'approved');
  check('approved → status done (persisted)', leafStatus(projectDir, 'I.1') === 'done');
  check('approved → transitioned', r.transitioned === true);
  check('approved → recursive-close hint', /recursive close/.test(r.text));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('iterate');
  writePlan(projectDir, FIXTURE);
  const r = applyReviewResponse(projectDir, { leaf_id: 'I.1', response: 'make the title smaller' });
  check('iterate → in-progress (persisted)', leafStatus(projectDir, 'I.1') === 'in-progress');
  check('iterate → re-execute hint', /re-execute applying the feedback/.test(r.text));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('defer');
  writePlan(projectDir, FIXTURE);
  buildReviewPlan(projectDir, 'I.1', {}); // → awaiting-review
  const r = applyReviewResponse(projectDir, { leaf_id: 'I.1', response: 'defer' });
  check('defer → no promotion', r.classification === 'defer' && r.transitioned === false);
  check('defer → stays awaiting-review', leafStatus(projectDir, 'I.1') === 'awaiting-review');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('ambiguous');
  writePlan(projectDir, FIXTURE);
  buildReviewPlan(projectDir, 'I.1', {});
  const r = applyReviewResponse(projectDir, { leaf_id: 'I.1', response: 'hmm' });
  check('ambiguous → no transition (hard rule 8)', r.classification === 'ambiguous' && r.transitioned === false);
  check('ambiguous → status unchanged (awaiting-review)', leafStatus(projectDir, 'I.1') === 'awaiting-review');
  check('ambiguous → numbered clarifying prompt', /\(1\) approve as-is/.test(r.text) && /\(2\) describe the change/.test(r.text));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('agent-auth');
  writePlan(projectDir, FIXTURE);
  // agent says iterate even though raw text reads like approval → agent wins, no promotion
  const r = applyReviewResponse(projectDir, { leaf_id: 'I.1', classification: 'iterate', response: 'looks good' });
  check('agent-authoritative iterate (not done)', leafStatus(projectDir, 'I.1') === 'in-progress');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('commit-err');
  writePlan(projectDir, FIXTURE);
  check('leaf-not-found', applyReviewResponse(projectDir, { leaf_id: 'Z.9', response: 'approved' }).reason === 'leaf-not-found');
  check('not-a-leaf', applyReviewResponse(projectDir, { leaf_id: 'I', response: 'approved' }).reason === 'not-a-leaf');
  check('missing signal', applyReviewResponse(projectDir, { leaf_id: 'I.1' }).reason === 'missing-signal');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 8. runReview dispatch + ovdPlan.runGo review
// ---------------------------------------------------------------------------
console.log('runReview + dispatch');
check('invalid dir', runReview(null, {}).reason === 'invalid-project-dir');
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch');
  writePlan(projectDir, FIXTURE);
  check('runReview plan', runReview(projectDir, { mode: 'plan', leafId: 'I.1' }).mode === 'review-plan');
  const viaPlan = ovdPlan.runGo({ projectDir, subcommand: 'review', text: 'I.1' }, process.env);
  check('runGo review plan', viaPlan.ok === true && viaPlan.mode === 'review-plan');
  const viaCommit = ovdPlan.runGo({ projectDir, subcommand: 'review', text: 'I.1', entriesJson: JSON.stringify({ leaf_id: 'I.1', classification: 'approved' }) }, process.env);
  check('runGo review commit', viaCommit.ok === true && viaCommit.mode === 'review-commit' && viaCommit.classification === 'approved');
  const badJson = ovdPlan.runGo({ projectDir, subcommand: 'review', text: 'I.1', entriesJson: '{bad' }, process.env);
  check('runGo review bad JSON guard', badJson.ok === false && /not valid JSON/.test(badJson.reason));
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 9. Migration-compat seam (Pattern 5)
// ---------------------------------------------------------------------------
console.log('Migration-compat seam (Pattern 5)');
{
  const { projectDir, tmpRoot } = makeTempProject('migration');
  writePlan(projectDir, FIXTURE_MIGRATION);
  check('migration plan → leaf-not-found, no crash', buildReviewPlan(projectDir, 'I.1', {}).reason === 'leaf-not-found');
  check('migration commit → leaf-not-found, no crash', applyReviewResponse(projectDir, { leaf_id: 'I.1', response: 'approved' }).reason === 'leaf-not-found');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${passed} checks passed.`);
if (failures.length > 0) {
  console.log(`${failures.length} failure(s):`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
