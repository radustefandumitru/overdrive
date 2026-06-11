'use strict';

const fs = require('fs');
const path = require('path');

const fsHelpers = require('./fs');
const { appendUnderHeader } = require('./migrate');

// Category schema per r3 §4.5. Each category is { key, header, question, examples }.
// `key` is the JS-friendly identifier used in entries payloads.
// `header` is the literal `## <Header>` text used inside preferences.md.
// `question` is the seed Socratic prompt the agent uses to elicit.
// `examples` give the agent a few one-line hints to share if the user is unsure.
const CATEGORIES = [
  {
    key: 'vetoes',
    header: 'Vetoes',
    question: 'Are there any libraries, patterns, frameworks, or behaviors we should NEVER use in this project?',
    examples: [
      'no jQuery',
      'no CommonJS in new code',
      'never use eval()',
      'never store secrets in git'
    ]
  },
  {
    key: 'codingStyle',
    header: 'Coding style',
    question: 'How do you like your code formatted and structured? (indentation, naming, comments, file size, abstraction level...)',
    examples: [
      'tabs, width 4',
      'single-quote strings',
      'no comments unless non-obvious',
      'prefer composition over inheritance'
    ]
  },
  {
    key: 'workflow',
    header: 'Workflow',
    question: 'How should we work together? (commit cadence, branch strategy, tests-before-merge, review style, ship-it threshold...)',
    examples: [
      'always run tests before commit',
      'batched commits at coherent boundaries',
      'never push without explicit approval',
      'every PR needs a passing CI run'
    ]
  },
  {
    key: 'communication',
    header: 'Communication',
    question: 'How should I communicate with you? (terse vs detailed, action paths, when to ask vs assume, format preferences...)',
    examples: [
      'concise — no walls of text',
      'always show action paths for ambiguous decisions',
      'never auto-commit',
      'surface uncertainty rather than guess'
    ]
  }
];

const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);
const CATEGORY_HEADERS = CATEGORIES.reduce((acc, c) => {
  acc[c.key] = c.header;
  return acc;
}, {});

function preferencesPath(rootDir) {
  return fsHelpers.ovdPath(rootDir, 'preferences.md');
}

function readPreferencesFile(rootDir) {
  const p = preferencesPath(rootDir);
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
    // Walk forward; the section is "populated" if it has any non-empty line that
    // isn't just whitespace or the next `## ` header.
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
  const content = readPreferencesFile(rootDir);
  const exists = content !== null;
  const categoryState = detectCategoryState(content);
  return {
    mode: 'plan',
    file: {
      path: preferencesPath(rootDir),
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
      'Accept the user\'s answer verbatim. A reply of "skip", "nothing", "no", or empty means the user has nothing to add for that category — record an empty array and move on.',
      'Honor any explicit "remove X" or "I don\'t want Y" — capture as a veto under `vetoes` instead.',
      'After all four categories are covered, batch the collected entries into a single JSON payload and call:',
      '  overdrive workflow preferences commit --entries-json \'{"vetoes":[...],"codingStyle":[...],"workflow":[...],"communication":[...]}\'',
      'Entries are appended under their respective ## section in .overdrive/preferences.md; existing content is preserved.'
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
  const filePath = preferencesPath(rootDir);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  let content = readPreferencesFile(rootDir);
  if (content === null) {
    content = fsHelpers.NEW_LAYOUT_PLACEHOLDER_FILES['preferences.md'];
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

function runPreferencesElicit(rootDir, opts = {}) {
  if (!rootDir) {
    return {
      ok: false,
      status: 'preferences-elicit',
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
      status: 'preferences-elicit',
      mode: 'plan',
      rootDir: resolvedRoot,
      plan,
      summary: `preferences plan emitted (4 categories; file ${plan.file.exists ? 'exists' : 'will be created on commit'})`
    };
    result.text = formatPlan(result);
    return result;
  }

  const norm = normalizeEntries(opts.entries);
  if (!norm.ok) {
    return {
      ok: false,
      status: 'preferences-elicit',
      mode: 'commit',
      reason: norm.reason,
      text: `Could not apply preferences: ${norm.reason}`
    };
  }

  const writeResult = applyEntries(resolvedRoot, norm.normalized);
  const result = {
    ok: true,
    status: 'preferences-elicit',
    mode: 'commit',
    rootDir: resolvedRoot,
    path: writeResult.path,
    applied: writeResult.applied,
    totalAdded: writeResult.totalAdded,
    unknownCategories: norm.unknownCategories,
    summary: `preferences commit: ${writeResult.totalAdded} entries across ${Object.values(writeResult.applied).filter((n) => n > 0).length} categories`
  };
  result.text = formatCommit(result);
  return result;
}

function formatPlan(result) {
  const plan = result.plan;
  const lines = [];
  lines.push('Overdrive (ovd-plan) — /ovd-workflow preferences (plan)');
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
  lines.push("  overdrive workflow preferences commit --entries-json '{\"vetoes\":[...],\"codingStyle\":[...],\"workflow\":[...],\"communication\":[...]}'");
  return lines.join('\n');
}

function formatCommit(result) {
  const lines = [];
  lines.push('Overdrive (ovd-plan) — /ovd-workflow preferences (commit)');
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
  lines.push('preferences.md updated. Existing content preserved; new entries appended under each ## section.');
  return lines.join('\n');
}

module.exports = {
  CATEGORIES,
  CATEGORY_KEYS,
  CATEGORY_HEADERS,
  preferencesPath,
  readPreferencesFile,
  detectCategoryState,
  buildPlan,
  normalizeEntries,
  applyEntries,
  formatPlan,
  formatCommit,
  runPreferencesElicit
};
