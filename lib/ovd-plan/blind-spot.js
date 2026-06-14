'use strict';

const { openState, commitState } = require('./deliberation-state');
const { appendUnderHeader } = require('./migrate');
const deliberate = require('./deliberate');

// ---------------------------------------------------------------------------
// r3 §5.3.4 — 11 architect-level categories. Internal reasoning is exhaustive
// (the agent's reasoning lives in inserted_node.internal_analysis); external
// presentation is one line per inserted node. Per Q3.4.4, every category MUST
// appear in either inserted_nodes or na_categories at commit time — no silent skips.
// ---------------------------------------------------------------------------

const CATEGORIES = [
  {
    key: 'security',
    prompt: 'Security — auth, authz, validation, secrets, CSRF, XSS, rate limiting',
    when_applicable: 'Applies to any system that accepts external input, stores credentials/secrets, or exposes endpoints to untrusted clients.',
    example_inserted_nodes: [
      'Rate limiting on auth endpoints',
      'CSRF protection on form submissions',
      'Input validation for user-provided data'
    ]
  },
  {
    key: 'perf',
    prompt: 'Performance — load, caching, queries, bundle size, perceived perf',
    when_applicable: 'Applies when latency, scale, or resource cost is a user-facing or operational concern.',
    example_inserted_nodes: [
      'Index frequently-queried columns',
      'Cache dashboard widget data with stale-while-revalidate',
      'Bundle-size budget for first-load JS'
    ]
  },
  {
    key: 'accessibility',
    prompt: 'Accessibility — WCAG compliance, keyboard nav, screen reader, contrast',
    when_applicable: 'Applies to any user-facing UI; especially load-bearing for internal tooling and public products with diverse users.',
    example_inserted_nodes: [
      'Keyboard navigation across primary nav bar',
      'WCAG AA contrast on primary action buttons',
      'Screen reader labels on data tables'
    ]
  },
  {
    key: 'observability',
    prompt: 'Observability — logging, tracing, metrics, alerting',
    when_applicable: 'Applies when production behaviour needs to be diagnosable without code changes; scales with criticality.',
    example_inserted_nodes: [
      'Request-trace IDs on every API call',
      'Latency metrics on the critical user path',
      'Alert on auth failure rate spike'
    ]
  },
  {
    key: 'error_handling',
    prompt: 'Error handling — failure modes, retries, fallbacks, user messages',
    when_applicable: 'Applies to every system with external dependencies or user-facing operations that can fail.',
    example_inserted_nodes: [
      'Retry-with-backoff on transient API failures',
      'User-facing message on network failure',
      'Fallback content when third-party service unavailable'
    ]
  },
  {
    key: 'data',
    prompt: 'Data — migrations, fixtures, seeds, backup, schema evolution',
    when_applicable: 'Applies to any system that persists state. Migration safety scales with row count and write volume.',
    example_inserted_nodes: [
      'Migration rollback plan for new schema column',
      'Seed data for development environment',
      'Backup strategy for production database'
    ]
  },
  {
    key: 'testing',
    prompt: 'Testing — unit, integration, e2e, regression, contract',
    when_applicable: 'Applies universally; depth scales with criticality and refactor frequency.',
    example_inserted_nodes: [
      'Integration tests for auth flow',
      'Visual regression tests for dashboard layout',
      'Contract tests for third-party API integration'
    ]
  },
  {
    key: 'operations',
    prompt: 'Operations — deployment, rollback, env config, feature flags',
    when_applicable: 'Applies when production deployments are not trivially reversible or env config diverges across stages.',
    example_inserted_nodes: [
      'Rollback runbook for failed deployment',
      'Feature flag for new widget rollout',
      'Environment-specific config separation'
    ]
  },
  {
    key: 'docs',
    prompt: 'Documentation — README, API reference, runbook, onboarding',
    when_applicable: 'Applies when the system has more than one human consumer (including future-self after a context gap).',
    example_inserted_nodes: [
      'Onboarding doc for new contributors',
      'API reference for public endpoints',
      'Runbook for common production incidents'
    ]
  },
  {
    key: 'user_facing',
    prompt: 'User-facing states — empty / loading / error states, onboarding, edge cases',
    when_applicable: 'Applies to any UI; missing states are the most common quality regression in user-facing surfaces.',
    example_inserted_nodes: [
      'Empty state for dashboard before first data',
      'Loading skeleton during slow API calls',
      'Error state with retry CTA when fetch fails'
    ]
  },
  {
    key: 'compliance',
    prompt: 'Compliance — licensing, privacy, audit logging',
    when_applicable: 'Applies if regulated industry, handles PII / financial / health data, or has audit obligations. Often N/A for hobby / internal tooling.',
    example_inserted_nodes: [
      'Audit log for admin actions',
      'GDPR data export endpoint',
      'Privacy policy in user onboarding'
    ]
  }
];

