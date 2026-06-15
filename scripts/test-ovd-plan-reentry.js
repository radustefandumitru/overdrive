#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const reentry = require('../lib/ovd-plan/reentry');
const {
  STATUS,
  THRESHOLD_MS_DEFAULT,
  REENTRY_KINDS,
  STALE_DETECTION_STAGES,
  SESSIONS_REL,
  PLAN_QUALITY_REPORT_PATTERN,
  parseDateMs,
  nowMs,
  nowIsoFromOpts,
  detectStaleState,
  detectReentry,
  findLatestPlanQualityReport,
  renderCalibrationRecap,
  renderPosition,
  renderOpenThreads,
  renderSummary,
  renderRestartConfirmPrompt,
  buildReentryTurn,
  buildStaleTurn,
  applyReentryTurn,
  runReentry,
  formatPlan,
  formatCommit
} = reentry;

const ovdPlan = require('../lib/ovd-plan');
const deliberate = require('../lib/ovd-plan/deliberate');
const { openState, readDeliberationState } = require('../lib/ovd-plan/deliberation-state');

let pass = 0;
let fail = 0;
function check(label, cond) {
  if (cond) { pass += 1; } else { fail += 1; console.error(`FAIL ${label}`); }
}

function makeTempProject(name) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-reentry-${name}-`));
  const projectDir = path.join(tmpRoot, 'project');
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
  return { projectDir, tmpRoot };
}
function cleanup(tmpRoot) { fs.rmSync(tmpRoot, { recursive: true, force: true }); }

const FRONT = '---\novd-plan: true\nversion: 3\nproject: "T"\n---\n\n';
const NOW = 1750000000000; // arbitrary millisecond timestamp ("now")
const NOW_ISO = new Date(NOW).toISOString();
const HOUR_AGO_ISO = new Date(NOW - 60 * 60 * 1000 - 1).toISOString(); // strictly > 1h ago
const TEN_MIN_AGO_ISO = new Date(NOW - 10 * 60 * 1000).toISOString();

// Compact fixture writer — bare project with deliberation-state block.
function writeFixture(projectDir, innerYaml, opts = {}) {
  const treeBlock = opts.tree || '';
  const content = `${FRONT}# T\n${treeBlock}\n<!-- ovd-plan:deliberation-state:start -->\n${innerYaml}\n<!-- ovd-plan:deliberation-state:end -->\n`;
  fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), content);
}

// ============================================================================
// Module surface
// ============================================================================
console.log('module surface');
check('STATUS = reentry', STATUS === 'reentry');
check('THRESHOLD_MS_DEFAULT = 1h', THRESHOLD_MS_DEFAULT === 60 * 60 * 1000);
check('REENTRY_KINDS = array', Array.isArray(REENTRY_KINDS) && REENTRY_KINDS.length === 4);
check('REENTRY_KINDS includes approved', REENTRY_KINDS.includes('approved'));
check('REENTRY_KINDS includes review', REENTRY_KINDS.includes('review'));
check('REENTRY_KINDS includes restart', REENTRY_KINDS.includes('restart'));
check('REENTRY_KINDS includes reconcile', REENTRY_KINDS.includes('reconcile'));
check('STALE_DETECTION_STAGES is a Set', STALE_DETECTION_STAGES instanceof Set);
check('STALE_DETECTION_STAGES includes plan_skills', STALE_DETECTION_STAGES.has('plan_skills'));
check('STALE_DETECTION_STAGES excludes verify', !STALE_DETECTION_STAGES.has('verify'));
check('STALE_DETECTION_STAGES excludes present', !STALE_DETECTION_STAGES.has('present'));
check('SESSIONS_REL contains sessions', typeof SESSIONS_REL === 'string' && SESSIONS_REL.includes('sessions'));
check('PLAN_QUALITY_REPORT_PATTERN is RegExp', PLAN_QUALITY_REPORT_PATTERN instanceof RegExp);
check('parseDateMs function', typeof parseDateMs === 'function');
check('nowMs function', typeof nowMs === 'function');
check('nowIsoFromOpts function', typeof nowIsoFromOpts === 'function');
check('detectStaleState function', typeof detectStaleState === 'function');
check('detectReentry function', typeof detectReentry === 'function');
check('findLatestPlanQualityReport function', typeof findLatestPlanQualityReport === 'function');
check('renderCalibrationRecap function', typeof renderCalibrationRecap === 'function');
check('renderPosition function', typeof renderPosition === 'function');
check('renderOpenThreads function', typeof renderOpenThreads === 'function');
check('renderSummary function', typeof renderSummary === 'function');
check('renderRestartConfirmPrompt function', typeof renderRestartConfirmPrompt === 'function');
check('buildReentryTurn function', typeof buildReentryTurn === 'function');
check('buildStaleTurn function', typeof buildStaleTurn === 'function');
check('applyReentryTurn function', typeof applyReentryTurn === 'function');
check('runReentry function', typeof runReentry === 'function');
check('formatPlan function', typeof formatPlan === 'function');
check('formatCommit function', typeof formatCommit === 'function');
check('ovdPlan.reentry namespace', ovdPlan.reentry === reentry);
check('ovdPlan.runReentry top-level', ovdPlan.runReentry === runReentry);

