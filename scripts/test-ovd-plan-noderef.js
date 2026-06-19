#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const noderef = require('../lib/ovd-plan/noderef');
const {
  STATUS,
  MATCH_TYPES,
  isLeaf,
  flattenNodes,
  applyTieBreak,
  resolveNodeRef,
  nodeLabel,
  renderNodeRefResolution,
  runGoNodeRef
} = noderef;

const ovdPlan = require('../lib/ovd-plan');

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
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-noderef-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
  return { projectDir, tmpRoot };
}
function cleanup(tmpRoot) { fs.rmSync(tmpRoot, { recursive: true, force: true }); }
function writePlan(projectDir, content) { fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), content); }

// --- Hand-built trees (depth = id segments + 1; root is depth 1) ---
function mk(id, title, status, opts) {
  opts = opts || {};
  return {
    id, title, status: status || 'pending',
    active: !!opts.active,
    depth: id.split('.').length + 1,
    children: opts.children || [],
    annotations: opts.annotations || null
  };
}
function tree(children) { return { id: '', title: 'Root', depth: 1, children, annotations: null }; }

// TIE_TREE: active node II.1 (Login form) → active milestone II.
const tIIa = mk('II.2.a', 'Widget layout', 'pending');
const tIIb = mk('II.2.b', 'Widget legend', 'done');
const tII2 = mk('II.2', 'Widget cluster', 'in-progress', { children: [tIIa, tIIb] });
const tII1 = mk('II.1', 'Login form', 'in-progress', { active: true });
const tII = mk('II', 'Dashboard', 'in-progress', { children: [tII1, tII2] });
const tI1 = mk('I.1', 'Widget alpha', 'pending');
const tI = mk('I', 'Foundation', 'done', { children: [tI1] });
const TIE_TREE = tree([tI, tII]);

// AMB_TREE: two pending sibling leaves both matching, both under active milestone I.
const aLeaf1 = mk('I.1.a', 'Widget layout', 'pending', { active: true });
const aLeaf2 = mk('I.1.b', 'Widget layout v2', 'pending');
const aCluster = mk('I.1', 'Widgets', 'in-progress', { children: [aLeaf1, aLeaf2] });
const aMile = mk('I', 'Foundation', 'in-progress', { children: [aCluster] });
const AMB_TREE = tree([aMile]);

const FRONT = '---\novd-plan: true\nversion: 3\nproject: "Test Project"\n---\n\n';
// Positional ids: milestone I, leaves I.1 (Login form, active), I.2 (Widget layout).
const FIXTURE = `${FRONT}# Test Project

## I. Foundation [in-progress]

### I.1 Login form [in-progress] ← ACTIVE
### I.2 Widget layout [pending]
`;
const FIXTURE_MIGRATION = '---\novd-plan: true\nversion: 3\nproject: "Migrated"\nactive_node: ""\n---\n\n# Migrated\n';

// ---------------------------------------------------------------------------
// 1. Module surface
// ---------------------------------------------------------------------------
console.log('Module surface');
check('STATUS === "go"', STATUS === 'go');
check('MATCH_TYPES has 5 entries', Array.isArray(MATCH_TYPES) && MATCH_TYPES.length === 5);
for (const fn of ['isLeaf', 'flattenNodes', 'applyTieBreak', 'resolveNodeRef', 'nodeLabel', 'renderNodeRefResolution', 'runGoNodeRef']) {
  check(`${fn} exported`, typeof noderef[fn] === 'function');
}
check('ovdPlan.noderef namespace', ovdPlan.noderef === noderef);
check('ovdPlan.runGoNodeRef wired', ovdPlan.runGoNodeRef === runGoNodeRef);

