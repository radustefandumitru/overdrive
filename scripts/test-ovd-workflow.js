#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const installer = require('../lib/installer');
const workflow = require('../lib/ovd-workflow');

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

function runNode(args, env = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, ...env },
    encoding: 'utf8'
  });
  check(`command exits 0: node ${args.join(' ')}`, result.status === 0, result.stderr || result.stdout);
  return result;
}

function runCommand(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, ...env },
    encoding: 'utf8'
  });
  check(`command exits 0: ${command} ${args.join(' ')}`, result.status === 0, result.stderr || result.stdout);
  return result;
}

function fakeToolOps({ platform = 'darwin', commands = [], paths = [], installSucceeds = true } = {}) {
  const commandSet = new Set(commands);
  const pathSet = new Set(paths);
  const calls = [];
  return {
    platform,
    env: {},
    calls,
    commandExists: (cmd) => commandSet.has(cmd),
    pathExists: (value) => pathSet.has(value),
    runOptional: (cmd, args) => {
      calls.push(['optional', cmd, ...args]);
      if (/^python3(\.\d+)?$/.test(cmd) && args.join(' ').includes('sys.version_info')) return cmd === 'python3.14' ? '3.14' : '3.11';
      if (/^python3(\.\d+)?$/.test(cmd) && args.join(' ').includes('import graphify') && commandSet.has('graphify')) return 'ok';
      return null;
    },
    run: (cmd, args) => {
      calls.push([cmd, ...args]);
      if (!installSucceeds) throw new Error(`${cmd} failed in fake tool setup`);
      if (cmd === 'pipx' && args.includes('graphifyy==0.1.14')) commandSet.add('graphify');
      if (cmd === 'brew' && args.includes('ffmpeg')) {
        commandSet.add('ffmpeg');
        commandSet.add('ffprobe');
      }
      if ((cmd === 'brew' && args.includes('yt-dlp')) || (cmd === 'pipx' && args.includes('yt-dlp'))) {
        commandSet.add('yt-dlp');
      }
      if (cmd === 'npx' && args.includes('chromium')) commandSet.add('chromium');
      return '';
    }
  };
}

function collectInvalidCommandHooks(settings, file) {
  const invalid = [];
  for (const [event, groups] of Object.entries(settings.hooks || {})) {
    if (!Array.isArray(groups)) continue;
    groups.forEach((group, groupIndex) => {
      if (typeof group.matcher !== 'string') invalid.push(`${file}:${event}[${groupIndex}] missing string matcher`);
      for (const [hookIndex, hook] of (group.hooks || []).entries()) {
        if (hook?.type === 'command' && typeof hook.command !== 'string') {
          invalid.push(`${file}:${event}[${groupIndex}].hooks[${hookIndex}] missing command`);
        }
      }
    });
  }
  return invalid;
}

function countWorkflowHookGroups(settings) {
  const counts = {};
  for (const [event, groups] of Object.entries(settings.hooks || {})) {
    counts[event] = (groups || []).filter((group) => (group.hooks || []).some((hook) => installer.isWorkflowCommand(hook.command) || /^(overdrive|agentic-supercharge)-/.test(hook.name || ''))).length;
  }
  return counts;
}