// ============================================================================
// parseDateMs + nowMs + nowIsoFromOpts
// ============================================================================
console.log('parseDateMs / nowMs / nowIsoFromOpts');
check('parseDateMs(null) === null', parseDateMs(null) === null);
check('parseDateMs(undefined) === null', parseDateMs(undefined) === null);
check('parseDateMs("") === null', parseDateMs('') === null);
check('parseDateMs("   ") === null', parseDateMs('   ') === null);
check('parseDateMs(123) === null', parseDateMs(123) === null);
check('parseDateMs("not a date") === null', parseDateMs('not a date') === null);
check('parseDateMs(NOW_ISO) parses', parseDateMs(NOW_ISO) === NOW);
check('nowMs default returns Date.now()-ish', Math.abs(nowMs() - Date.now()) < 5000);
check('nowMs({now: number}) returns number', nowMs({ now: NOW }) === NOW);
check('nowMs({now: ISO string}) parses', nowMs({ now: NOW_ISO }) === NOW);
check('nowMs({now: bad string}) falls back to Date.now()-ish', Math.abs(nowMs({ now: 'not a date' }) - Date.now()) < 5000);
check('nowIsoFromOpts returns ISO', nowIsoFromOpts({ now: NOW }) === NOW_ISO);

// ============================================================================
// detectStaleState
// ============================================================================
console.log('detectStaleState');
{
  const r = detectStaleState(null);
  check('stale: null opened → drifted=false', r.drifted === false);
  check('stale: null opened → reason=invalid-open', r.reason === 'invalid-open');
}
{
  const r = detectStaleState({ ok: false });
  check('stale: ok=false → drifted=false', r.drifted === false);
}
{
  // out-of-scope stage (verify): drifted=false even if proposed_tree exists
  const r = detectStaleState({
    ok: true, innerObj: { stage: 'verify', proposed_tree: { milestones: [{ id: 'I' }] } }, parsed: { tree: { children: [{ id: 'X' }] } }
  });
  check('stale: out-of-scope stage → drifted=false', r.drifted === false);
  check('stale: out-of-scope reason', r.reason === 'out-of-scope-stage');
  check('stale: out-of-scope returns stage', r.stage === 'verify');
}
{
  // no proposed_tree
  const r = detectStaleState({ ok: true, innerObj: { stage: 'plan' }, parsed: { tree: { children: [{ id: 'I' }] } } });
  check('stale: no proposed_tree → drifted=false', r.drifted === false);
  check('stale: no proposed_tree reason', r.reason === 'no-proposed-tree');
}
{
  // no committed tree
  const r = detectStaleState({
    ok: true,
    innerObj: { stage: 'plan', proposed_tree: { milestones: [{ id: 'I' }] } },
    parsed: { tree: { children: [] } }
  });
  check('stale: no committed tree → drifted=false', r.drifted === false);
  check('stale: no committed tree reason', r.reason === 'no-committed-tree');
}
{
  // matching IDs
  const r = detectStaleState({
    ok: true,
    innerObj: { stage: 'plan', proposed_tree: { milestones: [{ id: 'I' }, { id: 'II' }] } },
    parsed: { tree: { children: [{ id: 'I' }, { id: 'II' }] } }
  });
  check('stale: matching IDs → drifted=false', r.drifted === false);
  check('stale: matching reason=in-sync', r.reason === 'in-sync');
}
{
  // milestone count mismatch
  const r = detectStaleState({
    ok: true,
    innerObj: { stage: 'plan', proposed_tree: { milestones: [{ id: 'I' }] } },
    parsed: { tree: { children: [{ id: 'I' }, { id: 'II' }] } }
  });
  check('stale: count mismatch → drifted=true', r.drifted === true);
  check('stale: count mismatch reason', r.reason === 'milestone-count-mismatch');
  check('stale: count mismatch reports proposed IDs', JSON.stringify(r.proposedIds) === '["I"]');
  check('stale: count mismatch reports committed IDs', JSON.stringify(r.committedIds) === '["I","II"]');
}
{
  // id mismatch (same count, different IDs)
  const r = detectStaleState({
    ok: true,
    innerObj: { stage: 'plan_skills', proposed_tree: { milestones: [{ id: 'I' }, { id: 'II' }] } },
    parsed: { tree: { children: [{ id: 'I' }, { id: 'III' }] } }
  });
  check('stale: id mismatch → drifted=true', r.drifted === true);
  check('stale: id mismatch reason', r.reason === 'milestone-id-mismatch');
}

