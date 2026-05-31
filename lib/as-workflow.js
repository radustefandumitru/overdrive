const crypto = require('crypto');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const workflowDirName = '.agenticsupercharge';
const markerFile = '.agentic-supercharge.json';

const defaultConfig = {
  version: 1,
  workflow_visibility: 'visible',
  auto_update_architecture: 'ask',
  context_budget_threshold: 0.6,
  git_mode: 'none',
  active_work_resolution: 'heuristic-then-ask',
  auto_archive_closed_after_days: 30,
  model_profile: 'balanced',
  knowledge_autosummarize: 'ask'
};

const requiredFiles = [
  'project.md',
  'state.md',
  'architecture.md',
  'constraints.md',
  'decisions.md',
  'preferences.md',
  'research.md',
  'changelog.md',
  'config.json',
  'file-index.json',
  'knowledge-index.json',
  'routes.jsonl',
  'work/_active.json'
];

const requiredDirs = [
  'reports',
  'handoffs',
  'knowledge',
  'work'
];

function workflowPath(projectDir) {
  return path.join(projectDir, workflowDirName);
}

function isWorkflowDisabled(env = process.env) {
  return String(env.AGENTIC_SUPERCHARGE_WORKFLOW || '').toLowerCase() === 'disabled';
}

function resolveProjectDir(value, env = process.env) {
  const raw = value || env.AGENTIC_SUPERCHARGE_PROJECT_DIR || env.CLAUDE_PROJECT_DIR || env.GEMINI_PROJECT_DIR || env.GEMINI_CWD || env.PWD || process.cwd();
  return findProjectRoot(path.resolve(raw));
}

function findProjectRoot(start) {
  let current = fs.existsSync(start) && fs.statSync(start).isFile() ? path.dirname(start) : start;
  const home = os.homedir();
  while (current && current !== path.dirname(current)) {
    if (hasProjectSignal(current)) return current;
    if (current === home) break;
    current = path.dirname(current);
  }
  return start;
}

function hasProjectSignal(dir) {
  const signals = [
    '.agenticsupercharge',
    '.git',
    'package.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    'bun.lockb',
    'pyproject.toml',
    'Cargo.toml',
    'go.mod',
    'composer.json',
    'Gemfile',
    'AGENTS.md',
    'CLAUDE.md',
    'GEMINI.md'
  ];
  return signals.some((signal) => fs.existsSync(path.join(dir, signal)));
}

function isSafeProjectDir(projectDir) {
  const resolved = path.resolve(projectDir);
  const home = path.resolve(os.homedir());
  if (resolved === '/' || resolved === home || resolved === path.dirname(home)) return false;
  return hasProjectSignal(resolved);
}