// ---------------------------------------------------------------------------
// 2. isLeaf + flattenNodes
// ---------------------------------------------------------------------------
console.log('isLeaf + flattenNodes');
check('leaf is leaf', isLeaf(tIIa) === true);
check('container not leaf', isLeaf(tII2) === false);
check('empty-children is leaf', isLeaf({ children: [] }) === true);
{
  const flat = flattenNodes(TIE_TREE);
  check('flatten excludes root', !flat.some((n) => n.id === ''));
  check('flatten includes all 7 nodes', flat.length === 7);
  check('flatten includes deep leaf', flat.some((n) => n.id === 'II.2.a'));
  check('flatten of null → []', flattenNodes(null).length === 0);
}

// ---------------------------------------------------------------------------
// 3. resolveNodeRef — id-exact
// ---------------------------------------------------------------------------
console.log('resolveNodeRef id-exact');
{
  const r = resolveNodeRef(TIE_TREE, 'II.2.a');
  check('id-exact matchType', r.matchType === 'id-exact');
  check('id-exact single match', r.matches.length === 1 && r.matches[0].id === 'II.2.a');
  check('id-exact NOT autoResolved (explicit → no announce)', r.autoResolved === false);
  check('id-exact not ambiguous', r.ambiguous === false);
  const ci = resolveNodeRef(TIE_TREE, 'ii.2.a');
  check('id-exact case-insensitive', ci.matchType === 'id-exact' && ci.matches[0].id === 'II.2.a');
}

// ---------------------------------------------------------------------------
// 4. resolveNodeRef — title-single (fuzzy → autoResolved)
// ---------------------------------------------------------------------------
console.log('resolveNodeRef title-single');
{
  const r = resolveNodeRef(TIE_TREE, 'login');
  check('title-single matchType', r.matchType === 'title-single');
  check('title-single match', r.matches.length === 1 && r.matches[0].id === 'II.1');
  check('title-single autoResolved (announce)', r.autoResolved === true);
  check('title-single case-insensitive', resolveNodeRef(TIE_TREE, 'LOGIN').matches[0].id === 'II.1');
}

// ---------------------------------------------------------------------------
// 5. resolveNodeRef — tie-broken (all 3 tiers narrow 'widget' to II.2.a)
// ---------------------------------------------------------------------------
console.log('resolveNodeRef tie-broken');
{
  const r = resolveNodeRef(TIE_TREE, 'widget');
  check('tie-broken matchType', r.matchType === 'tie-broken');
  check('tie-broken resolves to II.2.a', r.matches.length === 1 && r.matches[0].id === 'II.2.a');
  check('tie-broken autoResolved', r.autoResolved === true);
  check('tie-break trace: leaves first', r.tieBreak[0] === 'prefer-leaves');
  check('tie-break trace: active milestone', r.tieBreak.includes('prefer-active-milestone'));
  check('tie-break trace: pending', r.tieBreak.includes('prefer-pending'));
}

// ---------------------------------------------------------------------------
// 6. applyTieBreak — tier isolation
// ---------------------------------------------------------------------------
console.log('applyTieBreak tiers');
{
  // tier 1: leaves > containers
  const t1 = applyTieBreak([tII2, tIIa], TIE_TREE);
  check('tier1: container+leaf → leaf', t1.node && t1.node.id === 'II.2.a');
  check('tier1: trace prefer-leaves', t1.trace.length === 1 && t1.trace[0] === 'prefer-leaves');
  // tier 2: active milestone (two leaves, different milestones)
  const t2 = applyTieBreak([tI1, tIIa], TIE_TREE);
  check('tier2: prefers active-milestone leaf', t2.node && t2.node.id === 'II.2.a');
  check('tier2: trace prefer-active-milestone', t2.trace.includes('prefer-active-milestone') && !t2.trace.includes('prefer-leaves'));
  // tier 3: pending status (two leaves same milestone)
  const t3 = applyTieBreak([tIIa, tIIb], TIE_TREE);
  check('tier3: prefers pending leaf', t3.node && t3.node.id === 'II.2.a');
  check('tier3: trace prefer-pending', t3.trace.includes('prefer-pending'));
}

