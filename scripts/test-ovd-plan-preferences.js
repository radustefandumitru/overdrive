#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  CATEGORIES,
  CATEGORY_KEYS,
  CATEGORY_HEADERS,
  preferencesPath,
  readPreferencesFile,
  detectCategoryState,
  buildPlan,
  normalizeEntries,
  applyEntries,
  formatPlan,
  formatCommit,
  runPreferencesElicit
} = require('../lib/ovd-plan/preferences-elicit');

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
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-prefs-test-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
  return { projectDir, tmpRoot };
}

function cleanup(tmpRoot) {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

console.log('ovd-plan preferences-elicit tests');

// --- 0. Module surface ---
{
  check('CATEGORIES has 4 entries', Array.isArray(CATEGORIES) && CATEGORIES.length === 4);
  check('CATEGORY_KEYS matches r3 §4.5', ['vetoes', 'codingStyle', 'workflow', 'communication'].every((k) => CATEGORY_KEYS.includes(k)));
  check('CATEGORY_HEADERS.vetoes = Vetoes', CATEGORY_HEADERS.vetoes === 'Vetoes');
  check('CATEGORY_HEADERS.codingStyle = "Coding style"', CATEGORY_HEADERS.codingStyle === 'Coding style');
  check('every category has key + header + question + examples', CATEGORIES.every((c) =>
    typeof c.key === 'string' &&
    typeof c.header === 'string' &&
    typeof c.question === 'string' &&
    Array.isArray(c.examples) && c.examples.length >= 2));
}

// --- 1. preferencesPath ---
{
  check('preferencesPath: ends with .overdrive/preferences.md', /\.overdrive[\\/]+preferences\.md$/.test(preferencesPath('/tmp/x')));
}

// --- 2. detectCategoryState ---
{
  const empty = detectCategoryState(null);
  check('detectCategoryState(null): all categories missing', CATEGORY_KEYS.every((k) => empty[k] === 'missing'));

  const placeholder = fsHelpers.NEW_LAYOUT_PLACEHOLDER_FILES['preferences.md'];
  const placeholderState = detectCategoryState(placeholder);
  check('detectCategoryState(placeholder): all categories present as placeholder',
    CATEGORY_KEYS.every((k) => placeholderState[k] === 'placeholder'));

  const populated = placeholder.replace('## Vetoes\n', '## Vetoes\n\n- no jQuery\n');
  const populatedState = detectCategoryState(populated);
  check('detectCategoryState(populated): vetoes=populated, others=placeholder',
    populatedState.vetoes === 'populated' && populatedState.codingStyle === 'placeholder');
}

// --- 3. buildPlan: shape and current state ---
{
  const { projectDir, tmpRoot } = makeTempProject('plan-missing');
  try {
    const plan = buildPlan(projectDir);
    check('plan: mode=plan', plan.mode === 'plan');
    check('plan: file.exists=false on missing file', plan.file.exists === false);
    check('plan: 4 categories', plan.categories.length === 4);
    check('plan: every category has key/header/question/examples/currentState', plan.categories.every((c) =>
      typeof c.key === 'string' &&
      typeof c.header === 'string' &&
      typeof c.question === 'string' &&
      Array.isArray(c.examples) &&
      ['missing', 'placeholder', 'populated'].includes(c.currentState)));
    check('plan: instructions array non-empty', Array.isArray(plan.instructions) && plan.instructions.length >= 4);
    check('plan: instructions mention `commit --entries-json`', plan.instructions.some((line) => /commit\b.*--entries-json/.test(line)));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 4. buildPlan: detects already-populated sections ---
{
  const { projectDir, tmpRoot } = makeTempProject('plan-populated');
  try {
    const prefsPath = preferencesPath(projectDir);
    fs.writeFileSync(prefsPath, '# Preferences\n\n## Vetoes\n\n- something\n\n## Coding style\n\n## Workflow\n\n## Communication\n');
    const plan = buildPlan(projectDir);
    check('plan-populated: file.exists=true', plan.file.exists === true);
    const vetoes = plan.categories.find((c) => c.key === 'vetoes');
    check('plan-populated: vetoes currentState=populated', vetoes.currentState === 'populated');
    const codingStyle = plan.categories.find((c) => c.key === 'codingStyle');
    check('plan-populated: codingStyle currentState=placeholder', codingStyle.currentState === 'placeholder');
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 5. normalizeEntries: happy path ---
{
  const r = normalizeEntries({
    vetoes: ['no jQuery', 'no eval'],
    codingStyle: 'tabs not spaces',
    workflow: [],
    communication: null
  });
  check('normalize: ok=true', r.ok === true);
  check('normalize: vetoes array preserved', Array.isArray(r.normalized.vetoes) && r.normalized.vetoes.length === 2);
  check('normalize: codingStyle string → 1-elem array', r.normalized.codingStyle.length === 1 && r.normalized.codingStyle[0] === 'tabs not spaces');
  check('normalize: empty array stays empty', r.normalized.workflow.length === 0);
  check('normalize: null → empty array', r.normalized.communication.length === 0);
  check('normalize: all 4 categories present', CATEGORY_KEYS.every((k) => k in r.normalized));
}

// --- 6. normalizeEntries: validation + tolerance ---
{
  check('normalize: non-object → ok=false', normalizeEntries('string').ok === false);
  check('normalize: array → ok=false', normalizeEntries(['x']).ok === false);
  check('normalize: null → ok=false', normalizeEntries(null).ok === false);
  check('normalize: number value → ok=false', normalizeEntries({ vetoes: 42 }).ok === false);
  const unknown = normalizeEntries({ vetoes: ['x'], bogus: ['y'] });
  check('normalize: unknown category recorded but not failing', unknown.ok === true && unknown.unknownCategories.includes('bogus'));
  check('normalize: unknown category not included in normalized', !('bogus' in unknown.normalized));
  const empties = normalizeEntries({ vetoes: ['  ', '', 'real entry', '   '] });
  check('normalize: trims and drops empty strings inside arrays', empties.normalized.vetoes.length === 1 && empties.normalized.vetoes[0] === 'real entry');
}

// --- 7. applyEntries: fresh file → creates with placeholder + entries appended ---
{
  const { projectDir, tmpRoot } = makeTempProject('apply-fresh');
  try {
    const result = applyEntries(projectDir, {
      vetoes: ['no jQuery'],
      codingStyle: ['tabs, width 4'],
      workflow: [],
      communication: ['concise']
    });
    check('apply-fresh: returns path', typeof result.path === 'string');
    check('apply-fresh: totalAdded=3', result.totalAdded === 3);
    check('apply-fresh: applied counts per category', result.applied.vetoes === 1 && result.applied.codingStyle === 1 && result.applied.workflow === 0 && result.applied.communication === 1);
    const content = fs.readFileSync(result.path, 'utf8');
    check('apply-fresh: file has # Preferences', /^# Preferences/m.test(content));
    check('apply-fresh: Vetoes section has the entry', /## Vetoes[\s\S]*- no jQuery/.test(content));
    check('apply-fresh: Coding style section has the entry', /## Coding style[\s\S]*- tabs, width 4/.test(content));
    check('apply-fresh: Communication section has the entry', /## Communication[\s\S]*- concise/.test(content));
    check('apply-fresh: Workflow section present but empty', /## Workflow/.test(content));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 8. applyEntries: existing file preserves existing entries (append-only) ---
{
  const { projectDir, tmpRoot } = makeTempProject('apply-preserve');
  try {
    const prefsPath = preferencesPath(projectDir);
    fs.writeFileSync(prefsPath, '# Preferences\n\n## Vetoes\n\n- existing veto\n\n## Coding style\n\n## Workflow\n\n## Communication\n');
    applyEntries(projectDir, { vetoes: ['new veto'] });
    const content = fs.readFileSync(prefsPath, 'utf8');
    check('apply-preserve: existing veto still present', /- existing veto/.test(content));
    check('apply-preserve: new veto added', /- new veto/.test(content));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 9. applyEntries: multi-line entries become bullets ---
{
  const { projectDir, tmpRoot } = makeTempProject('apply-multi');
  try {
    applyEntries(projectDir, {
      vetoes: ['no jQuery', 'no eval()', 'no global state']
    });
    const content = fs.readFileSync(preferencesPath(projectDir), 'utf8');
    check('apply-multi: 3 vetoes as separate bullets',
      /- no jQuery\n- no eval\(\)\n- no global state/.test(content));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 10. runPreferencesElicit: plan mode (default) ---
{
  const { projectDir, tmpRoot } = makeTempProject('elicit-plan');
  try {
    const result = runPreferencesElicit(projectDir);
    check('plan-mode: ok=true', result.ok === true);
    check('plan-mode: status=preferences-elicit', result.status === 'preferences-elicit');
    check('plan-mode: mode=plan', result.mode === 'plan');
    check('plan-mode: stub flag absent', result.stub !== true);
    check('plan-mode: result.plan present', typeof result.plan === 'object');
    check('plan-mode: text non-empty', typeof result.text === 'string' && result.text.length > 0);
    check('plan-mode: text mentions Socratic ordering', /one question per turn|Socratic/i.test(result.text));
    check('plan-mode: summary set', typeof result.summary === 'string' && result.summary.includes('preferences plan'));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 11. runPreferencesElicit: commit mode writes the file ---
{
  const { projectDir, tmpRoot } = makeTempProject('elicit-commit');
  try {
    const result = runPreferencesElicit(projectDir, {
      mode: 'commit',
      entries: {
        vetoes: ['no jQuery', 'no eval()'],
        codingStyle: ['tabs, 4'],
        workflow: [],
        communication: ['terse responses']
      }
    });
    check('commit-mode: ok=true', result.ok === true);
    check('commit-mode: mode=commit', result.mode === 'commit');
    check('commit-mode: totalAdded=4', result.totalAdded === 4);
    check('commit-mode: applied counts', result.applied.vetoes === 2 && result.applied.codingStyle === 1 && result.applied.communication === 1);
    const content = fs.readFileSync(preferencesPath(projectDir), 'utf8');
    check('commit-mode: vetoes both present', /- no jQuery\n- no eval/.test(content));
    check('commit-mode: communication present', /- terse responses/.test(content));
    check('commit-mode: summary set', typeof result.summary === 'string' && /4 entries/.test(result.summary));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 12. runPreferencesElicit: commit mode with invalid entries → ok=false ---
{
  const { projectDir, tmpRoot } = makeTempProject('elicit-invalid');
  try {
    const result = runPreferencesElicit(projectDir, {
      mode: 'commit',
      entries: 'not an object'
    });
    check('invalid: ok=false', result.ok === false);
    check('invalid: reason mentions object', /object/i.test(result.reason));
    // File should NOT be written.
    check('invalid: preferences.md NOT created', !fs.existsSync(preferencesPath(projectDir)));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 13. runPreferencesElicit: no rootDir ---
{
  const r = runPreferencesElicit(null);
  check('no rootDir: ok=false', r.ok === false);
}

// --- 14. CLI dispatch: subcommand=preferences → plan mode ---
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-plan');
  try {
    const ovdPlan = require('../lib/ovd-plan');
    const result = ovdPlan.runWorkflow({ projectDir, subcommand: 'preferences' }, process.env);
    check('dispatch-plan: status=preferences-elicit', result.status === 'preferences-elicit');
    check('dispatch-plan: mode=plan', result.mode === 'plan');
    check('dispatch-plan: plan present', !!result.plan);
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 15. CLI dispatch: subcommand=preferences + entriesJson → commit mode ---
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-commit');
  try {
    const ovdPlan = require('../lib/ovd-plan');
    const json = JSON.stringify({ vetoes: ['no monorepo'], codingStyle: [], workflow: [], communication: [] });
    const result = ovdPlan.runWorkflow({
      projectDir,
      subcommand: 'preferences',
      step: 'commit',
      entriesJson: json
    }, process.env);
    check('dispatch-commit: mode=commit', result.mode === 'commit');
    check('dispatch-commit: totalAdded=1', result.totalAdded === 1);
    const content = fs.readFileSync(preferencesPath(projectDir), 'utf8');
    check('dispatch-commit: veto written', /- no monorepo/.test(content));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 16. CLI dispatch: malformed --entries-json → ok=false with helpful message ---
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-badjson');
  try {
    const ovdPlan = require('../lib/ovd-plan');
    const result = ovdPlan.runWorkflow({
      projectDir,
      subcommand: 'preferences',
      step: 'commit',
      entriesJson: '{ not valid'
    }, process.env);
    check('dispatch-badjson: ok=false', result.ok === false);
    check('dispatch-badjson: reason mentions JSON', /JSON/i.test(result.reason));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 17. CLI dispatch: namespace exports available ---
{
  const ovdPlan = require('../lib/ovd-plan');
  check('exports: runPreferencesElicit top-level', typeof ovdPlan.runPreferencesElicit === 'function');
  check('exports: preferencesElicit namespace', !!ovdPlan.preferencesElicit && Array.isArray(ovdPlan.preferencesElicit.CATEGORIES));
}

// --- 18. formatPlan / formatCommit produce non-empty text ---
{
  const { projectDir, tmpRoot } = makeTempProject('format');
  try {
    const planResult = runPreferencesElicit(projectDir);
    check('formatPlan: includes File line', /^File:/m.test(planResult.text));
    check('formatPlan: lists every category key', CATEGORY_KEYS.every((k) => planResult.text.includes(`[${k}]`)));

    const commitResult = runPreferencesElicit(projectDir, { mode: 'commit', entries: { vetoes: ['v1'] } });
    check('formatCommit: includes Total entries line', /Total entries added: 1/.test(commitResult.text));
    check('formatCommit: lists every category counter', CATEGORY_KEYS.every((k) => new RegExp(`${k}:`).test(commitResult.text)));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 19. Compatibility with migration-produced preferences.md (legacy Vetoes already there) ---
{
  const { projectDir, tmpRoot } = makeTempProject('migration-compat');
  try {
    // Simulate what Task 2.2.5 produces after migrating constraints → preferences vetoes.
    const prefsPath = preferencesPath(projectDir);
    fs.writeFileSync(
      prefsPath,
      '# Preferences\n\nDurable user preferences and do-not rules.\n\n| Date | Preference / Do-not Rule | Reason / Signal |\n|---|---|---|\n| 2026-05-01 | concise commits | user said no walls of text |\n\n## Vetoes\n\nNo jQuery — modern React only.\nNo CommonJS in new code; ES modules throughout.\n'
    );
    const result = runPreferencesElicit(projectDir, {
      mode: 'commit',
      entries: { vetoes: ['no global state'], codingStyle: ['tabs'] }
    });
    check('migration-compat: ok=true', result.ok === true);
    const content = fs.readFileSync(prefsPath, 'utf8');
    check('migration-compat: legacy v1 table preserved', /concise commits/.test(content));
    check('migration-compat: legacy constraint preserved (No jQuery)', /No jQuery/.test(content));
    check('migration-compat: new veto appended', /- no global state/.test(content));
    check('migration-compat: new coding-style appended', /- tabs/.test(content));
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
