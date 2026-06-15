#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const idea = require('../lib/ovd-plan/idea');
const {
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
} = idea;

const ovdPlan = require('../lib/ovd-plan');
const deliberate = require('../lib/ovd-plan/deliberate');
const calibrate = require('../lib/ovd-plan/calibrate');
const decisionsLog = require('../lib/ovd-plan/decisions-log');
const { parseOverdriveMd } = require('../lib/ovd-plan/parser');
const { openState } = require('../lib/ovd-plan/deliberation-state');

const verbose = process.argv.includes('--verbose');
let passed = 0;
const failures = [];
function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    if (verbose) console.log(`PASS ${label}`);
  } else {
    const message = detail ? `${label}: ${detail}` : label;
    failures.push(message);
    console.log(`FAIL ${message}`);
  }
}

function makeTempProject(name) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-idea-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
  return { projectDir, tmpRoot };
}
function cleanup(tmpRoot) { fs.rmSync(tmpRoot, { recursive: true, force: true }); }
function writePlan(projectDir, content) { fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), content); }
function readPlan(projectDir) { return fs.readFileSync(path.join(projectDir, 'OVERDRIVE.md'), 'utf8'); }
function readDecisions(projectDir) {
  const p = path.join(projectDir, '.overdrive', 'decisions.md');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

const FIXED_NOW = '2026-06-13T12:00:00.000Z';
const FIXED_NOW_2 = '2026-06-13T12:05:00.000Z';
const FRONT = '---\novd-plan: true\nversion: 3\nproject: "Test Project"\n---\n\n';

function seedToSpecCommit(projectDir) {
  writePlan(projectDir, FRONT + '# Test Project\n');
  deliberate.applyElicitTurn(projectDir, { answer: 'Need login + dashboard.', turn_id: 1, transition: 'spec' }, { now: FIXED_NOW });
  deliberate.applySpecTurn(projectDir, {
    milestones: [
      { id: 'I', title: 'Foundation', description: 'Auth + DB.', ambiguity_score: 2 },
      { id: 'II', title: 'Dashboard', description: 'Stats widgets.', ambiguity_score: 2 }
    ],
    transition: 'blind_spot'
  }, { now: FIXED_NOW });
}

function seedCalibration(projectDir) {
  calibrate.applyCalibration(projectDir, { domain: 'medium', technical: 'high', scope: 'low', rationale: 'test' }, { now: FIXED_NOW });
}

// ---------------------------------------------------------------------------
// 1. Module surface / exports
// ---------------------------------------------------------------------------
console.log('Module surface');
check('STATUS === "idea"', STATUS === 'idea');
check('ACTIONS contains four entries', Array.isArray(ACTIONS) && ACTIONS.length === 4);
check('ACTIONS contains approved', ACTIONS.includes('approved'));
check('ACTIONS contains continue', ACTIONS.includes('continue'));
check('ACTIONS contains research', ACTIONS.includes('research'));
check('ACTIONS contains reject', ACTIONS.includes('reject'));
check('NODE_PREFIX is "IDEA: "', NODE_PREFIX === 'IDEA: ');
check('NODE_MAX_LEN is 80', NODE_MAX_LEN === 80);
check('INBOX_HEADER_IDEA_REJECTED defined', typeof INBOX_HEADER_IDEA_REJECTED === 'string' && INBOX_HEADER_IDEA_REJECTED.length > 0);
check('truncateAtWordBoundary exported', typeof truncateAtWordBoundary === 'function');
check('nodeIdentifierFromIdea exported', typeof nodeIdentifierFromIdea === 'function');
check('summarizeProposedTree exported', typeof summarizeProposedTree === 'function');
check('buildIdeaPlan exported', typeof buildIdeaPlan === 'function');
check('normalizeIdeaEntries exported', typeof normalizeIdeaEntries === 'function');
check('applyIdeaApproved exported', typeof applyIdeaApproved === 'function');
check('applyIdeaContinue exported', typeof applyIdeaContinue === 'function');
check('applyIdeaResearch exported', typeof applyIdeaResearch === 'function');
check('applyIdeaReject exported', typeof applyIdeaReject === 'function');
check('applyIdeaAction exported', typeof applyIdeaAction === 'function');
check('runIdea exported', typeof runIdea === 'function');
check('formatPlan exported', typeof formatPlan === 'function');
check('formatCommit exported', typeof formatCommit === 'function');

// ---------------------------------------------------------------------------
// 2. Word-boundary truncation
// ---------------------------------------------------------------------------
console.log('Word-boundary truncation');
check('short text unchanged', truncateAtWordBoundary('short text', 20) === 'short text');
check('exactly maxLen unchanged', truncateAtWordBoundary('abcde', 5) === 'abcde');
check('truncates at last space + ellipsis',
  truncateAtWordBoundary('add a dark mode toggle to the settings page', 25) === 'add a dark mode toggle…',
  `got: "${truncateAtWordBoundary('add a dark mode toggle to the settings page', 25)}"`);
check('preserves whole words', truncateAtWordBoundary('the quick brown fox jumps over the lazy dog', 20).endsWith('…'));
check('cuts at last full word', truncateAtWordBoundary('the quick brown fox jumps over the lazy dog', 20) === 'the quick brown…',
  `value: "${truncateAtWordBoundary('the quick brown fox jumps over the lazy dog', 20)}"`);
check('hard-truncates very long single word',
  truncateAtWordBoundary('supercalifragilisticexpialidocious', 10) === 'supercali…',
  `got: "${truncateAtWordBoundary('supercalifragilisticexpialidocious', 10)}"`);
check('hard-truncates when last space too early',
  truncateAtWordBoundary('a verylongwordwithoutspacesgoeshere', 15).endsWith('…'));
check('handles non-string input', truncateAtWordBoundary(null, 10) === '');
check('handles undefined input', truncateAtWordBoundary(undefined, 10) === '');

// ---------------------------------------------------------------------------
// 3. Node identifier
// ---------------------------------------------------------------------------
console.log('Node identifier from idea');
check('short idea: prefix + text', nodeIdentifierFromIdea('add dark mode') === 'IDEA: add dark mode');
check('starts with NODE_PREFIX', nodeIdentifierFromIdea('whatever').startsWith(NODE_PREFIX));
check('long idea is truncated', nodeIdentifierFromIdea('add dark mode and integrate with system preferences and persist across sessions for all users worldwide').length <= NODE_MAX_LEN + 1,
  `got len ${nodeIdentifierFromIdea('add dark mode and integrate with system preferences and persist across sessions for all users worldwide').length}`);
check('long idea ends with ellipsis',
  nodeIdentifierFromIdea('add dark mode and integrate with system preferences and persist across sessions for all users worldwide').endsWith('…'));
check('long idea preserves prefix',
  nodeIdentifierFromIdea('add dark mode and integrate with system preferences and persist across sessions for all users worldwide').startsWith('IDEA: '));
check('collapses internal whitespace', nodeIdentifierFromIdea('add   dark   mode') === 'IDEA: add dark mode');
check('trims leading/trailing whitespace', nodeIdentifierFromIdea('   add dark mode   ') === 'IDEA: add dark mode');
check('handles empty input', nodeIdentifierFromIdea('') === 'IDEA: ');
check('handles null input', nodeIdentifierFromIdea(null) === 'IDEA: ');

// ---------------------------------------------------------------------------
// 4. Tree summary
// ---------------------------------------------------------------------------
console.log('summarizeProposedTree');
check('null opened → empty', JSON.stringify(summarizeProposedTree(null)) === '{"source":null,"lines":[]}');
check('failed open → empty', JSON.stringify(summarizeProposedTree({ ok: false })) === '{"source":null,"lines":[]}');
check('no innerObj → empty', JSON.stringify(summarizeProposedTree({ ok: true })) === '{"source":null,"lines":[]}');
check('proposed_tree milestones → source=proposed',
  summarizeProposedTree({ ok: true, innerObj: { proposed_tree: { milestones: [{ id: 'I', title: 'Foo' }] } } }).source === 'proposed');
check('proposed_tree renders milestone lines',
  summarizeProposedTree({ ok: true, innerObj: { proposed_tree: { milestones: [{ id: 'I', title: 'Foo' }] } } }).lines[0] === '  I Foo');
check('committed tree fallback → source=committed',
  summarizeProposedTree({
    ok: true,
    innerObj: {},
    parsed: { tree: { children: [{ id: 'II', title: 'Bar', depth: 2 }] } }
  }).source === 'committed');
check('committed tree filters depth !== 2',
  summarizeProposedTree({
    ok: true,
    innerObj: {},
    parsed: { tree: { children: [{ id: 'X', title: 'NotMilestone', depth: 3 }] } }
  }).source === null);
check('empty tree → source=null',
  summarizeProposedTree({ ok: true, innerObj: {}, parsed: { tree: { children: [] } } }).source === null);

// ---------------------------------------------------------------------------
// 5. buildIdeaPlan
// ---------------------------------------------------------------------------
console.log('buildIdeaPlan');
{
  const { projectDir, tmpRoot } = makeTempProject('plan-no-text');
  const r = buildIdeaPlan(projectDir, {});
  check('no text → ok=false', r.ok === false);
  check('no text → reason=missing-idea-text', r.reason === 'missing-idea-text');
  check('no text → text mentions invocation', typeof r.text === 'string' && r.text.includes('Invocation'));
  check('no text → status=idea', r.status === 'idea');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('plan-no-plan');
  const r = buildIdeaPlan(projectDir, { text: 'add dark mode' });
  check('no plan → ok=true (tolerant)', r.ok === true);
  check('no plan → mode=plan', r.mode === 'plan');
  check('no plan → tree_source=null', r.tree_source === null);
  check('no plan → calibration=null', r.calibration === null);
  check('no plan → text has idea echo', r.text.includes('Idea: add dark mode'));
  check('no plan → text has early-stage marker', r.text.includes('No current tree found'));
  check('no plan → text has Q9 dual-presentation marker', r.text.includes('Q9 dual-presentation'));
  check('no plan → text has 4 action paths', r.text.includes('(1) approved') && r.text.includes('(2) continue') && r.text.includes('(3) research') && r.text.includes('(4) other'));
  check('no plan → text has new-chat handoff reference', r.text.includes('fresh conversation') && r.text.includes('/ovd-plan edit'));
  check('no plan → text has Q3.10 sketch stub note', r.text.includes('Q3.10') && r.text.includes('Phase 6'));
  check('no plan → text has commit syntax for all 4 actions',
    r.text.includes('"action":"approved"') && r.text.includes('"action":"continue"') && r.text.includes('"action":"research"') && r.text.includes('"action":"reject"'));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('plan-with-proposed-tree');
  seedToSpecCommit(projectDir);
  const r = buildIdeaPlan(projectDir, { text: 'add dark mode' });
  check('proposed tree → ok=true', r.ok === true);
  check('proposed tree → tree_source=proposed', r.tree_source === 'proposed');
  check('proposed tree → text includes milestone I', r.text.includes('I Foundation'));
  check('proposed tree → text includes milestone II', r.text.includes('II Dashboard'));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('plan-with-calibration');
  seedToSpecCommit(projectDir);
  seedCalibration(projectDir);
  const r = buildIdeaPlan(projectDir, { text: 'add dark mode' });
  check('calibration present → r.calibration not null', r.calibration && r.calibration.domain === 'medium');
  check('calibration → text shows domain', r.text.includes('domain: medium'));
  check('calibration → text shows technical', r.text.includes('technical: high'));
  check('calibration → text shows scope', r.text.includes('scope: low'));
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 6. normalizeIdeaEntries
// ---------------------------------------------------------------------------
console.log('normalizeIdeaEntries');
check('null entries → invalid-shape', normalizeIdeaEntries(null).reason === 'invalid-shape');
check('array entries → invalid-shape', normalizeIdeaEntries([]).reason === 'invalid-shape');
check('missing action → invalid-values', normalizeIdeaEntries({ idea_text: 'x' }).reason === 'invalid-values');
check('bad action → invalid-values', normalizeIdeaEntries({ action: 'bogus', idea_text: 'x' }).reason === 'invalid-values');
check('missing idea_text → invalid-values', normalizeIdeaEntries({ action: 'continue' }).reason === 'invalid-values');
check('empty idea_text → invalid-values', normalizeIdeaEntries({ action: 'continue', idea_text: '   ' }).reason === 'invalid-values');
check('approved without impact_summary → errors', normalizeIdeaEntries({ action: 'approved', idea_text: 'x', tradeoffs: 'y', suggested_route: 'z' }).errors.join(';').includes('impact_summary'));
check('approved without tradeoffs → errors', normalizeIdeaEntries({ action: 'approved', idea_text: 'x', impact_summary: 'y', suggested_route: 'z' }).errors.join(';').includes('tradeoffs'));
check('approved without suggested_route → errors', normalizeIdeaEntries({ action: 'approved', idea_text: 'x', impact_summary: 'y', tradeoffs: 'z' }).errors.join(';').includes('suggested_route'));
check('approved valid → ok=true', normalizeIdeaEntries({ action: 'approved', idea_text: 'x', impact_summary: 'i', tradeoffs: 't', suggested_route: 'r' }).ok === true);
check('approved with decision_rationale → preserved',
  normalizeIdeaEntries({ action: 'approved', idea_text: 'x', impact_summary: 'i', tradeoffs: 't', suggested_route: 'r', decision_rationale: 'why' }).entries.decision_rationale === 'why');
check('approved with non-string decision_rationale → error',
  normalizeIdeaEntries({ action: 'approved', idea_text: 'x', impact_summary: 'i', tradeoffs: 't', suggested_route: 'r', decision_rationale: 42 }).reason === 'invalid-values');
check('approved with empty decision_rationale → omitted',
  normalizeIdeaEntries({ action: 'approved', idea_text: 'x', impact_summary: 'i', tradeoffs: 't', suggested_route: 'r', decision_rationale: '   ' }).entries.decision_rationale === undefined);
check('reject without rejection_reason → errors',
  normalizeIdeaEntries({ action: 'reject', idea_text: 'x' }).errors.join(';').includes('rejection_reason'));
check('reject valid → ok=true',
  normalizeIdeaEntries({ action: 'reject', idea_text: 'x', rejection_reason: 'too expensive' }).ok === true);
check('continue only requires idea_text',
  normalizeIdeaEntries({ action: 'continue', idea_text: 'x' }).ok === true);
check('research only requires idea_text',
  normalizeIdeaEntries({ action: 'research', idea_text: 'x' }).ok === true);
check('trims idea_text', normalizeIdeaEntries({ action: 'continue', idea_text: '  hello  ' }).entries.idea_text === 'hello');
check('trims approved string fields', normalizeIdeaEntries({ action: 'approved', idea_text: 'x', impact_summary: '  i  ', tradeoffs: ' t ', suggested_route: ' r ' }).entries.impact_summary === 'i');

// ---------------------------------------------------------------------------
// 7. applyIdeaApproved
// ---------------------------------------------------------------------------
console.log('applyIdeaApproved');
{
  const { projectDir, tmpRoot } = makeTempProject('apply-approved');
  const entries = { action: 'approved', idea_text: 'add dark mode', impact_summary: 'Affects all UI components', tradeoffs: 'Increases bundle slightly', suggested_route: 'Tailwind dark: classes' };
  const r = applyIdeaApproved(projectDir, entries, { now: FIXED_NOW });
  check('approved → ok=true', r.ok === true);
  check('approved → mode=commit', r.mode === 'commit');
  check('approved → action=approved', r.action === 'approved');
  check('approved → status=idea', r.status === 'idea');
  check('approved → decision_node has IDEA prefix', r.decision_node.startsWith('IDEA: '));
  check('approved → decision_path is decisions.md', r.decision_path.endsWith('decisions.md'));
  check('approved → text has handoff', r.text.includes('Recommend: start a fresh conversation') && r.text.includes('/ovd-plan edit'));
  check('approved → text mentions /ovd-log option', r.text.includes('/ovd-log'));
  const decisions = readDecisions(projectDir);
  check('decisions.md exists', typeof decisions === 'string' && decisions.length > 0);
  check('decisions.md has IDEA row', decisions.includes('IDEA: add dark mode'));
  check('decisions.md has the suggested route', decisions.includes('Tailwind dark: classes'));
  check('decisions.md has rationale (falls back to impact_summary)', decisions.includes('Affects all UI components'));
  check('decisions.md has 2026-06-13 date', decisions.includes('2026-06-13'));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('apply-approved-rationale');
  const entries = { action: 'approved', idea_text: 'x', impact_summary: 'i', tradeoffs: 't', suggested_route: 'r', decision_rationale: 'explicit why' };
  applyIdeaApproved(projectDir, entries, { now: FIXED_NOW });
  const decisions = readDecisions(projectDir);
  check('explicit decision_rationale used over impact_summary', decisions.includes('explicit why'));
  check('impact_summary NOT used as rationale when explicit rationale given', !decisions.includes('| i |'));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('apply-approved-long');
  const longIdea = 'integrate dark mode across all the UI components including settings dashboard navbar footer modals tooltips';
  const entries = { action: 'approved', idea_text: longIdea, impact_summary: 'i', tradeoffs: 't', suggested_route: 'r' };
  const r = applyIdeaApproved(projectDir, entries, { now: FIXED_NOW });
  check('long idea → decision_node length <= NODE_MAX_LEN + 1', r.decision_node.length <= NODE_MAX_LEN + 1);
  check('long idea → decision_node ends with ellipsis', r.decision_node.endsWith('…'));
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 8. applyIdeaContinue
// ---------------------------------------------------------------------------
console.log('applyIdeaContinue');
{
  const entries = { action: 'continue', idea_text: 'add dark mode' };
  const r = applyIdeaContinue(null, entries);
  check('continue → ok=true', r.ok === true);
  check('continue → action=continue', r.action === 'continue');
  check('continue → status=idea', r.status === 'idea');
  check('continue → text echoes idea', r.text.includes('add dark mode'));
  check('continue → text suggests re-run', r.text.includes('Re-run /ovd-plan idea'));
}
{
  // No state mutation: confirm decisions.md NOT created.
  const { projectDir, tmpRoot } = makeTempProject('continue-no-mutation');
  applyIdeaContinue(projectDir, { action: 'continue', idea_text: 'x' });
  check('continue → no decisions.md created', readDecisions(projectDir) === null);
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 9. applyIdeaResearch
// ---------------------------------------------------------------------------
console.log('applyIdeaResearch');
{
  const r = applyIdeaResearch(null, { action: 'research', idea_text: 'add dark mode' });
  check('research → ok=true', r.ok === true);
  check('research → action=research', r.action === 'research');
  check('research → status=idea', r.status === 'idea');
  check('research → text recommends /ovd-plan research', r.text.includes('/ovd-plan research'));
  check('research → text includes idea', r.text.includes('add dark mode'));
  check('research → text references r3 §5.5', r.text.includes('§5.5') || r.text.includes('5.5'));
}
{
  const { projectDir, tmpRoot } = makeTempProject('research-no-mutation');
  applyIdeaResearch(projectDir, { action: 'research', idea_text: 'x' });
  check('research → no decisions.md created', readDecisions(projectDir) === null);
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 10. applyIdeaReject
// ---------------------------------------------------------------------------
console.log('applyIdeaReject');
{
  const { projectDir, tmpRoot } = makeTempProject('reject-no-plan');
  const r = applyIdeaReject(projectDir, { action: 'reject', idea_text: 'x', rejection_reason: 'no' }, { now: FIXED_NOW });
  check('reject without plan → ok=false', r.ok === false);
  check('reject without plan → reason=missing-plan', r.reason === 'missing-plan');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('reject-happy');
  seedToSpecCommit(projectDir);
  const entries = { action: 'reject', idea_text: 'add blockchain integration', rejection_reason: 'out of scope for v1' };
  const r = applyIdeaReject(projectDir, entries, { now: FIXED_NOW });
  check('reject happy → ok=true', r.ok === true);
  check('reject happy → action=reject', r.action === 'reject');
  check('reject happy → inbox_header echoed', r.inbox_header === INBOX_HEADER_IDEA_REJECTED);
  check('reject happy → text mentions inbox header', r.text.includes(INBOX_HEADER_IDEA_REJECTED));
  const plan = readPlan(projectDir);
  check('plan has inbox header', plan.includes(`## ${INBOX_HEADER_IDEA_REJECTED}`));
  check('plan has rejection line', plan.includes('add blockchain integration'));
  check('plan has rejection reason tag', plan.includes('idea-rejected: out of scope for v1'));
  check('plan has considered-but-not-adopted prefix', plan.includes('[considered-but-not-adopted: idea-rejected:'));
  check('plan has timestamp', plan.includes(FIXED_NOW));
  cleanup(tmpRoot);
}
{
  // Reject with newlines should be sanitized into single-line entry.
  const { projectDir, tmpRoot } = makeTempProject('reject-sanitize');
  seedToSpecCommit(projectDir);
  applyIdeaReject(projectDir, { action: 'reject', idea_text: 'multi\nline\nidea', rejection_reason: 'a\nb' }, { now: FIXED_NOW });
  const plan = readPlan(projectDir);
  check('newlines collapsed in idea text', !plan.includes('multi\nline\nidea') && plan.includes('multi line idea'));
  check('newlines collapsed in rejection reason', plan.includes('idea-rejected: a b'));
  cleanup(tmpRoot);
}
{
  // Two reject calls in a row should both land under the same header.
  const { projectDir, tmpRoot } = makeTempProject('reject-multiple');
  seedToSpecCommit(projectDir);
  applyIdeaReject(projectDir, { action: 'reject', idea_text: 'first', rejection_reason: 'r1' }, { now: FIXED_NOW });
  applyIdeaReject(projectDir, { action: 'reject', idea_text: 'second', rejection_reason: 'r2' }, { now: FIXED_NOW_2 });
  const plan = readPlan(projectDir);
  const headerOccurrences = (plan.match(new RegExp(`## ${INBOX_HEADER_IDEA_REJECTED.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')) || []).length;
  check('header appears only once', headerOccurrences === 1, `got ${headerOccurrences}`);
  check('both rejections present', plan.includes('first') && plan.includes('second'));
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 11. applyIdeaAction dispatch
// ---------------------------------------------------------------------------
console.log('applyIdeaAction dispatch');
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-approved');
  const r = applyIdeaAction(projectDir, { action: 'approved', idea_text: 'x', impact_summary: 'i', tradeoffs: 't', suggested_route: 'r' }, { now: FIXED_NOW });
  check('dispatch approved', r.action === 'approved' && r.ok === true);
  cleanup(tmpRoot);
}
{
  const r = applyIdeaAction(null, { action: 'continue', idea_text: 'x' });
  check('dispatch continue', r.action === 'continue' && r.ok === true);
}
{
  const r = applyIdeaAction(null, { action: 'research', idea_text: 'x' });
  check('dispatch research', r.action === 'research' && r.ok === true);
}
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-reject');
  seedToSpecCommit(projectDir);
  const r = applyIdeaAction(projectDir, { action: 'reject', idea_text: 'x', rejection_reason: 'no' }, { now: FIXED_NOW });
  check('dispatch reject', r.action === 'reject' && r.ok === true);
  cleanup(tmpRoot);
}
{
  const r = applyIdeaAction(null, { action: 'bogus', idea_text: 'x' });
  check('dispatch invalid action → ok=false', r.ok === false);
  check('dispatch invalid action → reason=invalid-action', r.reason === 'invalid-action');
}

// ---------------------------------------------------------------------------
// 12. runIdea — full plan/commit cycle
// ---------------------------------------------------------------------------
console.log('runIdea');
{
  const { projectDir, tmpRoot } = makeTempProject('runIdea-plan');
  const r = runIdea(projectDir, { text: 'add dark mode' });
  check('runIdea plan-mode → ok=true', r.ok === true);
  check('runIdea plan-mode → mode=plan', r.mode === 'plan');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('runIdea-commit');
  const entries = { action: 'approved', idea_text: 'x', impact_summary: 'i', tradeoffs: 't', suggested_route: 'r' };
  const r = runIdea(projectDir, { entries, now: FIXED_NOW });
  check('runIdea commit-mode → ok=true', r.ok === true);
  check('runIdea commit-mode → mode=commit', r.mode === 'commit');
  cleanup(tmpRoot);
}
{
  const r = runIdea('/tmp/nonexistent', { entries: { action: 'bogus', idea_text: 'x' } });
  check('runIdea bad entries → ok=false', r.ok === false);
  check('runIdea bad entries → reason=invalid-values', r.reason === 'invalid-values');
}
{
  const r = runIdea('/tmp/nonexistent', { mode: 'commit', entries: null });
  check('runIdea null entries → ok=false', r.ok === false);
}

// ---------------------------------------------------------------------------
// 13. Subcommand dispatch through runPlan
// ---------------------------------------------------------------------------
console.log('runPlan subcommand dispatch');
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-plan');
  process.env.OVERDRIVE_PROJECT_DIR_TEST = projectDir;
  const r = ovdPlan.runPlan({ subcommand: 'idea', text: 'add dark mode', projectDir }, process.env);
  check('runPlan idea plan-mode → ok=true', r.ok === true);
  check('runPlan idea plan-mode → status=idea', r.status === 'idea');
  check('runPlan idea plan-mode → mode=plan', r.mode === 'plan');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-commit-bad-json');
  const r = ovdPlan.runPlan({ subcommand: 'idea', entriesJson: '{not valid}', projectDir }, process.env);
  check('runPlan idea bad JSON → ok=false', r.ok === false);
  check('runPlan idea bad JSON → text mentions Invalid', r.text.includes('Invalid --entries-json'));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-commit-ok');
  const entries = { action: 'continue', idea_text: 'x' };
  const r = ovdPlan.runPlan({ subcommand: 'idea', entriesJson: JSON.stringify(entries), projectDir }, process.env);
  check('runPlan idea commit-mode → ok=true', r.ok === true);
  check('runPlan idea commit-mode → mode=commit', r.mode === 'commit');
  check('runPlan idea commit-mode → action=continue', r.action === 'continue');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 14. ovdPlan module surface integration
// ---------------------------------------------------------------------------
console.log('Module surface integration');
check('ovdPlan.idea exported', !!ovdPlan.idea);
check('ovdPlan.runIdea exported', typeof ovdPlan.runIdea === 'function');
check('ovdPlan.idea.STATUS === "idea"', ovdPlan.idea.STATUS === 'idea');

// ---------------------------------------------------------------------------
// 15. Formatters
// ---------------------------------------------------------------------------
console.log('Formatters');
check('formatPlan with text', formatPlan({ text: 'hello' }) === 'hello');
check('formatPlan without text', formatPlan({}) === '(no plan text)');
check('formatCommit with text', formatCommit({ text: 'hello' }) === 'hello');
check('formatCommit without text', formatCommit({}) === '(no commit text)');

// ---------------------------------------------------------------------------
// 16. Locked-design pre-flight (regression tripwires)
// ---------------------------------------------------------------------------
console.log('Locked-design pre-flight tripwires');
{
  const { projectDir, tmpRoot } = makeTempProject('q8-no-auto-route');
  const entries = { action: 'approved', idea_text: 'add dark mode', impact_summary: 'i', tradeoffs: 't', suggested_route: 'r' };
  const r = applyIdeaApproved(projectDir, entries, { now: FIXED_NOW });
  // Q8 lock: approved emits new-chat handoff, NOT auto-route to edit.
  check('Q8 lock: text says "Recommend" (not autoroute)', r.text.includes('Recommend:'));
  check('Q8 lock: text does NOT say "running /ovd-plan edit now"', !r.text.includes('Running /ovd-plan edit'));
  check('Q8 lock: text explicitly mentions fresh conversation', r.text.includes('fresh conversation'));
  cleanup(tmpRoot);
}
{
  // Q9 dual-presentation: plan-mode external render is one-liner action paths.
  const { projectDir, tmpRoot } = makeTempProject('q9-terse-external');
  const r = buildIdeaPlan(projectDir, { text: 'x' });
  // Verify the four action paths each occupy a single user-facing line in the rendered template.
  const text = r.text;
  const linesInRender = text.split('\n').filter((l) => /\((\d)\)/.test(l));
  check('Q9 lock: 4 action-path lines in render', linesInRender.length >= 4);
  cleanup(tmpRoot);
}
{
  // Q3.10 sketch stub: plan-mode mentions Phase 6 stub.
  const { projectDir, tmpRoot } = makeTempProject('q3-10-sketch-stub');
  const r = buildIdeaPlan(projectDir, { text: 'sketch a new dashboard' });
  check('Q3.10 stub: plan text mentions Phase 6', r.text.includes('Phase 6'));
  check('Q3.10 stub: plan text mentions sketch sub-state', r.text.includes('sketch sub-state'));
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