function seedLegacyWorkflowHooks(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({
    hooks: {
      SessionStart: [
        { matcher: 'startup|resume|clear', hooks: [{ type: 'command', command: "node '/tmp/.agentic-supercharge/runtime/current/bin/agentic-supercharge.js' hook --target 'claude' --event session-start" }] },
        { matcher: 'startup|resume|clear', hooks: [{ type: 'command', command: "node '/tmp/.overdrive/runtime/current/bin/overdrive.js' hook --target 'claude' --event session-start" }] }
      ],
      UserPromptSubmit: [
        { matcher: '', hooks: [{ type: 'command', command: "node '/tmp/.agentic-supercharge/runtime/current/bin/agentic-supercharge.js' hook --target 'claude' --event prompt-submit" }] }
      ],
      PostToolUse: [
        { matcher: 'Edit|Write', hooks: [{ type: 'command', command: "node '/tmp/.overdrive/runtime/current/bin/overdrive.js' hook --target 'claude' --event post-tool-use" }] }
      ],
      PreToolUse: [
        { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo user hook' }] }
      ]
    }
  }, null, 2)}\n`);
}

const skillFixtureHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ovd-skill-fixture-home-'));
const skillFixtureCtx = installer.createContext({ dryRun: false, allowUpstreamDrift: false, conflict: 'preserve' }, { HOME: skillFixtureHome, OVERDRIVE_KIT_DIR: path.resolve(__dirname, '..') });
const skillFixturePlan = {
  skillTargets: [{
    key: 'fixture',
    label: 'Fixture',
    scope: 'local',
    skillRootAbs: path.join(skillFixtureHome, 'skills')
  }],
  instructions: []
};
const lowerSkillSrc = fs.mkdtempSync(path.join(os.tmpdir(), 'ovd-lower-skill-'));
fs.writeFileSync(path.join(lowerSkillSrc, 'skill.md'), '---\nname: graphify\ndescription: Fixture graph skill.\n---\n\n# Graphify\n');
installer.copySkill(skillFixtureCtx, { dryRun: false, conflict: 'preserve' }, skillFixturePlan, lowerSkillSrc, 'graphify', 'fixture-source', 'skill.md', { skillFile: 'skill.md' });
const installedGraphifyDir = path.join(skillFixtureHome, 'skills/graphify');
check('lowercase skill.md installs as exact SKILL.md directory entry', fs.readdirSync(installedGraphifyDir).includes('SKILL.md') && !fs.readdirSync(installedGraphifyDir).includes('skill.md'));

const videoSkillSrc = fs.mkdtempSync(path.join(os.tmpdir(), 'ovd-claude-video-skill-'));
fs.mkdirSync(path.join(videoSkillSrc, 'scripts'), { recursive: true });
fs.mkdirSync(path.join(videoSkillSrc, 'commands'), { recursive: true });
fs.mkdirSync(path.join(videoSkillSrc, '.claude-plugin'), { recursive: true });
fs.mkdirSync(path.join(videoSkillSrc, '.codex-plugin'), { recursive: true });
fs.writeFileSync(path.join(videoSkillSrc, 'SKILL.md'), `---
name: watch
description: Fixture video skill.
allowed-tools: Bash, Read, AskUserQuestion
---

# Watch

## Step 0

Run installer. AskUserQuestion may write it into \`~/.config/watch/.env\`.

## When to use

Use for video comprehension.

- **Setup preflight failed** -> Run \`python3 {setup_py}\` to enable Whisper, then re-run._
- **Other** -> continue.
`);
fs.writeFileSync(path.join(videoSkillSrc, 'scripts/setup.py'), 'import subprocess\nsubprocess.run(cmd)\n');
fs.writeFileSync(path.join(videoSkillSrc, 'scripts/build-skill.sh'), 'zip -d watch/.claude-plugin/* watch/commands/*\n');
fs.writeFileSync(path.join(videoSkillSrc, 'commands/watch.md'), 'allowed-tools: [Bash, Read, AskUserQuestion]\n');
fs.writeFileSync(path.join(videoSkillSrc, '.claude-plugin/plugin.json'), '{}\n');
fs.writeFileSync(path.join(videoSkillSrc, '.codex-plugin/plugin.json'), '{}\n');
fs.writeFileSync(path.join(videoSkillSrc, '.gitattributes'), 'commands/ .claude-plugin/ .codex-plugin/\n');
fs.writeFileSync(path.join(videoSkillSrc, 'CHANGELOG.md'), 'Run installer and AskUserQuestion were used upstream.\n');
fs.writeFileSync(path.join(videoSkillSrc, 'README.md'), 'Run installer and write it into `~/.config/watch/.env`.\n');
installer.copySkill(skillFixtureCtx, { dryRun: false, conflict: 'preserve' }, skillFixturePlan, videoSkillSrc, 'claude-video', 'fixture-source', '.', { transforms: ['agentic-claude-video-safe'] });
const installedVideoDir = path.join(skillFixtureHome, 'skills/claude-video');
const installedVideoFiles = fs.readdirSync(installedVideoDir);
const installedVideoText = fs.readFileSync(path.join(installedVideoDir, 'SKILL.md'), 'utf8');
const installedSetupText = fs.readFileSync(path.join(installedVideoDir, 'scripts/setup.py'), 'utf8');
check('claude-video transform strips nested command/plugin payloads', !installedVideoFiles.includes('commands') && !installedVideoFiles.includes('.claude-plugin') && !installedVideoFiles.includes('.codex-plugin') && !installedVideoFiles.includes('.gitattributes') && !installedVideoFiles.includes('CHANGELOG.md') && !installedVideoFiles.includes('README.md') && !fs.existsSync(path.join(installedVideoDir, 'scripts/build-skill.sh')));
check('claude-video transform removes unsafe setup strings from installed files', !/AskUserQuestion|Run installer|write it into\s+`~\/\.config\/watch\/\.env`|subprocess\.run\(cmd\)/.test(`${installedVideoText}\n${installedSetupText}`));

