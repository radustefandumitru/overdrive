'use strict';

// Task 7.3 — `overdrive verify --plan` project-integrity verifier.
//
// This is the v2-native project health check (the delegation target for the
// repurposed `/ovd-doctor`, Task 2.9). It is distinct from `verify.js`
// (LEAF VERIFY / CLUSTER VERIFY, Task 4.3): this module audits the *layout*
// of an ovd-plan project — OVERDRIVE.md parseability, cache↔tree consistency,
// `.overdrive/` structure, and orphan files. It reuses parser.js + cache.js
// (Pattern 2 — single canonical primitives; no re-implementation).
//
// Pure function: reads the filesystem, returns structured findings. No writes,
// no LLM (Pattern 1 — CLI never calls an LLM). The installer dispatch renders
// the findings and sets the process exit code.

const fs = require('fs');
const path = require('path');

const { OVD_DIR, ovdPath, newLayoutPresent, detectOldLayout, oldLayoutMarkerCount } = require('./fs');
const { parseOverdriveMd, ParseError } = require('./parser');
const { loadCache, planPath, cachePath } = require('./cache');

const SEVERITY = { ERROR: 'error', WARNING: 'warning', INFO: 'info' };

// Directories/files expected once a project has an ovd-plan layout. Missing ones
// are warnings (created lazily by the relevant command), never hard errors.
const EXPECTED_DIRS = ['codebase', 'sessions', 'handoffs', 'reports'];
const EXPECTED_FILES = ['preferences.md', 'requirements.md', 'decisions.md'];

function finding(severity, code, message) {
  return { severity, code, message };
}

function collectNodes(node, map) {
  if (node && node.id) map.set(node.id, node);
  for (const child of (node && node.children) || []) collectNodes(child, map);
}

function summarize(findings) {
  const counts = { error: 0, warning: 0, info: 0 };
  for (const f of findings) counts[f.severity] += 1;
  return counts;
}

// Cross-check the stored cache against the freshly-parsed tree. Orphan cache
// nodes are errors (cache references a node OVERDRIVE.md no longer has); stale
// cache nodes / status drift are warnings (cache regenerates on next command).
function checkCacheConsistency(parsedTree, cache, findings) {
  if (!cache) {
    findings.push(finding(SEVERITY.WARNING, 'cache-missing',
      'plan.cache.json is missing or unreadable — run any /ovd-plan command to regenerate it.'));
    return;
  }
  const treeNodes = new Map();
  collectNodes(parsedTree, treeNodes);
  const cacheNodes = new Map();
  collectNodes(cache.tree, cacheNodes);

  for (const id of cacheNodes.keys()) {
    if (!treeNodes.has(id)) {
      findings.push(finding(SEVERITY.ERROR, 'cache-orphan-node',
        `Cache references node "${id}" that no longer exists in OVERDRIVE.md.`));
    }
  }
  for (const [id, node] of treeNodes) {
    const cacheNode = cacheNodes.get(id);
    if (!cacheNode) {
      findings.push(finding(SEVERITY.WARNING, 'cache-stale-node',
        `Node "${id}" in OVERDRIVE.md is not reflected in the cache (stale cache).`));
      continue;
    }
    if ((cacheNode.status || null) !== (node.status || null)) {
      findings.push(finding(SEVERITY.WARNING, 'cache-status-drift',
        `Node "${id}" status differs: OVERDRIVE.md="${node.status || 'none'}" vs cache="${cacheNode.status || 'none'}".`));
    }
  }
}

// Sketches under sketches/approved/ should be referenced by some leaf's
// references.sketches[]. Unreferenced files are warnings (orphans).
function checkOrphanSketches(projectDir, parsedTree, findings) {
  const approvedDir = ovdPath(projectDir, 'sketches', 'approved');
  if (!fs.existsSync(approvedDir)) return;
  const referenced = new Set();
  const nodes = new Map();
  collectNodes(parsedTree, nodes);
  for (const node of nodes.values()) {
    const refs = node.annotations && node.annotations.references;
    const sketches = refs && refs.sketches;
    if (Array.isArray(sketches)) {
      for (const s of sketches) referenced.add(path.basename(String(s)));
    }
  }
  for (const entry of fs.readdirSync(approvedDir)) {
    if (entry.startsWith('.')) continue;
    if (!referenced.has(entry)) {
      findings.push(finding(SEVERITY.WARNING, 'orphan-sketch',
        `sketches/approved/${entry} is not referenced by any leaf.`));
    }
  }
}

function checkStructure(projectDir, findings) {
  for (const dir of EXPECTED_DIRS) {
    if (!fs.existsSync(ovdPath(projectDir, dir))) {
      findings.push(finding(SEVERITY.WARNING, 'missing-dir',
        `.overdrive/${dir}/ is missing (created on demand by the relevant command).`));
    }
  }
  for (const file of EXPECTED_FILES) {
    if (!fs.existsSync(ovdPath(projectDir, file))) {
      findings.push(finding(SEVERITY.WARNING, 'missing-file',
        `.overdrive/${file} is missing.`));
    }
  }
}

