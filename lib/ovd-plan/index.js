'use strict';

const fsModule = require('./fs');
const parserModule = require('./parser');
const writerModule = require('./writer');
const cacheModule = require('./cache');
const skillRouterModule = require('./skill-router');
const workflowModule = require('./workflow');
const decisionsLogModule = require('./decisions-log');
const preferencesElicitModule = require('./preferences-elicit');
const requirementsDraftModule = require('./requirements-draft');
const codebaseMapperModule = require('./codebase-mapper');
const driftDetectorModule = require('./drift-detector');
const codebaseRefreshModule = require('./codebase-refresh');
const displayModule = require('./display');
const deliberationStateModule = require('./deliberation-state');
const calibrateModule = require('./calibrate');
const deliberateModule = require('./deliberate');
const blindSpotModule = require('./blind-spot');
const planSkillsModule = require('./plan-skills');
const planQualityModule = require('./plan-quality');
const reentryModule = require('./reentry');
const ideaModule = require('./idea');
const editModule = require('./edit');
const researchModule = require('./research');
const orientModule = require('./orient');
const noderefModule = require('./noderef');
const executeModule = require('./execute');
const verifyModule = require('./verify');
const reviewModule = require('./review');
const iterateModule = require('./iterate');
const closureModule = require('./closure');
const fixModule = require('./fix');
const decisionModule = require('./decision');
const smallModule = require('./small');
const logCaptureModule = require('./log-capture');

const STUB_NOTICE =
  'Implementation is in progress. ' +
  'See docs/superpowers/specs/2026-06-08-ovd-plan-pipeline-architecture-r3.md for the design ' +
  'and docs/superpowers/specs/2026-06-08-ovd-plan-implementation-plan.md for the rollout plan.';

function describeArgs(options) {
  const parts = [];
  if (options.subcommand) parts.push(options.subcommand);
  if (options.text) parts.push(`"${options.text}"`);
  if (options.small) parts.push('--small');
  return parts.join(' ');
}

function stubHandler(command, options = {}) {
  const args = describeArgs(options);
  const header = args ? `[ovd-plan] /ovd-${command} ${args}` : `[ovd-plan] /ovd-${command}`;
  console.log(header);
  console.log(STUB_NOTICE);
  return { ok: true, command, options, status: 'stub' };
}

// Bare `/ovd-plan` three-way routing per readiness brief 12 §5.1:
//   Branch 1: OVERDRIVE.md exists with non-trivial (committed) tree → DISPLAY.
//   Branch 2: deliberation-state shows paused/in-flight activity        → re-entry summary.
//   Branch 3: empty plan / new project                                  → action-path prompt.
//
// Explicit `/ovd-plan display` always runs DISPLAY (no routing).
function emitEmptyPlanRoute() {
  const text = [
    '/ovd-plan — new project (no committed tree, no in-flight deliberation)',
    '=====================================================================',
    '',
    'No plan structure detected yet. Pick a starting path:',
    '',
    'Action paths:',
    '  (1) /ovd-plan deliberate — start the Socratic flow to build a plan from scratch.',
    '  (2) /ovd-plan import — ingest an existing plan doc (Phase 7 — currently stub).',
    '  (3) other — describe what you want.'
  ].join('\n');
  return { ok: true, status: 'plan', mode: 'route', route: 'empty-plan', text };
}

function routeBarePlan(rootDir, opts) {
  const opened = deliberationStateModule.openState(rootDir);
  if (!opened.ok) {
    if (opened.reason === 'missing-plan') return emitEmptyPlanRoute();
    return { ok: false, status: 'plan', mode: 'route', reason: opened.reason, text: opened.text };
  }
  const parsedTree = opened.parsed && opened.parsed.tree;
  const committedChildren = (parsedTree && Array.isArray(parsedTree.children)) ? parsedTree.children : [];
  if (committedChildren.length > 0) {
    return displayModule.runDisplay(rootDir, opts);
  }
  const inner = opened.innerObj || {};
  const hasActivity = !!(
    (inner.proposed_tree && Array.isArray(inner.proposed_tree.milestones) && inner.proposed_tree.milestones.length > 0) ||
    (Array.isArray(inner.answered_questions) && inner.answered_questions.length > 0) ||
    inner.calibration ||
    inner.last_action
  );
  const isMidDeliberation = hasActivity && inner.stage !== 'committed';
  if (isMidDeliberation) {
    return reentryModule.runReentry(rootDir, opts);
  }
  return emitEmptyPlanRoute();
}

