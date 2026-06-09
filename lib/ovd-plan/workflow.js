'use strict';

const fs = require('fs');
const path = require('path');

const fsHelpers = require('./fs');

const TUTORIAL_LINES = [
  'Overdrive (ovd-plan) adds a structural planning + execution pipeline on top of your skills.',
  'Four commands cover the loop:',
  '  /ovd-workflow — set up and maintain project context (codebase maps, preferences, requirements, decisions).',
  '  /ovd-plan     — deliberate, research, and shape the OVERDRIVE.md tree of work.',
  '  /ovd-go       — orient and execute leaves, iterate with you, and close clusters when complete.',
  '  /ovd-log      — lightweight save (default) or full handoff with recursive closure checks.',
  'Files live at OVERDRIVE.md (the plan, committed) and .overdrive/ (context: codebase/, preferences, requirements, decisions, sessions/, sketches/, handoffs/, reports/).',
  'Closure is recursive: every level asks before advancing — nothing implicit.',
  'Every consequential action presents numbered action paths and waits for you.',
  'See docs/ovd-plan-v2.md for the public overview, or the r3 spec for the design contract.'
];

const CODEBASE_FILES = [
  'architecture.md',
  'patterns.md',
  'tech-stack.md',
  'quality.md',
  'concerns.md'
];

const STATES = ['uninitialized', 'legacy', 'scaffolded', 'partial', 'initialized'];

function readIfExists(filePath) {
  try {
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  } catch (_e) {
    return null;
  }
}

function matchesPlaceholder(actual, placeholder) {
  if (actual === null || placeholder === undefined) return false;
  return actual === placeholder || actual.trim() === placeholder.trim();
}

function classifyFile(filePath, placeholder) {
  const content = readIfExists(filePath);
  if (content === null) return 'missing';
  if (placeholder !== undefined && matchesPlaceholder(content, placeholder)) return 'placeholder';
  return 'populated';
}

function inspectCodebase(rootDir) {
  const codebaseDir = fsHelpers.ovdPath(rootDir, 'codebase');
  const present = {};
  for (const name of CODEBASE_FILES) {
    present[name] = fs.existsSync(path.join(codebaseDir, name));
  }
  const count = Object.values(present).filter(Boolean).length;
  return { present, count };
}

function inspectProject(rootDir) {
  const ovdDir = path.join(rootDir, fsHelpers.OVD_DIR);
  const ovdExists = fs.existsSync(ovdDir);
  const overdriveMd = fs.existsSync(path.join(rootDir, fsHelpers.OVD_PLAN_FILE));
  const legacy = ovdExists && fsHelpers.detectOldLayout(rootDir);
  const newLayout = ovdExists && fsHelpers.newLayoutPresent(rootDir);

  const codebase = inspectCodebase(rootDir);
  const placeholders = fsHelpers.NEW_LAYOUT_PLACEHOLDER_FILES;
  const requirements = classifyFile(
    fsHelpers.ovdPath(rootDir, 'requirements.md'),
    placeholders['requirements.md']
  );
  const preferences = classifyFile(
    fsHelpers.ovdPath(rootDir, 'preferences.md'),
    placeholders['preferences.md']
  );
  const decisions = classifyFile(
    fsHelpers.ovdPath(rootDir, 'decisions.md'),
    placeholders['decisions.md']
  );

  let state;
  if (!ovdExists && !overdriveMd) {
    state = 'uninitialized';
  } else if (legacy) {
    state = 'legacy';
  } else if (
    newLayout &&
    codebase.count === 0 &&
    requirements !== 'populated' &&
    preferences !== 'populated' &&
    !overdriveMd
  ) {
    state = 'scaffolded';
  } else if (
    newLayout &&
    codebase.count === CODEBASE_FILES.length &&
    requirements === 'populated' &&
    preferences === 'populated'
  ) {
    state = 'initialized';
  } else {
    state = 'partial';
  }

  return {
    state,
    rootDir,
    ovdExists,
    overdriveMd,
    legacy,
    newLayout,
    codebase,
    requirements,
    preferences,
    decisions
  };
}

