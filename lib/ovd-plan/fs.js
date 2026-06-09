'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const OVD_DIR = '.overdrive';
const OVD_PLAN_FILE = 'OVERDRIVE.md';

const GITIGNORE_BLOCK_START = '# overdrive:gitignore:start';
const GITIGNORE_BLOCK_END = '# overdrive:gitignore:end';

const NEW_LAYOUT_DIRS = [
  'codebase',
  'handoffs',
  'sessions',
  'sketches',
  'sketches/approved',
  'reports'
];

const NEW_LAYOUT_PLACEHOLDER_FILES = {
  'requirements.md':
    '# Requirements\n\n' +
    'Functional, non-functional, and out-of-scope requirements for this project. ' +
    'Populated by `/ovd-workflow requirements` during init or on demand.\n\n' +
    '## Functional\n\n## Non-functional\n\n## Out of scope\n',
  'preferences.md':
    '# Preferences\n\n' +
    'User preferences, vetoes, and team conventions. ' +
    'Populated by `/ovd-workflow preferences` during init or on demand.\n\n' +
    '## Vetoes\n\n## Coding style\n\n## Workflow\n\n## Communication\n',
  'decisions.md':
    '# Decisions\n\n' +
    'Append-only log of decisions made during planning and execution.\n\n' +
    '| Date | Node | Decision | Rationale |\n|---|---|---|---|\n'
};

const OLD_LAYOUT_MARKERS = [
  'project.md',
  'state.md',
  'constraints.md',
  'research.md',
  'changelog.md',
  'config.json',
  'file-index.json',
  'knowledge-index.json',
  'routes.jsonl',
  'work/_active.json'
];

const NEW_LAYOUT_MARKERS = [
  'codebase',
  'sessions',
  'requirements.md'
];

const PROJECT_SIGNALS = [
  '.overdrive',
  '.git',
  'package.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
  'pyproject.toml',
  'Cargo.toml',
  'go.mod',
  'composer.json',
  'Gemfile',
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md'
];

const GITIGNORE_CARVE_OUT_BODY = [
  '# ovd-plan: .overdrive/ ignored by default; specific paths carved out for commit',
  '.overdrive/',
  '!.overdrive/codebase/',
  '!.overdrive/codebase/**',
  '!.overdrive/requirements.md',
  '!.overdrive/preferences.md',
  '!.overdrive/decisions.md',
  '!.overdrive/handoffs/',
  '!.overdrive/handoffs/**',
  '!.overdrive/reports/',
  '!.overdrive/reports/**',
  '!.overdrive/sketches/approved/',
  '!.overdrive/sketches/approved/**'
].join('\n');

const GITIGNORE_CARVE_OUT_BLOCK = [
  GITIGNORE_BLOCK_START,
  GITIGNORE_CARVE_OUT_BODY,
  GITIGNORE_BLOCK_END
].join('\n');

function hasProjectSignal(dir) {
  return PROJECT_SIGNALS.some((signal) => fs.existsSync(path.join(dir, signal)));
}

function isSafeProjectDir(projectDir) {
  const resolved = path.resolve(projectDir);
  const home = path.resolve(os.homedir());
  if (resolved === '/' || resolved === home || resolved === path.dirname(home)) {
    return false;
  }
  return hasProjectSignal(resolved);
}

function ovdPath(projectDir, ...segments) {
  return path.join(projectDir, OVD_DIR, ...segments);
}

function newLayoutPresent(projectDir) {
  if (fs.existsSync(path.join(projectDir, OVD_PLAN_FILE))) return true;
  return NEW_LAYOUT_MARKERS.some((marker) => fs.existsSync(ovdPath(projectDir, marker)));
}

function oldLayoutMarkerCount(projectDir) {
  return OLD_LAYOUT_MARKERS.reduce((count, marker) => {
    return fs.existsSync(ovdPath(projectDir, marker)) ? count + 1 : count;
  }, 0);
}

function detectOldLayout(projectDir) {
  if (!fs.existsSync(path.join(projectDir, OVD_DIR))) return false;
  if (newLayoutPresent(projectDir)) return false;
  return oldLayoutMarkerCount(projectDir) > 0;
}