// ============================================================================
// detectReentry
// ============================================================================
console.log('detectReentry');
{
  const r = detectReentry(null);
  check('reentry: null opened → needsReentry=false', r.needsReentry === false);
  check('reentry: null opened → reason=invalid-open', r.reason === 'invalid-open');
}
{
  // pending flag short-circuits
  const r = detectReentry({ ok: true, innerObj: { pending_reentry: true, last_action: NOW_ISO } }, { now: NOW });
  check('reentry: pending flag → needsReentry=true', r.needsReentry === true);
  check('reentry: pending reason=pending', r.reason === 'pending');
}
{
  // committed stage never triggers
  const r = detectReentry({ ok: true, innerObj: { stage: 'committed', last_action: HOUR_AGO_ISO } }, { now: NOW });
  check('reentry: committed → needsReentry=false', r.needsReentry === false);
  check('reentry: committed reason=committed', r.reason === 'committed');
}
{
  // null last_action (Q3.9.1' refinement) → no re-entry
  const r = detectReentry({ ok: true, innerObj: { stage: 'elicit' } }, { now: NOW });
  check('reentry: null last_action → needsReentry=false (Q3.9.1\' refinement)', r.needsReentry === false);
  check('reentry: null last_action reason=no-prior-activity', r.reason === 'no-prior-activity');
}
{
  // explicit null last_action
  const r = detectReentry({ ok: true, innerObj: { stage: 'elicit', last_action: null } }, { now: NOW });
  check('reentry: explicit null last_action → no-prior-activity', r.reason === 'no-prior-activity');
}
{
  // unparseable last_action
  const r = detectReentry({ ok: true, innerObj: { stage: 'elicit', last_action: 'garbage' } }, { now: NOW });
  check('reentry: unparseable last_action → needsReentry=false', r.needsReentry === false);
  check('reentry: unparseable reason', r.reason === 'unparseable-last-action');
}
{
  // recent activity (within threshold)
  const r = detectReentry({ ok: true, innerObj: { stage: 'plan', last_action: TEN_MIN_AGO_ISO } }, { now: NOW });
  check('reentry: recent activity → needsReentry=false', r.needsReentry === false);
  check('reentry: recent reason=recent-activity', r.reason === 'recent-activity');
  check('reentry: recent reports elapsedMs', typeof r.elapsedMs === 'number' && r.elapsedMs >= 600000);
}
{
  // pause exceeds default threshold (1h+)
  const r = detectReentry({ ok: true, innerObj: { stage: 'plan', last_action: HOUR_AGO_ISO } }, { now: NOW });
  check('reentry: pause > 1h → needsReentry=true', r.needsReentry === true);
  check('reentry: pause reason=pause-exceeds-threshold', r.reason === 'pause-exceeds-threshold');
}
{
  // configurable threshold via opts
  const r = detectReentry(
    { ok: true, innerObj: { stage: 'plan', last_action: TEN_MIN_AGO_ISO } },
    { now: NOW, reentryThresholdMs: 60 * 1000 } // 60s
  );
  check('reentry: configurable threshold (60s) fires on 10min ago', r.needsReentry === true);
}

// ============================================================================
// findLatestPlanQualityReport
// ============================================================================
console.log('findLatestPlanQualityReport');
{
  const { projectDir, tmpRoot } = makeTempProject('latest-no-dir');
  check('latest report: no sessions dir → null', findLatestPlanQualityReport(projectDir) === null);
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('latest-no-files');
  fs.mkdirSync(path.join(projectDir, SESSIONS_REL), { recursive: true });
  fs.writeFileSync(path.join(projectDir, SESSIONS_REL, 'not-a-report.md'), 'x');
  check('latest report: no matching files → null', findLatestPlanQualityReport(projectDir) === null);
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('latest-single');
  const dir = path.join(projectDir, SESSIONS_REL);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '2026-06-14T10-00-00-000Z-plan-quality-1.md'), 'r');
  check('latest report: one matching file', findLatestPlanQualityReport(projectDir) === '2026-06-14T10-00-00-000Z-plan-quality-1.md');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('latest-pick-newer');
  const dir = path.join(projectDir, SESSIONS_REL);
  fs.mkdirSync(dir, { recursive: true });
  const older = path.join(dir, '2026-06-14T10-00-00-000Z-plan-quality-1.md');
  const newer = path.join(dir, '2026-06-14T12-00-00-000Z-plan-quality-2.md');
  fs.writeFileSync(older, 'r1');
  fs.writeFileSync(newer, 'r2');
  // Force older mtime to be earlier than newer.
  fs.utimesSync(older, new Date('2026-06-14T10:00:00Z'), new Date('2026-06-14T10:00:00Z'));
  fs.utimesSync(newer, new Date('2026-06-14T12:00:00Z'), new Date('2026-06-14T12:00:00Z'));
  check('latest report: picks most-recent mtime', findLatestPlanQualityReport(projectDir) === '2026-06-14T12-00-00-000Z-plan-quality-2.md');
  cleanup(tmpRoot);
}

// ============================================================================
// renderCalibrationRecap
// ============================================================================
console.log('renderCalibrationRecap');
check('cal recap: no calibration', renderCalibrationRecap({}) === 'Calibration: not yet established.');
check('cal recap: null', renderCalibrationRecap({ calibration: null }) === 'Calibration: not yet established.');
check('cal recap: plain override', renderCalibrationRecap({ calibration: { override: 'plain' } }) === 'Calibration: plain verbosity override.');
{
  const text = renderCalibrationRecap({ calibration: { domain: 'medium', technical: 'high', scope: 'low', override: 'none' } });
  check('cal recap: default axes', text === 'Calibration: domain=medium, technical=high, scope=low, override=none.');
}
{
  const text = renderCalibrationRecap({ calibration: { domain: 'high', technical: 'medium', scope: 'high', override: 'detailed', rationale: 'user is expert' } });
  check('cal recap: detailed includes rationale', /Rationale: user is expert/.test(text));
  check('cal recap: detailed includes axes', /domain=high/.test(text));
}