function nextStepsFor(state) {
  switch (state) {
    case 'uninitialized':
      return {
        question: 'Next steps:',
        options: [
          '(1) Run /ovd-workflow init — codebase mapping (5 mappers), preferences, requirements. Recommended before planning.',
          '(2) Skip mapping; go straight to /ovd-plan (faster but the planner has less context).',
          '(3) Capture preferences and requirements first; defer mapping.',
          '(4) Other — describe what you want.'
        ]
      };
    case 'legacy':
      return {
        question: 'Pre-v2 .overdrive/ layout detected. Pick one:',
        options: [
          '(1) Migrate now — move legacy files into the new layout; archive originals in .overdrive/_legacy/. Recommended.',
          '(2) Skip migration — archive the legacy directory in .overdrive/_legacy/ and start fresh.',
          '(3) Other — describe what you want.'
        ]
      };
    case 'scaffolded':
      return {
        question: 'New layout present (.overdrive/ scaffolded). Next steps:',
        options: [
          '(1) Run /ovd-workflow map — populate the codebase analysis (5 parallel mappers). Recommended.',
          '(2) Capture preferences and requirements via /ovd-workflow preferences and /ovd-workflow requirements.',
          '(3) Skip context setup and go to /ovd-plan.',
          '(4) Other — describe what you want.'
        ]
      };
    case 'partial':
      return {
        question: 'Project is partially initialized. Next steps:',
        options: [
          '(1) Continue init — finish whichever of mapping, preferences, requirements is still missing. Recommended.',
          '(2) Run /ovd-plan with current context.',
          '(3) Refresh the codebase map (/ovd-workflow map) if you suspect drift.',
          '(4) Other — describe what you want.'
        ]
      };
    case 'initialized':
      return {
        question: 'Project initialized. Next steps:',
        options: [
          '(1) Run /ovd-plan to start or continue planning.',
          '(2) Run /ovd-go to start or continue execution.',
          '(3) Refresh the codebase map (/ovd-workflow map) if you suspect drift.',
          '(4) Review preferences or requirements.',
          '(5) Other — describe what you want.'
        ]
      };
    default:
      return {
        question: 'Next steps:',
        options: [
          '(1) Run /ovd-workflow init.',
          '(2) Other — describe what you want.'
        ]
      };
  }
}

function formatStatusBlock(report) {
  const lines = [];
  lines.push(`Status: ${report.state}`);
  lines.push(`Project root: ${report.rootDir}`);
  if (report.legacy) {
    lines.push('  Legacy layout detected (pre-v2 .overdrive/ files present).');
  }
  if (report.newLayout) {
    lines.push('  New layout present (.overdrive/ scaffolded).');
  }
  lines.push(`  OVERDRIVE.md: ${report.overdriveMd ? 'present' : 'not present'}`);
  if (report.newLayout) {
    const presentFiles = CODEBASE_FILES.filter((name) => report.codebase.present[name]);
    const codebaseSummary = presentFiles.length > 0 ? ` (${presentFiles.join(', ')})` : '';
    lines.push(`  Codebase files: ${report.codebase.count}/${CODEBASE_FILES.length}${codebaseSummary}`);
    lines.push(`  Preferences: ${report.preferences}`);
    lines.push(`  Requirements: ${report.requirements}`);
    lines.push(`  Decisions: ${report.decisions}`);
  }
  return lines.join('\n');
}

function formatWorkflowDefault(result) {
  if (!result) return '';
  const lines = [];
  lines.push('Overdrive (ovd-plan) — /ovd-workflow');
  lines.push('');
  for (const line of result.tutorial) {
    lines.push(line);
  }
  lines.push('');
  lines.push(formatStatusBlock(result.statusReport));
  lines.push('');
  lines.push(result.nextSteps.question);
  for (const opt of result.nextSteps.options) {
    lines.push(`  ${opt}`);
  }
  lines.push('');
  lines.push('Reply with the number, or describe what you want.');
  return lines.join('\n');
}

function runWorkflowDefault(rootDir, opts = {}) {
  if (!rootDir) {
    return {
      ok: false,
      status: 'workflow-default',
      reason: 'no rootDir resolved',
      tutorial: TUTORIAL_LINES.slice(),
      text: 'Could not resolve a project directory. Pass --project-dir or run inside a project tree.'
    };
  }

  const resolvedRoot = path.resolve(rootDir);
  const statusReport = inspectProject(resolvedRoot);
  const nextSteps = nextStepsFor(statusReport.state);

  const result = {
    ok: true,
    status: 'workflow-default',
    state: statusReport.state,
    rootDir: resolvedRoot,
    tutorial: TUTORIAL_LINES.slice(),
    statusReport,
    nextSteps
  };
  result.text = formatWorkflowDefault(result);
  return result;
}

module.exports = {
  CODEBASE_FILES,
  TUTORIAL_LINES,
  STATES,
  inspectProject,
  inspectCodebase,
  classifyFile,
  nextStepsFor,
  formatStatusBlock,
  formatWorkflowDefault,
  runWorkflowDefault
};