const noToolProject = tempProject('ovd-no-tool-install');
const noToolResult = runNode([
  'bin/overdrive.js',
  '--scope', 'local',
  '--project-dir', noToolProject,
  '--skills', 'graphify,design-extract,claude-video,media-download',
  '--no-tool-install',
  '--dry-run',
  '--yes'
], { HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'ovd-no-tool-home-')), OVERDRIVE_KIT_DIR: path.resolve(__dirname, '..') });
check('--no-tool-install emits no external installer command plan', !/\bnpx\b|\bpipx\b|\bbrew\b|\bwinget\b/.test(noToolResult.stdout));

const dryProject = tempProject('ovd-workflow-dry');
workflow.resync({ projectDir: dryProject, apply: false });
check('resync dry-run does not initialize workflow', !fs.existsSync(path.join(dryProject, '.overdrive')));

const project = tempProject('ovd-workflow');
const init = workflow.initWorkflow({ projectDir: project, reason: 'test' });
check('init creates workflow', fs.existsSync(path.join(project, '.overdrive')));
check('init creates config', fs.existsSync(path.join(project, '.overdrive/config.json')));
check('init creates preferences tracker', fs.existsSync(path.join(project, '.overdrive/preferences.md')));
check('init creates research log', fs.existsSync(path.join(project, '.overdrive/research.md')));
check('init creates knowledge vault', fs.existsSync(path.join(project, '.overdrive/knowledge')));
check('init creates knowledge index', fs.existsSync(path.join(project, '.overdrive/knowledge-index.json')));
check('config includes knowledge autosummarize default', JSON.parse(fs.readFileSync(path.join(project, '.overdrive/config.json'), 'utf8')).knowledge_autosummarize === 'ask');
check('research log includes objectivity mandate', fs.readFileSync(path.join(project, '.overdrive/research.md'), 'utf8').includes('objective, evidence-based standpoint'));
check('preferences tracker includes do-not guidance', fs.readFileSync(path.join(project, '.overdrive/preferences.md'), 'utf8').includes('do-not rules'));
check('init gitignores workflow', fs.readFileSync(path.join(project, '.gitignore'), 'utf8').includes('.overdrive/'));
check('init gitignores legacy workflow for migration safety', fs.readFileSync(path.join(project, '.gitignore'), 'utf8').includes('.agenticsupercharge/'));

