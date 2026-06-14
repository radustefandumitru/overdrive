'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const ovdPlan = require('../lib/ovd-plan');
const {
  STATUS,
  INBOX_HEADER_UNKNOWN,
  CODEBASE_PATTERNS_REL,
  CODEBASE_TECH_STACK_REL,
  readCodebaseContext,
  findPendingLeaves,
  findLeafById,
  buildPlanSkillsTurn,
  applyPlanSkillsTurn,
  runPlanSkills,
  formatPlan,
  formatCommit
} = require('../lib/ovd-plan/plan-skills');

const { readDeliberationState } = require('../lib/ovd-plan/deliberation-state');

let pass = 0; let fail = 0;
function check(label, cond) {
  if (cond) { pass += 1; } else { fail += 1; console.error(`FAIL ${label}`); }
}

function makeTempProject(name) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-skills-${name}-`));
  const projectDir = path.join(tmpRoot, 'project');
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
  return { projectDir, tmpRoot };
}
function cleanup(tmpRoot) { fs.rmSync(tmpRoot, { recursive: true, force: true }); }
function writePlan(projectDir, content) { fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), content); }
function readPlan(projectDir) { return fs.readFileSync(path.join(projectDir, 'OVERDRIVE.md'), 'utf8'); }

// Stub catalog inside the temp project so the helper can resolve skills against a
// known small set. The helper parses skills/skill-router/references/catalog.md
// via TABLE_SKILL_PATTERN — backticked skill IDs in markdown table rows.
function writeStubCatalog(projectDir) {
  const catalogDir = path.join(projectDir, 'skills', 'skill-router', 'references');
  fs.mkdirSync(catalogDir, { recursive: true });
  fs.writeFileSync(path.join(catalogDir, 'catalog.md'),
    '# Skill catalog (stub for tests)\n' +
    '\n' +
    '| Skill | Description |\n' +
    '|---|---|\n' +
    '| `frontend-design` | UI work |\n' +
    '| `taste` | tasteful UI |\n' +
    '| `react` | react app |\n' +
    '| `playwright` | e2e tests |\n' +
    '| `security-review` | security audit |\n'
  );
}

const FIXED_NOW = '2026-06-14T12:00:00.000Z';
const FIXED_NOW_2 = '2026-06-14T12:05:00.000Z';

const FRONT = '---\novd-plan: true\nversion: 3\nproject: "Test Project"\n---\n\n';
const FIXTURE_FRESH = `${FRONT}# Test Project
`;

// Helper: build a plan-mode fixture with proposed_tree containing N pending leaves
// across M milestones. Stage is set to 'plan_skills' so the module can dispatch.
function fixtureWithPendingLeaves(opts = {}) {
  const milestones = opts.milestones || [
    {
      id: 'I',
      title: 'Foundation',
      description: 'Scaffolding.',
      ambiguity_score: 2,
      children: [
        {
          id: 'I.1',
          title: 'Setup auth',
          description: 'Wire Supabase auth into the app.',
          scope: { in: ['src/auth/'], out: ['src/admin/'] },
          success: ['Login flow round-trips a session token.'],
          verify: { method: 'vitest', fallback: 'agent_self_check_against_success', review_required: true },
          deps: [],
          skills: [],
          confidence: 'low',
          pending_skill_resolution: true
        }
      ]
    },
    {
      id: 'II',
      title: 'Dashboard',
      description: 'Stats widgets.',
      ambiguity_score: 2,
      children: [
        {
          id: 'II.1',
          title: 'Widget layout',
          description: 'Three responsive widget sizes with grid layout.',
          scope: { in: ['src/components/Dashboard/'], out: [] },
          success: ['Grid renders at 768/1024/1440px without overflow.'],
          verify: { method: 'playwright', fallback: 'agent_self_check_against_success', review_required: true },
          deps: ['I'],
          skills: [],
          confidence: 'low',
          pending_skill_resolution: true
        }
      ]
    }
  ];
  return `${FRONT}# Test Project

<!-- ovd-plan:deliberation-state:start -->
calibration:
  domain: medium
  technical: high
  scope: low
stage: plan_skills
turn_count: 2
answered_questions: []
proposed_tree:
  milestones:
${milestones.map((m) => '    - id: ' + JSON.stringify(m.id) + '\n' +
    '      title: ' + JSON.stringify(m.title) + '\n' +
    '      description: ' + JSON.stringify(m.description) + '\n' +
    '      ambiguity_score: ' + (m.ambiguity_score || 2) + '\n' +
    '      children:\n' +
    (m.children || []).map((leaf) => '        - id: ' + JSON.stringify(leaf.id) + '\n' +
      '          title: ' + JSON.stringify(leaf.title) + '\n' +
      '          description: ' + JSON.stringify(leaf.description) + '\n' +
      '          scope:\n' +
      '            in: ' + JSON.stringify(leaf.scope.in) + '\n' +
      '            out: ' + JSON.stringify(leaf.scope.out) + '\n' +
      '          success: ' + JSON.stringify(leaf.success) + '\n' +
      '          verify:\n' +
      '            method: ' + JSON.stringify(leaf.verify.method) + '\n' +
      '            fallback: ' + JSON.stringify(leaf.verify.fallback) + '\n' +
      '            review_required: ' + leaf.verify.review_required + '\n' +
      '          deps: ' + JSON.stringify(leaf.deps) + '\n' +
      '          skills: ' + JSON.stringify(leaf.skills || []) + '\n' +
      '          confidence: ' + JSON.stringify(leaf.confidence || 'low') + '\n' +
      (leaf.pending_skill_resolution ? '          pending_skill_resolution: true\n' : '') +
      (leaf.inserted_by ? '          inserted_by: ' + JSON.stringify(leaf.inserted_by) + '\n' : '')
    ).join('')
  ).join('')}  last_revision: 5