// Main entry. Returns { ok, status, findings, counts }.
//   status: 'no-layout' | 'old-layout' | 'ok' | 'errors'
//   ok: true unless there is at least one error-severity finding.
function verifyPlanLayout(projectDir) {
  const findings = [];
  const planFile = planPath(projectDir);
  const hasPlanFile = fs.existsSync(planFile);
  const hasOvdDir = fs.existsSync(path.join(projectDir, OVD_DIR));
  const hasCache = fs.existsSync(cachePath(projectDir));

  // Graceful empty-project / pre-r3 cases — informational, not failures. A lone
  // cache file (no plan, no layout markers) is corruption, not a clean slate, so
  // it must fall through to the missing-plan-file check below.
  if (!hasPlanFile && !newLayoutPresent(projectDir) && !hasCache) {
    if (detectOldLayout(projectDir)) {
      findings.push(finding(SEVERITY.INFO, 'old-layout',
        `Pre-r3 .overdrive/ layout detected (${oldLayoutMarkerCount(projectDir)} legacy marker(s)) — run /ovd-workflow init to migrate.`));
      return { ok: true, status: 'old-layout', findings, counts: summarize(findings) };
    }
    findings.push(finding(SEVERITY.INFO, 'no-layout',
      'No ovd-plan layout detected — run /ovd-workflow init to create one.'));
    return { ok: true, status: 'no-layout', findings, counts: summarize(findings) };
  }

  let parsed = null;
  if (!hasPlanFile) {
    // A layout exists but there's no plan tree yet. This is the normal state
    // between `/ovd-workflow init` (which scaffolds .overdrive/) and the first
    // `/ovd-plan` (which writes OVERDRIVE.md) — a warning, not corruption.
    // It IS corruption if a cache exists without its source file.
    if (hasCache) {
      findings.push(finding(SEVERITY.ERROR, 'missing-plan-file',
        'OVERDRIVE.md is missing but plan.cache.json exists — the plan source was deleted. Restore OVERDRIVE.md or remove the stale cache.'));
    } else {
      findings.push(finding(SEVERITY.WARNING, 'plan-not-created',
        'OVERDRIVE.md not found — run /ovd-plan to create your plan tree.'));
    }
  } else {
    let content = '';
    try {
      content = fs.readFileSync(planFile, 'utf8');
    } catch (err) {
      findings.push(finding(SEVERITY.ERROR, 'plan-unreadable',
        `OVERDRIVE.md could not be read: ${err.message}`));
    }
    if (content) {
      try {
        parsed = parseOverdriveMd(content);
      } catch (err) {
        const detail = err instanceof ParseError ? err.message : String(err && err.message ? err.message : err);
        findings.push(finding(SEVERITY.ERROR, 'parse-error',
          `OVERDRIVE.md failed to parse: ${detail}`));
      }
    }
  }

  if (!hasOvdDir) {
    findings.push(finding(SEVERITY.ERROR, 'missing-ovd-dir', '.overdrive/ directory is missing.'));
  } else {
    checkStructure(projectDir, findings);
  }

  if (parsed) {
    checkCacheConsistency(parsed.tree, loadCache(projectDir), findings);
    checkOrphanSketches(projectDir, parsed.tree, findings);
  }

  const counts = summarize(findings);
  return {
    ok: counts.error === 0,
    status: counts.error === 0 ? 'ok' : 'errors',
    findings,
    counts
  };
}

// Plain-language renderer for the CLI (Pattern 7 — user-facing surfaces stay
// simple). Lists each finding with a severity tag and a one-line summary.
function renderVerifyLayout(result) {
  const lines = [];
  lines.push('ovd-plan layout verification');
  if (result.status === 'no-layout' || result.status === 'old-layout') {
    for (const f of result.findings) lines.push(`  ${f.message}`);
    return lines.join('\n');
  }
  if (result.findings.length === 0) {
    lines.push('  All checks passed.');
    return lines.join('\n');
  }
  const order = [SEVERITY.ERROR, SEVERITY.WARNING, SEVERITY.INFO];
  const tag = { error: 'ERROR', warning: 'WARN', info: 'INFO' };
  for (const sev of order) {
    for (const f of result.findings.filter((x) => x.severity === sev)) {
      lines.push(`  ${tag[sev]}  ${f.message}`);
    }
  }
  lines.push('');
  lines.push(`Summary: ${result.counts.error} error(s), ${result.counts.warning} warning(s).`);
  lines.push(result.ok ? 'Layout is healthy (no errors).' : 'Layout has errors — see above.');
  return lines.join('\n');
}

module.exports = {
  SEVERITY,
  EXPECTED_DIRS,
  EXPECTED_FILES,
  verifyPlanLayout,
  renderVerifyLayout
};
