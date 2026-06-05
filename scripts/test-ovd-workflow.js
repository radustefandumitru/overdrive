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
}
check('Cursor receives rule fallback only', fs.existsSync(path.join(runtimeHome, '.cursor/rules/overdrive-workflow.mdc')) && !fs.existsSync(path.join(runtimeHome, '.cursor/settings.json')));
for (const name of ['ovd-status', 'ovd-resync', 'ovd-knowledge', 'ovd-doctor', 'ovd-checkpoint', 'ovd-usage', 'as-status', 'as-resync', 'as-knowledge', 'as-doctor', 'as-checkpoint', 'as-usage']) {
  check(`Claude command ${name} exists`, fs.existsSync(path.join(runtimeHome, `.claude/commands/${name}.md`)));
}
check('new overdrive shim exists', fs.existsSync(path.join(runtimeHome, '.overdrive/bin/overdrive')));
check('ovd shim exists', fs.existsSync(path.join(runtimeHome, '.overdrive/bin/ovd')));
check('legacy CLI shim delegates to Overdrive runtime', fs.existsSync(path.join(runtimeHome, '.agentic-supercharge/bin/agentic-supercharge')) && fs.readFileSync(path.join(runtimeHome, '.agentic-supercharge/bin/agentic-supercharge'), 'utf8').includes('Overdrive managed legacy CLI shim'));
const runtimeVersionDir = path.join(runtimeHome, '.overdrive/runtime/1.0.0');
check('runtime payload includes manifest', fs.existsSync(path.join(runtimeVersionDir, 'manifest.json')));
check('runtime payload includes local skills', fs.existsSync(path.join(runtimeVersionDir, 'skills/skill-router/SKILL.md')));
check('runtime payload includes global instructions', fs.existsSync(path.join(runtimeVersionDir, 'global-instructions/AGENTS.md')));
check('runtime payload excludes workflow state', !fs.existsSync(path.join(runtimeVersionDir, '.overdrive')) && !fs.existsSync(path.join(runtimeVersionDir, '.agenticsupercharge')));
const runtimeHelp = runCommand(path.join(runtimeHome, '.overdrive/bin/overdrive'), ['--help']);
check('runtime overdrive shim prints help', runtimeHelp.stdout.includes('Overdrive') && runtimeHelp.stdout.includes('Usage:'));
const runtimeAliasHelp = runCommand(path.join(runtimeHome, '.overdrive/bin/ovd'), ['--help']);
check('runtime ovd shim prints help', runtimeAliasHelp.stdout.includes('Overdrive') && runtimeAliasHelp.stdout.includes('Usage:'));

if (failures.length) {
  console.error(`ovd-workflow tests failed (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('ovd-workflow tests passed');
