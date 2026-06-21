'use strict';

// Task 5.3 — /ovd-log capture "text"  (r3 §7.2, §7.3)
//
// Timestamped append to the *current* session file (or a new one if none).
// Zero analysis, zero interruption. CAPTURE is NOT a Pattern-1 dispatch — the
// CLI writes the literal user text directly; no agent reasoning, no LLM call.
//
// Session files live at .overdrive/sessions/YYYY-MM-DD-HH-MM.md (r3 §7.1) — a
// minute-precision plain timestamp that is deliberately distinct from the
// ISO-safe sub-files (`<iso>-research-…`, `<iso>-execute-…`, etc.) and from
// Phase 2 migration artifacts. `findCurrentSessionFile` therefore ignores
// everything that isn't a plain log-session file (migration-compat seam).
//
// The session-file primitives below (formatStamp / findCurrentSessionFile /
// appendSessionEntry) are exported for reuse by Task 5.1 DEFAULT so the
// session-file shape is defined in exactly one place (Pattern 2 — no fork).

const fs = require('fs');
const path = require('path');

const { ovdPath } = require('./fs');

const STATUS = 'captured';

// Plain log-session filename: YYYY-MM-DD-HH-MM.md (minute precision, no `T`,
// no seconds, no kind infix). Anchored so sub-files / legacy files don't match.
const LOG_SESSION_PATTERN = /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}\.md$/;

function nowIso(opts) {
  return (opts && opts.now) || new Date().toISOString();
}

// Derive both the filename stamp and the human display stamp from one ISO
// instant, formatted in UTC so behavior is deterministic across timezones.
function formatStamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`formatStamp: invalid ISO timestamp: ${iso}`);
  const yyyy = String(d.getUTCFullYear()).padStart(4, '0');
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  return { file: `${yyyy}-${mo}-${dd}-${hh}-${mi}`, display: `${yyyy}-${mo}-${dd} ${hh}:${mi}` };
}

function sessionsDir(rootDir) {
  return ovdPath(rootDir, 'sessions');
}

// Newest plain log-session file (absolute path), or null. Sub-files and legacy
// artifacts are excluded by LOG_SESSION_PATTERN.
function findCurrentSessionFile(rootDir) {
  const dir = sessionsDir(rootDir);
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw err;
  }
  const sessions = names.filter((n) => LOG_SESSION_PATTERN.test(n)).sort();
  if (sessions.length === 0) return null;
  return path.join(dir, sessions[sessions.length - 1]);
}

function relSessionPath(rootDir, absFile) {
  return path.relative(rootDir, absFile);
}

// Resolve the current session file, creating one (with header) if none exists.
// Shared primitive: CAPTURE appends `[stamp] text` lines under `## Activity log`;
// Task 5.1 DEFAULT appends a structured `## Save <stamp>` block to the SAME file.
// Defining find-or-create once keeps the session-file shape in one place (Pattern 2).
function ensureSessionFile(rootDir, opts = {}) {
  const dir = sessionsDir(rootDir);
  fs.mkdirSync(dir, { recursive: true });
  const existing = findCurrentSessionFile(rootDir);
  if (existing) return { file: existing, rel: relSessionPath(rootDir, existing), created: false };
  const stamp = formatStamp(nowIso(opts));
  const target = path.join(dir, `${stamp.file}.md`);
  const header = `# Session ${stamp.display}\n\n## Activity log\n\n`;
  fs.writeFileSync(target, header);
  return { file: target, rel: relSessionPath(rootDir, target), created: true };
}

// Core primitive: append `[display] text` to the current session file, creating
// one (with header) if none exists. Atomic append — fs.appendFileSync, never a
// read-modify-write. Returns { ok, file (absolute), rel, created, entry }.
function appendSessionEntry(rootDir, text, opts = {}) {
  const trimmed = String(text === undefined || text === null ? '' : text).trim();
  if (!trimmed) return { ok: false, reason: 'capture text is empty' };

  const { display } = formatStamp(nowIso(opts));
  const entry = `[${display}] ${trimmed}\n`;

  const { file, rel, created } = ensureSessionFile(rootDir, opts);
  fs.appendFileSync(file, entry);

  return { ok: true, file, rel, created, entry: entry.replace(/\n$/, '') };
}

// Handler: /ovd-log capture "text".
function runLogCapture(rootDir, text, opts = {}) {
  const res = appendSessionEntry(rootDir, text, opts);
  if (!res.ok) return { ok: false, status: STATUS, reason: res.reason };
  return {
    ok: true,
    status: STATUS,
    file: res.rel,
    created: res.created,
    entry: res.entry
  };
}

module.exports = {
  STATUS,
  LOG_SESSION_PATTERN,
  formatStamp,
  sessionsDir,
  findCurrentSessionFile,
  ensureSessionFile,
  appendSessionEntry,
  runLogCapture
};
