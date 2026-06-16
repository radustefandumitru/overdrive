#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const blindSpot = require('../lib/ovd-plan/blind-spot');
const {
  CATEGORIES,
  CATEGORY_KEYS,
  CATEGORY_SET,
  INSERTED_NODE_BASE_FIELDS,
  INSERTED_LEAF_EXTRA_FIELDS,
  INSERTED_MILESTONE_EXTRA_FIELDS,
  INBOX_HEADER_NA,
  INBOX_HEADER_PRUNED,
  buildBlindSpotTurn,
  buildBlindSpotInsertTurn,
  buildBlindSpotPruneTurn,
  applyBlindSpotInsert,
  applyBlindSpotPrune,
  applyBlindSpotReanalyze,
  runBlindSpot,
  formatPlan,
  formatCommit,
  validateInsertedNode,
  validateNaCategory,
  findInsertedNodes,
  isPostInsert,
  detachNode
} = blindSpot;

const ovdPlan = require('../lib/ovd-plan');
const deliberate = require('../lib/ovd-plan/deliberate');
const { parseOverdriveMd } = require('../lib/ovd-plan/parser');
const { writeOverdriveMd } = require('../lib/ovd-plan/writer');
const { readDeliberationState, openState, commitState } = require('../lib/ovd-plan/deliberation-state');

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
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-blind-spot-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
  return { projectDir, tmpRoot };
}
function cleanup(tmpRoot) { fs.rmSync(tmpRoot, { recursive: true, force: true }); }
function writePlan(projectDir, content) { fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), content); }
function readPlan(projectDir) { return fs.readFileSync(path.join(projectDir, 'OVERDRIVE.md'), 'utf8'); }

const FIXED_NOW = '2026-06-13T12:00:00.000Z';
const FIXED_NOW_2 = '2026-06-13T12:05:00.000Z';

const FRONT = '---\novd-plan: true\nversion: 3\nproject: "Test Project"\n---\n\n';

// Project with calibration + Spec'd proposed_tree (stage='blind_spot').
function seedToBlindSpot(projectDir) {
  writePlan(projectDir, FRONT + '# Test Project\n');
  deliberate.applyElicitTurn(projectDir, { answer: 'Need login + dashboard.', turn_id: 1, transition: 'spec' }, { now: FIXED_NOW });
  deliberate.applySpecTurn(projectDir, {
    milestones: [
      { id: 'I', title: 'Foundation', description: 'Auth + DB.', ambiguity_score: 2 },
      { id: 'II', title: 'Dashboard', description: 'Stats widgets.', ambiguity_score: 2 }
    ],
    transition: 'blind_spot'
  }, { now: FIXED_NOW });
}

function fullInsertPayload(extras = {}) {
  // A complete inserted_nodes + na_categories payload covering all 11 categories.
  return Object.assign({
    kind: 'insert',
    inserted_nodes: [
      {
        category: 'accessibility',
        parent_milestone_id: 'II',
        id: 'II.4',
        title: 'WCAG AA pass',
        description: 'Keyboard nav + contrast pass on dashboard.',
        scope: { in: ['src/components/'], out: [] },
        success: ['AA contrast on primary CTAs', 'Keyboard nav across nav bar'],
        verify: { method: 'axe-core', fallback: 'agent_self_check_against_success', review_required: true },
        deps: [],
        internal_analysis: 'Internal tooling UIs commonly miss WCAG basics. Concrete checks: keyboard tab order, focus-visible, contrast on buttons + text on backgrounds.',
        inserted_reason: 'Internal tooling needs WCAG AA for keyboard + screen-reader users.'
      },
      {
        category: 'security',
        parent_milestone_id: 'I',
        id: 'I.4',
        title: 'Rate limit on auth',
        description: 'Add rate limiting to login endpoints.',
        scope: { in: ['src/auth/'], out: [] },
        success: ['Login throttled at >10/min per IP'],
        verify: { method: 'integration_test', fallback: 'agent_self_check_against_success', review_required: true },
        deps: [],
        internal_analysis: 'Auth endpoints without rate limiting are an obvious abuse vector for credential-stuffing attacks.',
        inserted_reason: 'Prevent abuse on login.'
      },
      {
        category: 'observability',
        id: 'III',
        title: 'Observability',
        description: 'Logging + tracing + metrics for prod debugging.',
        ambiguity_score: 3,
        internal_analysis: 'Without observability, prod issues cannot be diagnosed without code changes. ...',
        inserted_reason: 'Need to debug prod without redeploys.'
      }
    ],
    na_categories: [
      { category: 'perf', reason: 'small internal tool, no scale concerns yet' },
      { category: 'error_handling', reason: 'mostly internal RPC; error paths handled by Slice A leaves' },
      { category: 'data', reason: 'simple Postgres; no migration complexity yet' },
      { category: 'testing', reason: 'covered by Slice A leaves explicitly' },
      { category: 'operations', reason: 'simple Vercel deploy; rollback via git' },
      { category: 'docs', reason: 'covered by Slice A leaves' },
      { category: 'user_facing', reason: 'covered by Slice A leaves' },
      { category: 'compliance', reason: 'hobby project, no PII / regulated data' }
    ]
  }, extras);
}

