# ovd-plan: Implementation Plan

**Date:** 2026-06-08
**Branch:** `feature/ovd-plan`
**Status:** Implementation plan locked. Phase 1 ready to start. Nothing implemented yet.
**Audience:** Future-self (and any other agent) picking this up in a fresh context. This document is the **resume-safe source of truth**. If you can read this and the spec referenced below, you can continue from any point without re-deriving anything.

---

## 0. How to use this document (READ FIRST IN EVERY NEW SESSION)

This plan is designed to survive arbitrary context refreshes. The principle: **nothing critical lives only in the chat history**. If a fact matters across sessions, it's either in this document or in the reference docs called out below.

### 0.1 New-session resume protocol

When opening a fresh conversation on this work, do exactly this, in order:

1. **Read this document fully.** Sections 1–4 establish what the system is and what's being built. Section 5 (phases) is the playbook. Section 7 (implementation log) tells you what's done and what's next.
2. **Read the spec doc:** `docs/superpowers/specs/2026-06-08-ovd-plan-pipeline-architecture-r3.md`. This is the converged design — the contract every implementation phase delivers against. Pay particular attention to Sections 9.3 (`OVERDRIVE.md` format), 10 (node schema), 11 (skill-router prior-set contract), and 1 (operating principles).
3. **Check Section 7 of this document** to find the most recent log entry. The "Next" pointer in the latest entry tells you the exact task to pick up.
4. **For the next task, perform its Research step first.** Every task has a Research step that grounds you in the current state of the codebase + the relevant GSD reference. Do this even if it feels redundant — the codebase may have changed since the previous session.
5. **Execute the task.** Follow its sub-steps. Meet its success criteria. Run its verification.
6. **Append to Section 7** when the task is done. Use the entry template at the end of Section 7.
7. **Ask the user before committing.** Per the user's persistent feedback (auto-memory: `feedback_git_commits.md`), never `git commit` without explicit user approval.

### 0.2 What lives where (source-of-truth ordering)

When in doubt about a design decision or fact:

| Question | Authoritative source |
|---|---|
| "What's the contract for X in the design?" | `2026-06-08-ovd-plan-pipeline-architecture-r3.md` (r3) — the spec |
| "What's the order of work?" | This document, Section 5 |
| "What's been built so far?" | This document, Section 7 (implementation log) |
| "What's the current state of the codebase?" | The codebase itself (read it; don't trust memory) |
| "What does this command do?" | r3 Sections 4–7 |
| "Why was this decision made?" | r3 Section 0 (resolution table) and historical revisions r1/r2 |
| "What's still open?" | r3 Section 13 (P0 resolved; P1/P2 follow-ups remain) |

### 0.3 Hard rules for every session

- **Never commit without user approval.** The user has stated this is a persistent preference. Stage and propose; the user accepts.
- **Never modify the 137 skill files.** They're the substrate. Only the skill-router itself is allowed to change (per the locked Q3 decision).
- **Never silently change a design decision.** If you think r3 needs revision, raise it explicitly with the user — do not patch the design while implementing.
- **Verify before you claim done.** Run the verification step listed for each task. If it fails, debug; do not mark complete.
- **Read the actual code, not memory.** Memory of file structure may be stale. Open the file.
- **Use plain prose for user-facing output.** Internal docstrings/comments may be technical; surfaces the user sees follow the spec's plain-language rule (r3 §1.6).

### 0.4 What this document is not

- Not a substitute for r3 (the design contract). It implements r3; r3 defines r3.
- Not a place to relitigate design. If a design question arises mid-implementation, surface it, don't decide it.
- Not a personal log. The implementation log is structured for handoff, not narrative.

---

## 1. What's being built (one-paragraph recap)

`ovd-plan` adds a structural planning + execution + record layer on top of Overdrive's existing skill catalog. Four user-facing commands (`/ovd-workflow`, `/ovd-plan`, `/ovd-go`, `/ovd-log`), each a state machine with many internal states. The plan is a **contract**: every leaf carries scope, skills, success criteria, verification method, references. Execution is **iterative**: leaves don't auto-complete, the user signals approval. Closure is **recursive**: leaf → cluster → milestone → root, each step human-approved. Skill-router gets a small extension (`prior_set` mode) so planning-time skill annotations short-circuit cold routing at execution. Multi-file architecture: `OVERDRIVE.md` at root for the plan tree, plus `.overdrive/codebase/`, `.overdrive/{requirements,preferences,decisions}.md`, `.overdrive/{handoffs,sessions,sketches,reports}/`, `.overdrive/plan.cache.json`. See r3 for the full design.

---

## 2. Reference materials (what to read when)

### 2.1 Primary references (always relevant)

| Path | Contents | When to consult |
|---|---|---|
| `docs/superpowers/specs/2026-06-08-ovd-plan-pipeline-architecture-r3.md` | **The converged spec.** Operating principles, command surface, all 4 command state machines, intent detection, file layout, node schema, locked YAML format, skill-router prior-set contract, open follow-ups. | Always — every session, every phase. |
| `docs/superpowers/specs/2026-06-08-ovd-plan-implementation-plan.md` | **This document.** Phase-by-phase tasks, research steps, success criteria, implementation log. | Always — every session. |

### 2.2 Historical references (read for context, not for current truth)

| Path | Contents | When to consult |
|---|---|---|
| `docs/superpowers/specs/2026-06-06-ovd-plan-design.md` | Original decisions + ambiguities record. | If you need to understand *why* a decision was made the way it was. |
| `docs/superpowers/specs/2026-06-06-ovd-plan-handoff.md` | First detailed handoff doc. Earliest pipeline draft. | If you want to see the design before convergence. |
| `docs/superpowers/specs/2026-06-07-ovd-plan-pipeline-architecture.md` | First converged pipeline architecture. | If you want to see the design before the multi-file / iterative-loop / intent-detection additions. |
| `docs/superpowers/specs/2026-06-08-ovd-plan-pipeline-architecture-r2.md` | Pre-resolution spec. | If you want to see what the open questions looked like before they were answered. |

### 2.3 Existing Overdrive codebase to study before Phase 1

| Path | What to learn |
|---|---|
| `bin/overdrive.js` | Entry point — command registration pattern, argument parsing |
| `lib/ovd-workflow.js` | Existing module style — exports, state persistence approach. **May or may not exist; verify with `ls lib/` before assuming.** |
| `lib/installer.js` | How Overdrive sets up new projects; reference for `/ovd-workflow init`'s file scaffolding |
| `package.json` | Existing dependencies (YAML library? `yargs`? `commander`?) — informs Phase 1 dependency choices |
| `scripts/` (if exists) | Existing test scripts — informs Phase 7's `test-ovd-plan.js` style |
| `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` | Where the global instruction note (Phase 7.2) gets appended |
| `.gitignore` | Where `.overdrive/sessions/`, `.overdrive/sketches/*`, `.overdrive/plan.cache.json` get added |

### 2.4 GSD references (study per-phase per Section 5; not all at once)

GSD is the inspiration we exceed. Each implementation phase calls out the specific GSD skills/commands relevant to it. **Do not read all of GSD up front** — read per-phase research instructions. Conceptual GSD knowledge (skill descriptions in the user's skill catalog) is sufficient for most; only dig deeper if a phase explicitly requires it.

---

## 3. Foundational principles (always-on guardrails)

These are extracted from r3 §1 and operate as guardrails for every task. If a task would violate one, stop and reconsider.

1. **The plan is a contract.** Every leaf produced by implementation must carry scope + skills + success_criteria + verification + dependencies + references (when applicable).
2. **Action paths are mandatory at every pause point.** Code must never silently route — always present numbered options + an "other" escape.
3. **Implicit only via prior conceptual approval.** Implementation should never run a heavy operation (codebase map, full handoff, commit) without an explicit user prompt that produced approval.
4. **Transparency over autonomy when ambiguous.** Surface tradeoffs in plain language; let the user pick.
5. **Match the user where they are.** Plain-language output, regardless of internal complexity.
6. **Blind spots filled by adding nodes, not by asking.** Planner inserts, agent justifies in one line, user prunes.
7. **Leaves never auto-complete.** Only explicit user approval (or equivalent signal captured via the action-path prompt) closes a leaf.
8. **Closure is recursive.** When a leaf closes, walk up and ask at every level.
9. **Pipelines chain themselves + recommend next command.** Implementation must implement these recommendations explicitly.
10. **Skill-router is pre-resolved at planning time.** Phase 1 extension to skill-router is the linchpin — get this right before Phases 3–5 depend on it.
11. **No fixed hierarchy.** Tree depth is unbounded; implementation must not assume any fixed level depth.
12. **State persistence is invisible work.** Cache writes happen on every change; user only sees them when relevant.

---

## 4. Cross-phase concerns

These concerns apply across all phases. Read once; refer back when they come up.

### 4.1 Testing strategy

- **Parser tests** (Phase 1.7) are the foundation; everything depends on them.
- **Per-pipeline unit tests** for each command's internal state machine.
- **Integration tests** for cross-pipeline flows (idea → edit → doc-update; leaf → cluster → milestone close).
- **End-to-end smoke test** (Phase 7.4) covers the full session loop: plan → go → log → resume.
- Run tests before claiming any task done. Verification step in each task spells out what must pass.

### 4.2 Commit discipline

- **Per task: one commit.** Commit message format: `ovd-plan(phase-N.task-M): <brief>` followed by a description body.
- **Never commit without user approval.** Stage, propose the commit message, wait for approval.
- **Never skip hooks** (`--no-verify`). If a hook fails, fix the underlying issue.
- **Branch:** `feature/ovd-plan`. Do not push without user approval.

### 4.3 Drift detection (this plan vs. r3)

If during implementation a task's success criteria appear impossible to meet as written, the contract may have a flaw. Stop, surface to user, propose an r3 revision. Do not silently adapt.

### 4.4 Rollback strategy

Each phase produces a coherent, working-on-its-own state. If a phase fails review:
- Revert the phase's commits (per `feedback_git_commits.md`, always ask first).
- Re-plan the phase from its research step.
- Update the implementation log with what was learned.

### 4.5 Handling non-existent files

The spec references files that may not exist yet (e.g., `lib/ovd-plan.js`). Phase 1 creates them. If you find yourself reading a path that doesn't exist:
- Don't assume it should.
- Check Section 7 (log) — has the previous session not created it yet?
- If the file is supposed to exist per the current phase: that's a regression; investigate.

### 4.6 Dependency on user availability

Most tasks can run autonomously through verification. Tasks that require user input are explicitly marked **[USER]** in Section 5. Examples: codebase map approval, commit approval, design clarifications.

---

## 5. Implementation phases

Seven phases. Each phase has: goal, research step, ordered tasks (with deliverable, success criteria, verification, references), and a phase-done definition.

**Phase ordering is strict.** Phase 2 depends on Phase 1 having a working parser; Phase 3 depends on Phase 2 producing codebase files; etc. Do not start a phase before the previous one is verified done.

---

### Phase 1 — Foundation

**Goal:** Build the substrate every command depends on: YAML parser/writer for `OVERDRIVE.md`, hierarchical cache, multi-file `.overdrive/` scaffolding, skill-router `prior_set` extension, CLI command skeletons. After Phase 1, no command does anything user-visible yet, but the foundation passes its own tests.

**Why this is first:** the parser fragility risk is the largest in the whole project. If the parser leaks, every downstream phase is unreliable. The skill-router extension is on the critical path because Phase 4 (`/ovd-go`) calls into it.

#### Phase 1 Research step (REQUIRED before any task)

Understand:

1. **Current state of `lib/`.** Run `ls lib/` and read whatever exists. Note module style (CommonJS vs ESM), export patterns, any existing test conventions. Specifically check whether `lib/ovd-plan.js` and `lib/ovd-workflow.js` exist as stubs or real modules.
2. **Entry point.** Read `bin/overdrive.js` to understand how commands are registered and what argument parser is used. Determine whether new commands plug in via the same mechanism.
3. **Dependencies.** Read `package.json`. Note YAML library if present (`js-yaml`, `yaml`). If absent, recommend `js-yaml` for Phase 1.2.
4. **GSD parallel.** GSD writes its plan state to `.planning/` as a directory tree with multiple `.md` files. We're doing single-root `OVERDRIVE.md` + supplementary files. **What we exceed:** human-readable single-file plan view at the root; GSD spreads it across many files which is harder to scan top-down. We're not implementing parallelism here — that's GSD's `gsd-execute-phase` differentiator and is out of scope for v1.
5. **Skill-router shape.** Find where skill-router lives in the codebase. Read its current `route()` signature. Identify the smallest patch surface that adds `prior_set` and `prior_confidence` without breaking existing callers.

Output of Research step: a short paragraph appended to the implementation log explaining what you found and any deviations from this plan's assumptions.

#### Phase 1 Tasks

##### Task 1.1 — `.overdrive/` directory scaffolding (NEW layout + carve-out gitignore)

- **Deliverable:** Function in a new `lib/ovd-plan/fs.js` that creates the r3 §9 layout idempotently. Plus an updated gitignore writer that emits the carve-out pattern from r3 §9.1, **replacing** the existing wholesale `.overdrive/` ignore from `lib/ovd-workflow.js::ensureWorkflowGitignore()`.
- **Specifically creates:**
  - Directories: `.overdrive/codebase/`, `.overdrive/handoffs/`, `.overdrive/sessions/`, `.overdrive/sketches/`, `.overdrive/sketches/approved/`, `.overdrive/reports/`.
  - Empty placeholder files: `.overdrive/requirements.md`, `.overdrive/preferences.md`, `.overdrive/decisions.md`.
  - Does NOT create `OVERDRIVE.md` (Phase 3 owns this).
  - Does NOT create old ovd-workflow files (state.md, project.md, etc.) — those are handled by Task 2.2.5 migration.
- **Gitignore carve-out pattern** (replaces existing wholesale ignore):
  ```
  .overdrive/
  !.overdrive/codebase/
  !.overdrive/codebase/**
  !.overdrive/requirements.md
  !.overdrive/preferences.md
  !.overdrive/decisions.md
  !.overdrive/handoffs/
  !.overdrive/handoffs/**
  !.overdrive/reports/
  !.overdrive/reports/**
  !.overdrive/sketches/approved/
  !.overdrive/sketches/approved/**
  ```
- **Reuses (from existing `lib/ovd-workflow.js`):** `findProjectRoot`, `hasProjectSignal`, `isSafeProjectDir` utilities (preserved as imports). Old `initWorkflow()` orchestration is NOT reused — replaced.
- **Success criteria:**
  - Idempotent: running twice produces no errors and no duplicate state.
  - Detects existing `.overdrive/` with old layout (presence of pre-r3 files) → does NOT scaffold the new layout; returns marker so Task 2.2 INIT can route to Task 2.2.5 migration.
  - Gitignore writer is idempotent and migrates old wholesale `.overdrive/` line to the new carve-out pattern transparently.
  - Returns a structured result describing what was created vs. what existed vs. what triggered the old-layout marker.
- **Verification:** unit tests covering: fresh project (scaffold + gitignore written), project with new layout already (idempotent), project with old layout (migration marker returned, no destructive write), gitignore round-trip from old → new pattern.
- **Reference:** r3 §9, §9.1, §12; impl plan §5A.

##### Task 1.2 — `OVERDRIVE.md` YAML parser

- **Deliverable:** `lib/ovd-plan/parser.js` (or similar) exporting `parseOverdriveMd(content: string): Tree`.
- **Behavior:** parses the locked format from r3 §9.3 — frontmatter, ATX-header tree, fenced `yaml ovd-plan` blocks per node, HTML-comment-delimited managed sections (inbox, capture, concerns, deliberation-state, archive). Returns a structured tree object matching the node schema in r3 §10.
- **Success criteria:**
  - Round-trips with writer (Task 1.3) without data loss on a representative example.
  - Missing `yaml ovd-plan` block on a node → node still parsed; status defaults to `pending`, skills empty.
  - Malformed YAML inside an `ovd-plan` block → **hard error** with line/col, no silent drop.
  - Schema violation (missing required field on a non-pending node, invalid enum value) → hard error.
  - Untagged YAML blocks elsewhere in the document → **ignored** (not parsed as node annotations).
  - Hierarchical IDs (I, II, II.2, II.2.a, II.2.a.i, etc.) correctly assigned from header depth + sibling order.
- **Verification:** unit tests covering: well-formed example from r3 §9.3, malformed YAML, missing required fields, deeply nested tree (5 levels), tree with no annotations, tree with managed sections.
- **Reference:** r3 §9.3 (format rules + parsing contract), §10 (node schema).

##### Task 1.3 — `OVERDRIVE.md` writer (tree → markdown)

- **Deliverable:** Same module as parser, exporting `writeOverdriveMd(tree: Tree): string`.
- **Behavior:** inverse of parser. Produces the exact format from r3 §9.3.
- **Success criteria:**
  - Round-trip stability: `parse(write(parse(content))) === parse(content)` for any valid input.
  - Field ordering inside YAML blocks is stable and deterministic (so diffs are clean).
  - Managed sections preserved verbatim (we don't reformat user prose in inbox/capture).
- **Verification:** round-trip tests + golden-file tests with diff inspection.
- **Reference:** r3 §9.3.

##### Task 1.4 — Hierarchical recursive cache (`plan.cache.json`)

- **Deliverable:** `lib/ovd-plan/cache.js` exporting:
  - `loadCache(rootDir): Tree` (returns cache or null)
  - `saveCache(rootDir, tree): void`
  - `regenerateCacheFrom(rootDir): Tree` (parses `OVERDRIVE.md` and writes cache)
  - `closureCheck(tree, nodeId): { closures: Node[], stops_at: Node }` — given a just-closed node, walks up the tree and returns the list of ancestors that are now candidates for closure (all children done) plus the first one that has open siblings.
- **Behavior:** cache mirrors the parsed tree. Write-through: every state change writes the cache. Cache structure includes per-node `iterations` array, current status, sub-tree-completion summary at each container level.
- **Success criteria:**
  - Cache regeneration from `OVERDRIVE.md` produces an identical tree to parsing.
  - Closure check correctly walks up: returns empty `closures` if any sibling open at any level; returns the closure chain if leaves close clusters close milestones.
  - Cache writes are atomic (write to temp, rename) — no half-written cache after crash.
- **Verification:** unit tests including: cache after every leaf transition; closure check on flat tree, deeply nested tree, tree with mixed completion.
- **Reference:** r3 §1.9 (recursive closure principle), §7.5 (recursive close mechanism).

##### Task 1.5 — Skill-router planning-time helper + SKILL.md protocol update

- **Deliverable:**
  - **New `lib/ovd-plan/skill-router.js`** — thin Node helper exposing `resolvePriorSet({ leafDescription, leafScope, leafSuccessCriteria, codebaseContext }): { skills, confidence, rationale, considered }`. Parses `skills/skill-router/references/catalog.md` to enumerate skill IDs. Builds a focused routing prompt for the host agent to render JSON. Parses the returned JSON. Note: does NOT make LLM calls itself — the slash command markdown body orchestrates the host agent to call the helper for the leaf list, answer the routing prompts, then call back with results (mirroring how `/ovd-status` etc. work).
  - **Updates to `skills/skill-router/SKILL.md`** — add the 'Planning-time vs execution-time routing (ovd-plan protocol)' section per r3 §11.7. Existing routing rules and skill descriptions untouched.
- **Behavior per r3 §11:**
  - Planning-time path is canonical: ovd-plan invokes the helper per leaf during Stage 5 of deliberation.
  - Execution-time delta is the exception: fires only when leaf annotation is empty/missing OR confidence was low/medium with observed complexity OR agent observes need outside prior.
  - Confidence semantics per r3 §11.5 (`high` = canonical, `medium` = starting set + observed additions, `low` = advisory).
  - The router benchmark in `scripts/evaluate-router.js` continues to validate skill catalog coverage; no regression.
- **Success criteria:**
  - Helper parses `references/catalog.md` and enumerates all skill IDs without error.
  - Helper produces a routing prompt that elicits structured JSON from the host agent.
  - SKILL.md changes don't break router benchmark (`node scripts/evaluate-router.js` passes).
  - For 5 representative leaf descriptions (UI / security / performance / research / sketch), helper returns plausible prior sets with confidence and rationale (verified via mocked host agent responses).
  - Fault tolerance behaviors per r3 §11.6 verified: empty annotation, renamed skill, helper failure, catalog parse failure.
- **Verification:**
  - `node scripts/evaluate-router.js` passes after SKILL.md edits.
  - Helper unit tests (mock host agent JSON responses) for the 5 representative cases.
  - Helper handles missing skills and parse errors per fault tolerance rules.
- **Reference:** r3 §11 (fully rewritten 2026-06-08); historical Option-B framing preserved in r3 §13.2.

##### Task 1.6 — CLI command skeletons in `bin/overdrive.js`

- **Deliverable:** Four new commands registered: `workflow`, `plan`, `go`, `log` (each with their flags from r3 §2). Each handler at this stage just prints `"[ovd-plan] /<command> <flag>: not yet implemented"` and exits cleanly.
- **Success criteria:**
  - `overdrive workflow init` prints the stub message without error.
  - All flag combinations from r3 §2 parse without "unknown flag" errors.
  - Existing commands continue to work.
- **Verification:** invoke each new command + flag combo from CLI; ensure no crash.
- **Reference:** r3 §2.

##### Task 1.7 — Parser test suite (golden files)

- **Deliverable:** `scripts/test-ovd-plan-parser.js` (or wherever tests live in Overdrive — discover during Research) with a directory of golden-file fixtures:
  - `tests/fixtures/ovd-plan/minimal.md` — smallest valid OVERDRIVE.md
  - `tests/fixtures/ovd-plan/complete.md` — the full example from r3 §9.3
  - `tests/fixtures/ovd-plan/deep-tree.md` — 5-level deep tree
  - `tests/fixtures/ovd-plan/managed-sections.md` — all managed sections populated
  - `tests/fixtures/ovd-plan/malformed-yaml.md` — for negative test
  - `tests/fixtures/ovd-plan/missing-required-field.md` — for negative test
- **Success criteria:**
  - Every fixture round-trips (parse → write → parse → deep equal).
  - Negative fixtures produce expected errors with helpful messages.
- **Verification:** `node scripts/test-ovd-plan-parser.js` (or `npm test` if integrated) — all pass.
- **Reference:** r3 §9.3.

#### Phase 1 done definition

- All 7 tasks complete; verification step passed for each.
- `OVERDRIVE.md` parser/writer round-trips the canonical example with zero diff.
- Cache layer correctly mirrors and walks the tree for closure checks.
- Skill-router accepts `prior_set` and existing tests still pass.
- CLI skeletons callable.
- One commit per task, approved by user, on `feature/ovd-plan`.

---

### Phase 2 — `/ovd-workflow` (full repurpose per r3 §4 + migration)

**Goal:** Repurpose the existing `lib/ovd-workflow.js` into the new `/ovd-workflow` per r3 §4 (initialization + codebase mapping + preferences + requirements + decisions hub). Implement migration from the old `.overdrive/` layout for projects that have it. Implement drift detection so the codebase map stays current.

**Why second:** Phase 3 (`/ovd-plan`) needs the codebase files to plan with context. Without Phase 2, planning has no grounding.

**Scope clarifications per 2026-06-08 user direction:**
- The existing `lib/ovd-workflow.js` is preliminary scaffolding — **gut and rebuild** rather than extend. Existing utility functions (path helpers, idempotent file helpers) are preserved as imports; the orchestration logic is replaced.
- The existing `.overdrive/{project,state,constraints,research,changelog}.md` + `config.json`, `file-index.json`, `knowledge-index.json`, `routes.jsonl`, `work/` files are NOT preserved as-is; they're migrated to the new layout per §5A.1 (Migration Map).
- The existing slash commands (`/ovd-status`, `/ovd-doctor`, `/ovd-checkpoint`, `/ovd-resync`, `/ovd-knowledge`) are repurposed per §5A.2; behavior aligns with r3's command surface. Old commands keep resolving (deprecation note) so muscle memory doesn't break.
- The 137 skill files remain untouched. Only the skill-router SKILL.md gets the additive section per r3 §11.7.

#### Phase 2 Research step

Understand:

1. **GSD parallel.** Study the description of `gsd-map-codebase` and its dispatched agent `gsd-codebase-mapper` (focus areas: tech, arch, quality, concerns). Note the 4-agent pattern. We extend this to 5 (adding `patterns.md` as a separate file from architecture).
2. **What we exceed:** GSD's `.planning/codebase/` is created once and rarely refreshed. We commit to **maintenance**: tag-of-affected-modules drift detection (r3 §4.4), agent-discovered-patterns appended automatically on `/ovd-go` completion, surgical refresh via `MAP REFRESH` state.
3. **Multi-agent dispatch.** Check how Overdrive currently dispatches parallel tasks (if at all). The 5 mapper agents need to run concurrently and write to distinct files. If Overdrive doesn't have a parallelism primitive, evaluate using `Promise.all` of 5 LLM calls each scoped to a focus area.
4. **Preferences elicitation.** Read `lib/ovd-workflow.js` (if it exists) for existing preference handling. Our `PREFERENCES ELICIT` state should reuse whatever's there, just with Socratic dialogue instead of a flat prompt.
5. **Tutorial content.** Determine the right tone and length for the tutorial pass — 10–15 lines per r3 §4.1. Plain language, action-path next steps.

Output: log paragraph explaining what GSD does and how we adapt + extend.

#### Phase 2 Tasks

##### Task 2.1 — Tutorial + status display

- **Deliverable:** `lib/ovd-plan/workflow.js` exporting `runWorkflowDefault(rootDir, opts)`. Detects setup state, shows tutorial (~10 lines plain text on the OVD model: 4 commands + 1-sentence each), shows project status (initialized? codebase files present? deliberation status?), ends with action-path next-steps prompt per r3 §4.1.
- **Success criteria:**
  - First run (uninitialized project) shows tutorial + next-steps "(1) start init, (2) skip mapping, (3) other".
  - Subsequent runs (initialized) show status + most-recent-activity summary + action-path tied to current state.
  - User never auto-routes — selecting (1) leads to explicit next-step prompt, not silent execution.
- **Verification:** invoke `overdrive workflow` in fresh dir; in initialized dir.
- **Reference:** r3 §4.1.

##### Task 2.2 — `INIT` orchestration (with migration detection)

- **Deliverable:** `runWorkflowInit(rootDir, opts)` — orchestrates the init flow:
  1. **Migration detection:** check for old `.overdrive/` layout (presence of `project.md`, `state.md`, etc. WITHOUT the new `OVERDRIVE.md` or `.overdrive/codebase/`). Uses the marker returned by Task 1.1's scaffolder.
  2. **If old layout detected:** present action-path prompt: (1) migrate now, (2) skip migration (start fresh, archive old to `.overdrive/_legacy/`), (3) other. On approval, run `MIGRATE` state (Task 2.2.5). Nothing implicit.
  3. **Canonical init sequence:** `CODEBASE MAP` → `PREFERENCES ELICIT` → `REQUIREMENTS DRAFT`. Each sub-step gated by user approval at its start.
- **Success criteria:**
  - Old-layout detection works (presence of pre-r3 files in `.overdrive/`).
  - Migration runs only on explicit user approval; never silent.
  - User can decline any canonical sub-step; init continues with what's approved.
  - Final state recorded so `STATUS` knows what's initialized.
- **Verification:** scripted tests for: fresh project (canonical init), project with old layout (migrate accepted → MIGRATE then canonical init), project with old layout (migrate skipped → archive + fresh init), project with new layout already (re-init → status only, no-op).
- **Reference:** r3 §4.1, §4.2, §12.3; impl plan §5A.

##### Task 2.2.5 — `MIGRATE` state (one-time legacy migration)

- **Deliverable:** `runMigrateLegacy(rootDir, opts)` — migrates old `.overdrive/` layout to r3 §9 layout per §5A.1 (Migration Map).
- **Behavior:**
  1. Read old files: `project.md`, `state.md`, `architecture.md`, `constraints.md`, `decisions.md`, `preferences.md`, `research.md`, `changelog.md`, `config.json`, `file-index.json`, `knowledge-index.json`, `routes.jsonl`, `work/_active.json`.
  2. Derive new layout entries per §5A.1.
  3. Write the r3 §9 structure (creates files not already present; never overwrites existing new-layout files).
  4. Archive old files to `.overdrive/_legacy/YYYY-MM-DD-HH-MM/` (timestamped one-time archive; user can remove after one cycle).
  5. Returns structured report: files migrated, files archived, conflicts detected (where a new-layout file already exists and old data was preserved in archive only).
- **Success criteria:**
  - All listed old files handled (migrated, archived, or noted obsolete).
  - No new-layout file ever overwritten; conflicts surfaced in report.
  - Archive directory created and old files MOVED (not copied — keeps `.overdrive/` clean).
  - Idempotent on a migrated project: re-running detects already-migrated state and exits with status.
- **Verification:** scripted test on a fixture project with full old layout; assert all files end up in correct new-layout location per §5A.1; assert `_legacy/` archive timestamps correctly.
- **Reference:** r3 §12.3; impl plan §5A.1.

##### Task 2.3 — `CODEBASE MAP` (5 parallel mapper agents)

- **Deliverable:** `runCodebaseMap(rootDir, opts)` — dispatches 5 mapper agents in parallel, each scoped to its focus area, each writing to its file in `.overdrive/codebase/`. Tracks per-file the set of source modules analyzed (for drift detection in Task 2.7).
- **Mappers:**
  - `architecture.md` — system structure, module boundaries, data flow
  - `patterns.md` — recurring idioms, conventions, abstraction patterns
  - `tech-stack.md` — frameworks, libraries, versions, build chain, deploy
  - `quality.md` — test coverage, type discipline, lint posture
  - `concerns.md` — pre-existing risks: security, perf, debt, drift
- **Success criteria:**
  - All 5 files exist after run; each has the consistent structure (overview / components / evidence with file paths and line numbers / risks).
  - Token-bounded per mapper (no full-codebase load); evidence cites specific file paths.
  - Module tags recorded for drift detection.
- **Verification:** run against a small fixture codebase; inspect outputs for shape and evidence.
- **Reference:** r3 §4.3.

##### Task 2.4 — `PREFERENCES ELICIT`

- **Deliverable:** Socratic-style elicitation flow that produces `.overdrive/preferences.md` covering vetoes, coding style, workflow, communication.
- **Success criteria:**
  - User-driven; one question at a time; never barrages.
  - If user has nothing to say, accepts empty/default and moves on.
  - Produces structured markdown file with sectioned categories.
- **Verification:** smoke test with mocked user responses.
- **Reference:** r3 §4.5.

##### Task 2.5 — `REQUIREMENTS DRAFT`

- **Deliverable:** Socratic flow producing `.overdrive/requirements.md` with functional / non-functional / out-of-scope sections.
- **Success criteria:**
  - Same Socratic discipline as preferences.
  - Distinguishes functional from non-functional explicitly.
- **Verification:** smoke test.
- **Reference:** r3 §4.5.

##### Task 2.6 — `DECISIONS LOG`

- **Deliverable:** Append-only utility `appendDecision(rootDir, { date, node, decision, rationale })` that writes to `.overdrive/decisions.md` as a markdown table row.
- **Success criteria:**
  - Append never overwrites existing entries.
  - Table header created on first write; not duplicated thereafter.
  - Used by every other phase that records decisions (so Phase 3/4/5 can call it).
- **Verification:** unit test append-only semantics; verify table integrity after N writes.
- **Reference:** r3 §4.2 (DECISIONS LOG state).

##### Task 2.7 — Drift detection

- **Deliverable:** `detectDrift(rootDir): { needsRefresh: string[], reason: string }` — primary signal tag-of-affected-modules, secondary file-tree hash.
- **Behavior:**
  - On each `/ovd-go` leaf complete, check whether touched paths overlap with any mapper's recorded module tags.
  - If yes, mark that mapper's file as needsRefresh.
  - File-tree hash compared against last snapshot; if delta significant (e.g., new top-level dir), mark all as needsRefresh.
- **Success criteria:**
  - Touching a known src file flags only the relevant mapper.
  - Adding a top-level dir flags all mappers.
  - Touching an unrelated file (docs, tests) doesn't flag anything.
- **Verification:** unit tests with mock module tags and file-tree snapshots.
- **Reference:** r3 §4.4.

##### Task 2.8 — `MAP REFRESH` (incremental update)

- **Deliverable:** `refreshMap(rootDir, files: string[])` — re-runs only the named mapper agents, updates their files, refreshes module tags.
- **Success criteria:**
  - Untouched mapper files preserved verbatim.
  - Refreshed mapper writes new content + updated module tags.
  - Discovered-during-execution sections (Phase 4 will append to these) preserved across refresh.
- **Verification:** integration test — initial map → simulate code change → drift detected → refresh → verify only affected files changed.
- **Reference:** r3 §4.4.

##### Task 2.9 — Legacy slash command repurposing

> **Status: DEFERRED to Phase 7 (decided 2026-06-09, Q5 confirmation).** `/ovd-status` depends on `/ovd-plan` (Phase 3); `/ovd-checkpoint` depends on `/ovd-log` (Phase 5). Wiring delegations now would point legacy commands at "not yet implemented" stubs. Repurposing happens in Phase 7 polish once the targets exist. Phase 2 done-definition explicitly accepts this deferral.

- **Deliverable:** Update existing slash command markdown files in `plugins/overdrive/commands/` to delegate to new ovd-plan handlers per §5A.2 (Slash command migration map). Add new command files for the four new commands.
- **Files updated (existing):**
  - `ovd-status.md` → body invokes `overdrive plan` (renders OVERDRIVE.md tree); one-line deprecation note.
  - `ovd-doctor.md` → body invokes `overdrive workflow doctor` or `overdrive verify --plan`; deprecation note.
  - `ovd-checkpoint.md` → body invokes `overdrive log handoff`; deprecation note.
  - `ovd-resync.md` → body invokes `overdrive workflow map`; deprecation note.
  - `ovd-knowledge.md` → body invokes `overdrive workflow knowledge` (preserved semantics) or routes to preferences/requirements view; deprecation note.
  - `ovd-install.md`, `ovd-update.md` — unchanged (installer commands).
- **Files created (new):**
  - `ovd-workflow.md`, `ovd-plan.md`, `ovd-go.md`, `ovd-log.md` per r3 §2. (These were originally listed under Phase 1 Task 1.6; in practice, Task 1.6 creates the stubs and Task 2.9 + later phases populate the bodies as functionality lands.)
- **Success criteria:**
  - Legacy commands continue to resolve (muscle memory preserved).
  - Each legacy command's body shows the deprecation note pointing to its new replacement.
  - New commands work per r3 §2.
- **Verification:** invoke each legacy command in a test project; verify routing to new handler + deprecation note printed.
- **Reference:** r3 §12.1; impl plan §5A.2.

#### Phase 2 done definition

- `overdrive workflow` (bare) produces tutorial + status + action-path next-steps.
- `overdrive workflow init` orchestrates the full init flow with user approval at each step, including migration detection for projects with the old layout.
- `overdrive workflow map` runs all 5 mappers in parallel and produces the 5 files.
- Drift detection correctly flags only affected mappers.
- Refresh correctly updates only flagged mappers.
- Preferences and requirements files produced via Socratic flows.
- Legacy `.overdrive/` layout migrated cleanly when user approves; archived to `_legacy/` otherwise.
- Legacy slash command repurposing (Task 2.9) **deferred to Phase 7 polish** (Q5 confirmation 2026-06-09) — `/ovd-status`, `/ovd-checkpoint`, etc. retain their Phase 1 bodies through Phases 2–6 and get repurposed once `/ovd-plan` and `/ovd-log` actually exist to delegate to.
- One commit per task, approved by user.

---

### Phase 3 — `/ovd-plan`

**Goal:** Build the deliberation and tree-creation pipeline. After Phase 3, the user can plan a project from scratch (or import / edit / propose ideas) and end up with an `OVERDRIVE.md` whose every leaf is a complete contract.

**Why third:** depends on Phase 2's codebase files for grounding and Phase 1's parser/writer for serializing the tree. Doesn't depend on Phase 4/5.

#### Phase 3 Research step

Understand:

1. **GSD parallel: `gsd-discuss-phase`.** Adaptive questioning before planning. Our Stage 2 (Elicit) mirrors this. Study its question structure.
2. **GSD parallel: `gsd-plan-phase`.** Detailed plan creation with verification loop. Our Stage 5 (Plan) mirrors this — per-leaf success_criteria, dependency mapping.
3. **GSD parallel: `gsd-spec-phase`.** Clarifies WHAT a phase delivers with ambiguity scoring. Our Stage 4 (Spec) borrows the ambiguity-scoring concept.
4. **GSD parallel: `gsd-plan-checker`.** Goal-backward verification of plan quality. Our Stage 6 (Verify) mirrors this.
5. **What we exceed:**
   - Single command (`/ovd-plan`) does what GSD splits across discuss/spec/plan/verify — pipeline chaining hides the stages from the user.
   - **Blind-spot expansion** as a tree-modification (not just a question-list) is novel; GSD surfaces blind spots as questions, we materialize them as nodes.
   - **Calibration** on three explicit axes (domain/technical/scope) is more structured than GSD's user-modeling.
6. **What about `/ovd-plan idea`?** The split idea-analyze-then-new-chat-for-edit pattern (r3 §5.2) is intentional — preserves context cleanliness. Implementation should make the "start a new conversation with /ovd-plan edit" recommendation explicit, not silent.

Output: log paragraph mapping each Socratic stage to its GSD equivalent + noting where we diverge.

#### Phase 3 Tasks

##### Task 3.1 — `DISPLAY` (visual tree render)

- **Deliverable:** `displayPlan(tree)` — renders the tree to terminal with status markers, active position, agent-recommended-next, health indicators.
- **Success criteria:**
  - Tree displayed with hierarchical IDs (I, II.2.a, etc.).
  - `← ACTIVE` marker on active leaf.
  - Status counts at top: "X done / Y in-progress / Z pending / W blocked".
  - Trailing recommendation: action-path prompt for next command.
- **Verification:** snapshot test against a fixture tree.
- **Reference:** r3 §5.1 (`DISPLAY`).

##### Task 3.2 — User calibration sub-system

- **Deliverable:** `calibrateUser(openingMessage, history): { domain, technical, scope }` and a calibration-aware presentation helper.
- **Behavior:**
  - Returns axis levels (low/medium/high) per r3 §5.3 Stage 1.
  - Calibration persists to `deliberation-state` block in OVERDRIVE.md.
  - Presentation helper adjusts vocabulary, sentence length, detail level based on calibration.
- **Success criteria:**
  - Calibration stable across a session.
  - User can override ("explain it more simply"); override is captured and respected.
- **Verification:** unit test against canned messages of varying sophistication.
- **Reference:** r3 §5.3 Stage 1.

##### Task 3.3 — Socratic protocol (Stages 2–7)

- **Deliverable:** `runDeliberation(rootDir, opts)` — orchestrates Stages 2 through 7 from r3 §5.3.
- **Stages:**
  - 2: Elicit (one high-leverage question per turn)
  - 3: Blind-spot expansion (covered separately in Task 3.4)
  - 4: Spec phase (ambiguity scoring)
  - 5: Plan phase (success_criteria, scope, deps, verification per leaf)
    - **RESOLVE SKILLS sub-step:** for each leaf, invoke `lib/ovd-plan/skill-router.js::resolvePriorSet()` (Task 1.5). Write returned `skills`, `confidence`, `rationale`, `considered` to leaf YAML annotation. See r3 §11.2 for canonical flow and §5.3.5 for the sub-step contract.
  - 6: Verify phase (goal-backward)
  - 7: Present + iterate
- **Success criteria:**
  - One question per turn; no barrage.
  - Calibration honored (Task 3.2 plugged in).
  - Stage 5 output: every leaf has success_criteria + scope + verification + deps.
  - Stage 5 RESOLVE SKILLS sub-step runs for every leaf; every leaf has `skills`, `confidence`, `rationale` annotated (calls Task 1.5 helper).
  - Stage 6 output: every functional requirement traces to a leaf.
  - Stage 7 loops on user iterations until approval.
- **Verification:** scripted end-to-end deliberation; assert resulting tree meets all stage criteria.
- **Reference:** r3 §5.3 (entire section).

##### Task 3.4 — Blind-spot expansion (Stage 3)

- **Deliverable:** `expandBlindSpots(elicitedTree, projectContext): expandedTree` — runs the architect-level category checklist internally, inserts agent-proposed nodes with `[proposed-by-agent: <reason>]` tags.
- **Categories:** as per r3 §5.3.4 (security, perf, accessibility, observability, error handling, data, testing, operations, docs, user-facing, compliance).
- **Success criteria:**
  - All applicable categories produce at least one proposed node (or explicit "N/A: <reason>" record).
  - User presentation is one-line per proposed node, not a long report.
  - User can prune by listing node IDs to remove.
  - Internal reasoning preserved in the node's `inserted_reason` field.
- **Verification:** unit test against fixtures (e.g., "build a login form" should produce auth/session/csrf/rate-limit/a11y nodes).
- **Reference:** r3 §5.3.4.

##### Task 3.5 — `IDEA` pipeline

- **Deliverable:** `runIdea(rootDir, ideaText)` — implements r3 §5.2 flow with action-path approval prompt.
- **Behavior:**
  - Step 1–3: ingest, analyze impact, surface tradeoffs.
  - Step 4: action-path prompt (approved / continue / research / other).
  - Step 5 on `approved`: record decision to decisions.md, recommend starting a fresh chat with `/ovd-plan edit`. Does NOT auto-route to `EDIT` — the new-chat recommendation is the integration point.
  - Step 6 on `continue`: stay in IDEA loop.
  - Step 7 on `research`: emit recommendation to run `/ovd-plan research`.
  - Step 8 on rejection: append to inbox.
- **Success criteria:**
  - Action-path prompt always presented.
  - `approved` → decision logged + new-chat recommendation; never silently edits the tree.
- **Verification:** scripted test of each branch.
- **Reference:** r3 §5.2, §5.5.

##### Task 3.6 — `EDIT` pipeline

- **Deliverable:** `runEdit(rootDir, opts)` — structural modifications to the tree based on user direction.
- **Behavior:** can add, remove, restructure, rename, reorder nodes. Always presents proposed change diff to user before applying. Calls `appendDecision` for non-trivial changes. Triggers internal `DOC UPDATE` if the change affects documented surfaces.
- **Success criteria:**
  - Diff presented before apply.
  - User can pick "apply / adjust / cancel".
  - Decisions logged.
- **Verification:** scripted test.
- **Reference:** r3 §5.1.

##### Task 3.7 — `RESEARCH` pipeline

- **Deliverable:** `runResearch(rootDir, question)` — investigates a specific question: codebase reference (using codebase files from Phase 2), external docs (via Context7 or WebSearch), skill spike.
- **Behavior:** produces a structured findings note attached to the inbox or to a specific node. If session is ending, recommends `/ovd-log handoff`.
- **Success criteria:**
  - Findings file or inbox entry created.
  - Action-path prompt at end: "(1) /ovd-plan edit to integrate, (2) /ovd-log handoff, (3) more research, (4) other."
- **Verification:** scripted test.
- **Reference:** r3 §5.1, §5.5.

##### Task 3.8 — Plan-quality check (Stage 6)

- **Deliverable:** `verifyPlanQuality(tree, requirements)` — runs goal-backward + coverage + leaf-quality checks per r3 §5.3 Stage 6.
- **Success criteria:**
  - Every functional requirement traces to ≥1 leaf.
  - Every leaf passes the "competent agent could execute from leaf spec alone" rule (heuristic: scope, skills, success_criteria, verification all present).
  - Failures surface as actionable feedback ("Requirement R-3 has no leaf").
- **Verification:** unit test.
- **Reference:** r3 §5.3 Stage 6.

##### Task 3.9 — `deliberation-state` persistence + re-entry (Q12)

- **Deliverable:** Read/write of the `<!-- ovd-plan:deliberation-state:start -->` block. Re-entry behavior per r3 §5.7 (summary → confirmation → continue).
- **Success criteria:**
  - State persists across context clears.
  - Re-entry surfaces summary + action-path prompt; never silently resumes.
- **Verification:** scripted simulation of pause → restart.
- **Reference:** r3 §5.7.

#### Phase 3 done definition

- Bare `/ovd-plan` correctly routes to DISPLAY / NEW PROJECT / CONTINUE DELIBERATION.
- New project flow produces complete OVERDRIVE.md with every leaf having full contract.
- Idea flow presents action-path prompt; never silently edits.
- Edit, research, plan-quality check all pass their tests.
- Deliberation state persists and re-entry honors user.
- One commit per task, approved.

---

### Phase 4 — `/ovd-go`

**Goal:** Build the orient-and-continue execution pipeline with iterative loop and recursive close. After Phase 4, the user can execute leaves, iterate based on feedback, walk closures up the tree, and resume cleanly across context clears.

**Why fourth:** depends on Phase 3 producing trees with contracts to execute against, and Phase 1's skill-router extension for pre-loaded skills.

#### Phase 4 Research step

Understand:

1. **GSD parallel: `gsd-resume-work`.** Context restoration from previous session. Our `ORIENT` default mirrors this. Study its handoff-file format and resume prompt.
2. **GSD parallel: `gsd-execute-phase`.** Wave-based parallelism with subagents. **We do NOT implement parallelism in v1** — single agent, single leaf at a time. Note this divergence explicitly in the user-facing tutorial (Phase 2).
3. **GSD parallel: `gsd-verify-work`.** Conversational UAT. Our `LEAF VERIFY` + `AWAITING REVIEW STATE` together approximate this — auto-verify is the machine part, AWAITING REVIEW is the conversational part.
4. **GSD parallel: `gsd-audit-fix`.** Find/classify/fix/test/commit. Our `FIX` state borrows the "two-attempt then escalate" discipline.
5. **What we exceed:**
   - `AWAITING REVIEW STATE` makes the iteration loop first-class; GSD's verification is often a single-pass approval.
   - **Recursive close** at every level (leaf → cluster → milestone → root) is more structured than GSD's milestone-close-only.
   - `--small` mode with auto-detection has no direct GSD analogue.
   - Orient default with explicit action-path prompt (never silently continue) is stricter than `gsd-resume-work`.

Output: log paragraph mapping our states to GSD's commands; note our divergences.

#### Phase 4 Tasks

##### Task 4.1 — `ORIENT` default behavior

- **Deliverable:** `runGoDefault(rootDir, opts)` — reads OVERDRIVE.md + latest session/handoff file + scoped codebase files. Renders orientation per r3 §6.2. Presents action-path prompt with 5–6 numbered options.
- **Success criteria:**
  - Orientation includes: project, milestone, active leaf, last-session summary, awaiting-review count, directions.
  - Action-path prompt always shown; agent never silently executes.
  - User shortcut forms (`/ovd-go continue`, `/ovd-go <ref>`) bypass the prompt and route directly.
- **Verification:** scripted test with various tree states.
- **Reference:** r3 §6.1, §6.2.

##### Task 4.2 — `LEAF EXECUTE` with skill-router integration

- **Deliverable:** `executeLeaf(rootDir, leafId)` — reads leaf's YAML annotations, invokes `skill-router.route()` with `prior_set` + `prior_confidence: "high"` (per r3 §11), executes the task, writes to disk.
- **Success criteria:**
  - Skill-router called with correct prior set.
  - Runtime deltas (if any) logged to session capture file, not silently rewritten into leaf annotations.
  - Files written only within leaf's `scope.in` paths (warn if outside).
- **Verification:** unit test with mocked skill-router.
- **Reference:** r3 §6.3, §11.

##### Task 4.3 — `LEAF VERIFY` per verification method

- **Deliverable:** `verifyLeaf(leaf, output)` — dispatches based on `verification.method` (playwright, security-review, react-doctor, api_response_check, agent_self_check_against_success_criteria, etc.).
- **Success criteria:**
  - Method dispatch correct per r3 §6.8 table.
  - Fallback to agent-self-check if method unavailable.
  - Returns pass/fail + structured findings.
- **Verification:** unit test each method dispatcher (mock the external tools).
- **Reference:** r3 §6.8.

##### Task 4.4 — `AWAITING REVIEW STATE` + approval signal recognition

- **Deliverable:** `presentForReview(leaf, changes, verifyResult)` — shows diff summary, verification result, prompt per r3 §6.4. `classifyUserResponse(response)` — distinguishes approval / iteration / defer / ambiguous.
- **Behavior:**
  - Approval words: `approved`, `ship it`, `done`, `next`, `lgtm`, etc.
  - Iteration: anything describing a change.
  - Defer: `defer`, `come back to this`, `blocked on X`.
  - Ambiguous: ask user to pick from numbered options (don't guess).
- **Success criteria:**
  - Leaf never auto-promotes to `done` without an approval signal.
  - Ambiguous responses produce clarifying prompt.
- **Verification:** unit test response classification with diverse inputs.
- **Reference:** r3 §6.4, §10.3.

##### Task 4.5 — `ITERATION LOOP`

- **Deliverable:** `iterateOnLeaf(leafId, feedback)` — captures feedback to session log + leaf's `iterations[]` array, transitions status back to `in-progress`, re-enters `LEAF EXECUTE` with deltas.
- **Success criteria:**
  - Feedback recorded with timestamp.
  - Iteration count incremented.
  - Re-execution applies the feedback as deltas, not full re-do.
- **Verification:** scripted test of multi-iteration cycle.
- **Reference:** r3 §6.4 (ITERATION LOOP), §10.6.

##### Task 4.6 — Recursive close detection (shared with `/ovd-log`)

- **Deliverable:** `recursiveCloseFlow(rootDir, justClosedNodeId)` — uses cache's `closureCheck` (Task 1.4) and walks up presenting closure prompts per r3 §7.5.
- **Success criteria:**
  - Closure prompt presented at each ancestor level that's now eligible.
  - Each prompt offers: verify / close / hold / other.
  - Walk stops at first ancestor with open siblings, or at root.
  - User can stop the walk at any level with `hold`.
- **Verification:** scripted test with deeply nested closures.
- **Reference:** r3 §7.5, §8.2.

##### Task 4.7 — `--small` auto-detection

- **Deliverable:** `assessScope(leafId, changeDescription): { recommend_small: bool, reason: string }`. Suggests `--small` when scope is genuinely narrow (single file, no contract impact); recommends transparently per r3 §6.7.
- **Success criteria:**
  - High-precision: doesn't recommend `--small` for changes that touch >2 files or shared contracts.
  - Transparent: agent presents recommendation, user picks.
- **Verification:** unit test against scope fixtures.
- **Reference:** r3 §6.7.

##### Task 4.8 — `--small` scope-growth detection

- **Deliverable:** `monitorSmallScope(sessionState): { exceeded: bool, evidence: string }`. During `--small` execution, tracks files touched + contract changes; if growing beyond `--small` justifies, surfaces transparently.
- **Success criteria:**
  - Detects when file count exceeds 2-3.
  - Detects when a shared contract (API, prop interface) is being modified.
  - Presents user with switch / keep / replan / other options.
- **Verification:** scripted test.
- **Reference:** r3 §6.7.

##### Task 4.9 — Two-attempt failure escalation

- **Deliverable:** `runFixLoop(leafId, failureSummary)` — runs `FIX attempt 1`, re-verifies; if fails, runs `FIX attempt 2` with different approach; if still fails, escalates per r3 §6.9.
- **Success criteria:**
  - Cap at 2 fix attempts.
  - Escalation includes structured diagnosis: what was tried, what failed, hypothesis.
  - User options: try-once-more / replan / skip / other.
- **Verification:** scripted test.
- **Reference:** r3 §6.9.

##### Task 4.10 — `DECISION POINT` handling

- **Deliverable:** `surfaceDecisionPoint(leafId, ambiguity, options)` — pauses execution, presents ambiguity + recommended option + alternatives.
- **Success criteria:**
  - Always presents recommended + reasoning + alternatives + "describe other".
  - User picks; execution branches accordingly.
- **Verification:** scripted test.
- **Reference:** r3 §6.3, §6.4.

##### Task 4.11 — Node-ref fuzzy matching

- **Deliverable:** `resolveNodeRef(tree, ref): { matches: Node[], ambiguous: bool }`. Accepts hierarchical ID (II.2.a) or fuzzy title match. Ambiguous → numbered disambiguation.
- **Success criteria:**
  - ID match exact when format matches.
  - Title fuzzy match returns top candidates.
  - >1 match → user picks from numbered list.
- **Verification:** unit test against fixture tree.
- **Reference:** r3 §6.8.

#### Phase 4 done definition

- Bare `/ovd-go` presents orientation + action-path prompt; never silently executes.
- Leaf execution invokes skill-router with prior_set.
- Awaiting-review always prompts; never auto-promotes.
- Iteration loop captures feedback and re-executes with deltas.
- Recursive close walks up correctly with prompts at each level.
- --small auto-detection + scope-growth detection work transparently.
- Two-attempt failure cap with escalation.
- Node-ref resolution handles fuzzy + ambiguous cases.
- One commit per task, approved.

---

### Phase 5 — `/ovd-log`

**Goal:** Build the save/capture/concerns/handoff pipeline. After Phase 5, the user can pause/resume cleanly, capture concerns, and run full session-end handoffs with milestone close detection.

**Why fifth:** depends on Phase 4 producing leaf-state transitions to log; depends on Phase 1's cache for recursive-close shared utility.

#### Phase 5 Research step

Understand:

1. **GSD parallel: `gsd-pause-work`.** Context handoff when pausing mid-phase. Our `DEFAULT (lightweight save)` mirrors this. Study its handoff-file structure.
2. **GSD parallel: `gsd-complete-milestone`.** Archive completed milestone. Our `MILESTONE CLOSE` state mirrors this (with our recursive-close extension).
3. **GSD parallel: `gsd-extract-learnings`.** Extract decisions, lessons, patterns, surprises from completed phase artifacts. Our `LEARNINGS EXTRACT` mirrors this — and includes our skill-delta history for planner improvement.
4. **GSD parallel: `gsd-capture` / `gsd-inbox`.** Quick capture + inbox triage. Our `CAPTURE` and `INBOX VIEW` mirror these.
5. **GSD parallel: `gsd-ship`.** PR creation + review + merge prep. Our `RELEASE PREP` state at milestone close approximates this (without auto-PR creation — we keep that user-driven).
6. **What we exceed:**
   - DEFAULT `/ovd-log` is **lightweight save + recursive close check** in one — GSD splits these.
   - **Conversation capture** distills the recent dialogue, not just hard state — preserves nuance across resumes.
   - DOC UPDATE is **surgical** via `doc-coauthoring`, not regenerative.

Output: log paragraph mapping our log states to GSD commands; note our integrative differences.

#### Phase 5 Tasks

##### Task 5.1 — `DEFAULT (lightweight save)`

- **Deliverable:** `runLogDefault(rootDir, conversation)` — convo capture → state update → doc update → session file write → recursive close check → print result with next-step recommendation.
- **Success criteria:**
  - Session file created at `.overdrive/sessions/YYYY-MM-DD-HH-MM.md` with structured capture (modifications, responses, alignment, criteria, discoveries, decisions, open threads, what was interrupted).
  - Active node state updated.
  - Affected docs updated surgically.
  - Recursive close check runs after state update.
- **Verification:** scripted test of a session pause; verify file contents and state changes.
- **Reference:** r3 §7.1, §7.5.

##### Task 5.2 — `HANDOFF` full pipeline

- **Deliverable:** `runLogHandoff(rootDir, conversation)` — full pipeline per r3 §7.6 (11 steps).
- **Success criteria:**
  - All 11 steps execute in order.
  - Handoff file produced at `.overdrive/handoffs/`.
  - If milestone closure detected, milestone close pipeline runs (Task 5.6).
  - Commit step is gated by user approval.
- **Verification:** scripted end-to-end test.
- **Reference:** r3 §7.6.

##### Task 5.3 — `CAPTURE`

- **Deliverable:** `runLogCapture(rootDir, text)` — timestamped append to the current session file (or new session file if none).
- **Success criteria:**
  - Zero analysis, zero interruption.
  - Append is atomic.
- **Verification:** unit test.
- **Reference:** r3 §7.2, §7.3.

##### Task 5.4 — `CONCERNS REVIEW`

- **Deliverable:** `runLogConcerns(rootDir, nodeId?)` — structured review on active node (or specified) across dimensions (security, perf, persistence, fault tolerance, accessibility, observability, scalability).
- **Behavior:** findings attached to node's `concerns` field. Actionable findings recommend `/ovd-plan idea` for remediation.
- **Success criteria:**
  - All dimensions evaluated (or explicitly N/A).
  - Findings structured with severity + recommendation.
  - Actionable findings produce explicit recommendation to user.
- **Verification:** scripted test against fixture leaf.
- **Reference:** r3 §7.2.

##### Task 5.5 — Recursive close check (shared utility)

- **Deliverable:** `runRecursiveCloseCheck(rootDir)` — used by both `DEFAULT` and `HANDOFF`. Uses cache's `closureCheck`; presents prompts per r3 §7.5.
- **Success criteria:**
  - Identical behavior whether invoked from `/ovd-log` default or handoff.
  - Walks up until parent has open siblings or root reached.
  - Each level requires user approval.
- **Verification:** unit + scripted tests.
- **Reference:** r3 §7.5, §6.5.

##### Task 5.6 — `MILESTONE CLOSE` + learnings + release prep + archive

- **Deliverable:** `runMilestoneClose(rootDir, milestoneId)` — extended pipeline triggered when recursive close reaches a milestone level and user approves.
- **Sub-tasks:**
  - LEARNINGS EXTRACT: what worked, friction, skill annotation accuracy, iteration counts.
  - RELEASE PREP (if release milestone): invoke pre-launch-checklist, jack-seo-launch-audit.
  - ARCHIVE: move completed milestone subtree to `<!-- ovd-plan:archive -->` section.
  - Milestone summary written to `.overdrive/reports/milestone-N-summary.md`.
- **Success criteria:**
  - Learnings file captures iteration counts + skill deltas.
  - Archive preserves milestone history.
  - Summary readable as standalone milestone retrospective.
- **Verification:** scripted test through completion of a small milestone.
- **Reference:** r3 §7.6 Steps 7–10.

##### Task 5.7 — `DOC UPDATE` propagation

- **Deliverable:** `runDocUpdate(rootDir, changes)` — surgical propagation of changes to project docs using `doc-coauthoring` skill.
- **Behavior:**
  - Identifies affected docs from changes (API → API docs, architecture → architecture.md, etc.).
  - Updates only affected sections.
  - Never full-regenerates.
- **Success criteria:**
  - Untouched doc sections preserved verbatim.
  - User can review proposed doc changes before they're written (action-path prompt for non-trivial updates).
- **Verification:** scripted test.
- **Reference:** r3 §4.4 (doc-coauthoring use), §7.6 Step 4.

##### Task 5.8 — `COMMIT` integration

- **Deliverable:** `runCommit(rootDir, message)` — invoked from HANDOFF Step 10; ALWAYS prompts user for approval before committing per `feedback_git_commits.md`.
- **Success criteria:**
  - Commit message follows convention: `ovd-plan: checkpoint — [details]`.
  - User approval required.
  - Hooks not skipped.
- **Verification:** scripted test with mock git.
- **Reference:** r3 §7.6 Step 10; auto-memory `feedback_git_commits.md`.

#### Phase 5 done definition

- DEFAULT log produces session file + recursive close check.
- HANDOFF runs full 11-step pipeline.
- Capture, concerns, doc update all work per spec.
- Milestone close detection + learnings + release prep + archive.
- Commit step gated by user approval.
- One commit per task, approved.

---

### Phase 6 — Intent Detection Layer

**Goal:** Build the natural-language router that sits in front of all commands. Free-form messages → classified intent → action-path prompt for ambiguous cases.

**Why sixth:** cross-cuts all commands; can be stubbed in earlier phases (route everything to "ambiguous, please use a command") and completed here. Or built earlier — see note below.

**Note on placement:** consider stubbing Phase 6.1 (classifier interface) in Phase 1 so other commands can call into it from day one. The full implementation can land here.

#### Phase 6 Research step

Understand:

1. **Current intent inference in Overdrive.** Search for any existing free-form input handling. Skill-router does some message classification — see whether its prior_set extension (Task 1.5) could be reused for intent classification.
2. **GSD parallel: `gsd-progress`.** Unified situational command — assesses state and routes. Closest GSD analog to our intent detection. Study its decision logic.
3. **What we exceed:** GSD requires the user to type the right command; intent detection lets users type freely. Our action-path discipline (always present options when ambiguous) avoids GSD's "guess wrong then user has to undo" failure mode.

Output: log paragraph noting current Overdrive surface and what gets reused.

#### Phase 6 Tasks

##### Task 6.1 — Classifier core

- **Deliverable:** `classifyIntent(message, state): { route: string, confidence: "unambiguous" | "ambiguous", candidates: Route[] }`. Evaluates verb/object/state-context/calibration axes per r3 §3.3.
- **Success criteria:**
  - Common patterns (the routing matrix in r3 §3.3) classify correctly.
  - Confidence label is honest — flags ambiguity when present.
- **Verification:** test suite of 20+ message→expected-route pairs.
- **Reference:** r3 §3.1, §3.3.

##### Task 6.2 — Action-path prompt template

- **Deliverable:** `renderAmbiguityPrompt(candidates): string` — produces the standardized 2-4 option prompt with "describe what you want" escape per r3 §3.2.
- **Success criteria:**
  - One-line per option describing tradeoff.
  - "Other" escape always present.
- **Verification:** snapshot test against several ambiguity scenarios.
- **Reference:** r3 §3.2.

##### Task 6.3 — Confidence-based branching

- **Deliverable:** `routeOrPrompt(message, state)` — unambiguous → announce + execute; ambiguous → prompt; very-low-confidence → ask clarifying question matched to calibration.
- **Success criteria:**
  - Explicit `/ovd-*` commands bypass classifier (honored as typed).
  - Announce-before-execute pattern always.
  - User can correct (`"that's not what I meant"`).
- **Verification:** scripted test.
- **Reference:** r3 §3.1, §3.4.

##### Task 6.4 — Mis-classification logging

- **Deliverable:** Mis-classifications (user corrections) logged to session capture; aggregated to learnings at milestone close.
- **Success criteria:**
  - Every correction recorded with original message + chosen route + corrected route.
- **Verification:** unit test logging behavior.
- **Reference:** r3 §3.5.

#### Phase 6 done definition

- Free-form messages route correctly for the test matrix.
- Ambiguous messages produce action-path prompts.
- Mis-classifications captured.
- One commit per task, approved.

---

### Phase 7 — Polish + integration

**Goal:** Final integration. Cross-pipeline smoke tests. Global instruction note. Overdrive verify. Comprehensive test suite. README/docs.

#### Phase 7 Research step

Understand:

1. **Existing `overdrive verify`.** Read whatever currently exists. Determine how to add `ovd-plan` checks.
2. **CLAUDE.md / AGENTS.md / GEMINI.md managed blocks.** Read existing managed-block pattern in Overdrive's installer (`lib/installer.js`).
3. **README / docs.** Find current README and decide where to insert the OVD-plan section.

Output: log paragraph identifying integration points.

#### Phase 7 Tasks

##### Task 7.1 — Cross-pipeline smoke tests

- **Deliverable:** End-to-end test of the full session loop: init → plan → execute leaves → log default (mid-session save) → resume → continue → log handoff (with milestone close).
- **Success criteria:**
  - Loop completes without errors.
  - Resulting OVERDRIVE.md + handoff file + sessions files all valid.
- **Verification:** test pass.

##### Task 7.2 — Global instruction note

- **Deliverable:** Managed block added to CLAUDE.md, AGENTS.md, GEMINI.md (whichever exists) noting: "If `OVERDRIVE.md` exists in the project, treat it as the primary project context and current task source."
- **Success criteria:**
  - Block uses Overdrive's managed-block convention.
  - Note is concise and non-intrusive.
- **Verification:** read the modified file; confirm format.

##### Task 7.3 — `overdrive verify` integration

- **Deliverable:** Add ovd-plan checks to whatever `overdrive verify` is (or create the command if absent).
- **Checks:**
  - OVERDRIVE.md parses cleanly.
  - Cache consistent with OVERDRIVE.md.
  - `.overdrive/` structure present.
  - No orphan files (e.g., cache references non-existent nodes).
- **Verification:** run on a healthy and a corrupted project; both behave correctly.

##### Task 7.4 — Comprehensive test suite

- **Deliverable:** `scripts/test-ovd-plan.js` — runs all unit + integration + smoke tests. Documented `npm test` target if applicable.
- **Success criteria:**
  - All tests pass.
  - Test suite runs in reasonable time.

##### Task 7.5 — README + docs update

- **Deliverable:** Section in README describing the 4 commands + the file layout. Link to r3 for full design.
- **Success criteria:**
  - Plain-language overview suitable for a new user.
  - Action-path examples included.

##### Task 7.6 — Install/uninstall behavior cleanup (CLI hygiene)

- **Deliverable:** Refactor of `lib/installer.js` (and supporting files) so that OVD CLI install/uninstall NEVER creates project-directory pollution. Specifically, no `.agents/` or `.cursor/` directories full of skill files should appear inside the project working directory as a side effect of running `overdrive` / `npx overdrive-cli` / equivalent. All CLI-installed agent state lives in global per-agent dirs (`~/.cursor/`, `~/.agents/`, `~/.claude/`, `~/.codex/`, `~/.gemini/`) only.
- **Why this matters:** As of Phase 1 commit (2026-06-09), running OVD CLI during dev populates `.agents/` and `.cursor/` inside the project working directory with 1000+ skill files. Phase 1 gitignored these so they don't pollute commits, but they still pollute `git status` output, IDE indexing, file searches, and disk usage. The right behavior is to install to user-global locations only; project directories should never receive installer output unless the user explicitly opted into a project-local install.
- **Scope:**
  - Audit `lib/installer.js` for all paths it writes to. Identify which target paths are correctly user-global (e.g., `~/.cursor/skills/`, `~/.claude/skills/`) and which improperly write inside the current working directory.
  - Refactor any project-relative install logic so it (a) only fires when the user explicitly opts in via flag (`--install-local` or similar), or (b) only fires when a project-local `.agents/skills/` or `.cursor/skills/` directory was pre-existing and clearly intentional. Default behavior is global-only.
  - Update `overdrive uninstall` to remove from the same set of locations the install wrote to.
  - Update installer messaging so it clearly indicates where skills are being installed.
- **Success criteria:**
  - Running `overdrive` (default install) on a fresh project does NOT create `.agents/` or `.cursor/` inside the project working directory.
  - User-global install paths continue to work per existing v1 semantics; no regression for users who installed v1 previously.
  - `overdrive uninstall` cleans user-global state.
  - The `.gitignore` entries for `.agents/` and `.cursor/` (added in Phase 1 commit) can be removed (or kept as belt-and-suspenders defense).
  - Existing installer tests continue to pass.
- **Verification:**
  - Fresh empty dir + `overdrive --dry-run` → reports no project-directory writes.
  - Fresh empty dir + `overdrive` → no project pollution; agent-global dirs populated.
  - Project with pre-existing `.agents/skills/` → preserves existing pattern only if the user explicitly opted in to local install.
  - `overdrive uninstall` → user-global state cleaned, no project-directory side effects.
- **Reference:** Identified during Phase 1 commit review (2026-06-09). User direction quoted verbatim: *"we will have to refine the install / uninstall for the CLI commands of OVD, since these appear in git as tracked items (1k+), and I don't think this should be the case in a well defined project (i don't exactly know - the installed skills, scripts, superpowers should live locally I suppose?)."*
- **Why Phase 7 (last phase):** This is independent of the ovd-plan structural-layer work. Doesn't block any Phase 2-6 task. Best done as a final polish + hygiene pass before declaring v2 ready, after the rest of the v2 surface is stable.

#### Phase 7 done definition

- Smoke test passes end-to-end.
- Global instructions installed.
- Verify command extended.
- Test suite green.
- README updated.
- CLI install/uninstall no longer pollutes project directories with skill files.
- Final commit, approved.

---

## 5A. Migration Map (legacy → r3 layout)

Resolved 2026-06-08 per user direction. Existing pre-ovd-plan code is preliminary scaffolding; fully repurpose for r3. Skills untouched; everything else migrated or repurposed.

### 5A.1 File migration map (per Task 2.2.5)

| Old file in `.overdrive/` | New location | Migration logic |
|---|---|---|
| `project.md` | `OVERDRIVE.md` frontmatter `project:` + `description:` | First non-empty paragraph → description; project title from first H1 |
| `state.md` | `OVERDRIVE.md` frontmatter (`active_node`, `current_milestone`, `deliberation_status`) + first session file in `.overdrive/sessions/` | Active focus → `active_node` (best-effort fuzzy match against tree if present, else free-text in session file); last reason + notes → session file |
| `architecture.md` | `.overdrive/codebase/architecture.md` — old content preserved as "Notes from previous workflow" section at top; mapper agent extends below | Preserve old prose verbatim; mapper output appended |
| `constraints.md` | `.overdrive/preferences.md` (under "Vetoes" section) | Each constraint becomes a veto entry with original date if available |
| `decisions.md` | `.overdrive/decisions.md` (preserved verbatim) | No structural change — already part of r3 §9 |
| `preferences.md` | `.overdrive/preferences.md` (preserved verbatim) | No structural change — already part of r3 §9 |
| `research.md` | `.overdrive/sessions/_research_legacy.md` (one-time archive) | Future research routes to ovd-plan research flow + per-session files |
| `changelog.md` | `.overdrive/reports/_changelog_legacy.md` (one-time archive) | Future changes captured in handoffs and milestone reports |
| `config.json` | `.overdrive/config.json` (rewritten — old keys preserved; new r3 keys added with defaults) | Read old, merge with new schema, write |
| `file-index.json` | Discarded (replaced by codebase mapper output + tag-of-affected-modules drift detection) | Archive in `_legacy/` |
| `knowledge-index.json` | Discarded (knowledge vault retained as `.overdrive/knowledge/` if `knowledge/` dir has user docs) | Archive in `_legacy/`; preserve `knowledge/` dir if non-empty |
| `routes.jsonl` | Discarded (router tracing now via session files + skill-delta lines) | Archive in `_legacy/` |
| `work/_active.json` | Replaced by `OVERDRIVE.md` `active_node` + `.overdrive/plan.cache.json` | Archive in `_legacy/` |
| `work/` (other than `_active.json`) | Archive in `_legacy/` (semantics replaced by sessions + cache) | Archive |
| `reports/` (existing files) | `.overdrive/reports/` (preserved verbatim — already part of r3 §9) | No structural change |
| `handoffs/` (existing files) | `.overdrive/handoffs/` (preserved verbatim — already part of r3 §9) | No structural change |
| `knowledge/` | `.overdrive/knowledge/` (preserved as-is if present) | No structural change; future user docs continue here |

All files moved to `_legacy/` land at `.overdrive/_legacy/YYYY-MM-DD-HH-MM/` (timestamped one-time archive). User can delete after one cycle.

### 5A.2 Slash command migration map (per Task 2.9)

| Old slash command | New behavior | Deprecation note |
|---|---|---|
| `/ovd-status` | Body invokes `overdrive plan` (default — renders OVERDRIVE.md tree + state per r3 §5 DISPLAY) | "This command now delegates to `/ovd-plan`. Consider using the new command directly." |
| `/ovd-doctor` | Body invokes `overdrive workflow doctor` (extended for new layout) or `overdrive verify --plan` | "This command now delegates to `/ovd-workflow doctor`. Consider using the new command directly." |
| `/ovd-checkpoint` | Body invokes `overdrive log handoff` per r3 §7 HANDOFF | "This command now delegates to `/ovd-log handoff`. Consider using the new command directly." |
| `/ovd-resync` | Body invokes `overdrive workflow map` per r3 §4 CODEBASE MAP refresh | "This command now delegates to `/ovd-workflow map`. Consider using the new command directly." |
| `/ovd-knowledge` | Body invokes `overdrive workflow knowledge` (knowledge vault preserved semantics) | "This command now delegates to `/ovd-workflow knowledge`. Consider using the new command directly." |
| `/ovd-install` | Unchanged (installer command) | — |
| `/ovd-update` | Unchanged (updater command) | — |
| (new) `/ovd-workflow` | Tutorial + init + map + preferences + requirements per r3 §4 | — |
| (new) `/ovd-plan` | Display + deliberate + research + create + edit + idea per r3 §5 | — |
| (new) `/ovd-go` | Orient + verify + node-ref + test + small per r3 §6 | — |
| (new) `/ovd-log` | Lightweight save + handoff + capture + concerns per r3 §7 | — |

### 5A.3 CLI subcommand migration map (per Task 1.6 + 2.9)

| Old CLI subcommand in `workflowCommands` Set | New behavior |
|---|---|
| `overdrive status` | Delegates to new `overdrive plan` handler |
| `overdrive doctor` | Extended for new layout (parser check, cache consistency, multi-file integrity, drift state) |
| `overdrive checkpoint` | Delegates to new `overdrive log handoff` handler |
| `overdrive resync` | Delegates to new `overdrive workflow map` handler |
| `overdrive knowledge` | Preserved (knowledge vault retains existing semantics under `/ovd-workflow knowledge` umbrella) |
| `overdrive hook` | Unchanged (hook integration is independent) |
| `overdrive route` | Updated to use new skill-router protocol per r3 §11 (planning-time canonical) |
| `overdrive usage` | Unchanged (token usage analytics independent) |
| (new) `overdrive workflow` | Per r3 §4 |
| (new) `overdrive plan` | Per r3 §5 |
| (new) `overdrive go` | Per r3 §6 |
| (new) `overdrive log` | Per r3 §7 |
| (existing) `overdrive install`, `verify`, `check-updates`, `self-update`, `update-skills`, `uninstall`, `help`, `list-targets` | Unchanged (installer-level) |

`workflowCommands` Set in `lib/installer.js` updated to include the new commands. The allowed-commands list in `parseArgs` updated similarly.

---

## 6. Lower-priority follow-ups (from r3 §13.3)

These are not blockers. Address after the 7 phases if the user wants them.

- **Q8 follow-up:** auto-route from `IDEA` → `EDIT` for trivially small changes (≤2 leaves, no dependency impact). Currently §5.2 always requires explicit approval. Decide later if friction warrants the shortcut.
- **Q9 follow-up:** make blind-spot expansion categories configurable per-project (some teams may skip categories like compliance).
- **Q14 follow-up:** define the format of the closure prompt when recursion reaches root (what counts as "project complete"?).
- **Q17 follow-up:** when an approved sketch is later superseded, what happens to the file? (Keep, archive, delete?)

---

## 7. Implementation log

Append a new entry after every meaningful work session. Entries are append-only; if you need to correct a prior entry, add a new entry referencing the correction.

### Entry template

```markdown
### YYYY-MM-DD HH:MM — Session N (Phase X, Task Y)

**Did:**
- bullet 1
- bullet 2

**Verified:**
- what was tested, what passed

**Decided:**
- decisions made + rationale (also append to .overdrive/decisions.md once that exists)

**Committed:**
- commit hash + message (only if user approved)

**Deviations from plan:**
- if any task was modified, note the change + why

**Next:**
- the exact next task to pick up (Phase X.Task Y) and any pre-work needed
```

### Entries

### 2026-06-08 — Session 1 (Phase 1, Research step)

**Did:**
- Read repo root (`ls -la`), `lib/`, `bin/`, `plugins/`, `scripts/`, `global-instructions/`, `skills/`.
- Read `package.json`, `bin/overdrive.js`, opening of `lib/installer.js`, opening of `lib/ovd-workflow.js`, opening of `skills/skill-router/SKILL.md`.
- Read existing slash command examples: `plugins/overdrive/commands/ovd-status.md`, `ovd-doctor.md`.
- Read `docs/ovd-workflow.md` for the documented `.overdrive/` layout.
- Read `scripts/evaluate-router.js` for the test pattern + benchmark contract.
- Searched for command routing in `installer.js`; found `workflowCommands` Set on line 18.

**Verified:**
- Node ≥18, zero runtime dependencies, pure Node + child_process + fs.
- `bin/overdrive.js` delegates everything to `lib/installer.js::main()`.
- Two CLI surfaces exist: top-level commands (install/verify/etc.) and workflow subcommands (status/resync/etc.).
- Slash commands live in `plugins/overdrive/commands/*.md`; each is a markdown file with frontmatter; body typically just instructs the AI agent to run the equivalent `overdrive <cmd>` and summarize.
- Existing slash commands: `ovd-status`, `ovd-doctor`, `ovd-install`, `ovd-update` (plus docs reference `ovd-resync`, `ovd-knowledge`, `ovd-checkpoint`).

**Key findings that require plan adjustment (surfaced to user before any code):**

1. **Skill-router is a SKILL.md document, not a Node function.** `skills/skill-router/SKILL.md` (21KB) is read by the AI agent itself as routing instructions. There is no `route()` function to patch. **Task 1.5 reshape:** the "prior-set extension" becomes (a) updating SKILL.md with a section documenting how ovd-plan surfaces leaf annotations as a prior + how the agent honors `prior_confidence` semantics, and (b) ovd-plan generating prompt context that includes the leaf's skill annotations when invoking the agent. The benchmark in `scripts/evaluate-router.js` must still pass — added skills/sections must keep the existing skill catalog coverage. This is simpler than a code patch but conceptually different from r3 §11's "skill-router.route({ prior_set })" API illustration.

2. **`.overdrive/` already exists with substantial scaffolding.** `lib/ovd-workflow.js::initWorkflow()` creates `project.md`, `state.md`, `architecture.md`, `constraints.md`, `decisions.md`, `preferences.md`, `research.md`, `changelog.md`, plus `config.json`, `file-index.json`, `knowledge-index.json`, `routes.jsonl`, and subdirs `reports/`, `handoffs/`, `knowledge/`, `work/`. Per the existing system, the entire `.overdrive/` directory is gitignored (added automatically by `ensureWorkflowGitignore()`). Our r3 §9 wants several files committed (`OVERDRIVE.md` at root yes, plus `.overdrive/codebase/`, `requirements.md`, `preferences.md`, `decisions.md`, `handoffs/`, `reports/`). **Conflicts to resolve:**
   - existing `.overdrive/architecture.md` (project-level summary) vs proposed `.overdrive/codebase/architecture.md` (codebase analysis): both can coexist with the codebase variant being the deeper analysis.
   - existing `.overdrive/decisions.md` and `.overdrive/preferences.md` (already gitignored as part of the wholesale `.overdrive/` ignore) need to be carved out as committed if we want r3's portability claim.
   - existing `.overdrive/handoffs/` (gitignored) likewise.
   - r3's `.overdrive/sessions/`, `sketches/` (outside `approved/`), `plan.cache.json` should remain gitignored.
   - **Recommendation:** add explicit `.gitignore` carve-outs (un-ignore the committed paths via `!` patterns) and keep `lib/ovd-workflow.js`'s existing file-creation as-is; ovd-plan adds new files alongside.

3. **YAML library decision.** Zero deps currently. Need to either add `js-yaml` (~80KB, battle-tested) or write a strict-subset YAML parser scoped to our `yaml ovd-plan` block format. **Recommendation: add `js-yaml`.** Writing a YAML parser is high-risk for a project where parser fragility is the largest concern per Phase 1's framing. `js-yaml` is the standard and is already used in many other Node projects; the dependency cost is small for the robustness gained.

4. **Command registration is two-surface.** To add `/ovd-plan` etc., we need:
   - **Slash command** in `plugins/overdrive/commands/ovd-plan.md` (markdown with frontmatter, body invokes `overdrive plan --project-dir $PWD`).
   - **CLI subcommand** in `lib/installer.js`: add to `workflowCommands` Set and the allowed-commands list in `parseArgs`; dispatch in `runWorkflowCommand` to a new `lib/ovd-plan.js`.
   - Pattern matches `/ovd-status` → `overdrive status` → `lib/ovd-workflow.js::status()`.

5. **The existing `lib/ovd-workflow.js` provides reusable utilities** that I should build on, not reinvent: `findProjectRoot()`, `hasProjectSignal()`, `isSafeProjectDir()`, `ensureWorkflowGitignore()`, `writeIfMissing`-style helpers in `initWorkflow()`. New `lib/ovd-plan.js` should import these.

6. **No `lib/ovd-plan.js` exists yet.** Phase 1 creates it from scratch.

**Decided:**
- Will not modify Phase 1 tasks unilaterally. Surfacing findings 1–5 to user before any code.

**Deviations from plan:**
- None yet (Research complete; tasks not started).

**Next:**
- User decisions needed on:
  - (a) YAML library: `js-yaml` (recommended) or custom parser?
  - (b) Skill-router prior-set: SKILL.md edits + prompt-context surfacing (recommended given codebase reality) or revisit r3 §11?
  - (c) Gitignore carve-outs: which `.overdrive/` paths get committed?
  - (d) File overlap with existing `ovd-workflow`: keep both layers (recommended) or consolidate?
- Once these are answered, Task 1.1 (`.overdrive/` directory scaffolding) starts. Note: scaffolding may largely reuse `lib/ovd-workflow.js` helpers; the *new* work is the additional ovd-plan subdirs + gitignore carve-outs.

### 2026-06-08 — Session 1 continued (design refinement before Task 1.1)

**Did:**
- Surfaced four decisions via AskUserQuestion (YAML lib, skill-router shape, gitignore policy, ovd-workflow coexistence).
- User locked **YAML library = js-yaml**.
- User asked to discuss skill-router (Q2) further with two probes:
  1. Can we use skill-router during planning stages, pre-resolving the prior set with full planning context?
  2. If designed from scratch, what shape would skill-router take (skill, function, API, other)?
- Provided design analysis: yes to Q1 as canonical path; four-option matrix for Q2 (A=pure skill, B=skill+helper, C=function/API, D=catalog-as-data + skill-as-narrative).
- Recommended **Option D with B-style implementation path** — helper layered on existing SKILL.md; catalog.json deferred to post-v1.
- User confirmed: "exactly how I envisioned it."

**Decided:**
- **Q1 (planning-time use): YES, canonical.** Planning-time skill resolution is the canonical path. Execution-time delta is the exception, fires only for: empty/missing annotation, low/medium confidence with observed complexity, or agent observation of need outside prior. Captured in r3 §11.2.
- **Q2 (router shape): Option D + B-style path.** Phase 1 deliverable:
  - `lib/ovd-plan/skill-router.js` — thin Node helper invoked by ovd-plan during planning.
  - Updates to `skills/skill-router/SKILL.md` adding the planning-time/execution-time protocol section.
  - Helper parses `skills/skill-router/references/catalog.md` for skill IDs (lightweight regex extraction).
  - No `catalog.json` yet (deferred to Phase 7+ if SKILL.md/catalog.md parsing proves fragile).
  - Helper does NOT make LLM calls — slash command markdown body orchestrates the host agent to answer routing prompts and call back with results.

**Edited:**
- r3 §11 — full rewrite from "Option B (route() patch)" to "Option D + B-style (catalog-as-data, planning-time canonical)." Sub-sections added: 11.1 (why refined), 11.2 (canonical flow), 11.3 (architectural shape), 11.4 (implementation path), 11.5 (confidence semantics), 11.6 (fault tolerance), 11.7 (SKILL.md update template).
- r3 §5.3.5 (new sub-section) — RESOLVE SKILLS sub-step explicitly added to Stage 5 (Plan phase) with reference back to §11.
- Implementation plan Phase 1 Task 1.5 — reshaped from "modify route() function" to "build planning-time helper + update SKILL.md." Success criteria updated; verification simplified.
- Implementation plan Phase 3 Task 3.3 — added RESOLVE SKILLS sub-step bullet under Stage 5; success criteria updated to require every leaf has `skills`, `confidence`, `rationale` annotated.

**Verified:**
- (no code yet — design refinement only)

**Committed:**
- (no commits this session — documentation updates only; user approval would be required for any commit per `feedback_git_commits.md`)

**Deviations from plan:**
- **Task 1.5 reshape (major):** original wording in r3 §11 and implementation plan implied a Node function patch. Codebase research showed skill-router is markdown-only. New shape: thin Node helper + SKILL.md edits. Same intent, different mechanism.
- **Task 3.3 expansion (minor):** explicit RESOLVE SKILLS sub-step bullet added; not a scope expansion, just making the implicit explicit.

**Key insights worth preserving (in case of context loss):**
- The skill-router as a SKILL.md (markdown for the AI agent) is intentional architecture, not a limitation. It preserves cross-agent portability (Claude / Codex / Gemini / Cursor / Antigravity all read it natively). Don't try to replace this; layer on top.
- The slash command pattern (`/ovd-*.md` body invokes `overdrive <cmd>` CLI) is the unifying mechanism. New ovd-plan commands follow the same pattern. The CLI returns structured output; the agent acts on it.
- The helper's "host agent invocation" works because the agent is what's executing the slash command. The helper generates routing prompts; the agent (already in context) answers them; the helper records.
- Existing `lib/ovd-workflow.js` already implements `.overdrive/` scaffolding with project.md, state.md, architecture.md, constraints.md, decisions.md, preferences.md, research.md, changelog.md, plus subdirs reports/, handoffs/, knowledge/, work/. Plus utilities: findProjectRoot, hasProjectSignal, isSafeProjectDir, ensureWorkflowGitignore, writeIfMissing-style helpers. Reuse these in Task 1.1.
- The existing `.overdrive/` is fully gitignored by `ensureWorkflowGitignore()`. For r3's portability claim, we need explicit `!` carve-outs (pending Q3 resolution).
- The 'planner emits low confidence' branch becomes the natural escape hatch: leaves the planner is uncertain about get full execution-time routing. This avoids forcing the planner to be confident when it shouldn't be.

**Next:**
- Resolve Q3 (gitignore policy: commit r3-specified paths via carve-outs vs keep everything ignored) and Q4 (ovd-workflow coexistence: keep both layers vs consolidate).
- Then begin Phase 1 Task 1.1.

### 2026-06-08 — Session 1 continued (Q3 + Q4 resolved, plan adjusted)

**Did:**
- Presented Q3 (gitignore policy) and Q4 (ovd-workflow coexistence) with full context and three-option recommendations.
- User accepted Q3 recommendation (carve-outs per r3 §9.1).
- User clarified Q4: my approach 3 (hybrid coexist-now / reposition-later) was too conservative. User wants approach 2 (full reposition now).
- Quoted user direction verbatim into the log for future-context preservation:
  > "AS a general rule of thumb, don't be too much influenced by the existing workflow / plan structure — those are preliminary, and we are now working precisely to draw something permanent."
  > "In terms of planning and usability, r3 precedes the existing code, what we won't touch is the pure skills, everything else can be repurposed and integrated in our plan."
  > "We have to choose the maximally beneficial option for this plan and for the final product, not previous commits."

**Decided:**
- **Q3 — Carve-outs per r3 §9.1.** The new gitignore writer (Task 1.1) replaces existing `ensureWorkflowGitignore()` wholesale `.overdrive/` ignore with explicit carve-outs. Committed: `OVERDRIVE.md` (root), `.overdrive/codebase/`, `requirements.md`, `preferences.md`, `decisions.md`, `handoffs/`, `reports/`, `sketches/approved/`. Ignored: `sessions/`, unapproved `sketches/`, `plan.cache.json`, `_legacy/`.
- **Q4 — Full reposition.** Existing `lib/ovd-workflow.js`, existing slash commands, existing `.overdrive/` files (those not in r3 §9) all get repurposed/migrated to r3 §9 layout. Migration is one-time, opt-in (user approval at `/ovd-workflow init` detect), with archive to `.overdrive/_legacy/YYYY-MM-DD-HH-MM/`. The only untouched layer is the 137 skill files.

**Edited:**
- **r3 §12** — full rewrite reflecting full reposition (not "coexistence"). Locked posture: pre-ovd-plan code is preliminary; r3 supersedes it. Skills untouched; everything else repurposed. User direction quoted verbatim. Sub-sections: what gets repurposed (12.1), what's untouched (12.2), migration semantics (12.3), internal granularity (12.4).
- **Impl plan §5A (new)** — Migration Map covering files (§5A.1), slash commands (§5A.2), CLI subcommands (§5A.3). Concrete per-file mapping with logic. The full reference for what happens to every existing artifact.
- **Impl plan Phase 1 Task 1.1** — clarified: scaffolds new layout ONLY (old-layout detection triggers a migration marker for Task 2.2 to handle); replaces wholesale `.overdrive/` ignore with the carve-out pattern; reuses existing utility functions but not the orchestration logic.
- **Impl plan Phase 2 intro** — scope clarification: gut and rebuild ovd-workflow per r3 §4; not extend. References §5A throughout.
- **Impl plan Phase 2 Task 2.2** — extended with migration detection step using Task 1.1's marker; action-path prompt before any migration.
- **Impl plan Phase 2 Task 2.2.5 (new)** — `MIGRATE` state with deliverable + behavior + success criteria + verification per §5A.1.
- **Impl plan Phase 2 Task 2.9 (new)** — Legacy slash command repurposing per §5A.2.
- **Impl plan Phase 2 done definition** — extended to cover migration and legacy command repurposing acceptance.

**Verified:**
- (no code yet — design refinement only)

**Committed:**
- (no commits this session — documentation only; awaits explicit user approval per `feedback_git_commits.md`)

**Deviations from plan:**
- None — these resolutions ARE the plan adjustments.

**Key insights worth preserving (in case of context loss):**
- The user's "maximally beneficial for the final product" principle resolved the conservative-vs-aggressive ambiguity in Q4. Default to the cleaner long-term shape, not the most backward-compatible one.
- Migration is one-time + opt-in + archive-based. The `_legacy/` archive policy keeps migration reversible without burdening normal operation. After one cycle the user can delete.
- Repurposed slash commands keep resolving (deprecation note) so existing user muscle memory doesn't break. Users see "still works, here's the new way" rather than "broken."
- The carve-out gitignore pattern was non-obvious: a wholesale `.overdrive/` ignore plus `!` patterns is a known Git idiom but easy to get subtly wrong (the `!` patterns must repeat both the dir and the `/**` glob to whitelist contents).
- Three migration outcomes per file: (a) preserved verbatim (decisions.md, preferences.md, handoffs/, reports/, knowledge/), (b) migrated with derivation (project.md → frontmatter, state.md → fragments), (c) discarded with archive (file-index.json, routes.jsonl, work/_active.json).

**Next:**
- All P0 and P1 design questions resolved. Ready to start Phase 1 Task 1.1 (scaffolding for new layout + carve-out gitignore writer).
- Task 1.1 should commit (with user approval) when complete. After that, Task 1.2 (parser) is next.

### 2026-06-08 — Session 1 continued (Phase 1 Task 1.1 COMPLETE — awaiting commit approval)

**Did:**
- Created `lib/ovd-plan/` directory.
- Wrote `lib/ovd-plan/fs.js` (203 lines) implementing:
  - Constants: `OVD_DIR`, `OVD_PLAN_FILE`, `NEW_LAYOUT_DIRS`, `NEW_LAYOUT_PLACEHOLDER_FILES`, `OLD_LAYOUT_MARKERS`, `NEW_LAYOUT_MARKERS`, `GITIGNORE_BLOCK_START/END`, `GITIGNORE_CARVE_OUT_BLOCK`.
  - Helpers (self-contained, mirror `ovd-workflow.js` semantics): `hasProjectSignal`, `isSafeProjectDir`, `ovdPath`, `newLayoutPresent`, `oldLayoutMarkerCount`.
  - Public API: `detectOldLayout(projectDir)`, `scaffoldOverdrivePlan(projectDir, opts)`, `writeGitignoreCarveOut(projectDir, opts)`.
- Wrote `scripts/test-ovd-plan-fs.js` (264 lines) with 59 checks across 12 scenarios: fresh scaffolding, idempotency, old-layout detection, partial new-layout handling, unsafe-dir rejection, dry-run, gitignore fresh / migrate / idempotent / stale-block / dry-run, detectOldLayout behaviors, OVERDRIVE.md root-file recognition.
- Wired new files into `package.json`: added `node --check` for both new files; added `test:ovd-plan` script; added it to the `verify` chain.

**Verified:**
- `npm run check` passes (all files parse cleanly).
- `npm run test:ovd-plan` → 59 checks passed.
- `node scripts/test-ovd-workflow.js` → "ovd-workflow tests passed" (no regression).
- `node scripts/evaluate-router.js` → 269 checks passed, 100% expected-skill coverage (no regression).
- Diagnostic warnings about dynamic path construction noted; mirror existing `lib/ovd-workflow.js` patterns; mitigated by `isSafeProjectDir()` project-signal check. Accepted as known.

**Decided:**
- Self-contained module (no imports from `lib/ovd-workflow.js`) to keep ovd-plan independent. Helpers duplicate `hasProjectSignal`, `isSafeProjectDir` from ovd-workflow — small cost; consolidation can happen in Phase 2 when ovd-workflow is rebuilt.
- Carve-out block uses managed-block delimiters (`# overdrive:gitignore:start` / `:end`) consistent with the existing `<!-- overdrive:global-guidelines:* -->` pattern in installer.js. Lets future updates find and rewrite the block atomically.

**Committed:**
- (pending user approval)

**Proposed commit:**
- Files added: `lib/ovd-plan/fs.js`, `scripts/test-ovd-plan-fs.js`.
- Files modified: `package.json` (script wiring).
- Message:
  ```
  ovd-plan(phase-1.task-1): scaffold .overdrive/ layout + carve-out gitignore

  Adds lib/ovd-plan/fs.js with:
  - scaffoldOverdrivePlan() — creates r3 §9 directory layout idempotently
  - writeGitignoreCarveOut() — replaces wholesale .overdrive/ ignore with
    managed-block carve-out pattern per r3 §9.1
  - detectOldLayout() — flags pre-r3 ovd-workflow projects for Phase 2 migration

  Adds scripts/test-ovd-plan-fs.js (59 checks, 12 scenarios).
  Wires both into npm run check + npm run verify.
  ```

**Deviations from plan:**
- None. Task 1.1 implemented as specified.

**Key insights worth preserving (in case of context loss):**
- The new module's helpers (`hasProjectSignal`, `isSafeProjectDir`) duplicate existing logic in `ovd-workflow.js`. Phase 2 (gut and rebuild ovd-workflow) is the natural consolidation point — extract these to a shared utility module then.
- The carve-out gitignore block uses START/END comment delimiters. Test `gi-stale-block` verifies that updates rewrite only the managed block, leaving user-added gitignore entries (outside the block) untouched.
- The `detectOldLayout` heuristic: old layout = (any of OLD_LAYOUT_MARKERS exists) AND (no NEW_LAYOUT_MARKERS exist). This handles all three cases cleanly: pre-r3 project (true), new project (false), partial migration (false — new layout dominates).
- `writeGitignoreCarveOut` has three actions: `appended-new-block` (fresh project), `migrated-wholesale-ignore` (existing project with the old `.overdrive/` line), `updated-managed-block` (existing managed block, content drifted). Each tested.

**Next:**
- Commit Task 1.1 (awaits user approval).
- Then Phase 1 Task 1.2: `OVERDRIVE.md` YAML parser. This is the parser-fragility risk task; needs careful design + golden-file fixtures. Depends on adding `js-yaml` to package.json (locked decision from Q1).

### 2026-06-08 — Session 1 continued (Phase 1 Task 1.2 COMPLETE — awaiting batched commit approval)

User direction: don't commit per-task; batch tasks and present together with a README/v2-positioning update before context clear. So Task 1.1 + 1.2 + (future) stay staged until the user calls for the consolidation commit.

**Did:**
- Added `js-yaml: ^4.1.0` to `package.json` dependencies (first runtime dep for Overdrive; locked per Q1).
- Ran `npm install` → js-yaml 4.2.0 installed + verified working.
- Wrote `lib/ovd-plan/parser.js` (~340 lines) implementing:
  - `parseOverdriveMd(content)` — public entry; returns `{ frontmatter, tree, sections }`.
  - `parseFrontmatter(content)` — extracts YAML frontmatter between `---` markers.
  - `extractManagedSections(body)` — pulls out HTML-comment-delimited managed sections (`inbox`, `capture`, `concerns`, `deliberation-state`, `archive`, `decisions`) into a `sections` map; returns body with those regions removed.
  - `parseTree(body)` — walks ATX headers, builds a recursive tree, assigns hierarchical IDs per r3 §10.2 (`I` / `I.1` / `I.1.a` / `I.1.a.i` / `I.1.a.i.A` / restart Arabic), extracts `[status]` and `← ACTIVE` markers, captures description text + `\`\`\`yaml ovd-plan` annotation block per node.
  - `parseHeaderText(text)` — pulls explicit ID prefix, title, status, active marker out of a header line.
  - `generateNodeId(parentId, depth, siblingIndex)` + `generateIdSegment(depth, index)` — position-derived IDs.
  - `toRoman(n)` — Roman numeral helper.
  - `validateTree(tree)` — enforces status enum, confidence enum, array typing on `skills`/`success`/`deps`/`considered`. Hard error on violations.
  - `ParseError` class with optional `line` annotation.
- Created `scripts/fixtures/ovd-plan/` with 8 golden-file fixtures:
  - `minimal.md` — smallest valid (frontmatter + H1 + one milestone).
  - `complete.md` — the full r3 §9.3 example with all annotation fields.
  - `deep-tree.md` — 5-level depth covering all ID notation tiers.
  - `managed-sections.md` — every managed section populated.
  - `with-descriptions-and-codeblocks.md` — exercises the "untagged code blocks belong to description, only `\`\`\`yaml ovd-plan` is annotation" rule.
  - `malformed-yaml.md` — negative test for malformed annotation YAML.
  - `invalid-status.md` — negative test for `[not-a-real-status]`.
  - `multiple-h1.md` — negative test for multiple roots.
- Wrote `scripts/test-ovd-plan-parser.js` (~280 lines) with 104 checks: Roman helper, ID generation, header parsing (5 forms), frontmatter (positive + 2 negatives), managed sections (positive + 1 negative), all 5 positive fixtures (minimal/complete/deep-tree/managed-sections/with-descriptions), 4 negative fixtures (malformed-yaml/invalid-status/multiple-h1/programmatic malformed), schema validations (confidence enum, skills array), edge cases (empty annotation block, no annotation, active without status, sibling sequence).
- Wired into `package.json`: added new files to `check` script; `test:ovd-plan` now runs both fs and parser test suites.

**Verified:**
- `npm run check` ✓
- `npm run test:ovd-plan` → 59 fs checks + 104 parser checks all pass.
- `node scripts/test-ovd-workflow.js` → "ovd-workflow tests passed" (no regression).
- `node scripts/evaluate-router.js` → 269 checks passed, 100% coverage (no regression).
- Diagnostic warnings about bracket notation on parsed YAML (lines 146, 330): false-positive — `js-yaml.load()` doesn't return prototype-injected keys; not a real risk. Accepted as known.
- Diagnostic warning about `^4.1.0` (caret semver): standard Node convention. Accepted as known.

**Decided:**
- ID generation is **position-derived**, not user-asserted. The header's explicit ID prefix (`I.`, `II.2.a`) is captured as `explicitId` but the canonical `id` field comes from sibling-position math. This means a user re-ordering headers automatically gets new canonical IDs; the explicit prefix is informational. Future writer (Task 1.3) will sync them. Mismatch detection deferred (could become a Phase 7 lint check).
- ATX-header depth maps directly to tree depth (H1 = root, H2 = milestone, etc.). Markdown caps at H6, so tree depth caps at 6 in normal use; deeper trees fall back to arabic digit IDs.
- Annotation YAML is **schema-validated immediately** on parse: invalid confidence values, non-array skills, etc. fail fast with line numbers. This honors r3 §9.3's "malformed YAML is a hard error" contract.
- Empty annotation block (`\`\`\`yaml ovd-plan` immediately followed by `\`\`\``) is allowed and parses to `{}`. Distinct from "no annotation" (annotations = null).
- Untagged code blocks (e.g., `\`\`\`yaml` without `ovd-plan` tag, `\`\`\`js`, `\`\`\``) are preserved verbatim in the node's description — important for users embedding code samples in descriptions.

**Committed:**
- (no commits this session — batching per user direction for the README/v2-positioning consolidation pass)

**Deviations from plan:**
- None. Task 1.2 implemented as specified (parser → JSON tree, malformed = hard error, IDs hierarchical per §10.2).

**Key insights worth preserving:**
- The "untagged code block must be preserved in description" rule is non-obvious but crucial — users will absolutely want to put code samples in descriptions. The parser specifically scans for `\`\`\`yaml ovd-plan` as the trigger; any other fence is description.
- Header parsing handles four optional pieces per line: explicit ID prefix, title, `[status]`, `← ACTIVE`. Each is independently optional. Tests cover all combinations.
- Empty `[]` brackets = `pending` (per r3 §9.3 example). Empty annotation block = `{}` (annotations exist, just empty). Missing annotation block = `annotations: null` (no annotation at all). Three distinct states.
- Frontmatter parser handles both CRLF (Windows) and LF (Unix) line endings by normalizing first.
- Managed sections are extracted BEFORE tree parsing, so they don't interfere with header detection. Section content can contain `#` characters without being mis-detected as headers.

**Next:**
- Phase 1 Task 1.3: `OVERDRIVE.md` writer (tree → markdown), inverse of parser. Must round-trip the canonical example with zero diff. Will share fixtures with parser tests (golden-file round-trip).

### 2026-06-08 — Session 1 continued (Phase 1 Tasks 1.3 + 1.4 COMPLETE)

**Did (Task 1.3 — writer):**
- Wrote `lib/ovd-plan/writer.js` (~190 lines) implementing:
  - `writeOverdriveMd({ frontmatter, tree, sections })` — public entry; produces full Markdown.
  - `writeFrontmatter(fm)` — emits `---`-delimited YAML with `FRONTMATTER_KEY_ORDER` for deterministic field ordering.
  - `writeTree(tree)` — recursive header + description + annotation emit.
  - `writeNode`, `writeHeader`, `writeAnnotations`, `writeDescription` — composable parts.
  - `writeManagedSections(sections)` — emits managed sections in canonical order: decisions / inbox / capture / concerns / deliberation-state / archive.
  - `reorderObject(obj, keyOrder)`, `reorderAnnotations(ann)` — deterministic key ordering for diff-friendly output.
  - Key order constants: `FRONTMATTER_KEY_ORDER`, `ANNOTATION_KEY_ORDER`, `SCOPE_KEY_ORDER`, `VERIFY_KEY_ORDER`, `REFERENCES_KEY_ORDER`, `CLUSTER_VERIFY_KEY_ORDER`.
- Wrote `scripts/test-ovd-plan-writer.js` (~220 lines) with 28 checks:
  - Reorder helpers (4 checks).
  - reorderAnnotations + nested scope/verify/references ordering (4 checks).
  - writeFrontmatter delimiter + content (3 checks).
  - writeAnnotations empty / null edge cases (2 checks).
  - writeManagedSections ordering (2 checks).
  - **Round-trip equivalence**: all 5 positive fixtures parse → write → parse → semantically equal to original (custom `treesEquivalent` deep-equal ignoring `lineNumber`).
  - Stability: write twice → identical output (1 check).
  - Status marker rendering: `pending` → `[]`, `awaiting-review` + ACTIVE marker (2 checks).
  - Auto-id round-trip when explicitId is null (1 check).
  - Description preservation including untagged code blocks (3 checks).

**Verified (Task 1.3):**
- `npm run check` ✓ (writer parses).
- `node scripts/test-ovd-plan-writer.js` → 28 checks pass.
- Parser + writer round-trip on all 5 positive fixtures with zero structural drift.

**Decided (Task 1.3):**
- **Semantic round-trip, not byte round-trip.** parse(write(parse(x))) ≡ parse(x) is the contract. Whitespace + YAML field ordering may shift on first write but stabilize on subsequent writes. Verified via the "write twice produces identical output" test.
- **Key ordering** is a quiet form of UX. When the user opens OVERDRIVE.md, fields appear in a consistent, scan-friendly order regardless of object insertion order: meta first (`inserted_by`, `skills`, `confidence`), then specification (`scope`, `success`, `deps`, `verify`), then references (`references`, `cluster_verification`, `iterations`).
- **Untagged code blocks in descriptions round-trip cleanly** — the parser ignores them as annotation candidates, the writer re-emits them as plain description. Verified.

**Did (Task 1.4 — hierarchical recursive cache):**
- Wrote `lib/ovd-plan/cache.js` (~180 lines) implementing:
  - `loadCache(projectDir)` — reads `.overdrive/plan.cache.json`; returns null on missing/stale-version/corrupt.
  - `saveCache(projectDir, cacheObject)` — atomic write (temp file + rename); injects `version: 1` + `generated_at`.
  - `regenerateCacheFrom(projectDir)` — reads `OVERDRIVE.md`, parses, flattens, saves cache. Throws if `OVERDRIVE.md` missing.
  - `flattenForCache(node)` — produces cache-friendly representation including per-container `summary` (status counts of children).
  - `summarizeChildren(node)` — `{ total, done, pending, in_progress, awaiting_review, blocked, skipped }`.
  - `findNodeById(tree, nodeId)` — walks tree returning `{ node, parents }`.
  - `isNodeClosed(node)` — leaf check (`status in {done, skipped}`) or container check (all children closed).
  - `closureCheck(tree, justClosedNodeId)` — the recursive close mechanism per r3 §7.5. Walks ancestors; returns `{ closures: [...], stops_at, reason }` where reason is one of `node-not-found`, `no-parent`, `open-siblings`, `reached-root`.
- Wrote `scripts/test-ovd-plan-cache.js` (~250 lines) with 39 checks:
  - load missing → null (1).
  - save → load round-trip (5).
  - atomic write (no .tmp leftover) (2).
  - stale version → null (1).
  - regenerateCacheFrom positive (3) + missing-file throws (1).
  - summarizeChildren correctness (5).
  - isNodeClosed for leaves + containers (4).
  - findNodeById positive + parent chain + not-found (4).
  - closureCheck: closes parent when siblings done (2), doesn't close on pending sibling (2), full walk to root (2), node-not-found (2).
  - flattenForCache summary on every node (4).

**Verified (Task 1.4):**
- `npm run check` ✓ (cache parses).
- `node scripts/test-ovd-plan-cache.js` → 39 checks pass.
- `npm run test:ovd-plan` → 59 + 104 + 28 + 39 = 230 checks pass (chained fs/parser/writer/cache).
- `node scripts/test-ovd-workflow.js` → no regression.
- `node scripts/evaluate-router.js` → 269 checks pass, no regression.

**Decided (Task 1.4):**
- **Per-container `summary` baked into cache** — eliminates re-derivation cost when displaying the tree. `summary.done === summary.total` is the closure-check primitive.
- **Atomic writes** via temp+rename. JSON write is small enough that the cost is negligible; the safety against half-written cache after a crash is worth it.
- **Stale-version returns null** rather than erroring — lets cache layer be a "best effort" surface; callers that need the cache can call `regenerateCacheFrom()` to rebuild.
- **`closureCheck` returns structured `reason`** (not just data) so callers can branch on outcome: `open-siblings` → prompt user about closing the intermediate ancestors; `reached-root` → trigger milestone-close pipeline; `node-not-found` → bug / stale ID.

**Phase 1 progress:**
- Task 1.1 (scaffolding + gitignore): ✓ 59 checks
- Task 1.2 (parser): ✓ 104 checks
- Task 1.3 (writer): ✓ 28 checks
- Task 1.4 (cache): ✓ 39 checks
- Task 1.5 (skill-router helper + SKILL.md update): next
- Task 1.6 (CLI skeletons): pending
- Task 1.7 (parser test suite — folded into Task 1.2): ✓ done as part of 1.2

230 total new checks; zero regressions in existing 269 router + ovd-workflow tests.

**Committed:**
- (batched per user direction; will consolidate before context-clear)

**Next:**
- Task 1.5: skill-router planning-time helper + SKILL.md "Planning-time vs execution-time routing" section. Must keep `evaluate-router.js` benchmark passing (269 checks).

### 2026-06-08 — Session 1 continued (Phase 1 Tasks 1.5 + 1.6 COMPLETE → PHASE 1 DONE)

**Did (Task 1.5 — skill-router helper + SKILL.md update):**
- Wrote `lib/ovd-plan/skill-router.js` (~210 lines) implementing:
  - `loadCatalogSkills(repoRoot)` — parses `skills/skill-router/references/catalog.md` via regex match on table rows ` ``\|\s*\`([a-z][a-z0-9-]*)\`\s*\|``; returns sorted unique skill IDs.
  - `buildRoutingPrompt({...})` — focused prompt for the host agent: lists available skills, includes leaf description / scope / success criteria / optional codebase context, ends with JSON reply format instructions and confidence semantics.
  - `parseRoutingResponse(text)` — extracts JSON object from agent reply (tries last-line first, then fenced ` ```json` block). Throws on parse failure with diagnostic.
  - `validateRoutingResponse(response, knownSkills)` — enforces shape: `skills: string[]`, `confidence: high|medium|low`, optional `rationale` and `considered`. Captures `unknown_skills` (those not in catalog) without failing — leaves the decision to the caller.
  - `resolvePriorSet(input, options)` — public entry. Returns `{ ok, reason, prompt, ... }` with reasons `requires-host-agent` (no answer supplied), `catalog-empty`, `parse-failed`, `validation-failed`, or success.
- Updated `skills/skill-router/SKILL.md` — added "Planning-time vs execution-time routing (ovd-plan protocol)" section right before "Hard Avoids". Documents: structured JSON reply on last line, confidence semantics with execution-time behavior per tier, skill-delta capture semantics.
- Wrote `scripts/test-ovd-plan-skill-router.js` (~250 lines) with 53 checks:
  - `loadCatalogSkills` returns ≥30 skills including key ones (planning-first, design-taste-frontend, security-review, skill-router itself).
  - `buildRoutingPrompt` includes description, scope, success criteria, confidence semantics, JSON reply instructions.
  - `parseRoutingResponse` handles last-line JSON, fenced JSON, empty/no-JSON/non-string inputs (with throws).
  - `validateRoutingResponse` accepts valid, captures unknowns non-fatally, throws on bad confidence / non-array skills / null / missing skills.
  - `resolvePriorSet` requires-host-agent mode + 5 representative leaf scenarios (UI / security / performance / research / sketch) end-to-end with mocked agent responses + diagnostic outcomes for parse-fail / validation-fail / catalog-empty.

**Verified (Task 1.5):**
- `npm run check` ✓ (helper + tests parse).
- `node scripts/test-ovd-plan-skill-router.js` → 53 checks pass.
- `node scripts/evaluate-router.js` → 269 checks pass, 100% coverage preserved after SKILL.md edit (no regression).

**Did (Task 1.6 — CLI skeletons + slash command files):**
- Wrote `lib/ovd-plan/index.js` — module entry exposing `runPlan`, `runGo`, `runLog`, `runWorkflow` as stub handlers that print `[ovd-plan] /<command> <args>` plus a one-line "Implementation in progress" notice pointing at r3 and the implementation plan. Re-exports the parser / writer / cache / fs / skill-router submodules.
- Modified `lib/installer.js`:
  - Imported `./ovd-plan`.
  - Added `plan`, `go`, `log`, `workflow` to `workflowCommands` Set.
  - Added `ovdPlanCommands` Set to discriminate the new commands.
  - Added all four to the allowed-commands list in `parseArgs`.
  - Added `small` and `positionals` to options; positional-arg capture for the four new commands so `overdrive plan idea "text"` etc. parse cleanly.
  - Added `--small` flag handler.
  - Added dispatch block in `runWorkflowCommand` that routes the four new commands to the appropriate `ovdPlan.run*` handler.
- Wrote 4 slash command markdown files in `plugins/overdrive/commands/`:
  - `ovd-plan.md`, `ovd-go.md`, `ovd-log.md`, `ovd-workflow.md`.
  - Each follows the existing `ovd-status.md`/`ovd-doctor.md` pattern: frontmatter (`description`, `argument-hint`), body that runs `overdrive <cmd> ${ARGUMENTS:-} --project-dir "$PWD"` and instructs the agent on next-step behavior.
  - Each links back to r3 sections (§4, §5, §6, §7) for the AI agent to reference.

**Verified (Task 1.6):**
- `node --check lib/installer.js` ✓.
- Smoke tests of all 4 new CLI commands:
  - `overdrive plan` → prints `[ovd-plan] /ovd-plan` + stub notice.
  - `overdrive go` → prints `[ovd-plan] /ovd-go` + stub notice.
  - `overdrive log handoff` → prints `[ovd-plan] /ovd-log handoff` + stub notice.
  - `overdrive workflow init` → prints `[ovd-plan] /ovd-workflow init` + stub notice.
  - `overdrive plan idea "add dark mode"` → prints `[ovd-plan] /ovd-plan idea "add dark mode"` + stub.
  - `overdrive go --small "tweak button"` → prints `[ovd-plan] /ovd-go tweak button --small` + stub.
- Existing `overdrive status` ✓ (no regression on existing workflow commands).
- Full `npm run check` ✓.
- Full `npm run test:ovd-plan` ✓ (59 + 104 + 28 + 39 + 53 = 283 checks).
- Full `node scripts/test-ovd-workflow.js` ✓.
- Full `node scripts/evaluate-router.js` ✓ (269 checks).

**Decided (Task 1.5):**
- Helper does NOT make LLM calls; instead returns either a prompt (`reason: requires-host-agent`) or a parsed/validated response (when caller supplies `hostAgentAnswer` from the host agent). This keeps Overdrive's zero-runtime-deps posture: the host agent (Claude / Codex / Gemini / Cursor / Antigravity) does the routing reasoning; the helper formats the question and validates the answer.
- Unknown skills (not in catalog) are **captured but non-fatal** — the host agent might have legitimate intent to use a skill that was added after catalog generation; caller can decide policy.
- SKILL.md update is purely **additive** — no existing routing rules touched. Benchmark coverage remains 269/269 / 55/55 expected-skill coverage.

**Decided (Task 1.6):**
- Stubs print a one-line "Implementation in progress" notice + literal command echo. This is a signal to anyone running the commands prematurely that the surface exists but the behavior is still landing.
- `positionals` array captures all non-flag args for the four new commands. The stub passes `subcommand` = `positionals[0]`, `text` = remaining joined. Real handlers in Phases 3-5 will parse subcommand-specifically.
- New slash commands mirror existing pattern (single body line invoking `overdrive <cmd>`). No special slash-command logic to maintain.

**Committed:**
- (still batched per user direction; no commits this session)

**Deviations from plan:**
- None. Tasks 1.5 and 1.6 implemented per plan.

**Phase 1 wrap-up:**
| Task | Status | Checks |
|---|---|---|
| 1.1 — scaffolding + gitignore | ✓ | 59 |
| 1.2 — parser | ✓ | 104 |
| 1.3 — writer | ✓ | 28 |
| 1.4 — cache | ✓ | 39 |
| 1.5 — skill-router helper + SKILL.md | ✓ | 53 + 269 router preserved |
| 1.6 — CLI skeletons + slash commands | ✓ | smoke tests |
| 1.7 — parser tests (folded into 1.2) | ✓ | (counted in 1.2) |

**Phase 1 done definition (from impl plan §5):**
- ✓ All 7 tasks complete; verification step passed for each.
- ✓ OVERDRIVE.md parser/writer round-trips the canonical example with zero structural diff.
- ✓ Cache layer correctly mirrors and walks the tree for closure checks.
- ✓ Skill-router protocol updated (markdown additive), benchmark passes.
- ✓ CLI skeletons callable.
- ⚠ Commit-per-task: deferred per user direction (batching to consolidate with README/v2-positioning).

**Phase 1 file inventory:**
New files:
- `lib/ovd-plan/fs.js` — scaffolding + carve-out gitignore + old-layout detection.
- `lib/ovd-plan/parser.js` — OVERDRIVE.md → tree.
- `lib/ovd-plan/writer.js` — tree → OVERDRIVE.md.
- `lib/ovd-plan/cache.js` — `.overdrive/plan.cache.json` + recursive closure check.
- `lib/ovd-plan/skill-router.js` — planning-time skill resolution helper.
- `lib/ovd-plan/index.js` — module entry + stub handlers.
- `plugins/overdrive/commands/ovd-plan.md`, `ovd-go.md`, `ovd-log.md`, `ovd-workflow.md` — slash commands.
- `scripts/test-ovd-plan-fs.js`, `test-ovd-plan-parser.js`, `test-ovd-plan-writer.js`, `test-ovd-plan-cache.js`, `test-ovd-plan-skill-router.js` — test suites (283 checks total).
- `scripts/fixtures/ovd-plan/*.md` — 8 golden-file fixtures.

Modified files:
- `package.json` — added `js-yaml: ^4.1.0` dependency; added new files to `check` and `test:ovd-plan` scripts.
- `lib/installer.js` — registered new commands; positional-arg + `--small` parsing; dispatch.
- `skills/skill-router/SKILL.md` — additive "Planning-time vs execution-time routing (ovd-plan protocol)" section.

**Tests added:** 283 (59 fs + 104 parser + 28 writer + 39 cache + 53 skill-router).
**Tests preserved:** 269 router + ovd-workflow suite (no regressions).

**Next:**
- Phase 2 (`/ovd-workflow` per r3 §4 + migration from old layout).
- Before starting Phase 2, recommend a consolidation pass per user direction: write Overdrive v2 positioning into the README, summarize what's been built and how it fits, then commit Phase 1 as a single coherent change with the README update.

### 2026-06-09 — Session 2 (consolidation pass — README + v2 docs + handoff dossier)

**Did:**
- **README.md** — added a single conservative section "Coming Next: Overdrive v2 (in development)" before the License section. Does not modify any existing content. Briefly describes the synthesis (v1 execution layer + new structural layer), states Phase 1 status (done, 283 tests pass, no regressions), points at `docs/ovd-plan-v2.md` for public details and `docs/superpowers/specs/` for design records.
- **docs/ovd-plan-v2.md** (new, ~220 lines) — public-facing v2 introduction. Covers: what v1 already does + what was missing; the synthesis pitch; the 4 commands; the file structure; an example OVERDRIVE.md slice; the 6 statuses; recursive closure mechanic; planning-time skill-router as consultant; relationship to existing v1 setup (migration semantics); what's untouched; the 7-phase roadmap with Phase 1 marked done; pointers to spec records and the new handoff dossier.
- **docs/superpowers/handoff/ (new directory)** — comprehensive context-handoff dossier (11 files, 3,551 lines total) designed for redundant preservation of every conversation, decision, principle, and implementation detail. Per user direction: "in the most precise, exhaustive and comprehensive way possible, so that when a context limit gets reached, and we clear the context we have absolutely everything we discussed in as much detail as possible."
  - **00-INDEX.md (81 lines)** — master index, dossier purpose, resume protocol summary, source-of-truth ordering, hard rules.
  - **01-conversation-narrative.md (297 lines)** — chronological story: origin → GSD comparison → r1 → r2 → r3 → Phase 1 Research → Phase 1 build task-by-task → current state.
  - **02-design-principles.md (267 lines)** — the 15 operating principles distilled, each with conversational source, application examples, and failure modes if forgotten.
  - **03-decisions-ledger.md (487 lines)** — every Q1-Q17 decision + Phase 1 implementation choices + posture decisions, with rationale and source.
  - **04-user-mental-model.md (282 lines)** — user communication style, design preferences, quality bar, working tempo, trust model, vocabulary preferences, observed failure modes to avoid.
  - **05-vocabulary.md (440 lines)** — glossary of every term with precise definitions, examples, and what each term does NOT mean. Project-level concepts, tree structure, statuses, contract terms, annotations, pipelines, skill-router protocol, closure mechanics, storage, workflow patterns, migration.
  - **06-rejected-alternatives.md (374 lines)** — options considered but not adopted, with the reason for rejection and conditions for revisiting. Command-surface alternatives, architecture alternatives, file-format alternatives, workflow alternatives, integration alternatives, implementation alternatives, anti-patterns to avoid.
  - **07-implementation-state.md (376 lines)** — current code state: branch, file inventory, test counts, CLI surface, slash command surface, what's NOT built (Phases 2-7), known false-positive diagnostics, architecture notes, code style observations, what to do at start of any future session.
  - **08-resume-protocol.md (280 lines)** — step-by-step pickup checklist for new sessions, common pitfalls, escalation order when stuck.
  - **09-phase-2-readiness.md (374 lines)** — forward-looking briefing for Phase 2: scope, migration map quick reference, codebase mapping design considerations, drift detection mechanics, Socratic flow notes, open questions to surface before/during Phase 2, suggested task order, estimated session count.
  - **10-conversational-pivots.md (293 lines)** — catalog of 14 design pivots with before/after and the user input that caused each.

**Verified:**
- `npm run check` ✓ (all files parse — documentation changes don't affect JS parse).
- `npm run test:ovd-plan` → 283 checks pass (no regression in Phase 1 work).
- `node scripts/test-ovd-workflow.js` ✓ (no regression).
- `node scripts/evaluate-router.js` → 269 checks pass, 100% coverage (no regression).
- All 11 handoff files present in `docs/superpowers/handoff/`.
- `docs/ovd-plan-v2.md` present.
- README modified with new section before License; no existing content touched.

**Decided:**
- **Conservative README posture:** added a single new section, no restructuring of existing sections. The v2 announcement is visible without disrupting v1's narrative flow.
- **Public v2 doc lives at `docs/ovd-plan-v2.md`** (root of `docs/`), discoverable from the README. Conservative location.
- **Handoff dossier lives at `docs/superpowers/handoff/`** alongside existing `docs/superpowers/specs/`. Committed (not gitignored) so it travels with the repo. The user signaled openness to either committed or gitignored ("possibly even creating a working gitignored directory"); the committed location is consistent with existing spec-doc patterns and preserves portability.
- **Redundancy by design:** each dossier file is self-contained enough to be read in isolation. Cross-references point to the canonical spec but readers don't need the spec to extract the file's information. This is intentional — context-clear scenarios may not allow full spec reading.
- **Index + per-task lookups:** the dossier is structured for both "read once at first resume" (00-INDEX → 08-resume-protocol → spec) and "look up specific topic" patterns. The 00-INDEX file's table of contents identifies which dossier files apply to which kinds of tasks.

**Committed:**
- (still no commits — proposing the consolidation commit at end of this session for user approval)

**Deviations from plan:**
- None. The consolidation pass executed per user direction.

**Key insights worth preserving:**
- The dossier's redundancy is intentional. The user said: *"It's highly important we do this one right, for the remaining of the project, and we have a lot uncached tokens (~531k uncached). So, please do it as comprehensively as possible."* The right error mode is over-document, not under-document.
- The dossier's audience is *future agents in fresh contexts*. Written as briefing material, not as project history for human readers. Each file says "if you're picking this up cold..." or "if you find yourself wondering...". Voice matches the pickup scenario.
- The 10-conversational-pivots.md file is novel — it catalogs the moments the design shifted with concrete before/after and the user input that caused each. Helps a new agent understand *why* r3 says what it says, not just *what* it says.
- The 09-phase-2-readiness.md file front-loads the gotchas: codebase mapper dispatch pattern (Pattern 1 vs 2), calibration system placement, decisions log format, drift detection bootstrap, task 2.9 split. These are decisions to make BEFORE building Phase 2, not during.
- Implementation plan §7 log (this very section) is now the most recent operational signal: it sits at the end of the plan doc and a fresh session can read just the last few entries to see where things stand.

**Total documentation added this session:**
- README: ~15 lines added.
- docs/ovd-plan-v2.md: 221 lines.
- docs/superpowers/handoff/: 11 files, 3,551 lines.
- Total new doc lines: ~3,787.

**Phase 1 + consolidation file inventory at end of session:**
- 6 new lib/ovd-plan/ modules.
- 4 new plugins/overdrive/commands/ slash command files.
- 5 new scripts/test-ovd-plan-* test suites.
- 8 new scripts/fixtures/ovd-plan/ fixture files.
- 12 new documentation files (ovd-plan-v2.md + 11 handoff dossier files).
- Modifications: package.json, lib/installer.js, skills/skill-router/SKILL.md (additive only), README.md (additive section).

**Next:**
- Propose the consolidation commit to user for approval.
- After commit, ready to begin Phase 2 in a new session if context allows, or in a future session per user pacing.

### 2026-06-09 — Session 3 (Phase 1 follow-up: runtime-shim regression fix)

**Context on resume:**
- Fresh agent picked up on the `feature/ovd-plan` branch after commit `23f10e0` (Phase 1 + dossier).
- Step 4 of the resume protocol (run all four regression checks) revealed `npm run test:workflow` failing with `MODULE_NOT_FOUND: js-yaml` from the installed runtime shim. `npm run check`, `npm run test:ovd-plan` (283 checks), and `npm run eval:router` (269 checks) all passed.
- Per the resume protocol hard rule ("never silently adapt a task whose success criteria appear impossible"), stopped and surfaced to user before any further reading or work. User approved a scoped Phase 1 follow-up fix.

**Root cause:**
- `lib/installer.js` line 7 had a top-level `const ovdPlan = require('./ovd-plan');` (added in Task 1.6).
- That eagerly chains `lib/ovd-plan/index.js` → `lib/ovd-plan/parser.js` → `require('js-yaml')` (added in Task 1.2).
- The installer's `copyRuntimePayload` (and the global `shouldCopy` filter) strip `node_modules/` from the runtime payload — so the installed shim at `~/.overdrive/runtime/<ver>/lib/ovd-plan/parser.js` has no resolvable `js-yaml` and crashes on *any* invocation, including `overdrive --help`.
- Test fixture `scripts/test-ovd-workflow.js` lines 446–449 invoke the installed shim's `--help` and assert it exits 0; that's what failed.

**Did:**
- **Part A (lazy-load):** in `lib/installer.js`, removed the top-level `const ovdPlan = require('./ovd-plan');` (line 7) and moved it inside the `if (ovdPlanCommands.has(command)) { … }` dispatch branch as the first statement. Only `plan`/`go`/`log`/`workflow` now load the parser; help/status/doctor/etc. do not.
- **Part B (vendor runtime deps):** in `lib/installer.js`, extended `copyRuntimePayload` to call a new helper `copyRuntimeDependencies(ctx, runtimeDir, pkg)`. The helper does a BFS over `package.json#dependencies`, recursing via each dep's own `package.json#dependencies`, de-duped via a `Set`. For each declared dep, it copies `<kitDir>/node_modules/<name>/` to `<runtimeDir>/node_modules/<name>/` via `fs.cpSync` with a new filter `shouldCopyDependency` that drops `.git`, `.github`, `.DS_Store`, `CHANGELOG.md`, `bin/`, `.bin/`, and nested `node_modules/` (transitives walked explicitly). Source-tree `shouldCopy` left alone.
- **Test belt-and-suspenders:** added one line to `scripts/test-ovd-workflow.js` after the existing runtime-payload assertions, checking that `node_modules/js-yaml/package.json` and `node_modules/js-yaml/lib` both exist in the runtime version directory.

**Verified:**
- After Part A only: `npm run test:workflow` → "ovd-workflow tests passed" (the help-shim assertions go green because they no longer transit parser.js).
- After Part B: full chain green — `npm run check` ✓, `npm run test:ovd-plan` (283 checks) ✓, `npm run test:workflow` (now including the new js-yaml vendoring assertion) ✓, `npm run eval:router` (269 checks) ✓.
- Manual sanity check via clean temp `$HOME`: installer wrote `~/.overdrive/runtime/1.0.2/node_modules/{js-yaml, argparse}/`; `js-yaml/{package.json, index.js, lib/, dist/, LICENSE, README.md}` all present; `bin/` and `CHANGELOG.md` correctly excluded; `node -e "require('js-yaml').load"` from the runtime dir returns a function (the failing path now resolves).
- Confirmed transitive walk works: `argparse` (declared by `js-yaml` even though its library path doesn't load it) was vendored.

**Decided:**
- **Two-part fix, not single.** Part A alone makes the test green (since the shim only invokes `--help`), but Part B is the correctness fix — without it, `overdrive plan` etc. would still crash from the installed shim. Both were required to avoid a latent bug surfacing the moment a user runs an ovd-plan command from the global install.
- **Dep traversal via `package.json#dependencies` rather than hard-coding `js-yaml`.** Future runtime deps will come along automatically; no further installer edits required when adding deps.
- **Filter drops `bin/` but keeps `LICENSE`.** Runtime payload doesn't need third-party CLI binaries, but it should ship licenses alongside vendored code.
- **No change to `shouldCopy`.** The source-tree copy still excludes `node_modules` (correct — kit's own `node_modules` is huge and irrelevant for the source-tree side). Vendoring is a separate code path that targets `runtimeDir/node_modules/` directly.

**Side effect noted:**
- During verification, the first manual sanity check had a shell-script bug (I set `$TMPHOME` but didn't pass it as `HOME=$TMPHOME` to the node invocation), which caused the installer to write to the agent's *actual* `$HOME/.overdrive/runtime/1.0.2/` for one run. Same version, idempotent install, no data loss — but flagged to user. The retry was clean.

**Committed:**
- **Commit 1 (fix):** `a6b0f4f` — `ovd-plan: lazy-load ovd-plan in installer + vendor js-yaml so runtime shim works`. `lib/installer.js` (lazy-load + new `copyRuntimeDependencies` / `shouldCopyDependency` helpers) + `scripts/test-ovd-workflow.js` (one-line vendoring assertion). 2 files changed, 39 insertions(+), 1 deletion(-).
- **Commit 2 (docs):** this commit. Contains this Session 3 entry + the prior agent's Phase 7 Task 7.6 addition + the Phase 7 done-definition update. `docs/superpowers/specs/2026-06-08-ovd-plan-implementation-plan.md` only. Hash will be recorded in the Session 4 wrap-up entry after this commit lands.

**Deviations from plan:**
- This is a Phase 1 follow-up that was not in the original phase plan. It exists because Session 2's verification log (claims `node scripts/test-ovd-workflow.js ✓`) and the actual state on resume disagreed — the regression was present in commit `23f10e0` but somehow not caught in Session 2's verification pass. Possible explanations: (a) verification was incomplete in Session 2 (e.g., only `npm run check` actually ran), (b) `js-yaml` was added to `node_modules` between Phase 1 verification and the commit but the test wasn't re-run, (c) test execution env differed. Not worth post-morteming further — the new `runtime payload vendors js-yaml runtime dep` assertion will catch this regression class permanently.

**Key insights worth preserving:**
- The runtime shim's whole-point-of-existence is to run *without* the source kit being on the PATH or as an `npx` target. So if the shim breaks on `--help`, every downstream integration (Claude hooks, Codex hooks, statusline, …) breaks. This is exactly why `test:workflow` exercises the installed shim end-to-end. Lesson: never skip `test:workflow` on Phase 1 or any phase that touches `lib/ovd-plan/*`, `lib/installer.js`, or new dependencies.
- The `node_modules` exclusion is intentional for source-tree copies (the kit's `node_modules/` is huge and not what you want in the runtime payload). But the *runtime* payload needs the dep tree vendored, separately. The two are different copy operations with different requirements; trying to share a single filter conflates them.
- Manual sanity checks of installer behavior should always explicitly pass `HOME=<tmp>` to the node invocation. The bash `TMPHOME=$(mktemp -d)` idiom is misleading: setting a variable doesn't automatically scope subsequent commands. This bit me on the first attempt; documenting here so future sessions don't repeat it.
- Lazy-loading of optional dispatch dependencies (Part A's pattern) is generally good practice for CLIs: it reduces cold-start cost for common commands (`--help`, `status`) and isolates failures to the specific subcommand path. Worth keeping in mind for future installer extensions.

**Next:**
- Propose Commit 1 (fix): `lib/installer.js` + `scripts/test-ovd-workflow.js`. Message: `ovd-plan: lazy-load ovd-plan in installer + vendor js-yaml so runtime shim works`. Wait for user approval.
- Then propose Commit 2 (docs): `docs/superpowers/specs/2026-06-08-ovd-plan-implementation-plan.md`. Message: `ovd-plan: docs (Phase 1 follow-up — Task 7.6 + log updates)`. Wait for user approval.
- The two 2026-06-06 spec docs (`…-design.md`, `…-handoff.md`) stay untracked per user direction — they're not pipeline-architecture files and were excluded from Phase 1's commit deliberately.
- After both commits land, resume protocol Step 5 onward: read r3 spec, then implementation plan §5 Phase 2 + §5A migration map + §7 log tail, then `09-phase-2-readiness.md`, then surface Phase 2 open questions, then begin Task 2.1.

### 2026-06-09 — Session 3 wrap-up (Phase 1 follow-up complete — both commits landed)

**Did:**
- Landed Commit 1 (`a6b0f4f`): fix only — `lib/installer.js` (lazy-load + `copyRuntimeDependencies` + `shouldCopyDependency`) and `scripts/test-ovd-workflow.js` (one-line vendoring assertion). 2 files changed, +39 / -1.
- Landed Commit 2 (`599fc8f`): docs only — this implementation plan (Phase 7 Task 7.6 from prior agent + Phase 7 done-definition update + Session 3 entry referencing Commit 1's hash). 1 file changed, +76.
- Two 2026-06-06 spec docs remained untracked per project direction; not part of either commit.

**Verified (post-Commit-2):**
- `npm run check` ✓ (all 20 files parse).
- `npm run test:ovd-plan` ✓ (283 checks across 5 suites — fs 59, parser 104, writer 28, cache 39, skill-router 53).
- `npm run test:workflow` ✓ (ovd-workflow tests passed, now including the new `runtime payload vendors js-yaml runtime dep` assertion).
- `npm run eval:router` ✓ (router benchmark 269/269; 100% expected-skill coverage).

**Branch state:**
- `feature/ovd-plan` ahead of `main` by 3 commits: `23f10e0` (Phase 1 + dossier) → `a6b0f4f` (regression fix) → `599fc8f` (this docs commit).
- Working tree clean except the two untracked 2026-06-06 spec docs (per project direction).
- No push performed; user prefers explicit push approval (none given).

**Key insights worth preserving:**
- The resume protocol's Step 4 regression-checks block is load-bearing. On this resume it caught a Phase 1 latent bug within the first ~5 minutes of work. Without it, Phase 2 work would have started on a broken Phase 1 foundation, and Phase 2's tests would have been hard to trust.
- The runtime payload's vendor-deps step is now an explicit contract via the test assertion. Future tasks that add runtime deps to `package.json` need no installer changes (the BFS walk handles them automatically), but the assertion will be a fail-safe if anyone accidentally regresses the helper.
- The "two-commit, bisectable" instinct the prior advisor agent recommended was correct: Commit 1 alone tells the complete story of the fix in `git log -p`; Commit 2 is pure documentation. Future bisects against `test:workflow` will land on `a6b0f4f` with the full explanation in the commit message — not buried under docs noise.

**Next:**
- Phase 1 follow-up is complete. The branch is back to "Phase 1 + tests green; ready for Phase 2."
- Per the user's order-of-operations Step 6: surface to user that Phase 1 follow-up is complete; pause for direction before reading r3 / impl plan §5 / Phase 2 readiness brief.
- Resume protocol Step 5 onward will pick up at: read r3 spec → impl plan §5 Phase 2 + §5A migration map + §7 log tail → `09-phase-2-readiness.md` → surface Phase 2 open questions → Task 2.1.
- Open question to user: should this Session 3 wrap-up entry get its own micro-commit, or be folded into the first Phase 2 commit alongside Task 2.1 work? My default is the latter (don't fragment the log into one-entry commits), but happy to commit now if preferred for bisect cleanliness.

### 2026-06-09 — Session 4 (Phase 2 kickoff — orientation reads + 6 open-question confirmations)

**Did:**
- Resume protocol Step 5: read r3 spec (`2026-06-08-ovd-plan-pipeline-architecture-r3.md`, full 1463 lines), with focus on §0 (resolution table), §1 (operating principles), §2 (command surface), §4 (`/ovd-workflow`), §5.3 (Socratic protocol), §9 (file structure), §10 (node schema), §11 (skill-router protocol), §12 (full reposition policy).
- Resume protocol Step 6: read impl plan §4 (cross-phase concerns), §5 Phase 2 (Tasks 2.1–2.9), §5A (Migration Map — file/slash/CLI sub-maps), §7 log tail (already touched during Session 3 fix work).
- Resume protocol Step 7: read `09-phase-2-readiness.md` (374 lines).
- Resume protocol Step 8: surfaced six Phase 2 open questions via action-path prompts; user confirmed all six per recommendations.

**Decided (Phase 2 open-question confirmations, 2026-06-09):**
- **Q1 — Codebase mapping dispatch (Task 2.3):** **Pattern 1.** CLI inspects project + emits a JSON dispatch plan (5 focused mapper prompts + module-tag scaffolding). The slash command body coordinates host-agent subagent dispatch via its task tool. No temporary metadata files on disk. Cleaner separation between CLI work (deterministic, scriptable) and agent work (LLM-driven).
- **Q2 — Calibration placement (Tasks 2.4, 2.5):** **Placeholder now.** Phase 2 Socratic flows default to "plain language" unless the user signals technical depth; Phase 3 Task 3.2 builds the real three-axis calibration and refactors the Phase 2 flows then. Lets Phase 2 ship without a Phase 3 dependency.
- **Q3 — Decisions log shape (Task 2.6 + migration):** **Legacy notes + table.** When migrating an existing project, preserve prose `.overdrive/decisions.md` verbatim under a top "Legacy notes" header; new entries from Task 2.6's `appendDecision` go into a structured markdown table below. No data lost; structure additive.
- **Q4 — Drift bootstrap (Task 2.7):** **Flag all on first run.** Missing `.overdrive/codebase/_tags.json` → every mapper file is needs-refresh; full map runs; tags get generated as a byproduct. Subsequent runs use tags for incremental drift detection.
- **Q5 — Task 2.9 timing:** **Deferred to Phase 7 polish.** `/ovd-status` and `/ovd-checkpoint` depend on `/ovd-plan` (Phase 3) and `/ovd-log` (Phase 5) existing. Wiring delegations in Phase 2 would point them at "not yet implemented" stubs. Phase 7 picks this up once targets exist. Phase 2 done-definition updated to accept this deferral; Task 2.9 annotated with deferral status.
- **Q6 — MIGRATE test fixture (Task 2.2.5 verification):** **Ship a fixture directory tree.** `scripts/fixtures/ovd-plan/legacy-project/` will hold a committed representative pre-v2 layout (project.md, state.md, architecture.md, constraints.md, decisions.md, preferences.md, research.md, changelog.md, config.json, file-index.json, knowledge-index.json, routes.jsonl, work/_active.json, and supporting subdirs). Tests copy it to temp, run migration, assert new layout matches expected.

**Edited:**
- **Task 2.9 status note** — added "Status: DEFERRED to Phase 7" block at top of the task per Q5.
- **Phase 2 done-definition** — replaced the "Legacy slash commands repurposed" bullet with explicit deferral language per Q5.

**Verified:**
- (no code change this session — orientation + decision-locking only)

**Committed:**
- (not committed yet — this entry + the Q5-driven edits sit in the working tree alongside the prior Session 3 wrap-up entry. Will be folded into the first Phase 2 commit per Session 3's default, unless user prefers a micro-commit now.)

**Deviations from plan:**
- **None substantively.** All six question answers matched the readiness brief's recommendations and the impl plan's existing scope. The only structural plan edit is the Task 2.9 deferral, which is a deliberate Q5 outcome.
- **Minor observation flagged to user (not changed):** the readiness brief's "suggested task order within Phase 2" reorders `2.1 → 2.2 → 2.2.5 → 2.6 → 2.4 → 2.5 → 2.3 → 2.7 → 2.8 → 2.9` (helper-first, big-task-last). The impl plan §5 lists tasks numerically without mandating strict order within a phase. The brief's order respects dependency direction (2.6 before 2.4/2.5 since they consume the helper; 2.3 before 2.7/2.8 since they consume its tag output). I'll follow the brief's ordering unless the user redirects.

**Key insights worth preserving:**
- The user's six-question batch was textbook action-path discipline: each Q had a concrete recommended option, a real alternative, and a "describe other" escape. Six in two batches of three (the AskUserQuestion tool's 4-per-call cap forced this) felt natural — each batch grouped semantically related decisions.
- The Pattern 1 vs Pattern 2 distinction for codebase mapping is load-bearing for Task 2.3 design. Pattern 1 means the CLI is purely deterministic (no LLM calls; emits a structured dispatch plan) and the slash command body is where the agent dispatch actually happens. This mirrors the skill-router helper pattern from Phase 1 Task 1.5 — same architectural shape ("CLI generates structured prompts; host agent does the work"). Consistency across helpers reduces cognitive load for future agents reading the codebase.
- The Q5 deferral is more conservative than the original impl plan but is the right call. It also creates an explicit Phase 7 hand-off point: a "Task 7.7 — Legacy slash command repurposing per §5A.2" addition to Phase 7 will be a natural Phase 7 kick-off task. Worth surfacing to user when Phase 7 work begins (not now).

**Next:**
- Begin **Task 2.1 — Tutorial + status display** (smallest Phase 2 task per impl plan §5; recommended starting point per readiness brief).
- Per Task 2.1 deliverable: create `lib/ovd-plan/workflow.js` exporting `runWorkflowDefault(rootDir, opts)`. Tutorial pass (~10 lines on the 4-command OVD model), status pass (inspect `.overdrive/`, report initialized state), action-path next-steps prompt per r3 §4.1.
- Plan: test cases first (or in parallel with implementation), then implementation, then verification (`npm run check` + new test suite + existing regression suite), then propose Phase 2 commit boundary to user.
- The Q1-Q6 confirmations and Phase 2 done-definition edits stay unstaged; first Phase 2 commit (likely Task 2.1) will include this Session 4 entry, the Session 3 wrap-up entry, and the Task 2.9 / done-definition edits as the doc portion alongside the new code.

### 2026-06-09 — Session 4 continued (Phase 2 Task 2.1 COMPLETE — tutorial + status display)

**Did:**
- Wrote `lib/ovd-plan/workflow.js` (~225 lines) exporting `runWorkflowDefault(rootDir, opts)` plus helpers: `inspectProject`, `inspectCodebase`, `classifyFile`, `nextStepsFor`, `formatStatusBlock`, `formatWorkflowDefault`, and the constants `CODEBASE_FILES`, `TUTORIAL_LINES`, `STATES`.
- Five project states distinguished: `uninitialized`, `legacy`, `scaffolded`, `partial`, `initialized` — each with its own dedicated next-steps action-path block per r3 §4.1.
- 10-line tutorial covering the four commands (`/ovd-workflow`, `/ovd-plan`, `/ovd-go`, `/ovd-log`), the file structure (`OVERDRIVE.md` + `.overdrive/` contents), and the action-path / recursive-closure principles.
- File classification helper (`classifyFile`) handles `missing` / `placeholder` / `populated` cleanly, with trim-tolerant placeholder matching so trailing-whitespace drift doesn't false-positive.
- Wired `lib/ovd-plan/index.js::runWorkflow` to dispatch bare invocations (no subcommand) to `workflowModule.runWorkflowDefault` after resolving `rootDir` via `lib/ovd-workflow.js::resolveProjectDir` (the only import from the legacy module — the env-fallback logic stays in one place per Phase 2 §326 "preserved as imports"). Subcommands still hit the stub (Task 2.2+ owns them).
- Updated installer dispatch (`lib/installer.js` line 398) to surface `result.text` to `printWorkflowResult`, so all ovd-plan handlers can supply pre-formatted human output. Forward-compatible — future task handlers can set `result.text` without further installer changes.
- Added `lib/ovd-plan/workflow.js` to the `npm run check` chain and `scripts/test-ovd-plan-workflow.js` to the `test:ovd-plan` chain in `package.json`.
- Wrote `scripts/test-ovd-plan-workflow.js` (~250 lines, 97 checks across 16 scenario groups): module exports, tutorial coverage, action-path escape on every state, file classification, codebase inspection counts, five-state inspection assertions, OVERDRIVE.md detection without .overdrive/, full result shape + text, null rootDir path, status-block formatting, end-to-end format, dispatch routing for bare vs subcommand.

**Verified:**
- `npm run check` ✓ (now covers 22 files: 21 previous + new workflow.js + new test script).
- `npm run test:ovd-plan` ✓ — 380 checks total (59 + 104 + 28 + 39 + 53 + **97 new**).
- `npm run test:workflow` ✓ (no regression; the existing v1 ovd-workflow test path still passes, and the runtime-shim vendoring assertion from Session 3 still holds).
- `npm run eval:router` ✓ (269/269; no skill-router regression).
- **Manual CLI smoke test** against the real bin: `node bin/overdrive.js workflow --project-dir <fresh-tmp>` prints the tutorial + uninitialized status + the four numbered next-steps options ending with the "Other — describe what you want" escape + the "Reply with the number..." instruction. `--json` mode emits the structured result. Subcommand `init` still routes to the stub as expected (Task 2.2 will replace).

**Decided:**
- **Single new file `lib/ovd-plan/workflow.js`** (not extension of legacy `lib/ovd-workflow.js`) per Phase 2 §319 "gut and rebuild rather than extend." Only import from the legacy module is `resolveProjectDir`, which Phase 2 §326 explicitly authorizes ("Existing utility functions ... preserved as imports").
- **`result.text` as the new convention** for ovd-plan handler human output. Side effect: stub handlers print via their own `console.log` (Phase 1's legacy pattern) AND `printWorkflowResult` prints `''` for them, since they don't set `result.text`. Same behavior as before — no double-print regression. Future ovd-plan tasks should set `result.text` to participate in the cleaner pattern.
- **Five-state classification** rather than a binary initialized/not. Lets the action-path prompt be precisely tailored to where the user is, per r3 §1.5 ("Transparency over autonomy when ambiguous"). The intermediate `scaffolded` and `partial` states each get their own next-steps block instead of being conflated with "uninitialized" or "initialized."
- **Tutorial as data, not as template string.** `TUTORIAL_LINES` is an exported array so tests can verify line-by-line content and downstream tooling could reformat (e.g., wrap to terminal width) without re-parsing prose.

**Committed:**
- (not yet — proposing commit boundary at end of this entry. Files in scope: `lib/ovd-plan/workflow.js` (new), `scripts/test-ovd-plan-workflow.js` (new), `lib/ovd-plan/index.js` (mod), `lib/installer.js` (mod), `package.json` (mod), `docs/superpowers/specs/2026-06-08-ovd-plan-implementation-plan.md` (mod — Session 3 wrap-up + Session 4 + Task 2.9 deferral + Phase 2 done-definition + this Task 2.1 entry).)

**Deviations from plan:**
- **None.** Task 2.1 deliverable, success criteria, and verification all hit per impl plan §5 Phase 2 Task 2.1. Result shape extends the spec slightly (the spec called for tutorial + status + next-steps; I added `state` field as an enum on the result so downstream Tasks 2.2+ can branch on it without re-deriving). Strict superset — no behavior reduction.

**Key insights worth preserving:**
- The placeholder-detection heuristic (`actual === placeholder || actual.trim() === placeholder.trim()`) is small but load-bearing: it lets the system distinguish "user has touched this file" from "scaffolding wrote it and the user hasn't engaged yet." Tasks 2.4 and 2.5 (Socratic flows) will use the same heuristic when deciding whether to append vs overwrite.
- The "every action path ends with `Other — describe what you want`" rule is now enforced by the test (`STATES.forEach` over `nextStepsFor`). If a future task adds a new state, the test will flag a missing escape automatically. That's a Phase 2-wide invariant codified.
- The bridging between `runWorkflowDefault(rootDir, opts)` (spec-API shape) and `runWorkflow(options, env)` (dispatch-convention shape) happens in `lib/ovd-plan/index.js`. Future Tasks 2.2/2.3/etc. will likely add similar bridge calls — that file becomes the canonical dispatch boundary between the CLI surface and the per-command Node modules. Worth keeping it thin (just routing + projectDir resolution); business logic stays in the per-task modules.

**Next:**
- Surface this Task 2.1 work to user for commit approval. Proposed commit boundary: "Phase 2 kickoff + Task 2.1 — tutorial + status display." Files listed under **Committed** above.
- After Task 2.1 commit lands: Task 2.2 (INIT orchestration with migration detection). Per the readiness brief's suggested order, 2.2 stubs the call to 2.2.5 (real MIGRATE) so it can land independently.

### 2026-06-09 — Session 4 continued (Phase 2 Task 2.2 COMPLETE — INIT orchestration + migration detection)

**Did:**
- Extended `lib/ovd-plan/workflow.js` (~280 new lines) with `runWorkflowInit(rootDir, opts)` plus four sub-task stubs (`runMigrateLegacy`, `runCodebaseMap`, `runPreferencesElicit`, `runRequirementsDraft`) and four action-path prompt builders (`migrationPrompt`, `mappingPrompt`, `preferencesPrompt`, `requirementsPrompt`).
- Implemented INIT as a **turn-based state machine** with six steps (`detect → migration → mapping → preferences → requirements → complete`). Each CLI invocation advances by one step. The agent (slash command body) re-invokes with the user's chosen action; the CLI itself remains non-interactive, returning either an action-path prompt (when awaiting input) or a step-completion result (when a sub-step ran).
- Migration detection routes off the project's classified state from Task 2.1's `inspectProject`:
  - `legacy` → emit migration prompt (migrate / skip-migration / other).
  - `initialized` → emit "already initialized" no-op result.
  - `uninitialized / scaffolded / partial` → `ensureScaffolded` (idempotent), emit mapping prompt.
- Each sub-step's prompt ends with the "Other — describe what you want" escape per Principle 3. The terminal `requirements` step omits `skip-all` from its allowed actions (no remaining canonical steps to skip); `mapping` and `preferences` include `skip-all` for early-abort.
- Updated installer dispatch (`lib/installer.js`) to also expose positionals[1] as `step` and positionals[2] as `action` on planOptions. `nodeRef` still aliases positionals[1] for `/ovd-go` to consume — same data, named per command context.
- Routed `subcommand === 'init'` to `runWorkflowInit` in `lib/ovd-plan/index.js`; other subcommands still hit the Phase 1 stub.
- Added 99 new test checks to `scripts/test-ovd-plan-workflow.js` covering: INIT_STEPS / action enum constants, sub-task stub shapes, prompt builder shapes (escape-always-present invariant), four required verification scenarios (fresh / legacy+migrate / legacy+skip-migration / already-initialized), individual sub-step skipping, `skip-all` early-abort, unrecognized-action re-prompting (with note), `requirements` step refusing `skip-all`, end-to-end `formatInitResult` output, `ensureScaffolded` idempotency, dispatch routing (`init` → real handler, `map` → stub).

**Verified:**
- `npm run check` ✓ (22 files, no new file to add — workflow.js + test already in check chain).
- `npm run test:ovd-plan` ✓ — **479 checks total** (59 + 104 + 28 + 39 + 53 + **196 new (97 Task 2.1 + 99 Task 2.2)**).
- `npm run test:workflow` ✓ (no v1 regression).
- `npm run eval:router` ✓ (269/269; no skill-router regression).
- **Manual CLI smoke test of the full state machine** via `node bin/overdrive.js workflow init [step action] --project-dir <tmp>`:
  - Fresh project → scaffold + mapping prompt.
  - `init mapping proceed` → codebase-map stub logged + preferences prompt.
  - `init preferences skip` → preferences-elicit [skipped] + requirements prompt.
  - `init requirements proceed` → requirements-draft stub + "Init complete. Run /ovd-plan to begin deliberation."
  - `init mapping bogus` → re-prompts mapping with `Note: Unrecognized action: bogus. Pick one of: proceed, skip, skip-all, other.`

**Decided:**
- **Turn-based state machine, not streaming dialogue.** The CLI is non-interactive (no stdin polling for user response); each invocation advances by one step. The agent drives transitions by re-invoking with `step` + `action` positionals. This mirrors Pattern 1 from Q1 (codebase mapping dispatch): CLI emits structured prompts; agent does the asking. Consistent shape across Phase 2 tasks.
- **Sub-task stubs return `{ stub: true, note }`** so the orchestrator and tests can verify "this sub-step was called" without depending on the real implementation. Tasks 2.2.5/2.3/2.4/2.5 will replace each stub with their owning logic; the orchestrator wiring stays the same.
- **Stubs live inline in `lib/ovd-plan/workflow.js`** rather than as per-task module placeholders. Phase 2 §326 keeps the new layer self-contained until the sub-tasks land; spreading stubs across files now would create cleanup work later. Each future task either replaces the stub inline or extracts to its own module — the orchestrator import stays internal.
- **Positionals-as-step-and-action, not new CLI flags.** Two reasons: (a) keeps the global `parseArgs` slim — no new flags introduced; (b) shell composition reads naturally — `overdrive workflow init migration migrate` matches the way a user would speak the choice. The `step` + `action` aliasing in planOptions documents the convention so future Phase 2 commands can re-use it.
- **`skip-all` only valid at non-terminal sub-steps.** The `requirements` step (the last canonical sub-step) doesn't expose `skip-all` because there's nothing left to skip — clicking it would be the same as clicking `skip`. The test verifies this rejection explicitly.

**Committed:**
- (not yet — proposing single-commit boundary for Task 2.2 per the commit-cleavage principle ([[feedback-commit-cleavage]]). Files in scope: `lib/ovd-plan/workflow.js` (mod, +~280), `scripts/test-ovd-plan-workflow.js` (mod, +~250 / 99 new checks), `lib/ovd-plan/index.js` (mod, +5 lines for init dispatch), `lib/installer.js` (mod, +2 lines for step/action in planOptions), `docs/superpowers/specs/2026-06-08-ovd-plan-implementation-plan.md` (mod, this entry). No new files; Task 2.1's `workflow.js` and test script just grew.)

**Deviations from plan:**
- **None.** All four required verification scenarios (fresh / legacy+migrate / legacy+skip-migration / already-initialized) pass. The orchestrator faithfully gates each canonical sub-step on user approval ("nothing implicit" per r3 §1.4 + impl plan Task 2.2 success criterion #2). Stubs are explicit per readiness brief ("2.2 needs the migration detection hook from 2.2.5 but doesn't need 2.2.5 to actually work yet — stub the migration call").
- **Minor structural addition (strict superset, not deviation):** I exported the `INIT_STEPS`, `MIGRATION_ACTIONS`, `CANONICAL_ACTIONS`, `REQUIREMENTS_ACTIONS` constants so the test can assert against them as ground truth. Future Phase 2 tasks can also import them for cross-task consistency.

**Key insights worth preserving:**
- The turn-based state machine pattern decouples the **dialogue** (which the agent owns) from the **state** (which the CLI owns). The CLI never asks; it only reports what state it's in and what choices are available. This means: (a) the CLI works the same whether invoked by an LLM agent or a script; (b) tests don't need to mock stdin/prompt UI — they just walk the state machine programmatically. Worth preserving for Phase 3+ tasks that need similar interactive flows (deliberation, idea pipeline).
- **The stub-tracking convention (`stub: true` + `note: 'Task X.Y placeholder...'`)** is small but loud. It makes it obvious in CLI output, in test assertions, and in JSON consumers when a downstream task hasn't landed yet. Future Phase 2 tasks (2.2.5, 2.3, 2.4, 2.5) just drop the `stub: true` marker when their real implementation replaces the stub. The orchestrator and tests need no rewiring.
- **`skip-all` at non-terminal steps but not at the last sub-step** is a tiny UX detail that prevented action-path confusion. Users would otherwise have a `skip-all` option that means literally the same as `skip` — that's the kind of small inconsistency that erodes trust in the surface. The test for `requirements` rejecting `skip-all` enforces the invariant going forward.
- **`ensureScaffolded` is now the canonical idempotent path** for any code that needs the new layout in place. It either calls `fsHelpers.scaffoldOverdrivePlan` (first time) or no-ops with `action: 'already-scaffolded'`. Phase 2 Tasks 2.3/2.4/2.5 can call this freely without worrying about double-scaffolding.

**Next:**
- Surface Task 2.2 work for commit approval. Proposed boundary: single commit `ovd-plan(phase-2.task-2): INIT orchestration with migration detection`. All code + tests + this log entry go together per [[feedback-commit-cleavage]]; the legacy + 2026-06-06 spec docs stay untracked per project direction.
- After Task 2.2 commit lands: **Task 2.2.5 — MIGRATE state** (real implementation of legacy `.overdrive/` migration per §5A.1). This is where the `runMigrateLegacy` stub gets replaced with the real per-file migration + archive logic, and where the test fixture directory `scripts/fixtures/ovd-plan/legacy-project/` gets shipped (per Q6 confirmation).

### 2026-06-10 — Session 5 (Phase 2 Task 2.2.5 COMPLETE — real MIGRATE state)

**Did:**
- Created `lib/ovd-plan/migrate.js` (~370 lines) with `runMigrateLegacy(rootDir, opts)` as the real Task 2.2.5 implementation per impl plan §5A.1. Two modes: `full` (per-file derivation + archive) and `archive-only` (archive only; no derivation). Returns a structured report (`migrated`, `archived`, `conflicts`, `summary`, `scaffolded`).
- Per-file derivation per §5A.1:
  - `project.md` → `OVERDRIVE.md` frontmatter `project:` + `description:` (extracts first H1 as title, first non-empty paragraph as description).
  - `state.md` → `.overdrive/sessions/<ts>-legacy-state.md` only (preserves original prose verbatim under a migration header). **No frontmatter mutation** — per §5A.1, "Active focus → `active_node` (best-effort fuzzy match against tree if present, else free-text in session file)"; at migration time there's no tree yet, so the focus goes only to the session file. Phase 3's `/ovd-plan` will set `active_node:` properly once the tree exists.
  - `architecture.md` → `.overdrive/codebase/architecture.md` (prepended `## Notes from previous workflow` header preserving the legacy prose verbatim).
  - `constraints.md` → `.overdrive/preferences.md` under a `## Vetoes` section (appended; section created if missing).
  - `decisions.md` (preserved-in-place; per Q3): if user prose is present, wrapped with `## Legacy notes` header at top + `## Structured log` with the v2 table beneath. If only a v1 or v2 placeholder is present, replaced with the v2 placeholder.
  - `research.md` → `.overdrive/sessions/_research_legacy.md` (one-time archive of legacy research notes).
  - `changelog.md` → `.overdrive/reports/_changelog_legacy.md` (one-time archive).
  - `config.json` → merged v2 config (preserves all legacy keys, bumps `version: 2`, adds `migratedAt`, `migratedFromVersion`). Malformed legacy JSON tolerated — wrapped as `{ malformedLegacy: true }` + noted in the report.
  - `file-index.json`, `knowledge-index.json`, `routes.jsonl`, `work/`, `.overdrive.json` → archived only (no derivation; replaced by mapper output + drift detection + session files + plan.cache.json + the new v2 marker scaffold).
- `preferences.md`, `reports/`, `handoffs/`, `knowledge/` preserved in place — they're already r3-aligned per §5A.1.
- **Order of operations** (load-bearing): `runMigrateLegacy` reads all legacy file contents into memory first, then archives originals, *then* runs derivation. This resolves the same-path collision for `config.json` (legacy v1 at `.overdrive/config.json` is moved to `_legacy/<ts>/config.json`; merged v2 is then written cleanly to the now-empty path).
- **Conflict semantics**: if a new-layout target already exists (e.g., user manually created `OVERDRIVE.md` before migrating), the existing file is preserved and the would-be derivation is recorded in `report.conflicts[]`. Legacy original is still archived. No new-layout file is ever overwritten.
- **Idempotency**: `isAlreadyMigrated(rootDir)` checks for `OVERDRIVE.md` + `.overdrive/codebase/` + absence of legacy markers; re-running migration on a migrated project returns `{ ok: true, alreadyMigrated: true }` with no further moves.
- Wired into `lib/ovd-plan/workflow.js` by replacing the inline `runMigrateLegacy` stub with `migrateModule.runMigrateLegacy`. The orchestrator's log entry shape now reads `{ step: 'migrate', mode, migrated, archived, conflicts, note: summary }` instead of `{ step: 'migrate', stub: true, mode, note }` — the migration result's `summary` (e.g., `"8 migrated, 12 archived, mode=full"`) flows into the log entry's `note` field.
- The orchestrator result also carries the full `migration` report when the migration step ran, so callers (tests / agents) can introspect counts + conflicts without re-parsing the log.
- Shipped the committed fixture at `scripts/fixtures/ovd-plan/legacy-project/` per Q6 confirmation: a representative pre-v2 project with all 10 LEGACY_FILES + work/ subtree (`_active.json`, `scratchpad.md`) + r3-aligned files (`decisions.md` with prose, `preferences.md` with the legacy table, `reports/2026-05-04-v1-dashboard.md`, `handoffs/2026-05-12-pre-reposition.md`, `knowledge/onboarding.md`) + `.overdrive.json` marker + a project-signal `package.json`.
- Wrote `scripts/test-ovd-plan-migrate.js` (~340 lines, **147 checks** across 19 scenario groups): module surface, timestamp shape, all four derivation helpers (`deriveProjectFromProjectMd`, `deriveStateFromStateMd`, `mergeConfig`, `appendUnderHeader`, `wrapLegacyDecisions`), `buildOverdriveMd` parser round-trip, `isAlreadyMigrated`, full end-to-end migration on the fixture (Scenario A with detailed asserts on every derived path + archive), archive-only mode (Scenario B), idempotency, OVERDRIVE.md conflict handling, empty `.overdrive/`, no `.overdrive/` at all (`nothingToMigrate`), malformed legacy `config.json`, null rootDir, `summarize` helper, fixture sanity.
- Updated `scripts/test-ovd-plan-workflow.js` test #19 and Scenarios B.2/C.2 to reflect the post-stub orchestrator shape (`stub: true` no longer in migrate log entries; migrate counts and `result.migration` report now visible).

**Verified:**
- `npm run check` ✓ (24 files; added `lib/ovd-plan/migrate.js` + `scripts/test-ovd-plan-migrate.js`).
- `npm run test:ovd-plan` ✓ — **630 checks total** (59 + 104 + 28 + 39 + 53 + **200** workflow + **147** migrate).
- `npm run test:workflow` ✓ (no v1 regression).
- `npm run eval:router` ✓ (269/269; no skill-router regression).
- **Manual CLI smoke test** copied the fixture to a temp dir and walked the full flow:
  - `overdrive workflow --project-dir <fixture>` → reports `Status: legacy`.
  - `overdrive workflow init` → emits migration prompt with three options + Other escape.
  - `overdrive workflow init migration migrate` → log shows `migrate: 8 migrated, 12 archived, mode=full` + scaffold skipped (already-scaffolded by derivation). Post-migration: `OVERDRIVE.md` at root with derived project name; `.overdrive/_legacy/<ts>/` contains the 10 archived files + work/ subtree + .overdrive.json marker (12 entries); `.overdrive/codebase/architecture.md` has the prepended header + legacy prose; `decisions.md` has Legacy notes + structured table; `preferences.md` has the original entries plus the constraints appended under `## Vetoes`; `sessions/_research_legacy.md` + `reports/_changelog_legacy.md` exist; `config.json` is the merged v2 (legacy keys preserved, `version: 2`, `migratedFromVersion: 1`); `reports/`, `handoffs/`, `knowledge/` preserved in place.
  - Re-running `overdrive workflow init` shows `Status: partial` and emits the mapping prompt (codebase mapping is the natural next step; the migration didn't run mapper agents — that's Task 2.3). Detection correctly identifies the project as no longer legacy.

**Decided:**
- **Archive-first, derive-second** ordering inside `runMigrateLegacy`. The naive order (derive then archive) creates a same-path collision for `config.json` because the legacy and the merged v2 both target `.overdrive/config.json` — the archive step then re-moves the merged file. Reading legacy content into memory before archiving lets us archive first, then write derivations to clean paths, with zero collisions.
- **`migrate.js` as its own module** (not inline in `workflow.js`). 370 lines of migration logic is enough to warrant separation; tests for migration semantics are cleaner with a dedicated test file (`scripts/test-ovd-plan-migrate.js`); the workflow orchestrator just imports `runMigrateLegacy` and treats it as a black box. Pattern matches Phase 1's separation of `fs.js`, `parser.js`, `writer.js`, `cache.js`, `skill-router.js`.
- **`decisions.md` and `preferences.md` are r3-aligned and never archived**, even in `archive-only` mode. Both have valid r3 locations per §5A.1; archiving them would discard live user data. The `archive-only` mode preserves them verbatim; the `full` mode preserves them too but appends/wraps content. Defensible against the Task 2.2 action-path prompt text ("archive the legacy directory") because the "legacy directory" semantically means files that are *legacy-specific*, not r3-aligned files.
- **`malformedLegacy: true` over throw**. Migration must not crash on real-world data drift; the user can clean up later. A note in `report.notes[]` surfaces the issue so it's visible.
- **Per Q3 confirmation**: legacy prose `decisions.md` → "Legacy notes" header preserving the prose + "Structured log" header + the v2 table. v1 or v2 placeholders → replaced with the v2 placeholder (no wrap noise).
- **`runMigrateLegacy` lives in `migrate.js`; `workflow.js` re-exports via `migrateModule.runMigrateLegacy`**. Keeps the orchestrator's import surface stable for any future test or consumer.

**Committed:**
- (not yet — proposing single-commit boundary per [[feedback-commit-cleavage]]. Files in scope: `lib/ovd-plan/migrate.js` (new), `scripts/test-ovd-plan-migrate.js` (new), `scripts/fixtures/ovd-plan/legacy-project/` (new, 19 files), `lib/ovd-plan/workflow.js` (mod — stub → delegate + log shape), `scripts/test-ovd-plan-workflow.js` (mod — test #19 + B.2/C.2 updated), `package.json` (mod — check + test:ovd-plan chains), `docs/superpowers/specs/2026-06-08-ovd-plan-implementation-plan.md` (mod, this entry).)

**Deviations from plan:**
- **None substantively.** All four impl plan §5 Task 2.2.5 success criteria pass: every listed old file handled; no new-layout file overwritten (conflicts surfaced); archive dir created with timestamped path; idempotent re-runs.
- **One implementation detail not spelled out in §5A.1:** the order-of-operations (archive first, derive second). The plan doesn't specify; the natural-reading order would be derive-then-archive, but that breaks for `config.json`. Documented in the decisions block above as the canonical order.
- **Modest scope extension (strict superset):** the result now carries a `summary` string (e.g., `"8 migrated, 12 archived, mode=full"`) that the orchestrator promotes into its log entry's `note` field. Not in the spec; useful for human readability without changing data shape.

**Key insights worth preserving:**
- **The same-path collision pattern** generalizes beyond `config.json`. Any future migration that derives a new file at the same path as a legacy file (e.g., if `state.md` ever migrates back to itself, or a new `config-v3` schema collides) will need the same archive-first, derive-second order. The runMigrateLegacy structure makes this explicit and avoidable.
- **The fixture directory is the migration's contract**. The committed `scripts/fixtures/ovd-plan/legacy-project/` is what "a representative pre-v2 project" looks like; any future change to the migration logic must keep the fixture's full-migration outputs stable (or update the fixture *and* the impl plan). This is essentially a golden-file test for the entire migration surface.
- **`isAlreadyMigrated` is the canonical "is this project on r3?" check**. It's three-part: OVERDRIVE.md present + .overdrive/codebase/ present + no legacy markers. Phase 2 Tasks 2.3/2.4/2.5 can use it to skip re-running heavy operations. Worth keeping prominent in the module's exports.
- **Per-file actions are enumerated in `report.migrated[].action`** (`frontmatter-derived`, `session-file`, `header-prepended`, `appended-under-vetoes`, `legacy-notes-wrapped`, `normalized-placeholder`, `preserved-in-place`, `one-time-archive`, `merged-v2`). Future analytics or debugging can pivot on this enum without re-deriving from file paths. Worth keeping stable across versions.

**Next:**
- Surface Task 2.2.5 work for commit approval. Proposed boundary: single commit `ovd-plan(phase-2.task-2.5): MIGRATE state — real legacy → r3 layout migration`. All code + tests + fixture + this log entry go together; the 2026-06-06 spec docs stay untracked per project direction.
- After Task 2.2.5 commit lands: **Task 2.6 — DECISIONS LOG** (small, append-only helper that Tasks 2.4/2.5/3.x will reuse). Per the readiness brief's suggested order, this lands before the Socratic flows.

### 2026-06-10 — Session 6 (Phase 2 Task 2.6 COMPLETE — decisions log helper)

**Did:**
- Created `lib/ovd-plan/decisions-log.js` (~135 lines) exporting `appendDecision(rootDir, entry)`, `readDecisions(rootDir)`, plus the supporting helpers (`buildRow`, `escapeCell`, `findTableSpan`, `parseRow`, `buildPlaceholderWithFirstRow`, `decisionsPath`, `todayDate`) and the format constants (`TABLE_HEADER`, `TABLE_DIVIDER`, `DIVIDER_PATTERN`, `ROW_PATTERN`).
- `appendDecision` handles three states cleanly:
  - **Fresh / empty file** → writes the v2 placeholder (header + descriptive paragraph + table header + divider) and the first row. Result: `{ action: 'created', totalRows: 1 }`.
  - **Existing file with table** (placeholder, populated, or legacy-wrapped) → finds the divider via `DIVIDER_PATTERN`, walks downward until the run of `|...|` rows ends, splices the new row after the last existing row. Result: `{ action: 'appended', totalRows: <count> }`.
  - **Existing file without a table** (prose-only) → appends the table structure (header + divider + row) at the end. Result: `{ action: 'table-appended', totalRows: 1 }`.
- Append-only semantics: identical entries appended twice produce two rows (no de-duplication). The helper is the canonical write API; the caller decides whether duplicates matter.
- Markdown table safety: pipes (`|`) inside any cell value are escaped to `\|`; newlines (`\n`, `\r\n`) are replaced with `<br>` so the row stays a single line. `readDecisions` un-escapes both on read-back, so round-trips preserve user content exactly.
- Compatible with the migration-produced layout (Q3): when `decisions.md` has a "Legacy notes" section at top + a "Structured log" section with the v2 table below, `appendDecision` finds the structured table and appends without disturbing the legacy notes prose.
- `readDecisions(rootDir)` parses the table back into structured `{ date, node, decision, rationale }` objects (in insertion order). Designed for Task 2.4 / 2.5 / 3.x callers that need to display recent decisions during Socratic flows or planning.
- Wired into `lib/ovd-plan/index.js`: top-level `appendDecision` / `readDecisions` exports for convenient call sites, plus a `decisionsLog: decisionsLogModule` namespace export for code that wants the constants or helpers.
- Wrote `scripts/test-ovd-plan-decisions.js` (~280 lines, **81 checks across 21 scenarios**): module surface, todayDate shape, escapeCell edge cases (null/undefined/number/pipe/newline/CRLF), buildRow shape + defaults, placeholder-builder structure, findTableSpan boundary cases, parseRow round-trip (including pipe + newline preservation), validation (null rootDir / missing decision / empty decision), fresh-file `created` path, multi-append `totalRows` increments + insertion order, existing-placeholder `appended` path, legacy-wrapped file (Legacy notes + Structured log) append, prose-only `table-appended` path, pipe-escaping in file + un-escaping on read, multiline rationale `<br>` ↔ `\n`, `readDecisions` for missing/no-table/null-rootDir, append-only (no dedup), index.js dispatch via `ovdPlan.appendDecision` / `ovdPlan.readDecisions` / `ovdPlan.decisionsLog.*`, `decisionsPath` path resolution.

**Verified:**
- `npm run check` ✓ (26 files now in chain — added `lib/ovd-plan/decisions-log.js` + `scripts/test-ovd-plan-decisions.js`).
- `npm run test:ovd-plan` ✓ — **714 checks total** (59 + 104 + 28 + 39 + 53 + 200 + 150 + **81 new**).
- `npm run test:workflow` ✓ (no v1 regression).
- `npm run eval:router` ✓ (269/269).

**Decided:**
- **Dedicated module (`decisions-log.js`)** rather than inline in `workflow.js`. Same reasoning as `migrate.js`: Tasks 2.4/2.5/3.x will call `appendDecision` from outside the workflow orchestrator, so coupling it to `workflow.js` would force unnecessary imports. The module is small (~135 lines including helpers) but the API boundary is clean.
- **Two-level export surface** — `ovdPlan.appendDecision` for direct calls (the 95% case) plus `ovdPlan.decisionsLog` as a namespace for callers that need constants (e.g., a UI renderer that wants to render the same table header). Mirrors the `ovdPlan.workflow` / `ovdPlan.skillRouter` precedent.
- **Pipe + newline escape strategy**: backslash-escape pipes, `<br>`-replace newlines. Both round-trip cleanly via `readDecisions`. Chose `<br>` over `\n` because `\n` literal inside a Markdown table cell breaks the table; `<br>` renders as a line break in any markdown viewer and is recoverable by the parser.
- **Append-only by contract.** No de-dup; callers can check with `readDecisions` first if they need it. Keeps the helper's responsibility narrow.
- **`DIVIDER_PATTERN` accepts loose alignment markers** (`:---`, `---:`, `:---:`) so the helper works against tables produced by hand or other tools, not just our exact v2 placeholder.

**Committed:**
- (not yet — proposing single-commit boundary per [[feedback-commit-cleavage]]. Files in scope: `lib/ovd-plan/decisions-log.js` (new), `scripts/test-ovd-plan-decisions.js` (new), `lib/ovd-plan/index.js` (mod — require + exports), `package.json` (mod — check + test:ovd-plan chains), `docs/superpowers/specs/2026-06-08-ovd-plan-implementation-plan.md` (mod, this entry).)

**Deviations from plan:**
- **None.** Task 2.6 deliverable and success criteria all met:
  - Append never overwrites existing entries → enforced by splicing the new row after the last existing row, never inside or replacing.
  - Table header created on first write; not duplicated thereafter → verified by tests (action transitions from `created` to `appended` and the file content has exactly one header).
  - Used by every other phase that records decisions → exported at top-level for `ovdPlan.appendDecision` call sites (Phase 3/4/5 can adopt directly).

**Key insights worth preserving:**
- **`appendDecision` is now the canonical write surface for `.overdrive/decisions.md`.** Migration's `wrapLegacyDecisions` produces a file with an empty structured table at the bottom; `appendDecision` extends that table without re-writing the file. Phase 3's `/ovd-plan` (when it records design decisions during deliberation) should call `appendDecision` rather than hand-writing markdown. Phase 4's `/ovd-go` similarly when execution-time decisions surface.
- **The `Legacy notes + Structured log` layout from Q3 confirms its design value here.** A user migrating from v1 keeps their prose decisions intact (Legacy notes section) AND the structured table grows naturally as the project continues. `appendDecision`'s `findTableSpan` walks past any prose to land at the table; no ambiguity.
- **`<br>` for newlines is a small but load-bearing detail.** Markdown tables don't tolerate raw newlines inside cells; `<br>` is the standard escape. Future Socratic flows in Tasks 2.4/2.5 can accept multi-line rationale from the user without breaking the table.

**Next:**
- Surface Task 2.6 work for commit approval. Proposed boundary: single commit `ovd-plan(phase-2.task-6): decisions log helper (appendDecision / readDecisions)`. All code + tests + this log entry go together; the 2026-06-06 spec docs stay untracked.
- After Task 2.6 commit lands: **Task 2.4 — PREFERENCES ELICIT** (Socratic flow capturing vetoes, coding style, workflow, communication into `.overdrive/preferences.md`). Per readiness brief, the Socratic flow uses the simple placeholder calibration (default plain language); Phase 3 Task 3.2 wires in the real calibration system later. Task 2.6's `appendDecision` is available for any decisions surfaced during the elicitation.

### 2026-06-10 — Session 7 (Phase 2 Task 2.4 COMPLETE — preferences elicit Socratic flow)

**Did:**
- Created `lib/ovd-plan/preferences-elicit.js` (~190 lines) implementing the Socratic elicitation flow per r3 §4.5 + Q2 confirmation (placeholder calibration; no real three-axis calibration system until Phase 3 Task 3.2).
- **Two-mode CLI helper** mirroring Q1's Pattern 1 (codebase mapping): the CLI is non-interactive; the agent drives the actual Socratic conversation. Modes:
  - **`plan`** (default) — emits a structured prompting plan: 4 categories (`vetoes`, `codingStyle`, `workflow`, `communication`), per-category header + seed question + 4 example anchors, current file state (`missing` / `placeholder` / `populated`) so the agent doesn't re-ask what's already captured, and explicit commit-mode instructions for the agent to follow.
  - **`commit`** — accepts a structured `entries` object keyed by category, normalizes per-category values (strings → 1-elem arrays; arrays → trimmed + empty-filtered), and appends each non-empty entry as a `- bullet` under its `## Section` header in `.overdrive/preferences.md`. Returns counts per category + summary line.
- Reuses `appendUnderHeader` from `lib/ovd-plan/migrate.js` (the canonical implementation already used for migration's constraints-to-Vetoes path) so the surface behaves identically whether prefs originate from migration or fresh elicitation.
- CLI surface: `overdrive workflow preferences` for plan, `overdrive workflow preferences commit --entries-json '<JSON>'` for commit. Added `--entries-json` as a new flag in `parseArgs` (alongside the existing `--message`, `--reason`, etc.); flowed through `workflowOptions` and into the index.js dispatch. JSON parse errors are caught at the dispatch layer with a helpful error message; the file is never partially written on a bad payload.
- Wired into `lib/ovd-plan/index.js` with a new `subcommand === 'preferences'` route (plan/commit decided by presence of `--entries-json` or `step === 'commit'`). Plus top-level `runPreferencesElicit` export and a `preferencesElicit: preferencesElicitModule` namespace for callers needing `CATEGORIES` / `CATEGORY_HEADERS` constants.
- The orchestrator's preferences-proceed branch in `runWorkflowInit` now invokes the real handler in plan mode (no longer the stub). Its log entry uses `note: sub.summary || sub.note` to accept both shapes — `summary` for real handlers, `note` for the remaining stubs (Tasks 2.3 / 2.5).
- Stub-marker check in `scripts/test-ovd-plan-workflow.js` test #19 split: runMigrateLegacy and runPreferencesElicit are real now (no `stub: true`); runCodebaseMap (Task 2.3) and runRequirementsDraft (Task 2.5) remain stubs.
- Scenario A.3 assertion (`log contains preferences-elicit stub`) updated to assert the real handler ran (`e.stub !== true`).
- Wrote `scripts/test-ovd-plan-preferences.js` (~310 lines, **80 checks across 19 scenarios**): module surface (CATEGORIES / CATEGORY_KEYS / CATEGORY_HEADERS), preferencesPath, detectCategoryState for missing/placeholder/populated, buildPlan shape + populated-section detection, normalizeEntries happy path + validation tolerance (non-object → false, array → false, number value → false, unknown category gets recorded + dropped, empty-string entries trimmed + filtered), applyEntries fresh-file + preserve-existing + multi-bullet, runPreferencesElicit plan mode + commit mode (4 entries across 3 categories) + invalid entries + null rootDir, dispatch routing for plan mode + commit mode + malformed `--entries-json`, namespace + top-level exports, formatPlan/formatCommit output shape, **migration-compat scenario** (a preferences.md produced by Task 2.2.5's constraints migration is correctly extended without disturbing the legacy v1 table or constraint prose).

**Verified:**
- `npm run check` ✓ (28 files now in chain — added `lib/ovd-plan/preferences-elicit.js` + `scripts/test-ovd-plan-preferences.js`).
- `npm run test:ovd-plan` ✓ — **795 checks total** (59 + 104 + 28 + 39 + 53 + 201 workflow + 150 migrate + 81 decisions + **80 new preferences**). Workflow gained +1 from the test-#19 expansion (split runPreferencesElicit assertions).
- `npm run test:workflow` ✓ (no v1 regression — `--entries-json` flag is additive).
- `npm run eval:router` ✓ (269/269).
- **Manual CLI smoke test**:
  - `overdrive workflow preferences --project-dir <tmp>` — emits the full plan with all 4 categories, their current state (`missing` for a fresh project), seed questions, and example anchors. Trailing line tells the agent how to call `commit --entries-json '<JSON>'`.
  - `overdrive workflow preferences commit --project-dir <tmp> --entries-json '{"vetoes":[...],...}'` — writes the entries cleanly to `.overdrive/preferences.md`; output reports totals per category. File-read confirms each bullet lands under the correct `##` section.
  - `overdrive workflow preferences commit --entries-json '{ broken'` — fails fast with `Invalid --entries-json: Expected property name or '}' in JSON at position 2`. No file write.

**Decided:**
- **Two-mode helper (plan + commit), not a turn-based state machine.** Mirrors Q1 Pattern 1 for codebase mapping — the agent owns the dialogue; the CLI emits structure + writes structure. Avoids shell-quoting hell for multi-line / multi-category user responses (`--entries-json` carries the whole payload as one quoted JSON string). The state-machine pattern from Task 2.2's INIT orchestration applies to *gating* sub-steps, not to *driving Socratic conversations inside a sub-step*.
- **`appendUnderHeader` reused from `migrate.js`** instead of duplicated. Single source of truth for the "find `## Section`, append body, create section if missing" semantics. If a future markdown utility module emerges, both call sites move together cleanly.
- **Entry normalization is permissive on input shape (string OR array of strings) but strict on top-level shape (object only, with known category keys).** Unknown categories are recorded in `unknownCategories[]` but don't fail the commit — the known categories still apply. This lets future schema extensions (e.g., a new `testing` category) coexist with older client agents.
- **JSON parse errors at the dispatch layer, not deeper.** The parse happens in `index.js::runWorkflow` *before* calling `runPreferencesElicit`, so a bad payload never touches the file or the per-category writer. Reported as `{ ok: false, status: 'preferences-elicit', mode: 'commit', reason, text }`.
- **`CATEGORY_KEYS` is camelCase (`codingStyle`)** rather than kebab-case (`coding-style`) so JSON payloads are clean JavaScript identifiers. The literal `## Section` header is title-case (`Coding style`) per r3 §4.5 / placeholder format. `CATEGORY_HEADERS` is the explicit mapping between the two.
- **Plan-mode `instructions[]` is a structured array, not a single prose blob.** Lets the agent emit them as a numbered list or skip rendering if the UX warrants. Keeps the contract explicit for future agents reading the plan structure programmatically.

**Committed:**
- (not yet — proposing single-commit boundary per [[feedback-commit-cleavage]]. Files in scope: `lib/ovd-plan/preferences-elicit.js` (new), `scripts/test-ovd-plan-preferences.js` (new), `lib/ovd-plan/workflow.js` (mod — stub → delegate; canonical log push accepts `summary || note`), `lib/ovd-plan/index.js` (mod — require + exports + subcommand route + JSON parse guard), `lib/installer.js` (mod — `--entries-json` flag + `workflowOptions` propagation), `scripts/test-ovd-plan-workflow.js` (mod — test #19 + Scenario A.3 updated), `package.json` (mod — check + test:ovd-plan chains), `docs/superpowers/specs/2026-06-08-ovd-plan-implementation-plan.md` (mod, this entry).)

**Deviations from plan:**
- **None substantively.** Task 2.4 success criteria all met:
  - User-driven, one question at a time, never barrages → enforced by the agent-side dialogue + the plan's `instructions` block explicitly stating "one question per turn."
  - If user has nothing to say, accepts empty/default → normalizeEntries treats `null`/empty arrays as no-op per category, no bullets added.
  - Produces structured markdown file with sectioned categories → preserved by reusing the v2 placeholder layout + appendUnderHeader.
- **Modest scope extension (strict superset):** added a `migration-compat` test scenario that wasn't required by the spec, asserting that a preferences.md produced by Task 2.2.5 (legacy v1 table + migrated constraints under `## Vetoes`) is extended cleanly by `runPreferencesElicit(commit)`. Same kind of cross-task seam check the migration test established for OVERDRIVE.md round-trip.

**Key insights worth preserving:**
- **The plan/commit pattern is the canonical shape for Phase 2 Socratic flows.** Task 2.5 (Requirements draft) should ship the same way: same 2-mode helper, same `--entries-json` payload, different category set (`functional`, `nonFunctional`, `outOfScope`). The `appendUnderHeader` reuse + the `normalizeEntries` validation surface + the test fixture structure are all reusable. If Task 2.5 deviates from this shape, that's a real divergence worth flagging.
- **`--entries-json` is now the canonical Phase 2 mechanism for batch user-data submission.** Future tasks that need similar structured input (e.g., a "set initial scope" prompt, a "capture decisions made elsewhere" import) should reuse this flag rather than inventing new ones. Single shell-quoting story for the whole CLI surface.
- **The orchestrator's log push (`note: sub.summary || sub.note`) is the bridging contract** between old-stub shape and new-real-handler shape. Tasks 2.3 / 2.5 don't need orchestrator changes when they land — they just stop returning `stub: true` and start returning `summary`; the log entry shape stays stable.

**Next:**
- Surface Task 2.4 work for commit approval. Proposed boundary: single commit `ovd-plan(phase-2.task-4): preferences elicit (plan + commit modes)`. All code + tests + this log entry go together; the 2026-06-06 spec docs stay untracked.
- After Task 2.4 commit lands: **Task 2.5 — REQUIREMENTS DRAFT** (Socratic flow capturing functional / non-functional / out-of-scope requirements into `.overdrive/requirements.md`). Same two-mode shape as Task 2.4 with a different category set per r3 §4.5; the `appendUnderHeader` + `normalizeEntries` + `--entries-json` machinery is fully reusable. Estimated scope: ~60% of Task 2.4's effort (smaller category set, no new CLI flags needed).

### 2026-06-11 — Session 8 (Phase 2 Task 2.5 COMPLETE — requirements draft Socratic flow)

**Did:**
- Created `lib/ovd-plan/requirements-draft.js` (~220 lines) implementing the Socratic flow for `.overdrive/requirements.md` per r3 §4.5. Mirrors `preferences-elicit.js` shape exactly — two modes (plan / commit), same dispatch contract, same `appendUnderHeader` reuse, same `normalizeEntries` tolerance semantics — so the user-facing UX is identical to a returning user who has already gone through preferences.
- Three categories per r3 §4.5: `functional` (## Functional), `nonFunctional` (## Non-functional, hyphenated), `outOfScope` (## Out of scope, multi-word). Headers match the v2 placeholder file `fs.NEW_LAYOUT_PLACEHOLDER_FILES['requirements.md']`.
- Plan mode includes a slightly richer `instructions[]` than preferences:
  - Standard "one question per turn" guidance.
  - Decompose-long-answers-into-atomic-bullets rule (requirements should be one short sentence each, not multi-clause).
  - Non-functional probe-the-dimensions hint (perf / security / a11y / scalability / observability) so the agent doesn't let the user skip past common bars.
  - Out-of-scope treat-as-boundary-marker hint (capture any "we won't do X" the user offers in conversation, even informally).
- Commit mode is identical in structure to preferences: takes `entries` keyed by `functional` / `nonFunctional` / `outOfScope`, normalizes (string → array; trim + empty-filter; reject non-object top-level; reject non-string array contents; record unknown categories without failing), and appends each non-empty bullet under its `## Section`.
- Wired into `lib/ovd-plan/index.js` with a new `subcommand === 'requirements'` route. The JSON-parse-error guard at the dispatch layer (already established for preferences) is duplicated for requirements with status string `'requirements-draft'`. No new CLI flags needed — `--entries-json` introduced in Task 2.4 is fully reusable.
- Replaced the inline `runRequirementsDraft` stub in `lib/ovd-plan/workflow.js` with a delegate to the new module. The canonical step config's runner is now `(root) => runRequirementsDraft(root, {})` matching the preferences pattern (explicit empty opts for plan mode).
- Updated `scripts/test-ovd-plan-workflow.js`: test #19 now asserts runRequirementsDraft has no stub flag (parallel to the runPreferencesElicit assertion). Scenario A.4 assertion updated to require the real handler ran (`e.stub !== true`).
- Wrote `scripts/test-ovd-plan-requirements.js` (~310 lines, **88 checks across 19 scenarios**): module surface (3 categories, expected keys + headers including hyphen + multi-word), placeholder-file headers cross-check, requirementsPath resolution, detectCategoryState for missing/placeholder/populated (with explicit assertions on the hyphenated and multi-word headers), buildPlan shape + instructions richness, normalizeEntries happy path + validation + tolerance (non-object, array, null, number value, unknown category, empty-string trimming), applyEntries fresh-file + preserve-existing, runRequirementsDraft plan + commit + invalid + null rootDir, dispatch routing for plan + commit + malformed JSON, namespace + top-level exports, formatPlan/formatCommit output (including hyphenated-header rendering), **end-to-end roundtrip** (plan-state changes from missing → populated after commit; empty-category commit leaves that category as placeholder), **migration-compat** (pre-existing requirements.md with user content is extended, not replaced).

**Verified:**
- `npm run check` ✓ (30 files now in chain — added `lib/ovd-plan/requirements-draft.js` + `scripts/test-ovd-plan-requirements.js`).
- `npm run test:ovd-plan` ✓ — **885 checks total** (59 + 104 + 28 + 39 + 53 + 203 workflow + 150 migrate + 81 decisions + 80 preferences + **88 new requirements**; workflow gained +2 from the new runRequirementsDraft assertions in test #19).
- `npm run test:workflow` ✓ (no v1 regression — `--entries-json` reuse means no new flag surface).
- `npm run eval:router` ✓ (269/269).
- **CLI smoke test**:
  - `overdrive workflow requirements --project-dir <tmp>` — emits plan with all 3 categories + their full questions + example anchors + `missing` state for a fresh project. The hyphenated "Non-functional" and multi-word "Out of scope" headers render correctly.
  - `overdrive workflow requirements commit --project-dir <tmp> --entries-json '{"functional":["SSO sign-in","CSV export"],"nonFunctional":["WCAG AA","p95 <300ms"],"outOfScope":["no IE11"]}'` — writes 5 entries cleanly to `requirements.md` under correct sections. File read confirms placeholder structure preserved + bullets land in right places (including under `## Non-functional` and `## Out of scope`).

**Decided:**
- **Verbatim mirror of Task 2.4 shape, no refactoring to a shared elicit utility.** The two modules diverge in: (a) category dictionary, (b) one extra `instructions[]` line for non-functional probing. Extracting a shared base would be premature abstraction with only 2 callers and meaningful per-flow content. If Task 3.x or beyond adds a third Socratic flow with similar shape, that's the natural extraction point.
- **Hyphenated header (`Non-functional`) confirmed safe in the regex.** `new RegExp('^##\\s+Non-functional\\s*$', 'm')` matches literally because `-` outside character classes is literal. Same for multi-word `Out of scope` — spaces match spaces. Tests assert this explicitly so a future header-renaming regression is caught.
- **`instructions[]` content per-flow.** preferences and requirements share the "ONE question per turn" / "skip means empty array" base, but requirements adds the decompose-into-atomic-bullets rule and the non-functional dimension probe. These are flow-specific Socratic hygiene rules; they belong with the flow that needs them.
- **CLI flag set unchanged.** `--entries-json` covers both Task 2.4 and Task 2.5. If Task 2.3 (codebase mapping) or future Task 3.x needs a different structured payload, evaluate whether `--entries-json` generalizes vs introducing a parallel flag. Default position: reuse `--entries-json`.

**Committed:**
- (not yet — proposing single-commit boundary per [[feedback-commit-cleavage]]. Files in scope: `lib/ovd-plan/requirements-draft.js` (new), `scripts/test-ovd-plan-requirements.js` (new), `lib/ovd-plan/workflow.js` (mod — stub → delegate + runner update), `lib/ovd-plan/index.js` (mod — require + exports + dispatch route + JSON parse guard), `scripts/test-ovd-plan-workflow.js` (mod — test #19 split for runRequirementsDraft; Scenario A.4 updated), `package.json` (mod — check + test:ovd-plan chains), `docs/superpowers/specs/2026-06-08-ovd-plan-implementation-plan.md` (mod, this entry).)

**Deviations from plan:**
- **None.** Task 2.5 success criteria all met:
  - Same Socratic discipline as preferences → mirror module structure + identical instructions[] base.
  - Distinguishes functional from non-functional explicitly → 3 separate categories, 3 distinct `## Section` headers, 3 separate prompting questions.
- **Modest scope extension (strict superset, parallel to Task 2.4):** migration-compat test scenario added — a pre-existing requirements.md (which can come from any source: prior session, human edit, Task 2.2.5 migration) is extended cleanly without disturbing existing content.

**Key insights worth preserving:**
- **The plan/commit pattern is now confirmed cross-flow.** Two consecutive Phase 2 tasks (2.4 preferences, 2.5 requirements) used the identical skeleton successfully. This is the canonical Socratic-flow CLI contract; future Phase 3+ tasks adding similar dialogue surfaces should default to this shape unless they have a concrete reason to diverge.
- **`appendUnderHeader` from migrate.js has now served three consumers** (migration's constraints→preferences/Vetoes; Task 2.4's preferences commit; Task 2.5's requirements commit). It's load-bearing infrastructure now — any future change to its semantics needs to land with explicit consideration of all three call sites + cross-task tests.
- **Phase 2 has now established the "stub today, real handler tomorrow" transition cleanly** for three stubs (`runMigrateLegacy` → Task 2.2.5, `runPreferencesElicit` → Task 2.4, `runRequirementsDraft` → Task 2.5). The remaining stub in `workflow.js` is `runCodebaseMap` for Task 2.3, which uses the same orchestrator-log-push contract (`note: sub.summary || sub.note`). Task 2.3 lands without touching the orchestrator.

**Next:**
- Surface Task 2.5 work for commit approval. Proposed boundary: single commit `ovd-plan(phase-2.task-5): requirements draft (plan + commit modes)`. All code + tests + this log entry go together; the 2026-06-06 spec docs stay untracked.
- After Task 2.5 commit lands: per the readiness brief, the next Phase 2 tasks in dependency order are **Task 2.3 — CODEBASE MAP** (5 parallel mapper agents via Q1 Pattern 1; the dispatch shape is already proven by Tasks 2.4 + 2.5), then **Task 2.7 — Drift detection** (depends on 2.3's tag output), then **Task 2.8 — MAP REFRESH** (depends on 2.7). Task 2.9 (legacy slash command repurposing) is deferred to Phase 7 per Q5 confirmation.

---

## 8. Glossary / quick decision reference

- **OVERDRIVE.md** — root plan tree file, human-readable Markdown, committed to git.
- **`.overdrive/`** — supporting context directory: codebase analysis, preferences, requirements, decisions, handoffs, sessions, sketches, reports, cache.
- **Leaf** — a node with no children; the unit of execution.
- **Cluster** — a non-leaf node; the unit of planning and organization.
- **Contract** — the complete spec for a leaf: scope, skills, success_criteria, verification, deps, references.
- **Recursive close** — when a leaf closes, the system walks up to parent → grandparent → … → root, asking the user to approve each level.
- **Iteration loop** — implementation → verify → awaiting-review → user feedback → either done or back to implementation with deltas.
- **Action path** — numbered options + "describe other" escape, presented at every pause point.
- **Prior set** — list of skills annotated to a leaf at planning time, passed to skill-router as canonical.
- **Delta** — runtime addition to the prior set by skill-router when the task reveals unexpected complexity.
- **Calibration** — the user's level on domain / technical / scope axes, used to adjust presentation depth.
- **Hierarchical ID** — short position-derived ID: I, II, II.2, II.2.a, II.2.a.i (Roman → Arabic → lowercase letter → lowercase Roman → uppercase letter).
- **Awaiting-review** — status between in-progress and done; user approval (not auto-verify pass) closes a leaf.
- **Blind-spot expansion** — planner inserts agent-proposed nodes for typically-missed categories; user prunes.

### Decisions reference

| Item | Decision | Source |
|---|---|---|
| Commands | `/ovd-workflow`, `/ovd-plan`, `/ovd-go`, `/ovd-log` | r3 §2 |
| Hierarchical IDs | I, 1, a, i, A | r3 §10.2 |
| Field syntax | Fenced YAML blocks tagged `yaml ovd-plan` | r3 §9.3 |
| Skill-router integration | Native `prior_set` mode (Option B) | r3 §11 |
| Status enum | pending, in-progress, awaiting-review, done, blocked, skipped | r3 §10 |
| Failure escalation | 2 fix attempts, then user | r3 §6.9 |
| Closure | Recursive, user-approved per level | r3 §1.9, §7.5 |
| Commit | User approval always | auto-memory `feedback_git_commits.md` |
| Codebase mapping | Owned by `/ovd-workflow`, 5 parallel mappers, drift-detected | r3 §4 |
| Multi-project | One `.overdrive/` per repo; multiple projects = root-level nodes | r3 §1.13 |

---

*This implementation plan is the resume-safe source of truth. On any new session, read this document fully, then r3, then check Section 7 for where to pick up. Phase 1 is ready to start when the user gives the go-ahead.*
