#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

function main() {
  const options = parseArgs(args);
  const files = routeFiles(options.paths);
  const entries = files.flatMap((file) => readRoutes(file));
  const manifest = readJson(path.join(root, 'manifest.json'), { localSkills: [], sources: [], officialInstallers: [] });
  const allSkills = collectManifestSkills(manifest);
  const scorecard = readJson(path.join(root, 'evals/scorecard-results.json'), { results: [] });
  const summary = analyze(entries, allSkills, scorecard);
  const markdown = renderMarkdown(summary, files, options.paths);
  const out = options.out || path.join(root, 'docs/catalog-health.md');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${markdown.trimEnd()}\n`);
  if (options.json) console.log(JSON.stringify(summary, null, 2));
  else console.log(`Catalog health report written to ${path.relative(process.cwd(), out)}`);
}

function parseArgs(argv) {
  const paths = [];
  let out = null;
  let json = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const readValue = (name) => {
      if (arg.includes('=')) return arg.slice(arg.indexOf('=') + 1);
      i += 1;
      if (i >= argv.length) throw new Error(`${name} requires a value`);
      return argv[i];
    };
    if (arg === '--out' || arg.startsWith('--out=')) out = path.resolve(readValue('--out'));
    else if (arg === '--json') json = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/analyze-routes.js [routes.jsonl|directory ...] [--out docs/catalog-health.md] [--json]');
      process.exit(0);
    } else {
      paths.push(path.resolve(arg));
    }
  }
  return { paths, out, json };
}

function routeFiles(inputPaths) {
  const candidates = inputPaths.length ? inputPaths : [path.join(root, '.agenticsupercharge/routes.jsonl')];
  const files = [];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const stat = fs.statSync(candidate);
    if (stat.isFile() && candidate.endsWith('.jsonl')) files.push(candidate);
    else if (stat.isDirectory()) findRouteFiles(candidate, files);
  }
  return [...new Set(files)].sort();
}

function findRouteFiles(dir, files) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_error) {
    return;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.cache') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findRouteFiles(full, files);
    else if (entry.isFile() && entry.name === 'routes.jsonl') files.push(full);
  }
}

function readRoutes(file) {
  const entries = [];
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
  for (const [index, line] of lines.entries()) {
    try {
      const entry = JSON.parse(line);
      entries.push({ ...entry, _file: file, _line: index + 1 });
    } catch (_error) {
      entries.push({ _invalid: true, _file: file, _line: index + 1, skills: [] });
    }
  }
  return entries;
}

function collectManifestSkills(manifest) {
  return [
    ...(manifest.localSkills || []).map((skill) => skill.to),
    ...(manifest.sources || []).flatMap((source) => (source.includes || []).map((include) => include.to)),
    ...(manifest.officialInstallers || []).flatMap((installer) => installer.skills || [])
  ].filter(Boolean).sort();
}

function analyze(entries, allSkills, scorecard) {
  const frequency = new Map(allSkills.map((skill) => [skill, 0]));
  const pairs = new Map();
  let noSkill = 0;
  let invalid = 0;

  for (const entry of entries) {
    if (entry._invalid) invalid += 1;
    const skills = unique((entry.skills || []).filter(Boolean));
    if (!skills.length) noSkill += 1;
    for (const skill of skills) frequency.set(skill, (frequency.get(skill) || 0) + 1);
    for (let i = 0; i < skills.length; i += 1) {
      for (let j = i + 1; j < skills.length; j += 1) {
        const pair = [skills[i], skills[j]].sort().join(' + ');
        pairs.set(pair, (pairs.get(pair) || 0) + 1);
      }
    }
  }

  const scored = scorecardSummary(scorecard);
  const counts = [...frequency.values()].sort((a, b) => a - b);
  const q1 = counts.length && entries.length ? counts[Math.floor(counts.length * 0.25)] : null;
  const enoughRouteData = entries.length >= 20;
  const bottomQuartileCandidates = enoughRouteData ? [...frequency.entries()]
    .filter(([, count]) => count <= q1)
    .map(([skill, count]) => ({
      skill,
      routeCount: count,
      scoreDelta: scored.bySkill.get(skill)?.averageDelta ?? null,
      note: 'Review/fold/remove candidate only; rare route use is not proof of low value.'
    }))
    .slice(0, 50) : [];

  return {
    generatedAt: new Date().toISOString(),
    routeFilesAnalyzed: entries.length ? unique(entries.map((entry) => entry._file)).length : 0,
    totalRoutes: entries.length,
    invalidLines: invalid,
    noSkillMatched: noSkill,
    noSkillRate: entries.length ? noSkill / entries.length : 0,
    skillFrequency: [...frequency.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([skill, count]) => ({ skill, count })),
    cooccurrencePairs: [...pairs.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([pair, count]) => ({ pair, count })),
    scorecardCases: scored.caseCount,
    enoughRouteData,
    bottomQuartileCandidates
  };
}

function scorecardSummary(scorecard) {
  const bySkill = new Map();
  const results = Array.isArray(scorecard.results) ? scorecard.results : [];
  const benchmark = readJson(path.join(root, 'evals/router-benchmark.json'), { cases: [] });
  const caseMap = new Map((benchmark.cases || []).map((item) => [item.id, item]));
  for (const result of results) {
    const testCase = caseMap.get(result.caseId);
    if (!testCase) continue;
    const delta = Number(result.routedScore) - Number(result.controlScore);
    if (!Number.isFinite(delta)) continue;
    for (const skill of testCase.expectedSkills || []) {
      const bucket = bySkill.get(skill) || { totalDelta: 0, count: 0, averageDelta: 0 };
      bucket.totalDelta += delta;
      bucket.count += 1;
      bucket.averageDelta = bucket.totalDelta / bucket.count;
      bySkill.set(skill, bucket);
    }
  }
  return { caseCount: results.length, bySkill };
}

function renderMarkdown(summary, files, inputPaths) {
  const topSkills = summary.skillFrequency.filter((item) => item.count > 0).slice(0, 20);
  const topPairs = summary.cooccurrencePairs.slice(0, 20);
  const candidates = summary.bottomQuartileCandidates.slice(0, 20);
  return `# Catalog Health

Generated: ${summary.generatedAt}

This report is produced from local AS-Workflow route traces. It is maintainer infrastructure only: AgenticSupercharge does not collect user telemetry.

## Inputs

- Requested paths: ${inputPaths.length ? inputPaths.map((item) => `\`${item}\``).join(', ') : '`./.agenticsupercharge/routes.jsonl`'}
- Route files found: ${files.length}
- Route entries: ${summary.totalRoutes}
- Invalid JSONL lines: ${summary.invalidLines}
- No-skill matched rate: ${formatPercent(summary.noSkillRate)}
- Scorecard cases recorded: ${summary.scorecardCases}

## Most Routed Skills

${topSkills.length ? table(['Skill', 'Count'], topSkills.map((item) => [item.skill, item.count])) : 'No route data found yet.'}

## Common Skill Pairs

${topPairs.length ? table(['Pair', 'Count'], topPairs.map((item) => [item.pair, item.count])) : 'No co-occurrence pairs found yet.'}

## Review Candidates

These are candidates for human review only. Rare route selection is not proof a skill should be removed. At least 20 route entries are required before this script surfaces candidates.

${candidates.length ? table(['Skill', 'Route Count', 'Score Delta', 'Note'], candidates.map((item) => [item.skill, item.routeCount, item.scoreDelta ?? '', item.note])) : 'Insufficient route data for candidate surfacing.'}
`;
}

function table(headers, rows) {
  const header = `| ${headers.join(' | ')} |`;
  const divider = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${row.map((cell) => String(cell).replace(/\|/g, '\\|')).join(' | ')} |`).join('\n');
  return [header, divider, body].join('\n');
}

function unique(items) {
  return [...new Set(items)];
}

function formatPercent(value) {
  return `${Math.round(value * 1000) / 10}%`;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_error) {
    return fallback;
  }
}

main();