current_proposal_revision: 5
last_action: "2026-06-14T11:00:00.000Z"
<!-- ovd-plan:deliberation-state:end -->
`;
}

// ===========================================================================
// Module surface
// ===========================================================================
console.log('module surface');
check('exports STATUS', STATUS === 'plan-skills');
check('exports INBOX_HEADER_UNKNOWN', typeof INBOX_HEADER_UNKNOWN === 'string' && INBOX_HEADER_UNKNOWN.length > 0);
check('exports CODEBASE_PATTERNS_REL', typeof CODEBASE_PATTERNS_REL === 'string' && CODEBASE_PATTERNS_REL.includes('patterns.md'));
check('exports CODEBASE_TECH_STACK_REL', typeof CODEBASE_TECH_STACK_REL === 'string' && CODEBASE_TECH_STACK_REL.includes('tech-stack.md'));
check('exports readCodebaseContext (function)', typeof readCodebaseContext === 'function');
check('exports findPendingLeaves (function)', typeof findPendingLeaves === 'function');
check('exports findLeafById (function)', typeof findLeafById === 'function');
check('exports buildPlanSkillsTurn (function)', typeof buildPlanSkillsTurn === 'function');
check('exports applyPlanSkillsTurn (function)', typeof applyPlanSkillsTurn === 'function');
check('exports runPlanSkills (function)', typeof runPlanSkills === 'function');
check('exports formatPlan (function)', typeof formatPlan === 'function');
check('exports formatCommit (function)', typeof formatCommit === 'function');
check('ovdPlan.planSkills namespace exists', !!ovdPlan.planSkills);
check('ovdPlan.runPlanSkills top-level export', typeof ovdPlan.runPlanSkills === 'function');
check('ovdPlan.planSkills.STATUS === STATUS', ovdPlan.planSkills.STATUS === STATUS);

// ===========================================================================
// readCodebaseContext
// ===========================================================================
console.log('readCodebaseContext');
{
  const { projectDir, tmpRoot } = makeTempProject('cb-neither');
  check('readCodebaseContext: null when neither file present', readCodebaseContext(projectDir) === null);
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('cb-patterns-only');
  fs.mkdirSync(path.join(projectDir, '.overdrive', 'codebase'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, '.overdrive', 'codebase', 'patterns.md'), 'pattern A\npattern B');
  const ctx = readCodebaseContext(projectDir);
  check('readCodebaseContext: patterns-only returns string', typeof ctx === 'string');
  check('readCodebaseContext: patterns-only includes label', ctx.includes('## Codebase patterns'));
  check('readCodebaseContext: patterns-only includes body', ctx.includes('pattern A'));
  check('readCodebaseContext: patterns-only excludes tech label', !ctx.includes('## Tech stack'));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('cb-tech-only');
  fs.mkdirSync(path.join(projectDir, '.overdrive', 'codebase'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, '.overdrive', 'codebase', 'tech-stack.md'), 'Node 20, TypeScript');
  const ctx = readCodebaseContext(projectDir);
  check('readCodebaseContext: tech-only returns string', typeof ctx === 'string');
  check('readCodebaseContext: tech-only includes label', ctx.includes('## Tech stack'));
  check('readCodebaseContext: tech-only includes body', ctx.includes('Node 20'));
  check('readCodebaseContext: tech-only excludes patterns label', !ctx.includes('## Codebase patterns'));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('cb-both');
  fs.mkdirSync(path.join(projectDir, '.overdrive', 'codebase'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, '.overdrive', 'codebase', 'patterns.md'), 'pattern A');
  fs.writeFileSync(path.join(projectDir, '.overdrive', 'codebase', 'tech-stack.md'), 'Node 20');
  const ctx = readCodebaseContext(projectDir);
  check('readCodebaseContext: both returns string', typeof ctx === 'string');
  check('readCodebaseContext: both includes patterns label', ctx.includes('## Codebase patterns'));
  check('readCodebaseContext: both includes tech label', ctx.includes('## Tech stack'));
  check('readCodebaseContext: both: patterns precedes tech', ctx.indexOf('## Codebase patterns') < ctx.indexOf('## Tech stack'));
  check('readCodebaseContext: both: bodies present', ctx.includes('pattern A') && ctx.includes('Node 20'));
  cleanup(tmpRoot);
}
{
  // Empty file is treated identically to absent file.
  const { projectDir, tmpRoot } = makeTempProject('cb-empty');
  fs.mkdirSync(path.join(projectDir, '.overdrive', 'codebase'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, '.overdrive', 'codebase', 'patterns.md'), '   \n\n   ');
  check('readCodebaseContext: null when both empty', readCodebaseContext(projectDir) === null);
  cleanup(tmpRoot);
}

// ===========================================================================
// findPendingLeaves + findLeafById
// ===========================================================================
console.log('findPendingLeaves + findLeafById');
{
  check('findPendingLeaves: null tree returns []', JSON.stringify(findPendingLeaves(null)) === '[]');
  check('findPendingLeaves: no milestones returns []', JSON.stringify(findPendingLeaves({})) === '[]');
  check('findPendingLeaves: empty milestones returns []', JSON.stringify(findPendingLeaves({ milestones: [] })) === '[]');
}
{
  const tree = {
    milestones: [
      { id: 'I', children: [{ id: 'I.1', pending_skill_resolution: true }, { id: 'I.2' }] },
      { id: 'II', children: [{ id: 'II.1', pending_skill_resolution: true }] },
      { id: 'III', children: [] }
    ]
  };
  const pending = findPendingLeaves(tree);
  check('findPendingLeaves: returns 2 pending', pending.length === 2);
  check('findPendingLeaves: first is I.1', pending[0].leaf.id === 'I.1');
  check('findPendingLeaves: first under milestone I', pending[0].milestone_id === 'I');
  check('findPendingLeaves: second is II.1', pending[1].leaf.id === 'II.1');
  check('findPendingLeaves: skips already-resolved leaves', !pending.some((p) => p.leaf.id === 'I.2'));
  check('findPendingLeaves: tolerates empty children array', pending.every((p) => p.milestone_id !== 'III'));
}
{
  const tree = {
    milestones: [
      { id: 'I', children: [{ id: 'I.1' }] },
      { id: 'II', children: [{ id: 'II.1' }, { id: 'II.2' }] }
    ]
  };
  check('findLeafById: finds I.1', findLeafById(tree, 'I.1').leaf.id === 'I.1');
  check('findLeafById: returns milestone_id', findLeafById(tree, 'II.2').milestone_id === 'II');
  check('findLeafById: returns null on unknown', findLeafById(tree, 'X.1') === null);
  check('findLeafById: null tree returns null', findLeafById(null, 'I.1') === null);
}

// ===========================================================================
// buildPlanSkillsTurn — plan mode
// ===========================================================================
console.log('buildPlanSkillsTurn');
{
  const { projectDir, tmpRoot } = makeTempProject('build-missing');
  // No OVERDRIVE.md at all.
  const r = buildPlanSkillsTurn(projectDir);
  check('build: missing-plan envelope', r.status === STATUS && r.ok === false && r.reason === 'missing-plan');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('build-no-tree');
  // OVERDRIVE.md exists but no proposed_tree in deliberation-state.
  writePlan(projectDir, FIXTURE_FRESH);
  const r = buildPlanSkillsTurn(projectDir);
  check('build: no-proposed-tree envelope (no block)', r.status === STATUS && r.ok === false);
  cleanup(tmpRoot);
}
{
  // Block exists but proposed_tree absent.
  const { projectDir, tmpRoot } = makeTempProject('build-no-proposed-tree');
  writePlan(projectDir, `${FRONT}# Test Project

