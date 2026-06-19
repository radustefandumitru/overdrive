#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const execute = require('../lib/ovd-plan/execute');
const {
  STATUS,
  EXECUTE_STATUS_VALUES,
  findLeaf,
  leafContract,
  skillMode,
  partitionSkills,
  isWithinScope,
  buildExecutePlan,
  normalizeExecuteEntries,
  applyExecuteResult,
  runExecuteLeaf
} = execute;

const ovdPlan = require('../lib/ovd-plan');
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
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-execute-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
  return { projectDir, tmpRoot };
}
function cleanup(tmpRoot) { fs.rmSync(tmpRoot, { recursive: true, force: true }); }
function writePlan(projectDir, content) { fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), content); }
function readPlan(projectDir) { return fs.readFileSync(path.join(projectDir, 'OVERDRIVE.md'), 'utf8'); }

// Fixture catalog so skill validation is deterministic (alpha + beta known).
function makeCatalog(root) {
  const dir = path.join(root, 'skills', 'skill-router', 'references');
  fs.mkdirSync(dir, { recursive: true });
  const md = [
    '# Catalog', '',
    '| Skill | Purpose | Use when | Notes |',
    '|---|---|---|---|',
    '| `alpha` | a | x | n |',
    '| `beta` | b | y | n |',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'catalog.md'), md);
  return root;
}

const FENCE = '```yaml ovd-plan';
const FRONT = '---\novd-plan: true\nversion: 3\nproject: "Test Project"\n---\n\n';
// Positional ids: milestone I, leaves I.1 (Auth, high-conf skills + scope), I.2 (Dashboard, empty/low).
const FIXTURE = `${FRONT}# Test Project

## I. Foundation [in-progress]

### I.1 Auth middleware [pending]

${FENCE}
skills: [alpha, gamma]
confidence: high
scope:
  in:
    - src/auth/
  out: []
  read_only:
    - src/config.ts
success:
  - login works
verify:
  method: agent_self_check_against_success_criteria
  fallback: agent_self_check_against_success_criteria
deps: []
\`\`\`

### I.2 Dashboard [pending]

${FENCE}
skills: []
confidence: low
\`\`\`
`;
const FIXTURE_MIGRATION = '---\novd-plan: true\nversion: 3\nproject: "Migrated"\nactive_node: ""\n---\n\n# Migrated\n';
const NOW = '2026-06-19T12:00:00.000Z';

// ---------------------------------------------------------------------------
// 1. Module surface
// ---------------------------------------------------------------------------
console.log('Module surface');
check('STATUS === "go"', STATUS === 'go');
check('EXECUTE_STATUS_VALUES', Array.isArray(EXECUTE_STATUS_VALUES) && EXECUTE_STATUS_VALUES.includes('in-progress'));
for (const fn of ['findLeaf', 'leafContract', 'skillMode', 'partitionSkills', 'isWithinScope', 'buildExecutePlan', 'normalizeExecuteEntries', 'applyExecuteResult', 'runExecuteLeaf']) {
  check(`${fn} exported`, typeof execute[fn] === 'function');
}
check('ovdPlan.execute namespace', ovdPlan.execute === execute);
check('ovdPlan.runExecuteLeaf wired', ovdPlan.runExecuteLeaf === runExecuteLeaf);

// ---------------------------------------------------------------------------
// 2. findLeaf
// ---------------------------------------------------------------------------
console.log('findLeaf');
{
  const tree = parseOverdriveMd(FIXTURE).tree;
  check('finds leaf by id', findLeaf(tree, 'I.1') && findLeaf(tree, 'I.1').title === 'Auth middleware');
  check('case-insensitive', findLeaf(tree, 'i.1') !== null);
  check('not found → null', findLeaf(tree, 'Z.9') === null);
  check('empty ref → null', findLeaf(tree, '') === null);
  check('finds container too', findLeaf(tree, 'I') !== null);
}

