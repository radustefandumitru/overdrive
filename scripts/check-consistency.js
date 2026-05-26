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

function exists(relPath) {
  return fs.existsSync(abs(relPath));
}

function pass(label) {
  passed += 1;
  if (verbose) console.log(`PASS ${label}`);
}

function fail(label, detail) {
  const message = detail ? `${label}: ${detail}` : label;
  failures.push(message);
  console.log(`FAIL ${message}`);
}

function check(label, condition, detail) {
  if (condition) pass(label);
  else fail(label, detail);
}

function normalizeUrl(value) {
  return String(value || '')
    .trim()
    .replace(/\.git$/i, '')
    .toLowerCase();
}

function getFrontmatter(body) {
  const match = body.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  return Object.fromEntries(
    match[1]
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/))
      .filter(Boolean)
      .map((matchLine) => [matchLine[1], matchLine[2].replace(/^['"]|['"]$/g, '').trim()])
  );
}

function collectManifestSkills(manifest) {
  const local = (manifest.localSkills || []).map((skill) => skill.to);
  const source = (manifest.sources || []).flatMap((sourceEntry) =>
    (sourceEntry.includes || []).map((include) => include.to)
  );
  const official = (manifest.officialInstallers || []).flatMap((installer) => installer.skills || []);
  return { local, source, official, all: [...local, ...source, ...official] };
}

function parseBenchmark() {
  const benchmarkPath = 'evals/router-benchmark.json';
  if (!exists(benchmarkPath)) return null;
  return readJson(benchmarkPath);
}

function isAtLeastVersion(version, minimum) {
  const parts = String(version).split('.').map((part) => Number(part));
  const minParts = String(minimum).split('.').map((part) => Number(part));
  for (let index = 0; index < Math.max(parts.length, minParts.length); index += 1) {
    const part = Number.isFinite(parts[index]) ? parts[index] : 0;
    const minPart = Number.isFinite(minParts[index]) ? minParts[index] : 0;
    if (part > minPart) return true;
    if (part < minPart) return false;
  }
  return true;
}

const manifest = readJson('manifest.json');
const pkg = readJson('package.json');
const skills = collectManifestSkills(manifest);
const uniqueSkills = new Set(skills.all);
const allowedExpectedTerms = new Set(['approval']);

console.log('AgenticSupercharge consistency check');

check('package version is 0.3.0 or newer', isAtLeastVersion(pkg.version, '0.3.0'), `found ${pkg.version}`);
check('manifest schema version is 5', manifest.version === 5, `found ${manifest.version}`);
check('manifest schema description mentions version 5', /version 5/i.test(manifest.schemaDescription || ''));
check('manifest has 12 local skills', skills.local.length === 12, `found ${skills.local.length}`);
check('manifest has 107 upstream GitHub skills', skills.source.length === 107, `found ${skills.source.length}`);
check('manifest has 1 installer-backed skill', skills.official.length === 1, `found ${skills.official.length}`);
check('manifest has 120 unique skills', uniqueSkills.size === 120, `found ${uniqueSkills.size}`);
check('manifest skill names are unique', uniqueSkills.size === skills.all.length);

for (const sourceEntry of manifest.sources || []) {
  check(`source ${sourceEntry.id} has pinned 40-char ref`, /^[a-f0-9]{40}$/i.test(sourceEntry.ref || ''), sourceEntry.ref);
  check(`source ${sourceEntry.id} has trackingRef`, Boolean(sourceEntry.trackingRef));
  check(`source ${sourceEntry.id} includes at least one skill`, (sourceEntry.includes || []).length > 0);
  for (const include of sourceEntry.includes || []) {
    check(`source ${sourceEntry.id} include ${include.to} has from path`, Boolean(include.from));
    check(`source ${sourceEntry.id} include ${include.to} has to name`, Boolean(include.to));
  }
}

for (const installer of manifest.officialInstallers || []) {
  check(`official installer ${installer.id} pins an exact package version`, /^@?[^@\s]+\/?[^@\s]*@\d+\.\d+\.\d+/.test(installer.package || ''), installer.package);
  check(`official installer ${installer.id} has trackingPackage`, /@latest$/.test(installer.trackingPackage || ''), installer.trackingPackage);
  check(`official installer ${installer.id} lists skills`, (installer.skills || []).length > 0);
}

for (const skill of manifest.localSkills || []) {
  const skillFile = path.join(skill.from, 'SKILL.md');
  const metadataFile = path.join(skill.from, 'agents/openai.yaml');
  check(`local skill ${skill.to} has SKILL.md`, exists(skillFile), skillFile);
  check(`local skill ${skill.to} has agents/openai.yaml`, exists(metadataFile), metadataFile);
  if (exists(skillFile)) {
    const frontmatter = getFrontmatter(read(skillFile));
    check(`local skill ${skill.to} frontmatter name matches manifest`, frontmatter.name === skill.to, `found ${frontmatter.name || '(missing)'}`);
    check(`local skill ${skill.to} has description`, Boolean(frontmatter.description));
  }
}

for (const smoke of manifest.smokeChecks || []) {
  check(`smoke check has prompt: ${smoke.prompt || '(missing)'}`, Boolean(smoke.prompt));
  check(`smoke check has expected skills: ${smoke.prompt || '(missing)'}`, Array.isArray(smoke.expected) && smoke.expected.length > 0);
  for (const expected of smoke.expected || []) {
    check(
      `smoke check expected term is known: ${expected}`,
      uniqueSkills.has(expected) || allowedExpectedTerms.has(expected),
      smoke.prompt
    );
  }
}

const benchmark = parseBenchmark();
check('router benchmark file exists', Boolean(benchmark));
if (benchmark) {
  check('router benchmark schema version is 1', benchmark.version === 1, `found ${benchmark.version}`);
  check('router benchmark has at least 12 cases', Array.isArray(benchmark.cases) && benchmark.cases.length >= 12, `found ${benchmark.cases ? benchmark.cases.length : 0}`);
  const ids = new Set();
  for (const testCase of benchmark.cases || []) {
    check(`benchmark case ${testCase.id || '(missing)'} has unique id`, Boolean(testCase.id) && !ids.has(testCase.id));
    if (testCase.id) ids.add(testCase.id);
    check(`benchmark case ${testCase.id || '(missing)'} has prompt`, Boolean(testCase.prompt));
    check(`benchmark case ${testCase.id || '(missing)'} has controlPrompt`, Boolean(testCase.controlPrompt));
    check(`benchmark case ${testCase.id || '(missing)'} has routedPrompt`, Boolean(testCase.routedPrompt));
    check(`benchmark case ${testCase.id || '(missing)'} has rubric`, Array.isArray(testCase.rubric) && testCase.rubric.length >= 3);
    for (const expected of testCase.expectedSkills || []) {
      check(
        `benchmark expected skill is known: ${expected}`,
        uniqueSkills.has(expected) || allowedExpectedTerms.has(expected),
        testCase.id
      );
    }
  }
}

const packageFiles = new Set(pkg.files || []);
check('package files include scripts/', packageFiles.has('scripts/'));
check('package files include evals/', packageFiles.has('evals/'));
check('package files include docs/', packageFiles.has('docs/'));
check('package files exclude SOCIAL_POSTS.md', !packageFiles.has('SOCIAL_POSTS.md'));

const readme = read('README.md');
check('README says current manifest contains 120 unique skills', /current manifest contains 120 unique skills/i.test(readme));
check('README links to router evaluation docs', /docs\/evaluation\.md/.test(readme));
check('README agent review mentions the v0.3 eval pack', /v0\.3.*eval pack/i.test(readme));

const skillReadiness = read('docs/skill-readiness.md');
check('skill readiness doc uses current manifest wording', /Unique skills in the current manifest: 120/.test(skillReadiness));

const skillSummary = read('SKILLS_SUMMARY.md');
for (const skillName of skills.local) {
  check(`SKILLS_SUMMARY includes local skill ${skillName}`, skillSummary.includes(`\`${skillName}\``));
}

const verifiedSources = read('VERIFIED_SOURCES.md').replace(/\.git\b/gi, '').toLowerCase();
for (const sourceEntry of manifest.sources || []) {
  check(
    `VERIFIED_SOURCES lists repo for ${sourceEntry.id}`,
    verifiedSources.includes(normalizeUrl(sourceEntry.repo)),
    sourceEntry.repo
  );
  check(`VERIFIED_SOURCES lists pinned ref for ${sourceEntry.id}`, verifiedSources.includes(String(sourceEntry.ref).toLowerCase()));
}
for (const installer of manifest.officialInstallers || []) {
  check(`VERIFIED_SOURCES lists package for ${installer.id}`, verifiedSources.includes(String(installer.package).toLowerCase()));
}

const thirdParty = read('THIRD_PARTY_NOTICES.md').replace(/\.git\b/gi, '').toLowerCase();
for (const sourceEntry of manifest.sources || []) {
  check(
    `THIRD_PARTY_NOTICES mentions repo for ${sourceEntry.id}`,
    thirdParty.includes(normalizeUrl(sourceEntry.repo)),
    sourceEntry.repo
  );
}

const routerSkill = read('skills/skill-router/SKILL.md');
const routerCatalog = read('skills/skill-router/references/catalog.md');
check('skill-router links routing trace examples', /routing-trace-examples\.md/.test(routerSkill));
for (const skillName of skills.local) {
  check(`router catalog lists local skill ${skillName}`, routerCatalog.includes(`\`${skillName}\``));
}

const changelog = read('CHANGELOG.md');
check(`CHANGELOG has v${pkg.version} entry`, changelog.includes(`## v${pkg.version}`));

if (failures.length > 0) {
  console.error(`\nConsistency check failed with ${failures.length} issue${failures.length === 1 ? '' : 's'} after ${passed} passing check${passed === 1 ? '' : 's'}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Consistency check passed (${passed} checks).`);
