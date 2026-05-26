#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const failures = [];
const verbose = process.argv.includes('--verbose');
let passed = 0;

function abs(relPath) {
  return path.join(root, relPath);
}

function read(relPath) {
  return fs.readFileSync(abs(relPath), 'utf8');
}

function readJson(relPath) {
  return JSON.parse(read(relPath));
}

function collectManifestSkills(manifest) {
  const local = (manifest.localSkills || []).map((skill) => skill.to);
  const source = (manifest.sources || []).flatMap((sourceEntry) =>
    (sourceEntry.includes || []).map((include) => include.to)
  );
  const official = (manifest.officialInstallers || []).flatMap((installer) => installer.skills || []);
  return new Set([...local, ...source, ...official]);
}

function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    if (verbose) console.log(`PASS ${label}`);
  } else {
    const message = detail ? `${label}: ${detail}` : label;
    failures.push(message);
    console.log(`FAIL ${message}`);
  }
}

function scoreCoverage(testCase, routerText) {
  const expected = testCase.expectedSkills || [];
  const matched = expected.filter((skill) => routerText.includes(`\`${skill}\``) || routerText.includes(skill));
  return { expected: expected.length, matched: matched.length, missing: expected.filter((skill) => !matched.includes(skill)) };
}

const manifest = readJson('manifest.json');
const knownSkills = collectManifestSkills(manifest);
const benchmark = readJson('evals/router-benchmark.json');
const routerText = [
  read('skills/skill-router/SKILL.md'),
  read('skills/skill-router/references/catalog.md'),
  read('skills/skill-router/references/frontend-design-routing.md'),
  read('skills/skill-router/references/routing-trace-examples.md')
].join('\n');

console.log('AgenticSupercharge router benchmark validation');

check('benchmark schema version is 1', benchmark.version === 1, `found ${benchmark.version}`);
check('benchmark describes manual scoring', Boolean(benchmark.scoring && benchmark.scoring.manualProtocol));
check('benchmark has enough cases for broad routing coverage', Array.isArray(benchmark.cases) && benchmark.cases.length >= 12);

let totalExpected = 0;
let totalMatched = 0;
const categoryCounts = new Map();

for (const testCase of benchmark.cases || []) {
  check(`case ${testCase.id} has prompt`, Boolean(testCase.prompt));
  check(`case ${testCase.id} has expectedSkills`, Array.isArray(testCase.expectedSkills) && testCase.expectedSkills.length > 0);
  check(`case ${testCase.id} has controlPrompt`, Boolean(testCase.controlPrompt));
  check(`case ${testCase.id} has routedPrompt`, Boolean(testCase.routedPrompt));
  check(`case ${testCase.id} has at least three rubric items`, Array.isArray(testCase.rubric) && testCase.rubric.length >= 3);
  check(`case ${testCase.id} routed prompt actually invokes skill-router`, /skill-router/i.test(testCase.routedPrompt || ''));

  if (testCase.category) {
    categoryCounts.set(testCase.category, (categoryCounts.get(testCase.category) || 0) + 1);
  }

  for (const skill of testCase.expectedSkills || []) {
    check(`case ${testCase.id} expected skill is in manifest: ${skill}`, knownSkills.has(skill), skill);
  }

  const coverage = scoreCoverage(testCase, routerText);
  totalExpected += coverage.expected;
  totalMatched += coverage.matched;
  check(
    `case ${testCase.id} expected skills are documented in router`,
    coverage.missing.length === 0,
    coverage.missing.join(', ')
  );
}

check('benchmark covers at least six task categories', categoryCounts.size >= 6, `found ${categoryCounts.size}`);

const coveragePercent = totalExpected === 0 ? 0 : Math.round((totalMatched / totalExpected) * 100);
console.log(`\nDocumented expected-skill coverage: ${totalMatched}/${totalExpected} (${coveragePercent}%)`);
console.log(`Benchmark categories: ${Array.from(categoryCounts.keys()).sort().join(', ')}`);
console.log('Manual scoring protocol: docs/evaluation.md');

if (failures.length > 0) {
  console.error(`\nRouter benchmark validation failed with ${failures.length} issue${failures.length === 1 ? '' : 's'} after ${passed} passing check${passed === 1 ? '' : 's'}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Router benchmark validation passed (${passed} checks).`);