function runPlan(options = {}, env = process.env) {
  if (options.subcommand === 'display') {
    const { resolveProjectDir } = require('../ovd-workflow');
    const rootDir = resolveProjectDir(options.projectDir, env);
    return displayModule.runDisplay(rootDir, { color: !!options.color });
  }
  if (!options.subcommand) {
    const { resolveProjectDir } = require('../ovd-workflow');
    const rootDir = resolveProjectDir(options.projectDir, env);
    return routeBarePlan(rootDir, { color: !!options.color });
  }
  if (options.subcommand === 'calibrate') {
    const { resolveProjectDir } = require('../ovd-workflow');
    const rootDir = resolveProjectDir(options.projectDir, env);
    const isCommit = options.step === 'commit' || !!options.entriesJson;
    let entries = null;
    let parseError = null;
    if (options.entriesJson) {
      try {
        entries = JSON.parse(options.entriesJson);
      } catch (e) {
        parseError = e.message;
      }
    }
    if (parseError) {
      return {
        ok: false,
        status: 'calibrate',
        mode: 'commit',
        reason: `--entries-json was not valid JSON: ${parseError}`,
        text: `Invalid --entries-json: ${parseError}`
      };
    }
    return calibrateModule.runCalibrate(rootDir, {
      mode: isCommit ? 'commit' : 'plan',
      entries
    });
  }
  if (options.subcommand === 'deliberate') {
    const { resolveProjectDir } = require('../ovd-workflow');
    const rootDir = resolveProjectDir(options.projectDir, env);
    const isCommit = options.step === 'commit' || !!options.entriesJson;
    let entries = null;
    let parseError = null;
    if (options.entriesJson) {
      try {
        entries = JSON.parse(options.entriesJson);
      } catch (e) {
        parseError = e.message;
      }
    }
    if (parseError) {
      return {
        ok: false,
        status: 'deliberate',
        mode: 'commit',
        reason: `--entries-json was not valid JSON: ${parseError}`,
        text: `Invalid --entries-json: ${parseError}`
      };
    }
    return deliberateModule.runDeliberate(rootDir, {
      mode: isCommit ? 'commit' : 'plan',
      entries
    });
  }
  if (options.subcommand === 'blind-spot') {
    const { resolveProjectDir } = require('../ovd-workflow');
    const rootDir = resolveProjectDir(options.projectDir, env);
    const isCommit = options.step === 'commit' || !!options.entriesJson;
    let entries = null;
    let parseError = null;
    if (options.entriesJson) {
      try {
        entries = JSON.parse(options.entriesJson);
      } catch (e) {
        parseError = e.message;
      }
    }
    if (parseError) {
      return {
        ok: false,
        status: 'blind-spot',
        mode: 'commit',
        reason: `--entries-json was not valid JSON: ${parseError}`,
        text: `Invalid --entries-json: ${parseError}`
      };
    }
    return blindSpotModule.runBlindSpot(rootDir, {
      mode: isCommit ? 'commit' : 'plan',
      entries
    });
  }
  if (options.subcommand === 'verify') {
    // Slice C — retrospective audit subcommand. Calls plan-quality.js directly
    // (no runVerifyStage wrapper, no deliberation-state stage transition).
    // Tree source: resolveTreeFromOpened in plan-quality picks proposed_tree if
    // present (mid-deliberation), else falls back to the committed tree.
    const { resolveProjectDir } = require('../ovd-workflow');
    const rootDir = resolveProjectDir(options.projectDir, env);
    const isCommit = options.step === 'commit' || !!options.entriesJson;
    let entries = null;
    let parseError = null;
    if (options.entriesJson) {
      try {
        entries = JSON.parse(options.entriesJson);
      } catch (e) {
        parseError = e.message;
      }
    }
    if (parseError) {
      return {
        ok: false,
        status: 'plan-quality',
        mode: 'commit',
        reason: `--entries-json was not valid JSON: ${parseError}`,
        text: `Invalid --entries-json: ${parseError}`
      };
    }
    return planQualityModule.runPlanQualityCheck(rootDir, {
      mode: isCommit ? 'commit' : 'plan',
      entries
    });
  }
  if (options.subcommand === 'idea') {
    const { resolveProjectDir } = require('../ovd-workflow');
    const rootDir = resolveProjectDir(options.projectDir, env);
    const isCommit = options.step === 'commit' || !!options.entriesJson;
    let entries = null;
    let parseError = null;
    if (options.entriesJson) {
      try {
        entries = JSON.parse(options.entriesJson);
      } catch (e) {
        parseError = e.message;
      }
    }
    if (parseError) {
      return {
        ok: false,
        status: 'idea',
        mode: 'commit',
        reason: `--entries-json was not valid JSON: ${parseError}`,
        text: `Invalid --entries-json: ${parseError}`
      };
    }
    return ideaModule.runIdea(rootDir, {
      mode: isCommit ? 'commit' : 'plan',
      text: options.text || null,
      entries
    });
  }
  if (options.subcommand === 'edit') {
    const { resolveProjectDir } = require('../ovd-workflow');
    const rootDir = resolveProjectDir(options.projectDir, env);
    const isCommit = options.step === 'commit' || !!options.entriesJson;
    let entries = null;
    let parseError = null;
    if (options.entriesJson) {
      try {
        entries = JSON.parse(options.entriesJson);
      } catch (e) {
        parseError = e.message;
      }
    }
    if (parseError) {
      return {
        ok: false,
        status: 'edit',
        mode: 'commit',
        reason: `--entries-json was not valid JSON: ${parseError}`,
        text: `Invalid --entries-json: ${parseError}`
      };
    }
    return editModule.runEdit(rootDir, {
      mode: isCommit ? 'commit' : 'plan',
      text: options.text || null,
      entries
    });
  }
  if (options.subcommand === 'research') {
    const { resolveProjectDir } = require('../ovd-workflow');
    const rootDir = resolveProjectDir(options.projectDir, env);
    const isCommit = options.step === 'commit' || !!options.entriesJson;
    let entries = null;
    let parseError = null;
    if (options.entriesJson) {
      try {
        entries = JSON.parse(options.entriesJson);
      } catch (e) {
        parseError = e.message;
      }
    }
    if (parseError) {
      return {
        ok: false,
        status: 'research',
        mode: 'commit',
        reason: `--entries-json was not valid JSON: ${parseError}`,
        text: `Invalid --entries-json: ${parseError}`
      };
    }
    return researchModule.runResearch(rootDir, {
      mode: isCommit ? 'commit' : 'plan',
      text: options.text || null,
      entries
    });
  }
  return stubHandler('plan', options);
}

