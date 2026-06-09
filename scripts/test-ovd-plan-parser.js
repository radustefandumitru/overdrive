#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const {
  parseOverdriveMd,
  parseFrontmatter,
  extractManagedSections,
  parseTree,
  parseHeaderText,
  generateNodeId,
  generateIdSegment,
  toRoman,
  ParseError
} = require('../lib/ovd-plan/parser');

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

function expectThrow(label, fn, matcher) {
  let threw = null;
  try {
    fn();
  } catch (err) {
    threw = err;
  }
  if (!threw) {
    failures.push(`${label}: expected throw, none happened`);
    console.log(`FAIL ${label}: no throw`);
    return;
  }
  if (matcher && !matcher(threw)) {
    failures.push(`${label}: throw mismatch (got: ${threw.message})`);
    console.log(`FAIL ${label}: ${threw.message}`);
    return;
  }
  passed += 1;
  if (verbose) console.log(`PASS ${label} (threw: ${threw.message})`);
}

console.log('ovd-plan parser tests');

// --- Roman numeral helper ---
{
  check('roman: 1 = I', toRoman(1) === 'I');
  check('roman: 4 = IV', toRoman(4) === 'IV');
  check('roman: 9 = IX', toRoman(9) === 'IX');
  check('roman: 14 = XIV', toRoman(14) === 'XIV');
}

// --- ID segment generation ---
{
  check('seg: depth 2 idx 1 = I', generateIdSegment(2, 1) === 'I');
  check('seg: depth 2 idx 3 = III', generateIdSegment(2, 3) === 'III');
  check('seg: depth 3 idx 2 = 2', generateIdSegment(3, 2) === '2');
  check('seg: depth 4 idx 1 = a', generateIdSegment(4, 1) === 'a');
  check('seg: depth 4 idx 3 = c', generateIdSegment(4, 3) === 'c');
  check('seg: depth 5 idx 2 = ii', generateIdSegment(5, 2) === 'ii');
  check('seg: depth 6 idx 1 = A', generateIdSegment(6, 1) === 'A');
}

// --- generateNodeId ---
{
  check('id: root depth 1 = empty', generateNodeId('', 1, 1) === '');
  check('id: milestone "I"', generateNodeId('', 2, 1) === 'I');
  check('id: feature "I.1"', generateNodeId('I', 3, 1) === 'I.1');
  check('id: task "II.3.b"', generateNodeId('II.3', 4, 2) === 'II.3.b');
  check('id: subtask "II.3.b.iii"', generateNodeId('II.3.b', 5, 3) === 'II.3.b.iii');
}

// --- parseHeaderText: various forms ---
{
  const r = parseHeaderText('I. Foundation [done]');
  check('header: I. Foundation [done] - id', r.explicitId === 'I');
  check('header: I. Foundation [done] - title', r.title === 'Foundation');
  check('header: I. Foundation [done] - status', r.status === 'done');
  check('header: I. Foundation [done] - not active', r.active === false);
}
{
  const r = parseHeaderText('II.2.a Widget layout design [awaiting-review] ← ACTIVE');
  check('header: II.2.a active - id', r.explicitId === 'II.2.a');
  check('header: II.2.a active - title', r.title === 'Widget layout design');
  check('header: II.2.a active - status', r.status === 'awaiting-review');
  check('header: II.2.a active - active', r.active === true);
}
{
  const r = parseHeaderText('I.1 Project scaffolding [done]');
  check('header: I.1 - id', r.explicitId === 'I.1');
  check('header: I.1 - title', r.title === 'Project scaffolding');
}
{
  const r = parseHeaderText('Foundation');
  check('header: no id - explicitId null', r.explicitId === null);
  check('header: no id - title', r.title === 'Foundation');
  check('header: no id - status default pending', r.status === 'pending');
}
{
  const r = parseHeaderText('III.1 Empty status []');
  check('header: empty brackets - status pending', r.status === 'pending');
}

// --- Frontmatter ---
{
  const { frontmatter, body } = parseFrontmatter('---\nfoo: bar\n---\n# Body\n');
  check('fm: parsed foo', frontmatter && frontmatter.foo === 'bar');
  check('fm: body starts with header', body.trim().startsWith('# Body'));
}
{
  const { frontmatter, body } = parseFrontmatter('# No frontmatter\n');
  check('fm: missing - frontmatter null', frontmatter === null);
  check('fm: missing - body preserved', body.startsWith('# No'));
}
expectThrow(
  'fm: unclosed throws',
  () => parseFrontmatter('---\nfoo: bar\n# Body\n'),
  (e) => e instanceof ParseError && /never closes/i.test(e.message)
);
expectThrow(
  'fm: malformed YAML throws',
  () => parseFrontmatter('---\nfoo: [unclosed\n---\n'),
  (e) => e instanceof ParseError && /frontmatter/i.test(e.message)
);

