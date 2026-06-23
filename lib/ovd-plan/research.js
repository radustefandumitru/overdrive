'use strict';

const fs = require('fs');
const path = require('path');

const { openState, commitState } = require('./deliberation-state');
const { findNodeById } = require('./cache');
const { readCalibration } = require('./calibrate');
const { appendUnderHeader } = require('./migrate');
const { truncateAtWordBoundary } = require('./idea');
const { ovdPath } = require('./fs');

const STATUS = 'research';
const KINDS = ['one-liner', 'substantive'];
const NEXT_ACTIONS = ['edit', 'handoff', null];

const SESSIONS_REL = path.join('.overdrive', 'sessions');
const CODEBASE_REL = path.join('.overdrive', 'codebase');

const INBOX_HEADER_RESEARCH = 'Research findings (lightweight)';

// Topic truncation for inbox entries (one-liner kind). Mirrors IDEA's 80-char
// word-boundary truncation — Pattern 3 reuse across modules per Q3.7 refinement.
const INBOX_TOPIC_MAX_LEN = 60;

// Slug max length when synthesizing from topic. Keeps filenames manageable
// while preserving enough context to scan a sessions/ listing.
const SLUG_MAX_LEN = 40;

// Agent-supplied slug must match this pattern (no slashes, no special chars,
// no leading/trailing hyphens).
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

function envelope(payload) {
  return Object.assign({ status: STATUS }, payload);
}

