#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  CACHE_FILE,
  CACHE_VERSION,
  cachePath,
  loadCache,
  saveCache,
  regenerateCacheFrom,
  flattenForCache,
  summarizeChildren,
  findNodeById,
  closureCheck,
  isNodeClosed
} = require('../lib/ovd-plan/cache');

const { parseOverdriveMd } = require('../lib/ovd-plan/parser');

const FIXTURES = path.join(__dirname, 'fixtures', 'ovd-plan');
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
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-cache-test-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}');
  fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
  return { projectDir, tmpRoot };
}

function cleanup(tmpRoot) {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

function readFixture(name) {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf8');
}

function buildSimpleTree() {
  // Root → I (done) → I.1 (done), I.2 (pending)
  //      → II (in-progress) → II.1 (done), II.2 (pending)
  return {
    id: '',
    depth: 1,
    title: 'Test',
    status: null,
    active: false,
    explicitId: null,
    description: null,
    annotations: null,
    children: [
      {
        id: 'I',
        depth: 2,
        title: 'M1',
        status: 'done',
        active: false,
        explicitId: 'I',
        description: null,
        annotations: null,
        children: [
          {
            id: 'I.1',
            depth: 3,
            title: 'F1',
            status: 'done',
            active: false,
            explicitId: 'I.1',
            description: null,
            annotations: null,
            children: []
          },
          {
            id: 'I.2',
            depth: 3,
            title: 'F2',
            status: 'done',
            active: false,
            explicitId: 'I.2',
            description: null,
            annotations: null,
            children: []
          }
        ]
      },
      {
        id: 'II',
        depth: 2,
        title: 'M2',
        status: 'in-progress',
        active: false,
        explicitId: 'II',
        description: null,
        annotations: null,
        children: [
          {
            id: 'II.1',
            depth: 3,
            title: 'F1',
            status: 'done',
            active: false,
            explicitId: 'II.1',
            description: null,
            annotations: null,
            children: []
          },
          {
            id: 'II.2',
            depth: 3,
            title: 'F2',
            status: 'pending',
            active: false,
            explicitId: 'II.2',
            description: null,
            annotations: null,
            children: []
          }
        ]
      }
    ]
  };
}

console.log('ovd-plan cache tests');

// --- loadCache: missing returns null ---
{
  const { projectDir, tmpRoot } = makeTempProject('load-missing');
  try {
    check('load: missing → null', loadCache(projectDir) === null);
  } finally {
    cleanup(tmpRoot);
  }
}

// --- saveCache then loadCache round-trips ---
{
  const { projectDir, tmpRoot } = makeTempProject('save-load');
  try {
    const tree = buildSimpleTree();
    saveCache(projectDir, { frontmatter: { project: 'X' }, tree, sections: {} });
    const loaded = loadCache(projectDir);
    check('save-load: loaded not null', loaded !== null);
    check('save-load: version matches', loaded.version === CACHE_VERSION);
    check('save-load: frontmatter preserved', loaded.frontmatter.project === 'X');
    check('save-load: tree root id', loaded.tree.id === '');
    check('save-load: tree has 2 milestones', loaded.tree.children.length === 2);
  } finally {
    cleanup(tmpRoot);
  }
}

// --- saveCache atomic (no .tmp leftover on success) ---
{
  const { projectDir, tmpRoot } = makeTempProject('save-atomic');
  try {
    saveCache(projectDir, { frontmatter: {}, tree: buildSimpleTree(), sections: {} });
    check(
      'save-atomic: no .tmp leftover',
      !fs.existsSync(cachePath(projectDir) + '.tmp')
    );
    check(
      'save-atomic: cache file exists',
      fs.existsSync(cachePath(projectDir))
    );
  } finally {
    cleanup(tmpRoot);
  }
}

// --- loadCache with stale version returns null ---
{
  const { projectDir, tmpRoot } = makeTempProject('stale-version');
  try {
    fs.writeFileSync(
      cachePath(projectDir),
      JSON.stringify({ version: 99, frontmatter: {}, tree: {} })
    );
    check('stale: version mismatch → null', loadCache(projectDir) === null);
  } finally {
    cleanup(tmpRoot);
  }
}

// --- regenerateCacheFrom: parses OVERDRIVE.md and writes cache ---
{
  const { projectDir, tmpRoot } = makeTempProject('regen');
  try {
    fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), readFixture('complete.md'));
    const result = regenerateCacheFrom(projectDir);
    check('regen: returns path', typeof result.path === 'string');
    check('regen: cache file written', fs.existsSync(result.path));

    const loaded = loadCache(projectDir);
    check('regen: tree matches fixture (milestone count)', loaded.tree.children.length === 3);
    check(
      'regen: II.2.a status awaiting-review',
      loaded.tree.children[1].children[1].children[0].status === 'awaiting-review'
    );
  } finally {
    cleanup(tmpRoot);
  }
}

