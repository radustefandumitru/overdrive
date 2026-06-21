#!/usr/bin/env node
'use strict';

// Task 5.4 — /ovd-log concerns [<node-ref>]  (r3 §7.2).
// Structured review across 7 dimensions on the active node (or specified).
// Pattern-1 dispatch: PLAN emits dimensions; COMMIT persists findings to the
// node's `concerns` annotation. High-severity findings recommend /ovd-plan idea.

const fs = require('fs');
const os = require('os');
const path = require('path');

const concerns = require('../lib/ovd-plan/concerns');
const {
  STATUS,
  DIMENSIONS,
  SEVERITIES,
  buildConcernsPlan,
  normalizeConcernsEntries,
  applyConcerns,
  runLogConcerns
} = concerns;

const { parseOverdriveMd } = require('../lib/ovd-plan/parser');

const verbose = process.argv.includes('--verbose');
let passed = 0;
const failures = [];
function check(label, condition, detail) {
  if (condition) { passed += 1; if (verbose) console.log(`PASS ${label}`); }
  else { failures.push(detail ? `${label}: ${detail}` : label); console.log(`FAIL ${label}`); }
}

const FRONT = '---\novd-plan: true\nversion: 3\nproject: "Test Project"\n---\n\n';
const FIXTURE = `${FRONT}# Test Project

## I. Foundation [done]

### I.1 Setup [done]

## II. Dashboard [in-progress]

### II.1 Data [done]

### II.2 Stats [in-progress]

#### II.2.a Widget [in-progress] ← ACTIVE
\`\`\`yaml ovd-plan
scope:
  in: [src/widget.js]
\`\`\`

#### II.2.b Chart [pending]
`;

function makeProject(name, content) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-concerns-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), content === undefined ? FIXTURE : content);
  return { projectDir, tmpRoot };
}
function cleanup(tmpRoot) { fs.rmSync(tmpRoot, { recursive: true, force: true }); }
function readPlan(p) { return fs.readFileSync(path.join(p, 'OVERDRIVE.md'), 'utf8'); }
function nodeBy(p, id) {
  const flat = [];
  (function walk(n) { for (const c of n.children || []) { flat.push(c); walk(c); } })(parseOverdriveMd(readPlan(p)).tree);
  return flat.find((x) => x.id === id) || null;
}

// --- constants ----------------------------------------------------------
(function () {
  check('STATUS is log', STATUS === 'log');
  check('7 dimensions', Array.isArray(DIMENSIONS) && DIMENSIONS.length === 7, String(DIMENSIONS && DIMENSIONS.length));
  const keys = DIMENSIONS.map((d) => d[0]);
  for (const k of ['security', 'performance', 'persistence', 'fault_tolerance', 'accessibility', 'observability', 'scalability']) {
    check(`dimension ${k} present`, keys.includes(k));
  }
  check('severities include high/medium/low/n/a', ['high', 'medium', 'low', 'n/a'].every((s) => SEVERITIES.includes(s)));
})();

// --- PLAN: defaults to active node --------------------------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('plan-active');
  const res = buildConcernsPlan(projectDir, {});
  check('plan ok', res.ok === true, JSON.stringify(res));
  check('plan mode', res.mode === 'plan');
  check('plan targets active node II.2.a', res.node_id === 'II.2.a', res.node_id);
  for (const [, label] of DIMENSIONS) check(`plan lists ${label}`, res.text.includes(label));
  check('plan mentions --entries-json', /--entries-json/.test(res.text));
  check('plan mentions scope file', /src\/widget\.js/.test(res.text));
  cleanup(tmpRoot);
})();

// --- PLAN: explicit node ref --------------------------------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('plan-explicit');
  const res = buildConcernsPlan(projectDir, { nodeId: 'II.2.b' });
  check('plan explicit targets II.2.b', res.ok === true && res.node_id === 'II.2.b');
  const missing = buildConcernsPlan(projectDir, { nodeId: 'ZZ.9' });
  check('plan unknown node → not ok', missing.ok === false && /not-found|no node/i.test(missing.reason || missing.text));
  cleanup(tmpRoot);
})();