// ---------------------------------------------------------------------------
// 7. resolveNodeRef — ambiguous (tie-break cannot narrow) + none
// ---------------------------------------------------------------------------
console.log('resolveNodeRef ambiguous + none');
{
  const r = resolveNodeRef(AMB_TREE, 'widget layout');
  check('ambiguous matchType', r.matchType === 'ambiguous');
  check('ambiguous keeps both', r.matches.length === 2);
  check('ambiguous flag true', r.ambiguous === true);
  check('ambiguous NOT autoResolved', r.autoResolved === false);
}
{
  check('no-match → none', resolveNodeRef(TIE_TREE, 'zzz-nope').matchType === 'none');
  check('no-match reason', resolveNodeRef(TIE_TREE, 'zzz-nope').reason === 'no-match');
  check('empty ref → none', resolveNodeRef(TIE_TREE, '').matchType === 'none');
  check('empty ref reason', resolveNodeRef(TIE_TREE, '   ').reason === 'empty-ref');
}

// ---------------------------------------------------------------------------
// 8. nodeLabel + renderNodeRefResolution
// ---------------------------------------------------------------------------
console.log('renderNodeRefResolution');
check('nodeLabel shape', nodeLabel(tIIa) === 'II.2.a Widget layout [pending]');
{
  const txt = renderNodeRefResolution(resolveNodeRef(TIE_TREE, 'II.2.a'), 'II.2.a');
  check('id-exact render: Resolved', /Resolved II\.2\.a → II\.2\.a Widget layout \[pending\]\./.test(txt));
  check('id-exact render: NO announce/continue', !/\(1\) continue/.test(txt));
}
{
  const txt = renderNodeRefResolution(resolveNodeRef(TIE_TREE, 'widget'), 'widget');
  check('tie-broken render: Matched', /Matched II\.2\.a Widget layout \[pending\]\./.test(txt));
  check('tie-broken render: auto-selected trace', /auto-selected by: prefer-leaves → prefer-active-milestone → prefer-pending/.test(txt));
  check('tie-broken render: announce/continue (Q4.10)', /\(1\) continue/.test(txt));
  check('tie-broken render: cancel/different option', /Pick a different node/.test(txt));
  check('tie-broken render: Pattern 7 Other', /Other —/i.test(txt));
}
{
  const txt = renderNodeRefResolution(resolveNodeRef(TIE_TREE, 'login'), 'login');
  check('title-single render: announce, no trace line', /\(1\) continue/.test(txt) && !/auto-selected by/.test(txt));
}
{
  const txt = renderNodeRefResolution(resolveNodeRef(AMB_TREE, 'widget layout'), 'widget layout');
  check('ambiguous render: header', /Multiple nodes match "widget layout"/.test(txt));
  check('ambiguous render: numbered candidates', /\(1\) I\.1\.a/.test(txt) && /\(2\) I\.1\.b/.test(txt));
  check('ambiguous render: Other escape', /Other —/i.test(txt));
  check('ambiguous render: reply-with-number', /Reply with a number/.test(txt));
}
{
  const txt = renderNodeRefResolution(resolveNodeRef(TIE_TREE, 'zzz'), 'zzz');
  check('none render: no-match guidance', /No node matches "zzz"/.test(txt) && /\/ovd-plan display/.test(txt));
}

