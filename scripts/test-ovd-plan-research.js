#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const research = require('../lib/ovd-plan/research');
const {
  STATUS,
  KINDS,
  NEXT_ACTIONS,
  SESSIONS_REL,
  CODEBASE_REL,
  INBOX_HEADER_RESEARCH,
  INBOX_TOPIC_MAX_LEN,
  SLUG_MAX_LEN,
  SLUG_PATTERN,
  synthesizeSlug,
  validateSlug,
  isoToFilenameSafe,
  loadCodebaseContext,
  buildResearchPlan,
  normalizeResearchEntries,
  buildSessionsFilename,
  buildSubstantiveFileBody,
  applyResearchSubstantive,
  applyResearchOneLiner,
  renderApplySummary,
  applyResearchFindings,
  runResearch,
  formatPlan,
  formatCommit
} = research;

const ovdPlan = require('../lib/ovd-plan');
const calibrate = require('../lib/ovd-plan/calibrate');
const { openState } = require('../lib/ovd-plan/deliberation-state');

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
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-research-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
  return { projectDir, tmpRoot };
}
function cleanup(tmpRoot) { fs.rmSync(tmpRoot, { recursive: true, force: true }); }
function writePlan(projectDir, content) { fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), content); }
function readPlan(projectDir) { return fs.readFileSync(path.join(projectDir, 'OVERDRIVE.md'), 'utf8'); }
function writeCodebaseContext(projectDir, files) {
  const dir = path.join(projectDir, CODEBASE_REL);
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content);
  }
}

const FIXED_NOW = '2026-06-13T12:00:00.000Z';
const FIXED_NOW_2 = '2026-06-13T12:05:00.000Z';
const FRONT = '---\novd-plan: true\nversion: 3\nproject: "Test Project"\n---\n\n';

function seedMinimalPlan(projectDir) {
  writePlan(projectDir, FRONT + '# Test Project\n');
}
function seedCalibration(projectDir) {
  calibrate.applyCalibration(projectDir, { domain: 'medium', technical: 'high', scope: 'low', rationale: 'test' }, { now: FIXED_NOW });
}

// ---------------------------------------------------------------------------
// 1. Module surface
// ---------------------------------------------------------------------------
console.log('Module surface');
check('STATUS === "research"', STATUS === 'research');
check('KINDS shape', Array.isArray(KINDS) && KINDS.length === 2);
check('KINDS includes one-liner', KINDS.includes('one-liner'));
check('KINDS includes substantive', KINDS.includes('substantive'));
check('NEXT_ACTIONS shape', Array.isArray(NEXT_ACTIONS) && NEXT_ACTIONS.length === 3);
check('NEXT_ACTIONS includes edit', NEXT_ACTIONS.includes('edit'));
check('NEXT_ACTIONS includes handoff', NEXT_ACTIONS.includes('handoff'));
check('NEXT_ACTIONS includes null', NEXT_ACTIONS.includes(null));
check('SESSIONS_REL = .overdrive/sessions', SESSIONS_REL === path.join('.overdrive', 'sessions'));
check('CODEBASE_REL = .overdrive/codebase', CODEBASE_REL === path.join('.overdrive', 'codebase'));
check('INBOX_HEADER_RESEARCH defined', typeof INBOX_HEADER_RESEARCH === 'string' && INBOX_HEADER_RESEARCH.length > 0);
check('INBOX_TOPIC_MAX_LEN is positive int', typeof INBOX_TOPIC_MAX_LEN === 'number' && INBOX_TOPIC_MAX_LEN > 0);
check('SLUG_MAX_LEN is positive int', typeof SLUG_MAX_LEN === 'number' && SLUG_MAX_LEN > 0);
check('SLUG_PATTERN is RegExp', SLUG_PATTERN instanceof RegExp);
for (const fn of ['synthesizeSlug', 'validateSlug', 'isoToFilenameSafe', 'loadCodebaseContext', 'buildResearchPlan', 'normalizeResearchEntries', 'buildSessionsFilename', 'buildSubstantiveFileBody', 'applyResearchSubstantive', 'applyResearchOneLiner', 'renderApplySummary', 'applyResearchFindings', 'runResearch', 'formatPlan', 'formatCommit']) {
  check(`exported ${fn}`, typeof research[fn] === 'function');
}

