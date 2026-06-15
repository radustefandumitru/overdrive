'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const ovdPlan = require('../lib/ovd-plan');
const {
  STATUS,
  SESSIONS_REL,
  REPORT_FILENAME_PREFIX,
  REQUIREMENTS_REL,
  REQUIREMENT_CATEGORIES,
  VALID_CONFIDENCE,
  VALID_VERDICTS,
  REQUIRED_LEAF_FIELDS,
  parseRequirements,
  extractBullets,
  resolveTreeFromOpened,
  rollUpCommittedLeaf,
  flattenLeaves,
  checkLeafCompleteness,
  runLeafCompleteness,
  buildPlanQualityTurn,
  applyPlanQualityTurn,
  validateTrace,
  validateUncovered,
  validateMilestoneVerdicts,
  renderReport,
  runPlanQualityCheck,
  formatPlan,
  formatCommit
} = require('../lib/ovd-plan/plan-quality');

const { openState } = require('../lib/ovd-plan/deliberation-state');

let pass = 0;
let fail = 0;
function check(label, cond) {
  if (cond) { pass += 1; } else { fail += 1; console.error(`FAIL ${label}`); }
}

function makeTempProject(name) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-quality-${name}-`));
  const projectDir = path.join(tmpRoot, 'project');
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
  return { projectDir, tmpRoot };
}
function cleanup(tmpRoot) { fs.rmSync(tmpRoot, { recursive: true, force: true }); }

const FRONT = '---\novd-plan: true\nversion: 3\nproject: "Test"\n---\n\n';
const FIXED_NOW = '2026-06-14T15:00:00.000Z';

// Sample requirements file content matching Phase 2 Task 2.5 format.
const REQS_THREE_CATEGORIES = `# Requirements

## Functional
- users can sign in via SSO
- dashboard shows real-time stats
- CSV export of the audit log

## Non-functional
- p95 latency under 300ms
- WCAG AA contrast everywhere

## Out of scope
- no native mobile app for v1
`;

const REQS_FUNCTIONAL_ONLY = `# Requirements

## Functional
- req one
- req two
`;

const REQS_EMPTY_FUNCTIONAL = `# Requirements

## Functional

## Non-functional
- something
`;

function freshLeafForResolved(id) {
  return {
    id,
    title: `Leaf ${id}`,
    description: `Description for ${id}.`,
    scope: { in: [`src/${id}/`], out: [] },
    success: [`${id} works`],
    verify: { method: 'vitest', fallback: 'agent_self_check_against_success', review_required: true },
    deps: [],
    skills: ['frontend-design'],
    confidence: 'high',
    rationale: 'narrow scope',
    considered: []
  };
}

// Fixture writer: proposed_tree with N milestones × M leaves, all resolved.
function fixtureProposedTree(rootDir, milestonesDef) {
  const lines = [`${FRONT}# Project`, '', '<!-- ovd-plan:deliberation-state:start -->'];
  lines.push('stage: plan_skills');
  lines.push('proposed_tree:');
  lines.push('  milestones:');
  for (const m of milestonesDef) {
    lines.push(`    - id: "${m.id}"`);
    lines.push(`      title: "${m.title}"`);
    lines.push(`      description: "${m.description}"`);
    lines.push('      children:');
    for (const leaf of m.children) {
      const l = freshLeafForResolved(leaf.id);
      if (leaf.title) l.title = leaf.title;
      if (leaf.description) l.description = leaf.description;
      if (leaf.pending) l.pending_skill_resolution = true;
      lines.push(`        - id: "${l.id}"`);
      lines.push(`          title: "${l.title}"`);
      lines.push(`          description: "${l.description}"`);
      lines.push('          scope:');
      lines.push(`            in: ${JSON.stringify(l.scope.in)}`);
      lines.push(`            out: ${JSON.stringify(l.scope.out)}`);
      lines.push(`          success: ${JSON.stringify(l.success)}`);
      lines.push('          verify:');
      lines.push(`            method: "${l.verify.method}"`);
      lines.push(`            fallback: "${l.verify.fallback}"`);
      lines.push(`            review_required: ${l.verify.review_required}`);
      lines.push(`          deps: ${JSON.stringify(l.deps)}`);
      lines.push(`          skills: ${JSON.stringify(l.skills)}`);
      lines.push(`          confidence: "${l.confidence}"`);
      lines.push(`          rationale: "${l.rationale}"`);
      lines.push(`          considered: ${JSON.stringify(l.considered)}`);
      if (l.pending_skill_resolution) lines.push('          pending_skill_resolution: true');
    }
  }
  lines.push('  last_revision: 3');
  lines.push('current_proposal_revision: 3');
  lines.push('<!-- ovd-plan:deliberation-state:end -->');
  fs.writeFileSync(path.join(rootDir, 'OVERDRIVE.md'), lines.join('\n'));
}

