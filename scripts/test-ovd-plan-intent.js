#!/usr/bin/env node
'use strict';

// Task 6.1 — Intent classifier core.
//
// Pattern 1 reminder: the CLI never classifies the message in code. intent.js
// builds the classification PROMPT (catalog + state + message) and validates the
// agent's structured answer. The CLASSIFICATION_MATRIX below is a *contract
// fixture* (analogous to evals/router-benchmark.json) that documents intended
// routing and asserts the catalog covers every route the matrix expects — it is
// NOT a keyword table and is NOT consumed by intent.js to classify.

const fs = require('fs');
const os = require('os');
const path = require('path');

const intent = require('../lib/ovd-plan/intent');
const {
  STATUS,
  ROUTE_CATALOG,
  CONFIDENCE_VALUES,
  catalogRoutes,
  isKnownRoute,
  summarizeState,
  buildClassificationPrompt,
  normalizeClassification,
  classifyIntent,
  renderAmbiguityPrompt,
  isExplicitCommand,
  routeOrPrompt,
  gatherProjectState,
  runIntent,
  recordIntentCorrection
} = intent;

const ovdPlan = require('../lib/ovd-plan');

function makeTempProject(name, planContent) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-intent-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
  if (planContent) fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), planContent);
  return { projectDir, tmpRoot };
}
function cleanup(tmpRoot) { fs.rmSync(tmpRoot, { recursive: true, force: true }); }

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

// ---------------------------------------------------------------------------
// Module surface
// ---------------------------------------------------------------------------
check('STATUS is "intent"', STATUS === 'intent', STATUS);
check('ROUTE_CATALOG is a non-empty array', Array.isArray(ROUTE_CATALOG) && ROUTE_CATALOG.length > 0);
check('CONFIDENCE_VALUES is a Set', CONFIDENCE_VALUES instanceof Set);
check('CONFIDENCE_VALUES has unambiguous', CONFIDENCE_VALUES.has('unambiguous'));
check('CONFIDENCE_VALUES has ambiguous', CONFIDENCE_VALUES.has('ambiguous'));
check('CONFIDENCE_VALUES has exactly 2 values', CONFIDENCE_VALUES.size === 2, String(CONFIDENCE_VALUES.size));
check('catalogRoutes is a function', typeof catalogRoutes === 'function');
check('isKnownRoute is a function', typeof isKnownRoute === 'function');
check('summarizeState is a function', typeof summarizeState === 'function');
check('buildClassificationPrompt is a function', typeof buildClassificationPrompt === 'function');
check('normalizeClassification is a function', typeof normalizeClassification === 'function');
check('classifyIntent is a function', typeof classifyIntent === 'function');

// ---------------------------------------------------------------------------
// Route catalog integrity (Q6.1: hardcoded constant)
// ---------------------------------------------------------------------------
check('every catalog entry has a route string', ROUTE_CATALOG.every((e) => typeof e.route === 'string' && e.route.length > 0));
check('every catalog entry has a description string', ROUTE_CATALOG.every((e) => typeof e.description === 'string' && e.description.length > 0));
check('every catalog route starts with /ovd-', ROUTE_CATALOG.every((e) => e.route.startsWith('/ovd-')));
{
  const routes = ROUTE_CATALOG.map((e) => e.route);
  check('catalog routes are unique', new Set(routes).size === routes.length);
}
check('catalogRoutes returns array of strings', Array.isArray(catalogRoutes()) && catalogRoutes().every((r) => typeof r === 'string'));
check('catalogRoutes length matches catalog', catalogRoutes().length === ROUTE_CATALOG.length);
check('isKnownRoute true for /ovd-plan idea', isKnownRoute('/ovd-plan idea'));
check('isKnownRoute true for /ovd-go --small', isKnownRoute('/ovd-go --small'));
check('isKnownRoute true for /ovd-log', isKnownRoute('/ovd-log'));
check('isKnownRoute false for unknown route', !isKnownRoute('/ovd-nonsense'));
check('isKnownRoute false for empty', !isKnownRoute(''));
check('isKnownRoute false for non-string', !isKnownRoute(null) && !isKnownRoute(42));
// Catalog must cover the route families the spec routes to (r3 §8.3 + readiness brief).
for (const required of ['/ovd-workflow', '/ovd-plan', '/ovd-plan idea', '/ovd-plan edit', '/ovd-plan research', '/ovd-go', '/ovd-go --small', '/ovd-log', '/ovd-log handoff']) {
  check(`catalog covers required route ${required}`, isKnownRoute(required));
}

