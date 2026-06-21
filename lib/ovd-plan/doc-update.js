'use strict';

// Task 5.7 — runDocUpdate: surgical doc propagation  (r3 §4.4, §7.6 step 4)
//
// Pattern-1 dispatch. PLAN emits the change context + a conservative candidate-
// doc list and instructs the agent to use the `doc-coauthoring` skill to pick
// the exact sections; COMMIT persists the agent's section diffs via --entries-
// json. Writes are SURGICAL — only the named section's body changes; every other
// section is preserved verbatim (sibling of Phase 2's discovered-section
// preservation). Never full-regenerates.
//
// Action-path threshold (Q5.3): a change is non-trivial when it touches >1
// section OR >50 net lines OR any load-bearing doc. Non-trivial changes return a
// preview prompt (Pattern 7 numbered options) and write nothing until the caller
// re-invokes with confirm; trivial changes apply silently. Per-section review is
// the agent re-invoking with `only` indices (stateless CLI — Pattern 1).
//
// Also the EDIT→DOC-UPDATE dependency (Q3.6.1): Task 3.6 wires this via
// runDocUpdate(rootDir, { changedNodes }).

const fs = require('fs');
const path = require('path');

const STATUS = 'doc-update';

// Q5.3 locked allow-list. No fuzzy matching — exact relative paths + a
// `load_bearing: true` frontmatter escape hatch.
const LOAD_BEARING_DOCS = [
  path.join('.overdrive', 'codebase', 'architecture.md'),
  path.join('.overdrive', 'codebase', 'patterns.md'),
  path.join('.overdrive', 'codebase', 'tech-stack.md'),
  'README.md'
];

const TRIVIAL_LINE_LIMIT = 50;

function normRel(p) {
  return String(p).split(/[\\/]/).join('/');
}

function isSafeDocPath(doc) {
  if (typeof doc !== 'string' || !doc.trim()) return false;
  if (path.isAbsolute(doc)) return false;
  const norm = path.normalize(doc);
  if (norm === '..' || norm.startsWith('..' + path.sep) || norm.startsWith('../')) return false;
  return true;
}

function isLoadBearingDoc(rootDir, docRel) {
  const norm = normRel(docRel);
  if (LOAD_BEARING_DOCS.some((d) => normRel(d) === norm)) return true;
  try {
    const content = fs.readFileSync(path.join(rootDir, docRel), 'utf8');
    const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (fm && /(^|\n)\s*load_bearing\s*:\s*true\s*(\r?\n|$)/i.test(fm[1])) return true;
  } catch (_) { /* missing/unreadable → not load-bearing */ }
  return false;
}

// ---------------------------------------------------------------------------
// Surgical section write (replace, not append — sibling of migrate.appendUnderHeader)
// ---------------------------------------------------------------------------
function findSection(lines, heading) {
  const esc = String(heading).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^(#{2,6})\\s+${esc}\\s*$`, 'i');
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(re);
    if (m) return { idx: i, level: m[1].length };
  }
  return { idx: -1, level: 2 };
}