function nowIso(opts) {
  return (opts && opts.now) || new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Slug synthesis (Q3.7.2: agent override + auto-default)
// ---------------------------------------------------------------------------

function synthesizeSlug(text) {
  const norm = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!norm) return 'untitled';
  const truncated = truncateAtWordBoundary(norm.replace(/-/g, ' '), SLUG_MAX_LEN)
    .replace(/[…\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return truncated || 'untitled';
}

function validateSlug(slug) {
  if (typeof slug !== 'string') return 'slug must be a string';
  if (!slug.trim()) return 'slug must be non-empty';
  if (slug.length > SLUG_MAX_LEN) return `slug must be ≤ ${SLUG_MAX_LEN} chars (got ${slug.length})`;
  if (!SLUG_PATTERN.test(slug)) return 'slug must be lowercase alphanumeric + hyphens, no leading/trailing hyphens';
  return null;
}

// Filesystem-safe ISO timestamp: replace `:` with `-` so the filename works on
// Windows + matches reentry.js's SESSIONS_REL convention.
function isoToFilenameSafe(iso) {
  return String(iso).replace(/:/g, '-');
}

// ---------------------------------------------------------------------------
// Codebase context loading (precedent: codebase-mapper.js per-file pattern)
// ---------------------------------------------------------------------------

function loadCodebaseContext(rootDir) {
  const patternsPath = path.join(rootDir, CODEBASE_REL, 'patterns.md');
  const techStackPath = path.join(rootDir, CODEBASE_REL, 'tech-stack.md');
  const out = { patterns: null, techStack: null, present: false };
  try {
    if (fs.existsSync(patternsPath)) {
      out.patterns = fs.readFileSync(patternsPath, 'utf8');
    }
  } catch (_err) {
    out.patterns = null;
  }
  try {
    if (fs.existsSync(techStackPath)) {
      out.techStack = fs.readFileSync(techStackPath, 'utf8');
    }
  } catch (_err) {
    out.techStack = null;
  }
  out.present = !!(out.patterns || out.techStack);
  return out;
}

// ---------------------------------------------------------------------------
// Plan-mode (emits topic + codebase context + tools reference + commit syntax)
// ---------------------------------------------------------------------------

function buildResearchPlan(rootDir, opts = {}) {
  const topic = (opts.text || '').trim();
  if (!topic) {
    return envelope({
      ok: false,
      mode: 'plan',
      reason: 'missing-topic',
      text: 'Research topic is required. Invocation: overdrive plan research "<your topic>".'
    });
  }

  let calibration = null;
  try {
    calibration = readCalibration(rootDir);
  } catch (_err) {
    calibration = null;
  }

  const codebaseCtx = loadCodebaseContext(rootDir);

  const lines = [];
  lines.push(`RESEARCH — focused investigation (per r3 §5.5)`);
  lines.push('='.repeat(45));
  lines.push('');
  lines.push(`Topic: ${topic}`);
  lines.push('');

  if (calibration) {
    lines.push('Calibration:');
    if (calibration.domain) lines.push(`  domain: ${calibration.domain}`);
    if (calibration.technical) lines.push(`  technical: ${calibration.technical}`);
    if (calibration.scope) lines.push(`  scope: ${calibration.scope}`);
    if (calibration.override) lines.push(`  override: ${calibration.override}`);
    lines.push('');
  }

  if (codebaseCtx.present) {
    lines.push('Codebase context (ground claims against these when relevant):');
    if (codebaseCtx.patterns) lines.push(`  - .overdrive/codebase/patterns.md (${codebaseCtx.patterns.length} chars)`);
    if (codebaseCtx.techStack) lines.push(`  - .overdrive/codebase/tech-stack.md (${codebaseCtx.techStack.length} chars)`);
    lines.push('');
  } else {
    lines.push('No codebase context available — run /ovd-workflow map first for repo-grounded research.');
    lines.push('(Domain-only topics can still proceed without it.)');
    lines.push('');
  }

  lines.push('Tools the agent should use:');
  lines.push('  - Context7 MCP for library/framework/SDK/API docs (current versions, not training-data drift).');
  lines.push('  - WebSearch / WebFetch for general web research, RFCs, blog posts, etc.');
  lines.push('  - Read for the codebase context above when grounding claims.');
  lines.push('  - Cite sources verbatim (URL or "Context7: <library>" or "<repo>:<file>:<line>") in the sources field.');
  lines.push('');
  lines.push('Output classification (Q3.7 hybrid output lock):');
  lines.push('  - "one-liner" → a single sentence or short paragraph; goes to the inbox section.');
  lines.push('  - "substantive" → multi-section findings; written to .overdrive/sessions/<ISO timestamp>-research-<slug>.md.');
  lines.push('');
  lines.push('After commit, recommended next actions (per r3 §5.5):');
  lines.push('  - /ovd-plan edit — integrate findings into the plan (continue this session).');
  lines.push('  - /ovd-log handoff — save state and end session (next session resumes with /ovd-plan edit).');
  lines.push('  - /ovd-plan idea "<follow-up>" — deliberate a new angle from the findings.');
  lines.push('  Agent may set entries.next_action ∈ {edit, handoff, null} to recommend one — the user still sees all three.');
  lines.push('');
  lines.push('Commit syntax — substantive:');
  lines.push('  overdrive plan research --entries-json \'{"topic":"...","kind":"substantive","findings":"...","sources":["..."],"next_action":"edit"}\'');
  lines.push('  Optional: add "attach_to_leaf":"<node-id>" to bind the findings FILE to that leaf\'s references.research[]');
  lines.push('  (a pointer, not a paste). The leaf surfaces the findings at /ovd-go execution. Substantive only.');
  lines.push('Commit syntax — one-liner:');
  lines.push('  overdrive plan research --entries-json \'{"topic":"...","kind":"one-liner","findings":"...","next_action":null}\'');

  return envelope({
    ok: true,
    mode: 'plan',
    topic,
    calibration,
    codebase_context_present: codebaseCtx.present,
    text: lines.join('\n')
  });
}

// ---------------------------------------------------------------------------
// Pattern 4 validation
// ---------------------------------------------------------------------------

function normalizeResearchEntries(rawEntries) {
  if (!rawEntries || typeof rawEntries !== 'object' || Array.isArray(rawEntries)) {
    return {
      ok: false,
      reason: 'invalid-shape',
      errors: ['entries must be a JSON object with at least { topic, kind, findings }']
    };
  }

  const errors = [];
  const out = {};

  if (typeof rawEntries.topic !== 'string' || !rawEntries.topic.trim()) {
    errors.push('topic must be a non-empty string');
  } else {
    out.topic = rawEntries.topic.trim();
  }

  if (!KINDS.includes(rawEntries.kind)) {
    errors.push(`kind must be one of: ${KINDS.join(', ')} (got "${rawEntries.kind}")`);
  } else {
    out.kind = rawEntries.kind;
  }

  if (typeof rawEntries.findings !== 'string' || !rawEntries.findings.trim()) {
    errors.push('findings must be a non-empty string');
  } else {
    out.findings = rawEntries.findings.trim();
  }

  if (rawEntries.slug !== undefined) {
    const err = validateSlug(rawEntries.slug);
    if (err) errors.push(`slug: ${err}`);
    else out.slug = rawEntries.slug;
  }

  if (rawEntries.sources !== undefined) {
    if (!Array.isArray(rawEntries.sources)) {
      errors.push('sources must be an array when provided');
    } else {
      const cleanSources = [];
      for (let i = 0; i < rawEntries.sources.length; i++) {
        const src = rawEntries.sources[i];
        if (typeof src !== 'string' || !src.trim()) {
          errors.push(`sources[${i}] must be a non-empty string`);
        } else {
          cleanSources.push(src.trim());
        }
      }
      if (cleanSources.length > 0) out.sources = cleanSources;
    }
  }

  if (rawEntries.next_action !== undefined) {
    if (rawEntries.next_action !== null && typeof rawEntries.next_action !== 'string') {
      errors.push('next_action must be string or null');
    } else if (!NEXT_ACTIONS.includes(rawEntries.next_action)) {
      errors.push(`next_action must be one of: ${NEXT_ACTIONS.map((a) => String(a)).join(', ')} (got "${rawEntries.next_action}")`);
    } else {
      out.next_action = rawEntries.next_action;
    }
  }

  // FU-2 (2026-06-23): optional attach_to_leaf binds the findings FILE to a leaf
  // via references.research[] (a pointer, not a paste). Substantive only — one-liners
  // have no file to point at and stay in the inbox.
  if (rawEntries.attach_to_leaf !== undefined && rawEntries.attach_to_leaf !== null) {
    if (typeof rawEntries.attach_to_leaf !== 'string' || !rawEntries.attach_to_leaf.trim()) {
      errors.push('attach_to_leaf must be a non-empty string node id when provided');
    } else if (rawEntries.kind === 'one-liner') {
      errors.push('attach_to_leaf is only valid for kind="substantive" (one-liners stay in the inbox)');
    } else {
      out.attach_to_leaf = rawEntries.attach_to_leaf.trim();
    }
  }

  if (errors.length > 0) {
    return { ok: false, reason: 'invalid-values', errors };
  }
  return { ok: true, entries: out };
}

// ---------------------------------------------------------------------------
// Apply — substantive findings → .overdrive/sessions/<ts>-research-<slug>.md
// ---------------------------------------------------------------------------

function buildSessionsFilename(now, slug) {
  return `${isoToFilenameSafe(now)}-research-${slug}.md`;
}

function buildSubstantiveFileBody(entries, now) {
  const lines = [];
  lines.push('---');
  lines.push('kind: research');
  lines.push(`topic: ${JSON.stringify(entries.topic)}`);
  if (entries.sources && entries.sources.length > 0) {
    lines.push('sources:');
    for (const s of entries.sources) lines.push(`  - ${JSON.stringify(s)}`);
  }
  lines.push(`generated_at: ${now}`);
  lines.push('---');
  lines.push('');
  lines.push(`# Research: ${entries.topic}`);
  lines.push('');
  lines.push(entries.findings);
  if (!entries.findings.endsWith('\n')) lines.push('');
  return lines.join('\n');
}

function applyResearchSubstantive(rootDir, entries, opts = {}) {
  const now = nowIso(opts);
  const slug = entries.slug || synthesizeSlug(entries.topic);
  const filename = buildSessionsFilename(now, slug);
  const sessionsDir = path.join(rootDir, SESSIONS_REL);
  const relPath = path.join(SESSIONS_REL, filename);

  // FU-2: if attaching to a leaf, validate the target BEFORE writing anything so a
  // bad node id never orphans a findings file. Uses the committed-tree round-trip
  // (openState → mutate → commitState — Pattern 2, no fork).
  let opened = null;
  let targetNode = null;
  if (entries.attach_to_leaf) {
    opened = openState(rootDir);
    if (!opened.ok) {
      return envelope({ ok: false, mode: 'commit', kind: 'substantive', reason: opened.reason, text: opened.text });
    }
    const found = findNodeById(opened.parsed.tree, entries.attach_to_leaf);
    if (!found) {
      return envelope({ ok: false, mode: 'commit', kind: 'substantive', reason: 'attach-leaf-not-found', text: `attach_to_leaf "${entries.attach_to_leaf}" not found in OVERDRIVE.md.` });
    }
    if (found.node.children && found.node.children.length > 0) {
      return envelope({ ok: false, mode: 'commit', kind: 'substantive', reason: 'attach-not-a-leaf', text: `attach_to_leaf "${entries.attach_to_leaf}" is a container, not a leaf — research attaches to leaves.` });
    }
    targetNode = found.node;
  }

  try {
    fs.mkdirSync(sessionsDir, { recursive: true });
  } catch (err) {
    return envelope({
      ok: false, mode: 'commit', kind: 'substantive',
      reason: 'mkdir-failed',
      text: `Could not create ${SESSIONS_REL}: ${err.message}`
    });
  }

  const filePath = path.join(sessionsDir, filename);
  const body = buildSubstantiveFileBody(entries, now);

  try {
    fs.writeFileSync(filePath, body);
  } catch (err) {
    return envelope({
      ok: false, mode: 'commit', kind: 'substantive',
      reason: 'write-failed',
      text: `Could not write ${filePath}: ${err.message}`
    });
  }

  // FU-2: bind the file path into the leaf's references.research[] (pointer, not
  // paste — keeps OVERDRIVE.md lean; findings live in their file).
  let attached_to = null;
  if (targetNode) {
    if (!targetNode.annotations || typeof targetNode.annotations !== 'object') targetNode.annotations = {};
    const refs = (targetNode.annotations.references && typeof targetNode.annotations.references === 'object')
      ? targetNode.annotations.references : {};
    if (!Array.isArray(refs.research)) refs.research = [];
    refs.research.push(relPath);
    targetNode.annotations.references = refs;
    const committed = commitState(rootDir, opened);
    if (!committed.ok) {
      return envelope({ ok: false, mode: 'commit', kind: 'substantive', reason: committed.reason, text: `Findings written to ${relPath}, but attaching to ${entries.attach_to_leaf} failed: ${committed.text}` });
    }
    attached_to = entries.attach_to_leaf;
  }

  const text = renderApplySummary(entries, {
    kind: 'substantive',
    filePath,
    relPath,
    slug,
    attached_to
  });

  return envelope({
    ok: true, mode: 'commit', kind: 'substantive', applied: true,
    topic: entries.topic,
    slug,
    sessions_path: filePath,
    sessions_rel: relPath,
    attached_to,
    next_action: entries.next_action || null,
    text
  });
}

// ---------------------------------------------------------------------------
// Apply — one-liner → inbox section
// ---------------------------------------------------------------------------

function applyResearchOneLiner(rootDir, entries, opts = {}) {
  const opened = openState(rootDir);
  if (!opened.ok) {
    return envelope({
      ok: false, mode: 'commit', kind: 'one-liner',
      reason: opened.reason, text: opened.text
    });
  }

  const now = nowIso(opts);
  // Truncate topic + sanitize newlines for a single inbox line. Reuses
  // IDEA's word-boundary truncation per Q3.7 refinement.
  const safeTopic = truncateAtWordBoundary(
    entries.topic.replace(/\s+/g, ' '),
    INBOX_TOPIC_MAX_LEN
  );
  const safeFindings = entries.findings.replace(/[\r\n]+/g, ' ');
  const bodyLine = `- [research: ${safeTopic}] ${safeFindings} (${now})`;

  opened.sections.inbox = appendUnderHeader(
    opened.sections.inbox || '',
    INBOX_HEADER_RESEARCH,
    bodyLine
  );

  const committed = commitState(rootDir, opened);
  if (!committed.ok) {
    return envelope({
      ok: false, mode: 'commit', kind: 'one-liner',
      reason: committed.reason, text: committed.text
    });
  }

  const text = renderApplySummary(entries, {
    kind: 'one-liner',
    inboxHeader: INBOX_HEADER_RESEARCH,
    truncatedTopic: safeTopic
  });

  return envelope({
    ok: true, mode: 'commit', kind: 'one-liner', applied: true,
    topic: entries.topic,
    inbox_header: INBOX_HEADER_RESEARCH,
    next_action: entries.next_action || null,
    text
  });
}

// ---------------------------------------------------------------------------
// Action-path render (Q3.7.4 — always emit BOTH options; next_action marker
// emphasizes one but never removes the alternative; matches r3 Principle 7)
// ---------------------------------------------------------------------------

function renderApplySummary(entries, contextSpecific) {
  const lines = [];
  if (contextSpecific.kind === 'substantive') {
    lines.push(`Research findings recorded (substantive).`);
    lines.push(`  Topic: ${entries.topic}`);
    lines.push(`  File:  ${contextSpecific.relPath}`);
    lines.push(`  Slug:  ${contextSpecific.slug}`);
    if (entries.sources && entries.sources.length > 0) {
      lines.push(`  Sources: ${entries.sources.length} cited.`);
    }
  } else {
    lines.push(`Research findings recorded (one-liner).`);
    lines.push(`  Topic: ${entries.topic}`);
    lines.push(`  Inbox header: "${contextSpecific.inboxHeader}".`);
    if (contextSpecific.truncatedTopic !== entries.topic.replace(/\s+/g, ' ')) {
      lines.push(`  (Topic truncated in inbox entry: "${contextSpecific.truncatedTopic}".)`);
    }
  }
  lines.push('');
  lines.push('Action paths (per §5 Phase 3 plan + r3 §5.5; user picks, agent may recommend):');
  const next = entries.next_action || null;
  const editMark = next === 'edit' ? ' (recommended)' : '';
  const handoffMark = next === 'handoff' ? ' (recommended)' : '';
  lines.push(`  (1) /ovd-plan edit — integrate findings into the plan (continue this session).${editMark}`);
  lines.push(`  (2) /ovd-log handoff — save state and end session (next session resumes with /ovd-plan edit).${handoffMark}`);
  lines.push(`  (3) /ovd-plan research "<refined>" — more research on the same topic or a refined angle.`);
  lines.push(`  (4) other — describe what you want (e.g., /ovd-plan idea "<follow-up>" to deliberate a new angle).`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Dispatch + orchestrator
// ---------------------------------------------------------------------------

function applyResearchFindings(rootDir, entries, opts = {}) {
  switch (entries.kind) {
    case 'substantive': return applyResearchSubstantive(rootDir, entries, opts);
    case 'one-liner': return applyResearchOneLiner(rootDir, entries, opts);
    default: return envelope({
      ok: false, mode: 'commit',
      reason: 'invalid-kind',
      text: `Unknown kind: "${entries.kind}"`
    });
  }
}

function runResearch(rootDir, opts = {}) {
  const isCommit = opts.mode === 'commit' || !!opts.entries;
  if (!isCommit) {
    return buildResearchPlan(rootDir, opts);
  }
  const normalized = normalizeResearchEntries(opts.entries);
  if (!normalized.ok) {
    return envelope({
      ok: false, mode: 'commit',
      reason: normalized.reason,
      errors: normalized.errors,
      text: `RESEARCH entries rejected: ${normalized.errors.join('; ')}`
    });
  }
  return applyResearchFindings(rootDir, normalized.entries, opts);
}

function formatPlan(result) { return (result && result.text) || '(no plan text)'; }
function formatCommit(result) { return (result && result.text) || '(no commit text)'; }

module.exports = {
  STATUS,
  KINDS,
  NEXT_ACTIONS,
  SESSIONS_REL,
  CODEBASE_REL,
  INBOX_HEADER_RESEARCH,
  INBOX_TOPIC_MAX_LEN,
  SLUG_MAX_LEN,
  SLUG_PATTERN,
  synthesizeSlug,
  validateSlug,
  isoToFilenameSafe,
  loadCodebaseContext,
  buildResearchPlan,
  normalizeResearchEntries,
  buildSessionsFilename,
  buildSubstantiveFileBody,
  applyResearchSubstantive,
  applyResearchOneLiner,
  renderApplySummary,
  applyResearchFindings,
  runResearch,
  formatPlan,
  formatCommit
};
