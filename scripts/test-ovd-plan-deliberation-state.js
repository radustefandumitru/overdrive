#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const deliberationState = require('../lib/ovd-plan/deliberation-state');
const {
  DELIBERATION_STATE_KEY,
  planPath,
  parseInnerYaml,
  dumpInnerYaml,
  openState,
  commitState,
  readDeliberationState
} = deliberationState;

const { parseOverdriveMd } = require('../lib/ovd-plan/parser');

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
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-ds-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
  return { projectDir, tmpRoot };
}

function cleanup(tmpRoot) {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

function writePlan(projectDir, content) {
  fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), content);
}

function readPlan(projectDir) {
  return fs.readFileSync(path.join(projectDir, 'OVERDRIVE.md'), 'utf8');
}

const FRONT = '---\novd-plan: true\nversion: 3\nproject: "Test Project"\n---\n\n';

const FIXTURE_NO_BLOCK = `${FRONT}# Test Project

## I. Foundation [pending]
`;

const FIXTURE_BLOCK_WITH_CAL = `${FRONT}# Test Project

## I. Foundation [pending]

<!-- ovd-plan:deliberation-state:start -->
stage: elicit
turn_count: 3
calibration:
  domain: medium
  technical: high
  scope: low
  override: none
  updated: "2026-06-13T10:00:00.000Z"
<!-- ovd-plan:deliberation-state:end -->
`;

const FIXTURE_BLOCK_EMPTY_INNER = `${FRONT}# Test Project

## I. Foundation [pending]

<!-- ovd-plan:deliberation-state:start -->
<!-- ovd-plan:deliberation-state:end -->
`;

const FIXTURE_MALFORMED_BLOCK = `${FRONT}# Test Project

## I. Foundation [pending]

<!-- ovd-plan:deliberation-state:start -->
this: is: invalid: yaml: : :
  : : :
<!-- ovd-plan:deliberation-state:end -->
`;

const FIXTURE_MALFORMED_MD = `---
not closed yaml frontmatter
# bad
`;

// ---------- Module surface ----------
console.log('deliberation-state module surface');
check('exports DELIBERATION_STATE_KEY', typeof DELIBERATION_STATE_KEY === 'string');
check('exports planPath', typeof planPath === 'function');
check('exports parseInnerYaml', typeof parseInnerYaml === 'function');
check('exports dumpInnerYaml', typeof dumpInnerYaml === 'function');
check('exports openState', typeof openState === 'function');
check('exports commitState', typeof commitState === 'function');
check('exports readDeliberationState', typeof readDeliberationState === 'function');
check('seven public exports', Object.keys(deliberationState).length === 7);

// ---------- Constants ----------
console.log('constants');
check('DELIBERATION_STATE_KEY value is "deliberation-state"', DELIBERATION_STATE_KEY === 'deliberation-state');

// ---------- planPath ----------
console.log('planPath');
{
  const p = planPath('/tmp/some-project');
  check('planPath joins OVERDRIVE.md', p.endsWith(path.join('/tmp/some-project', 'OVERDRIVE.md')));
  check('planPath returns absolute joined path', p === path.join('/tmp/some-project', 'OVERDRIVE.md'));
}

// ---------- parseInnerYaml ----------
console.log('parseInnerYaml');
{
  check('null → empty object', JSON.stringify(parseInnerYaml(null)) === '{}');
  check('undefined → empty object', JSON.stringify(parseInnerYaml(undefined)) === '{}');
  check('empty string → empty object', JSON.stringify(parseInnerYaml('')) === '{}');
  check('whitespace-only → empty object', JSON.stringify(parseInnerYaml('   \n  \n\n')) === '{}');
  const simple = parseInnerYaml('foo: bar');
  check('simple key:value parses', simple && simple.foo === 'bar');
  const multi = parseInnerYaml('stage: elicit\nturn_count: 2');
  check('multi-key: stage', multi.stage === 'elicit');
  check('multi-key: turn_count', multi.turn_count === 2);
  const nested = parseInnerYaml('calibration:\n  domain: high\n  technical: medium\nstage: spec');
  check('nested: calibration.domain', nested.calibration.domain === 'high');
  check('nested: calibration.technical', nested.calibration.technical === 'medium');
  check('nested: sibling stage', nested.stage === 'spec');
  let threw = false;
  try { parseInnerYaml('this: is: invalid: yaml: : :\n  : : :'); } catch (e) { threw = true; }
  check('malformed YAML throws (caller catches)', threw);
}

