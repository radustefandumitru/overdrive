const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline/promises');
const { spawnSync } = require('child_process');
const ovdWorkflow = require('./ovd-workflow');

const managedBlockStart = '<!-- overdrive:global-guidelines:start -->';
const managedBlockEnd = '<!-- overdrive:global-guidelines:end -->';
const markerFile = '.overdrive.json';
const backupRootName = '.overdrive';
const managedTextNamespace = 'overdrive:managed';
const defaultConflict = 'preserve';
const publicRepoUrl = 'https://github.com/radustefandumitru/overdrive.git';
const graphifyPackageSpec = 'graphifyy==0.1.14';
const validConflicts = new Set(['preserve', 'backup-and-replace', 'replace-managed-only', 'force']);
const validScopes = new Set(['global', 'local']);
const workflowCommands = new Set(['status', 'resync', 'knowledge', 'doctor', 'checkpoint', 'hook', 'route', 'usage', 'plan', 'go', 'log', 'workflow']);
const ovdPlanCommands = new Set(['plan', 'go', 'log', 'workflow']);

const targetDefs = {
  claude: {
    label: 'Claude Code',
    kind: 'agent',
    globalSkillRoot: '$HOME/.claude/skills',
    globalInstruction: { from: 'global-instructions/CLAUDE.md', to: '$HOME/.claude/CLAUDE.md' },
    configDir: '$HOME/.claude',
    workflow: {
      settings: '$HOME/.claude/settings.json',
      commandsDir: '$HOME/.claude/commands',
      hookStyle: 'claude',
      statusLine: true,
    },
    detect: (ctx) => [
      commandExists('claude'),
      pathExists('/Applications/Claude.app'),
      pathExists(resolvePath('$HOME/.claude', ctx))
    ]
  },
  codex: {
    label: 'Codex',
    kind: 'agent',
    globalSkillRoot: '$HOME/.codex/skills',
    globalInstruction: { from: 'global-instructions/AGENTS.md', to: '$HOME/.codex/AGENTS.md' },
    configDir: '$HOME/.codex',
    workflow: {
      settings: '$HOME/.codex/hooks.json',
      rulesDir: '$HOME/.codex/rules',
      hookStyle: 'codex',
      statusLine: false,
    },
    detect: (ctx) => [
      commandExists('codex'),
      pathExists('/Applications/Codex.app'),
      pathExists(resolvePath('$HOME/.codex', ctx))
    ]
  },
  gemini: {
    label: 'Gemini CLI',
    kind: 'agent',
    globalSkillRoot: '$HOME/.gemini/skills',
    globalInstruction: { from: 'global-instructions/GEMINI.md', to: '$HOME/.gemini/GEMINI.md' },
    configDir: '$HOME/.gemini',
    workflow: {
      settings: '$HOME/.gemini/settings.json',
      commandsDir: '$HOME/.gemini/commands',
      hookStyle: 'gemini',
      statusLine: false,
    },
    detect: (ctx) => [
      commandExists('gemini'),
      pathExists(resolvePath('$HOME/.gemini/skills', ctx))
    ]
  },
  antigravity: {
    label: 'Antigravity',
    kind: 'agent',
    globalSkillRoot: '$HOME/.gemini/config/skills',
    globalInstruction: { from: 'global-instructions/GEMINI.md', to: '$HOME/.gemini/GEMINI.md' },
    configDir: '$HOME/.gemini/config',
    workflow: {
      settings: '$HOME/.gemini/config/settings.json',
      commandsDir: '$HOME/.gemini/config/commands',
      hookStyle: 'gemini',
      statusLine: false,
    },
    detect: () => [
      pathExists('/Applications/Antigravity.app'),
      pathExists('/Applications/Antigravity IDE.app')
    ]
  },
  cursor: {
    label: 'Cursor',
    kind: 'agent',
    globalSkillRoot: '$HOME/.cursor/skills',
    workflow: {
      rulesDir: '$HOME/.cursor/rules',
      hookStyle: 'cursor-rules',
      statusLine: false,
    },
    detect: () => [
      commandExists('cursor-agent'),
      commandExists('cursor'),
      pathExists('/Applications/Cursor.app')
    ]
  },
  agents: {
    label: 'Shared .agents root',
    kind: 'shared',
    globalSkillRoot: '$HOME/.agents/skills',
    detect: (ctx) => [
      pathExists(resolvePath('$HOME/.agents', ctx)),
      pathExists(resolvePath('$HOME/.agents/skills', ctx))
    ]
  }
};

const localSkillTargets = [
  {
    key: 'local-agents',
    label: 'Project .agents',
    skillRoot: '.agents/skills',
    scope: 'local',
  },
  {
    key: 'local-cursor',
    label: 'Project Cursor',
    skillRoot: '.cursor/skills',
    scope: 'local',
  }
];

const localInstructionFiles = [
  { key: 'local-agents-instructions', from: 'global-instructions/AGENTS.md', to: 'AGENTS.md', label: 'Project AGENTS.md' },
  { key: 'local-claude-instructions', from: 'global-instructions/CLAUDE.md', to: 'CLAUDE.md', label: 'Project CLAUDE.md' },
  { key: 'local-gemini-instructions', from: 'global-instructions/GEMINI.md', to: 'GEMINI.md', label: 'Project GEMINI.md' }
];

function main(argv = process.argv.slice(2), env = process.env) {
  return runCli(argv, env).catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}

async function runCli(argv, env) {
  const parsed = parseArgs(argv);
  if (workflowCommands.has(parsed.command)) {
    await runWorkflowCommand(parsed.command, parsed.options, env);
    return;
  }
  const ctx = createContext(parsed.options, env);
  if (parsed.command === 'help') {
    printHelp();
    return;
  }
  if (parsed.command === 'list-targets') {
    listTargets(ctx);
    return;
  }
  if (parsed.command === 'verify') {
    if (parsed.options.plan) {
      runVerifyPlan(parsed.options);
      return;
    }
    await runVerify(ctx, parsed.options);
    return;
  }
  if (parsed.command === 'check-updates') {
    await runCheckUpdates(ctx, parsed.options);
    return;
  }
  if (parsed.command === 'self-update') {
    runSelfUpdate(ctx, parsed.options);
    return;
  }
  if (parsed.command === 'update-skills') {
    await runUpdateSkills(ctx, parsed.options);
    return;
  }
  if (parsed.command === 'uninstall') {
    await runUninstall(ctx, parsed.options);
    return;
  }
  await runInstall(ctx, parsed.options);
}

function parseArgs(argv) {
  const args = [...argv];
  let command = 'install';
  if (args[0] && !args[0].startsWith('-')) {
    const first = args.shift();
    if (['install', 'verify', 'check-updates', 'list-targets', 'self-update', 'update-skills', 'uninstall', 'status', 'resync', 'knowledge', 'doctor', 'checkpoint', 'hook', 'route', 'usage', 'help', 'plan', 'go', 'log', 'workflow'].includes(first)) {
      command = first;
    } else {
      throw new Error(`Unknown command: ${first}`);
    }
  }

  const options = {
    dryRun: false,
    yes: false,
    skipUpstream: false,
    skipOfficial: false,
    scope: null,
    tools: null,
    projectDir: process.cwd(),
    projectDirProvided: false,
    conflict: null,
    forceTargets: false,
    allSkills: false,
    allowUpstreamDrift: false,
    allowDirtySelfUpdate: false,
    noToolInstall: false,
    json: false,
    apply: false,
    target: null,
    message: null,
    skills: null,
    skipSkills: null,
    selectedSkillNames: null,
    reason: null,
    prompt: null,
    event: null,
    days: null,
    all: false,
    small: false,
    color: false,
    plan: false,
    positionals: [],
    command
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const readValue = (name) => {
      if (arg.includes('=')) return arg.slice(arg.indexOf('=') + 1);
      i += 1;
      if (i >= args.length) throw new Error(`${name} requires a value`);
      return args[i];
    };
    if (arg === '--') continue;
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--yes' || arg === '-y') options.yes = true;
    else if (arg === '--skip-upstream') options.skipUpstream = true;
    else if (arg === '--skip-official-installers') options.skipOfficial = true;
    else if (arg === '--scope' || arg.startsWith('--scope=')) {
      options.scope = readValue('--scope');
    } else if (arg === '--tools' || arg.startsWith('--tools=')) {
      options.tools = readValue('--tools');
    } else if (arg === '--project-dir' || arg.startsWith('--project-dir=')) {
      options.projectDir = readValue('--project-dir');
      options.projectDirProvided = true;
    } else if (arg === '--conflict' || arg.startsWith('--conflict=')) {
      options.conflict = readValue('--conflict');
    } else if (arg === '--force-targets') {
      options.forceTargets = true;
    } else if (arg === '--all-skills') {
      options.allSkills = true;
    } else if (arg === '--all') {
      if (command === 'usage') options.all = true;
      else options.allSkills = true;
    } else if (arg === '--allow-upstream-drift') {
      options.allowUpstreamDrift = true;
    } else if (arg === '--allow-dirty-self-update') {
      options.allowDirtySelfUpdate = true;
    } else if (arg === '--no-tool-install') {
      options.noToolInstall = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--apply') {
      options.apply = true;
    } else if (arg === '--target' || arg.startsWith('--target=')) {
      options.target = readValue('--target');
    } else if (arg === '--message' || arg.startsWith('--message=')) {
      options.message = readValue('--message');
    } else if (arg === '--skills' || arg.startsWith('--skills=')) {
      options.skills = readValue('--skills');
    } else if (arg === '--skip-skills' || arg.startsWith('--skip-skills=')) {
      options.skipSkills = readValue('--skip-skills');
    } else if (arg === '--reason' || arg.startsWith('--reason=')) {
      options.reason = readValue('--reason');
    } else if (arg === '--prompt' || arg.startsWith('--prompt=')) {
      options.prompt = readValue('--prompt');
    } else if (arg === '--event' || arg.startsWith('--event=')) {
      options.event = readValue('--event');
    } else if (arg === '--days' || arg.startsWith('--days=')) {
      options.days = readValue('--days');
    } else if (arg === '--entries-json' || arg.startsWith('--entries-json=')) {
      options.entriesJson = readValue('--entries-json');
    } else if (arg === '--list-targets') {
      if (command !== 'install') throw new Error('--list-targets cannot be combined with another command');
      command = 'list-targets';
      options.command = command;
    } else if (arg === '--help' || arg === '-h') {
      command = 'help';
      options.command = command;
    } else if (arg === '--small') {
      options.small = true;
    } else if (arg === '--color') {
      options.color = true;
    } else if (arg === '--plan') {
      options.plan = true;
    } else if (!arg.startsWith('-') && ovdPlanCommands.has(command)) {
      options.positionals.push(arg);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (options.scope && !validScopes.has(options.scope)) {
    throw new Error(`--scope must be one of: ${[...validScopes].join(', ')}`);
  }
  if (options.conflict && !validConflicts.has(options.conflict)) {
    throw new Error(`--conflict must be one of: ${[...validConflicts].join(', ')}`);
  }
  return { command, options };
}

async function runWorkflowCommand(command, options, env) {
  const workflowOptions = {
    projectDir: options.projectDirProvided ? options.projectDir : null,
    env,
    json: options.json,
    apply: options.apply,
    dryRun: options.dryRun,
    target: options.target,
    message: options.message,
    skills: options.skills,
    reason: options.reason,
    prompt: options.prompt,
    event: options.event,
    days: options.days,
    all: options.all,
    entriesJson: options.entriesJson
  };
  if (command === 'status') {
    const result = ovdWorkflow.status(workflowOptions);
    printWorkflowResult(result, options.json, ovdWorkflow.formatStatus(result));
    return;
  }
  if (command === 'resync') {
    const result = ovdWorkflow.resync(workflowOptions);
    printWorkflowResult(result, options.json, result.apply
      ? `ovd-workflow resynced ${result.trackedFiles} file(s); ${result.changed.length} changed.`
      : `ovd-workflow resync dry-run: ${result.trackedFiles} file(s); ${result.changed.length} changed. Re-run with --apply to write file-index.json.`);
    return;
  }
  if (command === 'knowledge') {
    const result = ovdWorkflow.knowledge(workflowOptions);
    printWorkflowResult(result, options.json, result.apply
      ? `ovd-workflow knowledge vault reindexed ${result.trackedKnowledge || 0} file(s); ${result.changed.length} changed.`
      : `ovd-workflow knowledge dry-run: ${result.trackedKnowledge || 0} file(s); ${result.changed.length} changed. Re-run with --apply to write knowledge-index.json.`);
    return;
  }
  if (command === 'doctor') {
    const result = ovdWorkflow.doctor(workflowOptions);
    const doctorText = result.issues.length
      ? `ovd-workflow doctor found ${result.issues.length} issue(s):\n- ${result.issues.join('\n- ')}`
      : result.recommendations?.length
        ? `ovd-workflow doctor: no blocking issues.\nRecommendations:\n- ${result.recommendations.join('\n- ')}`
        : 'ovd-workflow doctor: clean.';
    printWorkflowResult(result, options.json, doctorText);
    if (result.initialized && result.issues.length) process.exitCode = 1;
    return;
  }
  if (command === 'checkpoint') {
    const result = ovdWorkflow.checkpoint(workflowOptions);
    printWorkflowResult(result, options.json, `ovd-workflow checkpoint created: ${result.file}`);
    return;
  }
  if (command === 'route') {
    const result = ovdWorkflow.recordRoute(workflowOptions);
    printWorkflowResult(result, options.json, result.skipped ? `ovd-workflow route skipped: ${result.reason}` : 'ovd-workflow route recorded.');
    return;
  }
  if (command === 'usage') {
    const result = ovdWorkflow.usage(workflowOptions);
    printWorkflowResult(result, options.json, ovdWorkflow.formatUsage(result));
    return;
  }
  if (command === 'hook') {
    const stdin = await readStdin();
    const event = options.event || inferHookEvent(options);
    const result = ovdWorkflow.hook({ ...workflowOptions, event, stdin });
    if (event === 'statusline') {
      process.stdout.write(`${result.text || 'OVD: off'}\n`);
    } else {
      process.stdout.write(`${result.output || '{}'}\n`);
    }
    return;
  }
  if (ovdPlanCommands.has(command)) {
    const ovdPlan = require('./ovd-plan');
    const planOptions = {
      ...workflowOptions,
      subcommand: options.positionals[0] || null,
      text: options.positionals.slice(1).join(' ') || null,
      nodeRef: options.positionals[1] || null,
      step: options.positionals[1] || null,
      action: options.positionals[2] || null,
      small: !!options.small,
      color: !!options.color
    };
    const handler =
      command === 'plan'
        ? ovdPlan.runPlan
        : command === 'go'
          ? ovdPlan.runGo
          : command === 'log'
            ? ovdPlan.runLog
            : ovdPlan.runWorkflow;
    const result = handler(planOptions, env);
    printWorkflowResult(result, options.json, result && result.text ? result.text : '');
  }
}

function inferHookEvent(options) {
  const target = options.target || '';
  if (target.includes(':')) return target.split(':').at(-1);
  return 'session-start';
}

function printWorkflowResult(result, json, text) {
  if (json) console.log(JSON.stringify(result, null, 2));
  else console.log(text);
}

function readStdin() {
  return new Promise((resolve) => {
    let body = '';
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      body += chunk;
    });
    process.stdin.on('end', () => resolve(body));
  });
}

