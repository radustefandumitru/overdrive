'use strict';

// Intent Detection Layer — classifier core (Phase 6 Task 6.1, per r3 §3).
//
// The CLI never classifies a message in code (Pattern 1). This module builds the
// classification PROMPT (route catalog + project state + the user's message) for
// the host agent, and validates the agent's structured answer
// (`{ route, confidence, candidates }`) with a strict Pattern-4 guard. The agent
// — which holds the conversational context the CLI lacks — does the reasoning.
//
// Categorical confidence only, no numeric cutoffs (Q6.2 lock). Route selection is
// independent of calibration; calibration affects downstream presentation depth
// only (Q6.7).

const STATUS = 'intent';

const CONFIDENCE_VALUES = new Set(['unambiguous', 'ambiguous']);

// Q6.1: the route catalog is a hardcoded constant. Small, durable list mapping
// each routable command to a one-line description. This is the MENU the agent
// classifies against — not a keyword table; nothing here pattern-matches the
// message. `takesArgs` marks routes that carry free-text args (rendered as
// `route "<args>"` in the prompt for the agent's benefit).
const ROUTE_CATALOG = [
  { route: '/ovd-workflow', description: 'initialization, codebase mapping, preferences, requirements' },
  { route: '/ovd-workflow init', description: 'full initialization flow' },
  { route: '/ovd-workflow map', description: 'refresh the codebase mapping' },
  { route: '/ovd-plan', description: 'display the plan tree or resume deliberation' },
  { route: '/ovd-plan deliberate', description: 'start Socratic deliberation to build a plan' },
  { route: '/ovd-plan idea', takesArgs: true, description: 'propose a new idea; analyze impact on the existing plan' },
  { route: '/ovd-plan edit', description: 'modify the existing tree directly' },
  { route: '/ovd-plan research', takesArgs: true, description: 'focused investigation of a question' },
  { route: '/ovd-go', description: 'orient and continue current work' },
  { route: '/ovd-go --small', takesArgs: true, description: 'surgical change scoped to the current leaf' },
  { route: '/ovd-go test', takesArgs: true, description: 'run verification only for a node' },
  { route: '/ovd-go <ref>', description: 'target and work a specific node' },
  { route: '/ovd-log', description: 'lightweight save of current state' },
  { route: '/ovd-log handoff', description: 'full session-end pipeline (close + handoff)' },
  { route: '/ovd-log capture', takesArgs: true, description: 'timestamped activity log entry' },
  { route: '/ovd-log concerns', description: 'structured concerns review' }
];

const ROUTE_SET = new Set(ROUTE_CATALOG.map((e) => e.route));

function catalogRoutes() {
  return ROUTE_CATALOG.map((e) => e.route);
}

function isKnownRoute(route) {
  return typeof route === 'string' && ROUTE_SET.has(route);
}

// Render the project-state context the agent uses for the "state context" axis
// (r3 §3.3). All fields are optional and best-effort — a free-form message can
// arrive against an uninitialized project.
function summarizeState(state) {
  if (!state || typeof state !== 'object') {
    return 'Project state: uninitialized / empty — no plan state available.';
  }
  const lines = [];
  if (state.projectTitle) lines.push(`Project: ${state.projectTitle}`);
  if (state.milestone) lines.push(`Milestone: ${state.milestone}`);
  const active = state.activeNode;
  if (active && active.id) {
    const title = active.title ? ` ${active.title}` : '';
    const status = active.status ? ` [${active.status}]` : '';
    lines.push(`Active leaf: ${active.id}${title}${status}`);
  }
  if (state.deliberationStatus) lines.push(`Deliberation: ${state.deliberationStatus}`);
  if (state.lastAction) lines.push(`Last action: ${state.lastAction}`);
  if (typeof state.awaitingReview === 'number' && state.awaitingReview > 0) {
    lines.push(`Awaiting review: ${state.awaitingReview} leaf${state.awaitingReview === 1 ? '' : 'ves'}`);
  }
  const cal = state.calibration;
  if (cal && typeof cal === 'object') {
    const parts = [];
    if (cal.domain) parts.push(`domain=${cal.domain}`);
    if (cal.technical) parts.push(`technical=${cal.technical}`);
    if (cal.scope) parts.push(`scope=${cal.scope}`);
    if (parts.length) lines.push(`Calibration: ${parts.join(', ')}`);
  }
  if (lines.length === 0) {
    return 'Project state: uninitialized / empty — no plan state available.';
  }
  return lines.join('\n');
}

function renderCatalog() {
  return ROUTE_CATALOG
    .map((e) => `  ${e.route}${e.takesArgs ? ' "<args>"' : ''} — ${e.description}`)
    .join('\n');
}

