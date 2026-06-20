#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const small = require('../lib/ovd-plan/small');
const {
  STATUS,
  SMALL_FILE_CAP,
  GROWTH_FILE_THRESHOLD,
  isSharedContract,
  sharedContractFiles,
  assessScopeFiles,
  assessScope,
  evaluateGrowth,
  monitorSmallScope
} = small;

const ovdPlan = require('../lib/ovd-plan');

const verbose = process.argv.includes('--verbose');
let passed = 0;
const failures = [];
function check(label, condition, detail) {
  if (condition) { passed += 1; if (verbose) console.log(`PASS ${label}`); }
  else { failures.push(detail ? `${label}: ${detail}` : label); console.log(`FAIL ${label}`); }
}

function makeTempProject(name) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-small-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
  return { projectDir, tmpRoot };
}
function cleanup(tmpRoot) { fs.rmSync(tmpRoot, { recursive: true, force: true }); }
function writePlan(projectDir, content) { fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), content); }

const FENCE = '```yaml ovd-plan';
const FRONT = '---\novd-plan: true\nversion: 3\nproject: "Test Project"\n---\n\n';
// I.1 single-file (small), I.2 shared-contract (not small), I.3 multi-file (not small).
const FIXTURE = `${FRONT}# Test Project

## I. Foundation [in-progress]

### I.1 Tweak [pending]

${FENCE}
scope:
  in:
    - src/widget/color.ts
\`\`\`

### I.2 Types [pending]

${FENCE}
scope:
  in:
    - src/types/api.d.ts
\`\`\`

### I.3 Wide [pending]

${FENCE}
scope:
  in:
    - src/a.ts
    - src/b.ts
    - src/c.ts
\`\`\`
`;
const FIXTURE_MIGRATION = '---\novd-plan: true\nversion: 3\nproject: "Migrated"\nactive_node: ""\n---\n\n# Migrated\n';

// ---------------------------------------------------------------------------
// 1. Module surface
// ---------------------------------------------------------------------------
console.log('Module surface');
check('STATUS === "go"', STATUS === 'go');
check('SMALL_FILE_CAP === 1 (Q4.6)', SMALL_FILE_CAP === 1);
check('GROWTH_FILE_THRESHOLD === 3 (Q4.7)', GROWTH_FILE_THRESHOLD === 3);
for (const fn of ['isSharedContract', 'sharedContractFiles', 'assessScopeFiles', 'assessScope', 'evaluateGrowth', 'monitorSmallScope']) {
  check(`${fn} exported`, typeof small[fn] === 'function');
}
check('ovdPlan.small namespace', ovdPlan.small === small);
check('ovdPlan.assessScope wired', ovdPlan.assessScope === assessScope);
check('ovdPlan.monitorSmallScope wired', ovdPlan.monitorSmallScope === monitorSmallScope);

// ---------------------------------------------------------------------------
// 2. isSharedContract (Q4.7 allow-list)
// ---------------------------------------------------------------------------
console.log('isSharedContract');
check('.d.ts shared', isSharedContract('src/types/api.d.ts') === true);
check('.proto shared', isSharedContract('proto/user.proto') === true);
check('interfaces/ shared', isSharedContract('src/interfaces/User.ts') === true);
check('contracts/ shared', isSharedContract('lib/contracts/Order.ts') === true);
check('types/ shared', isSharedContract('src/types/index.ts') === true);
check('schema (case-insensitive) shared', isSharedContract('db/UserSchema.ts') === true);
check('plain file not shared', isSharedContract('src/widget/color.ts') === false);
check('non-string → false', isSharedContract(null) === false);
check('sharedContractFiles filters', JSON.stringify(sharedContractFiles(['a.ts', 'src/types/x.d.ts', 'b.ts'])) === JSON.stringify(['src/types/x.d.ts']));

// ---------------------------------------------------------------------------
// 3. assessScopeFiles (4.7 heuristic, Q4.6)
// ---------------------------------------------------------------------------
console.log('assessScopeFiles');
check('single file no contract → small', assessScopeFiles(['src/x.ts']).recommend_small === true);
check('zero files → small (likely narrow)', assessScopeFiles([]).recommend_small === true);
check('2 files → not small', assessScopeFiles(['a.ts', 'b.ts']).recommend_small === false);
check('2 files reason mentions count', /2 files/.test(assessScopeFiles(['a.ts', 'b.ts']).reason));
check('shared contract single file → not small', assessScopeFiles(['src/types/api.d.ts']).recommend_small === false);
check('shared contract reason', /shared contract/.test(assessScopeFiles(['src/types/api.d.ts']).reason));
check('non-array → small (empty)', assessScopeFiles(null).recommend_small === true);
check('single-file reason names the file', /src\/x\.ts/.test(assessScopeFiles(['src/x.ts']).reason));