// ============================================================================
// renderPosition (per stage)
// ============================================================================
console.log('renderPosition');
{
  const t = renderPosition({ stage: 'elicit', turn_count: 3, answered_questions: [{ question: 'first?' }, { question: 'second?' }] }, '/tmp');
  check('position elicit: includes Stage 2', /Stage 2 \(Elicit\)/.test(t));
  check('position elicit: includes turn count', /3 turn/.test(t));
  check('position elicit: includes last question', /second\?/.test(t));
}
check('position spec: includes Stage 4', /Stage 4 \(Spec\)/.test(renderPosition({ stage: 'spec', proposed_tree: { milestones: [{ id: 'I', children: [] }] } }, '/tmp')));
check('position blind_spot: includes Stage 3', /Stage 3 \(Blind-spot/.test(renderPosition({ stage: 'blind_spot', proposed_tree: { milestones: [] } }, '/tmp')));
check('position plan: includes Stage 5', /Stage 5 \(Plan\)/.test(renderPosition({ stage: 'plan', proposed_tree: { milestones: [{ id: 'I', children: [{ id: 'I.1' }] }] } }, '/tmp')));
check('position plan_skills: includes Stage 5.5', /Stage 5\.5/.test(renderPosition({ stage: 'plan_skills', proposed_tree: { milestones: [] } }, '/tmp')));
{
  const { projectDir, tmpRoot } = makeTempProject('pos-verify-no-report');
  const t = renderPosition({ stage: 'verify' }, projectDir);
  check('position verify: no report on disk', /No plan-quality report/.test(t) && /Stage 6/.test(t));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('pos-verify-with-report');
  const dir = path.join(projectDir, SESSIONS_REL);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '2026-06-14T10-00-00-000Z-plan-quality-3.md'), 'r');
  const t = renderPosition({ stage: 'verify' }, projectDir);
  check('position verify: includes report path', /2026-06-14T10-00-00-000Z-plan-quality-3\.md/.test(t));
  check('position verify: includes Stage 6', /Stage 6/.test(t));
  cleanup(tmpRoot);
}
check('position present: includes Stage 7', /Stage 7/.test(renderPosition({ stage: 'present', proposed_tree: { milestones: [{ id: 'I', children: [{ id: 'I.1' }] }] }, current_proposal_revision: 3 }, '/tmp')));
check('position commit: includes Stage 8', /Stage 8/.test(renderPosition({ stage: 'commit', proposed_tree: { milestones: [] } }, '/tmp')));
check('position unknown stage: fallback line', /no specific recap/.test(renderPosition({ stage: 'committed' }, '/tmp')));

// ============================================================================
// renderOpenThreads
// ============================================================================
console.log('renderOpenThreads');
check('open threads: empty → none', renderOpenThreads({}) === 'Open threads: none.');
check('open threads: undefined → none', renderOpenThreads({ open_threads: [] }) === 'Open threads: none.');
{
  const t = renderOpenThreads({ open_threads: ['data model', 'offline mode'] });
  check('open threads: bullet list', /- data model/.test(t) && /- offline mode/.test(t));
}
{
  const t = renderOpenThreads({ open_threads: [{ topic: 'x', notes: 'y' }] });
  check('open threads: object thread serialized', /"topic":"x"/.test(t));
}

// ============================================================================
// renderRestartConfirmPrompt
// ============================================================================
console.log('renderRestartConfirmPrompt');
{
  const out = renderRestartConfirmPrompt({ turn_count: 5, answered_questions: [{}, {}], proposed_tree: { milestones: [{}, {}, {}] } });
  check('restart prompt: counts.turn_count', out.counts.turn_count === 5);
  check('restart prompt: counts.answered', out.counts.answered === 2);
  check('restart prompt: counts.milestones', out.counts.milestones === 3);
  check('restart prompt: text mentions destructive', /destructive/.test(out.text));
  check('restart prompt: text preserves calibration', /Calibration WILL be preserved/.test(out.text));
  check('restart prompt: confirm + cancel paths', /confirm/.test(out.text) && /cancel/.test(out.text));
}
{
  const out = renderRestartConfirmPrompt({});
  check('restart prompt: empty state zeros', out.counts.turn_count === 0 && out.counts.answered === 0 && out.counts.milestones === 0);
}

