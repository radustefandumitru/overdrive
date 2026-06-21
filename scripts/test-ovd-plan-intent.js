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
  classifyIntent
} = intent;

const ovdPlan = require('../lib/ovd-plan');

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
// Top-level + namespace exports
// ---------------------------------------------------------------------------
check('ovdPlan exposes intent module', ovdPlan.intent === intent);
check('ovdPlan exposes classifyIntent', ovdPlan.classifyIntent === classifyIntent);

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