const legacyProject = tempProject('ovd-workflow-legacy');
fs.mkdirSync(path.join(legacyProject, '.agenticsupercharge'), { recursive: true });
fs.writeFileSync(path.join(legacyProject, '.agenticsupercharge/state.md'), '# Legacy State\n\nCurrent focus: migrate.\n');
fs.writeFileSync(path.join(legacyProject, '.agenticsupercharge/.agentic-supercharge.json'), '{"managedBy":"AgenticSupercharge"}\n');
const legacyStatus = workflow.status({ projectDir: legacyProject });
check('status does not silently migrate legacy workflow', legacyStatus.legacyAvailable === true && !fs.existsSync(path.join(legacyProject, '.overdrive')));
const legacyDoctor = workflow.doctor({ projectDir: legacyProject });
check('doctor reports legacy compatibility without blocking issue', legacyDoctor.legacyCompatible === true && legacyDoctor.issues.length === 0 && legacyDoctor.recommendations.length === 1);
const legacyMigrateDry = workflow.migrate({ projectDir: legacyProject, apply: false });
check('migrate defaults to dry-run', legacyMigrateDry.dryRun === true && legacyMigrateDry.migrated === true && !fs.existsSync(path.join(legacyProject, '.overdrive')));
const legacyInit = workflow.initWorkflow({ projectDir: legacyProject, reason: 'legacy migration' });
check('init migrates legacy workflow copy', legacyInit.migration?.migrated === true && fs.existsSync(path.join(legacyProject, '.overdrive/state.md')));
check('legacy workflow remains after migration', fs.existsSync(path.join(legacyProject, '.agenticsupercharge/state.md')));
check('migration writes new marker', fs.existsSync(path.join(legacyProject, '.overdrive/.overdrive.json')));
const legacyGitignore = fs.readFileSync(path.join(legacyProject, '.gitignore'), 'utf8');
check('migration gitignores both workflow folders', legacyGitignore.includes('.overdrive/') && legacyGitignore.includes('.agenticsupercharge/'));

const knowledgeDir = path.join(project, '.overdrive/knowledge');
fs.writeFileSync(path.join(knowledgeDir, 'brief.md'), '# Brief\n\nA short project reference.\n');
fs.writeFileSync(path.join(knowledgeDir, 'data.csv'), 'name,value\nalpha,1\n');
const knowledgeDryRun = workflow.knowledge({ projectDir: project, apply: false });
check('knowledge dry-run scans vault without writing', knowledgeDryRun.trackedKnowledge === 2 && JSON.parse(fs.readFileSync(path.join(project, '.overdrive/knowledge-index.json'), 'utf8')).files.length === 0);
const knowledgeApply = workflow.knowledge({ projectDir: project, apply: true });
const knowledgeIndex = JSON.parse(fs.readFileSync(path.join(project, '.overdrive/knowledge-index.json'), 'utf8'));
check('knowledge apply indexes vault files', knowledgeApply.trackedKnowledge === 2 && knowledgeIndex.files.length === 2);
check('knowledge index records markdown cache for csv fallback', knowledgeIndex.files.some((entry) => entry.path.endsWith('data.csv') && entry.markdownCache && entry.conversionStatus === 'converted'));

const researchPath = path.join(project, '.overdrive/research.md');
fs.rmSync(researchPath);
const missingResearch = workflow.doctor({ projectDir: project });
check('doctor detects missing research log', missingResearch.issues.some((issue) => issue.includes('research.md')));
workflow.initWorkflow({ projectDir: project, reason: 'restore research' });
check('init restores missing research log without overwriting other workflow files', fs.existsSync(researchPath));

const preferencesPath = path.join(project, '.overdrive/preferences.md');
fs.rmSync(preferencesPath);
const missingPreferences = workflow.doctor({ projectDir: project });
check('doctor detects missing preferences tracker', missingPreferences.issues.some((issue) => issue.includes('preferences.md')));
workflow.initWorkflow({ projectDir: project, reason: 'restore preferences' });
check('init restores missing preferences tracker without overwriting other workflow files', fs.existsSync(preferencesPath));

fs.writeFileSync(path.join(project, '.DS_Store'), 'finder noise');
fs.writeFileSync(path.join(project, 'sources.lock.json'), '{"local":"install metadata"}\n');
fs.mkdirSync(path.join(project, 'nested/.overdrive'), { recursive: true });
fs.writeFileSync(path.join(project, 'nested/.overdrive/state.md'), '# nested state\n');
workflow.resync({ projectDir: project, apply: true });
const indexedAfterDsStore = JSON.parse(fs.readFileSync(path.join(project, '.overdrive/file-index.json'), 'utf8'));
check('resync ignores .DS_Store files', !indexedAfterDsStore.files.some((entry) => entry.path.endsWith('.DS_Store')));
check('resync ignores sources.lock.json install metadata', !indexedAfterDsStore.files.some((entry) => entry.path === 'sources.lock.json'));
check('resync ignores nested ovd-workflow folders', !indexedAfterDsStore.files.some((entry) => entry.path.includes('/.overdrive/')));

