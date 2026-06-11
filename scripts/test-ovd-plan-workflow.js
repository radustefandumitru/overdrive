#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  CODEBASE_FILES,
  TUTORIAL_LINES,
  STATES,
  INIT_STEPS,
  MIGRATION_ACTIONS,
  CANONICAL_ACTIONS,
  REQUIREMENTS_ACTIONS,
  inspectProject,
  inspectCodebase,
  classifyFile,
  nextStepsFor,
  formatStatusBlock,
  formatWorkflowDefault,
  formatInitResult,
  runWorkflowDefault,
  runWorkflowInit,
  runMigrateLegacy,
  runCodebaseMap,
  runPreferencesElicit,
  runRequirementsDraft,
  ensureScaffolded,
  migrationPrompt,
  mappingPrompt,
  preferencesPrompt,
  requirementsPrompt,
  promptFor
} = require('../lib/ovd-plan/workflow');

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

function makeTempProject(name, options = {}) {
  const opts = { withSignal: true, ...options };
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-workflow-test-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(projectDir, { recursive: true });
  if (opts.withSignal) {
    fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}');
  }
  return { projectDir, tmpRoot };
}

function cleanup(tmpRoot) {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

console.log('ovd-plan workflow tests');

// --- 0. Module exports ---
{
  check('CODEBASE_FILES is the 5 expected files', Array.isArray(CODEBASE_FILES) && CODEBASE_FILES.length === 5);
  check(
    'CODEBASE_FILES contents match r3 §4.3',
    ['architecture.md', 'patterns.md', 'tech-stack.md', 'quality.md', 'concerns.md'].every((f) =>
      CODEBASE_FILES.includes(f)
    )
  );
  check('TUTORIAL_LINES is a non-empty array of strings', Array.isArray(TUTORIAL_LINES) && TUTORIAL_LINES.length >= 8);
  check('TUTORIAL_LINES every entry is a string', TUTORIAL_LINES.every((l) => typeof l === 'string' && l.length > 0));
  check('STATES enum includes the five expected', STATES.includes('uninitialized') && STATES.includes('legacy') && STATES.includes('scaffolded') && STATES.includes('partial') && STATES.includes('initialized'));
}

// --- 1. Tutorial mentions all four commands ---
{
  const text = TUTORIAL_LINES.join('\n');
  check('tutorial mentions /ovd-workflow', text.includes('/ovd-workflow'));
  check('tutorial mentions /ovd-plan', text.includes('/ovd-plan'));
  check('tutorial mentions /ovd-go', text.includes('/ovd-go'));
  check('tutorial mentions /ovd-log', text.includes('/ovd-log'));
  check('tutorial mentions OVERDRIVE.md', text.includes('OVERDRIVE.md'));
  check('tutorial mentions .overdrive/', text.includes('.overdrive/'));
}

// --- 2. nextStepsFor: every state has a "describe other" escape ---
{
  for (const state of STATES) {
    const ns = nextStepsFor(state);
    check(`${state}: nextSteps.question is non-empty string`, typeof ns.question === 'string' && ns.question.length > 0);
    check(`${state}: nextSteps.options is non-empty array`, Array.isArray(ns.options) && ns.options.length >= 2);
    const last = ns.options[ns.options.length - 1];
    check(`${state}: last option is the 'Other' escape`, /Other\b/i.test(last) && /describe/i.test(last));
  }
}

// --- 3. classifyFile: missing / placeholder / populated ---
{
  const { projectDir, tmpRoot } = makeTempProject('classify');
  try {
    // Missing
    const missing = classifyFile(path.join(projectDir, 'nonexistent.md'));
    check('classifyFile: missing returns "missing"', missing === 'missing');

    // Placeholder (exact match)
    const placeholderText = '# Hello\n\nbody\n';
    const placeholderFile = path.join(projectDir, 'placeholder.md');
    fs.writeFileSync(placeholderFile, placeholderText);
    check(
      'classifyFile: exact placeholder match returns "placeholder"',
      classifyFile(placeholderFile, placeholderText) === 'placeholder'
    );

    // Populated (different content)
    const populatedFile = path.join(projectDir, 'populated.md');
    fs.writeFileSync(populatedFile, '# Different\n\nUser wrote this.\n');
    check(
      'classifyFile: different content returns "populated"',
      classifyFile(populatedFile, placeholderText) === 'populated'
    );

    // Placeholder with trailing whitespace drift (.trim() match)
    const driftFile = path.join(projectDir, 'drift.md');
    fs.writeFileSync(driftFile, placeholderText + '\n\n');
    check(
      'classifyFile: trailing-whitespace drift still classifies as "placeholder"',
      classifyFile(driftFile, placeholderText) === 'placeholder'
    );

    // No placeholder arg → returns 'populated' if file exists
    check(
      'classifyFile: no placeholder arg returns "populated" for any extant file',
      classifyFile(populatedFile) === 'populated'
    );
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 4. inspectCodebase: counts ---
{
  const { projectDir, tmpRoot } = makeTempProject('codebase');
  try {
    fsHelpers.scaffoldOverdrivePlan(projectDir);
    const empty = inspectCodebase(projectDir);
    check('inspectCodebase: 0 of 5 in fresh scaffold', empty.count === 0);
    check('inspectCodebase: all entries false in fresh scaffold', CODEBASE_FILES.every((f) => empty.present[f] === false));

    // Add two real mapper files
    const codebaseDir = fsHelpers.ovdPath(projectDir, 'codebase');
    fs.writeFileSync(path.join(codebaseDir, 'architecture.md'), '# Architecture\nReal content.\n');
    fs.writeFileSync(path.join(codebaseDir, 'patterns.md'), '# Patterns\nReal content.\n');
    const partial = inspectCodebase(projectDir);
    check('inspectCodebase: count=2 after writing 2 files', partial.count === 2);
    check('inspectCodebase: architecture.md present', partial.present['architecture.md'] === true);
    check('inspectCodebase: patterns.md present', partial.present['patterns.md'] === true);
    check('inspectCodebase: quality.md absent', partial.present['quality.md'] === false);
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 5. inspectProject: uninitialized ---
{
  const { projectDir, tmpRoot } = makeTempProject('uninitialized');
  try {
    const report = inspectProject(projectDir);
    check('uninitialized: state=uninitialized', report.state === 'uninitialized');
    check('uninitialized: ovdExists=false', report.ovdExists === false);
    check('uninitialized: overdriveMd=false', report.overdriveMd === false);
    check('uninitialized: legacy=false', report.legacy === false);
    check('uninitialized: newLayout=false', report.newLayout === false);
    check('uninitialized: codebase.count=0', report.codebase.count === 0);
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 6. inspectProject: legacy ---
{
  const { projectDir, tmpRoot } = makeTempProject('legacy');
  try {
    const ovdDir = path.join(projectDir, fsHelpers.OVD_DIR);
    fs.mkdirSync(ovdDir, { recursive: true });
    fs.writeFileSync(path.join(ovdDir, 'project.md'), '# Legacy project\n');
    fs.writeFileSync(path.join(ovdDir, 'state.md'), '# State\nActive: foo\n');
    const report = inspectProject(projectDir);
    check('legacy: state=legacy', report.state === 'legacy');
    check('legacy: ovdExists=true', report.ovdExists === true);
    check('legacy: legacy=true', report.legacy === true);
    check('legacy: newLayout=false', report.newLayout === false);
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 7. inspectProject: scaffolded (new layout, placeholders only) ---
{
  const { projectDir, tmpRoot } = makeTempProject('scaffolded');
  try {
    fsHelpers.scaffoldOverdrivePlan(projectDir);
    const report = inspectProject(projectDir);
    check('scaffolded: state=scaffolded', report.state === 'scaffolded');
    check('scaffolded: newLayout=true', report.newLayout === true);
    check('scaffolded: legacy=false', report.legacy === false);
    check('scaffolded: codebase.count=0', report.codebase.count === 0);
    check('scaffolded: preferences=placeholder', report.preferences === 'placeholder');
    check('scaffolded: requirements=placeholder', report.requirements === 'placeholder');
    check('scaffolded: decisions=placeholder', report.decisions === 'placeholder');
    check('scaffolded: overdriveMd=false', report.overdriveMd === false);
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 8. inspectProject: partial (some codebase files, placeholders rest) ---
{
  const { projectDir, tmpRoot } = makeTempProject('partial');
  try {
    fsHelpers.scaffoldOverdrivePlan(projectDir);
    const codebaseDir = fsHelpers.ovdPath(projectDir, 'codebase');
    fs.writeFileSync(path.join(codebaseDir, 'architecture.md'), '# Architecture\nReal content here.\n');
    fs.writeFileSync(path.join(codebaseDir, 'patterns.md'), '# Patterns\nReal content here.\n');
    const report = inspectProject(projectDir);
    check('partial: state=partial', report.state === 'partial');
    check('partial: codebase.count=2', report.codebase.count === 2);
    check('partial: preferences still placeholder', report.preferences === 'placeholder');
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 9. inspectProject: initialized (full setup) ---
{
  const { projectDir, tmpRoot } = makeTempProject('initialized');
  try {
    fsHelpers.scaffoldOverdrivePlan(projectDir);
    const codebaseDir = fsHelpers.ovdPath(projectDir, 'codebase');
    for (const name of CODEBASE_FILES) {
      fs.writeFileSync(path.join(codebaseDir, name), `# ${name}\nReal content.\n`);
    }
    // Overwrite placeholders with user content
    fs.writeFileSync(
      fsHelpers.ovdPath(projectDir, 'preferences.md'),
      '# Preferences\n\n## Vetoes\n- no jQuery\n'
    );
    fs.writeFileSync(
      fsHelpers.ovdPath(projectDir, 'requirements.md'),
      '# Requirements\n\n## Functional\n- Real requirement\n'
    );
    const report = inspectProject(projectDir);
    check('initialized: state=initialized', report.state === 'initialized', `actual=${report.state}`);
    check('initialized: codebase.count=5', report.codebase.count === 5);
    check('initialized: preferences=populated', report.preferences === 'populated');
    check('initialized: requirements=populated', report.requirements === 'populated');
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 10. inspectProject: OVERDRIVE.md present without .overdrive/ → not uninitialized ---
{
  const { projectDir, tmpRoot } = makeTempProject('overdrive-md-only');
  try {
    fs.writeFileSync(path.join(projectDir, fsHelpers.OVD_PLAN_FILE), '---\novd-plan: true\n---\n\n# Project\n');
    const report = inspectProject(projectDir);
    check('overdrive-md-only: overdriveMd=true', report.overdriveMd === true);
    check('overdrive-md-only: ovdExists=false', report.ovdExists === false);
    check('overdrive-md-only: state is NOT uninitialized', report.state !== 'uninitialized');
    check('overdrive-md-only: state is NOT legacy', report.state !== 'legacy');
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 11. runWorkflowDefault: result shape and text ---
{
  const { projectDir, tmpRoot } = makeTempProject('result-shape');
  try {
    const result = runWorkflowDefault(projectDir, {});
    check('runWorkflowDefault: ok=true', result.ok === true);
    check('runWorkflowDefault: status=workflow-default', result.status === 'workflow-default');
    check('runWorkflowDefault: state is a STATES value', STATES.includes(result.state));
    check('runWorkflowDefault: rootDir is absolute', path.isAbsolute(result.rootDir));
    check('runWorkflowDefault: tutorial is an array', Array.isArray(result.tutorial));
    check('runWorkflowDefault: tutorial is not a reference to TUTORIAL_LINES', result.tutorial !== TUTORIAL_LINES);
    check('runWorkflowDefault: statusReport present', typeof result.statusReport === 'object');
    check('runWorkflowDefault: nextSteps present', typeof result.nextSteps === 'object');
    check('runWorkflowDefault: text non-empty string', typeof result.text === 'string' && result.text.length > 0);
    check('runWorkflowDefault: text mentions Status', result.text.includes('Status:'));
    check('runWorkflowDefault: text mentions Project root', result.text.includes('Project root:'));
    check('runWorkflowDefault: text mentions next-steps prompt', result.text.includes('Reply'));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 12. runWorkflowDefault: null/empty rootDir → ok=false ---
{
  const fallback = runWorkflowDefault(null, {});
  check('null rootDir: ok=false', fallback.ok === false);
  check('null rootDir: text describes the failure', typeof fallback.text === 'string' && fallback.text.length > 0);
}

// --- 13. formatStatusBlock: each state renders distinct content ---
{
  const reports = {
    uninitialized: {
      state: 'uninitialized',
      rootDir: '/tmp/proj',
      legacy: false,
      newLayout: false,
      overdriveMd: false,
      codebase: { present: {}, count: 0 },
      preferences: 'missing',
      requirements: 'missing',
      decisions: 'missing'
    },
    legacy: {
      state: 'legacy',
      rootDir: '/tmp/proj',
      legacy: true,
      newLayout: false,
      overdriveMd: false,
      codebase: { present: {}, count: 0 },
      preferences: 'missing',
      requirements: 'missing',
      decisions: 'missing'
    },
    scaffolded: {
      state: 'scaffolded',
      rootDir: '/tmp/proj',
      legacy: false,
      newLayout: true,
      overdriveMd: false,
      codebase: { present: { 'architecture.md': false }, count: 0 },
      preferences: 'placeholder',
      requirements: 'placeholder',
      decisions: 'placeholder'
    }
  };
  for (const [state, report] of Object.entries(reports)) {
    const block = formatStatusBlock(report);
    check(`formatStatusBlock(${state}): mentions the state`, block.includes(`Status: ${state}`));
    check(`formatStatusBlock(${state}): mentions the rootDir`, block.includes('/tmp/proj'));
  }
  check(
    'formatStatusBlock(legacy): includes legacy notice',
    formatStatusBlock(reports.legacy).includes('Legacy layout detected')
  );
  check(
    'formatStatusBlock(scaffolded): includes codebase counter',
    formatStatusBlock(reports.scaffolded).includes('Codebase files: 0/5')
  );
}

// --- 14. formatWorkflowDefault: end-to-end against a real fixture ---
{
  const { projectDir, tmpRoot } = makeTempProject('format-e2e');
  try {
    fsHelpers.scaffoldOverdrivePlan(projectDir);
    const result = runWorkflowDefault(projectDir, {});
    const text = result.text;
    check('format-e2e: text starts with header', text.startsWith('Overdrive (ovd-plan) — /ovd-workflow'));
    check('format-e2e: text contains every tutorial line', TUTORIAL_LINES.every((l) => text.includes(l)));
    check('format-e2e: text contains next-steps question', text.includes(result.nextSteps.question));
    check('format-e2e: every nextSteps option appears in text', result.nextSteps.options.every((opt) => text.includes(opt)));
    check('format-e2e: ends with reply instruction', /Reply with the number, or describe what you want\.\s*$/.test(text));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 15. index.js dispatch: bare runWorkflow → real handler ---
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch');
  try {
    const ovdPlan = require('../lib/ovd-plan');
    fsHelpers.scaffoldOverdrivePlan(projectDir);
    const result = ovdPlan.runWorkflow({ projectDir, subcommand: null }, process.env);
    check('dispatch (bare): status=workflow-default (not stub)', result.status === 'workflow-default');
    check('dispatch (bare): has tutorial', Array.isArray(result.tutorial) && result.tutorial.length > 0);
    check('dispatch (bare): state=scaffolded', result.state === 'scaffolded');
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 16. index.js dispatch: subcommand=init → runWorkflowInit (not stub) ---
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-init');
  try {
    const ovdPlan = require('../lib/ovd-plan');
    const result = ovdPlan.runWorkflow({ projectDir, subcommand: 'init' }, process.env);
    check('dispatch (subcommand=init): status=workflow-init (not stub)', result.status === 'workflow-init');
    check('dispatch (subcommand=init): currentStep set', typeof result.currentStep === 'string' && INIT_STEPS.includes(result.currentStep));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 17. index.js dispatch: unknown subcommand → still stub ---
{
  const ovdPlan = require('../lib/ovd-plan');
  const result = ovdPlan.runWorkflow({ projectDir: process.cwd(), subcommand: 'map' }, process.env);
  check('dispatch (subcommand=map): status=stub (Task 2.3 not built yet)', result.status === 'stub');
}

// --- 18. Constants: INIT_STEPS / action enums shape ---
{
  check('INIT_STEPS is the six expected', INIT_STEPS.length === 6 && ['detect','migration','mapping','preferences','requirements','complete'].every((s) => INIT_STEPS.includes(s)));
  check('MIGRATION_ACTIONS = [migrate, skip-migration, other]', MIGRATION_ACTIONS.length === 3 && MIGRATION_ACTIONS.includes('migrate') && MIGRATION_ACTIONS.includes('skip-migration'));
  check('CANONICAL_ACTIONS has proceed/skip/skip-all/other', ['proceed','skip','skip-all','other'].every((a) => CANONICAL_ACTIONS.includes(a)));
  check('REQUIREMENTS_ACTIONS has no skip-all (terminal sub-step)', !REQUIREMENTS_ACTIONS.includes('skip-all') && REQUIREMENTS_ACTIONS.includes('proceed') && REQUIREMENTS_ACTIONS.includes('skip'));
}

// --- 19. Sub-task stubs (runMigrateLegacy is now real; others still stubs) ---
{
  // runMigrateLegacy is the real Task 2.2.5 implementation; full coverage lives in scripts/test-ovd-plan-migrate.js.
  // Here we just confirm the orchestrator-visible no-op shape when there's nothing to migrate.
  const m = runMigrateLegacy('/tmp/nonexistent-ovd-vendor', { mode: 'full' });
  check('runMigrateLegacy: ok=true on nothing-to-migrate', m.ok === true);
  check('runMigrateLegacy: no stub flag (Task 2.2.5 landed)', m.stub !== true);
  check('runMigrateLegacy: nothingToMigrate=true when .overdrive/ absent', m.nothingToMigrate === true);
  check('runMigrateLegacy: summary string present', typeof m.summary === 'string' && m.summary.length > 0);
  // Remaining sub-task stub (Task 2.3) still holds the stub marker.
  check('runCodebaseMap: still stub (Task 2.3 pending)', runCodebaseMap('/tmp/x').stub === true);
  // runPreferencesElicit (Task 2.4) and runRequirementsDraft (Task 2.5) are real; full coverage lives in their dedicated test files.
  const prefs = runPreferencesElicit('/tmp/nonexistent-ovd-prefs', {});
  check('runPreferencesElicit: no stub flag (Task 2.4 landed)', prefs.stub !== true);
  check('runPreferencesElicit: returns plan mode by default', prefs.mode === 'plan');
  const reqs = runRequirementsDraft('/tmp/nonexistent-ovd-reqs', {});
  check('runRequirementsDraft: no stub flag (Task 2.5 landed)', reqs.stub !== true);
  check('runRequirementsDraft: returns plan mode by default', reqs.mode === 'plan');
}

// --- 20. Action-path prompt builders: shape ---
{
  for (const prompt of [migrationPrompt(), mappingPrompt(), preferencesPrompt(), requirementsPrompt()]) {
    check(`${prompt.step}: prompt.step matches expected`, INIT_STEPS.includes(prompt.step));
    check(`${prompt.step}: prompt has question string`, typeof prompt.question === 'string' && prompt.question.length > 0);
    check(`${prompt.step}: prompt has 3+ options`, Array.isArray(prompt.options) && prompt.options.length >= 3);
    check(`${prompt.step}: prompt has actions array`, Array.isArray(prompt.actions) && prompt.actions.length >= 3);
    check(`${prompt.step}: last option is the Other escape`, /Other\b/i.test(prompt.options[prompt.options.length - 1]) && /describe/i.test(prompt.options[prompt.options.length - 1]));
    check(`${prompt.step}: actions includes 'other'`, prompt.actions.includes('other'));
  }
  check('promptFor(migration) equals migrationPrompt()', promptFor('migration').step === 'migration');
  check('promptFor(unknown) is null', promptFor('unknown') === null);
}

// --- 21. runWorkflowInit: null rootDir → ok=false ---
{
  const result = runWorkflowInit(null, {});
  check('runWorkflowInit(null): ok=false', result.ok === false);
  check('runWorkflowInit(null): has text', typeof result.text === 'string' && result.text.length > 0);
}

// --- 22. runWorkflowInit: unknown step → ok=false ---
{
  const { projectDir, tmpRoot } = makeTempProject('unknown-step');
  try {
    const result = runWorkflowInit(projectDir, { step: 'bogus', action: 'proceed' });
    check('runWorkflowInit(unknown step): ok=false', result.ok === false);
    check('runWorkflowInit(unknown step): mentions valid steps', result.text.includes(INIT_STEPS.join(', ')));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 23. Scenario A: fresh project → canonical init walks mapping → preferences → requirements → complete ---
{
  const { projectDir, tmpRoot } = makeTempProject('scenario-a');
  try {
    // Step 1: detect (no opts) — scaffolds + emits mapping prompt
    const r1 = runWorkflowInit(projectDir);
    check('A.1: ok=true', r1.ok === true);
    check('A.1: currentStep=mapping', r1.currentStep === 'mapping');
    check('A.1: prompt.step=mapping', r1.prompt && r1.prompt.step === 'mapping');
    check('A.1: log includes scaffold', r1.log.some((e) => e.step === 'scaffold'));
    check('A.1: scaffolded the new layout', fs.existsSync(path.join(projectDir, '.overdrive', 'codebase')));

    // Step 2: mapping proceed → preferences prompt
    const r2 = runWorkflowInit(projectDir, { step: 'mapping', action: 'proceed' });
    check('A.2: currentStep=preferences', r2.currentStep === 'preferences');
    check('A.2: log contains codebase-map stub call', r2.log.some((e) => e.step === 'codebase-map' && e.stub === true));
    check('A.2: prompt.step=preferences', r2.prompt && r2.prompt.step === 'preferences');

    // Step 3: preferences proceed → requirements prompt
    const r3 = runWorkflowInit(projectDir, { step: 'preferences', action: 'proceed' });
    check('A.3: currentStep=requirements', r3.currentStep === 'requirements');
    check('A.3: log contains preferences-elicit step (Task 2.4 real handler)', r3.log.some((e) => e.step === 'preferences-elicit' && e.stub !== true));

    // Step 4: requirements proceed → complete
    const r4 = runWorkflowInit(projectDir, { step: 'requirements', action: 'proceed' });
    check('A.4: currentStep=complete', r4.currentStep === 'complete');
    check('A.4: done=true', r4.done === true);
    check('A.4: log contains requirements-draft step (Task 2.5 real handler)', r4.log.some((e) => e.step === 'requirements-draft' && e.stub !== true));
    check('A.4: text mentions /ovd-plan as next', r4.text.includes('/ovd-plan'));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 24. Scenario B: legacy project, migrate accepted → MIGRATE then canonical init ---
{
  const { projectDir, tmpRoot } = makeTempProject('scenario-b');
  try {
    const ovdDir = path.join(projectDir, '.overdrive');
    fs.mkdirSync(ovdDir, { recursive: true });
    fs.writeFileSync(path.join(ovdDir, 'project.md'), '# legacy\n');
    fs.writeFileSync(path.join(ovdDir, 'state.md'), '# state\n');
    fs.writeFileSync(path.join(ovdDir, 'config.json'), '{"legacy":true}\n');

    // Step 1: detect → legacy state → migration prompt
    const r1 = runWorkflowInit(projectDir);
    check('B.1: state=legacy', r1.state === 'legacy');
    check('B.1: currentStep=migration', r1.currentStep === 'migration');
    check('B.1: prompt.step=migration', r1.prompt && r1.prompt.step === 'migration');
    check('B.1: prompt.actions includes migrate', r1.prompt.actions.includes('migrate'));

    // Step 2: migrate → real migrate runs + scaffold + mapping prompt
    const r2 = runWorkflowInit(projectDir, { step: 'migration', action: 'migrate' });
    check('B.2: currentStep=mapping (after migrate)', r2.currentStep === 'mapping');
    check('B.2: log contains migrate in full mode', r2.log.some((e) => e.step === 'migrate' && e.mode === 'full'));
    check('B.2: log migrate entry tracks counts', r2.log.some((e) => e.step === 'migrate' && typeof e.migrated === 'number' && typeof e.archived === 'number'));
    check('B.2: result carries migration report', r2.migration && Array.isArray(r2.migration.migrated));
    check('B.2: log contains scaffold', r2.log.some((e) => e.step === 'scaffold'));

    // Continue: mapping proceed → preferences prompt
    const r3 = runWorkflowInit(projectDir, { step: 'mapping', action: 'proceed' });
    check('B.3: currentStep=preferences after mapping', r3.currentStep === 'preferences');
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 25. Scenario C: legacy project, skip-migration → archive-only stub + scaffold ---
{
  const { projectDir, tmpRoot } = makeTempProject('scenario-c');
  try {
    const ovdDir = path.join(projectDir, '.overdrive');
    fs.mkdirSync(ovdDir, { recursive: true });
    fs.writeFileSync(path.join(ovdDir, 'project.md'), '# legacy\n');
    fs.writeFileSync(path.join(ovdDir, 'state.md'), '# state\n');

    const r1 = runWorkflowInit(projectDir);
    check('C.1: currentStep=migration', r1.currentStep === 'migration');

    const r2 = runWorkflowInit(projectDir, { step: 'migration', action: 'skip-migration' });
    check('C.2: currentStep=mapping', r2.currentStep === 'mapping');
    check('C.2: log contains migrate in archive-only mode', r2.log.some((e) => e.step === 'migrate' && e.mode === 'archive-only'));
    check('C.2: log migrate entry tracks counts', r2.log.some((e) => e.step === 'migrate' && typeof e.migrated === 'number' && typeof e.archived === 'number'));
    check('C.2: result carries migration report', r2.migration && Array.isArray(r2.migration.archived));
    check('C.2: scaffold ran after archive-only', r2.log.some((e) => e.step === 'scaffold'));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 26. Scenario D: already-initialized project → no-op result ---
{
  const { projectDir, tmpRoot } = makeTempProject('scenario-d');
  try {
    const fsHelpers = require('../lib/ovd-plan/fs');
    fsHelpers.scaffoldOverdrivePlan(projectDir);
    const codebaseDir = fsHelpers.ovdPath(projectDir, 'codebase');
    for (const name of CODEBASE_FILES) {
      fs.writeFileSync(path.join(codebaseDir, name), `# ${name}\nReal content.\n`);
    }
    fs.writeFileSync(fsHelpers.ovdPath(projectDir, 'preferences.md'), '# Preferences\n\n## Vetoes\n- something\n');
    fs.writeFileSync(fsHelpers.ovdPath(projectDir, 'requirements.md'), '# Requirements\n\n## Functional\n- something\n');

    const r1 = runWorkflowInit(projectDir);
    check('D.1: state=initialized', r1.state === 'initialized');
    check('D.1: currentStep=complete', r1.currentStep === 'complete');
    check('D.1: done=true', r1.done === true);
    check('D.1: alreadyInitialized=true', r1.alreadyInitialized === true);
    check('D.1: no prompt emitted', !r1.prompt);
    check('D.1: text mentions already initialized', /already initialized/i.test(r1.text));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 27. Skip individual sub-steps ---
{
  const { projectDir, tmpRoot } = makeTempProject('skip-sub');
  try {
    runWorkflowInit(projectDir); // scaffolds, lands at mapping
    const r2 = runWorkflowInit(projectDir, { step: 'mapping', action: 'skip' });
    check('skip-sub.2: mapping skipped, advance to preferences', r2.currentStep === 'preferences');
    check('skip-sub.2: log shows codebase-map skipped', r2.log.some((e) => e.step === 'codebase-map' && e.skipped === true));

    const r3 = runWorkflowInit(projectDir, { step: 'preferences', action: 'skip' });
    check('skip-sub.3: preferences skipped, advance to requirements', r3.currentStep === 'requirements');

    const r4 = runWorkflowInit(projectDir, { step: 'requirements', action: 'skip' });
    check('skip-sub.4: requirements skipped, complete', r4.currentStep === 'complete');
    check('skip-sub.4: done=true', r4.done === true);
    check('skip-sub.4: abortedEarly NOT set (user chose skip each step, not skip-all)', !r4.abortedEarly);
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 28. skip-all at any canonical step jumps to complete with abortedEarly ---
{
  const { projectDir, tmpRoot } = makeTempProject('skip-all');
  try {
    runWorkflowInit(projectDir); // scaffolds
    const r = runWorkflowInit(projectDir, { step: 'mapping', action: 'skip-all' });
    check('skip-all: currentStep=complete', r.currentStep === 'complete');
    check('skip-all: done=true', r.done === true);
    check('skip-all: abortedEarly=true', r.abortedEarly === true);
    check('skip-all: text mentions deferred', /deferred/i.test(r.text));
    check('skip-all: log entry mentions remaining steps', r.log.some((e) => e.step === 'init-aborted' && Array.isArray(e.remaining)));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 29. Unrecognized action at each step re-emits the prompt with note ---
{
  const { projectDir, tmpRoot } = makeTempProject('unrecognized');
  try {
    // Legacy migration step
    const ovdDir = path.join(projectDir, '.overdrive');
    fs.mkdirSync(ovdDir, { recursive: true });
    fs.writeFileSync(path.join(ovdDir, 'project.md'), '# legacy\n');
    const r1 = runWorkflowInit(projectDir, { step: 'migration', action: 'bogus' });
    check('unrecognized: currentStep=migration (re-prompted)', r1.currentStep === 'migration');
    check('unrecognized: note mentions action', /Unrecognized action: bogus/.test(r1.note));
    check('unrecognized: prompt re-emitted', !!r1.prompt && r1.prompt.step === 'migration');
  } finally {
    cleanup(tmpRoot);
  }
  // Mapping step: bogus action
  {
    const { projectDir, tmpRoot } = makeTempProject('unrecognized-mapping');
    try {
      runWorkflowInit(projectDir);
      const r = runWorkflowInit(projectDir, { step: 'mapping', action: 'invalid' });
      check('unrecognized-mapping: re-prompted', r.currentStep === 'mapping' && !!r.prompt);
      check('unrecognized-mapping: note mentions action', /Unrecognized action: invalid/.test(r.note));
    } finally {
      cleanup(tmpRoot);
    }
  }
}

// --- 30. Requirements step rejects skip-all (terminal sub-step) ---
{
  const { projectDir, tmpRoot } = makeTempProject('req-skip-all');
  try {
    runWorkflowInit(projectDir);
    runWorkflowInit(projectDir, { step: 'mapping', action: 'skip' });
    runWorkflowInit(projectDir, { step: 'preferences', action: 'skip' });
    const r = runWorkflowInit(projectDir, { step: 'requirements', action: 'skip-all' });
    check('req-skip-all: skip-all NOT a valid action at requirements (re-prompts)', r.currentStep === 'requirements' && !!r.prompt);
    check('req-skip-all: note mentions allowed actions', /proceed/.test(r.note) && /skip/.test(r.note));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 31. formatInitResult: end-to-end shape ---
{
  const { projectDir, tmpRoot } = makeTempProject('format-init');
  try {
    const r = runWorkflowInit(projectDir);
    check('format-init: text starts with header', r.text.startsWith('Overdrive (ovd-plan) — /ovd-workflow init'));
    check('format-init: text contains current step line', r.text.includes('Current step: mapping'));
    check('format-init: text contains the prompt question', r.text.includes(r.prompt.question));
    check('format-init: text mentions To advance CLI hint', /To advance via CLI: overdrive workflow init mapping <action>/.test(r.text));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 32. ensureScaffolded: idempotent ---
{
  const { projectDir, tmpRoot } = makeTempProject('ensure');
  try {
    const e1 = ensureScaffolded(projectDir);
    check('ensureScaffolded.1: scaffolded=true on first call', e1.scaffolded === true);
    const e2 = ensureScaffolded(projectDir);
    check('ensureScaffolded.2: scaffolded=false on second call (already-scaffolded)', e2.scaffolded === false && e2.action === 'already-scaffolded');
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