// --- Managed sections extraction ---
{
  const body =
    '# Title\n\n' +
    '<!-- ovd-plan:inbox:start -->\n' +
    '- item 1\n' +
    '<!-- ovd-plan:inbox:end -->\n\n' +
    '## I. Milestone []\n';
  const { sections, body: stripped } = extractManagedSections(body);
  check('managed: inbox extracted', sections.inbox === '- item 1');
  check('managed: body has milestone', stripped.includes('## I.'));
  check('managed: body has no markers', !stripped.includes('ovd-plan:inbox'));
}
{
  // Multiple sections
  const body =
    '<!-- ovd-plan:capture:start -->\nlog 1\n<!-- ovd-plan:capture:end -->\n' +
    '<!-- ovd-plan:concerns:start -->\nconcern 1\n<!-- ovd-plan:concerns:end -->';
  const { sections } = extractManagedSections(body);
  check('managed: multiple - capture', sections.capture === 'log 1');
  check('managed: multiple - concerns', sections.concerns === 'concern 1');
}
expectThrow(
  'managed: unclosed throws',
  () => extractManagedSections('<!-- ovd-plan:inbox:start -->\nfoo\n'),
  (e) => e instanceof ParseError && /no end marker/i.test(e.message)
);

// --- parseOverdriveMd: minimal.md fixture ---
{
  const result = parseOverdriveMd(readFixture('minimal.md'));
  check('minimal: frontmatter project', result.frontmatter.project === 'Minimal Project');
  check('minimal: root title', result.tree.title === 'Minimal Project');
  check('minimal: 1 child', result.tree.children.length === 1);
  check('minimal: child id I', result.tree.children[0].id === 'I');
  check('minimal: child title', result.tree.children[0].title === 'First milestone');
  check('minimal: child status pending', result.tree.children[0].status === 'pending');
}

// --- parseOverdriveMd: complete.md fixture ---
{
  const result = parseOverdriveMd(readFixture('complete.md'));
  check(
    'complete: frontmatter project',
    result.frontmatter.project === 'Foo Dashboard'
  );
  check(
    'complete: active_node',
    result.frontmatter.active_node === 'II.2.a'
  );
  check('complete: 3 milestones', result.tree.children.length === 3);
  check(
    'complete: milestone I id',
    result.tree.children[0].id === 'I'
  );
  check(
    'complete: milestone I title',
    result.tree.children[0].title === 'Foundation'
  );
  check(
    'complete: milestone I status done',
    result.tree.children[0].status === 'done'
  );
  check(
    'complete: milestone I has annotations',
    result.tree.children[0].annotations !== null
  );
  check(
    'complete: milestone I skills',
    Array.isArray(result.tree.children[0].annotations.skills) &&
      result.tree.children[0].annotations.skills.includes('planning-first')
  );
  check(
    'complete: milestone I confidence',
    result.tree.children[0].annotations.confidence === 'high'
  );
  check(
    'complete: milestone I has 3 children',
    result.tree.children[0].children.length === 3
  );
  check(
    'complete: I.3 id',
    result.tree.children[0].children[2].id === 'I.3'
  );

  const milestoneII = result.tree.children[1];
  check('complete: II id', milestoneII.id === 'II');
  check('complete: II status', milestoneII.status === 'in-progress');
  check('complete: II has 3 features', milestoneII.children.length === 3);

  const II2 = milestoneII.children[1];
  check('complete: II.2 id', II2.id === 'II.2');
  check('complete: II.2.a child', II2.children[0].id === 'II.2.a');
  check('complete: II.2.a active', II2.children[0].active === true);
  check(
    'complete: II.2.a status awaiting-review',
    II2.children[0].status === 'awaiting-review'
  );
  check(
    'complete: II.2.a has description',
    typeof II2.children[0].description === 'string' &&
      II2.children[0].description.includes('grid layout')
  );
  check(
    'complete: II.2.a success criteria length',
    II2.children[0].annotations.success.length === 3
  );
  check(
    'complete: II.2.a scope.in length',
    II2.children[0].annotations.scope.in.length === 2
  );
  check(
    'complete: II.2.a deps',
    II2.children[0].annotations.deps[0] === 'II.1'
  );
  check(
    'complete: II.2.a references.sketches',
    II2.children[0].annotations.references.sketches.length === 1
  );
  check(
    'complete: II.2.b pending status',
    II2.children[1].status === 'pending'
  );
}

// --- parseOverdriveMd: deep-tree.md fixture ---
{
  const result = parseOverdriveMd(readFixture('deep-tree.md'));
  let node = result.tree;
  const expectedIds = ['', 'I', 'I.1', 'I.1.a', 'I.1.a.i', 'I.1.a.i.A'];
  for (const expectedId of expectedIds) {
    check(
      `deep-tree: node at depth has id "${expectedId}"`,
      node.id === expectedId,
      `got "${node.id}"`
    );
    if (node.children.length > 0) {
      node = node.children[0];
    }
  }
}