function writeReqs(rootDir, content) {
  const p = path.join(rootDir, REQUIREMENTS_REL);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

// ===========================================================================
// Module surface
// ===========================================================================
console.log('module surface');
check('exports STATUS', STATUS === 'plan-quality');
check('exports SESSIONS_REL', typeof SESSIONS_REL === 'string' && SESSIONS_REL.includes('sessions'));
check('exports REPORT_FILENAME_PREFIX', REPORT_FILENAME_PREFIX === 'plan-quality');
check('exports REQUIREMENTS_REL', typeof REQUIREMENTS_REL === 'string' && REQUIREMENTS_REL.includes('requirements.md'));
check('exports REQUIREMENT_CATEGORIES (array)', Array.isArray(REQUIREMENT_CATEGORIES) && REQUIREMENT_CATEGORIES.length === 3);
check('REQUIREMENT_CATEGORIES has functional', REQUIREMENT_CATEGORIES.some((c) => c.key === 'functional'));
check('REQUIREMENT_CATEGORIES has nonFunctional', REQUIREMENT_CATEGORIES.some((c) => c.key === 'nonFunctional'));
check('REQUIREMENT_CATEGORIES has outOfScope', REQUIREMENT_CATEGORIES.some((c) => c.key === 'outOfScope'));
check('exports VALID_CONFIDENCE', VALID_CONFIDENCE.has('high') && VALID_CONFIDENCE.has('medium') && VALID_CONFIDENCE.has('low'));
check('VALID_CONFIDENCE rejects others', !VALID_CONFIDENCE.has('certain'));
check('exports VALID_VERDICTS', VALID_VERDICTS.has('pass') && VALID_VERDICTS.has('gap') && VALID_VERDICTS.has('reroute'));
check('VALID_VERDICTS rejects others', !VALID_VERDICTS.has('maybe'));
check('REQUIRED_LEAF_FIELDS array', Array.isArray(REQUIRED_LEAF_FIELDS));
check('REQUIRED_LEAF_FIELDS includes description', REQUIRED_LEAF_FIELDS.includes('description'));
check('REQUIRED_LEAF_FIELDS includes skills', REQUIRED_LEAF_FIELDS.includes('skills'));
check('REQUIRED_LEAF_FIELDS includes rationale', REQUIRED_LEAF_FIELDS.includes('rationale'));
check('REQUIRED_LEAF_FIELDS includes considered', REQUIRED_LEAF_FIELDS.includes('considered'));
check('exports parseRequirements (function)', typeof parseRequirements === 'function');
check('exports extractBullets (function)', typeof extractBullets === 'function');
check('exports resolveTreeFromOpened (function)', typeof resolveTreeFromOpened === 'function');
check('exports rollUpCommittedLeaf (function)', typeof rollUpCommittedLeaf === 'function');
check('exports flattenLeaves (function)', typeof flattenLeaves === 'function');
check('exports checkLeafCompleteness (function)', typeof checkLeafCompleteness === 'function');
check('exports runLeafCompleteness (function)', typeof runLeafCompleteness === 'function');
check('exports buildPlanQualityTurn (function)', typeof buildPlanQualityTurn === 'function');
check('exports applyPlanQualityTurn (function)', typeof applyPlanQualityTurn === 'function');
check('exports validateTrace (function)', typeof validateTrace === 'function');
check('exports validateUncovered (function)', typeof validateUncovered === 'function');
check('exports validateMilestoneVerdicts (function)', typeof validateMilestoneVerdicts === 'function');
check('exports renderReport (function)', typeof renderReport === 'function');
check('exports runPlanQualityCheck (function)', typeof runPlanQualityCheck === 'function');
check('exports formatPlan (function)', typeof formatPlan === 'function');
check('exports formatCommit (function)', typeof formatCommit === 'function');
check('ovdPlan.planQuality namespace exists', !!ovdPlan.planQuality);
check('ovdPlan.runPlanQualityCheck top-level export', typeof ovdPlan.runPlanQualityCheck === 'function');
check('ovdPlan.planQuality.STATUS === STATUS', ovdPlan.planQuality.STATUS === STATUS);

// ===========================================================================
// parseRequirements + extractBullets
// ===========================================================================
console.log('parseRequirements + extractBullets');
{
  const { projectDir, tmpRoot } = makeTempProject('reqs-missing');
  check('parseRequirements: null when file absent', parseRequirements(projectDir) === null);
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('reqs-three');
  writeReqs(projectDir, REQS_THREE_CATEGORIES);
  const r = parseRequirements(projectDir);
  check('parseRequirements: returns object', r && typeof r === 'object');
  check('parseRequirements: functional length=3', r.functional.length === 3);
  check('parseRequirements: nonFunctional length=2', r.nonFunctional.length === 2);
  check('parseRequirements: outOfScope length=1', r.outOfScope.length === 1);
  check('parseRequirements: functional[0]', r.functional[0] === 'users can sign in via SSO');
  check('parseRequirements: nonFunctional[0]', r.nonFunctional[0] === 'p95 latency under 300ms');
  check('parseRequirements: outOfScope[0]', r.outOfScope[0] === 'no native mobile app for v1');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('reqs-functional-only');
  writeReqs(projectDir, REQS_FUNCTIONAL_ONLY);
  const r = parseRequirements(projectDir);
  check('parseRequirements: missing non-functional → []', r.nonFunctional.length === 0);
  check('parseRequirements: missing out-of-scope → []', r.outOfScope.length === 0);
  check('parseRequirements: functional has items', r.functional.length === 2);
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('reqs-empty-functional');
  writeReqs(projectDir, REQS_EMPTY_FUNCTIONAL);
  const r = parseRequirements(projectDir);
  check('parseRequirements: empty functional section → []', r.functional.length === 0);
  check('parseRequirements: populated non-functional → has 1', r.nonFunctional.length === 1);
  cleanup(tmpRoot);
}
{
  // Bullet extraction: ignore blank lines + trim whitespace.
  const sample = '## Functional\n  -    item with extra spaces\n\n- item 2\n\n## Next\n- not me';
  const items = extractBullets(sample, 'Functional');
  check('extractBullets: extracts 2 items', items.length === 2);
  check('extractBullets: trims whitespace', items[0] === 'item with extra spaces');
  check('extractBullets: stops at next ##', !items.includes('not me'));
  check('extractBullets: returns [] when header absent', extractBullets(sample, 'Nope').length === 0);
}

// ===========================================================================
// resolveTreeFromOpened
// ===========================================================================
console.log('resolveTreeFromOpened');
{
  // Empty opened — no tree.
  const opened = { innerObj: {}, parsed: { tree: null } };
  const r = resolveTreeFromOpened(opened);
  check('resolve: source=null when nothing', r.source === null);
  check('resolve: milestones=[]', r.milestones.length === 0);
}
{
  // proposed_tree wins over committed.
  const opened = {
    innerObj: {
      proposed_tree: {
        milestones: [{ id: 'I', title: 'F', description: 'd', children: [] }],
        last_revision: 5
      }
    },
    parsed: {
      tree: {
        children: [
          { id: 'X', depth: 2, title: 'committed', children: [] }
        ]
      }
    }
  };
  const r = resolveTreeFromOpened(opened);
  check('resolve: source=proposed when proposed_tree present', r.source === 'proposed');
  check('resolve: uses proposed milestones', r.milestones[0].id === 'I');
  check('resolve: revision from proposed_tree', r.revision === 5);
}
{
  // Fallback to committed when proposed absent.
  const opened = {
    innerObj: {},
    parsed: {
      tree: {
        children: [
          {
            id: 'I',
            depth: 2,
            title: 'Foundation',
            description: 'desc',
            children: [
              {
                id: 'I.1',
                depth: 3,
                title: 'L',
                description: 'd',
                annotations: {
                  skills: ['frontend-design'],
                  confidence: 'high',
                  rationale: 'r',
                  considered: [],
                  scope: { in: ['src/'], out: [] },
                  success: ['x'],
                  verify: { method: 'm', fallback: 'f', review_required: true },
                  deps: []
                }
              }
            ]
          }
        ]
      }
    }
  };
  const r = resolveTreeFromOpened(opened);
  check('resolve: source=committed when fallback used', r.source === 'committed');
  check('resolve: maps depth-2 milestones', r.milestones.length === 1);
  check('resolve: maps depth-3 leaf', r.milestones[0].children.length === 1);
  check('resolve: rolls annotations onto leaf', r.milestones[0].children[0].skills[0] === 'frontend-design');
}
{
  // Committed tree but empty proposed → fall back to committed.
  const opened = {
    innerObj: { proposed_tree: { milestones: [] } },
    parsed: {
      tree: { children: [{ id: 'I', depth: 2, title: 't', description: 'd', children: [] }] }
    }
  };
  const r = resolveTreeFromOpened(opened);
  check('resolve: empty proposed → fall back to committed', r.source === 'committed');
}

// ===========================================================================
// rollUpCommittedLeaf
// ===========================================================================
console.log('rollUpCommittedLeaf');
{
  const leaf = {
    id: 'I.1',
    title: 't',
    description: 'd',
    annotations: {
      skills: ['frontend-design'],
      confidence: 'medium',
      rationale: 'reason',
      considered: ['taste'],
      scope: { in: [], out: [] },
      success: ['x'],
      verify: { method: 'm', fallback: 'f', review_required: true },
      deps: [],
      inserted_by: 'agent',
      inserted_reason: 'reason'
    }
  };
  const rolled = rollUpCommittedLeaf(leaf);
  check('rollUp: id preserved', rolled.id === 'I.1');
  check('rollUp: skills rolled up', rolled.skills[0] === 'frontend-design');
  check('rollUp: confidence rolled up', rolled.confidence === 'medium');
  check('rollUp: scope rolled up', Array.isArray(rolled.scope.in));
  check('rollUp: inserted_by rolled up', rolled.inserted_by === 'agent');
}

// ===========================================================================
// flattenLeaves
// ===========================================================================
console.log('flattenLeaves');
{
  const milestones = [
    { id: 'I', children: [{ id: 'I.1' }, { id: 'I.2' }] },
    { id: 'II', children: [{ id: 'II.1' }] }
  ];
  const flat = flattenLeaves(milestones);
  check('flatten: returns 3 entries', flat.length === 3);
  check('flatten: I.1 first', flat[0].leaf.id === 'I.1' && flat[0].milestone_id === 'I');
  check('flatten: II.1 last', flat[2].leaf.id === 'II.1' && flat[2].milestone_id === 'II');
}
{
  check('flatten: empty milestones', flattenLeaves([]).length === 0);
  check('flatten: milestone with no children', flattenLeaves([{ id: 'I' }]).length === 0);
}

// ===========================================================================
// checkLeafCompleteness
// ===========================================================================
console.log('checkLeafCompleteness');
{
  const r = checkLeafCompleteness(freshLeafForResolved('I.1'));
  check('completeness: happy passes', r.ok === true);
}
{
  const r = checkLeafCompleteness(null);
  check('completeness: null fails as invalid-leaf', r.ok === false && r.failure_kind === 'invalid-leaf');
}
{
  const r = checkLeafCompleteness([]);
  check('completeness: array fails as invalid-leaf', r.ok === false && r.failure_kind === 'invalid-leaf');
}
{
  // Q3.8.5 amplify: pending_skill_resolution=true → distinct failure_kind.
  const leaf = freshLeafForResolved('I.1');
  leaf.pending_skill_resolution = true;
  const r = checkLeafCompleteness(leaf);
  check('completeness: pending_skill_resolution → skill-resolution-skipped', r.ok === false && r.failure_kind === 'skill-resolution-skipped');
  check('completeness: skill-resolution-skipped mentions Slice B', /Stage 5\.5|RESOLVE SKILLS/.test(r.message));
}
{
  const leaf = freshLeafForResolved('I.1');
  delete leaf.skills;
  const r = checkLeafCompleteness(leaf);
  check('completeness: missing skills → missing-fields', r.ok === false && r.failure_kind === 'missing-fields');
  check('completeness: missing skills lists field', r.missing_fields.includes('skills'));
}
{
  const leaf = freshLeafForResolved('I.1');
  delete leaf.rationale;
  delete leaf.considered;
  const r = checkLeafCompleteness(leaf);
  check('completeness: missing rationale + considered', r.ok === false && r.missing_fields.length === 2);
  check('completeness: lists both', r.missing_fields.includes('rationale') && r.missing_fields.includes('considered'));
}
{
  const leaf = Object.assign(freshLeafForResolved('I.1'), { description: '' });
  const r = checkLeafCompleteness(leaf);
  check('completeness: empty description → invalid-fields', r.ok === false && r.failure_kind === 'invalid-fields' && r.invalid_field === 'description');
}
{
  const leaf = Object.assign(freshLeafForResolved('I.1'), { scope: 'not object' });
  const r = checkLeafCompleteness(leaf);
  check('completeness: scope not object', r.ok === false && r.invalid_field === 'scope');
}
{
  const leaf = Object.assign(freshLeafForResolved('I.1'), { scope: { out: [] } });
  // missing scope.in
  const r = checkLeafCompleteness(leaf);
  check('completeness: scope.in array required', r.ok === false && r.invalid_field === 'scope.in');
}
{
  const leaf = Object.assign(freshLeafForResolved('I.1'), { scope: { in: [], out: 'no' } });
  const r = checkLeafCompleteness(leaf);
  check('completeness: scope.out array required', r.ok === false && r.invalid_field === 'scope.out');
}
{
  const leaf = Object.assign(freshLeafForResolved('I.1'), { success: [] });
  const r = checkLeafCompleteness(leaf);
  check('completeness: empty success', r.ok === false && r.invalid_field === 'success');
}
{
  const leaf = Object.assign(freshLeafForResolved('I.1'), { verify: { method: 'm', fallback: 'f' } });
  // missing review_required
  const r = checkLeafCompleteness(leaf);
  check('completeness: verify.review_required required boolean', r.ok === false && r.invalid_field === 'verify.review_required');
}
{
  const leaf = Object.assign(freshLeafForResolved('I.1'), { verify: { method: '', fallback: 'f', review_required: true } });
  const r = checkLeafCompleteness(leaf);
  check('completeness: empty verify.method', r.ok === false && r.invalid_field === 'verify.method');
}
{
  const leaf = Object.assign(freshLeafForResolved('I.1'), { confidence: 'sky-high' });
  const r = checkLeafCompleteness(leaf);
  check('completeness: invalid confidence', r.ok === false && r.invalid_field === 'confidence');
}
{
  const leaf = Object.assign(freshLeafForResolved('I.1'), { deps: 'not array' });
  const r = checkLeafCompleteness(leaf);
  check('completeness: invalid deps', r.ok === false && r.invalid_field === 'deps');
}
{
  const leaf = Object.assign(freshLeafForResolved('I.1'), { rationale: 123 });
  const r = checkLeafCompleteness(leaf);
  check('completeness: rationale must be string', r.ok === false && r.invalid_field === 'rationale');
}
{
  const leaf = Object.assign(freshLeafForResolved('I.1'), { considered: 'not array' });
  const r = checkLeafCompleteness(leaf);
  check('completeness: considered must be array', r.ok === false && r.invalid_field === 'considered');
}

// ===========================================================================
// runLeafCompleteness
// ===========================================================================
console.log('runLeafCompleteness');
{
  const milestones = [
    { id: 'I', children: [freshLeafForResolved('I.1'), Object.assign(freshLeafForResolved('I.2'), { pending_skill_resolution: true })] },
    { id: 'II', children: [Object.assign(freshLeafForResolved('II.1'), { rationale: undefined })] }
  ];
  const report = runLeafCompleteness(milestones);
  check('runCompleteness: 1 passed', report.passed_leaf_ids.length === 1 && report.passed_leaf_ids[0] === 'I.1');
  check('runCompleteness: 2 failed', report.failed.length === 2);
  check('runCompleteness: I.2 skill-resolution-skipped', report.failed.find((f) => f.leaf_id === 'I.2').failure_kind === 'skill-resolution-skipped');
  check('runCompleteness: II.1 missing rationale', report.failed.find((f) => f.leaf_id === 'II.1').failure_kind === 'missing-fields');
  check('runCompleteness: II.1 milestone_id=II', report.failed.find((f) => f.leaf_id === 'II.1').milestone_id === 'II');
}

// ===========================================================================
// buildPlanQualityTurn
// ===========================================================================
console.log('buildPlanQualityTurn');
{
  const { projectDir, tmpRoot } = makeTempProject('build-no-plan');
  const r = buildPlanQualityTurn(projectDir);
  check('build: missing-plan envelope', r.ok === false && r.reason === 'missing-plan');
  cleanup(tmpRoot);
}
{
  // Plan exists, no proposed_tree, no committed children.
  const { projectDir, tmpRoot } = makeTempProject('build-no-tree');
  fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), `${FRONT}# t`);
  writeReqs(projectDir, REQS_THREE_CATEGORIES);
  const r = buildPlanQualityTurn(projectDir);
  check('build: no-tree envelope', r.ok === false && r.reason === 'no-tree');
  cleanup(tmpRoot);
}
{
  // Tree exists, no requirements file.
  const { projectDir, tmpRoot } = makeTempProject('build-no-reqs');
  fixtureProposedTree(projectDir, [
    { id: 'I', title: 'F', description: 'd', children: [{ id: 'I.1' }] }
  ]);
  const r = buildPlanQualityTurn(projectDir);
  check('build: no-requirements envelope', r.ok === false && r.reason === 'no-requirements');
  cleanup(tmpRoot);
}
{
  // Happy plan-mode dispatch.
  const { projectDir, tmpRoot } = makeTempProject('build-happy');
  fixtureProposedTree(projectDir, [
    { id: 'I', title: 'Foundation', description: 'auth', children: [{ id: 'I.1' }, { id: 'I.2' }] },
    { id: 'II', title: 'Dashboard', description: 'stats', children: [{ id: 'II.1' }] }
  ]);
  writeReqs(projectDir, REQS_THREE_CATEGORIES);
  const r = buildPlanQualityTurn(projectDir);
  check('build: happy ok', r.ok === true);
  check('build: status', r.status === STATUS);
  check('build: mode=plan', r.mode === 'plan');
  check('build: tree_source=proposed', r.tree_source === 'proposed');
  check('build: tree_revision=3', r.tree_revision === 3);
  check('build: requirements present', r.requirements && r.requirements.functional.length === 3);
  check('build: 2 milestones', r.milestones.length === 2);
  check('build: 3 leaves', r.leaves.length === 3);
  check('build: leaf_completeness pre-computed', r.leaf_completeness && Array.isArray(r.leaf_completeness.passed_leaf_ids));
  check('build: all 3 leaves pass completeness', r.leaf_completeness.passed_leaf_ids.length === 3);
  check('build: text mentions Stage 6', /Stage 6/.test(r.text));
  check('build: text shows functional reqs', /sign in via SSO/.test(r.text));
  check('build: text shows non-functional reqs', /WCAG AA/.test(r.text));
  check('build: text mentions agent reasoning', /agent reasoning|trace/.test(r.text));
  check('build: text shows leaves by milestone', /I.1.*Leaf I.1/.test(r.text));
  check('build: text shows verdict options', /pass.*gap.*reroute/s.test(r.text));
  check('build: text includes action paths', /Action paths/.test(r.text));
  check('build: text shows commit syntax', /entries-json/.test(r.text));
  check('build: expectedPayload shape declared', r.expectedPayload && typeof r.expectedPayload.trace === 'string');
  cleanup(tmpRoot);
}
{
  // Build with one leaf skipped (Slice B) — leaf_completeness surfaces it.
  const { projectDir, tmpRoot } = makeTempProject('build-with-skipped');
  fixtureProposedTree(projectDir, [
    { id: 'I', title: 'F', description: 'd', children: [{ id: 'I.1' }, { id: 'I.2', pending: true }] }
  ]);
  writeReqs(projectDir, REQS_FUNCTIONAL_ONLY);
  const r = buildPlanQualityTurn(projectDir);
  check('build skipped: ok', r.ok === true);
  check('build skipped: failed contains I.2 skill-resolution-skipped', r.leaf_completeness.failed.some((f) => f.leaf_id === 'I.2' && f.failure_kind === 'skill-resolution-skipped'));
  check('build skipped: text surfaces failure', /skill-resolution-skipped/.test(r.text));
  cleanup(tmpRoot);
}