// ============================================================================
// buildReentryTurn — persists pending_reentry; emits summary
// ============================================================================
console.log('buildReentryTurn');
{
  const { projectDir, tmpRoot } = makeTempProject('build-no-plan');
  // No OVERDRIVE.md at all.
  const r = buildReentryTurn(projectDir);
  check('build no-plan: ok=false', r.ok === false);
  check('build no-plan: reason missing-plan', r.reason === 'missing-plan');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('build-happy');
  writeFixture(projectDir, 'stage: plan\nlast_action: "' + HOUR_AGO_ISO + '"\nturn_count: 2\nopen_threads: ["x"]\nproposed_tree:\n  milestones:\n    - id: "I"\n      title: "M1"\n      children: []');
  const r = buildReentryTurn(projectDir);
  check('build happy: ok', r.ok === true);
  check('build happy: status=reentry', r.status === 'reentry');
  check('build happy: mode=plan', r.mode === 'plan');
  check('build happy: kind=reentry-summary', r.kind === 'reentry-summary');
  check('build happy: pending_reentry=true', r.pending_reentry === true);
  check('build happy: text mentions r3 §5.7', /r3 §5\.7/.test(r.text));
  check('build happy: text shows last_action', new RegExp(HOUR_AGO_ISO).test(r.text));
  check('build happy: text shows action paths', /\(1\) approved/.test(r.text));
  const persisted = readDeliberationState(projectDir);
  check('build happy: pending_reentry persisted', persisted.pending_reentry === true);
  check('build happy: last_action NOT updated', persisted.last_action === HOUR_AGO_ISO);
  cleanup(tmpRoot);
}
{
  // Idempotence: repeat build doesn't change anything but re-emits.
  const { projectDir, tmpRoot } = makeTempProject('build-idempotent');
  writeFixture(projectDir, 'stage: plan\nlast_action: "' + HOUR_AGO_ISO + '"\nturn_count: 1');
  const r1 = buildReentryTurn(projectDir);
  const r2 = buildReentryTurn(projectDir);
  check('build idempotent: both ok', r1.ok && r2.ok);
  check('build idempotent: same summary_stage', r1.summary_stage === r2.summary_stage);
  cleanup(tmpRoot);
}
{
  // Mid-restart-confirm re-entry: emits restart prompt, NOT high-level summary.
  const { projectDir, tmpRoot } = makeTempProject('build-mid-restart-confirm');
  writeFixture(projectDir, 'stage: plan\nlast_action: "' + HOUR_AGO_ISO + '"\nturn_count: 2\npending_reentry: true\nawaiting_restart_confirm: true');
  const r = buildReentryTurn(projectDir);
  check('build mid-restart: kind=restart-confirm-resume', r.kind === 'restart-confirm-resume');
  check('build mid-restart: awaiting_confirm=true', r.awaiting_confirm === true);
  check('build mid-restart: text mentions destructive', /destructive/.test(r.text));
  check('build mid-restart: text does NOT have high-level summary header', !/Resuming deliberation — multi-session/.test(r.text));
  cleanup(tmpRoot);
}

// ============================================================================
// buildStaleTurn
// ============================================================================
console.log('buildStaleTurn');
{
  const { projectDir, tmpRoot } = makeTempProject('stale-happy');
  writeFixture(projectDir, 'stage: plan\nproposed_tree:\n  milestones:\n    - id: "I"\n      title: "x"\n      children: []');
  const drift = { drifted: true, reason: 'milestone-count-mismatch', proposedIds: ['I'], committedIds: ['I', 'II'] };
  const r = buildStaleTurn(projectDir, drift);
  check('stale build: ok', r.ok === true);
  check('stale build: kind=stale-state', r.kind === 'stale-state');
  check('stale build: drift_reason', r.drift_reason === 'milestone-count-mismatch');
  check('stale build: text mentions Tree drift', /Tree drift detected/.test(r.text));
  check('stale build: text has reconcile path', /reconcile/.test(r.text));
  check('stale build: persisted pending_reentry', readDeliberationState(projectDir).pending_reentry === true);
  cleanup(tmpRoot);
}

// ============================================================================
// applyReentryTurn — validation rejections
// ============================================================================
console.log('applyReentryTurn validation');
{
  const { projectDir, tmpRoot } = makeTempProject('apply-no-state');
  // openState returns missing-plan
  const r = applyReentryTurn(projectDir, { kind: 'approved' });
  check('apply: no plan → missing-plan reason', r.reason === 'missing-plan');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('apply-null-entries');
  writeFixture(projectDir, 'stage: plan\npending_reentry: true');
  const r = applyReentryTurn(projectDir, null);
  check('apply null entries: invalid-shape', r.reason === 'invalid-shape');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('apply-array-entries');
  writeFixture(projectDir, 'stage: plan\npending_reentry: true');
  const r = applyReentryTurn(projectDir, []);
  check('apply array entries: invalid-shape', r.reason === 'invalid-shape');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('apply-invalid-kind');
  writeFixture(projectDir, 'stage: plan\npending_reentry: true');
  const r = applyReentryTurn(projectDir, { kind: 'bogus' });
  check('apply invalid kind: invalid-kind', r.reason === 'invalid-kind');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('apply-no-pending');
  writeFixture(projectDir, 'stage: plan\nlast_action: "' + NOW_ISO + '"');
  const r = applyReentryTurn(projectDir, { kind: 'approved' });
  check('apply no-pending: rejected', r.ok === false);
  check('apply no-pending: reason no-pending-reentry', r.reason === 'no-pending-reentry');
  cleanup(tmpRoot);
}

// ============================================================================
// applyReentryTurn — approved
// ============================================================================
console.log('applyReentryTurn approved');
{
  const { projectDir, tmpRoot } = makeTempProject('apply-approved');
  writeFixture(projectDir, 'stage: plan\npending_reentry: true\nturn_count: 4');
  const r = applyReentryTurn(projectDir, { kind: 'approved' }, { now: NOW });
  check('apply approved: ok', r.ok === true);
  check('apply approved: status=reentry', r.status === 'reentry');
  check('apply approved: kind=approved', r.kind === 'approved');
  check('apply approved: resumed_stage=plan', r.resumed_stage === 'plan');
  check('apply approved: text mentions Resuming', /Resuming deliberation/.test(r.text));
  const persisted = readDeliberationState(projectDir);
  check('apply approved: pending_reentry cleared', persisted.pending_reentry == null);
  check('apply approved: last_action updated to NOW', persisted.last_action === NOW_ISO);
  check('apply approved: stage preserved', persisted.stage === 'plan');
  cleanup(tmpRoot);
}