// ===========================================================================
// Module surface
// ===========================================================================
console.log('module surface');
check('exports CATEGORIES (array)', Array.isArray(CATEGORIES));
check('CATEGORIES has 11 entries', CATEGORIES.length === 11);
check('exports CATEGORY_KEYS', Array.isArray(CATEGORY_KEYS) && CATEGORY_KEYS.length === 11);
check('exports CATEGORY_SET (Set)', CATEGORY_SET instanceof Set);
check('CATEGORY_SET size 11', CATEGORY_SET.size === 11);
const expectedKeys = ['security', 'perf', 'accessibility', 'observability', 'error_handling', 'data', 'testing', 'operations', 'docs', 'user_facing', 'compliance'];
for (const k of expectedKeys) check(`CATEGORIES includes "${k}"`, CATEGORY_SET.has(k));
// Each entry has full shape
for (const cat of CATEGORIES) {
  check(`category ${cat.key}: has prompt`, typeof cat.prompt === 'string' && cat.prompt.length > 10);
  check(`category ${cat.key}: has when_applicable`, typeof cat.when_applicable === 'string' && cat.when_applicable.length > 10);
  check(`category ${cat.key}: example_inserted_nodes array`, Array.isArray(cat.example_inserted_nodes) && cat.example_inserted_nodes.length >= 2);
}
check('exports INSERTED_NODE_BASE_FIELDS', Array.isArray(INSERTED_NODE_BASE_FIELDS) && INSERTED_NODE_BASE_FIELDS.includes('category') && INSERTED_NODE_BASE_FIELDS.includes('internal_analysis') && INSERTED_NODE_BASE_FIELDS.includes('inserted_reason'));
check('exports INSERTED_LEAF_EXTRA_FIELDS', Array.isArray(INSERTED_LEAF_EXTRA_FIELDS) && INSERTED_LEAF_EXTRA_FIELDS.includes('scope') && INSERTED_LEAF_EXTRA_FIELDS.includes('verify'));
check('exports INSERTED_MILESTONE_EXTRA_FIELDS', Array.isArray(INSERTED_MILESTONE_EXTRA_FIELDS) && INSERTED_MILESTONE_EXTRA_FIELDS.includes('id'));
check('exports INBOX_HEADER_NA', typeof INBOX_HEADER_NA === 'string' && /N\/A/.test(INBOX_HEADER_NA));
check('exports INBOX_HEADER_PRUNED', typeof INBOX_HEADER_PRUNED === 'string' && /pruned/.test(INBOX_HEADER_PRUNED));
check('exports buildBlindSpotTurn', typeof buildBlindSpotTurn === 'function');
check('exports buildBlindSpotInsertTurn', typeof buildBlindSpotInsertTurn === 'function');
check('exports buildBlindSpotPruneTurn', typeof buildBlindSpotPruneTurn === 'function');
check('exports applyBlindSpotInsert', typeof applyBlindSpotInsert === 'function');
check('exports applyBlindSpotPrune', typeof applyBlindSpotPrune === 'function');
check('exports applyBlindSpotReanalyze', typeof applyBlindSpotReanalyze === 'function');
check('exports runBlindSpot', typeof runBlindSpot === 'function');
check('exports formatPlan', typeof formatPlan === 'function');
check('exports formatCommit', typeof formatCommit === 'function');
check('exports validateInsertedNode', typeof validateInsertedNode === 'function');
check('exports validateNaCategory', typeof validateNaCategory === 'function');
check('exports findInsertedNodes', typeof findInsertedNodes === 'function');
check('exports isPostInsert', typeof isPostInsert === 'function');
check('exports detachNode', typeof detachNode === 'function');

// ===========================================================================
// Helpers
// ===========================================================================
console.log('helpers');
check('isPostInsert false on empty', isPostInsert({}) === false);
check('isPostInsert false on missing flag', isPostInsert({ stage: 'blind_spot' }) === false);
check('isPostInsert true when blind_spot_inserted=true', isPostInsert({ blind_spot_inserted: true }) === true);
check('isPostInsert false on blind_spot_inserted=false', isPostInsert({ blind_spot_inserted: false }) === false);

{
  const tree = { milestones: [
    { id: 'I', title: 'F', children: [{ id: 'I.1', title: 'leaf' }] },
    { id: 'II', title: 'D', inserted_by: 'agent', category: 'obs', children: [] },
    { id: 'III', title: 'X', children: [{ id: 'III.1', title: 'agent-leaf', inserted_by: 'agent', category: 'security' }] }
  ]};
  const found = findInsertedNodes(tree);
  check('findInsertedNodes finds 2 inserted nodes', found.length === 2);
  check('findInsertedNodes: milestone id II', found.find((n) => n.id === 'II'));
  check('findInsertedNodes: leaf id III.1', found.find((n) => n.id === 'III.1'));
  check('findInsertedNodes: leaf kind is "leaf"', found.find((n) => n.id === 'III.1').kind === 'leaf');
  check('findInsertedNodes: milestone kind is "milestone"', found.find((n) => n.id === 'II').kind === 'milestone');
  check('findInsertedNodes: leaf has parent_milestone_id', found.find((n) => n.id === 'III.1').parent_milestone_id === 'III');
}

