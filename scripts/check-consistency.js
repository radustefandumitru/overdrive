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
const allowedExpectedTerms = new Set(['approval', 'security-guidance']);

console.log('AgenticSupercharge consistency check');

check('package version is 0.6.0 or newer', isAtLeastVersion(pkg.version, '0.6.0'), `found ${pkg.version}`);
check('manifest schema version is 6', manifest.version === 6, `found ${manifest.version}`);
check('manifest schema description mentions version 6', /version 6/i.test(manifest.schemaDescription || ''));
check('manifest includes AS-Workflow metadata', manifest.asWorkflow?.projectStateDir === '.agenticsupercharge' && /AGENTIC_SUPERCHARGE_WORKFLOW/.test(manifest.asWorkflow?.disableEnv || ''));
check('manifest has 15 local skills', skills.local.length === 15, `found ${skills.local.length}`);
check('manifest has 113 upstream GitHub skills', skills.source.length === 113, `found ${skills.source.length}`);
check('manifest has 1 installer-backed skill', skills.official.length === 1, `found ${skills.official.length}`);
check('manifest has 129 unique skills', uniqueSkills.size === 129, `found ${uniqueSkills.size}`);
check('manifest skill names are unique', uniqueSkills.size === skills.all.length);
check('manifest includes react-doctor', uniqueSkills.has('react-doctor'));
check('manifest includes what-should-i-consider', uniqueSkills.has('what-should-i-consider'));
check('manifest includes media-download', uniqueSkills.has('media-download'));
check('manifest includes liquid-glass-web', uniqueSkills.has('liquid-glass-web'));
check('manifest includes layers-intro', uniqueSkills.has('layers-intro'));
check('manifest includes layers-orient', uniqueSkills.has('layers-orient'));
check('manifest includes layers-conceptual-model', uniqueSkills.has('layers-conceptual-model'));
check('manifest excludes removed Obsidian skills', !uniqueSkills.has('obsidian-cli') && !uniqueSkills.has('obsidian-markdown') && !uniqueSkills.has('obsidian-bases'));
check('manifest excludes upstream video-downloader', !uniqueSkills.has('video-downloader'));

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
check('package check script includes build-scorecard syntax check', /build-scorecard\.js/.test(pkg.scripts?.check || ''));
check('package exposes scorecard script', /build-scorecard\.js/.test(pkg.scripts?.scorecard || ''));