// ---------------------------------------------------------------------------
// summarizeState — renders present fields, tolerates absence
// ---------------------------------------------------------------------------
{
  const empty = summarizeState(null);
  check('summarizeState(null) returns a string', typeof empty === 'string');
  check('summarizeState(null) signals no project state', /no .*state|uninitial|empty|not.*found/i.test(empty));

  const full = summarizeState({
    projectTitle: 'Foo Dashboard',
    milestone: 'II Dashboard',
    activeNode: { id: 'II.2', title: 'Stats widgets', status: 'in-progress' },
    deliberationStatus: 'committed',
    lastAction: 'execute II.2',
    awaitingReview: 1,
    calibration: { domain: 'web', technical: 'high', scope: 'feature' }
  });
  check('summarizeState includes project title', full.includes('Foo Dashboard'));
  check('summarizeState includes milestone', full.includes('II Dashboard'));
  check('summarizeState includes active node id', full.includes('II.2'));
  check('summarizeState includes active node status', full.includes('in-progress'));
  check('summarizeState includes deliberation status', full.includes('committed'));
  check('summarizeState includes last action', full.includes('execute II.2'));
  check('summarizeState includes awaiting-review signal', /awaiting/i.test(full));
  check('summarizeState includes calibration', full.includes('high'));

  const partial = summarizeState({ activeNode: { id: 'I.1' } });
  check('summarizeState tolerates partial state', typeof partial === 'string' && partial.includes('I.1'));
}

// ---------------------------------------------------------------------------
// buildClassificationPrompt — prompt contains message + catalog + axes + JSON spec
// ---------------------------------------------------------------------------
{
  const state = { projectTitle: 'Demo', activeNode: { id: 'II.2', status: 'in-progress' } };
  const prompt = buildClassificationPrompt({ message: 'I want dark mode', state });
  check('prompt is a string', typeof prompt === 'string' && prompt.length > 0);
  check('prompt includes the user message', prompt.includes('I want dark mode'));
  check('prompt includes the state summary', prompt.includes('II.2'));
  // Catalog routes must all appear so the agent classifies against the menu.
  check('prompt lists every catalog route', ROUTE_CATALOG.every((e) => prompt.includes(e.route)));
  // The four classification axes per r3 §3.3.
  check('prompt references verb-intent axis', /verb/i.test(prompt));
  check('prompt references object axis', /object/i.test(prompt));
  check('prompt references state-context axis', /state context|state-context/i.test(prompt));
  check('prompt references calibration axis', /calibration/i.test(prompt));
  // The structured-answer contract.
  check('prompt instructs to return route', /"route"|\broute\b/.test(prompt));
  check('prompt instructs to return confidence', /confidence/.test(prompt));
  check('prompt instructs to return candidates', /candidates/.test(prompt));
  check('prompt names both confidence labels', prompt.includes('unambiguous') && prompt.includes('ambiguous'));
  // Q6.2 lock: no numeric confidence cutoffs leaking into the prompt.
  check('prompt does not request a numeric confidence score', !/0\.\d|probabilit|percent|score between/i.test(prompt));

  // Message escaping — a message with quotes/newlines must not break the prompt.
  const tricky = buildClassificationPrompt({ message: 'add a "save" button\nand a footer', state: null });
  check('prompt tolerates quotes and newlines in message', typeof tricky === 'string' && tricky.includes('save'));
  check('prompt builds with null state', tricky.length > 0);
}

// ---------------------------------------------------------------------------
// normalizeClassification — Pattern 4 guard on { route, confidence, candidates }
// ---------------------------------------------------------------------------
function unambig(route, args) {
  return { route, confidence: 'unambiguous', candidates: [{ route, rationale: 'fits', ...(args ? { args_hint: args } : {}) }] };
}

// Invalid shapes
check('rejects null', normalizeClassification(null).ok === false);
check('rejects array', normalizeClassification([]).ok === false);
check('rejects string', normalizeClassification('idea').ok === false);
check('rejects missing confidence', normalizeClassification({ route: '/ovd-log', candidates: [] }).ok === false);
check('rejects bad confidence value', normalizeClassification({ route: '/ovd-log', confidence: 'high', candidates: [{ route: '/ovd-log', rationale: 'x' }] }).ok === false);
check('rejects non-array candidates', normalizeClassification({ route: '/ovd-log', confidence: 'unambiguous', candidates: {} }).ok === false);
check('rejects candidate without route', normalizeClassification({ route: '/ovd-log', confidence: 'ambiguous', candidates: [{ rationale: 'x' }] }).ok === false);
check('rejects candidate without rationale', normalizeClassification({ route: '/ovd-log', confidence: 'ambiguous', candidates: [{ route: '/ovd-log' }] }).ok === false);
check('rejects unknown candidate route', normalizeClassification({ route: '/ovd-bogus', confidence: 'unambiguous', candidates: [{ route: '/ovd-bogus', rationale: 'x' }] }).ok === false);
check('rejects unambiguous with 0 candidates', normalizeClassification({ route: '/ovd-log', confidence: 'unambiguous', candidates: [] }).ok === false);
check('rejects unambiguous with 2 candidates', normalizeClassification({ route: '/ovd-log', confidence: 'unambiguous', candidates: [{ route: '/ovd-log', rationale: 'a' }, { route: '/ovd-go', rationale: 'b' }] }).ok === false);
check('rejects unambiguous when route != candidates[0]', normalizeClassification({ route: '/ovd-go', confidence: 'unambiguous', candidates: [{ route: '/ovd-log', rationale: 'a' }] }).ok === false);
check('rejects non-string args_hint', normalizeClassification({ route: '/ovd-plan idea', confidence: 'unambiguous', candidates: [{ route: '/ovd-plan idea', rationale: 'x', args_hint: 5 }] }).ok === false);