function initWorkflow(options = {}) {
  const env = options.env || process.env;
  if (isWorkflowDisabled(env)) {
    return { initialized: false, skipped: true, reason: 'disabled' };
  }
  const projectDir = resolveProjectDir(options.projectDir, env);
  if (!isSafeProjectDir(projectDir) && !options.force) {
    return { initialized: false, skipped: true, reason: 'no project signal', projectDir };
  }
  const root = workflowPath(projectDir);
  const dryRun = Boolean(options.dryRun);
  const now = new Date().toISOString();
  const created = [];

  const ensureDir = (rel) => {
    const full = path.join(root, rel);
    if (fs.existsSync(full)) return;
    created.push(path.join(workflowDirName, rel));
    if (!dryRun) fs.mkdirSync(full, { recursive: true });
  };
  const writeIfMissing = (rel, body) => {
    const full = path.join(root, rel);
    if (fs.existsSync(full)) return;
    created.push(path.join(workflowDirName, rel));
    if (!dryRun) {
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, body);
    }
  };

  ensureDir('.');
  for (const dir of requiredDirs) ensureDir(dir);
  writeIfMissing('project.md', `# Project\n\nInitialized by AgenticSupercharge on ${now}.\n\nKeep this file short: purpose, product, users, and local project facts only.\n`);
  writeIfMissing('state.md', `# State\n\n- Initialized: ${now}\n- Last reason: ${options.reason || 'manual'}\n- Current focus: Not set yet.\n`);
  writeIfMissing('architecture.md', '# Architecture\n\nNo architecture summary has been written yet. Run `agentic-supercharge resync --apply` after the agent has inspected the codebase.\n');
  writeIfMissing('constraints.md', '# Constraints\n\nRecord hard constraints, user preferences, platform limits, and project-specific rules here.\n');
  writeIfMissing('decisions.md', '# Decisions\n\nRecord durable decisions here with dates and short rationale.\n');
  writeIfMissing('preferences.md', '# Preferences\n\nDurable user preferences and do-not rules. The agent appends here when the user expresses a dislike, says "never do X", repeats a correction, or shows clear frustration, and reads it at the start of meaningful work to avoid repeating mistakes.\n\nKeep this lightweight and never store secrets, credentials, private tokens, or sensitive personal data.\n\n| Date | Preference / Do-not Rule | Reason / Signal |\n|---|---|---|\n');
  writeIfMissing('research.md', '# Research\n\nRecord research here. Take the most objective, evidence-based standpoint; note where the user\'s assumptions were challenged.\n\n| Date | Question | Sources | Finding |\n|---|---|---|---|\n');
  writeIfMissing('changelog.md', '# AS-Workflow Changelog\n\n');
  writeIfMissing('config.json', `${JSON.stringify(defaultConfig, null, 2)}\n`);
  if (!dryRun) ensureConfigDefaults(path.join(root, 'config.json'));
  writeIfMissing('file-index.json', `${JSON.stringify({ version: 1, generatedAt: now, files: [] }, null, 2)}\n`);
  writeIfMissing('knowledge-index.json', `${JSON.stringify({ version: 1, generatedAt: now, files: [] }, null, 2)}\n`);
  writeIfMissing('routes.jsonl', '');
  writeIfMissing('work/_active.json', `${JSON.stringify({ version: 1, active: null, updatedAt: now }, null, 2)}\n`);
  writeIfMissing(markerFile, `${JSON.stringify({ managedBy: 'AgenticSupercharge', markerVersion: 1, createdAt: now }, null, 2)}\n`);

  const gitignore = path.join(projectDir, '.gitignore');
  const entry = `${workflowDirName}/`;
  if (!dryRun) {
    const current = fs.existsSync(gitignore) ? fs.readFileSync(gitignore, 'utf8') : '';
    const lines = current.split(/\r?\n/).map((line) => line.trim());
    if (!lines.includes(entry) && !lines.includes(workflowDirName)) {
      const prefix = current.trim() ? `${current.trimEnd()}\n` : '';
      fs.writeFileSync(gitignore, `${prefix}${entry}\n`);
      created.push('.gitignore entry');
    }
  } else {
    created.push('.gitignore entry if missing');
  }

  return { initialized: true, projectDir, workflowDir: root, created };
}

function workflowExists(projectDir) {
  return fs.existsSync(workflowPath(projectDir));
}

function readWorkflow(projectDir) {
  const root = workflowPath(projectDir);
  const config = readJson(path.join(root, 'config.json'), null);
  const active = readJson(path.join(root, 'work/_active.json'), null);
  const fileIndex = readJson(path.join(root, 'file-index.json'), null);
  const knowledgeIndex = readJson(path.join(root, 'knowledge-index.json'), null);
  return { root, config, active, fileIndex, knowledgeIndex };
}

function status(options = {}) {
  const projectDir = resolveProjectDir(options.projectDir, options.env || process.env);
  const root = workflowPath(projectDir);
  if (!fs.existsSync(root)) {
    return {
      ok: true,
      initialized: false,
      projectDir,
      message: 'AS-Workflow is not initialized in this project.'
    };
  }
  const data = readWorkflow(projectDir);
  const active = data.active?.active || null;
  const fileCount = Array.isArray(data.fileIndex?.files) ? data.fileIndex.files.length : 0;
  const knowledgeCount = Array.isArray(data.knowledgeIndex?.files) ? data.knowledgeIndex.files.length : 0;
  const issues = doctor({ projectDir, json: true }).issues;
  return {
    ok: issues.length === 0,
    initialized: true,
    projectDir,
    workflowDir: root,
    activeWork: active,
    trackedFiles: fileCount,
    knowledgeDocs: knowledgeCount,
    issues
  };
}

