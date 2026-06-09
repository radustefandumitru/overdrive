#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const { parseOverdriveMd } = require('../lib/ovd-plan/parser');
const {
  writeOverdriveMd,
  writeFrontmatter,
  writeTree,
  writeAnnotations,
  writeManagedSections,
  reorderObject,
  reorderAnnotations,
  FRONTMATTER_KEY_ORDER,
  ANNOTATION_KEY_ORDER
} = require('../lib/ovd-plan/writer');

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

function readFixture(name) {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf8');
}

function treesEquivalent(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!treesEquivalent(a[i], b[i])) return false;
    }
    return true;
  }
  const keysA = Object.keys(a).filter((k) => k !== 'lineNumber');
  const keysB = Object.keys(b).filter((k) => k !== 'lineNumber');
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (!keysB.includes(k)) return false;
    if (!treesEquivalent(a[k], b[k])) return false;
  }
  return true;
}

function diffPath(a, b, prefix = '') {
  if (treesEquivalent(a, b)) return null;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) {
    return `${prefix}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
  }
  const keysA = Object.keys(a).filter((k) => k !== 'lineNumber');
  const keysB = Object.keys(b).filter((k) => k !== 'lineNumber');
  const allKeys = new Set([...keysA, ...keysB]);
  for (const k of allKeys) {
    const sub = diffPath(a[k], b[k], `${prefix}.${k}`);
    if (sub) return sub;
  }
  return `${prefix}: structural`;
}

function roundTripCheck(label, fixture) {
  const input = readFixture(fixture);
  const parsed1 = parseOverdriveMd(input);
  const written = writeOverdriveMd(parsed1);
  let parsed2;
  try {
    parsed2 = parseOverdriveMd(written);
  } catch (err) {
    check(`${label}: re-parse threw: ${err.message}`, false);
    return;
  }
  const equivalent = treesEquivalent(parsed1, parsed2);
  if (!equivalent) {
    const diff = diffPath(parsed1, parsed2);
    check(`${label}: round-trip equivalent`, false, `diff at ${diff}`);
    if (verbose) {
      console.error('--- written output ---');
      console.error(written);
      console.error('----------------------');
    }
    return;
  }
  check(`${label}: round-trip equivalent`, true);
}

console.log('ovd-plan writer tests');

// --- reorderObject preserves order for known keys, appends unknowns ---
{
  const result = reorderObject(
    { custom: 1, project: 'X', 'ovd-plan': true, version: 3 },
    FRONTMATTER_KEY_ORDER
  );
  const keys = Object.keys(result);
  check('reorder: ovd-plan first', keys[0] === 'ovd-plan');
  check('reorder: version second', keys[1] === 'version');
  check('reorder: project third', keys[2] === 'project');
  check('reorder: custom last (preserved)', keys[3] === 'custom');
}

// --- reorderAnnotations orders nested scope/verify/references ---
{
  const ann = {
    confidence: 'high',
    skills: ['a', 'b'],
    inserted_by: 'user',
    scope: { out: ['x'], in: ['y'], read_only: ['z'] }
  };
  const result = reorderAnnotations(ann);
  const keys = Object.keys(result);
  check('reorder ann: inserted_by first', keys[0] === 'inserted_by');
  check('reorder ann: skills before confidence', keys.indexOf('skills') < keys.indexOf('confidence'));
  const scopeKeys = Object.keys(result.scope);
  check('reorder scope: in first', scopeKeys[0] === 'in');
  check('reorder scope: read_only second', scopeKeys[1] === 'read_only');
  check('reorder scope: out third', scopeKeys[2] === 'out');
}

// --- writeFrontmatter renders --- delimiters ---
{
  const out = writeFrontmatter({ 'ovd-plan': true, project: 'X' });
  check('fm write: starts with ---', out.startsWith('---\n'));
  check('fm write: ends with ---', out.trim().endsWith('---'));
  check('fm write: contains project', out.includes('project: X'));
}

// --- writeAnnotations: empty object → empty block ---
{
  const out = writeAnnotations({});
  check('ann write: empty → empty block', out === '```yaml ovd-plan\n```');
}

// --- writeAnnotations: null → empty string ---
{
  const out = writeAnnotations(null);
  check('ann write: null → empty string', out === '');
}

// --- writeManagedSections: ordered ---
{
  const out = writeManagedSections({
    archive: 'arc',
    inbox: 'in',
    decisions: 'dec'
  });
  const decIdx = out.indexOf('decisions:');
  const inIdx = out.indexOf('inbox:');
  const arcIdx = out.indexOf('archive:');
  check('managed write: decisions before inbox', decIdx < inIdx);
  check('managed write: inbox before archive', inIdx < arcIdx);
}

// --- Round-trip fixtures ---
roundTripCheck('round-trip: minimal', 'minimal.md');
roundTripCheck('round-trip: complete', 'complete.md');
roundTripCheck('round-trip: deep-tree', 'deep-tree.md');
roundTripCheck('round-trip: managed-sections', 'managed-sections.md');
roundTripCheck('round-trip: with-descriptions', 'with-descriptions-and-codeblocks.md');

// --- Stability (write twice produces identical output) ---
{
  const parsed = parseOverdriveMd(readFixture('complete.md'));
  const w1 = writeOverdriveMd(parsed);
  const w2 = writeOverdriveMd(parseOverdriveMd(w1));
  check('stability: write twice produces identical output', w1 === w2);
}

// --- Status markers: pending uses [] ---
{
  const tree = {
    id: '',
    depth: 1,
    title: 'Root',
    status: null,
    active: false,
    description: null,
    annotations: null,
    children: [
      {
        id: 'I',
        depth: 2,
        explicitId: 'I',
        title: 'First',
        status: 'pending',
        active: false,
        description: null,
        annotations: null,
        children: []
      }
    ]
  };
  const out = writeTree(tree);
  check('status: pending → []', out.includes('## I. First []'));
}

// --- ACTIVE marker rendered when active=true ---
{
  const tree = {
    id: '',
    depth: 1,
    title: 'Root',
    status: null,
    active: false,
    description: null,
    annotations: null,
    children: [
      {
        id: 'I',
        depth: 2,
        explicitId: 'I',
        title: 'Active one',
        status: 'awaiting-review',
        active: true,
        description: null,
        annotations: null,
        children: []
      }
    ]
  };
  const out = writeTree(tree);
  check(
    'active marker: rendered',
    out.includes('[awaiting-review] ← ACTIVE')
  );
}

// --- Roundtrip: a programmatically built tree without explicitId still emits a usable header ---
{
  const tree = {
    id: '',
    depth: 1,
    title: 'No-ID Root',
    status: null,
    active: false,
    description: null,
    annotations: null,
    children: [
      {
        id: 'I',
        depth: 2,
        explicitId: null,
        title: 'Auto-id only',
        status: 'pending',
        active: false,
        description: null,
        annotations: null,
        children: []
      }
    ]
  };
  const out = writeOverdriveMd({ frontmatter: { 'ovd-plan': true }, tree, sections: {} });
  const reparsed = parseOverdriveMd(out);
  check(
    'no-explicit-id: round-trips with id=I from position',
    reparsed.tree.children[0].id === 'I'
  );
}

// --- Description preserved through round-trip including untagged code blocks ---
{
  const input = readFixture('with-descriptions-and-codeblocks.md');
  const parsed1 = parseOverdriveMd(input);
  const written = writeOverdriveMd(parsed1);
  const parsed2 = parseOverdriveMd(written);
  check(
    'desc round-trip: description contains untagged yaml',
    parsed2.tree.children[0].description.includes('this: is')
  );
  check(
    'desc round-trip: description contains js block',
    parsed2.tree.children[0].description.includes('console.log')
  );
  check(
    'desc round-trip: annotation preserved',
    parsed2.tree.children[0].annotations.confidence === 'medium'
  );
}

// --- Summary ---
console.log('');
if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${failures.length + passed} checks:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`${passed} checks passed.`);