<!-- ovd-plan:deliberation-state:start -->
stage: plan_skills
<!-- ovd-plan:deliberation-state:end -->
`);
  const r = buildPlanSkillsTurn(projectDir);
  check('build: no-proposed-tree explicit reason', r.ok === false && r.reason === 'no-proposed-tree');
  cleanup(tmpRoot);
}
{
  // proposed_tree exists but no leaves are pending.
  const { projectDir, tmpRoot } = makeTempProject('build-no-pending');
  writePlan(projectDir, `${FRONT}# Test Project

<!-- ovd-plan:deliberation-state:start -->
stage: plan_skills
proposed_tree:
  milestones:
    - id: "I"
      title: "Foundation"
      description: "Done."
      children:
        - id: "I.1"
          title: "L"
          description: "d"
          scope:
            in: []
            out: []
          success: ["x"]
          verify:
            method: "m"
            fallback: "f"
            review_required: true
          deps: []
          skills: ["frontend-design"]
          confidence: "high"
<!-- ovd-plan:deliberation-state:end -->
`);
  writeStubCatalog(projectDir);
  const r = buildPlanSkillsTurn(projectDir);
  check('build: no-pending-leaves envelope', r.ok === false && r.reason === 'no-pending-leaves');
  cleanup(tmpRoot);
}
{
  // catalog-empty: helper returns fail-fast per r3 §11.6.
  const { projectDir, tmpRoot } = makeTempProject('build-catalog-empty');
  writePlan(projectDir, fixtureWithPendingLeaves());
  // No skills/skill-router/references/catalog.md → helper returns catalog-empty.
  const r = buildPlanSkillsTurn(projectDir);
  check('build: catalog-empty envelope from helper', r.ok === false && r.reason === 'catalog-empty');
  check('build: catalog-empty text mentions catalog', /catalog/i.test(r.text));
  cleanup(tmpRoot);
}
{
  // Happy plan-mode dispatch — first pending leaf surfaced.
  const { projectDir, tmpRoot } = makeTempProject('build-happy');
  writePlan(projectDir, fixtureWithPendingLeaves());
  writeStubCatalog(projectDir);
  const r = buildPlanSkillsTurn(projectDir);
  check('build: happy ok', r.ok === true);
  check('build: happy status', r.status === STATUS);
  check('build: happy mode=plan', r.mode === 'plan');
  check('build: happy stage=plan_skills', r.stage === 'plan_skills');
  check('build: happy leaf_id is first pending (I.1)', r.leaf_id === 'I.1');
  check('build: happy milestone_id=I', r.milestone_id === 'I');
  check('build: happy leaf_context.description matches leaf', /Supabase auth/.test(r.leaf_context.description));
  check('build: happy leaf_context.scope copied', Array.isArray(r.leaf_context.scope.in) && r.leaf_context.scope.in[0] === 'src/auth/');
  check('build: happy leaf_context.success is array', Array.isArray(r.leaf_context.success));
  check('build: happy remaining_leaf_ids count=2', r.remaining_leaf_ids.length === 2);
  check('build: happy remaining_leaf_ids in tree order', r.remaining_leaf_ids[0] === 'I.1' && r.remaining_leaf_ids[1] === 'II.1');
  check('build: happy prompt non-empty', typeof r.prompt === 'string' && r.prompt.length > 100);
  check('build: happy prompt references catalog', /catalog/i.test(r.prompt));
  check('build: happy text mentions Stage 5.5', /Stage 5\.5|RESOLVE SKILLS/.test(r.text));
  check('build: happy text shows leaf id', r.text.includes('I.1'));
  check('build: happy text shows milestone id', r.text.includes('milestone I'));
  check('build: happy text shows remaining count', /Leaves still pending skill resolution: 2/.test(r.text));
  check('build: happy text shows action paths', /Action paths:/.test(r.text) && /Resolve/.test(r.text) && /Skip-with-low-default/.test(r.text) && /Re-analyze/.test(r.text));
  check('build: happy codebase_patterns_summary=absent', r.leaf_context.codebase_patterns_summary === 'absent');
  cleanup(tmpRoot);
}
{
  // Plan-mode with codebase context present.
  const { projectDir, tmpRoot } = makeTempProject('build-with-cb');
  writePlan(projectDir, fixtureWithPendingLeaves());
  writeStubCatalog(projectDir);
  fs.mkdirSync(path.join(projectDir, '.overdrive', 'codebase'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, '.overdrive', 'codebase', 'patterns.md'), 'observed pattern: Pattern 1 dispatch shape');
  fs.writeFileSync(path.join(projectDir, '.overdrive', 'codebase', 'tech-stack.md'), 'Node 20 CLI');
  const r = buildPlanSkillsTurn(projectDir);
  check('build cb: codebase_patterns_summary=present', r.leaf_context.codebase_patterns_summary === 'present');
  check('build cb: prompt includes patterns label', r.prompt.includes('## Codebase patterns'));
  check('build cb: prompt includes tech label', r.prompt.includes('## Tech stack'));
  cleanup(tmpRoot);
}

// ===========================================================================
// applyPlanSkillsTurn — validation rejections
// ===========================================================================
console.log('applyPlanSkillsTurn — validation rejections');
{
  const { projectDir, tmpRoot } = makeTempProject('apply-reject-null');
  writePlan(projectDir, fixtureWithPendingLeaves());
  writeStubCatalog(projectDir);
  let r;
  r = applyPlanSkillsTurn(projectDir, null);
  check('apply reject null', r.ok === false && r.reason === 'invalid-shape');
  r = applyPlanSkillsTurn(projectDir, []);
  check('apply reject array', r.ok === false && r.reason === 'invalid-shape');
  r = applyPlanSkillsTurn(projectDir, {});
  check('apply reject missing leaf_id', r.ok === false && r.reason === 'missing-leaf-id');
  r = applyPlanSkillsTurn(projectDir, { leaf_id: '' });
  check('apply reject empty leaf_id', r.ok === false && r.reason === 'missing-leaf-id');
  r = applyPlanSkillsTurn(projectDir, { leaf_id: 'I.1', kind: 'bogus' });
  check('apply reject invalid kind', r.ok === false && r.reason === 'invalid-kind');
  r = applyPlanSkillsTurn(projectDir, { leaf_id: 'I.1' });
  check('apply reject missing host_agent_response (default kind=resolve)', r.ok === false && r.reason === 'missing-host-agent-response');
  r = applyPlanSkillsTurn(projectDir, { leaf_id: 'I.1', kind: 'resolve', host_agent_response: '   ' });
  check('apply reject whitespace host_agent_response', r.ok === false && r.reason === 'missing-host-agent-response');
  cleanup(tmpRoot);
}
{
  // stage-mismatch
  const { projectDir, tmpRoot } = makeTempProject('apply-stage-mismatch');
  writePlan(projectDir, `${FRONT}# Test Project