function scaffoldOverdrivePlan(projectDir, options = {}) {
  const opts = { dryRun: false, force: false, ...options };

  if (!isSafeProjectDir(projectDir) && !opts.force) {
    return {
      scaffolded: false,
      reason: 'no project signal',
      projectDir
    };
  }

  if (detectOldLayout(projectDir)) {
    return {
      scaffolded: false,
      reason: 'old layout detected',
      needsMigration: true,
      oldMarkerCount: oldLayoutMarkerCount(projectDir),
      projectDir
    };
  }

  const created = [];
  const existed = [];

  const root = path.join(projectDir, OVD_DIR);
  if (fs.existsSync(root)) {
    existed.push(OVD_DIR);
  } else {
    created.push(OVD_DIR);
    if (!opts.dryRun) fs.mkdirSync(root, { recursive: true });
  }

  for (const dir of NEW_LAYOUT_DIRS) {
    const full = ovdPath(projectDir, dir);
    const rel = path.join(OVD_DIR, dir);
    if (fs.existsSync(full)) {
      existed.push(rel);
    } else {
      created.push(rel);
      if (!opts.dryRun) fs.mkdirSync(full, { recursive: true });
    }
  }

  for (const [name, content] of Object.entries(NEW_LAYOUT_PLACEHOLDER_FILES)) {
    const full = ovdPath(projectDir, name);
    const rel = path.join(OVD_DIR, name);
    if (fs.existsSync(full)) {
      existed.push(rel);
    } else {
      created.push(rel);
      if (!opts.dryRun) fs.writeFileSync(full, content);
    }
  }

  return {
    scaffolded: true,
    created,
    existed,
    projectDir
  };
}

function isStandaloneOverdriveIgnore(line) {
  const trimmed = line.trim();
  return trimmed === '.overdrive/' || trimmed === '.overdrive';
}

function writeGitignoreCarveOut(projectDir, options = {}) {
  const opts = { dryRun: false, ...options };
  const gitignorePath = path.join(projectDir, '.gitignore');

  let currentContent = '';
  if (fs.existsSync(gitignorePath)) {
    currentContent = fs.readFileSync(gitignorePath, 'utf8');
  }

  const blockStartIdx = currentContent.indexOf(GITIGNORE_BLOCK_START);
  const blockEndIdx = currentContent.indexOf(GITIGNORE_BLOCK_END);
  const hasManagedBlock = blockStartIdx !== -1 && blockEndIdx !== -1 && blockEndIdx > blockStartIdx;

  if (hasManagedBlock) {
    const existingBlock = currentContent.substring(
      blockStartIdx,
      blockEndIdx + GITIGNORE_BLOCK_END.length
    );
    if (existingBlock === GITIGNORE_CARVE_OUT_BLOCK) {
      return { changed: false, action: 'already-current', path: gitignorePath };
    }
    const newContent =
      currentContent.substring(0, blockStartIdx) +
      GITIGNORE_CARVE_OUT_BLOCK +
      currentContent.substring(blockEndIdx + GITIGNORE_BLOCK_END.length);
    if (!opts.dryRun) fs.writeFileSync(gitignorePath, newContent);
    return { changed: true, action: 'updated-managed-block', path: gitignorePath };
  }

  const lines = currentContent.split(/\r?\n/);
  const hadWholesale = lines.some(isStandaloneOverdriveIgnore);
  const filtered = lines.filter((line) => !isStandaloneOverdriveIgnore(line));
  let body = filtered.join('\n');
  body = body.replace(/\n{3,}$/g, '\n\n').replace(/\n+$/g, '');
  const separator = body.length > 0 ? '\n\n' : '';
  const newContent = body + separator + GITIGNORE_CARVE_OUT_BLOCK + '\n';

  if (!opts.dryRun) fs.writeFileSync(gitignorePath, newContent);

  return {
    changed: true,
    action: hadWholesale ? 'migrated-wholesale-ignore' : 'appended-new-block',
    path: gitignorePath
  };
}

module.exports = {
  OVD_DIR,
  OVD_PLAN_FILE,
  NEW_LAYOUT_DIRS,
  NEW_LAYOUT_PLACEHOLDER_FILES,
  OLD_LAYOUT_MARKERS,
  NEW_LAYOUT_MARKERS,
  PROJECT_SIGNALS,
  GITIGNORE_BLOCK_START,
  GITIGNORE_BLOCK_END,
  GITIGNORE_CARVE_OUT_BLOCK,
  hasProjectSignal,
  isSafeProjectDir,
  ovdPath,
  newLayoutPresent,
  oldLayoutMarkerCount,
  detectOldLayout,
  scaffoldOverdrivePlan,
  writeGitignoreCarveOut
};
