#!/usr/bin/env node
'use strict';

// Task 5.3 — /ovd-log capture "text"
// Timestamped append to the current session file (or a new one if none).
// Zero analysis, zero interruption; atomic append.

const fs = require('fs');
const os = require('os');
const path = require('path');

const capture = require('../lib/ovd-plan/log-capture');
const {
  LOG_SESSION_PATTERN,
  formatStamp,
  sessionsDir,
  findCurrentSessionFile,
  appendSessionEntry,
  runLogCapture
} = capture;

const verbose = process.argv.includes('--verbose');
let passed = 0;
const failures = [];
function check(label, condition, detail) {
  if (condition) { passed += 1; if (verbose) console.log(`PASS ${label}`); }
  else { failures.push(detail ? `${label}: ${detail}` : label); console.log(`FAIL ${label}`); }
}

function makeTempProject(name) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-log-capture-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.mkdirSync(path.join(projectDir, '.overdrive'), { recursive: true });
  return { projectDir, tmpRoot };
}
function cleanup(tmpRoot) { fs.rmSync(tmpRoot, { recursive: true, force: true }); }
function sdir(projectDir) { return path.join(projectDir, '.overdrive', 'sessions'); }
function listSessions(projectDir) {
  const d = sdir(projectDir);
  return fs.existsSync(d) ? fs.readdirSync(d).sort() : [];
}
function readSession(projectDir, name) {
  return fs.readFileSync(path.join(sdir(projectDir), name), 'utf8');
}

// --- formatStamp ---------------------------------------------------------
(function () {
  const s = formatStamp('2026-06-20T15:36:09.123Z');
  check('formatStamp.file shape', s.file === '2026-06-20-15-36', s.file);
  check('formatStamp.display shape', s.display === '2026-06-20 15:36', s.display);
  check('formatStamp.file matches LOG_SESSION_PATTERN', LOG_SESSION_PATTERN.test(`${s.file}.md`));
  // zero-padding
  const s2 = formatStamp('2026-01-05T04:07:00.000Z');
  check('formatStamp zero-pads month/day', s2.file === '2026-01-05-04-07', s2.file);
  check('formatStamp.display zero-pads', s2.display === '2026-01-05 04:07', s2.display);
})();

// --- LOG_SESSION_PATTERN discriminates session files from sub-files -------
(function () {
  check('pattern matches plain session file', LOG_SESSION_PATTERN.test('2026-06-20-15-36.md'));
  check('pattern rejects research sub-file', !LOG_SESSION_PATTERN.test('2026-06-20T15-36-00.000Z-research-foo.md'));
  check('pattern rejects execute sub-file', !LOG_SESSION_PATTERN.test('2026-06-20T15-36-00.000Z-execute-II.2.a.md'));
  check('pattern rejects legacy state file', !LOG_SESSION_PATTERN.test('2026-06-09T00-00-00.000Z-legacy-state.md'));
  check('pattern rejects _research_legacy', !LOG_SESSION_PATTERN.test('_research_legacy.md'));
  check('pattern rejects non-md', !LOG_SESSION_PATTERN.test('2026-06-20-15-36.txt'));
})();

