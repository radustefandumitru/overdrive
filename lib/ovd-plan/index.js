'use strict';

const fsModule = require('./fs');
const parserModule = require('./parser');
const writerModule = require('./writer');
const cacheModule = require('./cache');
const skillRouterModule = require('./skill-router');
const workflowModule = require('./workflow');

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
  workflow: workflowModule
};
