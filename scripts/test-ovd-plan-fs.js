#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  OVD_DIR,
  OVD_PLAN_FILE,
  GITIGNORE_BLOCK_START,
  GITIGNORE_BLOCK_END,
  GITIGNORE_CARVE_OUT_BLOCK,
  detectOldLayout,
  scaffoldOverdrivePlan,
  writeGitignoreCarveOut
} = require('../lib/ovd-plan/fs');

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
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-test-${name}-`));
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

console.log('ovd-plan fs tests');

// --- scaffoldOverdrivePlan: fresh project ---
{
  const { projectDir, tmpRoot } = makeTempProject('fresh');
  try {
    const result = scaffoldOverdrivePlan(projectDir);
    check('fresh: scaffolded=true', result.scaffolded === true);
    check('fresh: .overdrive/ created', fs.existsSync(path.join(projectDir, OVD_DIR)));
    check('fresh: codebase/ created', fs.existsSync(path.join(projectDir, OVD_DIR, 'codebase')));
    check('fresh: handoffs/ created', fs.existsSync(path.join(projectDir, OVD_DIR, 'handoffs')));
    check('fresh: sessions/ created', fs.existsSync(path.join(projectDir, OVD_DIR, 'sessions')));
    check('fresh: sketches/ created', fs.existsSync(path.join(projectDir, OVD_DIR, 'sketches')));
    check(
      'fresh: sketches/approved/ created',
      fs.existsSync(path.join(projectDir, OVD_DIR, 'sketches', 'approved'))
    );
    check('fresh: reports/ created', fs.existsSync(path.join(projectDir, OVD_DIR, 'reports')));
    check(
      'fresh: requirements.md created',
      fs.existsSync(path.join(projectDir, OVD_DIR, 'requirements.md'))
    );
    check(
      'fresh: preferences.md created',
      fs.existsSync(path.join(projectDir, OVD_DIR, 'preferences.md'))
    );
    check(
      'fresh: decisions.md created',
      fs.existsSync(path.join(projectDir, OVD_DIR, 'decisions.md'))
    );
    check(
      'fresh: OVERDRIVE.md NOT created (Phase 3 owns)',
      !fs.existsSync(path.join(projectDir, OVD_PLAN_FILE))
    );
    check(
      'fresh: requirements.md has expected sections',
      fs
        .readFileSync(path.join(projectDir, OVD_DIR, 'requirements.md'), 'utf8')
        .includes('## Functional')
    );
    check(
      'fresh: decisions.md has expected table header',
      fs
        .readFileSync(path.join(projectDir, OVD_DIR, 'decisions.md'), 'utf8')
        .includes('| Date | Node | Decision | Rationale |')
    );
  } finally {
    cleanup(tmpRoot);
  }
}

// --- scaffoldOverdrivePlan: idempotent ---
{
  const { projectDir, tmpRoot } = makeTempProject('idempotent');
  try {
    const r1 = scaffoldOverdrivePlan(projectDir);
    const r2 = scaffoldOverdrivePlan(projectDir);
    check('idempotent: r1 scaffolded', r1.scaffolded === true);
    check('idempotent: r2 scaffolded', r2.scaffolded === true);
    check('idempotent: r2 created nothing', r2.created.length === 0);
    check('idempotent: r2 reports existing entries', r2.existed.length >= 1);
  } finally {
    cleanup(tmpRoot);
  }
}

// --- scaffoldOverdrivePlan: detects old layout, returns migration marker ---
{
  const { projectDir, tmpRoot } = makeTempProject('old-layout');
  try {
    fs.mkdirSync(path.join(projectDir, OVD_DIR), { recursive: true });
    fs.writeFileSync(path.join(projectDir, OVD_DIR, 'project.md'), '# Old project');
    fs.writeFileSync(path.join(projectDir, OVD_DIR, 'state.md'), '# Old state');

    const result = scaffoldOverdrivePlan(projectDir);
    check('old-layout: scaffolded=false', result.scaffolded === false);
    check('old-layout: needsMigration=true', result.needsMigration === true);
    check(
      'old-layout: reason=old layout detected',
      result.reason === 'old layout detected'
    );
    check('old-layout: oldMarkerCount >= 2', (result.oldMarkerCount || 0) >= 2);
    check(
      'old-layout: codebase/ NOT created',
      !fs.existsSync(path.join(projectDir, OVD_DIR, 'codebase'))
    );
  } finally {
    cleanup(tmpRoot);
  }
}

// --- scaffoldOverdrivePlan: existing new-layout partial — proceeds idempotently ---
{
  const { projectDir, tmpRoot } = makeTempProject('partial-new');
  try {
    fs.mkdirSync(path.join(projectDir, OVD_DIR, 'codebase'), { recursive: true });

    const result = scaffoldOverdrivePlan(projectDir);
    check('partial-new: scaffolded=true (not old)', result.scaffolded === true);
    check(
      'partial-new: codebase/ existed (not re-created)',
      result.existed.includes(path.join(OVD_DIR, 'codebase'))
    );
    check(
      'partial-new: sessions/ created (was missing)',
      result.created.includes(path.join(OVD_DIR, 'sessions'))
    );
  } finally {
    cleanup(tmpRoot);
  }
}

// --- scaffoldOverdrivePlan: rejects directory with no project signal ---
{
  const { projectDir, tmpRoot } = makeTempProject('unsafe', { withSignal: false });
  try {
    const result = scaffoldOverdrivePlan(projectDir);
    check('unsafe: scaffolded=false', result.scaffolded === false);
    check('unsafe: reason=no project signal', result.reason === 'no project signal');
    check(
      'unsafe: .overdrive/ NOT created',
      !fs.existsSync(path.join(projectDir, OVD_DIR))
    );
  } finally {
    cleanup(tmpRoot);
  }
}

// --- scaffoldOverdrivePlan: dryRun does not write ---
{
  const { projectDir, tmpRoot } = makeTempProject('dry-run');
  try {
    const result = scaffoldOverdrivePlan(projectDir, { dryRun: true });
    check('dry-run: scaffolded=true', result.scaffolded === true);
    check('dry-run: reports planned creations', result.created.length > 0);
    check(
      'dry-run: nothing actually written',
      !fs.existsSync(path.join(projectDir, OVD_DIR))
    );
  } finally {
    cleanup(tmpRoot);
  }
}

// --- writeGitignoreCarveOut: fresh project ---
{
  const { projectDir, tmpRoot } = makeTempProject('gi-fresh');
  try {
    const result = writeGitignoreCarveOut(projectDir);
    check('gi-fresh: changed=true', result.changed === true);
    check('gi-fresh: action=appended-new-block', result.action === 'appended-new-block');
    const content = fs.readFileSync(path.join(projectDir, '.gitignore'), 'utf8');
    check('gi-fresh: contains block start', content.includes(GITIGNORE_BLOCK_START));
    check('gi-fresh: contains block end', content.includes(GITIGNORE_BLOCK_END));
    check(
      'gi-fresh: contains carve-out for codebase/',
      content.includes('!.overdrive/codebase/**')
    );
    check(
      'gi-fresh: contains carve-out for sketches/approved/',
      content.includes('!.overdrive/sketches/approved/**')
    );
    check(
      'gi-fresh: contains base .overdrive/ ignore inside block',
      content.includes('.overdrive/')
    );
  } finally {
    cleanup(tmpRoot);
  }
}

// --- writeGitignoreCarveOut: migrates wholesale ignore ---
{
  const { projectDir, tmpRoot } = makeTempProject('gi-migrate');
  try {
    fs.writeFileSync(
      path.join(projectDir, '.gitignore'),
      'node_modules/\n.overdrive/\n*.log\n'
    );

    const result = writeGitignoreCarveOut(projectDir);
    check('gi-migrate: changed=true', result.changed === true);
    check(
      'gi-migrate: action=migrated-wholesale-ignore',
      result.action === 'migrated-wholesale-ignore'
    );

    const content = fs.readFileSync(path.join(projectDir, '.gitignore'), 'utf8');
    check('gi-migrate: still has node_modules/', content.includes('node_modules/'));
    check('gi-migrate: still has *.log', content.includes('*.log'));
    check('gi-migrate: contains carve-out block', content.includes(GITIGNORE_BLOCK_START));

    const linesOutsideBlock = (() => {
      const startIdx = content.indexOf(GITIGNORE_BLOCK_START);
      const endIdx = content.indexOf(GITIGNORE_BLOCK_END);
      return (
        content.substring(0, startIdx) +
        content.substring(endIdx + GITIGNORE_BLOCK_END.length)
      ).split('\n');
    })();
    check(
      'gi-migrate: no standalone .overdrive/ line outside managed block',
      !linesOutsideBlock.some((l) => l.trim() === '.overdrive/' || l.trim() === '.overdrive')
    );
  } finally {
    cleanup(tmpRoot);
  }
}

// --- writeGitignoreCarveOut: idempotent ---
{
  const { projectDir, tmpRoot } = makeTempProject('gi-idempotent');
  try {
    writeGitignoreCarveOut(projectDir);
    const r2 = writeGitignoreCarveOut(projectDir);
    check('gi-idempotent: r2 changed=false', r2.changed === false);
    check('gi-idempotent: r2 action=already-current', r2.action === 'already-current');
  } finally {
    cleanup(tmpRoot);
  }
}

// --- writeGitignoreCarveOut: rewrites stale managed block ---
{
  const { projectDir, tmpRoot } = makeTempProject('gi-stale-block');
  try {
    const stale = [
      'node_modules/',
      '',
      GITIGNORE_BLOCK_START,
      '# old carve-out content',
      '.overdrive/',
      '!.overdrive/wrong-path/',
      GITIGNORE_BLOCK_END,
      ''
    ].join('\n');
    fs.writeFileSync(path.join(projectDir, '.gitignore'), stale);

    const result = writeGitignoreCarveOut(projectDir);
    check('gi-stale-block: changed=true', result.changed === true);
    check(
      'gi-stale-block: action=updated-managed-block',
      result.action === 'updated-managed-block'
    );

    const content = fs.readFileSync(path.join(projectDir, '.gitignore'), 'utf8');
    check(
      'gi-stale-block: contains new carve-out for codebase/',
      content.includes('!.overdrive/codebase/**')
    );
    check(
      'gi-stale-block: stale wrong-path/ removed',
      !content.includes('wrong-path')
    );
    check('gi-stale-block: still has node_modules/', content.includes('node_modules/'));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- writeGitignoreCarveOut: dryRun ---
{
  const { projectDir, tmpRoot } = makeTempProject('gi-dry-run');
  try {
    const result = writeGitignoreCarveOut(projectDir, { dryRun: true });
    check('gi-dry-run: changed=true', result.changed === true);
    check(
      'gi-dry-run: .gitignore NOT written',
      !fs.existsSync(path.join(projectDir, '.gitignore'))
    );
  } finally {
    cleanup(tmpRoot);
  }
}

// --- detectOldLayout: behaviors ---
{
  const { projectDir, tmpRoot } = makeTempProject('detect');
  try {
    check('detect: empty project = false', detectOldLayout(projectDir) === false);

    fs.mkdirSync(path.join(projectDir, OVD_DIR), { recursive: true });
    check('detect: empty .overdrive/ = false', detectOldLayout(projectDir) === false);

    fs.writeFileSync(path.join(projectDir, OVD_DIR, 'state.md'), '# state');
    check('detect: only state.md = true', detectOldLayout(projectDir) === true);

    fs.mkdirSync(path.join(projectDir, OVD_DIR, 'codebase'), { recursive: true });
    check(
      'detect: state.md + codebase/ = false (new layout present)',
      detectOldLayout(projectDir) === false
    );
  } finally {
    cleanup(tmpRoot);
  }
}

// --- detectOldLayout: OVERDRIVE.md root file indicates new layout ---
{
  const { projectDir, tmpRoot } = makeTempProject('detect-root-file');
  try {
    fs.mkdirSync(path.join(projectDir, OVD_DIR), { recursive: true });
    fs.writeFileSync(path.join(projectDir, OVD_DIR, 'project.md'), '# old');
    fs.writeFileSync(path.join(projectDir, OVD_PLAN_FILE), '---\novd-plan: true\n---\n# X');

    check(
      'detect-root-file: OVERDRIVE.md present → false even with old marker',
      detectOldLayout(projectDir) === false
    );
  } finally {
    cleanup(tmpRoot);
  }
}

// --- Summary ---
console.log('');
if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${failures.length + passed} checks:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`${passed} checks passed.`);