// Build the classification prompt for the host agent. Includes the route catalog
// (the menu), the project-state summary (state-context axis), the four axes to
// evaluate (r3 §3.3), and the structured-answer contract. No numeric confidence
// is ever requested (Q6.2).
function buildClassificationPrompt({ message, state } = {}) {
  const msg = typeof message === 'string' ? message : '';
  const sections = [
    '# ovd-plan: Classify a free-form message into a route',
    '',
    'A user sent a free-form message (no leading slash command). Classify it into',
    'one of the routes below. You hold the conversational context; decide honestly.',
    '',
    'Routes:',
    renderCatalog(),
    '',
    'Project state context:',
    summarizeState(state),
    '',
    'User message:',
    msg,
    '',
    'Evaluate four axes (r3 §3.3):',
    '  - Verb intent:   propose / ask / instruct / review / capture / halt',
    '  - Object:        code / plan / tree / doc / concern / idea / sketch',
    '  - State context: active node, deliberation status, recent activity, last action',
    '  - Calibration:   how technically framed the message is (affects PRESENTATION',
    '                   DEPTH only — never the route choice)',
    '',
    'Confidence is categorical (no numeric scores):',
    '  - "unambiguous": exactly one route is clearly correct → announce + execute.',
    '  - "ambiguous":   multiple plausible routes (2+ candidates) → present options;',
    '                   OR the intent is unclear (0–1 candidate) → ask a clarifying',
    '                   question matched to the calibration.',
    '',
    'Reply with prose if useful, then end with a SINGLE JSON object describing your',
    'classification:',
    '{"route":"<best route or null>","confidence":"unambiguous|ambiguous",' +
      '"candidates":[{"route":"<route>","rationale":"<one line>","args_hint":"<optional>"}]}',
    '',
    'For "unambiguous": exactly one candidate, and "route" equals that candidate.',
    'For "ambiguous": 2–4 candidates (or 0–1 when intent is genuinely unclear).'
  ];
  return sections.join('\n');
}

// Pattern 4 guard: validate the agent's `{ route, confidence, candidates }`
// answer. Bad shape → { ok: false, reason, errors } with NO routing decision.
function normalizeClassification(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reason: 'invalid-shape', errors: ['classification must be a JSON object with { route, confidence, candidates }'] };
  }

  const errors = [];

  if (!CONFIDENCE_VALUES.has(raw.confidence)) {
    errors.push(`confidence must be one of: ${[...CONFIDENCE_VALUES].join(', ')} (got "${raw.confidence}")`);
  }

  if (!Array.isArray(raw.candidates)) {
    errors.push('candidates must be an array');
  }

  const candidates = [];
  if (Array.isArray(raw.candidates)) {
    raw.candidates.forEach((c, i) => {
      if (!c || typeof c !== 'object' || Array.isArray(c)) {
        errors.push(`candidate[${i}] must be an object`);
        return;
      }
      if (!isKnownRoute(c.route)) {
        errors.push(`candidate[${i}].route must be a known route (got "${c.route}")`);
      }
      if (typeof c.rationale !== 'string' || !c.rationale.trim()) {
        errors.push(`candidate[${i}].rationale must be a non-empty string`);
      }
      if (c.args_hint !== undefined && typeof c.args_hint !== 'string') {
        errors.push(`candidate[${i}].args_hint must be a string when present`);
      }
      const norm = { route: c.route, rationale: typeof c.rationale === 'string' ? c.rationale.trim() : c.rationale };
      if (typeof c.args_hint === 'string') norm.args_hint = c.args_hint;
      candidates.push(norm);
    });
  }

  if (raw.confidence === 'unambiguous') {
    if (candidates.length !== 1) {
      errors.push('unambiguous classification must have exactly one candidate');
    } else if (raw.route !== candidates[0].route) {
      errors.push(`unambiguous route ("${raw.route}") must equal the single candidate route ("${candidates[0].route}")`);
    }
  }
  // ambiguous: 0–1 candidates is valid (very-low-confidence / clarifying-question
  // path per Q6.3); 2+ is the action-path-prompt path. No upper bound enforced
  // here — the renderer (Task 6.2) applies the 4-option cap (Q6.8).

  if (errors.length > 0) {
    return { ok: false, reason: 'invalid-values', errors };
  }

  return {
    ok: true,
    classification: {
      route: raw.route === undefined ? null : raw.route,
      confidence: raw.confidence,
      candidates
    }
  };
}

// Orchestrator (mirrors skill-router's resolvePriorSet shape). Without an agent
// answer it returns the prompt and `requires-host-agent`; with one it validates
// and returns the resolved classification.
function classifyIntent(message, state, options = {}) {
  if (typeof message !== 'string' || !message.trim()) {
    return { ok: false, status: STATUS, reason: 'missing-message', text: 'A non-empty message is required to classify.' };
  }

  const prompt = buildClassificationPrompt({ message, state });

  if (options.classification === undefined) {
    return { ok: false, status: STATUS, reason: 'requires-host-agent', prompt };
  }

  const normalized = normalizeClassification(options.classification);
  if (!normalized.ok) {
    return { ok: false, status: STATUS, reason: 'validation-failed', errors: normalized.errors, prompt };
  }

  return {
    ok: true,
    status: STATUS,
    route: normalized.classification.route,
    confidence: normalized.classification.confidence,
    candidates: normalized.classification.candidates,
    prompt
  };
}

module.exports = {
  STATUS,
  ROUTE_CATALOG,
  CONFIDENCE_VALUES,
  catalogRoutes,
  isKnownRoute,
  summarizeState,
  buildClassificationPrompt,
  normalizeClassification,
  classifyIntent
};
