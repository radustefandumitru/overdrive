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

// ============================================================================
// Task 2.2 — INIT orchestration (with migration detection)
// ============================================================================
//
// Turn-based state machine: each invocation advances by one step. The agent
// (slash command body) re-invokes the CLI with the chosen action. The CLI
// itself is non-interactive — it inspects state, returns an action-path prompt
// or a step-completion result, and exits.
//
// Sub-task stubs (runMigrateLegacy / runCodebaseMap / runPreferencesElicit /
// runRequirementsDraft) are placeholders for Tasks 2.2.5 / 2.3 / 2.4 / 2.5.
// Each emits a structured result with stub: true so the orchestrator and the
// tests can verify the call happened. The real implementations replace these
// in their owning tasks.

const INIT_STEPS = ['detect', 'migration', 'mapping', 'preferences', 'requirements', 'complete'];
const MIGRATION_ACTIONS = ['migrate', 'skip-migration', 'other'];
const CANONICAL_ACTIONS = ['proceed', 'skip', 'skip-all', 'other'];
const REQUIREMENTS_ACTIONS = ['proceed', 'skip', 'other'];

const migrateModule = require('./migrate');
const runMigrateLegacy = migrateModule.runMigrateLegacy;

function runCodebaseMap(rootDir, opts = {}) {
  return {
    ok: true,
    status: 'codebase-map-stub',
    stub: true,
    note: 'Task 2.3 placeholder — 5 parallel mapper agents (architecture, patterns, tech-stack, quality, concerns) land in a future commit.'
  };
}

const preferencesElicitModule = require('./preferences-elicit');
const runPreferencesElicit = preferencesElicitModule.runPreferencesElicit;

function runRequirementsDraft(rootDir, opts = {}) {
  return {
    ok: true,
    status: 'requirements-draft-stub',
    stub: true,
    note: 'Task 2.5 placeholder — Socratic requirements flow lands in a future commit.'
  };
}

function ensureScaffolded(rootDir) {
  const report = inspectProject(rootDir);
  if (report.ovdExists && report.newLayout) {
    return { scaffolded: false, action: 'already-scaffolded' };
  }
  const result = fsHelpers.scaffoldOverdrivePlan(rootDir);
  return {
    scaffolded: result.scaffolded === true,
    action: result.scaffolded ? 'scaffolded' : (result.reason || 'unknown'),
    needsMigration: result.needsMigration === true
  };
}

function migrationPrompt() {
  return {
    step: 'migration',
    question: 'Pre-v2 .overdrive/ layout detected. Pick one:',
    options: [
      '(1) migrate — move legacy files into the new layout; archive originals in .overdrive/_legacy/. Recommended.',
      '(2) skip-migration — archive the legacy directory in .overdrive/_legacy/ and start fresh on the new layout.',
      '(3) other — describe what you want.'
    ],
    actions: MIGRATION_ACTIONS.slice()
  };
}

function mappingPrompt() {
  return {
    step: 'mapping',
    question: 'Codebase mapping (5 parallel mappers → .overdrive/codebase/). Run now?',
    options: [
      '(1) proceed — run the mapping (recommended; gives the planner grounding).',
      '(2) skip — skip mapping for now (you can run /ovd-workflow map later).',
      '(3) skip-all — skip the rest of init (mapping + preferences + requirements).',
      '(4) other — describe what you want.'
    ],
    actions: CANONICAL_ACTIONS.slice()
  };
}

function preferencesPrompt() {
  return {
    step: 'preferences',
    question: 'Preferences (Socratic capture of vetoes, coding style, workflow, communication). Run now?',
    options: [
      '(1) proceed — capture preferences via short Socratic dialogue.',
      '(2) skip — leave preferences as placeholder; you can run /ovd-workflow preferences later.',
      '(3) skip-all — skip the rest of init (preferences + requirements).',
      '(4) other — describe what you want.'
    ],
    actions: CANONICAL_ACTIONS.slice()
  };
}

function requirementsPrompt() {
  return {
    step: 'requirements',
    question: 'Requirements (Socratic capture of functional, non-functional, out-of-scope). Run now?',
    options: [
      '(1) proceed — capture requirements via short Socratic dialogue.',
      '(2) skip — leave requirements as placeholder; you can run /ovd-workflow requirements later.',
      '(3) other — describe what you want.'
    ],
    actions: REQUIREMENTS_ACTIONS.slice()
  };
}