// Valid shapes
{
  const u = normalizeClassification(unambig('/ovd-plan idea', 'dark mode'));
  check('accepts valid unambiguous', u.ok === true);
  check('valid unambiguous preserves route', u.ok && u.classification.route === '/ovd-plan idea');
  check('valid unambiguous preserves args_hint', u.ok && u.classification.candidates[0].args_hint === 'dark mode');

  const amb = normalizeClassification({
    route: '/ovd-plan idea',
    confidence: 'ambiguous',
    candidates: [
      { route: '/ovd-plan idea', rationale: 'deliberate a new direction', args_hint: 'adjust dashboard' },
      { route: '/ovd-plan edit', rationale: 'adjust the tree directly' },
      { route: '/ovd-go --small', rationale: 'surgical change', args_hint: 'adjust dashboard' }
    ]
  });
  check('accepts valid ambiguous with 3 candidates', amb.ok === true);
  check('valid ambiguous preserves candidate count', amb.ok && amb.classification.candidates.length === 3);

  // Q6.3: very-low-confidence = ambiguous with 0 or 1 candidate (clarifying-question path).
  const vlow0 = normalizeClassification({ route: null, confidence: 'ambiguous', candidates: [] });
  check('accepts very-low-confidence ambiguous with 0 candidates', vlow0.ok === true);
  const vlow1 = normalizeClassification({ route: '/ovd-go', confidence: 'ambiguous', candidates: [{ route: '/ovd-go', rationale: 'maybe continue' }] });
  check('accepts very-low-confidence ambiguous with 1 candidate', vlow1.ok === true);
}

// ---------------------------------------------------------------------------
// classifyIntent — orchestrator (mirrors skill-router resolvePriorSet shape)
// ---------------------------------------------------------------------------
{
  const noMsg = classifyIntent('', null);
  check('classifyIntent rejects empty message', noMsg.ok === false && noMsg.reason === 'missing-message');

  // No agent answer supplied → returns the prompt for the host agent.
  const needAgent = classifyIntent('I want dark mode', { activeNode: { id: 'II.2' } });
  check('classifyIntent without answer requires host agent', needAgent.ok === false && needAgent.reason === 'requires-host-agent');
  check('classifyIntent without answer returns the prompt', typeof needAgent.prompt === 'string' && needAgent.prompt.includes('I want dark mode'));

  // Agent answer supplied + valid → resolved classification.
  const resolved = classifyIntent('I want dark mode', null, { classification: unambig('/ovd-plan idea', 'I want dark mode') });
  check('classifyIntent resolves valid classification', resolved.ok === true);
  check('classifyIntent resolved carries route', resolved.ok && resolved.route === '/ovd-plan idea');
  check('classifyIntent resolved carries confidence', resolved.ok && resolved.confidence === 'unambiguous');
  check('classifyIntent resolved carries candidates', resolved.ok && Array.isArray(resolved.candidates) && resolved.candidates.length === 1);
  check('classifyIntent resolved still exposes prompt', resolved.ok && typeof resolved.prompt === 'string');

  // Agent answer supplied + invalid → validation failure, no crash.
  const bad = classifyIntent('hmm', null, { classification: { confidence: 'banana' } });
  check('classifyIntent rejects invalid classification', bad.ok === false && bad.reason === 'validation-failed');
  check('classifyIntent invalid carries errors', bad.ok === false && Array.isArray(bad.errors) && bad.errors.length > 0);
}

// ---------------------------------------------------------------------------
// Task 6.2 — renderAmbiguityPrompt (r3 §3.2 shape; Pattern 7; Q6.8 cap)
// ---------------------------------------------------------------------------
check('renderAmbiguityPrompt is a function', typeof renderAmbiguityPrompt === 'function');

{
  // Exact snapshot for a concrete 2-candidate set (r3 §3.2 shape, no column align).
  const snap = renderAmbiguityPrompt([
    { route: '/ovd-plan idea', rationale: 'deliberate a new direction', args_hint: 'dark mode' },
    { route: '/ovd-plan edit', rationale: 'adjust the existing tree directly' }
  ]);
  const expected = [
    'I read your message a few ways. Pick one:',
    '',
    ' (1) /ovd-plan idea "dark mode" — deliberate a new direction',
    ' (2) /ovd-plan edit — adjust the existing tree directly',
    '',
    ' Reply with the number, or describe what you want.'
  ].join('\n');
  check('renderAmbiguityPrompt snapshot matches r3 §3.2 shape', snap === expected, JSON.stringify(snap));
}