function formatStatus(result) {
  if (!result.initialized) {
    return `${result.message}\nProject: ${result.projectDir}`;
  }
  const lines = [
    'AS-Workflow status',
    `Project: ${result.projectDir}`,
    `Workflow: ${result.workflowDir}`,
    `Active work: ${result.activeWork || 'none'}`,
    `Tracked files: ${result.trackedFiles}`,
    `Knowledge docs: ${result.knowledgeDocs || 0}`,
    `Doctor: ${result.issues.length ? `${result.issues.length} issue(s)` : 'clean'}`
  ];
  if (result.issues.length) {
    for (const issue of result.issues.slice(0, 5)) lines.push(`- ${issue}`);
  }
  return lines.join('\n');
}

function resync(options = {}) {
  const env = options.env || process.env;
  if (isWorkflowDisabled(env)) return { ok: true, disabled: true, changed: [] };
  const projectDir = resolveProjectDir(options.projectDir, env);
  if (!options.apply && !workflowExists(projectDir)) {
    return { ok: true, initialized: false, projectDir, apply: false, changed: [], removed: [], trackedFiles: 0 };
  }
  const init = options.apply ? initWorkflow({ projectDir, reason: 'resync', env, dryRun: false }) : { projectDir };
  const root = workflowPath(projectDir);
  const current = readJson(path.join(root, 'file-index.json'), { files: [] });
  const previous = new Map((current.files || []).map((file) => [file.path, file.sha256]));
  const files = scanProjectFiles(projectDir);
  const changed = files.filter((file) => previous.get(file.path) !== file.sha256).map((file) => file.path);
  const removed = [...previous.keys()].filter((file) => !files.some((entry) => entry.path === file));
  const generatedAt = new Date().toISOString();
  const next = { version: 1, generatedAt, files };
  const knowledgeResult = knowledge({ projectDir, apply: Boolean(options.apply), env });
  if (options.apply) {
    fs.writeFileSync(path.join(root, 'file-index.json'), `${JSON.stringify(next, null, 2)}\n`);
    appendFile(path.join(root, 'changelog.md'), `- ${generatedAt}: Resynced file index (${changed.length} changed, ${removed.length} removed) and knowledge index (${knowledgeResult.changed.length} changed, ${knowledgeResult.removed.length} removed).\n`);
    const report = path.join(root, 'reports', `${safeStamp(generatedAt)}-resync.md`);
    fs.writeFileSync(report, `# Resync Report\n\nGenerated: ${generatedAt}\n\nChanged files: ${changed.length}\nRemoved files: ${removed.length}\nTracked files: ${files.length}\nKnowledge docs: ${knowledgeResult.files.length}\n`);
  }
  return { ok: true, projectDir, apply: Boolean(options.apply), changed, removed, trackedFiles: files.length, knowledge: knowledgeResult };
}

function knowledge(options = {}) {
  const env = options.env || process.env;
  if (isWorkflowDisabled(env)) return { ok: true, disabled: true, changed: [], removed: [], files: [] };
  const projectDir = resolveProjectDir(options.projectDir, env);
  if (!options.apply && !workflowExists(projectDir)) {
    return { ok: true, initialized: false, projectDir, apply: false, changed: [], removed: [], files: [] };
  }
  const init = options.apply ? initWorkflow({ projectDir, reason: 'knowledge', env, dryRun: false }) : { projectDir };
  const root = workflowPath(projectDir);
  const indexPath = path.join(root, 'knowledge-index.json');
  const current = readJson(indexPath, { version: 1, generatedAt: null, files: [] });
  const previous = new Map((current.files || []).map((file) => [file.path, file]));
  const files = scanKnowledgeFiles(projectDir, { apply: Boolean(options.apply), previous });
  const changed = files.filter((file) => previous.get(file.path)?.sha256 !== file.sha256).map((file) => file.path);
  const removed = [...previous.keys()].filter((file) => !files.some((entry) => entry.path === file));
  const generatedAt = new Date().toISOString();
  const next = { version: 1, generatedAt, files };
  if (options.apply) {
    fs.writeFileSync(indexPath, `${JSON.stringify(next, null, 2)}\n`);
    appendFile(path.join(root, 'changelog.md'), `- ${generatedAt}: Reindexed knowledge vault (${changed.length} changed, ${removed.length} removed, ${files.length} tracked).\n`);
  }
  return {
    ok: true,
    projectDir: init.projectDir || projectDir,
    apply: Boolean(options.apply),
    changed,
    removed,
    files,
    trackedKnowledge: files.length
  };
}

