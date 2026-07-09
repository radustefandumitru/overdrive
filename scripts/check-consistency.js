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

function findManifestInclude(skillName) {
  for (const sourceEntry of manifest.sources || []) {
    for (const include of sourceEntry.includes || []) {
      if (include.to === skillName) return { source: sourceEntry, include };
    }
  }
  return null;
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
const retiredDraftFile = ['SOCIAL', 'POSTS.md'].join('_');
const retiredHyphenBrand = ['agentic', 'supercharge'].join('-');
const retiredSolidBrand = ['agentic', 'supercharge'].join('');
const retiredInstructionBlock = ['ai', 'skill', 'setup:global-guidelines'].join('-');
const retiredSlashStatus = ['as', 'status'].join('-');

console.log('Overdrive consistency check');

check('package is overdrive-cli', pkg.name === 'overdrive-cli', `found ${pkg.name}`);
check('package version is 2.0.2', pkg.version === '2.0.2', `found ${pkg.version}`);
check('package license is Apache-2.0', pkg.license === 'Apache-2.0', `found ${pkg.license}`);
check('package exposes overdrive bin', pkg.bin?.overdrive === 'bin/overdrive.js');
check('package exposes ovd bin alias', pkg.bin?.ovd === 'bin/overdrive.js');
check('package exposes overdrive-cli bin alias', pkg.bin?.['overdrive-cli'] === 'bin/overdrive.js');
check('package exposes only canonical Overdrive bins', Object.keys(pkg.bin || {}).sort().join(',') === 'ovd,overdrive,overdrive-cli');
check('manifest schema version is 6', manifest.version === 6, `found ${manifest.version}`);
check('manifest schema description mentions version 6', /version 6/i.test(manifest.schemaDescription || ''));
check('manifest includes ovd-workflow metadata', manifest.ovdWorkflow?.projectStateDir === '.overdrive' && /OVERDRIVE_WORKFLOW/.test(manifest.ovdWorkflow?.disableEnv || ''));
check('manifest no longer uses asWorkflow key', !Object.prototype.hasOwnProperty.call(manifest, 'asWorkflow'));
check('manifest has 23 local skills', skills.local.length === 23, `found ${skills.local.length}`);
check('manifest has 136 upstream GitHub skills', skills.source.length === 136, `found ${skills.source.length}`);
check('manifest has 1 installer-backed skill', skills.official.length === 1, `found ${skills.official.length}`);
check('manifest has 160 unique skills', uniqueSkills.size === 160, `found ${uniqueSkills.size}`);
check('manifest skill names are unique', uniqueSkills.size === skills.all.length);
check('manifest includes react-doctor', uniqueSkills.has('react-doctor'));
check('manifest includes what-should-i-consider', uniqueSkills.has('what-should-i-consider'));
check('manifest includes media-download', uniqueSkills.has('media-download'));
check('manifest includes liquid-glass-web', uniqueSkills.has('liquid-glass-web'));
check('manifest includes pretext', uniqueSkills.has('pretext'));
check('manifest includes convert-to-markdown', uniqueSkills.has('convert-to-markdown'));
check('manifest includes reddit-research', uniqueSkills.has('reddit-research'));
check('manifest includes graphify', uniqueSkills.has('graphify'));
check('manifest includes prompt-master', uniqueSkills.has('prompt-master'));
check('manifest includes humanizer', uniqueSkills.has('humanizer'));
check('manifest includes design-extract', uniqueSkills.has('design-extract'));
check('manifest includes claude-video', uniqueSkills.has('claude-video'));
check('manifest includes v2.0.2 local wrappers', ['brag-video', 'autoresearch-harness', 'clone-website-guide', 'fact-checker'].every((skill) => uniqueSkills.has(skill)));
check('manifest includes Addy Osmani engineering skills', ['interview-me', 'doubt-driven-development', 'source-driven-development', 'api-and-interface-design', 'code-simplification', 'documentation-and-adrs', 'performance-optimization', 'test-driven-development', 'debugging-and-error-recovery'].every((skill) => uniqueSkills.has(skill)));
check('manifest includes Matt Pocock grilling skills', uniqueSkills.has('grill-me') && uniqueSkills.has('grilling'));
check('manifest includes new context-engineering skills', uniqueSkills.has('harness-engineering') && uniqueSkills.has('self-improvement-loops'));
check('manifest includes official Anthropic additions', ['algorithmic-art', 'canvas-design', 'claude-api', 'skill-creator', 'web-artifacts-builder', 'webapp-testing', 'theme-factory'].every((skill) => uniqueSkills.has(skill)));
check('manifest safety-transforms defuddle', (findManifestInclude('defuddle')?.include.transforms || []).includes('overdrive-defuddle-safe'));
check('manifest safety-transforms artifacts-builder', (findManifestInclude('artifacts-builder')?.include.transforms || []).includes('overdrive-web-artifacts-safe'));
check('manifest safety-transforms web-artifacts-builder', (findManifestInclude('web-artifacts-builder')?.include.transforms || []).includes('overdrive-web-artifacts-safe'));
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
    if (include.to === 'graphify') {
      check('graphify source normalizes lowercase skill file', include.skillFile === 'skill.md');
      check('graphify source has safe transform', Array.isArray(include.transforms) && include.transforms.includes('agentic-graphify-safe'));
    }
    if (include.to === 'claude-video') {
      check('claude-video source has safe transform', Array.isArray(include.transforms) && include.transforms.includes('agentic-claude-video-safe'));
    }
    if (include.to === 'humanizer') {
      check('humanizer source has ethics transform', Array.isArray(include.transforms) && include.transforms.includes('agentic-humanizer-ethics'));
    }
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
check('package files include assets/', packageFiles.has('assets/'));
check('package files include plugin wrapper', packageFiles.has('plugins/') && packageFiles.has('.claude-plugin/'));
check('package files include NOTICE', packageFiles.has('NOTICE'));
check('package files exclude removed social draft', !packageFiles.has(retiredDraftFile));
check('package check script includes build-scorecard syntax check', /build-scorecard\.js/.test(pkg.scripts?.check || ''));
check('package check script includes analyze-routes syntax check', /analyze-routes\.js/.test(pkg.scripts?.check || ''));
check('package exposes scorecard script', /build-scorecard\.js/.test(pkg.scripts?.scorecard || ''));
check('package exposes analyze routes script', /analyze-routes\.js/.test(pkg.scripts?.['analyze:routes'] || ''));
check('analyze-routes script exists', exists('scripts/analyze-routes.js'));
check('no obsolete CLI wrapper exists', !exists(`bin/${retiredHyphenBrand}.js`));
check('no obsolete workflow wrapper exists', !exists(`lib/${['as', 'workflow.js'].join('-')}`));
for (const asset of [
  'assets/overdrive logo.png',
  'assets/overdrive-flow-diagram@2x.png',
  'assets/overdrive-system-diagram@2x.png',
  'assets/overdrive-architecture-diagram@2x.png'
]) {
  check(`README asset exists: ${asset}`, exists(asset));
}
check('Claude marketplace file exists', exists('.claude-plugin/marketplace.json'));
check('Claude plugin manifest exists', exists('plugins/overdrive/.claude-plugin/plugin.json'));
if (exists('.claude-plugin/marketplace.json')) {
  const marketplace = readJson('.claude-plugin/marketplace.json');
  check('Claude marketplace is named overdrive-marketplace', marketplace.name === 'overdrive-marketplace');
  check('Claude marketplace references thin Overdrive plugin', Array.isArray(marketplace.plugins) && marketplace.plugins.some((plugin) => plugin.name === 'overdrive' && plugin.source === './plugins/overdrive'));
}
if (exists('plugins/overdrive/.claude-plugin/plugin.json')) {
  const plugin = readJson('plugins/overdrive/.claude-plugin/plugin.json');
  check('Claude plugin wrapper is overdrive v2.0.2', plugin.name === 'overdrive' && plugin.version === '2.0.2');
  check('Claude plugin wrapper uses Apache license', plugin.license === 'Apache-2.0');
}
check('Claude plugin helper skill exists', exists('plugins/overdrive/skills/overdrive/SKILL.md'));
check('Claude plugin wrapper stays thin', !exists('plugins/overdrive/skills/skill-router') && !exists('plugins/overdrive/skills/playwright-cli'));

const readme = read('README.md');
check('README states the 160-skill catalog count', /curated catalog of 160 of the top skills/i.test(readme));
check('README links to router evaluation docs', /docs\/evaluation\.md/.test(readme));
check('README links to v0.6 scorecard docs', /docs\/scorecard-v0\.6\.md/.test(readme));
check('README explains ovd-workflow', /ovd-workflow/i.test(readme) && /\.overdrive/.test(readme));
check('README positions Overdrive as a complete system', /complete,\s*plug-and-play system/i.test(readme) && /not just another skill pack/i.test(readme));
check('README includes Stefan origin/contact note', /own daily AI coding-agent setup/i.test(readme) && /@StefanDumitruX/.test(readme) && /buymeacoffee/.test(readme));
check('README clarifies managed vs native/plugin layers', /managed skills/i.test(readme) && /native skills, third-party plugin skills, or MCP servers/i.test(readme));
check('README documents Cursor reserved folder boundary', /~\/\.cursor\/skills-cursor/.test(readme) && /does not touch Cursor's reserved/i.test(readme));
check('README states no telemetry', /no telemetry/i.test(readme));
check('README agent review mentions the router benchmark', /benchmark.*routing quality/i.test(readme));
check('README documents skill subset install flags', /--skills/.test(readme) && /--skip-skills/.test(readme));
check('README mentions Layers product-design skills', /layers-\*/i.test(readme) || /Layers product-design/i.test(readme));
check('README mentions Liquid Glass Web', /liquid-glass-web/i.test(readme) || /Liquid Glass/i.test(readme));
check('README explains knowledge vault', /knowledge vault/i.test(readme) && /knowledge-index\.json/.test(readme));
check('README embeds repo-local Overdrive assets', /assets\/overdrive%20logo\.png/.test(readme) && /assets\/overdrive-flow-diagram@2x\.png/.test(readme) && /assets\/overdrive-system-diagram@2x\.png/.test(readme) && /assets\/overdrive-architecture-diagram@2x\.png/.test(readme));
check('README documents canonical ovd aliases only', /ovd --help/.test(readme) && !readme.includes(`${retiredHyphenBrand} --help`));
check('README exposes global guide and router in collapsible sections', /<summary>Installed global operating guide<\/summary>/.test(readme) && /<summary>Installed skill-router<\/summary>/.test(readme));
check('README documents Claude plugin wrapper', /Claude Plugin Wrapper/.test(readme) && /\.claude-plugin\/marketplace\.json/.test(readme) && /does \*\*not\*\* bundle all 160 skills/.test(readme));
check('README mentions MarkItDown token pipeline', /MarkItDown/i.test(readme) && /convert-to-markdown/.test(readme));
check('README mentions route analysis', /analyze:routes/.test(readme) && /catalog-health/.test(readme));
check('README links prompt caching doc', /docs\/prompt-caching\.md/.test(readme));
check('README links context runtime matrix doc', /docs\/context-runtime-matrix\.md/.test(readme));
check('README mentions pretext skill', /pretext/i.test(readme) && /@chenglou\/pretext/.test(readme));
check('README mentions v0.11 optional tool setup', /--no-tool-install/.test(readme) && /graphifyy==0\.1\.14/.test(readme) && /non-privileged/i.test(readme));
check('README mentions Graphify optional code intelligence', /Graphify/i.test(readme) && /graphifyy==0\.1\.14/.test(readme) && /managed user-space virtualenv/i.test(readme));
check('README mentions v0.10 skills', /prompt-master/.test(readme) && /humanizer/.test(readme) && /design-extract/.test(readme) && /claude-video/.test(readme));
check('README mentions v2.0.2 skills', /brag-video/.test(readme) && /autoresearch-harness/.test(readme) && /clone-website-guide/.test(readme) && /fact-checker/.test(readme) && /grill-me/.test(readme) && /interview-me/.test(readme));
check('README documents usage command privacy', /overdrive usage/.test(readme) && /prints no prompt or message content/i.test(readme));
check('README shows varied router examples', /security-review/.test(readme) && /react-doctor/.test(readme) && /jack-seo-launch-audit/.test(readme));
check('README credits Layers source links', readme.includes('https://github.com/jamiemill/layers-skills') && readme.includes('https://layers.jamiemill.com'));
check('README credits Liquid Glass provenance links', readme.includes('https://github.com/AndrewPrifer/liquid-dom') && readme.includes('https://kube.io/blog/liquid-glass-css-svg/') && readme.includes('https://github.com/naughtyduk/liquidGL'));
check('README credits v0.6 motion provenance links', readme.includes('https://x.com/gabriell_lab/status/2060336070059864461') && readme.includes('https://x.com/baptistebriel/status/2060351541345681851') && readme.includes('https://x.com/mannupaaji/status/2060025609867387239'));
check('README credits v0.7 sources', readme.includes('https://github.com/microsoft/markitdown') && readme.includes('https://github.com/browserbase/skills'));
check('README credits prompt-caching sources', readme.includes('https://kreidemann.com/blog/prompt-caching') && readme.includes('https://sankalp.bearblog.dev/how-prompt-caching-works/') && readme.includes('https://ngrok.com/blog/prompt-caching'));
check('README credits Graphify source links', readme.includes('https://github.com/safishamsi/graphify') && readme.includes('https://graphify.net'));
check('README credits v0.10 source links', readme.includes('https://github.com/nidhinjs/prompt-master') && readme.includes('https://github.com/blader/humanizer') && readme.includes('https://designlang.manavaryasingh.com') && readme.includes('https://github.com/bradautomates/claude-video'));
check('README credits usage inspiration links', readme.includes('https://github.com/getagentseal/codeburn') && readme.includes('https://github.com/ryoppippi/ccusage'));
const thirdPartyNoticesEarly = read('THIRD_PARTY_NOTICES.md');
check('THIRD_PARTY_NOTICES credits v2.0.2 source links', thirdPartyNoticesEarly.includes('https://github.com/addyosmani/agent-skills') && thirdPartyNoticesEarly.includes('https://github.com/mattpocock/skills') && thirdPartyNoticesEarly.includes('https://github.com/karpathy/autoresearch') && thirdPartyNoticesEarly.includes('https://github.com/latent-spaces/brag') && thirdPartyNoticesEarly.includes('https://github.com/JCodesMore/ai-website-cloner-template'));
check('prompt caching doc exists', exists('docs/prompt-caching.md'));
check('context runtime matrix doc exists', exists('docs/context-runtime-matrix.md'));
if (exists('docs/context-runtime-matrix.md')) {
  const contextMatrix = read('docs/context-runtime-matrix.md');
  check('context matrix covers supported runtimes', /Claude Code/.test(contextMatrix) && /Codex/.test(contextMatrix) && /Gemini CLI/.test(contextMatrix) && /Antigravity/.test(contextMatrix) && /Cursor/.test(contextMatrix));
  check('context matrix distinguishes Claude-only levers', /Claude-only/.test(contextMatrix) && /ENABLE_TOOL_SEARCH=false/.test(contextMatrix) && /disable-model-invocation/.test(contextMatrix));
  check('context matrix defers to native compaction', /\/compact/.test(contextMatrix) && /\/compress/.test(contextMatrix) && /Do not silently compress/.test(contextMatrix));
}

const skillReadiness = read('docs/skill-readiness.md');
check('skill readiness doc uses current manifest wording', /Unique skills in the current manifest: 160/.test(skillReadiness));
check('skill readiness doc explains Graphify setup', /graphifyy/.test(skillReadiness) && /optional/i.test(skillReadiness));
check('skill readiness doc explains v0.11 optional setup', /design-extract/.test(skillReadiness) && /claude-video/.test(skillReadiness) && /--no-tool-install/.test(skillReadiness) && /non-privileged/.test(skillReadiness));
check('scorecard doc exists', exists('docs/scorecard-v0.6.md'));
check('scorecard results file exists', exists('evals/scorecard-results.json'));
if (exists('evals/scorecard-results.json')) {
  const scorecardResults = readJson('evals/scorecard-results.json');
  check('scorecard results schema version is 1', scorecardResults.version === 1, `found ${scorecardResults.version}`);
  check('scorecard results starts without invented scores', Array.isArray(scorecardResults.results) && scorecardResults.results.length === 0, `found ${scorecardResults.results ? scorecardResults.results.length : 0}`);
}

const skillSummary = read('docs/SKILLS_SUMMARY.md');
for (const skillName of skills.local) {
  check(`SKILLS_SUMMARY includes local skill ${skillName}`, skillSummary.includes(`\`${skillName}\``));
}

const globalInstructionFiles = ['global-instructions/CLAUDE.md', 'global-instructions/AGENTS.md', 'global-instructions/GEMINI.md'];
for (const file of globalInstructionFiles) {
  const text = read(file);
  check(`${file} includes objectivity guidance`, text.includes('Default to objective, evidence-based reasoning'));
  check(`${file} includes anti-sycophancy guidance`, text.includes('sycophancy / Dunning-Kruger feedback loop'));
  check(`${file} includes weak-premise challenge guidance`, text.includes('consequential, ambiguous, or irreversible decision'));
  check(`${file} includes stronger option guidance`, text.includes('When the user\'s preferred idea competes with a stronger one'));
  check(`${file} includes research-before-guessing guidance`, text.includes('start with current research using web search, Context7, or official docs'));
  check(`${file} includes concise output guidance`, text.includes('Skip unnecessary preamble'));
  check(`${file} includes pressure-test guidance`, text.includes('attack the plan first'));
  check(`${file} includes natural status trigger`, text.includes('When the user asks "show status"'));
  check(`${file} includes natural usage trigger`, text.includes('When the user asks "show usage"') && text.includes('should not print prompts or message content'));
  check(`${file} includes decision contradiction guidance`, text.includes('contradicts a recorded decision or constraint'));
  check(`${file} includes loop frustration stop guidance`, text.includes('oscillating fix loop'));
  check(`${file} includes native orchestration guidance`, text.includes('runtime\'s native orchestration'));
  check(`${file} includes model/planning knob honesty`, text.includes('does not auto-switch models across providers'));
  check(`${file} includes native plan mode vs clarify guidance`, text.includes('`clarify-and-plan` adds requirement and ambiguity clarification'));
	  check(`${file} includes prompt-cache stability guidance`, text.includes('Prefer stable, front-loaded context'));
	  check(`${file} includes native context commands guidance`, text.includes('Claude Code `/memory` and `/compact`') && text.includes('Gemini CLI `/memory`, `/compress`, `/stats`, `/skills`, and `/mcp`'));
	  check(`${file} keeps Claude-only context levers platform-specific`, text.includes('ENABLE_TOOL_SEARCH=false') && text.includes('disable-model-invocation') && text.includes('should not be presented as universal behavior'));
	  check(`${file} includes Graphify graph preference guidance`, text.includes('if a Graphify graph already exists in the project'));
  check(`${file} includes lean context guidance`, text.includes('Keep context lean'));
  check(`${file} includes vague request sharpening guidance`, text.includes('sharpen the goal'));
  check(`${file} includes escalating context budget bands`, text.includes('~60%+ (caution)') && text.includes('~75%+ (warning)') && text.includes('~85-90%+ (red zone)'));
  check(`${file} includes per-band re-prompt guidance`, text.includes('crosses each new band'));
  check(`${file} includes preferences tracker guidance`, text.includes('preferences.md'));
  check(`${file} credits Boris/Anatoli prompt-line principles`, text.includes('Boris Cherny') && text.includes('@AnatoliKopadze'));
}

const verifiedSources = read('docs/VERIFIED_SOURCES.md').replace(/\.git\b/gi, '').toLowerCase();
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
const verifiedRaw = read('docs/VERIFIED_SOURCES.md');
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
  'https://github.com/microsoft/markitdown',
  'https://github.com/browserbase/skills',
  'https://kreidemann.com/blog/prompt-caching',
  'https://sankalp.bearblog.dev/how-prompt-caching-works/',
  'https://ngrok.com/blog/prompt-caching',
  'https://github.com/safishamsi/graphify',
  'https://graphify.net',
  'https://github.com/nidhinjs/prompt-master',
  'https://github.com/blader/humanizer',
  'https://designlang.manavaryasingh.com',
	  'https://github.com/bradautomates/claude-video',
	  'https://github.com/chenglou/pretext',
	  'https://github.com/getagentseal/codeburn',
  'https://github.com/ryoppippi/ccusage',
  'https://github.com/addyosmani/agent-skills',
  'https://github.com/mattpocock/skills',
  'https://github.com/karpathy/autoresearch',
  'https://github.com/latent-spaces/brag',
  'https://github.com/JCodesMore/ai-website-cloner-template',
  'https://github.com/hesreallyhim/awesome-claude-code',
  'https://github.com/Shubhamsaboo/awesome-llm-apps',
  'https://github.com/pypa/pipx',
  'https://github.com/Homebrew/brew',
  'https://github.com/microsoft/winget-cli',
  'https://ffmpeg.org/',
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
  'https://github.com/microsoft/markitdown',
  'https://github.com/browserbase/skills',
  'https://kreidemann.com/blog/prompt-caching',
  'https://sankalp.bearblog.dev/how-prompt-caching-works/',
  'https://ngrok.com/blog/prompt-caching',
  'https://github.com/safishamsi/graphify',
  'https://graphify.net',
  'https://github.com/nidhinjs/prompt-master',
  'https://github.com/blader/humanizer',
  'https://designlang.manavaryasingh.com',
	  'https://github.com/bradautomates/claude-video',
	  'https://github.com/chenglou/pretext',
	  'https://github.com/getagentseal/codeburn',
  'https://github.com/ryoppippi/ccusage',
  'https://github.com/addyosmani/agent-skills',
  'https://github.com/mattpocock/skills',
  'https://github.com/karpathy/autoresearch',
  'https://github.com/latent-spaces/brag',
  'https://github.com/JCodesMore/ai-website-cloner-template',
  'https://github.com/hesreallyhim/awesome-claude-code',
  'https://github.com/Shubhamsaboo/awesome-llm-apps',
  'https://github.com/pypa/pipx',
  'https://github.com/Homebrew/brew',
  'https://github.com/microsoft/winget-cli',
  'https://ffmpeg.org/',
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
check('skill-router documents deterministic sequence order', /stable, deterministic ordering/.test(routerSkill));
check('skill-router mentions ovd-workflow route trace helper', /routes\.jsonl/.test(routerSkill));
check('skill-router documents Layers routing', /layers-intro/.test(routerSkill) && /layers-conceptual-model/.test(routerSkill));
check('skill-router documents Liquid Glass routing', /liquid-glass-web/.test(routerSkill) && /Tier 1/.test(routerSkill));
check('skill-router documents pretext routing', /pretext/.test(routerSkill) && /text measurement\/layout performance/.test(routerSkill));
check('skill-router documents convert-to-markdown routing', /convert-to-markdown/.test(routerSkill));
check('skill-router documents reddit-research routing', /reddit-research/.test(routerSkill));
check('skill-router documents graphify routing', /graphify/.test(routerSkill) && /ovd-workflow knowledge vault/.test(routerSkill));
check('skill-router documents v0.10 routing', /prompt-master/.test(routerSkill) && /humanizer/.test(routerSkill) && /design-extract/.test(routerSkill) && /claude-video/.test(routerSkill));
check('skill-router documents v2.0.2 routing', /grill-me/.test(routerSkill) && /interview-me/.test(routerSkill) && /clone-website-guide/.test(routerSkill) && /brag-video/.test(routerSkill) && /autoresearch-harness/.test(routerSkill) && /fact-checker/.test(routerSkill));
for (const skillName of skills.local) {
  check(`router catalog lists local skill ${skillName}`, routerCatalog.includes(`\`${skillName}\``));
}
for (const skillName of ['layers-intro', 'layers-orient', 'layers-conceptual-model', 'layers-interaction-flow', 'liquid-glass-web', 'graphify', 'prompt-master', 'humanizer', 'design-extract', 'claude-video']) {
  check(`router catalog lists routed skill ${skillName}`, routerCatalog.includes(`\`${skillName}\``));
}

const installer = read('lib/installer.js');
check('installer writes and reads only Overdrive markers', /\.overdrive\.json/.test(installer) && !installer.includes(retiredHyphenBrand) && /function readMarker/.test(installer));
check('installer uses only Overdrive managed instruction blocks', /managedBlockStart/.test(installer) && !installer.includes(retiredInstructionBlock));
check('installer installs canonical ovd slash commands only', /ovd-status/.test(installer) && !installer.includes(retiredSlashStatus));
check('installer installs persistent overdrive and ovd shims', /writeWorkflowShim\(shim/.test(installer) && /writeWorkflowShim\(ovdShim/.test(installer));
check('installer does not install obsolete CLI shims', !/managed legacy CLI shim/.test(installer));
check('installer safety-transforms web-artifacts-builder global installs', /applyWebArtifactsSafeTransform/.test(installer) && /hasUnsafeWebArtifactsInstallInstruction/.test(installer));
check('installer safety-transforms defuddle global install guidance', /applyDefuddleSafeTransform/.test(installer));
check('installer copies package payload into persistent runtime', /function copyRuntimePayload/.test(installer) && /pkg\.files/.test(installer) && /manifest\.json/.test(installer));
check('installer supports exact Graphify lowercase skill.md normalization', /function normalizeSkillFileCase/.test(installer) && /hasExactDirEntry/.test(installer) && /agentic-graphify-safe/.test(installer));
check('installer supports v0.11 no-tool-install flag for helper and official installers', /--no-tool-install/.test(installer) && /options\.noToolInstall/.test(installer) && /Skipping official installer-backed sources because --no-tool-install/.test(installer));
check('installer supports optional tool setup engine', /function setupOptionalTools/.test(installer) && /function graphifyToolSetup/.test(installer) && /function ffmpegToolSetup/.test(installer) && /function ytDlpToolSetup/.test(installer) && /function browserToolSetup/.test(installer));
check('installer pins Graphify package setup', /graphifyy==0\.1\.14/.test(installer));
check('installer Graphify setup avoids global pip and break-system-packages', /managed venv/.test(installer) && /pipx install/.test(installer) && /never uses global pip/.test(installer) && /hasUnsafeGraphifyInstallInstruction/.test(installer));
check('installer Graphify setup prefers Python 3.10-3.12', /function selectGraphifyPython/.test(installer) && /Python 3\.10-3\.12/.test(installer) && /--python/.test(installer));
check('installer supports v0.10 safety transforms', /agentic-design-extract-safe/.test(installer) && /agentic-claude-video-safe/.test(installer) && /agentic-humanizer-ethics/.test(installer));
check('installer strips nested claude-video plugin payloads', /function stripClaudeVideoNestedPayload/.test(installer) && /\.claude-plugin/.test(installer) && /\.codex-plugin/.test(installer));
check('installer uses tokenized workflow hook command matching', /function shellWords/.test(installer) && /isWorkflowCommand/.test(installer) && !/overdrive\|/.test(installer));
check('workflow migration command is absent', !/overdrive migrate/.test(installer) && !/migrateCurrentProjectWorkflow/.test(installer));
check('installer Design Extract transform prefers system Chrome and public URLs', /--system-chrome/.test(installer) && /Only extract public pages/.test(installer));
check('installer Design Extract browser setup does not install MCP or browser state', /never installs extensions, MCP servers, cookies, authenticated sessions, or global CLIs/.test(installer));
check('installer Claude Video transform preserves preflight and key safety', /Overdrive normally attempts setup during install/.test(installer) && /do not ask the user to paste a key into chat/.test(installer));
check('installer optional setup is fail-open', /status: 'fallback'/.test(installer) && /never hard-fails the main install/.test(installer) && /Optional tool setup fallbacks/.test(installer));
check('installer optional setup avoids sudo execution', !/ops\.run\([^)]*sudo/.test(installer) && !/runCommand\([^)]*sudo/.test(installer));
const workflowTests = read('scripts/test-ovd-workflow.js');
check('installer tests cover optional setup', /fakeToolOps/.test(workflowTests) && /--no-tool-install/.test(workflowTests) && /sudo/.test(workflowTests));
check('behavioral tests cover exact SKILL.md casing', /exact SKILL\.md directory entry/.test(workflowTests) && /readdirSync/.test(workflowTests));
check('behavioral tests cover hook idempotency and canonical commands', /seedDuplicateWorkflowHooks/.test(workflowTests) && /exactly one managed workflow hook group/.test(workflowTests) && /canonical Overdrive hook commands/.test(workflowTests));
check('behavioral tests cover claude-video nested payload stripping', /claude-video transform strips nested command\/plugin payloads/.test(workflowTests));
check('behavioral tests cover uninstall helper cleanup', /uninstall removes managed helper tools/.test(workflowTests));
check('source fidelity report generator exists', exists('scripts/source-fidelity-report.js') && /source:fidelity/.test(read('package.json')));

const ovdWorkflow = read('lib/ovd-workflow.js');
check('ovd-workflow required files include research.md', /requiredFiles[\s\S]*research\.md/.test(ovdWorkflow));
check('ovd-workflow required files include preferences.md', /requiredFiles[\s\S]*preferences\.md/.test(ovdWorkflow));
check('ovd-workflow required files include knowledge-index.json', /requiredFiles[\s\S]*knowledge-index\.json/.test(ovdWorkflow));
check('ovd-workflow required dirs include knowledge', /requiredDirs[\s\S]*knowledge/.test(ovdWorkflow));
check('ovd-workflow config includes knowledge_autosummarize', /knowledge_autosummarize/.test(ovdWorkflow));
check('ovd-workflow exports knowledge helper', /function knowledge/.test(ovdWorkflow) && /module\.exports[\s\S]*knowledge/.test(ovdWorkflow));
check('ovd-workflow seeds research objectivity mandate', /objective, evidence-based standpoint/.test(ovdWorkflow));
check('ovd-workflow seeds preferences do-not guidance', /do-not rules/.test(ovdWorkflow));
check('ovd-workflow hook context avoids volatile issue counts', !/Workflow doctor currently reports/.test(ovdWorkflow));
check('ovd-workflow exports recordDecision helper', /recordDecision/.test(ovdWorkflow) && /module\.exports[\s\S]*recordDecision/.test(ovdWorkflow));
check('ovd-workflow exports usage helper', /function usage/.test(ovdWorkflow) && /formatUsage/.test(ovdWorkflow) && /module\.exports[\s\S]*usage/.test(ovdWorkflow));
check('ovd-workflow usage avoids content printing in tests', /SECRET PROMPT CONTENT SHOULD NOT PRINT/.test(read('scripts/test-ovd-workflow.js')));
check('ovd-workflow has no obsolete project-state migration', !ovdWorkflow.includes(retiredSolidBrand) && !/migrateLegacyWorkflow/.test(ovdWorkflow));
check('ovd-workflow uses only OVERDRIVE_WORKFLOW disable env', /OVERDRIVE_WORKFLOW/.test(ovdWorkflow) && !/AGENTIC_SUPERCHARGE_WORKFLOW/.test(ovdWorkflow));
check('ovd-workflow statusline uses OVD label', /OVD: off/.test(ovdWorkflow) && /OVD:\$\{active\}/.test(ovdWorkflow));

const mcpDocs = read('docs/MCP_AND_CONNECTORS.md');
check('MCP docs mention optional MarkItDown MCP', /markitdown/i.test(mcpDocs) && /optional/i.test(mcpDocs));
check('MCP docs mention Browserbase as optional', /Browserbase/i.test(mcpDocs) && /not installed/i.test(mcpDocs));
check('catalog health doc exists', exists('docs/catalog-health.md'));
check('LICENSE is Apache-2.0 text', /Apache License[\s\S]*Version 2\.0/.test(read('LICENSE')) && read('LICENSE').includes('Radu Stefan Dumitru'));
check('NOTICE exists and points to third-party notices', exists('NOTICE') && /Overdrive/.test(read('NOTICE')) && /THIRD_PARTY_NOTICES\.md/.test(read('NOTICE')));

const changelog = read('CHANGELOG.md');
check(`CHANGELOG has v${pkg.version} entry`, changelog.includes(`## v${pkg.version}`));

if (failures.length > 0) {
  console.error(`\nConsistency check failed with ${failures.length} issue${failures.length === 1 ? '' : 's'} after ${passed} passing check${passed === 1 ? '' : 's'}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Consistency check passed (${passed} checks).`);