{
  const three = renderAmbiguityPrompt([
    { route: '/ovd-plan idea', rationale: 'deliberate', args_hint: 'adjust dashboard' },
    { route: '/ovd-plan edit', rationale: 'adjust the tree directly' },
    { route: '/ovd-go --small', rationale: 'surgical change', args_hint: 'adjust dashboard' }
  ]);
  check('prompt opens with the standard lead-in', three.startsWith('I read your message a few ways. Pick one:'));
  check('prompt always includes the describe-other escape', three.includes('Reply with the number, or describe what you want.'));
  check('prompt numbers options sequentially', three.includes(' (1) ') && three.includes(' (2) ') && three.includes(' (3) '));
  check('prompt renders args_hint in quotes when present', three.includes('/ovd-go --small "adjust dashboard"'));
  check('prompt omits quotes when no args_hint', three.includes('/ovd-plan edit — adjust the tree directly'));
  check('prompt renders rationale after em dash', three.includes(' — deliberate'));
  // Pattern 7 / FM #7: no implicit preference markers.
  check('prompt has no preference markers', !/recommend|\bbest\b|preferred|suggested|★|\*\*/i.test(three));
  check('prompt lists every candidate route', three.includes('/ovd-plan idea') && three.includes('/ovd-plan edit') && three.includes('/ovd-go --small'));
}

{
  // 2 is the floor; 4 is the cap — both render all options.
  const two = renderAmbiguityPrompt([
    { route: '/ovd-log', rationale: 'save' },
    { route: '/ovd-log handoff', rationale: 'full handoff' }
  ]);
  check('two candidates render two options', two.includes(' (1) ') && two.includes(' (2) ') && !two.includes(' (3) '));

  const four = renderAmbiguityPrompt([
    { route: '/ovd-plan idea', rationale: 'a' },
    { route: '/ovd-plan edit', rationale: 'b' },
    { route: '/ovd-go --small', rationale: 'c' },
    { route: '/ovd-go', rationale: 'd' }
  ]);
  check('four candidates render four options', four.includes(' (4) ') && !four.includes(' (5) '));
  check('four-option prompt still has the escape', four.includes('Reply with the number, or describe what you want.'));
}

{
  // Q6.8 overflow: more than 4 candidates → top 3 + escape (clamps to §3.2 shape).
  const overflow = renderAmbiguityPrompt([
    { route: '/ovd-plan idea', rationale: 'a' },
    { route: '/ovd-plan edit', rationale: 'b' },
    { route: '/ovd-go --small', rationale: 'c' },
    { route: '/ovd-go', rationale: 'd' },
    { route: '/ovd-log', rationale: 'e' },
    { route: '/ovd-log handoff', rationale: 'f' }
  ]);
  check('overflow caps at top 3 options', overflow.includes(' (3) ') && !overflow.includes(' (4) '));
  check('overflow keeps the escape', overflow.includes('Reply with the number, or describe what you want.'));
}

// ---------------------------------------------------------------------------
// Task 6.3 — isExplicitCommand (Q6.9 bypass detection)
// ---------------------------------------------------------------------------
check('isExplicitCommand is a function', typeof isExplicitCommand === 'function');
check('isExplicitCommand true for /ovd-plan idea "x"', isExplicitCommand('/ovd-plan idea "x"'));
check('isExplicitCommand true for /ovd-go', isExplicitCommand('/ovd-go'));
check('isExplicitCommand true for /ovd-log handoff', isExplicitCommand('/ovd-log handoff'));
check('isExplicitCommand true for /ovd-workflow', isExplicitCommand('/ovd-workflow'));
check('isExplicitCommand trims leading whitespace', isExplicitCommand('   /ovd-go  '));
// Q6.9: must START with / AND parse as a valid command.
check('isExplicitCommand false when slash is mid-sentence', !isExplicitCommand('I think /ovd-plan idea is right'));
check('isExplicitCommand false for free-form', !isExplicitCommand('I want dark mode'));
check('isExplicitCommand false for unknown slash command', !isExplicitCommand('/ovd-bogus do things'));
check('isExplicitCommand false for empty / non-string', !isExplicitCommand('') && !isExplicitCommand(null) && !isExplicitCommand(42));

// ---------------------------------------------------------------------------
// Task 6.3 — routeOrPrompt branching (announce / prompt / clarify / bypass)
// ---------------------------------------------------------------------------
check('routeOrPrompt is a function', typeof routeOrPrompt === 'function');