const status = workflow.status({ projectDir: project });
check('status reports initialized', status.initialized === true);

const resync = workflow.resync({ projectDir: project, apply: true });
check('resync apply tracks files', resync.trackedFiles > 0);
check('resync apply refreshes knowledge index', resync.knowledge && resync.knowledge.trackedKnowledge === 2);
check('resync writes file-index', JSON.parse(fs.readFileSync(path.join(project, '.overdrive/file-index.json'), 'utf8')).files.length > 0);

const cachePath = path.join(project, knowledgeIndex.files.find((entry) => entry.path.endsWith('data.csv')).markdownCache);
fs.rmSync(cachePath);
const missingKnowledgeCache = workflow.doctor({ projectDir: project });
check('doctor detects missing knowledge markdown cache', missingKnowledgeCache.issues.some((issue) => issue.includes('Knowledge markdown cache is missing')));
workflow.knowledge({ projectDir: project, apply: true });

fs.writeFileSync(path.join(project, 'index.js'), 'console.log("changed")\n');
const doctor = workflow.doctor({ projectDir: project });
check('doctor detects stale hash', doctor.issues.some((issue) => issue.includes('index.js')));

const checkpoint = workflow.checkpoint({ projectDir: project, message: 'test checkpoint' });
check('checkpoint creates handoff file', fs.existsSync(checkpoint.file));

const route = workflow.recordRoute({ projectDir: project, skills: 'planning-first,playwright-cli', reason: 'test route' });
check('route is recorded', route.ok === true && fs.readFileSync(path.join(project, '.overdrive/routes.jsonl'), 'utf8').includes('planning-first'));

const usageConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ovd-workflow-usage-claude-'));
const usageCodexHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ovd-workflow-usage-codex-'));
const usageProject = tempProject('ovd-workflow-usage');
workflow.initWorkflow({ projectDir: usageProject, reason: 'usage test' });
const usageNow = new Date().toISOString();
fs.writeFileSync(
  path.join(usageProject, '.overdrive/routes.jsonl'),
  `${JSON.stringify({ ts: usageNow, skills: ['prompt-master'], reason: 'usage test' })}\n`
);
const claudeLogDir = path.join(usageConfigDir, 'projects', '-tmp-ovd-workflow-usage');
fs.mkdirSync(claudeLogDir, { recursive: true });
fs.writeFileSync(path.join(claudeLogDir, 'session.jsonl'), [
  '{malformed json',
  JSON.stringify({
    type: 'user',
    timestamp: usageNow,
    cwd: usageProject,
    sessionId: 'usage-session',
    message: { role: 'user', content: 'SECRET PROMPT CONTENT SHOULD NOT PRINT' }
  }),
  JSON.stringify({
    type: 'assistant',
    timestamp: usageNow,
    cwd: usageProject,
    sessionId: 'usage-session',
    message: {
      role: 'assistant',
      model: 'claude-test',
      content: [{ type: 'tool_use', name: 'Bash' }],
      usage: {
        input_tokens: 100,
        output_tokens: 20,
        cache_read_input_tokens: 40,
        cache_creation_input_tokens: 10
      }
    }
  })
].join('\n'));
const usage = workflow.usage({
  projectDir: usageProject,
  days: 1,
  env: { ...process.env, CLAUDE_CONFIG_DIR: usageConfigDir, CODEX_HOME: usageCodexHome }
});
const usageText = workflow.formatUsage(usage);
check('usage aggregates Claude Code token totals', usage.totals.total === 170 && usage.totals.input === 100 && usage.totals.output === 20);
check('usage records cache-hit percentage', usage.cacheHitPercent === 28.6);
check('usage records top tool without prompt content', usage.topTools.some((entry) => entry.name === 'Bash') && !usageText.includes('SECRET PROMPT CONTENT'));
check('usage attributes tokens to route skills when timestamps match', usage.bySkill.some((entry) => entry.name === 'prompt-master' && entry.total === 170));
const emptyUsage = workflow.usage({
  projectDir: usageProject,
  days: 1,
  env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(usageConfigDir, 'missing'), CODEX_HOME: usageCodexHome }
});
check('usage degrades cleanly when logs are absent', emptyUsage.ok === true && emptyUsage.totals.total === 0 && workflow.formatUsage(emptyUsage).includes('No Claude Code token usage entries'));