<!-- ovd-plan:deliberation-state:start -->
stage: plan
proposed_tree:
  milestones:
    - id: "I"
      children:
        - id: "I.1"
          title: "L"
          description: "d"
          scope: { in: [], out: [] }
          success: ["x"]
          verify: { method: "m", fallback: "f", review_required: true }
          deps: []
          pending_skill_resolution: true
<!-- ovd-plan:deliberation-state:end -->
`);
  writeStubCatalog(projectDir);
  const r = applyPlanSkillsTurn(projectDir, { leaf_id: 'I.1', host_agent_response: '{"skills":[],"confidence":"low","rationale":"x","considered":[]}' });
  check('apply stage-mismatch when stage=plan', r.ok === false && r.reason === 'stage-mismatch');
  cleanup(tmpRoot);
}
{
  // unknown-leaf
  const { projectDir, tmpRoot } = makeTempProject('apply-unknown-leaf');
  writePlan(projectDir, fixtureWithPendingLeaves());
  writeStubCatalog(projectDir);
  const r = applyPlanSkillsTurn(projectDir, { leaf_id: 'Z.99', host_agent_response: '{"skills":[],"confidence":"low","rationale":"x","considered":[]}' });
  check('apply unknown-leaf', r.ok === false && r.reason === 'unknown-leaf');
  cleanup(tmpRoot);
}
{
  // already-resolved (target leaf lacks pending_skill_resolution flag)
  const { projectDir, tmpRoot } = makeTempProject('apply-already-resolved');
  writePlan(projectDir, `${FRONT}# Test Project

<!-- ovd-plan:deliberation-state:start -->
stage: plan_skills
proposed_tree:
  milestones:
    - id: "I"
      children:
        - id: "I.1"
          title: "L"
          description: "d"
          scope: { in: [], out: [] }
          success: ["x"]
          verify: { method: "m", fallback: "f", review_required: true }
          deps: []
          skills: ["frontend-design"]
          confidence: "high"
        - id: "I.2"
          title: "L2"
          description: "d2"
          scope: { in: [], out: [] }
          success: ["y"]
          verify: { method: "m", fallback: "f", review_required: true }
          deps: []
          pending_skill_resolution: true