// ===========================================================================
// validateTrace
// ===========================================================================
console.log('validateTrace');
{
  const leafIds = new Set(['I.1', 'I.2', 'II.1']);
  const r = validateTrace({ '0': ['I.1'] }, 3, leafIds);
  check('trace: happy ok', r.ok === true);
}
{
  const leafIds = new Set(['I.1']);
  check('trace: null fails', !validateTrace(null, 1, leafIds).ok);
  check('trace: array fails', !validateTrace([], 1, leafIds).ok);
  // Q3.8.10 amplify: non-integer key
  check('trace: non-integer key', validateTrace({ 'foo': ['I.1'] }, 1, leafIds).reason === 'invalid-trace-key');
  // Q3.8.10 amplify: out-of-range key
  check('trace: out-of-range key', validateTrace({ '5': ['I.1'] }, 1, leafIds).reason === 'invalid-trace-key');
  // negative — fails regex test which only allows /^[0-9]+$/
  check('trace: negative key', validateTrace({ '-1': ['I.1'] }, 1, leafIds).reason === 'invalid-trace-key');
  // value not array
  check('trace: value not array', validateTrace({ '0': 'I.1' }, 1, leafIds).reason === 'invalid-trace-value');
  // value contains non-string
  check('trace: value contains non-string', validateTrace({ '0': [123] }, 1, leafIds).reason === 'invalid-trace-value');
  // unknown leaf id
  check('trace: unknown leaf id', validateTrace({ '0': ['X.1'] }, 1, leafIds).reason === 'unknown-leaf-id');
}

