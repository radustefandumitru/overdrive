#!/usr/bin/env node
'use strict';

// Task 7.1 — cross-pipeline smoke test.
//
// Drives the real v2 CLI handlers (runWorkflow / runPlan / runGo / runLog) through
// the full session loop on a seeded fixture project, exercising the cross-pipeline
// seams (plan <-> go <-> log <-> cache <-> parser) plus the required non-happy
// paths (iteration loop, FIX escalation, --small scope-growth, DECISION POINT —
// Q7.1). No LLM (Pattern 1): every agent return is a canned --entries-json payload.
// Final artifacts are validated with the Task 7.3 verifier (verifyPlanLayout).

const fs = require('fs');
const os = require('os');
const path = require('path');

const ovd = require('../lib/ovd-plan');
const { parseOverdriveMd } = require('../lib/ovd-plan/parser');
const { regenerateCacheFrom, loadCache, findNodeById } = require('../lib/ovd-plan/cache');
const { scaffoldOverdrivePlan } = require('../lib/ovd-plan/fs');
const { verifyPlanLayout } = require('../lib/ovd-plan/verify-layout');

const verbose = process.argv.includes('--verbose');
let passed = 0;
const failures = [];
function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    if (verbose) console.log(`PASS ${label}`);
  } else {
    failures.push(detail ? `${label}: ${detail}` : label);
    console.log(`FAIL ${label}`);
  }
}

const FIXTURE = path.resolve(__dirname, 'fixtures/ovd-plan/smoke/OVERDRIVE.md');
const env = process.env;

// --- Setup: seed a temp project from the committed fixture --------------------
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ovd-smoke-'));
const projectDir = path.join(tmpRoot, 'app');
fs.mkdirSync(projectDir, { recursive: true });
fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"smoke-app"}\n');

// Scaffold .overdrive/ structure (real fs primitive), then drop the fixture tree.
const scaffold = scaffoldOverdrivePlan(projectDir);
check('scaffold .overdrive structure', scaffold.scaffolded === true, JSON.stringify(scaffold));
fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), fs.readFileSync(FIXTURE, 'utf8'));
regenerateCacheFrom(projectDir);

// --- Handler helpers (mirror the CLI dispatch option-mapping) ----------------
function withEntries(opts, entries) {
  return entries ? { ...opts, entriesJson: JSON.stringify(entries) } : opts;
}
function workflow(subcommand, { entries } = {}) {
  return ovd.runWorkflow(withEntries({ projectDir, subcommand: subcommand || null }, entries), env);
}
function plan(subcommand, { text, entries } = {}) {
  return ovd.runPlan(withEntries({ projectDir, subcommand: subcommand || null, text: text || null }, entries), env);
}
function go(subcommand, { text, entries } = {}) {
  return ovd.runGo(withEntries({ projectDir, subcommand: subcommand || null, text: text || null }, entries), env);
}
function log(subcommand, { text, entries } = {}) {
  return ovd.runLog(withEntries({ projectDir, subcommand: subcommand || null, text: text || null }, entries), env);
}
function statusOf(id) {
  const parsed = parseOverdriveMd(fs.readFileSync(path.join(projectDir, 'OVERDRIVE.md'), 'utf8'));
  const found = findNodeById(parsed.tree, id);
  return found ? found.node.status : null;
}
// Drive a leaf to done: execute -> verify(pass) -> review(approved).
function completeLeaf(id, file) {
  const e = go('execute', { text: id, entries: { leaf_id: id, files_touched: [file] } });
  check(`execute ${id} ok`, e && e.ok !== false, e && e.reason);
  const v = go('verify', { text: id, entries: { leaf_id: id, result: 'pass' } });
  check(`verify ${id} ok`, v && v.ok !== false, v && v.reason);
  const r = go('review', { text: id, entries: { leaf_id: id, response: 'approved, ship it' } });
  check(`review ${id} ok`, r && r.ok !== false, r && r.reason);
}

// --- 1. Workflow pipeline responds (init entry) ------------------------------
{
  const r = workflow('init');
  check('workflow init pipeline responds', r && r.ok !== false, r && r.reason);
}

// --- 2. Plan pipeline: display reads the tree --------------------------------
{
  const r = plan('display');
  check('plan display ok', r && r.ok !== false, r && r.reason);
  check('plan display renders project', /Smoke Test App/.test(r.text || ''), r && r.text);
}

// --- 3. Go pipeline: orient reads active state -------------------------------
{
  const r = go(null, {});
  check('go orient ok', r && r.ok !== false, r && r.reason);
}

// --- 4. Happy path: complete milestone I (I.1, I.2, I.3) ----------------------
completeLeaf('I.1', 'src/index.ts');
completeLeaf('I.2', 'src/db/schema.ts');
completeLeaf('I.3', 'src/config.ts');
check('I.1 done after review', statusOf('I.1') === 'done', statusOf('I.1'));
check('I.2 done after review', statusOf('I.2') === 'done', statusOf('I.2'));
check('I.3 done after review', statusOf('I.3') === 'done', statusOf('I.3'));