// ===========================================================================
// Validation: validateInsertedNode
// ===========================================================================
console.log('validateInsertedNode');
{
  const milestoneIds = new Set(['I', 'II']);
  // Happy depth-3 leaf
  const goodLeaf = {
    category: 'security',
    parent_milestone_id: 'I',
    id: 'I.x',
    title: 'Rate limit',
    description: 'desc',
    scope: { in: ['src/'], out: [] },
    success: ['s'],
    verify: { method: 'm', fallback: 'f', review_required: true },
    deps: [],
    internal_analysis: 'analysis',
    inserted_reason: 'reason'
  };
  check('validateInsertedNode accepts good leaf', validateInsertedNode(goodLeaf, 0, milestoneIds) === null);
  // Happy depth-2 milestone
  const goodMilestone = {
    category: 'observability',
    id: 'III',
    title: 'Obs',
    description: 'desc',
    internal_analysis: 'analysis',
    inserted_reason: 'reason'
  };
  check('validateInsertedNode accepts good milestone', validateInsertedNode(goodMilestone, 0, milestoneIds) === null);

  // Rejections
  check('rejects null', /must be an object/.test(validateInsertedNode(null, 0, milestoneIds)));
  check('rejects array', /must be an object/.test(validateInsertedNode([], 0, milestoneIds)));
  check('rejects missing category', /missing required field: category/.test(validateInsertedNode({ title: 't', description: 'd', internal_analysis: 'a', inserted_reason: 'r' }, 0, milestoneIds)));
  check('rejects invalid category', /category must be one of/.test(validateInsertedNode(Object.assign({}, goodMilestone, { category: 'invalid' }), 0, milestoneIds)));
  check('rejects empty title', /title must be/.test(validateInsertedNode(Object.assign({}, goodMilestone, { title: '   ' }), 0, milestoneIds)));
  check('rejects empty description', /description must be/.test(validateInsertedNode(Object.assign({}, goodMilestone, { description: '   ' }), 0, milestoneIds)));
  check('rejects empty internal_analysis', /internal_analysis must be/.test(validateInsertedNode(Object.assign({}, goodMilestone, { internal_analysis: '   ' }), 0, milestoneIds)));
  check('rejects empty inserted_reason', /inserted_reason must be/.test(validateInsertedNode(Object.assign({}, goodMilestone, { inserted_reason: '   ' }), 0, milestoneIds)));
  // Depth-3 specific rejections
  check('rejects unknown parent_milestone_id', /parent_milestone_id.*not found/.test(validateInsertedNode(Object.assign({}, goodLeaf, { parent_milestone_id: 'XX' }), 0, milestoneIds)));
  check('rejects leaf missing scope', /missing required field: scope/.test(validateInsertedNode(Object.assign({}, goodLeaf, { scope: undefined }), 0, milestoneIds)));
  check('rejects leaf missing success', /missing required field: success/.test(validateInsertedNode(Object.assign({}, goodLeaf, { success: undefined }), 0, milestoneIds)));
  check('rejects leaf missing verify', /missing required field: verify/.test(validateInsertedNode(Object.assign({}, goodLeaf, { verify: undefined }), 0, milestoneIds)));
  check('rejects leaf missing deps', /missing required field: deps/.test(validateInsertedNode(Object.assign({}, goodLeaf, { deps: undefined }), 0, milestoneIds)));
  check('rejects leaf scope without in', /scope\.in must be/.test(validateInsertedNode(Object.assign({}, goodLeaf, { scope: { out: [] } }), 0, milestoneIds)));
  check('rejects leaf scope without out', /scope\.out must be/.test(validateInsertedNode(Object.assign({}, goodLeaf, { scope: { in: [] } }), 0, milestoneIds)));
  check('rejects leaf empty success', /success must be a non-empty/.test(validateInsertedNode(Object.assign({}, goodLeaf, { success: [] }), 0, milestoneIds)));
  check('rejects leaf verify missing review_required', /review_required must be a boolean/.test(validateInsertedNode(Object.assign({}, goodLeaf, { verify: { method: 'm', fallback: 'f' } }), 0, milestoneIds)));
  // Depth-2 specific rejections (id-collision is handled by the post-check at apply-time
  // for uniform treatment of milestone + leaf collisions — covered by "reject duplicate-id
  // with tree" below).
  check('accepts milestone id collision at validateInsertedNode level (post-check handles)', validateInsertedNode(Object.assign({}, goodMilestone, { id: 'I' }), 0, milestoneIds) === null);
  check('rejects milestone bad ambiguity_score', /ambiguity_score must be/.test(validateInsertedNode(Object.assign({}, goodMilestone, { ambiguity_score: 6 }), 0, milestoneIds)));
}

// ===========================================================================
// Validation: validateNaCategory
// ===========================================================================
console.log('validateNaCategory');
check('validateNaCategory accepts good', validateNaCategory({ category: 'compliance', reason: 'hobby project' }, 0) === null);
check('validateNaCategory rejects null', /must be an object/.test(validateNaCategory(null, 0)));
check('validateNaCategory rejects bad category', /one of:/.test(validateNaCategory({ category: 'xx', reason: 'r' }, 0)));
check('validateNaCategory rejects empty reason', /reason must be/.test(validateNaCategory({ category: 'compliance', reason: '   ' }, 0)));