// ============================================================================
// applyReentryTurn — review
// ============================================================================
console.log('applyReentryTurn review');
{
  const { projectDir, tmpRoot } = makeTempProject('apply-review-empty');
  writeFixture(projectDir, 'stage: elicit\npending_reentry: true\nanswered_questions: []');
  const r = applyReentryTurn(projectDir, { kind: 'review' }, { now: NOW });
  check('apply review empty: ok', r.ok === true);
  check('apply review empty: answered_count=0', r.answered_count === 0);
  check('apply review empty: text mentions no answered', /no answered questions/.test(r.text));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('apply-review-populated');
  writeFixture(projectDir,
    'stage: plan\npending_reentry: true\n' +
    'answered_questions:\n' +
    '  - stage: elicit\n    question: "what is the goal?"\n    answer: "build dashboard"\n    classification: high\n' +
    '  - stage: elicit\n    question: "who is the user?"\n    answer: "ops team"\n'
  );
  const r = applyReentryTurn(projectDir, { kind: 'review' }, { now: NOW });
  check('apply review populated: answered_count=2', r.answered_count === 2);
  check('apply review populated: text shows Q1', /Q1 \[elicit\]: what is the goal\?/.test(r.text));
  check('apply review populated: text shows Q2', /Q2 \[elicit\]: who is the user\?/.test(r.text));
  check('apply review populated: text shows answers', /build dashboard/.test(r.text) && /ops team/.test(r.text));
  check('apply review populated: text shows classification', /classification: high/.test(r.text));
  check('apply review populated: text shows resuming line', /Resuming at stage "plan"/.test(r.text));
  const persisted = readDeliberationState(projectDir);
  check('apply review populated: pending cleared', persisted.pending_reentry == null);
  cleanup(tmpRoot);
}

// ============================================================================
// applyReentryTurn — reconcile
// ============================================================================
console.log('applyReentryTurn reconcile');
{
  const { projectDir, tmpRoot } = makeTempProject('apply-reconcile');
  writeFixture(projectDir,
    'stage: plan\npending_reentry: true\nblind_spot_inserted: true\ncurrent_proposal_revision: 4\n' +
    'calibration:\n  domain: medium\n  technical: high\n  scope: low\n  override: none\n' +
    'answered_questions:\n  - stage: elicit\n    question: "q?"\n    answer: "a"\n' +
    'proposed_tree:\n  milestones:\n    - id: "I"\n      children: []'
  );
  const r = applyReentryTurn(projectDir, { kind: 'reconcile' }, { now: NOW });
  check('apply reconcile: ok', r.ok === true);
  check('apply reconcile: resumed_stage=elicit', r.resumed_stage === 'elicit');
  check('apply reconcile: text mentions preserved calibration', /Calibration \+ prior answered_questions preserved/.test(r.text));
  const persisted = readDeliberationState(projectDir);
  check('apply reconcile: stage=elicit', persisted.stage === 'elicit');
  check('apply reconcile: proposed_tree gone', persisted.proposed_tree == null);
  check('apply reconcile: blind_spot_inserted gone', persisted.blind_spot_inserted == null);
  check('apply reconcile: current_proposal_revision gone', persisted.current_proposal_revision == null);
  check('apply reconcile: pending_reentry cleared', persisted.pending_reentry == null);
  check('apply reconcile: calibration preserved', persisted.calibration && persisted.calibration.domain === 'medium');
  check('apply reconcile: answered_questions preserved', Array.isArray(persisted.answered_questions) && persisted.answered_questions.length === 1);
  cleanup(tmpRoot);
}

