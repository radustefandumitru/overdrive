#!/usr/bin/env node
'use strict';

const path = require('path');

const {
  loadCatalogSkills,
  buildRoutingPrompt,
  parseRoutingResponse,
  validateRoutingResponse,
  resolvePriorSet
} = require('../lib/ovd-plan/skill-router');

const REPO_ROOT = path.resolve(__dirname, '..');
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

function expectThrow(label, fn) {
  let threw = null;
  try {
    fn();
  } catch (err) {
    threw = err;
  }
  if (threw) {
    passed += 1;
    if (verbose) console.log(`PASS ${label} (threw: ${threw.message})`);
  } else {
    failures.push(`${label}: expected throw`);
    console.log(`FAIL ${label}: no throw`);
  }
}

console.log('ovd-plan skill-router helper tests');

// --- loadCatalogSkills returns known skills from real catalog ---
{
  const skills = loadCatalogSkills(REPO_ROOT);
  check('catalog: returns >= 30 skills', skills.length >= 30, `got ${skills.length}`);
  check('catalog: includes planning-first', skills.includes('planning-first'));
  check('catalog: includes design-taste-frontend', skills.includes('design-taste-frontend'));
  check('catalog: includes security-review', skills.includes('security-review'));
  check('catalog: includes skill-router itself', skills.includes('skill-router'));
}

// --- buildRoutingPrompt produces a valid-shape prompt ---
{
  const prompt = buildRoutingPrompt({
    leafDescription: 'Design the widget grid layout',
    leafScope: { in: ['src/grid/'], out: [], read_only: ['src/types/'] },
    leafSuccessCriteria: ['Grid responsive at 768/1024px'],
    codebaseContext: null,
    knownSkills: ['planning-first', 'design-taste-frontend']
  });
  check('prompt: contains leaf description', prompt.includes('Design the widget grid layout'));
  check('prompt: lists skills', prompt.includes('- planning-first'));
  check('prompt: lists skills', prompt.includes('- design-taste-frontend'));
  check('prompt: contains scope.in', prompt.includes('src/grid/'));
  check('prompt: contains success criteria', prompt.includes('Grid responsive'));
  check('prompt: contains confidence semantics', prompt.includes('Confidence semantics:'));
  check(
    'prompt: instructs JSON reply',
    prompt.includes('LAST LINE') && prompt.includes('"skills"')
  );
}

// --- parseRoutingResponse: last-line JSON ---
{
  const text =
    'Some prose explanation here.\n' +
    'A bit more.\n' +
    '{"skills":["design-taste-frontend","impeccable"],"confidence":"high","rationale":"r","considered":[]}';
  const parsed = parseRoutingResponse(text);
  check('parse last-line: skills array', Array.isArray(parsed.skills));
  check('parse last-line: confidence', parsed.confidence === 'high');
  check('parse last-line: 2 skills', parsed.skills.length === 2);
}

// --- parseRoutingResponse: fenced JSON block ---
{
  const text =
    'Prose...\n```json\n{"skills":["planning-first"],"confidence":"medium"}\n```\nTrailing prose.';
  const parsed = parseRoutingResponse(text);
  check('parse fenced: skills', parsed.skills[0] === 'planning-first');
  check('parse fenced: confidence', parsed.confidence === 'medium');
}

// --- parseRoutingResponse: empty throws ---
expectThrow('parse: empty string throws', () => parseRoutingResponse(''));
expectThrow('parse: no JSON throws', () => parseRoutingResponse('just prose, no json'));
expectThrow('parse: non-string throws', () => parseRoutingResponse(null));

// --- validateRoutingResponse: valid passes through ---
{
  const result = validateRoutingResponse(
    {
      skills: ['planning-first'],
      confidence: 'high',
      rationale: 'why',
      considered: ['react-doctor']
    },
    ['planning-first', 'react-doctor']
  );
  check('validate: valid passes', result.skills[0] === 'planning-first');
  check('validate: unknown_skills is empty', result.unknown_skills.length === 0);
}

// --- validateRoutingResponse: unknown skill captured but not fatal ---
{
  const result = validateRoutingResponse(
    {
      skills: ['planning-first', 'nonexistent-skill'],
      confidence: 'medium'
    },
    ['planning-first']
  );
  check('validate: unknown captured', result.unknown_skills.includes('nonexistent-skill'));
  check('validate: known skill kept', result.skills.includes('planning-first'));
}

// --- validateRoutingResponse: invalid confidence throws ---
expectThrow('validate: bad confidence throws', () =>
  validateRoutingResponse({ skills: [], confidence: 'super-high' }, [])
);

// --- validateRoutingResponse: non-array skills throws ---
expectThrow('validate: non-array skills throws', () =>
  validateRoutingResponse({ skills: 'not-array', confidence: 'high' }, [])
);

// --- validateRoutingResponse: null throws ---
expectThrow('validate: null throws', () => validateRoutingResponse(null, []));

// --- validateRoutingResponse: missing skills throws ---
expectThrow('validate: missing skills throws', () =>
  validateRoutingResponse({ confidence: 'high' }, [])
);

