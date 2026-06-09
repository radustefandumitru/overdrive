'use strict';

const yaml = require('js-yaml');

const FRONTMATTER_DELIM = '---';
const YAML_BLOCK_TAG = 'ovd-plan';

const HEADER_PATTERN = /^(#{1,6})\s+(.*?)\s*$/;
const ID_PATTERN = /^([IVXLCDM]+(?:\.\d+(?:\.[a-z](?:\.[ivxlcdm]+(?:\.[A-Z](?:\.\d+)?)?)?)?)?)\.?(?=\s|$)/;
const STATUS_PATTERN = /\s*\[([^\]]*)\]\s*$/;
const ACTIVE_PATTERN = /\s*←\s*ACTIVE\s*$/;
const YAML_BLOCK_OPEN = /^```yaml\s+ovd-plan\s*$/;
const CODE_FENCE = /^```/;
const FENCE_CLOSE = /^```\s*$/;

const STATUS_VALUES = new Set([
  'pending',
  'in-progress',
  'awaiting-review',
  'done',
  'blocked',
  'skipped',
  'mixed'
]);

const CONFIDENCE_VALUES = new Set(['high', 'medium', 'low']);

const MANAGED_SECTIONS = [
  'inbox',
  'capture',
  'concerns',
  'deliberation-state',
  'archive',
  'decisions'
];

const ROMAN_NUMERALS = [
  ['M', 1000],
  ['CM', 900],
  ['D', 500],
  ['CD', 400],
  ['C', 100],
  ['XC', 90],
  ['L', 50],
  ['XL', 40],
  ['X', 10],
  ['IX', 9],
  ['V', 5],
  ['IV', 4],
  ['I', 1]
];

class ParseError extends Error {
  constructor(message, line) {
    super(line !== undefined ? `${message} (line ${line})` : message);
    this.name = 'ParseError';
    if (line !== undefined) this.line = line;
  }
}

function toRoman(n) {
  if (n < 1) return '';
  let out = '';
  let rem = n;
  for (const [letter, value] of ROMAN_NUMERALS) {
    while (rem >= value) {
      out += letter;
      rem -= value;
    }
  }
  return out;
}

function generateIdSegment(depth, index) {
  switch (depth) {
    case 2:
      return toRoman(index).toUpperCase();
    case 3:
      return String(index);
    case 4: {
      if (index < 1 || index > 26) return String(index);
      return String.fromCharCode(96 + index);
    }
    case 5:
      return toRoman(index).toLowerCase();
    case 6: {
      if (index < 1 || index > 26) return String(index);
      return String.fromCharCode(64 + index);
    }
    default:
      return String(index);
  }
}

function generateNodeId(parentId, depth, siblingIndex) {
  if (depth <= 1) return '';
  const segment = generateIdSegment(depth, siblingIndex);
  return parentId ? `${parentId}.${segment}` : segment;
}

function parseFrontmatter(content) {
  const normalized = content.replace(/\r\n/g, '\n');
  if (!normalized.startsWith(FRONTMATTER_DELIM + '\n')) {
    return { frontmatter: null, body: normalized, bodyOffset: 0 };
  }
  const afterFirst = FRONTMATTER_DELIM.length + 1;
  const closingMarker = '\n' + FRONTMATTER_DELIM + '\n';
  const closingIdx = normalized.indexOf(closingMarker, afterFirst);
  if (closingIdx === -1) {
    const trailingMarker = '\n' + FRONTMATTER_DELIM;
    if (normalized.endsWith(trailingMarker)) {
      const yamlText = normalized.substring(afterFirst, normalized.length - trailingMarker.length);
      return parseFrontmatterYaml(yamlText, normalized.length, '');
    }
    throw new ParseError('Frontmatter starts with --- but never closes');
  }
  const yamlText = normalized.substring(afterFirst, closingIdx);
  const body = normalized.substring(closingIdx + closingMarker.length);
  return parseFrontmatterYaml(yamlText, closingIdx + closingMarker.length, body);
}

function parseFrontmatterYaml(yamlText, bodyOffset, body) {
  let frontmatter;
  try {
    frontmatter = yaml.load(yamlText);
  } catch (err) {
    throw new ParseError(`Malformed frontmatter YAML: ${err.message}`);
  }
  return { frontmatter: frontmatter || {}, body, bodyOffset };
}

function extractManagedSections(body) {
  const sections = {};
  let result = body;
  for (const type of MANAGED_SECTIONS) {
    const startMarker = `<!-- ovd-plan:${type}:start -->`;
    const endMarker = `<!-- ovd-plan:${type}:end -->`;
    const startIdx = result.indexOf(startMarker);
    if (startIdx === -1) continue;
    const endIdx = result.indexOf(endMarker, startIdx);
    if (endIdx === -1) {
      throw new ParseError(`Managed section '${type}' has start marker but no end marker`);
    }
    const inner = result.substring(startIdx + startMarker.length, endIdx);
    const trimmed = inner.replace(/^\n+/, '').replace(/\n+$/, '');
    sections[type] = trimmed;
    result = result.substring(0, startIdx) + result.substring(endIdx + endMarker.length);
  }
  return { sections, body: result };
}

function parseHeaderText(text) {
  let working = text;
  let active = false;
  const activeMatch = working.match(ACTIVE_PATTERN);
  if (activeMatch) {
    active = true;
    working = working.substring(0, activeMatch.index);
  }

  let status = null;
  const statusMatch = working.match(STATUS_PATTERN);
  if (statusMatch) {
    const raw = statusMatch[1].trim();
    status = raw === '' ? 'pending' : raw;
    working = working.substring(0, statusMatch.index);
  }

  working = working.trim();

  let explicitId = null;
  let title = working;
  const idMatch = working.match(ID_PATTERN);
  if (idMatch) {
    explicitId = idMatch[1];
    title = working.substring(idMatch[0].length).trim();
  }

  return {
    explicitId,
    title,
    status: status || 'pending',
    active
  };
}

function buildNode(depth, parentId, siblingIndex, headerInfo, lineNumber) {
  const generatedId = generateNodeId(parentId, depth, siblingIndex);
  return {
    id: generatedId,
    depth,
    explicitId: headerInfo.explicitId,
    title: headerInfo.title,
    status: headerInfo.status,
    active: headerInfo.active,
    description: null,
    annotations: null,
    children: [],
    lineNumber
  };
}

function collectNodeBody(lines, startIdx) {
  let i = startIdx;
  const descriptionLines = [];
  let annotations = null;
  let annotationLineNumber = null;

  while (i < lines.length) {
    const line = lines[i];

    if (HEADER_PATTERN.test(line)) break;

    if (YAML_BLOCK_OPEN.test(line)) {
      const blockStartLine = i + 1;
      i += 1;
      const yamlLines = [];
      let closed = false;
      while (i < lines.length) {
        if (FENCE_CLOSE.test(lines[i])) {
          i += 1;
          closed = true;
          break;
        }
        yamlLines.push(lines[i]);
        i += 1;
      }
      if (!closed) {
        throw new ParseError('Unclosed ovd-plan YAML block', blockStartLine);
      }
      if (annotations !== null) {
        throw new ParseError(
          'Multiple ovd-plan YAML blocks for the same node',
          blockStartLine
        );
      }
      const yamlText = yamlLines.join('\n');
      try {
        const parsed = yaml.load(yamlText);
        annotations = parsed === undefined ? {} : parsed;
      } catch (err) {
        throw new ParseError(
          `Malformed YAML in ovd-plan block: ${err.message}`,
          blockStartLine
        );
      }
      annotationLineNumber = blockStartLine;
      continue;
    }

    if (CODE_FENCE.test(line)) {
      descriptionLines.push(line);
      i += 1;
      while (i < lines.length) {
        descriptionLines.push(lines[i]);
        const isClose = FENCE_CLOSE.test(lines[i]);
        i += 1;
        if (isClose) break;
      }
      continue;
    }

    descriptionLines.push(line);
    i += 1;
  }

  let description = descriptionLines.join('\n').trim();
  if (description === '') description = null;

  return { description, annotations, annotationLineNumber, nextLineIdx: i };
}

function makeRoot() {
  return {
    id: '',
    depth: 1,
    explicitId: null,
    title: null,
    status: null,
    active: false,
    description: null,
    annotations: null,
    children: [],
    lineNumber: 0
  };
}

function parseTree(body) {
  const lines = body.split('\n');
  const root = makeRoot();
  const stack = [root];
  let sawH1 = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const headerMatch = line.match(HEADER_PATTERN);

    if (!headerMatch) {
      i += 1;
      continue;
    }

    const depth = headerMatch[1].length;
    const headerInfo = parseHeaderText(headerMatch[2]);
    const lineNumber = i + 1;

    if (depth === 1) {
      if (sawH1) {
        throw new ParseError(
          `Multiple H1 headers; only one project root is allowed (got "${headerInfo.title}")`,
          lineNumber
        );
      }
      root.title = headerInfo.title;
      root.status = headerInfo.status === 'pending' && !line.match(STATUS_PATTERN) ? null : headerInfo.status;
      root.explicitId = headerInfo.explicitId;
      root.active = headerInfo.active;
      root.lineNumber = lineNumber;
      sawH1 = true;
      while (stack.length > 1) stack.pop();
      i += 1;
      const collected = collectNodeBody(lines, i);
      root.description = collected.description;
      root.annotations = collected.annotations;
      i = collected.nextLineIdx;
      continue;
    }

    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }
    let parent = stack[stack.length - 1];
    if (!parent) {
      parent = root;
      stack.push(root);
    }

    const siblingIndex = parent.children.length + 1;
    const node = buildNode(depth, parent.id, siblingIndex, headerInfo, lineNumber);
    parent.children.push(node);
    stack.push(node);

    i += 1;
    const collected = collectNodeBody(lines, i);
    node.description = collected.description;
    node.annotations = collected.annotations;
    i = collected.nextLineIdx;
  }

  return root;
}

function validateAnnotations(node, ann) {
  if (!ann || typeof ann !== 'object') return;
  if (Array.isArray(ann)) {
    throw new ParseError(`Node ${node.id || '(root)'}: annotations must be an object, not an array`);
  }
  if (ann.skills !== undefined && !Array.isArray(ann.skills)) {
    throw new ParseError(`Node ${node.id || '(root)'}: skills must be an array`);
  }
  if (ann.confidence !== undefined && !CONFIDENCE_VALUES.has(ann.confidence)) {
    throw new ParseError(
      `Node ${node.id || '(root)'}: confidence must be one of high/medium/low (got "${ann.confidence}")`
    );
  }
  if (ann.success !== undefined && !Array.isArray(ann.success)) {
    throw new ParseError(`Node ${node.id || '(root)'}: success must be an array`);
  }
  if (ann.deps !== undefined && !Array.isArray(ann.deps)) {
    throw new ParseError(`Node ${node.id || '(root)'}: deps must be an array`);
  }
  if (ann.considered !== undefined && !Array.isArray(ann.considered)) {
    throw new ParseError(`Node ${node.id || '(root)'}: considered must be an array`);
  }
}

function validateNode(node, isRoot) {
  if (!isRoot && node.status && !STATUS_VALUES.has(node.status)) {
    throw new ParseError(`Node ${node.id || '(root)'}: invalid status "${node.status}"`);
  }
  validateAnnotations(node, node.annotations);
  for (const child of node.children) {
    validateNode(child, false);
  }
}

function validateTree(tree) {
  validateNode(tree, true);
}

function parseOverdriveMd(content) {
  const { frontmatter, body } = parseFrontmatter(content);
  const { sections, body: bodyWithoutManaged } = extractManagedSections(body);
  const tree = parseTree(bodyWithoutManaged);
  validateTree(tree);

  return {
    frontmatter,
    tree,
    sections
  };
}

module.exports = {
  parseOverdriveMd,
  parseFrontmatter,
  extractManagedSections,
  parseTree,
  parseHeaderText,
  generateNodeId,
  generateIdSegment,
  toRoman,
  validateTree,
  ParseError,
  STATUS_VALUES,
  CONFIDENCE_VALUES,
  MANAGED_SECTIONS,
  YAML_BLOCK_TAG
};
