'use strict';

const fs = require('fs');
const path = require('path');

const fsHelpers = require('./fs');
const { appendUnderHeader } = require('./migrate');

// Category schema per r3 §4.5 (Requirements = functional / non-functional /
// out-of-scope). Mirrors the shape of preferences-elicit.js so the two
// Socratic flows feel identical to a returning user.
const CATEGORIES = [
  {
    key: 'functional',
    header: 'Functional',
    question: 'What does this project NEED to do? What are the must-have capabilities, user flows, and behaviors?',
    examples: [
      'users can sign in via SSO',
      'dashboard shows real-time stats',
      'admins can revoke a session',
      'CSV export of the audit log'
    ]
  },
  {
    key: 'nonFunctional',
    header: 'Non-functional',
    question: 'What quality bars must the project hit? Think performance, security, accessibility, scalability, observability, reliability.',
    examples: [
      'p95 latency under 300ms',
      'WCAG AA contrast on every surface',
      'survives 10x current load',
      'all writes audit-logged',
      'no PII in client-side logs'
    ]
  },
  {
    key: 'outOfScope',
    header: 'Out of scope',
    question: 'What is explicitly NOT in scope, even if it might seem adjacent? What boundary should we hold even under pressure?',
    examples: [
      'no native mobile app for v1',
      'no offline mode',
      'no IE11 support',
      'no real-time multiplayer'
    ]
  }
];

const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);
const CATEGORY_HEADERS = CATEGORIES.reduce((acc, c) => {
  acc[c.key] = c.header;
  return acc;
}, {});

function requirementsPath(rootDir) {
  return fsHelpers.ovdPath(rootDir, 'requirements.md');
}

function readRequirementsFile(rootDir) {
  const p = requirementsPath(rootDir);
  if (!fs.existsSync(p)) return null;
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (_e) {
    return null;
  }
}

function detectCategoryState(content) {
  if (!content) {
    return CATEGORIES.reduce((acc, c) => {
      acc[c.key] = 'missing';
      return acc;
    }, {});
  }
  const result = {};
  for (const c of CATEGORIES) {
    const headerPattern = new RegExp(`^##\\s+${c.header}\\s*$`, 'm');
    const idx = content.search(headerPattern);
    if (idx === -1) {
      result[c.key] = 'missing';
      continue;
    }
    const after = content.slice(idx);
    const lines = after.split(/\r?\n/).slice(1);
    let populated = false;
    for (const raw of lines) {
      const line = raw.replace(/\r$/, '').trim();
      if (line.length === 0) continue;
      if (/^##\s+/.test(line)) break;
      populated = true;
      break;
    }
    result[c.key] = populated ? 'populated' : 'placeholder';
  }
  return result;
}

function buildPlan(rootDir) {
  const content = readRequirementsFile(rootDir);
  const exists = content !== null;
  const categoryState = detectCategoryState(content);
  return {
    mode: 'plan',
    file: {
      path: requirementsPath(rootDir),
      exists
    },
    categories: CATEGORIES.map((c) => ({
      key: c.key,
      header: c.header,
      question: c.question,
      examples: c.examples.slice(),
      currentState: categoryState[c.key]
    })),
    instructions: [
      'Drive a Socratic dialogue: ask ONE question per turn, in the order listed in `categories`.',
      'For each category, present the question (rephrase to plain language if helpful) and offer 2-3 of the listed examples to anchor the user.',
      'Each requirement should be one short sentence. If the user gives a long answer, decompose into one bullet per atomic requirement.',
      'Accept the user\'s answer verbatim. A reply of "skip", "nothing", "no", or empty means the user has nothing to add for that category — record an empty array and move on.',
      'For non-functional, gently probe the standard dimensions (perf, security, a11y, scalability, observability) so they don\'t get forgotten — one short follow-up per dimension if the user paused.',
      'For out-of-scope, treat any explicit "we won\'t do X" or "not in this milestone" as a boundary marker; capture it.',
      'After all three categories are covered, batch the collected entries into a single JSON payload and call:',
      '  overdrive workflow requirements commit --entries-json \'{"functional":[...],"nonFunctional":[...],"outOfScope":[...]}\'',
      'Entries are appended under their respective ## section in .overdrive/requirements.md; existing content is preserved.'
    ]
  };
}

function normalizeEntries(rawEntries) {
  if (!rawEntries || typeof rawEntries !== 'object' || Array.isArray(rawEntries)) {
    return { ok: false, reason: 'entries must be an object keyed by category', normalized: null };
  }
  const normalized = {};
  const unknown = [];
  for (const key of Object.keys(rawEntries)) {
    if (!CATEGORY_KEYS.includes(key)) {
      unknown.push(key);
      continue;
    }
    const raw = rawEntries[key];
    if (raw === null || raw === undefined) {
      normalized[key] = [];
      continue;
    }
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      normalized[key] = trimmed.length > 0 ? [trimmed] : [];
      continue;
    }
    if (Array.isArray(raw)) {
      normalized[key] = raw
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0);
      continue;
    }
    return { ok: false, reason: `entries.${key} must be a string or array of strings`, normalized: null };
  }
  for (const c of CATEGORY_KEYS) {
    if (!(c in normalized)) normalized[c] = [];
  }
  return { ok: true, normalized, unknownCategories: unknown };
}