// ---------- dumpInnerYaml ----------
console.log('dumpInnerYaml');
{
  const out = dumpInnerYaml({ foo: 'bar' });
  check('simple round-trip via parseInnerYaml', parseInnerYaml(out).foo === 'bar');
  check('no trailing whitespace', !/\s+$/.test(out));
  const out2 = dumpInnerYaml({ stage: 'elicit', turn_count: 5, calibration: { domain: 'high' } });
  check('multi-key dump includes stage', out2.includes('stage: elicit'));
  check('multi-key dump includes turn_count', out2.includes('turn_count: 5'));
  check('multi-key dump nests calibration', out2.includes('calibration:'));
  check('multi-key dump round-trips: stage', parseInnerYaml(out2).stage === 'elicit');
  check('multi-key dump round-trips: nested', parseInnerYaml(out2).calibration.domain === 'high');
  // Key order: js-yaml dumps in insertion order when noRefs+default sortKeys (we do not pass sortKeys).
  const ordered = dumpInnerYaml({ a: 1, b: 2, c: 3 });
  check('insertion order preserved: a before b', ordered.indexOf('a:') < ordered.indexOf('b:'));
  check('insertion order preserved: b before c', ordered.indexOf('b:') < ordered.indexOf('c:'));
}

// ---------- openState ----------
console.log('openState');
{
  const { projectDir, tmpRoot } = makeTempProject('open-missing');
  const result = openState(projectDir);
  check('missing file: ok=false', result.ok === false);
  check('missing file: reason=missing-plan', result.reason === 'missing-plan');
  check('missing file: text mentions OVERDRIVE.md', /OVERDRIVE\.md/.test(result.text));
  check('missing file: text mentions recovery path', /ovd-workflow init|ovd-plan deliberate/.test(result.text));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('open-no-block');
  writePlan(projectDir, FIXTURE_NO_BLOCK);
  const result = openState(projectDir);
  check('no-block: ok=true', result.ok === true);
  check('no-block: innerObj is empty', JSON.stringify(result.innerObj) === '{}');
  check('no-block: parsed exposed', !!result.parsed);
  check('no-block: sections exposed', !!result.sections);
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('open-empty-inner');
  writePlan(projectDir, FIXTURE_BLOCK_EMPTY_INNER);
  const result = openState(projectDir);
  check('empty-block inner: ok=true', result.ok === true);
  check('empty-block inner: innerObj is empty', JSON.stringify(result.innerObj) === '{}');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('open-with-cal');
  writePlan(projectDir, FIXTURE_BLOCK_WITH_CAL);
  const result = openState(projectDir);
  check('with-cal: ok=true', result.ok === true);
  check('with-cal: stage', result.innerObj.stage === 'elicit');
  check('with-cal: turn_count', result.innerObj.turn_count === 3);
  check('with-cal: calibration object', !!result.innerObj.calibration);
  check('with-cal: calibration.domain', result.innerObj.calibration.domain === 'medium');
  check('with-cal: calibration.technical', result.innerObj.calibration.technical === 'high');
  check('with-cal: sections has deliberation-state key', DELIBERATION_STATE_KEY in result.sections);
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('open-malformed-block');
  writePlan(projectDir, FIXTURE_MALFORMED_BLOCK);
  const result = openState(projectDir);
  check('malformed-block: ok=false', result.ok === false);
  check('malformed-block: reason', result.reason === 'deliberation-state-malformed');
  check('malformed-block: text mentions YAML', /YAML|yaml/.test(result.text));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('open-malformed-md');
  writePlan(projectDir, FIXTURE_MALFORMED_MD);
  const result = openState(projectDir);
  check('malformed-md: ok=false', result.ok === false);
  check('malformed-md: reason', result.reason === 'parse-error' || result.reason === 'unknown-error');
  cleanup(tmpRoot);
}

// ---------- commitState ----------
console.log('commitState');
{
  const result = commitState('/tmp/whatever', null);
  check('null opened: ok=false', result.ok === false);
  check('null opened: reason=invalid-open-state', result.reason === 'invalid-open-state');
}
{
  const { projectDir, tmpRoot } = makeTempProject('commit-roundtrip');
  writePlan(projectDir, FIXTURE_BLOCK_WITH_CAL);
  const opened = openState(projectDir);
  check('roundtrip: openState ok', opened.ok === true);
  opened.innerObj.stage = 'spec';
  opened.innerObj.turn_count = 4;
  const committed = commitState(projectDir, opened);
  check('roundtrip: commit ok', committed.ok === true);
  check('roundtrip: written flag', committed.written === true);
  // Re-open and verify mutations landed
  const reopened = openState(projectDir);
  check('roundtrip: reopen ok', reopened.ok === true);
  check('roundtrip: stage mutated', reopened.innerObj.stage === 'spec');
  check('roundtrip: turn_count mutated', reopened.innerObj.turn_count === 4);
  // Sibling preservation: calibration intact
  check('roundtrip: calibration sibling preserved (object)', !!reopened.innerObj.calibration);
  check('roundtrip: calibration.domain preserved', reopened.innerObj.calibration.domain === 'medium');
  check('roundtrip: calibration.technical preserved', reopened.innerObj.calibration.technical === 'high');
  check('roundtrip: calibration.scope preserved', reopened.innerObj.calibration.scope === 'low');
  cleanup(tmpRoot);
}
{
  // Idempotent on no-mutation: write same state twice → second write = first byte-equal
  const { projectDir, tmpRoot } = makeTempProject('commit-idempotent');
  writePlan(projectDir, FIXTURE_BLOCK_WITH_CAL);
  const opened1 = openState(projectDir);
  commitState(projectDir, opened1);
  const after1 = readPlan(projectDir);
  const opened2 = openState(projectDir);
  commitState(projectDir, opened2);
  const after2 = readPlan(projectDir);
  check('idempotent: byte-equal on no-mutation', after1 === after2);
  cleanup(tmpRoot);
}
{
  // Add a brand-new sibling field; original calibration sibling MUST stay byte-equal in inner YAML
  const { projectDir, tmpRoot } = makeTempProject('commit-add-sibling');
  writePlan(projectDir, FIXTURE_BLOCK_WITH_CAL);
  const opened = openState(projectDir);
  opened.innerObj.proposed_tree = { milestones: [{ id: 'I', title: 'Foundation', ambiguity_score: 2 }] };
  const committed = commitState(projectDir, opened);
  check('add-sibling: commit ok', committed.ok === true);
  const reopened = openState(projectDir);
  check('add-sibling: proposed_tree present', !!reopened.innerObj.proposed_tree);
  check('add-sibling: proposed_tree.milestones is array', Array.isArray(reopened.innerObj.proposed_tree.milestones));
  check('add-sibling: proposed_tree milestone id', reopened.innerObj.proposed_tree.milestones[0].id === 'I');
  // Existing siblings preserved
  check('add-sibling: stage preserved', reopened.innerObj.stage === 'elicit');
  check('add-sibling: calibration object preserved', !!reopened.innerObj.calibration);
  check('add-sibling: calibration.domain preserved', reopened.innerObj.calibration.domain === 'medium');
  cleanup(tmpRoot);
}
{
  // Commit on missing parsed/sections → reject
  const result = commitState('/tmp/whatever', { ok: true });
  check('missing parsed: ok=false', result.ok === false);
  check('missing parsed: reason=invalid-open-state', result.reason === 'invalid-open-state');
}