// --- runLogCapture: creates session file when none ----------------------
(function () {
  const { projectDir, tmpRoot } = makeTempProject('create');
  const res = runLogCapture(projectDir, 'started auth refactor', { now: '2026-06-20T15:36:00.000Z' });
  check('create ok', res.ok === true, JSON.stringify(res));
  check('create status captured', res.status === 'captured', res.status);
  check('create reports created=true', res.created === true);
  const files = listSessions(projectDir);
  check('create wrote exactly one session file', files.length === 1, files.join(','));
  check('create filename is YYYY-MM-DD-HH-MM.md', files[0] === '2026-06-20-15-36.md', files[0]);
  const body = readSession(projectDir, files[0]);
  check('create body has header', body.includes('# Session 2026-06-20 15:36'), body);
  check('create body has activity log header', /##\s+Activity log/i.test(body), body);
  check('create body has entry line', body.includes('[2026-06-20 15:36] started auth refactor'), body);
  check('create res.file is relative path under .overdrive/sessions', res.file === path.join('.overdrive', 'sessions', '2026-06-20-15-36.md'), res.file);
  cleanup(tmpRoot);
})();

// --- runLogCapture: appends to existing current session file -------------
(function () {
  const { projectDir, tmpRoot } = makeTempProject('append');
  runLogCapture(projectDir, 'first entry', { now: '2026-06-20T15:36:00.000Z' });
  const res2 = runLogCapture(projectDir, 'second entry', { now: '2026-06-20T15:40:00.000Z' });
  check('append ok', res2.ok === true);
  check('append reports created=false', res2.created === false);
  const files = listSessions(projectDir);
  check('append did not create a second file', files.length === 1, files.join(','));
  const body = readSession(projectDir, files[0]);
  check('append kept first entry', body.includes('[2026-06-20 15:36] first entry'));
  check('append added second entry with its own stamp', body.includes('[2026-06-20 15:40] second entry'));
  check('append preserves order', body.indexOf('first entry') < body.indexOf('second entry'));
  check('append did not duplicate header', (body.match(/# Session/g) || []).length === 1, body);
  cleanup(tmpRoot);
})();

// --- empty / whitespace text rejected, no write -------------------------
(function () {
  const { projectDir, tmpRoot } = makeTempProject('empty');
  const r1 = runLogCapture(projectDir, '', { now: '2026-06-20T15:36:00.000Z' });
  check('empty text rejected', r1.ok === false);
  check('empty text gives reason', typeof r1.reason === 'string' && r1.reason.length > 0, r1.reason);
  const r2 = runLogCapture(projectDir, '   \n  ', { now: '2026-06-20T15:36:00.000Z' });
  check('whitespace text rejected', r2.ok === false);
  const r3 = runLogCapture(projectDir, undefined, { now: '2026-06-20T15:36:00.000Z' });
  check('undefined text rejected', r3.ok === false);
  check('no session file written on reject', listSessions(projectDir).length === 0);
  cleanup(tmpRoot);
})();

// --- multi-line + special chars preserved -------------------------------
(function () {
  const { projectDir, tmpRoot } = makeTempProject('special');
  const text = 'noted: brackets [x] and unicode ✓ — kept\nsecond line';
  const res = runLogCapture(projectDir, text, { now: '2026-06-20T15:36:00.000Z' });
  check('special ok', res.ok === true);
  const body = readSession(projectDir, listSessions(projectDir)[0]);
  check('special preserves brackets', body.includes('brackets [x]'));
  check('special preserves unicode', body.includes('unicode ✓ — kept'));
  check('special preserves second line', body.includes('second line'));
  check('special prefixes only once', (body.match(/\[2026-06-20 15:36\]/g) || []).length === 1, body);
  cleanup(tmpRoot);
})();

// --- text is trimmed of surrounding whitespace but inner preserved -------
(function () {
  const { projectDir, tmpRoot } = makeTempProject('trim');
  runLogCapture(projectDir, '  padded entry  ', { now: '2026-06-20T15:36:00.000Z' });
  const body = readSession(projectDir, listSessions(projectDir)[0]);
  check('surrounding whitespace trimmed', body.includes('[2026-06-20 15:36] padded entry'));
  check('no double-space before text', !body.includes('15:36]  padded'), body);
  cleanup(tmpRoot);
})();

// --- findCurrentSessionFile picks newest, ignores sub-files -------------
(function () {
  const { projectDir, tmpRoot } = makeTempProject('current');
  const d = sdir(projectDir);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, '2026-06-19-09-00.md'), '# Session 2026-06-19 09:00\n');
  fs.writeFileSync(path.join(d, '2026-06-20-15-36.md'), '# Session 2026-06-20 15:36\n');
  fs.writeFileSync(path.join(d, '2026-06-20T15-50-00.000Z-research-foo.md'), 'sub-file\n');
  fs.writeFileSync(path.join(d, '_research_legacy.md'), 'legacy\n');
  const cur = findCurrentSessionFile(projectDir);
  check('findCurrent picks newest log-session file', path.basename(cur) === '2026-06-20-15-36.md', cur);
  cleanup(tmpRoot);
})();

(function () {
  const { projectDir, tmpRoot } = makeTempProject('current-none');
  check('findCurrent null when no sessions dir', findCurrentSessionFile(projectDir) === null);
  fs.mkdirSync(sdir(projectDir), { recursive: true });
  check('findCurrent null when dir empty', findCurrentSessionFile(projectDir) === null);
  fs.writeFileSync(path.join(sdir(projectDir), '2026-06-20T15-50-00.000Z-execute-x.md'), 'sub\n');
  check('findCurrent null when only sub-files present', findCurrentSessionFile(projectDir) === null);
  cleanup(tmpRoot);
})();

// --- capture appends to existing current file, not a new one ------------
(function () {
  const { projectDir, tmpRoot } = makeTempProject('append-existing');
  const d = sdir(projectDir);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, '2026-06-20-15-36.md'), '# Session 2026-06-20 15:36\n\n## Activity log\n\n[2026-06-20 15:36] earlier\n');
  // Later capture (different minute) should still append to the existing current file.
  const res = runLogCapture(projectDir, 'later note', { now: '2026-06-20T16:10:00.000Z' });
  check('append-existing created=false', res.created === false);
  check('append-existing did not add a 16-10 file', listSessions(projectDir).length === 1, listSessions(projectDir).join(','));
  const body = readSession(projectDir, '2026-06-20-15-36.md');
  check('append-existing kept earlier', body.includes('[2026-06-20 15:36] earlier'));
  check('append-existing added later with its stamp', body.includes('[2026-06-20 16:10] later note'));
  cleanup(tmpRoot);
})();

