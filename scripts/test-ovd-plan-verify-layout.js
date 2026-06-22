#!/usr/bin/env node
'use strict';

// Task 7.3 — tests for lib/ovd-plan/verify-layout.js (`overdrive verify --plan`).
// Covers: no-layout, old-layout, healthy, parse-error, missing-plan-file,
// missing-ovd-dir, cache consistency (orphan / stale / status-drift / missing),
// structure warnings, orphan sketches, and the plain-language renderer.

const fs = require('fs');
const os = require('os');
const path = require('path');

const { verifyPlanLayout, renderVerifyLayout, SEVERITY } = require('../lib/ovd-plan/verify-layout');
const { regenerateCacheFrom, cachePath } = require('../lib/ovd-plan/cache');
const { ovdPath } = require('../lib/ovd-plan/fs');

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

function makeTempProject(name, { ovdDir = true } = {}) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-verifylayout-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  if (ovdDir) fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
  return { projectDir, tmpRoot };
}
function cleanup(tmpRoot) { fs.rmSync(tmpRoot, { recursive: true, force: true }); }
function writePlan(projectDir, content) { fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), content); }
function hasCode(result, code) { return result.findings.some((f) => f.code === code); }
function findingFor(result, code) { return result.findings.find((f) => f.code === code); }
function makeStructure(projectDir) {
  for (const d of ['codebase', 'sessions', 'handoffs', 'reports']) {
    fs.mkdirSync(ovdPath(projectDir, d), { recursive: true });
  }
  for (const f of ['preferences.md', 'requirements.md', 'decisions.md']) {
    fs.writeFileSync(ovdPath(projectDir, f), '# placeholder\n');
  }
}

const FENCE = '```yaml ovd-plan';
const FRONT = '---\novd-plan: true\nversion: 3\nproject: "Test Project"\n---\n\n';

function plan(nodes) {
  return `${FRONT}# Test Project\n\n${nodes}`;
}
const HEALTHY_TREE = `## I. Foundation [in-progress]

### I.1 Widget [in-progress]

${FENCE}
success:
  - works
references:
  sketches:
    - design.png
\`\`\`

### I.2 Gadget [pending]

## II. Polish [pending]
`;