function promptFor(step) {
  switch (step) {
    case 'migration': return migrationPrompt();
    case 'mapping': return mappingPrompt();
    case 'preferences': return preferencesPrompt();
    case 'requirements': return requirementsPrompt();
    default: return null;
  }
}

function formatInitResult(result) {
  const lines = [];
  lines.push('Overdrive (ovd-plan) — /ovd-workflow init');
  lines.push('');
  lines.push(`Status: ${result.state}`);
  lines.push(`Project root: ${result.rootDir}`);
  lines.push(`Current step: ${result.currentStep}`);
  if (Array.isArray(result.log) && result.log.length > 0) {
    lines.push('');
    lines.push('This turn:');
    for (const entry of result.log) {
      const marks = [];
      if (entry.skipped) marks.push('skipped');
      if (entry.stub) marks.push('stub');
      if (entry.mode && entry.mode !== 'full') marks.push(`mode=${entry.mode}`);
      const tagSuffix = marks.length > 0 ? ` [${marks.join(', ')}]` : '';
      const detail = entry.note ? `: ${entry.note}` : '';
      lines.push(`  - ${entry.step}${tagSuffix}${detail}`);
    }
  }
  if (result.note) {
    lines.push('');
    lines.push(`Note: ${result.note}`);
  }
  if (result.prompt) {
    lines.push('');
    lines.push(result.prompt.question);
    for (const opt of result.prompt.options) {
      lines.push(`  ${opt}`);
    }
    lines.push('');
    lines.push(
      `Reply with the number, the action keyword (${result.prompt.actions.join(' / ')}), or describe what you want.`
    );
    lines.push(`To advance via CLI: overdrive workflow init ${result.prompt.step} <action>`);
  }
  if (result.done) {
    lines.push('');
    if (result.alreadyInitialized) {
      lines.push('Project already initialized — nothing to do. Run /ovd-plan to begin (or continue) deliberation.');
    } else if (result.abortedEarly) {
      lines.push('Init ended early (skip-all chosen). Remaining steps deferred — run /ovd-workflow init <step> proceed to resume.');
    } else {
      lines.push('Init complete. Run /ovd-plan to begin deliberation.');
    }
  }
  return lines.join('\n');
}

function emitInitResult(currentStep, statusReport, log, extra = {}) {
  const result = {
    ok: true,
    status: 'workflow-init',
    state: statusReport.state,
    rootDir: statusReport.rootDir,
    currentStep,
    statusReport,
    log,
    ...extra
  };
  result.text = formatInitResult(result);
  return result;
}