const toolHome = fs.mkdtempSync(path.join(os.tmpdir(), 'as-tool-home-'));
const toolCtx = installer.createContext({ dryRun: false, allowUpstreamDrift: false, conflict: 'preserve' }, { HOME: toolHome });
const toolPlan = { skillTargets: [], instructions: [] };
const selectedToolOptions = {
  dryRun: false,
  noToolInstall: false,
  skipUpstream: false,
  selectedSkillNames: new Set(['graphify', 'design-extract', 'claude-video', 'media-download'])
};
const successOps = fakeToolOps({ commands: ['python3.12', 'pipx', 'brew', 'npx'] });
const successSetup = installer.setupOptionalTools(toolCtx, selectedToolOptions, toolPlan, successOps);
check('optional tool setup can install selected tool helpers', successSetup.every((item) => ['installed', 'present'].includes(item.status)));
check('optional tool setup invokes no sudo command', !successOps.calls.some((call) => call[0] === 'sudo'));
check('optional tool setup never invokes global pip directly', !successOps.calls.some((call) => /^pip3?$/.test(call[0]) || call.includes('--break-system-packages')));

const fallbackOps = fakeToolOps({ platform: 'linux', commands: [] });
const fallbackSetup = installer.setupOptionalTools(toolCtx, selectedToolOptions, toolPlan, fallbackOps);
check('optional tool setup falls back when package managers are absent', fallbackSetup.every((item) => item.status === 'fallback' && item.manualCommand));

const tooNewPythonOps = fakeToolOps({ commands: ['python3.14'] });
const tooNewPythonSetup = installer.setupOptionalTools(toolCtx, { ...selectedToolOptions, selectedSkillNames: new Set(['graphify']) }, toolPlan, tooNewPythonOps);
check('Graphify setup avoids too-new Python when pinned deps are incompatible', tooNewPythonSetup[0].status === 'fallback' && /Python 3\.10-3\.12/.test(tooNewPythonSetup[0].reason));

const skipSetup = installer.setupOptionalTools(toolCtx, { ...selectedToolOptions, noToolInstall: true }, toolPlan, fakeToolOps());
check('optional tool setup respects --no-tool-install', skipSetup.every((item) => item.status === 'skipped'));

const drySetup = installer.setupOptionalTools(toolCtx, { ...selectedToolOptions, dryRun: true }, toolPlan, fakeToolOps());
check('optional tool setup dry-run writes no installs', drySetup.every((item) => item.status === 'would-attempt'));

const decision = workflow.recordDecision({ projectDir: project, decision: 'Use compact dashboard cards by default.', rationale: 'User preference' });
check('decision is recorded', decision.ok === true && fs.readFileSync(path.join(project, '.overdrive/decisions.md'), 'utf8').includes('Use compact dashboard cards by default.'));
const contradiction = workflow.recordDecision({
  projectDir: project,
  decision: 'Use oversized dashboard cards by default.',
  contradicts: 'Use compact dashboard cards by default.'
});
const decisionsText = fs.readFileSync(path.join(project, '.overdrive/decisions.md'), 'utf8');
check('decision helper flags possible contradiction before overwriting', contradiction.needsConfirmation === true && !decisionsText.includes('Use oversized dashboard cards by default.'));

const disabledProject = tempProject('ovd-workflow-disabled');
const hook = workflow.hook({
  projectDir: disabledProject,
  event: 'prompt-submit',
  target: 'claude',
  stdin: JSON.stringify({ cwd: disabledProject, prompt: 'Build a reasonably complex feature and verify it.' }),
  env: { ...process.env, OVERDRIVE_WORKFLOW: 'disabled' }
});
check('disabled hook does not initialize workflow', hook.disabled === true && !fs.existsSync(path.join(disabledProject, '.overdrive')));