// --- PLAN: no active node and none specified ----------------------------
(function () {
  const noActive = FIXTURE.replace(' ← ACTIVE', '');
  const { projectDir, tmpRoot } = makeProject('plan-noactive', noActive);
  const res = buildConcernsPlan(projectDir, {});
  check('plan no-target → not ok', res.ok === false, JSON.stringify(res));
  check('plan no-target reason', /no-active|no active|specify/i.test(res.reason || res.text));
  cleanup(tmpRoot);
})();

// --- normalize ----------------------------------------------------------
(function () {
  check('normalize rejects array', normalizeConcernsEntries([]).ok === false);
  check('normalize rejects missing node_id', normalizeConcernsEntries({ concerns: [] }).ok === false);
  check('normalize rejects empty concerns', normalizeConcernsEntries({ node_id: 'II.2.a', concerns: [] }).ok === false);

  const good = normalizeConcernsEntries({
    node_id: 'II.2.a',
    concerns: [
      { dimension: 'security', severity: 'high', finding: 'no input validation', recommendation: 'add a validator' },
      { dimension: 'performance', severity: 'n/a', finding: 'not applicable' }
    ]
  });
  check('normalize accepts valid', good.ok === true && good.concerns.length === 2);
  check('normalize keeps recommendation', good.concerns[0].recommendation === 'add a validator');
  check('normalize default recommendation empty', good.concerns[1].recommendation === '');

  const badDim = normalizeConcernsEntries({ node_id: 'X', concerns: [{ dimension: 'telepathy', severity: 'high', finding: 'f' }] });
  check('normalize rejects unknown dimension', badDim.ok === false && /dimension/.test(badDim.reason || badDim.text));
  const badSev = normalizeConcernsEntries({ node_id: 'X', concerns: [{ dimension: 'security', severity: 'catastrophic', finding: 'f' }] });
  check('normalize rejects invalid severity', badSev.ok === false && /severity/.test(badSev.reason || badSev.text));
  const noFinding = normalizeConcernsEntries({ node_id: 'X', concerns: [{ dimension: 'security', severity: 'high' }] });
  check('normalize rejects missing finding', noFinding.ok === false);
})();

// --- COMMIT: persists to node concerns + recommends idea on high --------
(function () {
  const { projectDir, tmpRoot } = makeProject('commit');
  const res = applyConcerns(projectDir, {
    node_id: 'II.2.a',
    concerns: [
      { dimension: 'security', severity: 'high', finding: 'no input validation on widget config', recommendation: 'validate before render' },
      { dimension: 'accessibility', severity: 'medium', finding: 'missing aria labels' },
      { dimension: 'performance', severity: 'n/a', finding: 'trivial render' }
    ]
  }, { now: '2026-06-21T16:00:00.000Z' });

  check('commit ok', res.ok === true, JSON.stringify(res));
  check('commit mode', res.mode === 'concerns-commit', res.mode);
  check('commit high_count 1', res.high_count === 1, String(res.high_count));

  const node = nodeBy(projectDir, 'II.2.a');
  check('node has concerns annotation', node.annotations && Array.isArray(node.annotations.concerns), JSON.stringify(node.annotations));
  check('concerns persisted count 3', node.annotations.concerns.length === 3);
  check('concern has dimension', node.annotations.concerns[0].dimension === 'security');
  check('concern has severity', node.annotations.concerns[0].severity === 'high');
  check('concern has finding', /input validation/.test(node.annotations.concerns[0].finding));
  check('concern has recorded_at', node.annotations.concerns[0].recorded_at === '2026-06-21T16:00:00.000Z');
  check('high-severity → recommends /ovd-plan idea', /\/ovd-plan idea/.test(res.text));
  check('text names the high finding', /input validation/.test(res.text));
  cleanup(tmpRoot);
})();

