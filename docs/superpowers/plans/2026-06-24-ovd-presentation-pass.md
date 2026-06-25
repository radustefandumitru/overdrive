# Overdrive v2 — Presentation Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Overdrive v2 feel polished and adoption-ready — a clean install (single live progress bar instead of log spam, no project-dir pollution), command surfaces that open with a clear high-level domain overview, and a README that teaches a developer how to actually use OVD.

**Architecture:** Two new zero-dependency helper modules consumed by existing code (no fork — matches the codebase's single-canonical-primitive pattern): `lib/ovd-plan/progress.js` (a TTY-aware progress bar) wired into the installer's skill-copy loops, and `lib/ovd-plan/overview.js` (a shared compact dashboard header) wired into the three "bare/unclear" command renders (`/ovd-go` orient, `/ovd-plan` display, `/ovd-workflow` status). Docs are a README-only expansion. No behavioral change to planning/execution logic.

**Tech Stack:** Node.js CommonJS, zero runtime deps (only `js-yaml`). Existing custom `check()` test harness (`scripts/test-ovd-plan-*.js`), run via `npm run test:ovd-plan`.

## Global Constraints

- **No new runtime dependencies.** No `ora`/`chalk`/`cli-progress`. The bar is hand-rolled with `process.stdout.write` + `\r`. (package.json `dependencies` stays `{ "js-yaml": "^4.1.0" }`.)
- **TTY-aware.** Carriage-return redraw (`\r`) only when the output stream `isTTY`. Non-TTY (CI, pipe, file) → no `\r`, no per-tick output; print one plain summary line at the end.
- **CLI never makes LLM calls** (Pattern 1). These are pure render/format functions.
- **Default install stays global-only** (Phase 7 Task 7.6) — do not regress `installLocal: false` default or create `.agents/`/`.cursor/` in the project dir.
- **No skill-file edits.** `skills/*/SKILL.md` untouched.
- **Every new module gets a `scripts/test-ovd-plan-<name>.js` suite** registered in `package.json` `check` + `test:ovd-plan` chains, using the existing `check(label, condition, detail)` harness.
- **Commits are user-approved**; no `--no-verify`.
- **Verification after every task:** `npm run check` (exit 0), `npm run test:ovd-plan` (0 FAIL), and for installer/doc changes also `npm run consistency` (1181) + `npm run test:workflow`.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `lib/ovd-plan/progress.js` | Create | Zero-dep progress bar: pure `renderBar()` + stateful `createProgress()` with injectable stream/isTty. |
| `scripts/test-ovd-plan-progress.js` | Create | Unit tests for progress.js (pure render + TTY/non-TTY tick/done). |
| `lib/installer.js` | Modify | Thread a progress counter through the skill-copy loops; route per-file `log()` lines behind `--verbose`; print one summary line. |
| `lib/ovd-plan/overview.js` | Create | `countStatuses(tree)` + `renderDomainHeader(model)` — the compact dashboard header. |
| `scripts/test-ovd-plan-overview.js` | Create | Unit tests for overview.js (counts + header rendering, empty/active/awaiting cases). |
| `lib/ovd-plan/orient.js` | Modify | Prepend the domain header to the `/ovd-go` orientation render. |
| `lib/ovd-plan/display.js` | Modify | Prepend the domain header to the `/ovd-plan` (bare) tree render. |
| `lib/ovd-plan/workflow.js` | Modify | Prepend the domain header to the `/ovd-workflow` status render (initialized projects). |
| `package.json` | Modify | Add the two new test scripts to `check` + `test:ovd-plan` chains. |
| `README.md` | Modify | Expand the "Overdrive v2" chapter (685–737) into an adoption-oriented guide. |

**Dependency order:** the three phases are independent and land as separate commits. **Agreed execution order (2026-06-25):** Phase 1 (Install UX: Tasks 1→2→3) → Phase 3 (README: Task 8) → Phase 2 (command overviews: Tasks 4→5/6/7) **last** — command overviews are deferred to the end so the user can review the current command renders before they change. Reconvene after each phase.

---

## Phase 1 — Install UX (quiet default + live progress bar)

### Task 1: `progress.js` — zero-dep progress bar utility

**Files:**
- Create: `lib/ovd-plan/progress.js`
- Test: `scripts/test-ovd-plan-progress.js`

**Interfaces:**
- Produces:
  - `renderBar({ current, total, label, width=24, columns=80 }) => string` — pure; a single line `[####----] 62%  (842/1361)  <label>`, truncated to `columns-1`.
  - `createProgress(total, { stream=process.stdout, isTty } ) => { tick(label?), done(summary?) }` — stateful; `tick` increments and (TTY only) rewrites the line via `\r`; `done` clears the line (TTY) and prints `summary`.

- [ ] **Step 1: Write the failing test**

```js
// scripts/test-ovd-plan-progress.js
'use strict';
const progress = require('../lib/ovd-plan/progress');
let passed = 0; const failures = [];
function check(label, cond, detail) { if (cond) { passed++; } else { failures.push(detail ? `${label}: ${detail}` : label); console.log(`FAIL ${label}`); } }

// renderBar — pure
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
// createProgress — injectable fake TTY stream
function fakeStream(isTTY) { const w = []; return { isTTY, columns: 80, write: (s) => w.push(s), writes: w }; }
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node scripts/test-ovd-plan-progress.js`
Expected: FAIL — `Cannot find module '../lib/ovd-plan/progress'`.

- [ ] **Step 3: Write minimal implementation**

```js
// lib/ovd-plan/progress.js
'use strict';

// Zero-dependency progress bar. Pure renderBar() + stateful createProgress().
// TTY-aware: carriage-return redraw only on a real terminal; non-TTY stays
// silent during ticks and prints one summary line at done (CI/pipe friendly).

function renderBar({ current, total, label, width = 24, columns = 80 }) {
  const ratio = total > 0 ? Math.min(1, current / total) : 0;
  const filled = Math.round(ratio * width);
  const bar = '#'.repeat(filled) + '-'.repeat(Math.max(0, width - filled));
  const pct = String(Math.floor(ratio * 100)).padStart(3, ' ').trimStart();
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `node scripts/test-ovd-plan-progress.js`
Expected: PASS — `NN checks passed.`

- [ ] **Step 5: Register in package.json + run chain**

Add `lib/ovd-plan/progress.js` and `scripts/test-ovd-plan-progress.js` to the `check` chain, and `scripts/test-ovd-plan-progress.js` to the `test:ovd-plan` chain (mirror an existing entry).
Run: `npm run check && npm run test:ovd-plan`
Expected: exit 0, 0 FAIL.

- [ ] **Step 6: Commit**

```bash
git add lib/ovd-plan/progress.js scripts/test-ovd-plan-progress.js package.json
git commit -m "feat(installer): zero-dep TTY-aware progress bar utility"
```

---

### Task 2: Wire the progress bar into the installer (quiet default + `--verbose`)

**Files:**
- Modify: `lib/installer.js` — copy loops at `installGitSources` (~1412–1447) and `installLocalSkills` (~1466–1473); arg parsing (`--verbose`); the `log()` helper.

**Interfaces:**
- Consumes: `createProgress` from `lib/ovd-plan/progress.js`.
- Behavior: default run shows ONE live bar over the total skill count and suppresses per-skill `log()` lines; `--verbose` restores full logs and disables the bar.

- [ ] **Step 1: Verify current `log()`/verbosity + total-count source**

Run: `rg -n "function log\(|options.verbose|isSkillSelected|skillTargets" lib/installer.js | head`
Confirm: whether `log()` already gates on a quiet flag, and that total skills = (Σ `selectedIncludes` across `ctx.manifest.sources`) + `ctx.manifest.localSkills` (filtered by `isSkillSelected`). Note the count expression for Step 3.

- [ ] **Step 2: Write the failing test (verbose flag parsed; bar used on default)**

In `scripts/test-ovd-workflow.js` (installer tests live here), add:

```js
// --verbose parse + default-quiet intent
{
  const opts = installer.parseInstallArgs(['--verbose']);   // use the real arg parser name confirmed in Step 1
  check('installer parses --verbose', opts.verbose === true, JSON.stringify(opts));
  const quiet = installer.parseInstallArgs([]);
  check('installer default is non-verbose', !quiet.verbose, JSON.stringify(quiet));
}
```

- [ ] **Step 3: Run to verify it fails**

Run: `node scripts/test-ovd-workflow.js`
Expected: FAIL — `--verbose` not yet parsed (or parser name differs; adjust to the confirmed name).

- [ ] **Step 4: Implement**

1. Add `--verbose` to the install arg parser (default `false`).
2. In the install entry (where `installGitSources` + `installLocalSkills` are called), compute `totalSkills` (Step 1 expression). If `!options.verbose && stream.isTTY`, create `const bar = createProgress(totalSkills, {})`; else `bar = null`.
3. Pass `bar` into both copy loops; call `bar && bar.tick(skillName)` once per `copySkill(...)` invocation (installer.js ~1436 and ~1472).
4. Gate the chatty per-skill `log(...)` lines so they only print when `options.verbose` (the bar replaces them by default).
5. After both loops, `bar && bar.done(\`✓ Installed ${totalSkills} skills (${plan.scope})\`)`.

- [ ] **Step 5: Run to verify pass + no regression**

Run: `node scripts/test-ovd-workflow.js && npm run check`
Expected: PASS; exit 0.

- [ ] **Step 6: Manual smoke (TTY + non-TTY)**

Run: `node bin/overdrive.js --help` (sanity), then a dry-run install if available: `node bin/overdrive.js install --dry-run` and `node bin/overdrive.js install --dry-run | cat` (piped → no `\r`).
Expected: TTY shows a single updating bar; piped output shows plain lines, no `\r` artifacts.

- [ ] **Step 7: Commit**

```bash
git add lib/installer.js scripts/test-ovd-workflow.js
git commit -m "feat(installer): single live progress bar by default; --verbose restores logs"
```

---

### Task 3: Install hygiene verification (no tracked-items / no project pollution)

**Files:**
- Modify: `scripts/test-ovd-workflow.js` (assertion); possibly `.gitignore` (only if Task 7.6's belt-and-suspenders entries are now redundant — keep unless clearly unused).

**Interfaces:** Consumes existing `installLocal` default + `maybeEnableLocalForExistingProject` logic (Phase 7 Task 7.6).

- [ ] **Step 1: Write the failing/guard test**

```js
// Default install must not target the project working directory.
{
  const opts = installer.parseInstallArgs([]);     // confirmed parser
  check('default install is global-only (installLocal false)', opts.installLocal === false, JSON.stringify(opts));
}
```

- [ ] **Step 2: Run**

Run: `node scripts/test-ovd-workflow.js`
Expected: PASS if Task 7.6 holds (this is a regression guard). If it FAILS, that's a real finding — stop and surface.

- [ ] **Step 3: Confirm gitignore covers agent dirs**

Run: `rg -n "\.agents/|\.cursor/" .gitignore`
Expected: both present. Leave as belt-and-suspenders (per Task 7.6 success criteria). No change unless absent.

- [ ] **Step 4: Commit (only if an assertion was added)**

```bash
git add scripts/test-ovd-workflow.js
git commit -m "test(installer): guard default-global install (no project pollution)"
```

---

## Phase 2 — Command domain overviews

### Task 4: `overview.js` — shared compact dashboard header

**Files:**
- Create: `lib/ovd-plan/overview.js`
- Test: `scripts/test-ovd-plan-overview.js`

**Interfaces:**
- Produces:
  - `countStatuses(tree) => { pending, 'in-progress', 'awaiting-review', done, blocked, skipped }` — walks all leaves (depth ≥ 2), tallies `node.status`.
  - `renderDomainHeader({ project, milestone, activeId, activeStatus, counts, awaitingReview, recommendation }) => string` — 3–4 line block.

- [ ] **Step 1: Write the failing test**

```js
// scripts/test-ovd-plan-overview.js
'use strict';
const overview = require('../lib/ovd-plan/overview');
let passed = 0; const failures = [];
function check(l, c, d) { if (c) passed++; else { failures.push(d ? `${l}: ${d}` : l); console.log(`FAIL ${l}`); } }

const tree = { id: '', depth: 1, title: 'Foo', children: [
  { id: 'I', depth: 2, title: 'M', status: 'in-progress', children: [
    { id: 'I.1', depth: 3, title: 'a', status: 'done', children: [] },
    { id: 'I.2', depth: 3, title: 'b', status: 'awaiting-review', children: [] },
    { id: 'I.3', depth: 3, title: 'c', status: 'pending', children: [] }
  ] }
] };

{
  const c = overview.countStatuses(tree);
  check('counts done=1', c.done === 1, JSON.stringify(c));
  check('counts awaiting-review=1', c['awaiting-review'] === 1, JSON.stringify(c));
  check('counts pending=1', c.pending === 1, JSON.stringify(c));
  check('container not counted as leaf', c['in-progress'] === 0, JSON.stringify(c));
}
{
  const h = overview.renderDomainHeader({
    project: 'Foo', milestone: 'I. M', activeId: 'I.2', activeStatus: 'awaiting-review',
    counts: { done: 1, 'in-progress': 0, pending: 1, blocked: 0 }, awaitingReview: 1,
    recommendation: 'review I.2'
  });
  check('header names project', h.includes('Foo'), h);
  check('header shows milestone', h.includes('I. M'), h);
  check('header shows active + status', h.includes('I.2') && h.includes('awaiting-review'), h);
  check('header shows counts', h.includes('1 done') && h.includes('1 pending'), h);
  check('header shows awaiting-review note', h.toLowerCase().includes('awaiting'), h);
  check('header shows recommendation', h.includes('review I.2'), h);
  check('header is at most 4 lines', h.split('\n').length <= 4, h);
}
{
  const empty = overview.renderDomainHeader({ project: 'Foo', milestone: null, activeId: null, counts: { done: 0, 'in-progress': 0, pending: 0, blocked: 0 }, awaitingReview: 0, recommendation: null });
  check('no active → no crash, no milestone line content', empty.includes('Foo') && !empty.includes('active:'), empty);
}

console.log(`\n${passed} checks passed.`);
if (failures.length) { console.log(`${failures.length} failure(s):`); failures.forEach((f) => console.log(`  - ${f}`)); process.exit(1); }
process.exit(0);
```

- [ ] **Step 2: Run to verify it fails**

Run: `node scripts/test-ovd-plan-overview.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// lib/ovd-plan/overview.js
'use strict';

// Compact domain dashboard shared by the three "bare/unclear" command renders
// (/ovd-go orient, /ovd-plan display, /ovd-workflow status). Pure functions; no IO.

const LEAF_STATUSES = ['pending', 'in-progress', 'awaiting-review', 'done', 'blocked', 'skipped'];

function countStatuses(tree) {
  const counts = Object.fromEntries(LEAF_STATUSES.map((s) => [s, 0]));
  (function walk(node) {
    for (const child of node.children || []) {
      const isLeaf = !child.children || child.children.length === 0;
      if (isLeaf && child.status && counts[child.status] !== undefined) counts[child.status] += 1;
      walk(child);
    }
  })(tree);
  return counts;
}

function renderDomainHeader({ project, milestone, activeId, activeStatus, counts, awaitingReview, recommendation }) {
  const lines = [];
  lines.push(`Overdrive · ${project || '(unnamed project)'}`);
  let l2 = milestone ? `Milestone ${milestone}` : 'No active milestone';
  if (activeId) l2 += `  •  active: ${activeId}${activeStatus ? ` [${activeStatus}]` : ''}`;
  lines.push(l2);
  const c = counts || {};
  let l3 = `${c.done || 0} done · ${c['in-progress'] || 0} in-progress · ${c.pending || 0} pending`;
  if (c.blocked) l3 += ` · ${c.blocked} blocked`;
  if (awaitingReview) l3 += `  •  ${awaitingReview} awaiting your review`;
  lines.push(l3);
  if (recommendation) lines.push(`→ Recommended: ${recommendation}`);
  return lines.join('\n');
}

module.exports = { countStatuses, renderDomainHeader, LEAF_STATUSES };
```

- [ ] **Step 4: Run to verify it passes**

Run: `node scripts/test-ovd-plan-overview.js`
Expected: PASS.

- [ ] **Step 5: Register in package.json + run chain**

Add both paths to `check`; add the test to `test:ovd-plan`.
Run: `npm run check && npm run test:ovd-plan`
Expected: exit 0, 0 FAIL.

- [ ] **Step 6: Commit**

```bash
git add lib/ovd-plan/overview.js scripts/test-ovd-plan-overview.js package.json
git commit -m "feat(ovd-plan): shared compact domain-header (overview.js)"
```

---

### Task 5: Wire the header into `/ovd-go` orient

**Files:**
- Modify: `lib/ovd-plan/orient.js` — `buildOrientation` (~188) / `runGoDefault` (~248).
- Test: `scripts/test-ovd-plan-orient.js`

**Interfaces:** Consumes `renderDomainHeader` + `countStatuses` from `overview.js`. The orient already parses the tree + active node + last-session summary; reuse those values for the header model.

- [ ] **Step 1: Write the failing test** — add to `scripts/test-ovd-plan-orient.js`:

```js
{
  // Orientation opens with the compact domain header.
  const r = /* existing helper that runs runGoDefault on a seeded tree with an active awaiting-review leaf */;
  check('orient output starts with Overdrive · <project>', /^Overdrive · /.test(r.text), r.text.slice(0, 60));
  check('orient header shows status counts', /\d+ done · \d+ in-progress · \d+ pending/.test(r.text), r.text.slice(0, 200));
}
```
(Reuse the file's existing seed/runner helpers; mirror an existing orient test's setup.)

- [ ] **Step 2: Run to verify it fails**

Run: `node scripts/test-ovd-plan-orient.js`
Expected: FAIL — output does not start with the header.

- [ ] **Step 3: Implement** — at the top of the orientation text assembly, prepend:

```js
const { renderDomainHeader, countStatuses } = require('./overview');
// ...inside buildOrientation, after parsed tree + active node are known:
const header = renderDomainHeader({
  project: parsed.frontmatter.project,
  milestone: parsed.frontmatter.current_milestone || null,
  activeId: activeNode ? activeNode.id : null,
  activeStatus: activeNode ? activeNode.status : null,
  counts: countStatuses(parsed.tree),
  awaitingReview: countStatuses(parsed.tree)['awaiting-review'],
  recommendation: /* the existing single-line recommendation the orient already computes */
});
lines.unshift('', header, '');   // header then the existing action-paths
```

- [ ] **Step 4: Run to verify pass + regression**

Run: `node scripts/test-ovd-plan-orient.js && npm run test:ovd-plan && node scripts/smoke-test-ovd-plan.js`
Expected: PASS; 0 FAIL; smoke 35.

- [ ] **Step 5: Commit**

```bash
git add lib/ovd-plan/orient.js scripts/test-ovd-plan-orient.js
git commit -m "feat(ovd-go): orient opens with the compact domain header"
```

---

### Task 6: Wire the header into `/ovd-plan` (bare) display

**Files:**
- Modify: `lib/ovd-plan/display.js` — the top-level `displayPlan`/render path (exports ~312; `renderTreeBody` ~205).
- Test: `scripts/test-ovd-plan-display.js`

**Interfaces:** Consumes `renderDomainHeader` + `countStatuses`. Display already renders status counts in some form; the header replaces/leads that with the shared block (remove any now-duplicated ad-hoc count line to stay DRY).

- [ ] **Step 1: Write the failing test** — add to `scripts/test-ovd-plan-display.js`:

```js
{
  const out = /* existing helper: render a seeded tree */;
  check('display opens with Overdrive · header', /^Overdrive · /.test(out), out.slice(0, 60));
  check('display header has counts line', /\d+ done · \d+ in-progress · \d+ pending/.test(out), out.slice(0, 200));
}
```

- [ ] **Step 2: Run to verify it fails** — `node scripts/test-ovd-plan-display.js` → FAIL.

- [ ] **Step 3: Implement** — prepend the header in the display render using the parsed tree + frontmatter; delete any pre-existing standalone "X done / Y in-progress…" line that the header now supersedes (check `renderTreeBody`/`renderRecommendation`).

- [ ] **Step 4: Run to verify pass** — `node scripts/test-ovd-plan-display.js && npm run test:ovd-plan` → PASS, 0 FAIL.

- [ ] **Step 5: Commit**

```bash
git add lib/ovd-plan/display.js scripts/test-ovd-plan-display.js
git commit -m "feat(ovd-plan): display opens with the compact domain header"
```

---

### Task 7: Wire the header into `/ovd-workflow` status

**Files:**
- Modify: `lib/ovd-plan/workflow.js` — `runWorkflowDefault` (~226) / `formatStatusBlock` (~215).
- Test: `scripts/test-ovd-plan-workflow.js`

**Interfaces:** Consumes `renderDomainHeader`. For an INITIALIZED project, prepend the header. For an uninitialized project (no `OVERDRIVE.md`), keep the tutorial (no header — nothing to summarize). The header for workflow may omit active-leaf detail if `OVERDRIVE.md` is absent — pass `activeId: null`.

- [ ] **Step 1: Write the failing test** — add to `scripts/test-ovd-plan-workflow.js`:

```js
{
  // Initialized project: workflow status opens with the domain header.
  const r = /* existing helper: runWorkflowDefault on a project with OVERDRIVE.md + .overdrive/ */;
  check('workflow status (initialized) shows Overdrive · header', r.text.includes('Overdrive · '), r.text.slice(0, 80));
}
{
  // Uninitialized project: tutorial still shown, no header.
  const r2 = /* runWorkflowDefault on a bare dir */;
  check('uninitialized still shows tutorial', r2.tutorial && r2.tutorial.length > 0, JSON.stringify(r2).slice(0,80));
}
```

- [ ] **Step 2: Run to verify it fails** — `node scripts/test-ovd-plan-workflow.js` → FAIL.

- [ ] **Step 3: Implement** — in `runWorkflowDefault`, when `statusReport.state` indicates an initialized project with a parseable `OVERDRIVE.md`, build the header from frontmatter + `countStatuses` and prepend to the rendered text. Leave the uninitialized/tutorial branch unchanged.

- [ ] **Step 4: Run to verify pass + regression** — `node scripts/test-ovd-plan-workflow.js && npm run test:ovd-plan && npm run test:workflow` → all green.

- [ ] **Step 5: Commit**

```bash
git add lib/ovd-plan/workflow.js scripts/test-ovd-plan-workflow.js
git commit -m "feat(ovd-workflow): status opens with the compact domain header"
```

---

## Phase 3 — README (developer-facing adoption chapter)

### Task 8: Expand the README "Overdrive v2" chapter

**Files:**
- Modify: `README.md` (replace lines ~685–737, the current "Overdrive v2 — Planning, Execution, and Record Pipeline" through "Quick start"; keep "Testing (contributors)" and below).

**Marketing lens:** simplicity first. Lead with the one-sentence value prop and a 4-line mental model before any reference detail. Plain language, skimmable, worked examples.

- [ ] **Step 1: Replace the chapter with this structure (write real prose, not placeholders):**

```markdown
## Overdrive v2 — plan, execute, and remember your work

Overdrive v2 gives an AI coding agent a **memory and a method**: a single human-readable
plan (`OVERDRIVE.md`) plus four commands that take you from idea → shipped, without losing
context across sessions.

**The mental model (4 commands):**
- `/ovd-workflow` — **set up.** Map the codebase, capture preferences/requirements. Start here once.
- `/ovd-plan` — **decide what to build.** Socratic planning into a tree where every leaf is a complete, executable contract.
- `/ovd-go` — **do the work.** Execute one leaf at a time, review, iterate; closures roll up the tree.
- `/ovd-log` — **save & hand off.** Capture the session, update docs, close milestones — resume cleanly later.

### The four commands (with flags)

[Table: command · what it does · key subcommands/flags · the question it answers.
 - /ovd-workflow: init · map · preferences · requirements
 - /ovd-plan: (bare=display) · deliberate · idea "X" · edit · research "Q" [attach_to_leaf] · verify
 - /ovd-go: (bare=orient) · <node-ref> · continue · --small · test <ref> · verify
 - /ovd-log: (bare=save) · handoff · capture "text" · concerns · milestone-close]

### What you'll see (the domain overview)

[Show the compact dashboard header example from a bare /ovd-go, and explain:
 project · milestone · active leaf · status counts · recommended next step, then numbered action-paths.
 Emphasize: bare commands ORIENT, they never silently execute.]

### Internal states (what's happening under the hood)

[Brief, skimmable: each command's internal states in one line each — e.g.
 /ovd-go: ORIENT → LEAF EXECUTE → LEAF VERIFY → AWAITING REVIEW → (ITERATE | FIX→escalate | DECISION POINT) → recursive close.
 Note these are internal; the developer just talks naturally and the intent layer routes.]

### Typical developer pipelines

[Three worked day-in-the-life flows:
 1. New project: /ovd-workflow init → /ovd-plan deliberate → /ovd-go → /ovd-log handoff.
 2. Resume after a context clear: /ovd-go (orients from cache+handoff) → continue mid-iteration.
 3. New idea mid-flight: /ovd-plan idea "…" → approve → fresh chat → /ovd-plan edit → /ovd-go.]

### File layout

[Keep the existing concise layout block: OVERDRIVE.md + .overdrive/ tree; what's committed vs gitignored.]

### Quick start

[Keep/refresh the existing quick-start commands.]
```

- [ ] **Step 2: Verify links + consistency**

Run: `npm run consistency`
Expected: `Consistency check passed (1181 checks).` (the consistency script scans docs/links).

- [ ] **Step 3: Self-check the prose**

Re-read: value prop first? Every command + flag listed matches the shipped surface (cross-check against `lib/ovd-plan/index.js` dispatch)? No invented flags? Internal-states line matches r3 §4–§7?

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(readme): adoption-oriented v2 chapter — commands, states, dev pipelines"
```

---

## Self-Review (plan vs. requirements)

**Spec coverage:**
- "Installed items don't clutter the terminal with logs" → Task 2 (quiet default + bar; per-skill logs behind `--verbose`). ✓
- "Don't appear as tracked items" → Task 3 (global-only guard + gitignore confirm). ✓
- "Interactive loading bar for the download" → Task 1 + 2 (live single-line bar, TTY-aware). ✓
- "Terminal commands present a clear high-level overview" → Tasks 4–7 (shared domain header on /ovd-go, /ovd-plan, /ovd-workflow). ✓
- "README + docs updated… how to use OVD, each command, user/internal states, typical dev pipelines" → Task 8. ✓
- "Simplicity is key" → README leads with value prop + 4-line model; header is ≤4 lines; bar is one line.

**Placeholder scan:** the orient/display/workflow wiring tests reference "existing helper" — these are real, named seed/runner helpers in each suite; the implementer mirrors the nearest existing test in that file (the surrounding tests show the exact helper names). All new-module code is complete. README task gives a concrete structure with bracketed content directions (not code) — acceptable for a docs task; prose is written during the step.

**Type consistency:** `renderDomainHeader(model)` / `countStatuses(tree)` / `renderBar({...})` / `createProgress(total, {stream,isTty})` names are used identically across tasks. Counts keys use the `node.status` enum verbatim (`'in-progress'`, `'awaiting-review'`).

**Scope:** three independent phases, each independently testable and committable. No decomposition needed.

---

## Notes for the implementer

- **Confirm two names in the codebase before Task 2/5/6/7** (they vary): the installer's arg-parser function name (Step 1 of Task 2), and each command suite's seed/runner helper (mirror the nearest existing test). These are the only lookups required.
- **TTY gating is the anti-clutter mechanism** — the per-file bar is a *single redrawing line*, never 1361 scrolling lines; piped/CI output degrades to plain summary lines.
- **DRY:** when wiring the header into display.js, remove any now-duplicated standalone counts line so the header is the single source of that information.