// --- parseOverdriveMd: managed-sections.md fixture ---
{
  const result = parseOverdriveMd(readFixture('managed-sections.md'));
  check('managed-fixture: inbox present', typeof result.sections.inbox === 'string');
  check(
    'managed-fixture: inbox content',
    result.sections.inbox.includes('Consider dark mode')
  );
  check(
    'managed-fixture: capture present',
    typeof result.sections.capture === 'string'
  );
  check(
    'managed-fixture: concerns present',
    typeof result.sections.concerns === 'string'
  );
  check(
    'managed-fixture: deliberation-state present',
    typeof result.sections['deliberation-state'] === 'string'
  );
  check(
    'managed-fixture: archive present',
    typeof result.sections.archive === 'string'
  );
  check(
    'managed-fixture: tree has milestone (managed sections stripped)',
    result.tree.children.length === 1
  );
}

// --- parseOverdriveMd: descriptions + untagged code blocks ---
{
  const result = parseOverdriveMd(readFixture('with-descriptions-and-codeblocks.md'));
  const milestone = result.tree.children[0];
  check(
    'desc: description present',
    typeof milestone.description === 'string' && milestone.description.length > 0
  );
  check(
    'desc: untagged yaml block preserved in description',
    milestone.description.includes('this: is')
  );
  check(
    'desc: untagged js block preserved in description',
    milestone.description.includes('console.log')
  );
  check(
    'desc: ovd-plan annotation extracted',
    milestone.annotations && milestone.annotations.confidence === 'medium'
  );
  check(
    'desc: annotation skills correct',
    milestone.annotations.skills[0] === 'planning-first'
  );
}

// --- Negative: malformed YAML in ovd-plan block ---
expectThrow(
  'malformed-yaml: throws ParseError',
  () => parseOverdriveMd(readFixture('malformed-yaml.md')),
  (e) => e instanceof ParseError && /malformed yaml/i.test(e.message)
);

// --- Negative: invalid status ---
expectThrow(
  'invalid-status: throws ParseError',
  () => parseOverdriveMd(readFixture('invalid-status.md')),
  (e) => e instanceof ParseError && /invalid status/i.test(e.message)
);

// --- Negative: multiple H1 ---
expectThrow(
  'multiple-h1: throws ParseError',
  () => parseOverdriveMd(readFixture('multiple-h1.md')),
  (e) => e instanceof ParseError && /multiple h1/i.test(e.message)
);

// --- Negative: malformed YAML directly (programmatic) ---
expectThrow(
  'malformed annotation - direct',
  () =>
    parseOverdriveMd(
      '---\nfoo: 1\n---\n# Root\n## I. Bad []\n```yaml ovd-plan\nfoo: [unclosed\n```\n'
    ),
  (e) => e instanceof ParseError && /malformed yaml/i.test(e.message)
);

// --- Invalid confidence value ---
expectThrow(
  'invalid confidence value',
  () =>
    parseOverdriveMd(
      '---\nfoo: 1\n---\n# Root\n## I. X []\n```yaml ovd-plan\nconfidence: super-high\n```\n'
    ),
  (e) => e instanceof ParseError && /confidence/i.test(e.message)
);

// --- skills must be array ---
expectThrow(
  'skills must be array',
  () =>
    parseOverdriveMd(
      '---\nfoo: 1\n---\n# Root\n## I. X []\n```yaml ovd-plan\nskills: "not-an-array"\n```\n'
    ),
  (e) => e instanceof ParseError && /skills must be an array/i.test(e.message)
);

// --- Empty annotation block is OK (annotations={}) ---
{
  const result = parseOverdriveMd(
    '---\nfoo: 1\n---\n# Root\n## I. Empty annotation []\n```yaml ovd-plan\n```\n'
  );
  check(
    'empty annotation block: annotations is empty object or null',
    result.tree.children[0].annotations !== undefined
  );
}

// --- Missing annotation entirely: annotations remain null ---
{
  const result = parseOverdriveMd(
    '---\nfoo: 1\n---\n# Root\n## I. No annotation []\n'
  );
  check(
    'no annotation: annotations null',
    result.tree.children[0].annotations === null
  );
  check(
    'no annotation: status defaults pending',
    result.tree.children[0].status === 'pending'
  );
}

// --- Active marker without status ---
{
  const result = parseOverdriveMd(
    '---\nfoo: 1\n---\n# Root\n## I. Just active [] ← ACTIVE\n'
  );
  check('active no status: active=true', result.tree.children[0].active === true);
  check(
    'active no status: status pending',
    result.tree.children[0].status === 'pending'
  );
}

// --- Sibling-index id generation in sequence ---
{
  const result = parseOverdriveMd(
    '---\nfoo: 1\n---\n' +
      '# Root\n' +
      '## I. One []\n' +
      '## II. Two []\n' +
      '## III. Three []\n'
  );
  check('seq: I exists', result.tree.children[0].id === 'I');
  check('seq: II exists', result.tree.children[1].id === 'II');
  check('seq: III exists', result.tree.children[2].id === 'III');
}

// --- Summary ---
console.log('');
if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${failures.length + passed} checks:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`${passed} checks passed.`);