function doctor(options = {}) {
  const projectDir = resolveProjectDir(options.projectDir, options.env || process.env);
  const root = workflowPath(projectDir);
  const issues = [];
  if (!fs.existsSync(root)) {
    return { ok: true, initialized: false, projectDir, issues: ['AS-Workflow is not initialized.'] };
  }
  for (const rel of requiredFiles) {
    if (!fs.existsSync(path.join(root, rel))) issues.push(`Missing ${workflowDirName}/${rel}`);
  }
  for (const rel of requiredDirs) {
    if (!fs.existsSync(path.join(root, rel))) issues.push(`Missing ${workflowDirName}/${rel}/`);
  }
  for (const rel of ['config.json', 'file-index.json', 'knowledge-index.json', 'work/_active.json']) {
    const parsed = readJson(path.join(root, rel), undefined);
    if (parsed === undefined) issues.push(`Invalid JSON in ${workflowDirName}/${rel}`);
  }
  const gitignore = path.join(projectDir, '.gitignore');
  if (!fs.existsSync(gitignore) || !fs.readFileSync(gitignore, 'utf8').split(/\r?\n/).map((line) => line.trim()).includes(`${workflowDirName}/`)) {
    issues.push(`${workflowDirName}/ is not listed in .gitignore`);
  }
  const active = readJson(path.join(root, 'work/_active.json'), null);
  if (active?.active && !fs.existsSync(path.join(root, 'work', active.active))) {
    issues.push(`Active work folder is missing: ${active.active}`);
  }
  const index = readJson(path.join(root, 'file-index.json'), null);
  if (index?.files) {
    for (const file of index.files.slice(0, 500)) {
      const full = path.join(projectDir, file.path);
      if (!fs.existsSync(full)) {
        issues.push(`Tracked file no longer exists: ${file.path}`);
      } else if (hashFile(full) !== file.sha256) {
        issues.push(`Tracked file changed since last resync: ${file.path}`);
      }
      if (issues.length > 25) break;
    }
  }
  checkKnowledgeIndex(projectDir, issues);
  return { ok: issues.length === 0, initialized: true, projectDir, workflowDir: root, issues };
}

function checkpoint(options = {}) {
  const env = options.env || process.env;
  if (isWorkflowDisabled(env)) return { ok: true, disabled: true, file: null };
  const init = initWorkflow({ projectDir: options.projectDir, reason: 'checkpoint', env, dryRun: false, force: true });
  const projectDir = init.projectDir || resolveProjectDir(options.projectDir, env);
  const root = workflowPath(projectDir);
  const now = new Date().toISOString();
  const file = path.join(root, 'handoffs', `${safeStamp(now)}-checkpoint.md`);
  const state = readText(path.join(root, 'state.md')).trim();
  const active = readJson(path.join(root, 'work/_active.json'), { active: null });
  const issues = doctor({ projectDir }).issues;
  const body = [
    '# AS-Workflow Checkpoint',
    '',
    `Created: ${now}`,
    `Project: ${projectDir}`,
    `Message: ${options.message || 'Manual checkpoint'}`,
    `Active work: ${active.active || 'none'}`,
    '',
    '## State',
    '',
    state || 'No state recorded.',
    '',
    '## Doctor',
    '',
    issues.length ? issues.map((issue) => `- ${issue}`).join('\n') : 'No workflow issues detected.',
    ''
  ].join('\n');
  fs.writeFileSync(file, body);
  appendFile(path.join(root, 'changelog.md'), `- ${now}: Created checkpoint ${path.basename(file)}.\n`);
  return { ok: true, projectDir, file };
}