{
  // Bypass: explicit command short-circuits classification.
  const bypass = routeOrPrompt('/ovd-plan idea "dark mode"', null);
  check('routeOrPrompt bypasses explicit command', bypass.ok === true && bypass.decision === 'bypass');
  check('routeOrPrompt bypass carries the leading command', bypass.route === '/ovd-plan');

  // No classification supplied → needs the host agent to classify first.
  const needAgent = routeOrPrompt('I want dark mode', null);
  check('routeOrPrompt without classification requires host agent', needAgent.ok === false && needAgent.reason === 'requires-host-agent');

  // Unambiguous → announce + execute.
  const exec = routeOrPrompt('I want dark mode', null, { classification: unambig('/ovd-plan idea', 'dark mode') });
  check('routeOrPrompt unambiguous → execute', exec.ok === true && exec.decision === 'execute');
  check('routeOrPrompt execute carries route', exec.route === '/ovd-plan idea');
  check('routeOrPrompt execute carries args_hint', exec.args_hint === 'dark mode');
  check('routeOrPrompt execute announces the route', /reading this as/i.test(exec.text) && exec.text.includes('/ovd-plan idea'));
  check('routeOrPrompt execute offers a correction affordance', /not what you meant|say so|correct/i.test(exec.text));

  // Ambiguous with 2+ candidates → action-path prompt.
  const promptResult = routeOrPrompt("let's adjust the dashboard", null, {
    classification: {
      route: '/ovd-plan idea',
      confidence: 'ambiguous',
      candidates: [
        { route: '/ovd-plan idea', rationale: 'deliberate a new direction', args_hint: 'adjust dashboard' },
        { route: '/ovd-plan edit', rationale: 'adjust the tree directly' },
        { route: '/ovd-go --small', rationale: 'surgical change', args_hint: 'adjust dashboard' }
      ]
    }
  });
  check('routeOrPrompt ambiguous(2+) → prompt', promptResult.ok === true && promptResult.decision === 'prompt');
  check('routeOrPrompt prompt renders the ambiguity prompt', promptResult.text.includes('I read your message a few ways'));
  check('routeOrPrompt prompt carries candidates', Array.isArray(promptResult.candidates) && promptResult.candidates.length === 3);

  // Very-low-confidence (0 candidates) → clarifying question (Q6.3).
  const clarify0 = routeOrPrompt('hmm', null, { classification: { route: null, confidence: 'ambiguous', candidates: [] } });
  check('routeOrPrompt ambiguous(0) → clarify', clarify0.ok === true && clarify0.decision === 'clarify');
  check('routeOrPrompt clarify(0) asks a question', clarify0.text.includes('?'));
  check('routeOrPrompt clarify(0) keeps a describe escape', /describe|say more|tell me more|more about/i.test(clarify0.text));

  // Very-low-confidence (1 candidate) → clarifying question that names the candidate.
  const clarify1 = routeOrPrompt('do the thing', null, {
    classification: { route: '/ovd-go', confidence: 'ambiguous', candidates: [{ route: '/ovd-go', rationale: 'maybe continue current work' }] }
  });
  check('routeOrPrompt ambiguous(1) → clarify', clarify1.ok === true && clarify1.decision === 'clarify');
  check('routeOrPrompt clarify(1) names the candidate', clarify1.text.includes('/ovd-go'));
  check('routeOrPrompt clarify(1) keeps a describe escape', /describe|say more|tell me more|or/i.test(clarify1.text));

  // Invalid classification → validation failure, no decision.
  const bad = routeOrPrompt('hmm', null, { classification: { confidence: 'banana' } });
  check('routeOrPrompt rejects invalid classification', bad.ok === false && bad.reason === 'validation-failed');
}

// Calibration-matched clarify (Q6.3 + Q6.7 — depth only, not route).
{
  const hi = routeOrPrompt('do something', { calibration: { technical: 'high' } }, { classification: { route: null, confidence: 'ambiguous', candidates: [] } });
  check('clarify is technical when calibration is high', /\/ovd-/.test(hi.text));
  const lo = routeOrPrompt('do something', { calibration: { technical: 'low' } }, { classification: { route: null, confidence: 'ambiguous', candidates: [] } });
  check('clarify(low) still asks a question with an escape', lo.text.includes('?') && /describe|say more|tell me more|more about/i.test(lo.text));
}

// ---------------------------------------------------------------------------
// Task 6.3 — gatherProjectState (best-effort, never throws)
// ---------------------------------------------------------------------------
check('gatherProjectState is a function', typeof gatherProjectState === 'function');
{
  const empty = makeTempProject('empty');
  const s1 = gatherProjectState(empty.projectDir);
  check('gatherProjectState tolerates a project with no plan', s1 && typeof s1 === 'object');
  cleanup(empty.tmpRoot);

  const PLAN = '---\novd-plan: true\nversion: 3\nproject: "Demo Project"\n---\n\n# Demo Project\n\n## I Foundation [done]\n### I.1 Scaffolding [done]\n';
  const withPlan = makeTempProject('withplan', PLAN);
  const s2 = gatherProjectState(withPlan.projectDir);
  check('gatherProjectState reads project title', s2.projectTitle === 'Demo Project');
  cleanup(withPlan.tmpRoot);
}