function createContext(options, env = process.env) {
  const kitDir = env.OVERDRIVE_KIT_DIR || path.resolve(__dirname, '..');
  const manifestPath = path.join(kitDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const home = env.HOME || os.homedir();
  const user = os.userInfo().username;
  return {
    kitDir,
    manifest,
    home,
    user,
    env,
    lock: {
      generatedAt: new Date().toISOString(),
      dryRun: options.dryRun,
      upstreamDriftAllowed: options.allowUpstreamDrift,
      scope: null,
      selectedTargets: [],
      selectedSkills: [],
      conflict: options.conflict || defaultConflict,
      sources: [],
      installed: [],
      uninstalled: [],
      skipped: [],
      backups: [],
      globalInstructions: [],
      toolSetup: []
    }
  };
}

async function runInstall(ctx, options) {
  await resolveInteractiveOptions(ctx, options, { forVerify: false });
  options.selectedSkillNames = resolveSelectedSkillNames(ctx, options);
  const plan = buildInstallPlan(ctx, options);
  ctx.lock.scope = plan.scope;
  ctx.lock.selectedTargets = plan.skillTargets.map((target) => ({
    key: target.key,
    label: target.label,
    skillRoot: target.skillRoot,
    scope: target.scope
  }));
  ctx.lock.conflict = options.conflict;
  ctx.lock.selectedSkills = [...options.selectedSkillNames].sort();

  printInstallSummary(ctx, options, plan);
  if (options.dryRun) {
    log('Dry run mode: no skill roots, instruction files, backups, or lockfiles will be changed.');
  }

  installGitSources(ctx, options, plan);
  installLocalSkills(ctx, options, plan);
  removeNonClaudeStagingNoise(ctx, options, plan, 'before official installers');
  sanitizeNonClaudeRuntimePathReferences(ctx, options, plan, 'before official installers');
  installOfficialInstallers(ctx, options, plan);
  setupOptionalTools(ctx, options, plan);
  pruneRetiredManagedSkills(ctx, options, plan);
  removeNonClaudeStagingNoise(ctx, options, plan, 'after official installers');
  sanitizeNonClaudeRuntimePathReferences(ctx, options, plan, 'after official installers');
  installInstructionFiles(ctx, options, plan);
  installWorkflowRuntime(ctx, options, plan);
  installWorkflowIntegrations(ctx, options, plan);
  removeNonClaudeStagingNoise(ctx, options, plan, 'after instruction files');
  sanitizeNonClaudeRuntimePathReferences(ctx, options, plan, 'after instruction files');

  if (!options.dryRun) {
    fs.writeFileSync(path.join(ctx.kitDir, 'sources.lock.json'), `${JSON.stringify(ctx.lock, null, 2)}\n`);
    log(`Wrote ${path.join(ctx.kitDir, 'sources.lock.json')}`);
  } else {
    log('Dry run complete. No files were changed.');
  }
  printWelcome(options, plan);
  maybePrintPassiveUpdateNotice(ctx, options);
}

async function runUpdateSkills(ctx, options) {
  options.scope = options.scope || 'global';
  if (options.scope === 'global') options.tools = options.tools || 'auto';
  if (!options.conflict) options.conflict = options.allSkills ? 'backup-and-replace' : 'replace-managed-only';
  options.yes = true;

  if (options.allSkills) {
    log(`Updating all matching Overdrive skills from ${options.allowUpstreamDrift ? 'tracking upstream sources' : 'verified pinned sources'}.`);
    log('Conflict policy: backup-and-replace. Existing matching folders are moved to ~/.overdrive/backups/... before replacement.');
  } else {
    log(`Updating Overdrive-managed skills from ${options.allowUpstreamDrift ? 'tracking upstream sources' : 'verified pinned sources'}.`);
    log('Conflict policy: replace-managed-only. Unmarked existing skill folders are preserved.');
  }
  await runInstall(ctx, options);
}

async function runUninstall(ctx, options) {
  options.scope = options.scope || 'global';
  if (options.scope === 'global') options.tools = options.tools || 'auto';
  options.conflict = options.conflict || defaultConflict;

  const plan = buildInstallPlan(ctx, options);
  console.log('\nOverdrive uninstall plan');
  console.log(`Scope: ${plan.scope}${plan.projectDir ? ` (${plan.projectDir})` : ''}`);
  console.log('Only skill folders containing .overdrive.json markers will be removed.');
  console.log('Skill roots:');
  for (const target of plan.skillTargets) console.log(`  - ${target.label}: ${target.skillRootAbs}`);
  if (plan.instructions.length) {
    console.log('Managed instruction blocks:');
    for (const item of plan.instructions) console.log(`  - ${item.label}: ${item.toAbs}`);
  }
  if (options.dryRun) console.log('Dry run mode: no skill folders or instruction files will be changed.');

  if (!options.dryRun && !options.yes && process.stdin.isTTY && process.stdout.isTTY) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      const confirm = await askChoice(rl, 'Remove Overdrive-managed files only?', [
        ['no', 'No, exit'],
        ['yes', 'Yes, remove marked folders and managed blocks']
      ], 'no');
      if (confirm !== 'yes') {
        log('No changes made.');
        return;
      }
    } finally {
      rl.close();
    }
  }

  uninstallMarkedSkills(ctx, options, plan);
  uninstallInstructionBlocks(ctx, options, plan);
  uninstallWorkflowIntegrations(ctx, options, plan);
  uninstallWorkflowRuntime(ctx, options);
  if (options.dryRun) log('Dry run complete. No files were changed.');
  else log('Uninstall complete. Restart your coding agents so they re-index skills.');
}

function runSelfUpdate(ctx, options) {
  const gitDir = path.join(ctx.kitDir, '.git');
  if (!fs.existsSync(gitDir)) {
    log('No .git directory found for this kit. Self-update is only available from a cloned repository.');
    log('If you installed with npx, rerun the npx command to fetch the latest GitHub version.');
    return;
  }
  if (!commandExists('git')) throw new Error('git is required for self-update');

  const status = run('git', ['-C', ctx.kitDir, 'status', '--porcelain'], { capture: true });
  if (status && !options.allowDirtySelfUpdate) {
    const message = 'Refusing to self-update because the Overdrive repo has uncommitted changes. Commit/stash them first, or rerun with --allow-dirty-self-update.';
    if (options.dryRun) {
      log(message);
      return;
    }
    throw new Error(message);
  }

  const branch = runOptional('git', ['-C', ctx.kitDir, 'rev-parse', '--abbrev-ref', 'HEAD']) || 'unknown';
  const upstream = runOptional('git', ['-C', ctx.kitDir, 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']) || 'origin/main';
  if (options.dryRun) {
    log(`would update Overdrive kit in ${ctx.kitDir}`);
    log(`would run: git -C ${ctx.kitDir} pull --ff-only`);
    log(`current branch: ${branch}; upstream: ${upstream}`);
    return;
  }

  log(`Updating Overdrive kit from ${upstream}...`);
  run('git', ['-C', ctx.kitDir, 'pull', '--ff-only']);
}

async function runCheckUpdates(ctx, options) {
  const result = checkUpdates(ctx, options);
  if (!result.checked) {
    console.log('Could not check for Overdrive updates right now. Try again later.');
    if (result.reason) console.log(`Reason: ${result.reason}`);
    return;
  }

  if (result.kitBehind) {
    console.log(`A newer Overdrive version is available (v${result.currentVersion} -> v${result.latestVersion}). Run ./update.sh to apply, or ./update.sh --kit-only to refresh just the installer.`);
  } else {
    console.log(`Overdrive v${result.currentVersion} is current.`);
  }

  if (result.skillUpdates.length) {
    const count = result.skillUpdates.reduce((sum, item) => sum + item.skillCount, 0);
    console.log(`${count} installed skill${count === 1 ? '' : 's'} from ${result.skillUpdates.length} upstream source${result.skillUpdates.length === 1 ? '' : 's'} have tracking-branch updates available. Update Overdrive when a release verifies newer pins, or run ./update.sh --skills-only --allow-upstream-drift if you intentionally want live upstream refs.`);
    for (const item of result.skillUpdates.slice(0, 8)) {
      console.log(`  - ${item.source}: ${item.installedCommit.slice(0, 12)} -> ${item.latestCommit.slice(0, 12)} (${item.skillCount} skill${item.skillCount === 1 ? '' : 's'})`);
    }
    if (result.skillUpdates.length > 8) console.log(`  - ${result.skillUpdates.length - 8} more source(s)`);
  }

  if (result.kitBehind || result.skillUpdates.length) process.exitCode = 1;
}

function maybePrintPassiveUpdateNotice(ctx, options) {
  if (options.command === 'check-updates') return;
  try {
    const result = checkUpdates(ctx, options);
    if (!result.checked) return;
    if (result.kitBehind) {
      console.log(`Update available: Overdrive v${result.currentVersion} -> v${result.latestVersion}. Run ./update.sh or overdrive check-updates.`);
    } else if (result.skillUpdates.length) {
      const count = result.skillUpdates.reduce((sum, item) => sum + item.skillCount, 0);
      console.log(`Skill updates available: ${count} installed managed skill${count === 1 ? '' : 's'} have newer tracking refs. Run ./check-updates.sh for details.`);
    }
  } catch (_error) {
    // Passive update notices must never block install or verify.
  }
}

function checkUpdates(ctx, options) {
  const currentVersion = readPackageVersion(ctx);
  const latestVersion = latestPublishedVersion();
  if (!latestVersion) {
    return { checked: false, reason: 'latest release tag could not be read', currentVersion, latestVersion: null, kitBehind: false, skillUpdates: [] };
  }
  const skillUpdates = checkManagedSkillUpdates(ctx, options);
  return {
    checked: true,
    currentVersion,
    latestVersion,
    kitBehind: compareSemver(currentVersion, latestVersion) < 0,
    skillUpdates
  };
}

function readPackageVersion(ctx) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ctx.kitDir, 'package.json'), 'utf8'));
    return pkg.version || '0.0.0';
  } catch (_error) {
    return '0.0.0';
  }
}

function latestPublishedVersion() {
  const output = runOptional('git', ['ls-remote', '--tags', '--refs', publicRepoUrl, 'refs/tags/v*'], { timeout: 8000 });
  if (!output) return null;
  const versions = [];
  for (const line of output.split('\n')) {
    const match = line.match(/refs\/tags\/v(\d+\.\d+\.\d+)$/);
    if (match) versions.push(match[1]);
  }
  versions.sort(compareSemver);
  return versions.at(-1) || null;
}

function checkManagedSkillUpdates(ctx, options) {
  const planOptions = {
    ...options,
    scope: options.scope || 'global',
    tools: options.tools || (options.scope === 'local' ? null : 'auto'),
    conflict: options.conflict || defaultConflict
  };
  const plan = buildInstallPlan(ctx, planOptions, { forVerify: true });
  const sourcesById = new Map((ctx.manifest.sources || []).map((source) => [source.id, source]));
  const seen = new Map();
  for (const target of plan.skillTargets) {
    if (!fs.existsSync(target.skillRootAbs)) continue;
    for (const entry of fs.readdirSync(target.skillRootAbs)) {
      let marker;
      try {
        marker = readMarker(path.join(target.skillRootAbs, entry));
      } catch (_error) {
        marker = null;
      }
      if (!marker) continue;
      const source = sourcesById.get(marker.source);
      const installedCommit = marker.sourceMeta?.commit;
      if (!source || !source.trackingRef || !installedCommit) continue;
      const key = `${source.id}:${installedCommit}`;
      const current = seen.get(key) || { source, installedCommit, skills: new Set() };
      current.skills.add(marker.skill || entry);
      seen.set(key, current);
    }
  }

  const latestBySource = new Map();
  const updates = [];
  for (const item of seen.values()) {
    const latestCommit = latestBySource.get(item.source.id) || latestTrackingCommit(item.source);
    latestBySource.set(item.source.id, latestCommit);
    if (!latestCommit || latestCommit === item.installedCommit) continue;
    updates.push({
      source: item.source.id,
      installedCommit: item.installedCommit,
      latestCommit,
      skillCount: item.skills.size
    });
  }
  return updates.sort((a, b) => a.source.localeCompare(b.source));
}

function latestTrackingCommit(source) {
  const ref = source.trackingRef || 'main';
  const output = runOptional('git', ['ls-remote', source.repo, `refs/heads/${ref}`], { timeout: 8000 });
  if (!output) return null;
  return output.split(/\s+/)[0] || null;
}

function compareSemver(a, b) {
  const pa = String(a).replace(/^v/, '').split('.').map((part) => Number(part) || 0);
  const pb = String(b).replace(/^v/, '').split('.').map((part) => Number(part) || 0);
  for (let i = 0; i < 3; i += 1) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

// `overdrive verify --plan` (Task 7.3) — v2-native project-integrity check.
// Opt-in via --plan (Q7.3): runs the ovd-plan layout verifier against the
// project dir, distinct from the installer skill-verification above. This is the
// delegation target for the repurposed `/ovd-doctor` (Task 2.9). Pattern 1: the
// verifier never calls an LLM; this just renders findings and sets exit code.
function runVerifyPlan(options) {
  const { resolveProjectDir } = require('./ovd-workflow');
  const { verifyPlanLayout, renderVerifyLayout } = require('./ovd-plan/verify-layout');
  const rootDir = resolveProjectDir(options.projectDir, process.env);
  const result = verifyPlanLayout(rootDir);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(renderVerifyLayout(result));
  }
  if (!result.ok) process.exitCode = 1;
}

async function runVerify(ctx, options) {
  options.conflict = options.conflict || defaultConflict;
  if (!options.scope) options.scope = 'global';
  if (!options.tools && options.scope === 'global') options.tools = 'auto';
  const plan = buildInstallPlan(ctx, options, { forVerify: true });
  const failures = [];
  const check = (label, condition) => {
    console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`);
    if (!condition) failures.push(label);
  };

  const expectedByRoot = expectedSkillsByRoot(ctx, plan, options);
  console.log('Expected skill installation');
  for (const [root, expectedSkills] of expectedByRoot.entries()) {
    check(`${root} exists`, fs.existsSync(root));
    for (const skill of expectedSkills) {
      const skillMd = path.join(root, skill, 'SKILL.md');
      const exactSkillFile = hasExactDirEntry(path.join(root, skill), 'SKILL.md');
      check(`${skill} installed in ${root}`, exactSkillFile);
      if (exactSkillFile) {
        const skillText = fs.readFileSync(skillMd, 'utf8');
        const fm = extractFrontmatter(skillText);
        check(`${skill} in ${root} has name frontmatter`, /^name:\s*.+$/m.test(fm));
        check(`${skill} in ${root} has description frontmatter`, /^description:\s*.+$/m.test(fm));
        if (skill === 'graphify') {
          check(`${skill} in ${root} uses exact SKILL.md directory entry`, hasExactDirEntry(path.join(root, skill), 'SKILL.md'));
          check(`${skill} in ${root} has Overdrive setup note`, skillText.includes('Overdrive attempts to set up Graphify during install') && skillText.includes('graphifyy==0.1.14') && skillText.includes('Python 3.10-3.12'));
          check(`${skill} in ${root} avoids unsafe Graphify install guidance`, !hasUnsafeGraphifyInstallInstruction(skillText));
        }
      }
    }
  }

  console.log('\nInstruction checks');
  for (const item of plan.instructions) {
    const src = path.join(ctx.kitDir, item.from);
    const dest = item.toAbs;
    check(`${item.from} exists in kit`, fs.existsSync(src));
    if (fs.existsSync(src)) {
      const sourceText = fs.readFileSync(src, 'utf8');
      check(`${item.from} has managed start marker`, sourceText.includes(managedBlockStart));
      check(`${item.from} has managed end marker`, sourceText.includes(managedBlockEnd));
      check(`${item.from} includes Context7 documentation section`, sourceText.includes('Context7 Documentation'));
      check(`${item.from} does not prescribe GitHub MCP`, !sourceText.includes('Use GitHub MCP'));
      check(`${item.from} does not prescribe Supabase MCP`, !sourceText.includes('Use Supabase MCP'));
      check(`${item.from} includes planning workflow guidance`, sourceText.includes('Planning Workflows'));
      check(`${item.from} includes context budget guidance`, sourceText.includes('Context Budget'));
    }
    check(`${dest} exists`, fs.existsSync(dest));
    if (fs.existsSync(dest)) {
      const targetText = fs.readFileSync(dest, 'utf8');
      check(`${dest} has managed global guidelines`, targetText.includes(managedBlockStart) && targetText.includes(managedBlockEnd));
      check(`${dest} includes skill-router guidance`, targetText.includes('skill-router'));
      check(`${dest} includes explicit skill-router preflight guidance`, targetText.includes('consult `skill-router` as the default lightweight preflight'));
      check(`${dest} lets explicit user-named skills win`, targetText.includes('If the user explicitly names one or more skills'));
      check(`${dest} includes Context7 documentation section`, targetText.includes('Context7 Documentation'));
      check(`${dest} includes Context7 guidance`, targetText.includes('Use Context7 MCP for library'));
      check(`${dest} includes secret handling guidance`, targetText.includes('Never expose API keys'));
      check(`${dest} includes surgical change guidance`, targetText.includes('Surgical Changes'));
      check(`${dest} includes planning workflow guidance`, targetText.includes('Planning Workflows'));
      check(`${dest} includes context budget guidance`, targetText.includes('Context Budget'));
      check(`${dest} notes OVERDRIVE.md as primary context`, targetText.includes('OVERDRIVE.md') && targetText.includes('/ovd-plan'));
    }
  }

  console.log('\nForbidden skill checks');
  for (const target of plan.skillTargets) {
    const root = target.skillRootAbs;
    for (const forbidden of ctx.manifest.exclusions.forbiddenSkillNames || []) {
      check(`${forbidden} absent from ${root}`, !fs.existsSync(path.join(root, forbidden)));
    }
    const rootEntries = fs.existsSync(root) ? fs.readdirSync(root) : [];
    for (const fragment of ctx.manifest.exclusions.forbiddenPathFragments || []) {
      const found = rootEntries.some((entry) => entry.includes(fragment));
      check(`${fragment} absent as top-level skill in ${root}`, !found);
    }
  }

  console.log('\nBroken symlink checks');
  const broken = [];
  for (const [root, expectedSkills] of expectedByRoot.entries()) {
    for (const skill of expectedSkills) walkForBrokenSymlinks(path.join(root, skill), broken);
  }
  check('no broken symlinks inside expected skill copies', broken.length === 0);
  if (broken.length) console.log(broken.join('\n'));

  console.log('\nNon-Claude runtime path checks');
  for (const configDir of nonClaudeRuntimeConfigDirs(plan)) {
    const leaks = findClaudeHomeLeaks(configDir, configDir);
    check(`${configDir} has no sanitized Claude home path references`, leaks.length === 0);
    if (leaks.length) console.log(leaks.slice(0, 20).join('\n'));
  }

  console.log('\nRouter checks');
  const routerRoot = findRouterRoot(plan);
  const routerFiles = [
    'SKILL.md',
    'references/catalog.md',
    'references/frontend-design-routing.md',
    'references/compatibility-audit.md',
    'references/sharing-and-transfer.md',
    'references/routing-trace-examples.md',
    'agents/openai.yaml'
  ];
  check('skill-router root found in selected targets', Boolean(routerRoot));
  const routerText = [];
  if (routerRoot) {
    for (const rel of routerFiles) {
      const file = path.join(routerRoot, rel);
      check(`skill-router ${rel} exists`, fs.existsSync(file));
      if (fs.existsSync(file)) routerText.push(fs.readFileSync(file, 'utf8'));
    }
    const catalogFile = path.join(routerRoot, 'references/catalog.md');
    if (fs.existsSync(catalogFile)) {
      const catalog = fs.readFileSync(catalogFile, 'utf8');
      const rows = [];
      for (const line of catalog.split('\n')) {
        const match = line.match(/^\|\s*`([^`]+)`\s*\|/);
        if (match) rows.push(match[1]);
      }
      const duplicateRows = rows.filter((name, index) => rows.indexOf(name) !== index);
      check('catalog has unique skill rows', duplicateRows.length === 0);
      const catalogNames = new Set(rows);
      const installedNames = new Set();
      for (const target of plan.skillTargets) {
        if (!fs.existsSync(target.skillRootAbs)) continue;
        for (const entry of fs.readdirSync(target.skillRootAbs)) {
          if (entry.startsWith('.') || entry === '.DS_Store') continue;
          if (fs.existsSync(path.join(target.skillRootAbs, entry, 'SKILL.md'))) installedNames.add(entry);
        }
      }
      const missing = [...installedNames].filter((name) => !catalogNames.has(name)).sort();
      check('catalog covers every installed top-level skill in target roots', missing.length === 0);
      if (missing.length) console.log(`missing from catalog: ${missing.join(', ')}`);
    }
  }

  console.log('\nMCP guidance checks');
  const mcpGuide = path.join(ctx.kitDir, 'MCP_AND_CONNECTORS.md');
  check('MCP_AND_CONNECTORS.md exists', fs.existsSync(mcpGuide));
  if (fs.existsSync(mcpGuide)) {
    const mcpText = fs.readFileSync(mcpGuide, 'utf8');
    check('MCP guide includes Context7', mcpText.includes('Context7 MCP'));
    check('MCP guide keeps GitHub MCP optional', !mcpText.includes('Use GitHub MCP'));
    check('MCP guide keeps Supabase MCP optional', !mcpText.includes('Use Supabase MCP'));
    check('MCP guide warns against sharing secrets', mcpText.includes('Do not commit, zip, paste, screenshot, or publish API keys'));
  }

  console.log('\nRelease documentation checks');
  const releaseDocs = ['SECURITY.md', 'VERIFIED_SOURCES.md', 'CHANGELOG.md', 'SKILLS_TLDR.md', 'AGENTS_OPENAI_YAML.md'];
  for (const doc of releaseDocs) check(`${doc} exists`, fs.existsSync(path.join(ctx.kitDir, doc)));
  check('Git sources use pinned commit refs with tracking refs', (ctx.manifest.sources || []).every((source) => /^[0-9a-f]{40}$/i.test(source.ref) && source.trackingRef));
  check('Official npm installers use pinned packages with tracking packages', (ctx.manifest.officialInstallers || []).every((installer) => !installer.package.endsWith('@latest') && installer.trackingPackage));
  const license = path.join(ctx.kitDir, 'LICENSE');
  check('LICENSE uses full copyright name', fs.existsSync(license) && fs.readFileSync(license, 'utf8').includes('Radu Stefan Dumitru'));
  const readme = path.join(ctx.kitDir, 'README.md');
  check('README documents pinned sources and upstream drift', fs.existsSync(readme) && fs.readFileSync(readme, 'utf8').includes('--allow-upstream-drift') && fs.readFileSync(readme, 'utf8').includes('VERIFIED_SOURCES.md'));

  console.log('\nSmoke routing checks');
  const combinedRouterText = routerText.join('\n');
  for (const smoke of ctx.manifest.smokeChecks || []) {
    check(`${smoke.prompt} -> ${smoke.expected.join(', ')}`, smoke.expected.every((term) => combinedRouterText.includes(term)));
  }

  if (failures.length) {
    console.log(`\nFailures: ${failures.length}`);
    process.exitCode = 1;
    return;
  }
  console.log('\nAll verification checks passed.');
  maybePrintPassiveUpdateNotice(ctx, options);
}