// ---------------------------------------------------------------------------
// 9. runGoNodeRef — entry point + error paths + integration
// ---------------------------------------------------------------------------
console.log('runGoNodeRef');
check('invalid dir → ok=false', runGoNodeRef(null, 'x').ok === false && runGoNodeRef(null, 'x').reason === 'invalid-project-dir');
{
  const { projectDir, tmpRoot } = makeTempProject('missing-ref');
  writePlan(projectDir, FIXTURE);
  const r = runGoNodeRef(projectDir, '   ');
  check('missing ref → ok=false', r.ok === false && r.reason === 'missing-ref');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('missing-plan');
  const r = runGoNodeRef(projectDir, 'widget');
  check('missing plan → ok=false', r.ok === false && r.reason === 'missing-plan');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('idmatch');
  writePlan(projectDir, FIXTURE);
  const r = runGoNodeRef(projectDir, 'I.2');
  check('id-exact → ok', r.ok === true && r.status === 'go' && r.mode === 'noderef');
  check('id-exact → matchType', r.matchType === 'id-exact');
  check('id-exact → match id', r.matches.length === 1 && r.matches[0].id === 'I.2');
  check('id-exact → autoResolved false', r.autoResolved === false);
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('fuzzy');
  writePlan(projectDir, FIXTURE);
  const r = runGoNodeRef(projectDir, 'widget');
  check('fuzzy single → title-single', r.matchType === 'title-single');
  check('fuzzy single → I.2', r.matches[0].id === 'I.2');
  check('fuzzy single → autoResolved (announce)', r.autoResolved === true && /\(1\) continue/.test(r.text));
  const none = runGoNodeRef(projectDir, 'nonexistent-zzz');
  check('no-match → matchType none', none.matchType === 'none');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 10. Dispatch via ovdPlan.runGo({ text })
// ---------------------------------------------------------------------------
console.log('Dispatch via runGo');
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch');
  writePlan(projectDir, FIXTURE);
  const r = ovdPlan.runGo({ projectDir, text: 'I.2' }, process.env);
  check('runGo with text → noderef', r.ok === true && r.mode === 'noderef' && r.matchType === 'id-exact');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 11. Migration-compat seam (Pattern 5)
// ---------------------------------------------------------------------------
console.log('Migration-compat seam (Pattern 5)');
{
  const { projectDir, tmpRoot } = makeTempProject('migration');
  writePlan(projectDir, FIXTURE_MIGRATION);
  const r = runGoNodeRef(projectDir, 'widget');
  check('migration-shape → ok=true', r.ok === true);
  check('migration-shape → no tree → none', r.matchType === 'none');
  check('migration-shape → no crash, guidance text', /No node matches/.test(r.text));
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 12. Edge cases — null tree, parse-error, tier no-ops, defensive label
// ---------------------------------------------------------------------------
console.log('Edge cases');
check('resolveNodeRef null tree → none', resolveNodeRef(null, 'x').matchType === 'none');
check('nodeLabel defensive (no title/status)', nodeLabel({ id: 'I.1' }) === 'I.1 [pending]');
{
  // tier1 no-op when all candidates are containers → falls through to ambiguous
  const t = applyTieBreak([tII, tII2], TIE_TREE);
  check('all-containers: tier1 no-op (no prefer-leaves)', !t.trace.includes('prefer-leaves'));
  check('all-containers: stays ambiguous (pool)', !t.node && Array.isArray(t.pool) && t.pool.length === 2);
}
{
  // no active node → tier2 skipped; two pending leaves in different milestones → ambiguous
  const nLeafA = mk('I.1', 'Widget a', 'pending');
  const nLeafB = mk('II.1', 'Widget b', 'pending');
  const NOACT_TREE = tree([mk('I', 'M1', 'pending', { children: [nLeafA] }), mk('II', 'M2', 'pending', { children: [nLeafB] })]);
  const t = applyTieBreak([nLeafA, nLeafB], NOACT_TREE);
  check('no-active: tier2 skipped', !t.trace.includes('prefer-active-milestone'));
  check('no-active: ambiguous', !t.node && t.pool.length === 2);
  check('no-active: resolveNodeRef ambiguous', resolveNodeRef(NOACT_TREE, 'widget').matchType === 'ambiguous');
}
{
  const { projectDir, tmpRoot } = makeTempProject('parse');
  writePlan(projectDir, `${FRONT}# Test Project\n\n## I. Foundation [pending]\n\n### I.1 Leaf [pending]\n\n\`\`\`yaml ovd-plan\nscope: [unclosed\n\`\`\`\n`);
  const r = runGoNodeRef(projectDir, 'leaf');
  check('parse-error → ok=false', r.ok === false);
  check('parse-error → reason', r.reason === 'parse-error' || r.reason === 'unknown-error');
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
