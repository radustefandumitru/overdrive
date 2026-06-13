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

function runPlan(options = {}, env = process.env) {
  const isDisplay = options.subcommand === 'display';
  const isBare = !options.subcommand;
  if (isDisplay || isBare) {
    const { resolveProjectDir } = require('../ovd-workflow');
    const rootDir = resolveProjectDir(options.projectDir, env);
    const displayResult = displayModule.runDisplay(rootDir, { color: !!options.color });
    if (displayResult.ok) return displayResult;
    if (isDisplay) return displayResult;
    if (displayResult.reason === 'missing-plan') {
      return stubHandler('plan', options);
    }
    return displayResult;
  }
  return stubHandler('plan', options);
}

function runGo(options = {}, env = process.env) {
  return stubHandler('go', options);
}

function runLog(options = {}, env = process.env) {
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
  runDisplay: displayModule.runDisplay
};
