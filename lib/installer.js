const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline/promises');
const { spawnSync } = require('child_process');

const managedBlockStart = '<!-- ai-skill-setup:global-guidelines:start -->';
const managedBlockEnd = '<!-- ai-skill-setup:global-guidelines:end -->';
const markerFile = '.agentic-supercharge.json';
const backupRootName = '.agentic-supercharge';
const defaultConflict = 'preserve';
const validConflicts = new Set(['preserve', 'backup-and-replace', 'replace-managed-only', 'force']);
const validScopes = new Set(['global', 'local']);

const targetDefs = {
  claude: {
    label: 'Claude Code',
    kind: 'agent',
    globalSkillRoot: '$HOME/.claude/skills',
    globalInstruction: { from: 'global-instructions/CLAUDE.md', to: '$HOME/.claude/CLAUDE.md' },
    configDir: '$HOME/.claude',
    gsdRuntime: 'claude',
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
    gsdRuntime: 'codex',
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
    gsdRuntime: 'gemini',
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
    gsdRuntime: 'antigravity',
    detect: (ctx) => [
      pathExists('/Applications/Antigravity.app'),
      pathExists(resolvePath('$HOME/.gemini/config', ctx))
    ]
  },
  cursor: {
    label: 'Cursor',
    kind: 'agent',
    globalSkillRoot: '$HOME/.cursor/skills',
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
    supportsGsd: false
  },
  {
    key: 'local-cursor',
    label: 'Project Cursor',
    skillRoot: '.cursor/skills',
    scope: 'local',
    supportsGsd: false
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
    await runVerify(ctx, parsed.options);
    return;
  }
  await runInstall(ctx, parsed.options);
}