// ---------------------------------------------------------------------------
// 2. synthesizeSlug
// ---------------------------------------------------------------------------
console.log('synthesizeSlug');
check('basic topic', synthesizeSlug('React Suspense patterns') === 'react-suspense-patterns');
check('lowercases', synthesizeSlug('REACT SUSPENSE') === 'react-suspense');
check('strips special chars', synthesizeSlug('React/Suspense: Patterns!') === 'react-suspense-patterns');
check('collapses runs of separators', synthesizeSlug('a__b___c') === 'a-b-c');
check('trims leading/trailing hyphens', synthesizeSlug('---hello---') === 'hello');
check('empty input → untitled', synthesizeSlug('') === 'untitled');
check('null input → untitled', synthesizeSlug(null) === 'untitled');
check('all-special input → untitled', synthesizeSlug('!!!@@@###') === 'untitled');
{
  const long = synthesizeSlug('the quick brown fox jumps over the lazy dog and runs around the bend');
  check('long topic truncated to <= SLUG_MAX_LEN', long.length <= SLUG_MAX_LEN);
  check('long topic preserves words', long.split('-').every((w) => w.length > 0 || w === ''));
  check('long topic matches SLUG_PATTERN', SLUG_PATTERN.test(long));
}

// ---------------------------------------------------------------------------
// 3. validateSlug
// ---------------------------------------------------------------------------
console.log('validateSlug');
check('non-string slug', validateSlug(42).includes('must be a string'));
check('empty slug', validateSlug('').includes('non-empty'));
check('too long slug', validateSlug('a'.repeat(SLUG_MAX_LEN + 1)).includes('≤'));
check('leading hyphen', validateSlug('-foo').includes('alphanumeric'));
check('trailing hyphen', validateSlug('foo-').includes('alphanumeric'));
check('contains slash', validateSlug('foo/bar').includes('alphanumeric'));
check('contains underscore', validateSlug('foo_bar').includes('alphanumeric'));
check('uppercase rejected', validateSlug('FooBar').includes('alphanumeric'));
check('single char accepted', validateSlug('a') === null);
check('multi-word kebab accepted', validateSlug('react-suspense-patterns') === null);
check('alphanumeric accepted', validateSlug('react18-hooks') === null);

// ---------------------------------------------------------------------------
// 4. isoToFilenameSafe
// ---------------------------------------------------------------------------
console.log('isoToFilenameSafe');
check('replaces colons', isoToFilenameSafe('2026-06-13T12:00:00.000Z') === '2026-06-13T12-00-00.000Z');
check('no colons → unchanged', isoToFilenameSafe('2026-06-13T12-00-00') === '2026-06-13T12-00-00');
check('handles non-string', isoToFilenameSafe(0) === '0');