<!-- ovd-plan:deliberation-state:end -->
`);
  writeStubCatalog(projectDir);
  const r = applyPlanSkillsTurn(projectDir, { leaf_id: 'I.1', host_agent_response: '{"skills":[],"confidence":"low","rationale":"x","considered":[]}' });
  check('apply already-resolved', r.ok === false && r.reason === 'already-resolved');
  cleanup(tmpRoot);
}
{
  // parse-failed: agent response is not valid JSON.
  const { projectDir, tmpRoot } = makeTempProject('apply-parse-failed');
  writePlan(projectDir, fixtureWithPendingLeaves());
  writeStubCatalog(projectDir);
  const r = applyPlanSkillsTurn(projectDir, { leaf_id: 'I.1', host_agent_response: 'this is prose with no JSON object anywhere' });
  check('apply parse-failed envelope', r.ok === false && r.reason === 'parse-failed');
  check('apply parse-failed text mentions JSON format', /JSON object|skills.*confidence/.test(r.text));
  // Leaf must not have been mutated.
  const persisted = readDeliberationState(projectDir);
  check('apply parse-failed: leaf still pending', persisted.proposed_tree.milestones[0].children[0].pending_skill_resolution === true);
  check('apply parse-failed: skills still []', JSON.stringify(persisted.proposed_tree.milestones[0].children[0].skills) === '[]');
  cleanup(tmpRoot);
}
{
  // validation-failed: JSON object but wrong shape (missing skills array).
  const { projectDir, tmpRoot } = makeTempProject('apply-validation-failed');
  writePlan(projectDir, fixtureWithPendingLeaves());
  writeStubCatalog(projectDir);
  const r = applyPlanSkillsTurn(projectDir, { leaf_id: 'I.1', host_agent_response: '{"confidence":"high","rationale":"x"}' });
  check('apply validation-failed envelope', r.ok === false && r.reason === 'validation-failed');
  // Leaf must not have been mutated.
  const persisted = readDeliberationState(projectDir);
  check('apply validation-failed: leaf still pending', persisted.proposed_tree.milestones[0].children[0].pending_skill_resolution === true);
  cleanup(tmpRoot);
}
{
  // validation-failed: bad confidence value.
  const { projectDir, tmpRoot } = makeTempProject('apply-bad-confidence');
  writePlan(projectDir, fixtureWithPendingLeaves());
  writeStubCatalog(projectDir);
  const r = applyPlanSkillsTurn(projectDir, { leaf_id: 'I.1', host_agent_response: '{"skills":["frontend-design"],"confidence":"super","rationale":"x"}' });
  check('apply validation-failed on bad confidence', r.ok === false && r.reason === 'validation-failed');
  cleanup(tmpRoot);
}
{
  // catalog-empty during commit phase (no catalog → helper fails before agent response is parsed).
  const { projectDir, tmpRoot } = makeTempProject('apply-catalog-empty');
  writePlan(projectDir, fixtureWithPendingLeaves());
  // No catalog written.
  const r = applyPlanSkillsTurn(projectDir, { leaf_id: 'I.1', host_agent_response: '{"skills":["frontend-design"],"confidence":"high","rationale":"x","considered":[]}' });
  check('apply catalog-empty envelope', r.ok === false && r.reason === 'catalog-empty');
  // Leaf must not have been mutated.
  const persisted = readDeliberationState(projectDir);
  check('apply catalog-empty: leaf still pending', persisted.proposed_tree.milestones[0].children[0].pending_skill_resolution === true);
  cleanup(tmpRoot);
}

// ===========================================================================
// applyPlanSkillsTurn — happy resolve
// ===========================================================================
console.log('applyPlanSkillsTurn — happy paths');
{
  // Happy resolve: parses agent response, persists 4 fields, clears flag, increments revision.
  const { projectDir, tmpRoot } = makeTempProject('apply-resolve-happy');
  writePlan(projectDir, fixtureWithPendingLeaves());
  writeStubCatalog(projectDir);
  const agentResponse = 'This is a UI leaf with narrow scope.\n{"skills":["frontend-design","taste"],"confidence":"high","rationale":"UI scope with clear contract","considered":["react","playwright"]}';
  const r = applyPlanSkillsTurn(projectDir, { leaf_id: 'I.1', host_agent_response: agentResponse }, { now: FIXED_NOW });
  check('apply resolve: ok', r.ok === true);
  check('apply resolve: status', r.status === STATUS);
  check('apply resolve: mode=commit', r.mode === 'commit');
  check('apply resolve: stage=plan_skills (still pending II.1)', r.stage === 'plan_skills');
  check('apply resolve: transitioned=false', r.transitioned === false);
  check('apply resolve: leaf_id echoed', r.leaf_id === 'I.1');
  check('apply resolve: skills persisted', JSON.stringify(r.skills) === '["frontend-design","taste"]');
  check('apply resolve: confidence persisted', r.confidence === 'high');
  check('apply resolve: rationale persisted', r.rationale === 'UI scope with clear contract');
  check('apply resolve: considered persisted', JSON.stringify(r.considered) === '["react","playwright"]');
  check('apply resolve: remaining_leaf_ids=[II.1]', JSON.stringify(r.remaining_leaf_ids) === '["II.1"]');
  check('apply resolve: revision bumped', r.revision === 6);
  // Persisted state check.
  const persisted = readDeliberationState(projectDir);
  const leaf = persisted.proposed_tree.milestones[0].children[0];
  check('persisted: pending_skill_resolution cleared', !('pending_skill_resolution' in leaf) || leaf.pending_skill_resolution === undefined);
  check('persisted: skills written', JSON.stringify(leaf.skills) === '["frontend-design","taste"]');
  check('persisted: confidence=high', leaf.confidence === 'high');
  check('persisted: rationale set', leaf.rationale === 'UI scope with clear contract');
  check('persisted: considered written', JSON.stringify(leaf.considered) === '["react","playwright"]');
  check('persisted: stage still plan_skills', persisted.stage === 'plan_skills');
  // II.1 still pending — sibling preservation.
  const stillPending = persisted.proposed_tree.milestones[1].children[0];
  check('persisted: II.1 still pending', stillPending.pending_skill_resolution === true);
  cleanup(tmpRoot);
}
{
  // Resolve the last leaf: implicit transition to 'present'.
  const { projectDir, tmpRoot } = makeTempProject('apply-resolve-last');
  writePlan(projectDir, fixtureWithPendingLeaves());
  writeStubCatalog(projectDir);
  // Resolve I.1 first.
  applyPlanSkillsTurn(projectDir, {
    leaf_id: 'I.1',
    host_agent_response: '{"skills":["frontend-design"],"confidence":"high","rationale":"r1","considered":[]}'
  }, { now: FIXED_NOW });
  // Now resolve II.1 — should transition.
  const r = applyPlanSkillsTurn(projectDir, {
    leaf_id: 'II.1',
    host_agent_response: '{"skills":["playwright"],"confidence":"medium","rationale":"r2","considered":[]}'
  }, { now: FIXED_NOW_2 });
  check('apply resolve last: ok', r.ok === true);
  check('apply resolve last: stage=present', r.stage === 'present');
  check('apply resolve last: transitioned=true', r.transitioned === true);
  check('apply resolve last: remaining_leaf_ids=[]', JSON.stringify(r.remaining_leaf_ids) === '[]');
  check('apply resolve last: text mentions transition to Stage 7', /Stage 7|Present/.test(r.text));
  const persisted = readDeliberationState(projectDir);
  check('persisted: stage=present', persisted.stage === 'present');
  check('persisted: both leaves resolved', JSON.stringify(persisted.proposed_tree.milestones[0].children[0].skills) === '["frontend-design"]' && JSON.stringify(persisted.proposed_tree.milestones[1].children[0].skills) === '["playwright"]');
  cleanup(tmpRoot);
}
{
  // Skip: empty skills, low confidence, user-supplied rationale.
  const { projectDir, tmpRoot } = makeTempProject('apply-skip');
  writePlan(projectDir, fixtureWithPendingLeaves());
  writeStubCatalog(projectDir);
  const r = applyPlanSkillsTurn(projectDir, { leaf_id: 'I.1', kind: 'skip', rationale: 'leaf scope is too speculative to route' }, { now: FIXED_NOW });
  check('apply skip: ok', r.ok === true);
  check('apply skip: stage=plan_skills (II.1 still pending)', r.stage === 'plan_skills');
  check('apply skip: transitioned=false', r.transitioned === false);
  check('apply skip: skills=[]', JSON.stringify(r.skills) === '[]');
  check('apply skip: confidence=low', r.confidence === 'low');
  check('apply skip: rationale carries user text', r.rationale === 'leaf scope is too speculative to route');
  const persisted = readDeliberationState(projectDir);
  const leaf = persisted.proposed_tree.milestones[0].children[0];
  check('persisted skip: skills=[]', Array.isArray(leaf.skills) && leaf.skills.length === 0);
  check('persisted skip: confidence=low', leaf.confidence === 'low');
  check('persisted skip: rationale set', leaf.rationale === 'leaf scope is too speculative to route');
  check('persisted skip: considered=[]', Array.isArray(leaf.considered) && leaf.considered.length === 0);
  check('persisted skip: pending_skill_resolution cleared', !('pending_skill_resolution' in leaf) || leaf.pending_skill_resolution === undefined);
  cleanup(tmpRoot);
}
{
  // Skip without rationale → default "skipped by user".
  const { projectDir, tmpRoot } = makeTempProject('apply-skip-default-rationale');
  writePlan(projectDir, fixtureWithPendingLeaves());
  writeStubCatalog(projectDir);
  const r = applyPlanSkillsTurn(projectDir, { leaf_id: 'I.1', kind: 'skip' }, { now: FIXED_NOW });
  check('apply skip default: ok', r.ok === true);
  check('apply skip default: rationale="skipped by user"', r.rationale === 'skipped by user');
  cleanup(tmpRoot);
}
{
  // Re-analyze: transition to 'plan'; leaf NOT mutated.
  const { projectDir, tmpRoot } = makeTempProject('apply-reanalyze');
  writePlan(projectDir, fixtureWithPendingLeaves());
  writeStubCatalog(projectDir);
  const r = applyPlanSkillsTurn(projectDir, { leaf_id: 'I.1', kind: 'reanalyze' }, { now: FIXED_NOW });
  check('apply reanalyze: ok', r.ok === true);
  check('apply reanalyze: stage=plan', r.stage === 'plan');
  check('apply reanalyze: transitioned=true', r.transitioned === true);
  check('apply reanalyze: leaf_id echoed', r.leaf_id === 'I.1');
  const persisted = readDeliberationState(projectDir);
  check('persisted reanalyze: stage=plan', persisted.stage === 'plan');
  // Leaf unchanged: still pending.
  check('persisted reanalyze: leaf I.1 still pending', persisted.proposed_tree.milestones[0].children[0].pending_skill_resolution === true);
  check('persisted reanalyze: leaf I.1 skills still []', Array.isArray(persisted.proposed_tree.milestones[0].children[0].skills) && persisted.proposed_tree.milestones[0].children[0].skills.length === 0);
  cleanup(tmpRoot);
}

// ===========================================================================
// Unknown skills → inbox write (non-fatal)
// ===========================================================================
console.log('unknown skills → inbox');
{
  const { projectDir, tmpRoot } = makeTempProject('apply-unknown-skills');
  writePlan(projectDir, fixtureWithPendingLeaves());
  writeStubCatalog(projectDir);
  const r = applyPlanSkillsTurn(projectDir, {
    leaf_id: 'I.1',
    host_agent_response: '{"skills":["frontend-design","not-a-real-skill","another-fake"],"confidence":"high","rationale":"r","considered":[]}'
  }, { now: FIXED_NOW });
  check('apply unknown-skills: still ok', r.ok === true);
  check('apply unknown-skills: skills persisted verbatim', r.skills.length === 3);
  check('apply unknown-skills: includes fake skills', r.skills.includes('not-a-real-skill') && r.skills.includes('another-fake'));
  // Inbox check via re-parsing OVERDRIVE.md.
  const md = readPlan(projectDir);
  check('inbox: header present', md.includes(INBOX_HEADER_UNKNOWN));
  check('inbox: leaf id present', md.includes('leaf I.1'));
  check('inbox: fake skill name present', md.includes('not-a-real-skill'));
  check('inbox: another fake name present', md.includes('another-fake'));
  check('inbox: timestamp present', md.includes(FIXED_NOW));
  cleanup(tmpRoot);
}
{
  // All-known skills → no inbox write.
  const { projectDir, tmpRoot } = makeTempProject('apply-known-skills');
  writePlan(projectDir, fixtureWithPendingLeaves());
  writeStubCatalog(projectDir);
  applyPlanSkillsTurn(projectDir, {
    leaf_id: 'I.1',
    host_agent_response: '{"skills":["frontend-design","taste"],"confidence":"high","rationale":"r","considered":[]}'
  }, { now: FIXED_NOW });
  const md = readPlan(projectDir);
  check('inbox: no header for all-known skills', !md.includes(INBOX_HEADER_UNKNOWN));
  cleanup(tmpRoot);
}

// ===========================================================================
// runPlanSkills orchestrator
// ===========================================================================
console.log('runPlanSkills orchestrator');
{
  const { projectDir, tmpRoot } = makeTempProject('orch-plan');
  writePlan(projectDir, fixtureWithPendingLeaves());
  writeStubCatalog(projectDir);
  const r = runPlanSkills(projectDir, {});
  check('orch plan: ok', r.ok === true);
  check('orch plan: mode=plan', r.mode === 'plan');
  check('orch plan: leaf_id=I.1', r.leaf_id === 'I.1');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('orch-commit');
  writePlan(projectDir, fixtureWithPendingLeaves());
  writeStubCatalog(projectDir);
  const r = runPlanSkills(projectDir, {
    entries: {
      leaf_id: 'I.1',
      host_agent_response: '{"skills":["taste"],"confidence":"medium","rationale":"r","considered":[]}'
    },
    now: FIXED_NOW
  });
  check('orch commit: ok', r.ok === true);
  check('orch commit: mode=commit', r.mode === 'commit');
  cleanup(tmpRoot);
}

// ===========================================================================
// Migration-compat seam — Phase 2-migrated layout (no deliberation-state block)
// ===========================================================================
console.log('migration-compat seam');
{
  const { projectDir, tmpRoot } = makeTempProject('migration');
  writePlan(projectDir, FIXTURE_FRESH); // no block at all
  writeStubCatalog(projectDir);
  const r = buildPlanSkillsTurn(projectDir);
  check('migration: plan returns no-proposed-tree envelope (no block creates fresh state without proposed_tree)', r.ok === false && (r.reason === 'no-proposed-tree' || r.reason === 'missing-plan' || r.reason === 'deliberation-state-malformed'));
  // No-write guarantee — file unchanged.
  const before = readPlan(projectDir);
  const beforeBytes = Buffer.from(before);
  applyPlanSkillsTurn(projectDir, { leaf_id: 'X.1', host_agent_response: '{"skills":[],"confidence":"low","rationale":"r","considered":[]}' });
  const after = readPlan(projectDir);
  const afterBytes = Buffer.from(after);
  check('migration: file bytes unchanged after rejected apply', beforeBytes.equals(afterBytes));
  cleanup(tmpRoot);
}

// ===========================================================================
// Pattern 4 — JSON parse guard via ovdPlan.runPlan dispatch (deliberate subcommand at stage=plan_skills)
// ===========================================================================
console.log('Pattern 4 JSON guard via dispatch');
{
  const { projectDir, tmpRoot } = makeTempProject('p4-bad-json');
  writePlan(projectDir, fixtureWithPendingLeaves());
  writeStubCatalog(projectDir);
  const before = fs.readFileSync(path.join(projectDir, 'OVERDRIVE.md'));
  const r = ovdPlan.runPlan({
    subcommand: 'deliberate',
    projectDir,
    entriesJson: '{not valid'
  });
  check('p4 bad-json: ok=false', r.ok === false);
  check('p4 bad-json: status=deliberate (dispatch envelope)', r.status === 'deliberate');
  check('p4 bad-json: mode=commit', r.mode === 'commit');
  check('p4 bad-json: reason mentions JSON', /JSON|valid/i.test(r.reason));
  const after = fs.readFileSync(path.join(projectDir, 'OVERDRIVE.md'));
  check('p4 bad-json: file unchanged', before.equals(after));
  cleanup(tmpRoot);
}
{
  // Valid JSON dispatch — round-trips to plan-skills.
  const { projectDir, tmpRoot } = makeTempProject('p4-valid-dispatch');
  writePlan(projectDir, fixtureWithPendingLeaves());
  writeStubCatalog(projectDir);
  const r = ovdPlan.runPlan({
    subcommand: 'deliberate',
    projectDir,
    entriesJson: JSON.stringify({
      leaf_id: 'I.1',
      host_agent_response: '{"skills":["frontend-design"],"confidence":"high","rationale":"r","considered":[]}'
    })
  });
  check('p4 valid: ok=true', r.ok === true);
  check('p4 valid: status=plan-skills (sub-dispatch)', r.status === STATUS);
  check('p4 valid: skills persisted', JSON.stringify(r.skills) === '["frontend-design"]');
  cleanup(tmpRoot);
}

// ===========================================================================
// Integration: Slice A → blind-spot skip → Stage 5.5 full sweep → present
// ===========================================================================
console.log('integration');
{
  const { projectDir, tmpRoot } = makeTempProject('integration');
  writePlan(projectDir, fixtureWithPendingLeaves());
  writeStubCatalog(projectDir);
  // Resolve leaf I.1.
  let r = applyPlanSkillsTurn(projectDir, {
    leaf_id: 'I.1',
    host_agent_response: '{"skills":["frontend-design"],"confidence":"high","rationale":"UI","considered":["react"]}'
  }, { now: FIXED_NOW });
  check('int: I.1 resolved ok', r.ok === true && r.stage === 'plan_skills' && r.transitioned === false);
  // Build mid-flow — should now dispatch II.1.
  const mid = buildPlanSkillsTurn(projectDir);
  check('int: mid build dispatches II.1', mid.ok === true && mid.leaf_id === 'II.1');
  check('int: mid remaining=[II.1]', JSON.stringify(mid.remaining_leaf_ids) === '["II.1"]');
  // Resolve II.1 — last leaf → transition to present.
  r = applyPlanSkillsTurn(projectDir, {
    leaf_id: 'II.1',
    host_agent_response: '{"skills":["playwright"],"confidence":"medium","rationale":"e2e","considered":[]}'
  }, { now: FIXED_NOW_2 });
  check('int: II.1 resolved ok', r.ok === true);
  check('int: II.1 transition to present', r.stage === 'present' && r.transitioned === true);
  // Verify proposed_tree state after both resolutions.
  const persisted = readDeliberationState(projectDir);
  check('int: stage=present', persisted.stage === 'present');
  check('int: I.1 skills=[frontend-design]', JSON.stringify(persisted.proposed_tree.milestones[0].children[0].skills) === '["frontend-design"]');
  check('int: I.1 confidence=high', persisted.proposed_tree.milestones[0].children[0].confidence === 'high');
  check('int: I.1 considered=[react]', JSON.stringify(persisted.proposed_tree.milestones[0].children[0].considered) === '["react"]');
  check('int: II.1 skills=[playwright]', JSON.stringify(persisted.proposed_tree.milestones[1].children[0].skills) === '["playwright"]');
  check('int: II.1 confidence=medium', persisted.proposed_tree.milestones[1].children[0].confidence === 'medium');
  check('int: no leaf has pending_skill_resolution', findPendingLeaves(persisted.proposed_tree).length === 0);
  check('int: calibration sibling preserved (medium domain)', persisted.calibration.domain === 'medium');
  // Build at stage=present (Slice B no longer applies) → returns no-pending-leaves logically, but stage routing has moved on.
  const post = buildPlanSkillsTurn(projectDir);
  check('int: post-build returns no-pending-leaves envelope', post.ok === false && post.reason === 'no-pending-leaves');
  cleanup(tmpRoot);
}

// ===========================================================================
// Blind-spot-inserted leaves are resolved uniformly with user-planned leaves
// (Task 3.4 surface invariant — Slice B doesn't special-case)
// ===========================================================================
console.log('blind-spot inserts resolved uniformly');
{
  const { projectDir, tmpRoot } = makeTempProject('uniform-blind-spot');
  writeStubCatalog(projectDir);
  // Fixture with one user-planned leaf + one blind-spot-inserted leaf, both pending.
  writePlan(projectDir, `${FRONT}# Test Project