async function resolveInteractiveOptions(ctx, options) {
  const interactive = process.stdin.isTTY && process.stdout.isTTY && !options.yes && !options.dryRun;
  if (options.scope && !options.conflict) options.conflict = defaultConflict;
  if (options.yes) {
    options.scope = options.scope || 'global';
    if (options.scope === 'global') options.tools = options.tools || 'auto';
    if (options.scope === 'local' && !options.projectDirProvided && !options.dryRun) {
      throw new Error('Non-interactive local installs with --yes require an explicit --project-dir. Add --project-dir . if you mean the current directory.');
    }
    options.conflict = options.conflict || defaultConflict;
    return;
  }
  if (options.dryRun) {
    options.scope = options.scope || 'global';
    if (options.scope === 'global') options.tools = options.tools || 'auto';
    options.conflict = options.conflict || defaultConflict;
    return;
  }
  if (!interactive) {
    if (!options.scope) {
      throw new Error('Non-interactive installs require --scope global or --scope local. Add --dry-run to preview safely.');
    }
    if (options.scope === 'global' && !options.tools) {
      throw new Error('Non-interactive global installs require --tools auto or --tools claude,codex,cursor.');
    }
    if (options.scope === 'local' && !options.projectDirProvided && !options.dryRun) {
      throw new Error('Non-interactive local installs require an explicit --project-dir. Add --project-dir . if you mean the current directory.');
    }
    options.conflict = options.conflict || defaultConflict;
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    if (!options.scope) {
      options.scope = await askScope(rl);
      if (options.scope === 'exit') {
        log('No changes made.');
        process.exit(0);
      }
    }
    if (options.scope === 'global' && !options.tools) {
      options.tools = await askGlobalTools(rl, ctx);
      if (options.tools === 'exit') {
        log('No changes made.');
        process.exit(0);
      }
    }
    if (options.scope === 'local') {
      const projectDir = path.resolve(options.projectDir || process.cwd());
      log('');
      log(`Local project install will update this folder:\n  ${projectDir}`);
      log('\nIt may create or update:\n  .agents/skills/\n  .cursor/skills/\n  AGENTS.md\n  CLAUDE.md\n  GEMINI.md');
      log('\nExisting files are preserved by default. Managed instruction blocks are updated in place.');
      const proceed = await askChoice(rl, 'Continue with local project install?', [
        ['yes', 'Yes, continue'],
        ['no', 'No, exit']
      ], 'yes');
      if (proceed !== 'yes') process.exit(0);
    }
    if (!options.conflict) options.conflict = await askConflict(rl);
    if (options.conflict === 'force') {
      const confirm = await askChoice(rl, 'Force can overwrite unmarked existing skill folders. Continue?', [
        ['no', 'No, choose the safe preserve policy'],
        ['yes', 'Yes, I understand and want force replacement']
      ], 'no');
      if (confirm !== 'yes') options.conflict = defaultConflict;
    }
    if (!options.allSkills && !options.skills && !options.skipSkills) {
      await askSkillSelection(rl, ctx, options);
    }
  } finally {
    rl.close();
  }
}

async function askScope(rl) {
  log('\nWhere do you want to install Overdrive?\n');
  log('1. Local project install');
  log('   Adds skills to this repo only. Best when you want a project to carry its own AI setup.\n');
  log('2. Global machine install');
  log('   Adds skills to installed coding agents on this machine. Best when you want skills available in all projects.\n');
  log('3. Exit\n');
  return askChoice(rl, 'Choose an install scope', [
    ['local', 'Local project install'],
    ['global', 'Global machine install'],
    ['exit', 'Exit']
  ], 'global');
}

async function askGlobalTools(rl, ctx) {
  log('\nWhich coding agents should receive the skills?\n');
  log('1. Scan and install for available coding agents');
  log('   Recommended. Detects installed coding agents and installs only for those.\n');
  log('2. Choose manually');
  log('   Pick exact targets, useful if you want to skip a detected tool or prepare a config for a tool you plan to install.\n');
  log('3. Exit\n');
  const mode = await askChoice(rl, 'Choose target selection mode', [
    ['auto', 'Scan and install for available coding agents'],
    ['manual', 'Choose manually'],
    ['exit', 'Exit']
  ], 'auto');
  if (mode !== 'manual') return mode;

  const detected = detectTargets(ctx);
  const entries = Object.entries(targetDefs);
  log('\nManual targets. Enter numbers separated by commas.\n');
  entries.forEach(([key, def], index) => {
    const root = def.globalSkillRoot ? resolvePath(def.globalSkillRoot, ctx) : '';
    const status = detected[key]?.available ? 'detected' : 'not detected';
    log(`${index + 1}. ${def.label.padEnd(18)} ${root} (${status})`);
  });
  const answer = await rl.question('\nTargets [1]: ');
  const raw = answer.trim() || '1';
  const selected = [];
  for (const part of raw.split(',').map((value) => value.trim()).filter(Boolean)) {
    if (/^\d+$/.test(part)) {
      const entry = entries[Number(part) - 1];
      if (entry) selected.push(entry[0]);
    } else {
      selected.push(normalizeToolName(part));
    }
  }
  const final = [];
  for (const key of [...new Set(selected)]) {
    if (!targetDefs[key]) continue;
    if (key === 'agents' || detected[key]?.available) {
      final.push(key);
      continue;
    }
    const choice = await askChoice(rl, `${targetDefs[key].label} was not detected. What should the installer do?`, [
      ['skip', 'Skip this target'],
      ['force', 'Create the config directory anyway']
    ], 'skip');
    if (choice === 'force') final.push(key);
  }
  return final.length ? final.join(',') : 'auto';
}

async function askConflict(rl) {
  log('\nHow should Overdrive handle existing skill folders?\n');
  log('1. Preserve existing files');
  log('   Recommended. Update Overdrive-managed skills, install missing skills, and skip unmarked existing folders.\n');
  log('2. Backup and replace');
  log('   Move existing skill folders to ~/.overdrive/backups/... before replacing them.\n');
  log('3. Replace managed only');
  log('   Replace only skills that already have an Overdrive marker. Skip unmarked folders.\n');
  log('4. Force replace');
  log('   Overwrite matching skill folders even if they are unmarked. Use only when you are sure.\n');
  return askChoice(rl, 'Choose a conflict policy', [
    ['preserve', 'Preserve existing files'],
    ['backup-and-replace', 'Backup and replace'],
    ['replace-managed-only', 'Replace managed only'],
    ['force', 'Force replace']
  ], 'preserve');
}

async function askSkillSelection(rl, ctx, options) {
  const catalog = collectSkillCatalog(ctx);
  const grouped = new Map();
  for (const item of catalog) {
    const group = grouped.get(item.group) || [];
    group.push(item.name);
    grouped.set(item.group, group);
  }

  log('\nWhich skills should be installed?\n');
  log('1. Install all skills');
  log('   Recommended. Installs the full Overdrive library and lets skill-router choose only what each task needs.\n');
  log('2. Choose exact skills');
  log('   Advanced. Installs only the comma-separated skills you name.\n');
  log('3. Install all except some skills');
  log('   Advanced. Useful when you want the full setup but want to exclude specific domains.\n');
  log('4. Exit\n');
  log(`Available skills grouped by source (${catalog.length} total):`);
  for (const [group, names] of grouped.entries()) {
    log(`  - ${group} (${names.length}): ${names.sort().join(', ')}`);
  }
  const mode = await askChoice(rl, 'Choose skill selection mode', [
    ['all', 'Install all skills'],
    ['choose', 'Choose exact skills'],
    ['skip', 'Install all except some skills'],
    ['exit', 'Exit']
  ], 'all');
  if (mode === 'exit') {
    log('No changes made.');
    process.exit(0);
  }
  if (mode === 'all') {
    options.allSkills = true;
    return;
  }
  if (mode === 'choose') {
    const answer = (await rl.question('\nExact skills to install, comma-separated: ')).trim();
    if (!answer) {
      log('No skills entered; using the recommended full install.');
      options.allSkills = true;
      return;
    }
    options.skills = answer;
    return;
  }
  const answer = (await rl.question('\nSkills to skip, comma-separated: ')).trim();
  if (answer) options.skipSkills = answer;
  else options.allSkills = true;
}

async function askChoice(rl, question, choices, defaultValue) {
  const labels = choices.map(([value], index) => `${index + 1}=${value}`).join(', ');
  while (true) {
    const answer = (await rl.question(`${question} (${labels}) [${defaultValue}]: `)).trim();
    if (!answer) return defaultValue;
    if (/^\d+$/.test(answer)) {
      const item = choices[Number(answer) - 1];
      if (item) return item[0];
    }
    const normalized = answer.toLowerCase();
    const item = choices.find(([value]) => value === normalized);
    if (item) return item[0];
    log(`Please choose one of: ${choices.map(([value]) => value).join(', ')}`);
  }
}

function collectSkillCatalog(ctx) {
  const entries = [];
  for (const skill of ctx.manifest.localSkills || []) {
    entries.push({ name: skill.to, group: 'Overdrive local skills', source: 'local-kit' });
  }
  for (const source of ctx.manifest.sources || []) {
    for (const include of source.includes || []) {
      entries.push({ name: include.to, group: source.id, source: source.id });
    }
  }
  for (const installer of ctx.manifest.officialInstallers || []) {
    for (const skill of installer.skills || []) {
      entries.push({ name: skill, group: installer.id, source: installer.id });
    }
  }
  const seen = new Set();
  return entries.filter((entry) => {
    if (!entry.name || seen.has(entry.name)) return false;
    seen.add(entry.name);
    return true;
  }).sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
}

function resolveSelectedSkillNames(ctx, options) {
  const all = new Set(collectSkillCatalog(ctx).map((entry) => entry.name));
  const requested = parseSkillList(options.skills);
  const skipped = parseSkillList(options.skipSkills);
  for (const name of [...requested, ...skipped]) {
    if (!all.has(name)) {
      throw new Error(`Unknown skill '${name}'. Run --dry-run or inspect manifest.json for available skill names.`);
    }
  }
  const selected = requested.length ? new Set(requested) : new Set(all);
  for (const name of skipped) selected.delete(name);
  if (!selected.size) throw new Error('No skills selected. Use --all, --skills name1,name2, or remove --skip-skills exclusions.');
  return selected;
}

function parseSkillList(value) {
  if (!value) return [];
  return [...new Set(String(value).split(',').map((item) => item.trim()).filter(Boolean))];
}

function isSkillSelected(options, skillName) {
  return !options.selectedSkillNames || options.selectedSkillNames.has(skillName);
}

function buildInstallPlan(ctx, options, mode = {}) {
  const scope = options.scope || 'global';
  if (scope === 'local') return buildLocalPlan(ctx, options);
  return buildGlobalPlan(ctx, options, mode);
}

function buildLocalPlan(ctx, options) {
  const projectDir = path.resolve(options.projectDir || process.cwd());
  const skillTargets = localSkillTargets.map((target) => ({
    ...target,
    skillRootAbs: path.resolve(projectDir, target.skillRoot)
  }));
  const instructions = localInstructionFiles.map((item) => ({
    ...item,
    toAbs: path.resolve(projectDir, item.to)
  }));
  return {
    scope: 'local',
    projectDir,
    selectedKeys: ['local-agents', 'local-cursor'],
    skillTargets,
    instructions
  };
}

function buildGlobalPlan(ctx, options, mode = {}) {
  const detected = detectTargets(ctx);
  let selectedKeys;
  if (!options.tools || options.tools === 'auto') {
    selectedKeys = Object.keys(targetDefs).filter((key) => detected[key]?.available);
  } else {
    selectedKeys = options.tools.split(',').map((tool) => normalizeToolName(tool.trim())).filter(Boolean);
  }
  selectedKeys = [...new Set(selectedKeys.filter((key) => targetDefs[key]))];
  const missing = selectedKeys.filter((key) => key !== 'agents' && !detected[key]?.available);
  if (missing.length && !options.forceTargets && !mode.forVerify) {
    log(`Warning: selected target(s) not detected and will be skipped: ${missing.map((key) => targetDefs[key].label).join(', ')}`);
    selectedKeys = selectedKeys.filter((key) => key === 'agents' || detected[key]?.available);
  }
  if (!selectedKeys.length && !mode.forVerify) {
    throw new Error('No install targets selected. Install a supported coding agent, use --tools auto, choose detected tools, or add --force-targets if you intentionally want to create config folders for an undetected tool.');
  }

  const skillTargets = selectedKeys.map((key) => {
    const def = targetDefs[key];
    return {
      key,
      label: def.label,
      scope: 'global',
      skillRoot: def.globalSkillRoot,
      skillRootAbs: resolvePath(def.globalSkillRoot, ctx),
      configDirAbs: def.configDir ? resolvePath(def.configDir, ctx) : null,
    };
  });
  const instructionMap = new Map();
  for (const key of selectedKeys) {
    const instruction = targetDefs[key].globalInstruction;
    if (!instruction) continue;
    const dest = resolvePath(instruction.to, ctx);
    if (!instructionMap.has(dest)) {
      instructionMap.set(dest, {
        key: `${key}-instructions`,
        from: instruction.from,
        to: instruction.to,
        toAbs: dest,
        label: `${targetDefs[key].label} instructions`
      });
    }
  }
  return {
    scope: 'global',
    projectDir: null,
    selectedKeys,
    detected,
    skillTargets,
    instructions: [...instructionMap.values()],
  };
}