// ---------------------------------------------------------------------------
// 5. loadCodebaseContext
// ---------------------------------------------------------------------------
console.log('loadCodebaseContext');
{
  const { projectDir, tmpRoot } = makeTempProject('codebase-none');
  const ctx = loadCodebaseContext(projectDir);
  check('no context → present=false', ctx.present === false);
  check('no context → patterns=null', ctx.patterns === null);
  check('no context → techStack=null', ctx.techStack === null);
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('codebase-both');
  writeCodebaseContext(projectDir, {
    'patterns.md': '# Patterns\n## Overview\nfoo',
    'tech-stack.md': '# Tech stack\n## Overview\nbar'
  });
  const ctx = loadCodebaseContext(projectDir);
  check('both present → present=true', ctx.present === true);
  check('patterns loaded', ctx.patterns.includes('foo'));
  check('techStack loaded', ctx.techStack.includes('bar'));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('codebase-only-patterns');
  writeCodebaseContext(projectDir, { 'patterns.md': '# Patterns\n' });
  const ctx = loadCodebaseContext(projectDir);
  check('only patterns → present=true', ctx.present === true);
  check('only patterns → techStack=null', ctx.techStack === null);
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 6. buildResearchPlan
// ---------------------------------------------------------------------------
console.log('buildResearchPlan');
{
  const { projectDir, tmpRoot } = makeTempProject('plan-no-topic');
  const r = buildResearchPlan(projectDir, {});
  check('no topic → ok=false', r.ok === false);
  check('no topic → reason=missing-topic', r.reason === 'missing-topic');
  check('no topic → text mentions invocation', r.text.includes('Invocation'));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('plan-no-codebase');
  const r = buildResearchPlan(projectDir, { text: 'React Suspense patterns' });
  check('no codebase → ok=true (soft-fail)', r.ok === true);
  check('no codebase → codebase_context_present=false', r.codebase_context_present === false);
  check('no codebase → text mentions /ovd-workflow map', r.text.includes('/ovd-workflow map'));
  check('no codebase → text mentions domain-only proceed', r.text.includes('Domain-only'));
  check('plan → echoes topic', r.text.includes('React Suspense patterns'));
  check('plan → mentions Context7', r.text.includes('Context7'));
  check('plan → mentions WebSearch', r.text.includes('WebSearch'));
  check('plan → mentions Q3.7 hybrid', r.text.includes('Q3.7 hybrid output'));
  check('plan → mentions one-liner kind', r.text.includes('"one-liner"'));
  check('plan → mentions substantive kind', r.text.includes('"substantive"'));
  check('plan → mentions /ovd-log handoff', r.text.includes('/ovd-log handoff'));
  check('plan → mentions /ovd-plan edit', r.text.includes('/ovd-plan edit'));
  check('plan → mentions /ovd-plan idea follow-up', r.text.includes('/ovd-plan idea'));
  check('plan → commit syntax for substantive', r.text.includes('"kind":"substantive"'));
  check('plan → commit syntax for one-liner', r.text.includes('"kind":"one-liner"'));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('plan-with-codebase');
  writeCodebaseContext(projectDir, {
    'patterns.md': '# Patterns\nfoo',
    'tech-stack.md': '# Tech stack\nbar'
  });
  const r = buildResearchPlan(projectDir, { text: 'topic' });
  check('with codebase → codebase_context_present=true', r.codebase_context_present === true);
  check('with codebase → text mentions patterns.md', r.text.includes('patterns.md'));
  check('with codebase → text mentions tech-stack.md', r.text.includes('tech-stack.md'));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('plan-with-calibration');
  seedMinimalPlan(projectDir);
  seedCalibration(projectDir);
  const r = buildResearchPlan(projectDir, { text: 'topic' });
  check('with calibration → r.calibration not null', r.calibration && r.calibration.domain === 'medium');
  check('with calibration → text shows axes', r.text.includes('domain: medium'));
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 7. normalizeResearchEntries
// ---------------------------------------------------------------------------
console.log('normalizeResearchEntries');
check('null → invalid-shape', normalizeResearchEntries(null).reason === 'invalid-shape');
check('array → invalid-shape', normalizeResearchEntries([]).reason === 'invalid-shape');
check('missing topic → invalid-values', normalizeResearchEntries({ kind: 'one-liner', findings: 'x' }).reason === 'invalid-values');
check('missing kind → invalid-values', normalizeResearchEntries({ topic: 'x', findings: 'x' }).reason === 'invalid-values');
check('bad kind → invalid-values', normalizeResearchEntries({ topic: 'x', kind: 'bogus', findings: 'x' }).reason === 'invalid-values');
check('missing findings → invalid-values', normalizeResearchEntries({ topic: 'x', kind: 'one-liner' }).reason === 'invalid-values');
check('empty findings → invalid-values', normalizeResearchEntries({ topic: 'x', kind: 'one-liner', findings: '   ' }).reason === 'invalid-values');
check('valid one-liner', normalizeResearchEntries({ topic: 't', kind: 'one-liner', findings: 'f' }).ok === true);
check('valid substantive', normalizeResearchEntries({ topic: 't', kind: 'substantive', findings: 'f' }).ok === true);
check('trims topic', normalizeResearchEntries({ topic: '  t  ', kind: 'one-liner', findings: 'f' }).entries.topic === 't');
check('trims findings', normalizeResearchEntries({ topic: 't', kind: 'one-liner', findings: '  f  ' }).entries.findings === 'f');
{
  const r = normalizeResearchEntries({ topic: 't', kind: 'one-liner', findings: 'f', slug: 'react-hooks' });
  check('valid slug preserved', r.entries.slug === 'react-hooks');
}
check('invalid slug → invalid-values', normalizeResearchEntries({ topic: 't', kind: 'one-liner', findings: 'f', slug: 'Foo/Bar' }).reason === 'invalid-values');
{
  const r = normalizeResearchEntries({ topic: 't', kind: 'one-liner', findings: 'f', sources: ['https://example.com', 'Context7: react'] });
  check('sources preserved', r.entries.sources.length === 2);
  check('sources trimmed', r.entries.sources[0] === 'https://example.com');
}
check('non-array sources → invalid-values', normalizeResearchEntries({ topic: 't', kind: 'one-liner', findings: 'f', sources: 'foo' }).reason === 'invalid-values');
check('empty-string source → invalid-values', normalizeResearchEntries({ topic: 't', kind: 'one-liner', findings: 'f', sources: ['ok', ''] }).reason === 'invalid-values');
check('non-string source → invalid-values', normalizeResearchEntries({ topic: 't', kind: 'one-liner', findings: 'f', sources: [42] }).reason === 'invalid-values');
{
  const r = normalizeResearchEntries({ topic: 't', kind: 'one-liner', findings: 'f', next_action: 'edit' });
  check('next_action edit preserved', r.entries.next_action === 'edit');
}
{
  const r = normalizeResearchEntries({ topic: 't', kind: 'one-liner', findings: 'f', next_action: null });
  check('next_action null preserved', r.entries.next_action === null);
}
check('bad next_action → invalid-values', normalizeResearchEntries({ topic: 't', kind: 'one-liner', findings: 'f', next_action: 'bogus' }).reason === 'invalid-values');

// ---------------------------------------------------------------------------
// 8. buildSessionsFilename + buildSubstantiveFileBody
// ---------------------------------------------------------------------------
console.log('buildSessionsFilename / buildSubstantiveFileBody');
check('filename shape', buildSessionsFilename(FIXED_NOW, 'react') === '2026-06-13T12-00-00.000Z-research-react.md');
{
  const body = buildSubstantiveFileBody({ topic: 'React Suspense', findings: 'Foo bar' }, FIXED_NOW);
  check('body has frontmatter', body.startsWith('---'));
  check('body has kind: research', body.includes('kind: research'));
  check('body has topic line', body.includes('topic: "React Suspense"'));
  check('body has generated_at', body.includes(`generated_at: ${FIXED_NOW}`));
  check('body has heading', body.includes('# Research: React Suspense'));
  check('body has findings', body.includes('Foo bar'));
}
{
  const body = buildSubstantiveFileBody({ topic: 't', findings: 'f', sources: ['s1', 's2'] }, FIXED_NOW);
  check('body with sources includes sources block', body.includes('sources:'));
  check('body with sources has s1', body.includes('"s1"'));
  check('body with sources has s2', body.includes('"s2"'));
}
{
  const body = buildSubstantiveFileBody({ topic: 't', findings: 'f' }, FIXED_NOW);
  check('body without sources omits sources block', !body.includes('sources:'));
}

// ---------------------------------------------------------------------------
// 9. applyResearchSubstantive
// ---------------------------------------------------------------------------
console.log('applyResearchSubstantive');
{
  const { projectDir, tmpRoot } = makeTempProject('substantive-happy');
  const entries = { topic: 'React Suspense patterns', kind: 'substantive', findings: 'Suspense suspends.\nThrow a promise.', sources: ['https://react.dev'] };
  const r = applyResearchSubstantive(projectDir, entries, { now: FIXED_NOW });
  check('substantive → ok', r.ok === true);
  check('substantive → kind=substantive', r.kind === 'substantive');
  check('substantive → applied=true', r.applied === true);
  check('substantive → sessions_path exists', fs.existsSync(r.sessions_path));
  check('substantive → file under sessions/', r.sessions_rel.startsWith(SESSIONS_REL));
  check('substantive → slug synthesized', r.slug === 'react-suspense-patterns');
  const content = fs.readFileSync(r.sessions_path, 'utf8');
  check('file has frontmatter', content.startsWith('---'));
  check('file has topic', content.includes('React Suspense patterns'));
  check('file has source', content.includes('https://react.dev'));
  check('file has findings', content.includes('Suspense suspends'));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('substantive-slug-override');
  const entries = { topic: 'Topic', kind: 'substantive', findings: 'f', slug: 'agent-slug' };
  const r = applyResearchSubstantive(projectDir, entries, { now: FIXED_NOW });
  check('agent slug used', r.slug === 'agent-slug');
  check('filename uses agent slug', r.sessions_rel.includes('agent-slug'));
  cleanup(tmpRoot);
}
{
  // Two substantives in a row use different timestamps → different files
  const { projectDir, tmpRoot } = makeTempProject('substantive-multiple');
  const r1 = applyResearchSubstantive(projectDir, { topic: 't', kind: 'substantive', findings: 'f' }, { now: FIXED_NOW });
  const r2 = applyResearchSubstantive(projectDir, { topic: 't', kind: 'substantive', findings: 'f' }, { now: FIXED_NOW_2 });
  check('two substantives → two files', r1.sessions_path !== r2.sessions_path);
  check('both files exist', fs.existsSync(r1.sessions_path) && fs.existsSync(r2.sessions_path));
  cleanup(tmpRoot);
}
{
  // Substantive does NOT require existing OVERDRIVE.md — early-stage research is valid
  const { projectDir, tmpRoot } = makeTempProject('substantive-no-plan');
  const r = applyResearchSubstantive(projectDir, { topic: 't', kind: 'substantive', findings: 'f' }, { now: FIXED_NOW });
  check('substantive no plan → ok=true (tolerant)', r.ok === true);
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 10. applyResearchOneLiner
// ---------------------------------------------------------------------------
console.log('applyResearchOneLiner');
{
  const { projectDir, tmpRoot } = makeTempProject('one-liner-no-plan');
  const r = applyResearchOneLiner(projectDir, { topic: 't', kind: 'one-liner', findings: 'f' }, { now: FIXED_NOW });
  check('one-liner no plan → ok=false', r.ok === false);
  check('one-liner no plan → reason=missing-plan', r.reason === 'missing-plan');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('one-liner-happy');
  seedMinimalPlan(projectDir);
  const entries = { topic: 'CSP headers', kind: 'one-liner', findings: 'Default-src self is the safe baseline.' };
  const r = applyResearchOneLiner(projectDir, entries, { now: FIXED_NOW });
  check('one-liner → ok', r.ok === true);
  check('one-liner → kind=one-liner', r.kind === 'one-liner');
  check('one-liner → inbox_header echoed', r.inbox_header === INBOX_HEADER_RESEARCH);
  const plan = readPlan(projectDir);
  check('plan has inbox header', plan.includes(`## ${INBOX_HEADER_RESEARCH}`));
  check('plan has [research: ...] line', plan.includes('[research: CSP headers]'));
  check('plan has findings text', plan.includes('Default-src self'));
  check('plan has timestamp', plan.includes(FIXED_NOW));
  cleanup(tmpRoot);
}
{
  // Two one-liners → single header (regex-escape bugfix from Task 3.5 honored)
  const { projectDir, tmpRoot } = makeTempProject('one-liner-multiple');
  seedMinimalPlan(projectDir);
  applyResearchOneLiner(projectDir, { topic: 'a', kind: 'one-liner', findings: 'fa' }, { now: FIXED_NOW });
  applyResearchOneLiner(projectDir, { topic: 'b', kind: 'one-liner', findings: 'fb' }, { now: FIXED_NOW_2 });
  const plan = readPlan(projectDir);
  const headerCount = (plan.match(new RegExp(`## ${INBOX_HEADER_RESEARCH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')) || []).length;
  check('two one-liners → single header', headerCount === 1, `got ${headerCount}`);
  check('both findings present', plan.includes('fa') && plan.includes('fb'));
  cleanup(tmpRoot);
}
{
  // Topic truncation in inbox entry — long topic gets word-boundary-truncated
  const { projectDir, tmpRoot } = makeTempProject('one-liner-truncation');
  seedMinimalPlan(projectDir);
  const longTopic = 'a really really really really long research topic about authentication patterns in modern web applications';
  const r = applyResearchOneLiner(projectDir, { topic: longTopic, kind: 'one-liner', findings: 'short' }, { now: FIXED_NOW });
  check('long topic truncated in inbox', r.text.includes('Topic truncated in inbox entry'));
  const plan = readPlan(projectDir);
  const inboxLine = plan.split('\n').find((l) => l.includes('[research:'));
  check('inbox line shorter than full topic', inboxLine && !inboxLine.includes(longTopic));
  cleanup(tmpRoot);
}
{
  // Newline sanitization in findings + topic
  const { projectDir, tmpRoot } = makeTempProject('one-liner-sanitize');
  seedMinimalPlan(projectDir);
  applyResearchOneLiner(projectDir, { topic: 'multi  spaces', kind: 'one-liner', findings: 'foo\nbar\nbaz' }, { now: FIXED_NOW });
  const plan = readPlan(projectDir);
  check('findings newlines collapsed', !plan.includes('foo\nbar\nbaz') && plan.includes('foo bar baz'));
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 11. renderApplySummary (action paths + recommendation marker)
// ---------------------------------------------------------------------------
console.log('renderApplySummary');
{
  const entries = { topic: 't', findings: 'f', next_action: null };
  const text = renderApplySummary(entries, { kind: 'substantive', filePath: '/abs', relPath: 'rel.md', slug: 'slug' });
  check('substantive summary: text mentions sessions file', text.includes('rel.md'));
  // Phase 3 completion (Remediation B): action-path render is the §5-canonical
  // 4 options — (1) edit / (2) handoff / (3) more research / (4) other — per
  // r3 §5.5 + Pattern 7 transparency.
  check('substantive summary: 4 numbered action paths',
    text.includes('(1) /ovd-plan edit')
    && text.includes('(2) /ovd-log handoff')
    && text.includes('(3) /ovd-plan research')
    && text.includes('(4) other'));
  check('substantive summary: idea follow-up surfaced inside (4) other',
    text.includes('/ovd-plan idea'));
  check('substantive summary: no recommendation marker when next_action=null', !text.includes('(recommended)'));
}
{
  const entries = { topic: 't', findings: 'f', next_action: 'edit' };
  const text = renderApplySummary(entries, { kind: 'substantive', filePath: '/abs', relPath: 'rel.md', slug: 'slug' });
  // Check exactly one line carries (recommended), and that line starts with the edit option.
  const recLines = text.split('\n').filter((l) => l.includes('(recommended)'));
  check('next_action=edit → exactly one (recommended) line', recLines.length === 1);
  check('next_action=edit → recommended line is the /ovd-plan edit option (1)', recLines[0] && /^\s*\(1\)\s+\/ovd-plan edit/.test(recLines[0]));
}
{
  const entries = { topic: 't', findings: 'f', next_action: 'handoff' };
  const text = renderApplySummary(entries, { kind: 'substantive', filePath: '/abs', relPath: 'rel.md', slug: 'slug' });
  const recLines = text.split('\n').filter((l) => l.includes('(recommended)'));
  check('next_action=handoff → exactly one (recommended) line', recLines.length === 1);
  check('next_action=handoff → recommended line is the /ovd-log handoff option (2)', recLines[0] && /^\s*\(2\)\s+\/ovd-log handoff/.test(recLines[0]));
}
{
  const entries = { topic: 'CSP headers', findings: 'Default-src self.', next_action: null };
  const text = renderApplySummary(entries, { kind: 'one-liner', inboxHeader: 'Research findings (lightweight)', truncatedTopic: 'CSP headers' });
  check('one-liner summary mentions inbox header', text.includes('Research findings (lightweight)'));
  check('one-liner summary: 4 numbered action paths',
    text.includes('(1) /ovd-plan edit')
    && text.includes('(2) /ovd-log handoff')
    && text.includes('(3) /ovd-plan research')
    && text.includes('(4) other'));
  check('one-liner summary: no truncation note when topic unchanged', !text.includes('Topic truncated'));
}

// ---------------------------------------------------------------------------
// 12. applyResearchFindings dispatch
// ---------------------------------------------------------------------------
console.log('applyResearchFindings dispatch');
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-substantive');
  const r = applyResearchFindings(projectDir, { topic: 't', kind: 'substantive', findings: 'f' }, { now: FIXED_NOW });
  check('dispatch substantive', r.kind === 'substantive' && r.ok === true);
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-one-liner');
  seedMinimalPlan(projectDir);
  const r = applyResearchFindings(projectDir, { topic: 't', kind: 'one-liner', findings: 'f' }, { now: FIXED_NOW });
  check('dispatch one-liner', r.kind === 'one-liner' && r.ok === true);
  cleanup(tmpRoot);
}
{
  const r = applyResearchFindings(null, { kind: 'bogus' });
  check('dispatch invalid kind', r.ok === false && r.reason === 'invalid-kind');
}

// ---------------------------------------------------------------------------
// 13. runResearch + ovdPlan integration
// ---------------------------------------------------------------------------
console.log('runResearch + ovdPlan integration');
{
  const { projectDir, tmpRoot } = makeTempProject('orch-plan');
  const r = runResearch(projectDir, { text: 'topic' });
  check('runResearch plan → ok', r.ok === true);
  check('runResearch plan → mode=plan', r.mode === 'plan');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('orch-commit-substantive');
  const r = runResearch(projectDir, { entries: { topic: 't', kind: 'substantive', findings: 'f' }, now: FIXED_NOW });
  check('runResearch commit → mode=commit', r.mode === 'commit');
  check('runResearch commit substantive → applied', r.applied === true);
  cleanup(tmpRoot);
}
{
  const r = runResearch('/tmp/nonexistent', { entries: { topic: 't', kind: 'bogus' } });
  check('runResearch bad entries → ok=false', r.ok === false);
  check('runResearch bad entries → reason=invalid-values', r.reason === 'invalid-values');
}
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-runPlan-plan');
  const r = ovdPlan.runPlan({ subcommand: 'research', text: 'topic', projectDir }, process.env);
  check('runPlan research plan → ok', r.ok === true);
  check('runPlan research plan → status=research', r.status === 'research');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-runPlan-bad-json');
  const r = ovdPlan.runPlan({ subcommand: 'research', entriesJson: '{not valid}', projectDir }, process.env);
  check('runPlan research bad JSON → ok=false', r.ok === false);
  check('runPlan research bad JSON → text mentions Invalid', r.text.includes('Invalid --entries-json'));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch-runPlan-commit');
  const entries = { topic: 't', kind: 'substantive', findings: 'f' };
  const r = ovdPlan.runPlan({ subcommand: 'research', entriesJson: JSON.stringify(entries), projectDir }, process.env);
  check('runPlan research commit → ok', r.ok === true);
  check('runPlan research commit → status=research', r.status === 'research');
  cleanup(tmpRoot);
}

// ---------------------------------------------------------------------------
// 14. Module surface integration
// ---------------------------------------------------------------------------
console.log('Module surface integration');
check('ovdPlan.research exported', !!ovdPlan.research);
check('ovdPlan.runResearch exported', typeof ovdPlan.runResearch === 'function');
check('ovdPlan.research.STATUS === "research"', ovdPlan.research.STATUS === 'research');

// ---------------------------------------------------------------------------
// 15. Formatters
// ---------------------------------------------------------------------------
console.log('Formatters');
check('formatPlan with text', formatPlan({ text: 'hello' }) === 'hello');
check('formatPlan without text', formatPlan({}) === '(no plan text)');
check('formatCommit with text', formatCommit({ text: 'hello' }) === 'hello');
check('formatCommit without text', formatCommit({}) === '(no commit text)');

// ---------------------------------------------------------------------------
// 16. Locked-design pre-flight tripwires
// ---------------------------------------------------------------------------
console.log('Locked-design pre-flight tripwires');
{
  // Q3.7 hybrid output by agent-classified kind
  check('Q3.7: KINDS has both one-liner + substantive', KINDS.includes('one-liner') && KINDS.includes('substantive'));
}
{
  // Q3.7.4 /ovd-log handoff option mentioned at apply
  const { projectDir, tmpRoot } = makeTempProject('q3.7.4');
  seedMinimalPlan(projectDir);
  const r = applyResearchOneLiner(projectDir, { topic: 't', kind: 'one-liner', findings: 'f' }, { now: FIXED_NOW });
  check('Q3.7.4: apply text mentions /ovd-log handoff', r.text.includes('/ovd-log handoff'));
  check('Q3.7.4: apply text mentions /ovd-plan edit', r.text.includes('/ovd-plan edit'));
  cleanup(tmpRoot);
}
{
  // Q3.7.5 no legacy .overdrive/research.md handling — write target is sessions/
  const { projectDir, tmpRoot } = makeTempProject('q3.7.5');
  fs.writeFileSync(path.join(projectDir, '.overdrive', 'research.md'), 'legacy content');
  const r = applyResearchSubstantive(projectDir, { topic: 't', kind: 'substantive', findings: 'f' }, { now: FIXED_NOW });
  check('Q3.7.5: writes to sessions/, not research.md', r.sessions_path.includes('sessions'));
  check('Q3.7.5: legacy research.md untouched', fs.readFileSync(path.join(projectDir, '.overdrive', 'research.md'), 'utf8') === 'legacy content');
  cleanup(tmpRoot);
}
{
  // Action-path render emits BOTH options regardless of next_action
  const both = renderApplySummary({ topic: 't', findings: 'f', next_action: 'edit' }, { kind: 'substantive', relPath: 'r', slug: 's' });
  check('Q3.7.4: both action paths present even when one is recommended',
    both.includes('/ovd-plan edit') && both.includes('/ovd-log handoff'));
}
{
  // Frontmatter includes kind: research (Task 3.7 refinement)
  const body = buildSubstantiveFileBody({ topic: 't', findings: 'f' }, FIXED_NOW);
  check('Refinement: frontmatter has kind: research', /^kind: research$/m.test(body));
}
{
  // Sources field validates non-empty-string entries (Task 3.7 refinement)
  const r = normalizeResearchEntries({ topic: 't', kind: 'one-liner', findings: 'f', sources: ['valid', ''] });
  check('Refinement: sources rejects empty-string entry', r.reason === 'invalid-values');
}

// ---------------------------------------------------------------------------
// FU-2 (2026-06-23): attach substantive research findings to a leaf via
// references.research[] (a pointer to the file, not a paste). Substantive only.
// ---------------------------------------------------------------------------
console.log('FU-2 attach_to_leaf');
const { findNodeById } = require('../lib/ovd-plan/cache');
function seedPlanWithLeaf(projectDir) {
  writePlan(projectDir, FRONT + '# Test Project\n\n## I. Milestone\n\n### I.1 Data layer\n\n```yaml ovd-plan\nskills: [modern-web-guidance]\n```\n');
}
check('normalize accepts attach_to_leaf string',
  normalizeResearchEntries({ topic: 't', kind: 'substantive', findings: 'f', attach_to_leaf: 'I.1' }).ok === true);
check('normalize rejects empty attach_to_leaf',
  normalizeResearchEntries({ topic: 't', kind: 'substantive', findings: 'f', attach_to_leaf: '  ' }).reason === 'invalid-values');
check('attach_to_leaf rejected for one-liner kind',
  normalizeResearchEntries({ topic: 't', kind: 'one-liner', findings: 'f', attach_to_leaf: 'I.1' }).reason === 'invalid-values');
{
  const { projectDir, tmpRoot } = makeTempProject('attach-happy');
  seedPlanWithLeaf(projectDir);
  const r = applyResearchSubstantive(projectDir, { topic: 'Caching', kind: 'substantive', findings: 'use SWR', attach_to_leaf: 'I.1' }, { now: FIXED_NOW });
  check('attach → ok', r.ok === true);
  check('attach → file written', fs.existsSync(r.sessions_path));
  check('attach → attached_to reported', r.attached_to === 'I.1');
  const found = findNodeById(openState(projectDir).parsed.tree, 'I.1');
  const refs = found && found.node.annotations && found.node.annotations.references;
  check('attach → leaf references.research[] holds the file path',
    !!refs && Array.isArray(refs.research) && refs.research.includes(r.sessions_rel));
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('attach-roundtrip');
  seedPlanWithLeaf(projectDir);
  applyResearchSubstantive(projectDir, { topic: 'Caching', kind: 'substantive', findings: 'x', attach_to_leaf: 'I.1' }, { now: FIXED_NOW });
  check('attach → OVERDRIVE.md still parses (round-trip)', openState(projectDir).ok === true);
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('attach-accumulate');
  seedPlanWithLeaf(projectDir);
  applyResearchSubstantive(projectDir, { topic: 'A', kind: 'substantive', findings: 'a', attach_to_leaf: 'I.1' }, { now: FIXED_NOW });
  applyResearchSubstantive(projectDir, { topic: 'B', kind: 'substantive', findings: 'b', attach_to_leaf: 'I.1' }, { now: FIXED_NOW_2 });
  const found = findNodeById(openState(projectDir).parsed.tree, 'I.1');
  const accRems = found && found.node.annotations && found.node.annotations.references && found.node.annotations.references.research;
  check('two attaches accumulate (append not overwrite)', Array.isArray(accRems) && accRems.length === 2);
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('attach-unknown-leaf');
  seedPlanWithLeaf(projectDir);
  const r = applyResearchSubstantive(projectDir, { topic: 'X', kind: 'substantive', findings: 'x', attach_to_leaf: 'Z.9' }, { now: FIXED_NOW });
  check('unknown leaf → not ok', r.ok === false);
  check('unknown leaf → reason attach-leaf-not-found', r.reason === 'attach-leaf-not-found');
  const sessionsDir = path.join(projectDir, SESSIONS_REL);
  const files = fs.existsSync(sessionsDir) ? fs.readdirSync(sessionsDir) : [];
  check('unknown leaf → no orphan research file (validated before write)', files.length === 0);
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('attach-container');
  seedPlanWithLeaf(projectDir);
  const r = applyResearchSubstantive(projectDir, { topic: 'X', kind: 'substantive', findings: 'x', attach_to_leaf: 'I' }, { now: FIXED_NOW });
  check('container attach → not ok', r.ok === false);
  check('container attach → reason attach-not-a-leaf', r.reason === 'attach-not-a-leaf');
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('attach-absent');
  const r = applyResearchSubstantive(projectDir, { topic: 'X', kind: 'substantive', findings: 'x' }, { now: FIXED_NOW });
  check('no attach_to_leaf → ok (unchanged behavior, no tree needed)', r.ok === true);
  check('no attach_to_leaf → attached_to falsy', !r.attached_to);
  cleanup(tmpRoot);
}
{
  const { projectDir, tmpRoot } = makeTempProject('attach-plan-discoverability');
  const r = research.buildResearchPlan(projectDir, { text: 'caching' });
  check('plan-mode text documents attach_to_leaf', r.text.includes('attach_to_leaf'));
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