// ---------------------------------------------------------------------------
// 3. leafContract
// ---------------------------------------------------------------------------
console.log('leafContract');
{
  const tree = parseOverdriveMd(FIXTURE).tree;
  const c = leafContract(findLeaf(tree, 'I.1'));
  check('skills extracted', JSON.stringify(c.skills) === JSON.stringify(['alpha', 'gamma']));
  check('confidence extracted', c.confidence === 'high');
  check('scope.in extracted', JSON.stringify(c.scope.in) === JSON.stringify(['src/auth/']));
  check('scope.read_only extracted', JSON.stringify(c.scope.read_only) === JSON.stringify(['src/config.ts']));
  check('success extracted', c.success[0] === 'login works');
  check('verify extracted', c.verify && c.verify.method === 'agent_self_check_against_success_criteria');
  check('deps default []', Array.isArray(c.deps) && c.deps.length === 0);
  const empty = leafContract({ annotations: null });
  check('null annotations → defaults', empty.skills.length === 0 && empty.confidence === null && empty.scope.in.length === 0);
}

// ---------------------------------------------------------------------------
// 4. skillMode (r3 §11.5)
// ---------------------------------------------------------------------------
console.log('skillMode');
check('high → canonical', skillMode({ skills: ['a'], confidence: 'high' }) === 'canonical');
check('medium → starting-point', skillMode({ skills: ['a'], confidence: 'medium' }) === 'starting-point');
check('low → reconsult', skillMode({ skills: ['a'], confidence: 'low' }) === 'reconsult');
check('empty skills → reconsult', skillMode({ skills: [], confidence: 'high' }) === 'reconsult');
check('unset confidence → starting-point', skillMode({ skills: ['a'], confidence: null }) === 'starting-point');

// ---------------------------------------------------------------------------
// 5. partitionSkills
// ---------------------------------------------------------------------------
console.log('partitionSkills');
{
  const { tmpRoot } = (() => { const p = makeTempProject('cat'); makeCatalog(p.projectDir); return p; })();
  // re-derive the catalog root
  const catRoot = path.join(tmpRoot);
}
{
  const t = makeTempProject('part');
  makeCatalog(t.projectDir);
  const p = partitionSkills(['alpha', 'gamma'], { repoRoot: t.projectDir });
  check('catalog available', p.catalogAvailable === true);
  check('known split', JSON.stringify(p.known) === JSON.stringify(['alpha']));
  check('unknown split', JSON.stringify(p.unknown) === JSON.stringify(['gamma']));
  cleanup(t.tmpRoot);
}
{
  const t = makeTempProject('nocat');
  const p = partitionSkills(['alpha', 'gamma'], { repoRoot: t.projectDir });
  check('no catalog → unavailable', p.catalogAvailable === false);
  check('no catalog → pass-through known', JSON.stringify(p.known) === JSON.stringify(['alpha', 'gamma']));
  check('no catalog → no unknown', p.unknown.length === 0);
  cleanup(t.tmpRoot);
}

// ---------------------------------------------------------------------------
// 6. isWithinScope
// ---------------------------------------------------------------------------
console.log('isWithinScope');
check('under dir entry', isWithinScope('src/auth/login.ts', ['src/auth/']) === true);
check('exact file entry', isWithinScope('src/file.ts', ['src/file.ts']) === true);
check('dir entry without trailing slash', isWithinScope('src/file.ts', ['src']) === true);
check('sibling not under dir', isWithinScope('src/auth.ts', ['src/auth/']) === false);
check('outside scope', isWithinScope('other.ts', ['src/']) === false);
check('empty scope → false', isWithinScope('x.ts', []) === false);
check('non-string file → false', isWithinScope(null, ['src/']) === false);

