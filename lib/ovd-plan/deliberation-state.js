'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const { OVD_PLAN_FILE } = require('./fs');
const { parseOverdriveMd, ParseError } = require('./parser');
const { writeOverdriveMd } = require('./writer');

const DELIBERATION_STATE_KEY = 'deliberation-state';

function planPath(rootDir) {
  return path.join(rootDir, OVD_PLAN_FILE);
}

function readPlanFile(rootDir) {
  const full = planPath(rootDir);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf8');
}

function parseInnerYaml(innerString) {
  if (!innerString || !innerString.trim()) return {};
  return yaml.load(innerString);
}

function dumpInnerYaml(obj) {
  return yaml
    .dump(obj, { lineWidth: 120, noRefs: true, quotingType: '"', forceQuotes: false })
    .replace(/\s+$/, '');
}

function openState(rootDir) {
  const content = readPlanFile(rootDir);
  if (!content) {
    return {
      ok: false,
      reason: 'missing-plan',
      text: `OVERDRIVE.md not found at ${planPath(rootDir)}. Run /ovd-workflow init first, or /ovd-plan deliberate to start a plan.`
    };
  }
  let parsed;
  try {
    parsed = parseOverdriveMd(content);
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof ParseError ? 'parse-error' : 'unknown-error',
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
      reason: 'deliberation-state-malformed',
      text: `Deliberation-state block contains invalid YAML: ${err.message}. Fix the block manually, or run /ovd-plan deliberate to restart.`
    };
  }
  return { ok: true, parsed, sections, innerObj };
}

function commitState(rootDir, opened) {
  if (!opened || !opened.ok || !opened.parsed || !opened.sections || !opened.innerObj) {
    return {
      ok: false,
      reason: 'invalid-open-state',
      text: 'commitState requires a successful openState result with parsed/sections/innerObj.'
    };
  }
  const { parsed, sections, innerObj } = opened;
  const newInner = dumpInnerYaml(innerObj);
  sections[DELIBERATION_STATE_KEY] = newInner;
  let newContent;
  try {
    newContent = writeOverdriveMd({
      frontmatter: parsed.frontmatter,
      tree: parsed.tree,
      sections
    });
  } catch (err) {
    return {
      ok: false,
      reason: 'write-error',
      text: `Could not serialize OVERDRIVE.md: ${err.message}`
    };
  }
  try {
    fs.writeFileSync(planPath(rootDir), newContent);
  } catch (err) {
    return {
      ok: false,
      reason: 'write-error',
      text: `Could not write ${planPath(rootDir)}: ${err.message}`
    };
  }
  return { ok: true, written: true };
}

function readDeliberationState(rootDir) {
  const content = readPlanFile(rootDir);
  if (!content) return null;
  let parsed;
  try {
    parsed = parseOverdriveMd(content);
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
  return obj;
}

module.exports = {
  DELIBERATION_STATE_KEY,
  planPath,
  parseInnerYaml,
  dumpInnerYaml,
  openState,
  commitState,
  readDeliberationState
};