// ============================================================================
// applyReentryTurn — restart double-confirm flow
// ============================================================================
console.log('applyReentryTurn restart double-confirm');
{
  // First-restart (no confirm field): sets awaiting_restart_confirm + returns confirmation prompt.
  const { projectDir, tmpRoot } = makeTempProject('apply-restart-first');
  writeFixture(projectDir,
    'stage: plan\npending_reentry: true\nturn_count: 4\n' +
    'answered_questions:\n  - stage: elicit\n    question: "q?"\n    answer: "a"\n' +
    'proposed_tree:\n  milestones:\n    - id: "I"\n      children: []\n    - id: "II"\n      children: []'
  );
  const r = applyReentryTurn(projectDir, { kind: 'restart' }, { now: NOW });
  check('apply restart first: ok', r.ok === true);
  check('apply restart first: kind=restart', r.kind === 'restart');
  check('apply restart first: confirmed=null', r.confirmed === null);
  check('apply restart first: awaiting_confirm=true', r.awaiting_confirm === true);
  check('apply restart first: counts.turn_count=4', r.counts.turn_count === 4);
  check('apply restart first: counts.milestones=2', r.counts.milestones === 2);
  check('apply restart first: text mentions destructive', /destructive/.test(r.text));
  const persisted = readDeliberationState(projectDir);
  check('apply restart first: awaiting_restart_confirm persisted', persisted.awaiting_restart_confirm === true);
  check('apply restart first: pending_reentry still true', persisted.pending_reentry === true);
  cleanup(tmpRoot);
}
{
  // confirm:true with awaiting → clears state, preserves calibration.
  const { projectDir, tmpRoot } = makeTempProject('apply-restart-confirm');
  writeFixture(projectDir,
    'stage: plan\npending_reentry: true\nawaiting_restart_confirm: true\nturn_count: 5\n' +
    'calibration:\n  domain: high\n  technical: medium\n  scope: high\n  override: detailed\n' +
    'answered_questions:\n  - stage: elicit\n    question: "q?"\n    answer: "a"\n' +
    'proposed_tree:\n  milestones:\n    - id: "I"\n      children: []'
  );
  const r = applyReentryTurn(projectDir, { kind: 'restart', confirm: true }, { now: NOW });
  check('apply restart confirm: ok', r.ok === true);
  check('apply restart confirm: confirmed=true', r.confirmed === true);
  check('apply restart confirm: cleared_counts.turn_count=5', r.cleared_counts.turn_count === 5);
  check('apply restart confirm: cleared_counts.milestones=1', r.cleared_counts.milestones === 1);
  check('apply restart confirm: text mentions Restart confirmed', /Restart confirmed/.test(r.text));
  check('apply restart confirm: text mentions calibration preserved', /Calibration preserved/.test(r.text));
  const persisted = readDeliberationState(projectDir);
  check('apply restart confirm: stage=elicit', persisted.stage === 'elicit');
  check('apply restart confirm: turn_count=0', persisted.turn_count === 0);
  check('apply restart confirm: proposed_tree gone', persisted.proposed_tree == null);
  check('apply restart confirm: pending_reentry cleared', persisted.pending_reentry == null);
  check('apply restart confirm: awaiting_restart_confirm cleared', persisted.awaiting_restart_confirm == null);
  check('apply restart confirm: calibration preserved (domain)', persisted.calibration.domain === 'high');
  check('apply restart confirm: calibration preserved (override)', persisted.calibration.override === 'detailed');
  check('apply restart confirm: answered_questions empty', Array.isArray(persisted.answered_questions) && persisted.answered_questions.length === 0);
  cleanup(tmpRoot);
}
{
  // confirm:true WITHOUT awaiting → rejected.
  const { projectDir, tmpRoot } = makeTempProject('apply-restart-confirm-no-pending');
  writeFixture(projectDir, 'stage: plan\npending_reentry: true');
  const r = applyReentryTurn(projectDir, { kind: 'restart', confirm: true }, { now: NOW });
  check('apply restart confirm without awaiting: rejected', r.ok === false);
  check('apply restart confirm without awaiting: reason no-pending-restart', r.reason === 'no-pending-restart');
  const persisted = readDeliberationState(projectDir);
  check('apply restart confirm without awaiting: no destructive write', persisted.stage === 'plan' && persisted.pending_reentry === true);
  cleanup(tmpRoot);
}
{
  // confirm:false → explicit cancel (Q3.9.6' refinement).
  const { projectDir, tmpRoot } = makeTempProject('apply-restart-cancel');
  writeFixture(projectDir,
    'stage: plan\npending_reentry: true\nawaiting_restart_confirm: true\nturn_count: 3\n' +
    'proposed_tree:\n  milestones:\n    - id: "I"\n      children: []'
  );
  const r = applyReentryTurn(projectDir, { kind: 'restart', confirm: false }, { now: NOW });
  check('apply restart cancel: ok', r.ok === true);
  check('apply restart cancel: confirmed=false', r.confirmed === false);
  check('apply restart cancel: cancelled=true', r.cancelled === true);
  check('apply restart cancel: text mentions cancelled', /cancelled/.test(r.text));
  const persisted = readDeliberationState(projectDir);
  check('apply restart cancel: awaiting_restart_confirm cleared', persisted.awaiting_restart_confirm == null);
  check('apply restart cancel: pending_reentry cleared', persisted.pending_reentry == null);
  check('apply restart cancel: stage preserved', persisted.stage === 'plan');
  check('apply restart cancel: turn_count preserved', persisted.turn_count === 3);
  check('apply restart cancel: proposed_tree preserved', persisted.proposed_tree && persisted.proposed_tree.milestones.length === 1);
  cleanup(tmpRoot);
}

// ============================================================================
// runReentry orchestrator
// ============================================================================
console.log('runReentry');
{
  const { projectDir, tmpRoot } = makeTempProject('orch-plan');
  writeFixture(projectDir, 'stage: plan\nlast_action: "' + HOUR_AGO_ISO + '"\nturn_count: 1');
  const r = runReentry(projectDir, {});
  check('orch plan: mode=plan', r.mode === 'plan');
  check('orch plan: kind=reentry-summary', r.kind === 'reentry-summary');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('orch-commit');
  writeFixture(projectDir, 'stage: plan\npending_reentry: true');
  const r = runReentry(projectDir, { entries: { kind: 'approved' }, now: NOW });
  check('orch commit: mode=commit', r.mode === 'commit');
  check('orch commit: kind=approved', r.kind === 'approved');
  cleanup(tmpRoot);
}