const legacyDisabledProject = tempProject('ovd-workflow-legacy-disabled');
const legacyDisabledHook = workflow.hook({
  projectDir: legacyDisabledProject,
  event: 'prompt-submit',
  target: 'claude',
  stdin: JSON.stringify({ cwd: legacyDisabledProject, prompt: 'Build a reasonably complex feature and verify it.' }),
  env: { ...process.env, AGENTIC_SUPERCHARGE_WORKFLOW: 'disabled' }
});
check('legacy disabled env still disables workflow', legacyDisabledHook.disabled === true && !fs.existsSync(path.join(legacyDisabledProject, '.overdrive')));

const disabledCheckpointProject = tempProject('ovd-workflow-disabled-checkpoint');
const disabledCheckpoint = workflow.checkpoint({
  projectDir: disabledCheckpointProject,
  message: 'disabled checkpoint',
  env: { ...process.env, OVERDRIVE_WORKFLOW: 'disabled' }
});
check('disabled checkpoint does not initialize workflow', disabledCheckpoint.disabled === true && !fs.existsSync(path.join(disabledCheckpointProject, '.overdrive')));

const disabledRouteProject = tempProject('ovd-workflow-disabled-route');
workflow.initWorkflow({ projectDir: disabledRouteProject, reason: 'route test' });
const disabledRoute = workflow.recordRoute({
  projectDir: disabledRouteProject,
  skills: 'planning-first',
  reason: 'disabled route',
  env: { ...process.env, OVERDRIVE_WORKFLOW: 'disabled' }
});
check('disabled route does not write route trace', disabledRoute.disabled === true && fs.readFileSync(path.join(disabledRouteProject, '.overdrive/routes.jsonl'), 'utf8') === '');

const runtimeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ovd-workflow-runtime-home-'));
const retiredSkill = path.join(runtimeHome, '.claude/skills/video-downloader');
fs.mkdirSync(retiredSkill, { recursive: true });
fs.writeFileSync(path.join(retiredSkill, '.overdrive.json'), '{"managedBy":"Overdrive"}\n');
seedLegacyWorkflowHooks(path.join(runtimeHome, '.claude/settings.json'));
seedLegacyWorkflowHooks(path.join(runtimeHome, '.codex/hooks.json'));
runNode([
  'bin/overdrive.js',
  '--scope', 'global',
  '--tools', 'claude,codex,gemini,antigravity,cursor,agents',
  '--force-targets',
  '--skip-upstream',
  '--skip-official-installers',
  '--skills', 'skill-router,media-download',
  '--yes'
], { HOME: runtimeHome, OVERDRIVE_KIT_DIR: path.resolve(__dirname, '..') });
runNode([
  'bin/overdrive.js',
  '--scope', 'global',
  '--tools', 'claude,codex,gemini,antigravity,cursor,agents',
  '--force-targets',
  '--skip-upstream',
  '--skip-official-installers',
  '--skills', 'skill-router,media-download',
  '--yes'
], { HOME: runtimeHome, OVERDRIVE_KIT_DIR: path.resolve(__dirname, '..') });
check('retired managed skills are pruned', !fs.existsSync(retiredSkill));