function runGo(options = {}, env = process.env) {
  // Bare `/ovd-go` → ORIENT (Task 4.1). `/ovd-go <node-ref>` (text, no subcommand)
  // → node-ref resolution (Task 4.11). Subcommands (verify/execute/test/continue)
  // are wired in subsequent Phase 4 tasks; until then they fall through to the stub.
  if (!options.subcommand && !options.text) {
    const { resolveProjectDir } = require('../ovd-workflow');
    const rootDir = resolveProjectDir(options.projectDir, env);
    return orientModule.runGoDefault(rootDir, { color: !!options.color });
  }
  if (!options.subcommand && options.text) {
    const { resolveProjectDir } = require('../ovd-workflow');
    const rootDir = resolveProjectDir(options.projectDir, env);
    return noderefModule.runGoNodeRef(rootDir, options.text, { color: !!options.color });
  }
  // `/ovd-go execute <ref>` (plan) / `--entries-json` (commit) — internal LEAF
  // EXECUTE entry the slash-command body orchestrates after orient/resolve (Task 4.2).
  if (options.subcommand === 'execute') {
    const { resolveProjectDir } = require('../ovd-workflow');
    const rootDir = resolveProjectDir(options.projectDir, env);
    const isCommit = options.step === 'commit' || !!options.entriesJson;
    let entries = null;
    let parseError = null;
    if (options.entriesJson) {
      try {
        entries = JSON.parse(options.entriesJson);
      } catch (e) {
        parseError = e.message;
      }
    }
    if (parseError) {
      return { ok: false, status: 'go', mode: 'commit', reason: `--entries-json was not valid JSON: ${parseError}`, text: `Invalid --entries-json: ${parseError}` };
    }
    return executeModule.runExecuteLeaf(rootDir, { mode: isCommit ? 'commit' : 'plan', leafId: options.text, entries });
  }
  // `/ovd-go verify <ref>` (plan) / `--entries-json` (commit) — LEAF VERIFY (Task 4.3).
  if (options.subcommand === 'verify') {
    const { resolveProjectDir } = require('../ovd-workflow');
    const rootDir = resolveProjectDir(options.projectDir, env);
    const isCommit = options.step === 'commit' || !!options.entriesJson;
    let entries = null;
    let parseError = null;
    if (options.entriesJson) {
      try {
        entries = JSON.parse(options.entriesJson);
      } catch (e) {
        parseError = e.message;
      }
    }
    if (parseError) {
      return { ok: false, status: 'go', mode: 'commit', reason: `--entries-json was not valid JSON: ${parseError}`, text: `Invalid --entries-json: ${parseError}` };
    }
    return verifyModule.runVerify(rootDir, { mode: isCommit ? 'commit' : 'plan', leafId: options.text, entries });
  }
  // `/ovd-go review <ref>` (plan) / `--entries-json` (commit) — AWAITING REVIEW (Task 4.4).
  if (options.subcommand === 'review') {
    const { resolveProjectDir } = require('../ovd-workflow');
    const rootDir = resolveProjectDir(options.projectDir, env);
    const isCommit = options.step === 'commit' || !!options.entriesJson;
    let entries = null;
    let parseError = null;
    if (options.entriesJson) {
      try {
        entries = JSON.parse(options.entriesJson);
      } catch (e) {
        parseError = e.message;
      }
    }
    if (parseError) {
      return { ok: false, status: 'go', mode: 'commit', reason: `--entries-json was not valid JSON: ${parseError}`, text: `Invalid --entries-json: ${parseError}` };
    }
    return reviewModule.runReview(rootDir, { mode: isCommit ? 'commit' : 'plan', leafId: options.text, entries });
  }
  // `/ovd-go iterate <ref>` (plan = history) / `--entries-json` (commit = capture + re-execute) — Task 4.5.
  if (options.subcommand === 'iterate') {
    const { resolveProjectDir } = require('../ovd-workflow');
    const rootDir = resolveProjectDir(options.projectDir, env);
    const isCommit = options.step === 'commit' || !!options.entriesJson;
    let entries = null;
    let parseError = null;
    if (options.entriesJson) {
      try {
        entries = JSON.parse(options.entriesJson);
      } catch (e) {
        parseError = e.message;
      }
    }
    if (parseError) {
      return { ok: false, status: 'go', mode: 'commit', reason: `--entries-json was not valid JSON: ${parseError}`, text: `Invalid --entries-json: ${parseError}` };
    }
    return iterateModule.runIterate(rootDir, { mode: isCommit ? 'commit' : 'plan', leafId: options.text, entries });
  }
  // `/ovd-go close <just-closed-ref>` (plan = present closure) / `--entries-json` (commit = decision) — Task 4.6.
  if (options.subcommand === 'close') {
    const { resolveProjectDir } = require('../ovd-workflow');
    const rootDir = resolveProjectDir(options.projectDir, env);
    const isCommit = options.step === 'commit' || !!options.entriesJson;
    let entries = null;
    let parseError = null;
    if (options.entriesJson) {
      try {
        entries = JSON.parse(options.entriesJson);
      } catch (e) {
        parseError = e.message;
      }
    }
    if (parseError) {
      return { ok: false, status: 'go', mode: 'commit', reason: `--entries-json was not valid JSON: ${parseError}`, text: `Invalid --entries-json: ${parseError}` };
    }
    return closureModule.runClose(rootDir, { mode: isCommit ? 'commit' : 'plan', leafId: options.text, entries });
  }
  // `/ovd-go fix <ref>` (plan = attempt plan/escalation) / `--entries-json` (commit = record attempt or escalation decision) — Task 4.9.
  if (options.subcommand === 'fix') {
    const { resolveProjectDir } = require('../ovd-workflow');
    const rootDir = resolveProjectDir(options.projectDir, env);
    const isCommit = options.step === 'commit' || !!options.entriesJson;
    let entries = null;
    let parseError = null;
    if (options.entriesJson) {
      try {
        entries = JSON.parse(options.entriesJson);
      } catch (e) {
        parseError = e.message;
      }
    }
    if (parseError) {
      return { ok: false, status: 'go', mode: 'commit', reason: `--entries-json was not valid JSON: ${parseError}`, text: `Invalid --entries-json: ${parseError}` };
    }
    return fixModule.runFix(rootDir, { mode: isCommit ? 'commit' : 'plan', leafId: options.text, entries });
  }
  // `/ovd-go decision <ref> --entries-json` (surface payload OR resolution) — Task 4.10.
  if (options.subcommand === 'decision') {
    const { resolveProjectDir } = require('../ovd-workflow');
    const rootDir = resolveProjectDir(options.projectDir, env);
    let entries = null;
    let parseError = null;
    if (options.entriesJson) {
      try {
        entries = JSON.parse(options.entriesJson);
      } catch (e) {
        parseError = e.message;
      }
    }
    if (parseError) {
      return { ok: false, status: 'go', mode: 'commit', reason: `--entries-json was not valid JSON: ${parseError}`, text: `Invalid --entries-json: ${parseError}` };
    }
    return decisionModule.runDecision(rootDir, { entries });
  }
  // `/ovd-go assess <ref>` — `--small` pre-execution scope assessment (Task 4.7).
  if (options.subcommand === 'assess') {
    const { resolveProjectDir } = require('../ovd-workflow');
    const rootDir = resolveProjectDir(options.projectDir, env);
    return smallModule.assessScope(rootDir, options.text, {});
  }
  // `/ovd-go monitor --entries-json {files_touched}` — `--small` scope-growth check (Task 4.8). Stateless.
  if (options.subcommand === 'monitor') {
    let entries = null;
    let parseError = null;
    if (options.entriesJson) {
      try {
        entries = JSON.parse(options.entriesJson);
      } catch (e) {
        parseError = e.message;
      }
    }
    if (parseError) {
      return { ok: false, status: 'go', mode: 'commit', reason: `--entries-json was not valid JSON: ${parseError}`, text: `Invalid --entries-json: ${parseError}` };
    }
    return smallModule.monitorSmallScope(entries);
  }
  return stubHandler('go', options);
}