// --- resolvePriorSet: requires-host-agent mode ---
{
  const result = resolvePriorSet({
    leafDescription: 'Test',
    leafScope: { in: [], out: [], read_only: [] },
    leafSuccessCriteria: [],
    repoRoot: REPO_ROOT
  });
  check(
    'resolve: returns requires-host-agent when no answer supplied',
    result.reason === 'requires-host-agent'
  );
  check('resolve: emits prompt', typeof result.prompt === 'string');
  check(
    'resolve: known_skills_count > 0',
    result.known_skills_count > 0
  );
}

// --- resolvePriorSet: hostAgentAnswer mode (5 representative leaves) ---

const reps = [
  {
    label: 'UI leaf',
    input: {
      leafDescription: 'Design and implement the dashboard widget grid layout',
      leafScope: { in: ['src/components/Dashboard/'], out: [], read_only: [] },
      leafSuccessCriteria: ['Renders at 768/1024/1440px', 'Three widget sizes']
    },
    answer:
      '{"skills":["design-taste-frontend","impeccable"],"confidence":"high","rationale":"UI design with clear spec","considered":["emil-design-eng"]}'
  },
  {
    label: 'Security leaf',
    input: {
      leafDescription: 'Audit and harden authentication and session token storage',
      leafScope: { in: ['src/auth/'], out: [], read_only: [] },
      leafSuccessCriteria: ['No CSRF', 'No XSS', 'Secrets not in storage']
    },
    answer:
      '{"skills":["security-review"],"confidence":"high","rationale":"security audit","considered":["what-should-i-consider"]}'
  },
  {
    label: 'Performance leaf',
    input: {
      leafDescription: 'Optimize text measurement and layout in virtualized chat',
      leafScope: { in: ['src/chat/'], out: [], read_only: [] },
      leafSuccessCriteria: ['No layout thrash', '60fps scroll']
    },
    answer:
      '{"skills":["pretext","modern-web-guidance"],"confidence":"medium","rationale":"layout perf","considered":["react-doctor"]}'
  },
  {
    label: 'Research leaf',
    input: {
      leafDescription: 'Research current sentiment about new framework X over last 30 days',
      leafScope: { in: [], out: [], read_only: [] },
      leafSuccessCriteria: ['3+ sources', 'Last 30 days only']
    },
    answer:
      '{"skills":["last30days","reddit-research"],"confidence":"high","rationale":"community research","considered":[]}'
  },
  {
    label: 'Sketch leaf',
    input: {
      leafDescription: 'Sketch a mockup of the onboarding hero',
      leafScope: { in: ['.overdrive/sketches/'], out: [], read_only: [] },
      leafSuccessCriteria: ['HTML mockup file', 'Three-section layout']
    },
    answer:
      '{"skills":["design-taste-frontend"],"confidence":"low","rationale":"early sketch, exploratory","considered":["impeccable"]}'
  }
];

for (const rep of reps) {
  const result = resolvePriorSet({ ...rep.input, repoRoot: REPO_ROOT }, { hostAgentAnswer: rep.answer });
  check(`resolve ${rep.label}: ok=true`, result.ok === true);
  check(`resolve ${rep.label}: skills non-empty`, result.skills.length > 0);
  check(
    `resolve ${rep.label}: confidence valid`,
    ['high', 'medium', 'low'].includes(result.confidence)
  );
}

// --- resolvePriorSet: parse failure reports diagnostically ---
{
  const result = resolvePriorSet(
    {
      leafDescription: 'X',
      leafScope: { in: [], out: [], read_only: [] },
      leafSuccessCriteria: [],
      repoRoot: REPO_ROOT
    },
    { hostAgentAnswer: 'no json here at all' }
  );
  check('resolve parse-fail: ok=false', result.ok === false);
  check('resolve parse-fail: reason', result.reason === 'parse-failed');
  check('resolve parse-fail: prompt preserved', typeof result.prompt === 'string');
}

// --- resolvePriorSet: validation failure ---
{
  const result = resolvePriorSet(
    {
      leafDescription: 'X',
      leafScope: { in: [], out: [], read_only: [] },
      leafSuccessCriteria: [],
      repoRoot: REPO_ROOT
    },
    { hostAgentAnswer: '{"skills":[],"confidence":"bogus"}' }
  );
  check('resolve validation-fail: ok=false', result.ok === false);
  check('resolve validation-fail: reason', result.reason === 'validation-failed');
}

// --- resolvePriorSet: catalog empty (point to a dir with no catalog) ---
{
  const result = resolvePriorSet(
    {
      leafDescription: 'X',
      leafScope: { in: [], out: [], read_only: [] },
      leafSuccessCriteria: [],
      repoRoot: '/nonexistent-repo-root-for-test'
    },
    { hostAgentAnswer: '{"skills":["x"],"confidence":"high"}' }
  );
  check('resolve catalog-empty: ok=false', result.ok === false);
  check('resolve catalog-empty: reason', result.reason === 'catalog-empty');
}

// --- Summary ---
console.log('');
if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${failures.length + passed} checks:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`${passed} checks passed.`);