const hookSettings = [
  '.claude/settings.json',
  '.codex/hooks.json',
  '.gemini/settings.json',
  '.gemini/config/settings.json'
];
for (const rel of hookSettings) {
  const file = path.join(runtimeHome, rel);
  check(`${rel} exists after runtime install`, fs.existsSync(file));
  if (!fs.existsSync(file)) continue;
  const invalid = collectInvalidCommandHooks(JSON.parse(fs.readFileSync(file, 'utf8')), rel);
  check(`${rel} has valid command hook schema`, invalid.length === 0, invalid.join(', '));
  const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
  const counts = countWorkflowHookGroups(settings);
  for (const event of rel.includes('.gemini') ? ['SessionStart', 'BeforeAgent', 'AfterTool'] : ['SessionStart', 'UserPromptSubmit', 'PostToolUse']) {
    check(`${rel} has exactly one managed workflow hook group for ${event}`, counts[event] === 1, JSON.stringify(counts));
  }
  check(`${rel} has no legacy agentic-supercharge hook commands`, !JSON.stringify(settings).includes('agentic-supercharge'));
}
check('Cursor receives rule fallback only', fs.existsSync(path.join(runtimeHome, '.cursor/rules/overdrive-workflow.mdc')) && !fs.existsSync(path.join(runtimeHome, '.cursor/settings.json')));
for (const name of ['ovd-status', 'ovd-resync', 'ovd-knowledge', 'ovd-doctor', 'ovd-checkpoint', 'ovd-usage', 'as-status', 'as-resync', 'as-knowledge', 'as-doctor', 'as-checkpoint', 'as-usage']) {
  check(`Claude command ${name} exists`, fs.existsSync(path.join(runtimeHome, `.claude/commands/${name}.md`)));
}
check('new overdrive shim exists', fs.existsSync(path.join(runtimeHome, '.overdrive/bin/overdrive')));
check('ovd shim exists', fs.existsSync(path.join(runtimeHome, '.overdrive/bin/ovd')));
check('legacy CLI shim delegates to Overdrive runtime', fs.existsSync(path.join(runtimeHome, '.agentic-supercharge/bin/agentic-supercharge')) && fs.readFileSync(path.join(runtimeHome, '.agentic-supercharge/bin/agentic-supercharge'), 'utf8').includes('Overdrive managed legacy CLI shim'));
const runtimeVersionDir = path.join(runtimeHome, '.overdrive/runtime/1.0.0');
const legacyRuntimeCurrent = path.join(runtimeHome, '.agentic-supercharge/runtime/current');
check('legacy runtime current delegates to Overdrive runtime', fs.existsSync(path.join(legacyRuntimeCurrent, 'bin/agentic-supercharge.js')) && fs.realpathSync(legacyRuntimeCurrent).includes(`${path.sep}.overdrive${path.sep}runtime${path.sep}`));
check('runtime payload includes manifest', fs.existsSync(path.join(runtimeVersionDir, 'manifest.json')));
check('runtime payload includes local skills', fs.existsSync(path.join(runtimeVersionDir, 'skills/skill-router/SKILL.md')));
check('runtime payload includes global instructions', fs.existsSync(path.join(runtimeVersionDir, 'global-instructions/AGENTS.md')));
check('runtime payload excludes workflow state', !fs.existsSync(path.join(runtimeVersionDir, '.overdrive')) && !fs.existsSync(path.join(runtimeVersionDir, '.agenticsupercharge')));
const runtimeHelp = runCommand(path.join(runtimeHome, '.overdrive/bin/overdrive'), ['--help']);
check('runtime overdrive shim prints help', runtimeHelp.stdout.includes('Overdrive') && runtimeHelp.stdout.includes('Usage:'));
const runtimeAliasHelp = runCommand(path.join(runtimeHome, '.overdrive/bin/ovd'), ['--help']);
check('runtime ovd shim prints help', runtimeAliasHelp.stdout.includes('Overdrive') && runtimeAliasHelp.stdout.includes('Usage:'));

const uninstallHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ovd-uninstall-home-'));
fs.mkdirSync(path.join(uninstallHome, '.overdrive/tools/graphify-venv'), { recursive: true });
fs.mkdirSync(path.join(uninstallHome, '.overdrive/bin'), { recursive: true });
fs.writeFileSync(path.join(uninstallHome, '.overdrive/bin/graphify'), '#!/usr/bin/env bash\nexec /tmp/.overdrive/tools/graphify-venv/bin/graphify "$@"\n');
fs.writeFileSync(path.join(uninstallHome, '.overdrive/bin/yt-dlp'), '#!/usr/bin/env bash\nexec /tmp/.overdrive/tools/yt-dlp-venv/bin/yt-dlp "$@"\n');
runNode([
  'bin/overdrive.js',
  'uninstall',
  '--scope', 'global',
  '--tools', 'claude',
  '--force-targets',
  '--yes'
], { HOME: uninstallHome, OVERDRIVE_KIT_DIR: path.resolve(__dirname, '..') });
check('uninstall removes managed helper tools', !fs.existsSync(path.join(uninstallHome, '.overdrive/tools')));
check('uninstall removes managed helper shims', !fs.existsSync(path.join(uninstallHome, '.overdrive/bin/graphify')) && !fs.existsSync(path.join(uninstallHome, '.overdrive/bin/yt-dlp')));

if (failures.length) {
  console.error(`ovd-workflow tests failed (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('ovd-workflow tests passed');
