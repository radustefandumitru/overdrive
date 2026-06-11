#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  CATEGORIES,
  CATEGORY_KEYS,
  CATEGORY_HEADERS,
  requirementsPath,
  readRequirementsFile,
  detectCategoryState,
  buildPlan,
  normalizeEntries,
  applyEntries,
  formatPlan,
  formatCommit,
  runRequirementsDraft
} = require('../lib/ovd-plan/requirements-draft');

const fsHelpers = require('../lib/ovd-plan/fs');

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
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-reqs-test-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
  return { projectDir, tmpRoot };
}

function cleanup(tmpRoot) {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

console.log('ovd-plan requirements-draft tests');

// --- 0. Module surface ---
{
  check('CATEGORIES has 3 entries', Array.isArray(CATEGORIES) && CATEGORIES.length === 3);
  check('CATEGORY_KEYS matches r3 §4.5', ['functional', 'nonFunctional', 'outOfScope'].every((k) => CATEGORY_KEYS.includes(k)));
  check('CATEGORY_HEADERS.functional = Functional', CATEGORY_HEADERS.functional === 'Functional');
  check('CATEGORY_HEADERS.nonFunctional = "Non-functional" (literal hyphen)', CATEGORY_HEADERS.nonFunctional === 'Non-functional');
  check('CATEGORY_HEADERS.outOfScope = "Out of scope" (spaces)', CATEGORY_HEADERS.outOfScope === 'Out of scope');
  check('every category has key + header + question + examples', CATEGORIES.every((c) =>
    typeof c.key === 'string' &&
    typeof c.header === 'string' &&
    typeof c.question === 'string' &&
    Array.isArray(c.examples) && c.examples.length >= 3));
}

// --- 1. Header strings match the v2 placeholder file ---
{
  const placeholder = fsHelpers.NEW_LAYOUT_PLACEHOLDER_FILES['requirements.md'];
  check('placeholder contains ## Functional', placeholder.includes('## Functional'));
  check('placeholder contains ## Non-functional', placeholder.includes('## Non-functional'));
  check('placeholder contains ## Out of scope', placeholder.includes('## Out of scope'));
}

// --- 2. requirementsPath ---
{
  check('requirementsPath: ends with .overdrive/requirements.md', /\.overdrive[\\/]+requirements\.md$/.test(requirementsPath('/tmp/x')));
}

// --- 3. detectCategoryState ---
{
  const empty = detectCategoryState(null);
  check('detectCategoryState(null): all categories missing', CATEGORY_KEYS.every((k) => empty[k] === 'missing'));

  const placeholder = fsHelpers.NEW_LAYOUT_PLACEHOLDER_FILES['requirements.md'];
  const placeholderState = detectCategoryState(placeholder);
  check('detectCategoryState(placeholder): all categories present as placeholder',
    CATEGORY_KEYS.every((k) => placeholderState[k] === 'placeholder'));

  const populated = placeholder.replace('## Functional\n', '## Functional\n\n- sign in via SSO\n');
  const populatedState = detectCategoryState(populated);
  check('detectCategoryState(populated): functional=populated, others=placeholder',
    populatedState.functional === 'populated' && populatedState.nonFunctional === 'placeholder' && populatedState.outOfScope === 'placeholder');

  // Hyphenated header should also be detectable when populated
  const hyphenPopulated = placeholder.replace('## Non-functional\n', '## Non-functional\n\n- WCAG AA contrast\n');
  check('detectCategoryState: hyphenated header detected when populated',
    detectCategoryState(hyphenPopulated).nonFunctional === 'populated');

  // Multi-word header
  const oosPopulated = placeholder.replace('## Out of scope\n', '## Out of scope\n\n- no native mobile app\n');
  check('detectCategoryState: multi-word header detected when populated',
    detectCategoryState(oosPopulated).outOfScope === 'populated');
}

// --- 4. buildPlan: shape and current state ---
{
  const { projectDir, tmpRoot } = makeTempProject('plan-missing');
  try {
    const plan = buildPlan(projectDir);
    check('plan: mode=plan', plan.mode === 'plan');
    check('plan: file.exists=false on missing file', plan.file.exists === false);
    check('plan: 3 categories', plan.categories.length === 3);
    check('plan: every category has key/header/question/examples/currentState', plan.categories.every((c) =>
      typeof c.key === 'string' &&
      typeof c.header === 'string' &&
      typeof c.question === 'string' &&
      Array.isArray(c.examples) &&
      ['missing', 'placeholder', 'populated'].includes(c.currentState)));
    check('plan: instructions array non-empty', Array.isArray(plan.instructions) && plan.instructions.length >= 6);
    check('plan: instructions mention `commit --entries-json`', plan.instructions.some((line) => /commit\b.*--entries-json/.test(line)));
    check('plan: instructions mention non-functional dimensions guidance', plan.instructions.some((line) => /non-functional.*perf|security|a11y/i.test(line)));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 5. normalizeEntries: happy path ---
{
  const r = normalizeEntries({
    functional: ['sign in via SSO', 'export CSV'],
    nonFunctional: 'WCAG AA contrast',
    outOfScope: [],
    extraField: ['ignored']
  });
  check('normalize: ok=true', r.ok === true);
  check('normalize: functional array preserved', r.normalized.functional.length === 2);
  check('normalize: nonFunctional string → 1-elem array', r.normalized.nonFunctional.length === 1 && r.normalized.nonFunctional[0] === 'WCAG AA contrast');
  check('normalize: outOfScope empty stays empty', r.normalized.outOfScope.length === 0);
  check('normalize: unknown category recorded but not failing', r.unknownCategories.includes('extraField'));
  check('normalize: unknown category not in normalized', !('extraField' in r.normalized));
}

// --- 6. normalizeEntries: validation ---
{
  check('normalize: non-object → ok=false', normalizeEntries('string').ok === false);
  check('normalize: array → ok=false', normalizeEntries(['x']).ok === false);
  check('normalize: null → ok=false', normalizeEntries(null).ok === false);
  check('normalize: number value → ok=false', normalizeEntries({ functional: 42 }).ok === false);
  const empties = normalizeEntries({ functional: ['  ', '', 'real req', '   '] });
  check('normalize: trims + drops empty strings', empties.normalized.functional.length === 1 && empties.normalized.functional[0] === 'real req');
}

// --- 7. applyEntries: fresh file → creates with placeholder + entries appended ---
{
  const { projectDir, tmpRoot } = makeTempProject('apply-fresh');
  try {
    const result = applyEntries(projectDir, {
      functional: ['user can sign in', 'user can export'],
      nonFunctional: ['WCAG AA'],
      outOfScope: ['no mobile']
    });
    check('apply-fresh: totalAdded=4', result.totalAdded === 4);
    check('apply-fresh: applied counts', result.applied.functional === 2 && result.applied.nonFunctional === 1 && result.applied.outOfScope === 1);
    const content = fs.readFileSync(result.path, 'utf8');
    check('apply-fresh: # Requirements header present', /^# Requirements/m.test(content));
    check('apply-fresh: Functional section has both entries', /## Functional[\s\S]*- user can sign in[\s\S]*- user can export/.test(content));
    check('apply-fresh: Non-functional section gets entry (hyphenated header)', /## Non-functional[\s\S]*- WCAG AA/.test(content));
    check('apply-fresh: Out of scope section gets entry (multi-word header)', /## Out of scope[\s\S]*- no mobile/.test(content));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 8. applyEntries: existing file preserved (append-only) ---
{
  const { projectDir, tmpRoot } = makeTempProject('apply-preserve');
  try {
    const reqsPath = requirementsPath(projectDir);
    fs.writeFileSync(reqsPath, '# Requirements\n\n## Functional\n\n- existing req\n\n## Non-functional\n\n## Out of scope\n');
    applyEntries(projectDir, { functional: ['new req'] });
    const content = fs.readFileSync(reqsPath, 'utf8');
    check('apply-preserve: existing req still present', /- existing req/.test(content));
    check('apply-preserve: new req appended', /- new req/.test(content));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 9. runRequirementsDraft: plan mode (default) ---
{
  const { projectDir, tmpRoot } = makeTempProject('elicit-plan');
  try {
    const result = runRequirementsDraft(projectDir);
    check('plan-mode: ok=true', result.ok === true);
    check('plan-mode: status=requirements-draft', result.status === 'requirements-draft');
    check('plan-mode: mode=plan', result.mode === 'plan');
    check('plan-mode: stub flag absent', result.stub !== true);
    check('plan-mode: result.plan present', typeof result.plan === 'object');
    check('plan-mode: text non-empty', typeof result.text === 'string' && result.text.length > 0);
    check('plan-mode: text mentions Socratic ordering', /one question per turn|Socratic/i.test(result.text));
    check('plan-mode: summary set', typeof result.summary === 'string' && result.summary.includes('requirements plan'));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 10. runRequirementsDraft: commit mode writes the file ---
{
  const { projectDir, tmpRoot } = makeTempProject('elicit-commit');
  try {
    const result = runRequirementsDraft(projectDir, {
      mode: 'commit',
      entries: {
        functional: ['SSO sign-in', 'export CSV'],
        nonFunctional: ['p95 latency <300ms'],
        outOfScope: ['no IE11']
      }
    });
    check('commit-mode: ok=true', result.ok === true);
    check('commit-mode: mode=commit', result.mode === 'commit');
    check('commit-mode: totalAdded=4', result.totalAdded === 4);
    check('commit-mode: applied counts', result.applied.functional === 2 && result.applied.nonFunctional === 1 && result.applied.outOfScope === 1);
    const content = fs.readFileSync(requirementsPath(projectDir), 'utf8');
    check('commit-mode: functional req present', /- SSO sign-in/.test(content));
    check('commit-mode: non-functional req present', /- p95 latency <300ms/.test(content));
    check('commit-mode: out-of-scope req present', /- no IE11/.test(content));
    check('commit-mode: summary set', typeof result.summary === 'string' && /4 entries/.test(result.summary));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 11. runRequirementsDraft: commit mode with invalid entries → ok=false ---
{
  const { projectDir, tmpRoot } = makeTempProject('elicit-invalid');
  try {
    const result = runRequirementsDraft(projectDir, {
      mode: 'commit',
      entries: 42
    });
    check('invalid: ok=false', result.ok === false);
    check('invalid: file NOT created', !fs.existsSync(requirementsPath(projectDir)));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 12. runRequirementsDraft: no rootDir ---
{
  const r = runRequirementsDraft(null);
  check('no rootDir: ok=false', r.ok === false);
}

// --- 13. CLI dispatch: subcommand=requirements → plan mode ---
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-plan');
  try {
    const ovdPlan = require('../lib/ovd-plan');
    const result = ovdPlan.runWorkflow({ projectDir, subcommand: 'requirements' }, process.env);
    check('dispatch-plan: status=requirements-draft', result.status === 'requirements-draft');
    check('dispatch-plan: mode=plan', result.mode === 'plan');
    check('dispatch-plan: plan present', !!result.plan);
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 14. CLI dispatch: subcommand=requirements + entriesJson → commit mode ---
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-commit');
  try {
    const ovdPlan = require('../lib/ovd-plan');
    const json = JSON.stringify({
      functional: ['login'],
      nonFunctional: ['fast'],
      outOfScope: ['no native']
    });
    const result = ovdPlan.runWorkflow({
      projectDir,
      subcommand: 'requirements',
      step: 'commit',
      entriesJson: json
    }, process.env);
    check('dispatch-commit: mode=commit', result.mode === 'commit');
    check('dispatch-commit: totalAdded=3', result.totalAdded === 3);
    const content = fs.readFileSync(requirementsPath(projectDir), 'utf8');
    check('dispatch-commit: functional written', /- login/.test(content));
    check('dispatch-commit: nonFunctional written', /- fast/.test(content));
    check('dispatch-commit: outOfScope written', /- no native/.test(content));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 15. CLI dispatch: malformed --entries-json → ok=false ---
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-badjson');
  try {
    const ovdPlan = require('../lib/ovd-plan');
    const result = ovdPlan.runWorkflow({
      projectDir,
      subcommand: 'requirements',
      step: 'commit',
      entriesJson: '{ not valid'
    }, process.env);
    check('dispatch-badjson: ok=false', result.ok === false);
    check('dispatch-badjson: reason mentions JSON', /JSON/i.test(result.reason));
    check('dispatch-badjson: requirements.md NOT created', !fs.existsSync(requirementsPath(projectDir)));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 16. Namespace + top-level exports ---
{
  const ovdPlan = require('../lib/ovd-plan');
  check('exports: runRequirementsDraft top-level', typeof ovdPlan.runRequirementsDraft === 'function');
  check('exports: requirementsDraft namespace', !!ovdPlan.requirementsDraft && Array.isArray(ovdPlan.requirementsDraft.CATEGORIES));
}

// --- 17. formatPlan / formatCommit output shape ---
{
  const { projectDir, tmpRoot } = makeTempProject('format');
  try {
    const planResult = runRequirementsDraft(projectDir);
    check('formatPlan: includes File line', /^File:/m.test(planResult.text));
    check('formatPlan: lists every category key', CATEGORY_KEYS.every((k) => planResult.text.includes(`[${k}]`)));
    check('formatPlan: lists Non-functional header (hyphenated)', /\(## Non-functional\)/.test(planResult.text));

    const commitResult = runRequirementsDraft(projectDir, { mode: 'commit', entries: { functional: ['r1'] } });
    check('formatCommit: includes Total entries line', /Total entries added: 1/.test(commitResult.text));
    check('formatCommit: lists every category counter', CATEGORY_KEYS.every((k) => new RegExp(`${k}:`).test(commitResult.text)));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 18. End-to-end: plan → user dialogue → commit → re-plan reflects state ---
{
  const { projectDir, tmpRoot } = makeTempProject('e2e');
  try {
    const p1 = runRequirementsDraft(projectDir);
    check('e2e.1: all categories missing initially', p1.plan.categories.every((c) => c.currentState === 'missing'));

    runRequirementsDraft(projectDir, {
      mode: 'commit',
      entries: { functional: ['login'], nonFunctional: ['fast'], outOfScope: [] }
    });

    const p2 = runRequirementsDraft(projectDir);
    const f = p2.plan.categories.find((c) => c.key === 'functional');
    const nf = p2.plan.categories.find((c) => c.key === 'nonFunctional');
    const oos = p2.plan.categories.find((c) => c.key === 'outOfScope');
    check('e2e.2: functional now populated', f.currentState === 'populated');
    check('e2e.2: nonFunctional now populated', nf.currentState === 'populated');
    check('e2e.2: outOfScope still placeholder (empty commit)', oos.currentState === 'placeholder');
    check('e2e.2: file.exists=true', p2.plan.file.exists === true);
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 19. Migration-compat: pre-existing requirements.md with user content is preserved ---
{
  const { projectDir, tmpRoot } = makeTempProject('migration-compat');
  try {
    const reqsPath = requirementsPath(projectDir);
    fs.writeFileSync(
      reqsPath,
      '# Requirements\n\nFunctional, non-functional, and out-of-scope requirements for this project. Populated by `/ovd-workflow requirements` during init or on demand.\n\n## Functional\n\n- pre-existing functional req from earlier session\n\n## Non-functional\n\n## Out of scope\n\n- already specified: no real-time updates\n'
    );
    const result = runRequirementsDraft(projectDir, {
      mode: 'commit',
      entries: { functional: ['new func req'], nonFunctional: ['security baseline'] }
    });
    check('migration-compat: ok=true', result.ok === true);
    const content = fs.readFileSync(reqsPath, 'utf8');
    check('migration-compat: pre-existing functional req still present', /pre-existing functional req/.test(content));
    check('migration-compat: pre-existing OOS still present', /no real-time updates/.test(content));
    check('migration-compat: new functional req appended', /- new func req/.test(content));
    check('migration-compat: new non-functional appended under hyphenated header', /## Non-functional[\s\S]*- security baseline/.test(content));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- Report ---
console.log('');
if (failures.length > 0) {
  console.log(`${failures.length} failure(s):`);
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
} else {
  console.log(`${passed} checks passed.`);
}