<!-- ovd-plan:deliberation-state:start -->
calibration:
  domain: medium
  technical: high
  scope: low
stage: plan_skills
proposed_tree:
  milestones:
    - id: "I"
      title: "Foundation"
      description: "core."
      ambiguity_score: 2
      children:
        - id: "I.1"
          title: "User-planned"
          description: "a user-planned leaf"
          scope: { in: ["src/"], out: [] }
          success: ["does X"]
          verify: { method: "vitest", fallback: "agent_self_check_against_success", review_required: true }
          deps: []
          skills: []
          confidence: "low"
          pending_skill_resolution: true
        - id: "I.4"
          title: "Agent-inserted accessibility pass"
          description: "from blind-spot Task 3.4"
          scope: { in: ["src/components/"], out: [] }
          success: ["wcag AA"]
          verify: { method: "axe-core", fallback: "agent_self_check_against_success", review_required: true }
          deps: []
          skills: []
          confidence: "low"
          pending_skill_resolution: true
          inserted_by: "agent"
          inserted_reason: "internal-tooling needs a11y"
          category: "accessibility"
<!-- ovd-plan:deliberation-state:end -->
`);
  // Resolve user-planned.
  let r = applyPlanSkillsTurn(projectDir, {
    leaf_id: 'I.1',
    host_agent_response: '{"skills":["frontend-design"],"confidence":"high","rationale":"core feature","considered":[]}'
  }, { now: FIXED_NOW });
  check('uniform: I.1 resolved', r.ok === true);
  // Resolve agent-inserted → should transition uniformly.
  r = applyPlanSkillsTurn(projectDir, {
    leaf_id: 'I.4',
    host_agent_response: '{"skills":["frontend-design"],"confidence":"high","rationale":"a11y pass","considered":[]}'
  }, { now: FIXED_NOW_2 });
  check('uniform: I.4 (agent) resolved', r.ok === true);
  check('uniform: I.4 transition to present', r.stage === 'present' && r.transitioned === true);
  const persisted = readDeliberationState(projectDir);
  // Verify the agent-inserted leaf retained ALL its Task 3.4 fields PLUS the new skill fields.
  const i4 = persisted.proposed_tree.milestones[0].children[1];
  check('uniform: I.4 inserted_by preserved', i4.inserted_by === 'agent');
  check('uniform: I.4 inserted_reason preserved', i4.inserted_reason === 'internal-tooling needs a11y');
  check('uniform: I.4 category preserved', i4.category === 'accessibility');
  check('uniform: I.4 skills filled', JSON.stringify(i4.skills) === '["frontend-design"]');
  check('uniform: I.4 confidence=high', i4.confidence === 'high');
  check('uniform: I.4 rationale set', i4.rationale === 'a11y pass');
  check('uniform: I.4 pending_skill_resolution cleared', !('pending_skill_resolution' in i4) || i4.pending_skill_resolution === undefined);
  cleanup(tmpRoot);
}

// ===========================================================================
// Multi-leaf partial-state resume (Q3.3B.10)
// ===========================================================================
console.log('multi-leaf partial-state resume');
{
  const { projectDir, tmpRoot } = makeTempProject('partial-resume');
  writeStubCatalog(projectDir);
  // 3 leaves: 1 already resolved, 2 still pending.
  writePlan(projectDir, `${FRONT}# Test Project