// ---------------------------------------------------------------------------
// Task 6.3 — dispatch via runPlan({ subcommand: 'intent' })
// ---------------------------------------------------------------------------
check('ovdPlan exposes runIntent', typeof ovdPlan.runIntent === 'function');
{
  const proj = makeTempProject('dispatch', '---\novd-plan: true\nversion: 3\nproject: "Dispatch Demo"\n---\n\n# Dispatch Demo\n');

  // Plan mode: builds the classification prompt for the agent.
  const planRes = ovdPlan.runPlan({ subcommand: 'intent', text: 'I want dark mode', projectDir: proj.projectDir }, process.env);
  check('dispatch plan mode is ok', planRes.ok === true && planRes.mode === 'plan');
  check('dispatch plan mode returns the prompt as text', planRes.text.includes('I want dark mode') && planRes.text.includes('/ovd-plan idea'));

  // Commit mode: routes the agent's classification.
  const commitRes = ovdPlan.runPlan({
    subcommand: 'intent',
    text: 'I want dark mode',
    entriesJson: JSON.stringify(unambig('/ovd-plan idea', 'I want dark mode')),
    projectDir: proj.projectDir
  }, process.env);
  check('dispatch commit mode executes', commitRes.ok === true && commitRes.decision === 'execute' && commitRes.route === '/ovd-plan idea');

  // Bad JSON → index.js parse guard (Pattern 4), no crash, no routing.
  const badJson = ovdPlan.runPlan({ subcommand: 'intent', text: 'x', entriesJson: '{not json' }, process.env);
  check('dispatch rejects bad --entries-json', badJson.ok === false && /json/i.test(`${badJson.text || ''} ${badJson.reason || ''}`));

  // Bypass via dispatch.
  const bypassRes = ovdPlan.runPlan({ subcommand: 'intent', text: '/ovd-go', projectDir: proj.projectDir }, process.env);
  check('dispatch bypasses explicit command', bypassRes.ok === true && bypassRes.decision === 'bypass');

  cleanup(proj.tmpRoot);
}

// ---------------------------------------------------------------------------
// Task 6.4 — recordIntentCorrection (mis-classification logging → session capture)
// ---------------------------------------------------------------------------
check('recordIntentCorrection is a function', typeof recordIntentCorrection === 'function');

function readSession(projectDir) {
  const dir = path.join(projectDir, '.overdrive', 'sessions');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  return fs.readFileSync(path.join(dir, files[files.length - 1]), 'utf8');
}
const FIXED = '2026-06-21T12:00:00.000Z';
const FIXED2 = '2026-06-21T12:05:00.000Z';