function recordRoute(options = {}) {
  const env = options.env || process.env;
  if (isWorkflowDisabled(env)) return { ok: true, disabled: true, skipped: true, reason: 'disabled' };
  const projectDir = resolveProjectDir(options.projectDir, env);
  if (!workflowExists(projectDir)) return { ok: true, skipped: true, reason: 'workflow not initialized', projectDir };
  const root = workflowPath(projectDir);
  const entry = {
    ts: new Date().toISOString(),
    prompt: options.prompt || null,
    skills: splitCsv(options.skills),
    reason: options.reason || null,
    target: options.target || null
  };
  appendFile(path.join(root, 'routes.jsonl'), `${JSON.stringify(entry)}\n`);
  return { ok: true, projectDir, entry };
}

function recordDecision(options = {}) {
  const env = options.env || process.env;
  if (isWorkflowDisabled(env)) return { ok: true, disabled: true, skipped: true, reason: 'disabled' };
  if (!options.decision) return { ok: false, skipped: true, reason: 'missing decision' };

  const init = initWorkflow({ projectDir: options.projectDir, reason: 'decision', env, dryRun: false });
  const projectDir = init.projectDir || resolveProjectDir(options.projectDir, env);
  if (!init.initialized && !workflowExists(projectDir)) {
    return { ok: true, skipped: true, reason: init.reason || 'workflow not initialized', projectDir };
  }
  const root = workflowPath(projectDir);
  const decisionsPath = path.join(root, 'decisions.md');
  const existing = readText(decisionsPath);
  const contradiction = String(options.contradicts || '').trim();

  if (contradiction && !options.force && existing.toLowerCase().includes(contradiction.toLowerCase())) {
    return {
      ok: true,
      projectDir,
      needsConfirmation: true,
      skipped: true,
      reason: 'possible contradiction',
      contradicts: contradiction
    };
  }

  const now = new Date().toISOString();
  const rationale = options.rationale ? ` Rationale: ${options.rationale}` : '';
  appendFile(decisionsPath, `- ${now}: ${options.decision}${rationale}\n`);
  appendFile(path.join(root, 'changelog.md'), `- ${now}: Recorded decision.\n`);
  return { ok: true, projectDir, needsConfirmation: false, decision: options.decision };
}

function hook(options = {}) {
  try {
    return hookUnsafe(options);
  } catch (_error) {
    return { ok: true, suppressedError: true, output: '{}' };
  }
}

function hookUnsafe(options = {}) {
  const env = options.env || process.env;
  if (isWorkflowDisabled(env)) return { ok: true, disabled: true, output: hookJson(options.target, null, options.event) };
  const input = parseJson(options.stdin || '{}') || {};
  const projectDir = resolveProjectDir(options.projectDir || hookCwd(input), env);
  const event = options.event;
  const target = options.target || 'unknown';

  if (event === 'statusline') {
    return { ok: true, text: statuslineText(projectDir) };
  }

  const prompt = input.prompt || input.user_prompt || input.command_args || '';
  const existing = workflowExists(projectDir);
  const shouldInit = existing || event === 'prompt-submit' && isMeaningfulPrompt(prompt) && isSafeProjectDir(projectDir) || event === 'post-tool-use' && isWriteLikeTool(input) && isSafeProjectDir(projectDir);
  if (shouldInit && !existing) initWorkflow({ projectDir, reason: `hook:${event}`, env, dryRun: false });
  if (event === 'post-tool-use' && workflowExists(projectDir) && isWriteLikeTool(input)) {
    try {
      resyncTouchedFile(projectDir, input);
    } catch (_error) {
      // Hooks are advisory only.
    }
  }
  const context = workflowExists(projectDir) ? workflowContext(projectDir) : null;
  return { ok: true, output: hookJson(target, context, event) };
}