function normalizeToolName(value) {
  const normalized = value.toLowerCase().replace(/_/g, '-').trim();
  const aliases = {
    claude: 'claude',
    'claude-code': 'claude',
    codex: 'codex',
    gemini: 'gemini',
    'gemini-cli': 'gemini',
    antigravity: 'antigravity',
    cursor: 'cursor',
    'cursor-agent': 'cursor',
    agents: 'agents',
    '.agents': 'agents'
  };
  return aliases[normalized] || normalized;
}

function detectTargets(ctx) {
  const detected = {};
  for (const [key, def] of Object.entries(targetDefs)) {
    const checks = def.detect ? def.detect(ctx) : [];
    const available = checks.some(Boolean);
    detected[key] = { available, checks };
  }
  return detected;
}

function listTargets(ctx) {
  const detected = detectTargets(ctx);
  console.log('Overdrive target detection\n');
  for (const [key, def] of Object.entries(targetDefs)) {
    const status = detected[key]?.available ? 'detected' : 'not detected';
    console.log(`${key.padEnd(12)} ${def.label.padEnd(20)} ${status}`);
    if (def.globalSkillRoot) console.log(`             skills: ${resolvePath(def.globalSkillRoot, ctx)}`);
    if (def.globalInstruction) console.log(`       instructions: ${resolvePath(def.globalInstruction.to, ctx)}`);
  }
  console.log('\nCursor note: custom skills go in ~/.cursor/skills globally or .cursor/skills locally. Do not write into ~/.cursor/skills-cursor.');
}

function printInstallSummary(ctx, options, plan) {
  console.log(`\n${style('Overdrive install plan', 'bold')}`);
  console.log(`Scope: ${plan.scope}${plan.projectDir ? ` (${plan.projectDir})` : ''}`);
  console.log(`Conflict policy: ${options.conflict}`);
  console.log(`Source mode: ${options.allowUpstreamDrift ? 'tracking refs / latest packages (--allow-upstream-drift)' : 'verified pinned refs / pinned packages'}`);
  console.log(`External tool/install setup: ${options.noToolInstall ? 'skipped by --no-tool-install' : 'attempt safe non-privileged setup when selected skills need it'}`);
  if (options.selectedSkillNames) {
    const total = collectSkillCatalog(ctx).length;
    console.log(`Skills: ${options.selectedSkillNames.size}/${total} selected`);
    if (options.selectedSkillNames.size < total) {
      console.log(`Selected skills: ${[...options.selectedSkillNames].sort().join(', ')}`);
    }
  }
  console.log('Skill targets:');
  for (const target of plan.skillTargets) {
    console.log(`  - ${target.label}: ${target.skillRootAbs}`);
  }
  if (plan.instructions.length) {
    console.log('Instruction files:');
    for (const item of plan.instructions) console.log(`  - ${item.label}: ${item.toAbs}`);
  }
  if (options.conflict === 'preserve') {
    console.log('Non-destructive mode: unmarked existing skill folders will be skipped; Overdrive-managed folders may be updated.');
  }
  if (options.allowUpstreamDrift) {
    console.log('Warning: upstream drift is enabled. GitHub sources and official installers may resolve newer content than this release verified.');
  }
  if (!options.noToolInstall) {
    console.log('Use --no-tool-install to skip optional helper setup and official installer-backed npx sources.');
  }
}