function parseArgs(argv) {
  const args = [...argv];
  let command = 'install';
  if (args[0] && !args[0].startsWith('-')) {
    const first = args.shift();
    if (['install', 'verify', 'list-targets', 'help'].includes(first)) {
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
    includeBundled: false,
    offline: false,
    scope: null,
    tools: null,
    projectDir: process.cwd(),
    conflict: null,
    forceTargets: false,
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
    else if (arg === '--include-bundled') options.includeBundled = true;
    else if (arg === '--offline') {
      options.offline = true;
      options.skipUpstream = true;
      options.skipOfficial = true;
      options.includeBundled = true;
    } else if (arg === '--scope' || arg.startsWith('--scope=')) {
      options.scope = readValue('--scope');
    } else if (arg === '--tools' || arg.startsWith('--tools=')) {
      options.tools = readValue('--tools');
    } else if (arg === '--project-dir' || arg.startsWith('--project-dir=')) {
      options.projectDir = readValue('--project-dir');
    } else if (arg === '--conflict' || arg.startsWith('--conflict=')) {
      options.conflict = readValue('--conflict');
    } else if (arg === '--force-targets') {
      options.forceTargets = true;
    } else if (arg === '--list-targets') {
      command = 'list-targets';
      options.command = command;
    } else if (arg === '--help' || arg === '-h') {
      command = 'help';
      options.command = command;
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

function createContext(options, env = process.env) {
  const kitDir = env.AGENTIC_SUPERCHARGE_KIT_DIR || env.AI_SKILL_KIT_DIR || path.resolve(__dirname, '..');
  const manifestPath = path.join(kitDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const home = env.HOME || os.homedir();
  const user = os.userInfo().username;
  return {
    kitDir,
    manifest,
    home,
    user,
    lock: {
      generatedAt: new Date().toISOString(),
      dryRun: options.dryRun,
      scope: null,
      selectedTargets: [],
      conflict: options.conflict || defaultConflict,
      sources: [],
      installed: [],
      skipped: [],
      backups: [],
      globalInstructions: []
    }
  };
}

async function runInstall(ctx, options) {
  await resolveInteractiveOptions(ctx, options, { forVerify: false });
  const plan = buildInstallPlan(ctx, options);
  ctx.lock.scope = plan.scope;
  ctx.lock.selectedTargets = plan.skillTargets.map((target) => ({
    key: target.key,
    label: target.label,
    skillRoot: target.skillRoot,
    scope: target.scope
  }));
  ctx.lock.conflict = options.conflict;

  printInstallSummary(ctx, options, plan);
  if (options.dryRun) {
    log('Dry run mode: no skill roots, instruction files, backups, or lockfiles will be changed.');
  }

  installBundled(ctx, options, plan);
  installGitSources(ctx, options, plan);
  installLocalSkills(ctx, options, plan);
  removeNonClaudeStagingNoise(ctx, options, plan, 'before official installers');
  sanitizeNonClaudeRuntimePathReferences(ctx, options, plan, 'before official installers');
  installOfficialInstallers(ctx, options, plan);
  removeNonClaudeStagingNoise(ctx, options, plan, 'after official installers');
  sanitizeNonClaudeRuntimePathReferences(ctx, options, plan, 'after official installers');
  installInstructionFiles(ctx, options, plan);
  removeNonClaudeStagingNoise(ctx, options, plan, 'after instruction files');
  sanitizeNonClaudeRuntimePathReferences(ctx, options, plan, 'after instruction files');

  if (!options.dryRun) {
    fs.writeFileSync(path.join(ctx.kitDir, 'sources.lock.json'), `${JSON.stringify(ctx.lock, null, 2)}\n`);
    log(`Wrote ${path.join(ctx.kitDir, 'sources.lock.json')}`);
  } else {
    log('Dry run complete. No files were changed.');
  }
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
      check(`${skill} installed in ${root}`, fs.existsSync(skillMd));
      if (fs.existsSync(skillMd)) {
        const fm = extractFrontmatter(fs.readFileSync(skillMd, 'utf8'));
        check(`${skill} in ${root} has name frontmatter`, /^name:\s*.+$/m.test(fm));
        check(`${skill} in ${root} has description frontmatter`, /^description:\s*.+$/m.test(fm));
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
    check(`${configDir} has no GSD-scanned Claude home path references`, leaks.length === 0);
    if (leaks.length) console.log(leaks.slice(0, 20).join('\n'));
  }

  console.log('\nRouter checks');
  const routerRoot = findRouterRoot(plan);
  const routerFiles = [
    'SKILL.md',
    'references/catalog.md',
    'references/frontend-design-routing.md',
    'references/gsd-routing.md',
    'references/compatibility-audit.md',
    'references/sharing-and-transfer.md',
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
    check('MCP guide does not prescribe GitHub MCP', !mcpText.includes('GitHub MCP'));
    check('MCP guide does not prescribe Supabase MCP', !mcpText.includes('Supabase MCP'));
    check('MCP guide warns against sharing secrets', mcpText.includes('Do not commit, zip, paste, screenshot, or publish API keys'));
  }

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
}

async function resolveInteractiveOptions(ctx, options) {
  const interactive = process.stdin.isTTY && process.stdout.isTTY && !options.yes && !options.dryRun;
  if (options.scope && !options.conflict) options.conflict = defaultConflict;
  if (options.yes) {
    options.scope = options.scope || 'global';
    if (options.scope === 'global') options.tools = options.tools || 'auto';
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
  } finally {
    rl.close();
  }
}

async function askScope(rl) {
  log('\nWhere do you want to install AgenticSupercharge?\n');
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
  log('\nHow should AgenticSupercharge handle existing skill folders?\n');
  log('1. Preserve existing files');
  log('   Recommended. Update AgenticSupercharge-managed skills, install missing skills, and skip unmarked existing folders.\n');
  log('2. Backup and replace');
  log('   Move existing skill folders to ~/.agentic-supercharge/backups/... before replacing them.\n');
  log('3. Replace managed only');
  log('   Replace only skills that already have an AgenticSupercharge marker. Skip unmarked folders.\n');
  log('4. Force replace');
  log('   Overwrite matching skill folders even if they are unmarked. Use only when you are sure.\n');
  return askChoice(rl, 'Choose a conflict policy', [
    ['preserve', 'Preserve existing files'],
    ['backup-and-replace', 'Backup and replace'],
    ['replace-managed-only', 'Replace managed only'],
    ['force', 'Force replace']
  ], 'preserve');
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
    instructions,
    selectedGsdRuntimes: [],
    supportsOfficialGsd: false
  };
}

function buildGlobalPlan(ctx, options, mode = {}) {
  const detected = detectTargets(ctx);
  let selectedKeys;
  if (!options.tools || options.tools === 'auto') {
    selectedKeys = Object.keys(targetDefs).filter((key) => key !== 'agents' && detected[key]?.available);
  } else {
    selectedKeys = options.tools.split(',').map((tool) => normalizeToolName(tool.trim())).filter(Boolean);
  }
  selectedKeys = [...new Set(selectedKeys.filter((key) => targetDefs[key]))];
  const missing = selectedKeys.filter((key) => key !== 'agents' && !detected[key]?.available);
  if (missing.length && !options.forceTargets && !mode.forVerify) {
    log(`Warning: selected target(s) not detected and will be skipped: ${missing.map((key) => targetDefs[key].label).join(', ')}`);
    selectedKeys = selectedKeys.filter((key) => key === 'agents' || detected[key]?.available);
  }
  if (selectedKeys.some((key) => key !== 'agents') && !selectedKeys.includes('agents')) selectedKeys.push('agents');
  if (!selectedKeys.length && !mode.forVerify) {
    throw new Error('No install targets selected. Use --tools claude,codex,cursor or install one supported coding agent first.');
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
      gsdRuntime: def.gsdRuntime || null,
      supportsGsd: Boolean(def.gsdRuntime)
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
    selectedGsdRuntimes: skillTargets.filter((target) => target.gsdRuntime).map((target) => target.gsdRuntime),
    supportsOfficialGsd: skillTargets.some((target) => target.gsdRuntime)
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
  console.log('AgenticSupercharge target detection\n');
  for (const [key, def] of Object.entries(targetDefs)) {
    const status = detected[key]?.available ? 'detected' : 'not detected';
    console.log(`${key.padEnd(12)} ${def.label.padEnd(20)} ${status}`);
    if (def.globalSkillRoot) console.log(`             skills: ${resolvePath(def.globalSkillRoot, ctx)}`);
    if (def.globalInstruction) console.log(`       instructions: ${resolvePath(def.globalInstruction.to, ctx)}`);
  }
  console.log('\nCursor note: custom skills go in ~/.cursor/skills globally or .cursor/skills locally. Do not write into ~/.cursor/skills-cursor.');
}

function printInstallSummary(ctx, options, plan) {
  console.log('\nAgenticSupercharge install plan');
  console.log(`Scope: ${plan.scope}${plan.projectDir ? ` (${plan.projectDir})` : ''}`);
  console.log(`Conflict policy: ${options.conflict}`);
  console.log('Skill targets:');
  for (const target of plan.skillTargets) {
    console.log(`  - ${target.label}: ${target.skillRootAbs}`);
  }
  if (plan.instructions.length) {
    console.log('Instruction files:');
    for (const item of plan.instructions) console.log(`  - ${item.label}: ${item.toAbs}`);
  }
  if (options.conflict === 'preserve') {
    console.log('Non-destructive mode: unmarked existing skill folders will be skipped; AgenticSupercharge-managed folders may be updated.');
  }
}

function installBundled(ctx, options, plan) {
  if (!options.includeBundled) {
    log('Skipping bundled snapshots by default. Use --include-bundled for private/offline installs.');
    return;
  }
  const bundled = path.join(ctx.kitDir, 'bundled', 'skills');
  if (!fs.existsSync(bundled)) {
    log('No bundled skills found; skipping bundled install.');
    return;
  }
  const names = fs.readdirSync(bundled)
    .filter((name) => !name.startsWith('.') && fs.existsSync(path.join(bundled, name, 'SKILL.md')))
    .sort();
  log(`Installing ${names.length} bundled snapshot skills...`);
  for (const name of names) {
    copySkill(ctx, options, plan, path.join(bundled, name), name, 'bundled-current-setup', `bundled/skills/${name}`, {});
  }
}

function installGitSources(ctx, options, plan) {
  if (options.skipUpstream) {
    log('Skipping GitHub upstream sources by request.');
    return;
  }
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-supercharge-git-'));
  try {
    for (const source of ctx.manifest.sources || []) {
      const checkout = path.join(tempRoot, source.id);
      log(`Cloning ${source.id} from ${source.repo}...`);
      run('git', ['clone', '--depth', '1', '--branch', source.ref, source.repo, checkout]);
      const commit = run('git', ['-C', checkout, 'rev-parse', 'HEAD'], { capture: true });
      ctx.lock.sources.push({ id: source.id, type: 'git', repo: source.repo, ref: source.ref, commit });
      for (const include of source.includes || []) {
        const src = path.resolve(checkout, include.from);
        copySkill(ctx, options, plan, src, include.to, source.id, include.from, { repo: source.repo, ref: source.ref, commit });
      }
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function installLocalSkills(ctx, options, plan) {
  const localSkills = ctx.manifest.localSkills || [];
  if (!localSkills.length) return;
  log(`Installing ${localSkills.length} local skill(s) from this kit...`);
  for (const item of localSkills) {
    const src = path.resolve(ctx.kitDir, item.from);
    copySkill(ctx, options, plan, src, item.to, 'local-kit', item.from, {});
  }
}

function copySkill(ctx, options, plan, src, skillName, sourceId, sourcePath, sourceMeta = {}) {
  for (const target of plan.skillTargets) {
    if (shouldSkipSkillForTarget(ctx, skillName, target)) {
      const message = `${skillName} skipped for ${target.label} by root policy`;
      log(message);
      ctx.lock.skipped.push({ skill: skillName, target: target.key, reason: 'root-policy' });
      continue;
    }
    copySkillToTarget(ctx, options, src, skillName, sourceId, sourcePath, target, sourceMeta);
  }
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
    managedBy: 'AgenticSupercharge',
    markerVersion: 1,
    kitName: ctx.manifest.name || 'agentic-supercharge',
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

function installOfficialInstallers(ctx, options, plan) {
  if (options.skipOfficial) {
    log('Skipping official installer-backed sources by request.');
    return;
  }
  for (const installer of ctx.manifest.officialInstallers || []) {
    if (installer.type === 'gsd-npm-installer') installGsd(ctx, options, plan, installer);
    else if (installer.type === 'playwright-cli-installer') installPlaywrightCli(ctx, options, plan, installer);
    else throw new Error(`Unknown official installer type: ${installer.type}`);
  }
}

function installGsd(ctx, options, plan, installer) {
  if (!plan.selectedGsdRuntimes.length) {
    log('Skipping GSD official installer because no selected target supports its runtime installer.');
    return;
  }
  npmMetadata(ctx, options, installer.package, installer.id, installer.repo);
  const runtimeInstalls = (installer.runtimeInstalls || []).filter((item) => plan.selectedGsdRuntimes.includes(item.runtime));
  if (!runtimeInstalls.length) return;
  const runnable = [];
  for (const item of runtimeInstalls) {
    const configDir = resolvePath(item.configDir, ctx);
    const conflicts = findUnmarkedGsdConflicts(configDir);
    const canRun = options.conflict === 'force' || options.conflict === 'backup-and-replace' || conflicts.length === 0 || hasMarker(path.join(configDir, 'get-shit-done'));
    if (!canRun) {
      log(`Skipping official GSD installer for ${item.runtime}: existing unmarked GSD files are preserved. Use --conflict backup-and-replace or --conflict force to refresh them.`);
      ctx.lock.skipped.push({ source: installer.id, runtime: item.runtime, reason: 'existing unmarked GSD files are preserved', conflicts: conflicts.slice(0, 10) });
      continue;
    }
    runnable.push(item);
  }
  if (options.dryRun) {
    for (const item of runnable) {
      const configDir = resolvePath(item.configDir, ctx);
      log(`would run: npx -y ${installer.package} ${item.args.join(' ')} --config-dir ${configDir}`);
    }
    if (plan.skillTargets.some((target) => target.key === 'agents') && runnable.length) log('would mirror GSD skills into selected shared .agents root');
    return;
  }
  for (const item of runnable) {
    const configDir = resolvePath(item.configDir, ctx);
    if (options.conflict === 'backup-and-replace') backupGsdRuntime(ctx, configDir, item.runtime);
    fs.mkdirSync(configDir, { recursive: true });
    log(`Running official GSD installer for ${item.runtime}...`);
    run('npx', ['-y', installer.package, ...item.args, '--config-dir', configDir]);
    markGsdRuntime(ctx, configDir, item.runtime, installer);
  }
  mirrorGsdToAgents(ctx, options, plan, installer);
}

function installPlaywrightCli(ctx, options, plan, installer) {
  if (!plan.skillTargets.length) return;
  npmMetadata(ctx, options, installer.package, installer.id, installer.repo);
  if (options.dryRun) {
    log(`would run official Playwright CLI skill installer: npx -y ${installer.package} install --skills agents`);
    log('would copy playwright-cli into selected skill roots subject to conflict policy');
    return;
  }
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-supercharge-playwright-'));
  const tempHome = path.join(tempRoot, 'home');
  fs.mkdirSync(tempHome, { recursive: true });
  try {
    log('Running official Playwright CLI skill installer...');
    run('npx', ['-y', installer.package, 'install', '--skills', 'agents'], {
      cwd: tempRoot,
      env: { ...process.env, HOME: tempHome }
    });
    const src = path.join(tempRoot, '.agents', 'skills', 'playwright-cli');
    copySkill(ctx, options, plan, src, 'playwright-cli', installer.id, 'npx @playwright/cli install --skills agents', { package: installer.package, repo: installer.repo });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function findUnmarkedGsdConflicts(configDir) {
  const conflicts = [];
  const gsdDir = path.join(configDir, 'get-shit-done');
  if (fs.existsSync(gsdDir) && !hasMarker(gsdDir)) conflicts.push(gsdDir);
  const skillsDir = path.join(configDir, 'skills');
  if (fs.existsSync(skillsDir)) {
    for (const entry of fs.readdirSync(skillsDir)) {
      if (!entry.startsWith('gsd-')) continue;
      const skillDir = path.join(skillsDir, entry);
      if (fs.existsSync(skillDir) && !hasMarker(skillDir)) conflicts.push(skillDir);
    }
  }
  return conflicts;
}

function backupGsdRuntime(ctx, configDir, runtime) {
  const stamp = safeTimestamp();
  const backupDir = path.join(ctx.home, backupRootName, 'backups', stamp, homeRelativeRef(configDir, ctx).replace(/^\$HOME\/?/, '').replace(/[^A-Za-z0-9._-]+/g, '/'));
  moveIfExists(ctx, path.join(configDir, 'get-shit-done'), path.join(backupDir, 'get-shit-done'), runtime);
  moveMatchingChildren(ctx, path.join(configDir, 'commands'), path.join(backupDir, 'commands'), runtime, (name) => name === 'gsd' || name.startsWith('gsd-'));
  moveMatchingChildren(ctx, path.join(configDir, 'agents'), path.join(backupDir, 'agents'), runtime, (name) => name.startsWith('gsd-'));
  moveMatchingChildren(ctx, path.join(configDir, 'hooks'), path.join(backupDir, 'hooks'), runtime, (name) => name.startsWith('gsd-'));
  const skillsDir = path.join(configDir, 'skills');
  if (fs.existsSync(skillsDir)) {
    for (const entry of fs.readdirSync(skillsDir).filter((name) => name.startsWith('gsd-'))) {
      const src = path.join(skillsDir, entry);
      const dest = path.join(backupDir, 'skills', entry);
      moveIfExists(ctx, src, dest, runtime);
    }
  }
}

function moveMatchingChildren(ctx, srcDir, backupDir, runtime, predicate) {
  if (!fs.existsSync(srcDir)) return;
  for (const entry of fs.readdirSync(srcDir)) {
    if (!predicate(entry)) continue;
    moveIfExists(ctx, path.join(srcDir, entry), path.join(backupDir, entry), runtime);
  }
}

function moveIfExists(ctx, src, dest, runtime) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.renameSync(src, dest);
  ctx.lock.backups.push({ from: src, to: dest, target: runtime, source: 'gsd-official' });
}

function markGsdRuntime(ctx, configDir, runtime, installer) {
  const rootMarkerTarget = { key: runtime, label: runtime, scope: 'global' };
  const gsdDir = path.join(configDir, 'get-shit-done');
  if (fs.existsSync(gsdDir)) writeMarker(ctx, gsdDir, 'get-shit-done-runtime', installer.id, installer.package, rootMarkerTarget, { package: installer.package, repo: installer.repo });
  const skillsDir = path.join(configDir, 'skills');
  if (!fs.existsSync(skillsDir)) return;
  for (const entry of fs.readdirSync(skillsDir).filter((name) => name.startsWith('gsd-'))) {
    const skillDir = path.join(skillsDir, entry);
    if (fs.existsSync(path.join(skillDir, 'SKILL.md'))) {
      writeMarker(ctx, skillDir, entry, installer.id, installer.package, rootMarkerTarget, { package: installer.package, repo: installer.repo });
    }
  }
}

function mirrorGsdToAgents(ctx, options, plan, installer) {
  const agentsTarget = plan.skillTargets.find((target) => target.key === 'agents');
  if (!agentsTarget) return;
  const sourceTargets = plan.skillTargets.filter((target) => target.gsdRuntime && fs.existsSync(target.skillRootAbs));
  const sourceTarget = sourceTargets.find((target) => target.key === 'codex') || sourceTargets[0];
  if (!sourceTarget) return;
  for (const name of fs.readdirSync(sourceTarget.skillRootAbs).filter((entry) => entry.startsWith('gsd-')).sort()) {
    const src = path.join(sourceTarget.skillRootAbs, name);
    if (fs.existsSync(path.join(src, 'SKILL.md'))) {
      copySkillToTarget(ctx, options, src, name, installer.id, `${sourceTarget.skillRootAbs}/${name}`, agentsTarget, { package: installer.package, repo: installer.repo, mirroredFrom: sourceTarget.key });
    }
  }
}

function npmMetadata(ctx, options, packageSpec, sourceId, fallbackRepo) {
  const packageName = packageSpec.replace(/@latest$/, '');
  if (options.dryRun && options.skipOfficial) return null;
  try {
    const raw = run('npm', ['view', packageName, 'version', 'repository.url', 'gitHead', '--json'], { capture: true });
    const data = JSON.parse(raw);
    const entry = {
      id: sourceId,
      type: 'npm',
      package: packageSpec,
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
  const sourceSkills = (ctx.manifest.sources || []).flatMap((source) => (source.includes || []).map((item) => item.to));
  const playwrightSkills = options.skipOfficial ? [] : skillsForInstaller(ctx, 'playwright-cli-installer');
  const gsdSkills = options.skipOfficial ? [] : skillsForInstaller(ctx, 'gsd-npm-installer');
  const base = [...new Set([...localSkills, ...sourceSkills, ...playwrightSkills])].sort();
  const anyGsdRuntime = plan.skillTargets.some((target) => target.gsdRuntime);
  const expected = new Map();
  for (const target of plan.skillTargets) {
    let skills = [...base];
    if (target.gsdRuntime || (target.key === 'agents' && anyGsdRuntime)) {
      skills = [...skills, ...gsdSkills];
    }
    skills = skills.filter((skill) => !shouldSkipSkillForTarget(ctx, skill, target));
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
      let text;
      try {
        text = fs.readFileSync(file, 'utf8');
      } catch (error) {
        if (error.code === 'EPERM' || error.code === 'EACCES') continue;
        throw error;
      }
      if (!/(?:~|\$HOME)\/\.claude\b/.test(text)) continue;
      const rel = path.relative(configDir, file).split(path.sep).join('/');
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
  if (['.git', '.tmp', 'node_modules', 'sessions', 'projects', 'logs'].includes(first)) return true;
  if (homeRelativeRef(configDir, ctx) === '$HOME/.gemini' && first === 'config') return true;
  return false;
}

function replacementsForFile(ctx, configDir, rel) {
  const configRef = homeRelativeRef(configDir, ctx);
  const instructionRef = globalInstructionRefForConfigDir(ctx, configDir);
  const runtimeReplacements = [
    [/\$HOME\/\.claude\/get-shit-done/g, `${configRef}/get-shit-done`],
    [/~\/\.claude\/get-shit-done/g, `${configRef}/get-shit-done`],
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
  return rel.startsWith('skills/gsd-') ||
    rel.startsWith('agents/gsd-') ||
    rel.startsWith('commands/gsd/') ||
    rel.startsWith('get-shit-done/') ||
    rel.startsWith('skills/playwright/');
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
      const text = fs.readFileSync(p, 'utf8');
      const matches = text.match(/(?:~|\$HOME)\/\.claude\b/g);
      if (matches) leaks.push(`${path.relative(configDir, p)} (${matches.length})`);
    }
  }
  return leaks;
}

function shouldSkipLeakDir(configDir, fullPath) {
  const rel = path.relative(configDir, fullPath).split(path.sep).join('/');
  if (!rel || rel.startsWith('..')) return true;
  const first = rel.split('/')[0];
  if (['.git', '.tmp', 'node_modules', 'sessions', 'projects', 'logs'].includes(first)) return true;
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

function shouldCopy(src) {
  const base = path.basename(src);
  if (base === '.git' || base === '.github' || base === 'node_modules' || base === '.DS_Store') return false;
  if (base === markerFile) return false;
  if (/^\.env(\.|$)/.test(base)) return false;
  if (base === '.mcp.json' || base === 'credentials.json' || base === 'token.json') return false;
  return true;
}

function isForbiddenSkillName(ctx, skillName) {
  return (ctx.manifest.exclusions.forbiddenSkillNames || []).includes(skillName);
}

function assertSkill(src, skillName, sourceId) {
  const skillMd = path.join(src, 'SKILL.md');
  if (!fs.existsSync(skillMd)) throw new Error(`${sourceId}:${skillName} is missing SKILL.md at ${skillMd}`);
  const text = fs.readFileSync(skillMd, 'utf8');
  if (!/^---\n[\s\S]*?\n---/.test(text)) throw new Error(`${sourceId}:${skillName} has no YAML frontmatter`);
  if (!/^name:\s*.+$/m.test(text) || !/^description:\s*.+$/m.test(text)) {
    throw new Error(`${sourceId}:${skillName} frontmatter must include name and description`);
  }
}

function extractFrontmatter(text) {
  return text.match(/^---\n([\s\S]*?)\n---/)?.[1] || '';
}

function hasMarker(dir) {
  return fs.existsSync(path.join(dir, markerFile));
}

function upsertManagedBlock(currentText, blockText, targetPath) {
  if (!blockText.includes(managedBlockStart) || !blockText.includes(managedBlockEnd)) {
    throw new Error(`Instruction source for ${targetPath} is missing managed block markers`);
  }
  const block = `${blockText.trimEnd()}\n`;
  const pattern = new RegExp(`${escapeRegExp(managedBlockStart)}[\\s\\S]*?${escapeRegExp(managedBlockEnd)}\\n?`);
  if (pattern.test(currentText)) return currentText.replace(pattern, block);
  if (!currentText.trim()) return block;
  return `${currentText.trimEnd()}\n\n${block}`;
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

function printHelp() {
  console.log(`AgenticSupercharge

Usage:
  agentic-supercharge [install] [options]
  agentic-supercharge verify [options]
  agentic-supercharge list-targets

Install options:
  --scope global|local              Install globally or into the current project.
  --tools auto|claude,codex,cursor  Global targets. Default interactive option is auto.
  --project-dir PATH                Project directory for --scope local.
  --conflict POLICY                 preserve, backup-and-replace, replace-managed-only, or force.
  --dry-run                         Preview without writing files.
  --yes                             Accept recommended defaults.
  --force-targets                   Create manually selected global target dirs even if not detected.
  --skip-upstream                   Skip GitHub skill sources.
  --skip-official-installers        Skip official npm installer-backed sources.
  --include-bundled                 Include private/offline bundled snapshots.
  --offline                         Use local/bundled only; no GitHub/npm sources.

Examples:
  ./install.sh
  ./install.sh --scope global --tools auto --conflict preserve
  ./install.sh --scope local --project-dir . --conflict replace-managed-only
  npx -y github:radustefandumitru/AgenticSupercharge -- --dry-run
`);
}

module.exports = {
  main,
  runCli,
  targetDefs,
  buildInstallPlan,
  createContext
};