function sectionEnd(lines, startIdx, level) {
  for (let i = startIdx + 1; i < lines.length; i += 1) {
    const hm = lines[i].match(/^(#{1,6})\s+/);
    if (hm && hm[1].length <= level) return i;
  }
  return lines.length;
}

function replaceOrAppendSection(content, heading, body) {
  const lines = String(content === undefined || content === null ? '' : content).split(/\r?\n/);
  const { idx, level } = findSection(lines, heading);
  const newBody = String(body === undefined || body === null ? '' : body).replace(/\s+$/, '');

  if (idx === -1) {
    const trimmed = String(content || '').replace(/\s+$/, '');
    const sep = trimmed ? '\n\n' : '';
    return `${trimmed}${sep}## ${heading}\n\n${newBody}\n`;
  }
  const end = sectionEnd(lines, idx, level);
  const head = lines.slice(0, idx + 1).join('\n');
  const tail = end < lines.length ? lines.slice(end).join('\n') : '';
  const section = `${head}\n\n${newBody}\n`;
  return tail ? `${section}\n${tail}` : section;
}

function sectionBodyLineCount(content, heading) {
  const lines = String(content).split(/\r?\n/);
  const { idx, level } = findSection(lines, heading);
  if (idx === -1) return 0;
  const end = sectionEnd(lines, idx, level);
  return lines.slice(idx + 1, end).filter((l) => l.trim()).length;
}

// ---------------------------------------------------------------------------
// PLAN
// ---------------------------------------------------------------------------
function normalizeChanges(opts) {
  if (Array.isArray(opts.changes)) return opts.changes.filter((c) => c && typeof c === 'object');
  if (Array.isArray(opts.changedNodes)) return opts.changedNodes.map((id) => ({ summary: `change in ${id}`, nodes: [id] }));
  return [];
}

function listCandidateDocs(rootDir) {
  // Conservative (FM #5 — don't over-flag): existing codebase docs + root README.
  const out = [];
  const codebaseDir = path.join(rootDir, '.overdrive', 'codebase');
  try {
    for (const f of fs.readdirSync(codebaseDir).sort()) {
      if (f.endsWith('.md')) out.push(path.join('.overdrive', 'codebase', f));
    }
  } catch (_) { /* no codebase dir */ }
  if (fs.existsSync(path.join(rootDir, 'README.md'))) out.push('README.md');
  return out;
}

function buildDocUpdatePlan(rootDir, opts = {}) {
  const changes = normalizeChanges(opts);
  const candidate_docs = listCandidateDocs(rootDir);
  const lines = [];
  lines.push('DOC UPDATE — surgical propagation (r3 §4.4). Identify the exact doc sections affected by these changes; do NOT regenerate whole files.');
  lines.push('');
  lines.push('Changes:');
  if (changes.length) {
    for (const c of changes) lines.push(`  - ${c.summary || '(change)'}${c.nodes && c.nodes.length ? ` [${c.nodes.join(', ')}]` : ''}`);
  } else {
    lines.push('  (none specified)');
  }
  lines.push('');
  lines.push('Candidate docs:');
  if (candidate_docs.length) {
    for (const d of candidate_docs) lines.push(`  - ${d}`);
  } else {
    lines.push('  (no project docs found under .overdrive/codebase/)');
  }
  lines.push('');
  lines.push('Use the `doc-coauthoring` skill to identify the precise sections needing change, then re-invoke with --entries-json:');
  lines.push('  { "updates": [ { "doc": "<rel path>", "heading": "<section title>", "body": "<new section content>" } ] }');
  lines.push('');
  lines.push('Be conservative — include only sections that actually need updating; do not touch unrelated docs.');
  return { ok: true, status: STATUS, mode: 'plan', candidate_docs, changes, text: lines.join('\n') };
}

// ---------------------------------------------------------------------------
// COMMIT
// ---------------------------------------------------------------------------
function normalizeDocUpdateEntries(entries) {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return { ok: false, reason: 'invalid-entries', text: 'doc-update commit requires a JSON object.' };
  }
  if (!Array.isArray(entries.updates) || entries.updates.length === 0) {
    return { ok: false, reason: 'no-updates', text: 'doc-update requires a non-empty updates[].' };
  }
  const updates = [];
  for (const u of entries.updates) {
    if (!u || typeof u !== 'object' || Array.isArray(u)) return { ok: false, reason: 'invalid-update', text: 'each update must be an object { doc, heading, body }.' };
    if (!isSafeDocPath(u.doc)) return { ok: false, reason: 'invalid-doc-path', text: `update.doc must be a safe relative path (got "${u.doc}").` };
    if (typeof u.heading !== 'string' || !u.heading.trim()) return { ok: false, reason: 'missing-heading', text: 'each update requires a non-empty heading.' };
    updates.push({ doc: u.doc.trim(), heading: u.heading.trim(), body: typeof u.body === 'string' ? u.body : '' });
  }
  return { ok: true, updates };
}

function computeTriviality(rootDir, updates) {
  let netLines = 0;
  const loadBearingDocs = [];
  for (const u of updates) {
    if (isLoadBearingDoc(rootDir, u.doc) && !loadBearingDocs.includes(u.doc)) loadBearingDocs.push(u.doc);
    let old = 0;
    try { old = sectionBodyLineCount(fs.readFileSync(path.join(rootDir, u.doc), 'utf8'), u.heading); } catch (_) { old = 0; }
    const neu = String(u.body).split(/\r?\n/).filter((l) => l.trim()).length;
    netLines += Math.abs(neu - old);
  }
  const sectionCount = updates.length;
  const trivial = sectionCount <= 1 && netLines <= TRIVIAL_LINE_LIMIT && loadBearingDocs.length === 0;
  return { trivial, sectionCount, netLines, loadBearingDocs };
}

function renderPreview(updates, triv) {
  const docList = [...new Set(updates.map((u) => u.doc))];
  const lines = [];
  lines.push(
    `DOC UPDATE: ${updates.length} section(s) across ${docList.length} doc(s) proposed for change` +
    (triv.loadBearingDocs.length ? ` (load-bearing: ${triv.loadBearingDocs.join(', ')})` : '') + '.'
  );
  lines.push('');
  for (const u of updates) lines.push(`  - ${u.doc} › ${u.heading}`);
  lines.push('');
  lines.push('  (1) apply all — write every proposed section.');
  lines.push('  (2) review per-section — re-invoke with --entries-json carrying only the sections you approve.');
  lines.push('  (3) skip — make no doc changes; the change stays captured in the session file.');
  lines.push('  (4) other — describe what you want.');
  return lines.join('\n');
}

function applyDocUpdate(rootDir, entries, opts = {}) {
  const norm = normalizeDocUpdateEntries(entries);
  if (!norm.ok) return { ok: false, status: STATUS, mode: 'commit', reason: norm.reason, text: norm.text };

  let updates = norm.updates;
  if (Array.isArray(opts.only)) updates = opts.only.map((i) => norm.updates[i]).filter(Boolean);
  if (updates.length === 0) return { ok: false, status: STATUS, mode: 'commit', reason: 'no-updates-selected', text: 'No updates selected.' };

  const triviality = computeTriviality(rootDir, updates);
  if (!triviality.trivial && !opts.confirm) {
    return {
      ok: true,
      status: STATUS,
      mode: 'doc-update-preview',
      needs_confirm: true,
      triviality,
      updates: updates.map((u) => ({ doc: u.doc, heading: u.heading })),
      text: renderPreview(updates, triviality)
    };
  }

  const written = [];
  const skipped = [];
  for (const u of updates) {
    const full = path.join(rootDir, u.doc);
    let content = '';
    try { content = fs.readFileSync(full, 'utf8'); } catch (_) { content = ''; }
    const updated = replaceOrAppendSection(content, u.heading, u.body);
    try {
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, updated);
      written.push(`${u.doc} › ${u.heading}`);
    } catch (err) {
      skipped.push({ doc: u.doc, heading: u.heading, reason: err.message });
    }
  }
  return {
    ok: true,
    status: STATUS,
    mode: 'doc-update-applied',
    written,
    skipped,
    triviality,
    text: `Updated ${written.length} doc section(s): ${written.join(', ') || '(none)'}.` + (skipped.length ? ` Skipped ${skipped.length}.` : '')
  };
}

function runDocUpdate(rootDir, opts = {}) {
  if (!rootDir || typeof rootDir !== 'string') {
    return { ok: false, status: STATUS, reason: 'invalid-project-dir', text: 'runDocUpdate requires a project directory string.' };
  }
  const mode = opts.mode || (opts.entries ? 'commit' : 'plan');
  if (mode === 'commit') return applyDocUpdate(rootDir, opts.entries, opts);
  return buildDocUpdatePlan(rootDir, opts);
}

module.exports = {
  STATUS,
  LOAD_BEARING_DOCS,
  TRIVIAL_LINE_LIMIT,
  isSafeDocPath,
  isLoadBearingDoc,
  replaceOrAppendSection,
  sectionBodyLineCount,
  buildDocUpdatePlan,
  normalizeDocUpdateEntries,
  computeTriviality,
  applyDocUpdate,
  runDocUpdate
};