function installGitSources(ctx, options, plan) {
  if (options.skipUpstream) {
    log('Skipping GitHub upstream sources by request.');
    return;
  }
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'overdrive-git-'));
  try {
    for (const source of ctx.manifest.sources || []) {
      const selectedIncludes = (source.includes || []).filter((include) => isSkillSelected(options, include.to));
      if (!selectedIncludes.length) {
        log(`Skipping ${source.id}: no selected skills from this source.`);
        continue;
      }
      const checkout = path.join(tempRoot, source.id);
      const requestedRef = sourceRefForInstall(source, options);
      const mode = options.allowUpstreamDrift ? 'tracking' : 'verified';
      log(`Cloning ${source.id} from ${source.repo} at ${mode} ref ${requestedRef}...`);
      checkoutGitSource(source.repo, requestedRef, checkout);
      const commit = run('git', ['-C', checkout, 'rev-parse', 'HEAD'], { capture: true });
      ctx.lock.sources.push({
        id: source.id,
        type: 'git',
        repo: source.repo,
        ref: source.ref,
        trackingRef: source.trackingRef || null,
        requestedRef,
        mode,
        commit
      });
      for (const include of selectedIncludes) {
        const src = path.resolve(checkout, include.from);
        copySkill(ctx, options, plan, src, include.to, source.id, include.from, {
          repo: source.repo,
          ref: source.ref,
          trackingRef: source.trackingRef || null,
          requestedRef,
          mode,
          commit,
          skillFile: include.skillFile || 'SKILL.md',
          transforms: include.transforms || []
        });
      }
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function sourceRefForInstall(source, options) {
  if (options.allowUpstreamDrift && source.trackingRef) return source.trackingRef;
  return source.ref;
}

function checkoutGitSource(repo, ref, checkout) {
  fs.mkdirSync(checkout, { recursive: true });
  run('git', ['-C', checkout, 'init', '--quiet']);
  run('git', ['-C', checkout, 'remote', 'add', 'origin', repo]);
  run('git', ['-C', checkout, 'fetch', '--quiet', '--depth', '1', 'origin', ref]);
  run('git', ['-C', checkout, 'checkout', '--quiet', '--detach', 'FETCH_HEAD']);
}

function installLocalSkills(ctx, options, plan) {
  const localSkills = (ctx.manifest.localSkills || []).filter((item) => isSkillSelected(options, item.to));
  if (!localSkills.length) return;
  log(`Installing ${localSkills.length} local skill(s) from this kit...`);
  for (const item of localSkills) {
    const src = path.resolve(ctx.kitDir, item.from);
    copySkill(ctx, options, plan, src, item.to, 'local-kit', item.from, {});
  }
}

function copySkill(ctx, options, plan, src, skillName, sourceId, sourcePath, sourceMeta = {}) {
  const preparedSrc = prepareSkillSource(src, skillName, sourceId, sourceMeta);
  for (const target of plan.skillTargets) {
    if (shouldSkipSkillForTarget(ctx, skillName, target)) {
      const message = `${skillName} skipped for ${target.label} by root policy`;
      log(message);
      ctx.lock.skipped.push({ skill: skillName, target: target.key, reason: 'root-policy' });
      continue;
    }
    copySkillToTarget(ctx, options, preparedSrc, skillName, sourceId, sourcePath, target, sourceMeta);
  }
}

function prepareSkillSource(src, skillName, sourceId, sourceMeta = {}) {
  const skillFile = sourceMeta.skillFile || 'SKILL.md';
  if (skillFile !== 'SKILL.md') {
    const alternate = path.join(src, skillFile);
    if (!fs.existsSync(alternate)) throw new Error(`${sourceId}:${skillName} is missing ${skillFile} at ${alternate}`);
    normalizeSkillFileCase(src, skillFile);
  }
  for (const transform of sourceMeta.transforms || []) {
    if (transform === 'agentic-graphify-safe') {
      applyGraphifySafeTransform(path.join(src, 'SKILL.md'), skillName, sourceId);
    } else if (transform === 'agentic-design-extract-safe') {
      applyDesignExtractSafeTransform(path.join(src, 'SKILL.md'), skillName, sourceId);
    } else if (transform === 'agentic-claude-video-safe') {
      applyClaudeVideoSafeTransform(src, path.join(src, 'SKILL.md'), skillName, sourceId);
    } else if (transform === 'agentic-humanizer-ethics') {
      applyHumanizerEthicsTransform(path.join(src, 'SKILL.md'));
    } else {
      throw new Error(`Unknown skill transform ${transform} for ${sourceId}:${skillName}`);
    }
  }
  return src;
}

function normalizeSkillFileCase(src, skillFile) {
  if (hasExactDirEntry(src, 'SKILL.md')) return;
  const alternate = path.join(src, skillFile);
  const text = fs.readFileSync(alternate, 'utf8');
  const tmp = path.join(src, `.overdrive-SKILL-${process.pid}-${Date.now()}.tmp`);
  fs.writeFileSync(tmp, text);
  for (const entry of fs.readdirSync(src)) {
    if (entry.toLowerCase() === 'skill.md' && entry !== 'SKILL.md') {
      fs.rmSync(path.join(src, entry), { force: true });
    }
  }
  const exact = path.join(src, 'SKILL.md');
  if (fs.existsSync(exact) && !hasExactDirEntry(src, 'SKILL.md')) fs.rmSync(exact, { force: true });
  fs.renameSync(tmp, exact);
  if (!hasExactDirEntry(src, 'SKILL.md')) {
    throw new Error(`Could not create exact SKILL.md directory entry in ${src}`);
  }
}

function applyGraphifySafeTransform(skillPath, skillName, sourceId) {
  let text = fs.readFileSync(skillPath, 'utf8');
  const replacement = `### Step 1 - Check whether Graphify is installed

Overdrive attempts to set up Graphify during install using \`${graphifyPackageSpec}\` through pipx or a managed venv, preferring Python 3.10-3.12 for the pinned dependency tree. It never uses sudo, never uses global pip, and never hard-fails the main install if setup is unavailable.

\`\`\`bash
command -v graphify >/dev/null 2>&1 || "$HOME/.overdrive/bin/graphify" --help >/dev/null 2>&1 || python3 -c "import graphify" 2>/dev/null
\`\`\`

If the check succeeds, continue to Step 2.

If Graphify is missing, tell the user:

\`\`\`text
Graphify is not available yet. Overdrive normally attempts setup during install.
To finish setup manually, run:
  pipx install --python python3.12 ${graphifyPackageSpec}

For PDF support:
  pipx inject graphifyy 'graphifyy[pdf]'
\`\`\`

If a Graphify graph already exists for this project, prefer querying it before broad \`rg\` exploration for relationship/orientation questions. If the graph is stale, recommend Graphify's own \`--watch\` or git-hook workflow; Overdrive must not run Graphify in the background itself.

When Graphify is unavailable, continue with normal repository exploration (\`rg\`, file reads, existing ovd-workflow state) and be clear that the graph-backed path was skipped.

`;
  const next = text.replace(/### Step 1 - Ensure graphify is installed[\s\S]*?(?=### Step 2 - Detect files)/i, replacement);
  if (next === text) throw new Error(`${sourceId}:${skillName} Graphify safety transform could not find the install section`);
  text = next;
  if (hasUnsafeGraphifyInstallInstruction(text)) {
    throw new Error(`${sourceId}:${skillName} Graphify safety transform left an unsafe auto-install instruction`);
  }
  fs.writeFileSync(skillPath, text);
}

function hasUnsafeGraphifyInstallInstruction(text) {
  const forbiddenBreakFlag = new RegExp(['--break', 'system', 'packages'].join('-'), 'i');
  return forbiddenBreakFlag.test(text) || /\|\|\s*pip install/i.test(text) || /\bpip(?:3)?\s+install\s+graphifyy/i.test(text);
}

function applyDesignExtractSafeTransform(skillPath, skillName, sourceId) {
  let text = fs.readFileSync(skillPath, 'utf8');
  text = text.replace(/^name:\s*extract-design$/m, 'name: design-extract');
  const safeBody = `## Prerequisites And Safety

Design Extract / designlang is optional in Overdrive. During install, Overdrive attempts browser support safely: it prefers an existing system Chrome/Chromium/Edge and only attempts a Playwright Chromium download when no system browser is found. It never uses sudo/elevation and never installs extensions, MCP servers, cookies, authenticated sessions, or global CLIs.

Before running extraction, check whether the tool path is available:

\`\`\`bash
designlang --help >/dev/null 2>&1 || npx --no-install designlang --help >/dev/null 2>&1
\`\`\`

If designlang is unavailable, tell the user the one-time runtime command and keep the fallback ready:

\`\`\`text
Design Extract browser support is normally prepared during Overdrive install.
To run extraction manually, use:
  npx designlang <url> --system-chrome

Use --system-chrome when possible to avoid downloading Playwright's bundled Chromium.
\`\`\`

Only extract public pages the user has permission to inspect. Respect site terms, robots guidance, rate limits, paywalls, logins, and private/customer data. Do not use cookies, authenticated sessions, or scraping workarounds unless the user explicitly confirms they have rights.

If the tool is missing or the user declines setup, proceed with normal design research from user-provided screenshots, source files, browser inspection, or manually supplied brand/design details.

## Process

1. **Confirm the URL and permission boundary.** Prefer one public URL first; avoid broad crawls unless the user asks.
2. **Run extraction only when designlang is available or the user has approved setup.**

\`\`\`bash
npx designlang <url> --system-chrome --screenshots
\`\`\`

For multi-page crawling, ask before using a depth greater than 1:

\`\`\`bash
npx designlang <url> --system-chrome --depth 3 --screenshots
\`\`\`

For dark mode:

\`\`\`bash
npx designlang <url> --system-chrome --dark --screenshots
\`\`\`

3. **Read the generated markdown file** to understand the design:

\`\`\`bash
cat design-extract-output/*-design-language.md
\`\`\`

4. **Present key findings** to the user:
   - Primary color palette with hex codes
   - Font families in use
   - Spacing system (base unit if detected)
   - WCAG accessibility score
   - Component patterns found
   - Notable design decisions (shadows, radii, motion, etc.)

5. **Offer next steps:**
   - Copy \`*-tailwind.config.js\` into their project
   - Import \`*-variables.css\` into their stylesheet
   - Paste \`*-shadcn-theme.css\` into globals.css for shadcn/ui users
   - Import \`*-theme.js\` for React/CSS-in-JS projects
   - Import \`*-figma-variables.json\` into Figma for designer handoff
   - Open \`*-preview.html\` in a browser for a visual overview
   - Use the markdown file as context for AI-assisted development

`;
  const next = text.replace(/## Prerequisites[\s\S]*?(?=## Output Files \(8\))/i, safeBody);
  if (next === text) throw new Error(`${sourceId}:${skillName} Design Extract safety transform could not find the prerequisite/process section`);
  text = next;
  if (hasUnsafeDesignExtractInstruction(text)) {
    throw new Error(`${sourceId}:${skillName} Design Extract safety transform left an unsafe install instruction`);
  }
  fs.writeFileSync(skillPath, text);
}

function hasUnsafeDesignExtractInstruction(text) {
  return /npm install -g/i.test(text) || /Install if needed/i.test(text);
}

function applyClaudeVideoSafeTransform(src, skillPath, skillName, sourceId) {
  let text = fs.readFileSync(skillPath, 'utf8');
  text = text.replace(/^name:\s*watch$/m, 'name: claude-video');
  text = text.replace(/^allowed-tools:.*$/m, 'allowed-tools: Bash, Read');
  text = text.replace(/\n  - AskUserQuestion/g, '');
  const safeStepZero = `## Step 0 - Safe setup preflight

Claude Video is optional in Overdrive. During install, Overdrive attempts safe non-privileged setup for ffmpeg/ffprobe and yt-dlp using Homebrew, winget, pipx, or a managed venv when available. It never uses sudo/elevation, never writes API keys, and never hard-fails the main install if optional video tooling cannot be installed.

Before a video run, check the local environment:

\`\`\`bash
python3 "\${CLAUDE_SKILL_DIR}/scripts/setup.py" --check
\`\`\`

On exit 0, continue to Step 1.

On non-zero exit, do not install tools from inside the agent session. Tell the user what is missing and offer the exact manual command:

\`\`\`text
Claude Video needs ffmpeg/ffprobe and yt-dlp for video frames and captions. Overdrive normally attempts setup during install.
Manual macOS setup: brew install ffmpeg yt-dlp
Manual Windows setup: winget install --id Gyan.FFmpeg -e && winget install --id yt-dlp.yt-dlp -e
Manual Linux setup: install ffmpeg with your distro package manager, then run pipx install yt-dlp.
Optional Whisper transcription needs a Groq or OpenAI API key configured by you.

Use --no-whisper to continue frames-only/captions-only when no API key is configured.
\`\`\`

Structured mode is still available for branching without printing secrets:

\`\`\`bash
python3 "\${CLAUDE_SKILL_DIR}/scripts/setup.py" --json
\`\`\`

If Whisper keys are missing, do not ask the user to paste a key into chat and do not store it from the conversation. Ask them to configure \`~/.config/watch/.env\` locally outside the conversation, or proceed with \`--no-whisper\`.

`;
  const next = text.replace(/## Step 0[\s\S]*?(?=## When to use)/i, safeStepZero);
  if (next === text) throw new Error(`${sourceId}:${skillName} Claude Video safety transform could not find Step 0`);
  text = next
    .replace(/On macOS with Homebrew, it auto-installs `ffmpeg` and `yt-dlp`\./gi, 'On macOS, it prints the commands the user can run for `ffmpeg` and `yt-dlp`.')
    .replace(/auto-installs/gi, 'is prepared by Overdrive install when possible')
    .replace(/run `python3 \{setup_py\}` to enable the Whisper fallback/gi, 'configure Whisper locally or rerun with `--no-whisper`')
    .replace(/Run `python3 \{setup_py\}` to enable Whisper, then re-run\._/gi, 'Configure Whisper locally or rerun with `--no-whisper`._')
    .replace(/- \*\*Setup preflight failed\*\*[\s\S]*?(?=\n- \*\*)/i, '- **Setup preflight failed** -> explain the missing binaries or key setup. Do not collect/write API keys automatically; ask the user to finish dependencies locally, or continue with `--no-whisper` when appropriate.');
  if (hasUnsafeClaudeVideoInstruction(text)) {
    throw new Error(`${sourceId}:${skillName} Claude Video safety transform left unsafe setup guidance`);
  }
  fs.writeFileSync(skillPath, text);
  writeClaudeVideoSetupChecker(src);
  stripClaudeVideoNestedPayload(src);
}

function hasUnsafeClaudeVideoInstruction(text) {
  return /Run installer/i.test(text) || /AskUserQuestion/i.test(text) || /write it into\s+`~\/\.config\/watch\/\.env`/i.test(text) || /auto-installs/i.test(text);
}

function writeClaudeVideoSetupChecker(src) {
  const setupPath = path.join(src, 'scripts', 'setup.py');
  if (!fs.existsSync(setupPath)) return;
  const text = `#!/usr/bin/env python3
"""Overdrive-safe Claude Video setup checker.

This script only checks local availability. It never installs packages, writes
API keys, or modifies user configuration.
"""

import argparse
import json
import os
import shutil
import sys


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    missing = [name for name in ("ffmpeg", "ffprobe", "yt-dlp") if shutil.which(name) is None]
    whisper_ready = bool(os.environ.get("GROQ_API_KEY") or os.environ.get("OPENAI_API_KEY"))
    result = {
        "ok": not missing,
        "missing": missing,
        "whisperReady": whisper_ready,
        "manual": {
            "macOS": "brew install ffmpeg yt-dlp",
            "Windows": "winget install --id Gyan.FFmpeg -e && winget install --id yt-dlp.yt-dlp -e",
            "Linux": "Install ffmpeg with your distro package manager, then run: pipx install yt-dlp"
        }
    }
    if args.json:
        print(json.dumps(result, indent=2))
    elif missing:
        print("Missing video helper(s): " + ", ".join(missing), file=sys.stderr)
        print("Manual macOS setup: brew install ffmpeg yt-dlp", file=sys.stderr)
        print("Use --no-whisper to continue without transcription when API keys are absent.", file=sys.stderr)
    else:
        print("Claude Video helpers are available.")
    return 0 if not missing else 2


if __name__ == "__main__":
    raise SystemExit(main())
`;
  fs.writeFileSync(setupPath, text);
}

function stripClaudeVideoNestedPayload(src) {
  for (const rel of ['commands', '.claude-plugin', '.codex-plugin', '.gitattributes', 'CHANGELOG.md', 'README.md', 'scripts/build-skill.sh']) {
    fs.rmSync(path.join(src, rel), { recursive: true, force: true });
  }
}

function applyHumanizerEthicsTransform(skillPath) {
  let text = fs.readFileSync(skillPath, 'utf8');
  if (text.includes('## Overdrive Ethics Note')) return;
  const note = `## Overdrive Ethics Note

Use humanizing to improve clarity, voice, rhythm, and reader trust while preserving meaning and facts. Do not fabricate authorship, fake lived experience, remove required AI disclosure, or make text deceptive.

`;
  text = text.replace(/## Your Task\n/, `${note}## Your Task\n`);
  fs.writeFileSync(skillPath, text);
}

function copySkillToTarget(ctx, options, src, skillName, sourceId, sourcePath, target, sourceMeta = {}) {
  if (isForbiddenSkillName(ctx, skillName)) {
    throw new Error(`Refusing to install forbidden skill: ${skillName}`);
  }
  assertSkill(src, skillName, sourceId);
  const dest = path.join(target.skillRootAbs, skillName);
  const decision = decideConflict(ctx, options, dest, skillName, target);
  if (decision.action === 'skip') {
    log(`${options.dryRun ? 'would skip' : 'skipped'} ${skillName} -> ${dest} (${decision.reason})`);
    ctx.lock.skipped.push({ source: sourceId, from: sourcePath, skill: skillName, root: target.skillRootAbs, target: target.key, reason: decision.reason });
    return;
  }
  if (options.dryRun) {
    log(`would install ${skillName} -> ${dest}${decision.action === 'backup' ? ' after backup' : ''}`);
  } else {
    fs.mkdirSync(target.skillRootAbs, { recursive: true });
    if (decision.action === 'backup') backupExisting(ctx, dest, skillName, target);
    else if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(src, dest, { recursive: true, filter: shouldCopy });
    writeMarker(ctx, dest, skillName, sourceId, sourcePath, target, sourceMeta);
    log(`installed ${skillName} -> ${dest}`);
  }
  ctx.lock.installed.push({ source: sourceId, from: sourcePath, skill: skillName, root: target.skillRootAbs, target: target.key });
}

function decideConflict(ctx, options, dest, skillName, target) {
  if (!fs.existsSync(dest)) return { action: 'install', reason: 'missing' };
  const managed = hasMarker(dest);
  if (options.conflict === 'force') return { action: 'replace', reason: 'force' };
  if (options.conflict === 'backup-and-replace') return { action: 'backup', reason: 'backup-and-replace' };
  if (managed) return { action: 'replace', reason: 'managed' };
  return { action: 'skip', reason: 'existing unmarked skill folder is preserved' };
}

function backupExisting(ctx, dest, skillName, target) {
  const stamp = safeTimestamp();
  const rel = homeRelativeRef(dest, ctx).replace(/^\$HOME\/?/, '').replace(/[^A-Za-z0-9._-]+/g, '/');
  const backupDest = path.join(ctx.home, backupRootName, 'backups', stamp, rel || `${target.key}/${skillName}`);
  fs.mkdirSync(path.dirname(backupDest), { recursive: true });
  fs.renameSync(dest, backupDest);
  ctx.lock.backups.push({ from: dest, to: backupDest, target: target.key, skill: skillName });
  log(`backed up ${dest} -> ${backupDest}`);
}

function writeMarker(ctx, dest, skillName, sourceId, sourcePath, target, sourceMeta = {}) {
  const marker = {
    managedBy: 'Overdrive',
    markerVersion: 1,
    kitName: ctx.manifest.name || 'overdrive',
    kitVersion: ctx.manifest.version || null,
    installedAt: new Date().toISOString(),
    scope: target.scope,
    target: target.key,
    targetLabel: target.label,
    skill: skillName,
    source: sourceId,
    sourcePath,
    sourceMeta
  };
  fs.writeFileSync(path.join(dest, markerFile), `${JSON.stringify(marker, null, 2)}\n`);
}

function installInstructionFiles(ctx, options, plan) {
  if (!plan.instructions.length) return;
  log(`Installing ${plan.instructions.length} instruction file(s)...`);
  for (const item of plan.instructions) {
    const src = path.resolve(ctx.kitDir, item.from);
    if (!fs.existsSync(src)) throw new Error(`Instruction source missing: ${item.from}`);
    const block = fs.readFileSync(src, 'utf8');
    if (options.dryRun) {
      log(`would upsert managed instruction block -> ${item.toAbs}`);
    } else {
      fs.mkdirSync(path.dirname(item.toAbs), { recursive: true });
      const current = fs.existsSync(item.toAbs) ? fs.readFileSync(item.toAbs, 'utf8') : '';
      fs.writeFileSync(item.toAbs, upsertManagedBlock(current, block, item.toAbs));
      log(`upserted managed instruction block -> ${item.toAbs}`);
    }
    ctx.lock.globalInstructions.push({
      runtime: item.key,
      from: item.from,
      to: item.toAbs,
      description: item.label
    });
  }
}

function uninstallMarkedSkills(ctx, options, plan) {
  const selectedSkills = options.skills || options.skipSkills ? resolveSelectedSkillNames(ctx, options) : null;
  let count = 0;
  for (const target of plan.skillTargets) {
    if (!fs.existsSync(target.skillRootAbs)) continue;
    for (const entry of fs.readdirSync(target.skillRootAbs)) {
      if (entry.startsWith('.') || entry === '.DS_Store') continue;
      const skillDir = path.join(target.skillRootAbs, entry);
      if (!hasMarker(skillDir)) continue;
      if (selectedSkills && !selectedSkills.has(entry)) continue;
      count += 1;
      if (options.dryRun) {
        log(`would remove marked skill folder -> ${skillDir}`);
      } else {
        fs.rmSync(skillDir, { recursive: true, force: true });
        log(`removed marked skill folder -> ${skillDir}`);
      }
      ctx.lock.uninstalled.push({ target: target.key, root: target.skillRootAbs, skill: entry, action: options.dryRun ? 'would-remove' : 'removed' });
    }
  }
  if (!count) log('No Overdrive-marked skill folders found in selected roots.');
}

function uninstallInstructionBlocks(ctx, options, plan) {
  for (const item of plan.instructions) {
    if (!fs.existsSync(item.toAbs)) continue;
    const current = fs.readFileSync(item.toAbs, 'utf8');
    const next = removeManagedBlock(current, item.toAbs);
    if (next === current) continue;
    if (options.dryRun) {
      log(`would remove managed instruction block -> ${item.toAbs}`);
    } else {
      fs.writeFileSync(item.toAbs, next);
      log(`removed managed instruction block -> ${item.toAbs}`);
    }
    ctx.lock.globalInstructions.push({
      runtime: item.key,
      to: item.toAbs,
      description: item.label,
      action: options.dryRun ? 'would-remove-managed-block' : 'removed-managed-block'
    });
  }
}

function installWorkflowRuntime(ctx, options, plan) {
  const version = readPackageVersion(ctx);
  const runtimeDir = workflowRuntimeVersionDir(ctx, version);
  const currentDir = workflowRuntimeCurrentDir(ctx);
  const shim = workflowShimPath(ctx);
  const ovdShim = path.join(workflowBaseDir(ctx), 'bin', 'ovd');
  if (options.dryRun) {
    log(`would install ovd-workflow runtime -> ${runtimeDir}`);
    log(`would update ovd-workflow runtime pointer -> ${currentDir}`);
    log(`would install ovd-workflow CLI shim -> ${shim}`);
    log(`would install ovd CLI alias -> ${ovdShim}`);
    return;
  }

  fs.rmSync(runtimeDir, { recursive: true, force: true });
  fs.mkdirSync(runtimeDir, { recursive: true });
  copyRuntimePayload(ctx, runtimeDir);
  writeRuntimeMarker(ctx, runtimeDir, version);
  fs.rmSync(currentDir, { recursive: true, force: true });
  try {
    fs.symlinkSync(runtimeDir, currentDir, 'dir');
  } catch (_error) {
    fs.cpSync(runtimeDir, currentDir, { recursive: true, filter: shouldCopy });
  }
  writeWorkflowShim(shim, currentDir);
  writeWorkflowShim(ovdShim, currentDir);
  log(`installed ovd-workflow runtime -> ${runtimeDir}`);
  if (plan.scope === 'global') log('ovd-workflow hooks will use the persistent runtime path, so npx temp folders are not referenced.');
}

function copyRuntimePayload(ctx, runtimeDir) {
  const pkg = JSON.parse(fs.readFileSync(path.join(ctx.kitDir, 'package.json'), 'utf8'));
  const files = ['package.json', ...(pkg.files || [])];
  const copied = new Set();
  for (const rel of files) {
    const cleanRel = String(rel).replace(/\/+$/, '');
    if (!cleanRel || copied.has(cleanRel)) continue;
    copied.add(cleanRel);
    const src = path.join(ctx.kitDir, cleanRel);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(runtimeDir, cleanRel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (fs.statSync(src).isDirectory()) {
      fs.cpSync(src, dest, { recursive: true, filter: shouldCopy });
    } else if (shouldCopy(src)) {
      fs.copyFileSync(src, dest);
      const mode = fs.statSync(src).mode;
      fs.chmodSync(dest, mode & 0o777);
    }
  }
  copyRuntimeDependencies(ctx, runtimeDir, pkg);
}

function copyRuntimeDependencies(ctx, runtimeDir, rootPkg) {
  const queue = Object.keys(rootPkg.dependencies || {});
  const copied = new Set();
  while (queue.length > 0) {
    const name = queue.shift();
    if (copied.has(name)) continue;
    copied.add(name);
    const src = path.join(ctx.kitDir, 'node_modules', name);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(runtimeDir, 'node_modules', name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.cpSync(src, dest, { recursive: true, filter: shouldCopyDependency });
    const depPkgPath = path.join(src, 'package.json');
    if (!fs.existsSync(depPkgPath)) continue;
    try {
      const depPkg = JSON.parse(fs.readFileSync(depPkgPath, 'utf8'));
      for (const t of Object.keys(depPkg.dependencies || {})) {
        if (!copied.has(t)) queue.push(t);
      }
    } catch (_e) {
      // malformed dep package.json — skip transitive walk for this dep
    }
  }
}

function shouldCopyDependency(src) {
  const base = path.basename(src);
  if (base === '.git' || base === '.github' || base === '.DS_Store') return false;
  if (base === 'CHANGELOG.md') return false;
  // 'bin', '.bin', 'node_modules' here assume the basename is a directory (the standard layout).
  // A future dep that ships a top-level file literally named e.g. 'bin' would be silently skipped.
  if (base === 'bin' || base === '.bin') return false;
  if (base === 'node_modules') return false;
  return true;
}

function writeWorkflowShim(shimPath, currentDir) {
  fs.mkdirSync(path.dirname(shimPath), { recursive: true });
  const label = 'Overdrive managed CLI shim';
  fs.writeFileSync(shimPath, `#!/bin/sh\n# ${label}\nexec node "${path.join(currentDir, 'bin/overdrive.js')}" "$@"\n`);
  fs.chmodSync(shimPath, 0o755);
}

function installWorkflowIntegrations(ctx, options, plan) {
  if (plan.scope !== 'global') return;
  const selected = plan.selectedKeys || [];
  for (const key of selected) {
    const def = targetDefs[key];
    if (!def?.workflow) continue;
    const workflow = def.workflow;
    if (workflow.hookStyle === 'cursor-rules') {
      installWorkflowRule(ctx, options, key, workflow);
      continue;
    }
    if (workflow.settings) installWorkflowHookSettings(ctx, options, key, workflow);
    if (workflow.commandsDir) installWorkflowCommands(ctx, options, key, workflow);
    if (workflow.rulesDir) installWorkflowRule(ctx, options, key, workflow);
  }
}

function uninstallWorkflowIntegrations(ctx, options, plan) {
  if (plan.scope !== 'global') return;
  const selected = plan.selectedKeys || [];
  for (const key of selected) {
    const def = targetDefs[key];
    if (!def?.workflow) continue;
    const workflow = def.workflow;
    if (workflow.settings) uninstallWorkflowHookSettings(ctx, options, key, workflow);
    if (workflow.commandsDir) uninstallWorkflowCommands(ctx, options, workflow);
    if (workflow.rulesDir) uninstallWorkflowRule(ctx, options, workflow);
  }
}

function uninstallWorkflowRuntime(ctx, options) {
  const base = workflowBaseDir(ctx);
  const shim = workflowShimPath(ctx);
  const ovdShim = path.join(base, 'bin', 'ovd');
  if (options.dryRun) {
    log(`would remove managed ovd-workflow runtime versions under -> ${path.join(base, 'runtime')}`);
    log(`would remove managed ovd-workflow CLI shim -> ${shim}`);
    log(`would remove managed ovd CLI alias -> ${ovdShim}`);
    log(`would remove managed helper tools under -> ${path.join(base, 'tools')}`);
    log(`would remove managed helper shims -> ${path.join(base, 'bin', 'graphify')}, ${path.join(base, 'bin', 'yt-dlp')}`);
    return;
  }
  if (fs.existsSync(shim) && fs.readFileSync(shim, 'utf8').includes('Overdrive managed CLI shim')) {
    fs.rmSync(shim, { force: true });
  }
  if (fs.existsSync(ovdShim) && fs.readFileSync(ovdShim, 'utf8').includes('Overdrive managed CLI shim')) {
    fs.rmSync(ovdShim, { force: true });
  }
  removeManagedRuntimeRoot(path.join(base, 'runtime'));
  removeManagedHelperTools(ctx);
  log('removed managed ovd-workflow runtime files');
}

function removeManagedHelperTools(ctx) {
  const base = workflowBaseDir(ctx);
  fs.rmSync(path.join(base, 'tools'), { recursive: true, force: true });
  for (const shimName of ['graphify', 'yt-dlp']) {
    const shim = path.join(base, 'bin', shimName);
    if (!fs.existsSync(shim)) continue;
    const text = fs.readFileSync(shim, 'utf8');
    if (text.includes(`${path.sep}.overdrive${path.sep}tools${path.sep}`) || text.includes('/.overdrive/tools/')) {
      fs.rmSync(shim, { force: true });
    }
  }
}

function removeManagedRuntimeRoot(runtimeRoot) {
  if (!fs.existsSync(runtimeRoot)) return;
  for (const entry of fs.readdirSync(runtimeRoot)) {
    const full = path.join(runtimeRoot, entry);
    if (entry === 'current') {
      fs.rmSync(full, { recursive: true, force: true });
    } else if (hasMarker(full)) {
      fs.rmSync(full, { recursive: true, force: true });
    }
  }
}

function installWorkflowHookSettings(ctx, options, targetKey, workflow) {
  const settingsPath = resolvePath(workflow.settings, ctx);
  const commandBase = workflowHookCommand(ctx, targetKey);
  if (options.dryRun) {
    log(`would upsert ovd-workflow hooks -> ${settingsPath}`);
    if (workflow.statusLine) log(`would upsert ovd-workflow statusLine -> ${settingsPath}`);
    return;
  }
  const settings = readJsonFile(settingsPath, {});
  settings.hooks = settings.hooks && typeof settings.hooks === 'object' ? settings.hooks : {};
  const pruned = pruneInvalidCommandHooks(settings);
  if (pruned) log(`removed ${pruned} invalid command hook(s) -> ${settingsPath}`);
  removeWorkflowHooks(settings);
  if (workflow.hookStyle === 'gemini') {
    addHookGroup(settings, 'SessionStart', 'startup|resume|clear', geminiHook('overdrive-session-start', `${commandBase} --event session-start`));
    addHookGroup(settings, 'BeforeAgent', '*', geminiHook('overdrive-prompt-submit', `${commandBase} --event prompt-submit`));
    addHookGroup(settings, 'AfterTool', '*', geminiHook('overdrive-post-tool-use', `${commandBase} --event post-tool-use`));
  } else {
    addHookGroup(settings, 'SessionStart', 'startup|resume|clear', claudeHook(`${commandBase} --event session-start`));
    addHookGroup(settings, 'UserPromptSubmit', null, claudeHook(`${commandBase} --event prompt-submit`));
    addHookGroup(settings, 'PostToolUse', 'Edit|Write|MultiEdit|NotebookEdit|Bash', claudeHook(`${commandBase} --event post-tool-use`));
  }
  if (workflow.statusLine) upsertWorkflowStatusLine(settings, `${commandBase} --event statusline`);
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
  log(`upserted ovd-workflow hooks -> ${settingsPath}`);
}

function uninstallWorkflowHookSettings(ctx, options, targetKey, workflow) {
  const settingsPath = resolvePath(workflow.settings, ctx);
  if (!fs.existsSync(settingsPath)) return;
  if (options.dryRun) {
    log(`would remove ovd-workflow hooks -> ${settingsPath}`);
    return;
  }
  const settings = readJsonFile(settingsPath, {});
  const pruned = pruneInvalidCommandHooks(settings);
  removeWorkflowHooks(settings);
  if (settings.statusLine?.command && isWorkflowCommand(settings.statusLine.command)) delete settings.statusLine;
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
  if (pruned) log(`removed ${pruned} invalid command hook(s) -> ${settingsPath}`);
  log(`removed ovd-workflow hooks -> ${settingsPath}`);
}

function installWorkflowCommands(ctx, options, targetKey, workflow) {
  const dir = resolvePath(workflow.commandsDir, ctx);
  const commands = workflowCommandBodies(ctx, targetKey);
  for (const [name, body] of Object.entries(commands)) {
    const dest = path.join(dir, `${name}.md`);
    if (options.dryRun) {
      log(`would upsert ovd-workflow slash command -> ${dest}`);
      continue;
    }
    writeManagedTextFile(dest, body, `ovd-workflow slash command ${name}`);
  }
}

function uninstallWorkflowCommands(ctx, options, workflow) {
  const dir = resolvePath(workflow.commandsDir, ctx);
  for (const name of ['ovd-status', 'ovd-resync', 'ovd-knowledge', 'ovd-doctor', 'ovd-checkpoint', 'ovd-usage']) {
    const dest = path.join(dir, `${name}.md`);
    if (!fs.existsSync(dest)) continue;
    if (options.dryRun) log(`would remove managed ovd-workflow slash command -> ${dest}`);
    else removeManagedTextFile(dest, `removed ovd-workflow slash command -> ${dest}`);
  }
}

function installWorkflowRule(ctx, options, targetKey, workflow) {
  const dir = resolvePath(workflow.rulesDir, ctx);
  const dest = path.join(dir, 'overdrive-workflow.mdc');
  const body = managedText(`ovd-workflow rule`, `---
description: Overdrive workflow awareness
alwaysApply: true
---

# Overdrive Workflow Awareness

For non-trivial project work, prefer the local ovd-workflow state in \`.overdrive/\` when it exists.

- Read \`.overdrive/state.md\` or active work only when it helps the current task.
- Read \`.overdrive/preferences.md\` at the start of meaningful work when it exists. Append short dated do-not/preference notes when the user clearly corrects a repeated mistake, says "never do X", or shows frustration; never store secrets.
- For reference docs, inspect \`.overdrive/knowledge-index.json\` first, then load only the relevant document or markdown cache.
- Keep workflow notes short after meaningful multi-step work.
- Use the installed runtime command when available: \`${workflowShimPath(ctx)} status\`, \`${workflowShimPath(ctx)} doctor\`, \`${workflowShimPath(ctx)} knowledge\`, \`${workflowShimPath(ctx)} checkpoint\`, \`${workflowShimPath(ctx)} usage\`.
- When the user asks "show usage", "what's burning tokens", or similar, run \`${workflowShimPath(ctx)} usage --project-dir "$PWD"\`. It is local, read-only, and token-only.
- Do not commit \`.overdrive/\`; it is local runtime state.
`);
  if (options.dryRun) {
    log(`would upsert ovd-workflow rule -> ${dest}`);
    return;
  }
  writeManagedTextFile(dest, body, `ovd-workflow rule for ${targetKey}`);
}

function uninstallWorkflowRule(ctx, options, workflow) {
  const dir = resolvePath(workflow.rulesDir, ctx);
  const dest = path.join(dir, 'overdrive-workflow.mdc');
  if (!fs.existsSync(dest)) return;
  if (options.dryRun) log(`would remove managed ovd-workflow rule -> ${dest}`);
  else removeManagedTextFile(dest, `removed ovd-workflow rule -> ${dest}`);
}

function workflowBaseDir(ctx) {
  return path.join(ctx.home, backupRootName);
}

function workflowRuntimeVersionDir(ctx, version) {
  return path.join(workflowBaseDir(ctx), 'runtime', version);
}

function workflowRuntimeCurrentDir(ctx) {
  return path.join(workflowBaseDir(ctx), 'runtime', 'current');
}

function workflowShimPath(ctx) {
  return path.join(workflowBaseDir(ctx), 'bin', 'overdrive');
}

function workflowHookCommand(ctx, targetKey) {
  const cli = path.join(workflowRuntimeCurrentDir(ctx), 'bin/overdrive.js');
  return `node ${shellQuote(cli)} hook --target ${shellQuote(targetKey)}`;
}

function claudeHook(command) {
  return {
    type: 'command',
    command,
    timeout: 5000
  };
}

function geminiHook(name, command) {
  return {
    name,
    type: 'command',
    command,
    timeout: 5000,
    description: 'Overdrive ovd-workflow state helper'
  };
}

function addHookGroup(settings, event, matcher, hook) {
  settings.hooks[event] = settings.hooks[event] || [];
  const group = { matcher: matcher || '', hooks: [hook] };
  settings.hooks[event].push(group);
}

function removeWorkflowHooks(settings) {
  if (!settings.hooks || typeof settings.hooks !== 'object') return;
  for (const [event, groups] of Object.entries(settings.hooks)) {
    if (!Array.isArray(groups)) continue;
    const nextGroups = [];
    for (const group of groups) {
      if (!group || !Array.isArray(group.hooks)) {
        nextGroups.push(group);
        continue;
      }
      const hooks = group.hooks.filter((hook) => !isWorkflowHook(hook));
      if (hooks.length) nextGroups.push({ ...group, hooks });
    }
    if (nextGroups.length) settings.hooks[event] = nextGroups;
    else delete settings.hooks[event];
  }
}

function pruneInvalidCommandHooks(settings) {
  if (!settings.hooks || typeof settings.hooks !== 'object') return 0;
  let removed = 0;
  for (const [event, groups] of Object.entries(settings.hooks)) {
    if (!Array.isArray(groups)) continue;
    const nextGroups = [];
    for (const group of groups) {
      if (!group || !Array.isArray(group.hooks)) {
        nextGroups.push(group);
        continue;
      }
      const hooks = group.hooks.filter((hook) => {
        const invalid = hook?.type === 'command' && typeof hook.command !== 'string';
        if (invalid) removed += 1;
        return !invalid;
      });
      if (hooks.length) nextGroups.push({ ...group, hooks });
    }
    if (nextGroups.length) settings.hooks[event] = nextGroups;
    else delete settings.hooks[event];
  }
  return removed;
}

function upsertWorkflowStatusLine(settings, command) {
  if (settings.statusLine?.command && !isWorkflowCommand(settings.statusLine.command)) return;
  settings.statusLine = {
    type: 'command',
    command,
    refreshInterval: 30,
    padding: 0
  };
}

function isWorkflowHook(hook) {
  return Boolean(hook?.command && isWorkflowCommand(hook.command)) || /^overdrive-/.test(hook?.name || '');
}

function isWorkflowCommand(command) {
  const tokens = shellWords(String(command || ''));
  if (!tokens.includes('hook')) return false;
  return tokens.some((token) => {
    const base = path.basename(token);
    return base === 'overdrive'
      || base === 'overdrive.js'
      || base === 'ovd';
  });
}

function shellWords(command) {
  const words = [];
  let current = '';
  let quote = null;
  let escaped = false;
  for (const ch of command) {
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      continue;
    }
    if (ch === '\'' || ch === '"') {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        words.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }
  if (current) words.push(current);
  return words;
}

function workflowCommandBodies(ctx, targetKey) {
  const shim = workflowShimPath(ctx);
  // Task 2.9 — legacy ovd-workflow slash commands now delegate to the v2 surface
  // and print a deprecation note. `ovd-usage` is independent (token analytics)
  // and stays unchanged. See impl plan §5A.2.
  const canonical = {
    'ovd-status': `Deprecated: this command now delegates to /ovd-plan. Consider using the new command directly.\nRun \`${shim} plan --project-dir "$PWD"\` and summarize the displayed plan tree and current state.`,
    'ovd-resync': `Deprecated: this command now delegates to /ovd-workflow map. Consider using the new command directly.\nRun \`${shim} workflow map --project-dir "$PWD"\` and follow the output to refresh the codebase analysis.`,
    'ovd-knowledge': `Deprecated: this command now delegates to /ovd-workflow knowledge. Consider using the new command directly.\nRun \`${shim} workflow knowledge --project-dir "$PWD"\`. If the user confirms, rerun with \`--apply\` to refresh the local knowledge vault index.`,
    'ovd-doctor': `Deprecated: this command now delegates to overdrive verify --plan. Consider using the new command directly.\nRun \`${shim} verify --plan --project-dir "$PWD"\` and explain any findings without changing project code.`,
    'ovd-checkpoint': `Deprecated: this command now delegates to /ovd-log handoff. Consider using the new command directly.\nRun \`${shim} log handoff --project-dir "$PWD"\` to create a full session handoff, then report the created file.`,
    'ovd-usage': `Run \`${shim} usage --project-dir "$PWD"\` to summarize local token usage. Do not print prompt or message content.`
  };
  return {
    ...Object.fromEntries(Object.entries(canonical).map(([name, body]) => [name, managedText(`ovd-workflow slash command ${name}`, body)]))
  };
}

function managedText(label, body) {
  return `<!-- ${managedTextNamespace}:${label} -->\n${body.trimEnd()}\n`;
}

function writeManagedTextFile(dest, body, label) {
  if (fs.existsSync(dest)) {
    const current = fs.readFileSync(dest, 'utf8');
    if (!hasManagedTextMarker(current)) {
      log(`skipped ${label} -> ${dest} (existing unmarked file is preserved)`);
      return;
    }
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, `${body.trimEnd()}\n`);
  log(`upserted ${label} -> ${dest}`);
}

function removeManagedTextFile(dest, message) {
  const current = fs.readFileSync(dest, 'utf8');
  if (!hasManagedTextMarker(current)) return;
  fs.rmSync(dest, { force: true });
  log(message);
}

function hasManagedTextMarker(text) {
  return text.includes(managedTextNamespace);
}

function writeRuntimeMarker(ctx, runtimeDir, version) {
  const marker = {
    managedBy: 'Overdrive',
    markerVersion: 1,
    kitName: ctx.manifest.name || 'overdrive',
    packageVersion: version,
    installedAt: new Date().toISOString(),
    purpose: 'ovd-workflow persistent runtime'
  };
  fs.writeFileSync(path.join(runtimeDir, markerFile), `${JSON.stringify(marker, null, 2)}\n`);
}

function readJsonFile(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_error) {
    return fallback;
  }
}

function installOfficialInstallers(ctx, options, plan) {
  if (options.skipOfficial || options.noToolInstall) {
    log(options.noToolInstall
      ? 'Skipping official installer-backed sources because --no-tool-install was set.'
      : 'Skipping official installer-backed sources by request.');
    return;
  }
  for (const installer of ctx.manifest.officialInstallers || []) {
    const installerSkills = installer.skills || [];
    if (installerSkills.length && !installerSkills.some((skill) => isSkillSelected(options, skill))) {
      log(`Skipping ${installer.id}: no selected skills from this installer.`);
      continue;
    }
    try {
      if (installer.type === 'playwright-cli-installer') installPlaywrightCli(ctx, options, plan, installer);
      else throw new Error(`Unknown official installer type: ${installer.type}`);
    } catch (error) {
      if (!installer.type || !['playwright-cli-installer'].includes(installer.type)) throw error;
      log(`Skipping ${installer.id}: ${error.message}`);
      ctx.lock.skipped.push({ source: installer.id, reason: 'official installer failed', error: error.message });
    }
  }
}

function setupOptionalTools(ctx, options, plan, ops = defaultToolOps(ctx)) {
  const setups = optionalToolSetupsForSelection(options);
  if (!setups.length) return [];

  log('Checking optional external tools for selected skills...');
  const skipReason = optionalToolInstallSkipReason(options, ops.env);
  const results = [];
  const seen = new Set();
  for (const setup of setups) {
    if (seen.has(setup.id)) continue;
    seen.add(setup.id);
    const result = runOptionalToolSetup(ctx, options, setup, skipReason, ops);
    results.push(result);
    ctx.lock.toolSetup.push(result);
    log(formatToolSetupResult(result));
  }
  printToolSetupSummary(results);
  return results;
}

function optionalToolSetupsForSelection(options) {
  const setups = [];
  const selected = (skill) => isSkillSelected(options, skill);
  if (!options.skipUpstream && selected('graphify')) setups.push(graphifyToolSetup());
  if (!options.skipUpstream && selected('design-extract')) setups.push(browserToolSetup());
  if (!options.skipUpstream && selected('claude-video')) {
    setups.push(ffmpegToolSetup());
    setups.push(ytDlpToolSetup());
  }
  if (selected('media-download')) setups.push(ytDlpToolSetup());
  return setups;
}

function runOptionalToolSetup(ctx, options, setup, skipReason, ops) {
  const suppressManualCommand = Boolean(options.noToolInstall);
  const base = {
    id: setup.id,
    label: setup.label,
    status: null,
    reason: null,
    manualCommand: suppressManualCommand ? null : setup.manualCommand(ops.platform),
    skills: setup.skills,
  };
  try {
    if (setup.check(ctx, ops)) return { ...base, status: 'present', reason: setup.presentReason || 'already available' };
    if (skipReason && options.noToolInstall) return { ...base, status: 'skipped', reason: skipReason };
    if (options.dryRun) return { ...base, status: 'would-attempt', reason: setup.dryRunReason || 'would attempt safe setup' };
    if (skipReason) return { ...base, status: 'skipped', reason: skipReason };
    const installResult = setup.install(ctx, ops);
    if (installResult?.ok && setup.check(ctx, ops)) {
      return { ...base, status: 'installed', reason: installResult.reason || 'installed with non-privileged setup' };
    }
    return {
      ...base,
      status: 'fallback',
      reason: installResult?.reason || 'setup did not make the tool available',
      manualCommand: installResult?.manualCommand || base.manualCommand
    };
  } catch (error) {
    return { ...base, status: 'fallback', reason: compactError(error), manualCommand: base.manualCommand };
  }
}

function optionalToolInstallSkipReason(options, env = process.env) {
  if (options.noToolInstall) return 'skipped by --no-tool-install';
  if (String(env.CI || '').toLowerCase() === 'true' && env.OVERDRIVE_TOOL_INSTALL !== '1') {
    return 'CI=true detected; rerun outside CI or set OVERDRIVE_TOOL_INSTALL=1 to opt in';
  }
  return null;
}

function graphifyToolSetup() {
  return {
    id: 'graphifyy',
    label: 'Graphify Python package',
    skills: ['graphify'],
    presentReason: 'graphify command/import is available',
    dryRunReason: `would install ${graphifyPackageSpec} with pipx or a managed venv using Python 3.10-3.12`,
    manualCommand: () => `pipx install --python python3.12 ${graphifyPackageSpec}`,
    check: (ctx, ops) => graphifyAvailable(ctx, ops),
    install: (ctx, ops) => installGraphify(ctx, ops)
  };
}

function ffmpegToolSetup() {
  return {
    id: 'ffmpeg',
    label: 'ffmpeg / ffprobe',
    skills: ['claude-video'],
    presentReason: 'ffmpeg and ffprobe are available',
    dryRunReason: 'would install ffmpeg with Homebrew or winget when available',
    manualCommand: (platform) => manualInstallCommand('ffmpeg', platform),
    check: (_ctx, ops) => ops.commandExists('ffmpeg') && ops.commandExists('ffprobe'),
    install: (_ctx, ops) => installPackageTool('ffmpeg', ops)
  };
}

function ytDlpToolSetup() {
  return {
    id: 'yt-dlp',
    label: 'yt-dlp',
    skills: ['claude-video', 'media-download'],
    presentReason: 'yt-dlp is available',
    dryRunReason: 'would install yt-dlp with Homebrew, winget, pipx, or a managed venv when available',
    manualCommand: (platform) => manualInstallCommand('yt-dlp', platform),
    check: (_ctx, ops) => ops.commandExists('yt-dlp'),
    install: (ctx, ops) => installYtDlp(ctx, ops)
  };
}

function browserToolSetup() {
  return {
    id: 'design-extract-browser',
    label: 'Design Extract browser support',
    skills: ['design-extract'],
    presentReason: 'system Chrome/Chromium/Edge browser is available',
    dryRunReason: 'would prefer system Chrome; if absent, would attempt a Playwright Chromium download',
    manualCommand: () => 'Install Google Chrome, or run: npx --yes playwright install chromium',
    check: (_ctx, ops) => systemBrowserAvailable(ops),
    install: (_ctx, ops) => installPlaywrightChromium(ops)
  };
}

function graphifyAvailable(ctx, ops) {
  return ops.commandExists('graphify')
    || ops.pathExists(path.join(workflowBaseDir(ctx), 'bin', 'graphify'))
    || ['python3.12', 'python3.11', 'python3.10', 'python3'].some((python) =>
      ops.commandExists(python) && Boolean(ops.runOptional(python, ['-c', 'import graphify']))
    );
}

function installGraphify(ctx, ops) {
  const selectedPython = selectGraphifyPython(ops);
  if (!selectedPython.ok) return selectedPython;
  if (ops.commandExists('pipx')) {
    ops.run('pipx', ['install', '--python', selectedPython.command, graphifyPackageSpec]);
    return { ok: true, reason: `installed ${graphifyPackageSpec} with pipx using ${selectedPython.command}` };
  }
  const venvDir = path.join(workflowBaseDir(ctx), 'tools', 'graphify-venv');
  const python = path.join(venvDir, ops.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const graphifyBin = path.join(venvDir, ops.platform === 'win32' ? 'Scripts/graphify.exe' : 'bin/graphify');
  fs.rmSync(venvDir, { recursive: true, force: true });
  ops.run(selectedPython.command, ['-m', 'venv', venvDir]);
  ops.run(python, ['-m', 'pip', 'install', '--upgrade', 'pip']);
  ops.run(python, ['-m', 'pip', 'install', graphifyPackageSpec]);
  if (ops.platform !== 'win32' && ops.pathExists(graphifyBin)) {
    const shimDir = path.join(workflowBaseDir(ctx), 'bin');
    fs.mkdirSync(shimDir, { recursive: true });
    const shim = path.join(shimDir, 'graphify');
    fs.writeFileSync(shim, `#!/usr/bin/env bash\nexec ${shellQuote(graphifyBin)} "$@"\n`);
    fs.chmodSync(shim, 0o755);
  }
  return { ok: true, reason: `installed ${graphifyPackageSpec} in managed venv` };
}

function selectGraphifyPython(ops) {
  const candidates = ['python3.12', 'python3.11', 'python3.10', 'python3'];
  const seen = new Set();
  const found = [];
  for (const command of candidates) {
    if (seen.has(command) || !ops.commandExists(command)) continue;
    seen.add(command);
    const version = ops.runOptional(command, ['-c', 'import sys; print(".".join(map(str, sys.version_info[:2])))']);
    if (!version) {
      found.push(`${command}: unknown`);
      continue;
    }
    found.push(`${command}: ${version}`);
    if (comparePythonVersion(version, '3.10') >= 0 && comparePythonVersion(version, '3.13') < 0) {
      return { ok: true, command, reason: `${command} ${version}` };
    }
  }
  const detail = found.length ? `found ${found.join(', ')}` : 'no python3.10-3.12 executable found';
  return {
    ok: false,
    reason: `Graphify pinned dependency setup currently requires Python 3.10-3.12; ${detail}`,
    manualCommand: `Install Python 3.10-3.12, then run: pipx install --python python3.12 ${graphifyPackageSpec}`
  };
}

function installPackageTool(tool, ops) {
  if (ops.platform === 'darwin' && ops.commandExists('brew')) {
    ops.run('brew', ['install', tool === 'ffmpeg' ? 'ffmpeg' : 'yt-dlp']);
    return { ok: true, reason: `installed ${tool} with Homebrew` };
  }
  if (ops.platform === 'win32' && ops.commandExists('winget')) {
    const id = tool === 'ffmpeg' ? 'Gyan.FFmpeg' : 'yt-dlp.yt-dlp';
    ops.run('winget', ['install', '--id', id, '-e', '--accept-source-agreements', '--accept-package-agreements']);
    return { ok: true, reason: `installed ${tool} with winget` };
  }
  return { ok: false, reason: 'no non-privileged package manager available', manualCommand: manualInstallCommand(tool, ops.platform) };
}

function installYtDlp(ctx, ops) {
  const packageManagerResult = installPackageTool('yt-dlp', ops);
  if (packageManagerResult.ok) return packageManagerResult;
  if (ops.commandExists('pipx')) {
    ops.run('pipx', ['install', 'yt-dlp']);
    return { ok: true, reason: 'installed yt-dlp with pipx' };
  }
  if (ops.commandExists('python3')) {
    const venvDir = path.join(workflowBaseDir(ctx), 'tools', 'yt-dlp-venv');
    const python = path.join(venvDir, ops.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    const ytDlpBin = path.join(venvDir, ops.platform === 'win32' ? 'Scripts/yt-dlp.exe' : 'bin/yt-dlp');
    ops.run('python3', ['-m', 'venv', venvDir]);
    ops.run(python, ['-m', 'pip', 'install', '--upgrade', 'pip']);
    ops.run(python, ['-m', 'pip', 'install', 'yt-dlp']);
    if (ops.platform !== 'win32' && ops.pathExists(ytDlpBin)) {
      const shimDir = path.join(workflowBaseDir(ctx), 'bin');
      fs.mkdirSync(shimDir, { recursive: true });
      const shim = path.join(shimDir, 'yt-dlp');
      fs.writeFileSync(shim, `#!/usr/bin/env bash\nexec ${shellQuote(ytDlpBin)} "$@"\n`);
      fs.chmodSync(shim, 0o755);
    }
    return { ok: true, reason: 'installed yt-dlp in managed venv' };
  }
  return packageManagerResult;
}

function installPlaywrightChromium(ops) {
  if (!ops.commandExists('npx')) {
    return { ok: false, reason: 'npx is not available', manualCommand: 'Install Google Chrome, or run: npx --yes playwright install chromium' };
  }
  ops.run('npx', ['--yes', 'playwright', 'install', 'chromium']);
  return { ok: true, reason: 'downloaded Playwright Chromium without sudo/elevation' };
}

function systemBrowserAvailable(ops) {
  const commands = ops.platform === 'win32'
    ? ['chrome', 'msedge']
    : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'msedge'];
  if (commands.some((cmd) => ops.commandExists(cmd))) return true;
  const macPaths = [
    '/Applications/Google Chrome.app',
    '/Applications/Chromium.app',
    '/Applications/Microsoft Edge.app',
  ];
  return ops.platform === 'darwin' && macPaths.some((p) => ops.pathExists(p));
}

function manualInstallCommand(tool, platform) {
  if (tool === 'ffmpeg') {
    if (platform === 'darwin') return 'brew install ffmpeg';
    if (platform === 'win32') return 'winget install --id Gyan.FFmpeg -e';
    return 'Install ffmpeg with your distro package manager, then rerun the installer or continue frames/captions-only.';
  }
  if (tool === 'yt-dlp') {
    if (platform === 'darwin') return 'brew install yt-dlp';
    if (platform === 'win32') return 'winget install --id yt-dlp.yt-dlp -e';
    return 'pipx install yt-dlp';
  }
  return '';
}

function defaultToolOps(ctx) {
  return {
    platform: process.platform,
    env: ctx.env || process.env,
    commandExists,
    pathExists,
    run,
    runOptional
  };
}

function comparePythonVersion(found, minimum) {
  const parse = (value) => String(value).split('.').map((part) => Number(part) || 0);
  const a = parse(found);
  const b = parse(minimum);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) - (b[index] || 0);
  }
  return 0;
}

function compactError(error) {
  return String(error?.message || error || 'unknown error').split('\n')[0];
}

function formatToolSetupResult(result) {
  const suffix = result.manualCommand && ['fallback', 'skipped'].includes(result.status)
    ? ` Manual: ${result.manualCommand}`
    : '';
  return `  - ${result.label}: ${result.status} (${result.reason})${suffix}`;
}

function printToolSetupSummary(results) {
  const fallback = results.filter((item) => item.status === 'fallback');
  if (!fallback.length) return;
  log('Optional tool setup fallbacks:');
  for (const item of fallback) log(`  - ${item.label}: ${item.manualCommand}`);
}

function pruneRetiredManagedSkills(ctx, options, plan) {
  const currentSkills = new Set(collectSkillCatalog(ctx).map((entry) => entry.name));
  let count = 0;
  for (const target of plan.skillTargets) {
    if (!fs.existsSync(target.skillRootAbs)) continue;
    for (const entry of fs.readdirSync(target.skillRootAbs)) {
      if (entry.startsWith('.') || entry === '.DS_Store' || currentSkills.has(entry)) continue;
      const skillDir = path.join(target.skillRootAbs, entry);
      if (!hasMarker(skillDir)) continue;
      count += 1;
      if (options.dryRun) {
        log(`would remove retired managed skill -> ${skillDir}`);
      } else {
        fs.rmSync(skillDir, { recursive: true, force: true });
        log(`removed retired managed skill -> ${skillDir}`);
      }
      ctx.lock.uninstalled.push({ target: target.key, root: target.skillRootAbs, skill: entry, action: options.dryRun ? 'would-remove-retired' : 'removed-retired' });
    }
  }
  if (count) log(`${options.dryRun ? 'would remove' : 'removed'} ${count} retired managed skill folder${count === 1 ? '' : 's'} no longer present in manifest.`);
}

function installPlaywrightCli(ctx, options, plan, installer) {
  if (!plan.skillTargets.length) return;
  if (!isSkillSelected(options, 'playwright-cli')) return;
  const packageSpec = installerPackage(installer, options);
  npmMetadata(ctx, options, packageSpec, installer.id, installer.repo, installer);
  if (options.dryRun) {
    log(`would run official Playwright CLI skill installer: npx -y ${packageSpec} install --skills agents`);
    log('would copy playwright-cli into selected skill roots subject to conflict policy');
    return;
  }
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'overdrive-playwright-'));
  const tempHome = path.join(tempRoot, 'home');
  fs.mkdirSync(tempHome, { recursive: true });
  try {
    log('Running official Playwright CLI skill installer...');
    run('npx', ['-y', packageSpec, 'install', '--skills', 'agents'], {
      cwd: tempRoot,
      env: { ...process.env, HOME: tempHome }
    });
    const src = path.join(tempRoot, '.agents', 'skills', 'playwright-cli');
    copySkill(ctx, options, plan, src, 'playwright-cli', installer.id, 'npx @playwright/cli install --skills agents', {
      package: installer.package,
      trackingPackage: installer.trackingPackage || null,
      requestedPackage: packageSpec,
      repo: installer.repo,
      mode: options.allowUpstreamDrift ? 'tracking' : 'verified'
    });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function installerPackage(installer, options) {
  if (options.allowUpstreamDrift && installer.trackingPackage) return installer.trackingPackage;
  return installer.package;
}

function npmMetadata(ctx, options, packageSpec, sourceId, fallbackRepo, installer = {}) {
  if (options.dryRun && options.skipOfficial) return null;
  try {
    const raw = run('npm', ['view', packageSpec, 'version', 'repository.url', 'gitHead', '--json'], { capture: true });
    const data = JSON.parse(raw);
    const entry = {
      id: sourceId,
      type: 'npm',
      package: packageSpec,
      pinnedPackage: installer.package || packageSpec,
      trackingPackage: installer.trackingPackage || null,
      mode: options.allowUpstreamDrift ? 'tracking' : 'verified',
      version: data.version || null,
      repo: data['repository.url'] || fallbackRepo || null,
      gitHead: data.gitHead || null
    };
    ctx.lock.sources.push(entry);
    return entry;
  } catch (error) {
    if (options.dryRun) {
      log(`would read npm metadata for ${packageSpec}`);
      return null;
    }
    throw error;
  }
}

function expectedSkillsByRoot(ctx, plan, options) {
  const localSkills = (ctx.manifest.localSkills || []).map((item) => item.to);
  const sourceSkills = options.skipUpstream ? [] : (ctx.manifest.sources || []).flatMap((source) => (source.includes || []).map((item) => item.to));
  const playwrightSkills = options.skipOfficial ? [] : skillsForInstaller(ctx, 'playwright-cli-installer');
  const selectedSkills = options.selectedSkillNames || resolveSelectedSkillNames(ctx, options);
  const base = [...new Set([...localSkills, ...sourceSkills, ...playwrightSkills])]
    .filter((skill) => selectedSkills.has(skill))
    .sort();
  const expected = new Map();
  for (const target of plan.skillTargets) {
    const skills = base.filter((skill) => !shouldSkipSkillForTarget(ctx, skill, target));
    expected.set(target.skillRootAbs, [...new Set(skills)].sort());
  }
  return expected;
}

function skillsForInstaller(ctx, type) {
  return (ctx.manifest.officialInstallers || [])
    .filter((installer) => installer.type === type)
    .flatMap((installer) => installer.skills || []);
}

function shouldSkipSkillForTarget(ctx, skillName, target) {
  const policies = ctx.manifest.rootPolicies || {};
  if ((policies.claudeOnlySkills || []).includes(skillName) && target.key !== 'claude') return true;
  for (const skip of policies.rootSkillSkips || []) {
    if (target.skillRootAbs.endsWith(skip.rootSuffix) && (skip.skills || []).includes(skillName)) return true;
  }
  return false;
}

function nonClaudeRuntimeConfigDirs(plan) {
  return plan.skillTargets
    .filter((target) => target.configDirAbs && target.key !== 'claude')
    .map((target) => target.configDirAbs)
    .sort((a, b) => b.length - a.length);
}

function findRouterRoot(plan) {
  const roots = [...plan.skillTargets].sort((a, b) => (a.key === 'agents' ? -1 : b.key === 'agents' ? 1 : 0));
  for (const target of roots) {
    const candidate = path.join(target.skillRootAbs, 'skill-router');
    if (fs.existsSync(path.join(candidate, 'SKILL.md'))) return candidate;
  }
  return null;
}

function removeNonClaudeStagingNoise(ctx, options, plan, reason) {
  let removed = 0;
  for (const configDir of nonClaudeRuntimeConfigDirs(plan)) {
    const tempDirs = [
      path.join(configDir, '.tmp', 'marketplaces'),
      path.join(configDir, '.tmp', 'plugins')
    ];
    for (const staging of tempDirs) {
      if (!fs.existsSync(staging)) continue;
      removed += 1;
      if (options.dryRun) log(`would remove stale installer temp directory -> ${staging}`);
      else fs.rmSync(staging, { recursive: true, force: true });
    }
  }
  if (removed && !options.dryRun) log(`removed ${removed} stale installer temp director${removed === 1 ? 'y' : 'ies'} (${reason})`);
}

function sanitizeNonClaudeRuntimePathReferences(ctx, options, plan, reason) {
  let changedFiles = 0;
  let replacementCount = 0;
  for (const configDir of nonClaudeRuntimeConfigDirs(plan)) {
    if (!fs.existsSync(configDir)) continue;
    for (const file of walkMarkdownAndToml(configDir, configDir, ctx)) {
      const rel = path.relative(configDir, file).split(path.sep).join('/');
      if (!runtimeSpecificFile(rel)) continue;
      let text;
      try {
        text = fs.readFileSync(file, 'utf8');
      } catch (error) {
        if (error.code === 'EPERM' || error.code === 'EACCES') continue;
        throw error;
      }
      if (!/(?:~|\$HOME)\/\.claude\b/.test(text)) continue;
      const result = applyRuntimePathReplacements(text, replacementsForFile(ctx, configDir, rel));
      if (result.text === text) continue;
      changedFiles += 1;
      replacementCount += result.count;
      if (!options.dryRun) fs.writeFileSync(file, result.text);
    }
  }
  if (replacementCount > 0) {
    log(`${options.dryRun ? 'would sanitize' : 'sanitized'} ${replacementCount} Claude Code home reference(s) in ${changedFiles} non-Claude runtime file(s) (${reason})`);
  }
}

function walkMarkdownAndToml(dir, configDir, ctx, files = []) {
  if (!fs.existsSync(dir)) return files;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'EPERM' || error.code === 'EACCES') return files;
    throw error;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!shouldSkipSanitizeDir(ctx, configDir, fullPath)) walkMarkdownAndToml(fullPath, configDir, ctx, files);
    } else if ((entry.name.endsWith('.md') || entry.name.endsWith('.toml')) && entry.name !== 'CHANGELOG.md') {
      files.push(fullPath);
    }
  }
  return files;
}

function shouldSkipSanitizeDir(ctx, configDir, fullPath) {
  const rel = path.relative(configDir, fullPath).split(path.sep).join('/');
  if (!rel || rel.startsWith('..')) return true;
  const first = rel.split('/')[0];
  if (['.git', '.tmp', 'node_modules', 'sessions', 'projects', 'logs', 'plugins', 'vendor_imports'].includes(first)) return true;
  if (homeRelativeRef(configDir, ctx) === '$HOME/.gemini' && first === 'config') return true;
  return false;
}

function replacementsForFile(ctx, configDir, rel) {
  const configRef = homeRelativeRef(configDir, ctx);
  const instructionRef = globalInstructionRefForConfigDir(ctx, configDir);
  const runtimeReplacements = [
    [/\$HOME\/\.claude\/skills/g, `${configRef}/skills`],
    [/~\/\.claude\/skills/g, `${configRef}/skills`],
    [/\$HOME\/\.claude\/commands/g, `${configRef}/commands`],
    [/~\/\.claude\/commands/g, `${configRef}/commands`],
    [/\$HOME\/\.claude\/agents/g, `${configRef}/agents`],
    [/~\/\.claude\/agents/g, `${configRef}/agents`],
    [/\$HOME\/\.claude\/CLAUDE\.md/g, instructionRef],
    [/~\/\.claude\/CLAUDE\.md/g, instructionRef],
    [/\$HOME\/\.claude\b/g, configRef],
    [/~\/\.claude\b/g, configRef]
  ];
  if (runtimeSpecificFile(rel)) return runtimeReplacements;
  return [
    [/\$HOME\/\.claude\/CLAUDE\.md/g, 'the Claude Code global instruction file'],
    [/~\/\.claude\/CLAUDE\.md/g, 'the Claude Code global instruction file'],
    [/\$HOME\/\.claude\/skills/g, 'the Claude Code skills directory'],
    [/~\/\.claude\/skills/g, 'the Claude Code skills directory'],
    [/\$HOME\/\.claude\/settings\.json/g, 'the Claude Code settings file'],
    [/~\/\.claude\/settings\.json/g, 'the Claude Code settings file'],
    [/\$HOME\/\.claude\/projects/g, 'the Claude Code projects directory'],
    [/~\/\.claude\/projects/g, 'the Claude Code projects directory'],
    [/\$HOME\/\.claude\/history\.jsonl/g, 'the active runtime chat history export if available'],
    [/~\/\.claude\/history\.jsonl/g, 'the active runtime chat history export if available'],
    [/\$HOME\/\.claude\b/g, 'the Claude Code config directory'],
    [/~\/\.claude\b/g, 'the Claude Code config directory']
  ];
}

function runtimeSpecificFile(rel) {
  return rel.startsWith('skills/playwright/');
}

function applyRuntimePathReplacements(text, replacements) {
  let next = text;
  let count = 0;
  for (const [pattern, replacement] of replacements) {
    next = next.replace(pattern, () => {
      count += 1;
      return replacement;
    });
  }
  return { text: next, count };
}

function findClaudeHomeLeaks(dir, configDir, leaks = []) {
  if (!fs.existsSync(dir)) return leaks;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'EPERM' || error.code === 'EACCES') return leaks;
    throw error;
  }
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!shouldSkipLeakDir(configDir, p)) findClaudeHomeLeaks(p, configDir, leaks);
    } else if ((entry.name.endsWith('.md') || entry.name.endsWith('.toml')) && entry.name !== 'CHANGELOG.md') {
      const rel = path.relative(configDir, p).split(path.sep).join('/');
      if (!runtimeSpecificFile(rel)) continue;
      const text = fs.readFileSync(p, 'utf8');
      const matches = text.match(/(?:~|\$HOME)\/\.claude\b/g);
      if (matches) leaks.push(`${rel} (${matches.length})`);
    }
  }
  return leaks;
}