{
  // Records a correction; creates a session file if none; writes under the section.
  const proj = makeTempProject('correction');
  const res = recordIntentCorrection(proj.projectDir, {
    originalMessage: 'reduce the title font', classifiedAs: '/ovd-plan idea', correctedTo: '/ovd-go --small'
  }, { now: FIXED });
  check('recordIntentCorrection ok', res.ok === true);
  check('recordIntentCorrection reports the file', typeof res.file === 'string' && res.file.includes('sessions'));
  const content = readSession(proj.projectDir);
  check('session has the intent-corrections section', /^##\s+intent-corrections\s*$/im.test(content));
  check('entry records the original message', content.includes('reduce the title font'));
  check('entry records the classified route', content.includes('/ovd-plan idea'));
  check('entry records the corrected route', content.includes('/ovd-go --small'));
  // Pattern 6 — log-push compat: result exposes summary AND note.
  check('result exposes summary (Pattern 6)', typeof res.summary === 'string' && res.summary.length > 0);
  check('result exposes note (Pattern 6)', typeof res.note === 'string' && res.note.length > 0);
  cleanup(proj.tmpRoot);
}

{
  // Multiple corrections accumulate under a single header.
  const proj = makeTempProject('correction-multi');
  recordIntentCorrection(proj.projectDir, { originalMessage: 'msg one', classifiedAs: '/ovd-plan idea', correctedTo: '/ovd-go --small' }, { now: FIXED });
  recordIntentCorrection(proj.projectDir, { originalMessage: 'msg two', classifiedAs: '/ovd-log', correctedTo: '/ovd-log handoff' }, { now: FIXED2 });
  const content = readSession(proj.projectDir);
  check('multi-correction has exactly one section header', (content.match(/^##\s+intent-corrections\s*$/gim) || []).length === 1);
  check('multi-correction keeps both entries', content.includes('msg one') && content.includes('msg two'));
  cleanup(proj.tmpRoot);
}

{
  // Validation — every field required.
  const proj = makeTempProject('correction-invalid');
  check('rejects missing originalMessage', recordIntentCorrection(proj.projectDir, { classifiedAs: '/ovd-log', correctedTo: '/ovd-go' }, { now: FIXED }).ok === false);
  check('rejects missing classifiedAs', recordIntentCorrection(proj.projectDir, { originalMessage: 'x', correctedTo: '/ovd-go' }, { now: FIXED }).ok === false);
  check('rejects missing correctedTo', recordIntentCorrection(proj.projectDir, { originalMessage: 'x', classifiedAs: '/ovd-log' }, { now: FIXED }).ok === false);
  check('rejects non-object', recordIntentCorrection(proj.projectDir, null, { now: FIXED }).ok === false);
  cleanup(proj.tmpRoot);
}

{
  // Newline sanitization — a multi-line message becomes a single-line entry.
  const proj = makeTempProject('correction-newline');
  recordIntentCorrection(proj.projectDir, { originalMessage: 'line one\nline two', classifiedAs: '/ovd-plan idea', correctedTo: '/ovd-go --small' }, { now: FIXED });
  const content = readSession(proj.projectDir);
  const entryLine = content.split('\n').find((l) => l.includes('line one'));
  check('entry is single-line (no embedded newline)', entryLine && entryLine.includes('line two'));
  cleanup(proj.tmpRoot);
}

{
  // Pattern 5 — migration-compat seam: a DEFAULT-save session (Activity log + Save
  // block) must keep its sections intact when an intent-correction is appended.
  const proj = makeTempProject('correction-seam');
  const dir = path.join(proj.projectDir, '.overdrive', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const seed = '# Session 2026-06-21 11:00\n\n## Activity log\n\n[2026-06-21 11:00] did a thing\n\n## Save 2026-06-21 11:30\n\n- state: in-progress\n';
  fs.writeFileSync(path.join(dir, '2026-06-21-11-00.md'), seed);
  const res = recordIntentCorrection(proj.projectDir, { originalMessage: 'seam test', classifiedAs: '/ovd-plan idea', correctedTo: '/ovd-go --small' }, { now: FIXED });
  check('seam: correction ok against existing session', res.ok === true);
  const content = readSession(proj.projectDir);
  check('seam: Activity log section preserved', content.includes('## Activity log') && content.includes('did a thing'));
  check('seam: Save block preserved', content.includes('## Save 2026-06-21 11:30') && content.includes('state: in-progress'));
  check('seam: intent-corrections section added', /^##\s+intent-corrections\s*$/im.test(content) && content.includes('seam test'));
  cleanup(proj.tmpRoot);
}

{
  // Dispatch: overdrive plan intent --entries-json '{"action":"correction",...}'.
  const proj = makeTempProject('correction-dispatch');
  const res = ovdPlan.runPlan({
    subcommand: 'intent',
    entriesJson: JSON.stringify({ action: 'correction', original_message: 'dispatch msg', classified_as: '/ovd-plan idea', corrected_to: '/ovd-go --small' }),
    projectDir: proj.projectDir
  }, process.env);
  check('dispatch records a correction', res.ok === true && res.action === 'correction');
  const content = readSession(proj.projectDir);
  check('dispatch wrote the correction entry', content.includes('dispatch msg') && /^##\s+intent-corrections\s*$/im.test(content));
  cleanup(proj.tmpRoot);
}

// ---------------------------------------------------------------------------
// Top-level + namespace exports
// ---------------------------------------------------------------------------
check('ovdPlan exposes intent module', ovdPlan.intent === intent);
check('ovdPlan exposes classifyIntent', ovdPlan.classifyIntent === classifyIntent);
check('ovdPlan exposes renderAmbiguityPrompt', ovdPlan.renderAmbiguityPrompt === renderAmbiguityPrompt);
check('ovdPlan exposes recordIntentCorrection', ovdPlan.recordIntentCorrection === recordIntentCorrection);

// ---------------------------------------------------------------------------
// CLASSIFICATION MATRIX — 20+ message → expected-route pairs (contract fixture)
//
// Validates: (a) >= 20 cases, (b) every expectedRoute is a known catalog route
// (catalog completeness, mirrors evaluate-router's "expected skill in manifest"),
// (c) scenario-class coverage (idea / surgical / save / ambiguous / near-miss /
// bypass), (d) bypass cases lead with an explicit slash command.
// ---------------------------------------------------------------------------
const CLASSIFICATION_MATRIX = [
  // idea phrases → /ovd-plan idea
  { message: 'I want dark mode', expectedRoute: '/ovd-plan idea', category: 'idea' },
  { message: 'what about adding a notifications panel?', expectedRoute: '/ovd-plan idea', category: 'idea' },
  { message: 'can we add CSV export to the reports page', expectedRoute: '/ovd-plan idea', category: 'idea' },
  { message: 'I have an idea for onboarding', expectedRoute: '/ovd-plan idea', category: 'idea' },
  // surgical phrases → /ovd-go --small
  { message: 'reduce the title font on widget cards', expectedRoute: '/ovd-go --small', category: 'surgical' },
  { message: 'change the button color to blue', expectedRoute: '/ovd-go --small', category: 'surgical' },
  { message: 'fix the typo in the header', expectedRoute: '/ovd-go --small', category: 'surgical' },
  { message: 'bump the padding on the sidebar', expectedRoute: '/ovd-go --small', category: 'surgical' },
  // continue / orient → /ovd-go
  { message: "let's keep going on the dashboard", expectedRoute: '/ovd-go', category: 'continue' },
  { message: 'what should I work on next', expectedRoute: '/ovd-go', category: 'continue' },
  // save phrases → /ovd-log and /ovd-log handoff
  { message: "let's save where we are", expectedRoute: '/ovd-log', category: 'save' },
  { message: 'checkpoint this', expectedRoute: '/ovd-log', category: 'save' },
  { message: "I'm done for now, wrap things up for next time", expectedRoute: '/ovd-log handoff', category: 'save' },
  { message: 'prepare a handoff before I clear the context', expectedRoute: '/ovd-log handoff', category: 'save' },
  // research → /ovd-plan research
  { message: 'look into how other apps do offline sync', expectedRoute: '/ovd-plan research', category: 'research' },
  { message: 'research the tradeoffs of websockets vs polling', expectedRoute: '/ovd-plan research', category: 'research' },
  // edit → /ovd-plan edit
  { message: 'remove the analytics milestone from the plan', expectedRoute: '/ovd-plan edit', category: 'edit' },
  { message: 'reorder the launch tasks in the tree', expectedRoute: '/ovd-plan edit', category: 'edit' },
  // workflow → /ovd-workflow
  { message: 'set up overdrive for this repo', expectedRoute: '/ovd-workflow', category: 'workflow' },
  { message: 'remap the codebase, it changed a lot', expectedRoute: '/ovd-workflow map', category: 'workflow' },
  // concerns → /ovd-log concerns
  { message: "I'm worried about the auth approach, let's note it", expectedRoute: '/ovd-log concerns', category: 'concerns' },
  // deliberate → /ovd-plan deliberate
  { message: "let's plan the whole thing from scratch", expectedRoute: '/ovd-plan deliberate', category: 'plan' },
  // near-miss: idea vs edit (planning a new direction vs editing existing tree)
  { message: 'I think we should rethink the whole reporting section', expectedRoute: '/ovd-plan idea', category: 'near-miss' },
  // near-miss: log default vs handoff
  { message: 'just save a quick note about what I changed', expectedRoute: '/ovd-log capture', category: 'near-miss' },
  // ambiguous (route is a best-guess; the agent would prompt)
  { message: "let's adjust the dashboard", expectedRoute: '/ovd-plan idea', category: 'ambiguous' },
  { message: 'update the settings', expectedRoute: '/ovd-go --small', category: 'ambiguous' },
  // bypass: explicit slash commands lead the message
  { message: '/ovd-plan idea "I want dark mode"', expectedRoute: '/ovd-plan idea', category: 'bypass' },
  { message: '/ovd-go --small', expectedRoute: '/ovd-go --small', category: 'bypass' },
  { message: '/ovd-log handoff', expectedRoute: '/ovd-log handoff', category: 'bypass' }
];

check('matrix has at least 20 cases', CLASSIFICATION_MATRIX.length >= 20, String(CLASSIFICATION_MATRIX.length));
check('every matrix expectedRoute is a known catalog route',
  CLASSIFICATION_MATRIX.every((c) => isKnownRoute(c.expectedRoute)),
  CLASSIFICATION_MATRIX.filter((c) => !isKnownRoute(c.expectedRoute)).map((c) => c.expectedRoute).join(', '));
{
  const cats = new Set(CLASSIFICATION_MATRIX.map((c) => c.category));
  for (const required of ['idea', 'surgical', 'save', 'ambiguous', 'near-miss', 'bypass']) {
    check(`matrix covers scenario class: ${required}`, cats.has(required));
  }
}
// Bypass cases must lead with an explicit /ovd- slash command (Q6.9).
check('every bypass case leads with /ovd-',
  CLASSIFICATION_MATRIX.filter((c) => c.category === 'bypass').every((c) => c.message.startsWith('/ovd-')));
check('non-bypass cases are free-form (no leading slash)',
  CLASSIFICATION_MATRIX.filter((c) => c.category !== 'bypass').every((c) => !c.message.startsWith('/')));
// Each matrix message builds a valid prompt that contains the message and its expected route in the catalog block.
check('every matrix message builds a prompt containing the message + expected route',
  CLASSIFICATION_MATRIX.every((c) => {
    const p = buildClassificationPrompt({ message: c.message, state: null });
    return p.includes(c.message) && p.includes(c.expectedRoute);
  }));

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
if (failures.length > 0) {
  console.error(`\nintent classifier tests FAILED: ${failures.length} failure(s) after ${passed} passing check(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`${passed} checks passed.`);
