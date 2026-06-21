#!/usr/bin/env node
'use strict';

// Task 5.7 — runDocUpdate surgical doc propagation (r3 §4.4, §7.6 step 4).
// Pattern-1 dispatch: PLAN emits candidate docs; agent uses doc-coauthoring to
// pick sections; COMMIT persists section diffs surgically (untouched sections
// preserved verbatim). Action-path threshold per Q5.3.

const fs = require('fs');
const os = require('os');
const path = require('path');

const docUpdate = require('../lib/ovd-plan/doc-update');
const {
  LOAD_BEARING_DOCS,
  isLoadBearingDoc,
  replaceOrAppendSection,
  buildDocUpdatePlan,
  normalizeDocUpdateEntries,
  computeTriviality,
  applyDocUpdate,
  runDocUpdate
} = docUpdate;

const verbose = process.argv.includes('--verbose');
let passed = 0;
const failures = [];
function check(label, condition, detail) {
  if (condition) { passed += 1; if (verbose) console.log(`PASS ${label}`); }
  else { failures.push(detail ? `${label}: ${detail}` : label); console.log(`FAIL ${label}`); }
}

function makeProject(name) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-doc-update-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(path.join(projectDir, '.overdrive', 'codebase'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  return { projectDir, tmpRoot };
}
function cleanup(tmpRoot) { fs.rmSync(tmpRoot, { recursive: true, force: true }); }
function writeDoc(projectDir, rel, content) {
  const p = path.join(projectDir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}
function readDoc(projectDir, rel) { return fs.readFileSync(path.join(projectDir, rel), 'utf8'); }

const SAMPLE = `# Components

## Overview

The system has parts.

## Auth

Old auth description.

## Storage

Storage stays put.
`;

// --- replaceOrAppendSection ---------------------------------------------
(function () {
  const out = replaceOrAppendSection(SAMPLE, 'Auth', 'New auth description.');
  check('replace: new body present', out.includes('New auth description.'));
  check('replace: old body gone', !out.includes('Old auth description.'));
  check('replace: untouched Overview preserved', out.includes('The system has parts.'));
  check('replace: untouched Storage preserved verbatim', out.includes('Storage stays put.'));
  check('replace: Auth heading kept once', (out.match(/^## Auth$/gm) || []).length === 1, out);
  check('replace: heading order preserved (Overview<Auth<Storage)', out.indexOf('Overview') < out.indexOf('## Auth') && out.indexOf('## Auth') < out.indexOf('Storage'));

  const appended = replaceOrAppendSection(SAMPLE, 'Telemetry', 'Brand new section.');
  check('append: new section added when not found', appended.includes('## Telemetry') && appended.includes('Brand new section.'));
  check('append: existing sections preserved', appended.includes('Old auth description.') && appended.includes('Storage stays put.'));

  // ### subsection replacement leaves sibling ## intact
  const nested = `## A\n\ntext a\n\n### Sub\n\nold sub\n\n## B\n\ntext b\n`;
  const r = replaceOrAppendSection(nested, 'Sub', 'new sub');
  check('replace subsection: new sub body', r.includes('new sub') && !r.includes('old sub'));
  check('replace subsection: ## B preserved', r.includes('## B') && r.includes('text b'));
})();

// --- isLoadBearingDoc ---------------------------------------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('loadbearing');
  check('allow-list is array', Array.isArray(LOAD_BEARING_DOCS) && LOAD_BEARING_DOCS.length >= 4);
  writeDoc(projectDir, '.overdrive/codebase/architecture.md', '# Arch\n');
  writeDoc(projectDir, '.overdrive/codebase/components.md', '# Components\n');
  writeDoc(projectDir, 'README.md', '# Readme\n');
  writeDoc(projectDir, 'docs/guide.md', '---\nload_bearing: true\n---\n# Guide\n');
  writeDoc(projectDir, 'docs/notes.md', '---\nfoo: bar\n---\n# Notes\n');
  check('architecture.md is load-bearing', isLoadBearingDoc(projectDir, '.overdrive/codebase/architecture.md') === true);
  check('patterns.md in allow-list', LOAD_BEARING_DOCS.some((d) => d.includes('patterns.md')));
  check('tech-stack.md in allow-list', LOAD_BEARING_DOCS.some((d) => d.includes('tech-stack.md')));
  check('README.md is load-bearing', isLoadBearingDoc(projectDir, 'README.md') === true);
  check('components.md is NOT load-bearing', isLoadBearingDoc(projectDir, '.overdrive/codebase/components.md') === false);
  check('frontmatter load_bearing:true → load-bearing', isLoadBearingDoc(projectDir, 'docs/guide.md') === true);
  check('frontmatter without flag → not load-bearing', isLoadBearingDoc(projectDir, 'docs/notes.md') === false);
  cleanup(tmpRoot);
})();

// --- buildDocUpdatePlan -------------------------------------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('plan');
  writeDoc(projectDir, '.overdrive/codebase/components.md', SAMPLE);
  writeDoc(projectDir, '.overdrive/codebase/architecture.md', '# Arch\n');
  const res = buildDocUpdatePlan(projectDir, { changes: [{ summary: 'renamed auth endpoint', nodes: ['II.2.a'] }] });
  check('plan ok', res.ok === true);
  check('plan mode', res.mode === 'plan');
  check('plan lists candidate docs', Array.isArray(res.candidate_docs) && res.candidate_docs.length >= 2, JSON.stringify(res.candidate_docs));
  check('plan mentions doc-coauthoring', /doc-coauthoring/i.test(res.text));
  check('plan mentions --entries-json', /--entries-json/.test(res.text));
  check('plan echoes change summary', /renamed auth endpoint/.test(res.text));
  cleanup(tmpRoot);
})();

// --- normalizeDocUpdateEntries ------------------------------------------
(function () {
  check('normalize rejects array', normalizeDocUpdateEntries([]).ok === false);
  check('normalize rejects missing updates', normalizeDocUpdateEntries({}).ok === false);
  check('normalize rejects empty updates', normalizeDocUpdateEntries({ updates: [] }).ok === false);
  const bad = normalizeDocUpdateEntries({ updates: [{ heading: 'x', body: 'y' }] });
  check('normalize rejects update without doc', bad.ok === false);
  const bad2 = normalizeDocUpdateEntries({ updates: [{ doc: 'a.md', body: 'y' }] });
  check('normalize rejects update without heading', bad2.ok === false);
  const ok = normalizeDocUpdateEntries({ updates: [{ doc: '.overdrive/codebase/components.md', heading: 'Auth', body: 'new' }] });
  check('normalize accepts valid update', ok.ok === true && ok.updates.length === 1);
  check('normalize trims fields', ok.updates[0].doc === '.overdrive/codebase/components.md' && ok.updates[0].heading === 'Auth');
  // path traversal guard
  const traversal = normalizeDocUpdateEntries({ updates: [{ doc: '../../etc/passwd', heading: 'x', body: 'y' }] });
  check('normalize rejects path traversal', traversal.ok === false, JSON.stringify(traversal));
})();

// --- computeTriviality --------------------------------------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('trivial');
  writeDoc(projectDir, '.overdrive/codebase/components.md', SAMPLE);
  writeDoc(projectDir, '.overdrive/codebase/architecture.md', '# Arch\n\n## Layers\n\nold\n');

  const small = computeTriviality(projectDir, [{ doc: '.overdrive/codebase/components.md', heading: 'Auth', body: 'short new body' }]);
  check('triviality: single small non-load-bearing is trivial', small.trivial === true, JSON.stringify(small));
  check('triviality: sectionCount 1', small.sectionCount === 1);

  const twoSections = computeTriviality(projectDir, [
    { doc: '.overdrive/codebase/components.md', heading: 'Auth', body: 'a' },
    { doc: '.overdrive/codebase/components.md', heading: 'Storage', body: 'b' }
  ]);
  check('triviality: >1 section is non-trivial', twoSections.trivial === false);

  const loadBearing = computeTriviality(projectDir, [{ doc: '.overdrive/codebase/architecture.md', heading: 'Layers', body: 'one line' }]);
  check('triviality: load-bearing doc is non-trivial', loadBearing.trivial === false);
  check('triviality: reports loadBearingDocs', loadBearing.loadBearingDocs.length === 1);

  const bigBody = Array.from({ length: 60 }, (_, i) => `line ${i}`).join('\n');
  const big = computeTriviality(projectDir, [{ doc: '.overdrive/codebase/components.md', heading: 'Auth', body: bigBody }]);
  check('triviality: >50 net lines is non-trivial', big.trivial === false, `netLines=${big.netLines}`);
  cleanup(tmpRoot);
})();