// ---------------------------------------------------------------------------
// 1. no-layout (graceful)
// ---------------------------------------------------------------------------
{
  const { projectDir, tmpRoot } = makeTempProject('nolayout', { ovdDir: false });
  const r = verifyPlanLayout(projectDir);
  check('no-layout status', r.status === 'no-layout', r.status);
  check('no-layout ok=true', r.ok === true);
  check('no-layout has info finding', hasCode(r, 'no-layout'));
  check('no-layout finding is info severity', findingFor(r, 'no-layout').severity === SEVERITY.INFO);
  check('no-layout counts no errors', r.counts.error === 0);
  const txt = renderVerifyLayout(r);
  check('no-layout render mentions init', /ovd-workflow init/.test(txt));
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 2. old-layout (pre-r3 markers, no OVERDRIVE.md)
// ---------------------------------------------------------------------------
{
  const { projectDir, tmpRoot } = makeTempProject('oldlayout');
  fs.writeFileSync(ovdPath(projectDir, 'project.md'), '# old\n');
  fs.writeFileSync(ovdPath(projectDir, 'state.md'), 'state\n');
  const r = verifyPlanLayout(projectDir);
  check('old-layout status', r.status === 'old-layout', r.status);
  check('old-layout ok=true', r.ok === true);
  check('old-layout info finding', hasCode(r, 'old-layout'));
  check('old-layout mentions marker count', /legacy marker/.test(findingFor(r, 'old-layout').message));
  check('old-layout no errors', r.counts.error === 0);
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 3. healthy project (plan + consistent cache + full structure)
// ---------------------------------------------------------------------------
{
  const { projectDir, tmpRoot } = makeTempProject('healthy');
  writePlan(projectDir, plan(HEALTHY_TREE));
  makeStructure(projectDir);
  // referenced sketch present → no orphan warning
  fs.mkdirSync(ovdPath(projectDir, 'sketches', 'approved'), { recursive: true });
  fs.writeFileSync(ovdPath(projectDir, 'sketches', 'approved', 'design.png'), 'x');
  regenerateCacheFrom(projectDir);
  const r = verifyPlanLayout(projectDir);
  check('healthy status ok', r.status === 'ok', r.status);
  check('healthy ok=true', r.ok === true);
  check('healthy zero errors', r.counts.error === 0, JSON.stringify(r.counts));
  check('healthy zero warnings', r.counts.warning === 0, JSON.stringify(r.findings));
  check('healthy no cache-missing', !hasCode(r, 'cache-missing'));
  check('healthy no orphan-sketch', !hasCode(r, 'orphan-sketch'));
  const txt = renderVerifyLayout(r);
  check('healthy render says all passed', /All checks passed/.test(txt));
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 4. parse error in OVERDRIVE.md
// ---------------------------------------------------------------------------
{
  const { projectDir, tmpRoot } = makeTempProject('parseerr');
  // invalid status value → parser throws ParseError
  writePlan(projectDir, plan('## I. Foundation [bogus-status]\n'));
  makeStructure(projectDir);
  const r = verifyPlanLayout(projectDir);
  check('parse-error reported', hasCode(r, 'parse-error'));
  check('parse-error is error severity', findingFor(r, 'parse-error').severity === SEVERITY.ERROR);
  check('parse-error ok=false', r.ok === false);
  check('parse-error status=errors', r.status === 'errors');
  check('parse-error message has detail', findingFor(r, 'parse-error').message.length > 'OVERDRIVE.md failed to parse: '.length);
  const txt = renderVerifyLayout(r);
  check('parse-error render has ERROR tag', /ERROR/.test(txt));
  check('parse-error render has summary', /Summary: 1 error/.test(txt));
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 5. layout scaffolded but no plan yet (init→plan window) → warning, not error
// ---------------------------------------------------------------------------
{
  const { projectDir, tmpRoot } = makeTempProject('missingplan');
  // codebase/ marker makes newLayoutPresent() true without OVERDRIVE.md
  fs.mkdirSync(ovdPath(projectDir, 'codebase'), { recursive: true });
  const r = verifyPlanLayout(projectDir);
  check('plan-not-created reported', hasCode(r, 'plan-not-created'));
  check('plan-not-created is warning', findingFor(r, 'plan-not-created').severity === SEVERITY.WARNING);
  check('plan-not-created guides to /ovd-plan', /ovd-plan/.test(findingFor(r, 'plan-not-created').message));
  check('plan-not-created ok=true', r.ok === true);
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 5b. cache without source OVERDRIVE.md → corruption error
// ---------------------------------------------------------------------------
{
  const { projectDir, tmpRoot } = makeTempProject('cacheorphansource');
  writePlan(projectDir, plan(HEALTHY_TREE));
  regenerateCacheFrom(projectDir);            // create a real cache
  fs.rmSync(path.join(projectDir, 'OVERDRIVE.md')); // then delete its source
  const r = verifyPlanLayout(projectDir);
  check('missing-plan-file reported (cache orphaned)', hasCode(r, 'missing-plan-file'));
  check('missing-plan-file is error', findingFor(r, 'missing-plan-file').severity === SEVERITY.ERROR);
  check('missing-plan-file mentions cache', /plan\.cache\.json/.test(findingFor(r, 'missing-plan-file').message));
  check('missing-plan-file ok=false', r.ok === false);
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 6. missing .overdrive dir but OVERDRIVE.md present
// ---------------------------------------------------------------------------
{
  const { projectDir, tmpRoot } = makeTempProject('nodir', { ovdDir: false });
  writePlan(projectDir, plan(HEALTHY_TREE));
  const r = verifyPlanLayout(projectDir);
  check('missing-ovd-dir reported', hasCode(r, 'missing-ovd-dir'));
  check('missing-ovd-dir is error', findingFor(r, 'missing-ovd-dir').severity === SEVERITY.ERROR);
  check('missing-ovd-dir ok=false', r.ok === false);
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 7. cache orphan node (cache has node not in tree)
// ---------------------------------------------------------------------------
{
  const { projectDir, tmpRoot } = makeTempProject('orphan');
  writePlan(projectDir, plan(HEALTHY_TREE));
  makeStructure(projectDir);
  regenerateCacheFrom(projectDir); // cache has I.1, I.2, II
  // remove I.2 from OVERDRIVE.md so cache references a vanished node
  writePlan(projectDir, plan(`## I. Foundation [in-progress]

### I.1 Widget [in-progress]

## II. Polish [pending]
`));
  const r = verifyPlanLayout(projectDir);
  check('cache-orphan-node reported', hasCode(r, 'cache-orphan-node'));
  check('cache-orphan-node is error', findingFor(r, 'cache-orphan-node').severity === SEVERITY.ERROR);
  check('cache-orphan-node names I.2', /I\.2/.test(findingFor(r, 'cache-orphan-node').message));
  check('cache-orphan-node ok=false', r.ok === false);
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 8. cache stale node (tree has node not in cache)
// ---------------------------------------------------------------------------
{
  const { projectDir, tmpRoot } = makeTempProject('stale');
  writePlan(projectDir, plan(HEALTHY_TREE));
  makeStructure(projectDir);
  regenerateCacheFrom(projectDir);
  // append a new milestone after caching
  writePlan(projectDir, plan(`${HEALTHY_TREE}
## III. Extra [pending]
`));
  const r = verifyPlanLayout(projectDir);
  check('cache-stale-node reported', hasCode(r, 'cache-stale-node'));
  check('cache-stale-node is warning', findingFor(r, 'cache-stale-node').severity === SEVERITY.WARNING);
  check('cache-stale-node does not fail', r.ok === true, JSON.stringify(r.counts));
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 9. cache status drift
// ---------------------------------------------------------------------------
{
  const { projectDir, tmpRoot } = makeTempProject('drift');
  writePlan(projectDir, plan(HEALTHY_TREE));
  makeStructure(projectDir);
  regenerateCacheFrom(projectDir);
  // flip I.2 pending → done after caching
  writePlan(projectDir, plan(`## I. Foundation [in-progress]

### I.1 Widget [in-progress]

${FENCE}
success:
  - works
references:
  sketches:
    - design.png
\`\`\`

### I.2 Gadget [done]

## II. Polish [pending]
`));
  const r = verifyPlanLayout(projectDir);
  check('cache-status-drift reported', hasCode(r, 'cache-status-drift'));
  check('cache-status-drift is warning', findingFor(r, 'cache-status-drift').severity === SEVERITY.WARNING);
  check('cache-status-drift mentions statuses', /done|pending/.test(findingFor(r, 'cache-status-drift').message));
  check('cache-status-drift ok=true', r.ok === true);
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 10. cache missing
// ---------------------------------------------------------------------------
{
  const { projectDir, tmpRoot } = makeTempProject('nocache');
  writePlan(projectDir, plan(HEALTHY_TREE));
  makeStructure(projectDir);
  const r = verifyPlanLayout(projectDir);
  check('cache-missing reported', hasCode(r, 'cache-missing'));
  check('cache-missing is warning', findingFor(r, 'cache-missing').severity === SEVERITY.WARNING);
  check('cache-missing ok=true', r.ok === true);
  check('no cache file exists', !fs.existsSync(cachePath(projectDir)));
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 11. structure warnings (missing dirs/files)
// ---------------------------------------------------------------------------
{
  const { projectDir, tmpRoot } = makeTempProject('struct');
  writePlan(projectDir, plan(HEALTHY_TREE));
  regenerateCacheFrom(projectDir);
  const r = verifyPlanLayout(projectDir);
  check('missing-dir reported', hasCode(r, 'missing-dir'));
  check('missing-file reported', hasCode(r, 'missing-file'));
  const dirWarnings = r.findings.filter((f) => f.code === 'missing-dir');
  check('all four expected dirs flagged', dirWarnings.length === 4, String(dirWarnings.length));
  const fileWarnings = r.findings.filter((f) => f.code === 'missing-file');
  check('all three expected files flagged', fileWarnings.length === 3, String(fileWarnings.length));
  check('structure warnings do not fail', r.ok === true);
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 12. orphan sketch
// ---------------------------------------------------------------------------
{
  const { projectDir, tmpRoot } = makeTempProject('sketch');
  writePlan(projectDir, plan(HEALTHY_TREE));
  makeStructure(projectDir);
  regenerateCacheFrom(projectDir);
  fs.mkdirSync(ovdPath(projectDir, 'sketches', 'approved'), { recursive: true });
  fs.writeFileSync(ovdPath(projectDir, 'sketches', 'approved', 'design.png'), 'x'); // referenced
  fs.writeFileSync(ovdPath(projectDir, 'sketches', 'approved', 'stray.png'), 'x');  // orphan
  const r = verifyPlanLayout(projectDir);
  check('orphan-sketch reported for stray', hasCode(r, 'orphan-sketch'));
  check('orphan-sketch names stray.png', /stray\.png/.test(findingFor(r, 'orphan-sketch').message));
  const orphans = r.findings.filter((f) => f.code === 'orphan-sketch');
  check('referenced design.png not flagged', orphans.every((f) => !/design\.png/.test(f.message)));
  check('orphan-sketch is warning', findingFor(r, 'orphan-sketch').severity === SEVERITY.WARNING);
  check('orphan-sketch ok=true', r.ok === true);
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 13. renderer shape
// ---------------------------------------------------------------------------
{
  const { projectDir, tmpRoot } = makeTempProject('render');
  writePlan(projectDir, plan(HEALTHY_TREE));
  makeStructure(projectDir);
  // no cache → one warning
  const r = verifyPlanLayout(projectDir);
  const txt = renderVerifyLayout(r);
  check('render has header', /ovd-plan layout verification/.test(txt));
  check('render has WARN tag', /WARN/.test(txt));
  check('render has summary line', /Summary: 0 error\(s\), 1 warning/.test(txt), txt);
  check('render healthy-note when no errors', /Layout is healthy/.test(txt));
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 14. multiple errors aggregate
// ---------------------------------------------------------------------------
{
  const { projectDir, tmpRoot } = makeTempProject('multierr', { ovdDir: false });
  // OVERDRIVE.md present but unparseable AND no .overdrive dir
  writePlan(projectDir, plan('## I. Foundation [nope]\n'));
  const r = verifyPlanLayout(projectDir);
  check('multi-error parse-error present', hasCode(r, 'parse-error'));
  check('multi-error missing-ovd-dir present', hasCode(r, 'missing-ovd-dir'));
  check('multi-error counts >= 2 errors', r.counts.error >= 2, String(r.counts.error));
  check('multi-error ok=false', r.ok === false);
  const txt = renderVerifyLayout(r);
  check('multi-error render summary plural', /Summary: 2 error/.test(txt));
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${passed} checks passed.`);
if (failures.length > 0) {
  console.log(`${failures.length} failure(s):`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