function shouldSkipLeakDir(configDir, fullPath) {
  const rel = path.relative(configDir, fullPath).split(path.sep).join('/');
  if (!rel || rel.startsWith('..')) return true;
  const first = rel.split('/')[0];
  if (['.git', '.tmp', 'node_modules', 'sessions', 'projects', 'logs', 'plugins', 'vendor_imports'].includes(first)) return true;
  if (configDir.endsWith('/.gemini') && first === 'config') return true;
  return false;
}

function commandExists(cmd) {
  const result = spawnSync('sh', ['-lc', `command -v ${shellQuote(cmd)} >/dev/null 2>&1`], { stdio: 'ignore' });
  return result.status === 0;
}

function pathExists(value) {
  return fs.existsSync(value);
}

function resolvePath(value, ctx) {
  return value
    .replaceAll('$HOME', ctx.home)
    .replaceAll('${HOME}', ctx.home)
    .replaceAll('$USER', ctx.user)
    .replaceAll('${USER}', ctx.user);
}

function homeRelativeRef(absPath, ctx) {
  const normalized = path.resolve(absPath).split(path.sep).join('/');
  const normalizedHome = path.resolve(ctx.home).split(path.sep).join('/');
  if (normalized === normalizedHome) return '$HOME';
  if (normalized.startsWith(`${normalizedHome}/`)) return `$HOME/${normalized.slice(normalizedHome.length + 1)}`;
  return absPath;
}