// ===========================================================================
// validateUncovered
// ===========================================================================
console.log('validateUncovered');
{
  check('uncovered: happy ok', validateUncovered([0, 2], 3).ok === true);
  check('uncovered: empty array ok', validateUncovered([], 3).ok === true);
  check('uncovered: not array fails', validateUncovered('nope', 3).ok === false);
  check('uncovered: float fails', validateUncovered([1.5], 3).reason === 'invalid-uncovered-index');
  check('uncovered: negative fails', validateUncovered([-1], 3).reason === 'invalid-uncovered-index');
  check('uncovered: out-of-range fails', validateUncovered([5], 3).reason === 'invalid-uncovered-index');
  check('uncovered: duplicate fails', validateUncovered([1, 1], 3).reason === 'duplicate-uncovered-index');
}

// ===========================================================================
// validateMilestoneVerdicts
// ===========================================================================
console.log('validateMilestoneVerdicts');
{
  const ids = new Set(['I', 'II']);
  check('verdicts: happy ok', validateMilestoneVerdicts([
    { milestone_id: 'I', verdict: 'pass', notes: 'good' },
    { milestone_id: 'II', verdict: 'gap', notes: 'thin' }
  ], ids).ok === true);
}
{
  const ids = new Set(['I']);
  check('verdicts: not array fails', !validateMilestoneVerdicts('nope', ids).ok);
  check('verdicts: missing milestone_id', validateMilestoneVerdicts([{ verdict: 'pass', notes: 'g' }], ids).reason === 'invalid-verdict');
  check('verdicts: unknown milestone', validateMilestoneVerdicts([{ milestone_id: 'X', verdict: 'pass', notes: 'g' }], ids).reason === 'unknown-milestone-id');
  check('verdicts: invalid verdict', validateMilestoneVerdicts([{ milestone_id: 'I', verdict: 'maybe', notes: 'g' }], ids).reason === 'invalid-verdict');
  check('verdicts: empty notes', validateMilestoneVerdicts([{ milestone_id: 'I', verdict: 'pass', notes: '' }], ids).reason === 'invalid-verdict');
}
{
  const ids = new Set(['I', 'II']);
  check('verdicts: duplicate milestone', validateMilestoneVerdicts([
    { milestone_id: 'I', verdict: 'pass', notes: 'g' },
    { milestone_id: 'I', verdict: 'pass', notes: 'g' }
  ], ids).reason === 'duplicate-milestone-verdict');
  check('verdicts: incomplete coverage', validateMilestoneVerdicts([
    { milestone_id: 'I', verdict: 'pass', notes: 'g' }
  ], ids).reason === 'incomplete-verdict-coverage');
}