function workflowContext(projectDir) {
  if (!workflowExists(projectDir)) return null;
  const lines = [
    'AgenticSupercharge AS-Workflow is active for this project.',
    `Workflow folder: ${workflowDirName}/ (local, gitignored runtime state).`,
    'Use it lightly: read state.md, preferences.md, or active work only when it helps the current task.',
    'Run agentic-supercharge status or doctor when workflow health details matter.'
  ];
  return lines.join('\n');
}

function hookJson(target, context, event) {
  if (!context) return '{}';
  if (target === 'claude' || target === 'codex') {
    return JSON.stringify({
      hookSpecificOutput: {
        hookEventName: hookEventName(event),
        additionalContext: context
      }
    });
  }
  return '{}';
}

function hookEventName(event) {
  const names = {
    'session-start': 'SessionStart',
    'prompt-submit': 'UserPromptSubmit',
    'post-tool-use': 'PostToolUse'
  };
  return names[event] || event || 'SessionStart';
}

function statuslineText(projectDir) {
  const result = status({ projectDir });
  if (!result.initialized) return 'AS: off';
  const active = result.activeWork ? ` ${result.activeWork}` : ' idle';
  const health = result.issues.length ? ` ${result.issues.length} issue(s)` : ' clean';
  return `AS:${active} |${health}`;
}

function hookCwd(input) {
  return input.cwd || input.project_dir || input.workspace?.current_dir || input.workspace?.project_dir || null;
}

function isMeaningfulPrompt(prompt) {
  const text = String(prompt || '').trim().toLowerCase();
  if (text.length < 40) return false;
  return /\b(build|implement|create|add|fix|debug|refactor|design|audit|review|ship|release|integrate|migrate|update|verify|test|plan|research|analy[sz]e|improve)\b/.test(text);
}

function isWriteLikeTool(input) {
  const name = String(input.tool_name || input.toolName || input.name || '').toLowerCase();
  if (/(edit|write|replace|patch|multiedit|notebook|bash|shell)/.test(name)) return true;
  const command = String(input.tool_input?.command || input.toolInput?.command || '').toLowerCase();
  return /\b(apply_patch|sed -i|perl -pi|npm run|pnpm|yarn|git commit)\b/.test(command);
}

function resyncTouchedFile(projectDir, input) {
  const candidate = input.tool_input?.file_path || input.tool_input?.path || input.toolInput?.file_path || input.toolInput?.path;
  if (!candidate) return;
  const full = path.resolve(projectDir, candidate);
  if (!full.startsWith(`${projectDir}${path.sep}`) || !fs.existsSync(full) || !fs.statSync(full).isFile()) return;
  const rel = path.relative(projectDir, full).split(path.sep).join('/');
  if (shouldSkipRel(rel)) return;
  const root = workflowPath(projectDir);
  const indexPath = path.join(root, 'file-index.json');
  const index = readJson(indexPath, { version: 1, generatedAt: null, files: [] });
  const nextEntry = fileEntry(projectDir, full);
  const files = (index.files || []).filter((entry) => entry.path !== rel);
  files.push(nextEntry);
  files.sort((a, b) => a.path.localeCompare(b.path));
  fs.writeFileSync(indexPath, `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), files }, null, 2)}\n`);
}

function checkKnowledgeIndex(projectDir, issues) {
  const root = workflowPath(projectDir);
  const knowledgeRoot = path.join(root, 'knowledge');
  const index = readJson(path.join(root, 'knowledge-index.json'), null);
  if (!index || !Array.isArray(index.files)) return;
  const seen = new Set();
  for (const entry of index.files.slice(0, 500)) {
    if (!entry.path) {
      issues.push(`Knowledge entry is missing path`);
      continue;
    }
    seen.add(entry.path);
    const full = path.join(projectDir, entry.path);
    if (!full.startsWith(`${knowledgeRoot}${path.sep}`) && full !== knowledgeRoot) {
      issues.push(`Knowledge entry points outside vault: ${entry.path}`);
      continue;
    }
    if (!fs.existsSync(full)) {
      issues.push(`Knowledge file no longer exists: ${entry.path}`);
      continue;
    }
    if (entry.sha256 && hashFile(full) !== entry.sha256) {
      issues.push(`Knowledge file changed since last reindex: ${entry.path}`);
    }
    if (entry.markdownCache) {
      const cacheFull = path.join(projectDir, entry.markdownCache);
      if (!cacheFull.startsWith(`${knowledgeRoot}${path.sep}`) || !fs.existsSync(cacheFull)) {
        issues.push(`Knowledge markdown cache is missing: ${entry.markdownCache}`);
      }
    }
    if (entry.sourceType !== 'markdown' && entry.conversionStatus === 'converted' && !entry.markdownCache) {
      issues.push(`Knowledge converted file is missing markdown cache: ${entry.path}`);
    }
    if (issues.length > 25) break;
  }
  for (const entry of scanKnowledgeFiles(projectDir, { apply: false })) {
    if (!seen.has(entry.path)) {
      issues.push(`Knowledge file is not indexed: ${entry.path}`);
      if (issues.length > 25) break;
    }
  }
}