const readme = read('README.md');
check('README says current manifest contains 129 unique skills', /current manifest contains 129 unique skills/i.test(readme));
check('README links to router evaluation docs', /docs\/evaluation\.md/.test(readme));
check('README links to v0.6 scorecard docs', /docs\/scorecard-v0\.6\.md/.test(readme));
check('README explains AS-Workflow', /AS-Workflow/i.test(readme) && /\.agenticsupercharge/.test(readme));
check('README positions AgenticSupercharge as a complete system', /complete,\s*plug-and-play system/i.test(readme) && /not just another skill pack/i.test(readme));
check('README includes Stefan origin note', /early AI adopter since ChatGPT launched in November 2022/i.test(readme));
check('README clarifies managed vs native/plugin layers', /managed skills/i.test(readme) && /native skills, third-party plugin skills, or MCP servers/i.test(readme));
check('README documents Cursor reserved folder boundary', /~\/\.cursor\/skills-cursor/.test(readme) && /does not touch Cursor's reserved/i.test(readme));
check('README states no telemetry', /no telemetry/i.test(readme));
check('README agent review mentions the router benchmark', /benchmark.*routing quality/i.test(readme));
check('README documents skill subset install flags', /--skills/.test(readme) && /--skip-skills/.test(readme));
check('README mentions Layers product-design skills', /layers-\*/i.test(readme) || /Layers product-design/i.test(readme));
check('README mentions Liquid Glass Web', /liquid-glass-web/i.test(readme) || /Liquid Glass/i.test(readme));
check('README credits Layers source links', readme.includes('https://github.com/jamiemill/layers-skills') && readme.includes('https://layers.jamiemill.com'));
check('README credits Liquid Glass provenance links', readme.includes('https://github.com/AndrewPrifer/liquid-dom') && readme.includes('https://kube.io/blog/liquid-glass-css-svg/') && readme.includes('https://github.com/naughtyduk/liquidGL'));
check('README credits v0.6 motion provenance links', readme.includes('https://x.com/gabriell_lab/status/2060336070059864461') && readme.includes('https://x.com/baptistebriel/status/2060351541345681851') && readme.includes('https://x.com/mannupaaji/status/2060025609867387239'));

const skillReadiness = read('docs/skill-readiness.md');
check('skill readiness doc uses current manifest wording', /Unique skills in the current manifest: 129/.test(skillReadiness));
check('scorecard doc exists', exists('docs/scorecard-v0.6.md'));
check('scorecard results file exists', exists('evals/scorecard-results.json'));
if (exists('evals/scorecard-results.json')) {
  const scorecardResults = readJson('evals/scorecard-results.json');
  check('scorecard results schema version is 1', scorecardResults.version === 1, `found ${scorecardResults.version}`);
  check('scorecard results starts without invented scores', Array.isArray(scorecardResults.results) && scorecardResults.results.length === 0, `found ${scorecardResults.results ? scorecardResults.results.length : 0}`);
}

const skillSummary = read('SKILLS_SUMMARY.md');
for (const skillName of skills.local) {
  check(`SKILLS_SUMMARY includes local skill ${skillName}`, skillSummary.includes(`\`${skillName}\``));
}

const globalInstructionFiles = ['global-instructions/CLAUDE.md', 'global-instructions/AGENTS.md', 'global-instructions/GEMINI.md'];
for (const file of globalInstructionFiles) {
  const text = read(file);
  check(`${file} includes objectivity guidance`, text.includes('Default to objective, evidence-based reasoning'));
  check(`${file} includes research-before-guessing guidance`, text.includes('start with current research using web search, Context7, or official docs'));
  check(`${file} includes concise output guidance`, text.includes('Skip unnecessary preamble'));
  check(`${file} includes pressure-test guidance`, text.includes('attack the plan first'));
  check(`${file} includes natural status trigger`, text.includes('When the user asks "show status"'));
  check(`${file} includes decision contradiction guidance`, text.includes('contradicts a recorded decision or constraint'));
  check(`${file} includes loop frustration stop guidance`, text.includes('oscillating fix loop'));
  check(`${file} includes parallel subagent guidance`, text.includes('parallel subagents with clear, scoped context'));
  check(`${file} includes model/planning knob honesty`, text.includes('does not auto-switch models across providers'));
  check(`${file} credits Boris/Anatoli prompt-line principles`, text.includes('Boris Cherny') && text.includes('@AnatoliKopadze'));
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
const verifiedRaw = read('VERIFIED_SOURCES.md');
for (const link of [
  'https://react.doctor',
  'https://impeccable.style',
  'https://layers.jamiemill.com',
  'https://github.com/AndrewPrifer/liquid-dom',
  'https://kube.io/blog/liquid-glass-css-svg/',
  'https://github.com/naughtyduk/liquidGL',
  'https://x.com/gabriell_lab/status/2060336070059864461',
  'https://x.com/baptistebriel/status/2060351541345681851',
  'https://x.com/mannupaaji/status/2060025609867387239',
]) {
  check(`VERIFIED_SOURCES includes attribution link ${link}`, verifiedRaw.includes(link));
}

const thirdParty = read('THIRD_PARTY_NOTICES.md').replace(/\.git\b/gi, '').toLowerCase();
for (const sourceEntry of manifest.sources || []) {
  check(
    `THIRD_PARTY_NOTICES mentions repo for ${sourceEntry.id}`,
    thirdParty.includes(normalizeUrl(sourceEntry.repo)),
    sourceEntry.repo
  );
}
const thirdPartyRaw = read('THIRD_PARTY_NOTICES.md');
for (const link of [
  'https://react.doctor',
  'https://impeccable.style',
  'https://layers.jamiemill.com',
  'https://github.com/AndrewPrifer/liquid-dom',
  'https://kube.io/blog/liquid-glass-css-svg/',
  'https://github.com/nikdelvin/liquid-glass',
  'https://github.com/rizroze/liquid-glass',
  'https://github.com/Z1Code/glass-refraction',
  'https://github.com/dashersw/liquid-glass-js',
  'https://github.com/naughtyduk/liquidGL',
  'https://x.com/gabriell_lab/status/2060336070059864461',
  'https://x.com/baptistebriel/status/2060351541345681851',
  'https://x.com/mannupaaji/status/2060025609867387239',
]) {
  check(`THIRD_PARTY_NOTICES includes attribution link ${link}`, thirdPartyRaw.includes(link));
}

const fluidAnimations = read('skills/fluid-animations/SKILL.md');
const emilAnimation = read('skills/emil-animation-polish/SKILL.md');
const liquidGlass = read('skills/liquid-glass-web/SKILL.md');
const liquidGlassTiers = read('skills/liquid-glass-web/references/liquid-glass-tiers.md');
check('fluid-animations credits proximity hover links', fluidAnimations.includes('https://x.com/gabriell_lab/status/2060336070059864461') && fluidAnimations.includes('https://x.com/baptistebriel/status/2060351541345681851'));
check('emil-animation-polish credits v0.6 motion links', emilAnimation.includes('https://x.com/gabriell_lab/status/2060336070059864461') && emilAnimation.includes('https://x.com/mannupaaji/status/2060025609867387239') && emilAnimation.includes('https://developer.chrome.com/blog/css-scroll-state-queries'));
check('liquid-glass-web credits Liquid Glass provenance links', liquidGlass.includes('https://github.com/AndrewPrifer/liquid-dom') && liquidGlass.includes('https://kube.io/blog/liquid-glass-css-svg/') && liquidGlass.includes('https://github.com/naughtyduk/liquidGL'));
check('liquid-glass tier reference warns about unlicensed liquid-dom', liquidGlassTiers.includes('inspiration only because it is unlicensed'));

const routerSkill = read('skills/skill-router/SKILL.md');
const routerCatalog = read('skills/skill-router/references/catalog.md');
check('skill-router links routing trace examples', /routing-trace-examples\.md/.test(routerSkill));
check('skill-router allows flexible skill sequences', /no hard cap/i.test(routerSkill) || /as many skills/i.test(routerSkill));
check('skill-router mentions AS-Workflow route trace helper', /routes\.jsonl/.test(routerSkill));
check('skill-router documents Layers routing', /layers-intro/.test(routerSkill) && /layers-conceptual-model/.test(routerSkill));
check('skill-router documents Liquid Glass routing', /liquid-glass-web/.test(routerSkill) && /Tier 1/.test(routerSkill));
for (const skillName of skills.local) {
  check(`router catalog lists local skill ${skillName}`, routerCatalog.includes(`\`${skillName}\``));
}
for (const skillName of ['layers-intro', 'layers-orient', 'layers-conceptual-model', 'layers-interaction-flow', 'liquid-glass-web']) {
  check(`router catalog lists v0.6 skill ${skillName}`, routerCatalog.includes(`\`${skillName}\``));
}

const asWorkflow = read('lib/as-workflow.js');
check('AS-Workflow required files include research.md', /requiredFiles[\s\S]*research\.md/.test(asWorkflow));
check('AS-Workflow seeds research objectivity mandate', /objective, evidence-based standpoint/.test(asWorkflow));
check('AS-Workflow exports recordDecision helper', /recordDecision/.test(asWorkflow) && /module\.exports[\s\S]*recordDecision/.test(asWorkflow));

const changelog = read('CHANGELOG.md');
check(`CHANGELOG has v${pkg.version} entry`, changelog.includes(`## v${pkg.version}`));

if (failures.length > 0) {
  console.error(`\nConsistency check failed with ${failures.length} issue${failures.length === 1 ? '' : 's'} after ${passed} passing check${passed === 1 ? '' : 's'}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Consistency check passed (${passed} checks).`);