// --- COMMIT: no high → no idea recommendation ---------------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('commit-nohigh');
  const res = applyConcerns(projectDir, {
    node_id: 'II.2.a',
    concerns: [{ dimension: 'observability', severity: 'low', finding: 'add a debug log' }]
  }, { now: '2026-06-21T16:00:00.000Z' });
  check('nohigh ok', res.ok === true);
  check('nohigh high_count 0', res.high_count === 0);
  check('nohigh no idea recommendation', !/\/ovd-plan idea/.test(res.text));
  cleanup(tmpRoot);
})();

// --- COMMIT: re-review replaces prior concerns --------------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('rereview');
  applyConcerns(projectDir, { node_id: 'II.2.a', concerns: [{ dimension: 'security', severity: 'high', finding: 'first pass' }] }, { now: '2026-06-21T16:00:00.000Z' });
  applyConcerns(projectDir, { node_id: 'II.2.a', concerns: [{ dimension: 'security', severity: 'low', finding: 'second pass' }] }, { now: '2026-06-21T17:00:00.000Z' });
  const node = nodeBy(projectDir, 'II.2.a');
  check('re-review replaced (not appended)', node.annotations.concerns.length === 1, JSON.stringify(node.annotations.concerns));
  check('re-review keeps latest finding', /second pass/.test(node.annotations.concerns[0].finding));
  cleanup(tmpRoot);
})();

// --- COMMIT: unknown node → no write ------------------------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('commit-badnode');
  const before = readPlan(projectDir);
  const res = applyConcerns(projectDir, { node_id: 'GHOST.9', concerns: [{ dimension: 'security', severity: 'high', finding: 'f' }] }, {});
  check('bad node → not ok', res.ok === false);
  check('bad node → OVERDRIVE.md unchanged', readPlan(projectDir) === before);
  cleanup(tmpRoot);
})();

// --- COMMIT: round-trips through writer (concerns survive parse) --------
(function () {
  const { projectDir, tmpRoot } = makeProject('roundtrip');
  applyConcerns(projectDir, {
    node_id: 'II.2.a',
    concerns: [{ dimension: 'scalability', severity: 'medium', finding: 'O(n^2) layout', recommendation: 'memoize' }]
  }, { now: '2026-06-21T16:00:00.000Z' });
  // re-parse fresh and confirm structure
  const node = nodeBy(projectDir, 'II.2.a');
  check('roundtrip dimension', node.annotations.concerns[0].dimension === 'scalability');
  check('roundtrip recommendation', node.annotations.concerns[0].recommendation === 'memoize');
  cleanup(tmpRoot);
})();

// --- dispatch -----------------------------------------------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('dispatch');
  const plan = runLogConcerns(projectDir, {});
  check('dispatch → plan', plan.mode === 'plan');
  const commit = runLogConcerns(projectDir, { entries: { node_id: 'II.2.a', concerns: [{ dimension: 'security', severity: 'low', finding: 'f' }] }, now: '2026-06-21T16:00:00.000Z' });
  check('dispatch entries → commit', commit.mode === 'concerns-commit');
  check('dispatch invalid project dir', runLogConcerns(null, {}).ok === false);
  cleanup(tmpRoot);
})();

// --- migration-compat seam (Pattern 5) ----------------------------------
(function () {
  const { projectDir, tmpRoot } = makeProject('migrate-seam');
  // existing annotation on the node (scope) must survive a concerns write.
  const res = applyConcerns(projectDir, {
    node_id: 'II.2.a',
    concerns: [{ dimension: 'security', severity: 'medium', finding: 'review auth' }]
  }, { now: '2026-06-21T16:00:00.000Z' });
  check('migrate-seam ok', res.ok === true);
  const node = nodeBy(projectDir, 'II.2.a');
  check('migrate-seam preserved existing scope annotation', node.annotations.scope && Array.isArray(node.annotations.scope.in) && node.annotations.scope.in.includes('src/widget.js'), JSON.stringify(node.annotations));
  check('migrate-seam added concerns alongside scope', Array.isArray(node.annotations.concerns) && node.annotations.concerns.length === 1);
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
