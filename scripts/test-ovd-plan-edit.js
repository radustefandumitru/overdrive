#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const edit = require('../lib/ovd-plan/edit');
const {
  STATUS,
  KINDS,
  STRUCTURAL_KINDS,
  PATCH_ALLOWED_FIELDS,
  resolveTreeSource,
  findNodeInMilestones,
  collectAllIds,
  validateOperation,
  normalizeEditEntries,
  describePatchChange,
  renderOperationLine,
  renderNarrativeDiff,
  applyPatchOp,
  applyAddMilestoneOp,
  applyAddLeafOp,
  applyRemoveOp,
  applyReorderOp,
  applyAllOps,
  describeStructuralOpForDecisions,
  invalidateCache,
  buildEditPlan,
  commitEdit,
  runEdit,
  formatPlan,
  formatCommit
} = edit;

const ovdPlan = require('../lib/ovd-plan');
const deliberate = require('../lib/ovd-plan/deliberate');
const { openState, commitState } = require('../lib/ovd-plan/deliberation-state');
const { cachePath, saveCache } = require('../lib/ovd-plan/cache');

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
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-edit-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
  return { projectDir, tmpRoot };
}
function cleanup(tmpRoot) { fs.rmSync(tmpRoot, { recursive: true, force: true }); }
function writePlan(projectDir, content) { fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), content); }
function readPlan(projectDir) { return fs.readFileSync(path.join(projectDir, 'OVERDRIVE.md'), 'utf8'); }
function readDecisions(projectDir) {
  const p = path.join(projectDir, '.overdrive', 'decisions.md');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

const FIXED_NOW = '2026-06-13T12:00:00.000Z';
const FRONT = '---\novd-plan: true\nversion: 3\nproject: "Test Project"\n---\n\n';

// Seed a proposed_tree at Stage 7 (Present) — two milestones each with two leaves.
// EDIT only needs a valid proposed_tree to operate; the exact stage is irrelevant
// to EDIT's runtime contract, so we assemble the inner state directly via
// openState/commitState instead of replaying Stage 2/4/etc. turn-by-turn.
function seedProposedTree(projectDir) {
  writePlan(projectDir, FRONT + '# Test Project\n');
  const opened = openState(projectDir);
  if (!opened.ok) throw new Error(`seed failed: ${opened.reason}`);
  opened.innerObj.stage = 'present';
  opened.innerObj.proposed_tree = {
    milestones: [
      {
        id: 'I',
        title: 'Foundation',
        description: 'Auth + DB.',
        ambiguity_score: 2,
        children: [
          { id: 'I.1', title: 'Auth', description: 'Login + sessions.' },
          { id: 'I.2', title: 'DB', description: 'Schema + migrations.' }
        ]
      },
      {
        id: 'II',
        title: 'Dashboard',
        description: 'Stats widgets.',
        ambiguity_score: 2,
        children: [
          { id: 'II.1', title: 'Widgets', description: 'Stats cards.' },
          { id: 'II.2', title: 'Filters', description: 'Time range.' }
        ]
      }
    ],
    last_revision: 1
  };
  opened.innerObj.last_action = FIXED_NOW;
  const result = commitState(projectDir, opened);
  if (!result.ok) throw new Error(`seed commitState failed: ${result.reason}`);
}

// Seed a committed tree (post-Stage-8): writes a full OVERDRIVE.md with depth-2
// milestones + depth-3 leaves so the parser produces parsed.tree.children.
function seedCommittedTree(projectDir) {
  const content = FRONT + [
    '# Test Project [pending]',
    '',
    '## I. Foundation [pending]',
    '',
    'Auth + DB.',
    '',
    '### I.1. Auth [pending]',
    '',
    'Login + sessions.',
    '',
    '### I.2. DB [pending]',
    '',
    'Schema + migrations.',
    '',
    '## II. Dashboard [pending]',
    '',
    'Stats widgets.',
    '',
    '### II.1. Widgets [pending]',
    '',
    'Stats cards.',
    '',
    '### II.2. Filters [pending]',
    '',
    'Time range.',
    ''
  ].join('\n');
  writePlan(projectDir, content);
}

// ---------------------------------------------------------------------------
// 1. Module surface
// ---------------------------------------------------------------------------
console.log('Module surface');
check('STATUS === "edit"', STATUS === 'edit');
check('KINDS length 5', KINDS.length === 5);
check('KINDS contains patch', KINDS.includes('patch'));
check('KINDS contains add_milestone', KINDS.includes('add_milestone'));
check('KINDS contains add_leaf', KINDS.includes('add_leaf'));
check('KINDS contains remove', KINDS.includes('remove'));
check('KINDS contains reorder', KINDS.includes('reorder'));
check('STRUCTURAL_KINDS is a Set of 4', STRUCTURAL_KINDS instanceof Set && STRUCTURAL_KINDS.size === 4);
check('STRUCTURAL_KINDS excludes patch', !STRUCTURAL_KINDS.has('patch'));
check('STRUCTURAL_KINDS contains add_milestone', STRUCTURAL_KINDS.has('add_milestone'));
check('PATCH_ALLOWED_FIELDS is array', Array.isArray(PATCH_ALLOWED_FIELDS));
check('PATCH_ALLOWED_FIELDS includes title', PATCH_ALLOWED_FIELDS.includes('title'));
check('PATCH_ALLOWED_FIELDS does NOT include id', !PATCH_ALLOWED_FIELDS.includes('id'));
for (const fn of ['resolveTreeSource','findNodeInMilestones','collectAllIds','validateOperation','normalizeEditEntries','describePatchChange','renderOperationLine','renderNarrativeDiff','applyPatchOp','applyAddMilestoneOp','applyAddLeafOp','applyRemoveOp','applyReorderOp','applyAllOps','describeStructuralOpForDecisions','invalidateCache','buildEditPlan','commitEdit','runEdit','formatPlan','formatCommit']) {
  check(`exported ${fn}`, typeof edit[fn] === 'function');
}

// ---------------------------------------------------------------------------
// 2. resolveTreeSource
// ---------------------------------------------------------------------------
console.log('resolveTreeSource');
{
  const r = resolveTreeSource({ ok: true, innerObj: {} });
  check('no tree → source=null', r.source === null);
  check('no tree → empty milestones', r.milestones.length === 0);
}
{
  const r = resolveTreeSource({ ok: true, innerObj: { proposed_tree: { milestones: [{ id: 'I', title: 'Foo' }] } } });
  check('proposed → source=proposed', r.source === 'proposed');
  check('proposed → milestones array', r.milestones.length === 1);
  check('proposed → root=null', r.root === null);
}
{
  const r = resolveTreeSource({
    ok: true,
    innerObj: {},
    parsed: { tree: { children: [{ id: 'I', title: 'Foo', depth: 2 }] } }
  });
  check('committed → source=committed', r.source === 'committed');
  check('committed → milestones reference root.children', r.milestones === r.root.children);
}
{
  // Proposed wins over committed when both present
  const r = resolveTreeSource({
    ok: true,
    innerObj: { proposed_tree: { milestones: [{ id: 'X', title: 'X' }] } },
    parsed: { tree: { children: [{ id: 'Y', title: 'Y', depth: 2 }] } }
  });
  check('proposed wins over committed', r.source === 'proposed' && r.milestones[0].id === 'X');
}

// ---------------------------------------------------------------------------
// 3. findNodeInMilestones + collectAllIds
// ---------------------------------------------------------------------------
console.log('findNodeInMilestones / collectAllIds');
{
  const ms = [{ id: 'I', title: 'I', children: [{ id: 'I.1', title: 'I1' }] }, { id: 'II', title: 'II', children: [] }];
  check('finds milestone', findNodeInMilestones(ms, 'I').kind === 'milestone');
  check('finds leaf', findNodeInMilestones(ms, 'I.1').kind === 'leaf');
  check('returns null for missing', findNodeInMilestones(ms, 'Z') === null);
  check('leaf carries milestone ref', findNodeInMilestones(ms, 'I.1').milestone.id === 'I');
  const ids = collectAllIds(ms);
  check('collectAllIds returns Set', ids instanceof Set);
  check('collectAllIds contains all', ids.has('I') && ids.has('II') && ids.has('I.1'));
  check('collectAllIds size matches', ids.size === 3);
}

// ---------------------------------------------------------------------------
// 4. validateOperation — per-kind matrix
// ---------------------------------------------------------------------------
console.log('validateOperation');
const tctx = {
  milestones: [
    { id: 'I', title: 'Foundation', children: [{ id: 'I.1', title: 'Auth' }, { id: 'I.2', title: 'DB' }] },
    { id: 'II', title: 'Dashboard', children: [{ id: 'II.1', title: 'Widgets' }] }
  ],
  idSet: new Set(['I', 'II', 'I.1', 'I.2', 'II.1']),
  source: 'proposed'
};
check('null op', /must be an object/.test(validateOperation(null, 0, tctx)));
check('array op', /must be an object/.test(validateOperation([], 0, tctx)));
check('unknown kind', /must be one of/.test(validateOperation({ kind: 'bogus' }, 0, tctx)));

// patch
check('patch no target_id', /target_id \(string\)/.test(validateOperation({ kind: 'patch', body: { title: 'X' } }, 0, tctx)));
check('patch unknown target_id', /not found in tree/.test(validateOperation({ kind: 'patch', target_id: 'Z', body: { title: 'X' } }, 0, tctx)));
check('patch no body', /requires body \(object\)/.test(validateOperation({ kind: 'patch', target_id: 'I' }, 0, tctx)));
check('patch with id field', /cannot rewrite id/.test(validateOperation({ kind: 'patch', target_id: 'I', body: { id: 'X' } }, 0, tctx)));
check('patch with unsupported field', /unsupported field/.test(validateOperation({ kind: 'patch', target_id: 'I', body: { foo: 'bar' } }, 0, tctx)));
check('patch valid', validateOperation({ kind: 'patch', target_id: 'I', body: { title: 'New' } }, 0, tctx) === null);
check('patch with all allowed fields', validateOperation({ kind: 'patch', target_id: 'I.1', body: { title: 't', description: 'd', scope: {}, success: [], deps: [], verify: {}, skills: {} } }, 0, tctx) === null);

// add_milestone
check('add_milestone no body.id', /body\.id \(string\)/.test(validateOperation({ kind: 'add_milestone', body: { title: 'X' } }, 0, tctx)));
check('add_milestone duplicate id', /already exists/.test(validateOperation({ kind: 'add_milestone', body: { id: 'I', title: 'X' } }, 0, tctx)));
check('add_milestone no title', /body\.title/.test(validateOperation({ kind: 'add_milestone', body: { id: 'III' } }, 0, tctx)));
check('add_milestone valid', validateOperation({ kind: 'add_milestone', body: { id: 'III', title: 'Launch' } }, 0, tctx) === null);

// add_leaf
check('add_leaf no body.id', /body\.id/.test(validateOperation({ kind: 'add_leaf', body: { title: 'X', parent_milestone_id: 'I' } }, 0, tctx)));
check('add_leaf no parent', /parent_milestone_id/.test(validateOperation({ kind: 'add_leaf', body: { id: 'X.1', title: 'X' } }, 0, tctx)));
check('add_leaf unknown parent', /not found/.test(validateOperation({ kind: 'add_leaf', body: { id: 'Z.1', title: 'X', parent_milestone_id: 'Z' } }, 0, tctx)));
check('add_leaf parent is leaf', /not a milestone/.test(validateOperation({ kind: 'add_leaf', body: { id: 'X.a', title: 'X', parent_milestone_id: 'I.1' } }, 0, tctx)));
check('add_leaf valid', validateOperation({ kind: 'add_leaf', body: { id: 'I.3', title: 'New', parent_milestone_id: 'I' } }, 0, tctx) === null);

// remove
check('remove no target_id', /target_id/.test(validateOperation({ kind: 'remove' }, 0, tctx)));
check('remove unknown target', /not found/.test(validateOperation({ kind: 'remove', target_id: 'Z' }, 0, tctx)));
check('remove valid', validateOperation({ kind: 'remove', target_id: 'I.1' }, 0, tctx) === null);

// reorder
check('reorder no body', /body \(object\)/.test(validateOperation({ kind: 'reorder' }, 0, tctx)));
check('reorder no ordered_ids', /ordered_ids/.test(validateOperation({ kind: 'reorder', body: {} }, 0, tctx)));
check('reorder unknown parent', /not found/.test(validateOperation({ kind: 'reorder', body: { parent_id: 'Z', ordered_ids: ['X'] } }, 0, tctx)));
check('reorder wrong count', /must contain exactly/.test(validateOperation({ kind: 'reorder', body: { parent_id: 'I', ordered_ids: ['I.1'] } }, 0, tctx)));
check('reorder unknown id', /unknown id/.test(validateOperation({ kind: 'reorder', body: { parent_id: 'I', ordered_ids: ['I.1', 'Z'] } }, 0, tctx)));
check('reorder duplicate ids', /duplicates/.test(validateOperation({ kind: 'reorder', body: { parent_id: 'I', ordered_ids: ['I.1', 'I.1'] } }, 0, tctx)));
check('reorder valid under parent', validateOperation({ kind: 'reorder', body: { parent_id: 'I', ordered_ids: ['I.2', 'I.1'] } }, 0, tctx) === null);
check('reorder valid top-level', validateOperation({ kind: 'reorder', body: { ordered_ids: ['II', 'I'] } }, 0, tctx) === null);
check('reorder top-level wrong count', /must contain exactly/.test(validateOperation({ kind: 'reorder', body: { ordered_ids: ['I'] } }, 0, tctx)));

// ---------------------------------------------------------------------------
// 5. normalizeEditEntries
// ---------------------------------------------------------------------------
console.log('normalizeEditEntries');
check('null entries → invalid-shape', normalizeEditEntries(null, tctx).reason === 'invalid-shape');
check('array entries → invalid-shape', normalizeEditEntries([], tctx).reason === 'invalid-shape');
check('no operations → no-operations', normalizeEditEntries({}, tctx).reason === 'no-operations');
check('empty operations → no-operations', normalizeEditEntries({ operations: [] }, tctx).reason === 'no-operations');
check('invalid op → invalid-operation', normalizeEditEntries({ operations: [{ kind: 'bogus' }] }, tctx).reason === 'invalid-operation');
{
  const r = normalizeEditEntries({ operations: [{ kind: 'patch', target_id: 'I', body: { title: 'X' } }] }, tctx);
  check('valid → ok=true', r.ok === true);
  check('valid → confirm defaults false', r.entries.confirm === false);
  check('valid → no rationale', r.entries.rationale === undefined);
}
{
  const r = normalizeEditEntries({ operations: [{ kind: 'patch', target_id: 'I', body: { title: 'X' } }], confirm: true, rationale: 'why' }, tctx);
  check('valid with confirm=true', r.entries.confirm === true);
  check('valid with rationale', r.entries.rationale === 'why');
}
{
  const r = normalizeEditEntries({ operations: [{ kind: 'patch', target_id: 'I', body: { title: 'X' } }], rationale: 'why', confirm: 'truthy-but-not-boolean-true' }, tctx);
  check('confirm strict-equals true only', r.entries.confirm === false);
}

// ---------------------------------------------------------------------------
// 6. describePatchChange / renderOperationLine
// ---------------------------------------------------------------------------
console.log('Renderers');
{
  const found = { node: { title: 'Foundation' } };
  check('patch rename description', describePatchChange({ body: { title: 'New' } }, found) === 'rename: "Foundation" → "New"');
  check('patch multi-field description', describePatchChange({ body: { scope: {}, success: [] } }, found) === 'update fields: scope, success');
  check('patch empty body description', describePatchChange({ body: {} }, found) === '(no-op)');
}
{
  const op = { kind: 'patch', target_id: 'I', body: { title: 'Rebranded' } };
  const line = renderOperationLine(op, tctx);
  check('patch line includes "Patch milestone"', /Patch milestone I/.test(line));
  check('patch line includes rename', /rename:/.test(line));
}
{
  const line = renderOperationLine({ kind: 'add_milestone', body: { id: 'III', title: 'Launch' } }, tctx);
  check('add_milestone line', line === 'Add milestone III "Launch"');
}
{
  const line = renderOperationLine({ kind: 'add_leaf', body: { id: 'I.3', title: 'Tests', parent_milestone_id: 'I' } }, tctx);
  check('add_leaf line', line === 'Add leaf I.3 "Tests" (under milestone I)');
}
{
  const line = renderOperationLine({ kind: 'remove', target_id: 'I.1' }, tctx);
  check('remove leaf line', /Remove leaf I\.1 "Auth"/.test(line));
}
{
  const line = renderOperationLine({ kind: 'reorder', body: { parent_id: 'I', ordered_ids: ['I.2', 'I.1'] } }, tctx);
  check('reorder line', /Reorder children of I → \[I\.2, I\.1\]/.test(line));
}
{
  const line = renderOperationLine({ kind: 'reorder', body: { ordered_ids: ['II', 'I'] } }, tctx);
  check('reorder top-level line', /Reorder children of \(top-level\) → \[II, I\]/.test(line));
}

// renderNarrativeDiff
{
  const ops = [
    { kind: 'patch', target_id: 'I', body: { title: 'Foundation v2' } },
    { kind: 'add_milestone', body: { id: 'III', title: 'Launch' } },
    { kind: 'remove', target_id: 'II.1' }
  ];
  const diff = renderNarrativeDiff(ops, tctx);
  check('diff has preview header', /EDIT preview \(3 operations on the proposed tree\)/.test(diff));
  check('diff has bullet markers', /  • /.test(diff));
  check('diff counts structural=2', /Structural: 2/.test(diff));
  check('diff counts non-structural=1', /Non-structural: 1/.test(diff));
  check('diff cache invalidation note', /Cache will be invalidated/.test(diff));
  check('diff has 3 action paths', /\(1\) apply/.test(diff) && /\(2\) adjust/.test(diff) && /\(3\) cancel/.test(diff));
  check('diff has commit syntax', /confirm":true/.test(diff));
  check('diff NOT unified format (no @@)', !/@@/.test(diff));
  check('diff NOT unified format (no +++/---)', !/^\+\+\+|^---/m.test(diff));
}
{
  // Singular vs plural
  const ops = [{ kind: 'patch', target_id: 'I', body: { title: 'X' } }];
  const diff = renderNarrativeDiff(ops, tctx);
  check('singular op count', /\(1 operation on/.test(diff));
}
{
  // Patch-only batch: no cache invalidation note, no structural log note
  const ops = [{ kind: 'patch', target_id: 'I', body: { title: 'X' } }];
  const diff = renderNarrativeDiff(ops, tctx);
  check('patch-only: no structural line', !/Structural: /.test(diff));
  check('patch-only: no cache note', !/Cache will be invalidated/.test(diff));
  check('patch-only: non-structural=1', /Non-structural: 1/.test(diff));
}

// ---------------------------------------------------------------------------
// 7. Apply operations against proposed_tree
// ---------------------------------------------------------------------------
console.log('Apply operations on proposed_tree');
{
  const { projectDir, tmpRoot } = makeTempProject('apply-proposed-patch');
  seedProposedTree(projectDir);
  const r = commitEdit(projectDir, { operations: [{ kind: 'patch', target_id: 'I.1', body: { title: 'Auth v2' } }], confirm: true }, { now: FIXED_NOW });
  check('proposed patch → ok', r.ok === true);
  check('proposed patch → applied', r.applied === true);
  check('proposed patch → tree_source=proposed', r.tree_source === 'proposed');
  const opened = openState(projectDir);
  const leaf = opened.innerObj.proposed_tree.milestones[0].children.find((l) => l.id === 'I.1');
  check('proposed patch → title updated', leaf.title === 'Auth v2');
  check('proposed patch → revision bumped', opened.innerObj.proposed_tree.last_revision === 2);
  check('proposed patch → no decisions row', readDecisions(projectDir) === null);
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('apply-proposed-add-milestone');
  seedProposedTree(projectDir);
  const r = commitEdit(projectDir, { operations: [{ kind: 'add_milestone', body: { id: 'III', title: 'Launch', ambiguity_score: 1 } }], confirm: true, rationale: 'pre-launch checklist' }, { now: FIXED_NOW });
  check('add_milestone → ok', r.ok === true);
  check('add_milestone → structural_count=1', r.structural_count === 1);
  const opened = openState(projectDir);
  check('add_milestone → 3 milestones', opened.innerObj.proposed_tree.milestones.length === 3);
  check('add_milestone → new milestone added', opened.innerObj.proposed_tree.milestones[2].id === 'III');
  check('add_milestone → ambiguity_score preserved', opened.innerObj.proposed_tree.milestones[2].ambiguity_score === 1);
  const decisions = readDecisions(projectDir);
  check('add_milestone → decisions.md exists', typeof decisions === 'string');
  check('add_milestone → decisions row for III', decisions.includes('| III |') || decisions.includes('III'));
  check('add_milestone → rationale in decisions', decisions.includes('pre-launch checklist'));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('apply-proposed-add-leaf');
  seedProposedTree(projectDir);
  const r = commitEdit(projectDir, { operations: [{ kind: 'add_leaf', body: { id: 'I.3', title: 'Tests', parent_milestone_id: 'I' } }], confirm: true }, { now: FIXED_NOW });
  check('add_leaf → ok', r.ok === true);
  const opened = openState(projectDir);
  const milestoneI = opened.innerObj.proposed_tree.milestones[0];
  check('add_leaf → I has 3 children', milestoneI.children.length === 3);
  check('add_leaf → new leaf at end', milestoneI.children[2].id === 'I.3');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('apply-proposed-remove-leaf');
  seedProposedTree(projectDir);
  commitEdit(projectDir, { operations: [{ kind: 'remove', target_id: 'I.1' }], confirm: true }, { now: FIXED_NOW });
  const opened = openState(projectDir);
  const milestoneI = opened.innerObj.proposed_tree.milestones[0];
  check('remove leaf → 1 remaining', milestoneI.children.length === 1);
  check('remove leaf → I.2 remains', milestoneI.children[0].id === 'I.2');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('apply-proposed-remove-milestone');
  seedProposedTree(projectDir);
  commitEdit(projectDir, { operations: [{ kind: 'remove', target_id: 'I' }], confirm: true }, { now: FIXED_NOW });
  const opened = openState(projectDir);
  check('remove milestone → 1 remaining', opened.innerObj.proposed_tree.milestones.length === 1);
  check('remove milestone → II remains', opened.innerObj.proposed_tree.milestones[0].id === 'II');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('apply-proposed-reorder-children');
  seedProposedTree(projectDir);
  commitEdit(projectDir, { operations: [{ kind: 'reorder', body: { parent_id: 'I', ordered_ids: ['I.2', 'I.1'] } }], confirm: true }, { now: FIXED_NOW });
  const opened = openState(projectDir);
  const milestoneI = opened.innerObj.proposed_tree.milestones[0];
  check('reorder → I.2 first', milestoneI.children[0].id === 'I.2');
  check('reorder → I.1 second', milestoneI.children[1].id === 'I.1');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('apply-proposed-reorder-top');
  seedProposedTree(projectDir);
  commitEdit(projectDir, { operations: [{ kind: 'reorder', body: { ordered_ids: ['II', 'I'] } }], confirm: true }, { now: FIXED_NOW });
  const opened = openState(projectDir);
  check('reorder top → II first', opened.innerObj.proposed_tree.milestones[0].id === 'II');
  check('reorder top → I second', opened.innerObj.proposed_tree.milestones[1].id === 'I');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 8. Apply operations against committed tree
// ---------------------------------------------------------------------------
console.log('Apply operations on committed tree');
{
  const { projectDir, tmpRoot } = makeTempProject('apply-committed-patch-leaf');
  seedCommittedTree(projectDir);
  const r = commitEdit(projectDir, { operations: [{ kind: 'patch', target_id: 'I.1', body: { success: ['login works'] } }], confirm: true }, { now: FIXED_NOW });
  check('committed patch leaf → ok', r.ok === true);
  check('committed patch leaf → tree_source=committed', r.tree_source === 'committed');
  const plan = readPlan(projectDir);
  check('committed patch leaf → annotations YAML in plan', plan.includes('login works'));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('apply-committed-patch-rename');
  seedCommittedTree(projectDir);
  commitEdit(projectDir, { operations: [{ kind: 'patch', target_id: 'I.1', body: { title: 'Authentication' } }], confirm: true }, { now: FIXED_NOW });
  const plan = readPlan(projectDir);
  check('committed patch rename → new title in plan', plan.includes('Authentication'));
  check('committed patch rename → old title removed', !plan.includes('### I.1. Auth ['));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('apply-committed-add-milestone');
  seedCommittedTree(projectDir);
  const r = commitEdit(projectDir, { operations: [{ kind: 'add_milestone', body: { id: 'III', title: 'Launch' } }], confirm: true }, { now: FIXED_NOW });
  check('committed add_milestone → ok', r.ok === true);
  const plan = readPlan(projectDir);
  check('committed add_milestone → III in plan', plan.includes('III') && plan.includes('Launch'));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('apply-committed-remove-leaf');
  seedCommittedTree(projectDir);
  commitEdit(projectDir, { operations: [{ kind: 'remove', target_id: 'I.1' }], confirm: true }, { now: FIXED_NOW });
  const plan = readPlan(projectDir);
  check('committed remove leaf → leaf gone', !plan.includes('### I.1.'));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('apply-committed-revision-NOT-bumped');
  seedCommittedTree(projectDir);
  const r = commitEdit(projectDir, { operations: [{ kind: 'patch', target_id: 'I', body: { title: 'Core' } }], confirm: true }, { now: FIXED_NOW });
  check('committed: no revision bump in response', r.text && !r.text.includes('Proposal revision bumped'));
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 9. Multi-op atomic batch
// ---------------------------------------------------------------------------
console.log('Multi-op atomic batches');
{
  const { projectDir, tmpRoot } = makeTempProject('multi-op-batch');
  seedProposedTree(projectDir);
  const r = commitEdit(projectDir, {
    operations: [
      { kind: 'patch', target_id: 'I', body: { title: 'Foundation v2' } },
      { kind: 'add_milestone', body: { id: 'III', title: 'Launch' } },
      { kind: 'remove', target_id: 'II.2' }
    ],
    confirm: true,
    rationale: 'restructure'
  }, { now: FIXED_NOW });
  check('multi-op → ok', r.ok === true);
  check('multi-op → 3 ops', r.operations_count === 3);
  check('multi-op → structural=2', r.structural_count === 2);
  const opened = openState(projectDir);
  check('multi-op → I renamed', opened.innerObj.proposed_tree.milestones[0].title === 'Foundation v2');
  check('multi-op → III added', opened.innerObj.proposed_tree.milestones.length === 3);
  check('multi-op → II.2 removed', opened.innerObj.proposed_tree.milestones[1].children.length === 1);
  const decisions = readDecisions(projectDir);
  check('multi-op → 2 decisions rows (III + II.2)', decisions.includes('III') && decisions.includes('II.2'));
  check('multi-op → patch NOT in decisions', !decisions.includes('Foundation v2'));
  cleanup(tmpRoot);
}
{
  // Atomic batch: validation rejects whole batch if any op is invalid
  const { projectDir, tmpRoot } = makeTempProject('atomic-reject');
  seedProposedTree(projectDir);
  const r = commitEdit(projectDir, {
    operations: [
      { kind: 'patch', target_id: 'I', body: { title: 'Foo' } },
      { kind: 'remove', target_id: 'Z' } // invalid
    ],
    confirm: true
  }, { now: FIXED_NOW });
  check('atomic reject → ok=false', r.ok === false);
  check('atomic reject → reason=invalid-operation', r.reason === 'invalid-operation');
  const opened = openState(projectDir);
  check('atomic reject → I.title unchanged', opened.innerObj.proposed_tree.milestones[0].title === 'Foundation');
  cleanup(tmpRoot);
}
{
  // Inter-op dependency rejected by design (no chained ops in one batch)
  const { projectDir, tmpRoot } = makeTempProject('inter-op-dep');
  seedProposedTree(projectDir);
  const r = commitEdit(projectDir, {
    operations: [
      { kind: 'add_milestone', body: { id: 'III', title: 'Launch' } },
      { kind: 'add_leaf', body: { id: 'III.1', title: 'X', parent_milestone_id: 'III' } } // parent doesn't exist yet
    ],
    confirm: true
  }, { now: FIXED_NOW });
  check('inter-op dep → rejected by validation', r.ok === false);
  check('inter-op dep → reason=invalid-operation', r.reason === 'invalid-operation');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 10. Two-phase commit (preview vs apply)
// ---------------------------------------------------------------------------
console.log('Two-phase commit');
{
  const { projectDir, tmpRoot } = makeTempProject('two-phase-preview');
  seedProposedTree(projectDir);
  const r = commitEdit(projectDir, { operations: [{ kind: 'patch', target_id: 'I', body: { title: 'X' } }] }, { now: FIXED_NOW });
  check('preview → ok', r.ok === true);
  check('preview → phase=preview', r.phase === 'preview');
  check('preview → applied=false', r.applied === false);
  check('preview → text has diff', r.text.includes('EDIT preview'));
  const opened = openState(projectDir);
  check('preview → tree NOT mutated', opened.innerObj.proposed_tree.milestones[0].title === 'Foundation');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('two-phase-apply');
  seedProposedTree(projectDir);
  const r = commitEdit(projectDir, { operations: [{ kind: 'patch', target_id: 'I', body: { title: 'X' } }], confirm: true }, { now: FIXED_NOW });
  check('apply → phase=apply', r.phase === 'apply');
  check('apply → applied=true', r.applied === true);
  const opened = openState(projectDir);
  check('apply → tree mutated', opened.innerObj.proposed_tree.milestones[0].title === 'X');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 11. Cache invalidation
// ---------------------------------------------------------------------------
console.log('Cache invalidation');
{
  const { projectDir, tmpRoot } = makeTempProject('cache-structural');
  seedProposedTree(projectDir);
  // Seed a fake cache file
  saveCache(projectDir, { tree: { id: 'root', children: [] }, sections: {}, frontmatter: {} });
  const cp = cachePath(projectDir);
  check('cache file exists pre-apply', fs.existsSync(cp));
  const r = commitEdit(projectDir, { operations: [{ kind: 'add_milestone', body: { id: 'III', title: 'X' } }], confirm: true }, { now: FIXED_NOW });
  check('structural apply → cache invalidation ok', r.cache_invalidation && r.cache_invalidation.ok === true);
  check('structural apply → cache file removed', !fs.existsSync(cp));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('cache-patch-only');
  seedProposedTree(projectDir);
  saveCache(projectDir, { tree: { id: 'root', children: [] }, sections: {}, frontmatter: {} });
  const cp = cachePath(projectDir);
  const r = commitEdit(projectDir, { operations: [{ kind: 'patch', target_id: 'I', body: { title: 'X' } }], confirm: true }, { now: FIXED_NOW });
  check('patch-only apply → no cache invalidation', r.cache_invalidation === null);
  check('patch-only apply → cache file intact', fs.existsSync(cp));
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 12. Decisions log content
// ---------------------------------------------------------------------------
console.log('Decisions log');
{
  const { projectDir, tmpRoot } = makeTempProject('decisions-content');
  seedProposedTree(projectDir);
  commitEdit(projectDir, {
    operations: [
      { kind: 'add_milestone', body: { id: 'III', title: 'Launch' } },
      { kind: 'remove', target_id: 'II.1' },
      { kind: 'reorder', body: { parent_id: 'I', ordered_ids: ['I.2', 'I.1'] } }
    ],
    confirm: true,
    rationale: 'restructure'
  }, { now: FIXED_NOW });
  const decisions = readDecisions(projectDir);
  check('decisions has add_milestone row', decisions.includes('Added milestone "Launch"'));
  check('decisions has remove row', decisions.includes('Removed node II.1'));
  check('decisions has reorder row', decisions.includes('Reordered children → [I.2, I.1]'));
  check('decisions has shared rationale', (decisions.match(/restructure/g) || []).length === 3);
  cleanup(tmpRoot);
}
{
  // No rationale provided → synthesized "EDIT <kind>" rationale
  const { projectDir, tmpRoot } = makeTempProject('decisions-synthesized-rationale');
  seedProposedTree(projectDir);
  commitEdit(projectDir, { operations: [{ kind: 'remove', target_id: 'I.1' }], confirm: true }, { now: FIXED_NOW });
  const decisions = readDecisions(projectDir);
  check('synthesized rationale "EDIT remove"', decisions.includes('EDIT remove'));
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 13. buildEditPlan
// ---------------------------------------------------------------------------
console.log('buildEditPlan');
{
  const { projectDir, tmpRoot } = makeTempProject('plan-no-tree');
  writePlan(projectDir, FRONT + '# Test\n');
  const r = buildEditPlan(projectDir, {});
  check('plan no tree → ok=false', r.ok === false);
  check('plan no tree → reason=no-tree', r.reason === 'no-tree');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('plan-no-plan');
  const r = buildEditPlan(projectDir, {});
  check('plan no plan → ok=false', r.ok === false);
  check('plan no plan → reason=missing-plan', r.reason === 'missing-plan');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('plan-proposed');
  seedProposedTree(projectDir);
  const r = buildEditPlan(projectDir, { text: 'reshape the dashboard' });
  check('plan proposed → ok', r.ok === true);
  check('plan proposed → tree_source=proposed', r.tree_source === 'proposed');
  check('plan proposed → milestone_count=2', r.milestone_count === 2);
  check('plan proposed → text includes edit direction', r.text.includes('reshape the dashboard'));
  check('plan proposed → lists all 5 op kinds', /patch/.test(r.text) && /add_milestone/.test(r.text) && /add_leaf/.test(r.text) && /remove/.test(r.text) && /reorder/.test(r.text));
  check('plan proposed → mentions two-phase', r.text.includes('Two-phase'));
  check('plan proposed → mentions atomic-batch limitation', r.text.includes('do NOT see each other'));
  check('plan proposed → tree dump includes I.1', r.text.includes('I.1') && r.text.includes('Auth'));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('plan-committed');
  seedCommittedTree(projectDir);
  const r = buildEditPlan(projectDir, {});
  check('plan committed → tree_source=committed', r.tree_source === 'committed');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 14. runEdit orchestrator + ovdPlan integration
// ---------------------------------------------------------------------------
console.log('runEdit + ovdPlan integration');
{
  const { projectDir, tmpRoot } = makeTempProject('orch-plan');
  seedProposedTree(projectDir);
  const r = runEdit(projectDir, {});
  check('runEdit plan-mode → ok', r.ok === true);
  check('runEdit plan-mode → mode=plan', r.mode === 'plan');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('orch-commit');
  seedProposedTree(projectDir);
  const r = runEdit(projectDir, { entries: { operations: [{ kind: 'patch', target_id: 'I', body: { title: 'X' } }], confirm: true }, now: FIXED_NOW });
  check('runEdit commit → mode=commit', r.mode === 'commit');
  check('runEdit commit → applied', r.applied === true);
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-plan');
  seedProposedTree(projectDir);
  const r = ovdPlan.runPlan({ subcommand: 'edit', projectDir }, process.env);
  check('runPlan edit plan → ok', r.ok === true);
  check('runPlan edit plan → status=edit', r.status === 'edit');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-commit-bad-json');
  seedProposedTree(projectDir);
  const r = ovdPlan.runPlan({ subcommand: 'edit', entriesJson: '{not valid}', projectDir }, process.env);
  check('runPlan edit bad JSON → ok=false', r.ok === false);
  check('runPlan edit bad JSON → text mentions Invalid', r.text.includes('Invalid --entries-json'));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-commit-ok');
  seedProposedTree(projectDir);
  const entries = { operations: [{ kind: 'patch', target_id: 'I', body: { title: 'X' } }], confirm: true };
  const r = ovdPlan.runPlan({ subcommand: 'edit', entriesJson: JSON.stringify(entries), projectDir }, process.env);
  check('runPlan edit commit → ok', r.ok === true);
  check('runPlan edit commit → status=edit', r.status === 'edit');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 15. Module-surface integration
// ---------------------------------------------------------------------------
console.log('Module surface integration');
check('ovdPlan.edit exported', !!ovdPlan.edit);
check('ovdPlan.runEdit exported', typeof ovdPlan.runEdit === 'function');
check('ovdPlan.edit.STATUS === "edit"', ovdPlan.edit.STATUS === 'edit');

// ---------------------------------------------------------------------------
// 16. Formatters
// ---------------------------------------------------------------------------
console.log('Formatters');
check('formatPlan with text', formatPlan({ text: 'hello' }) === 'hello');
check('formatPlan without text', formatPlan({}) === '(no plan text)');
check('formatCommit with text', formatCommit({ text: 'hello' }) === 'hello');
check('formatCommit without text', formatCommit({}) === '(no commit text)');

// ---------------------------------------------------------------------------
// 17. describeStructuralOpForDecisions
// ---------------------------------------------------------------------------
console.log('describeStructuralOpForDecisions');
check('add_milestone description', describeStructuralOpForDecisions({ kind: 'add_milestone', body: { id: 'III', title: 'X' } }).node === 'III');
check('add_leaf description', describeStructuralOpForDecisions({ kind: 'add_leaf', body: { id: 'I.3', title: 'X', parent_milestone_id: 'I' } }).decision.includes('under milestone I'));
check('remove description', describeStructuralOpForDecisions({ kind: 'remove', target_id: 'I' }).decision.includes('Removed node I'));
check('reorder description', describeStructuralOpForDecisions({ kind: 'reorder', body: { parent_id: 'I', ordered_ids: ['I.2', 'I.1'] } }).node === 'I');
check('reorder top-level description', describeStructuralOpForDecisions({ kind: 'reorder', body: { ordered_ids: ['II', 'I'] } }).node === '(top-level)');
check('patch returns null (non-structural)', describeStructuralOpForDecisions({ kind: 'patch', target_id: 'I' }) === null);

// ---------------------------------------------------------------------------
// 18. Locked-design pre-flight tripwires
// ---------------------------------------------------------------------------
console.log('Locked-design pre-flight tripwires');
{
  // Q3.6.3 narrative diff format (NOT unified)
  const ops = [{ kind: 'patch', target_id: 'I', body: { title: 'X' } }];
  const diff = renderNarrativeDiff(ops, tctx);
  check('Q3.6.3: bullets used', /^\s+• /m.test(diff));
  check('Q3.6.3: no @@ unified markers', !/@@/.test(diff));
}
{
  // Q3.6.5 patch NOT logged
  const { projectDir, tmpRoot } = makeTempProject('q3.6.5');
  seedProposedTree(projectDir);
  commitEdit(projectDir, { operations: [{ kind: 'patch', target_id: 'I', body: { title: 'X' } }, { kind: 'patch', target_id: 'II', body: { description: 'Y' } }], confirm: true }, { now: FIXED_NOW });
  check('Q3.6.5: patch-only batch → no decisions.md', readDecisions(projectDir) === null);
  cleanup(tmpRoot);
}
{
  // Q3.6.6 proposed wins over committed
  const opened = {
    ok: true,
    innerObj: { proposed_tree: { milestones: [{ id: 'P', title: 'Proposed' }] } },
    parsed: { tree: { children: [{ id: 'C', title: 'Committed', depth: 2 }] } }
  };
  const r = resolveTreeSource(opened);
  check('Q3.6.6: proposed wins', r.source === 'proposed');
}
{
  // FU-1 (2026-06-22): after a committed EDIT, the apply output leads with doc
  // propagation via /ovd-log (which owns DOC UPDATE), and must NOT recommend
  // re-running the codebase mappers (/ovd-workflow refresh) — mappers run once.
  const { projectDir, tmpRoot } = makeTempProject('fu1-doc-propagation');
  seedProposedTree(projectDir);
  const r = commitEdit(projectDir, { operations: [{ kind: 'patch', target_id: 'I', body: { title: 'X' } }], confirm: true }, { now: FIXED_NOW });
  check('FU-1: EDIT apply recommends /ovd-log for doc propagation', r.text.includes('/ovd-log'));
  check('FU-1: EDIT apply does NOT recommend a codebase-mapper refresh', !r.text.includes('/ovd-workflow refresh'));
  cleanup(tmpRoot);
}
{
  // Q3.3A.4 envelope shape { kind, target_id, body } preserved
  check('Q3.3A.4: KINDS uses kind enum', KINDS.length > 0 && typeof KINDS[0] === 'string');
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