// ===========================================================================
// buildBlindSpotTurn — plan mode (insert phase)
// ===========================================================================
console.log('buildBlindSpotTurn — insert phase');
{
  const { projectDir, tmpRoot } = makeTempProject('plan-missing');
  const r = buildBlindSpotTurn(projectDir);
  check('missing-plan: ok=false', r.ok === false);
  check('missing-plan: reason', r.reason === 'missing-plan');
  cleanup(tmpRoot);
}
{
  // Fresh project — no proposed_tree
  const { projectDir, tmpRoot } = makeTempProject('plan-no-tree');
  writePlan(projectDir, FRONT + '# Test Project\n');
  const r = buildBlindSpotTurn(projectDir);
  check('no-proposed-tree: ok=false', r.ok === false);
  check('no-proposed-tree: reason', r.reason === 'no-proposed-tree');
  check('no-proposed-tree: text guides recovery', /Spec\'?d?/.test(r.text) || /Spec/.test(r.text));
  cleanup(tmpRoot);
}
{
  // Properly seeded — insert phase
  const { projectDir, tmpRoot } = makeTempProject('plan-insert');
  seedToBlindSpot(projectDir);
  const r = buildBlindSpotTurn(projectDir);
  check('insert: ok=true', r.ok === true);
  check('insert: phase=insert', r.phase === 'insert');
  check('insert: stage=blind_spot', r.stage === 'blind_spot');
  check('insert: categories array', Array.isArray(r.categories) && r.categories.length === 11);
  check('insert: milestones list', Array.isArray(r.milestones) && r.milestones.length === 2);
  check('insert: text mentions all 11 categories', expectedKeys.every((k) => r.text.includes(k)));
  check('insert: text mentions milestone IDs', /I  Foundation/.test(r.text) && /II  Dashboard/.test(r.text));
  check('insert: text instructs no silent skips', /No silent skips|MUST appear/.test(r.text));
  check('insert: text shows commit syntax', /--entries-json/.test(r.text) && /"kind":"insert"/.test(r.text));
  cleanup(tmpRoot);
}
{
  // Insert phase: status='blind-spot' envelope
  const { projectDir, tmpRoot } = makeTempProject('plan-status');
  seedToBlindSpot(projectDir);
  const r = buildBlindSpotTurn(projectDir);
  check('envelope: status=blind-spot', r.status === 'blind-spot');
  cleanup(tmpRoot);
}

// ===========================================================================
// applyBlindSpotInsert — validation rejections
// ===========================================================================
console.log('applyBlindSpotInsert — validation');
{
  const { projectDir, tmpRoot } = makeTempProject('insert-validation');
  seedToBlindSpot(projectDir);
  let r;
  r = applyBlindSpotInsert(projectDir, null);
  check('reject null', r.ok === false && r.reason === 'invalid-shape');
  r = applyBlindSpotInsert(projectDir, []);
  check('reject array', r.ok === false && r.reason === 'invalid-shape');
  r = applyBlindSpotInsert(projectDir, { kind: 'foo' });
  check('reject invalid kind', r.ok === false && r.reason === 'invalid-kind');
  r = applyBlindSpotInsert(projectDir, { kind: 'insert' });
  check('reject missing inserted_nodes', r.ok === false && r.reason === 'invalid-shape');
  r = applyBlindSpotInsert(projectDir, { kind: 'insert', inserted_nodes: [] });
  check('reject missing na_categories', r.ok === false && r.reason === 'invalid-shape');
  r = applyBlindSpotInsert(projectDir, { kind: 'insert', inserted_nodes: [], na_categories: [] });
  check('reject category-coverage (empty)', r.ok === false && r.reason === 'category-coverage');
  // Partial coverage rejection
  r = applyBlindSpotInsert(projectDir, { kind: 'insert', inserted_nodes: [], na_categories: [{ category: 'security', reason: 'x' }] });
  check('reject category-coverage (partial)', r.ok === false && r.reason === 'category-coverage' && /missing/.test(r.text));
  cleanup(tmpRoot);
}
{
  // Per-inserted-node validation surfaces
  const { projectDir, tmpRoot } = makeTempProject('insert-leaf-validation');
  seedToBlindSpot(projectDir);
  const payload = fullInsertPayload();
  payload.inserted_nodes[0].category = 'invalid_cat';
  let r = applyBlindSpotInsert(projectDir, payload);
  check('reject invalid-inserted-node category', r.ok === false && r.reason === 'invalid-inserted-node');
  cleanup(tmpRoot);
}
{
  // Per-na validation surfaces
  const { projectDir, tmpRoot } = makeTempProject('insert-na-validation');
  seedToBlindSpot(projectDir);
  const payload = fullInsertPayload();
  payload.na_categories[0].category = 'bad';
  let r = applyBlindSpotInsert(projectDir, payload);
  check('reject invalid-na-category', r.ok === false && r.reason === 'invalid-na-category');
  cleanup(tmpRoot);
}
{
  // Duplicate ID across inserted_nodes
  const { projectDir, tmpRoot } = makeTempProject('insert-dup-id-payload');
  seedToBlindSpot(projectDir);
  const payload = fullInsertPayload();
  payload.inserted_nodes[1].id = payload.inserted_nodes[0].id;
  let r = applyBlindSpotInsert(projectDir, payload);
  check('reject duplicate-id within payload', r.ok === false && r.reason === 'duplicate-id');
  cleanup(tmpRoot);
}
{
  // Inserted ID collides with existing tree
  const { projectDir, tmpRoot } = makeTempProject('insert-dup-id-tree');
  seedToBlindSpot(projectDir);
  const payload = fullInsertPayload();
  payload.inserted_nodes[2].id = 'I'; // collide with milestone I
  let r = applyBlindSpotInsert(projectDir, payload);
  check('reject duplicate-id with tree', r.ok === false && r.reason === 'duplicate-id');
  cleanup(tmpRoot);
}
{
  // Stage mismatch
  const { projectDir, tmpRoot } = makeTempProject('insert-stage-mismatch');
  writePlan(projectDir, FRONT + '# Test Project\n');
  // Stage is implicit elicit (no block)
  let r = applyBlindSpotInsert(projectDir, fullInsertPayload());
  check('reject stage-mismatch (elicit)', r.ok === false && r.reason === 'stage-mismatch');
  cleanup(tmpRoot);
}
{
  // Already-inserted
  const { projectDir, tmpRoot } = makeTempProject('insert-already');
  seedToBlindSpot(projectDir);
  let r = applyBlindSpotInsert(projectDir, fullInsertPayload(), { now: FIXED_NOW });
  check('first insert ok', r.ok === true);
  r = applyBlindSpotInsert(projectDir, fullInsertPayload(), { now: FIXED_NOW_2 });
  check('reject already-inserted on second call', r.ok === false && r.reason === 'already-inserted');
  cleanup(tmpRoot);
}

// ===========================================================================
// applyBlindSpotInsert — happy path
// ===========================================================================
console.log('applyBlindSpotInsert — happy');
{
  const { projectDir, tmpRoot } = makeTempProject('insert-happy');
  seedToBlindSpot(projectDir);
  const payload = fullInsertPayload();
  const r = applyBlindSpotInsert(projectDir, payload, { now: FIXED_NOW });
  check('happy: ok=true', r.ok === true);
  check('happy: phase=insert', r.phase === 'insert');
  check('happy: stage=blind_spot', r.stage === 'blind_spot');
  check('happy: insertedCount=3', r.insertedCount === 3);
  check('happy: naCount=8', r.naCount === 8);
  // Persisted state
  const persisted = readDeliberationState(projectDir);
  check('persisted: blind_spot_inserted=true', persisted.blind_spot_inserted === true);
  check('persisted: stage still blind_spot', persisted.stage === 'blind_spot');
  // Tree mutations
  const tree = persisted.proposed_tree;
  check('persisted: 3 milestones (was 2, +1 new III)', tree.milestones.length === 3);
  const milestoneIII = tree.milestones.find((m) => m.id === 'III');
  check('persisted: milestone III inserted', !!milestoneIII);
  check('persisted: milestone III inserted_by=agent', milestoneIII.inserted_by === 'agent');
  check('persisted: milestone III category=observability', milestoneIII.category === 'observability');
  check('persisted: milestone III has internal_analysis', typeof milestoneIII.internal_analysis === 'string' && milestoneIII.internal_analysis.length > 0);
  check('persisted: milestone III has inserted_reason', typeof milestoneIII.inserted_reason === 'string');
  // Leaves added under I and II
  const milestoneI = tree.milestones.find((m) => m.id === 'I');
  const milestoneII = tree.milestones.find((m) => m.id === 'II');
  check('persisted: milestone I has 1 child', Array.isArray(milestoneI.children) && milestoneI.children.length === 1);
  check('persisted: milestone II has 1 child', Array.isArray(milestoneII.children) && milestoneII.children.length === 1);
  check('persisted: leaf I.4 category=security', milestoneI.children[0].category === 'security');
  check('persisted: leaf I.4 inserted_by=agent', milestoneI.children[0].inserted_by === 'agent');
  check('persisted: leaf I.4 has scope.in', Array.isArray(milestoneI.children[0].scope.in));
  check('persisted: leaf I.4 has success', Array.isArray(milestoneI.children[0].success));
  check('persisted: leaf I.4 has verify.review_required', milestoneI.children[0].verify.review_required === true);
  check('persisted: leaf I.4 internal_analysis preserved', /credential-stuffing/.test(milestoneI.children[0].internal_analysis));
  // Sibling preservation
  check('persisted: calibration sibling absent (none was set, ok)', !persisted.calibration || typeof persisted.calibration === 'object');
  check('persisted: answered_questions preserved', Array.isArray(persisted.answered_questions) && persisted.answered_questions.length === 1);
  // Tree revision bumped
  check('persisted: last_revision=2', tree.last_revision === 2);
  // Inbox written
  const inboxContent = parseOverdriveMd(readPlan(projectDir)).sections.inbox || '';
  check('inbox: has N/A header', inboxContent.includes(INBOX_HEADER_NA));
  check('inbox: lists perf N/A', /perf/.test(inboxContent));
  check('inbox: lists compliance N/A', /compliance/.test(inboxContent));
  cleanup(tmpRoot);
}

// ===========================================================================
// buildBlindSpotTurn — prune phase (post-insert)
// ===========================================================================
console.log('buildBlindSpotTurn — prune phase');
{
  const { projectDir, tmpRoot } = makeTempProject('plan-prune');
  seedToBlindSpot(projectDir);
  applyBlindSpotInsert(projectDir, fullInsertPayload(), { now: FIXED_NOW });
  const r = buildBlindSpotTurn(projectDir);
  check('prune: ok=true', r.ok === true);
  check('prune: phase=prune', r.phase === 'prune');
  check('prune: insertedNodes array', Array.isArray(r.insertedNodes));
  check('prune: 3 inserted nodes listed', r.insertedNodes.length === 3);
  check('prune: text mentions [proposed-by-agent:] tag', /\[proposed-by-agent:/.test(r.text));
  check('prune: text mentions all 3 inserted IDs', /II\.4/.test(r.text) && /I\.4/.test(r.text) && /III/.test(r.text));
  check('prune: action paths present', /\(1\) Approve all/.test(r.text) && /\(2\) Prune/.test(r.text) && /\(3\) Re-analyze/.test(r.text));
  check('prune: describe-other escape', /describe other/i.test(r.text));
  cleanup(tmpRoot);
}
{
  // Prune phase with zero inserted nodes (all categories N/A)
  const { projectDir, tmpRoot } = makeTempProject('plan-prune-empty');
  seedToBlindSpot(projectDir);
  // All-N/A payload
  const payload = { kind: 'insert', inserted_nodes: [], na_categories: CATEGORY_KEYS.map((k) => ({ category: k, reason: 'not applicable' })) };
  const insertResult = applyBlindSpotInsert(projectDir, payload, { now: FIXED_NOW });
  check('all-NA: insert ok', insertResult.ok === true);
  const r = buildBlindSpotTurn(projectDir);
  check('all-NA: prune phase active', r.phase === 'prune');
  check('all-NA: zero inserted nodes', r.insertedNodes.length === 0);
  check('all-NA: text shows none-inserted message', /no nodes were inserted|none/i.test(r.text));
  cleanup(tmpRoot);
}

// ===========================================================================
// applyBlindSpotPrune
// ===========================================================================
console.log('applyBlindSpotPrune');
{
  // Validation rejections
  const { projectDir, tmpRoot } = makeTempProject('prune-validation');
  seedToBlindSpot(projectDir);
  applyBlindSpotInsert(projectDir, fullInsertPayload(), { now: FIXED_NOW });
  let r;
  r = applyBlindSpotPrune(projectDir, null);
  check('reject null', r.ok === false && r.reason === 'invalid-shape');
  r = applyBlindSpotPrune(projectDir, { kind: 'foo' });
  check('reject invalid kind', r.ok === false && r.reason === 'invalid-kind');
  r = applyBlindSpotPrune(projectDir, { kind: 'prune' });
  check('reject missing approved_ids', r.ok === false && r.reason === 'invalid-shape');
  r = applyBlindSpotPrune(projectDir, { kind: 'prune', approved_ids: [] });
  check('reject missing pruned_ids', r.ok === false && r.reason === 'invalid-shape');
  r = applyBlindSpotPrune(projectDir, { kind: 'prune', approved_ids: ['I.4', 'II.4'], pruned_ids: ['XX'] });
  check('reject unknown id', r.ok === false && r.reason === 'unknown-id');
  r = applyBlindSpotPrune(projectDir, { kind: 'prune', approved_ids: ['I.4', 'I.4', 'II.4', 'III'], pruned_ids: [] });
  check('reject duplicate id', r.ok === false && r.reason === 'duplicate-id');
  r = applyBlindSpotPrune(projectDir, { kind: 'prune', approved_ids: ['I.4', 'II.4'], pruned_ids: [] });
  check('reject incomplete-coverage (III missing)', r.ok === false && r.reason === 'incomplete-coverage');
  cleanup(tmpRoot);
}
{
  // not-post-insert: prune before insert
  const { projectDir, tmpRoot } = makeTempProject('prune-not-post-insert');
  seedToBlindSpot(projectDir);
  const r = applyBlindSpotPrune(projectDir, { kind: 'prune', approved_ids: [], pruned_ids: [] });
  check('reject not-post-insert', r.ok === false && r.reason === 'not-post-insert');
  cleanup(tmpRoot);
}
{
  // Happy: approve all
  const { projectDir, tmpRoot } = makeTempProject('prune-approve-all');
  seedToBlindSpot(projectDir);
  applyBlindSpotInsert(projectDir, fullInsertPayload(), { now: FIXED_NOW });
  const r = applyBlindSpotPrune(projectDir, { kind: 'prune', approved_ids: ['I.4', 'II.4', 'III'], pruned_ids: [] }, { now: FIXED_NOW_2 });
  check('approve-all: ok=true', r.ok === true);
  check('approve-all: stage=plan', r.stage === 'plan');
  check('approve-all: transitioned', r.transitioned === true);
  check('approve-all: approvedCount=3', r.approvedCount === 3);
  check('approve-all: prunedCount=0', r.prunedCount === 0);
  // Persisted
  const persisted = readDeliberationState(projectDir);
  check('persisted: stage=plan', persisted.stage === 'plan');
  check('persisted: blind_spot_inserted cleared', !('blind_spot_inserted' in persisted) || persisted.blind_spot_inserted === undefined);
  // Tree unchanged (no pruned)
  const tree = persisted.proposed_tree;
  check('persisted: tree still has 3 milestones', tree.milestones.length === 3);
  cleanup(tmpRoot);
}
{
  // Happy: prune some
  const { projectDir, tmpRoot } = makeTempProject('prune-some');
  seedToBlindSpot(projectDir);
  applyBlindSpotInsert(projectDir, fullInsertPayload(), { now: FIXED_NOW });
  const r = applyBlindSpotPrune(projectDir, { kind: 'prune', approved_ids: ['I.4', 'II.4'], pruned_ids: ['III'] }, { now: FIXED_NOW_2 });
  check('prune-some: ok=true', r.ok === true);
  check('prune-some: prunedCount=1', r.prunedCount === 1);
  // Tree: III milestone removed
  const persisted = readDeliberationState(projectDir);
  check('prune-some: milestone III detached', !persisted.proposed_tree.milestones.find((m) => m.id === 'III'));
  check('prune-some: tree now has 2 milestones', persisted.proposed_tree.milestones.length === 2);
  // Inbox has pruned record with internal_analysis preserved
  const inboxContent = parseOverdriveMd(readPlan(projectDir)).sections.inbox || '';
  check('inbox: pruned header present', inboxContent.includes(INBOX_HEADER_PRUNED));
  check('inbox: pruned III tagged user-pruned-at', /user-pruned-at/.test(inboxContent));
  check('inbox: pruned III shows category', /observability/.test(inboxContent));
  check('inbox: pruned III internal_analysis preserved', /diagnosed without code changes|observability/.test(inboxContent));
  // Leaf preserved approved IDs still under their milestones
  const persistedI = persisted.proposed_tree.milestones.find((m) => m.id === 'I');
  check('prune-some: approved leaf I.4 still attached', persistedI.children.length === 1 && persistedI.children[0].id === 'I.4');
  cleanup(tmpRoot);
}

// ===========================================================================
// applyBlindSpotReanalyze
// ===========================================================================
console.log('applyBlindSpotReanalyze');
{
  const { projectDir, tmpRoot } = makeTempProject('reanalyze-happy');
  seedToBlindSpot(projectDir);
  applyBlindSpotInsert(projectDir, fullInsertPayload(), { now: FIXED_NOW });
  const r = applyBlindSpotReanalyze(projectDir, { kind: 're-analyze' }, { now: FIXED_NOW_2 });
  check('reanalyze: ok=true', r.ok === true);
  check('reanalyze: stage stays blind_spot', r.stage === 'blind_spot');
  check('reanalyze: discardedCount=3', r.discardedCount === 3);
  // Persisted: tree back to 2 milestones, blind_spot_inserted cleared
  const persisted = readDeliberationState(projectDir);
  check('reanalyze: tree back to 2 milestones', persisted.proposed_tree.milestones.length === 2);
  check('reanalyze: blind_spot_inserted cleared', !persisted.blind_spot_inserted);
  cleanup(tmpRoot);
}
{
  // Reanalyze without prior insert
  const { projectDir, tmpRoot } = makeTempProject('reanalyze-not-post-insert');
  seedToBlindSpot(projectDir);
  const r = applyBlindSpotReanalyze(projectDir, { kind: 're-analyze' });
  check('reanalyze: reject not-post-insert', r.ok === false && r.reason === 'not-post-insert');
  cleanup(tmpRoot);
}

// ===========================================================================
// runBlindSpot orchestrator + ovdPlan.runPlan dispatch + Pattern 4 guard
// ===========================================================================
console.log('runBlindSpot orchestrator');
{
  const { projectDir, tmpRoot } = makeTempProject('orch-plan');
  seedToBlindSpot(projectDir);
  const r = runBlindSpot(projectDir);
  check('orchestrator plan: ok=true', r.ok === true);
  check('orchestrator plan: phase=insert', r.phase === 'insert');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('orch-commit-insert');
  seedToBlindSpot(projectDir);
  const r = runBlindSpot(projectDir, { mode: 'commit', entries: fullInsertPayload(), now: FIXED_NOW });
  check('orchestrator commit insert: ok=true', r.ok === true && r.phase === 'insert');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('orch-bad-kind');
  seedToBlindSpot(projectDir);
  const r = runBlindSpot(projectDir, { mode: 'commit', entries: { kind: 'something' } });
  check('orchestrator: reject invalid kind', r.ok === false && r.reason === 'invalid-kind');
  cleanup(tmpRoot);
}
{
  // Pattern 4 JSON guard via ovdPlan.runPlan
  const { projectDir, tmpRoot } = makeTempProject('runPlan-bad-json');
  seedToBlindSpot(projectDir);
  const before = readPlan(projectDir);
  const r = ovdPlan.runPlan({ subcommand: 'blind-spot', projectDir, entriesJson: '{not json' });
  check('runPlan blind-spot bad JSON: rejected', r.ok === false);
  check('runPlan blind-spot bad JSON: status=blind-spot', r.status === 'blind-spot');
  check('runPlan blind-spot bad JSON: reason mentions JSON', /JSON/.test(r.reason));
  const after = readPlan(projectDir);
  check('Pattern 4: no write on bad JSON', before === after);
  cleanup(tmpRoot);
}
{
  // ovdPlan.runPlan plan mode
  const { projectDir, tmpRoot } = makeTempProject('runPlan-plan');
  seedToBlindSpot(projectDir);
  const r = ovdPlan.runPlan({ subcommand: 'blind-spot', projectDir });
  check('runPlan blind-spot plan: ok=true', r.ok === true && r.mode === 'plan');
  cleanup(tmpRoot);
}

// ===========================================================================
// Integration: full insert + prune cycle through Stage 5/7/8 commit
// ===========================================================================
console.log('integration');
{
  const { projectDir, tmpRoot } = makeTempProject('integration');
  seedToBlindSpot(projectDir);
  // 1. Insert
  let r = applyBlindSpotInsert(projectDir, fullInsertPayload(), { now: FIXED_NOW });
  check('int: insert ok', r.ok === true);
  // 2. Prune — approve I.4 + II.4 + III, none pruned
  r = applyBlindSpotPrune(projectDir, { kind: 'prune', approved_ids: ['I.4', 'II.4', 'III'], pruned_ids: [] }, { now: FIXED_NOW });
  check('int: prune ok, stage=plan', r.ok === true && r.stage === 'plan');
  // 3. Stage 5 Plan for milestone I — agent-inserted child I.4 is preserved + new leaf I.1 appended
  r = deliberate.applyPlanTurn(projectDir, {
    milestone_id: 'I',
    leaves: [{
      id: 'I.1', title: 'Set up auth',
      description: 'Wire Supabase auth client into the app.',
      scope: { in: ['src/auth/'], out: [] },
      success: ['Login works'],
      verify: { method: 'integration_test', fallback: 'agent_self_check_against_success', review_required: true },
      deps: []
    }]
  }, { now: FIXED_NOW });
  check('int: Plan I ok', r.ok === true);
  const afterPlanI = readDeliberationState(projectDir);
  const milestoneI = afterPlanI.proposed_tree.milestones.find((m) => m.id === 'I');
  check('int: milestone I has 2 children (1 agent-inserted + 1 user-planned)', milestoneI.children.length === 2);
  check('int: milestone I preserves agent-inserted I.4', milestoneI.children.find((c) => c.id === 'I.4'));
  check('int: milestone I has user-planned I.1', milestoneI.children.find((c) => c.id === 'I.1'));
  check('int: agent-inserted preserved inserted_by', milestoneI.children.find((c) => c.id === 'I.4').inserted_by === 'agent');
  // 4. Plan II and III
  deliberate.applyPlanTurn(projectDir, {
    milestone_id: 'II',
    leaves: [{ id: 'II.1', title: 'L', description: 'd', scope: { in: ['x'], out: [] }, success: ['s'], verify: { method: 'm', fallback: 'f', review_required: true }, deps: [] }]
  }, { now: FIXED_NOW });
  r = deliberate.applyPlanTurn(projectDir, {
    milestone_id: 'III',
    leaves: [{ id: 'III.1', title: 'L', description: 'd', scope: { in: ['x'], out: [] }, success: ['s'], verify: { method: 'm', fallback: 'f', review_required: true }, deps: [] }],
    transition: 'plan_skills'
  }, { now: FIXED_NOW });
  check('int: Plan III → plan_skills ok (Slice B sub-step)', r.ok === true && r.stage === 'plan_skills');
  // 4.5. Skip Stage 5.5 RESOLVE SKILLS — plan-skills.js owns its own full-cycle tests.
  // Bulk-clear pending_skill_resolution + advance stage to 'present' via direct state mutation.
  {
    const { openState, commitState } = require('../lib/ovd-plan/deliberation-state');
    const op = openState(projectDir);
    const t = op.innerObj.proposed_tree;
    for (const m of t.milestones) {
      if (Array.isArray(m.children)) {
        for (const lf of m.children) {
          if (lf) delete lf.pending_skill_resolution;
        }
      }
    }
    op.innerObj.stage = 'present';
    commitState(projectDir, op);
  }
  // 5. Present approve → commit
  r = deliberate.applyPresentTurn(projectDir, { kind: 'approve' }, { now: FIXED_NOW });
  check('int: present approve → commit', r.ok === true && r.stage === 'commit');
  // 6. Stage 8 commit (Slice A): write tree to OVERDRIVE.md
  r = deliberate.applyCommitTurn(projectDir, { kind: 'commit' }, { now: FIXED_NOW });
  check('int: stage 8 commit ok', r.ok === true && r.stage === 'committed');
  // 7. Parse final tree — verify agent-inserted leaf retained its blind-spot annotations.
  // Note: the parser auto-renumbers IDs by position (so the blind-spot's "I.4" becomes "I.1"
  // after round-trip). Lookup by annotation-based finder is more robust.
  const parsed = parseOverdriveMd(readPlan(projectDir));
  const treeI = parsed.tree.children.find((m) => m.id === 'I');
  check('int: tree.children includes milestone I', !!treeI);
  const leafSec = (treeI.children || []).find((c) => c.annotations && c.annotations.inserted_by === 'agent');
  check('int: tree has agent-inserted leaf under milestone I', !!leafSec);
  check('int: agent-inserted leaf annotations.inserted_by=agent', leafSec.annotations.inserted_by === 'agent');
  check('int: agent-inserted leaf annotations.inserted_reason preserved', typeof leafSec.annotations.inserted_reason === 'string' && leafSec.annotations.inserted_reason.length > 0);
  check('int: agent-inserted leaf annotations.category=security (Q3.4.7 additive)', leafSec.annotations.category === 'security');
  check('int: agent-inserted leaf annotations.internal_analysis preserved (Q3.4.7 additive)', typeof leafSec.annotations.internal_analysis === 'string' && /credential-stuffing/.test(leafSec.annotations.internal_analysis));
  // Slice B seam: pending_skill_resolution is the placeholder Slice A + Task 3.4 write;
  // Stage 5.5 (Slice B) clears it when resolution lands. In this integration test, the
  // 4.5 skipPlanSkills block clears the flag uniformly across user-planned and agent-inserted leaves.
  check('int: agent-inserted leaf no longer pending_skill_resolution (cleared by 5.5)', !('pending_skill_resolution' in leafSec.annotations));
  // Tree has milestone III (new agent-inserted milestone)
  const treeIII = parsed.tree.children.find((m) => m.annotations && m.annotations.inserted_by === 'agent');
  check('int: tree.children includes new agent-inserted milestone', !!treeIII);
  check('int: agent-inserted milestone annotations.inserted_by=agent', treeIII.annotations.inserted_by === 'agent');
  check('int: agent-inserted milestone annotations.category preserved', treeIII.annotations.category === 'observability');
  cleanup(tmpRoot);
}

// ===========================================================================
// Migration-compat seam (no block, fresh project — proper error envelope, no write)
// ===========================================================================
console.log('migration-compat');
{
  const { projectDir, tmpRoot } = makeTempProject('migration');
  writePlan(projectDir, FRONT + '# Test Project\n');
  const before = readPlan(projectDir);
  const r = buildBlindSpotTurn(projectDir);
  check('migration: ok=false (no proposed_tree)', r.ok === false && r.reason === 'no-proposed-tree');
  const r2 = applyBlindSpotInsert(projectDir, fullInsertPayload());
  check('migration: insert rejects (stage-mismatch or no-proposed-tree)', r2.ok === false);
  const after = readPlan(projectDir);
  check('migration: no write on either path', before === after);
  cleanup(tmpRoot);
}

// ===========================================================================
// formatPlan / formatCommit
// ===========================================================================
console.log('formatPlan / formatCommit');
check('formatPlan returns text', formatPlan({ text: 'hi' }) === 'hi');
check('formatPlan default', formatPlan(null) === '(no plan text)');
check('formatCommit returns text', formatCommit({ text: 'ok' }) === 'ok');
check('formatCommit default', formatCommit({}) === '(no commit text)');

// ===========================================================================
// Namespace + top-level exports
// ===========================================================================
console.log('namespace exports');
check('ovdPlan.blindSpot exists', !!ovdPlan.blindSpot);
check('ovdPlan.blindSpot.runBlindSpot exists', typeof ovdPlan.blindSpot.runBlindSpot === 'function');
check('ovdPlan.runBlindSpot top-level', typeof ovdPlan.runBlindSpot === 'function');
check('module identity', ovdPlan.blindSpot === blindSpot);

console.log('');
console.log(`${passed} checks passed.`);
if (failures.length) {
  console.log(`${failures.length} FAILURES`);
  process.exit(1);
}
