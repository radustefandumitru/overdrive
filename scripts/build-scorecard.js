#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const benchmarkPath = path.join(root, 'evals/router-benchmark.json');
const resultsPath = path.join(root, 'evals/scorecard-results.json');
const outputPath = path.join(root, 'docs/scorecard-v0.6.md');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function scoreDelta(result) {
  if (typeof result.controlScore !== 'number' || typeof result.routedScore !== 'number') return '';
  const delta = result.routedScore - result.controlScore;
  return delta > 0 ? `+${delta}` : String(delta);
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function render() {
  const benchmark = readJson(benchmarkPath);
  const results = readJson(resultsPath);
  const byCase = new Map((results.results || []).map((result) => [result.caseId, result]));
  const scored = [...byCase.values()].filter((result) => typeof result.controlScore === 'number' && typeof result.routedScore === 'number');
  const wins = scored.filter((result) => result.routedScore > result.controlScore).length;
  const losses = scored.filter((result) => result.routedScore < result.controlScore).length;
  const ties = scored.filter((result) => result.routedScore === result.controlScore).length;

  const lines = [
    '# v0.6 Router Scorecard',
    '',
    'This is the public scorecard template for comparing plain prompts against `skill-router` routed prompts. It is intentionally empty until real blind runs are collected and scored.',
    '',
    'Do not claim AgenticSupercharge improves outputs from this file until the table contains real model runs.',
    '',
    '## Protocol',
    '',
    '1. Pick a case from `evals/router-benchmark.json`.',
    '2. Run `controlPrompt` and `routedPrompt` in separate fresh sessions with the same model, tools, repo state, and time budget.',
    '3. Hide which output is control vs routed when practical.',
    '4. Score each rubric item from 0 to 2.',
    '5. Record totals and notes in `evals/scorecard-results.json`.',
    '6. Rebuild this file with `npm run scorecard`.',
    '',
    '## Summary',
    '',
    `- Scored cases: ${scored.length}/${benchmark.cases.length}`,
    `- Routed wins: ${wins}`,
    `- Ties: ${ties}`,
    `- Routed losses: ${losses}`,
    '',
    '## Results',
    '',
    '| Case | Category | Expected Skills | Model | Control | Routed | Delta | Notes |',
    '|---|---|---|---|---:|---:|---:|---|'
  ];

  for (const testCase of benchmark.cases || []) {
    const result = byCase.get(testCase.id) || {};
    lines.push([
      escapeCell(testCase.id),
      escapeCell(testCase.category),
      escapeCell((testCase.expectedSkills || []).join(', ')),
      escapeCell(result.model || ''),
      escapeCell(result.controlScore ?? ''),
      escapeCell(result.routedScore ?? ''),
      escapeCell(scoreDelta(result)),
      escapeCell(result.notes || '')
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  }

  lines.push(
    '',
    '## Raw Results Schema',
    '',
    'Each entry in `evals/scorecard-results.json` should look like:',
    '',
    '```json',
    JSON.stringify({
      caseId: 'case-id-from-router-benchmark',
      model: 'model name and settings',
      date: 'YYYY-MM-DD',
      controlScore: 0,
      routedScore: 0,
      notes: 'Short blind-scoring notes and regressions.'
    }, null, 2),
    '```',
    ''
  );

  fs.writeFileSync(outputPath, `${lines.join('\n')}\n`);
  console.log(`Wrote ${path.relative(root, outputPath)}`);
}

render();
