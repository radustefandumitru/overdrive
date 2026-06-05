#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const installer = require('../lib/installer');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const outPath = process.argv.includes('--stdout') ? null : path.join(root, 'docs/source-fidelity-report.md');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ovd-source-fidelity-'));

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed\n${result.stderr}`);
  return result.stdout.trim();
}

function walk(dir, base = dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir)) {
    if (entry === '.git' || entry === 'node_modules' || entry === '.DS_Store') continue;
    const full = path.join(dir, entry);
    const rel = path.relative(base, full).split(path.sep).join('/');
    const stat = fs.lstatSync(full);
    if (stat.isDirectory()) walk(full, base, files);
    else if (stat.isFile()) files.push(rel);
  }
  return files.sort();
}

function readSafe(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (_error) {
    return null;
  }
}

function detectLicense(checkout) {
  const candidates = fs.readdirSync(checkout).filter((entry) => /^licen[sc]e/i.test(entry) || /^copying/i.test(entry));
  if (!candidates.length) return 'not detected';
  const text = readSafe(path.join(checkout, candidates[0])) || '';
  if (/MIT License/i.test(text)) return `MIT (${candidates[0]})`;
  if (/Apache License/i.test(text)) return `Apache (${candidates[0]})`;
  return candidates[0];
}

function setupStrings(dir) {
  const patterns = [
    /npm install -g/ig,
    /pip(?:3)? install/ig,
    /--break-system-packages/ig,
    /\bnpx\b/ig,
    /\bbrew install\b/ig,
    /\bwinget install\b/ig,
    /AskUserQuestion/g
  ];
  const hits = [];
  for (const rel of walk(dir)) {
    const text = readSafe(path.join(dir, rel));
    if (!text) continue;
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) hits.push(`${rel}: ${[...new Set(matches)].join(', ')}`);
    }
  }
  return hits.slice(0, 20);
}

function compareFiles(originalDir, installedDir) {
  const original = new Set(walk(originalDir));
  const installed = new Set(walk(installedDir).filter((rel) => rel !== '.overdrive.json'));
  const copied = [...installed].filter((rel) => original.has(rel));
  const added = [...installed].filter((rel) => !original.has(rel));
  const omitted = [...original].filter((rel) => !installed.has(rel));
  const modified = copied.filter((rel) => {
    const before = readSafe(path.join(originalDir, rel));
    const after = readSafe(path.join(installedDir, rel));
    return before !== after;
  });
  return { copied: copied.length, added, omitted, modified };
}

function reportForInclude(source, include, checkout, tempHome) {
  const originalDir = path.resolve(checkout, include.from);
  const targetRoot = path.join(tempHome, 'skills');
  const ctx = installer.createContext({ dryRun: false, allowUpstreamDrift: false, conflict: 'preserve' }, { HOME: tempHome, OVERDRIVE_KIT_DIR: root });
  const plan = { skillTargets: [{ key: 'fidelity', label: 'Fidelity', scope: 'local', skillRootAbs: targetRoot }], instructions: [] };
  installer.copySkill(ctx, { dryRun: false, conflict: 'preserve' }, plan, originalDir, include.to, source.id, include.from, {
    repo: source.repo,
    ref: source.ref,
    trackingRef: source.trackingRef || null,
    requestedRef: source.ref,
    mode: 'verified',
    commit: source.ref,
    skillFile: include.skillFile || 'SKILL.md',
    transforms: include.transforms || []
  });
  const installedDir = path.join(targetRoot, include.to);
  const diff = compareFiles(originalDir, installedDir);
  const hits = setupStrings(installedDir);
  return [
    `### ${include.to}`,
    '',
    `- Source: ${source.id}`,
    `- Include path: \`${include.from}\``,
    `- Transform(s): ${(include.transforms || []).length ? include.transforms.join(', ') : 'none'}`,
    `- Copied file count: ${diff.copied}`,
    `- Modified file(s): ${diff.modified.length ? diff.modified.map((item) => `\`${item}\``).join(', ') : 'none'}`,
    `- Added file(s): ${diff.added.length ? diff.added.map((item) => `\`${item}\``).join(', ') : 'none'}`,
    `- Omitted file count: ${diff.omitted.length}`,
    `- Install/setup string hits: ${hits.length ? hits.map((item) => `\`${item}\``).join('; ') : 'none'}`,
    ''
  ].join('\n');
}

try {
  const sections = [
    '# Overdrive Source Fidelity Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    'This report clones pinned upstream sources and compares included skill folders with the Overdrive-installed output after safety transforms. It is a maintainer audit aid, not a runtime dependency.',
    ''
  ];
  for (const source of manifest.sources || []) {
    const checkout = path.join(tempRoot, source.id);
    run('git', ['clone', '--quiet', '--depth', '1', source.repo, checkout]);
    run('git', ['-C', checkout, 'fetch', '--quiet', '--depth', '1', 'origin', source.ref]);
    run('git', ['-C', checkout, 'checkout', '--quiet', '--detach', 'FETCH_HEAD']);
    sections.push(`## ${source.id}`, '', `- Repo: ${source.repo}`, `- Ref: ${source.ref}`, `- Tracking ref: ${source.trackingRef || 'n/a'}`, `- License: ${detectLicense(checkout)}`, '');
    for (const include of source.includes || []) {
      sections.push(reportForInclude(source, include, checkout, fs.mkdtempSync(path.join(tempRoot, `${source.id}-home-`))));
    }
  }
  const body = `${sections.join('\n')}\n`;
  if (outPath) {
    fs.writeFileSync(outPath, body);
    console.log(`Source fidelity report written to ${outPath}`);
  } else {
    process.stdout.write(body);
  }
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