<!-- ovd-plan:deliberation-state:start -->
stage: plan_skills
proposed_tree:
  milestones:
    - id: "I"
      children:
        - id: "I.1"
          title: "Already resolved"
          description: "pre-resolved"
          scope: { in: [], out: [] }
          success: ["x"]
          verify: { method: "m", fallback: "f", review_required: true }
          deps: []
          skills: ["frontend-design"]
          confidence: "high"
          rationale: "previously resolved"
          considered: []
        - id: "I.2"
          title: "Still pending"
          description: "d"
          scope: { in: [], out: [] }
          success: ["y"]
          verify: { method: "m", fallback: "f", review_required: true }
          deps: []
          skills: []
          confidence: "low"
          pending_skill_resolution: true
        - id: "I.3"
          title: "Also pending"
          description: "d"
          scope: { in: [], out: [] }
          success: ["z"]
          verify: { method: "m", fallback: "f", review_required: true }
          deps: []
          skills: []
          confidence: "low"
          pending_skill_resolution: true
<!-- ovd-plan:deliberation-state:end -->
`);
  // Build should target I.2 (skips I.1, picks first pending).
  let r = buildPlanSkillsTurn(projectDir);
  check('partial: build skips I.1, targets I.2', r.ok === true && r.leaf_id === 'I.2');
  check('partial: remaining=[I.2, I.3]', JSON.stringify(r.remaining_leaf_ids) === '["I.2","I.3"]');
  // Resolve I.2.
  r = applyPlanSkillsTurn(projectDir, { leaf_id: 'I.2', host_agent_response: '{"skills":["taste"],"confidence":"medium","rationale":"r","considered":[]}' }, { now: FIXED_NOW });
  check('partial: I.2 resolved no transition', r.ok === true && r.stage === 'plan_skills' && r.transitioned === false);
  check('partial: I.1 was not touched', JSON.stringify(readDeliberationState(projectDir).proposed_tree.milestones[0].children[0].skills) === '["frontend-design"]');
  // Resolve I.3 → transition.
  r = applyPlanSkillsTurn(projectDir, { leaf_id: 'I.3', host_agent_response: '{"skills":["react"],"confidence":"low","rationale":"r","considered":[]}' }, { now: FIXED_NOW_2 });
  check('partial: I.3 resolved + transition', r.ok === true && r.stage === 'present' && r.transitioned === true);
  const persisted = readDeliberationState(projectDir);
  check('partial: I.1 rationale untouched', persisted.proposed_tree.milestones[0].children[0].rationale === 'previously resolved');
  check('partial: I.2 skills set', JSON.stringify(persisted.proposed_tree.milestones[0].children[1].skills) === '["taste"]');
  check('partial: I.3 skills set', JSON.stringify(persisted.proposed_tree.milestones[0].children[2].skills) === '["react"]');
  cleanup(tmpRoot);
}

// ===========================================================================
// formatPlan / formatCommit
// ===========================================================================
console.log('formatPlan / formatCommit');
check('formatPlan: returns text', formatPlan({ text: 'hello' }) === 'hello');
check('formatPlan: default on missing', formatPlan(null) === '(no plan text)');
check('formatCommit: returns text', formatCommit({ text: 'hi' }) === 'hi');
check('formatCommit: default on missing', formatCommit({}) === '(no commit text)');

// ===========================================================================
// Summary
// ===========================================================================
console.log('');
console.log(`${pass} checks passed.`);
if (fail > 0) {
  console.error(`${fail} FAILURES`);
  process.exit(1);
}
