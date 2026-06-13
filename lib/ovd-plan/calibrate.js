'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const { OVD_PLAN_FILE } = require('./fs');
const { parseOverdriveMd, ParseError } = require('./parser');
const { writeOverdriveMd } = require('./writer');

const CALIBRATION_AXES = ['domain', 'technical', 'scope'];
const AXIS_LEVELS = ['low', 'medium', 'high'];
const OVERRIDE_KINDS = ['none', 'plain', 'detailed'];
const DELIBERATION_STATE_KEY = 'deliberation-state';
const CALIBRATION_FIELD = 'calibration';

const CALIBRATION_KEY_ORDER = ['domain', 'technical', 'scope', 'override', 'rationale', 'updated'];

const AXIS_DESCRIPTORS = [
  {
    axis: 'domain',
    prompt: 'Domain expertise — how comfortable is the user with the project\'s subject-area vocabulary?',
    levelRubric: {
      low: 'Uses generic project nouns; asks for domain term definitions; describes the problem in everyday language.',
      medium: 'Mixes generic and domain-specific vocabulary; recognises domain terms but may not use them naturally.',
      high: 'Uses domain-specific jargon naturally; references domain conventions or standards without prompting.'
    },
    exampleSignals: [
      'low: "I want a thing that lets people log in"',
      'medium: "I want SSO with the usual providers"',
      'high: "I want OIDC with PKCE for native clients and JWT refresh rotation"'
    ]
  },
  {
    axis: 'technical',
    prompt: 'Technical fluency — how comfortable is the user with the engineering side of the work?',
    levelRubric: {
      low: 'Avoids implementation terminology; describes outcomes rather than mechanisms; defers technical choices.',
      medium: 'Comfortable naming common patterns; opinions on architecture at a high level; defers to recommendations on details.',
      high: 'Uses precise technical vocabulary; argues about trade-offs at the implementation level; pre-empts decisions with reasoning.'
    },
    exampleSignals: [
      'low: "make it fast"',
      'medium: "we should probably cache the dashboard widgets"',
      'high: "stale-while-revalidate at the edge with a 60s window, fall back to origin on miss"'
    ]
  },
  {
    axis: 'scope',
    prompt: 'Scope appetite — how big does the user want this work to be?',
    levelRubric: {
      low: 'Single focused feature or fix; small slice; explicit "just this for now"; resistance to expansion.',
      medium: 'A coherent feature area with related sub-tasks; willing to add adjacent items if they\'re cheap.',
      high: 'Full product surface; multiple milestones in scope; comfortable with months-long roadmaps.'
    },
    exampleSignals: [
      'low: "just add a dark mode toggle"',
      'medium: "redesign the dashboard, including the widget settings flow"',
      'high: "rebuild the analytics platform end-to-end, including ingest and reporting"'
    ]
  }
];

function planPath(rootDir) {
  return path.join(rootDir, OVD_PLAN_FILE);
}

function readPlanFile(rootDir) {
  const full = planPath(rootDir);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf8');
}

function parsePlan(content) {
  return parseOverdriveMd(content);
}

function parseInnerYaml(innerString) {
  if (!innerString || !innerString.trim()) return {};
  return yaml.load(innerString);
}

