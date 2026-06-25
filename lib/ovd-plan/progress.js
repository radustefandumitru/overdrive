'use strict';

// Zero-dependency progress bar. Pure renderBar() + stateful createProgress().
// TTY-aware: carriage-return redraw only on a real terminal; non-TTY stays
// silent during ticks and prints one summary line at done (CI/pipe friendly).

function renderBar({ current, total, label, width = 24, columns = 80 }) {
  const ratio = total > 0 ? Math.min(1, current / total) : 0;
  const filled = Math.round(ratio * width);
  const bar = '#'.repeat(filled) + '-'.repeat(Math.max(0, width - filled));
  const pct = String(Math.floor(ratio * 100));
  let line = `[${bar}] ${pct}%  (${current}/${total})`;
  if (label) line += `  ${label}`;
  const max = Math.max(10, columns - 1);
  if (line.length > max) line = line.slice(0, max - 1) + '…';
  return line;
}

function createProgress(total, opts = {}) {
  const stream = opts.stream || process.stdout;
  const isTty = opts.isTty !== undefined ? opts.isTty : !!stream.isTTY;
  let current = 0;
  return {
    tick(label) {
      current += 1;
      if (!isTty) return;
      const columns = stream.columns || 80;
      stream.write('\r' + renderBar({ current, total, label, columns }));
    },
    done(summary) {
      if (isTty) {
        const columns = stream.columns || 80;
        stream.write('\r' + ' '.repeat(columns - 1) + '\r');
      }
      if (summary) stream.write(summary + '\n');
    }
  };
}

module.exports = { renderBar, createProgress };