// --- applyDocUpdate: trivial → silent apply -----------------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('apply-trivial');
  writeDoc(projectDir, '.overdrive/codebase/components.md', SAMPLE);
  const res = applyDocUpdate(projectDir, { updates: [{ doc: '.overdrive/codebase/components.md', heading: 'Auth', body: 'New auth description.' }] }, {});
  check('trivial apply ok', res.ok === true, JSON.stringify(res));
  check('trivial apply mode applied', res.mode === 'doc-update-applied', res.mode);
  check('trivial apply needs_confirm false', !res.needs_confirm);
  const body = readDoc(projectDir, '.overdrive/codebase/components.md');
  check('trivial apply wrote new body', body.includes('New auth description.') && !body.includes('Old auth description.'));
  check('trivial apply preserved Storage', body.includes('Storage stays put.'));
  check('trivial apply reports written docs', Array.isArray(res.written) && res.written.length === 1);
  cleanup(tmpRoot);
})();

// --- applyDocUpdate: non-trivial → preview (no write) -------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('apply-preview');
  writeDoc(projectDir, '.overdrive/codebase/architecture.md', '# Arch\n\n## Layers\n\nold layers\n');
  const before = readDoc(projectDir, '.overdrive/codebase/architecture.md');
  const res = applyDocUpdate(projectDir, { updates: [{ doc: '.overdrive/codebase/architecture.md', heading: 'Layers', body: 'new layers' }] }, {});
  check('preview ok', res.ok === true);
  check('preview mode', res.mode === 'doc-update-preview', res.mode);
  check('preview needs_confirm', res.needs_confirm === true);
  check('preview lists numbered options', /\(1\)/.test(res.text) && /\(2\)/.test(res.text) && /\(3\)/.test(res.text));
  check('preview offers describe-other', /other/i.test(res.text));
  check('preview names the doc', /architecture\.md/.test(res.text));
  check('preview did NOT write', readDoc(projectDir, '.overdrive/codebase/architecture.md') === before);
  cleanup(tmpRoot);
})();