function runLog(options = {}, env = process.env) {
  // `/ovd-log capture "text"` (Task 5.3) — timestamped append to the current
  // session file. Zero analysis; not a Pattern-1 dispatch (no --entries-json).
  if (options.subcommand === 'capture') {
    const { resolveProjectDir } = require('../ovd-workflow');
    const rootDir = resolveProjectDir(options.projectDir, env);
    return logCaptureModule.runLogCapture(rootDir, options.text || '');
  }
  return stubHandler('log', options);
}

function runWorkflow(options = {}, env = process.env) {
  if (!options.subcommand) {
    const { resolveProjectDir } = require('../ovd-workflow');
    const rootDir = resolveProjectDir(options.projectDir, env);
    return workflowModule.runWorkflowDefault(rootDir, options);
  }
  if (options.subcommand === 'init') {
    const { resolveProjectDir } = require('../ovd-workflow');
    const rootDir = resolveProjectDir(options.projectDir, env);
    return workflowModule.runWorkflowInit(rootDir, options);
  }
  if (options.subcommand === 'preferences') {
    const { resolveProjectDir } = require('../ovd-workflow');
    const rootDir = resolveProjectDir(options.projectDir, env);
    const isCommit = options.step === 'commit' || !!options.entriesJson;
    let entries = null;
    let parseError = null;
    if (isCommit && options.entriesJson) {
      try {
        entries = JSON.parse(options.entriesJson);
      } catch (e) {
        parseError = e.message;
      }
    }
    if (isCommit && parseError) {
      return {
        ok: false,
        status: 'preferences-elicit',
        mode: 'commit',
        reason: `--entries-json was not valid JSON: ${parseError}`,
        text: `Invalid --entries-json: ${parseError}`
      };
    }
    return preferencesElicitModule.runPreferencesElicit(rootDir, {
      mode: isCommit ? 'commit' : 'plan',
      entries
    });
  }
  if (options.subcommand === 'requirements') {
    const { resolveProjectDir } = require('../ovd-workflow');
    const rootDir = resolveProjectDir(options.projectDir, env);
    const isCommit = options.step === 'commit' || !!options.entriesJson;
    let entries = null;
    let parseError = null;
    if (isCommit && options.entriesJson) {
      try {
        entries = JSON.parse(options.entriesJson);
      } catch (e) {
        parseError = e.message;
      }
    }
    if (isCommit && parseError) {
      return {
        ok: false,
        status: 'requirements-draft',
        mode: 'commit',
        reason: `--entries-json was not valid JSON: ${parseError}`,
        text: `Invalid --entries-json: ${parseError}`
      };
    }
    return requirementsDraftModule.runRequirementsDraft(rootDir, {
      mode: isCommit ? 'commit' : 'plan',
      entries
    });
  }
  if (options.subcommand === 'map') {
    const { resolveProjectDir } = require('../ovd-workflow');
    const rootDir = resolveProjectDir(options.projectDir, env);
    const isCommit = options.step === 'commit' || !!options.entriesJson;
    let entries = null;
    let parseError = null;
    if (isCommit && options.entriesJson) {
      try {
        entries = JSON.parse(options.entriesJson);
      } catch (e) {
        parseError = e.message;
      }
    }
    if (isCommit && parseError) {
      return {
        ok: false,
        status: 'codebase-map',
        mode: 'commit',
        reason: `--entries-json was not valid JSON: ${parseError}`,
        text: `Invalid --entries-json: ${parseError}`
      };
    }
    return codebaseMapperModule.runCodebaseMap(rootDir, {
      mode: isCommit ? 'commit' : 'plan',
      entries
    });
  }
  if (options.subcommand === 'drift') {
    const { resolveProjectDir } = require('../ovd-workflow');
    const rootDir = resolveProjectDir(options.projectDir, env);
    let entries = null;
    let parseError = null;
    if (options.entriesJson) {
      try {
        entries = JSON.parse(options.entriesJson);
      } catch (e) {
        parseError = e.message;
      }
    }
    if (parseError) {
      return {
        ok: false,
        status: 'drift-detect',
        reason: `--entries-json was not valid JSON: ${parseError}`,
        text: `Invalid --entries-json: ${parseError}`
      };
    }
    const changedPaths = (entries && Array.isArray(entries.changedPaths)) ? entries.changedPaths : [];
    return driftDetectorModule.detectDrift(rootDir, { changedPaths });
  }
  if (options.subcommand === 'refresh') {
    const { resolveProjectDir } = require('../ovd-workflow');
    const rootDir = resolveProjectDir(options.projectDir, env);
    const isCommit = options.step === 'commit';
    let entries = null;
    let parseError = null;
    if (options.entriesJson) {
      try {
        entries = JSON.parse(options.entriesJson);
      } catch (e) {
        parseError = e.message;
      }
    }
    if (parseError) {
      return {
        ok: false,
        status: 'refresh',
        mode: isCommit ? 'commit' : 'plan',
        reason: `--entries-json was not valid JSON: ${parseError}`,
        text: `Invalid --entries-json: ${parseError}`
      };
    }
    if (isCommit) {
      return codebaseRefreshModule.runRefreshMap(rootDir, {
        mode: 'commit',
        entries
      });
    }
    const planOpts = { mode: 'plan' };
    if (entries && Array.isArray(entries.mappers)) planOpts.mappers = entries.mappers;
    if (entries && Array.isArray(entries.changedPaths)) planOpts.changedPaths = entries.changedPaths;
    return codebaseRefreshModule.runRefreshMap(rootDir, planOpts);
  }
  return stubHandler('workflow', options);
}