// ===========================================================================
// applyPlanQualityTurn — Pattern 4 invariants + happy + report write
// ===========================================================================
console.log('applyPlanQualityTurn');
{
  const { projectDir, tmpRoot } = makeTempProject('apply-reject-null');
  fixtureProposedTree(projectDir, [{ id: 'I', title: 'F', description: 'd', children: [{ id: 'I.1' }] }]);
  writeReqs(projectDir, REQS_FUNCTIONAL_ONLY);
  check('apply reject null', applyPlanQualityTurn(projectDir, null).ok === false);
  check('apply reject array', applyPlanQualityTurn(projectDir, []).ok === false);
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('apply-incomplete-coverage');
  fixtureProposedTree(projectDir, [{ id: 'I', title: 'F', description: 'd', children: [{ id: 'I.1' }] }]);
  writeReqs(projectDir, REQS_FUNCTIONAL_ONLY); // 2 functional reqs
  // trace covers req 0; uncovered_indices doesn't list req 1 → incomplete-coverage
  const r = applyPlanQualityTurn(projectDir, {
    trace: { '0': ['I.1'] },
    uncovered_indices: [],
    milestone_verdicts: [{ milestone_id: 'I', verdict: 'pass', notes: 'g' }]
  });
  check('apply incomplete-coverage', r.ok === false && r.reason === 'incomplete-coverage');
  // No sessions file should exist.
  const sessionsDir = path.join(projectDir, SESSIONS_REL);
  check('apply incomplete: no sessions file', !fs.existsSync(sessionsDir) || fs.readdirSync(sessionsDir).length === 0);
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('apply-covered-and-uncovered');
  fixtureProposedTree(projectDir, [{ id: 'I', title: 'F', description: 'd', children: [{ id: 'I.1' }] }]);
  writeReqs(projectDir, REQS_FUNCTIONAL_ONLY);
  const r = applyPlanQualityTurn(projectDir, {
    trace: { '0': ['I.1'], '1': ['I.1'] },
    uncovered_indices: [0],
    milestone_verdicts: [{ milestone_id: 'I', verdict: 'pass', notes: 'g' }]
  });
  check('apply covered-and-uncovered', r.ok === false && r.reason === 'covered-and-uncovered');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('apply-unknown-leaf');
  fixtureProposedTree(projectDir, [{ id: 'I', title: 'F', description: 'd', children: [{ id: 'I.1' }] }]);
  writeReqs(projectDir, REQS_FUNCTIONAL_ONLY);
  const r = applyPlanQualityTurn(projectDir, {
    trace: { '0': ['Z.99'], '1': [] },
    uncovered_indices: [],
    milestone_verdicts: [{ milestone_id: 'I', verdict: 'pass', notes: 'g' }]
  });
  check('apply unknown-leaf', r.ok === false && r.reason === 'unknown-leaf-id');
  cleanup(tmpRoot);
}
{
  // Happy: writes report, returns envelope.
  const { projectDir, tmpRoot } = makeTempProject('apply-happy');
  fixtureProposedTree(projectDir, [
    { id: 'I', title: 'Foundation', description: 'auth', children: [{ id: 'I.1' }, { id: 'I.2' }] },
    { id: 'II', title: 'Dashboard', description: 'stats', children: [{ id: 'II.1' }] }
  ]);
  writeReqs(projectDir, REQS_THREE_CATEGORIES);
  // requirements has 3 functional reqs. Trace 2, leave 1 uncovered.
  const r = applyPlanQualityTurn(projectDir, {
    trace: { '0': ['I.1'], '1': ['II.1'] },
    uncovered_indices: [2],
    milestone_verdicts: [
      { milestone_id: 'I', verdict: 'pass', notes: 'auth in place' },
      { milestone_id: 'II', verdict: 'gap', notes: 'stats source unclear' }
    ]
  }, { now: FIXED_NOW });
  check('apply happy: ok', r.ok === true);
  check('apply happy: mode=commit', r.mode === 'commit');
  check('apply happy: tree_source=proposed', r.tree_source === 'proposed');
  check('apply happy: covered=2', r.coverage.covered_requirement_indices.length === 2);
  check('apply happy: uncovered=1', r.coverage.uncovered_requirement_indices.length === 1);
  check('apply happy: uncovered includes 2', r.coverage.uncovered_requirement_indices.includes(2));
  check('apply happy: leaf_trace preserved', r.coverage.leaf_trace['0'][0] === 'I.1');
  check('apply happy: leaf_completeness present', r.leaf_completeness && r.leaf_completeness.passed_leaf_ids.length === 3);
  check('apply happy: 0 failed', r.leaf_completeness.failed.length === 0);
  check('apply happy: goal_backward verdicts preserved', r.goal_backward.length === 2);
  check('apply happy: report_path set', typeof r.report_path === 'string' && r.report_path.includes('plan-quality'));
  check('apply happy: report_path under sessions', r.report_path.includes('sessions'));
  check('apply happy: summary string', typeof r.summary === 'string' && /2\/3/.test(r.summary));
  check('apply happy: text mentions report path', r.text.includes('plan-quality'));
  // Verify the report file was actually written.
  check('apply happy: report file exists', fs.existsSync(r.report_path));
  const reportBody = fs.readFileSync(r.report_path, 'utf8');
  check('apply happy: report has Coverage section', /## Coverage/.test(reportBody));
  check('apply happy: report has Non-functional section', /## Non-functional/.test(reportBody));
  check('apply happy: report has Out of scope section', /## Out of scope/.test(reportBody));
  check('apply happy: report has Leaf completeness', /## Leaf completeness/.test(reportBody));
  check('apply happy: report has Goal-backward', /## Goal-backward/.test(reportBody));
  check('apply happy: report shows GAP for req 2', /\[GAP\].*\[2\]/.test(reportBody));
  check('apply happy: report shows pass for I', /\[pass\] I:/.test(reportBody));
  check('apply happy: report shows GAP for II', /\[GAP\] II:/.test(reportBody));
  cleanup(tmpRoot);
}
{
  // Happy with zero functional requirements (coverage trivially satisfied).
  const { projectDir, tmpRoot } = makeTempProject('apply-zero-functional');
  fixtureProposedTree(projectDir, [{ id: 'I', title: 'F', description: 'd', children: [{ id: 'I.1' }] }]);
  writeReqs(projectDir, '# Requirements\n\n## Functional\n\n## Non-functional\n- something\n');
  const r = applyPlanQualityTurn(projectDir, {
    trace: {},
    uncovered_indices: [],
    milestone_verdicts: [{ milestone_id: 'I', verdict: 'pass', notes: 'good' }]
  }, { now: FIXED_NOW });
  check('apply zero-functional: ok', r.ok === true);
  check('apply zero-functional: covered=0', r.coverage.covered_requirement_indices.length === 0);
  check('apply zero-functional: uncovered=0', r.coverage.uncovered_requirement_indices.length === 0);
  cleanup(tmpRoot);
}
{
  // Stage 6 with skipped leaf (Slice B not run) → leaf_completeness reports failure.
  const { projectDir, tmpRoot } = makeTempProject('apply-with-skipped');
  fixtureProposedTree(projectDir, [
    { id: 'I', title: 'F', description: 'd', children: [{ id: 'I.1' }, { id: 'I.2', pending: true }] }
  ]);
  writeReqs(projectDir, REQS_FUNCTIONAL_ONLY);
  const r = applyPlanQualityTurn(projectDir, {
    trace: { '0': ['I.1'], '1': ['I.1'] },
    uncovered_indices: [],
    milestone_verdicts: [{ milestone_id: 'I', verdict: 'gap', notes: 'skill resolution incomplete' }]
  }, { now: FIXED_NOW });
  check('apply skipped: ok=true (commit lands even with failed leaves — the report surfaces them)', r.ok === true);
  check('apply skipped: failed includes I.2', r.leaf_completeness.failed.some((f) => f.leaf_id === 'I.2' && f.failure_kind === 'skill-resolution-skipped'));
  // The session file should surface the failure.
  const reportBody = fs.readFileSync(r.report_path, 'utf8');
  check('apply skipped: report mentions FAIL I.2', /\[FAIL\] I\.2.*skill-resolution-skipped/.test(reportBody));
  cleanup(tmpRoot);
}
{
  // Committed-tree fallback path. Generate via writer to ensure parser/writer
  // round-trip correctness, then verify the tree_source flip works at the helper
  // level (this exercises the rollUpCommittedLeaf seam end-to-end).
  const { projectDir, tmpRoot } = makeTempProject('apply-committed-fallback');
  const writer = require('../lib/ovd-plan/writer');
  const tree = {
    frontmatter: { 'ovd-plan': true, version: 3, project: 'Test' },
    tree: {
      depth: 1,
      id: '',
      title: 'Test',
      description: '',
      status: 'pending',
      annotations: {},
      children: [
        {
          depth: 2,
          id: 'I',
          title: 'Foundation',
          description: '',
          status: 'pending',
          annotations: {},
          children: [
            {
              depth: 3,
              id: 'I.1',
              title: 'L1',
              description: 'desc',
              status: 'pending',
              annotations: {
                skills: ['frontend-design'],
                confidence: 'high',
                rationale: 'r',
                considered: [],
                scope: { in: ['src/'], out: [] },
                success: ['x'],
                deps: [],
                verify: { method: 'vitest', fallback: 'agent_self_check_against_success', review_required: true }
              },
              children: [],
              active: false
            }
          ],
          active: false
        }
      ],
      active: false
    },
    sections: {}
  };
  const md = writer.writeOverdriveMd(tree);
  fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), md);
  writeReqs(projectDir, REQS_FUNCTIONAL_ONLY);
  const r = buildPlanQualityTurn(projectDir);
  check('build committed-fallback: ok', r.ok === true);
  check('build committed-fallback: source=committed', r.tree_source === 'committed');
  cleanup(tmpRoot);
}

// ===========================================================================
// runPlanQualityCheck orchestrator
// ===========================================================================
console.log('runPlanQualityCheck orchestrator');
{
  const { projectDir, tmpRoot } = makeTempProject('orch-plan');
  fixtureProposedTree(projectDir, [{ id: 'I', title: 'F', description: 'd', children: [{ id: 'I.1' }] }]);
  writeReqs(projectDir, REQS_FUNCTIONAL_ONLY);
  const r = runPlanQualityCheck(projectDir, {});
  check('orch plan: ok', r.ok === true);
  check('orch plan: mode=plan', r.mode === 'plan');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('orch-commit');
  fixtureProposedTree(projectDir, [{ id: 'I', title: 'F', description: 'd', children: [{ id: 'I.1' }] }]);
  writeReqs(projectDir, REQS_FUNCTIONAL_ONLY);
  const r = runPlanQualityCheck(projectDir, {
    entries: {
      trace: { '0': ['I.1'], '1': ['I.1'] },
      uncovered_indices: [],
      milestone_verdicts: [{ milestone_id: 'I', verdict: 'pass', notes: 'g' }]
    },
    now: FIXED_NOW
  });
  check('orch commit: ok', r.ok === true);
  check('orch commit: mode=commit', r.mode === 'commit');
  cleanup(tmpRoot);
}

// ===========================================================================
// /ovd-plan verify subcommand (Slice C — retrospective audit route via runPlan)
// ===========================================================================
// Slice C added an `/ovd-plan verify` route in lib/ovd-plan/index.js that calls
// runPlanQualityCheck directly (no runVerifyStage wrapper, no deliberation-state
// transition). These tests verify the route: Pattern 4 JSON guard, plan-mode +
// commit-mode dispatch, and the retrospective-audit invariant — deliberation-state
// stage is NOT mutated by `/ovd-plan verify` even on a clean envelope.
console.log('/ovd-plan verify subcommand (Slice C)');
const { readDeliberationState: readDS } = require('../lib/ovd-plan/deliberation-state');
{
  // Pattern 4 JSON guard at subcommand boundary — bad JSON rejected with no write.
  const { projectDir, tmpRoot } = makeTempProject('verify-cmd-bad-json');
  fixtureProposedTree(projectDir, [{ id: 'I', title: 'F', description: 'd', children: [{ id: 'I.1' }] }]);
  writeReqs(projectDir, REQS_FUNCTIONAL_ONLY);
  const r = ovdPlan.runPlan({ subcommand: 'verify', entriesJson: '{not valid' , projectDir });
  check('verify cmd bad-json: ok=false', r && r.ok === false);
  check('verify cmd bad-json: status=plan-quality', r.status === 'plan-quality');
  check('verify cmd bad-json: reason mentions JSON', /not valid JSON/.test(r.reason));
  // No sessions file written by a rejected dispatch.
  const sessionsDir = path.join(projectDir, SESSIONS_REL);
  check('verify cmd bad-json: no sessions written', !fs.existsSync(sessionsDir));
  cleanup(tmpRoot);
}
{
  // Plan-mode dispatch — returns plan-quality envelope (mode=plan).
  const { projectDir, tmpRoot } = makeTempProject('verify-cmd-plan');
  fixtureProposedTree(projectDir, [{ id: 'I', title: 'F', description: 'd', children: [{ id: 'I.1' }] }]);
  writeReqs(projectDir, REQS_FUNCTIONAL_ONLY);
  const r = ovdPlan.runPlan({ subcommand: 'verify', projectDir });
  check('verify cmd plan: ok', r && r.ok === true);
  check('verify cmd plan: status=plan-quality', r.status === 'plan-quality');
  check('verify cmd plan: mode=plan', r.mode === 'plan');
  // No transition (retrospective semantics).
  const persisted = readDS(projectDir);
  check('verify cmd plan: stage unchanged (still plan_skills)', persisted.stage === 'plan_skills');
  cleanup(tmpRoot);
}
{
  // Commit-mode dispatch — returns plan-quality envelope (mode=commit) and writes report.
  // CRITICAL retrospective invariant: deliberation-state.stage is NOT mutated by the
  // subcommand path even on a clean envelope (transition only happens via runVerifyStage).
  const { projectDir, tmpRoot } = makeTempProject('verify-cmd-commit');
  fixtureProposedTree(projectDir, [{ id: 'I', title: 'F', description: 'd', children: [{ id: 'I.1' }] }]);
  writeReqs(projectDir, REQS_FUNCTIONAL_ONLY);
  const entriesJson = JSON.stringify({
    trace: { '0': ['I.1'], '1': ['I.1'] },
    uncovered_indices: [],
    milestone_verdicts: [{ milestone_id: 'I', verdict: 'pass', notes: 'covered' }]
  });
  const r = ovdPlan.runPlan({ subcommand: 'verify', entriesJson, projectDir });
  check('verify cmd commit: ok', r && r.ok === true);
  check('verify cmd commit: status=plan-quality', r.status === 'plan-quality');
  check('verify cmd commit: mode=commit', r.mode === 'commit');
  check('verify cmd commit: report_path returned', typeof r.report_path === 'string' && r.report_path.includes('plan-quality'));
  // Retrospective invariant: NO deliberation-state stage transition (Q3.3C.5' lock).
  const persisted = readDS(projectDir);
  check('verify cmd commit: stage unchanged (retrospective — no transition)', persisted.stage === 'plan_skills');
  check('verify cmd commit: no transitioned=true on subcommand path', r.transitioned !== true);
  cleanup(tmpRoot);
}

// ===========================================================================
// Migration-compat seam — no requirements / no tree → error envelopes, no write
// ===========================================================================
console.log('migration-compat seam');
{
  const { projectDir, tmpRoot } = makeTempProject('migration');
  fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), `${FRONT}# Project\n`); // No block, no tree, no reqs
  const r = buildPlanQualityTurn(projectDir);
  check('migration: build returns no-tree envelope', r.ok === false);
  // No-write guarantee.
  const sessionsDir = path.join(projectDir, SESSIONS_REL);
  check('migration: no sessions dir created on error', !fs.existsSync(sessionsDir));
  cleanup(tmpRoot);
}

// ===========================================================================
// formatPlan / formatCommit
// ===========================================================================
console.log('formatPlan / formatCommit');
check('formatPlan returns text', formatPlan({ text: 'hello' }) === 'hello');
check('formatPlan default', formatPlan(null) === '(no plan text)');
check('formatCommit returns text', formatCommit({ text: 'hi' }) === 'hi');
check('formatCommit default', formatCommit({}) === '(no commit text)');

// ===========================================================================
// Summary
// ===========================================================================
console.log('');
console.log(`${pass} checks passed.`);
if (fail > 0) {
  console.error(`${fail} FAILURES`);
  process.exit(1);
}
