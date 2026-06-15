'use strict';

const fs = require('fs');
const path = require('path');

const fsHelpers = require('./fs');

const ARCHIVE_ROOT = '_legacy';

// Legacy files that get archived (and possibly derived from in 'full' mode).
const LEGACY_FILES = [
  'project.md',
  'state.md',
  'architecture.md',
  'constraints.md',
  'research.md',
  'changelog.md',
  'config.json',
  'file-index.json',
  'knowledge-index.json',
  'routes.jsonl'
];

// Legacy subdirectories that get archived as whole subtrees.
const LEGACY_DIRS = [
  'work'
];

// The legacy managed marker (.overdrive.json from lib/ovd-workflow.js) — archived in both modes.
const LEGACY_MARKER_FILE = '.overdrive.json';

// Files preserved in place across both modes (r3-aligned per §5A.1):
// decisions.md, preferences.md, reports/, handoffs/, knowledge/.
// In 'full' mode these may still be augmented (constraints → preferences vetoes,
// prose decisions → "Legacy notes" wrap), but they are never moved to _legacy/.

const V1_DECISIONS_PLACEHOLDER = '# Decisions\n\nRecord durable decisions here with dates and short rationale.\n';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function timestamp(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}-${pad2(date.getHours())}-${pad2(date.getMinutes())}`;
}

function nowIso() {
  return new Date().toISOString();
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function readIfExists(p) {
  try {
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  } catch (_e) {
    return null;
  }
}

function isAlreadyMigrated(rootDir) {
  const overdriveMd = fs.existsSync(path.join(rootDir, fsHelpers.OVD_PLAN_FILE));
  const codebaseDir = fs.existsSync(fsHelpers.ovdPath(rootDir, 'codebase'));
  const hasLegacy = fsHelpers.detectOldLayout(rootDir);
  return overdriveMd && codebaseDir && !hasLegacy;
}

function moveToArchive(srcAbs, archiveDirAbs, relPath) {
  const dest = path.join(archiveDirAbs, relPath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.renameSync(srcAbs, dest);
  return { from: srcAbs, to: dest };
}

function deriveProjectFromProjectMd(content) {
  if (typeof content !== 'string') return { title: 'Untitled project', description: '' };
  const lines = content.split(/\r?\n/);
  let title = null;
  const descLines = [];
  let pastTitle = false;
  for (const raw of lines) {
    const line = raw.replace(/\r$/, '');
    if (!pastTitle) {
      const m = line.match(/^#\s+(.+?)\s*$/);
      if (m) {
        title = m[1].trim();
        pastTitle = true;
      }
      continue;
    }
    if (line.trim().length === 0) {
      if (descLines.length > 0) break;
      continue;
    }
    if (/^#/.test(line)) break;
    descLines.push(line.trim());
  }
  return {
    title: title || 'Untitled project',
    description: descLines.join(' ').trim()
  };
}

function deriveStateFromStateMd(content) {
  if (typeof content !== 'string') {
    return { activeFocus: null, lastReason: null, initializedAt: null };
  }
  const lines = content.split(/\r?\n/);
  let activeFocus = null;
  let lastReason = null;
  let initializedAt = null;
  for (const raw of lines) {
    const line = raw.replace(/\r$/, '').trim();
    const focus = line.match(/^[-*]?\s*(?:Current focus|Active focus):\s*(.+)$/i);
    if (focus) {
      activeFocus = focus[1].trim();
      continue;
    }
    const reason = line.match(/^[-*]?\s*Last reason:\s*(.+)$/i);
    if (reason) {
      lastReason = reason[1].trim();
      continue;
    }
    const init = line.match(/^[-*]?\s*Initialized:\s*(.+)$/i);
    if (init) {
      initializedAt = init[1].trim();
    }
  }
  return { activeFocus, lastReason, initializedAt };
}

function buildOverdriveMd({ project, description, deliberationStatus }) {
  // r3 §9.3 frontmatter only. Per §5A.1, the legacy state.md "Current focus"
  // is preserved in the migrated session file, NOT in the OVERDRIVE.md
  // frontmatter -- the canonical `active_node:` field expects a hierarchical
  // ID (e.g., "II.2.a") which doesn't exist until /ovd-plan builds a tree.
  // Phase 3 sets `active_node:` properly once the tree exists.
  const fmLines = ['---', 'ovd-plan: true', 'version: 3'];
  fmLines.push(`project: ${JSON.stringify(project)}`);
  if (description) {
    fmLines.push(`description: ${JSON.stringify(description)}`);
  }
  fmLines.push(`created: ${todayDate()}`);
  fmLines.push(`updated: ${nowIso()}`);
  fmLines.push(`deliberation_status: ${deliberationStatus || 'pending'}`);
  fmLines.push('context_files:');
  fmLines.push('  codebase: .overdrive/codebase/');
  fmLines.push('  requirements: .overdrive/requirements.md');
  fmLines.push('  preferences: .overdrive/preferences.md');
  fmLines.push('  decisions: .overdrive/decisions.md');
  fmLines.push('---');
  return `${fmLines.join('\n')}\n\n# ${project}\n`;
}

