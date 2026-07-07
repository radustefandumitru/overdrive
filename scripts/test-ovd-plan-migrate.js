#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  ARCHIVE_ROOT,
  LEGACY_FILES,
  LEGACY_DIRS,
  LEGACY_MARKER_FILE,
  V1_DECISIONS_PLACEHOLDER,
  timestamp,
  isAlreadyMigrated,
  deriveProjectFromProjectMd,
  deriveStateFromStateMd,
  buildOverdriveMd,
  mergeConfig,
  appendUnderHeader,
  wrapLegacyDecisions,
  summarize,
  runMigrateLegacy
} = require('../lib/ovd-plan/migrate');

const fsHelpers = require('../lib/ovd-plan/fs');
const { parseOverdriveMd } = require('../lib/ovd-plan/parser');

const FIXTURE_DIR = path.resolve(__dirname, 'fixtures/ovd-plan/legacy-project');
const FIXTURE_LEGACY_STATE_DIR = path.join(FIXTURE_DIR, 'legacy-overdrive-state');

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

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function makeLegacyTempProject(name) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-migrate-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  copyDir(FIXTURE_DIR, projectDir);
  fs.renameSync(path.join(projectDir, 'legacy-overdrive-state'), path.join(projectDir, '.overdrive'));
  return { projectDir, tmpRoot };
}

function makeFreshTempProject(name) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-migrate-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"fresh"}\n');
  return { projectDir, tmpRoot };
}