function applyEntries(rootDir, entries) {
  const filePath = requirementsPath(rootDir);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  let content = readRequirementsFile(rootDir);
  if (content === null) {
    content = fsHelpers.NEW_LAYOUT_PLACEHOLDER_FILES['requirements.md'];
  }

  const applied = {};
  let totalAdded = 0;
  for (const category of CATEGORIES) {
    const items = entries[category.key] || [];
    applied[category.key] = items.length;
    if (items.length === 0) continue;
    const body = items.map((item) => `- ${item}`).join('\n');
    content = appendUnderHeader(content, category.header, body);
    totalAdded += items.length;
  }

  fs.writeFileSync(filePath, content);
  return {
    path: filePath,
    applied,
    totalAdded
  };
}

function runRequirementsDraft(rootDir, opts = {}) {
  if (!rootDir) {
    return {
      ok: false,
      status: 'requirements-draft',
      reason: 'no rootDir resolved',
      text: 'Could not resolve a project directory.'
    };
  }
  const resolvedRoot = path.resolve(rootDir);
  const mode = opts.mode === 'commit' ? 'commit' : 'plan';

  if (mode === 'plan') {
    const plan = buildPlan(resolvedRoot);
    const result = {
      ok: true,
      status: 'requirements-draft',
      mode: 'plan',
      rootDir: resolvedRoot,
      plan,
      summary: `requirements plan emitted (3 categories; file ${plan.file.exists ? 'exists' : 'will be created on commit'})`
    };
    result.text = formatPlan(result);
    return result;
  }

  const norm = normalizeEntries(opts.entries);
  if (!norm.ok) {
    return {
      ok: false,
      status: 'requirements-draft',
      mode: 'commit',
      reason: norm.reason,
      text: `Could not apply requirements: ${norm.reason}`
    };
  }

  const writeResult = applyEntries(resolvedRoot, norm.normalized);
  const result = {
    ok: true,
    status: 'requirements-draft',
    mode: 'commit',
    rootDir: resolvedRoot,
    path: writeResult.path,
    applied: writeResult.applied,
    totalAdded: writeResult.totalAdded,
    unknownCategories: norm.unknownCategories,
    summary: `requirements commit: ${writeResult.totalAdded} entries across ${Object.values(writeResult.applied).filter((n) => n > 0).length} categories`
  };
  result.text = formatCommit(result);
  return result;
}

function formatPlan(result) {
  const plan = result.plan;
  const lines = [];
  lines.push('Overdrive (ovd-plan) — /ovd-workflow requirements (plan)');
  lines.push('');
  lines.push(`File: ${plan.file.path}`);
  lines.push(`Exists: ${plan.file.exists ? 'yes' : 'no (will be created on commit)'}`);
  lines.push('');
  lines.push('Drive a short Socratic flow — one question per turn, in this order:');
  lines.push('');
  for (const cat of plan.categories) {
    lines.push(`  [${cat.key}] (## ${cat.header}) — ${cat.currentState}`);
    lines.push(`    Q: ${cat.question}`);
    lines.push(`    Examples: ${cat.examples.join('; ')}`);
    lines.push('');
  }
  lines.push('When done, commit with:');
  lines.push("  overdrive workflow requirements commit --entries-json '{\"functional\":[...],\"nonFunctional\":[...],\"outOfScope\":[...]}'");
  return lines.join('\n');
}

function formatCommit(result) {
  const lines = [];
  lines.push('Overdrive (ovd-plan) — /ovd-workflow requirements (commit)');
  lines.push('');
  lines.push(`File: ${result.path}`);
  lines.push(`Total entries added: ${result.totalAdded}`);
  lines.push('');
  lines.push('Per category:');
  for (const c of CATEGORIES) {
    const count = result.applied[c.key] || 0;
    lines.push(`  ${c.key}: ${count}`);
  }
  if (result.unknownCategories && result.unknownCategories.length > 0) {
    lines.push('');
    lines.push(`Unknown categories ignored: ${result.unknownCategories.join(', ')}`);
  }
  lines.push('');
  lines.push('requirements.md updated. Existing content preserved; new entries appended under each ## section.');
  return lines.join('\n');
}

module.exports = {
  CATEGORIES,
  CATEGORY_KEYS,
  CATEGORY_HEADERS,
  requirementsPath,
  readRequirementsFile,
  detectCategoryState,
  buildPlan,
  normalizeEntries,
  applyEntries,
  formatPlan,
  formatCommit,
  runRequirementsDraft
};