function mergeConfig(legacy) {
  const base = (legacy && typeof legacy === 'object') ? legacy : {};
  return {
    ...base,
    version: 2,
    migratedAt: nowIso(),
    migratedFromVersion: base.version || 1
  };
}

function appendUnderHeader(content, header, body) {
  // Escape regex metacharacters in the header so headers containing characters
  // like (), [], or . match literally. Without this, e.g. a header with "(rejected)"
  // would not match its own emitted "## ... (rejected)" line on a second pass,
  // causing duplicate headers (surfaced by Task 3.5 IDEA multi-reject case).
  const headerEscaped = header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const headerPattern = new RegExp(`^##\\s+${headerEscaped}\\s*$`, 'i');
  const lines = content.split(/\r?\n/);
  const idx = lines.findIndex((line) => headerPattern.test(line));
  if (idx === -1) {
    const trimmed = content.replace(/\s+$/, '');
    return `${trimmed}\n\n## ${header}\n\n${body}\n`;
  }
  let endIdx = lines.length;
  for (let i = idx + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  const head = lines.slice(0, idx + 1).join('\n');
  const sectionBody = lines.slice(idx + 1, endIdx).join('\n').replace(/\s+$/, '');
  const tail = endIdx < lines.length ? lines.slice(endIdx).join('\n') : '';
  const newSection = sectionBody.length > 0
    ? `${head}\n${sectionBody}\n\n${body}\n`
    : `${head}\n\n${body}\n`;
  return tail.length > 0 ? `${newSection}\n${tail}` : newSection;
}

function wrapLegacyDecisions(legacyContent) {
  const trimmed = legacyContent.trim();
  if (
    trimmed === V1_DECISIONS_PLACEHOLDER.trim() ||
    trimmed === fsHelpers.NEW_LAYOUT_PLACEHOLDER_FILES['decisions.md'].trim()
  ) {
    return { wrapped: false, content: fsHelpers.NEW_LAYOUT_PLACEHOLDER_FILES['decisions.md'] };
  }
  const stripped = legacyContent.replace(/^#\s+Decisions\s*\n+/i, '').trim();
  const lines = [
    '# Decisions',
    '',
    '## Legacy notes (from pre-v2 .overdrive/decisions.md)',
    '',
    stripped,
    '',
    '## Structured log',
    '',
    '| Date | Node | Decision | Rationale |',
    '|---|---|---|---|',
    ''
  ];
  return { wrapped: true, content: lines.join('\n') };
}

function buildEmptyReport(mode, archiveDir, ts) {
  return {
    ok: true,
    status: 'migrate',
    mode,
    archiveDir,
    timestamp: ts,
    migrated: [],
    archived: [],
    conflicts: [],
    notes: [],
    summary: '',
    scaffolded: null
  };
}

function archiveLegacyFilesAndDirs(ovdDir, resolvedRoot, archiveDir, report) {
  for (const name of LEGACY_FILES) {
    const src = path.join(ovdDir, name);
    if (fs.existsSync(src)) {
      const moved = moveToArchive(src, archiveDir, name);
      report.archived.push({ from: name, to: path.relative(resolvedRoot, moved.to) });
    }
  }
  for (const dirName of LEGACY_DIRS) {
    const src = path.join(ovdDir, dirName);
    if (fs.existsSync(src)) {
      const moved = moveToArchive(src, archiveDir, dirName);
      report.archived.push({ from: `${dirName}/`, to: path.relative(resolvedRoot, moved.to) });
    }
  }
  const markerPath = path.join(ovdDir, LEGACY_MARKER_FILE);
  if (fs.existsSync(markerPath)) {
    const moved = moveToArchive(markerPath, archiveDir, LEGACY_MARKER_FILE);
    report.archived.push({ from: LEGACY_MARKER_FILE, to: path.relative(resolvedRoot, moved.to) });
  }
}

function derivePerFile(resolvedRoot, ovdDir, legacyContent, report) {
  const overdrivePath = path.join(resolvedRoot, fsHelpers.OVD_PLAN_FILE);
  let derivedProject = null;
  if (legacyContent['project.md']) {
    derivedProject = deriveProjectFromProjectMd(legacyContent['project.md']);
  }
  const derivedState = legacyContent['state.md']
    ? deriveStateFromStateMd(legacyContent['state.md'])
    : { activeFocus: null, lastReason: null, initializedAt: null };

  // OVERDRIVE.md
  if (derivedProject) {
    if (fs.existsSync(overdrivePath)) {
      report.conflicts.push({
        from: 'project.md + state.md',
        target: fsHelpers.OVD_PLAN_FILE,
        reason: 'OVERDRIVE.md already exists at root; not overwritten',
        archivedFrom: 'project.md'
      });
    } else {
      const md = buildOverdriveMd({
        project: derivedProject.title,
        description: derivedProject.description,
        deliberationStatus: 'pending'
      });
      fs.writeFileSync(overdrivePath, md);
      report.migrated.push({
        from: 'project.md + state.md',
        to: fsHelpers.OVD_PLAN_FILE,
        action: 'frontmatter-derived'
      });
    }
  }

  // state.md → sessions/<ts>-legacy-state.md
  if (legacyContent['state.md']) {
    const sessionPath = fsHelpers.ovdPath(resolvedRoot, 'sessions', `${report.timestamp}-legacy-state.md`);
    fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
    if (fs.existsSync(sessionPath)) {
      report.conflicts.push({
        from: 'state.md',
        target: path.relative(resolvedRoot, sessionPath),
        reason: 'session file already exists at timestamp',
        archivedFrom: 'state.md'
      });
    } else {
      const sessionContent = [
        '# Legacy state.md',
        '',
        `Migrated ${report.timestamp} from .overdrive/state.md (pre-v2 ovd-workflow).`,
        '',
        '---',
        '',
        legacyContent['state.md'].trim()
      ].join('\n') + '\n';
      fs.writeFileSync(sessionPath, sessionContent);
      report.migrated.push({
        from: 'state.md',
        to: path.relative(resolvedRoot, sessionPath),
        action: 'session-file'
      });
    }
  }

  // architecture.md → codebase/architecture.md
  if (legacyContent['architecture.md']) {
    const target = fsHelpers.ovdPath(resolvedRoot, 'codebase', 'architecture.md');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (fs.existsSync(target)) {
      report.conflicts.push({
        from: 'architecture.md',
        target: 'codebase/architecture.md',
        reason: 'target already exists; not overwritten',
        archivedFrom: 'architecture.md'
      });
    } else {
      const stripped = legacyContent['architecture.md'].replace(/^#\s+.*\n/, '').trim();
      const content = `# Architecture\n\n## Notes from previous workflow\n\n${stripped}\n`;
      fs.writeFileSync(target, content);
      report.migrated.push({
        from: 'architecture.md',
        to: 'codebase/architecture.md',
        action: 'header-prepended'
      });
    }
  }

  // constraints.md → preferences.md under "Vetoes" section
  if (legacyContent['constraints.md']) {
    const prefsPath = fsHelpers.ovdPath(resolvedRoot, 'preferences.md');
    fs.mkdirSync(path.dirname(prefsPath), { recursive: true });
    let prefsBody = readIfExists(prefsPath);
    if (prefsBody === null) {
      prefsBody = fsHelpers.NEW_LAYOUT_PLACEHOLDER_FILES['preferences.md'];
    }
    const constraintsBody = legacyContent['constraints.md'].replace(/^#\s+.*\n/, '').trim();
    const updated = appendUnderHeader(prefsBody, 'Vetoes', constraintsBody);
    fs.writeFileSync(prefsPath, updated);
    report.migrated.push({
      from: 'constraints.md',
      to: 'preferences.md',
      action: 'appended-under-vetoes'
    });
  }

  // decisions.md (Q3 — preserve in place; if user prose, wrap with Legacy notes + structured table)
  const decisionsPath = fsHelpers.ovdPath(resolvedRoot, 'decisions.md');
  const existingDecisions = readIfExists(decisionsPath);
  if (existingDecisions !== null) {
    const { wrapped, content } = wrapLegacyDecisions(existingDecisions);
    if (wrapped) {
      fs.writeFileSync(decisionsPath, content);
      report.migrated.push({
        from: 'decisions.md',
        to: 'decisions.md',
        action: 'legacy-notes-wrapped'
      });
    } else if (existingDecisions !== content) {
      fs.writeFileSync(decisionsPath, content);
      report.migrated.push({
        from: 'decisions.md',
        to: 'decisions.md',
        action: 'normalized-placeholder'
      });
    } else {
      report.migrated.push({
        from: 'decisions.md',
        to: 'decisions.md',
        action: 'preserved-in-place'
      });
    }
  }

  // research.md → sessions/_research_legacy.md
  if (legacyContent['research.md']) {
    const target = fsHelpers.ovdPath(resolvedRoot, 'sessions', '_research_legacy.md');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (fs.existsSync(target)) {
      report.conflicts.push({
        from: 'research.md',
        target: 'sessions/_research_legacy.md',
        reason: 'target already exists; not overwritten',
        archivedFrom: 'research.md'
      });
    } else {
      fs.writeFileSync(target, legacyContent['research.md']);
      report.migrated.push({
        from: 'research.md',
        to: 'sessions/_research_legacy.md',
        action: 'one-time-archive'
      });
    }
  }

  // changelog.md → reports/_changelog_legacy.md
  if (legacyContent['changelog.md']) {
    const target = fsHelpers.ovdPath(resolvedRoot, 'reports', '_changelog_legacy.md');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (fs.existsSync(target)) {
      report.conflicts.push({
        from: 'changelog.md',
        target: 'reports/_changelog_legacy.md',
        reason: 'target already exists; not overwritten',
        archivedFrom: 'changelog.md'
      });
    } else {
      fs.writeFileSync(target, legacyContent['changelog.md']);
      report.migrated.push({
        from: 'changelog.md',
        to: 'reports/_changelog_legacy.md',
        action: 'one-time-archive'
      });
    }
  }

  // config.json → merged v2 config
  if (legacyContent['config.json']) {
    const target = fsHelpers.ovdPath(resolvedRoot, 'config.json');
    let legacyConfig;
    try {
      legacyConfig = JSON.parse(legacyContent['config.json']);
    } catch (_e) {
      legacyConfig = { malformedLegacy: true };
      report.notes.push('Legacy config.json was malformed; preserved as { malformedLegacy: true } + v2 defaults.');
    }
    if (fs.existsSync(target)) {
      report.conflicts.push({
        from: 'config.json',
        target: 'config.json',
        reason: 'target already exists; not overwritten',
        archivedFrom: 'config.json'
      });
    } else {
      const merged = mergeConfig(legacyConfig);
      fs.writeFileSync(target, `${JSON.stringify(merged, null, 2)}\n`);
      report.migrated.push({
        from: 'config.json',
        to: 'config.json',
        action: 'merged-v2'
      });
    }
  }
}

function summarize(report) {
  const parts = [];
  parts.push(`${report.migrated.length} migrated`);
  parts.push(`${report.archived.length} archived`);
  if (report.conflicts.length > 0) parts.push(`${report.conflicts.length} conflict(s)`);
  parts.push(`mode=${report.mode}`);
  return parts.join(', ');
}

function runMigrateLegacy(rootDir, opts = {}) {
  if (!rootDir) {
    return {
      ok: false,
      status: 'migrate',
      reason: 'no rootDir resolved',
      summary: 'no rootDir resolved'
    };
  }

  const resolvedRoot = path.resolve(rootDir);
  const ovdDir = path.join(resolvedRoot, fsHelpers.OVD_DIR);

  if (!fs.existsSync(ovdDir)) {
    return {
      ok: true,
      status: 'migrate',
      mode: opts.mode || 'full',
      alreadyMigrated: false,
      nothingToMigrate: true,
      migrated: [],
      archived: [],
      conflicts: [],
      notes: ['.overdrive/ does not exist; nothing to migrate.'],
      summary: 'no .overdrive/ — nothing to migrate'
    };
  }

  if (isAlreadyMigrated(resolvedRoot)) {
    return {
      ok: true,
      status: 'migrate',
      mode: opts.mode || 'full',
      alreadyMigrated: true,
      migrated: [],
      archived: [],
      conflicts: [],
      notes: ['Project already migrated (OVERDRIVE.md + codebase/ present; no legacy markers).'],
      summary: 'already migrated'
    };
  }

  const mode = opts.mode === 'archive-only' ? 'archive-only' : 'full';
  const ts = opts.timestamp || timestamp();
  const archiveDir = path.join(ovdDir, ARCHIVE_ROOT, ts);
  fs.mkdirSync(archiveDir, { recursive: true });

  const report = buildEmptyReport(mode, archiveDir, ts);

  // Capture all legacy file contents in memory BEFORE archiving so derivation
  // can write to new paths even when an old path collides with a new one
  // (e.g., config.json archives the v1 file and writes the merged v2 to the
  // same path).
  const legacyContent = {};
  for (const name of LEGACY_FILES) {
    legacyContent[name] = readIfExists(path.join(ovdDir, name));
  }

  // Archive originals FIRST so subsequent derivation writes land in clean paths.
  archiveLegacyFilesAndDirs(ovdDir, resolvedRoot, archiveDir, report);

  if (mode === 'full') {
    derivePerFile(resolvedRoot, ovdDir, legacyContent, report);
  }

  const scaffoldResult = fsHelpers.scaffoldOverdrivePlan(resolvedRoot);
  report.scaffolded = {
    ran: scaffoldResult.scaffolded === true,
    created: scaffoldResult.created || [],
    existed: scaffoldResult.existed || [],
    reason: scaffoldResult.reason || null
  };

  report.summary = summarize(report);
  return report;
}

module.exports = {
  ARCHIVE_ROOT,
  LEGACY_FILES,
  LEGACY_DIRS,
  LEGACY_MARKER_FILE,
  V1_DECISIONS_PLACEHOLDER,
  timestamp,
  nowIso,
  todayDate,
  readIfExists,
  isAlreadyMigrated,
  moveToArchive,
  deriveProjectFromProjectMd,
  deriveStateFromStateMd,
  buildOverdriveMd,
  mergeConfig,
  appendUnderHeader,
  wrapLegacyDecisions,
  summarize,
  runMigrateLegacy
};