function globalInstructionRefForConfigDir(ctx, configDir) {
  const ref = homeRelativeRef(configDir, ctx);
  if (ref === '$HOME/.codex') return '$HOME/.codex/AGENTS.md';
  if (ref === '$HOME/.gemini' || ref === '$HOME/.gemini/config') return '$HOME/.gemini/GEMINI.md';
  if (ref === '$HOME/.agents') return '$HOME/.agents/AGENTS.md';
  return `${ref}/AGENTS.md`;
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    ...options,
    env: options.env || process.env
  });
  if (result.status !== 0) {
    const stderr = result.stderr ? `\n${result.stderr}` : '';
    throw new Error(`${cmd} ${args.join(' ')} failed${stderr}`);
  }
  return result.stdout ? result.stdout.trim() : '';
}

function runOptional(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    timeout: options.timeout || 15000,
    env: options.env || process.env,
    cwd: options.cwd || process.cwd()
  });
  if (result.status !== 0) return null;
  return result.stdout ? result.stdout.trim() : '';
}

function shouldCopy(src) {
  const base = path.basename(src);
  if (base === '.git' || base === '.github' || base === 'node_modules' || base === '.DS_Store') return false;
  if (base === markerFile) return false;
  if (base === '.overdrive') return false;
  if (/^\.env(\.|$)/.test(base)) return false;
  if (['.aws', '.ssh', '.config', '.netrc', '.npmrc', '.pypirc', '.git-credentials'].includes(base)) return false;
  if (base === '.mcp.json' || base === 'credentials.json' || base === 'token.json') return false;
  return true;
}

