#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  IGNORED_TOP_LEVEL,
  normalizePosix,
  immediateParent,
  computeFileTreeSignature,
  writeSignatureToTags,
  normalizeChangedPaths,
  detectDrift,
  formatResult
} = require('../lib/ovd-plan/drift-detector');

const codebaseMapper = require('../lib/ovd-plan/codebase-mapper');
const { MAPPER_KEYS, tagsPath } = codebaseMapper;

const verbose = process.argv.includes('--verbose');
let passed = 0;
const failures = [];

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

function makeTempProject(name) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ovd-plan-drift-test-${name}-`));
  const projectDir = path.join(tmpRoot, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"test"}\n');
  fs.mkdirSync(path.join(projectDir, '.overdrive', 'codebase'), { recursive: true });
  return { projectDir, tmpRoot };
}

function writeTags(projectDir, overrides = {}) {
  const defaultTags = {
    scannedAt: new Date().toISOString(),
    mappers: MAPPER_KEYS.reduce((acc, k) => {
      acc[k] = { file: `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}.md`, sources: [] };
      return acc;
    }, {})
  };
  // Patch with real filenames for keys whose camelCase doesn't trivially round-trip.
  defaultTags.mappers.techStack.file = 'tech-stack.md';
  const merged = { ...defaultTags, ...overrides };
  if (overrides.mappers) {
    merged.mappers = { ...defaultTags.mappers, ...overrides.mappers };
  }
  fs.writeFileSync(tagsPath(projectDir), JSON.stringify(merged, null, 2) + '\n');
  return merged;
}

function cleanup(tmpRoot) {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

console.log('ovd-plan drift-detector tests');

// --- 0. Module surface ---
{
  check('IGNORED_TOP_LEVEL is a Set', IGNORED_TOP_LEVEL instanceof Set);
  check('IGNORED_TOP_LEVEL excludes .git', IGNORED_TOP_LEVEL.has('.git'));
  check('IGNORED_TOP_LEVEL excludes node_modules', IGNORED_TOP_LEVEL.has('node_modules'));
  check('IGNORED_TOP_LEVEL excludes .overdrive', IGNORED_TOP_LEVEL.has('.overdrive'));
  check('IGNORED_TOP_LEVEL excludes build outputs (dist, build, coverage)', IGNORED_TOP_LEVEL.has('dist') && IGNORED_TOP_LEVEL.has('build') && IGNORED_TOP_LEVEL.has('coverage'));
  check('normalizePosix: backslash → slash + ./ stripped + trim', normalizePosix('  ./lib\\foo.js  ') === 'lib/foo.js');
  check('normalizePosix: non-string returns empty', normalizePosix(null) === '' && normalizePosix(42) === '');
  check('immediateParent: top-level returns ""', immediateParent('foo.js') === '');
  check('immediateParent: nested returns dirname', immediateParent('lib/ovd-plan/index.js') === 'lib/ovd-plan');
  check('immediateParent: single-level returns dir', immediateParent('lib/foo.js') === 'lib');
}

// --- 1. computeFileTreeSignature ---
{
  const { projectDir, tmpRoot } = makeTempProject('signature-basic');
  try {
    fs.mkdirSync(path.join(projectDir, 'lib'));
    fs.mkdirSync(path.join(projectDir, 'scripts'));
    fs.mkdirSync(path.join(projectDir, 'node_modules')); // should be ignored
    fs.writeFileSync(path.join(projectDir, 'README.md'), 'hi\n');
    const sig = computeFileTreeSignature(projectDir);
    check('signature: returns object with algorithm/hash/entries', sig && sig.algorithm === 'sha1' && typeof sig.hash === 'string' && Array.isArray(sig.entries));
    check('signature: includes lib/scripts/README.md/package.json', ['lib', 'scripts', 'README.md', 'package.json'].every((e) => sig.entries.includes(e)));
    check('signature: excludes node_modules and .overdrive', !sig.entries.includes('node_modules') && !sig.entries.includes('.overdrive'));
    check('signature: entries are sorted', JSON.stringify(sig.entries) === JSON.stringify(sig.entries.slice().sort()));
    check('signature: hash is 40 hex chars (sha1)', /^[0-9a-f]{40}$/.test(sig.hash));
  } finally {
    cleanup(tmpRoot);
  }
}
{
  // Signature is stable across calls when tree unchanged
  const { projectDir, tmpRoot } = makeTempProject('signature-stable');
  try {
    fs.mkdirSync(path.join(projectDir, 'lib'));
    const a = computeFileTreeSignature(projectDir);
    const b = computeFileTreeSignature(projectDir);
    check('signature: stable across two reads when tree unchanged', a.hash === b.hash);
    // Adding a new top-level dir changes the hash
    fs.mkdirSync(path.join(projectDir, 'mobile'));
    const c = computeFileTreeSignature(projectDir);
    check('signature: changes when a new top-level dir is added', c.hash !== a.hash);
    // Adding/changing files in .overdrive does NOT change the signature
    fs.writeFileSync(path.join(projectDir, '.overdrive', 'noise.txt'), 'x\n');
    const d = computeFileTreeSignature(projectDir);
    check('signature: .overdrive changes do not affect hash', d.hash === c.hash);
  } finally {
    cleanup(tmpRoot);
  }
}
{
  // Missing directory returns null
  check('signature: null on nonexistent rootDir', computeFileTreeSignature('/tmp/definitely-not-a-real-overdrive-test-dir-xyz123') === null);
}

// --- 2. normalizeChangedPaths ---
{
  check('normalize: undefined → []', JSON.stringify(normalizeChangedPaths(undefined).normalized) === '[]');
  check('normalize: null → []', JSON.stringify(normalizeChangedPaths(null).normalized) === '[]');

  const r1 = normalizeChangedPaths(['lib/foo.js', '  scripts/bar.js  ', '']);
  check('normalize: trims whitespace + drops empties', r1.ok && JSON.stringify(r1.normalized) === JSON.stringify(['lib/foo.js', 'scripts/bar.js']));

  const r2 = normalizeChangedPaths(['lib\\foo.js']);
  check('normalize: converts backslashes to slashes', r2.normalized[0] === 'lib/foo.js');

  const r3 = normalizeChangedPaths('not an array');
  check('normalize: non-array → ok=false', r3.ok === false && /must be an array/.test(r3.reason));

  const r4 = normalizeChangedPaths(['lib/foo.js', 42]);
  check('normalize: non-string element → ok=false', r4.ok === false && /must be strings/.test(r4.reason));
}

// --- 3. writeSignatureToTags ---
{
  const { projectDir, tmpRoot } = makeTempProject('sig-write-no-tags');
  try {
    // Refuses to create _tags.json from scratch
    const ok = writeSignatureToTags(projectDir, { algorithm: 'sha1', hash: 'aaa', entries: [] });
    check('writeSignatureToTags: refuses to create _tags.json when missing', ok === false && !fs.existsSync(tagsPath(projectDir)));
  } finally {
    cleanup(tmpRoot);
  }
}
{
  const { projectDir, tmpRoot } = makeTempProject('sig-write-existing');
  try {
    writeTags(projectDir);
    const sig = { algorithm: 'sha1', hash: 'first', entries: ['lib'] };
    const wrote = writeSignatureToTags(projectDir, sig);
    check('writeSignatureToTags: writes signature into existing _tags.json', wrote === true);
    const raw = JSON.parse(fs.readFileSync(tagsPath(projectDir), 'utf8'));
    check('writeSignatureToTags: persisted under fileTreeSignature key', raw.fileTreeSignature && raw.fileTreeSignature.hash === 'first');
    check('writeSignatureToTags: mappers section preserved (narrow write contract)', raw.mappers && MAPPER_KEYS.every((k) => raw.mappers[k]));
    check('writeSignatureToTags: scannedAt preserved (narrow write contract)', typeof raw.scannedAt === 'string');

    // Idempotent write: same signature → returns false, file unchanged
    const before = fs.readFileSync(tagsPath(projectDir), 'utf8');
    const second = writeSignatureToTags(projectDir, sig);
    const after = fs.readFileSync(tagsPath(projectDir), 'utf8');
    check('writeSignatureToTags: idempotent for unchanged signature', second === false && before === after);

    // Different signature → returns true, hash updated, sibling fields preserved
    const wrote2 = writeSignatureToTags(projectDir, { algorithm: 'sha1', hash: 'second', entries: ['lib', 'mobile'] });
    check('writeSignatureToTags: returns true on hash change', wrote2 === true);
    const raw2 = JSON.parse(fs.readFileSync(tagsPath(projectDir), 'utf8'));
    check('writeSignatureToTags: hash advanced to second', raw2.fileTreeSignature.hash === 'second');
    check('writeSignatureToTags: mappers still untouched after second write', raw2.mappers && MAPPER_KEYS.every((k) => raw2.mappers[k]));
  } finally {
    cleanup(tmpRoot);
  }
}
{
  const { projectDir, tmpRoot } = makeTempProject('sig-write-corrupt');
  try {
    fs.writeFileSync(tagsPath(projectDir), '{ not valid json');
    const ok = writeSignatureToTags(projectDir, { algorithm: 'sha1', hash: 'x', entries: [] });
    check('writeSignatureToTags: false on corrupt _tags.json (no throw)', ok === false);
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 4. detectDrift: null rootDir ---
{
  const r = detectDrift(null, {});
  check('detect(null root): ok=false', r.ok === false);
  check('detect(null root): status=drift-detect', r.status === 'drift-detect');
  check('detect(null root): text non-empty', typeof r.text === 'string' && r.text.length > 0);
}

// --- 5. detectDrift: invalid changedPaths ---
{
  const { projectDir, tmpRoot } = makeTempProject('detect-bad-input');
  try {
    writeTags(projectDir);
    const r = detectDrift(projectDir, { changedPaths: 'not an array' });
    check('detect(bad input): ok=false', r.ok === false);
    check('detect(bad input): reason mentions array', /must be an array/.test(r.reason));
    const r2 = detectDrift(projectDir, { changedPaths: ['lib/foo.js', null] });
    check('detect(bad item): ok=false', r2.ok === false && /must be strings/.test(r2.reason));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 6. detectDrift: first-run (no _tags.json) → flag all ---
{
  const { projectDir, tmpRoot } = makeTempProject('first-run');
  try {
    const r = detectDrift(projectDir, { changedPaths: ['lib/foo.js'] });
    check('first-run: ok=true', r.ok === true);
    check('first-run: needsRefresh has all 5 mappers', r.needsRefresh.length === 5 && MAPPER_KEYS.every((k) => r.needsRefresh.includes(k)));
    check('first-run: reason mentions first run', /first run/i.test(r.reason));
    check('first-run: signals.firstRun=true', r.signals.firstRun === true);
    check('first-run: signatureWritten=false (refused to create _tags.json from scratch)', r.signals.signatureWritten === false);
    check('first-run: _tags.json still does not exist', !fs.existsSync(tagsPath(projectDir)));
    check('first-run: perMapperReasons covers every mapper', MAPPER_KEYS.every((k) => Array.isArray(r.perMapperReasons[k]) && r.perMapperReasons[k].length > 0));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 7. detectDrift: tags exist, no signature → flag all + persist signature ---
{
  const { projectDir, tmpRoot } = makeTempProject('first-sig');
  try {
    fs.mkdirSync(path.join(projectDir, 'lib'));
    writeTags(projectDir);
    const r = detectDrift(projectDir, { changedPaths: [] });
    check('no-prior-sig: ok=true', r.ok === true);
    check('no-prior-sig: flags all 5', r.needsRefresh.length === 5);
    check('no-prior-sig: reason mentions no prior signature', /no prior file-tree signature/i.test(r.reason));
    check('no-prior-sig: signals.fileTreeChanged=true', r.signals.fileTreeChanged === true);
    check('no-prior-sig: signatureWritten=true', r.signals.signatureWritten === true);
    const raw = JSON.parse(fs.readFileSync(tagsPath(projectDir), 'utf8'));
    check('no-prior-sig: fileTreeSignature now in _tags.json', raw.fileTreeSignature && typeof raw.fileTreeSignature.hash === 'string');
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 8. detectDrift: tags + matching signature, no changed paths → no flag ---
{
  const { projectDir, tmpRoot } = makeTempProject('no-changes');
  try {
    fs.mkdirSync(path.join(projectDir, 'lib'));
    const sig = computeFileTreeSignature(projectDir);
    writeTags(projectDir, { fileTreeSignature: sig });
    const r = detectDrift(projectDir, { changedPaths: [] });
    check('no-changes: ok=true', r.ok === true);
    check('no-changes: needsRefresh empty', r.needsRefresh.length === 0);
    check('no-changes: reason mentions no changed paths', /no changed paths/i.test(r.reason));
    check('no-changes: signals.fileTreeChanged=false', r.signals.fileTreeChanged === false);
    check('no-changes: signatureWritten=false (idempotent)', r.signals.signatureWritten === false);
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 9. detectDrift: file-tree drift (new top-level dir) → flag all ---
{
  const { projectDir, tmpRoot } = makeTempProject('tree-drift');
  try {
    fs.mkdirSync(path.join(projectDir, 'lib'));
    const sigBefore = computeFileTreeSignature(projectDir);
    writeTags(projectDir, { fileTreeSignature: sigBefore });

    // Add a new top-level dir
    fs.mkdirSync(path.join(projectDir, 'mobile'));
    const r = detectDrift(projectDir, { changedPaths: [] });
    check('tree-drift: flags all 5', r.needsRefresh.length === 5);
    check('tree-drift: reason mentions top-level + added', /top-level changed/.test(r.reason) && /added \[mobile\]/.test(r.reason));
    check('tree-drift: signatureWritten=true', r.signals.signatureWritten === true);
    const raw = JSON.parse(fs.readFileSync(tagsPath(projectDir), 'utf8'));
    check('tree-drift: persisted new signature entries include mobile', raw.fileTreeSignature.entries.includes('mobile'));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 10. detectDrift: per-mapper touched-path (exact match flags only that mapper
// when every mapper's sources live in DISTINCT immediate-parent dirs) ---
{
  const { projectDir, tmpRoot } = makeTempProject('exact-match');
  try {
    fs.mkdirSync(path.join(projectDir, 'lib'));
    const sig = computeFileTreeSignature(projectDir);
    writeTags(projectDir, {
      fileTreeSignature: sig,
      mappers: {
        architecture: { file: 'architecture.md', sources: ['lib/installer.js'] },
        patterns: { file: 'patterns.md', sources: ['scripts/test-x.js'] },
        techStack: { file: 'tech-stack.md', sources: ['package.json'] },
        quality: { file: 'quality.md', sources: ['__tests__/foo.test.js'] },
        // Deliberately in a different immediate-parent dir than architecture's
        // lib/installer.js so this test isolates exact-match behavior from
        // the same-immediate-parent semantic (covered by test 11).
        concerns: { file: 'concerns.md', sources: ['security/audit.md'] }
      }
    });
    const r = detectDrift(projectDir, { changedPaths: ['lib/installer.js'] });
    check('exact: needsRefresh = [architecture]', r.needsRefresh.length === 1 && r.needsRefresh[0] === 'architecture');
    check('exact: perMapperReasons.architecture mentions exact match', r.perMapperReasons.architecture && /exact:\s*lib\/installer\.js/.test(r.perMapperReasons.architecture[0]));
    check('exact: reason names architecture', /architecture/.test(r.reason) && /1 mapper/.test(r.reason));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 11. detectDrift: same immediate-parent dir flags (the design Q2 lock) ---
{
  const { projectDir, tmpRoot } = makeTempProject('same-parent');
  try {
    fs.mkdirSync(path.join(projectDir, 'lib'));
    const sig = computeFileTreeSignature(projectDir);
    writeTags(projectDir, {
      fileTreeSignature: sig,
      mappers: {
        architecture: { file: 'architecture.md', sources: ['lib/ovd-plan/index.js'] },
        patterns: { file: 'patterns.md', sources: ['lib/ovd-plan/preferences-elicit.js'] },
        techStack: { file: 'tech-stack.md', sources: ['package.json'] },
        quality: { file: 'quality.md', sources: [] },
        concerns: { file: 'concerns.md', sources: [] }
      }
    });
    // New file in lib/ovd-plan/ → flags architecture + patterns (same immediate parent)
    const r = detectDrift(projectDir, { changedPaths: ['lib/ovd-plan/foo.js'] });
    check('same-parent: flags architecture + patterns', r.needsRefresh.length === 2 && r.needsRefresh.includes('architecture') && r.needsRefresh.includes('patterns'));
    check('same-parent: reason format human-readable', /same-dir:\s*lib\/ovd-plan\/foo\.js/.test(r.perMapperReasons.architecture[0]));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 12. detectDrift: shared ancestor (lib/) but DIFFERENT immediate parent does NOT flag ---
{
  // This is the explicit Q2 boundary the user called out: lib/installer.js changing
  // should NOT flag a mapper that recorded lib/ovd-plan/index.js. Sharing `lib/` is too loose.
  const { projectDir, tmpRoot } = makeTempProject('ancestor-no-flag');
  try {
    fs.mkdirSync(path.join(projectDir, 'lib'));
    const sig = computeFileTreeSignature(projectDir);
    writeTags(projectDir, {
      fileTreeSignature: sig,
      mappers: {
        architecture: { file: 'architecture.md', sources: ['lib/ovd-plan/index.js'] },
        patterns: { file: 'patterns.md', sources: [] },
        techStack: { file: 'tech-stack.md', sources: [] },
        quality: { file: 'quality.md', sources: [] },
        concerns: { file: 'concerns.md', sources: [] }
      }
    });
    const r = detectDrift(projectDir, { changedPaths: ['lib/installer.js'] });
    check('ancestor-boundary: no flag when shared ancestor is lib/ but immediate parents differ', r.needsRefresh.length === 0);
    check('ancestor-boundary: reason mentions no overlap', /no overlap/i.test(r.reason));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 13. detectDrift: top-level file change (no parent) ---
{
  // package.json at root → immediate parent is '' for both sides; we should still flag.
  const { projectDir, tmpRoot } = makeTempProject('top-level-file');
  try {
    fs.mkdirSync(path.join(projectDir, 'lib'));
    const sig = computeFileTreeSignature(projectDir);
    writeTags(projectDir, {
      fileTreeSignature: sig,
      mappers: {
        architecture: { file: 'architecture.md', sources: [] },
        patterns: { file: 'patterns.md', sources: [] },
        techStack: { file: 'tech-stack.md', sources: ['package.json'] },
        quality: { file: 'quality.md', sources: [] },
        concerns: { file: 'concerns.md', sources: [] }
      }
    });
    const r = detectDrift(projectDir, { changedPaths: ['package.json'] });
    check('top-level: exact match flags techStack', r.needsRefresh.length === 1 && r.needsRefresh[0] === 'techStack');
  } finally {
    cleanup(tmpRoot);
  }
}
{
  // But two different top-level files (e.g., package.json recorded, README.md changed)
  // should NOT flag — both have immediate parent '' which we deliberately reject.
  const { projectDir, tmpRoot } = makeTempProject('top-level-no-cross-flag');
  try {
    fs.mkdirSync(path.join(projectDir, 'lib'));
    const sig = computeFileTreeSignature(projectDir);
    writeTags(projectDir, {
      fileTreeSignature: sig,
      mappers: {
        architecture: { file: 'architecture.md', sources: [] },
        patterns: { file: 'patterns.md', sources: [] },
        techStack: { file: 'tech-stack.md', sources: ['package.json'] },
        quality: { file: 'quality.md', sources: [] },
        concerns: { file: 'concerns.md', sources: [] }
      }
    });
    const r = detectDrift(projectDir, { changedPaths: ['README.md'] });
    check('top-level-no-cross-flag: README.md does not flag techStack (different file, both root)', r.needsRefresh.length === 0);
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 14. detectDrift: docs / tests / unrelated files don't flag ---
{
  // r3 §5 Task 2.7 success criterion: "Touching an unrelated file (docs, tests) doesn't flag anything."
  const { projectDir, tmpRoot } = makeTempProject('unrelated-no-flag');
  try {
    fs.mkdirSync(path.join(projectDir, 'lib'));
    const sig = computeFileTreeSignature(projectDir);
    writeTags(projectDir, {
      fileTreeSignature: sig,
      mappers: {
        architecture: { file: 'architecture.md', sources: ['lib/installer.js'] },
        patterns: { file: 'patterns.md', sources: ['lib/ovd-plan/index.js'] },
        techStack: { file: 'tech-stack.md', sources: ['package.json'] },
        quality: { file: 'quality.md', sources: ['__tests__/foo.test.js'] },
        concerns: { file: 'concerns.md', sources: ['lib/security.js'] }
      }
    });
    const r = detectDrift(projectDir, { changedPaths: ['docs/README.md', 'CHANGELOG.md'] });
    check('unrelated: no mappers flagged', r.needsRefresh.length === 0);
    check('unrelated: reason mentions no overlap + examined count', /no overlap/i.test(r.reason) && /2 changed path/.test(r.reason));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 15. detectDrift: multiple changed paths flag multiple mappers ---
{
  const { projectDir, tmpRoot } = makeTempProject('multi-flag');
  try {
    fs.mkdirSync(path.join(projectDir, 'lib'));
    const sig = computeFileTreeSignature(projectDir);
    writeTags(projectDir, {
      fileTreeSignature: sig,
      mappers: {
        // Each mapper's source lives in a distinct immediate-parent dir so the
        // changedPaths below each match exactly one mapper without colliding via
        // the same-dir rule.
        architecture: { file: 'architecture.md', sources: ['lib/installer.js'] },
        patterns: { file: 'patterns.md', sources: ['scripts/test-x.js'] },
        techStack: { file: 'tech-stack.md', sources: ['package.json'] },
        quality: { file: 'quality.md', sources: ['__tests__/foo.test.js'] },
        concerns: { file: 'concerns.md', sources: ['security/audit.md'] }
      }
    });
    const r = detectDrift(projectDir, { changedPaths: ['lib/installer.js', 'package.json', '__tests__/foo.test.js'] });
    check('multi: flags exactly architecture + techStack + quality', r.needsRefresh.length === 3 && r.needsRefresh.includes('architecture') && r.needsRefresh.includes('techStack') && r.needsRefresh.includes('quality'));
    check('multi: needsRefresh in mapper-key order', JSON.stringify(r.needsRefresh) === JSON.stringify(['architecture', 'techStack', 'quality']));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 16. detectDrift: idempotent signature side effect ---
{
  const { projectDir, tmpRoot } = makeTempProject('idempotent');
  try {
    fs.mkdirSync(path.join(projectDir, 'lib'));
    const sig = computeFileTreeSignature(projectDir);
    writeTags(projectDir, { fileTreeSignature: sig });

    const before = fs.readFileSync(tagsPath(projectDir), 'utf8');
    const r = detectDrift(projectDir, { changedPaths: [] });
    const after = fs.readFileSync(tagsPath(projectDir), 'utf8');
    check('idempotent: ok=true', r.ok === true);
    check('idempotent: signatureWritten=false', r.signals.signatureWritten === false);
    check('idempotent: _tags.json byte-equal across run', before === after);
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 17. detectDrift: narrow-write contract — mapper sources untouched after detectDrift ---
{
  const { projectDir, tmpRoot } = makeTempProject('narrow-write');
  try {
    fs.mkdirSync(path.join(projectDir, 'lib'));
    writeTags(projectDir, {
      mappers: {
        architecture: { file: 'architecture.md', sources: ['lib/installer.js', 'lib/ovd-plan/index.js'] },
        patterns: { file: 'patterns.md', sources: ['scripts/x.js'] },
        techStack: { file: 'tech-stack.md', sources: ['package.json'] },
        quality: { file: 'quality.md', sources: [] },
        concerns: { file: 'concerns.md', sources: [] }
      }
    });
    // Trigger first-sig persistence
    detectDrift(projectDir, { changedPaths: [] });
    // Trigger a tree-drift persistence
    fs.mkdirSync(path.join(projectDir, 'mobile'));
    detectDrift(projectDir, { changedPaths: [] });

    const raw = JSON.parse(fs.readFileSync(tagsPath(projectDir), 'utf8'));
    check('narrow-write: architecture.sources verbatim across two detectDrift calls', JSON.stringify(raw.mappers.architecture.sources) === JSON.stringify(['lib/installer.js', 'lib/ovd-plan/index.js']));
    check('narrow-write: patterns.sources verbatim', JSON.stringify(raw.mappers.patterns.sources) === JSON.stringify(['scripts/x.js']));
    check('narrow-write: techStack.sources verbatim', JSON.stringify(raw.mappers.techStack.sources) === JSON.stringify(['package.json']));
    check('narrow-write: signature updated to include mobile', raw.fileTreeSignature && raw.fileTreeSignature.entries.includes('mobile'));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 18. detectDrift: backslash path normalization in changedPaths ---
{
  const { projectDir, tmpRoot } = makeTempProject('backslash-normalize');
  try {
    fs.mkdirSync(path.join(projectDir, 'lib'));
    const sig = computeFileTreeSignature(projectDir);
    writeTags(projectDir, {
      fileTreeSignature: sig,
      mappers: {
        architecture: { file: 'architecture.md', sources: ['lib/installer.js'] },
        patterns: { file: 'patterns.md', sources: [] },
        techStack: { file: 'tech-stack.md', sources: [] },
        quality: { file: 'quality.md', sources: [] },
        concerns: { file: 'concerns.md', sources: [] }
      }
    });
    const r = detectDrift(projectDir, { changedPaths: ['lib\\installer.js'] });
    check('backslash: still flags architecture (normalized to posix)', r.needsRefresh.length === 1 && r.needsRefresh[0] === 'architecture');
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 19. formatResult output ---
{
  const result = {
    ok: true,
    status: 'drift-detect',
    needsRefresh: ['architecture', 'patterns'],
    reason: '2 changed path(s) flagged 2 mapper(s): architecture, patterns',
    signals: { firstRun: false, fileTreeChanged: false, signatureWritten: false, changedPathsCount: 2 },
    perMapperReasons: {
      architecture: ['exact: lib/installer.js'],
      patterns: ['same-dir: lib/ovd-plan/foo.js (recorded lib/ovd-plan/index.js)']
    },
    summary: 'drift: 2 mapper(s) flagged (architecture, patterns)'
  };
  const txt = formatResult(result);
  check('formatResult: starts with command label', /Overdrive.*\/ovd-workflow drift/.test(txt));
  check('formatResult: includes summary line', txt.includes('drift: 2 mapper(s) flagged'));
  check('formatResult: shows signals block', /Signals:/.test(txt) && /file-tree changed: no/.test(txt));
  check('formatResult: lists flagged mappers with per-mapper reasons', /architecture: exact:/.test(txt) && /patterns: same-dir:/.test(txt));
  check('formatResult: suggests next step (workflow map / MAP REFRESH)', /workflow map/.test(txt) && /MAP REFRESH/.test(txt));

  const cleanResult = {
    ok: true,
    status: 'drift-detect',
    needsRefresh: [],
    reason: 'no changed paths supplied; nothing to diff',
    signals: { firstRun: false, fileTreeChanged: false, signatureWritten: false, changedPathsCount: 0 },
    perMapperReasons: {},
    summary: 'drift: no mappers flagged'
  };
  const cleanText = formatResult(cleanResult);
  check('formatResult: clean text says "No mappers flagged"', /No mappers flagged/.test(cleanText) && /current/.test(cleanText));

  const failResult = { ok: false, reason: 'no rootDir resolved' };
  check('formatResult: failure path readable', /failed/.test(formatResult(failResult)));
}

// --- 20. Dispatch routing: subcommand=drift via index.js ---
{
  const ovdPlan = require('../lib/ovd-plan');
  const { projectDir, tmpRoot } = makeTempProject('dispatch-no-entries');
  try {
    const r = ovdPlan.runWorkflow({ projectDir, subcommand: 'drift' }, process.env);
    check('dispatch(drift): status=drift-detect', r.status === 'drift-detect');
    // No tags + no entries-json → first-run → flag all
    check('dispatch(drift): first-run flags all 5', r.ok === true && r.needsRefresh.length === 5);
  } finally {
    cleanup(tmpRoot);
  }
}
{
  const ovdPlan = require('../lib/ovd-plan');
  const { projectDir, tmpRoot } = makeTempProject('dispatch-with-entries');
  try {
    fs.mkdirSync(path.join(projectDir, 'lib'));
    const sig = computeFileTreeSignature(projectDir);
    writeTags(projectDir, {
      fileTreeSignature: sig,
      mappers: {
        architecture: { file: 'architecture.md', sources: ['lib/installer.js'] },
        patterns: { file: 'patterns.md', sources: [] },
        techStack: { file: 'tech-stack.md', sources: [] },
        quality: { file: 'quality.md', sources: [] },
        concerns: { file: 'concerns.md', sources: [] }
      }
    });
    const r = ovdPlan.runWorkflow({
      projectDir,
      subcommand: 'drift',
      entriesJson: JSON.stringify({ changedPaths: ['lib/installer.js'] })
    }, process.env);
    check('dispatch(drift + entries): flags only architecture', r.needsRefresh.length === 1 && r.needsRefresh[0] === 'architecture');
  } finally {
    cleanup(tmpRoot);
  }
}
{
  const ovdPlan = require('../lib/ovd-plan');
  const { projectDir, tmpRoot } = makeTempProject('dispatch-bad-json');
  try {
    const r = ovdPlan.runWorkflow({ projectDir, subcommand: 'drift', entriesJson: '{not valid json' }, process.env);
    check('dispatch(drift bad JSON): ok=false', r.ok === false);
    check('dispatch(drift bad JSON): status=drift-detect', r.status === 'drift-detect');
    check('dispatch(drift bad JSON): text mentions Invalid --entries-json', /Invalid --entries-json/.test(r.text));
  } finally {
    cleanup(tmpRoot);
  }
}

// --- 21. Namespace + top-level exports ---
{
  const ovdPlan = require('../lib/ovd-plan');
  check('exports: driftDetector namespace exists', typeof ovdPlan.driftDetector === 'object' && ovdPlan.driftDetector !== null);
  check('exports: detectDrift is the same function as namespace', ovdPlan.detectDrift === ovdPlan.driftDetector.detectDrift);
}

// --- summary ---
if (failures.length > 0) {
  console.log(`\n${failures.length} failure(s):`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`\n${passed} checks passed.`);