// ---------- readDeliberationState (read-only convenience) ----------
console.log('readDeliberationState');
{
  const { projectDir, tmpRoot } = makeTempProject('read-missing');
  check('missing file → null', readDeliberationState(projectDir) === null);
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('read-no-block');
  writePlan(projectDir, FIXTURE_NO_BLOCK);
  check('no-block → null', readDeliberationState(projectDir) === null);
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('read-with-cal');
  writePlan(projectDir, FIXTURE_BLOCK_WITH_CAL);
  const obj = readDeliberationState(projectDir);
  check('with-cal: returns object', obj && typeof obj === 'object');
  check('with-cal: has stage', obj.stage === 'elicit');
  check('with-cal: has turn_count', obj.turn_count === 3);
  check('with-cal: nested calibration', obj.calibration && obj.calibration.domain === 'medium');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('read-malformed-block');
  writePlan(projectDir, FIXTURE_MALFORMED_BLOCK);
  check('malformed block → null (silent)', readDeliberationState(projectDir) === null);
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('read-empty-inner');
  writePlan(projectDir, FIXTURE_BLOCK_EMPTY_INNER);
  // Block exists but inner is empty → null per the contract (no useful state)
  check('empty-inner → null', readDeliberationState(projectDir) === null);
  cleanup(tmpRoot);
}

// ---------- Integration: openState/mutate/commitState/readDeliberationState round-trip ----------
console.log('integration round-trip');
{
  const { projectDir, tmpRoot } = makeTempProject('integration');
  writePlan(projectDir, FIXTURE_NO_BLOCK);
  // Fresh project: no block. openState yields empty innerObj.
  const opened = openState(projectDir);
  check('fresh: openState ok', opened.ok === true);
  check('fresh: innerObj empty', JSON.stringify(opened.innerObj) === '{}');
  // Mutate: write a stage + turn_count
  opened.innerObj.stage = 'elicit';
  opened.innerObj.turn_count = 1;
  opened.innerObj.answered_questions = [
    { turn_id: 1, question: 'What is the primary user journey?', answer: 'Login → dashboard → action', stage_at_turn: 'elicit', timestamp: '2026-06-13T10:30:00.000Z' }
  ];
  const committed = commitState(projectDir, opened);
  check('fresh: commitState ok', committed.ok === true);
  // Re-read via readDeliberationState (convenience reader)
  const obj = readDeliberationState(projectDir);
  check('integration: readDeliberationState yields stage', obj.stage === 'elicit');
  check('integration: yields turn_count', obj.turn_count === 1);
  check('integration: yields answered_questions array', Array.isArray(obj.answered_questions));
  check('integration: answered_questions[0].turn_id', obj.answered_questions[0].turn_id === 1);
  check('integration: answered_questions[0].answer preserved', obj.answered_questions[0].answer === 'Login → dashboard → action');
  // Sanity: parser still parses the file overall
  const parsed = parseOverdriveMd(readPlan(projectDir));
  check('integration: parser handles written file', !!parsed.tree);
  check('integration: managed section is present', DELIBERATION_STATE_KEY in parsed.sections);
  cleanup(tmpRoot);
}

console.log('');
console.log(`${passed} checks passed.`);
if (failures.length) {
  console.log(`${failures.length} FAILURES`);
  process.exit(1);
}