function isForbiddenSkillName(ctx, skillName) {
  return (ctx.manifest.exclusions.forbiddenSkillNames || []).includes(skillName);
}

function assertSkill(src, skillName, sourceId) {
  const skillMd = path.join(src, 'SKILL.md');
  if (!hasExactDirEntry(src, 'SKILL.md')) throw new Error(`${sourceId}:${skillName} is missing exact SKILL.md directory entry at ${skillMd}`);
  const text = fs.readFileSync(skillMd, 'utf8');
  if (!/^---\n[\s\S]*?\n---/.test(text)) throw new Error(`${sourceId}:${skillName} has no YAML frontmatter`);
  if (!/^name:\s*.+$/m.test(text) || !/^description:\s*.+$/m.test(text)) {
    throw new Error(`${sourceId}:${skillName} frontmatter must include name and description`);
  }
}

function hasExactDirEntry(dir, name) {
  try {
    return fs.readdirSync(dir).includes(name);
  } catch (_error) {
    return false;
  }
}

function extractFrontmatter(text) {
  return text.match(/^---\n([\s\S]*?)\n---/)?.[1] || '';
}

function hasMarker(dir) {
  return fs.existsSync(path.join(dir, markerFile));
}

function readMarker(dir) {
  const markerPath = path.join(dir, markerFile);
  if (fs.existsSync(markerPath)) return JSON.parse(fs.readFileSync(markerPath, 'utf8'));
  return null;
}

function upsertManagedBlock(currentText, blockText, targetPath) {
  if (!blockText.includes(managedBlockStart) || !blockText.includes(managedBlockEnd)) {
    throw new Error(`Instruction source for ${targetPath} is missing managed block markers`);
  }
  const block = `${blockText.trimEnd()}\n`;
  const pattern = new RegExp(`${escapeRegExp(managedBlockStart)}[\\s\\S]*?${escapeRegExp(managedBlockEnd)}\\n?`);
  assertManagedMarkerPair(currentText, targetPath);
  if (pattern.test(currentText)) return currentText.replace(pattern, block);
  if (!currentText.trim()) return block;
  return `${currentText.trimEnd()}\n\n${block}`;
}

function removeManagedBlock(currentText, targetPath) {
  assertManagedMarkerPair(currentText, targetPath);
  const pattern = new RegExp(`\\n?${escapeRegExp(managedBlockStart)}[\\s\\S]*?${escapeRegExp(managedBlockEnd)}\\n?`, 'g');
  return currentText.replace(pattern, (match) => (match.startsWith('\n') && match.endsWith('\n') ? '\n' : '')).replace(/\n{3,}/g, '\n\n');
}

function assertManagedMarkerPair(text, targetPath) {
  const starts = (text.match(new RegExp(escapeRegExp(managedBlockStart), 'g')) || []).length;
  const ends = (text.match(new RegExp(escapeRegExp(managedBlockEnd), 'g')) || []).length;
  if (starts !== ends) {
    throw new Error(`Instruction file ${targetPath} has mismatched Overdrive managed block markers (${starts} start, ${ends} end). Restore or remove the orphan marker before running this command.`);
  }
  if (starts > 1) {
    throw new Error(`Instruction file ${targetPath} has ${starts} managed blocks. Keep one block or remove duplicates before running this command.`);
  }
}

function walkForBrokenSymlinks(dir, broken = []) {
  if (!fs.existsSync(dir)) return broken;
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    const st = fs.lstatSync(p);
    if (st.isSymbolicLink()) {
      if (!fs.existsSync(p)) broken.push(p);
    } else if (st.isDirectory()) {
      walkForBrokenSymlinks(p, broken);
    }
  }
  return broken;
}

function safeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function log(message) {
  console.log(message);
}

function supportsColor() {
  return process.stdout.isTTY && !process.env.NO_COLOR && !process.env.CI;
}

function style(text, kind) {
  if (!supportsColor()) return text;
  const codes = {
    bold: ['\x1b[1m', '\x1b[22m'],
    green: ['\x1b[32m', '\x1b[39m'],
    cyan: ['\x1b[36m', '\x1b[39m'],
    dim: ['\x1b[2m', '\x1b[22m']
  };
  const pair = codes[kind];
  return pair ? `${pair[0]}${text}${pair[1]}` : text;
}

function printWelcome(options, plan) {
  if (options.dryRun) return;
  console.log('');
  console.log(style('Overdrive is installed and working behind the scenes to improve the quality of what your agent produces.', 'green'));
  console.log('Restart or reload your coding agent so it re-indexes the updated skills.');
  console.log('');
  console.log('Useful commands:');
  console.log(`  ${style('overdrive status', 'cyan')}      show ovd-workflow project state`);
  console.log(`  ${style('overdrive doctor', 'cyan')}      check workflow health`);
  console.log(`  ${style('overdrive resync', 'cyan')}      refresh file-index state (use --apply to write)`);
  console.log(`  ${style('overdrive knowledge', 'cyan')}   refresh local knowledge vault index`);
  console.log(`  ${style('overdrive checkpoint', 'cyan')}  create a handoff snapshot`);
  console.log(`  ${style('overdrive route', 'cyan')}       record a short routing trace when useful`);
  console.log(`  ${style('overdrive usage', 'cyan')}      show local token usage without prices or telemetry`);
  console.log('');
  console.log('Natural triggers: ask for "show status", "show usage", "what should I consider?", "download this as mp3", "run React doctor", or any normal build/review task.');
  if (plan.scope === 'global') console.log('Hooks are advisory and fail open; your agent should keep working if ovd-workflow is unavailable.');
}

function printHelp() {
  console.log(`Overdrive

Usage:
  overdrive [install] [options]
  overdrive update-skills [options]
  overdrive self-update [options]
  overdrive check-updates [options]
  overdrive uninstall [options]
  overdrive verify [options]
  overdrive verify --plan [--project-dir PATH] [--json]
  overdrive list-targets
  overdrive status [--project-dir PATH] [--json]
  overdrive resync [--project-dir PATH] [--apply] [--json]
  overdrive knowledge [--project-dir PATH] [--apply] [--json]
  overdrive doctor [--project-dir PATH] [--json]
  overdrive checkpoint [--project-dir PATH] [--message TEXT]
  overdrive usage [--project-dir PATH] [--days N|--all] [--json]

Install options:
  --scope global|local              Install globally or into the current project.
  --tools auto|claude,codex,gemini,antigravity,cursor,agents
                                    Global targets. Default interactive option is auto.
  --project-dir PATH                Project directory for --scope local.
  --conflict POLICY                 preserve, backup-and-replace, replace-managed-only, or force.
  --dry-run                         Preview without writing files.
  --yes                             Accept recommended defaults.
  --force-targets                   Create manually selected global target dirs even if not detected.
  --all                             Install all skills without showing the interactive picker.
  --skills LIST                     Install only the comma-separated skill names.
  --skip-skills LIST                Install all except the comma-separated skill names.
  --all-skills                      For update-skills: refresh matching skill folders with backup-and-replace.
	  --allow-upstream-drift            Use tracking refs/latest packages instead of verified pinned sources.
	  --allow-dirty-self-update         For self-update: allow git pull with local uncommitted changes.
	  --no-tool-install                 Skip optional helper setup and official installer-backed npx sources.
	  --skip-upstream                   Skip GitHub skill sources.
  --skip-official-installers        Skip official npm installer-backed sources.

Workflow options:
  --json                            Print workflow command output as JSON.
  --apply                           For resync/knowledge: write refreshed indexes.
  --message TEXT                    For checkpoint: add a short handoff note.
  --days N                          For usage: scan the last N days. Default: 30.
  --all                             For usage: scan all readable local logs.

Examples:
  ./install.sh
  ./install.sh --scope global --tools auto --conflict preserve
  ./install.sh --scope global --tools auto --skills skill-router,planning-first,playwright-cli
  ./install.sh --scope global --tools auto --skip-skills connect,connect-apps
  ./install.sh --scope local --project-dir . --conflict replace-managed-only
  ./check-updates.sh
  ./update.sh
  ./update.sh --all-skills
  ./uninstall.sh --dry-run
  overdrive check-updates
  overdrive status
  overdrive doctor
  overdrive knowledge --apply
  overdrive checkpoint --message "before refactor"
  overdrive usage
  overdrive usage --days 7 --json
  overdrive update-skills --all-skills
  npx -y github:radustefandumitru/Overdrive -- --dry-run
  npx -y github:radustefandumitru/Overdrive check-updates
  npx -y github:radustefandumitru/Overdrive update-skills --all-skills
`);
}

module.exports = {
  main,
  runCli,
  targetDefs,
  buildInstallPlan,
  createContext,
  setupOptionalTools,
  optionalToolSetupsForSelection,
  optionalToolInstallSkipReason,
  copySkill,
  prepareSkillSource,
  hasExactDirEntry,
  isWorkflowCommand
};