// --- applyDocUpdate: non-trivial + confirm → apply ----------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('apply-confirm');
  writeDoc(projectDir, '.overdrive/codebase/architecture.md', '# Arch\n\n## Layers\n\nold layers\n');
  const res = applyDocUpdate(projectDir, { updates: [{ doc: '.overdrive/codebase/architecture.md', heading: 'Layers', body: 'new layers' }] }, { confirm: true });
  check('confirm apply mode applied', res.mode === 'doc-update-applied');
  check('confirm apply wrote', readDoc(projectDir, '.overdrive/codebase/architecture.md').includes('new layers'));
  cleanup(tmpRoot);
})();

// --- applyDocUpdate: per-section review via `only` ----------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('apply-only');
  writeDoc(projectDir, '.overdrive/codebase/components.md', SAMPLE);
  const updates = [
    { doc: '.overdrive/codebase/components.md', heading: 'Auth', body: 'AUTH-NEW' },
    { doc: '.overdrive/codebase/components.md', heading: 'Storage', body: 'STORAGE-NEW' }
  ];
  // apply only index 0 (per-section review picked just Auth)
  const res = applyDocUpdate(projectDir, { updates }, { confirm: true, only: [0] });
  check('only apply ok', res.ok === true && res.mode === 'doc-update-applied');
  const body = readDoc(projectDir, '.overdrive/codebase/components.md');
  check('only applied Auth', body.includes('AUTH-NEW'));
  check('only did NOT apply Storage', !body.includes('STORAGE-NEW') && body.includes('Storage stays put.'));
  cleanup(tmpRoot);
})();

// --- applyDocUpdate: missing doc handled --------------------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('apply-missing');
  const res = applyDocUpdate(projectDir, { updates: [{ doc: '.overdrive/codebase/ghost.md', heading: 'X', body: 'y' }] }, { confirm: true });
  // creating a missing doc with the section is acceptable; assert it doesn't crash and reports outcome
  check('missing doc apply returns ok-shaped result', typeof res.ok === 'boolean');
  if (res.ok && res.mode === 'doc-update-applied') {
    check('missing doc created', fs.existsSync(path.join(projectDir, '.overdrive/codebase/ghost.md')));
  } else {
    check('missing doc reported as skipped/failed cleanly', !!res.reason || Array.isArray(res.skipped));
  }
  cleanup(tmpRoot);
})();

// --- runDocUpdate dispatch ----------------------------------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('dispatch');
  writeDoc(projectDir, '.overdrive/codebase/components.md', SAMPLE);
  const plan = runDocUpdate(projectDir, { changes: [{ summary: 'x' }] });
  check('dispatch → plan when no entries', plan.mode === 'plan');
  const commit = runDocUpdate(projectDir, { entries: { updates: [{ doc: '.overdrive/codebase/components.md', heading: 'Auth', body: 'z' }] } });
  check('dispatch → commit when entries', commit.mode === 'doc-update-applied' || commit.mode === 'doc-update-preview');
  check('dispatch invalid project dir', runDocUpdate(null, {}).ok === false);
  // changedNodes convenience (Task 3.6 EDIT wiring shape)
  const plan2 = runDocUpdate(projectDir, { changedNodes: ['II.2.a'] });
  check('dispatch accepts changedNodes → plan', plan2.mode === 'plan');
  cleanup(tmpRoot);
})();

// --- migration-compat seam (Pattern 5) ----------------------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('migrate-seam');
  // A migrated doc with a discovered-content section must survive a surgical update.
  const doc = `# Components\n\n## Overview\n\nbase\n\n## Discovered during execution\n\nimportant runtime note\n`;
  writeDoc(projectDir, '.overdrive/codebase/components.md', doc);
  const res = applyDocUpdate(projectDir, { updates: [{ doc: '.overdrive/codebase/components.md', heading: 'Overview', body: 'updated overview' }] }, { confirm: true });
  check('migrate-seam apply ok', res.ok === true);
  const body = readDoc(projectDir, '.overdrive/codebase/components.md');
  check('migrate-seam updated Overview', body.includes('updated overview'));
  check('migrate-seam preserved discovered section verbatim', body.includes('## Discovered during execution') && body.includes('important runtime note'));
  cleanup(tmpRoot);
})();

// --- summary ------------------------------------------------------------
if (failures.length) {
  console.log(`\n${failures.length} FAILURES:`);
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`\n${passed} checks passed, ${failures.length} failed.`);
  process.exit(1);
}
console.log(`${passed} checks passed.`);
