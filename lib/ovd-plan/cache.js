'use strict';

const fs = require('fs');
const path = require('path');

const { OVD_DIR, OVD_PLAN_FILE } = require('./fs');
const { parseOverdriveMd } = require('./parser');

const CACHE_FILE = 'plan.cache.json';
const CACHE_VERSION = 1;

const CLOSED_STATUSES = new Set(['done', 'skipped']);

function cachePath(projectDir) {
  return path.join(projectDir, OVD_DIR, CACHE_FILE);
}

function planPath(projectDir) {
  return path.join(projectDir, OVD_PLAN_FILE);
}

function loadCache(projectDir) {
  const full = cachePath(projectDir);
  if (!fs.existsSync(full)) return null;
  const raw = fs.readFileSync(full, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === CACHE_VERSION) return parsed;
    return null;
  } catch (err) {
    return null;
  }
}

function saveCache(projectDir, cacheObject) {
  const full = cachePath(projectDir);
  const dir = path.dirname(full);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const payload = {
    version: CACHE_VERSION,
    generated_at: new Date().toISOString(),
    ...cacheObject
  };

  const tmpPath = `${full}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2) + '\n');
  fs.renameSync(tmpPath, full);
  return { path: full, version: CACHE_VERSION };
}

function summarizeChildren(node) {
  const summary = { total: 0, done: 0, pending: 0, in_progress: 0, awaiting_review: 0, blocked: 0, skipped: 0 };
  for (const child of node.children || []) {
    summary.total += 1;
    switch (child.status) {
      case 'done':
        summary.done += 1;
        break;
      case 'in-progress':
        summary.in_progress += 1;
        break;
      case 'awaiting-review':
        summary.awaiting_review += 1;
        break;
      case 'blocked':
        summary.blocked += 1;
        break;
      case 'skipped':
        summary.skipped += 1;
        break;
      default:
        summary.pending += 1;
    }
  }
  return summary;
}

function flattenForCache(node) {
  const out = {
    id: node.id,
    depth: node.depth,
    title: node.title,
    status: node.status,
    active: !!node.active,
    explicit_id: node.explicitId || null,
    description: node.description || null,
    annotations: node.annotations || null,
    children: (node.children || []).map(flattenForCache),
    summary: summarizeChildren(node)
  };
  return out;
}

function regenerateCacheFrom(projectDir) {
  const planFile = planPath(projectDir);
  if (!fs.existsSync(planFile)) {
    throw new Error(`OVERDRIVE.md not found at ${planFile}`);
  }
  const content = fs.readFileSync(planFile, 'utf8');
  const parsed = parseOverdriveMd(content);
  const cacheObject = {
    frontmatter: parsed.frontmatter || {},
    tree: flattenForCache(parsed.tree),
    sections: parsed.sections || {}
  };
  return saveCache(projectDir, cacheObject);
}

function findNodeById(tree, nodeId) {
  if (tree.id === nodeId) return { node: tree, parents: [] };
  function walk(node, parents) {
    for (const child of node.children || []) {
      if (child.id === nodeId) return { node: child, parents: [...parents, node] };
      const found = walk(child, [...parents, node]);
      if (found) return found;
    }
    return null;
  }
  return walk(tree, []);
}

function isNodeClosed(node) {
  if (CLOSED_STATUSES.has(node.status)) return true;
  if (!node.children || node.children.length === 0) {
    return CLOSED_STATUSES.has(node.status);
  }
  return node.children.every(isNodeClosed);
}

function closureCheck(tree, justClosedNodeId) {
  const found = findNodeById(tree, justClosedNodeId);
  if (!found) {
    return {
      closures: [],
      stops_at: null,
      reason: 'node-not-found',
      nodeId: justClosedNodeId
    };
  }

  const { parents } = found;
  if (parents.length === 0) {
    return { closures: [], stops_at: null, reason: 'no-parent' };
  }

  const closures = [];
  for (let i = parents.length - 1; i >= 0; i--) {
    const ancestor = parents[i];
    if (!ancestor.children || ancestor.children.length === 0) break;
    const allChildrenClosed = ancestor.children.every(isNodeClosed);
    if (allChildrenClosed) {
      closures.push({ id: ancestor.id || '(root)', title: ancestor.title, depth: ancestor.depth });
    } else {
      return {
        closures,
        stops_at: { id: ancestor.id || '(root)', title: ancestor.title, depth: ancestor.depth },
        reason: 'open-siblings'
      };
    }
  }

  return { closures, stops_at: null, reason: 'reached-root' };
}

module.exports = {
  CACHE_FILE,
  CACHE_VERSION,
  cachePath,
  planPath,
  loadCache,
  saveCache,
  regenerateCacheFrom,
  flattenForCache,
  summarizeChildren,
  findNodeById,
  closureCheck,
  isNodeClosed,
  CLOSED_STATUSES
};