function scanProjectFiles(projectDir) {
  const files = [];
  walk(projectDir, projectDir, files);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function scanKnowledgeFiles(projectDir, options = {}) {
  const root = workflowPath(projectDir);
  const knowledgeRoot = path.join(root, 'knowledge');
  if (!fs.existsSync(knowledgeRoot)) return [];
  const files = [];
  walkKnowledge(projectDir, knowledgeRoot, files, options);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function walkKnowledge(projectDir, dir, files, options) {
  if (files.length >= 500) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_error) {
    return;
  }
  for (const entry of entries) {
    if (entry.name === '.DS_Store' || entry.name === '.cache') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkKnowledge(projectDir, full, files, options);
    } else if (entry.isFile()) {
      files.push(knowledgeEntry(projectDir, full, options));
    }
    if (files.length >= 500) break;
  }
}

function knowledgeEntry(projectDir, fullPath, options = {}) {
  const stat = fs.statSync(fullPath);
  const rel = path.relative(projectDir, fullPath).split(path.sep).join('/');
  const sha256 = hashFile(fullPath);
  const previous = options.previous?.get(rel);
  const sourceType = sourceTypeFor(fullPath);
  const entry = {
    path: rel,
    title: titleForKnowledgeFile(fullPath, sourceType),
    summary: previous?.sha256 === sha256 ? previous.summary || '' : '',
    topics: previous?.sha256 === sha256 && Array.isArray(previous.topics) ? previous.topics : [],
    sha256,
    bytes: stat.size,
    updatedAt: stat.mtime.toISOString(),
    sourceType
  };
  if (sourceType !== 'markdown') {
    const cache = markdownCacheFor(projectDir, fullPath, sha256, { apply: Boolean(options.apply) });
    if (cache.markdownCache) entry.markdownCache = cache.markdownCache;
    entry.conversionStatus = cache.status;
    if (cache.error) entry.conversionError = cache.error;
  }
  return entry;
}

function sourceTypeFor(fullPath) {
  const ext = path.extname(fullPath).toLowerCase();
  if (['.md', '.markdown', '.mdown'].includes(ext)) return 'markdown';
  if (['.txt', '.text', '.log'].includes(ext)) return 'text';
  if (['.csv', '.tsv', '.json', '.jsonl', '.yaml', '.yml', '.xml', '.html', '.htm'].includes(ext)) return 'data';
  if (['.pdf'].includes(ext)) return 'pdf';
  if (['.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'].includes(ext)) return 'office';
  return ext ? ext.slice(1) : 'unknown';
}