module.exports = {
  runPlan,
  runGo,
  runLog,
  runWorkflow,
  STUB_NOTICE,
  fs: fsModule,
  parser: parserModule,
  writer: writerModule,
  cache: cacheModule,
  skillRouter: skillRouterModule,
  workflow: workflowModule,
  decisionsLog: decisionsLogModule,
  appendDecision: decisionsLogModule.appendDecision,
  readDecisions: decisionsLogModule.readDecisions,
  preferencesElicit: preferencesElicitModule,
  runPreferencesElicit: preferencesElicitModule.runPreferencesElicit,
  requirementsDraft: requirementsDraftModule,
  runRequirementsDraft: requirementsDraftModule.runRequirementsDraft,
  codebaseMapper: codebaseMapperModule,
  runCodebaseMap: codebaseMapperModule.runCodebaseMap,
  driftDetector: driftDetectorModule,
  detectDrift: driftDetectorModule.detectDrift,
  codebaseRefresh: codebaseRefreshModule,
  runRefreshMap: codebaseRefreshModule.runRefreshMap,
  display: displayModule,
  runDisplay: displayModule.runDisplay,
  deliberationState: deliberationStateModule,
  calibrate: calibrateModule,
  runCalibrate: calibrateModule.runCalibrate,
  deliberate: deliberateModule,
  runDeliberate: deliberateModule.runDeliberate,
  blindSpot: blindSpotModule,
  runBlindSpot: blindSpotModule.runBlindSpot,
  planSkills: planSkillsModule,
  runPlanSkills: planSkillsModule.runPlanSkills,
  planQuality: planQualityModule,
  runPlanQualityCheck: planQualityModule.runPlanQualityCheck,
  reentry: reentryModule,
  runReentry: reentryModule.runReentry,
  idea: ideaModule,
  runIdea: ideaModule.runIdea,
  edit: editModule,
  runEdit: editModule.runEdit,
  research: researchModule,
  runResearch: researchModule.runResearch,
  orient: orientModule,
  runGoDefault: orientModule.runGoDefault,
  noderef: noderefModule,
  runGoNodeRef: noderefModule.runGoNodeRef,
  execute: executeModule,
  runExecuteLeaf: executeModule.runExecuteLeaf,
  verify: verifyModule,
  runVerify: verifyModule.runVerify,
  review: reviewModule,
  runReview: reviewModule.runReview,
  classifyUserResponse: reviewModule.classifyUserResponse,
  iterate: iterateModule,
  runIterate: iterateModule.runIterate,
  closure: closureModule,
  runClose: closureModule.runClose,
  fix: fixModule,
  runFix: fixModule.runFix,
  decision: decisionModule,
  runDecision: decisionModule.runDecision,
  small: smallModule,
  assessScope: smallModule.assessScope,
  monitorSmallScope: smallModule.monitorSmallScope,
  logCapture: logCaptureModule,
  runLogCapture: logCaptureModule.runLogCapture,
  appendSessionEntry: logCaptureModule.appendSessionEntry,
  routeBarePlan,
  emitEmptyPlanRoute
};
