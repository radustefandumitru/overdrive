'use strict';

const fs = require('fs');
const path = require('path');

const fsHelpers = require('./fs');

const TABLE_HEADER = '| Date | Node | Decision | Rationale |';
const TABLE_DIVIDER = '|---|---|---|---|';

// Divider lines vary slightly in spec writers (':--', '---', etc.). Accept any
// pipe-delimited line whose interior characters are only -, :, |, or whitespace.
const DIVIDER_PATTERN = /^\|[\s\-:|]+\|\s*$/;
const ROW_PATTERN = /^\|.*\|\s*$/;

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function decisionsPath(rootDir) {
  return fsHelpers.ovdPath(rootDir, 'decisions.md');
}

function escapeCell(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>');
}

function buildRow({ date, node, decision, rationale }) {
  return `| ${escapeCell(date || todayDate())} | ${escapeCell(node)} | ${escapeCell(decision)} | ${escapeCell(rationale)} |`;
}

function buildPlaceholderWithFirstRow(row) {
  return [
    '# Decisions',
    '',
    'Append-only log of decisions made during planning and execution.',
    '',
    TABLE_HEADER,
    TABLE_DIVIDER,
    row,
    ''
  ].join('\n');
}

function findTableSpan(lines) {
  const dividerIdx = lines.findIndex((line) => DIVIDER_PATTERN.test(line));
  if (dividerIdx === -1) return null;
  let endIdx = dividerIdx;
  for (let i = dividerIdx + 1; i < lines.length; i++) {
    if (ROW_PATTERN.test(lines[i])) {
      endIdx = i;
    } else {
      break;
    }
  }
  return { dividerIdx, endIdx };
}

function parseRow(line) {
  // Strip leading/trailing | and split on un-escaped pipes.
  const interior = line.replace(/^\|\s*/, '').replace(/\s*\|\s*$/, '');
  const cells = interior
    .split(/(?<!\\)\|/)
    .map((cell) =>
      cell
        .trim()
        .replace(/\\\|/g, '|')
        .replace(/<br>/g, '\n')
    );
  if (cells.length !== 4) return null;
  return { date: cells[0], node: cells[1], decision: cells[2], rationale: cells[3] };
}

function appendDecision(rootDir, entry = {}) {
  if (!rootDir) {
    return { ok: false, reason: 'no rootDir resolved' };
  }
  if (!entry || typeof entry.decision !== 'string' || entry.decision.length === 0) {
    return { ok: false, reason: 'entry.decision is required (non-empty string)' };
  }

  const resolvedRoot = path.resolve(rootDir);
  const filePath = decisionsPath(resolvedRoot);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const row = buildRow(entry);

  let content = '';
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, 'utf8');
  }

  if (content.trim().length === 0) {
    const result = buildPlaceholderWithFirstRow(row);
    fs.writeFileSync(filePath, result);
    return { ok: true, path: filePath, action: 'created', row, totalRows: 1 };
  }

  const lines = content.split(/\r?\n/);
  const span = findTableSpan(lines);

  if (!span) {
    const trailing = content.endsWith('\n') ? '' : '\n';
    const result = `${content}${trailing}\n${TABLE_HEADER}\n${TABLE_DIVIDER}\n${row}\n`;
    fs.writeFileSync(filePath, result);
    return { ok: true, path: filePath, action: 'table-appended', row, totalRows: 1 };
  }

  const { dividerIdx, endIdx } = span;
  const updatedLines = [
    ...lines.slice(0, endIdx + 1),
    row,
    ...lines.slice(endIdx + 1)
  ];
  fs.writeFileSync(filePath, updatedLines.join('\n'));
  const totalRows = endIdx + 1 - dividerIdx;
  return { ok: true, path: filePath, action: 'appended', row, totalRows };
}

function readDecisions(rootDir) {
  if (!rootDir) return { ok: false, reason: 'no rootDir resolved', rows: [] };
  const resolvedRoot = path.resolve(rootDir);
  const filePath = decisionsPath(resolvedRoot);
  if (!fs.existsSync(filePath)) {
    return { ok: true, path: filePath, exists: false, rows: [] };
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const span = findTableSpan(lines);
  if (!span) {
    return { ok: true, path: filePath, exists: true, rows: [] };
  }
  const rows = [];
  for (let i = span.dividerIdx + 1; i <= span.endIdx; i++) {
    const parsed = parseRow(lines[i]);
    if (parsed) rows.push(parsed);
  }
  return { ok: true, path: filePath, exists: true, rows };
}

module.exports = {
  TABLE_HEADER,
  TABLE_DIVIDER,
  DIVIDER_PATTERN,
  ROW_PATTERN,
  todayDate,
  decisionsPath,
  escapeCell,
  buildRow,
  buildPlaceholderWithFirstRow,
  findTableSpan,
  parseRow,
  appendDecision,
  readDecisions
};
