'use strict';

const yaml = require('js-yaml');

const FRONTMATTER_KEY_ORDER = [
  'ovd-plan',
  'version',
  'project',
  'description',
  'created',
  'updated',
  'deliberation_status',
  'active_node',
  'current_milestone',
  'session_count',
  'context_files'
];

const ANNOTATION_KEY_ORDER = [
  'inserted_by',
  'inserted_reason',
  'skills',
  'confidence',
  'rationale',
  'considered',
  'scope',
  'success',
  'deps',
  'verify',
  'references',
  'cluster_verification',
  'iterations'
];

const SCOPE_KEY_ORDER = ['in', 'read_only', 'out'];
const VERIFY_KEY_ORDER = ['method', 'fallback', 'review_required'];
const REFERENCES_KEY_ORDER = ['sketches', 'research', 'external'];
const CLUSTER_VERIFY_KEY_ORDER = ['criteria', 'method', 'review_required'];

const MANAGED_SECTION_ORDER = [
  'decisions',
  'inbox',
  'capture',
  'concerns',
  'deliberation-state',
  'archive'
];

function orderedSortKeysFor(orderArray) {
  return (a, b) => {
    const ai = orderArray.indexOf(a);
    const bi = orderArray.indexOf(b);
    if (ai === -1 && bi === -1) return a < b ? -1 : a > b ? 1 : 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  };
}

function reorderObject(obj, keyOrder) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const result = {};
  for (const key of keyOrder) {
    if (key in obj) result[key] = obj[key];
  }
  for (const key of Object.keys(obj)) {
    if (!(key in result)) result[key] = obj[key];
  }
  return result;
}

function reorderAnnotations(ann) {
  if (!ann || typeof ann !== 'object' || Array.isArray(ann)) return ann;
  const out = reorderObject(ann, ANNOTATION_KEY_ORDER);
  if (out.scope && typeof out.scope === 'object') {
    out.scope = reorderObject(out.scope, SCOPE_KEY_ORDER);
  }
  if (out.verify && typeof out.verify === 'object') {
    out.verify = reorderObject(out.verify, VERIFY_KEY_ORDER);
  }
  if (out.references && typeof out.references === 'object') {
    out.references = reorderObject(out.references, REFERENCES_KEY_ORDER);
  }
  if (out.cluster_verification && typeof out.cluster_verification === 'object') {
    out.cluster_verification = reorderObject(out.cluster_verification, CLUSTER_VERIFY_KEY_ORDER);
  }
  return out;
}

function dumpYaml(obj, sortKeys = false) {
  return yaml
    .dump(obj, {
      lineWidth: 120,
      noRefs: true,
      sortKeys: sortKeys || false,
      quotingType: '"',
      forceQuotes: false
    })
    .replace(/\s+$/, '');
}

function writeFrontmatter(frontmatter) {
  if (!frontmatter || Object.keys(frontmatter).length === 0) return '';
  const ordered = reorderObject(frontmatter, FRONTMATTER_KEY_ORDER);
  if (ordered.context_files && typeof ordered.context_files === 'object') {
    // Keep context_files keys in insertion order
  }
  return `---\n${dumpYaml(ordered)}\n---\n`;
}

function statusBracket(status, isRoot) {
  if (isRoot) return '';
  if (!status || status === 'pending') return '[]';
  return `[${status}]`;
}

function writeHeader(node, isRoot) {
  const hashes = '#'.repeat(node.depth || 1);
  const idPart = node.explicitId
    ? node.explicitId + (node.depth === 2 && /^[IVXLCDM]+$/.test(node.explicitId) ? '.' : '')
    : node.id
      ? node.id + (node.depth === 2 && /^[IVXLCDM]+$/.test(node.id) ? '.' : '')
      : '';
  const titlePart = node.title || '';
  const head = idPart ? `${idPart} ${titlePart}`.trim() : titlePart;
  const status = statusBracket(node.status, isRoot);
  const active = node.active ? ' ← ACTIVE' : '';
  const tail = [status, active].filter(Boolean).join('').trim();
  return `${hashes} ${head}${tail ? ' ' + tail : ''}`.replace(/\s+$/, '');
}

function writeAnnotations(annotations) {
  if (annotations === null || annotations === undefined) return '';
  const ordered = reorderAnnotations(annotations);
  if (Object.keys(ordered).length === 0) {
    return '```yaml ovd-plan\n```';
  }
  const body = dumpYaml(ordered);
  return `\`\`\`yaml ovd-plan\n${body}\n\`\`\``;
}

function writeDescription(description) {
  if (!description) return '';
  return description.replace(/\s+$/, '');
}

function writeNode(node, isRoot) {
  const parts = [];
  parts.push(writeHeader(node, isRoot));
  const description = writeDescription(node.description);
  if (description) {
    parts.push('');
    parts.push(description);
  }
  const annotations = writeAnnotations(node.annotations);
  if (annotations) {
    parts.push('');
    parts.push(annotations);
  }
  return parts.join('\n');
}

function writeTree(tree) {
  const lines = [];
  function walk(node, isRoot) {
    lines.push(writeNode(node, isRoot));
    for (const child of node.children || []) {
      lines.push('');
      walk(child, false);
    }
  }
  walk(tree, true);
  return lines.join('\n');
}

function writeManagedSection(type, content) {
  const startMarker = `<!-- ovd-plan:${type}:start -->`;
  const endMarker = `<!-- ovd-plan:${type}:end -->`;
  const body = (content || '').replace(/\s+$/, '');
  return `${startMarker}\n${body}\n${endMarker}`;
}

function writeManagedSections(sections) {
  if (!sections || Object.keys(sections).length === 0) return '';
  const parts = [];
  const writtenTypes = new Set();
  for (const type of MANAGED_SECTION_ORDER) {
    if (type in sections) {
      parts.push(writeManagedSection(type, sections[type]));
      writtenTypes.add(type);
    }
  }
  for (const type of Object.keys(sections)) {
    if (!writtenTypes.has(type)) {
      parts.push(writeManagedSection(type, sections[type]));
    }
  }
  return parts.join('\n\n');
}

function writeOverdriveMd({ frontmatter, tree, sections }) {
  const segments = [];
  const fm = writeFrontmatter(frontmatter);
  if (fm) segments.push(fm.replace(/\n$/, ''));
  segments.push(writeTree(tree));
  const managed = writeManagedSections(sections);
  if (managed) segments.push(managed);
  return segments.join('\n\n') + '\n';
}

module.exports = {
  writeOverdriveMd,
  writeFrontmatter,
  writeTree,
  writeNode,
  writeAnnotations,
  writeManagedSections,
  reorderAnnotations,
  reorderObject,
  FRONTMATTER_KEY_ORDER,
  ANNOTATION_KEY_ORDER,
  MANAGED_SECTION_ORDER
};