// ============================================================================
// runDeliberate intercept (integration via deliberate.runDeliberate)
// ============================================================================
console.log('runDeliberate intercept');
{
  // No state → no intercept; falls through to normal stage routing (elicit build).
  const { projectDir, tmpRoot } = makeTempProject('intercept-no-state');
  fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), `${FRONT}# T\n`);
  const r = deliberate.runDeliberate(projectDir, {});
  check('intercept no-state: status=deliberate (not reentry)', r.status === 'deliberate');
  cleanup(tmpRoot);
}
{
  // Recent activity → no intercept.
  const { projectDir, tmpRoot } = makeTempProject('intercept-recent');
  writeFixture(projectDir, 'stage: elicit\nlast_action: "' + TEN_MIN_AGO_ISO + '"\nturn_count: 1');
  const r = deliberate.runDeliberate(projectDir, { now: NOW });
  check('intercept recent: status=deliberate (no re-entry)', r.status === 'deliberate');
  cleanup(tmpRoot);
}
{
  // Pause > 1h → re-entry intercept fires.
  const { projectDir, tmpRoot } = makeTempProject('intercept-pause');
  writeFixture(projectDir, 'stage: plan\nlast_action: "' + HOUR_AGO_ISO + '"\nturn_count: 1\nproposed_tree:\n  milestones:\n    - id: "I"\n      children: []');
  const r = deliberate.runDeliberate(projectDir, { now: NOW });
  check('intercept pause: status=reentry', r.status === 'reentry');
  check('intercept pause: kind=reentry-summary', r.kind === 'reentry-summary');
  cleanup(tmpRoot);
}
{
  // Pending re-entry + commit-mode → routes to applyReentryTurn.
  const { projectDir, tmpRoot } = makeTempProject('intercept-pending-commit');
  writeFixture(projectDir, 'stage: plan\npending_reentry: true\nturn_count: 1');
  const r = deliberate.runDeliberate(projectDir, { mode: 'commit', entries: { kind: 'approved' }, now: NOW });
  check('intercept pending commit: status=reentry', r.status === 'reentry');
  check('intercept pending commit: kind=approved', r.kind === 'approved');
  // After approved, next bare invocation routes normally.
  const r2 = deliberate.runDeliberate(projectDir, { now: NOW });
  check('intercept after approved: status=deliberate (now back to normal)', r2.status === 'deliberate');
  cleanup(tmpRoot);
}
{
  // skipReentry opt-out (test-only).
  const { projectDir, tmpRoot } = makeTempProject('intercept-skip-opt');
  writeFixture(projectDir, 'stage: plan\nlast_action: "' + HOUR_AGO_ISO + '"\nturn_count: 1\nproposed_tree:\n  milestones:\n    - id: "I"\n      children: []');
  const r = deliberate.runDeliberate(projectDir, { now: NOW, skipReentry: true });
  check('intercept skipReentry: status=deliberate (intercept skipped)', r.status === 'deliberate');
  cleanup(tmpRoot);
}
{
  // Tree-drift intercept (committed tree differs from proposed).
  const { projectDir, tmpRoot } = makeTempProject('intercept-stale');
  const tree = '## I. M1 []\n## II. M2 []\n';
  writeFixture(projectDir, 'stage: plan\nlast_action: "' + TEN_MIN_AGO_ISO + '"\nturn_count: 1\nproposed_tree:\n  milestones:\n    - id: "I"\n      children: []', { tree });
  const r = deliberate.runDeliberate(projectDir, { now: NOW });
  check('intercept stale: status=reentry', r.status === 'reentry');
  check('intercept stale: kind=stale-state', r.kind === 'stale-state');
  check('intercept stale: drift_reason set', typeof r.drift_reason === 'string');
  cleanup(tmpRoot);
}

// ============================================================================
// Migration-compat seam — fresh project (no plan / no block) is a no-op
// ============================================================================
console.log('migration-compat seam');
{
  const { projectDir, tmpRoot } = makeTempProject('migration-no-plan');
  // No OVERDRIVE.md at all.
  const r = deliberate.runDeliberate(projectDir, { now: NOW });
  // openState fails → no intercept fires → falls through. runDeliberate's switch routes
  // to the elicit stage build, which reports missing-plan from buildElicitTurn.
  check('migration no-plan: status=deliberate', r.status === 'deliberate');
  check('migration no-plan: ok=false (missing plan)', r.ok === false);
  cleanup(tmpRoot);
}

// ============================================================================
// formatPlan / formatCommit
// ============================================================================
console.log('formatPlan / formatCommit');
check('formatPlan returns text', formatPlan({ text: 'hi' }) === 'hi');
check('formatPlan default', formatPlan(null) === '(no plan text)');
check('formatCommit returns text', formatCommit({ text: 'hey' }) === 'hey');
check('formatCommit default', formatCommit({}) === '(no commit text)');

// ============================================================================
// Summary
// ============================================================================
console.log('');
console.log(`${pass} checks passed.`);
if (fail > 0) {
  console.error(`${fail} FAILURES`);
  process.exit(1);
}