// --- regenerateCacheFrom: missing file throws ---
{
  const { projectDir, tmpRoot } = makeTempProject('regen-missing');
  try {
    let threw = false;
    try {
      regenerateCacheFrom(projectDir);
    } catch (err) {
      threw = err instanceof Error && /not found/i.test(err.message);
    }
    check('regen: missing OVERDRIVE.md throws', threw === true);
  } finally {
    cleanup(tmpRoot);
  }
}

// --- summarizeChildren counts statuses ---
{
  const tree = buildSimpleTree();
  const m1Summary = summarizeChildren(tree.children[0]);
  check('summary: M1 total 2', m1Summary.total === 2);
  check('summary: M1 all done', m1Summary.done === 2);

  const m2Summary = summarizeChildren(tree.children[1]);
  check('summary: M2 total 2', m2Summary.total === 2);
  check('summary: M2 done 1', m2Summary.done === 1);
  check('summary: M2 pending 1', m2Summary.pending === 1);
}

// --- isNodeClosed: leaf done = closed ---
{
  const tree = buildSimpleTree();
  check('closed: leaf done', isNodeClosed(tree.children[0].children[0]) === true);
  check('closed: leaf pending', isNodeClosed(tree.children[1].children[1]) === false);
  check(
    'closed: container all-done = closed',
    isNodeClosed(tree.children[0]) === true
  );
  check(
    'closed: container mixed = not closed',
    isNodeClosed(tree.children[1]) === false
  );
}

// --- findNodeById ---
{
  const tree = buildSimpleTree();
  const found = findNodeById(tree, 'II.1');
  check('find: II.1 found', found && found.node.id === 'II.1');
  check('find: II.1 parents length 2', found && found.parents.length === 2);
  check(
    'find: II.1 parent chain root → II',
    found && found.parents[0].id === '' && found.parents[1].id === 'II'
  );

  const notFound = findNodeById(tree, 'X.Y.Z');
  check('find: not found returns null', notFound === null);
}

// --- closureCheck: closes parent when all siblings done ---
{
  const tree = buildSimpleTree();
  // I.2 is done, all of I.1, I.2 done → closing I.2 makes I a candidate
  const result = closureCheck(tree, 'I.2');
  check('closure I.2: closures includes I', result.closures.some((c) => c.id === 'I'));
  check(
    'closure I.2: stops at root level (open sibling II in-progress)',
    result.reason === 'open-siblings' && result.stops_at && result.stops_at.id === '(root)'
  );
}

// --- closureCheck: does not close parent with pending sibling ---
{
  const tree = buildSimpleTree();
  // II.1 is done, II.2 is pending → closing II.1 does not close II
  const result = closureCheck(tree, 'II.1');
  check(
    'closure II.1: no closures (II.2 still pending)',
    result.closures.length === 0
  );
  check(
    'closure II.1: stops at II (open siblings)',
    result.stops_at && result.stops_at.id === 'II'
  );
}

// --- closureCheck: full walk to root when everything done ---
{
  const tree = buildSimpleTree();
  tree.children[1].children[1].status = 'done';
  tree.children[1].status = 'done';
  const result = closureCheck(tree, 'II.2');
  check(
    'closure all done: closures include II and root',
    result.closures.some((c) => c.id === 'II') &&
      result.closures.some((c) => c.id === '(root)')
  );
  check('closure all done: reached-root', result.reason === 'reached-root');
}

// --- closureCheck: node not found ---
{
  const tree = buildSimpleTree();
  const result = closureCheck(tree, 'nonexistent');
  check('closure not-found: empty closures', result.closures.length === 0);
  check('closure not-found: reason', result.reason === 'node-not-found');
}

// --- flattenForCache produces summary on each container ---
{
  const flat = flattenForCache(buildSimpleTree());
  check('flatten: root summary present', !!flat.summary);
  check('flatten: root has 2 children counted', flat.summary.total === 2);
  check('flatten: I summary correct', flat.children[0].summary.done === 2);
  check('flatten: leaf has summary too (empty children)', flat.children[0].children[0].summary.total === 0);
}

// --- Summary ---
console.log('');
if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${failures.length + passed} checks:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`${passed} checks passed.`);