const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);
const CATEGORY_SET = new Set(CATEGORY_KEYS);

// Required fields on every inserted node (regardless of depth).
const INSERTED_NODE_BASE_FIELDS = ['category', 'title', 'description', 'internal_analysis', 'inserted_reason'];
// Additional required fields for depth-3 (parent_milestone_id given) — reuses Slice A's leaf shape.
const INSERTED_LEAF_EXTRA_FIELDS = ['id', 'scope', 'success', 'verify', 'deps'];
// Required for depth-2 (new milestone — no parent_milestone_id).
const INSERTED_MILESTONE_EXTRA_FIELDS = ['id'];

const INBOX_HEADER_NA = 'Blind-spot N/A categories (agent-deemed-not-applicable)';
const INBOX_HEADER_PRUNED = 'Blind-spot pruned nodes (considered-but-not-adopted)';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowIso(opts) {
  return (opts && opts.now) || new Date().toISOString();
}

function envelope(payload) {
  return Object.assign({ status: 'blind-spot' }, payload);
}

function isPostInsert(inner) {
  return !!(inner && inner.blind_spot_inserted === true);
}

function findInsertedNodes(tree) {
  if (!tree || !Array.isArray(tree.milestones)) return [];
  const out = [];
  for (const m of tree.milestones) {
    if (m && m.inserted_by === 'agent') {
      out.push({ id: m.id, title: m.title, kind: 'milestone', node: m, category: m.category, inserted_reason: m.inserted_reason });
    }
    if (Array.isArray(m.children)) {
      for (const leaf of m.children) {
        if (leaf && leaf.inserted_by === 'agent') {
          out.push({ id: leaf.id, title: leaf.title, kind: 'leaf', node: leaf, parent_milestone_id: m.id, category: leaf.category, inserted_reason: leaf.inserted_reason });
        }
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Plan mode — emit dispatch artifact (insert OR prune phase)
// ---------------------------------------------------------------------------

function buildBlindSpotTurn(rootDir, opts = {}) {
  const opened = openState(rootDir);
  if (!opened.ok) {
    return envelope({ ok: false, reason: opened.reason, text: opened.text });
  }
  const inner = opened.innerObj;
  if (!inner.proposed_tree || !Array.isArray(inner.proposed_tree.milestones) || inner.proposed_tree.milestones.length === 0) {
    return envelope({
      ok: false,
      reason: 'no-proposed-tree',
      text: 'Blind-spot expansion requires a Spec\'d proposed_tree. Run /ovd-plan deliberate through Stage 2 (Elicit) and Stage 4 (Spec) first.'
    });
  }
  if (isPostInsert(inner)) {
    return buildBlindSpotPruneTurn(inner);
  }
  return buildBlindSpotInsertTurn(inner);
}

function buildBlindSpotInsertTurn(inner) {
  const tree = inner.proposed_tree;
  const lines = [];
  lines.push('Stage 3 — Blind-spot expansion (exhaustive internally, terse externally)');
  lines.push('========================================================================');
  lines.push('');
  lines.push(`Milestones in proposed_tree (use these IDs as parent_milestone_id anchors):`);
  for (const m of tree.milestones) {
    lines.push(`  ${m.id}  ${m.title}`);
  }
  lines.push('');
  lines.push('Categories to evaluate (architect-level internal pass, terse external presentation):');
  for (const cat of CATEGORIES) {
    lines.push('');
    lines.push(`## ${cat.key}`);
    lines.push(`  prompt: ${cat.prompt}`);
    lines.push(`  when_applicable: ${cat.when_applicable}`);
    lines.push('  example_inserted_nodes:');
    for (const ex of cat.example_inserted_nodes) {
      lines.push(`    - ${ex}`);
    }
  }
  lines.push('');
  lines.push('Instructions for the agent:');
  lines.push('  - Run the full architect-level analysis internally per category. Surface only the inserted-node candidates externally (one line per node).');
  lines.push('  - Per r3 §5.3.4: EVERY category MUST appear in either inserted_nodes OR na_categories. No silent skips.');
  lines.push('  - Each inserted node MUST carry: category (from the 11 keys above), title (one line, user-facing), description (one paragraph), internal_analysis (multi-paragraph agent reasoning — preserved on commit), inserted_reason (one-line user-facing).');
  lines.push('  - With parent_milestone_id: a depth-3 leaf under that milestone. Must include full leaf shape: id (e.g., "II.4"), scope.{in,out,read_only?}, success[] (non-empty), verify.{method,fallback,review_required:boolean}, deps[].');
  lines.push('  - Without parent_milestone_id: a NEW depth-2 milestone appended to proposed_tree.milestones[]. Must include id (e.g., "III"), title, description, ambiguity_score (1-5).');
  lines.push('  - parent_milestone_id, if given, MUST reference an existing milestone in proposed_tree.milestones[].');
  lines.push('');
  lines.push('Commit syntax (insert):');
  lines.push('  overdrive plan deliberate --entries-json \'{"kind":"insert","inserted_nodes":[{"category":"accessibility","parent_milestone_id":"II","id":"II.4","title":"WCAG AA pass","description":"...","scope":{"in":["src/components/"],"out":[]},"success":["AA contrast ratios met on primary CTAs"],"verify":{"method":"axe-core","fallback":"agent_self_check_against_success","review_required":true},"deps":[],"internal_analysis":"...","inserted_reason":"Internal-tooling UIs need keyboard nav and contrast for screen-reader users."}],"na_categories":[{"category":"compliance","reason":"hobby project, no regulated data"}]}\'');
  return envelope({
    ok: true,
    mode: 'plan',
    phase: 'insert',
    stage: 'blind_spot',
    categories: CATEGORIES,
    milestones: tree.milestones.map((m) => ({ id: m.id, title: m.title })),
    expectedPayload: { kind: '"insert"', inserted_nodes: 'array', na_categories: 'array' },
    text: lines.join('\n')
  });
}

function buildBlindSpotPruneTurn(inner) {
  const tree = inner.proposed_tree;
  const inserted = findInsertedNodes(tree);
  const lines = [];
  lines.push('Stage 3 — Blind-spot review + prune');
  lines.push('===================================');
  lines.push('');
  lines.push(`Inserted nodes (review each — prune any not relevant):`);
  if (inserted.length === 0) {
    lines.push('  (none — all 11 categories returned N/A; no nodes were inserted.)');
  } else {
    for (const n of inserted) {
      const parent = n.parent_milestone_id ? ` (under ${n.parent_milestone_id})` : ' (new milestone)';
      const reason = n.inserted_reason ? ` — ${n.inserted_reason}` : '';
      lines.push(`  [agent] ${n.id} ${n.title}${parent}${reason}`);
    }
  }
  lines.push('');
  lines.push('Action paths:');
  lines.push('  (1) Approve all — keep every inserted node, transition to Stage 5 (Plan).');
  lines.push('  (2) Prune — list specific IDs to remove (pruned nodes move to inbox with full internal_analysis preserved).');
  lines.push('  (3) Re-analyze — discard all inserts, return to blind-spot insert phase.');
  lines.push('  (4) Describe other (or describe what you want).');
  lines.push('');
  lines.push('Commit syntax (prune):');
  if (inserted.length === 0) {
    lines.push('  overdrive plan deliberate --entries-json \'{"kind":"prune","approved_ids":[],"pruned_ids":[]}\'  (no nodes were inserted — empty arrays advance to Stage 5)');
  } else {
    const allIds = inserted.map((n) => n.id);
    lines.push(`  overdrive plan deliberate --entries-json '{"kind":"prune","approved_ids":${JSON.stringify(allIds)},"pruned_ids":[]}'  (approve all)`);
    lines.push(`  overdrive plan deliberate --entries-json '{"kind":"prune","approved_ids":[...],"pruned_ids":[...]}'  (every inserted ID must appear in exactly one list)`);
  }
  return envelope({
    ok: true,
    mode: 'plan',
    phase: 'prune',
    stage: 'blind_spot',
    insertedNodes: inserted,
    expectedPayload: { kind: '"prune"', approved_ids: 'string[]', pruned_ids: 'string[]' },
    text: lines.join('\n')
  });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateInsertedNode(node, index, milestoneIds) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return `inserted_nodes[${index}] must be an object.`;
  }
  for (const field of INSERTED_NODE_BASE_FIELDS) {
    if (node[field] === undefined) {
      return `inserted_nodes[${index}] missing required field: ${field}.`;
    }
  }
  if (typeof node.category !== 'string' || !CATEGORY_SET.has(node.category)) {
    return `inserted_nodes[${index}].category must be one of: ${CATEGORY_KEYS.join(', ')} (got "${node.category}").`;
  }
  if (typeof node.title !== 'string' || !node.title.trim()) {
    return `inserted_nodes[${index}].title must be a non-empty string.`;
  }
  if (typeof node.description !== 'string' || !node.description.trim()) {
    return `inserted_nodes[${index}].description must be a non-empty string.`;
  }
  if (typeof node.internal_analysis !== 'string' || !node.internal_analysis.trim()) {
    return `inserted_nodes[${index}].internal_analysis must be a non-empty string (agent's architect-level reasoning — preserved on commit).`;
  }
  if (typeof node.inserted_reason !== 'string' || !node.inserted_reason.trim()) {
    return `inserted_nodes[${index}].inserted_reason must be a non-empty string (one-line user-facing).`;
  }

  if (node.parent_milestone_id !== undefined && node.parent_milestone_id !== null) {
    // Depth-3 leaf under existing milestone — full leaf shape required.
    if (typeof node.parent_milestone_id !== 'string') {
      return `inserted_nodes[${index}].parent_milestone_id must be a string when present.`;
    }
    if (!milestoneIds.has(node.parent_milestone_id)) {
      return `inserted_nodes[${index}].parent_milestone_id "${node.parent_milestone_id}" not found in proposed_tree.milestones[].`;
    }
    for (const field of INSERTED_LEAF_EXTRA_FIELDS) {
      if (node[field] === undefined) {
        return `inserted_nodes[${index}] (depth-3 leaf) missing required field: ${field}.`;
      }
    }
    if (typeof node.id !== 'string' || !node.id.trim()) {
      return `inserted_nodes[${index}].id must be a non-empty string.`;
    }
    if (!node.scope || typeof node.scope !== 'object' || Array.isArray(node.scope)) {
      return `inserted_nodes[${index}].scope must be an object.`;
    }
    if (!Array.isArray(node.scope.in)) return `inserted_nodes[${index}].scope.in must be an array.`;
    if (!Array.isArray(node.scope.out)) return `inserted_nodes[${index}].scope.out must be an array.`;
    if (node.scope.read_only !== undefined && !Array.isArray(node.scope.read_only)) {
      return `inserted_nodes[${index}].scope.read_only must be an array when present.`;
    }
    if (!Array.isArray(node.success) || node.success.length === 0) {
      return `inserted_nodes[${index}].success must be a non-empty array.`;
    }
    if (!node.verify || typeof node.verify !== 'object' || Array.isArray(node.verify)) {
      return `inserted_nodes[${index}].verify must be an object.`;
    }
    if (typeof node.verify.method !== 'string' || !node.verify.method.trim()) {
      return `inserted_nodes[${index}].verify.method must be a non-empty string.`;
    }
    if (typeof node.verify.fallback !== 'string' || !node.verify.fallback.trim()) {
      return `inserted_nodes[${index}].verify.fallback must be a non-empty string.`;
    }
    if (typeof node.verify.review_required !== 'boolean') {
      return `inserted_nodes[${index}].verify.review_required must be a boolean.`;
    }
    if (!Array.isArray(node.deps)) return `inserted_nodes[${index}].deps must be an array.`;
  } else {
    // Depth-2 new milestone.
    for (const field of INSERTED_MILESTONE_EXTRA_FIELDS) {
      if (node[field] === undefined) {
        return `inserted_nodes[${index}] (depth-2 new milestone) missing required field: ${field}.`;
      }
    }
    if (typeof node.id !== 'string' || !node.id.trim()) {
      return `inserted_nodes[${index}].id must be a non-empty string.`;
    }
    if (node.ambiguity_score !== undefined && (!Number.isInteger(node.ambiguity_score) || node.ambiguity_score < 1 || node.ambiguity_score > 5)) {
      return `inserted_nodes[${index}].ambiguity_score must be an integer 1-5 when present (default 2).`;
    }
  }
  return null;
}

function validateNaCategory(na, index) {
  if (!na || typeof na !== 'object' || Array.isArray(na)) {
    return `na_categories[${index}] must be an object.`;
  }
  if (typeof na.category !== 'string' || !CATEGORY_SET.has(na.category)) {
    return `na_categories[${index}].category must be one of: ${CATEGORY_KEYS.join(', ')} (got "${na.category}").`;
  }
  if (typeof na.reason !== 'string' || !na.reason.trim()) {
    return `na_categories[${index}].reason must be a non-empty string.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Apply (commit) — insert phase
// ---------------------------------------------------------------------------

function writeInboxNa(sections, naCategories, now) {
  const lines = naCategories.map((na) => `- [considered-but-not-adopted: agent-deemed-N/A: ${na.category}] ${na.reason} (${now})`);
  const body = lines.join('\n');
  const prior = sections.inbox || '';
  return appendUnderHeader(prior, INBOX_HEADER_NA, body);
}

function writeInboxPruned(sections, prunedNodes, now) {
  const lines = [];
  for (const n of prunedNodes) {
    lines.push(`- [considered-but-not-adopted: user-pruned-at: ${now}] ${n.id} ${n.title} (category=${n.category})`);
    lines.push(`  - inserted_reason: ${n.inserted_reason}`);
    if (n.node.internal_analysis) {
      lines.push(`  - internal_analysis: ${n.node.internal_analysis}`);
    }
  }
  const body = lines.join('\n');
  const prior = sections.inbox || '';
  return appendUnderHeader(prior, INBOX_HEADER_PRUNED, body);
}

function applyBlindSpotInsert(rootDir, entries, opts = {}) {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return envelope({ ok: false, reason: 'invalid-shape', text: 'Blind-spot insert commit requires a JSON object with { kind: "insert", inserted_nodes, na_categories }.' });
  }
  if (entries.kind !== 'insert') {
    return envelope({ ok: false, reason: 'invalid-kind', text: 'Blind-spot insert commit kind must be "insert".' });
  }
  if (!Array.isArray(entries.inserted_nodes)) {
    return envelope({ ok: false, reason: 'invalid-shape', text: 'entries.inserted_nodes must be an array (use [] when all categories are N/A).' });
  }
  if (!Array.isArray(entries.na_categories)) {
    return envelope({ ok: false, reason: 'invalid-shape', text: 'entries.na_categories must be an array (use [] when no categories are N/A).' });
  }

  // Pre-flight: open state, validate stage + proposed_tree present.
  const opened = openState(rootDir);
  if (!opened.ok) {
    return envelope({ ok: false, reason: opened.reason, text: opened.text });
  }
  if (deliberate.currentStage(opened.innerObj) !== 'blind_spot') {
    return envelope({ ok: false, reason: 'stage-mismatch', text: `Cannot apply blind-spot insert while stage is "${deliberate.currentStage(opened.innerObj)}".` });
  }
  if (isPostInsert(opened.innerObj)) {
    return envelope({ ok: false, reason: 'already-inserted', text: 'Blind-spot insert already applied; next call should be {kind:"prune"} or {kind:"re-analyze"}.' });
  }
  const inner = opened.innerObj;
  const tree = inner.proposed_tree;
  if (!tree || !Array.isArray(tree.milestones)) {
    return envelope({ ok: false, reason: 'no-proposed-tree', text: 'Blind-spot insert requires a proposed_tree.milestones[].' });
  }
  const milestoneIds = new Set(tree.milestones.map((m) => m.id));

  // Validation rejections (Pattern 4 — per-node first; coverage is an aggregate check that follows).
  // Order matters: a bad category on a single node is reported as 'invalid-inserted-node', not as
  // 'category-coverage' (which would be a misleading aggregate error pointing at the wrong cause).
  for (let i = 0; i < entries.inserted_nodes.length; i += 1) {
    const err = validateInsertedNode(entries.inserted_nodes[i], i, milestoneIds);
    if (err) return envelope({ ok: false, reason: 'invalid-inserted-node', text: err });
  }
  for (let i = 0; i < entries.na_categories.length; i += 1) {
    const err = validateNaCategory(entries.na_categories[i], i);
    if (err) return envelope({ ok: false, reason: 'invalid-na-category', text: err });
  }

  // Coverage check (Q3.4.4): every category must appear in inserted_nodes OR na_categories.
  const coveredCategories = new Set();
  for (const n of entries.inserted_nodes) {
    if (n && typeof n.category === 'string') coveredCategories.add(n.category);
  }
  for (const na of entries.na_categories) {
    if (na && typeof na.category === 'string') coveredCategories.add(na.category);
  }
  const missingCategories = CATEGORY_KEYS.filter((k) => !coveredCategories.has(k));
  if (missingCategories.length > 0) {
    return envelope({
      ok: false,
      reason: 'category-coverage',
      text: `Every category must appear in inserted_nodes OR na_categories — missing: ${missingCategories.join(', ')}. Use na_categories to explicitly mark non-applicable ones.`
    });
  }

  // Check inserted-node IDs are unique within the payload AND don't collide with existing proposed_tree IDs.
  const allExistingIds = new Set();
  for (const m of tree.milestones) {
    allExistingIds.add(m.id);
    if (Array.isArray(m.children)) {
      for (const leaf of m.children) {
        if (leaf && leaf.id) allExistingIds.add(leaf.id);
      }
    }
  }
  const seenIds = new Set();
  for (let i = 0; i < entries.inserted_nodes.length; i += 1) {
    const n = entries.inserted_nodes[i];
    if (seenIds.has(n.id)) {
      return envelope({ ok: false, reason: 'duplicate-id', text: `inserted_nodes[${i}].id "${n.id}" appears twice in the payload.` });
    }
    seenIds.add(n.id);
    if (allExistingIds.has(n.id)) {
      return envelope({ ok: false, reason: 'duplicate-id', text: `inserted_nodes[${i}].id "${n.id}" collides with an existing node in proposed_tree.` });
    }
  }

  // Apply mutations. Per the readiness brief: blind-spot-inserted leaves carry the same
  // Slice B placeholders (skills:[], confidence:'low', pending_skill_resolution:true) as
  // Slice A user-planned leaves, so Slice B's RESOLVE SKILLS sweep is uniform across both.
  const now = nowIso(opts);
  for (const n of entries.inserted_nodes) {
    if (n.parent_milestone_id) {
      const target = tree.milestones.find((m) => m.id === n.parent_milestone_id);
      if (!Array.isArray(target.children)) target.children = [];
      target.children.push(Object.assign({}, n, {
        inserted_by: 'agent',
        skills: [],
        confidence: 'low',
        pending_skill_resolution: true
      }));
    } else {
      // New depth-2 milestone — defaults: ambiguity_score=2, children=[].
      const newMilestone = Object.assign({
        ambiguity_score: 2,
        children: []
      }, n, { inserted_by: 'agent' });
      tree.milestones.push(newMilestone);
    }
  }

  // N/A categories → inbox.
  if (entries.na_categories.length > 0) {
    opened.sections.inbox = writeInboxNa(opened.sections, entries.na_categories, now);
  }

  // State updates.
  inner.blind_spot_inserted = true;
  tree.last_revision = (tree.last_revision || 1) + 1;
  inner.current_proposal_revision = tree.last_revision;
  inner.last_action = now;
  opened.innerObj = deliberate.reorderInner(inner);

  const committed = commitState(rootDir, opened);
  if (!committed.ok) {
    return envelope({ ok: false, reason: committed.reason, text: committed.text });
  }

  return envelope({
    ok: true,
    mode: 'commit',
    phase: 'insert',
    stage: 'blind_spot',
    insertedCount: entries.inserted_nodes.length,
    naCount: entries.na_categories.length,
    revision: tree.last_revision,
    text: `Blind-spot inserts recorded: ${entries.inserted_nodes.length} node(s); N/A: ${entries.na_categories.length} categor${entries.na_categories.length === 1 ? 'y' : 'ies'} (written to inbox). Next: /ovd-plan deliberate to review the inserted set and prune.`
  });
}

// ---------------------------------------------------------------------------
// Apply (commit) — prune phase
// ---------------------------------------------------------------------------

function detachNode(tree, found) {
  if (found.kind === 'milestone') {
    const idx = tree.milestones.findIndex((m) => m.id === found.id);
    if (idx >= 0) tree.milestones.splice(idx, 1);
  } else if (found.kind === 'leaf') {
    const milestone = tree.milestones.find((m) => m.id === found.parent_milestone_id);
    if (milestone && Array.isArray(milestone.children)) {
      const idx = milestone.children.findIndex((c) => c.id === found.id);
      if (idx >= 0) milestone.children.splice(idx, 1);
    }
  }
}

function applyBlindSpotPrune(rootDir, entries, opts = {}) {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return envelope({ ok: false, reason: 'invalid-shape', text: 'Blind-spot prune commit requires a JSON object with { kind: "prune", approved_ids, pruned_ids }.' });
  }
  if (entries.kind !== 'prune') {
    return envelope({ ok: false, reason: 'invalid-kind', text: 'Blind-spot prune commit kind must be "prune".' });
  }
  if (!Array.isArray(entries.approved_ids)) {
    return envelope({ ok: false, reason: 'invalid-shape', text: 'entries.approved_ids must be an array of node IDs.' });
  }
  if (!Array.isArray(entries.pruned_ids)) {
    return envelope({ ok: false, reason: 'invalid-shape', text: 'entries.pruned_ids must be an array of node IDs.' });
  }

  const opened = openState(rootDir);
  if (!opened.ok) {
    return envelope({ ok: false, reason: opened.reason, text: opened.text });
  }
  if (deliberate.currentStage(opened.innerObj) !== 'blind_spot') {
    return envelope({ ok: false, reason: 'stage-mismatch', text: `Cannot apply blind-spot prune while stage is "${deliberate.currentStage(opened.innerObj)}".` });
  }
  if (!isPostInsert(opened.innerObj)) {
    return envelope({ ok: false, reason: 'not-post-insert', text: 'Blind-spot prune requires a prior insert call. Use {kind:"insert"} first.' });
  }
  const inner = opened.innerObj;
  const tree = inner.proposed_tree;
  const inserted = findInsertedNodes(tree);
  const insertedIds = new Set(inserted.map((n) => n.id));

  // Validate every actually-inserted ID appears in EXACTLY one list (approved or pruned).
  const seen = new Set();
  for (const id of entries.approved_ids) {
    if (!insertedIds.has(id)) {
      return envelope({ ok: false, reason: 'unknown-id', text: `approved_ids contains "${id}" but no such inserted node exists.` });
    }
    if (seen.has(id)) {
      return envelope({ ok: false, reason: 'duplicate-id', text: `"${id}" appears more than once across approved_ids + pruned_ids.` });
    }
    seen.add(id);
  }
  for (const id of entries.pruned_ids) {
    if (!insertedIds.has(id)) {
      return envelope({ ok: false, reason: 'unknown-id', text: `pruned_ids contains "${id}" but no such inserted node exists.` });
    }
    if (seen.has(id)) {
      return envelope({ ok: false, reason: 'duplicate-id', text: `"${id}" appears more than once across approved_ids + pruned_ids.` });
    }
    seen.add(id);
  }
  const missing = inserted.filter((n) => !seen.has(n.id));
  if (missing.length > 0) {
    return envelope({
      ok: false,
      reason: 'incomplete-coverage',
      text: `Every inserted ID must appear in approved_ids OR pruned_ids — missing: ${missing.map((n) => n.id).join(', ')}.`
    });
  }

  // Apply: move pruned nodes to inbox, detach from tree.
  const now = nowIso(opts);
  const prunedNodes = inserted.filter((n) => entries.pruned_ids.includes(n.id));
  if (prunedNodes.length > 0) {
    opened.sections.inbox = writeInboxPruned(opened.sections, prunedNodes, now);
    for (const n of prunedNodes) {
      detachNode(tree, n);
    }
  }

  // Transition stage + clear blind_spot_inserted.
  inner.stage = 'plan';
  delete inner.blind_spot_inserted;
  tree.last_revision = (tree.last_revision || 1) + 1;
  inner.current_proposal_revision = tree.last_revision;
  inner.last_action = now;
  opened.innerObj = deliberate.reorderInner(inner);

  const committed = commitState(rootDir, opened);
  if (!committed.ok) {
    return envelope({ ok: false, reason: committed.reason, text: committed.text });
  }

  return envelope({
    ok: true,
    mode: 'commit',
    phase: 'prune',
    stage: 'plan',
    transitioned: true,
    approvedCount: entries.approved_ids.length,
    prunedCount: entries.pruned_ids.length,
    revision: tree.last_revision,
    text: `Blind-spot prune recorded: ${entries.approved_ids.length} approved, ${entries.pruned_ids.length} pruned (moved to inbox with full internal_analysis). Transitioning to Stage 5 (Plan).`
  });
}

// ---------------------------------------------------------------------------
// Apply (commit) — re-analyze (discard all inserts, return to insert phase)
// ---------------------------------------------------------------------------

function applyBlindSpotReanalyze(rootDir, entries, opts = {}) {
  const opened = openState(rootDir);
  if (!opened.ok) {
    return envelope({ ok: false, reason: opened.reason, text: opened.text });
  }
  if (deliberate.currentStage(opened.innerObj) !== 'blind_spot') {
    return envelope({ ok: false, reason: 'stage-mismatch', text: `Cannot apply blind-spot re-analyze while stage is "${deliberate.currentStage(opened.innerObj)}".` });
  }
  if (!isPostInsert(opened.innerObj)) {
    return envelope({ ok: false, reason: 'not-post-insert', text: 'Re-analyze requires a prior insert call.' });
  }
  const inner = opened.innerObj;
  const tree = inner.proposed_tree;
  const inserted = findInsertedNodes(tree);
  for (const n of inserted) detachNode(tree, n);
  delete inner.blind_spot_inserted;
  tree.last_revision = (tree.last_revision || 1) + 1;
  inner.current_proposal_revision = tree.last_revision;
  inner.last_action = nowIso(opts);
  opened.innerObj = deliberate.reorderInner(inner);
  const committed = commitState(rootDir, opened);
  if (!committed.ok) {
    return envelope({ ok: false, reason: committed.reason, text: committed.text });
  }
  return envelope({
    ok: true,
    mode: 'commit',
    phase: 'reanalyze',
    stage: 'blind_spot',
    discardedCount: inserted.length,
    text: `Blind-spot re-analyze: discarded ${inserted.length} prior insert(s). Run /ovd-plan deliberate to start a fresh insert pass.`
  });
}

// ---------------------------------------------------------------------------
// Orchestrator — plan/commit dispatch + kind-based commit routing
// ---------------------------------------------------------------------------

function runBlindSpot(rootDir, opts = {}) {
  const isCommit = opts.mode === 'commit' || !!opts.entries;
  if (!isCommit) {
    return buildBlindSpotTurn(rootDir, opts);
  }
  if (!opts.entries || typeof opts.entries !== 'object' || Array.isArray(opts.entries)) {
    return envelope({ ok: false, reason: 'invalid-shape', text: 'Blind-spot commit requires a JSON object with { kind: "insert" | "prune" | "re-analyze", ... }.' });
  }
  switch (opts.entries.kind) {
    case 'insert':     return applyBlindSpotInsert(rootDir, opts.entries, opts);
    case 'prune':      return applyBlindSpotPrune(rootDir, opts.entries, opts);
    case 're-analyze': return applyBlindSpotReanalyze(rootDir, opts.entries, opts);
    default:
      return envelope({
        ok: false,
        reason: 'invalid-kind',
        text: 'Blind-spot commit kind must be "insert" | "prune" | "re-analyze" (got "' + opts.entries.kind + '").'
      });
  }
}

function formatPlan(result) {
  if (result && result.text) return result.text;
  return '(no plan text)';
}

function formatCommit(result) {
  if (result && result.text) return result.text;
  return '(no commit text)';
}

module.exports = {
  CATEGORIES,
  CATEGORY_KEYS,
  CATEGORY_SET,
  INSERTED_NODE_BASE_FIELDS,
  INSERTED_LEAF_EXTRA_FIELDS,
  INSERTED_MILESTONE_EXTRA_FIELDS,
  INBOX_HEADER_NA,
  INBOX_HEADER_PRUNED,
  buildBlindSpotTurn,
  buildBlindSpotInsertTurn,
  buildBlindSpotPruneTurn,
  applyBlindSpotInsert,
  applyBlindSpotPrune,
  applyBlindSpotReanalyze,
  runBlindSpot,
  formatPlan,
  formatCommit,
  validateInsertedNode,
  validateNaCategory,
  findInsertedNodes,
  isPostInsert,
  detachNode,
  writeInboxNa,
  writeInboxPruned
};
