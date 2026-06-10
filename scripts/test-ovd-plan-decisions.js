#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  TABLE_HEADER,
  TABLE_DIVIDER,
  DIVIDER_PATTERN,
  ROW_PATTERN,
  todayDate,
  decisionsPath,
  escapeCell,
  buildRow,
  buildPlaceholderWithFirstRow,
  findTableSpan,
  parseRow,
  appendDecision,
  readDecisions
} = require('../lib/ovd-plan/decisions-log');

const fsHelpers = require('../lib/ovd-plan/fs');

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
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-decisions-test-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  return { projectDir, tmpRoot };
}

function cleanup(tmpRoot) {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

console.log('ovd-plan decisions-log tests');

// --- 0. Module surface ---
{
  check('TABLE_HEADER value', TABLE_HEADER === '| Date | Node | Decision | Rationale |');
  check('TABLE_DIVIDER value', TABLE_DIVIDER === '|---|---|---|---|');
  check('DIVIDER_PATTERN matches the divider', DIVIDER_PATTERN.test(TABLE_DIVIDER));
  check('DIVIDER_PATTERN matches widened divider', DIVIDER_PATTERN.test('| :--- | :---: | ---: | --- |'));
  check('DIVIDER_PATTERN rejects a normal row', !DIVIDER_PATTERN.test('| 2026-06-10 | a | b | c |'));
  check('ROW_PATTERN matches a normal row', ROW_PATTERN.test('| 2026-06-10 | II.2.a | decided | because |'));
  check('appendDecision is a function', typeof appendDecision === 'function');
  check('readDecisions is a function', typeof readDecisions === 'function');
}

// --- 1. todayDate format ---
{
  const t = todayDate();
  check('todayDate: YYYY-MM-DD format', /^\d{4}-\d{2}-\d{2}$/.test(t), t);
}

// --- 2. escapeCell ---
{
  check('escapeCell: null → empty', escapeCell(null) === '');
  check('escapeCell: undefined → empty', escapeCell(undefined) === '');
  check('escapeCell: number coerced to string', escapeCell(42) === '42');
  check('escapeCell: pipe escaped', escapeCell('a|b') === 'a\\|b');
  check('escapeCell: newline → <br>', escapeCell('line1\nline2') === 'line1<br>line2');
  check('escapeCell: \\r\\n → <br>', escapeCell('line1\r\nline2') === 'line1<br>line2');
  check('escapeCell: plain string unchanged', escapeCell('hello world') === 'hello world');
}

// --- 3. buildRow ---
{
  const row = buildRow({ date: '2026-06-10', node: 'II.2.a', decision: 'Use Tailwind', rationale: 'Familiar to team' });
  check('buildRow: pipe-delimited shape', /^\| 2026-06-10 \| II\.2\.a \| Use Tailwind \| Familiar to team \|$/.test(row));

  const withPipe = buildRow({ decision: 'route a|b' });
  check('buildRow: pipe in decision is escaped', /route a\\\|b/.test(withPipe));

  const noDate = buildRow({ decision: 'no date provided' });
  check('buildRow: missing date defaults to today', new RegExp(`^\\| ${todayDate()} \\|`).test(noDate));

  const allBlank = buildRow({ decision: 'D' });
  check('buildRow: blank fields render as empty cells', /\|\s*\|\s*D\s*\|\s*\|$/.test(allBlank));
}

// --- 4. buildPlaceholderWithFirstRow ---
{
  const placeholder = buildPlaceholderWithFirstRow('| 2026-06-10 | n | d | r |');
  check('placeholder: starts with # Decisions', placeholder.startsWith('# Decisions\n'));
  check('placeholder: includes table header', placeholder.includes(TABLE_HEADER));
  check('placeholder: includes divider', placeholder.includes(TABLE_DIVIDER));
  check('placeholder: includes the row', placeholder.includes('| 2026-06-10 | n | d | r |'));
}

// --- 5. findTableSpan ---
{
  const lines = [
    '# Decisions',
    '',
    'Append-only log.',
    '',
    TABLE_HEADER,
    TABLE_DIVIDER,
    '| 2026-06-01 | n | d1 | r1 |',
    '| 2026-06-02 | n | d2 | r2 |',
    '',
    '## Other section'
  ];
  const span = findTableSpan(lines);
  check('findTableSpan: dividerIdx points at divider', span && lines[span.dividerIdx] === TABLE_DIVIDER);
  check('findTableSpan: endIdx points at last row', span && /d2/.test(lines[span.endIdx]));

  const noTable = findTableSpan(['# Decisions', 'no table here']);
  check('findTableSpan: returns null when no divider', noTable === null);
}

// --- 6. parseRow round-trip ---
{
  const original = { date: '2026-06-10', node: 'II.2.a', decision: 'Decided X with | and a line\nbreak', rationale: 'Because' };
  const row = buildRow(original);
  const parsed = parseRow(row);
  check('parseRow: date matches', parsed && parsed.date === '2026-06-10');
  check('parseRow: node matches', parsed && parsed.node === 'II.2.a');
  check('parseRow: decision pipe unescaped', parsed && parsed.decision.includes('|'));
  check('parseRow: decision newline restored from <br>', parsed && /\n/.test(parsed.decision));
  check('parseRow: rationale matches', parsed && parsed.rationale === 'Because');

  check('parseRow: rejects 3-cell row', parseRow('| a | b | c |') === null);
}

// --- 7. appendDecision: validation ---
{
  check('appendDecision: no rootDir → ok=false', appendDecision(null, { decision: 'd' }).ok === false);
  check('appendDecision: missing decision → ok=false', appendDecision('/tmp', {}).ok === false);
  check('appendDecision: empty decision string → ok=false', appendDecision('/tmp', { decision: '' }).ok === false);
}

// --- 8. appendDecision: fresh file → creates v2 placeholder + first row ---
{
  const { projectDir, tmpRoot } = makeTempProject('fresh');
  try {
    fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
    const result = appendDecision(projectDir, { decision: 'Use Postgres', rationale: 'Team familiarity' });
    check('fresh: ok=true', result.ok === true);
    check('fresh: action=created', result.action === 'created');
    check('fresh: totalRows=1', result.totalRows === 1);
    const content = fs.readFileSync(result.path, 'utf8');
    check('fresh: file has # Decisions header', /^# Decisions/m.test(content));
    check('fresh: file has table header', content.includes(TABLE_HEADER));
    check('fresh: file has the row', /Use Postgres/.test(content));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 9. appendDecision: multiple appends → totalRows increments, order preserved ---
{
  const { projectDir, tmpRoot } = makeTempProject('multi');
  try {
    fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
    const r1 = appendDecision(projectDir, { date: '2026-06-08', node: 'I', decision: 'D1', rationale: 'R1' });
    const r2 = appendDecision(projectDir, { date: '2026-06-09', node: 'II', decision: 'D2', rationale: 'R2' });
    const r3 = appendDecision(projectDir, { date: '2026-06-10', node: 'III', decision: 'D3', rationale: 'R3' });

    check('multi.1: totalRows=1 after first', r1.totalRows === 1);
    check('multi.2: totalRows=2 after second', r2.totalRows === 2);
    check('multi.3: totalRows=3 after third', r3.totalRows === 3);
    check('multi.2: action=appended (not created)', r2.action === 'appended');

    const read = readDecisions(projectDir);
    check('multi: readDecisions exists=true', read.exists === true);
    check('multi: 3 rows in insertion order',
      read.rows.length === 3 &&
      read.rows[0].decision === 'D1' &&
      read.rows[1].decision === 'D2' &&
      read.rows[2].decision === 'D3');
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 10. appendDecision: existing v2 placeholder (no rows yet) → appends first row ---
{
  const { projectDir, tmpRoot } = makeTempProject('placeholder');
  try {
    fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
    const filePath = fsHelpers.ovdPath(projectDir, 'decisions.md');
    fs.writeFileSync(filePath, fsHelpers.NEW_LAYOUT_PLACEHOLDER_FILES['decisions.md']);

    const result = appendDecision(projectDir, { decision: 'First real decision' });
    check('placeholder: ok=true', result.ok === true);
    check('placeholder: action=appended (table existed)', result.action === 'appended');
    check('placeholder: totalRows=1', result.totalRows === 1);
    const read = readDecisions(projectDir);
    check('placeholder: 1 row visible', read.rows.length === 1 && read.rows[0].decision === 'First real decision');
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 11. appendDecision: legacy-wrapped file (Legacy notes + structured table) ---
{
  const { projectDir, tmpRoot } = makeTempProject('legacy-wrapped');
  try {
    fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
    const filePath = fsHelpers.ovdPath(projectDir, 'decisions.md');
    fs.writeFileSync(
      filePath,
      [
        '# Decisions',
        '',
        '## Legacy notes (from pre-v2 .overdrive/decisions.md)',
        '',
        'We decided X on 2026-05-01.',
        '',
        '## Structured log',
        '',
        TABLE_HEADER,
        TABLE_DIVIDER,
        '| 2026-05-09 | I | Existing legacy row | Mid-wrap example |',
        ''
      ].join('\n')
    );

    const result = appendDecision(projectDir, { decision: 'New decision after wrap' });
    check('legacy-wrapped: ok=true', result.ok === true);
    check('legacy-wrapped: action=appended', result.action === 'appended');
    check('legacy-wrapped: totalRows=2', result.totalRows === 2);

    const content = fs.readFileSync(filePath, 'utf8');
    check('legacy-wrapped: Legacy notes preserved', /## Legacy notes/.test(content));
    check('legacy-wrapped: legacy prose preserved', /We decided X on 2026-05-01/.test(content));
    check('legacy-wrapped: existing row preserved', /Existing legacy row/.test(content));
    check('legacy-wrapped: new row appended', /New decision after wrap/.test(content));

    const read = readDecisions(projectDir);
    check('legacy-wrapped: 2 rows visible',
      read.rows.length === 2 &&
      read.rows[1].decision === 'New decision after wrap');
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 12. appendDecision: file exists but has no table → adds table + row ---
{
  const { projectDir, tmpRoot } = makeTempProject('no-table');
  try {
    fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
    const filePath = fsHelpers.ovdPath(projectDir, 'decisions.md');
    fs.writeFileSync(filePath, '# Decisions\n\nSome prose without a table.\n');

    const result = appendDecision(projectDir, { decision: 'First structured decision' });
    check('no-table: ok=true', result.ok === true);
    check('no-table: action=table-appended', result.action === 'table-appended');
    const content = fs.readFileSync(filePath, 'utf8');
    check('no-table: original prose preserved', /Some prose without a table/.test(content));
    check('no-table: table header now present', content.includes(TABLE_HEADER));
    check('no-table: row present', /First structured decision/.test(content));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 13. appendDecision: pipe in decision is escaped in the written row ---
{
  const { projectDir, tmpRoot } = makeTempProject('pipe-escape');
  try {
    fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
    const result = appendDecision(projectDir, { decision: 'Route /api/foo|bar to handler' });
    const content = fs.readFileSync(result.path, 'utf8');
    check('pipe-escape: pipe is escaped in file', /\\\|/.test(content));
    const read = readDecisions(projectDir);
    check('pipe-escape: readDecisions un-escapes pipe', read.rows[0].decision === 'Route /api/foo|bar to handler');
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 14. appendDecision: multiline rationale → <br> in file, \n on read-back ---
{
  const { projectDir, tmpRoot } = makeTempProject('multiline');
  try {
    fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
    const result = appendDecision(projectDir, {
      decision: 'Use module Y',
      rationale: 'Reason 1.\nReason 2.\nReason 3.'
    });
    const content = fs.readFileSync(result.path, 'utf8');
    check('multiline: <br> tokens in file', /Reason 1\.<br>Reason 2\./.test(content));
    const read = readDecisions(projectDir);
    check('multiline: readDecisions restores newlines', /Reason 1\.\nReason 2\./.test(read.rows[0].rationale));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 15. readDecisions: missing file → exists=false, rows=[] ---
{
  const { projectDir, tmpRoot } = makeTempProject('read-missing');
  try {
    const read = readDecisions(projectDir);
    check('read-missing: ok=true', read.ok === true);
    check('read-missing: exists=false', read.exists === false);
    check('read-missing: rows=[]', Array.isArray(read.rows) && read.rows.length === 0);
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 16. readDecisions: file without a table → exists=true, rows=[] ---
{
  const { projectDir, tmpRoot } = makeTempProject('read-no-table');
  try {
    fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
    fs.writeFileSync(fsHelpers.ovdPath(projectDir, 'decisions.md'), '# Decisions\n\nProse only.\n');
    const read = readDecisions(projectDir);
    check('read-no-table: exists=true', read.exists === true);
    check('read-no-table: rows=[]', read.rows.length === 0);
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 17. readDecisions: null rootDir → ok=false ---
{
  const r = readDecisions(null);
  check('readDecisions(null): ok=false', r.ok === false);
}

// --- 18. Append-only semantics: same entry twice creates two rows (no dedup) ---
{
  const { projectDir, tmpRoot } = makeTempProject('append-only');
  try {
    fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
    appendDecision(projectDir, { date: '2026-06-10', node: 'II', decision: 'Dup', rationale: 'Same' });
    const r2 = appendDecision(projectDir, { date: '2026-06-10', node: 'II', decision: 'Dup', rationale: 'Same' });
    check('append-only: second identical append still increments', r2.totalRows === 2);
    const read = readDecisions(projectDir);
    check('append-only: 2 rows after dup append', read.rows.length === 2);
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 19. Dispatch via lib/ovd-plan: appendDecision + readDecisions surface ---
{
  const { projectDir, tmpRoot } = makeTempProject('dispatch');
  try {
    const ovdPlan = require('../lib/ovd-plan');
    fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
    const r1 = ovdPlan.appendDecision(projectDir, { decision: 'Via index export' });
    check('dispatch: ovdPlan.appendDecision works', r1.ok === true);
    const read = ovdPlan.readDecisions(projectDir);
    check('dispatch: ovdPlan.readDecisions returns the row', read.rows.length === 1 && read.rows[0].decision === 'Via index export');
    check('dispatch: ovdPlan.decisionsLog.TABLE_HEADER exported',
      ovdPlan.decisionsLog && ovdPlan.decisionsLog.TABLE_HEADER === TABLE_HEADER);
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 20. decisionsPath resolves to .overdrive/decisions.md ---
{
  const p = decisionsPath('/tmp/foo');
  check('decisionsPath: ends with .overdrive/decisions.md', /\.overdrive[\\/]+decisions\.md$/.test(p));
}

// --- Report ---
console.log('');
if (failures.length > 0) {
  console.log(`${failures.length} failure(s):`);
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
} else {
  console.log(`${passed} checks passed.`);
}