function cleanup(tmpRoot) {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

console.log('ovd-plan migrate tests');

// --- 0. Module surface ---
{
  check('LEGACY_FILES has the 10 expected names', LEGACY_FILES.length === 10);
  check('LEGACY_FILES includes project.md, state.md, config.json', ['project.md', 'state.md', 'config.json'].every((n) => LEGACY_FILES.includes(n)));
  check('LEGACY_FILES excludes preferences.md (r3-aligned, preserved)', !LEGACY_FILES.includes('preferences.md'));
  check('LEGACY_FILES excludes decisions.md (r3-aligned, preserved)', !LEGACY_FILES.includes('decisions.md'));
  check('LEGACY_DIRS includes work', LEGACY_DIRS.includes('work'));
  check('LEGACY_MARKER_FILE is .overdrive.json', LEGACY_MARKER_FILE === '.overdrive.json');
  check('ARCHIVE_ROOT is _legacy', ARCHIVE_ROOT === '_legacy');
  check('runMigrateLegacy is a function', typeof runMigrateLegacy === 'function');
}

// --- 1. timestamp shape ---
{
  const ts = timestamp(new Date(Date.UTC(2026, 5, 10, 11, 23, 45)));
  check('timestamp: YYYY-MM-DD-HH-MM format', /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/.test(ts), ts);
}

// --- 2. deriveProjectFromProjectMd ---
{
  const { title, description } = deriveProjectFromProjectMd('# Foo\n\nA project for testing.\nMore description.\n\n## Section\n');
  check('derive: title from H1', title === 'Foo');
  check('derive: description is first paragraph after H1', /A project for testing\. More description\./.test(description));

  const empty = deriveProjectFromProjectMd('');
  check('derive: empty input → Untitled project, blank description', empty.title === 'Untitled project' && empty.description === '');

  const noH1 = deriveProjectFromProjectMd('Just some prose with no header.\n');
  check('derive: missing H1 → fallback title', noH1.title === 'Untitled project');

  const onlyH1 = deriveProjectFromProjectMd('# Bar\n\n## Sub\n');
  check('derive: H1 then immediately ## → empty description', onlyH1.title === 'Bar' && onlyH1.description === '');
}

// --- 3. deriveStateFromStateMd ---
{
  const state1 = deriveStateFromStateMd('# State\n\n- Initialized: 2026-05-01T10:30:00Z\n- Last reason: paused\n- Current focus: Navigation\n');
  check('state: activeFocus parsed', state1.activeFocus === 'Navigation');
  check('state: lastReason parsed', state1.lastReason === 'paused');
  check('state: initializedAt parsed', state1.initializedAt === '2026-05-01T10:30:00Z');

  const state2 = deriveStateFromStateMd('# State\n\nNothing structured here.\n');
  check('state: unstructured → all null', state2.activeFocus === null && state2.lastReason === null);

  const state3 = deriveStateFromStateMd('Active focus: widget\n');
  check('state: "Active focus" alias also works', state3.activeFocus === 'widget');
}

// --- 4. mergeConfig ---
{
  const merged = mergeConfig({ version: 1, customKey: 'preserved', git_mode: 'none' });
  check('mergeConfig: version bumped to 2', merged.version === 2);
  check('mergeConfig: legacy keys preserved', merged.customKey === 'preserved' && merged.git_mode === 'none');
  check('mergeConfig: migratedAt set', typeof merged.migratedAt === 'string' && merged.migratedAt.length > 0);
  check('mergeConfig: migratedFromVersion preserved', merged.migratedFromVersion === 1);

  const noLegacy = mergeConfig(null);
  check('mergeConfig: null legacy → still version 2', noLegacy.version === 2);
  check('mergeConfig: null legacy → migratedFromVersion=1 default', noLegacy.migratedFromVersion === 1);
}

// --- 5. appendUnderHeader ---
{
  const existing = '# Prefs\n\n## Vetoes\n\n- old veto\n\n## Coding style\n\n- 4 spaces\n';
  const updated = appendUnderHeader(existing, 'Vetoes', '- new veto from constraints');
  check('appendUnderHeader: new content appears under Vetoes', /## Vetoes[\s\S]*new veto from constraints/.test(updated));
  check('appendUnderHeader: Coding style section preserved', /## Coding style[\s\S]*4 spaces/.test(updated));
  check('appendUnderHeader: original Vetoes content preserved', /old veto/.test(updated));

  const missing = '# Prefs\n\nNo Vetoes section.\n';
  const added = appendUnderHeader(missing, 'Vetoes', '- first veto');
  check('appendUnderHeader: missing header → appended at end', /## Vetoes[\s\S]*first veto/.test(added));

  const emptyVetoes = '# Prefs\n\n## Vetoes\n\n## Other\n';
  const filledEmpty = appendUnderHeader(emptyVetoes, 'Vetoes', '- veto');
  check('appendUnderHeader: empty section gets body inserted before next ##', /## Vetoes[\s\S]*veto[\s\S]*## Other/.test(filledEmpty));
}

// --- 6. wrapLegacyDecisions ---
{
  const prose = '# Decisions\n\nWe decided X on 2026-05-01.\nWe decided Y on 2026-05-04.\n';
  const wrappedResult = wrapLegacyDecisions(prose);
  check('wrap: wrapped=true for prose', wrappedResult.wrapped === true);
  check('wrap: content includes "Legacy notes" header', /## Legacy notes/.test(wrappedResult.content));
  check('wrap: content includes structured table header', /\| Date \| Node \| Decision \| Rationale \|/.test(wrappedResult.content));
  check('wrap: original prose preserved inside Legacy notes', /We decided X on 2026-05-01/.test(wrappedResult.content));

  const v1Placeholder = wrapLegacyDecisions(V1_DECISIONS_PLACEHOLDER);
  check('wrap: v1 placeholder → wrapped=false (replace with v2 placeholder)', v1Placeholder.wrapped === false);

  const v2Placeholder = wrapLegacyDecisions(fsHelpers.NEW_LAYOUT_PLACEHOLDER_FILES['decisions.md']);
  check('wrap: v2 placeholder → wrapped=false (no-op)', v2Placeholder.wrapped === false);
}

// --- 7. buildOverdriveMd: minimal valid + round-trip through parser ---
{
  const md = buildOverdriveMd({
    project: 'Test Project',
    description: 'A test description.',
    activeFocus: 'navigation',
    deliberationStatus: 'pending'
  });
  check('buildOverdriveMd: starts with frontmatter delimiter', md.startsWith('---\n'));
  check('buildOverdriveMd: contains project title H1', md.includes('# Test Project'));
  check('buildOverdriveMd: includes ovd-plan: true', md.includes('ovd-plan: true'));
  check('buildOverdriveMd: includes version: 3', md.includes('version: 3'));
  check('buildOverdriveMd: includes context_files block', md.includes('context_files:'));

  // Round-trip through parser
  let parsed;
  let threw = false;
  try {
    parsed = parseOverdriveMd(md);
  } catch (e) {
    threw = true;
  }
  check('buildOverdriveMd: parser accepts without throwing', !threw);
  if (parsed) {
    check('buildOverdriveMd: parser extracts project from frontmatter', parsed.frontmatter && parsed.frontmatter.project === 'Test Project');
    const findTitle = (node, target) => {
      if (!node) return false;
      if (node.title === target) return true;
      if (Array.isArray(node.children)) return node.children.some((child) => findTitle(child, target));
      return false;
    };
    check('buildOverdriveMd: parser finds H1 title in tree', findTitle(parsed.tree, 'Test Project'));
  }
}

// --- 8. isAlreadyMigrated ---
{
  const { projectDir, tmpRoot } = makeFreshTempProject('already');
  try {
    check('isAlreadyMigrated: false on fresh project', isAlreadyMigrated(projectDir) === false);

    fsHelpers.scaffoldOverdrivePlan(projectDir);
    fs.writeFileSync(path.join(projectDir, fsHelpers.OVD_PLAN_FILE), '---\novd-plan: true\nversion: 3\nproject: "X"\n---\n\n# X\n');
    check('isAlreadyMigrated: true when OVERDRIVE.md + codebase/ present and no legacy', isAlreadyMigrated(projectDir) === true);
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 9. Scenario A: full migration on the fixture (the big end-to-end test) ---
{
  const { projectDir, tmpRoot } = makeLegacyTempProject('full');
  try {
    const result = runMigrateLegacy(projectDir, { mode: 'full' });
    check('full: ok=true', result.ok === true);
    check('full: mode=full', result.mode === 'full');
    check('full: alreadyMigrated NOT true', result.alreadyMigrated !== true);
    check('full: nothingToMigrate NOT true', result.nothingToMigrate !== true);
    check('full: migrated.length >= 7 (project, state, architecture, constraints, decisions, research, changelog, config)', result.migrated.length >= 7);
    check('full: archived.length >= 5 (file-index, knowledge-index, routes, work/, marker + the per-file originals)', result.archived.length >= 5);
    check('full: conflicts empty', result.conflicts.length === 0);
    check('full: scaffolded reported', result.scaffolded !== null);

    // OVERDRIVE.md at root with frontmatter derived from project.md
    const overdriveMd = path.join(projectDir, 'OVERDRIVE.md');
    check('full: OVERDRIVE.md created at root', fs.existsSync(overdriveMd));
    const overdriveContent = fs.readFileSync(overdriveMd, 'utf8');
    check('full: OVERDRIVE.md has project from H1', /project: "Foo Legacy Dashboard"/.test(overdriveContent));
    check('full: OVERDRIVE.md has H1 project title', /^# Foo Legacy Dashboard$/m.test(overdriveContent));
    // Per §5A.1: free-text active focus lives in the session file (no
    // active_node yet because no tree exists for the fuzzy-match path).
    check('full: OVERDRIVE.md does NOT carry transitional active_focus frontmatter field', !/active_focus:/.test(overdriveContent));
    check('full: OVERDRIVE.md does NOT carry an active_node yet (no tree)', !/active_node:/.test(overdriveContent));

    // OVERDRIVE.md round-trips through parser
    let parsedRoundtrip = true;
    try {
      parseOverdriveMd(overdriveContent);
    } catch (_e) {
      parsedRoundtrip = false;
    }
    check('full: generated OVERDRIVE.md parses without error', parsedRoundtrip);

    // sessions/<ts>-legacy-state.md
    const sessionsDir = fsHelpers.ovdPath(projectDir, 'sessions');
    const sessionFiles = fs.readdirSync(sessionsDir);
    check('full: sessions/ contains a legacy-state.md', sessionFiles.some((n) => /legacy-state\.md$/.test(n)));
    const legacyStateFile = sessionFiles.find((n) => /legacy-state\.md$/.test(n));
    if (legacyStateFile) {
      const legacyStateContent = fs.readFileSync(path.join(sessionsDir, legacyStateFile), 'utf8');
      check('full: legacy-state session file preserves original "Current focus" line', /Current focus:\s*Navigation polish/.test(legacyStateContent));
      check('full: legacy-state session file has migration header', /Migrated.*from \.overdrive\/state\.md/.test(legacyStateContent));
    }

    // codebase/architecture.md with prepended header
    const archPath = fsHelpers.ovdPath(projectDir, 'codebase', 'architecture.md');
    check('full: codebase/architecture.md created', fs.existsSync(archPath));
    const archContent = fs.readFileSync(archPath, 'utf8');
    check('full: architecture.md has Notes from previous workflow header', /## Notes from previous workflow/.test(archContent));
    check('full: architecture.md preserves React SPA content', /React SPA backed by a Node API/.test(archContent));

    // preferences.md gained constraints under Vetoes
    const prefsPath = fsHelpers.ovdPath(projectDir, 'preferences.md');
    const prefsContent = fs.readFileSync(prefsPath, 'utf8');
    check('full: preferences.md preserves original prefs', /no walls of text/.test(prefsContent));
    check('full: preferences.md has Vetoes section', /## Vetoes/i.test(prefsContent));
    check('full: preferences.md gained constraints (No jQuery)', /No jQuery/.test(prefsContent));
    check('full: preferences.md gained constraints (No CommonJS)', /No CommonJS/.test(prefsContent));

    // decisions.md wrapped with Legacy notes
    const decPath = fsHelpers.ovdPath(projectDir, 'decisions.md');
    const decContent = fs.readFileSync(decPath, 'utf8');
    check('full: decisions.md has Legacy notes header', /## Legacy notes/.test(decContent));
    check('full: decisions.md preserves Postgres rationale', /Postgres rather than DynamoDB/.test(decContent));
    check('full: decisions.md has structured log header + table', /## Structured log[\s\S]*\| Date \| Node \| Decision \| Rationale \|/.test(decContent));

    // sessions/_research_legacy.md
    const resPath = fsHelpers.ovdPath(projectDir, 'sessions', '_research_legacy.md');
    check('full: sessions/_research_legacy.md exists', fs.existsSync(resPath));
    check('full: _research_legacy preserves REST vs GraphQL row', /REST vs GraphQL/.test(fs.readFileSync(resPath, 'utf8')));

    // reports/_changelog_legacy.md
    const clogPath = fsHelpers.ovdPath(projectDir, 'reports', '_changelog_legacy.md');
    check('full: reports/_changelog_legacy.md exists', fs.existsSync(clogPath));
    check('full: _changelog_legacy preserves Resynced file index entry', /Resynced file index/.test(fs.readFileSync(clogPath, 'utf8')));

    // config.json merged
    const cfgPath = fsHelpers.ovdPath(projectDir, 'config.json');
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    check('full: config.json version bumped to 2', cfg.version === 2);
    check('full: config.json preserves legacy keys (git_mode)', cfg.git_mode === 'none');
    check('full: config.json carries migratedFromVersion=1', cfg.migratedFromVersion === 1);

    // Archive directory populated
    const archiveDir = path.join(projectDir, '.overdrive', '_legacy', result.timestamp);
    check('full: archive directory exists', fs.existsSync(archiveDir));
    for (const name of ['project.md', 'state.md', 'architecture.md', 'constraints.md', 'research.md', 'changelog.md', 'config.json', 'file-index.json', 'knowledge-index.json', 'routes.jsonl']) {
      check(`full: archive contains ${name}`, fs.existsSync(path.join(archiveDir, name)));
    }
    check('full: archive contains work/ subtree', fs.existsSync(path.join(archiveDir, 'work', '_active.json')));
    check('full: archive contains work/scratchpad.md (whole subtree)', fs.existsSync(path.join(archiveDir, 'work', 'scratchpad.md')));
    check('full: archive contains .overdrive.json marker', fs.existsSync(path.join(archiveDir, '.overdrive.json')));

    // Original legacy files MOVED (not copied) — should be absent from .overdrive/ root
    const ovd = path.join(projectDir, '.overdrive');
    check('full: original project.md moved (absent from .overdrive/)', !fs.existsSync(path.join(ovd, 'project.md')));
    check('full: original state.md moved', !fs.existsSync(path.join(ovd, 'state.md')));
    check('full: original architecture.md moved', !fs.existsSync(path.join(ovd, 'architecture.md')));
    check('full: original config.json moved (replaced by merged v2)', JSON.parse(readIfExists(path.join(ovd, 'config.json'))).version === 2);

    // r3-aligned files preserved in place: reports/, handoffs/, knowledge/
    check('full: reports/2026-05-04-v1-dashboard.md preserved in place', fs.existsSync(path.join(ovd, 'reports', '2026-05-04-v1-dashboard.md')));
    check('full: handoffs/2026-05-12-pre-reposition.md preserved in place', fs.existsSync(path.join(ovd, 'handoffs', '2026-05-12-pre-reposition.md')));
    check('full: knowledge/onboarding.md preserved in place', fs.existsSync(path.join(ovd, 'knowledge', 'onboarding.md')));

    // After migration, no longer detected as legacy
    check('full: detectOldLayout returns false post-migration', fsHelpers.detectOldLayout(projectDir) === false);
    check('full: isAlreadyMigrated returns true post-migration', isAlreadyMigrated(projectDir) === true);
  } finally {
    cleanup(tmpRoot);
  }
}

function readIfExists(p) {
  try { return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; } catch (_e) { return null; }
}

// --- 10. Scenario B: archive-only mode on the fixture ---
{
  const { projectDir, tmpRoot } = makeLegacyTempProject('archive-only');
  try {
    const result = runMigrateLegacy(projectDir, { mode: 'archive-only' });
    check('archive-only: ok=true', result.ok === true);
    check('archive-only: mode=archive-only', result.mode === 'archive-only');
    check('archive-only: migrated empty (no derivation)', result.migrated.length === 0);
    check('archive-only: archived non-empty', result.archived.length > 0);

    // OVERDRIVE.md was NOT created
    check('archive-only: OVERDRIVE.md NOT created at root', !fs.existsSync(path.join(projectDir, 'OVERDRIVE.md')));

    // codebase/architecture.md NOT created (no derivation)
    check('archive-only: codebase/architecture.md NOT created', !fs.existsSync(fsHelpers.ovdPath(projectDir, 'codebase', 'architecture.md')));

    // decisions.md preserved verbatim (not wrapped)
    const dec = fs.readFileSync(fsHelpers.ovdPath(projectDir, 'decisions.md'), 'utf8');
    check('archive-only: decisions.md NOT wrapped (verbatim from fixture)', !/## Legacy notes/.test(dec));
    check('archive-only: decisions.md still has Postgres prose verbatim', /Postgres rather than DynamoDB/.test(dec));

    // preferences.md preserved verbatim (no Vetoes section added)
    const prefs = fs.readFileSync(fsHelpers.ovdPath(projectDir, 'preferences.md'), 'utf8');
    check('archive-only: preferences.md verbatim (no jQuery veto added)', !/No jQuery/.test(prefs));

    // Archive contains the legacy files
    const archiveDir = path.join(projectDir, '.overdrive', '_legacy', result.timestamp);
    check('archive-only: archive has project.md', fs.existsSync(path.join(archiveDir, 'project.md')));
    check('archive-only: archive has work/ subtree', fs.existsSync(path.join(archiveDir, 'work', '_active.json')));

    // Scaffold ran (codebase/, sessions/, sketches/, sketches/approved/, requirements.md placeholder, etc.)
    check('archive-only: codebase/ dir scaffolded', fs.existsSync(fsHelpers.ovdPath(projectDir, 'codebase')));
    check('archive-only: sessions/ dir scaffolded', fs.existsSync(fsHelpers.ovdPath(projectDir, 'sessions')));
    check('archive-only: requirements.md scaffolded as placeholder', fs.existsSync(fsHelpers.ovdPath(projectDir, 'requirements.md')));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 11. Idempotency: re-running migrate on a migrated project ---
{
  const { projectDir, tmpRoot } = makeLegacyTempProject('idempotent');
  try {
    runMigrateLegacy(projectDir, { mode: 'full' });
    const second = runMigrateLegacy(projectDir, { mode: 'full' });
    check('idempotent: second call ok=true', second.ok === true);
    check('idempotent: alreadyMigrated=true', second.alreadyMigrated === true);
    check('idempotent: migrated empty on second call', second.migrated.length === 0);
    check('idempotent: archived empty on second call', second.archived.length === 0);
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 12. Conflict: OVERDRIVE.md already exists ---
{
  const { projectDir, tmpRoot } = makeLegacyTempProject('conflict');
  try {
    // Pre-create OVERDRIVE.md so migration finds a conflict
    fs.writeFileSync(path.join(projectDir, 'OVERDRIVE.md'), '---\novd-plan: true\nversion: 3\nproject: "Pre-existing"\n---\n\n# Pre-existing\n');
    const result = runMigrateLegacy(projectDir, { mode: 'full' });
    check('conflict: ok=true (migration completes even with conflicts)', result.ok === true);
    check('conflict: at least one conflict reported', result.conflicts.length > 0);
    check('conflict: conflict mentions OVERDRIVE.md target', result.conflicts.some((c) => c.target === 'OVERDRIVE.md'));
    check('conflict: original OVERDRIVE.md preserved (not overwritten)', /project: "Pre-existing"/.test(fs.readFileSync(path.join(projectDir, 'OVERDRIVE.md'), 'utf8')));
    // The legacy project.md should still be archived
    const archiveDir = path.join(projectDir, '.overdrive', '_legacy', result.timestamp);
    check('conflict: legacy project.md still archived', fs.existsSync(path.join(archiveDir, 'project.md')));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 13. Empty .overdrive/ (no legacy markers, no new layout) ---
{
  const { projectDir, tmpRoot } = makeFreshTempProject('empty-ovd');
  try {
    fs.mkdirSync(path.join(projectDir, '.overdrive'));
    const result = runMigrateLegacy(projectDir, { mode: 'full' });
    check('empty-ovd: ok=true', result.ok === true);
    check('empty-ovd: migrated empty', result.migrated.length === 0);
    check('empty-ovd: archived empty', result.archived.length === 0);
    // Should still scaffold the new layout
    check('empty-ovd: scaffold created codebase/', fs.existsSync(fsHelpers.ovdPath(projectDir, 'codebase')));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 14. No .overdrive/ at all → nothingToMigrate ---
{
  const { projectDir, tmpRoot } = makeFreshTempProject('no-ovd');
  try {
    const result = runMigrateLegacy(projectDir, { mode: 'full' });
    check('no-ovd: ok=true', result.ok === true);
    check('no-ovd: nothingToMigrate=true', result.nothingToMigrate === true);
    check('no-ovd: no codebase/ created (nothing to do)', !fs.existsSync(fsHelpers.ovdPath(projectDir, 'codebase')));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 15. Malformed legacy config.json ---
{
  const { projectDir, tmpRoot } = makeLegacyTempProject('malformed-cfg');
  try {
    // Corrupt the config.json
    fs.writeFileSync(path.join(projectDir, '.overdrive', 'config.json'), '{ this is not valid json');
    const result = runMigrateLegacy(projectDir, { mode: 'full' });
    check('malformed-cfg: ok=true (does not throw)', result.ok === true);
    check('malformed-cfg: notes mention malformed config', result.notes.some((n) => /malformed/i.test(n)));
    const cfg = JSON.parse(fs.readFileSync(fsHelpers.ovdPath(projectDir, 'config.json'), 'utf8'));
    check('malformed-cfg: config.json marked with malformedLegacy', cfg.malformedLegacy === true);
    check('malformed-cfg: config.json still bumped to v2', cfg.version === 2);
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 16. null/empty rootDir ---
{
  const r = runMigrateLegacy(null, { mode: 'full' });
  check('null rootDir: ok=false', r.ok === false);
  check('null rootDir: reason mentions rootDir', /rootDir/i.test(r.reason));
}

// --- 17. summarize ---
{
  const s = summarize({
    mode: 'full',
    migrated: [1, 2, 3],
    archived: [1, 2],
    conflicts: []
  });
  check('summarize: includes mode', /mode=full/.test(s));
  check('summarize: includes migrated count', /3 migrated/.test(s));
  check('summarize: includes archived count', /2 archived/.test(s));
  check('summarize: omits conflict count when zero', !/conflict/.test(s));

  const s2 = summarize({ mode: 'archive-only', migrated: [], archived: [1], conflicts: [1, 2] });
  check('summarize: includes conflict count when non-zero', /2 conflict/.test(s2));
}

// --- 18. Fixture is committed and readable (sanity check) ---
{
  check('fixture: legacy-project dir exists', fs.existsSync(FIXTURE_DIR));
  check('fixture: has package.json (project signal)', fs.existsSync(path.join(FIXTURE_DIR, 'package.json')));
  check('fixture: has legacy-overdrive-state/project.md', fs.existsSync(path.join(FIXTURE_LEGACY_STATE_DIR, 'project.md')));
  check('fixture: has legacy-overdrive-state/state.md', fs.existsSync(path.join(FIXTURE_LEGACY_STATE_DIR, 'state.md')));
  check('fixture: has legacy-overdrive-state/.overdrive.json marker', fs.existsSync(path.join(FIXTURE_LEGACY_STATE_DIR, '.overdrive.json')));
  check('fixture: has legacy-overdrive-state/work/_active.json', fs.existsSync(path.join(FIXTURE_LEGACY_STATE_DIR, 'work', '_active.json')));
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