// --- 5. Recursive close: milestone I closes once all children done -----------
{
  const r = go('close', { text: 'I.3', entries: { node_id: 'I', decision: 'close' } });
  check('go close cascade ok', r && r.ok !== false, r && r.reason);
  check('milestone I closed (done)', statusOf('I') === 'done', statusOf('I'));
}

// --- 6. NON-HAPPY: iteration loop on II.1.a ----------------------------------
{
  go('execute', { text: 'II.1.a', entries: { leaf_id: 'II.1.a', files_touched: ['src/widgets/layout.tsx'] } });
  const r = go('iterate', { text: 'II.1.a', entries: { leaf_id: 'II.1.a', feedback: 'make the layout smaller' } });
  check('iterate II.1.a ok', r && r.ok !== false, r && r.reason);
}

// --- 7. NON-HAPPY: FIX escalation on II.1.b (repeated failures) ---------------
{
  go('execute', { text: 'II.1.b', entries: { leaf_id: 'II.1.b', files_touched: ['src/widgets/data.ts'] } });
  let escalated = false;
  let lastReason = null;
  // The FIX cap is 2 attempts; the 2nd failure escalates (mode fix-escalate).
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const r = go('fix', { text: 'II.1.b', entries: { leaf_id: 'II.1.b', result: 'fail', approach: `attempt ${attempt}`, error: 'still failing' } });
    lastReason = r && (r.mode || r.reason || r.status);
    if (r && (r.escalated === true || r.mode === 'fix-escalate')) { escalated = true; break; }
    if (r && r.ok === false) break;
  }
  check('FIX escalation surfaced at the 2-attempt cap', escalated, lastReason);
}

// --- 8. NON-HAPPY: --small scope-growth detection ----------------------------
{
  const r = go('monitor', { entries: { files_touched: ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'] } });
  check('small monitor ok', r && r.ok !== false, r && r.reason);
  check('small scope-growth exceeded', r.exceeded === true, JSON.stringify(r));
}

// --- 9. NON-HAPPY: DECISION POINT surface + resolve --------------------------
{
  const surface = go('decision', { entries: { leaf_id: 'II.2.a', kind: 'scope-overflow', ambiguity: 'CSS bleeds into II.2.b styling — expand scope?', recommended: { label: 'expand', reasoning: 'shared stylesheet needed now' } } });
  check('decision surface ok', surface && surface.ok !== false, surface && surface.reason);
  const resolve = go('decision', { entries: { leaf_id: 'II.2.a', kind: 'scope-overflow', chosen: 'expand', rationale: 'shared stylesheet needed now' } });
  check('decision resolve ok', resolve && resolve.ok !== false, resolve && resolve.reason);
}

// --- 10. Log pipeline: mid-session lightweight save --------------------------
{
  const r = log(null, { entries: { capture: { modifications: ['completed milestone I', 'started milestone II'] } } });
  check('log default save ok', r && r.ok !== false, r && r.reason);
  const sessions = fs.readdirSync(path.join(projectDir, '.overdrive', 'sessions'));
  check('log default wrote a session file', sessions.length > 0, sessions.join(','));
}

// --- 11. Resume simulation: re-read state, prior progress preserved ----------
{
  const r = go(null, {});
  check('resume orient ok', r && r.ok !== false, r && r.reason);
  check('resume: I.1 still done', statusOf('I.1') === 'done', statusOf('I.1'));
}

// --- 12. Log pipeline: full handoff ------------------------------------------
{
  const r = log('handoff', { entries: { summary: { highlights: ['milestone I complete', 'milestone II underway'] } } });
  check('log handoff ok', r && r.ok !== false, r && r.reason);
  const handoffs = fs.readdirSync(path.join(projectDir, '.overdrive', 'handoffs'));
  check('handoff file written', handoffs.length > 0, handoffs.join(','));
}

// --- 13. Milestone close cascade (milestone I fully done) --------------------
{
  const r = log('milestone-close', { text: 'I', entries: { milestone_id: 'I', learnings: { what_worked: ['clean scaffolding'] }, release_prep: { checklist: ['build: pass'] } } });
  check('milestone-close ok', r && r.ok === true, r && r.reason);
}

// --- 14. Final artifact validity (Task 7.3 verifier as cross-check) ----------
{
  let parsedOk = true;
  try { parseOverdriveMd(fs.readFileSync(path.join(projectDir, 'OVERDRIVE.md'), 'utf8')); }
  catch (e) { parsedOk = false; failures.push(`final OVERDRIVE.md parse: ${e.message}`); }
  check('final OVERDRIVE.md parses cleanly', parsedOk);

  regenerateCacheFrom(projectDir); // realign cache after all mutations
  const v = verifyPlanLayout(projectDir);
  check('final verify-layout has no errors', v.counts.error === 0, JSON.stringify(v.findings));
  check('final cache loads', !!loadCache(projectDir));
}

// --- Teardown ----------------------------------------------------------------
fs.rmSync(tmpRoot, { recursive: true, force: true });

console.log(`\n${passed} checks passed.`);
if (failures.length > 0) {
  console.log(`${failures.length} failure(s):`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