// ---------------------------------------------------------------------------
// 7. buildExecutePlan
// ---------------------------------------------------------------------------
console.log('buildExecutePlan');
{
  const { projectDir, tmpRoot } = makeTempProject('plan');
  writePlan(projectDir, FIXTURE);
  makeCatalog(projectDir);
  const r = buildExecutePlan(projectDir, 'I.1', { repoRoot: projectDir });
  check('plan ok', r.ok === true && r.mode === 'execute-plan');
  check('plan leaf_id', r.leaf_id === 'I.1');
  check('plan skillMode canonical', r.skillMode === 'canonical');
  check('plan skills carried', JSON.stringify(r.skills) === JSON.stringify(['alpha', 'gamma']));
  check('plan unknownSkills flagged', JSON.stringify(r.unknownSkills) === JSON.stringify(['gamma']));
  check('plan text: scope.in', /src\/auth\//.test(r.text));
  check('plan text: success criteria', /login works/.test(r.text));
  check('plan text: canonical instruction (no re-route)', /do NOT re-route/.test(r.text));
  check('plan text: unknown-skill warning', /not in catalog/.test(r.text) && /gamma/.test(r.text));
  check('plan text: callback syntax with --entries-json', /overdrive go execute I\.1 --entries-json/.test(r.text));
  check('plan text: SKILL DELTA mention', /SKILL DELTA/.test(r.text));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('plan-reconsult');
  writePlan(projectDir, FIXTURE);
  const r = buildExecutePlan(projectDir, 'I.2', { repoRoot: projectDir });
  check('empty/low → reconsult mode', r.skillMode === 'reconsult');
  check('reconsult instruction', /re-resolve skills/.test(r.text));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('plan-err');
  writePlan(projectDir, FIXTURE);
  check('not-a-leaf (container)', buildExecutePlan(projectDir, 'I', {}).reason === 'not-a-leaf');
  check('leaf-not-found', buildExecutePlan(projectDir, 'Z.9', {}).reason === 'leaf-not-found');
  check('missing-ref', buildExecutePlan(projectDir, '', {}).reason === 'missing-ref');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('plan-noplan');
  check('missing-plan', buildExecutePlan(projectDir, 'I.1', {}).reason === 'missing-plan');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 8. normalizeExecuteEntries (Pattern 4)
// ---------------------------------------------------------------------------
console.log('normalizeExecuteEntries');
check('null → invalid', normalizeExecuteEntries(null).ok === false);
check('array → invalid', normalizeExecuteEntries([]).ok === false);
check('missing leaf_id', normalizeExecuteEntries({ files_touched: [] }).reason === 'missing-leaf-id');
check('valid minimal', normalizeExecuteEntries({ leaf_id: 'I.1' }).ok === true);
check('default status in-progress', normalizeExecuteEntries({ leaf_id: 'I.1' }).status === 'in-progress');
check('invalid status rejected', normalizeExecuteEntries({ leaf_id: 'I.1', status: 'done' }).reason === 'invalid-status');
check('valid status accepted', normalizeExecuteEntries({ leaf_id: 'I.1', status: 'blocked' }).status === 'blocked');
check('invalid skill_delta rejected', normalizeExecuteEntries({ leaf_id: 'I.1', skill_delta: [] }).reason === 'invalid-skill-delta');
check('valid skill_delta normalized', JSON.stringify(normalizeExecuteEntries({ leaf_id: 'I.1', skill_delta: { planner: ['a'], runtime: ['a', 'b'] } }).skill_delta.runtime) === JSON.stringify(['a', 'b']));
check('files filtered to strings', JSON.stringify(normalizeExecuteEntries({ leaf_id: 'I.1', files_touched: ['a', 2, null, 'b'] }).files_touched) === JSON.stringify(['a', 'b']));

// ---------------------------------------------------------------------------
// 9. applyExecuteResult
// ---------------------------------------------------------------------------
console.log('applyExecuteResult');
{
  const { projectDir, tmpRoot } = makeTempProject('commit-happy');
  writePlan(projectDir, FIXTURE);
  const r = applyExecuteResult(projectDir, { leaf_id: 'I.1', files_touched: ['src/auth/login.ts'], summary: 'wired login', status: 'in-progress' }, { now: NOW });
  check('commit ok', r.ok === true && r.mode === 'execute-commit');
  check('status_after', r.status_after === 'in-progress');
  check('no scope warnings (in scope)', r.scope_warnings.length === 0);
  check('status persisted to tree', parseOverdriveMd(readPlan(projectDir)).tree.children[0].children[0].status === 'in-progress');
  check('session file recorded', typeof r.session_file === 'string' && /execute-I\.1\.md$/.test(r.session_file));
  check('session file exists on disk', fs.existsSync(path.join(projectDir, r.session_file)));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('commit-scope');
  writePlan(projectDir, FIXTURE);
  const r = applyExecuteResult(projectDir, { leaf_id: 'I.1', files_touched: ['src/auth/ok.ts', 'src/outside.ts'] }, { now: NOW });
  check('out-of-scope detected', r.scope_warnings.length === 1 && r.scope_warnings[0] === 'src/outside.ts');
  check('scope warning in text', /outside scope\.in/.test(r.text) && /DECISION POINT/.test(r.text));
  check('still ok (warn not block)', r.ok === true);
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('commit-delta');
  writePlan(projectDir, FIXTURE);
  const r = applyExecuteResult(projectDir, { leaf_id: 'I.1', files_touched: [], skill_delta: { planner: ['alpha'], runtime: ['alpha', 'delta'] } }, { now: NOW });
  check('skill_delta logged flag', r.skill_delta_logged === true);
  const sessionBody = fs.readFileSync(path.join(projectDir, r.session_file), 'utf8');
  check('session has skill-delta line', /skill-delta: planner=\[alpha\], runtime=\[alpha, delta\]/.test(sessionBody));
  // leaf annotation NOT rewritten (r3 §11.2)
  const reparsed = parseOverdriveMd(readPlan(projectDir));
  const leaf = reparsed.tree.children[0].children[0];
  check('leaf.skills annotation unchanged', JSON.stringify(leaf.annotations.skills) === JSON.stringify(['alpha', 'gamma']));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('commit-err');
  writePlan(projectDir, FIXTURE);
  check('leaf-not-found commit', applyExecuteResult(projectDir, { leaf_id: 'Z.9' }, { now: NOW }).reason === 'leaf-not-found');
  check('not-a-leaf commit', applyExecuteResult(projectDir, { leaf_id: 'I' }, { now: NOW }).reason === 'not-a-leaf');
  check('bad entries commit', applyExecuteResult(projectDir, null, { now: NOW }).ok === false);
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 10. runExecuteLeaf dispatch + ovdPlan.runGo
// ---------------------------------------------------------------------------
console.log('runExecuteLeaf + dispatch');
check('invalid dir', runExecuteLeaf(null, {}).reason === 'invalid-project-dir');
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch');
  writePlan(projectDir, FIXTURE);
  const plan = runExecuteLeaf(projectDir, { mode: 'plan', leafId: 'I.1', repoRoot: projectDir });
  check('runExecuteLeaf plan', plan.ok === true && plan.mode === 'execute-plan');
  const commit = runExecuteLeaf(projectDir, { mode: 'commit', entries: { leaf_id: 'I.1' }, now: NOW });
  check('runExecuteLeaf commit', commit.ok === true && commit.mode === 'execute-commit');
  // via ovdPlan.runGo
  const viaPlan = ovdPlan.runGo({ projectDir, subcommand: 'execute', text: 'I.1' }, process.env);
  check('runGo execute plan', viaPlan.ok === true && viaPlan.mode === 'execute-plan');
  const viaCommit = ovdPlan.runGo({ projectDir, subcommand: 'execute', text: 'I.1', entriesJson: JSON.stringify({ leaf_id: 'I.1' }) }, process.env);
  check('runGo execute commit', viaCommit.ok === true && viaCommit.mode === 'execute-commit');
  const badJson = ovdPlan.runGo({ projectDir, subcommand: 'execute', text: 'I.1', entriesJson: '{not json' }, process.env);
  check('runGo bad JSON guard (Pattern 4)', badJson.ok === false && /not valid JSON/.test(badJson.reason));
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 11. Migration-compat seam (Pattern 5)
// ---------------------------------------------------------------------------
console.log('Migration-compat seam (Pattern 5)');
{
  const { projectDir, tmpRoot } = makeTempProject('migration');
  writePlan(projectDir, FIXTURE_MIGRATION);
  const r = buildExecutePlan(projectDir, 'I.1', {});
  check('migration-shape plan → leaf-not-found (no tree), no crash', r.ok === false && r.reason === 'leaf-not-found');
  const c = applyExecuteResult(projectDir, { leaf_id: 'I.1' }, { now: NOW });
  check('migration-shape commit → leaf-not-found, no crash', c.ok === false && c.reason === 'leaf-not-found');
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