// --- migration-compat seam (Pattern 5) ----------------------------------
// A Phase 2-migrated layout has legacy + sub-files in sessions/. Capture must
// create a fresh log-session file and never clobber migrated artifacts.
(function () {
  const { projectDir, tmpRoot } = makeTempProject('migrate-seam');
  const d = sdir(projectDir);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, '_research_legacy.md'), 'legacy research\n');
  fs.writeFileSync(path.join(d, '2026-06-09T00-00-00.000Z-legacy-state.md'), 'legacy state\n');
  const res = runLogCapture(projectDir, 'post-migration capture', { now: '2026-06-20T15:36:00.000Z' });
  check('migrate-seam ok', res.ok === true);
  check('migrate-seam created fresh session file', res.created === true);
  check('migrate-seam new file exists', fs.existsSync(path.join(d, '2026-06-20-15-36.md')));
  check('migrate-seam did not touch legacy research', fs.readFileSync(path.join(d, '_research_legacy.md'), 'utf8') === 'legacy research\n');
  check('migrate-seam did not touch legacy state', fs.readFileSync(path.join(d, '2026-06-09T00-00-00.000Z-legacy-state.md'), 'utf8') === 'legacy state\n');
  cleanup(tmpRoot);
})();

// --- appendSessionEntry primitive directly (reusable by Task 5.1) -------
(function () {
  const { projectDir, tmpRoot } = makeTempProject('primitive');
  const r1 = appendSessionEntry(projectDir, 'via primitive', { now: '2026-06-20T15:36:00.000Z' });
  check('primitive returns ok', r1.ok === true);
  check('primitive returns absolute-ish file path', typeof r1.file === 'string' && r1.file.endsWith('2026-06-20-15-36.md'), r1.file);
  check('primitive created flag', r1.created === true);
  const r2 = appendSessionEntry(projectDir, 'second via primitive', { now: '2026-06-20T15:40:00.000Z' });
  check('primitive second append created=false', r2.created === false);
  const body = readSession(projectDir, '2026-06-20-15-36.md');
  check('primitive both entries present', body.includes('via primitive') && body.includes('second via primitive'));
  cleanup(tmpRoot);
})();

// --- atomicity: rapid sequential appends preserve every entry -----------
(function () {
  const { projectDir, tmpRoot } = makeTempProject('atomic');
  const N = 25;
  for (let i = 0; i < N; i += 1) {
    const mm = String(i).padStart(2, '0');
    runLogCapture(projectDir, `entry-${i}`, { now: `2026-06-20T15:${mm}:00.000Z` });
  }
  // All captures land in the first-created session file (15-00), appended in order.
  const files = listSessions(projectDir);
  check('atomic single session file', files.length === 1, files.join(','));
  const body = readSession(projectDir, files[0]);
  let allPresent = true;
  let ordered = true;
  let lastIdx = -1;
  for (let i = 0; i < N; i += 1) {
    const idx = body.indexOf(`entry-${i}`);
    if (idx === -1) allPresent = false;
    if (idx < lastIdx) ordered = false;
    lastIdx = idx;
  }
  check('atomic all entries present', allPresent);
  check('atomic entries in order', ordered);
  cleanup(tmpRoot);
})();

// --- summary --------------------------------------------------------------
if (failures.length) {
  console.log(`\n${failures.length} FAILURES:`);
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`\n${passed} checks passed, ${failures.length} failed.`);
  process.exit(1);
}
console.log(`${passed} checks passed.`);
