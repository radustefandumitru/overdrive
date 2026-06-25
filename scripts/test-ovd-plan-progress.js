#!/usr/bin/env node
'use strict';

const progress = require('../lib/ovd-plan/progress');

let passed = 0;
const failures = [];
function check(label, cond, detail) {
  if (cond) { passed += 1; }
  else { failures.push(detail ? `${label}: ${detail}` : label); console.log(`FAIL ${label}`); }
}

// --- renderBar — pure -------------------------------------------------------
{
  const line = progress.renderBar({ current: 1, total: 4, label: 'x.md', width: 4 });
  check('renderBar shows 25%', line.includes('25%'), line);
  check('renderBar shows count', line.includes('(1/4)'), line);
  check('renderBar fills one of four cells', line.includes('[#---]'), line);
  check('renderBar includes label', line.includes('x.md'), line);
}
{
  const full = progress.renderBar({ current: 4, total: 4, width: 4 });
  check('renderBar 100% fully filled', full.includes('[####]') && full.includes('100%'), full);
  const zero = progress.renderBar({ current: 0, total: 0, width: 4 });
  check('renderBar total=0 is 0% (no divide-by-zero)', zero.includes('0%'), zero);
  const longLabel = progress.renderBar({ current: 1, total: 2, label: 'a'.repeat(200), columns: 40 });
  check('renderBar truncates to columns', longLabel.length <= 40, String(longLabel.length));
}

// --- createProgress — injectable fake stream --------------------------------
function fakeStream(isTTY) { const writes = []; return { isTTY, columns: 80, write: (s) => writes.push(s), writes }; }
{
  const s = fakeStream(true);
  const p = progress.createProgress(2, { stream: s, isTty: true });
  p.tick('a'); p.tick('b');
  check('tty tick writes carriage return', s.writes.join('').includes('\r'), JSON.stringify(s.writes));
  check('tty second tick shows 100%', s.writes.join('').includes('100%'), JSON.stringify(s.writes));
  p.done('Done: 2 items');
  check('tty done prints summary', s.writes.join('').includes('Done: 2 items'), JSON.stringify(s.writes));
}
{
  const s = fakeStream(false);
  const p = progress.createProgress(2, { stream: s, isTty: false });
  p.tick('a'); p.tick('b');
  check('non-tty ticks emit NO carriage return', !s.writes.join('').includes('\r'), JSON.stringify(s.writes));
  p.done('Done: 2 items');
  check('non-tty done still prints summary', s.writes.join('').includes('Done: 2 items'), JSON.stringify(s.writes));
}

console.log(`\n${passed} checks passed.`);
if (failures.length) { console.log(`${failures.length} failure(s):`); failures.forEach((f) => console.log(`  - ${f}`)); process.exit(1); }
process.exit(0);