function readCalibration(rootDir) {
  const content = readPlanFile(rootDir);
  if (!content) return null;
  let parsed;
  try {
    parsed = parsePlan(content);
  } catch (err) {
    return null;
  }
  const sections = parsed.sections || {};
  const inner = sections[DELIBERATION_STATE_KEY];
  if (!inner) return null;
  let obj;
  try {
    obj = parseInnerYaml(inner);
  } catch (err) {
    return null;
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const cal = obj[CALIBRATION_FIELD];
  if (!cal || typeof cal !== 'object' || Array.isArray(cal)) return null;
  return cal;
}

function buildCalibrationPlan(rootDir, opts = {}) {
  const content = readPlanFile(rootDir);
  if (!content) {
    return {
      ok: false,
      status: 'calibrate',
      reason: 'missing-plan',
      text: `OVERDRIVE.md not found at ${planPath(rootDir)}. Run /ovd-workflow init first, or /ovd-plan deliberate to start a plan.`
    };
  }
  let currentCalibration = null;
  try {
    currentCalibration = readCalibration(rootDir);
  } catch (err) {
    currentCalibration = null;
  }

  const instructions = [
    'Observation-driven, not questionnaire. Do NOT ask the user "how technical are you?" — infer from how they phrase the work in their recent messages.',
    'For each axis, pick low / medium / high using the level rubric and example signals below. If signals are mixed, lean toward medium and capture the uncertainty in rationale.',
    'If the user explicitly overrides verbosity ("explain it more simply" → override: plain; "give me the full detail" → override: detailed), set the override field; per Q3.2 lock, axes domain/technical/scope are governed independently of override.',
    currentCalibration
      ? 'A prior calibration is recorded; emit a NEW classification only if you observe meaningful drift since the prior. Otherwise, omit unchanged axes from the payload — applyCalibration preserves them.'
      : 'No prior calibration exists; emit all three axes on the first commit.',
    'Commit with the JSON payload via --entries-json once you have the assessment.'
  ];

  const commitSyntax =
    `overdrive plan calibrate --entries-json '{"domain":"low|medium|high","technical":"low|medium|high","scope":"low|medium|high","override":"none|plain|detailed","rationale":"one-line reasoning"}'`;

  const text = formatPlanText({
    axes: AXIS_DESCRIPTORS,
    instructions,
    currentCalibration,
    commitSyntax
  });

  return {
    ok: true,
    mode: 'plan',
    status: 'calibrate',
    axes: AXIS_DESCRIPTORS,
    instructions,
    currentCalibration,
    commitSyntax,
    text
  };
}

function formatPlanText({ axes, instructions, currentCalibration, commitSyntax }) {
  const lines = [];
  lines.push('Calibration (3 axes — observation-driven)');
  lines.push('=========================================');
  if (currentCalibration) {
    lines.push('');
    lines.push('Current calibration:');
    for (const axis of CALIBRATION_AXES) {
      const value = currentCalibration[axis];
      if (value) lines.push(`  ${axis}: ${value}`);
    }
    if (currentCalibration.override) lines.push(`  override: ${currentCalibration.override}`);
    if (currentCalibration.updated) lines.push(`  updated: ${currentCalibration.updated}`);
  } else {
    lines.push('');
    lines.push('No prior calibration recorded.');
  }
  lines.push('');
  for (const axis of axes) {
    lines.push(`## ${axis.axis}`);
    lines.push(axis.prompt);
    lines.push('  low:    ' + axis.levelRubric.low);
    lines.push('  medium: ' + axis.levelRubric.medium);
    lines.push('  high:   ' + axis.levelRubric.high);
    lines.push('  signals:');
    for (const sig of axis.exampleSignals) {
      lines.push(`    - ${sig}`);
    }
    lines.push('');
  }
  lines.push('Instructions:');
  for (const inst of instructions) {
    lines.push(`  - ${inst}`);
  }
  lines.push('');
  lines.push('Commit syntax:');
  lines.push(`  ${commitSyntax}`);
  return lines.join('\n');
}

function normalizeCalibration(rawEntries) {
  const errors = [];

  if (!rawEntries || typeof rawEntries !== 'object' || Array.isArray(rawEntries)) {
    return {
      ok: false,
      reason: 'invalid-shape',
      errors: ['entries must be a JSON object with one or more calibration fields']
    };
  }

  const out = {};
  let anyField = false;

  for (const axis of CALIBRATION_AXES) {
    if (rawEntries[axis] !== undefined) {
      anyField = true;
      if (!AXIS_LEVELS.includes(rawEntries[axis])) {
        errors.push(`${axis} must be one of low / medium / high (got "${rawEntries[axis]}")`);
        continue;
      }
      out[axis] = rawEntries[axis];
    }
  }

  if (rawEntries.override !== undefined) {
    anyField = true;
    if (!OVERRIDE_KINDS.includes(rawEntries.override)) {
      errors.push(`override must be one of ${OVERRIDE_KINDS.join(' / ')} (got "${rawEntries.override}")`);
    } else {
      out.override = rawEntries.override;
    }
  }

  if (rawEntries.rationale !== undefined) {
    if (typeof rawEntries.rationale !== 'string') {
      errors.push('rationale must be a string when present');
    } else {
      out.rationale = rawEntries.rationale;
    }
  }

  if (!anyField) {
    return {
      ok: false,
      reason: 'no-fields',
      errors: ['entries must include at least one of: domain, technical, scope, override']
    };
  }

  if (errors.length > 0) {
    return { ok: false, reason: 'invalid-values', errors };
  }

  return { ok: true, calibration: out };
}

function mergeCalibration(prior, incoming, now) {
  const merged = {};
  const priorObj = prior && typeof prior === 'object' && !Array.isArray(prior) ? prior : {};
  for (const axis of CALIBRATION_AXES) {
    if (incoming[axis] !== undefined) merged[axis] = incoming[axis];
    else if (priorObj[axis] !== undefined) merged[axis] = priorObj[axis];
  }
  merged.override = incoming.override !== undefined
    ? incoming.override
    : (priorObj.override !== undefined ? priorObj.override : 'none');
  if (incoming.rationale !== undefined) merged.rationale = incoming.rationale;
  else if (priorObj.rationale !== undefined) merged.rationale = priorObj.rationale;
  merged.updated = now;
  return reorderCalibration(merged);
}

function reorderCalibration(cal) {
  const result = {};
  for (const key of CALIBRATION_KEY_ORDER) {
    if (key in cal) result[key] = cal[key];
  }
  return result;
}

function dumpInnerYaml(obj) {
  return yaml
    .dump(obj, { lineWidth: 120, noRefs: true, quotingType: '"', forceQuotes: false })
    .replace(/\s+$/, '');
}

function applyCalibration(rootDir, calibrationInput, opts = {}) {
  const now = opts.now || new Date().toISOString();

  const content = readPlanFile(rootDir);
  if (!content) {
    return {
      ok: false,
      status: 'calibrate',
      reason: 'missing-plan',
      text: `OVERDRIVE.md not found at ${planPath(rootDir)}. Run /ovd-workflow init first, or /ovd-plan deliberate to start a plan.`
    };
  }

  let parsed;
  try {
    parsed = parsePlan(content);
  } catch (err) {
    const reason = err instanceof ParseError ? 'parse-error' : 'unknown-error';
    return {
      ok: false,
      status: 'calibrate',
      reason,
      text: `OVERDRIVE.md could not be parsed: ${err.message}`
    };
  }

  const sections = Object.assign({}, parsed.sections || {});
  const innerString = sections[DELIBERATION_STATE_KEY] || '';

  let innerObj;
  try {
    const loaded = parseInnerYaml(innerString);
    innerObj = (loaded && typeof loaded === 'object' && !Array.isArray(loaded)) ? loaded : {};
  } catch (err) {
    return {
      ok: false,
      status: 'calibrate',
      reason: 'deliberation-state-malformed',
      text: `Deliberation-state block contains invalid YAML: ${err.message}. Fix the block manually, or run /ovd-plan deliberate to restart.`
    };
  }

  const prior = (innerObj[CALIBRATION_FIELD] && typeof innerObj[CALIBRATION_FIELD] === 'object' && !Array.isArray(innerObj[CALIBRATION_FIELD]))
    ? innerObj[CALIBRATION_FIELD]
    : null;
  const merged = mergeCalibration(prior, calibrationInput, now);

  innerObj[CALIBRATION_FIELD] = merged;

  const newInner = dumpInnerYaml(innerObj);
  sections[DELIBERATION_STATE_KEY] = newInner;

  const newContent = writeOverdriveMd({
    frontmatter: parsed.frontmatter,
    tree: parsed.tree,
    sections
  });

  fs.writeFileSync(planPath(rootDir), newContent);

  return {
    ok: true,
    status: 'calibrate',
    mode: 'commit',
    applied: merged,
    before: prior,
    text: formatCommitText(merged, !!prior)
  };
}

function presentForCalibration(text, calibration) {
  if (!calibration || typeof calibration !== 'object') return text;
  if (calibration.override !== 'plain') return text;
  const lines = text.split('\n');
  const filtered = lines.filter((line) => !/^\s+[-*+]\s/.test(line));
  return filtered.join('\n');
}

function runCalibrate(rootDir, opts = {}) {
  const isCommit = opts.mode === 'commit' || !!opts.entries;

  if (!isCommit) {
    return buildCalibrationPlan(rootDir, opts);
  }

  const normalized = normalizeCalibration(opts.entries);
  if (!normalized.ok) {
    return {
      ok: false,
      status: 'calibrate',
      mode: 'commit',
      reason: normalized.reason,
      errors: normalized.errors,
      text: `Calibration entries rejected: ${normalized.errors.join('; ')}`
    };
  }

  return applyCalibration(rootDir, normalized.calibration, { now: opts.now });
}

function formatPlan(result) {
  if (result && result.text) return result.text;
  return '(no plan text)';
}

function formatCommitText(applied, hadPrior) {
  const verb = hadPrior ? 'updated' : 'written';
  const axisLine = CALIBRATION_AXES
    .filter((a) => applied[a])
    .map((a) => `${a}=${applied[a]}`)
    .join(' · ');
  const overrideLine = applied.override ? `override=${applied.override}` : '';
  const parts = [`Calibration ${verb}.`];
  if (axisLine) parts.push(`  ${axisLine}`);
  if (overrideLine) parts.push(`  ${overrideLine}`);
  if (applied.rationale) parts.push(`  rationale: ${applied.rationale}`);
  if (applied.updated) parts.push(`  updated: ${applied.updated}`);
  return parts.join('\n');
}

function formatCommit(result) {
  if (result && result.text) return result.text;
  return '(no commit text)';
}

module.exports = {
  CALIBRATION_AXES,
  AXIS_LEVELS,
  OVERRIDE_KINDS,
  DELIBERATION_STATE_KEY,
  CALIBRATION_FIELD,
  CALIBRATION_KEY_ORDER,
  AXIS_DESCRIPTORS,
  planPath,
  readCalibration,
  buildCalibrationPlan,
  normalizeCalibration,
  mergeCalibration,
  applyCalibration,
  presentForCalibration,
  runCalibrate,
  formatPlan,
  formatCommit
};