function runWorkflowInit(rootDir, opts = {}) {
  if (!rootDir) {
    return {
      ok: false,
      status: 'workflow-init',
      reason: 'no rootDir resolved',
      text: 'Could not resolve a project directory. Pass --project-dir or run inside a project tree.'
    };
  }

  const resolvedRoot = path.resolve(rootDir);
  const step = opts.step || 'detect';
  const action = opts.action || null;
  const log = [];

  if (!INIT_STEPS.includes(step)) {
    return {
      ok: false,
      status: 'workflow-init',
      reason: `Unknown step: ${step}`,
      text: `Unknown init step: ${step}. Valid: ${INIT_STEPS.join(', ')}.`
    };
  }

  const initialReport = inspectProject(resolvedRoot);

  // --- detect: initial entry; route based on state ---
  if (step === 'detect') {
    if (initialReport.state === 'legacy') {
      return emitInitResult('migration', initialReport, log, { prompt: migrationPrompt() });
    }
    if (initialReport.state === 'initialized') {
      return emitInitResult('complete', initialReport, log, { done: true, alreadyInitialized: true });
    }
    const scaffold = ensureScaffolded(resolvedRoot);
    log.push({ step: 'scaffold', skipped: !scaffold.scaffolded, note: scaffold.action });
    const refreshed = inspectProject(resolvedRoot);
    return emitInitResult('mapping', refreshed, log, { prompt: mappingPrompt() });
  }

  // --- migration: legacy → migrate-or-archive → mapping ---
  if (step === 'migration') {
    if (action === 'migrate' || action === 'skip-migration') {
      const mode = action === 'migrate' ? 'full' : 'archive-only';
      const migration = runMigrateLegacy(resolvedRoot, { mode });
      log.push({
        step: 'migrate',
        mode: migration.mode || mode,
        migrated: Array.isArray(migration.migrated) ? migration.migrated.length : 0,
        archived: Array.isArray(migration.archived) ? migration.archived.length : 0,
        conflicts: Array.isArray(migration.conflicts) ? migration.conflicts.length : 0,
        note: migration.summary
      });
      const scaffold = ensureScaffolded(resolvedRoot);
      log.push({ step: 'scaffold', skipped: !scaffold.scaffolded, note: scaffold.action });
      const refreshed = inspectProject(resolvedRoot);
      return emitInitResult('mapping', refreshed, log, { prompt: mappingPrompt(), migration });
    }
    return emitInitResult('migration', initialReport, log, {
      prompt: migrationPrompt(),
      note: action
        ? `Unrecognized action: ${action}. Pick one of: ${MIGRATION_ACTIONS.join(', ')}.`
        : 'No action provided.'
    });
  }

  // --- canonical sub-steps: mapping → preferences → requirements → complete ---
  const canonical = {
    mapping: {
      runner: runCodebaseMap,
      logKey: 'codebase-map',
      next: 'preferences',
      nextPrompt: preferencesPrompt,
      skipRemaining: ['mapping', 'preferences', 'requirements'],
      allowedActions: CANONICAL_ACTIONS
    },
    preferences: {
      runner: (root) => runPreferencesElicit(root, {}),
      logKey: 'preferences-elicit',
      next: 'requirements',
      nextPrompt: requirementsPrompt,
      skipRemaining: ['preferences', 'requirements'],
      allowedActions: CANONICAL_ACTIONS
    },
    requirements: {
      runner: runRequirementsDraft,
      logKey: 'requirements-draft',
      next: 'complete',
      nextPrompt: null,
      skipRemaining: ['requirements'],
      allowedActions: REQUIREMENTS_ACTIONS
    }
  };

  if (canonical[step]) {
    const cfg = canonical[step];
    if (action === 'proceed') {
      const sub = cfg.runner(resolvedRoot);
      log.push({ step: cfg.logKey, stub: sub.stub === true, note: sub.summary || sub.note });
      const refreshed = inspectProject(resolvedRoot);
      if (cfg.next === 'complete') {
        return emitInitResult('complete', refreshed, log, { done: true });
      }
      return emitInitResult(cfg.next, refreshed, log, { prompt: cfg.nextPrompt() });
    }
    if (action === 'skip') {
      log.push({ step: cfg.logKey, skipped: true });
      if (cfg.next === 'complete') {
        return emitInitResult('complete', initialReport, log, { done: true });
      }
      return emitInitResult(cfg.next, initialReport, log, { prompt: cfg.nextPrompt() });
    }
    if (action === 'skip-all' && cfg.allowedActions.includes('skip-all')) {
      log.push({ step: 'init-aborted', remaining: cfg.skipRemaining });
      return emitInitResult('complete', initialReport, log, { done: true, abortedEarly: true });
    }
    return emitInitResult(step, initialReport, log, {
      prompt: promptFor(step),
      note: action
        ? `Unrecognized action: ${action}. Pick one of: ${cfg.allowedActions.join(', ')}.`
        : 'No action provided.'
    });
  }

  // --- complete: terminal no-op ---
  return emitInitResult('complete', initialReport, log, { done: true });
}

module.exports = {
  CODEBASE_FILES,
  TUTORIAL_LINES,
  STATES,
  INIT_STEPS,
  MIGRATION_ACTIONS,
  CANONICAL_ACTIONS,
  REQUIREMENTS_ACTIONS,
  inspectProject,
  inspectCodebase,
  classifyFile,
  nextStepsFor,
  formatStatusBlock,
  formatWorkflowDefault,
  formatInitResult,
  runWorkflowDefault,
  runWorkflowInit,
  runMigrateLegacy,
  runCodebaseMap,
  runPreferencesElicit,
  runRequirementsDraft,
  ensureScaffolded,
  migrationPrompt,
  mappingPrompt,
  preferencesPrompt,
  requirementsPrompt,
  promptFor
};