// ---------------------------------------------------------------------------
// 4. assessScope (reads leaf scope.in)
// ---------------------------------------------------------------------------
console.log('assessScope');
{
  const { projectDir, tmpRoot } = makeTempProject('assess');
  writePlan(projectDir, FIXTURE);
  const r1 = assessScope(projectDir, 'I.1', {});
  check('I.1 small → recommend', r1.ok === true && r1.mode === 'assess-scope' && r1.recommend_small === true);
  check('I.1 text recommends --small', /Recommending \/ovd-go --small I\.1/.test(r1.text));
  check('I.1 transparent options (approved/full/other)', /\(1\) approved/.test(r1.text) && /\(2\) full/.test(r1.text) && /\(3\) other/.test(r1.text));
  const r2 = assessScope(projectDir, 'I.2', {});
  check('I.2 shared contract → full', r2.recommend_small === false);
  check('I.2 text recommends full', /Full mode recommended for I\.2/.test(r2.text));
  check('I.2 offers force --small (transparent)', /\(2\) --small — force small mode/.test(r2.text));
  const r3 = assessScope(projectDir, 'I.3', {});
  check('I.3 multi-file → full', r3.recommend_small === false && /3 files/.test(r3.reason));
  // errors
  check('not-a-leaf', assessScope(projectDir, 'I', {}).reason === 'not-a-leaf');
  check('leaf-not-found', assessScope(projectDir, 'Z.9', {}).reason === 'leaf-not-found');
  check('missing-ref', assessScope(projectDir, '', {}).reason === 'missing-ref');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('assess-noplan');
  check('missing-plan', assessScope(projectDir, 'I.1', {}).reason === 'missing-plan');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 5. evaluateGrowth (4.8 heuristic, Q4.7)
// ---------------------------------------------------------------------------
console.log('evaluateGrowth');
check('1 file → not exceeded', evaluateGrowth({ files_touched: ['a.ts'] }).exceeded === false);
check('3 files → not exceeded (at threshold)', evaluateGrowth({ files_touched: ['a.ts', 'b.ts', 'c.ts'] }).exceeded === false);
check('4 files → exceeded', evaluateGrowth({ files_touched: ['a.ts', 'b.ts', 'c.ts', 'd.ts'] }).exceeded === true);
check('4 files evidence mentions count', /4 files/.test(evaluateGrowth({ files_touched: ['a.ts', 'b.ts', 'c.ts', 'd.ts'] }).evidence));
check('shared contract (1 file) → exceeded', evaluateGrowth({ files_touched: ['src/types/x.d.ts'] }).exceeded === true);
check('shared contract takes priority in evidence', /shared contract/.test(evaluateGrowth({ files_touched: ['src/types/x.d.ts'] }).evidence));
check('empty → not exceeded', evaluateGrowth({ files_touched: [] }).exceeded === false);
check('missing/invalid → not exceeded', evaluateGrowth(null).exceeded === false);
check('files_touched count surfaced', evaluateGrowth({ files_touched: ['a.ts', 'b.ts'] }).files_touched === 2);
check('shared_contracts list surfaced', evaluateGrowth({ files_touched: ['src/types/x.d.ts'] }).shared_contracts.length === 1);

// ---------------------------------------------------------------------------
// 6. monitorSmallScope (4.8 prompt)
// ---------------------------------------------------------------------------
console.log('monitorSmallScope');
{
  const r = monitorSmallScope({ files_touched: ['a.ts', 'b.ts', 'c.ts', 'd.ts'] });
  check('exceeded → ok + flag', r.ok === true && r.mode === 'monitor-small' && r.exceeded === true);
  check('exceeded text: grown', /iteration has grown/.test(r.text));
  check('exceeded options: switch/keep/replan/other (FM #6 transparent)', /\(1\) switch/.test(r.text) && /\(2\) keep --small/.test(r.text) && /\(3\) replan/.test(r.text) && /\(4\) other/.test(r.text));
}
{
  const r = monitorSmallScope({ files_touched: ['a.ts'] });
  check('within scope → not exceeded', r.exceeded === false);
  check('within scope text: OK', /--small scope OK/.test(r.text));
  check('within scope: no switch prompt', !/\(1\) switch/.test(r.text));
}
{
  const r = monitorSmallScope({ files_touched: ['src/contracts/Order.ts'] });
  check('shared contract → exceeded', r.exceeded === true);
  check('shared contract evidence in text', /shared contract/.test(r.text));
}

// ---------------------------------------------------------------------------
// 7. Dispatch via ovdPlan.runGo
// ---------------------------------------------------------------------------
console.log('Dispatch via runGo');
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch');
  writePlan(projectDir, FIXTURE);
  const assess = ovdPlan.runGo({ projectDir, subcommand: 'assess', text: 'I.1' }, process.env);
  check('runGo assess', assess.ok === true && assess.mode === 'assess-scope' && assess.recommend_small === true);
  const monitor = ovdPlan.runGo({ projectDir, subcommand: 'monitor', entriesJson: JSON.stringify({ files_touched: ['a.ts', 'b.ts', 'c.ts', 'd.ts'] }) }, process.env);
  check('runGo monitor', monitor.ok === true && monitor.mode === 'monitor-small' && monitor.exceeded === true);
  const monitorOk = ovdPlan.runGo({ projectDir, subcommand: 'monitor', entriesJson: JSON.stringify({ files_touched: ['a.ts'] }) }, process.env);
  check('runGo monitor within-scope', monitorOk.exceeded === false);
  const badJson = ovdPlan.runGo({ projectDir, subcommand: 'monitor', entriesJson: '{bad' }, process.env);
  check('runGo monitor bad JSON guard', badJson.ok === false && /not valid JSON/.test(badJson.reason));
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 8. Migration-compat seam (Pattern 5)
// ---------------------------------------------------------------------------
console.log('Migration-compat seam (Pattern 5)');
{
  const { projectDir, tmpRoot } = makeTempProject('migration');
  writePlan(projectDir, FIXTURE_MIGRATION);
  check('assess migration → leaf-not-found, no crash', assessScope(projectDir, 'I.1', {}).reason === 'leaf-not-found');
  // monitor is stateless — works regardless of plan shape
  check('monitor stateless on bare project', monitorSmallScope({ files_touched: ['a.ts'] }).ok === true);
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 9. Edge cases + boundaries
// ---------------------------------------------------------------------------
console.log('Edge cases');
check('exactly 1 file → small (at cap)', assessScopeFiles(['only.ts']).recommend_small === true);
check('assessScopeFiles filters non-strings', assessScopeFiles(['a.ts', 2, null, '']).recommend_small === true);
check('two non-shared still not small', assessScopeFiles(['x.ts', 'y.ts']).recommend_small === false);
check('shared beats count in reason (shared first)', /shared contract/.test(assessScopeFiles(['src/types/a.d.ts', 'b.ts', 'c.ts']).reason));
check('deep .proto path shared', isSharedContract('a/b/c/user.proto') === true);
check('root-level interfaces not matched (needs /interfaces/ or start)', isSharedContract('myinterfaces.ts') === false);
check('leading interfaces/ matched', isSharedContract('interfaces/X.ts') === true);
check('evaluateGrowth array input (not object) → not exceeded', evaluateGrowth(['a.ts', 'b.ts', 'c.ts', 'd.ts']).exceeded === false);
check('evaluateGrowth filters non-string files', evaluateGrowth({ files_touched: ['a.ts', 5, null] }).files_touched === 1);
check('monitor exactly 3 files → not exceeded', monitorSmallScope({ files_touched: ['a.ts', 'b.ts', 'c.ts'] }).exceeded === false);
{
  // assess force-small option present on the not-small branch
  const { projectDir, tmpRoot } = makeTempProject('force');
  writePlan(projectDir, FIXTURE);
  const r = assessScope(projectDir, 'I.3', {});
  check('not-small branch: scope_files surfaced', Array.isArray(r.scope_files) && r.scope_files.length === 3);
  check('not-small branch: approved=full option', /\(1\) approved — use full mode/.test(r.text));
  cleanup(tmpRoot);
}
check('monitor missing entries → not exceeded (stateless safe)', monitorSmallScope(undefined).exceeded === false);
check('sharedContractFiles non-array → []', sharedContractFiles(null).length === 0);
check('assessScopeFiles 0 files reason = narrow', /narrow change likely/.test(assessScopeFiles([]).reason));
check('evaluateGrowth within-scope evidence', /within --small scope/.test(evaluateGrowth({ files_touched: ['a.ts'] }).evidence));
check('monitor result carries files_touched count', monitorSmallScope({ files_touched: ['a.ts', 'b.ts'] }).files_touched === 2);
check('monitor result carries shared_contracts', monitorSmallScope({ files_touched: ['src/types/x.d.ts'] }).shared_contracts.length === 1);

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
