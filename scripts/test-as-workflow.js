#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const workflow = require('../lib/as-workflow');

const failures = [];

function check(label, condition, detail = '') {
  if (!condition) failures.push(detail ? `${label}: ${detail}` : label);
}

function tempProject(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"test"}\n');
  fs.writeFileSync(path.join(dir, 'index.js'), 'console.log("hello")\n');
  return dir;
}

const dryProject = tempProject('as-workflow-dry');
workflow.resync({ projectDir: dryProject, apply: false });
check('resync dry-run does not initialize workflow', !fs.existsSync(path.join(dryProject, '.agenticsupercharge')));

const project = tempProject('as-workflow');
const init = workflow.initWorkflow({ projectDir: project, reason: 'test' });
check('init creates workflow', fs.existsSync(path.join(project, '.agenticsupercharge')));
check('init creates config', fs.existsSync(path.join(project, '.agenticsupercharge/config.json')));
check('init gitignores workflow', fs.readFileSync(path.join(project, '.gitignore'), 'utf8').includes('.agenticsupercharge/'));

const status = workflow.status({ projectDir: project });
check('status reports initialized', status.initialized === true);

const resync = workflow.resync({ projectDir: project, apply: true });
check('resync apply tracks files', resync.trackedFiles > 0);
check('resync writes file-index', JSON.parse(fs.readFileSync(path.join(project, '.agenticsupercharge/file-index.json'), 'utf8')).files.length > 0);

fs.writeFileSync(path.join(project, 'index.js'), 'console.log("changed")\n');
const doctor = workflow.doctor({ projectDir: project });
check('doctor detects stale hash', doctor.issues.some((issue) => issue.includes('index.js')));

const checkpoint = workflow.checkpoint({ projectDir: project, message: 'test checkpoint' });
check('checkpoint creates handoff file', fs.existsSync(checkpoint.file));

const route = workflow.recordRoute({ projectDir: project, skills: 'planning-first,playwright-cli', reason: 'test route' });
check('route is recorded', route.ok === true && fs.readFileSync(path.join(project, '.agenticsupercharge/routes.jsonl'), 'utf8').includes('planning-first'));

const disabledProject = tempProject('as-workflow-disabled');
const hook = workflow.hook({
  projectDir: disabledProject,
  event: 'prompt-submit',
  target: 'claude',
  stdin: JSON.stringify({ cwd: disabledProject, prompt: 'Build a reasonably complex feature and verify it.' }),
  env: { ...process.env, AGENTIC_SUPERCHARGE_WORKFLOW: 'disabled' }
});
check('disabled hook does not initialize workflow', hook.disabled === true && !fs.existsSync(path.join(disabledProject, '.agenticsupercharge')));

const disabledCheckpointProject = tempProject('as-workflow-disabled-checkpoint');
const disabledCheckpoint = workflow.checkpoint({
  projectDir: disabledCheckpointProject,
  message: 'disabled checkpoint',
  env: { ...process.env, AGENTIC_SUPERCHARGE_WORKFLOW: 'disabled' }
});
check('disabled checkpoint does not initialize workflow', disabledCheckpoint.disabled === true && !fs.existsSync(path.join(disabledCheckpointProject, '.agenticsupercharge')));

const disabledRouteProject = tempProject('as-workflow-disabled-route');
workflow.initWorkflow({ projectDir: disabledRouteProject, reason: 'route test' });
const disabledRoute = workflow.recordRoute({
  projectDir: disabledRouteProject,
  skills: 'planning-first',
  reason: 'disabled route',
  env: { ...process.env, AGENTIC_SUPERCHARGE_WORKFLOW: 'disabled' }
});
check('disabled route does not write route trace', disabledRoute.disabled === true && fs.readFileSync(path.join(disabledRouteProject, '.agenticsupercharge/routes.jsonl'), 'utf8') === '');

if (failures.length) {
  console.error(`AS-Workflow tests failed (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('AS-Workflow tests passed');
