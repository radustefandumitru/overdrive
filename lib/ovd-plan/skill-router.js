'use strict';

const fs = require('fs');
const path = require('path');

const SKILL_ROUTER_CATALOG_REL = path.join(
  'skills',
  'skill-router',
  'references',
  'catalog.md'
);

const CONFIDENCE_VALUES = new Set(['high', 'medium', 'low']);
const TABLE_SKILL_PATTERN = /^\|\s*`([a-z][a-z0-9-]*)`\s*\|/;

function loadCatalogSkills(repoRoot) {
  const catalogPath = path.join(repoRoot, SKILL_ROUTER_CATALOG_REL);
  if (!fs.existsSync(catalogPath)) return [];
  const content = fs.readFileSync(catalogPath, 'utf8');
  const skills = new Set();
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(TABLE_SKILL_PATTERN);
    if (match) skills.add(match[1]);
  }
  return Array.from(skills).sort();
}

function formatList(arr) {
  if (!arr || arr.length === 0) return '(none)';
  return arr.join(', ');
}

function buildRoutingPrompt({
  leafDescription,
  leafScope,
  leafSuccessCriteria,
  codebaseContext,
  knownSkills
}) {
  const scopeBlock =
    `Scope.in:        ${formatList(leafScope && leafScope.in)}\n` +
    `Scope.read_only: ${formatList(leafScope && leafScope.read_only)}\n` +
    `Scope.out:       ${formatList(leafScope && leafScope.out)}`;

  const successBlock =
    leafSuccessCriteria && leafSuccessCriteria.length
      ? leafSuccessCriteria.map((s) => `  - ${s}`).join('\n')
      : '  (not specified)';

  const skillsBlock = knownSkills.map((s) => `  - ${s}`).join('\n');

  const sections = [
    '# ovd-plan: Resolve skills for one planned leaf',
    '',
    'You are routing a planned leaf to the smallest sufficient skill set.',
    'Consult skills/skill-router/SKILL.md and the catalog below. Pick the',
    'narrowest skills that actually apply.',
    '',
    'Available skill IDs (from skills/skill-router/references/catalog.md):',
    skillsBlock,
    '',
    'Leaf description:',
    leafDescription || '(empty)',
    '',
    scopeBlock,
    '',
    'Success criteria:',
    successBlock
  ];

  if (codebaseContext) {
    sections.push('', 'Relevant codebase context:', codebaseContext);
  }

  sections.push(
    '',
    'Confidence semantics:',
    '- high:   narrow scope + clear success criteria + well-understood domain',
    '- medium: moderate scope or one input is partial',
    '- low:    experimental, novel, or broad scope',
    '',
    'Reply with prose if useful, then end your response with a SINGLE JSON',
    'object on the LAST LINE (no fence, no trailing text after it):',
    '{"skills":["..."],"confidence":"high|medium|low","rationale":"...","considered":["..."]}'
  );

  return sections.join('\n');
}

function tryParseJsonObject(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    return null;
  }
}

function parseRoutingResponse(rawText) {
  if (typeof rawText !== 'string') {
    throw new Error('Routing response must be a string');
  }
  const text = rawText.trim();
  if (!text) {
    throw new Error('Routing response is empty');
  }

  const fenceMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fenceMatch) {
    const inside = tryParseJsonObject(fenceMatch[1]);
    if (inside) return inside;
  }

  const lines = text.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const obj = tryParseJsonObject(lines[i]);
    if (obj) return obj;
  }

  throw new Error('Could not parse JSON object from routing response');
}

function validateRoutingResponse(response, knownSkills) {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw new Error('Routing response must be a JSON object');
  }
  if (!Array.isArray(response.skills)) {
    throw new Error('Routing response.skills must be an array');
  }
  if (!response.skills.every((s) => typeof s === 'string')) {
    throw new Error('Routing response.skills must contain only strings');
  }
  if (!CONFIDENCE_VALUES.has(response.confidence)) {
    throw new Error(
      `Routing response.confidence must be one of high/medium/low (got "${response.confidence}")`
    );
  }
  if (response.rationale !== undefined && typeof response.rationale !== 'string') {
    throw new Error('Routing response.rationale must be a string when present');
  }
  if (response.considered !== undefined && !Array.isArray(response.considered)) {
    throw new Error('Routing response.considered must be an array when present');
  }

  const known = new Set(knownSkills);
  const unknown = response.skills.filter((s) => !known.has(s));

  return {
    skills: response.skills,
    confidence: response.confidence,
    rationale: response.rationale || '',
    considered: response.considered || [],
    unknown_skills: unknown
  };
}

function resolvePriorSet(input, options = {}) {
  const repoRoot = input.repoRoot || process.cwd();
  const knownSkills = loadCatalogSkills(repoRoot);

  if (knownSkills.length === 0) {
    return {
      ok: false,
      reason: 'catalog-empty',
      message: `Catalog not found or empty at ${SKILL_ROUTER_CATALOG_REL}`,
      skills: [],
      confidence: 'low',
      rationale: 'Catalog could not be loaded; falling back to no prior',
      considered: [],
      prompt: null
    };
  }

  const prompt = buildRoutingPrompt({
    leafDescription: input.leafDescription,
    leafScope: input.leafScope,
    leafSuccessCriteria: input.leafSuccessCriteria,
    codebaseContext: input.codebaseContext,
    knownSkills
  });

  if (options.hostAgentAnswer === undefined) {
    return {
      ok: false,
      reason: 'requires-host-agent',
      prompt,
      known_skills_count: knownSkills.length
    };
  }

  let parsed;
  try {
    parsed = parseRoutingResponse(options.hostAgentAnswer);
  } catch (err) {
    return {
      ok: false,
      reason: 'parse-failed',
      message: err.message,
      prompt
    };
  }

  let validated;
  try {
    validated = validateRoutingResponse(parsed, knownSkills);
  } catch (err) {
    return {
      ok: false,
      reason: 'validation-failed',
      message: err.message,
      prompt,
      raw: parsed
    };
  }

  return {
    ok: true,
    prompt,
    ...validated
  };
}

module.exports = {
  SKILL_ROUTER_CATALOG_REL,
  CONFIDENCE_VALUES,
  loadCatalogSkills,
  buildRoutingPrompt,
  parseRoutingResponse,
  validateRoutingResponse,
  resolvePriorSet
};