function titleForKnowledgeFile(fullPath, sourceType) {
  if (sourceType === 'markdown' || sourceType === 'text') {
    const text = readText(fullPath).split(/\r?\n/);
    const heading = text.find((line) => /^#\s+/.test(line));
    if (heading) return heading.replace(/^#\s+/, '').trim();
    const firstLine = text.find((line) => line.trim().length > 0);
    if (firstLine) return firstLine.trim().slice(0, 120);
  }
  return path.basename(fullPath).replace(/\.[^.]+$/, '');
}

function markdownCacheFor(projectDir, fullPath, sha256, options = {}) {
  const root = workflowPath(projectDir);
  const cacheDir = path.join(root, 'knowledge', '.cache');
  const safeBase = path.basename(fullPath).replace(/[^A-Za-z0-9._-]+/g, '-');
  const cacheFull = path.join(cacheDir, `${safeBase}-${sha256.slice(0, 12)}.md`);
  const cacheRel = path.relative(projectDir, cacheFull).split(path.sep).join('/');
  if (fs.existsSync(cacheFull)) return { status: 'converted', markdownCache: cacheRel };
  if (!options.apply) return { status: 'pending' };

  fs.mkdirSync(cacheDir, { recursive: true });
  if (canFallbackTextConvert(fullPath)) {
    const body = readText(fullPath);
    fs.writeFileSync(cacheFull, `# ${path.basename(fullPath)}\n\nConverted by AgenticSupercharge fallback text cache.\n\n\`\`\`\n${body}\n\`\`\`\n`);
    return { status: 'converted', markdownCache: cacheRel };
  }

  const markitdown = spawnSync('markitdown', [fullPath, '-o', cacheFull], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (markitdown.status === 0 && fs.existsSync(cacheFull)) {
    return { status: 'converted', markdownCache: cacheRel };
  }
  fs.rmSync(cacheFull, { force: true });
  const error = markitdown.error?.message || markitdown.stderr?.trim() || 'MarkItDown unavailable or unsupported for this file';
  return { status: 'unavailable', error: error.slice(0, 240) };
}

function canFallbackTextConvert(fullPath) {
  return ['.txt', '.text', '.log', '.csv', '.tsv', '.json', '.jsonl', '.yaml', '.yml', '.xml', '.html', '.htm'].includes(path.extname(fullPath).toLowerCase());
}

function walk(root, dir, files) {
  if (files.length >= 800) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_error) {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full).split(path.sep).join('/');
    if (shouldSkipRel(rel)) continue;
    if (entry.isDirectory()) walk(root, full, files);
    else if (entry.isFile()) files.push(fileEntry(root, full));
    if (files.length >= 800) break;
  }
}

function fileEntry(projectDir, fullPath) {
  const stat = fs.statSync(fullPath);
  return {
    path: path.relative(projectDir, fullPath).split(path.sep).join('/'),
    sha256: hashFile(fullPath),
    bytes: stat.size,
    updatedAt: stat.mtime.toISOString()
  };
}

function shouldSkipRel(rel) {
  const first = rel.split('/')[0];
  if (!rel || rel.startsWith('..')) return true;
  if (path.basename(rel) === '.DS_Store') return true;
  if (rel.split('/').includes(workflowDirName)) return true;
  if (path.basename(rel) === 'sources.lock.json') return true;
  if (['.git', workflowDirName, 'node_modules', '.next', 'dist', 'build', 'coverage', '.turbo', '.cache', '.venv', 'vendor'].includes(first)) return true;
  if (rel.includes('/node_modules/') || rel.includes('/.git/')) return true;
  if (/(\.png|\.jpg|\.jpeg|\.gif|\.webp|\.mp4|\.mov|\.zip|\.tgz|\.pdf|\.lock)$/i.test(rel) && rel !== 'package-lock.json') return true;
  return false;
}

function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_error) {
    return fallback;
  }
}

function ensureConfigDefaults(file) {
  const current = readJson(file, null);
  if (!current || typeof current !== 'object' || Array.isArray(current)) return;
  const next = { ...defaultConfig, ...current };
  if (JSON.stringify(next) !== JSON.stringify(current)) {
    fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch (_error) {
    return null;
  }
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (_error) {
    return '';
  }
}

function appendFile(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, text);
}

function splitCsv(value) {
  if (Array.isArray(value)) return value;
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function safeStamp(value) {
  return value.replace(/[:.]/g, '-');
}

module.exports = {
  workflowDirName,
  defaultConfig,
  initWorkflow,
  status,
  formatStatus,
  resync,
  knowledge,
  doctor,
  checkpoint,
  recordRoute,
  recordDecision,
  hook,
  resolveProjectDir,
  workflowPath,
  workflowExists
};
