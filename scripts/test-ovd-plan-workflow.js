#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  CODEBASE_FILES,
  TUTORIAL_LINES,
  STATES,
  inspectProject,
  inspectCodebase,
  classifyFile,
  nextStepsFor,
  formatStatusBlock,
  formatWorkflowDefault,
  runWorkflowDefault
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

// --- 16. index.js dispatch: subcommand → still stub ---
{
  const ovdPlan = require('../lib/ovd-plan');
  const result = ovdPlan.runWorkflow({ projectDir: process.cwd(), subcommand: 'init' }, process.env);
  check('dispatch (subcommand=init): status=stub', result.status === 'stub');
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
