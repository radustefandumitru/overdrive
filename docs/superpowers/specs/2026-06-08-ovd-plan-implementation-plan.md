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
  - **Tie-break before prompting (Q4.10 lock, Session 19):** when fuzzy matches remain ambiguous, apply `depth (leaves > containers) → active milestone → pending status`; only prompt if still ambiguous after these.
  - **Auto-pick announcement (Q4.10 orchestrator amendment — Pattern 7):** when the tie-break resolves to a single auto-pick, the result MUST be announced with a cancel option before execution proceeds (e.g. "Matched II.2.a Widget layout design — reply 'continue' to proceed or describe a different target"). Never silently execute an auto-resolved node-ref. ≈5–10 lines + ≈3 test checks.
- **Verification:** unit test against fixture tree (incl. tie-break ordering + announce/cancel hygiene).
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
- **Q3.3A.10 follow-up (Phase 3 Slice A finding):** r3 §10.1 leaf field name alignment with writer canonical. The §10.1 example documents leaf annotations as `success_criteria`, `dependencies`, `verification`, and `scope.{files_touched, files_read_only, out_of_scope}`; the Phase 1 parser/writer (load-bearing round-trip contract) uses `success`, `deps`, `verify`, and `scope.{in, read_only, out}`. Slice A (Stage 5 leaf emission) uses the writer-canonical names per the round-trip contract — Phase 3 is not the place to rewrite Phase 1. Resolution: either an r4 amendment that updates §10.1's example to writer-canonical names, or a Phase 7 polish task that aligns code with r3 (would touch parser + writer + 100+ test checks for cosmetic gain). Recommend the r4 amendment as the cheaper durable fix. Scoped here per Failure Mode #8 so the deferral does not disappear.
- **Q3.4.1-followup (Phase 3 Task 3.4 finding):** r3 §5.3 lists Blind-spot expansion as "Stage 3" between Elicit and Spec, but r3 §5.3.4's example node IDs (II.4, III.1, III.2) presume a Spec'd milestone backbone already exists. The implementation places `blind_spot` between `spec` and `plan` in STAGES per §5.3.4's content (data-flow wins over numerical ordering — same precedent as Slice A's 6-stage vs r3's 8-stage conceptual list). r4 amendment should either renumber §5.3 stages to match data-flow ordering OR update §5.3.4's example to use IDs that pre-date Spec. Recommend the renumbering as the simpler fix. Scoped here per Failure Mode #8.
- **Q3.3C-followup (Phase 3 Task 3.3 Slice C finding):** r3 has no §6.X (or §5.X) covering `/ovd-plan verify` as a retrospective-audit subcommand. Slice C added the user-facing subcommand route in `lib/ovd-plan/index.js` per Session 16 §Next's stated intent, but the spec's §6.6 is specifically `/ovd-go verify` (post-execution LEAF VERIFY / CLUSTER VERIFY), not `/ovd-plan verify`. r4 amendment should add §6.7 (or §5.8) documenting the `/ovd-plan verify` user-facing surface: retrospective audit semantics (no deliberation-state stage transition), tree-source precedence (proposed-first-fallback-to-committed via `resolveTreeFromOpened`), plan/commit-mode dispatch shape (Pattern 1 + Pattern 4 inheritance from the helper), and the canonical action paths (accept-and-commit / iterate-via-deliberate / describe-other). Scoped here per Failure Mode #8 so the spec-vs-code gap does not disappear.
- **Q3.4.2-followup (Phase 3 Task 3.4 + completion commit finding):** r3 §5.3.4's example renders blind-spot-inserted nodes with the short `[agent]` tag (lines 304-308); r3 §10.4 specifies the verbose `[proposed-by-agent: <one-line-reason>]` form for the `inserted_by` field surface. The completion commit (2026-06-16) ships the verbose form per orchestrator direction — Pattern 7 transparency lock — across `blind-spot.js` (prune review) + `display.js` (tree render). **r4 amendment should align r3 §5.3.4's example with §10.4's authoritative tag form**, removing the spec-vs-spec divergence the implementer had to navigate. Recommend the §5.3.4 example update as the cheaper fix (does not affect the §10.4 field-spec authority). Scoped here per Failure Mode #8 so the lingering example divergence does not disappear.
- **Q3.7.1-followup (Phase 3 Task 3.7 finding — Concern C from comprehensive review):** §5 Phase 3 Task 3.7 plan said RESEARCH findings could be "attached to the inbox or to a specific node." Phase 3 ships inbox + sessions-file outputs only; the "specific node attachment" mode is NOT implemented. The implementation parallel is Q17's `references.sketches[]` field on a leaf — RESEARCH would need a `references.research[]` field + an `entries.attach_to_leaf: <node_id>` commit-mode flag that writes the sessions file path into the leaf's `references.research[]` array. **Phase 7 deferral accepted** (per orchestrator 2026-06-16). r4 may add §10.X documenting the `references.research[]` schema if the user wants the surface formalized before Phase 7. Scoped here per Failure Mode #8 so the deferral does not disappear.
- **Q3.6.1-followup (Phase 3 Task 3.6 finding — Concern D from comprehensive review):** §5 Phase 3 Task 3.6 plan said EDIT "triggers internal `DOC UPDATE` if the change affects documented surfaces." Phase 3 ships a one-line text recommendation only (`Recommend: /ovd-workflow refresh ...`); no actual doc-write. **The full DOC UPDATE flow has a Phase 5 dependency, not Phase 7**: Phase 5 Task 5.7 builds `runDocUpdate` (the cross-doc-write surface that walks committed nodes + updates per-file documentation surfaces). Task 3.6 EDIT will wire to `runDocUpdate` when Phase 5 ships — the wiring is mechanical (call `runDocUpdate(rootDir, { changedNodes })` after EDIT applies); the design + helper live in Phase 5. **Phase 5 target verbatim per orchestrator 2026-06-16.** Scoped here per Failure Mode #8 so the cross-phase dependency does not disappear.
- **Q4.2.1-followup (Phase 4 Task 4.2 finding — pre-flight surface-conflict):** §5 Phase 4 Task 4.2's deliverable says LEAF EXECUTE "invokes `skill-router.route()` with `prior_set` + `prior_confidence: "high"`." This wording is **outdated** — r3 §11.1 records that Phase 1 research confirmed skill-router is a SKILL.md document read by the agent, **there is no code-level `route()` function**. The canonical execution flow (r3 §11.2) is: the agent reads the leaf's pre-resolved `skills` annotation, loads those SKILL.md files, and executes — **no router consultation** on the canonical path; SKILL DELTA (re-invocation) is the exception. Task 4.2 ships this correctly as a Pattern-1 dispatch (`execute.js` reads `leaf.skills` as the prior, emits the execution plan, never calls a router). **r4/impl-plan amendment should rewrite the §5 Task 4.2 deliverable wording to match r3 §11.2** (Pattern-1 dispatch reading the annotation), removing the stale `route()` phrasing. Scoped here per Failure Mode #8 so the spec-vs-code wording gap does not disappear.

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

### 2026-06-11 — Phase 2 mid-phase wrap-up (5/8 tasks done; Task 2.3 onward to next session)

**Context:** Session 8 ended right after Task 2.5 commit `a5fa5ba`. Context budget hit ~80% — too tight to start Task 2.3 (codebase mapping, design-heavy, needs ~50% of a fresh session per the readiness brief). User instructed: stop here, write this wrap-up, hand off to next session.

This entry sits **uncommitted** in the working tree on purpose. The next session folds it into the Task 2.3 commit (along with the Task 2.3 work + Task 2.3 session entry).

**Phase 2 progress: 5 of 8 net tasks complete.**

Done so far (numerical):
- **Task 2.1** — `/ovd-workflow` tutorial + status display (`runWorkflowDefault`). Commit `2b6db6e`.
- **Task 2.2** — INIT orchestration with migration detection (`runWorkflowInit` turn-based state machine; six steps; stubs for sub-tasks). Commit `ed9cb3f`.
- **Task 2.2.5** — MIGRATE state (real per-file migration + archive per §5A.1; committed fixture at `scripts/fixtures/ovd-plan/legacy-project/`; archive-first/derive-second order resolves same-path collision for `config.json`). Commit `f710436`.
- **Task 2.6** — Decisions log helper (`appendDecision` / `readDecisions`; markdown table safety with pipe escape + `<br>` newlines; legacy-wrapped layout compatibility). Commit `f29cb16`.
- **Task 2.4** — Preferences elicit Socratic flow (plan + commit modes; `--entries-json` flag introduced; 4 categories per r3 §4.5). Commit `1902a9e`.
- **Task 2.5** — Requirements draft Socratic flow (verbatim mirror of Task 2.4 with 3 categories per r3 §4.5; hyphenated + multi-word headers). Commit `a5fa5ba`.

Remaining in Phase 2:
- **Task 2.3 — CODEBASE MAP** (design-heavy; 5 parallel mapper agents producing `architecture.md` / `patterns.md` / `tech-stack.md` / `quality.md` / `concerns.md`; Pattern 1 dispatch from Q1 confirmation). The next session should surface the Task 2.3 design choices upfront (mapper prompt design; per-mapper module-tag schema for drift detection; output format consistency across mappers).
- **Task 2.7 — Drift detection** (depends on 2.3's tag output; per-mapper-file `needsRefresh` signal; first-run = flag-everything per Q4 confirmation).
- **Task 2.8 — MAP REFRESH** (depends on 2.7; incremental re-run of only the flagged mapper files; preserves discovered-during-execution sections that Phase 4 will append).
- **Task 2.9 — Legacy slash command repurposing** — DEFERRED to Phase 7 per Q5 confirmation. Not part of remaining Phase 2 scope.

**The five Q1–Q6 decisions are all locked and applied:**
1. **Q1 (codebase mapping dispatch):** Pattern 1 — CLI emits dispatch plan; slash command body coordinates host-agent subagent dispatch. *Now proven by Tasks 2.4 + 2.5's two-mode plan/commit pattern (CLI emits plan; agent drives Socratic dialogue; commit happens via `--entries-json`).* Task 2.3 follows the same shape: CLI emits 5 focused mapper prompts + module-tag scaffold; agent dispatches subagents and writes results back.
2. **Q2 (calibration placement):** Placeholder calibration in Phase 2; real three-axis system in Phase 3 Task 3.2. Tasks 2.4 + 2.5 ship with plain-language defaults; Phase 3 swap is local to the prompt-building logic.
3. **Q3 (decisions log shape):** Legacy notes + structured table. Implemented in `migrate.js::wrapLegacyDecisions` and respected by Task 2.6's `appendDecision` (walks past Legacy notes prose to land at the Structured log table).
4. **Q4 (drift bootstrap):** Flag everything on first run. Task 2.7 will encode this when it lands.
5. **Q5 (Task 2.9 timing):** Defer to Phase 7. Task 2.9 stub in §5 explicitly notes the deferral; Phase 2 done-definition accepts it.
6. **Q6 (MIGRATE fixture):** Ship `scripts/fixtures/ovd-plan/legacy-project/`. Done at Task 2.2.5; 19 files committed.

**Architectural patterns established for Phase 2 — these MUST carry into Task 2.3 and beyond:**

- **Pattern 1 dispatch (Q1).** CLI is non-interactive; agent drives interactive work. CLI emits structured plans (categories with questions/prompts; dispatch plans with subagent prompts) and accepts batched results via flags (`--entries-json`). Tasks 2.4 + 2.5 are the precedent; Task 2.3 follows.
- **Single canonical primitives, reused across handlers.** `appendUnderHeader` (from `migrate.js`) has now served three consumers: migration's constraints → preferences/Vetoes; Task 2.4's preferences commit; Task 2.5's requirements commit. `normalizeEntries` shape (string → array; trim + empty-filter; reject non-object/number; unknown categories logged without failing) is duplicated identically in `preferences-elicit.js` and `requirements-draft.js`. If a third Socratic flow appears, extract to a shared `lib/ovd-plan/elicit-helpers.js`.
- **JSON parse guard at the dispatch layer, BEFORE any file write.** Bad payload → `{ ok: false, reason, text }` with no partial write. Tasks 2.4 + 2.5 both implement this. Task 2.3 should follow if it accepts any agent-batched payload.
- **Migration-compat tested explicitly.** Each Phase 2 task that writes to a `.overdrive/*` file gets a test that asserts a pre-existing (migration-produced) file is extended cleanly, not replaced. The cross-task seam is easy to break; explicit tests pay off.
- **Log-push compatibility: `note: sub.summary || sub.note`.** The orchestrator in `runWorkflowInit` accepts both stub-shape (`stub: true; note: '<placeholder text>'`) and real-handler-shape (`summary: 'N entries across M categories'`) without orchestrator changes. Task 2.3 lands without touching the orchestrator — it just stops returning `stub: true` and starts returning `summary`.
- **Two-mode plan/commit for Socratic flows.** Plan mode is `default` (no opts.entries; no `--entries-json`); commit mode requires entries. The dispatch layer decides via `options.entriesJson` presence OR `options.step === 'commit'`. This contract is encoded twice now (2.4 + 2.5); it's canonical.

**Aggregate test count after Task 2.5 commit: 885 passing.**

Breakdown:
- `npm run test:ovd-plan` (885 total):
  - fs: 59
  - parser: 104
  - writer: 28
  - cache: 39
  - skill-router: 53
  - workflow: 203
  - migrate: 150
  - decisions-log: 81
  - preferences-elicit: 80
  - requirements-draft: 88
- `npm run test:workflow`: 4 checks pass (existing v1 ovd-workflow tests; unchanged across Phase 2).
- `npm run eval:router`: 269/269 (100% expected-skill coverage; unchanged).
- `npm run check`: 30 files parse cleanly.

**Branch state at session end (uncommitted bits):**

- `feature/ovd-plan` is 8 commits ahead of `main`:
  ```
  a5fa5ba  ovd-plan(phase-2.task-5): requirements draft (plan + commit modes)
  1902a9e  ovd-plan(phase-2.task-4): preferences elicit (plan + commit modes)
  f29cb16  ovd-plan(phase-2.task-6): decisions log helper
  f710436  ovd-plan(phase-2.task-2.5): MIGRATE state -- real legacy -> r3 layout migration
  ed9cb3f  ovd-plan(phase-2.task-2): INIT orchestration with migration detection
  2b6db6e  ovd-plan(phase-2.task-1): tutorial + status display for /ovd-workflow
  599fc8f  ovd-plan: docs (Phase 1 follow-up -- Task 7.6 + log updates)
  a6b0f4f  ovd-plan: lazy-load ovd-plan in installer + vendor js-yaml so runtime shim works
  23f10e0  ovd-plan: Phase 1 foundation + Overdrive v2 design records
  ```
- Working tree at session end:
  - **M** `docs/superpowers/specs/2026-06-08-ovd-plan-implementation-plan.md` — this Phase 2 mid-phase wrap-up entry. Uncommitted; for the next session to fold into the Task 2.3 commit.
  - **??** `docs/superpowers/specs/2026-06-06-ovd-plan-design.md` — still untracked per project direction.
  - **??** `docs/superpowers/specs/2026-06-06-ovd-plan-handoff.md` — still untracked per project direction.
- No push. The user has not asked for one; per the hard rules, no push without explicit approval.

**Next session pickup point:**

1. Resume protocol: read this entry first, then the most recent Session 8 + Session 7 + earlier sessions if needed. The §7 log is the canonical "where are we" reference.
2. Verify the four regression checks are still green (they should be — no work between this entry and the next session).
3. **Begin Task 2.3 — CODEBASE MAP.** Per Q1 (Pattern 1), the design surface to confirm with the user upfront:
   - **Mapper prompt design.** Each of the 5 mappers (`architecture` / `patterns` / `tech-stack` / `quality` / `concerns`) needs a focused prompt that scopes its analysis. The prompts should be similar in shape (overview / components / evidence with file paths and line numbers / risks per r3 §4.3) but differ in their core question. Confirm prompt-per-mapper as the right granularity vs a single all-domains prompt with a focus-area hint.
   - **Module-tag schema for drift detection.** Each mapper records the set of source modules it analyzed. Schema for `.overdrive/codebase/_tags.json`: per-mapper-file, list of source paths. Confirm the path-glob shape (e.g., `src/**/*` vs explicit per-file lists) and whether tags include hashes for change detection.
   - **CLI vs agent boundary.** The CLI emits the dispatch plan (5 prompts + tag scaffolding). The slash command body coordinates the host agent's subagent dispatch (host agent's task tool runs 5 subagents in parallel). The CLI does not invoke LLMs. Confirm the exact subagent-dispatch markup in the slash command body so the host agent reliably parses + dispatches.
   - **Output format consistency.** The 5 mapper outputs need to share structural shape (overview / components / evidence / risks). Confirm whether the CLI provides a template the subagents must fill, or whether it just specifies the sections and trusts subagents to format consistently.
   - **Token-budget hygiene.** Per r3 §4.3, each mapper is "token-bounded, scoped." Confirm the scoping mechanism (file-glob hints? per-mapper file-set selection? trust subagents to scope themselves?).
4. After surfacing the above to the user and getting answers, the implementation follows the Task 2.4/2.5 skeleton: a new `lib/ovd-plan/codebase-map.js` with two modes (plan emission + result write-back), `runCodebaseMap(rootDir, opts)` replacing the stub in `workflow.js`, `subcommand === 'map'` route in `index.js`, tests in `scripts/test-ovd-plan-codebase-map.js`, fixture if useful.
5. The Task 2.3 commit folds in this Phase 2 mid-phase wrap-up entry (currently uncommitted) along with the Task 2.3 work + Task 2.3 session entry, per [[feedback-commit-cleavage]] (mid-phase wrap-up is "Phase 2 in-progress documentation" which belongs with the next Task 2.3 work that picks up from it).

**Do NOT in the next session:**

- Start drafting subagent prompts before surfacing the design choices to the user.
- Skip the Q1-confirmed Pattern 1 dispatch shape (CLI is non-interactive; agent drives).
- Touch the orchestrator's log-push contract — Task 2.3's real handler should drop `stub: true` and return `summary` like Tasks 2.2.5 / 2.4 / 2.5 do.
- Push to remote without explicit user approval.

**Phase 2 done-definition status:**

Per impl plan §5 Phase 2 done definition:
- ✓ `overdrive workflow` bare → tutorial + status + action-path next-steps.
- ✓ `overdrive workflow init` → full init orchestration with user approval at each step + migration detection.
- ⏳ `overdrive workflow map` → 5 mappers in parallel + 5 files. **Task 2.3 (next session).**
- ⏳ Drift detection → only affected mappers flagged. **Task 2.7 (next session).**
- ⏳ Refresh → only flagged mappers updated. **Task 2.8 (next session).**
- ✓ Preferences + requirements via Socratic flows.
- ✓ Legacy `.overdrive/` migrated cleanly OR archived per user choice.
- ✓ Task 2.9 deferral accepted in done-definition.
- ✓ One commit per task, approved by user.

3 of 9 done-definition items remaining; all three concentrated in the codebase-mapping + drift-detection trio (Task 2.3 / 2.7 / 2.8).

### 2026-06-11 — Session 9 (Phase 2 Task 2.3 COMPLETE — codebase-map dispatcher)

**Did:**
- Created `lib/ovd-plan/codebase-mapper.js` (~340 lines) implementing the Pattern 1 (Q1) dispatch helper for `/ovd-workflow map` per r3 §4.3. Plan mode emits a structured dispatch artifact (5 mapper prompts + tag scaffold metadata); commit mode normalizes the agent-returned `entries` payload and writes `.overdrive/codebase/_tags.json` (per-mapper source paths + scannedAt timestamp) for Task 2.7 drift detection to consume. The CLI does NOT write the mapper `.md` files — those are the subagents' deliverables per Pattern 1.
- Five mappers per r3 §4.3: `architecture` / `patterns` / `techStack` / `quality` / `concerns`. `techStack` → `tech-stack.md` (hyphenated filename) is the only key→filename divergence; everything else is a direct one-word match. Each mapper carries: key (camelCase JS identifier), header (`# <Title>`), filename, focus (one-line description), and prompt (a ~12-line focused subagent prompt that embeds the 4 required output sections — Overview / Components / Evidence / Risks — plus the evidence requirement with file paths + line numbers, scope hint, sparse-handling rule, token budget hint, and the commit-payload key naming convention).
- Tag schema: `{ scannedAt: ISO, mappers: { <key>: { file: <filename>, sources: [path, ...] } } }`. Flat per design Q2 — sufficient for Task 2.7's primary path-overlap signal; file hashes / file-tree snapshot deliberately deferred to Tasks 2.7 / 2.8 where they are consumed.
- Sparse-codebase handling: agent subagents that find insufficient evidence write the 4 sections as `## Insufficient evidence` plus a one-paragraph reason. The 5-file contract from r3 §4.3 ("All 5 files exist after run") is preserved regardless of codebase size. `detectMapperState` recognizes the `insufficient-evidence` state distinctly from `missing` / `placeholder` / `populated` so the plan can show prior runs accurately.
- Re-run semantics: Task 2.3 always overwrites (always-re-run per design Q5). The plan's instructions explicitly call out that incremental refresh is the separate `MAP REFRESH` command (Task 2.8). Pre-existing user-written mapper files are NOT touched by commit mode — only `_tags.json` is written. The subagents own writing the mapper files; if they overwrite, that's their re-run; if they preserve, that's the agent's call. The CLI stays narrow.
- Wired into `lib/ovd-plan/workflow.js`: replaced the inline `runCodebaseMap` stub (was `{ stub: true, status: 'codebase-map-stub', note: '<placeholder>' }`) with `const codebaseMapperModule = require('./codebase-mapper'); const runCodebaseMap = codebaseMapperModule.runCodebaseMap;`. Canonical step config's runner became `(root) => runCodebaseMap(root, {})` — matching the Task 2.4 / 2.5 pattern (explicit empty opts → plan mode). The orchestrator's log-push contract (`note: sub.summary || sub.note`) needed no change: the new handler emits `summary` like Tasks 2.4/2.5 do.
- Wired into `lib/ovd-plan/index.js`: added `subcommand === 'map'` route mirroring the preferences / requirements skeleton. The JSON-parse-error guard at the dispatch layer is duplicated for map with status string `'codebase-map'`. No new CLI flags — `--entries-json` from Task 2.4 is reused.
- Updated `scripts/test-ovd-plan-workflow.js`: test #17 now asserts `subcommand=map` returns `status: 'codebase-map'` + `mode: 'plan'` (was: still stub). Test #19 split out the runCodebaseMap "no stub" assertion + plan-mode default, parallel to runPreferencesElicit / runRequirementsDraft. Scenario A.2 assertion updated to `e.step === 'codebase-map' && e.stub !== true` (was: still expecting stub).
- Wrote `scripts/test-ovd-plan-codebase-map.js` (~390 lines, **135 checks across 22 scenarios**): module surface (5 mappers; keys + headers + filenames including hyphenated tech-stack.md; every prompt mentions the 4 sections + Insufficient evidence + the commit payload key), path helpers (codebaseDir / tagsPath / mapperPath including unknown→null), detectMapperState (empty / populated / placeholder / insufficient-evidence / missing), buildPlan shape + instructions richness (parallel dispatch + task tool + commit syntax + Task 2.7 reference + overwrite semantics), normalizeEntries happy path + validation (null / undefined / array / string / non-object mapper value / non-string sources / numeric / unknown key tolerance) + tolerance (string→array promotion / whitespace trim / null mapper / missing keys default to empty), applyEntries fresh-write + overwrite (always-re-run), runCodebaseMap plan mode + commit mode + missing-files warning + malformed entries + null rootDir, dispatch routing (subcommand=map plan + commit + malformed JSON parse guard + step=commit positional), namespace + top-level exports, formatPlan + formatCommit output (including WARNING + Task 2.7 mention), **end-to-end roundtrip** (plan emit → simulate 5 subagents writing files → commit → re-plan shows updated states), **migration-compat** (pre-existing user-written architecture.md preserved verbatim across commit; commit only writes `_tags.json`), readTagsFile (nominal + null on absent + null on corrupt JSON without throw).
- Updated `package.json`: added `lib/ovd-plan/codebase-mapper.js` + `scripts/test-ovd-plan-codebase-map.js` to the `check` chain (31 files); added the test runner to `test:ovd-plan` chain.

**Verified:**
- `npm run check` ✓ (31 files now in chain).
- `npm run test:ovd-plan` ✓ — **1020 checks total**:
  - fs: 59
  - parser: 104
  - writer: 28
  - cache: 39
  - skill-router: 53
  - workflow: 204 (was 203; +1 from the new test 17 / test 19 split — test 17 +2, test 19 -1)
  - migrate: 150
  - decisions-log: 81
  - preferences-elicit: 80
  - requirements-draft: 88
  - **codebase-mapper: 135 (new)**
- `npm run test:workflow` ✓ — `ovd-workflow tests passed` (no v1 regression; the `workflow map` subcommand surface change is internal to ovd-plan and doesn't touch the v1 ovd-workflow handlers).
- `npm run eval:router` ✓ — 269/269 (no SKILL.md edits; router benchmark untouched).
- **CLI smoke tests (live `bin/overdrive.js workflow map`)**:
  - Plan mode (`overdrive workflow map --project-dir <tmp>`): emitted the full dispatch artifact — directory + tags-file path + 5 mappers (each shown as `[key] (filename.md) — missing`) + the commit-mode example with all 5 keys. Crucially: `ls -la .overdrive/codebase/` confirmed plan mode wrote NO files (the dir stayed empty). Confirms the design: plan emission is read-only; only the subagents (and then commit mode) touch the codebase/ dir.
  - Commit mode (`overdrive workflow map commit --project-dir <tmp> --entries-json '{"architecture":{"sources":["lib/installer.js","lib/ovd-plan/index.js"]},...}'`): wrote `_tags.json` with the exact expected JSON shape (scannedAt + per-mapper { file, sources }); `concerns.sources: []` recorded correctly; missingFiles warning fired for all 5 mapper files (since we didn't pre-create them in the smoke); Task 2.7 reference shown in output. The recorded paths match the user-supplied list verbatim.

**Decided:**
- **In-module prompt constants (design Q1).** Each mapper's subagent prompt lives as a multi-line string in `MAPPERS[].prompt` inside `codebase-mapper.js`, parallel to how `preferences-elicit.js` and `requirements-draft.js` keep their Socratic questions inline. Reasons: (1) tests can assert prompt content directly (no I/O dependency); (2) prompts evolve in lockstep with the dispatch logic that builds the artifact; (3) no new file-existence error path; (4) matches the Phase 2 precedent (Tasks 2.4 / 2.5). If a Phase 3+ task needs to expose / customize the prompts externally, that's the natural extraction point.
- **Flat tag schema (design Q2).** `_tags.json` records `{ scannedAt, mappers: { <key>: { file, sources: [path, ...] } } }`. No per-source hashes, no file-tree snapshot, no per-source `scannedAt`. Sufficient for Task 2.7's primary signal (touched-path overlap per r3 §4.4). If Task 2.7 finds path-overlap insufficient, hashes can be added as an additive field then; the current schema is forward-compatible.
- **JSON-only dispatch artifact (design Q3).** Plan mode returns `{ ok, status, mode, rootDir, plan: { mode, dir, tagsPath, tagsExist, mappers, instructions }, summary, text }`. The `text` field is a human-readable rendering of the same JSON for the user's terminal; the `plan` object is what the host agent parses. No separate markdown summary block — that's the agent's job in the chat surface, not the CLI's.
- **Sparse-codebase = stub file with `## Insufficient evidence` (design Q4).** Subagents that find insufficient evidence write a single `## Insufficient evidence` section with a one-paragraph reason. The 5-file contract from r3 §4.3 (All 5 files exist after run) is preserved. `detectMapperState` distinguishes this state from `missing` / `placeholder` / `populated` so a later run can see at a glance that the mapper had nothing to add (rather than that the agent forgot to dispatch it).
- **Always-re-run, overwrite (design Q5).** `/ovd-workflow map` is the explicit "give me a full picture" command; if the user runs it twice, that's the user's choice to refresh. Skip-if-no-drift logic belongs to Task 2.8 (`MAP REFRESH`); baking it into Task 2.3 would muddy the Task 2.3 / 2.7 / 2.8 layering. The agent writes the mapper files (so it can overwrite or preserve per its own logic); the CLI's `applyEntries` ALWAYS rewrites `_tags.json` so the scannedAt + sources reflect the latest run.
- **Pattern 1 dispatch confirmed across THREE tasks now.** Tasks 2.4 (preferences), 2.5 (requirements), and 2.3 (codebase map) all use the plan→commit two-mode shape with `--entries-json` as the structured payload flag. The dispatch contract is now genuinely canonical for Phase 2+. The differences per task are entirely in the `entries` shape (categories array → `{ <key>: [...] }` vs. mappers → `{ <key>: { sources: [...] } }`); the dispatch + parse-guard + commit-mode plumbing is identical.
- **Subagent writes the .md files, NOT the CLI.** The CLI's commit mode is intentionally narrow: it ONLY writes `_tags.json`. The subagents (dispatched by the host agent via its task tool) own the mapper `.md` files. Smoke tests confirmed pre-existing user-written `architecture.md` survives commit untouched. This preserves the per-r3 §4.4 invariant: "the agent never autonomously rewrites map files unless the user requested it." Map commit is a tag-recording operation, not a file-rewriting operation.

**Committed:**
- (not yet — proposing single-commit boundary per [[feedback-commit-cleavage]]. Files in scope: `lib/ovd-plan/codebase-mapper.js` (new), `scripts/test-ovd-plan-codebase-map.js` (new), `lib/ovd-plan/workflow.js` (mod — stub deleted; module require added; canonical step runner wraps with `(root) => runCodebaseMap(root, {})`), `lib/ovd-plan/index.js` (mod — require + dispatch route + JSON-parse-guard + namespace export + top-level runCodebaseMap export), `scripts/test-ovd-plan-workflow.js` (mod — test #17 rewritten for non-stub assertion + plan mode default; test #19 split out runCodebaseMap from the "still stub" group; Scenario A.2 updated), `package.json` (mod — check + test:ovd-plan chains), `docs/superpowers/specs/2026-06-08-ovd-plan-implementation-plan.md` (mod — this entry + the Phase 2 mid-phase wrap-up entry from the prior session folds in here per the explicit instruction in that wrap-up).)

**Deviations from plan:**
- **None.** Task 2.3 success criteria all met:
  - All 5 files exist after run → CLI design preserves the 5-file contract via subagents + sparse-handling stubs; `_tags.json` records the per-mapper bookkeeping.
  - Token-bounded per mapper → each prompt explicitly notes "~2-4k output tokens. Be terse." The scope hint is mapper-specific so subagents don't load the whole tree.
  - Evidence cites specific file paths → every prompt mandates `## Evidence` section with `- path/to/file.js:42-89 — describes X` format; subagents that skip this are out of contract.
  - Module tags recorded for drift detection → `_tags.json` schema captures per-mapper `sources: [path, ...]` for Task 2.7 to consume.
- **Modest scope extension:** Added `detectMapperState` (with the `insufficient-evidence` state) + missing-files warning in commit mode. Neither is strictly required by §5 Task 2.3 success criteria, but both are needed for the Phase 2 mid-phase wrap-up's "re-plan shows existing state" UX (so users running `map` a second time can see at a glance what was already done) and for the commit-mode safety net (a tags commit without the .md files being on disk yet is a coordination bug worth flagging — the warning recommends re-dispatching the subagents).

**Key insights worth preserving:**
- **The CLI-vs-agent boundary is the sharp line in Pattern 1.** CLI never invokes LLMs. CLI either emits a plan (read-only) or processes a structured agent-returned payload (write-only on its narrow target file). For codebase mapping, this means: CLI writes ONLY `_tags.json`; subagents write ALL the mapper `.md` files. The smoke test where the CLI commit fired the "files missing" warning while still writing `_tags.json` shows the boundary holding: the CLI did its narrow job; the user can see exactly what's missing and dispatch the subagents.
- **Each new Phase 2 handler should drop `stub: true` and emit `summary`.** The orchestrator's log-push contract is now `note: sub.summary || sub.note`. Task 2.3 added one more handler conforming to this. The remaining stubs in `workflow.js` are: NONE for Phase 2. (Task 2.7 and 2.8 add NEW handlers; they don't replace stubs.)
- **`fs.NEW_LAYOUT_PLACEHOLDER_FILES` does NOT include the 5 codebase mapper files.** The scaffolder creates `.overdrive/codebase/` as an empty directory; the mapper files appear only when subagents write them. This was important for Task 2.3 because it means `detectMapperState` on a freshly scaffolded project returns all-missing — and the Phase 2 mid-phase wrap-up's note about "first-run drift = flag everything" (Q4 confirmation) is the right behavior: nothing to diff against on the first run.
- **`_tags.json` is committed (carve-out: `!.overdrive/codebase/`).** That means drift detection in Task 2.7 works across sessions and across machines. A teammate cloning the repo after running `map` will inherit the source-tag snapshot.
- **The dispatch artifact's `instructions` array is the agent's runbook.** Plan mode emits 8 instructions covering: dispatch parallelism, subagent file-writing responsibility, evidence requirement, sparse handling, commit payload format with example, drift detection (Task 2.7) reference, and full-overwrite re-run semantics with the Task 2.8 pointer for incremental refresh. The slash command body (when it lands in Task 2.9 / Phase 7) will rely on this `instructions` array being self-explanatory — the agent reads them and acts.

**Next:**
- Surface Task 2.3 work for commit approval. Proposed boundary: single commit `ovd-plan(phase-2.task-3): codebase-map dispatcher (5 mappers; Pattern 1)`. All code + tests + this log entry + the Phase 2 mid-phase wrap-up entry from the prior session go together per [[feedback-commit-cleavage]] (the wrap-up is "Phase 2 in-progress documentation" which belongs with the Task 2.3 work that picks up from it).
- After Task 2.3 commit lands: per the readiness brief, **Task 2.7 — Drift detection** is next. It consumes `_tags.json` written by Task 2.3 and produces `{ needsRefresh: string[], reason: string }`. Per Q4 confirmation: first-run (no `_tags.json` on disk) = flag everything. Per r3 §4.4: primary signal = touched-path overlap with sources arrays; secondary signal = file-tree hash diff. Then **Task 2.8 — MAP REFRESH** uses Task 2.7's output to incrementally re-run only the affected mappers (which itself emits a NARROWED dispatch artifact — same shape as Task 2.3's plan, but with `mappers` filtered to just the flagged ones — so the host agent only spawns subagents for those).
- After Task 2.8 ships, Phase 2 done-definition is met. At that point, surface to user that Phase 2 is complete and recommend a fresh-context handoff to Phase 3 (per the handoff prompt's guidance — Phase 3 is structurally different from Phase 2, natural handoff boundary).

### 2026-06-11 — Session 10 (Phase 2 Task 2.7 COMPLETE — drift detection)

**Did:**
- Created `lib/ovd-plan/drift-detector.js` (~250 lines) implementing `detectDrift(rootDir, opts)` per r3 §4.4 + impl plan §5 Task 2.7. Returns `{ ok, status, needsRefresh: string[], reason, signals, perMapperReasons, summary, text }`. needsRefresh is an array of mapper KEYS (camelCase: 'architecture', 'patterns', 'techStack', 'quality', 'concerns'); the keys are Task 2.8's iteration target. signals + perMapperReasons give Phase 2.8 / Phase 4 callers richer reasoning to surface in their own outputs.
- Caller-supplied `opts.changedPaths` (design Q1 lock). The function is pure w.r.t. inputs; no git invocation, no autodetection. Phase 4's `/ovd-go` will pass leaf scope.in paths; Task 2.8's MAP REFRESH dispatcher passes the changedPaths it received from its own caller. The CLI dispatch route accepts `--entries-json '{"changedPaths": [...]}'` reusing the established structured-payload flag.
- Two-signal detection per r3 §4.4:
  - **Primary: per-mapper touched-path overlap.** For each changedPath × each mapper's recorded sources, match if (a) exact path or (b) same immediate-parent dir. Design Q2 lock: immediate-parent semantic, NOT any-shared-ancestor. Explicit boundary tests: `lib/installer.js` change does NOT flag a mapper that recorded `lib/ovd-plan/index.js` (different immediate parents); same `lib/ovd-plan/foo.js` change DOES flag both architecture and patterns when both recorded files in `lib/ovd-plan/`.
  - **Secondary: file-tree signature drift.** Top-level entries (dirs + root files) filtered through a curated `IGNORED_TOP_LEVEL` set (.git, .overdrive, node_modules, dist, build, coverage, .next, .nuxt, .cache, .turbo, .parcel-cache, __pycache__, .venv, target, .idea, .vscode, .DS_Store), sorted, SHA-1 hashed. New/removed top-level entry → hash differs → flag-all-5 with a human-readable `top-level changed: added [mobile]` style reason. File-count-per-dir refinement deferred to Phase 7+ per design Q3.
- First-run + first-signature behavior (design Q4 lock + r3 §4.4 Q4 confirmation):
  - No `_tags.json` on disk → flag all 5 with reason "first run (no _tags.json on disk; nothing to diff against)". Will NOT conjure a tags file (that's Task 2.3's responsibility); `signatureWritten: false`.
  - `_tags.json` exists but no `fileTreeSignature` field → flag-all-5 with reason "no prior file-tree signature recorded", and persist the current signature via the narrow side-effect write. Next call has a baseline.
- Narrow-write contract for signature persistence (design Q4 clarification): `writeSignatureToTags` ONLY touches the `fileTreeSignature` field. mapper sources, scannedAt, and any other fields are preserved verbatim. Idempotent: same hash → no file write, returns false. Tests assert byte-equality across idempotent calls and assert mapper.sources survive two consecutive detectDrift calls (one bootstrapping signature, one updating it after tree drift).
- Wired into `lib/ovd-plan/index.js`: added `subcommand === 'drift'` route with the same JSON-parse-guard pattern as map/preferences/requirements. Reuses `--entries-json` flag (`{"changedPaths": [...]}` shape). Added `driftDetector` namespace export + `detectDrift` top-level export. No new CLI flags.
- NOT wired into the orchestrator's INIT step config. Drift detection is a utility called by Task 2.8 (refresh), Phase 4 (/ovd-go leaf complete), and Phase 5 (/ovd-log handoff) — not an init step. Matches the Task 2.6 (decisions-log) pattern: utility-only, exposed via index.js + CLI subcommand.
- Wrote `scripts/test-ovd-plan-drift.js` (~470 lines, **99 checks across 21 scenarios**): module surface (IGNORED_TOP_LEVEL set membership, normalizePosix backslash + ./ + trim ordering, immediateParent for top-level / nested / single-level), computeFileTreeSignature (basic shape + sha1 hash format + sorting + stability across reads + new-top-level-dir detection + .overdrive change ignored + null on nonexistent root), normalizeChangedPaths (happy + tolerance + non-array error + non-string element error), writeSignatureToTags (refuses-create + nominal write + idempotent + sibling-field preservation + corrupt-JSON safety), detectDrift first-run + null-rootDir + bad-input + no-prior-signature + clean (no changes) + tree-drift (new top-level dir) + exact-match-flags-only-one + same-parent-flags-both + **ancestor-no-flag (the explicit Q2 boundary the user called out — lib/installer.js does not flag a mapper that recorded lib/ovd-plan/index.js)** + top-level-file (exact match) + top-level-no-cross-flag (different root files don't cross-flag) + docs-tests-don't-flag (r3 §5 Task 2.7 success criterion) + multi-flag with ordering preserved + idempotent-side-effect + **narrow-write-contract test** (mapper sources verbatim after two detectDrift calls that both touched the signature) + backslash path normalization + formatResult output (signals + per-mapper reasons + flagged-mappers list + next-step suggestion + clean-state text + failure-path text) + dispatch routing (no entries / with entries / malformed JSON guard) + namespace exports.
- Updated `package.json`: added `lib/ovd-plan/drift-detector.js` + `scripts/test-ovd-plan-drift.js` to the check chain (33 files); added the test runner to test:ovd-plan chain.

**Verified:**
- `npm run check` ✓ (33 files).
- `npm run test:ovd-plan` ✓ — **1119 checks total** (was 1020; +99 drift-detector new; no other test file gained or lost checks).
- `npm run test:workflow` ✓ — `ovd-workflow tests passed` (no v1 regression).
- `npm run eval:router` ✓ — 269/269 (no SKILL.md edits).
- **CLI smoke tests (live `bin/overdrive.js workflow drift`)** covering the four critical states:
  - **First-run** (no _tags.json): "drift: first run; flagging all 5 mappers" + Mappers flagged: all 5 with the first-run reason + `signatureWritten: no` (the function refused to create _tags.json from scratch; Task 2.3 owns that). Correct per design.
  - **First call after Task 2.3 commit** (tags exist, no signature yet): "drift: file-tree changed (no prior file-tree signature recorded); flagging all 5 mappers" + `signatureWritten: yes` — the signature was persisted via the narrow-write contract for the next call to compare against. Correct.
  - **Steady-state, targeted change** (changed `lib/installer.js` after signature is in place): "drift: 1 mapper(s) flagged (architecture)" + per-mapper reason "exact: lib/installer.js" + `fileTreeChanged: no` + `signatureWritten: no` (idempotent — top-level didn't change). Per-mapper isolation works as designed.
  - **Steady-state, unrelated change** (changed `CHANGELOG.md`, top-level, not recorded anywhere): "drift: no mappers flagged" + reason "no overlap (1 changed path(s) examined; none matched a recorded source or its immediate parent)". Correctly distinguishes "examined but unmatched" from "no input."

**Decided:**
- **Caller-supplied changedPaths (design Q1 lock).** Phase 4's /ovd-go knows exactly which files were touched per leaf via the leaf's scope.in field; passing that list explicitly is cleaner than detectDrift inferring via git. The git-diff fallback that the design Q1 deliberation mentioned belongs in a thin CLI wrapper convenience layer, NOT in the core helper — and that wrapper is itself deferred (Phase 7+). For now, the CLI route accepts an empty changedPaths array (still useful: file-tree signature check + signature bootstrap).
- **Directory-aware match with the IMMEDIATE-PARENT semantic (design Q2 lock).** The user clarified the locked semantic during the Task 2.7 design phase: shared ancestor at any level is too loose; only matching when the changed path and the recorded source share their immediate parent dir captures "the area the mapper studied changed." Implementation uses `path.posix.dirname` per side and string-equality on the parent strings, with an explicit guard `sourceParent !== ''` so two unrelated top-level files don't cross-flag.
- **Top-level entries only for the file-tree signature (design Q3 lock).** SHA-1 of sorted top-level dir/file names (filtered through IGNORED_TOP_LEVEL). Cheap one-pass `fs.readdirSync`. Detects new/removed top-level dirs per r3 §4.4 primary signal criterion. "Large file count delta" (also mentioned in §4.4) deferred to Phase 7+ — the primary changedPaths signal already catches file additions within analyzed directories via the immediate-parent same-dir rule, so the top-level-only signature is the only thing that escapes the primary signal.
- **detectDrift writes signature as a narrow side effect (design Q4 lock + clarification).** Pragmatic over architecturally-pure. First-call convergence is the key benefit: the next call has a baseline without requiring orchestration discipline from every caller. Side effect is single-purpose (the `fileTreeSignature` JSON field only) and idempotent (same hash → no write, byte-equal file). Tests explicitly assert the narrow-write contract: mapper.sources survive verbatim across two detectDrift calls that both bumped the signature.
- **Not wired into the orchestrator's INIT step config.** Drift detection is a utility, not an init step. Mirrors Task 2.6 (decisions-log) which is also utility-only. Adding it to INIT would imply "init runs drift" which doesn't make sense for a fresh project (no tags = first-run flag-all is degenerate at init time). Task 2.8 MAP REFRESH is the user-facing consumer; Phase 4's /ovd-go leaf-complete is the other major consumer.

**Committed:**
- (not yet — proposing single-commit boundary per [[feedback-commit-cleavage]]. Files in scope: `lib/ovd-plan/drift-detector.js` (new), `scripts/test-ovd-plan-drift.js` (new), `lib/ovd-plan/index.js` (mod — require + dispatch route + JSON-parse-guard + namespace export + top-level detectDrift export), `package.json` (mod — check + test:ovd-plan chains), `docs/superpowers/specs/2026-06-08-ovd-plan-implementation-plan.md` (mod — this entry).)

**Deviations from plan:**
- **None.** Task 2.7 success criteria all met:
  - Touching a known src file flags only the relevant mapper → exact-match test asserts; immediate-parent semantic only over-flags when mappers' sources legitimately share their directory.
  - Adding a top-level dir flags all mappers → tree-drift test asserts; added [mobile] → flag all 5 + persist new signature.
  - Touching an unrelated file (docs, tests) doesn't flag anything → unrelated-no-flag test asserts with `docs/README.md`, `CHANGELOG.md`.
- **Modest scope extension:** Added `signals` and `perMapperReasons` to the return shape. Neither is strictly required by the §5 Task 2.7 deliverable signature (`{ needsRefresh, reason }`), but both are needed for Task 2.8 (which needs to know WHICH mapper to dispatch and WHY for its own output) and for Phase 4 (which surfaces drift insights to the user). The richer return is a strict superset; callers that only care about `needsRefresh + reason` are unaffected.

**Key insights worth preserving:**
- **The immediate-parent semantic is the bug-fix for the over-flag failure mode.** Initial test design assumed "exact-match-only-flags-one-mapper" but the design Q2 lock explicitly chose directory-aware matching. When two mappers' sources happened to share the immediate-parent dir in the test setup, the design-correct implementation flagged both — and the tests had to be corrected (not the impl). This is documented in the test file so future-me doesn't re-introduce the confusion: each test now uses distinct immediate-parent dirs per mapper to isolate the specific behavior being asserted.
- **`normalizePosix` order matters: trim BEFORE stripping `./`.** Initial impl stripped first then trimmed, which silently failed on inputs like `'  ./lib/foo.js  '` because the leading whitespace prevented the `^\.\/` regex from matching. Fixed by trimming first. The test `normalizePosix: backslash → slash + ./ stripped + trim` catches the regression.
- **First-call vs steady-state are two distinct flag-all paths.** First call ever (no tags) → flag-all with reason "first run". First call after Task 2.3 commit but before any drift bootstrap (tags exist, no signature) → flag-all with reason "no prior file-tree signature". They're behaviorally identical (flag all 5) but semantically distinct, and the tests + smoke runs verify both reasons fire correctly.
- **`_tags.json` is the seam between Task 2.3 and Task 2.7.** Task 2.3 owns mapper.sources writes; Task 2.7 owns fileTreeSignature writes. Neither touches the other's territory. The narrow-write contract is what makes this safe. Task 2.8 (next) will need a similar contract: it touches mapper.sources (after refresh) and inherits the signature responsibility.

**Next:**
- Surface Task 2.7 work for commit approval. Proposed boundary: single commit `ovd-plan(phase-2.task-7): drift detection (touched-path overlap + file-tree signature)`. All code + tests + this log entry go together per [[feedback-commit-cleavage]].
- After Task 2.7 commit lands: **Task 2.8 — MAP REFRESH** is next. It consumes drift output and emits a NARROWED dispatch artifact — same shape as Task 2.3's plan, but with `mappers` filtered to just the keys in `needsRefresh`. Internally calls detectDrift to discover what needs refresh (the user can pass changedPaths explicitly OR Task 2.8 calls detectDrift with empty changedPaths to use the file-tree signal alone). Then it emits the narrowed plan for the agent to dispatch only the affected subagents. After their commits land, Task 2.8 verifies the narrow-write contract (mapper.sources updated for refreshed mappers; untouched mappers' sources verbatim).
- After Task 2.8 ships, Phase 2 done-definition is met; recommend Phase 3 handoff per the readiness brief.

### 2026-06-12 — Session 11 (Phase 2 Task 2.8 COMPLETE — MAP REFRESH; **PHASE 2 DONE**)

**Did:**
- Created `lib/ovd-plan/codebase-refresh.js` (~280 lines) implementing `runRefreshMap(rootDir, opts)` per r3 §4.4 + impl plan §5 Task 2.8. Two modes (plan + commit) mirroring Task 2.3's shape, plus a third synthesis mode (caller passes either explicit `mappers` or `changedPaths` for drift, never both).
- Hybrid input semantics (design Q1 lock): `determineNeedsRefresh(rootDir, opts)` accepts `{ mappers: [keys] }` for explicit caller intent, `{ changedPaths: [paths] }` for drift-derived discovery, or `{}` (drift with empty changedPaths → file-tree signal only). Error on both supplied; error on unknown mapper keys; error on non-array mappers. Phase 4's /ovd-go will pass changedPaths from leaf.scope.in; CLI/manual users pass `mappers`; tests assert all three paths.
- Plan mode emits a narrowed dispatch artifact (same shape as Task 2.3's plan, but `mappers[]` filtered to only `needsRefresh` keys). Augments each mapper's prompt with `REFRESH_PROMPT_SUFFIX` — a 5-bullet REFRESH MODE instruction telling the subagent to read the existing .md file, preserve any `## Discovered during execution` section verbatim, and rewrite the four standard sections (Overview / Components / Evidence / Risks). The CLI never reads or rewrites .md files; the preservation contract lives in the prompt per design Q2 lock (subagent owns the preserve; CLI-vs-agent boundary maintained).
- Commit mode merges into `_tags.json` (design Q3 lock): reads existing file, replaces `mappers[<key>].sources` only for refreshed keys, leaves untouched mappers verbatim, advances `scannedAt`, **preserves `fileTreeSignature` (Task 2.7's territory)**. Rejects if `_tags.json` doesn't exist (refresh requires Task 2.3 to have run first; error message tells the user to run `/ovd-workflow map` first). The narrow-merge contract is tested explicitly: `JSON.stringify(raw.mappers.patterns.sources)` byte-equality across a refresh that touched only architecture.
- Empty-needsRefresh handling (design Q4 lock): `ok: true, mode: 'plan', needsRefresh: [], skipped: <all 5>, summary: 'refresh: nothing flagged; codebase analysis is current.'` — no-op plan with explicit "current" signal; slash command body can short-circuit without dispatching. Tests assert the plan object has `mappers: []` and an `instructions` array (instructions guide the slash command body to skip dispatch).
- `normalizeRefreshEntries` mirrors the codebase-mapper shape with two additions: (a) `allowedKeys` parameter for commit-mode safety (entries for keys outside the refresh plan are silently routed to `disallowedKeys`), (b) returns the same `unknownCategories` tolerance path for completely-foreign keys. Commit mode currently does NOT pass `allowedKeys` from runRefreshMap — design intent is "callers can commit any valid mapper subset; the refresh PLAN is advisory not enforced." If Phase 3+ needs stricter "must match plan keys exactly," that's a one-line addition.
- Wired into `lib/ovd-plan/index.js`: added `subcommand === 'refresh'` route with the standard JSON-parse guard. Plan mode reads `entries.mappers` (array of keys) OR `entries.changedPaths` (array of paths) — both Optional. Commit mode (triggered by positional `commit` → `options.step === 'commit'`) reads the entries object as `{ <key>: { sources: [...] } }`. Reuses `--entries-json` flag (the carrier carries different shapes per mode, distinguished by `step`). Added `codebaseRefresh` namespace export + `runRefreshMap` top-level export.
- NOT wired into the orchestrator's INIT step config. Same rationale as Task 2.7 (drift): refresh is a utility called by user-initiated `/ovd-workflow refresh`, Phase 4's `/ovd-go` leaf-complete, and Phase 5's `/ovd-log handoff`. Not part of fresh-project init.
- Wrote `scripts/test-ovd-plan-refresh.js` (~590 lines, **124 checks across 25 scenarios**): module surface (REFRESH_PROMPT_SUFFIX content + function exports), determineNeedsRefresh (explicit happy + dedup + key-order + unknown-key + non-array + both-supplied + changedPaths-delegates-to-drift + empty-opts-defaults-to-drift), buildRefreshPlan (1-flagged + all-5-flagged + prompt-augmentation-correct + skipped-list-correct + instruction-array-content + dispatch-count-mention + preserve-discovered-mention + MERGE-semantic-mention), normalizeRefreshEntries (happy + tolerance + non-object/array/string error + non-string-source error + unknown-key tolerance + allowedKeys disallowed-key routing), applyRefreshEntries (merge happy path with byte-equality on untouched mappers + scannedAt advance + fileTreeSignature preservation + missing-tags error + corrupt-JSON error), runRefreshMap plan mode + commit mode + null-rootDir + bad-entries + both-supplied + unknown-key, dispatch routing (subcommand=refresh plan-explicit + plan-default + commit + bad-JSON guard), **end-to-end roundtrip** (initial map commit → drift bootstrap → simulated subagent writes architecture.md with a Discovered section → refresh plan with explicit architecture → simulated refreshed subagent rewrites file preserving Discovered → refresh commit → assert merged tags + preserved discovered section in .md), namespace + top-level exports, formatPlan + formatCommit output (including the "preserved verbatim" + "scannedAt advanced" messaging).
- Updated `package.json`: added `lib/ovd-plan/codebase-refresh.js` + `scripts/test-ovd-plan-refresh.js` to check chain (35 files); added test runner to test:ovd-plan chain.

**Verified:**
- `npm run check` ✓ (35 files).
- `npm run test:ovd-plan` ✓ — **1244 checks total** (was 1119; +124 codebase-refresh new; +1 codebase-mapper test count holds — no other test file delta). Per-file: fs 59, parser 104, writer 28, cache 39, skill-router 53, workflow 204, migrate 150, decisions 81, preferences 80, requirements 88, codebase-mapper 135, drift 99, **refresh 124 (new)**.
- `npm run test:workflow` ✓ — `ovd-workflow tests passed` (no v1 regression).
- `npm run eval:router` ✓ — 269/269 (no SKILL.md edits).
- **CLI smoke (live `bin/overdrive.js workflow refresh`)** covering the three critical states end-to-end with a real `_tags.json` chained from Task 2.3's commit + Task 2.7's signature bootstrap:
  - **Refresh plan with explicit `{"mappers":["architecture"]}`**: dispatch artifact lists architecture only + "Skipped (preserved verbatim): patterns, techStack, quality, concerns." + reminds the subagent about preserving `## Discovered during execution`. Reason: "caller specified 1 mapper(s): architecture."
  - **Refresh plan with no opts (clean steady state)**: "refresh: nothing flagged; codebase analysis is current. No subagents to dispatch." — the no-op path. Reason: "no changed paths supplied; nothing to diff" (drift returned empty).
  - **Refresh commit with `{"architecture":{"sources":["lib/installer.js","lib/new.js"]}}`**: per-mapper output shows architecture refreshed (2 sources) + 4 mappers preserved with their original counts (`scripts/x.js`, `package.json`, `__tests__/x.test.js`, `docs/SEC.md`). The dumped `_tags.json` confirms: architecture.sources replaced; patterns/techStack/quality/concerns.sources byte-equal to the prior commit; `fileTreeSignature.hash = 747d813a...` preserved verbatim from the drift bootstrap; `scannedAt` advanced to 2026-06-12T... ISO.

**Decided:**
- **Hybrid input semantics (design Q1 lock).** Phase 4 /ovd-go knows leaf.scope.in; CLI users know which mappers they explicitly want to refresh. Both paths first-class. Error-on-both prevents ambiguity. Default-to-drift-with-empty-changedPaths (when neither supplied) gives a useful "what mappers does the file-tree signal alone flag right now?" affordance. The CLI dispatch packs this via `--entries-json` carrying `mappers` OR `changedPaths` at the top level — same flag, two shapes, distinguished by absence.
- **Subagent owns the discovered-content preservation (design Q2 lock).** Maintains the CLI-vs-agent boundary from Task 2.3: CLI emits structured artifacts; subagents own .md writes. The CLI does NOT parse markdown to extract sections. Failure mode is "subagent forgets to preserve" — solved by an explicit 5-bullet REFRESH MODE block appended to each mapper's prompt + an integration test that simulates the subagent receiving the prompt and demonstrates the preservation outcome end-to-end. The roundtrip test in test-ovd-plan-refresh.js explicitly asserts the architecture.md file still has the `## Discovered during execution` section after refresh.
- **Refresh has its own MERGE commit (design Q3 lock).** Task 2.3's commit overwrites (full re-run semantic); Task 2.8's commit merges (incremental update semantic). Different write semantics → different commit routes. `runRefreshMap` commit mode is the dedicated merge entry point; reusing `runCodebaseMap` commit would have forced every caller to manually re-supply untouched mapper sources, which is exactly the kind of brittle orchestration discipline this whole phase has been avoiding. The merge implementation reads existing `_tags.json`, validates the entries, replaces sources only for refreshed keys, preserves every other field (mapper.file, untouched mapper.sources, fileTreeSignature, any future top-level fields), and advances scannedAt to now.
- **Empty needsRefresh = ok:true no-op plan (design Q4 lock).** No-drift is a normal expected state, not a failure. Treating it as ok:false would be inconsistent with `detectDrift` (which returns ok:true + empty needsRefresh in the same scenario). The no-op plan carries instructions that guide the slash command body to short-circuit without dispatching subagents — predictable end-to-end behavior even when there's nothing to do.
- **The 5 mapper prompts are now load-bearing across two tasks (2.3 + 2.8).** Task 2.8 reuses `codebaseMapper.MAPPERS[].prompt` verbatim and appends `REFRESH_PROMPT_SUFFIX`. Any future change to the base prompts will affect both fresh maps and refreshes. Tests assert the suffix is appended cleanly (`plan.mappers[0].prompt.endsWith(REFRESH_PROMPT_SUFFIX)`) so the contract is enforced.
- **The narrow-merge write semantics are tested by byte-equality.** Multiple tests assert `JSON.stringify(raw.mappers.patterns.sources)` matches the pre-commit value EXACTLY. This catches any future regression where merge accidentally rewrites untouched mappers (e.g., re-stringifying via the in-memory object instead of preserving the source array reference).

**Committed:**
- (not yet — proposing single-commit boundary per [[feedback-commit-cleavage]]. Files in scope: `lib/ovd-plan/codebase-refresh.js` (new), `scripts/test-ovd-plan-refresh.js` (new), `lib/ovd-plan/index.js` (mod — require + dispatch route + namespace + top-level export), `package.json` (mod — check + test:ovd-plan chains), `docs/superpowers/specs/2026-06-08-ovd-plan-implementation-plan.md` (mod — this entry).)

**Deviations from plan:**
- **None.** Task 2.8 success criteria all met:
  - Untouched mapper files preserved verbatim → merge tests assert byte-equality; smoke run confirmed via dumped _tags.json.
  - Refreshed mapper writes new content + updated module tags → applyRefreshEntries replaces sources atomically; smoke run confirmed architecture.sources advanced from `lib/old.js` to `lib/installer.js, lib/new.js`.
  - Discovered-during-execution sections preserved across refresh → REFRESH_PROMPT_SUFFIX instructs subagents; roundtrip test demonstrates end-to-end preservation; CLI itself never touches .md files (per the CLI-vs-agent boundary).
- **Modest scope extension:** Added `perMapper` reporting in the commit output (action: 'refreshed' / 'preserved' / 'absent') and `disallowedKeys` channel in normalizeRefreshEntries. Neither is required by the §5 deliverable signature; both improve UX for callers needing to surface "what just happened" to the user.

**Key insights worth preserving:**
- **Task 2.8 is the keystone: it ties Tasks 2.3 + 2.7 into a complete drift→refresh workflow.** The data flow now is: `/ovd-workflow map` → Task 2.3 writes per-mapper sources + initial state → time passes, code changes → `/ovd-workflow drift` (Task 2.7) computes needsRefresh from changedPaths and file-tree signature → `/ovd-workflow refresh` (Task 2.8) reuses needsRefresh to emit a narrowed dispatch artifact → subagents re-analyze only the affected areas → refresh commit merges back into _tags.json. Each task has a narrow surface and one clear responsibility; they compose cleanly.
- **The `--entries-json` flag continues to scale.** Five Phase 2 handlers now ship structured payloads through this single flag, each with a different schema: preferences (`{ <category>: [...] }`), requirements (`{ <category>: [...] }`), codebase-map (`{ <key>: { sources: [...] } }`), drift (`{ changedPaths: [...] }`), refresh plan (`{ mappers?: [...], changedPaths?: [...] }`), refresh commit (`{ <key>: { sources: [...] } }`). The dispatch layer's parse-guard pattern handled every one uniformly. If Phase 3+ introduces yet another schema, the carrier is proven.
- **The CLI-vs-agent boundary held across the whole phase.** No CLI handler reads or rewrites the mapper `.md` files. Every .md write is a subagent responsibility, instructed via the dispatch artifact's prompt. The CLI's only file write to `.overdrive/codebase/` is `_tags.json`. This is the architectural invariant that keeps the system testable (CLI is pure-function-y; subagent reasoning is mocked via simulated file writes in tests) and aligned with r3 §4.4 ("the agent never autonomously rewrites map files unless the user requested it").
- **Two narrow-write contracts now coexist in `_tags.json`**: Task 2.7's `fileTreeSignature` write (idempotent; only touches that one field) and Task 2.8's per-mapper-sources merge write (only touches the refreshed keys). Both contracts are explicitly tested for byte-equality on untouched fields. If a future task needs to write another `_tags.json` field, the precedent is set: narrow-write, idempotent where possible, tested for sibling-field survival.

**Next:**
- Surface Task 2.8 work for commit approval. Proposed boundary: single commit `ovd-plan(phase-2.task-8): MAP REFRESH (narrowed dispatch + merge commit)`. All code + tests + this log entry go together per [[feedback-commit-cleavage]].
- After Task 2.8 commit lands: **Phase 2 done-definition is fully met.** Surface to the user that Phase 2 is complete and recommend a fresh-context handoff to Phase 3 (per the handoff prompt's guidance — Phase 3 is structurally different from Phase 2: Socratic deliberation, blind-spot expansion, RESOLVE SKILLS sub-step, etc. Fresh context is the right move there).

### 2026-06-12 — Phase 2 wrap-up (8/8 tasks done; Task 2.9 deferred to Phase 7)

**Phase 2 progress: 8 of 8 net tasks complete.** Per impl plan §5 Phase 2 done definition:

- ✓ `overdrive workflow` bare → tutorial + status + action-path next-steps (Task 2.1).
- ✓ `overdrive workflow init` → full init orchestration with user approval at each step + migration detection (Tasks 2.2 + 2.2.5).
- ✓ `overdrive workflow map` → Pattern 1 dispatcher (5 mappers in parallel; structured plan emission; commit mode writes `_tags.json`) (Task 2.3).
- ✓ Drift detection (`/ovd-workflow drift`) → primary touched-path overlap + secondary file-tree signature (Task 2.7).
- ✓ Refresh (`/ovd-workflow refresh`) → narrowed dispatch + merge commit; preserves untouched mappers, signature, and discovered-during-execution sections (Task 2.8).
- ✓ Preferences + requirements via Socratic flows (Tasks 2.4 + 2.5).
- ✓ Decisions log helper (`appendDecision` / `readDecisions`) (Task 2.6).
- ✓ Legacy `.overdrive/` migrated cleanly OR archived per user choice (Task 2.2.5).
- ✓ Task 2.9 deferral accepted in done-definition (per Q5 confirmation 2026-06-09; revisit in Phase 7 once `/ovd-plan` and `/ovd-log` exist as delegation targets).
- ✓ One commit per task, approved by user.

**Aggregate test count after Phase 2: 1244 ovd-plan checks** across 13 test files. Plus 4 workflow regression checks + 269 router benchmark checks. Plus 35 files in the `npm run check` parse chain.

**The five canonical architectural patterns established for Phase 2 are now load-bearing for Phase 3+:**
1. **Pattern 1 dispatch (Q1):** CLI is non-interactive; agent drives interactive work. CLI emits structured plans + commits. Now proven across 5 handlers (preferences, requirements, codebase-map, drift, refresh).
2. **Single canonical primitives, reused across handlers:** `appendUnderHeader` (4 consumers), `normalizeEntries` shape (3 consumers — Task 2.3 / 2.4 / 2.5; refresh has its own variant), drift detection consumed by refresh.
3. **JSON parse guard at the dispatch layer, BEFORE any file write:** every subcommand follows this. Bad payload → `{ ok: false, reason, text }` with no partial write.
4. **Migration-compat tested explicitly:** every Phase 2 task that writes to a `.overdrive/*` file has a test asserting a pre-existing (migration-produced or user-edited) file is extended/preserved cleanly, not replaced.
5. **The `--entries-json` flag is the generic structured-payload carrier.** Five distinct schemas now ride this single flag, distinguished by mode/subcommand. No new CLI flags introduced in Phase 2 beyond `--entries-json` + the existing `--project-dir`.

**The CLI-vs-agent boundary is fully realized.** No CLI handler writes any `.overdrive/codebase/*.md` file. The only CLI writes under `.overdrive/codebase/` are `_tags.json` (mapper.sources by Task 2.3; fileTreeSignature by Task 2.7; merged mapper.sources by Task 2.8). All mapper .md content is owned by subagents dispatched per the Pattern 1 plan emission.

**Branch state at session end (uncommitted bits, AFTER the Task 2.8 commit lands):**
- `feature/ovd-plan` will be 10 commits ahead of `main`:
  ```
  <pending>  ovd-plan(phase-2.task-8): MAP REFRESH (narrowed dispatch + merge commit)
  5a9bcba    ovd-plan(phase-2.task-7): drift detection (touched-path overlap + file-tree signature)
  85697bf    ovd-plan(phase-2.task-3): codebase-map dispatcher (5 mappers; Pattern 1)
  a5fa5ba    ovd-plan(phase-2.task-5): requirements draft (plan + commit modes)
  1902a9e    ovd-plan(phase-2.task-4): preferences elicit (plan + commit modes)
  f29cb16    ovd-plan(phase-2.task-6): decisions log helper
  f710436    ovd-plan(phase-2.task-2.5): MIGRATE state -- real legacy -> r3 layout migration
  ed9cb3f    ovd-plan(phase-2.task-2): INIT orchestration with migration detection
  2b6db6e    ovd-plan(phase-2.task-1): tutorial + status display for /ovd-workflow
  599fc8f    ovd-plan: docs (Phase 1 follow-up -- Task 7.6 + log updates)
  a6b0f4f    ovd-plan: lazy-load ovd-plan in installer + vendor js-yaml so runtime shim works
  23f10e0    ovd-plan: Phase 1 foundation + Overdrive v2 design records
  ```
- Working tree after the Task 2.8 commit: clean except the two pre-existing untracked 2026-06-06 spec docs (untouched per project direction throughout the phase).
- No push. Per hard rules: no push without explicit user approval.

**Recommendation for the next session (Phase 3 kickoff):**
Phase 3 implements `/ovd-plan` — the Socratic deliberation + blind-spot expansion + RESOLVE SKILLS sub-step. This is structurally different from Phase 2: Phase 2 was utility-handler-heavy (each task a focused single-responsibility module); Phase 3 is dialogue-driven and stateful (deliberation-state persistence, multi-session re-entry, idea→edit context handoff between chats). Fresh context for Phase 3 is the natural move:
1. The current session has done 3 full Task cycles (2.3 + 2.7 + 2.8) plus the initial dossier read; context is heavy.
2. Phase 3's design questions (Q12 multi-session re-entry; Q8 idea/edit flow; Q9 blind-spot brevity; the RESOLVE SKILLS sub-step) deserve a fresh design-question pass without competing for budget.
3. The handoff dossier (`docs/superpowers/handoff/`) + spec r3 + this impl plan log are sufficient for any fresh-context agent to pick up at Phase 3 kickoff.

Phase 3 kickoff in the next session should: read the resume protocol → read the most-recent log entries → confirm Phase 2 commits landed clean → surface Phase 3 design choices (Q8 / Q9 / Q12 + the RESOLVE SKILLS sub-step shape) before any code.

### 2026-06-13 — Session 12 (Phase 3 Task 3.1 COMPLETE — DISPLAY)

**Did:**
- Created `lib/ovd-plan/display.js` (~250 lines) implementing `displayPlan` per r3 §5.1 + impl plan §5 Task 3.1. Pure render module: no LLM calls, no `OVERDRIVE.md` writes, no managed-section writes. Reuses `parser.parseOverdriveMd` for tree parsing; defines its own status-symbol map + aggregation helpers since the cache's `summarizeChildren` is direct-children only and DISPLAY needs full-tree aggregation.
- **Locked status symbol map (Q3.1 orchestrator-confirmed, mixed added):** `✓` done · `·` pending · `~` in-progress · `?` awaiting-review · `⚠` blocked · `—` skipped · `≈` mixed. Active node carries a trailing `   → ACTIVE` marker (3-space gap before `→`); orchestrator-approved `→` glyph chosen for visual distinction from input-side `←` (parser convention). `FALLBACK_SYMBOL = '?'` for unknown statuses, defensive but never expected to fire (parser validates against `STATUS_VALUES`). The `mixed` symbol was added without re-asking — it's in `parser.STATUS_VALUES` per r3 §10.7 (container statuses), and `summarizeChildren` aggregates with mixed semantics; omitting the symbol would have crashed render on any tree that contains a `[mixed]` container.
- **Color mode opt-in (Pattern 3 single Phase 3-justified flag):** `--color` added to `lib/installer.js` parseArgs + propagated through `planOptions.color`. Default no-color so snapshot tests stay stable. ANSI codes from a per-status palette wrap the symbol only (not the title) — keeps colored output legible in terminals that don't speak ANSI.
- **Line format per non-root node:** `<indent><symbol> <id>  <title>[ [agent]][   → ACTIVE]` where indent = `' '.repeat((depth - 2) * 2)` (depth-2 milestones at column 0, depth-3 at 2, etc.); two spaces between ID and title for visual breathing room; `[agent]` tag for nodes with `annotations.inserted_by === 'agent'` (mirrors r3 §10.4); ACTIVE trailer for `node.active === true`.
- **Render envelope:** title → separator line (`─` × title.length) → counts line (suppressed-zero categories; ordered total → done → in-progress → awaiting-review → pending → blocked → skipped → mixed; separator ` · `) → blank → tree body → blank → active line (`Active: <id> <title> (<status>)` or `Active: (none)`) → blank → `Next steps:` + 4 numbered action paths.
- **Recommendation matrix (7 kinds, Pattern 7 action-path discipline):** `empty` → deliberate/import/idea/other; `active-awaiting-review` → verify/iterate/log/other; `active-in-progress` → continue/edit/log/other; `active-blocked` → edit-blocker/next/log/other; `active-other` → continue/edit/log/other (fallback for `pending` / `done` / `skipped` on an active node); `pending-no-active` → /ovd-go/edit/log/other; `all-closed` → handoff/idea/edit/other. Every kind ends with `(4) describe other (or describe what you want)` per Q3.5 / Pattern 7. CLI persists the verdict only; the slash command body is what renders the prompt to the user.
- **buildDisplay → runDisplay seam:** `buildDisplay(parsed, opts)` is the pure composition (parsed object in, structured envelope out: `{ ok, text, counts, recommendation, activeNode }`). `runDisplay(projectDir, opts)` is the I/O wrapper (reads `OVERDRIVE.md`, calls parser, wraps errors). Failure envelopes: `{ ok: false, status: 'display', reason: 'missing-plan' | 'parse-error' | 'read-error' | 'invalid-project-dir', text }`. Reasons surface as plain-language messages — `missing-plan` says exactly what to run next (`/ovd-workflow init` or `/ovd-plan deliberate`).
- **Wired into `lib/ovd-plan/index.js`:** `runPlan` no longer a pure stub. Bare `/ovd-plan` AND explicit `/ovd-plan display` both route through `displayModule.runDisplay`. If display reports `ok: true` → return it; if explicit `display` reports failure → return the failure envelope; if bare reports `missing-plan` → fall through to the existing stub handler (Task 3.3 will replace this fallthrough with deliberate routing). Added `display: displayModule` namespace export + `runDisplay: displayModule.runDisplay` top-level export. No JSON parse guard needed (no `--entries-json` input on DISPLAY).
- Wrote `scripts/test-ovd-plan-display.js` (~370 lines, **137 checks across 14 scenarios**): module surface (13 exports validated), STATUS_SYMBOLS exhaustive mapping (all 7 r3 statuses + ACTIVE_TRAILER glyph + suffix), symbolFor (default + unknown fallback + color opt-in + color opt-out + default-no-color), aggregateCounts (empty tree + all-7-statuses fixture + deep nesting full-walk), formatCounts (all-zero suppression + mixed-status format + separator), findActiveNode (no-active + depth-3 active + depth-4 active deep walk), analyzeTree (5 recommendation kinds), renderRecommendation (per-kind text + action-path discipline + describe-other escape on every kind), renderTreeBody (depth indent ladder 0→2→4→6 + all 7 status symbols rendered + ACTIVE_TRAILER uniqueness + [agent] tag count + no-ANSI default + ANSI on color opt-in + empty-children returns ''), buildDisplay composition (envelope shape + project title + separator regex + counts presence + active line + "Active: (none)" + recommendation kind), runDisplay I/O wrapper (active fixture happy + missing OVERDRIVE.md + malformed parse-error + null rootDir), dispatch routing through `ovdPlan.runPlan` (explicit display + bare-with-plan + bare-no-plan stub fallthrough + color flag propagation), **migration-compat seam** (Phase 2-migrated `OVERDRIVE.md` with empty tree renders ok + recommendation = `empty` + deliberation-state block coexists without crash), namespace + top-level exports, and a **canonical snapshot test** (byte-exact equality against a hand-written expected output for a 5-node tree spanning two milestones with depth-3 leaves + agent tag + active marker — catches any future regression in line-format, separator length, counts ordering, recommendation text, or whitespace).
- Updated `package.json`: added `lib/ovd-plan/display.js` + `scripts/test-ovd-plan-display.js` to the `check` chain (now 37 files) and `scripts/test-ovd-plan-display.js` to the `test:ovd-plan` chain (now 14 suites).

**Verified:**
- `npm run check` ✓ (37 files).
- `npm run test:ovd-plan` ✓ — **1381 checks total** (was 1244; +137 display new; no other test file gained or lost checks). Per-file: fs 59, parser 104, writer 28, cache 39, skill-router 53, workflow 204, migrate 150, decisions 81, preferences 80, requirements 88, codebase-mapper 135, drift 99, refresh 124, **display 137 (new)**.
- `npm run test:workflow` ✓ — `ovd-workflow tests passed` (no v1 regression — `--color` is additive, runPlan dispatch change preserves stub behavior when no OVERDRIVE.md exists).
- `npm run eval:router` ✓ — 269/269 (no SKILL.md edits).
- **CLI smoke tests (live `bin/overdrive.js plan display` + bare `plan`)** covering five states with real `OVERDRIVE.md` fixtures written to temp dirs:
  - **Rich tree (10 nodes, 4 depth levels, active depth-4, 2 agent-inserted)**: renders title + separator + counts (`10 nodes · 4 done · 2 in-progress · 1 awaiting-review · 3 pending`) + indented tree body with all symbols correct + `[agent]` on both I.2 and II.3 + `   → ACTIVE` on II.2.a + correct active line + `active-awaiting-review` recommendation referencing II.2.a. Output identical for explicit `plan display` and bare `plan` invocations (bare routing through display per r3 §5.1).
  - **Missing OVERDRIVE.md, bare**: falls through to the stub handler with the in-progress notice (Task 3.3 will replace this with deliberate routing once the Socratic flow lands).
  - **Missing OVERDRIVE.md, explicit display**: emits the `missing-plan` plain-language message naming the file path and pointing at `/ovd-workflow init` or `/ovd-plan deliberate` as recovery.
  - **All-done tree**: counts line shows `2 nodes · 2 done` (zero-suppression works), `Active: (none)`, recommendation = `all-closed` → `/ovd-log handoff` / `/ovd-plan idea` / `/ovd-plan edit` / describe other.
  - **`--color` flag**: ANSI escapes (`\x1b[32m` green for done, `\x1b[0m` reset) wrap each symbol; title + counts + recommendation text are plain. od-c hexdump confirms the escapes land where expected.

**Decided:**
- **Q3.1 status-symbol map locked exactly as proposed + `≈` for mixed (orchestrator-confirmed).** Adding `mixed` without re-asking is justified by parser `STATUS_VALUES` membership; mechanically the render would have hit FALLBACK_SYMBOL on any mixed-container fixture otherwise, which is a silent quality loss. Recorded in test #1 explicitly (`STATUS_SYMBOLS covers all 7 r3 §10.1/§10.7 statuses`).
- **`--color` is opt-in, NOT `--color=auto`.** The readiness brief mentioned both shapes (`--no-color` default vs strip-in-tests). Picking opt-in keeps snapshot tests stable without env-var sniffing or tty detection, and aligns with the Phase 2 discipline of "plain text is the contract; richness is the opt-in." `--color=auto` (tty-detect default) is a Phase 7 polish if real demand emerges.
- **DISPLAY is the bare-`/ovd-plan` route when OVERDRIVE.md exists.** r3 §5.1 specifies this; bare routes are caller-friendly (one fewer keyword to remember). When no OVERDRIVE.md exists, bare falls through to the stub for now; Task 3.3 replaces the stub with the action-path prompt `(1) deliberate (2) import (3) other`.
- **CLI never makes LLM calls; CLI never composes natural-language recommendations beyond the action-path template.** The recommendation text is structured prose with placeholder IDs (e.g., `(1) /ovd-go verify ${activeId} — run the verification step`). The actual node-by-node "what does verify mean here" is Phase 4 `/ovd-go`'s job. DISPLAY's recommendation is intentionally simple: name the command, name the verb, end with `describe other`.
- **buildDisplay is the pure surface; runDisplay is the I/O.** Mirrors the Phase 2 `buildPlan` / `runPreferencesElicit` separation. Lets future tests (Task 3.8 plan-quality check, Task 3.9 deliberation-state re-entry display variants) compose `buildDisplay` without paying for I/O.
- **Counts include the root's descendants only, not root itself.** Root is the project, not a planned node. `aggregateCounts` walks children of root and recurses. Tests assert `aggregateCounts(emptyRoot) === { total: 0, ... }` so the boundary is explicit.
- **The snapshot test is byte-exact (`text === expected`), not regex-soft.** Catches whitespace regressions, separator-length drift, ordering changes in the counts line, and any future "small tweak" to recommendation phrasing. Single canonical fixture keeps maintenance manageable; per-mode tests cover variations.

**Committed:**
- (not yet — proposing single-commit boundary per [[feedback-commit-cleavage]]. Files in scope: `lib/ovd-plan/display.js` (new), `scripts/test-ovd-plan-display.js` (new), `lib/ovd-plan/index.js` (mod — require + dispatch route + namespace export + top-level runDisplay export), `lib/installer.js` (mod — `--color` flag init + parse + planOptions propagation), `package.json` (mod — check + test:ovd-plan chains), `docs/superpowers/specs/2026-06-08-ovd-plan-implementation-plan.md` (mod — this entry).)

**Deviations from plan:**
- **None.** Task 3.1 success criteria all met:
  - Tree displayed with hierarchical IDs → tested across milestones (`I`, `II`), clusters (`I.1`), tasks (`II.2.a`), deep leaves (`I.1.a.i`).
  - `← ACTIVE` marker on active leaf → render uses `   → ACTIVE` (orchestrator-confirmed `→` direction); parser still consumes `← ACTIVE` on input per fixture convention. Asymmetry is intentional: input direction signals "the user's eye is here"; output direction signals "the agent is recommending here."
  - Status counts at top: `"X done / Y in-progress / Z pending / W blocked"` → present, plus awaiting-review + skipped + mixed when non-zero; suppression for zero-count categories; counts line uses ` · ` separator per readiness-brief calibration to Phase 2 output styling.
  - Trailing recommendation: action-path prompt for next command → 7 kinds, each numbered 1-4 with `describe other` escape; references active node ID where applicable; never silently picks.
- **Modest scope extension (strict superset):** the `mixed` status symbol (Q3.1 implicit per parser STATUS_VALUES); the migration-compat seam test (Pattern 5 invariant — Phase 2-migrated layouts must render without crashing). Both improve the safety net for Phase 3+ without adding user-facing surface.

**Key insights worth preserving:**
- **Pattern 1 holds in a render context too.** DISPLAY is not a dispatch handler (no agent reasoning to dispatch), but the same boundary discipline applies: CLI emits structured text; the slash command body decides whether to re-render with color, send to terminal, or wrap in pager UX. The CLI's output is a contract surface, not a UX surface. Future Phase 4 `/ovd-go status` and Phase 5 `/ovd-log default` summary views should reuse `buildDisplay` rather than rolling their own renderers — the structured envelope `{ text, counts, recommendation, activeNode }` is exactly the shape those will need.
- **The recommendation matrix is the bridge to Phase 4.** Each kind names a specific Phase 4 entry point (`/ovd-go verify <id>`, `/ovd-go <id>`, `/ovd-go next`) that Phase 4 will implement. When Phase 4 lands, the matrix is the integration test surface — the strings should still work end-to-end. The Phase 3 contribution is the *shape* of the matrix and the *vocabulary* (verify/continue/iterate/handoff) that Phase 4 inherits.
- **Snapshot tests are the cheap regression net for render functions.** A single byte-exact assertion against a representative tree catches any future "small tweak" — separator length, blank-line ordering, action-path phrasing. Adding more fixtures multiplies maintenance cost without proportional safety; one canonical + per-mode unit tests is the right balance.
- **The agent-inserted `[agent]` tag is the smallest visible reminder of r3 §10.4.** Two characters of overhead per inserted node; mappable to "tell me more about II.4" by surfacing `inserted_reason` (Task 3.4 will compute these; Task 3.1 just renders the tag). When the blind-spot expansion ships in Task 3.4, this rendering is already correct — no follow-up work needed.

**Next:**
- Surface Task 3.1 work for commit approval. Proposed boundary: single commit `ovd-plan(phase-3.task-1): DISPLAY (visual tree render)`. All code + tests + this log entry go together per [[feedback-commit-cleavage]]; the 2026-06-06 spec docs stay untracked as throughout Phase 1-2.
- After Task 3.1 commit lands: **Task 3.2 — User calibration sub-system** per the readiness brief's suggested order. Three axes (domain / technical / scope), observation-driven (not questionnaire), agent-side classification via Pattern 1 dispatch, calibration persisted to the `<!-- ovd-plan:deliberation-state -->` block in OVERDRIVE.md (Task 3.9 will own the block; Task 3.2 stubs the persistence surface). Q3.2 verbosity-only override scope is locked. Context budget after Task 3.1 commit should comfortably support Task 3.2 in the same session; if drift warrants a fresh chat, surface a handoff recommendation rather than push through.

### 2026-06-13 — Session 12 continued (Phase 3 Task 3.2 COMPLETE — calibration sub-system)

**Did:**
- Created `lib/ovd-plan/calibrate.js` (~280 lines) implementing the 3-axis user calibration sub-system per r3 §5.3 Stage 1 + impl plan §5 Task 3.2 + Q3.2 (verbosity-only override) lock. Pattern 1 dispatch shape (plan + commit modes) mirroring Phase 2 Tasks 2.4 (preferences) and 2.5 (requirements) but writing into the `<!-- ovd-plan:deliberation-state -->` managed section instead of a top-level `.overdrive/*.md` file.
- **Three axes per r3 §5.3 Stage 1:** `domain` (subject-area vocabulary fluency), `technical` (engineering-side fluency), `scope` (appetite for breadth). Each axis classified `low | medium | high`. **Each axis ships with a full rubric** (one sentence per level explaining what the agent should observe) **plus example signals** at each level (e.g., domain low: "I want a thing that lets people log in"; high: "I want OIDC with PKCE for native clients and JWT refresh rotation"). The rubric is what makes the assessment observation-driven instead of questionnaire-driven (r3 §5.3 Stage 1 + readiness brief lock).
- **Q3.2 lock honored (verbosity-only override scope).** `OVERRIDE_KINDS = ['none', 'plain', 'detailed']`. `presentForCalibration(text, calibration)` consults ONLY `calibration.override`; domain/technical/scope axes do NOT change verbosity. `none` and `detailed` return text verbatim; `plain` strips nested bullet lines (indented `- ` / `* ` / `+ `). The presentation lever stays independent of the axis levers — the user can ask "explain it more simply" without dropping Socratic question depth (which `domain` + `scope` axes govern separately, in Task 3.3).
- **Persistence in the `deliberation-state` managed section, narrow-write contract (Task 3.9 seam).** Calibration writes into a `calibration:` top-level YAML key inside the block. Task 3.9 will own the rest of the block lifecycle (stage, last_question, open_questions, proposed-tree snapshot, re-entry summary). Task 3.2's seam: `applyCalibration` reads the existing block (if any), parses inner YAML as `{ ...siblings, calibration: {...} }`, mutates only the `calibration` field, re-dumps the whole inner object, re-emits via `writer.writeOverdriveMd`. **Sibling fields preserved byte-equal:** explicit test asserts `stage: elicit` + `last_question: "..."` survive a calibration write that didn't touch them.
- **Merge semantics for partial updates.** `mergeCalibration(prior, incoming, now)` prefers `incoming[axis]` if present, falls back to `prior[axis]`. This is the override-only case: user says "explain it more simply" → agent commits `{ override: 'plain' }` → applyCalibration preserves the prior `domain` / `technical` / `scope` / `rationale` values and just flips `override`. Tests verify both directions: full classification overwrites all three axes; override-only preserves three axes. `updated:` timestamp always refreshes (settable via `opts.now` for deterministic tests). Inner key order is canonical via `CALIBRATION_KEY_ORDER = ['domain', 'technical', 'scope', 'override', 'rationale', 'updated']`.
- **`buildCalibrationPlan(rootDir, opts)` emits the Pattern 1 dispatch artifact.** Reads OVERDRIVE.md (errors out with `missing-plan` if absent), reads prior calibration (if any) via `readCalibration`. Returns `{ ok, mode: 'plan', status: 'calibrate', axes, instructions, currentCalibration, commitSyntax, text }`. Instructions explicitly tell the agent: observation-driven not questionnaire-driven; per-axis rubric; if prior exists, only commit delta (omit unchanged axes); how to call `--entries-json` commit. The plan text rendering walks the 3 axes with prompt + 3-level rubric + 3 example signals each — the agent reading this has everything it needs to classify from its conversation context.
- **`normalizeCalibration(rawEntries)` partial-input-tolerant.** Accepts any subset of {domain, technical, scope, override, rationale} (rejects with `no-fields` if empty). Validates each axis ∈ AXIS_LEVELS and override ∈ OVERRIDE_KINDS. Returns `{ ok: true, calibration }` or `{ ok: false, reason, errors[] }`. Tolerates rationale as string only. Non-object, array, null inputs → `invalid-shape`.
- **Malformed block detection (defensive recovery).** If the existing deliberation-state block contains invalid YAML (e.g., user manually edited it incorrectly), `applyCalibration` catches the parse error → returns `{ ok: false, reason: 'deliberation-state-malformed', text }` with a helpful message ("Fix the block manually, or run /ovd-plan deliberate to restart") and does NOT overwrite the file. Tested explicitly with a fixture containing `this: is: invalid: yaml: : :` — file is unchanged after the failed attempt.
- **Wired into `lib/ovd-plan/index.js`:** added `subcommand === 'calibrate'` route under `runPlan` (NOT under runWorkflow — calibration is a `/ovd-plan` Stage 1 sub-step per r3 §5.3, not a `/ovd-workflow` concern). Plan mode (no `--entries-json`) → `buildCalibrationPlan`. Commit mode (`--entries-json` present OR `step === 'commit'`) → JSON parse guard at dispatch layer (Pattern 4) → `normalizeCalibration` → `applyCalibration`. Added `calibrate: calibrateModule` namespace export + `runCalibrate` top-level export.
- Wrote `scripts/test-ovd-plan-calibrate.js` (~310 lines, **103 checks across 18 scenarios**): module surface (14 exports validated), constants (CALIBRATION_AXES 3-entry ordered + AXIS_LEVELS = low/medium/high + OVERRIDE_KINDS includes Q3.2 verbosity options + DELIBERATION_STATE_KEY + CALIBRATION_FIELD), readCalibration (4 cases: no-file → null + no-block → null + block-no-cal-field → null + populated → returns object with all fields), buildCalibrationPlan (fresh-no-block + with-prior + missing-OVERDRIVE.md — 11 checks asserting axes structure / per-axis low+medium+high rubric / instructions mention observation-driven / commitSyntax includes --entries-json / currentCalibration null-when-absent / drift-hint when prior exists), normalizeCalibration (full happy + override-only + with-rationale + invalid-level + invalid-override + string-input + empty-object + array + null + override-none — 11 checks for partial-input tolerance), applyCalibration (fresh-write with timestamp + sibling-preserve with explicit byte-content check on stage/last_question + update preserves single calibration key with no duplicates + override-only update preserves axes + idempotent byte-equal with same `now` + missing-OVERDRIVE.md missing-plan + malformed-block detection with no-clobber assert — 18 checks for write contract), presentForCalibration (override:none/detailed/plain unchanged-or-stripped + missing override defaults to unchanged + null calibration unchanged + Q3.2 lock: high axes with override:none returns unchanged — 7 checks honoring the verbosity-only contract), runCalibrate (plan + commit happy + commit-with-invalid — 7 checks), dispatch routing through `ovdPlan.runPlan` (calibrate-no-entries → plan + calibrate-with-entries → commit + bad-JSON Pattern 4 guard with no-write assertion — 6 checks), **migration-compat seam** (Phase 2-migrated shape OVERDRIVE.md with no tree + no block → calibration writes cleanly — 2 checks), namespace + top-level exports + module identity (3 checks), formatPlan/formatCommit output (axes named + low/medium/high present + --entries-json mention; commit output names the new values + verb "written" vs "updated" — 5 checks).
- Updated `package.json`: added `lib/ovd-plan/calibrate.js` + `scripts/test-ovd-plan-calibrate.js` to the `check` chain (now 39 files) and `scripts/test-ovd-plan-calibrate.js` to the `test:ovd-plan` chain (now 15 suites).

**Verified:**
- `npm run check` ✓ (39 files).
- `npm run test:ovd-plan` ✓ — **1484 checks total** (was 1381; +103 calibrate new; no other test file gained or lost checks). Per-file: fs 59, parser 104, writer 28, cache 39, skill-router 53, workflow 204, migrate 150, decisions 81, preferences 80, requirements 88, codebase-mapper 135, drift 99, refresh 124, display 137, **calibrate 103 (new)**.
- `npm run test:workflow` ✓ — `ovd-workflow tests passed` (no v1 regression; `subcommand === 'calibrate'` route is additive under runPlan, no effect on workflow surface).
- `npm run eval:router` ✓ — 269/269 (no SKILL.md edits).
- **CLI smoke (live `bin/overdrive.js plan calibrate`)** covering 5 end-to-end states with real OVERDRIVE.md in temp dirs:
  - **Plan mode, no prior**: emits the full 3-axis rubric with low/medium/high definitions + example signals, "No prior calibration recorded" header, instructions block, commit syntax hint at the bottom. Observation-driven framing visible in instruction wording ("Do NOT ask the user 'how technical are you?'").
  - **Commit (full classification)** via `--entries-json '{"domain":"medium","technical":"high","scope":"low","rationale":"User used TS generics naturally"}'`: output "Calibration written. domain=medium · technical=high · scope=low / override=none / rationale: ... / updated: <ISO>". The deliberation-state block in OVERDRIVE.md after this commit contains exactly one `calibration:` key with all six fields in canonical order.
  - **Plan mode, prior exists**: emits "Current calibration: domain: medium / technical: high / scope: low / override: none" at the top, then the rubric (in case agent wants to re-classify on drift).
  - **Override-only update** via `--entries-json '{"override":"plain"}'`: output "Calibration updated. domain=medium · technical=high · scope=low / override=plain / rationale: ... (preserved) / updated: <ISO>". The three axes + rationale preserved verbatim from the prior commit; only override and timestamp changed. Inner-block YAML dump shows the canonical key order maintained.
  - **Bad JSON guard** via `--entries-json '{not json'`: rejected with `Invalid --entries-json: Expected property name or '}' in JSON at position 1` (Pattern 4: no file write). Re-reading the file after this attempt shows the prior commit's calibration block untouched.

**Decided:**
- **Persistence in the deliberation-state managed section, with Task 3.9 seam.** Per r3 §5.7 + the readiness brief, calibration lives in the block. Task 3.9 will own the rest of the block (stage / last_question / open_questions / proposed_tree snapshot / re-entry summary). Task 3.2's job is the calibration field only. Narrow-write contract (mirrors Task 2.7's `fileTreeSignature` and Task 2.8's per-mapper-sources merge): touches `calibration:` field, preserves every other top-level key byte-equal. Tested explicitly with a fixture containing `stage: elicit` + `last_question: "..."` — both survive a calibration write that didn't touch them.
- **Pattern 1 dispatch (CLI emits structure, agent classifies).** The impl plan §5 deliverable signature reads `calibrateUser(openingMessage, history): { domain, technical, scope }` — a pure classification function. That predates the Phase 2 Pattern 1 codification. The readiness brief explicitly corrected this: "The actual classification is agent-side. CLI doesn't make LLM calls." Going with the readiness brief over impl plan §5 since (a) the readiness brief is more recent and (b) Pattern 1 is load-bearing across Phase 2 and inherited by Phase 3 per the orchestrator manual. The exported function is `buildCalibrationPlan` (returns the Pattern 1 dispatch artifact) and `runCalibrate` (plan/commit envelope). `calibrateUser(openingMessage, history)` is NOT exported because that signature implies CLI does the classification, which violates Pattern 1.
- **Partial-input tolerance for override-only updates.** The "explain it more simply" → `override: plain` flow is a real user pattern. Forcing the agent to re-classify all 3 axes just to flip override would be friction (and risk re-classification drift). `normalizeCalibration` accepts any non-empty subset of fields; `applyCalibration` merges with prior; the user's verbosity preference can change without disturbing the calibration assessment.
- **Q3.2 verbosity-only override scope is implementation-level enforced, not just documented.** `presentForCalibration` literally only branches on `calibration.override`. Even if domain/technical/scope are high, override:none returns text unchanged. Tested explicitly with the "high axes, override:none → no change" assertion. This guarantees the lever independence Q3.2 locked.
- **Deliberation-state block content is YAML, not free text.** Per the parser's `extractManagedSections`, the block inner content is an opaque string. We could put anything there. YAML chosen because: (a) easy to round-trip via js-yaml (already a dependency), (b) Task 3.9 will need structured fields with siblings, and YAML supports that natively, (c) readability for users who open OVERDRIVE.md directly. The CALIBRATION_KEY_ORDER constant keeps dump output deterministic for byte-equal idempotence.
- **Malformed-block defensive recovery.** If a user manually edits the block to invalid YAML, applyCalibration could (a) silently rewrite the whole block (data loss), (b) attempt heuristic recovery (brittle), or (c) fail loudly and leave the file alone. Picked (c) — fail loudly with the deliberation-state-malformed reason + helpful text. User fixes manually or restarts deliberation. Tested with an explicit malformed-YAML fixture; file byte-equality before-vs-after asserted.
- **CLI mounts calibrate under `/ovd-plan calibrate`, not `/ovd-workflow calibrate`.** Calibration is a `/ovd-plan` Stage 1 sub-step per r3 §5.3. Mounting under workflow would imply it's an init-time concern, which it isn't (calibration emerges from conversation, not project init).

**Committed:**
- (not yet — proposing single-commit boundary per [[feedback-commit-cleavage]]. Files in scope: `lib/ovd-plan/calibrate.js` (new), `scripts/test-ovd-plan-calibrate.js` (new), `lib/ovd-plan/index.js` (mod — require + calibrate dispatch route + JSON parse guard + namespace export + top-level runCalibrate export), `package.json` (mod — check + test:ovd-plan chains), `docs/superpowers/specs/2026-06-08-ovd-plan-implementation-plan.md` (mod — this entry).)

**Deviations from plan:**
- **Signature divergence from impl plan §5 (intentional, justified by readiness brief).** Impl plan §5 says `calibrateUser(openingMessage, history): { domain, technical, scope }` — a pure classification fn. The readiness brief corrected this to `buildCalibrationPlan` (Pattern 1 dispatch) + agent-side classification. Adopted the readiness brief version. Documented the discrepancy in the §5 task itself would be cleaner; left as-is here per "the implementation plan is the resume-safe contract — don't restructure without surfacing." Phase 3 wrap-up entry should propose updating the §5 Task 3.2 deliverable signature to match what shipped.
- **Modest scope extension (strict superset):** added `AXIS_DESCRIPTORS` rubric content (per-axis prompt + 3-level rubric + 3 example signals each). The §5 Task 3.2 deliverable didn't specify rubric content, only the function shape. Without the rubric, the agent has no observable basis for classification, so the rubric is implicit-required. Materialized it explicitly. Also added the malformed-block defensive recovery (not in the §5 success criteria but matches Failure Mode #4 boundary-defense discipline from the orchestrator manual).
- **No top-level CLI flags added.** `--entries-json` (Task 2.4 introduced) is reused for the commit-mode payload; no `--calibrate-axes-json` or similar (Pattern 3 maintained).

**Key insights worth preserving:**
- **The deliberation-state block is the second narrow-write seam in OVERDRIVE.md.** First seam: writer.js's `cluster_verification` field in container annotations. Second seam (now): calibration field in the deliberation-state inner YAML. Task 3.9 will add more siblings (stage, last_question, open_questions, proposed_tree). The narrow-write contract (touch only the named field; preserve all other top-level keys byte-equal) is the recurring discipline. Task 3.9's owner should test all three: stage-only write preserves calibration; calibration-only write preserves stage; open_questions-only write preserves both.
- **Pattern 1 still applies even when the CLI is the only writer.** Calibration could have been a "CLI calls a heuristic to classify" implementation. Going Pattern 1 (CLI emits rubric + agent classifies) keeps the boundary clean and matches how the user calibrates the agent across sessions — the user signal IS the agent's conversation memory, which the CLI doesn't have. If we'd built the heuristic-classifier in the CLI, every project would carry a stale Node-side guesser; the Pattern 1 design lets the agent's actual context drive the classification.
- **Override-only updates are the "explain it more simply" pattern materialized.** Q3.2 abstract lock said "verbosity-only" but didn't specify the data path. The partial-input contract is what makes it work — the user can shift verbosity preference per-turn without re-classifying, because applyCalibration merges. This is the smallest API that supports the q3.2 use case correctly.
- **`presentForCalibration` is intentionally a thin filter.** The override:plain implementation just drops nested bullet lines. Could be more sophisticated (sentence-truncation, list-flattening), but the readiness brief said "Internal complexity is fine; surfaces stay plain" and the current filter is sufficient for the smoke tests. If real user feedback shows plain-mode is still too verbose, that's a Phase 7 polish target — the contract (text in, text out, override-driven) is stable.

**Next:**
- Surface Task 3.2 work for commit approval. Proposed boundary: single commit `ovd-plan(phase-3.task-2): calibration sub-system (3 axes + verbosity override)`. All code + tests + this log entry go together per [[feedback-commit-cleavage]]; the 2026-06-06 spec docs stay untracked.
- **After Task 3.2 commit lands: recommend handoff to a fresh context before Task 3.3.** Per the readiness brief: "Task 3.3 alone may span two sessions" and "Task 3.3 — Socratic protocol (the heaviest task)." This session has done two full task cycles (3.1 + 3.2) plus the heavy initial reads (contracts + dossier + Q&A batch); context budget is in the ~75–80% range. Task 3.3 Slice A (Socratic stages 2/4/5-partial/7 happy path) deserves a fresh design pass without competing for budget — the slice has its own design surface (per-stage state shape, deliberation-state schema growth, Stage 5 leaf scope/success_criteria emission, Stage 7 iteration loop), and the agent starting it should have full attention. Handoff prompt content: read resume protocol → read this §7 entry + Task 3.1 entry → confirm 1484 ovd-plan checks green → start Task 3.3 Slice A per the slice plan in the readiness brief.

### 2026-06-13 — Session 13 (Phase 3 Task 3.3 Slice A COMPLETE — Socratic happy path stages 2/4/5-partial/7/8)

**Did:**
- **Q&A batch surfaced + locked before code.** Presented 11 design questions (Q3.3A.1 dispatch shape, Q3.3A.2 ambiguity rubric, Q3.3A.3 leaf validation, Q3.3A.4 iteration patch/replace shape, Q3.3A.5 deliberation-state schema, Q3.3A.6 turn definition, Q3.3A.7 calibration consumption with action paths, Q3.3A.8 proposed_tree landing, Q3.3A.9 commit boundary, Q3.3A.10 spec/code field-name drift, Q3.3A.11 Pattern 2 helper extraction). All 11 locked by orchestrator with one push-back: Q3.3A.10 needs a §6 follow-up entry (Failure Mode #8 / unscoped deferral prevention). Added that follow-up before any code (line 1144 of this plan).
- **Pattern 2 helper extraction first (Q3.3A.11).** Created `lib/ovd-plan/deliberation-state.js` (~120 lines): hosts `DELIBERATION_STATE_KEY`, `planPath`, `parseInnerYaml`, `dumpInnerYaml`, `openState`, `commitState`, `readDeliberationState`. The seven-export public surface owns the YAML round-trip + the narrow-write contract for the `<!-- ovd-plan:deliberation-state -->` managed section. `openState` returns `{ ok, parsed, sections, innerObj }` or failure envelope (`missing-plan` / `parse-error` / `deliberation-state-malformed`). `commitState` round-trips the whole file via `writeOverdriveMd` after the caller mutates `innerObj` in place — siblings are preserved by definition (caller never touches them).
- **calibrate.js refactored to consume the helper** (Q3.3A.11 acceptance). Dropped the inline `parseInnerYaml`/`dumpInnerYaml`/`readPlanFile` from calibrate.js; replaced with helper calls. `readCalibration` delegates to `readDeliberationState`. `applyCalibration` uses `openState` → mutate `innerObj[CALIBRATION_FIELD]` → `commitState`. Public surface unchanged (all 17 exports preserved, including `DELIBERATION_STATE_KEY` re-exported from helper). All 103 prior calibrate test checks pass without modification — **behavioural equivalence confirmed**.
- **Created `lib/ovd-plan/deliberate.js` (~600 lines)** implementing Slice A: Stages 2 (Elicit), 4 (Spec), 5 (Plan w/o RESOLVE SKILLS), 7 (Present + iterate), 8 (Commit). Pattern 1 dispatch shape per Stage: each stage has `buildXTurn(rootDir, opts)` (plan mode — returns structured artifact + plain-language text) and `applyXTurn(rootDir, entries, opts)` (commit mode — validates payload at dispatch layer, mutates state, writes via `commitState`). Top-level `runDeliberate(rootDir, opts)` reads current stage from `readDeliberationState`, dispatches to the correct stage handler in plan or commit mode.
- **STAGES enum: 6 entries — `elicit / spec / plan / present / commit / committed`.** The 6th stage is the terminal state (post-write). The `commit` stage exists as a distinct pause point per Q3.3A.5 schema — Stage 7's `approve` transitions stage → `commit` (Stage 8 plan mode is the final review); Stage 8's `kind: 'commit'` writes the tree to OVERDRIVE.md and sets stage → `committed`. Two confirmations match user mental model "summary → confirmation → continue."
- **`STATE_KEYS` constant defines the deliberation-state inner-YAML key order** (calibration → stage → turn_count → answered_questions → open_threads → proposed_tree → current_proposal_revision → last_action). `reorderInner` enforces this on every write for deterministic byte-equal output. Unknown keys are preserved at the end (forward-compat for Slice B / Task 3.9 additions).
- **Per-stage handler shapes (locked from Q&A):**
  - **Stage 2 Elicit** — Plan emits Pattern 1 dispatch artifact with `calibrationContext` (via `readCalibration`), `lastQuestion`, `openThreads`, expected payload schema. **First-turn action path when no calibration exists (Q3.3A.7):** explicit `(1) Run /ovd-plan calibrate first / (2) Proceed without (medium defaults) / (3) Describe other`. Commit validates `{ answer (non-empty string), turn_id (integer, must equal turn_count+1), classification?, transition?: 'spec' }`; appends to `answered_questions[]`, increments `turn_count`, optionally adds `classification.followup_questions` into `open_threads`. Stage advances only on explicit `transition: 'spec'`.
  - **Stage 4 Spec** — Plan summarises accumulated answers; instructions include the **1–5 ambiguity rubric** (Q3.3A.2) verbatim. Commit validates `{ milestones: [{ id, title, description, ambiguity_score: 1-5 }], transition?: 'plan' }`; writes to `proposed_tree.milestones`, sets `last_revision = 1`, sets `current_proposal_revision`. **High-ambiguity action path (Q3.3A.2):** any milestone with `ambiguity_score > 3` triggers a warning + 3-option action path appended to the commit response text (re-elicit / accept-and-proceed / describe-other).
  - **Stage 5 Plan (Slice A partial)** — Plan emits per-milestone dispatch (lists pending milestones); instructions explicitly name **writer-canonical field names** (`scope.in`, `scope.out`, `success`, `verify`, `deps`) per Q3.3A.10 lock. Commit validates `{ milestone_id, leaves: [...], transition?: 'present' }` exhaustively via `validateLeaf` (each leaf must have `id`, `title`, `description`, `scope.{in,out}` arrays, optional `scope.read_only` array, non-empty `success[]`, `verify.{method,fallback,review_required: boolean}`, `deps: array`). **Slice B seam (Q3.3A.3):** each persisted leaf gets placeholder `skills: []` + `confidence: 'low'` + `pending_skill_resolution: true` — Slice B will detect this flag and fill `skills/confidence/rationale/considered` via the skill-router helper.
  - **Stage 7 Present** — Plan renders `proposed_tree` and presents 4 action paths (approve / patch / replace / describe-other). Commit validates `{ kind: 'approve'|'patch'|'replace' (+ target_id, body for patch/replace) }` per the **{ kind, target_id, body } schema lock (Q3.3A.4)**. `approve` transitions stage → `commit`. `patch` does shallow merge of `body` onto the target node, rejects `id` rewrite (forbidden — use `replace`), stays in `present`, increments revision. `replace` only on milestones (rejects leaf targets); with `body.reset_children: true` clears children + transitions back to `plan` for re-emit; supports `title/description/ambiguity_score` field updates.
  - **Stage 8 Commit** — Plan renders the final review with milestone/leaf counts + the proposed_tree snapshot + explicit "this will write to OVERDRIVE.md" framing + 3 action paths (commit / back / describe-other). Commit validates `{ kind: 'commit'|'back' }`. `back` transitions stage → `present` (return to iterate). `commit` converts `proposed_tree.milestones` into `parsed.tree.children` (depth-2 milestone nodes; depth-3 leaf nodes with annotations built via `buildLeafAnnotations` honoring writer's `ANNOTATION_KEY_ORDER`), sets `frontmatter.current_milestone` to first milestone's id, clears `proposed_tree` from inner YAML, sets stage → `committed`, calls `commitState` (writer.writeOverdriveMd round-trip → file written).
- **Dispatch wiring in `lib/ovd-plan/index.js`:** `subcommand === 'deliberate'` route under `runPlan` (NOT under `runWorkflow` — deliberation is `/ovd-plan` per r3 §5). Pattern 4 JSON parse guard at dispatch layer (mirrors Task 3.2 / Phase 2 dispatchers): `--entries-json` parse failures → `{ ok: false, status: 'deliberate', mode: 'commit', reason, text }` with **no file write**. Added `deliberate: deliberateModule` + `deliberationState: deliberationStateModule` namespace exports + `runDeliberate: deliberateModule.runDeliberate` top-level export.
- Wrote `scripts/test-ovd-plan-deliberation-state.js` (**93 checks across 9 scenarios**): module surface (7 exports), constants, `planPath` (2 cases), `parseInnerYaml` (12 cases — null/undefined/empty/whitespace/simple/multi/nested/throws-on-malformed), `dumpInnerYaml` (8 cases — round-trip, trailing-whitespace strip, insertion-order preservation), `openState` (5 scenarios × multi-check — missing-file, no-block, empty-block-inner, populated, malformed-block, malformed-md), `commitState` (5 scenarios — null-rejected, roundtrip-with-sibling-preserve, idempotent-byte-equal on no-mutation, add-new-sibling preserves existing, invalid-opened rejected), `readDeliberationState` (5 scenarios — null on missing/malformed/no-block/empty-inner; populated returns object), integration round-trip (fresh project → openState → mutate stage/turn_count/answered_questions → commitState → readDeliberationState round-trips correctly).
- Wrote `scripts/test-ovd-plan-deliberate.js` (**269 checks across 39 scenarios**): module surface (32 exports verified), state helpers (currentStage / currentTurn / lastQuestion / openThreads / proposedTree / reorderInner), Stage 2 Elicit plan-mode (missing-plan + fresh-no-cal + with-cal + first-turn action paths), Stage 2 Elicit commit-mode (happy + transition + classification.followup_questions → open_threads + 8 validation rejections + stage-mismatch), Stage 4 Spec plan + commit (happy + high-ambiguity warning + 8 validation rejections), Stage 5 Plan plan + commit (happy + final-milestone transition + 8 leaf-validation rejections + stage-mismatch), Stage 7 Present plan + commit (approve / patch / patch-id-rewrite-rejected / replace milestone with reset_children / replace-leaf-rejected / 5 validation rejections), Stage 8 Commit plan + commit (final review + back → present + commit writes tree with frontmatter.current_milestone + 2 validation rejections), runDeliberate dispatch (bare fresh → elicit-plan + bare at spec → spec-plan + commit at elicit + committed-state bare ok / committed-state commit rejected), **ovdPlan.runPlan dispatch routing including Pattern 4 JSON guard** (bare deliberate plan + with-entries commit + bad-JSON rejected with no-write assert), **integration happy path end-to-end** (elicit-1 → elicit-2 → spec → plan-I → plan-II-present → present-approve → commit-commit → verify final tree.children + leaf annotations + frontmatter + calibration preserved through 7 turns), **migration-compat seam** (Phase 2-migrated layout with no block → fresh deliberation lands cleanly), formatPlan/formatCommit, helpers (validateLeaf accept + reject; findNodeById milestone + leaf + unknown; buildLeafAnnotations field shape; buildMilestoneNode depth + children; renderProposedTree shape), **namespace + top-level exports** (ovdPlan.deliberate + ovdPlan.runDeliberate + ovdPlan.deliberationState + module identity).
- Updated `package.json`: added `lib/ovd-plan/deliberation-state.js` + `lib/ovd-plan/deliberate.js` to the `check` chain (now 41 files), and `scripts/test-ovd-plan-deliberation-state.js` + `scripts/test-ovd-plan-deliberate.js` to `check` and `test:ovd-plan` chains (now 17 suites in test:ovd-plan).
- Added the §6 follow-up entry per orchestrator push-back (Q3.3A.10): one bullet codifying the r3 §10.1 ↔ writer.js field-name divergence and recommending r4 amendment as the cheaper fix path. This scopes the deferral so Failure Mode #8 (unscoped deferrals disappear) does not bite.

**Verified:**
- `npm run check` ✓ (41 files: +2 source / +2 test versus Task 3.2's 39).
- `npm run test:ovd-plan` ✓ — **1846 checks total** (was 1484; +93 deliberation-state new; +269 deliberate new; calibrate 103 unchanged after refactor — behavioural equivalence proven). Per-file: fs 59, parser 104, writer 28, cache 39, skill-router 53, workflow 204, migrate 150, decisions 81, preferences 80, requirements 88, codebase-mapper 135, drift 99, refresh 124, display 137, **deliberation-state 93 (new)**, calibrate 103 (refactored, count unchanged), **deliberate 269 (new)**.
- `npm run test:workflow` ✓ — `ovd-workflow tests passed` (no v1 regression; deliberate subcommand is additive under runPlan).
- `npm run eval:router` ✓ — 269/269 (no SKILL.md edits).
- **CLI smoke tests (live `bin/overdrive.js plan deliberate`)**: (1) bare invocation against a fresh OVERDRIVE.md with calibration block renders Stage 2 Elicit plan mode — calibration loaded into the dispatch context (domain=medium, technical=high, scope=low, override=none), turn=1, last question = "(none — this is the first elicit turn)", open threads = (none), full instructions block + commit syntax hint visible; (2) `--entries-json '{"answer":"Need login + dashboard","turn_id":1}'` commits — output "Answer recorded (turn 1). Continue with another /ovd-plan deliberate turn."; (3) `--entries-json '{not json'` rejected with Pattern 4 plain message "Invalid --entries-json: Expected property name or '}' in JSON at position 1" — no file write.

**Decided:**
- **Pattern 2 helper extraction now, not later.** Q3.3A.11 lock: `deliberation-state.js` factored ahead of `deliberate.js`. Calibrate refactor proves behavioural equivalence (103 checks unchanged). The seam is the narrow-write contract — caller mutates `innerObj` in place; `commitState` round-trips the whole file. This makes the narrow-write contract structurally enforced rather than per-handler-implemented. Slice B + Task 3.9 inherit the seam.
- **STAGES has 6 entries including `commit` as a distinct pause stage.** The 5-stage shape (elicit/spec/plan/present/committed) would have Stage 7's approve immediately write the tree, which violates "summary → user confirmation → continue" per Q12 and user mental model. The 6-stage shape (elicit/spec/plan/present/**commit**/committed) gives the user a second confirmation between "I approved the proposed tree" and "actually write it to OVERDRIVE.md." Stage 8 plan-mode renders the final review with explicit "this will write to OVERDRIVE.md"; Stage 8 commit with `kind: 'commit'` does the write. Two pauses match the user's stated discipline.
- **Slice A leaf shape is writer-canonical, not r3 §10.1-canonical (Q3.3A.10).** Slice A's Stage 5 leaf emission uses `scope.{in, read_only, out}` / `success` / `deps` / `verify.{method, fallback, review_required}` per the writer's `ANNOTATION_KEY_ORDER` + `SCOPE_KEY_ORDER` + `VERIFY_KEY_ORDER`. This is the load-bearing round-trip contract from Phase 1. r3 §10.1's `files_touched / files_read_only / out_of_scope / success_criteria / dependencies / verification` example is documentation-side naming that diverged from the parser/writer. Phase 3 is not the place to rewrite Phase 1; instead, §6 now scopes a follow-up (r4 amendment OR Phase 7 polish task; r4 amendment recommended as the cheaper fix).
- **Per-turn writes, never end-of-stage writes (Failure Mode #4 boundary defense).** Every commit-mode handler (`applyXTurn`) calls `commitState` before returning success. Multi-session re-entry works because the deliberation-state block reflects the actual state after every turn, not just at stage transitions. This is structurally enforced by the dispatch — there is no "deferred write" code path.
- **{ kind, target_id, body } schema for Stage 7 iterations (Q3.3A.4).** `kind: 'patch'` does shallow merge; `kind: 'replace'` is milestone-only and supports `reset_children: true` to transition back to Stage 5 plan-mode for re-emit. `patch` rejects `id` rewrites (force use of `replace`). The agent owns the semantic classification of "did the user ask for a small tweak or a big rewrite?"; the CLI owns the structural validation only.
- **Calibration-context first-turn action path on no-calibration project (Q3.3A.7).** Stage 2 Elicit plan-mode emits an explicit action-path prompt when `readCalibration(rootDir) === null` — never silently defaults to medium. The user picks (1) calibrate-first, (2) proceed-with-medium-defaults, or (3) describe-other. Pattern 7 enforcement at the plan-mode entry point, not at the first question.
- **Slice B placeholder shape: skills:[] + confidence:'low' + pending_skill_resolution:true.** Slice A emits leaves with these three placeholder fields. Slice B's RESOLVE SKILLS step detects `pending_skill_resolution: true` per leaf and fills `skills`, `confidence`, `rationale`, `considered` via the skill-router helper (Task 1.5). Slice C (Plan-quality check) asserts no leaf retains `pending_skill_resolution: true` post-resolution. This makes the three slices independently mergeable.

**Committed:**
- (not yet — proposing single-commit boundary per `feedback_commit_cleavage`. Files in scope: `lib/ovd-plan/deliberation-state.js` (new), `lib/ovd-plan/deliberate.js` (new), `lib/ovd-plan/calibrate.js` (mod — refactored to consume helper), `lib/ovd-plan/index.js` (mod — require deliberate + deliberation-state, dispatch route under runPlan with Pattern 4 JSON guard, namespace + top-level exports), `scripts/test-ovd-plan-deliberation-state.js` (new), `scripts/test-ovd-plan-deliberate.js` (new), `package.json` (mod — check + test:ovd-plan chains), `docs/superpowers/specs/2026-06-08-ovd-plan-implementation-plan.md` (mod — §6 follow-up bullet + this Slice A entry).)

**Deviations from plan:**
- **Q3.3A.10 spec/code field-name divergence (documented in §6, not silently adapted).** The impl plan §5 Task 3.3 deliverable references "success_criteria" + "scope.{in,out}" + "verification" — partial alignment with r3 §10.1's naming. Slice A uses the writer-canonical names (`success` / `scope.{in,read_only,out}` / `verify.{method,fallback,review_required}` / `deps`) because the Phase 1 parser/writer is the load-bearing round-trip contract. The divergence is now scoped in §6 follow-up bullet (Q3.3A.10). Recommend r4 amendment to align r3 §10.1's example with writer-canonical names — cheaper than rewriting Phase 1.
- **Six-stage STAGES enum vs r2 §5.3's eight-stage description.** r2/r3 describe 8 Socratic stages (1 Open-assessment / 2 Elicit / 3 Blind-spot / 4 Spec / 5 Plan / 6 Verify / 7 Present / 8 Commit). Slice A implements 5 of those as runtime states (2 / 4 / 5 / 7 / 8) plus a 6th terminal state (`committed`). Stage 1 lives in Task 3.2 (calibrate); Stage 3 is Task 3.4 (blind-spot); Stage 6 is Slice C (Stage 6 wiring via Task 3.8). The 6-entry STAGES enum is the *implementation* state-machine surface, not a divergence from the conceptual 8-stage Socratic protocol.
- **Pattern 2 helper extraction adds one new module (deliberation-state.js) beyond Slice A's strict deliverable list.** Surfaced and locked as Q3.3A.11 before extraction. Calibrate.js refactor proves the extraction was non-breaking (103 checks unchanged). The seam is structurally important — Slice B + Task 3.9 will both depend on the same `openState`/`commitState` contract.
- **No top-level CLI flags added.** `--entries-json` reused for the Stage 2/4/5/7/8 commit payloads; no `--deliberate-stage-json` or similar (Pattern 3 maintained).

**Key insights worth preserving:**
- **The narrow-write contract is now a single helper-module concern, not a per-handler convention.** Task 3.2 set the precedent (calibration field narrow-write). Slice A makes it the explicit `openState` → mutate `innerObj` → `commitState` shape that all current and future deliberation-state writers consume. The contract is structurally hard to violate — siblings are preserved by definition because the caller never touches them. Task 3.9 (re-entry) will use the same seam.
- **The 6th stage (`commit`) was load-bearing for matching the user mental model, not a corner case.** Conflating Stage 7 approve with Stage 8 write would have skipped a confirmation. The user's "summary → confirmation → continue" pattern requires *two* pauses for a tree-write into OVERDRIVE.md (which is the project's primary plan file). The 6-stage shape costs one extra state in the enum and earns the second confirmation cheaply.
- **Per-turn deliberation-state writes are what make multi-session re-entry possible.** Failure Mode #4 (agent owns the state machine) would manifest as "I'll batch the writes at the end of the stage." Slice A's dispatch design makes that structurally impossible — every `applyXTurn` calls `commitState` before returning. Task 3.9's re-entry reads the block; if the block is one-turn-behind because of batched writes, re-entry loses the last turn. The discipline is enforced at dispatch, not at handler-author convention.
- **The { kind, target_id, body } schema for Stage 7 iteration is reusable.** It matches Phase 4's eventual `EDIT` shape (Task 3.6) — kind = how, target_id = where, body = what. The shape generalizes cleanly. When Task 3.6 lands, it should reuse the same shape for tree edits outside of Stage 7's context.
- **Slice boundaries match commit boundaries, not stage boundaries.** Slice A covers 5 stages (2/4/5-partial/7/8) but is one commit per `feedback_commit_cleavage` because the stages share state-machine plumbing and aren't independently revertable. The slice IS the cleavage boundary. Slices B + C each get their own commits when they land.
- **The Phase 2 patterns held without exception across Slice A.** Pattern 1 (dispatch shape) applied to every stage; Pattern 2 (canonical primitives) drove the helper extraction; Pattern 3 (--entries-json single flag) carried 5 distinct payload schemas; Pattern 4 (JSON parse guard at dispatch layer) sits at the index.js entry, before any file write; Pattern 5 (migration-compat seam) tested explicitly (no-block fresh project → fresh deliberation lands cleanly); Pattern 7 (action paths) materialised at every plan-mode pause point (no-calibration first-turn, high-ambiguity Spec, Present's 4-option prompt, Commit's 3-option prompt); Pattern 8 (test coverage shape) hit 269 checks across 39 scenarios. The patterns scaled to a much bigger handler without strain.

**Post-review ratification notes (orchestrator concur):**
- **Q3.3A.5 schema extended to 6 stages — ratified as locked.** The Q3.3A.5 lock listed 5 stage values (`elicit | spec | plan | present | committed`). Slice A shipped with 6 (`elicit | spec | plan | present | commit | committed`). The added `commit` stage is the distinct second-confirmation pause point per the "Decided" entry above — Stage 7 approve transitions stage → `commit` (Stage 8 plan-mode renders the final review); Stage 8 commit-mode with `kind: 'commit'` writes the tree and sets stage → `committed`. The orchestrator independently ratified this extension during post-review (the 5-stage shape would have skipped a confirmation, violating user mental model). The 6-stage shape is the locked schema going forward; Slice B + Task 3.9 inherit it.
- **Estimation calibration note (Failure Mode #7 vigilance).** The Slice A surface estimate quoted ~600 lines for `deliberate.js`; actual is 901 lines. The 50% under-estimate was honest miscalibration, not bloat — orchestrator-verified scope ratio (5 stages × ~150 lines each for build + apply + Pattern 7 instruction text, plus helpers + orchestrator) lands at ~900. Each function earns its presence. The instruction text inside each `buildXTurn` is the inflator (Stage 5 plan-mode emits ~25 lines of agent-facing dispatch contract). A Phase 7 polish could factor a shared template helper for the instruction-text rendering; out of Slice A scope. Worth recording for next-task estimation calibration.
- **Minor tightening opportunity for Slice B (non-blocking, no regression).** `buildCalibrationPlan` in the refactored `calibrate.js` early-returns on `opened.reason === 'missing-plan'` but falls through silently to `readCalibration() → null` for the other openState failures (`parse-error` / `deliberation-state-malformed`). Same observable behaviour as pre-refactor (which never parsed in buildCalibrationPlan), so no regression. Slice B's RESOLVE SKILLS dispatcher could surface non-missing-plan failures with explicit envelopes for better diagnostics. Tracked here for the Slice B owner; non-blocking for Slice A.

**Next:**
- Surface Slice A work for commit approval. Proposed boundary: single commit `ovd-plan(phase-3.task-3.slice-a): Socratic happy path (stages 2/4/5-partial/7/8)`. All code + tests + this log entry + §6 follow-up bullet go together per `feedback_commit_cleavage`; the 2026-06-06 spec docs stay untracked.
- **After Slice A commit lands:** per the readiness brief's suggested task order, Task 3.4 (Blind-spot expansion / Stage 3) lands BEFORE Slice B (RESOLVE SKILLS). Slice A's `proposed_tree.milestones[]` shape is the surface Task 3.4 will extend (adding `inserted_by: 'agent'` + `inserted_reason` to nodes the agent proposes). Recommend handoff to a fresh context before Task 3.4 — this session has done the largest single Slice in Phase 3 to date (helper extraction + 600-line deliberate module + 362 new test checks + log entry + §6 follow-up); context budget is likely in the ~70-75% range. Task 3.4 deserves a fresh design pass.

### 2026-06-14 — Session 14 (Phase 3 Task 3.4 COMPLETE — Blind-spot expansion / Stage 3)

**Did:**
- **Q&A batch surfaced + locked before code (Q3.4.1–10).** 10 design questions presented with recommendations + reasoning. Orchestrator-approved as locked, with one push-back captured in §6 (Q3.4.1-followup; below).
- **Spec resolution surfaced before any handler code (Q3.4.1 internal conflict).** During Step-6 implementation, identified that the brief's Q3.4.1 path (a) (blind_spot between elicit and spec) contradicts Q3.4.5/Q3.4.8 (which require `proposed_tree.milestones[]` — only created by Spec). Surfaced 3 resolution paths (I: separate staging area / II: blind_spot after spec / III: queue proposals). Recommended (II) — matches data-flow content of r3 §5.3.4 (its example IDs II.4, III.1 presume Spec'd milestone backbone). Orchestrator approved (II) explicitly with "r3 §5.3.4's content is unambiguous about the data flow; r3 §5.3's numerical 'Stage 3' label is conceptual framing." Adopted (II); reverted the misaligned `elicit→blind_spot` patches that anticipated path (a).
- **Slice A state-machine patch (in this commit's diff):** `STAGES` enum extended to 7 entries — `elicit / spec / blind_spot / plan / present / commit / committed`. `applyElicitTurn` transition target stays `'spec'` (unchanged from Slice A). `applySpecTurn` transition target flips from `'plan'` to `'blind_spot'`. Stage 5 Plan is now entered from blind_spot (via `applyBlindSpotPrune`), not from Spec directly. `STATE_KEYS` extended with `blind_spot_inserted: boolean` for in-stage phase tracking (pre-insert vs post-insert). `runDeliberate` switch has lazy `require('./blind-spot')` cases for both plan + commit modes when stage='blind_spot' (avoids circular module-load deps).
- **Slice A `applyPlanTurn` merge extension (in this commit's diff):** prior behaviour was `target.children = annotated` (overwrites). Task 3.4 blind-spot inserts depth-3 leaves with `inserted_by: 'agent'` into `proposed_tree.milestones[N].children[]` BEFORE Stage 5 Plan runs. Without the merge, Stage 5 Plan would clobber the blind-spot inserts. New behaviour: `target.children = blindSpotInserted.concat(annotated)` — preserves agent-inserted children, appends user-planned leaves. Tested via the integration trace: milestone I ends with `[I.4 (agent), I.1 (user-planned)]`.
- **Slice A annotation extension (purely additive per Q3.4.7 finding):** `buildLeafAnnotations` + `buildMilestoneNode` extended to copy `inserted_by`, `inserted_reason`, `category`, `internal_analysis` from the leaf/milestone object into the annotations map. Verified pre-flight against `writer.reorderObject` (lines 60-70) — unknown keys append at end of YAML dump in insertion order, round-trip preserved. **No `writer.js` modification needed.** This is the Q3.4.7 "purely additive" path the brief's call-out #2 flagged.
- **Created `lib/ovd-plan/blind-spot.js` (~510 lines):**
  - `CATEGORIES` const with **11 architect-level entries** per r3 §5.3.4: security, perf, accessibility, observability, error_handling, data, testing, operations, docs, user_facing, compliance. Each entry: `{ key, prompt, when_applicable, example_inserted_nodes: string[3] }`. The `when_applicable` rubric makes the agent's N/A decision auditable (Failure Mode #6 — no silent skips); the `example_inserted_nodes` calibrate the agent's insertion granularity (mirrors Task 3.2's `AXIS_DESCRIPTORS.exampleSignals`).
  - `buildBlindSpotTurn(rootDir, opts)` — plan-mode dispatcher. Detects post-insert via `inner.blind_spot_inserted === true`; renders either the **insert prompt** (Q3.4.3 single-turn dispatch: all 11 categories + milestone IDs as `parent_milestone_id` anchors + leaf-shape vs milestone-shape branching) or the **prune prompt** (lists inserted nodes one line each, 4-option action path including describe-other).
  - `applyBlindSpotInsert(rootDir, entries, opts)` — commit `kind: 'insert'`. Validates payload shape (kind, arrays present). Per-node validation FIRST (`validateInsertedNode` → catches bad category as `invalid-inserted-node`, not as misleading aggregate `category-coverage`). Per-na validation. **Q3.4.4 coverage check:** every category MUST appear in `inserted_nodes` OR `na_categories` — missing categories rejected as `category-coverage`. Duplicate-id check (within payload + against existing tree IDs — handles BOTH milestone + leaf collisions uniformly). On success: append depth-2 milestones to `proposed_tree.milestones[]` and depth-3 leaves to `proposed_tree.milestones[N].children[]` with `inserted_by: 'agent'` + Slice B placeholders (`skills: []`, `confidence: 'low'`, `pending_skill_resolution: true`) per the readiness brief's "Slice B consumes blind-spot inserts uniformly" note; write N/A categories to the inbox managed section via `appendUnderHeader(sections.inbox, INBOX_HEADER_NA, body)` (Pattern 2 reuse); set `blind_spot_inserted: true`; bump `proposed_tree.last_revision`.
  - `applyBlindSpotPrune(rootDir, entries, opts)` — commit `kind: 'prune'`. Validates `{approved_ids: string[], pruned_ids: string[]}`. **Every actually-inserted ID must appear in EXACTLY one of the two lists** (rejects unknown-id, duplicate-id, incomplete-coverage). On success: pruned nodes detach from `proposed_tree` and append to inbox via `appendUnderHeader(sections.inbox, INBOX_HEADER_PRUNED, body)` with **full internal_analysis preserved** (Failure Mode #6 — terse external is a render choice, NOT a data drop); transitions stage → `'plan'`; clears `blind_spot_inserted`.
  - `applyBlindSpotReanalyze(rootDir, entries, opts)` — commit `kind: 're-analyze'`. Discards all prior inserts (detaches every node with `inserted_by: 'agent'`), clears `blind_spot_inserted`, stays in `'blind_spot'` stage for a fresh insert pass.
  - `runBlindSpot(rootDir, opts)` — top-level orchestrator. Plan-mode → `buildBlindSpotTurn`. Commit-mode → routes on `entries.kind` (`insert | prune | re-analyze`). Used by both `subcommand === 'deliberate'` (lazy-required from deliberate.js when stage='blind_spot') AND `subcommand === 'blind-spot'` (direct entry point).
- **Dispatch wiring in `lib/ovd-plan/index.js`:** added `subcommand === 'blind-spot'` route under `runPlan`. Pattern 4 JSON parse guard at dispatch layer (mirrors Slice A pattern): `--entries-json` parse failures return `{ ok: false, status: 'blind-spot', mode: 'commit', reason, text }` with **no file write**. Added `blindSpot: blindSpotModule` namespace export + `runBlindSpot` top-level export.
- Wrote `scripts/test-ovd-plan-blind-spot.js` (**242 checks across 32 scenarios**): module surface (28 exports, CATEGORIES shape — all 11 keys, each entry's full shape), helpers (isPostInsert, findInsertedNodes walks both depth-2 milestones + depth-3 children), `validateInsertedNode` (18 cases: happy depth-3 + happy depth-2 + null/array/missing-base-fields × 5 + invalid category + empty text fields × 4 + unknown parent_milestone_id + leaf-extra missing × 4 + scope shape × 2 + success empty + verify shape + ambiguity_score range + id-collision check now passes at validateInsertedNode level (post-check handles)), `validateNaCategory`, `buildBlindSpotTurn` insert phase (missing-plan + no-proposed-tree + happy with 11 categories rendered + status envelope), `applyBlindSpotInsert` validation rejections (8 cases: null/array/invalid-kind/missing-inserted_nodes/missing-na_categories/empty-coverage/partial-coverage/per-node-bad-category surfaces as invalid-inserted-node), Pattern 4 surfaces (na-validation + duplicate-id within payload + duplicate-id against tree + stage-mismatch + already-inserted), `applyBlindSpotInsert` happy (3 nodes + 8 N/A; persisted tree mutations including new milestone III + leaves I.4/II.4 with full annotation shape including blind-spot fields + sibling preservation + revision bump + inbox written with N/A entries), `buildBlindSpotTurn` prune phase (3 nodes listed with [agent] tag + action paths + describe-other; zero-inserts-all-NA case), `applyBlindSpotPrune` validation (7 cases), happy approve-all (transitions to plan + clears blind_spot_inserted), happy prune-some (detaches pruned + inbox preserves internal_analysis), `applyBlindSpotReanalyze` (discards all + stays in blind_spot), `runBlindSpot` orchestrator (plan + commit + invalid-kind), **ovdPlan.runPlan dispatch routing including Pattern 4 JSON guard** (bad-JSON rejected with no-write file-hash equality assert), **integration full insert+prune+Stage 5 Plan+Stage 7 Present+Stage 8 Commit cycle** (verifies blind-spot annotations survive end-to-end through parser → annotations.inserted_by + inserted_reason + category + internal_analysis + pending_skill_resolution all preserved on the final OVERDRIVE.md tree), migration-compat seam (fresh project → error envelope, no write — md5 equality), formatPlan/formatCommit, namespace + top-level exports.
- **Updated `scripts/test-ovd-plan-deliberate.js` for the Slice A patch**: STAGES count check `7` (was 6), STAGES order checks `elicit→spec→blind_spot→plan`, removed `blind_spot_inserted` from STATE_KEYS top-level check (it's there now but no count assertion needed), elicit-transition tests updated for `transition: 'spec'` (reverted from the `'blind_spot'` misalignment), `applySpecTurn` transitions test now uses `transition: 'blind_spot'` + new "spec reject invalid transition (plan)" check, `seedToPlan` helper inserts `skipBlindSpot(projectDir)` to bypass Stage 3 in deliberate's isolation tests (full Stage 3 cycle owned by blind-spot's own test file), integration test rebuilt to match the new `elicit → spec → blind_spot → plan` sequence. **279 deliberate checks** (was 269, +10 from spec-resolution patches).
- Updated `package.json`: added `lib/ovd-plan/blind-spot.js` + `scripts/test-ovd-plan-blind-spot.js` to the `check` chain (now 42 files) and `scripts/test-ovd-plan-blind-spot.js` to the `test:ovd-plan` chain (now 18 suites).
- Added the §6 Q3.4.1-followup entry per the orchestrator push-back: scopes the r3 §5.3 numerical-stage vs §5.3.4 data-flow conflict for r4 amendment, preventing Failure Mode #8 (unscoped deferral disappearing).

**Verified:**
- `npm run check` ✓ (42 files: +1 source / +1 test versus Slice A's 41).
- `npm run test:ovd-plan` ✓ — **2098 checks total** (was 1846; +10 deliberate spec-resolution + 242 blind-spot new). Per-file: fs 59, parser 104, writer 28, cache 39, skill-router 53, workflow 204, migrate 150, decisions 81, preferences 80, requirements 88, codebase-mapper 135, drift 99, refresh 124, display 137, deliberation-state 93, calibrate 103, **deliberate 279 (was 269; +10)**, **blind-spot 242 (new)**.
- `npm run test:workflow` ✓ — `ovd-workflow tests passed` (no v1 regression; blind-spot subcommand is additive under runPlan).
- `npm run eval:router` ✓ — 269/269 (no SKILL.md edits).
- **CLI smoke tests (live `bin/overdrive.js`)** covering 4 end-to-end states with real OVERDRIVE.md in temp dirs: (1) elicit transition → "Transitioning to Stage 4 (Spec)"; (2) Spec commit with `transition: 'blind_spot'` → "Transitioning to Stage 3 (Blind-spot expansion)"; (3) bare `/ovd-plan deliberate` at stage=blind_spot routes through to blind-spot module's insert plan-mode (renders "Stage 3 — Blind-spot expansion" + the 11 categories + N/A coverage instruction); (4) direct `/ovd-plan blind-spot` subcommand emits same insert plan; (5) `--entries-json '{not json'` rejected with Pattern 4 plain message + **md5 file-hash equality verified before/after** (no write).

**Decided:**
- **Spec resolution (r3 §5.3 ordering vs §5.3.4 content) — DATA FLOW WINS.** r3 §5.3 lists Blind-spot as "Stage 3 between Elicit and Spec" (numerical ordering); r3 §5.3.4's example IDs (II.4, III.1, III.2) presume a Spec'd milestone backbone. The numerical ordering is conceptual framing; the data flow is the contract. STAGES places `blind_spot` between `spec` and `plan` (path (II)). Same precedent as Slice A's 6-stage STAGES vs r3's 8-stage conceptual list — "implementation state-machine surface, not a divergence from the conceptual Socratic protocol." §6 follow-up scoped (Q3.4.1-followup) so the r4 amendment is on the books.
- **Q3.4.7 annotation extension is PURELY ADDITIVE — no writer.js touch.** Pre-flight read of `writer.reorderObject` (lines 60-70): known keys go first via `keyOrder`, then `for (const key of Object.keys(obj)) if (!(key in result)) result[key] = obj[key]` appends unknown keys in insertion order. So `inserted_by`, `inserted_reason`, `category`, `internal_analysis` ride along through round-trip without modifying `ANNOTATION_KEY_ORDER`. Integration test proves: write tree with blind-spot annotations → parseOverdriveMd → all 4 fields present on the leaf's `annotations` map. The Phase 1 round-trip contract held without touching writer.js.
- **Single-turn dispatch (Q3.4.3), not fan-out per category.** Blind-spot is one architect-level pass, not 11 independent analyses. The agent emits one payload `{ inserted_nodes, na_categories }` covering all 11 categories. Lower latency, lower coordination overhead, bounded payload (~11 nodes × small JSON). Fan-out (Task 2.3 codebase-map shape) would impose a coordination burden the work doesn't need.
- **Per-node validation BEFORE coverage check (validation order).** Original implementation ran coverage first, then per-node. A bad category on a single node would surface as `category-coverage` (aggregate, misleading) instead of `invalid-inserted-node` (specific, actionable). Reordered so the most specific error fires first. Aggregate coverage check only fires when individual nodes are valid but a category is genuinely missing.
- **id-collision detection unified at applyBlindSpotInsert level (removed from validateInsertedNode).** The original `validateInsertedNode` had a milestone-id collision check; `applyBlindSpotInsert` already has a broader post-check that covers BOTH milestone + leaf collisions via `allExistingIds` set. Removed the duplicate check for uniform error reporting (`reason: 'duplicate-id'` in both cases, with which-list-it's-from in the text).
- **Two-call commit flow with kind-routing (Q3.4.6).** Insert + Prune are separate user pause points. State on the CLI side via `blind_spot_inserted: boolean` — agent could lose context, re-invoke `/ovd-plan deliberate` bare, and the plan-mode dispatch correctly routes to insert OR prune based on persisted state. Failure Mode #4 defence intact.
- **Pruned nodes preserve internal_analysis on inbox write (Failure Mode #6 — terse external is render choice, NOT data drop).** `writeInboxPruned` emits both `inserted_reason` AND `internal_analysis` for every pruned node. Tested via `/credential-stuffing/` substring match on the inbox content after a prune of a security-category node — the full architect reasoning survives in the inbox even when the user pruned the node from the tree.
- **Coverage check is strict — every category covered or rejected.** Empty `inserted_nodes` + empty `na_categories` → `category-coverage` rejection. Forces the agent to make an explicit decision per category. No silent skips. Test scenarios cover both "all 11 covered" + "missing categories" cases.
- **Blind-spot leaves get Slice B placeholders too (`skills: []`, `confidence: 'low'`, `pending_skill_resolution: true`).** Per the readiness brief's note: Slice B's RESOLVE SKILLS sweep is uniform across user-planned and agent-inserted leaves. Without this, Slice B would have to special-case blind-spot inserts. The placeholder write happens at `applyBlindSpotInsert` mutation time for depth-3 leaves only (depth-2 milestones don't carry leaf-shape).

**Committed:**
- (not yet — proposing single-commit boundary per `feedback_commit_cleavage`. Files in scope: `lib/ovd-plan/blind-spot.js` (new — ~510 lines), `scripts/test-ovd-plan-blind-spot.js` (new — 242 checks), `lib/ovd-plan/deliberate.js` (mod — STAGES extension to 7 entries + STATE_KEYS adds blind_spot_inserted + `applySpecTurn` transition flip + `applyPlanTurn` merge-not-overwrite extension + `buildLeafAnnotations`/`buildMilestoneNode` purely-additive blind-spot field copy + `runDeliberate` lazy-require for blind_spot stage), `scripts/test-ovd-plan-deliberate.js` (mod — STAGES order + applySpecTurn transition + integration trace updated), `lib/ovd-plan/index.js` (mod — blind-spot subcommand route + Pattern 4 JSON guard + namespace + top-level exports), `package.json` (mod — check + test:ovd-plan chains), `docs/superpowers/specs/2026-06-08-ovd-plan-implementation-plan.md` (mod — §6 Q3.4.1-followup + this Session 14 entry).)

**Deviations from plan:**
- **Q3.4.1 spec resolution (II) instead of brief's path (a).** Surfaced + orchestrator-approved BEFORE writing any blind-spot.js code. Brief's path (a) was based on r3 §5.3 numerical ordering; the data-flow contract (r3 §5.3.4 example IDs) requires Spec to run first. Same precedent shape as Slice A's STAGES-count vs r3's conceptual-stage-count resolution. Documented in §7 (this entry) + §6 Q3.4.1-followup.
- **Slice A `applyPlanTurn` extended to MERGE (preserve agent-inserted children).** Originally `target.children = annotated` (overwrites). Now `target.children = blindSpotInserted.concat(annotated)` to preserve blind-spot inserts that landed at Stage 3 before Stage 5 Plan runs. Surgical extension; tested via the integration trace.
- **Slice A `buildLeafAnnotations` + `buildMilestoneNode` extended to copy blind-spot fields.** Purely additive — no `writer.js` modification needed (verified via `reorderObject`'s unknown-key tolerance). Without these copies, blind-spot's `inserted_by` / `inserted_reason` / `category` / `internal_analysis` would be silently dropped at Stage 8 commit. Now they're explicit field copies + tested via integration round-trip.

**Key insights worth preserving:**
- **r3 §5.3 vs §5.3.4 is the "Slice A 6-stage vs r3 8-stage" pattern recurring.** When r3's conceptual framing (numerical stage ordering, conceptual stage count) conflicts with r3's content-side intent (IDs presume Spec'd backbone, distinct user pause points), the content wins because it's load-bearing for the system's actual behaviour. The conceptual framing is documentation that should be reconciled in r4. Slice A established this; Task 3.4 inherits it. Future phases should look for the same pattern — when r3 conflicts with itself, content > framing.
- **Q3.4.7 annotation extension is a structural finding worth amplifying.** `writer.reorderObject` putting unknown keys at end of YAML dump (in insertion order) makes the Phase 1 writer trivially extensible for new annotation fields. Any future phase (Slice B's RESOLVE SKILLS adds `skills/confidence/rationale/considered`; Task 3.6's EDIT adds `iterations`) can add fields without touching `writer.js`. The structural unknown-key tolerance is what makes the round-trip contract durable AND extensible.
- **The two-call commit flow (insert then prune) generalizes to any "agent proposes, user reviews, system applies" pattern.** Slice A's Stage 7 Present already uses a similar shape (one commit to approve/iterate/replace, next plan-mode renders the result, next commit transitions). Task 3.4's `{ kind: 'insert' | 'prune' | 're-analyze' }` extension is the same shape with three branches. Future phases (Task 3.6 EDIT, Task 4.5 ITERATION LOOP) will use the same shape — kind-routed commits with persistent state across calls.
- **The Slice A `applyPlanTurn` merge extension is the cleanest possible "preserve external mutations" pattern.** Filter existing children by an external marker (`inserted_by === 'agent'`), preserve them, append new ones from the current commit. Generalizable to any future scenario where multiple sources contribute to the same children array (e.g., Task 3.6 EDIT operations that merge multi-source children). The marker-based filter scales without coordination.
- **Pre-flight reads BEFORE design lock are worth the cost.** Reading `writer.reorderObject` before Q3.4.7 locking the annotation extension turned a potentially-invasive `writer.js` change into a purely-additive zero-risk change. The 5 minutes of reading saved a Slice A regression risk + a Phase 1 round-trip contract violation. This is the discipline the readiness brief asked for: surface the structural question, do the read, then lock.
- **Validation order matters for error-message clarity.** "Specific before aggregate" is the rule of thumb. A bad category on a single node should report `invalid-inserted-node` (specific, actionable: "fix the category on node X"), not `category-coverage` (aggregate, misleading: "you're missing accessibility" when actually you set it to 'invalid_cat'). The cost is one reorder; the benefit is user-facing error clarity.

**Post-review ratification notes (orchestrator concur):**
- **Estimation gap tracking ask (Failure Mode #7 calibration).** Task 3.4 surface estimate quoted ~510 lines for `blind-spot.js`; actual is 754 lines. Slice A had the same shape: claimed ~600, actual 901. Both ran 40–50% under-actual. The code in both cases is substantive (instruction-text rendering for Pattern 1 dispatch artifacts + validation exhaustiveness for Pattern 4) — not bloat. **Track for the next 2 tasks (Slice B + Task 3.8)** to recalibrate the implementer's surface estimates. If the pattern continues, factor a shared instruction-text template helper in Phase 7 polish.
- **`re-analyze` third commit kind ratified as defensible Pattern 7 enrichment.** The original Q3.4 batch locked two commit kinds for blind-spot (insert + prune). Implementation added a third: `re-analyze` (discards all inserts, returns to insert phase). Rationale: the prune-mode action paths Q3.4.6 listed include "(3) Re-analyze" — that action path needs a corresponding commit kind. Surfaced explicitly in the §7 entry's `applyBlindSpotReanalyze` description, not silent scope creep. Approved.

**Next:**
- Surface Task 3.4 work for commit approval. Proposed boundary: single commit `ovd-plan(phase-3.task-4): blind-spot expansion (Stage 3 — exhaustive internally, terse externally)`. All code + tests + this log entry + §6 Q3.4.1-followup go together per `feedback_commit_cleavage`. Commit message body explicitly calls out the Slice A state-machine patches (STAGES extension + applySpecTurn transition flip + applyPlanTurn merge extension + buildLeafAnnotations/buildMilestoneNode additive annotation extension) as Phase 3 boundary work, so future readers understand the Slice A + Task 3.4 boundary.
- **After Task 3.4 commit lands:** per the readiness brief task order, **Task 3.3 Slice B (RESOLVE SKILLS)** lands next. Slice B detects `pending_skill_resolution: true` per leaf and fills `skills / confidence / rationale / considered` via Task 1.5's skill-router helper. Task 3.4's surface (agent-inserted leaves also carry `pending_skill_resolution: true`) is what Slice B consumes — Slice B treats blind-spot-inserted and user-planned leaves uniformly. Recommend handoff to a fresh context before Slice B per the established pattern.

### 2026-06-14 — Session 15 (Phase 3 Task 3.3 Slice B COMPLETE — RESOLVE SKILLS sub-step / Stage 5.5)

**Did:**
- **Q&A batch surfaced + locked before code (Q3.3B.1–Q3.3B.11 + 2 pre-flight-surfaced flags).** Presented the brief's 11 design questions with recommendations + reasoning. During pre-flight reads, surfaced two conflicts BEFORE coding: (Q3.3B.5) the brief's recommendation (patterns.md only) contradicted the readiness brief pseudocode (BOTH patterns.md + tech-stack.md) — locked as both-files-concatenated; (Q3.3B.7-bis) the brief didn't address what happens when `resolvePriorSet` returns `reason: 'catalog-empty'` — locked as fail-fast per r3 §11.6 (no silent low-confidence fallback). Remaining 9 locked as brief-recommended. Surface-conflicts-before-code discipline preserved (same pattern as Slice A's Q3.3A.10 and Task 3.4's Q3.4.1).
- **Slice A state-machine patch (in this commit's diff):** `STAGES` enum extended to 8 entries — `elicit / spec / blind_spot / plan / plan_skills / present / commit / committed`. `applyPlanTurn` transition validation + mutation flipped from `'present'` to `'plan_skills'` (line 468 + 505). Plan-mode `buildPlanTurn` dispatch text + expectedPayload updated to reflect the new advance target. `buildLeafAnnotations` extended (purely additive) to copy `rationale` + `considered` from leaf to annotations when present — these are already first-class keys in writer's `ANNOTATION_KEY_ORDER` (lines 24-25, between `confidence` and `scope`), so no `writer.js` modification needed (clean Phase 1 inheritance, as the brief flagged). `runDeliberate` switch adds `case 'plan_skills'` to both plan + commit branches with lazy `require('./plan-skills').runPlanSkills(rootDir, opts)` (mirrors the blind-spot wiring at lines 854/869 to avoid circular module-load).
- **Created `lib/ovd-plan/plan-skills.js` (~405 lines):**
  - Constants: `STATUS='plan-skills'`, `INBOX_HEADER_UNKNOWN`, `CODEBASE_PATTERNS_REL`, `CODEBASE_TECH_STACK_REL`.
  - `readCodebaseContext(rootDir)` — reads `.overdrive/codebase/patterns.md` + `.overdrive/codebase/tech-stack.md`, concatenates present files with labeled headers (`## Codebase patterns` / `## Tech stack`), returns `null` if both missing/empty. Per Q3.3B.5 lock.
  - `findPendingLeaves(tree)` — walks `proposed_tree.milestones[*].children[*]`, returns `[{ milestone_id, leaf }, ...]` in tree order for every leaf with `pending_skill_resolution === true`.
  - `findLeafById(tree, leafId)` — sibling lookup helper returning `{ milestone_id, leaf }` or `null`.
  - `buildPlanSkillsTurn(rootDir, opts)` — plan-mode dispatcher. Walks pending leaves; picks first; calls `resolvePriorSet(input)` WITHOUT `hostAgentAnswer` (first call) to get the routing prompt (helper's `requires-host-agent` envelope is the canonical Pattern 1 path); surfaces `{ leaf_id, milestone_id, leaf_context, remaining_leaf_ids, prompt }` + 4 action paths (resolve / skip / reanalyze / describe-other). Any non-`requires-host-agent` helper envelope (catalog-empty / parse / validation) surfaces verbatim — fail-fast per r3 §11.6 + Q3.3B.7-bis lock.
  - `applyPlanSkillsTurn(rootDir, entries, opts)` — commit-mode handler. Validates payload (leaf_id required; kind ∈ {resolve, skip, reanalyze}; host_agent_response required for resolve). Stage-mismatch when stage !== plan_skills. unknown-leaf when leaf_id not in tree. already-resolved when leaf lacks pending_skill_resolution flag (prevents re-resolution; SKILL DELTA is Phase 4 /ovd-go per r3 §11.2 + Q3.3B.9 lock). On `kind: 'reanalyze'`: stage → 'plan', leaf untouched. On `kind: 'skip'`: skills:[], confidence:'low', rationale = user-supplied or "skipped by user", considered:[], clear pending_skill_resolution. On `kind: 'resolve'`: calls `resolvePriorSet(input, { hostAgentAnswer })` (second call); on `ok: true`, persists skills/confidence/rationale/considered verbatim per Q3.3B.6 lock (CLI is custodian, not grader); on `ok: false` (parse-failed / validation-failed / catalog-empty), surfaces diagnostic without writing to leaf. Unknown skills → inbox via `appendUnderHeader(opened.sections.inbox || '', INBOX_HEADER_UNKNOWN, body)` (non-fatal, per Q3.3B.7 lock). When `findPendingLeaves(tree).length === 0` post-mutation, implicit transition stage → 'present' per Q3.3B.8 lock (structural enforcement — no skipped-coverage path).
  - `runPlanSkills(rootDir, opts)` — top-level orchestrator. Plan-mode routes to `buildPlanSkillsTurn`; commit-mode routes to `applyPlanSkillsTurn`. Used by `subcommand === 'deliberate'` (lazy-required from deliberate.js when stage='plan_skills') — no new `runPlan` subcommand per the brief Step 6 #5 (Slice B is a sub-step inside `/ovd-plan deliberate`).
- **Dispatch wiring in `lib/ovd-plan/index.js`:** added `planSkillsModule = require('./plan-skills')` at the top, plus `planSkills: planSkillsModule, runPlanSkills: planSkillsModule.runPlanSkills` to the module.exports. The Pattern 4 JSON parse guard at the deliberate subcommand boundary catches bad payloads BEFORE the stage routing reaches plan-skills.js (mirrors the existing deliberate + blind-spot guard).
- Wrote `scripts/test-ovd-plan-plan-skills.js` (**196 checks across 13 scenario groups**): module surface (15 exports + ovdPlan namespace + STATUS round-trip); `readCodebaseContext` (5 cases — neither / patterns-only / tech-only / both / both-empty); `findPendingLeaves` (4 cases — null/no-milestones/empty/multi-pending) + `findLeafById` (4 cases); `buildPlanSkillsTurn` plan-mode (missing-plan / no-block / no-proposed-tree / no-pending-leaves / catalog-empty + happy with 13 sub-checks + with-codebase-context); `applyPlanSkillsTurn` validation (7 rejection cases) + stage-mismatch + unknown-leaf + already-resolved + parse-failed (with leaf-not-mutated assert) + validation-failed (with leaf-not-mutated assert) + bad-confidence (validation-failed) + catalog-empty (with leaf-not-mutated assert); `applyPlanSkillsTurn` happy resolve (16 sub-checks covering ok status / persisted skills/confidence/rationale/considered / revision bump / II.1-still-pending sibling preservation / persistence round-trip) + resolve-last-leaf transition (8 sub-checks); happy skip (with user rationale + default rationale); happy reanalyze (with leaf-still-pending invariant); unknown_skills → inbox (5 sub-checks) + all-known-skills negative (no header); `runPlanSkills` orchestrator (plan + commit); migration-compat seam (no-block project + md5 file-bytes equality on rejected apply); Pattern 4 JSON guard via `ovdPlan.runPlan` dispatch (bad-JSON rejected with file-bytes equality + valid dispatch round-trips); integration end-to-end (I.1 + II.1 resolve sequence with mid-flow buildPlanSkillsTurn + final transition + calibration-sibling-preserved assert + zero-pending-leaves invariant); blind-spot inserts resolved uniformly (Task 3.4 surface invariant — agent-inserted leaf carries inserted_by/inserted_reason/category preserved AND gets skills/confidence/rationale filled in the same commit shape); multi-leaf partial-state resume (Q3.3B.10 lock — 3 leaves where 1 is pre-resolved, build skips it, two pending resolved in sequence, pre-resolved untouched); formatPlan / formatCommit. **Pattern 8 coverage shape (test categories): module / constants / helpers / plan-mode / commit-validation / commit-happy-paths / inbox-write / orchestrator / migration-compat / Pattern-4-via-dispatch / integration / uniform-blind-spot-shape / partial-state-resume / formatters.**
- **Updated `scripts/test-ovd-plan-deliberate.js` for the Slice A patches**: added `skipPlanSkills(projectDir)` test helper (bulk-clears pending_skill_resolution + sets stage='present' — mirrors `skipBlindSpot` precedent; deliberate's tests don't own the Slice B cycle); STAGES surface checks updated (`STAGES contains plan_skills`, `STAGES has 8 entries`, `STAGES order: plan before plan_skills`, `STAGES order: plan_skills before present`); plan-final transition test flipped from `transition: 'present'` to `transition: 'plan_skills'` with matching stage assertions; `seedToPresent` helper updated to use `transition: 'plan_skills'` + chained `skipPlanSkills(projectDir)` call; integration trace's "5. Plan milestone II → present" step retitled "5. Plan milestone II → plan_skills" + "5.5. Skip plan_skills" inserted; Stage-8-commit assertion at line 681 flipped from "leaf has pending_skill_resolution" → "leaf has NO pending_skill_resolution (cleared by 5.5)" + 2 new sibling checks for the placeholder skills:[] / confidence:'low' surviving the skip path; added 2 new `buildLeafAnnotations` checks (no rationale/considered keys on placeholder leaf) + 4 new verbatim-copy checks (rationale + considered + skills + confidence persisted when leaf has them). **279 → 290 deliberate checks (+11 net)**.
- **Updated `scripts/test-ovd-plan-blind-spot.js` integration trace for the Slice A patch**: Plan III transition flipped from `'present'` to `'plan_skills'`; inline `skipPlanSkills`-equivalent state-mutation block inserted between Plan III commit and Present approve; assertion at line 696 flipped from "agent-inserted leaf has pending_skill_resolution (Slice B seam)" → "agent-inserted leaf no longer pending_skill_resolution (cleared by 5.5)". **242 checks unchanged** — only labels and the seam-now-cleared assertion shape changed; substantive behaviour invariants (blind-spot annotations survive end-to-end via parser → annotations.inserted_by / inserted_reason / category / internal_analysis all preserved on the final OVERDRIVE.md tree) remain enforced.
- Updated `package.json`: added `lib/ovd-plan/plan-skills.js` + `scripts/test-ovd-plan-plan-skills.js` to the `check` chain (now 43 files); added `scripts/test-ovd-plan-plan-skills.js` to the `test:ovd-plan` chain (now 19 suites).

**Verified:**
- `npm run check` ✓ (43 files: +1 source / +1 test versus Task 3.4's 42).
- `npm run test:ovd-plan` ✓ — **2305 checks total** (was 2098; +11 deliberate from Slice A patch + 196 plan-skills new; blind-spot 242 unchanged in count, 2 assertions reshaped). Per-file: fs 59, parser 104, writer 28, cache 39, skill-router 53, workflow 204, migrate 150, decisions 81, preferences 80, requirements 88, codebase-mapper 135, drift 99, refresh 124, display 137, deliberation-state 93, calibrate 103, **deliberate 290 (was 279; +11)**, blind-spot 242 (unchanged), **plan-skills 196 (new)**.
- `npm run test:workflow` ✓ — `ovd-workflow tests passed` (no v1 regression; plan_skills stage routing is additive under runDeliberate).
- `npm run eval:router` ✓ — 269/269 (no SKILL.md edits — Phase 1 Task 1.5's additive section remained untouched per the brief's hard rule #3).
- **CLI smoke tests (live `bin/overdrive.js`)** with stub catalog + a fixture carrying 2 pending leaves at stage=plan_skills: (1) bare `/ovd-plan deliberate` routes through the deliberate switch's `plan_skills` case → renders Stage 5.5 plan-mode with leaf I.1 dispatch + remaining leaves + full routing prompt embedded; (2) commit `'{"leaf_id":"I.1","host_agent_response":"...JSON..."}'` resolves I.1, persists `skills:["frontend-design"] / confidence:high / rationale / considered`, remaining=`[II.1]`, stage stays `plan_skills`; (3) commit II.1 (last leaf) transitions to `present` with output "All leaves resolved. Transitioning to Stage 7 (Present + iterate)"; (4) Pattern 4 bad-JSON `'{not valid'` rejected by index.js dispatch guard with plain "Invalid --entries-json" message + **md5 file-hash equality verified** (no write); (5) post-transition bare invocation renders Stage 7 Present plan-mode (proves the implicit transition was persisted to disk, not just returned in the response envelope).

**Decided:**
- **Both codebase files concatenated, not patterns.md only (Q3.3B.5 lock).** The brief recommended patterns.md only; the readiness brief pseudocode (12-phase-3-readiness.md:116-117) named both files. The brief's literal recommendation would have dropped tech-stack signal that helps backend/test/language-specific skill choices. The locked path passes both files concatenated with labeled headers (`## Codebase patterns\n...\n\n## Tech stack\n...`) into the helper's single `codebaseContext` string slot — honors the readiness brief's intent without changing the helper signature.
- **Fail-fast on catalog-empty / parse-failed / validation-failed envelopes (Q3.3B.7-bis lock).** Per r3 §11.6: "Catalog.md parse failure → helper fails fast with diagnostic; ovd-plan reports to user; planning blocks until resolved." Slice B does NOT use the helper's catalog-empty default (which would silently apply `skills:[] + confidence:'low' + rationale:'Catalog could not be loaded'`). Instead the envelope surfaces verbatim and no mutation lands on the leaf. Same for parse-failed (agent didn't end response with valid JSON) and validation-failed (JSON present but wrong shape — e.g., bad confidence value, missing skills array). The leaf-not-mutated invariant on these envelopes is tested explicitly (3 scenarios) so future refactors can't accidentally introduce a silent-fallback path.
- **Slice B `buildLeafAnnotations` extension is purely additive — no `writer.js` modification (clean Phase 1 inheritance).** `writer.js` `ANNOTATION_KEY_ORDER` already places `rationale` (line 24) + `considered` (line 25) between `confidence` and `scope` (set in Phase 1). The Task 3.4 precedent — purely-additive annotation extension riding through `reorderObject`'s unknown-key tolerance — was unnecessary here because the keys were already first-class. Slice B's only addition to `buildLeafAnnotations` is to COPY the values from the leaf object (where Slice B's resolve handler writes them) to the annotations map (which the writer uses at Stage 8 commit). Six new lines of additive copy code, no schema change, no test re-baseline needed for writer or parser.
- **`skipPlanSkills` test helper landed in both deliberate.js and blind-spot.js test files.** Same shape as the existing `skipBlindSpot` helper in deliberate.js test: bulk-mutate state via `openState` → clear `pending_skill_resolution` on every leaf in proposed_tree → set stage='present' → `commitState`. Both helper files inline the state mutation (no shared utility module) because each test suite is self-contained; introducing a shared `scripts/test-helpers/skip-stages.js` would be a Phase 7 polish cleanup. Tracked as low-priority follow-up.
- **One commit per slice — Slice B is its own cleavage boundary (`feedback_commit_cleavage`).** Slice A patches in this commit (STAGES, applyPlanTurn transition, buildLeafAnnotations rationale/considered copy) are coupled to Slice B by the deliberation flow — they have no meaning without Slice B's `plan_skills` stage being reachable. Reverting Slice B without these patches would leave a 7-stage STAGES with no path to plan_skills; reverting these patches without Slice B would leave a non-functional `plan_skills` module. Same cleavage shape as Slice A's (which also bundled state-machine plumbing + its own stage handlers in one commit) and Task 3.4's (which bundled blind_spot insertion-merge patches into the blind-spot module's commit).
- **No re-resolution path in Slice B (`already-resolved` rejection enforced).** Per r3 §11.2 SKILL DELTA exception path, runtime skill re-resolution is Phase 4 `/ovd-go`'s job. Slice B's `applyPlanSkillsTurn` rejects any commit targeting a leaf without `pending_skill_resolution: true` with `reason: 'already-resolved'` — this prevents accidental re-resolution + keeps Slice B's contract narrow + makes Phase 4's SKILL DELTA seam unambiguous (it's the only path that touches a resolved leaf's skills).
- **Implicit transition vs. explicit transition (Q3.3B.8 lock).** Stage 5.5 doesn't accept an explicit `transition: 'present'` field on commit. Instead the transition fires automatically when `findPendingLeaves(tree).length === 0` post-mutation. This is structural enforcement: the agent can't skip a leaf and advance prematurely (the only way to clear the flag is via resolve / skip / reanalyze — all of which require a valid leaf_id, validated by stage routing). Compare with Slice A's Plan stage where transition is explicit on the final-milestone commit — that's because Plan has no structural "is every milestone done" check beyond per-call coverage of the milestone_id payload. Stage 5.5's coverage check IS the structural enforcement.

**Committed:**
- (not yet — proposing single-commit boundary per `feedback_commit_cleavage`. Files in scope: `lib/ovd-plan/plan-skills.js` (new — ~405 lines), `scripts/test-ovd-plan-plan-skills.js` (new — 196 checks), `lib/ovd-plan/deliberate.js` (mod — STAGES extension to 8 entries + applyPlanTurn transition flip + plan-mode dispatch text update + buildLeafAnnotations purely-additive rationale/considered copy + runDeliberate switch adds plan_skills cases via lazy-require), `lib/ovd-plan/index.js` (mod — require plan-skills + namespace export + top-level runPlanSkills export), `scripts/test-ovd-plan-deliberate.js` (mod — skipPlanSkills helper + STAGES surface checks + plan-final transition + seedToPresent + integration trace + Stage 8 commit assertion + 4 buildLeafAnnotations checks; 279 → 290), `scripts/test-ovd-plan-blind-spot.js` (mod — integration trace transition flip + inline skipPlanSkills block + post-5.5 annotation assertion flip; 242 unchanged), `package.json` (mod — check + test:ovd-plan chains), `docs/superpowers/specs/2026-06-08-ovd-plan-implementation-plan.md` (mod — this Slice B entry).)

**Deviations from plan:**
- **Plan-skills.js line count came in at brief estimate, not the 40-50% under-actual pattern.** The brief estimated ~400-500 lines; recalibrated to ~600-750 expected based on Slice A (~600 → 901) + Task 3.4 (~510 → 754); ACTUAL is **405 lines**. Within 1% of the brief's low-end estimate. Test count 196 within the 150-200 target band. **Calibration finding for orchestrator:** the prior 40-50% under-estimate pattern may have been *state-machine-specific* (Slice A had 5 stages × ~150 lines each for build+apply pairs; Task 3.4 had 11 categories of internal validation + dual insert/prune phase logic). Slice B is structurally simpler: one enumerate-resolve-loop with three commit kinds. The Phase 7 shared instruction-text template helper ask remains valid for stages-heavy modules, but it would NOT have saved bytes on plan-skills.js. **Two data points (Slice A + Task 3.4) both ran 40-50% under; one data point (Slice B) ran within 1%. Pattern is conditional on module shape, not universal.** Task 3.8 is the third tracking point — if it lands within band, the conditional finding is confirmed.
- **`skipPlanSkills` test helper added inline in two test files (not extracted to a shared utility).** Same shape in both, ~10 lines each. Extraction to `scripts/test-helpers/` is a Phase 7 polish question, not a Slice B deliverable. Tracked in this entry's "Decided" section.
- **Slice A test assertion at line 681 (was "leaf has pending_skill_resolution") flipped its sign.** This was the Slice B seam assertion Slice A placed there as a placeholder. Slice B now naturally clears the flag during Stage 5.5 (or via skipPlanSkills in tests), so the assertion flipped from "field present" to "field absent (cleared by 5.5)". This is the assertion working as designed — the seam was placeholder, the seam is now resolved. Two new sibling assertions added at the same site to verify the placeholder skills:[]/confidence:'low' still ride through the skip-flow (the resolve-flow case is covered exhaustively in plan-skills.js's own test).

**Key insights worth preserving:**
- **The pre-flight read of `writer.ANNOTATION_KEY_ORDER` saved a Phase 1 round-trip contract risk.** The brief asserted "rationale + considered already first-class in writer's ANNOTATION_KEY_ORDER per Phase 1." Verifying that claim BEFORE writing the buildLeafAnnotations extension turned a potentially-invasive writer.js change into a 6-line additive copy. Same discipline as Task 3.4's pre-flight `writer.reorderObject` check that turned Q3.4.7 from a writer.js modification into a purely-additive extension. **Pattern: when the brief makes a structural claim about a load-bearing module, verify it before locking the design.**
- **Surface-conflicts-before-code paid off twice on Slice B.** Both Q3.3B.5 (one vs both codebase files) and Q3.3B.7-bis (catalog-empty fail-fast) were conflicts surfaced during pre-flight reads, not during implementation. Q3.3B.5 was a brief-vs-readiness-brief documentation disagreement; Q3.3B.7-bis was a gap in the brief's question list that the helper-source-code read exposed. Both were locked BEFORE writing handler code, avoiding the rework cost that would have hit if discovered mid-implementation. **Same discipline as Slice A's Q3.3A.10 (spec/code field-name drift) and Task 3.4's Q3.4.1 (numerical-stage vs data-flow ordering) — pre-flight surface > mid-implementation rework.**
- **The skill-router helper's two-call shape (`requires-host-agent` envelope, then commit with `hostAgentAnswer`) IS Pattern 1.** The helper externalizes the agent reasoning step structurally — plan mode receives the prompt, commit mode receives the response. Slice B didn't have to invent this — it was already in the helper's design (skill-router.js:158-222). Using the helper as designed (vs working around it) made Slice B's plan-mode + commit-mode dispatchers trivial to write. **Pattern: when the canonical primitive's shape matches the Pattern 1 boundary, lean into it; don't add a custom layer.**
- **The implicit transition on coverage-zero is structurally cleaner than an explicit `transition: 'present'` field.** Slice A's Plan stage requires the agent to remember to set `transition: 'plan_skills'` on the final-milestone commit; Slice B's Stage 5.5 fires the transition automatically when no leaves remain pending. The structural enforcement removes a class of failure (agent forgets to advance + user stays stuck in a stage with no work). Future stages with a "process every element" shape (e.g., Phase 4's potential per-leaf execution sweep) should consider the same pattern.
- **The `pending_skill_resolution` flag is the single-bit boundary between Slice A (writes it) + Task 3.4 (writes it on agent-inserted leaves) + Slice B (reads it, clears it).** Three independent commits, one structural seam, zero coordination overhead. The placeholder field made Slice B independently developable from Slice A and Task 3.4 — a strong example of structural decoupling via a documented seam. Future cross-slice/cross-task coordination should aim for the same single-bit shape.
- **Estimation calibration: state-machine shape, not universal under-estimate.** Two prior data points (Slice A 40-50% under, Task 3.4 40-50% under) both involved heavy state-machine code (5 stages × 2 modes for Slice A; insert+prune+re-analyze dual-phase for Task 3.4). Slice B's enumerate-resolve-loop is structurally lighter — one main loop, three branches (resolve/skip/reanalyze), and the heavy lifting (prompt construction, JSON parse, catalog parse) is delegated to the skill-router helper that Phase 1 already built. **Don't generalize the 40-50% under-actual pattern to all future Phase 3 / 4 / 5 modules — verify by shape, not by historical average.**

**Post-review ratification candidates (orchestrator concur expected):**
- **`skip` and `reanalyze` commit kinds ratified as defensible Pattern 7 enrichment.** The Q3.3B batch locked only `kind: 'resolve'` (via Q3.3B.4 payload schema). Implementation added two more kinds matching the action paths in the plan-mode dispatch text: `skip` (user-initiated low-confidence default) and `reanalyze` (transition back to Stage 5 Plan to re-emit the milestone's leaves). Without these kinds, the action paths would be unimplementable. Same pattern as Task 3.4's `re-analyze` kind added on top of the brief's locked insert+prune duo. Surfaced explicitly in this entry's `applyPlanSkillsTurn` description, not silent scope creep.
- **Estimation calibration note (Failure Mode #7 third data point).** Slice B's actual landed within 1% of the brief estimate — the inverse of the Slice A + Task 3.4 pattern. Track Task 3.8 (Plan-quality check / Stage 6) as the fourth data point: if it also lands within band, the "40-50% under-actual" pattern is confirmed as state-machine-specific, not universal. If Task 3.8 also runs significantly over, two outliers vs one within-band would suggest re-estimating the conditional. Either way, the Phase 7 shared instruction-text template helper ask should NOT be auto-promoted just because two prior tasks ran over — verify which module shapes actually need it.

**Next:**
- Surface Slice B work for commit approval. Proposed boundary: single commit `ovd-plan(phase-3.task-3.slice-b): RESOLVE SKILLS sub-step (planning-time canonical, per-leaf)`. All code + tests + this log entry + Slice A state-machine patches (STAGES extension + applyPlanTurn transition flip + buildLeafAnnotations rationale/considered copy) go together per `feedback_commit_cleavage`. Commit message body explicitly calls out the Slice A patches as Slice B boundary work, so future readers understand the Slice A + Slice B cleavage.
- **After Slice B commit lands:** per the readiness brief task order, **Task 3.8 (Plan-quality check / Stage 6)** lands next. Task 3.8 builds `verifyPlanQuality(tree, requirements)` — coverage check (every functional requirement traces to ≥1 leaf), leaf completeness (every leaf has full contract including the RESOLVE SKILLS quartet that Slice B now writes), goal-backward heuristic. Task 3.8 depends on Slice B's coverage invariant being enforceable — every leaf must have skills/confidence/rationale/considered, no `pending_skill_resolution: true` survivors. Task 3.8's plan-quality contract is the third estimation data point. Recommend handoff to a fresh context before Task 3.8 per the established pattern (context likely in the 60-70% range after Slice B given Stage 5.5's smaller-than-expected surface).

### 2026-06-14 — Session 16 (Phase 3 Task 3.8 COMPLETE — Plan-quality check / Stage 6 Verify)

**Did:**
- **Q&A batch surfaced + locked before code (Q3.8.1–Q3.8.11).** Brief listed 8 anticipated questions; pre-flight surfaced 3 more (Q3.8.3 coverage scope, Q3.8.4 tree source precedence, Q3.8.10 agent-verdict validation rules). Total 11 locked. Architect concur added 4 refinements applied during implementation: (1) envelope REPORTS all three requirement categories for transparency but only ENFORCES trace on functional[]; (2) `pending_skill_resolution: true` is a distinct `failure_kind: 'skill-resolution-skipped'`, NOT bundled into generic missing-fields — surfaces root cause (Slice B skipped) instead of symptom; (3) trace keys MUST stringify-equal valid integer indices in `[0, functionalLen)` with `reason: 'invalid-trace-key'` rejection; (4) Task 3.8 boundary excludes the `/ovd-plan verify` subcommand + STAGES entry — those are Slice C territory. Surface-conflicts-before-code discipline now at **5th instance** (Q3.3A.10 → Q3.4.1 → Q3.3B.5 → Q3.3B.7-bis → Q3.8.3/4/10).
- **Created `lib/ovd-plan/plan-quality.js` (~738 lines):**
  - Constants: `STATUS='plan-quality'`, `SESSIONS_REL`, `REPORT_FILENAME_PREFIX`, `REQUIREMENTS_REL`, `REQUIREMENT_CATEGORIES`, `VALID_CONFIDENCE` (high/medium/low), `VALID_VERDICTS` (pass/gap/reroute), `REQUIRED_LEAF_FIELDS` (9 entries per Slice A + Slice B contract).
  - `parseRequirements(rootDir)` + `extractBullets(content, headerText)` — parse Phase 2 Task 2.5's requirements file format (`## Functional` / `## Non-functional` / `## Out of scope` with bullet-list bodies). Returns `{functional, nonFunctional, outOfScope}` arrays or `null` if file absent. Missing sections yield empty arrays.
  - `resolveTreeFromOpened(opened)` — proposed-first-fallback-to-committed per Q3.8.4 lock. Returns `{source: 'proposed'|'committed'|null, milestones, revision}`. The `committed` path uses `rollUpCommittedLeaf` to project annotations onto the leaf object so leaf-completeness sees a uniform shape regardless of source — same Q3.4.7 unknown-key tolerance technique inverted (read direction instead of write direction).
  - `flattenLeaves(milestones)` — `[{milestone_id, leaf}]` enumeration in tree order.
  - `checkLeafCompleteness(leaf)` — pure CLI check; returns `{ok, failure_kind, message, missing_fields?, invalid_field?}`. Failure kinds: `invalid-leaf` / `skill-resolution-skipped` (Q3.8.5 amplify) / `missing-fields` (with `missing_fields[]` list) / `invalid-fields` (with `invalid_field`). Validates 9 required-field presence + 13 type/shape rules (description non-empty / scope object with .in + .out arrays / success non-empty array / verify object with method+fallback non-empty strings + boolean review_required / deps array / skills array / confidence enum / rationale string / considered array).
  - `runLeafCompleteness(milestones)` — returns `{passed_leaf_ids, failed: [{leaf_id, milestone_id, failure_kind, message, missing_fields?, invalid_field?}]}`.
  - `buildPlanQualityTurn(rootDir, opts)` — plan-mode dispatcher. openState → resolveTree → parseRequirements → fail-fast on no-tree / no-requirements. Pre-computes leaf-completeness at plan-mode time (pure CLI, no agent needed). Emits bundled Pattern 1 dispatch artifact per Q3.8.8 lock: requirements (3 categories) + milestones + leaves + per-milestone children_success_criteria + instructions + commit syntax example. Action paths: (1) accept and commit, (2) iterate via /ovd-plan deliberate, (3) describe-other.
  - `applyPlanQualityTurn(rootDir, entries, opts)` — commit-mode handler. Bundled validation: `validateTrace` (Q3.8.10 amplify — strict integer-keyed regex `^[0-9]+$`, in-range check, leaf-id existence check) + `validateUncovered` (integer in range, no duplicates) + `validateMilestoneVerdicts` (every milestone has a verdict, no duplicates, verdict ∈ {pass,gap,reroute}, notes non-empty). Coverage assertion: every functional requirement index appears in exactly one of trace-covered or uncovered_indices — no silent gaps. On success: re-runs leaf-completeness (state may have changed between plan and commit), writes report to `.overdrive/sessions/<timestamp>-plan-quality-<revision>.md`, returns envelope with summary + coverage + leaf_completeness + goal_backward + report_path.
  - `renderReport(input)` — human-readable session file: Coverage (with `[pass]` / `[GAP]` per requirement), Non-functional + Out of scope (transparency only), Leaf completeness (passed + failed with failure_kind detail), Goal-backward (per-milestone verdict + notes). Self-documenting footer explains Q3.8 lock (CLI custodian, not grader).
  - `runPlanQualityCheck(rootDir, opts)` — top-level orchestrator. Plan-mode → build; commit-mode → apply. Consumed via `ovdPlan.runPlanQualityCheck` namespace export.
- **`lib/ovd-plan/index.js` wiring (additive only):** require + namespace `planQuality: planQualityModule` + top-level `runPlanQualityCheck: planQualityModule.runPlanQualityCheck`. **No subcommand route added** per architect's Q3.8.1 / Q3.8.11 boundary lock — `/ovd-plan verify` (or equivalent) + the verify STAGES entry are Slice C territory. Task 3.8's standalone surface is consumable programmatically (Slice C will call `runPlanQualityCheck` from a verify-stage handler in deliberate.js; tests call it directly).
- Wrote `scripts/test-ovd-plan-plan-quality.js` (**194 checks across 13 scenario groups**, within Pattern 8's 150-200 target band):
  - **Module surface** (15 exports + ovdPlan namespace + STATUS round-trip + REQUIREMENT_CATEGORIES shape + enum-membership checks for VALID_CONFIDENCE / VALID_VERDICTS).
  - **parseRequirements + extractBullets** (5 fixtures: missing file → null; all three categories populated → 3+2+1 counts; functional-only → empty siblings; empty-functional section → empty array; bullet extraction with whitespace + ## boundary).
  - **resolveTreeFromOpened** (4 cases: nothing → null; proposed-wins-over-committed; committed-fallback with annotations rolled up via `rollUpCommittedLeaf`; empty proposed → fall back to committed).
  - **rollUpCommittedLeaf** (5 sub-checks: id preserved + skills/confidence/scope rolled up + inserted_by ride-through for Task 3.4 surface preservation).
  - **flattenLeaves** (4 cases: 3-leaf tree order preserved; empty milestones; milestone with no children).
  - **checkLeafCompleteness** (18 cases — every required-field missing case + every type/shape rejection case + pending_skill_resolution=true → skill-resolution-skipped + the message mentions "Stage 5.5 | RESOLVE SKILLS" for user-facing actionability).
  - **runLeafCompleteness** (5 sub-checks: 1 passed + 2 failed + skill-resolution-skipped variant + missing-fields variant + milestone_id preserved on failure entries).
  - **buildPlanQualityTurn** (missing-plan / no-tree / no-requirements + happy with 17 sub-checks: status / mode / tree_source / requirements present / leaves count / leaf_completeness pre-computed / text includes Stage 6 + functional reqs + non-functional reqs + verdict options + leaves-by-milestone + action paths + commit syntax + expectedPayload shape + skipped-leaf surfaces failure).
  - **validateTrace** (7 rejection cases — null/array/non-integer key/out-of-range key/negative key/value-not-array/value-contains-non-string/unknown-leaf-id, all with Q3.8.10 amplify "invalid-trace-key" reason).
  - **validateUncovered** (6 cases — happy + empty + not-array + float/negative/out-of-range + duplicate).
  - **validateMilestoneVerdicts** (8 cases — happy + not-array + missing-id + unknown + invalid-verdict + empty-notes + duplicate + incomplete-coverage).
  - **applyPlanQualityTurn** (8 scenarios — reject null/array + incomplete-coverage (with sessions-file-not-created assert) + covered-and-uncovered + unknown-leaf + happy with 17 sub-checks including report file written with sections (Coverage / Non-functional / Out of scope / Leaf completeness / Goal-backward) + GAP+pass tags + zero-functional edge case + skipped-leaf surfaces failure in report + committed-tree fallback via writer round-trip).
  - **runPlanQualityCheck orchestrator** (plan + commit dispatch).
  - **migration-compat seam** (no-block fresh project → error envelope; no sessions dir created — Pattern 5 enforced).
  - **formatPlan / formatCommit**.
- Updated `package.json`: added `lib/ovd-plan/plan-quality.js` + `scripts/test-ovd-plan-plan-quality.js` to the `check` chain (now 45 files: +1 source / +1 test versus Slice B's 43); added `scripts/test-ovd-plan-plan-quality.js` to `test:ovd-plan` (now 20 suites).

**Verified:**
- `npm run check` ✓ (45 files: +1 source / +1 test versus Slice B's 43).
- `npm run test:ovd-plan` ✓ — **2499 checks total** (was 2305; +194 plan-quality new; no other suite changed). Per-file: fs 59, parser 104, writer 28, cache 39, skill-router 53, workflow 204, migrate 150, decisions 81, preferences 80, requirements 88, codebase-mapper 135, drift 99, refresh 124, display 137, deliberation-state 93, calibrate 103, deliberate 290, blind-spot 242, plan-skills 196, **plan-quality 194 (new)**.
- `npm run test:workflow` ✓ — `ovd-workflow tests passed` (no v1 regression; plan-quality is additive standalone — no deliberate or blind-spot or plan-skills touched).
- `npm run eval:router` ✓ — 269/269 (no SKILL.md edits).
- **No CLI live smoke tests** by design — Slice C owns the `/ovd-plan verify` subcommand route. Task 3.8's orchestrator round-trip is exercised in the test suite via `ovdPlan.runPlanQualityCheck(rootDir, opts)` direct calls in plan-mode + commit-mode + with-skipped-leaf + zero-functional-requirements + committed-fallback scenarios. Slice C will add the live CLI smoke when it lands the subcommand route.

**Decided:**
- **Coverage scope: functional[] only (Q3.8.3 lock).** Non-functional requirements are cross-cutting (Task 3.4's blind-spot inserts security/perf/a11y leaves that cover non-functional categories without 1:1 trace); enforcing trace coverage on Non-functional[] would over-fire false positives. Out-of-scope is informational by definition — not implemented. **All three categories ARE reported in the envelope + the sessions report file for transparency.** Only functional[] coverage is ENFORCED via the trace+uncovered_indices coverage-assertion rejection. Pattern: coverage semantics differ by requirement-category type; enforcement is a category-level decision.
- **`pending_skill_resolution: true` is its own failure_kind (Q3.8.5 amplify).** The presence of this flag on a leaf at Stage 6 time means Slice B was skipped — root cause, not symptom. Treating it as a generic "missing rationale/considered field" would surface the symptom (downstream effect: the resolve helper hasn't populated those fields yet) while obscuring the cause. The distinct `skill-resolution-skipped` failure_kind with a Stage-5.5-referencing message tells the user exactly what to do: "Run /ovd-plan deliberate to complete Stage 5.5." Same precedent as Task 3.4's "per-node validation before category-coverage check" — surface specific over aggregate.
- **Bundled dispatch over split (Q3.8.8 lock).** Single Pattern 1 dispatch carries requirements + milestones + leaves; agent returns one commit payload with both `trace` + `milestone_verdicts`. Coverage and goal-backward are conceptually one user-facing report; doubling user-facing turns to split them would create asymmetric latency without information gain. Two-call split would only be justified if goal-backward depended on coverage results — it doesn't.
- **Tree source precedence: proposed-first-fallback-to-committed (Q3.8.4 lock).** During deliberation (Slice C's eventual Verify stage), `proposed_tree` exists in deliberation-state — use it. Post-Stage-8 (retrospective audit via Slice C's eventual `/ovd-plan verify` subcommand), only the committed tree exists — fall back to `parsed.tree.children`. Both paths roll annotations up to a uniform leaf shape via `rollUpCommittedLeaf` so `checkLeafCompleteness` doesn't have to special-case the source. The committed-tree path is tested via writer roundtrip (test-ovd-plan-plan-quality.js committed-fallback scenario) which proves the seam works end-to-end through parse → resolve → roll-up → check.
- **No subcommand route + no STAGES entry in this commit (Q3.8.1 / Q3.8.11 boundary lock).** Task 3.8 ships `runPlanQualityCheck` as a programmatic API only. Slice C adds the deliberate.js Verify stage routing AND (likely) the `/ovd-plan verify` direct entry. Keeping these separate preserves slice cleavage discipline — Slice C is a wiring task that can be reviewed independently. Same precedent as Slice B's `runPlanSkills` which is consumed by deliberate's stage routing without needing its own subcommand route at runPlan level.
- **Reports written to .overdrive/sessions/<timestamp>-plan-quality-<revision>.md (Q3.8.9 lock).** Plan-mode returns envelope only (no file write); commit-mode writes the user-readable session report AND returns the envelope for programmatic consumption by Slice C. Sessions directory creation is idempotent (`fs.mkdirSync(..., { recursive: true })`); the timestamp prefix `<iso-replaced-with-dashes>` makes file ordering chronological without further indexing.
- **Reports include passing leaves explicitly, not just failures.** `renderReport` lists every passing leaf with `[pass] <leaf_id>` (not just the count). Rationale: gives the user a concrete audit trail — "yes, I checked I.1 and it passed" — instead of an invisible win. The Task 3.4 precedent for `inserted_reason` preservation on inbox writes (terse external is render choice, NOT data drop) generalizes: surface what was checked AND what passed, not just what failed.
- **`renderReport` is a pure function of input data.** No reads from disk, no globals. Called by `applyPlanQualityTurn` with the computed coverage + leaf_completeness + goal_backward data. Test-isolatable via unit test (not covered in this commit's 194 — it's transitively covered via the apply-happy report-file-contents assertions, but a Phase 7 polish could add direct unit tests for the markdown output structure).

**Committed:**
- (not yet — proposing single-commit boundary per `feedback_commit_cleavage`. Files in scope: `lib/ovd-plan/plan-quality.js` (new — ~738 lines), `scripts/test-ovd-plan-plan-quality.js` (new — 194 checks), `lib/ovd-plan/index.js` (mod — require plan-quality + namespace export + top-level runPlanQualityCheck export; **no subcommand route**), `package.json` (mod — check + test:ovd-plan chains), `docs/superpowers/specs/2026-06-08-ovd-plan-implementation-plan.md` (mod — this entry).)

**Deviations from plan:**
- **plan-quality.js line count came in at 738 lines vs brief's 300-400 estimate (~84% over the high-end).** This is the 4th estimation calibration data point and it **broke the cleanly-bifurcated pattern** that Slice B established. Slice A (~600 → 901 ≈ 50% over), Task 3.4 (~510 → 754 ≈ 48% over), Slice B (~400-500 → 405 ≈ 1% under high-end), Task 3.8 (~300-400 → 738 ≈ 84% over). Three of four landed substantially over; one landed in band. The pattern is NOT cleanly state-machine-vs-not. Task 3.8 is a linear three-check sweep — not a state machine — but it ran 84% over. **Reason: Task 3.8's heaviness is in (a) the human-readable report rendering (~75 lines), (b) the bundled Pattern 1 dispatch instruction text (~50 lines), and (c) exhaustive multi-payload validation (3 validate* functions ≈ 80 lines combined).** Slice B avoided most of this because it delegates the heavy work (prompt construction, JSON parse, catalog parse) to the skill-router helper that Phase 1 built. Task 3.8 has no such helper to delegate to — `.overdrive/sessions/<ts>-plan-quality-<rev>.md` is generated inline. **Refined finding: estimation under-counts emerge whenever the module owns either (1) a state machine OR (2) substantial user-facing report rendering OR (3) exhaustive Pattern 4 validation across multiple sub-payloads.** Slice B avoided ALL THREE; Task 3.8 hit (2) + (3); Slice A + Task 3.4 hit (1) + (3). The Phase 7 polish ask (shared instruction-text template helper) would meaningfully reduce (2) but not (3). Worth tracking the next two phases' module shapes against this 3-factor model.
- **Architect concur added 4 refinements (transparency reporting + skill-resolution-skipped distinct failure_kind + strict integer trace-key validation + boundary clarification) that strengthened the locked design without changing scope.** Recorded under "Did" + "Decided"; not silent.

**Key insights worth preserving:**
- **Pre-flight question surfacing has stabilized as a structural pattern.** 5 instances now: Q3.3A.10 (writer-canonical field-name drift) → Q3.4.1 (numerical-stage vs data-flow ordering) → Q3.3B.5 (codebase context one-file-vs-both) → Q3.3B.7-bis (catalog-empty fail-fast) → Q3.8.3/4/10 (coverage scope + tree source + trace-key validation). Each instance turned a potentially-mid-implementation rework into a pre-code design lock. **Suggested Phase 7 polish: a kickoff-brief template that explicitly invites the implementer to surface pre-flight design questions — formalize what's currently emerging organically.** This is now load-bearing for slice quality; codifying it should be cheap.
- **The `rollUpCommittedLeaf` seam mirrors the Q3.4.7 write-side discovery (writer.reorderObject's unknown-key tolerance) but in the read direction.** Q3.4.7 established that writer.js tolerates unknown annotation keys (insertion order at end of dump → round-trip preserved). `rollUpCommittedLeaf` is the dual: it reads annotations from a committed leaf and projects them onto the leaf's own keys, making the leaf shape uniform regardless of whether the source is a proposed_tree leaf (annotations at leaf top-level) or a committed leaf (annotations in `leaf.annotations`). Together these patterns make the leaf-shape contract durable across both write and read directions without requiring a normalization pass at parse time.
- **The bundled Pattern 1 dispatch (Q3.8.8) generalizes to any multi-check reporting task.** Coverage + goal-backward + leaf-completeness are three checks producing one report. The bundled dispatch ships one plan-mode artifact and accepts one commit payload regardless of how many sub-checks need agent reasoning vs. CLI-side validation. Future tasks with similar shape (Task 3.6 EDIT's diff-before-apply, Task 4.5 SECURITY review's threat-vs-mitigation matrix) can use the same shape. The structural rule: bundle when checks are independent (no temporal dependency between agent responses); split when one check's result feeds another.
- **Coverage semantics differ by requirement-category type is a worth-amplifying finding.** Functional requirements are 1:1-traceable; non-functional are cross-cutting (covered by blind-spot inserts that span milestones); out-of-scope is by-definition not-implemented. Slice C's Verify-stage wiring should preserve this category-level decision — don't fail the deliberation flow on non-functional gaps. If future phases (Task 4.5 SECURITY) need a similar split — e.g., "security threats[] traces 1:1, but cross-cutting controls[] reports without enforcing trace" — the precedent is set here.
- **Three-factor estimation model is more useful than the binary state-machine-vs-not.** Four data points across Slice A + Task 3.4 + Slice B + Task 3.8 show that the 40-50% under-estimate fires whenever a module owns state-machine OR substantial user-facing report rendering OR exhaustive Pattern 4 validation across multiple sub-payloads. Slice B avoided all three by delegating to the helper. Task 3.8 hit (2) + (3) and ran 84% over. **For Phase 4 / 5 estimation, check the module's shape against these three factors BEFORE locking the line estimate.** The Phase 7 polish ask (shared instruction-text template) addresses (2) only; (1) and (3) need separate ergonomics.

**Post-review ratification candidates (orchestrator concur expected):**
- **The 4 architect refinements applied during implementation (transparency reporting / skill-resolution-skipped failure_kind / strict integer trace-key validation / Slice C boundary protection).** All four strengthened the locked design without expanding scope. Each is documented in this entry under "Decided" or "Did" with explicit reasoning.
- **Estimation calibration model refined.** Three-factor model (state machine / report rendering / Pattern 4 validation across multi-payload) replaces the bifurcated state-machine-vs-not model from Slice B's §7 entry. Phase 4 / 5 module estimation should reference this model.

**Next:**
- Surface Task 3.8 work for commit approval. Proposed boundary: single commit `ovd-plan(phase-3.task-8): plan-quality check (Stage 6 — coverage + leaf-completeness + goal-backward)`. All code + tests + this log entry go together per `feedback_commit_cleavage`. **No Slice A / Slice B / Task 3.4 patches needed** — Task 3.8 is a standalone module with no state-machine surface changes (Slice C will own the deliberate.js wiring).
- **After Task 3.8 commit lands:** per the readiness brief task order, **Task 3.3 Slice C (Stage 6 wiring inside Socratic flow)** lands next. Slice C extends STAGES to 9 entries (`elicit / spec / blind_spot / plan / plan_skills / verify / present / commit / committed`), patches `applyPlanSkillsTurn`'s implicit transition to target `'verify'` instead of `'present'`, adds a `runVerify` handler in deliberate.js that delegates to `ovdPlan.runPlanQualityCheck(rootDir, opts)` for the actual check + reads its envelope to drive the next action paths. Slice C also wires the `/ovd-plan verify` direct subcommand route in index.js for retrospective audits. Slice C's surface is small (a wiring layer) — estimation should be ~200-300 lines for the deliberate.js patches + ~50 lines for the index.js subcommand + ~150 tests. The user signaled they'll dispatch a fresh implementer agent for the remaining Phase 3 tasks (Slice C + 3.9 + 3.5 + 3.6 + 3.7) after the Slice B + Task 3.8 ship pass. Phase 3 status at session end: **5.33 of 9 tasks complete** (3.1 + 3.2 + Slice A + 3.4 + Slice B + 3.8; remaining: Slice C + 3.5 + 3.6 + 3.7 + 3.9).

### 2026-06-15 — Session 17 (Phase 3 Task 3.3 Slice C COMPLETE — Stage 6 Verify wiring + `/ovd-plan verify` subcommand)

**Did:**
- **Pre-flight surfaced 4 substantive conflicts in the pasted brief vs canonical Session 16 §Next + r3 §5.3 BEFORE any code (6th instance of surface-conflicts-before-code).** (A) STAGES placement inverted — brief said insert `verify` between `present` and `commit` and patch `applyPresentTurn` approve→verify; canonical (Session 16 §Next + r3 §5.3 conceptual order "Spec → Plan → Verify → Present → Commit") puts `verify` between `plan_skills` and `present`, patching `applyPlanSkillsTurn`'s implicit transition target. (B) Brief's "approve transitions to commit" was a downstream symptom of (A). (C) Brief cited r3 §6.6 as the `/ovd-plan verify` spec — §6.6 is actually `/ovd-go verify` (LEAF VERIFY / CLUSTER VERIFY post-execution); `/ovd-plan verify` is implementation-only with no spec coverage. (D) Brief's Q3.3C.4 implied per-failure-category routing that doesn't exist in plan-quality's action paths. Orchestrator concur on all four — canonical wins on A+B+D; (C) locked as additive-without-spec-coverage + §6 follow-up entry added (this entry's accompanying §6 bullet).
- **Q3.3C.1'–Q3.3C.8' surfaced + locked.** Orchestrator concur on all 8 with one refinement on Q3.3C.4': auto-advance lives in a new `runVerifyStage` wrapper in **deliberate.js**, NOT in plan-quality.js (preserves Q3.8.1 standalone-module boundary). `plan-quality.js` remained UNTOUCHED in this commit.
- **`lib/ovd-plan/deliberate.js` changes:**
  - `STAGES` extended from 8 → 9 entries — inserted `'verify'` between `'plan_skills'` and `'present'`. Per r3 §5.3 conceptual ordering and Session 16 §Next canonical placement.
  - New `runVerifyStage(rootDir, opts)` function (~45 lines) — wraps `require('./plan-quality').runPlanQualityCheck(rootDir, opts)`. On commit-mode + clean envelope (`coverage.uncovered_requirement_indices.length === 0` AND `leaf_completeness.failed.length === 0` AND every `goal_backward` verdict `=== 'pass'`), opens deliberation-state via `openState`, sets `stage = 'present'`, calls `commitState`. Returns the plan-quality envelope augmented with `stage`, `transitioned`, and a one-line tail message ("Audit clean — transitioning to Stage 7 (Present + iterate)." OR "Audit has open items — stage stays at Stage 6 (Verify)..."). Lazy `require('./plan-quality')` matches the Slice B precedent for `plan-skills` (avoids circular-load).
  - `runDeliberate` switch: added `case 'verify': return runVerifyStage(rootDir, opts);` to BOTH plan-mode and commit-mode branches.
  - `module.exports`: added `runVerifyStage`.
- **`lib/ovd-plan/plan-skills.js` changes (implicit-transition flip):**
  - Module-level comment: "transition stage → 'present'" → "transition stage → 'verify' (Slice C — Stage 6 plan-quality audit precedes Stage 7 Present)".
  - `buildPlanSkillsTurn` no-pending-leaves message: "Stage 7 (Present)" → "Stage 6 (Verify)".
  - `buildPlanSkillsTurn` last-pending-leaf message: "stage → present (Stage 7)" → "stage → verify (Stage 6)".
  - `applyPlanSkillsTurn` actual transition: `inner.stage = 'present'` → `inner.stage = 'verify'` (the structural change; everything else is text).
  - `applyPlanSkillsTurn` transition tail: "Transitioning to Stage 7 (Present + iterate)" → "Transitioning to Stage 6 (Verify)".
- **`lib/ovd-plan/index.js` change (subcommand route):**
  - Added `if (options.subcommand === 'verify')` block in `runPlan` between the `'blind-spot'` block and the stub fallthrough. Resolves project dir, parses `--entries-json` with Pattern 4 guard (returns `status: 'plan-quality'` envelope on parse failure), then calls `planQualityModule.runPlanQualityCheck(rootDir, { mode, entries })` **directly** — NO `runVerifyStage` wrapper for the subcommand path. This preserves retrospective-audit semantics (no deliberation-state stage transition); per Q3.3C.5' lock, the subcommand path is for committed-tree audits and must never mutate stage.
- **`lib/ovd-plan/plan-quality.js`: UNTOUCHED.** Per Q3.8.1 / Q3.3C.4'-refinement, plan-quality stays standalone. The wrapper's transition logic lives in deliberate.js; the retrospective subcommand calls plan-quality directly.
- **Test updates across 3 files (+47 net checks):**
  - `scripts/test-ovd-plan-deliberate.js`: STAGES surface flipped (was 8 entries, now 9; added `STAGES contains verify`, `STAGES order: plan_skills before verify`, `STAGES order: verify before present`; replaced the old `plan_skills before present`). Added `runVerifyStage` export check. New "Stage 6 Verify (runVerifyStage)" test section: inline `fixtureVerifyStage(projectDir, opts)` helper (stage=verify + complete 1-leaf proposed_tree + requirements.md), plan-mode passthrough (5 sub-checks: ok + status=plan-quality + mode=plan + not-transitioned + stage-unchanged), commit-mode clean-envelope auto-advance (7 sub-checks: ok + stage=present + transitioned=true + text-contains-Audit-clean + text-contains-Stage-7 + persisted-stage=present), commit-mode uncovered stays-at-verify (6 sub-checks), commit-mode gap-verdict stays-at-verify (5 sub-checks), commit-mode failed-leaf stays-at-verify (4 sub-checks; drops `success` field via `dropLeafField`), `runDeliberate` dispatch via stage=verify (plan-mode and commit-mode — 7 sub-checks). `skipPlanSkills` test helper comment updated to reflect it now skips BOTH plan_skills and the downstream verify wrapper (the helper itself still sets stage='present' directly — it's a fast-forward, not a stage runner). **290 → 323 deliberate checks (+33).**
  - `scripts/test-ovd-plan-plan-skills.js`: 6 spots flipped from `'present'` to `'verify'` post-resolution (apply-resolve-last: stage/transitioned/persisted + Stage 7→6 regex; integration: II.1 transition + persisted; uniform: I.4 transition; partial: I.3 transition). Comment "Resolve the last leaf: implicit transition to 'present'" → "to 'verify'". **196 checks unchanged in count (assertions reshaped).**
  - `scripts/test-ovd-plan-plan-quality.js`: new "/ovd-plan verify subcommand (Slice C)" section. Bad-JSON Pattern 4 guard (4 sub-checks: ok=false + status=plan-quality + reason-includes-JSON + no-sessions-dir-written). Plan-mode dispatch (5 sub-checks: ok + status + mode=plan + stage-unchanged-stays-plan_skills). Commit-mode dispatch (7 sub-checks: ok + status + mode=commit + report_path-returned + **critical retrospective invariant: stage-unchanged-stays-plan_skills + no transitioned=true on subcommand path**). **194 → 208 plan-quality checks (+14).**
  - `scripts/test-ovd-plan-blind-spot.js`: NOT touched. Slice B's previous patches to its integration trace (the post-plan_skills assertion shape) are independent of Slice C — blind-spot integration uses `skipPlanSkills` to bypass both plan_skills AND verify, so the assertion at the Stage 8 commit boundary remains correct.

**Verified:**
- `npm run check` ✓ (45 files; **no new source or test files added** — Slice C is a wiring slice that modifies existing modules and existing test files only).
- `npm run test:ovd-plan` ✓ — **2546 checks total** (was 2499; +47 net: +33 deliberate, +14 plan-quality, 0 plan-skills assertion-reshape, 0 blind-spot). Per-file: fs 59, parser 104, writer 28, cache 39, skill-router 53, workflow 204, migrate 150, decisions 81, preferences 80, requirements 88, codebase-mapper 135, drift 99, refresh 124, display 137, deliberation-state 93, calibrate 103, **deliberate 323 (was 290; +33)**, blind-spot 242 (unchanged), **plan-skills 196 (unchanged in count; 6 assertions reshaped)**, **plan-quality 208 (was 194; +14)**.
- `npm run test:workflow` ✓ — `ovd-workflow tests passed` (no v1 regression; Slice C is additive — touches deliberate's switch, plan-skills' transition text, index's subcommand route).
- `npm run eval:router` ✓ — 269/269 (no SKILL.md edits).
- **CLI live smoke** deferred to next session's wrap-up review — the test suite's `ovdPlan.runPlan({ subcommand: 'verify', ... })` round-trips (3 scenarios: bad-json / plan-mode / commit-mode) cover the dispatch path end-to-end; deliberate's runVerifyStage tests cover the auto-advance path via direct calls AND via `runDeliberate` dispatch (4 dispatch-path sub-checks).

**Decided:**
- **Conflict resolutions (4 corrections to the brief, all orchestrator-concurred):**
  - **(A) STAGES placement = canonical, not brief.** r3 §5.3 conceptual order is "Spec → Plan → Verify → Present → Commit"; Session 16 §Next codified this; the brief's "verify between present and commit" was inverted. Verify goes between `plan_skills` and `present`.
  - **(B) Transition follows from (A).** Verify → present (forward to user iteration), not verify → commit. `applyPresentTurn` is UNTOUCHED in Slice C (its existing present→commit transition stays correct).
  - **(C) r3 §6.6 is `/ovd-go verify`, NOT `/ovd-plan verify`.** Slice C added the `/ovd-plan verify` subcommand without spec coverage; §6 follow-up entry (`Q3.3C-followup`) flags r4 amendment to add §6.7 (or §5.8) documenting the user-facing surface.
  - **(D) No per-failure-category routing.** Slice C is wiring, not action-path expansion. plan-quality's existing action paths (Q3.8.8 lock) — "accept and commit / iterate via /ovd-plan deliberate / describe-other" — are the user-facing surface; iteration sends the user back to whichever stage owns the issue via their own re-dispatch, not via auto-routing.
- **`runVerifyStage` wrapper lives in deliberate.js, plan-quality.js stays standalone (Q3.3C.4'-refinement lock).** Embedding the auto-advance in plan-quality.js would couple it to the deliberation state machine (violating Q3.8.1 boundary lock) AND force the retrospective subcommand path to conditionally skip the auto-advance via an opt-out flag. Cleaner: state-machine owner (deliberate.js) owns transitions; handler module (plan-quality.js) owns the audit work. Same separation as Slice B (plan-skills owns Stage 5.5 work; runDeliberate switch wires it) and Task 3.4 (blind-spot owns Stage 3 work). The wrapper is ~45 lines (slightly above the orchestrator's 20-30 estimate due to the verbose post-Object-assign envelope shape preservation).
- **Clean-envelope predicate is a conjunction of 3 conditions, not a single "ok" check.** `result.ok` from plan-quality means "the agent's payload was structurally valid and the report was written"; it does NOT mean "the audit found no gaps." The 3 clean conditions (coverage.uncovered_requirement_indices empty + leaf_completeness.failed empty + every goal_backward verdict === 'pass') are evaluated explicitly in `runVerifyStage`. This is structurally important — a payload could be perfectly-shaped (ok=true) but report uncovered functional requirements (1 gap) + a milestone with verdict='gap'; that scenario stays at verify, correctly. Tested explicitly via the verify-uncovered + verify-gap + verify-failed-leaf scenarios.
- **Retrospective subcommand path is structurally untestable for the auto-advance (and that's the point).** `/ovd-plan verify` calls `runPlanQualityCheck` DIRECTLY, bypassing `runVerifyStage`. Even on a clean envelope, the subcommand path emits no `transitioned: true` and no `stage: 'present'` — verified in test-ovd-plan-plan-quality.js's "verify cmd commit" scenario which explicitly asserts `persisted.stage === 'plan_skills'` (fixture's original stage, unchanged) AND `r.transitioned !== true`. This is the structural enforcement of the retrospective-audit invariant: there is no code path from the subcommand handler to the state-machine transition. Same discipline shape as Slice B's `already-resolved` rejection (no re-resolution path can exist because the only entry point requires `pending_skill_resolution === true`).
- **Lazy `require('./plan-quality')` in `runVerifyStage` mirrors Slice B's pattern.** Slice B's `runDeliberate` switch uses `require('./plan-skills').runPlanSkills(rootDir, opts)` inline (lazy-require) to avoid circular module-load between deliberate.js ↔ plan-skills.js. plan-quality.js has the same shape — it requires deliberate.js's `currentStage` / `reorderInner` exports transitively via `openState` round-trip. Eager top-level require would risk a load-order race. The diagnostic warnings about lazy `require` are the same false-positive convention that fires across every existing runPlan subcommand block in index.js (lines 48, 59, 86, 113, 144, 183, 188, 193, 220, 247, 274) — known convention, not net-new tech debt.
- **`skipPlanSkills` test helper remains a fast-forward to `present` (does not run plan_skills then advance).** Helper is a state-mutation shortcut for tests that want to exercise Stages 7+ in isolation without setting up verify-stage fixtures (which would need requirements.md + a complete proposed_tree). Setting `stage = 'present'` directly skips BOTH plan_skills AND verify; the helper's docblock now says so explicitly. Plan-skills' own tests exercise the natural plan_skills → verify transition; plan-quality's tests exercise the verify-stage audit; deliberate's downstream Stage 7+ tests use the fast-forward to focus on what they own.

**Committed:**
- (not yet — proposing single-commit boundary per `feedback_commit_cleavage`. Files in scope: `lib/ovd-plan/deliberate.js` (mod — STAGES extension + runVerifyStage wrapper + runDeliberate switch cases + module.exports addition), `lib/ovd-plan/plan-skills.js` (mod — transition flip + 4 text updates), `lib/ovd-plan/index.js` (mod — `/ovd-plan verify` subcommand route), `scripts/test-ovd-plan-deliberate.js` (mod — STAGES surface checks + runVerifyStage export check + Stage 6 Verify test section + skipPlanSkills comment update; 290 → 323), `scripts/test-ovd-plan-plan-skills.js` (mod — 6 assertions flipped present→verify + comment update; 196 unchanged in count), `scripts/test-ovd-plan-plan-quality.js` (mod — /ovd-plan verify subcommand smoke section; 194 → 208), `docs/superpowers/specs/2026-06-08-ovd-plan-implementation-plan.md` (mod — §6 Q3.3C-followup bullet + this Slice C §7 entry). **`lib/ovd-plan/plan-quality.js`: NOT touched** (Q3.8.1 boundary preserved). `package.json`: NOT touched (no new files).)

**Deviations from plan:**
- **runVerifyStage wrapper landed at ~45 lines vs orchestrator's 20-30 estimate (50% over the high-end).** Reason: the envelope-preservation pattern (`Object.assign({}, result, {...overrides})`) plus the dual clean-vs-not branching plus the lazy-require comment block expanded the bytecount. None of the 3 estimation factors from Session 16 (state machine / report rendering / Pattern 4 validation) apply — runVerifyStage is a thin wrapper. The over-run is from API-surface ergonomics (3 conditions × 2 branches × envelope-merge boilerplate), not module-shape complexity. **Calibration finding for future wrappers:** envelope-merge-style wrappers around Pattern 1 handlers add a fixed ~20-line overhead per wrapper (envelope spread + tail text + conditional state mutation + early-return guards). Not a flag; just data.
- **Test count came in at +47 vs orchestrator's 120-180 estimate.** The 120-180 was a TOTAL-net estimate; the actual decomposed as +33 deliberate (5 runVerifyStage scenarios × ~6 sub-checks each + 2 dispatch sub-checks) + +14 plan-quality subcommand smoke (3 scenarios × ~5 sub-checks). Plan-skills' 6 spot-flips don't add net count (assertions reshaped not added). Blind-spot untouched. **Calibration: wiring-slice tests come in well under the brief's bands because most of the underlying logic is exhaustively tested in the delegated modules already.** Slice B's +196 (and the +11 Slice A patches in deliberate) was an outlier driven by the new plan-skills.js module; Slice C is purely additive wiring on top of existing exhaustively-tested modules.
- **Architect-concur Q3.3C.4' refinement (wrapper-in-deliberate, not in plan-quality) applied as locked.** The original Q3.3C.4' draft put the auto-advance in plan-quality.js. The architect-concur refinement preserved Q3.8.1's standalone-module discipline. The implementation matches the refinement verbatim — plan-quality.js untouched, wrapper lives in deliberate.js.

**Key insights worth preserving:**
- **Pre-flight surface-conflicts-before-code now at 6th instance — discipline structurally outperforms architect briefs.** Q3.3A.10 → Q3.4.1 → Q3.3B.5 → Q3.3B.7-bis → Q3.8.3/4/10 → Q3.3C-A/B/C/D. Worth amplifying in the Phase 3 wrap-up entry per the orchestrator's direction: "pre-flight reads are now structurally outperforming the architect's brief alone. That's a healthy signal of the implementer's spec-vigilance discipline, not a sign of architect failure — the brief is intended to seed thinking, not lock down truth; the canonical state document is the truth." Phase 7 polish ask (kickoff-brief template explicitly inviting pre-flight design surfacing) gains a second data point supporting it.
- **The state-machine-owner vs handler-module separation is structurally important, not just stylistic.** Q3.3C.4'-refinement made the case explicit: putting the auto-advance in plan-quality.js would have coupled the standalone-module-by-design (Q3.8.1 lock) to the deliberation state machine, and would have forced the retrospective subcommand path to conditionally skip the auto-advance via an opt-out flag. The cleaner shape (wrapper in deliberate.js, plan-quality untouched) means the retrospective path is structurally untestable for the auto-advance — there is no code path from the subcommand handler to the state-machine transition. Same shape applies to Slice B (plan-skills owns Stage 5.5 work; runDeliberate switch wires it) and to Task 3.4 (blind-spot owns Stage 3 work). **Future phase work (Phase 4 /ovd-go, Phase 5 /ovd-log) should ask: "is the new work module standalone or does it own a stage transition?" — and if both, split it.**
- **Wiring slices have a distinct estimation shape from new-module slices.** Three data points now: Slice A (5 stages, 901 lines, 290 tests), Slice B (1 new module + state-machine patch, 405 + 11 lines, 196 + 11 tests), Slice C (1 wrapper + 4 text flips + 1 subcommand route, ~75 lines net, +47 tests). Slice C is the cleanest wiring shape — no new modules, no new test suites. **Wiring slices cap out at ~50-100 net lines of code + ~30-60 net tests** unless they expose a new public surface (like Slice C's `/ovd-plan verify` subcommand, which added the +14 plan-quality tests). Phase 7 polish + the Phase 4/5 estimation pass should reference this 3-shape model (new-module / state-machine-extension / wiring-only).
- **The retrospective-audit subcommand path's structural unreachability of the transition is a Pattern 7 enrichment in disguise.** `/ovd-plan verify` is action-path-bare (no "approve" path to a stage transition) because the user's options on a retrospective audit are: read the report, fix the codebase, re-run the audit. There is no deliberation state to transition because the deliberation is already committed. **This is the same structural enforcement as Slice B's `already-resolved` rejection — the only valid path from "no transition" to "transition" is via the deliberation state machine, which the subcommand path cannot reach.** Discipline pattern: when a feature has a "natural" path AND a "retrospective" path, the structural shape should make the retrospective path unable to fire the natural path's mutations, not just refrain from firing them by convention.
- **The 3-factor estimation model (Session 16 §Insights) is confirmed as conditional, not universal.** Slice C hit zero of factors (1)/(2)/(3) and came in at ~75 lines net (wiring) + envelope-merge boilerplate. The under-estimate pattern (40-84% over) emerges only when factor (1) state-machine OR (2) substantial user-facing report rendering OR (3) exhaustive Pattern 4 validation is present. Slice C confirms: wiring with no new module is the cleanest shape. Phase 4 / 5 estimation should reference this 4-data-point model (Slice A + Task 3.4 hit (1)+(3) → 40-50% over; Slice B hit none → within band; Task 3.8 hit (2)+(3) → 84% over; Slice C hit none → within band).

**Post-review ratification candidates (orchestrator concur expected):**
- **The 4 conflict resolutions (A/B/C/D) ratified as canonical.** All four are the implementer's pushback on the brief, with orchestrator concur. Recorded under "Decided" with explicit reasoning. (C) particularly has a §6 follow-up entry (Q3.3C-followup) to flag the r4 amendment.
- **Wiring-slice estimation shape ratified as the 4th estimation data point.** The 3-factor model from Session 16 §Insights now has 4 data points (Slice A / Task 3.4 / Slice B / Task 3.8) + a 5th data point (Slice C) confirming the conditional pattern. Phase 4 / 5 estimation should reference this 5-data-point model.

**Next:**
- Surface Slice C work for commit approval. Proposed boundary: single commit `ovd-plan(phase-3.task-3.slice-c): Stage 6 Verify wiring + /ovd-plan verify subcommand`. All code + tests + §7 entry + §6 Q3.3C-followup bullet go together per `feedback_commit_cleavage`. **plan-quality.js NOT in scope** — Q3.8.1 boundary preserved.
- **After Slice C commit lands:** per the orchestrator's staging direction, **Task 3.9 (deliberation-state persistence + re-entry per r3 §5.7)** lands next. Task 3.9 reads the STATE_KEYS schema accumulated across Slice A + Task 3.2 + Task 3.4 (now including Slice C's verify stage as a re-entry destination — "last plan-quality verdict" becomes a meaningful field for the re-entry summary). Task 3.9's Q&A batch (Q3.9.1–Q3.9.7) was anticipated in the brief but deferred until after Slice C lands per orchestrator concur (defer reasoning: carrying two open design surfaces simultaneously risks schema-read assumption drift, especially because Slice C's verify-between-plan_skills-and-present extension changes what Task 3.9's re-entry summary needs to surface). Phase 3 status at Slice C end: **6.33 of 9 tasks complete** (3.1 + 3.2 + Slice A + 3.4 + Slice B + 3.8 + Slice C; remaining: 3.5 + 3.6 + 3.7 + 3.9).

### 2026-06-15 — Session 17 continued (Phase 3 Task 3.9 COMPLETE — Multi-session deliberation re-entry)

**Did:**
- **Q&A batch Q3.9.1'–Q3.9.9' surfaced with recommendations + reasoning BEFORE code.** Orchestrator locked all 9 with two refinements: (Q3.9.1') explicit null-guard on `last_action` — re-entry does not fire when `last_action == null` (treats fresh state as "no prior activity to summarize"); (Q3.9.6') `{kind:'restart', confirm:false}` is an EXPLICIT cancel branch (clears `awaiting_restart_confirm`) distinct from the implicit "any non-confirm commit clears" rule. Both refinements applied.
- **Budget-discrepancy diagnostic from orchestrator: implementer was at 34% (user external measurement) vs my 65-70% (experiential self-estimate). Orchestrator correctly identified the 31-point gap as "accumulated prior work feeling heavy" — a known over-estimation pattern after a busy work cycle. Trust external measurement; proceed in same session.** Confirmed Task 3.9 implementation budget was comfortable; ship pass closed at ~64-79% per orchestrator's projection. **Calibration finding: when implementer self-estimates context, trust the harness's measurement over the feel of prior turns; the harness's prompt-caching compresses prior work in ways the implementer's experiential calibration cannot directly perceive.**
- **Created `lib/ovd-plan/reentry.js` (~620 lines):**
  - Constants: `STATUS='reentry'`, `THRESHOLD_MS_DEFAULT = 60*60*1000` (1 hour per Q3.9.1' lock), `REENTRY_KINDS = ['approved', 'review', 'restart', 'reconcile']`, `STALE_DETECTION_STAGES = Set('elicit', 'spec', 'blind_spot', 'plan', 'plan_skills')` (per Q3.9.4' conservative scope — verify/present/commit excluded), `SESSIONS_REL`, `PLAN_QUALITY_REPORT_PATTERN`.
  - `parseDateMs(iso)` / `nowMs(opts)` / `nowIsoFromOpts(opts)` — clock helpers. `opts.now` accepts number (ms) or ISO string; falls back to `Date.now()` on bad input.
  - `detectStaleState(opened)` — tree-drift detection per Q3.9.4'. Returns `{drifted, reason, proposedIds?, committedIds?}`. Fires only when stage ∈ STALE_DETECTION_STAGES + proposed_tree exists + committed tree exists + milestone ID sets differ.
  - `detectReentry(opened, opts)` — time-threshold detection per Q3.9.1' WITH orchestrator's null-guard refinement. Returns `{needsReentry, reason, elapsedMs?}`. Short-circuits to `needsReentry=true` when `pending_reentry === true`. Returns false on: `committed` stage / null `last_action` / unparseable `last_action` / `(now - lastMs) <= threshold`. Configurable threshold via `opts.reentryThresholdMs`.
  - `findLatestPlanQualityReport(rootDir)` — scans `.overdrive/sessions/` for files matching `-plan-quality-.*\.md`, returns the most-recent-by-mtime filename. This is Slice C's verify-stage hook (Q3.9.2') — surfaces "what verdict were you looking at" for re-entry mid-audit.
  - `renderCalibrationRecap(inner)` / `renderPosition(inner, rootDir)` / `renderOpenThreads(inner)` / `renderSummary(opened, rootDir)` — stage-aware + calibration-aware summary rendering. Position recap branches per stage: elicit (turn_count + last question) / spec/blind_spot/plan/plan_skills (milestone + leaf counts + revision) / verify (Stage 6 label + latest report path) / present/commit (proposed_tree summary + revision) / unknown (fallback line). Calibration recap respects `override='plain'` (one-line) vs `'detailed'` (axes + rationale) vs default (axes-only). Open threads serialize as bullet list; objects → JSON.stringify.
  - `renderRestartConfirmPrompt(inner)` — shared helper for the restart confirmation prompt; returns `{text, counts}`. Used by both `applyReentryTurn` (first-restart commit) AND `buildReentryTurn` (mid-restart-confirm re-entry, when user pauses after the first restart commit).
  - `buildReentryTurn(rootDir, opts)` — plan-mode dispatcher. Sets `pending_reentry: true` (DOES NOT update `last_action` per Q3.9.1' — trigger predicate stays true across repeated plan-mode invocations until user commits an action). If `awaiting_restart_confirm === true`, re-emits the restart-confirm prompt instead of the high-level summary (Q3.9.6' idempotence — user pausing mid-restart-confirm should see the same prompt on next bare invocation).
  - `buildStaleTurn(rootDir, drift, opts)` — plan-mode dispatcher for stale-state envelope. Sets `pending_reentry: true`. Renders drift reason + proposed/committed milestone IDs + 3 action paths (reconcile / restart / describe-other).
  - `applyReentryTurn(rootDir, entries, opts)` — commit-mode handler. Validates `{kind, ...}` shape + REENTRY_KINDS membership + `pending_reentry === true` gate.
    - `approved` — clears `pending_reentry` + `awaiting_restart_confirm`, updates `last_action`, returns resumed-stage envelope. User runs `/ovd-plan deliberate` again to render the next stage prompt.
    - `review` — clears flags, emits walkthrough of `answered_questions` verbatim (Q1[stage]: question / →A: answer / classification?), trailing "Resuming at stage X" line. Single-envelope dump per Q3.9.7' — no `review_replay` sub-stage.
    - `reconcile` — discards proposed_tree + blind_spot_inserted + current_proposal_revision; resets stage to elicit; PRESERVES calibration + answered_questions (the user's prior elicitation work survives). Returns reset envelope.
    - `restart` — double-confirm flow per Q3.9.6'. First commit without `confirm`: sets `awaiting_restart_confirm: true` + emits confirmation prompt with counts (turn_count + answered + milestones). Second commit `{confirm: true}` with awaiting: clears EVERY key except `calibration`, resets stage to elicit. Q3.9.6' refinement: `{confirm: false}` is an EXPLICIT cancel branch (clears `awaiting_restart_confirm` + `pending_reentry`, preserves all other state). `{confirm: true}` without awaiting → rejected with `reason: 'no-pending-restart'`.
  - `runReentry(rootDir, opts)` — plan/commit orchestrator.
- **`lib/ovd-plan/deliberate.js` changes:**
  - `STATE_KEYS` extended from 9 → 11 entries — appended `pending_reentry` + `awaiting_restart_confirm` (ride through writer.reorderObject's unknown-key tolerance per Q3.4.7 + Slice B precedent; no writer.js modification).
  - `runDeliberate` intercept added at the top, BEFORE the existing stage switch. Two-phase intercept: (1) plan-mode → stale-state detection first (drift wins because a drifted tree makes any summary misleading), then time-threshold re-entry. (2) commit-mode → if `pending_reentry === true`, route directly to `reentry.applyReentryTurn`; bypasses the stage switch. **Test-only opt-out:** `opts.skipReentry: true` short-circuits the intercept entirely (production callers never set it).
- **`lib/ovd-plan/index.js` changes:**
  - Added `reentryModule = require('./reentry')` at the top.
  - Added `reentry: reentryModule, runReentry: reentryModule.runReentry` to `module.exports`.
- **`package.json` changes:**
  - `check` chain: added `lib/ovd-plan/reentry.js` + `scripts/test-ovd-plan-reentry.js`. Now 47 files (was 45).
  - `test:ovd-plan` chain: added `scripts/test-ovd-plan-reentry.js`. Now 21 suites.
- **Wrote `scripts/test-ovd-plan-reentry.js` (227 checks across 20 scenario groups; **below the brief's 250-350 band by 9%** — see Deviations):** module surface (31 sub-checks: STATUS / THRESHOLD_MS_DEFAULT / REENTRY_KINDS / STALE_DETECTION_STAGES / SESSIONS_REL / PLAN_QUALITY_REPORT_PATTERN + 14 function exports + namespace exports); parseDateMs / nowMs / nowIsoFromOpts (12 sub-checks); detectStaleState (8 scenarios: null / ok=false / out-of-scope-stage / no-proposed-tree / no-committed-tree / matching / count-mismatch / id-mismatch); detectReentry (9 scenarios incl. Q3.9.1' null-guard + unparseable + configurable threshold); findLatestPlanQualityReport (4 scenarios: no-dir / no-files / single / pick-newer-mtime via utimesSync); renderCalibrationRecap (5: no-cal / null / plain / default-axes / detailed-with-rationale); renderPosition (8 stages × edge cases); renderOpenThreads (4: empty / undefined / bullet-list / object-serialization); renderRestartConfirmPrompt (7 sub-checks); buildReentryTurn (4 scenarios incl. idempotence + mid-restart-confirm re-emit); buildStaleTurn (6 sub-checks); applyReentryTurn validation (5 rejection cases: missing-plan / null entries / array entries / invalid-kind / no-pending); approved happy (7); review empty + populated (12); reconcile happy (10); restart double-confirm (first/confirm/no-pending-confirm/cancel × ~7 sub-checks each = 23); runReentry orchestrator (4); runDeliberate intercept integration (6 scenarios: no-state / recent / pause-fires / pending-commit-routes / skipReentry-opt-out / stale-drift-fires); migration-compat seam (2); formatPlan / formatCommit (4).
- **Updated `scripts/test-ovd-plan-deliberate.js`:** STATE_KEYS surface checks for `pending_reentry` + `awaiting_restart_confirm` (+2 new checks; length predicate updated from `>= 8` to `>= 11`). Two existing dispatch tests (`dispatch-bare-spec` / `dispatch-bare-blind-spot`) patched with `{ skipReentry: true }` — those tests exercise stage routing, not Task 3.9 intercept; their `applyElicitTurn`/`applySpecTurn` setup writes `last_action = FIXED_NOW` (2026-06-13) which exceeds the 1h threshold against real wall-clock and would have fired the intercept. Test-only opt-out is exactly the use case `skipReentry` was designed for. 323 → 324 deliberate checks (+1 net: +2 new STATE_KEYS checks − 1 reshape on existing length predicate; counted as net +1 because the existing length check itself didn't add).

**Verified:**
- `npm run check` ✓ (47 files: +1 source + +1 test versus Slice C's 45).
- `npm run test:ovd-plan` ✓ — **2774 checks total** (was 2546; +228 net: +227 reentry new + +1 deliberate STATE_KEYS new). Per-file: fs 59, parser 104, writer 28, cache 39, skill-router 53, workflow 204, migrate 150, decisions 81, preferences 80, requirements 88, codebase-mapper 135, drift 99, refresh 124, display 137, deliberation-state 93, calibrate 103, **deliberate 324 (was 323; +1)**, blind-spot 242 (unchanged), plan-skills 196 (unchanged), plan-quality 208 (unchanged), **reentry 227 (new)**.
- `npm run test:workflow` ✓ — `ovd-workflow tests passed` (no v1 regression; Task 3.9 is additive intercept).
- `npm run eval:router` ✓ — 269/269 (no SKILL.md edits).
- **Production routing path verified via integration scenarios** in test-ovd-plan-reentry.js's "runDeliberate intercept" section: pause > 1h fires intercept (`status='reentry'`, `kind='reentry-summary'`); pending_reentry + commit-mode routes to applyReentryTurn (`status='reentry'`, `kind='approved'`); post-approved bare invocation returns to normal stage routing (`status='deliberate'`); stale tree drift fires before time-threshold; `skipReentry: true` opt-out short-circuits intercept entirely.

**Decided:**
- **Q3.9.1' null-guard refinement (orchestrator-locked).** `detectReentry` explicitly returns `{needsReentry: false, reason: 'no-prior-activity'}` when `last_action == null`. The brief's original "(now - last_action) > THRESHOLD_MS" predicate would have arithmetic-NaN'd or fired incorrectly on null. Tested explicitly via 2 scenarios (missing field + explicit null).
- **Q3.9.6' explicit-cancel refinement (orchestrator-locked).** `{kind:'restart', confirm:false}` is a distinct branch in `applyReentryTurn` — clears BOTH `awaiting_restart_confirm` AND `pending_reentry`, updates `last_action`, returns cancelled envelope with `confirmed: false, cancelled: true`. Tested via the apply-restart-cancel scenario which asserts: awaiting cleared / pending cleared / stage preserved / turn_count preserved / proposed_tree preserved.
- **Mid-restart-confirm re-entry idempotence (implementer addition; surfaced inline).** If the user pauses AFTER the first restart commit (`awaiting_restart_confirm: true` + `pending_reentry: true`), a bare `/ovd-plan deliberate` invocation should re-emit the restart confirmation prompt — NOT the high-level summary. Without this, the user would see contradictory UX: "you said restart? Here's a summary of what to do." `buildReentryTurn` now branches on `awaiting_restart_confirm` and calls the shared `renderRestartConfirmPrompt` helper. Tested explicitly via the build-mid-restart-confirm scenario which asserts `kind === 'restart-confirm-resume'` + text does NOT contain the high-level summary header. Same structural shape as Slice C's `runVerifyStage` wrapper (state-machine owner translates handler envelope into appropriate stage-aware UX).
- **Stale-state detection scope (Q3.9.4' conservative lock honored).** Detection fires ONLY when stage ∈ STALE_DETECTION_STAGES = {elicit, spec, blind_spot, plan, plan_skills}. verify / present / commit / committed are excluded — at those stages, the committed tree is authoritative (or about to be), and proposed_tree differing from committed is by design rather than drift. Conservative shape favors false-negatives over false-positives — false-positives erode trust in the detection more than false-negatives erode safety. Phase 7 polish can widen the scope if real-world testing surfaces user-hand-edits at verify/present that the detection should catch.
- **Reconcile preserves answered_questions; restart destroys them.** The two paths have different semantic shapes. Reconcile = "the milestones are wrong, but my elicitation answers are still valid — let me re-emit the spec from those answers." Restart = "start over from scratch except for the verbosity preference." Reconcile is the less-destructive option offered specifically when stale-state detection fires; restart is the heavy hammer offered everywhere. Tested explicitly via both happy-path scenarios.
- **Calibration is invariant across reconcile + restart.** Both paths preserve `calibration` because verbosity preference is orthogonal to the deliberation content. Recalibration is a separate axis with its own `/ovd-plan calibrate` subcommand. Tested via both paths' persistence assertions.
- **Time-threshold uses `last_action` from deliberation-state, NOT clock-wall time from the OS.** `last_action` is updated by every commit handler across Slice A + Task 3.2 + Task 3.4 + Slice B + Slice C. If the agent's clock differs from the user's (rare, but possible in CI/containers), the threshold still works because both `last_action` and `now` are agent-clock-relative. The orchestrator's Q3.9.1' null-guard handles the fresh-state edge case.
- **Test-only `opts.skipReentry: true` opt-out is the canonical test-isolation mechanism for stage-routing tests.** Two existing tests in `test-ovd-plan-deliberate.js` (`dispatch-bare-spec` + `dispatch-bare-blind-spot`) need it because their setup writes `last_action = FIXED_NOW` (2026-06-13) which exceeds the 1h threshold against the real wall-clock. New tests that DO want to exercise re-entry behavior pass `opts.now` to control the clock instead. Production callers never set `skipReentry`. The opt-out semantics are documented in the deliberate.js source comment AND in this entry. Same pattern as `opts.skipBlindSpot` from Task 3.4 / `opts.skipPlanSkills` from Slice B (those are NOT production code paths either).

**Committed:**
- (not yet — proposing single-commit boundary per `feedback_commit_cleavage`. Files in scope: `lib/ovd-plan/reentry.js` (new — ~620 lines), `scripts/test-ovd-plan-reentry.js` (new — 227 checks), `lib/ovd-plan/deliberate.js` (mod — STATE_KEYS extension to 11 entries + runDeliberate intercept), `lib/ovd-plan/index.js` (mod — require reentry + namespace export + top-level runReentry export), `scripts/test-ovd-plan-deliberate.js` (mod — STATE_KEYS surface checks + 2 dispatch tests patched with skipReentry: true), `package.json` (mod — check + test:ovd-plan chains include reentry), `docs/superpowers/specs/2026-06-08-ovd-plan-implementation-plan.md` (mod — this entry).)

**Deviations from plan:**
- **Test count 227 came in 9% UNDER the brief's 250-350 band.** Reason: scenario consolidation. The brief estimated 4 distinct test concerns (restart double-confirm, stale-state, summary rendering, dispatch integration) each needing ~50-80 sub-checks. Actual scenarios merged some (e.g., restart double-confirm's 4 sub-flows ≈ 23 sub-checks; stale-state ≈ 8 sub-checks across detect + buildStaleTurn). **Calibration finding: scenario consolidation is a legitimate test-budget optimization when sub-flows share fixture setup; below-band test counts aren't auto-flag-worthy unless they leave specific failure modes uncovered. All 4 brief-anticipated concerns ARE covered.**
- **Source line count 620 came in WITHIN brief's 500-700 band (~17% over midpoint), UNDER the 3-factor model's prediction of 700-1100.** The 3-factor model (Session 16 §Insights) predicted factor (1)+(2) modules would run 40-60% over brief estimate. Task 3.9 ran 24% over the midpoint (in-band). **Calibration finding for the 3-factor model: factor (2) "substantial user-facing summary rendering" was actually well-modularized in reentry.js via the renderCalibrationRecap / renderPosition / renderOpenThreads decomposition — each helper is short, the orchestration in renderSummary is short, and the dispatch handlers reuse them. This is the OPPOSITE pattern from Task 3.8's inlined `renderReport` which contributed substantially to its 84% over-estimate. Phase 4/5 estimation: when factor (2) is heavy, ASK whether the module decomposes summary rendering into per-domain helpers (good shape) or inlines it (the Task 3.8 trap).** Task 3.9 is now the 5th data point on the 3-factor calibration model.
- **Implementer self-estimated context budget incorrectly by 31 points (65-70% vs orchestrator's correct 34% external).** Documented in §Did for future reference; calibration finding: trust harness measurement, not experiential weight of prior turns.

**Key insights worth preserving:**
- **Two-phase intercept (stale-state precedes time-threshold) is structurally important.** A drifted tree makes any summary potentially misleading — the user would be told "you decided X, Y, Z" when the underlying tree has different milestones than the deliberation-state thinks. Reconcile is the less-destructive corrective; restart is the heavy hammer. The ordering enforces "show drift before summary" which is the only safe sequencing.
- **`pending_reentry` is the single-bit boundary between detection (sets it) and resolution (clears it) — same pattern as Slice B's `pending_skill_resolution`.** Three independent code paths set or read it: `buildReentryTurn` + `buildStaleTurn` set; `applyReentryTurn` clears (on every action kind); commit-mode intercept in `runDeliberate` reads. The structural shape is the same as `pending_skill_resolution`: a single bit that can only flow from "needs work" → "work done" via the resolution handler, never the other direction.
- **The intercept's commit-mode path bypasses the stage switch entirely.** When `pending_reentry === true`, the user MUST resolve re-entry before any stage commit can fire. This is structural enforcement of r3 §5.7's "Never silent resume" rule — even if the agent sends a perfectly-shaped Stage 5 plan commit, the intercept routes it to applyReentryTurn which rejects with `invalid-kind` (the kind isn't in REENTRY_KINDS). Same shape as Slice B's `already-resolved` rejection — the structural enforcement prevents accidental forward motion across a paused boundary.
- **Renderer decomposition is the antidote to the 3-factor model's factor (2) under-estimation.** Task 3.8's `renderReport` (~75 lines inlined) contributed substantially to its 84% over-estimate; Task 3.9's renderCalibrationRecap (~10 lines) + renderPosition (~40 lines branching) + renderOpenThreads (~7 lines) + renderRestartConfirmPrompt (~20 lines) + renderSummary (~12 orchestration lines) total ~90 lines but are individually short and testable. **Pattern: when designing a module that hits factor (2), decompose rendering into per-domain helpers BEFORE writing any orchestrator. Phase 7 polish on Task 3.8's renderReport should refactor it to this shape.**
- **Pre-flight surface-conflicts-before-code now at 7th instance.** Q3.3A.10 → Q3.4.1 → Q3.3B.5 → Q3.3B.7-bis → Q3.8.3/4/10 → Q3.3C-A/B/C/D → Q3.9.1'-null-guard + Q3.9.6'-explicit-cancel. Two refinements surfaced as anticipated questions in the Q&A batch; orchestrator locked both. The kickoff-brief-template polish ask (Phase 7) gains a third data point supporting it.
- **Budget self-estimation has a known over-estimation bias after busy work cycles.** The orchestrator's diagnostic ("accumulated prior work feeling heavy" vs "specific re-read budget") is worth amplifying in the Phase 3 wrap-up entry. **Implementer calibration finding: always articulate the basis for a context estimate (specific re-reads + specific implementation surfaces) before claiming high context use. The harness's external measurement is the truth; experiential weight is not.**

**Post-review ratification candidates (orchestrator concur expected):**
- **Two refinements (Q3.9.1' null-guard + Q3.9.6' explicit-cancel) applied as locked.**
- **One implementer addition (mid-restart-confirm re-entry idempotence) — surfaced inline as a UX-coherence requirement, not a scope expansion.** The user pausing after the first restart commit shouldn't see "you said restart? Here's a summary." It's the same structural shape as Slice C's runVerifyStage envelope-augmentation — state-machine owner translates handler state into stage-aware UX.
- **3-factor model 5th data point with a refinement: factor (2) over-estimation can be mitigated by per-domain renderer helpers.** Task 3.8 inlined → 84% over; Task 3.9 decomposed → in-band. Phase 4/5 estimation should ASK about decomposition before locking the line estimate.

**Next:**
- Surface Task 3.9 work for commit approval. Proposed boundary: single commit `ovd-plan(phase-3.task-9): deliberation-state re-entry + stale-state detection (multi-session per r3 §5.7)`. All code + tests + this §7 entry go together per `feedback_commit_cleavage`. **No Slice C patches needed** — Task 3.9 is purely additive (new module + intercept layer above the existing stage switch + 2 small test patches for clock-aware opt-out).
- **After Task 3.9 commit lands:** per the original Session 1 brief's task order, the final Phase 3 trio (3.5 IDEA + 3.6 EDIT + 3.7 RESEARCH) lands in ONE final session. All three are post-deliberation command surfaces sharing the Pattern 1 dispatch shape; should fit comfortably in a single session per the Session 2 plan. Phase 3 status at Task 3.9 end: **7.33 of 9 tasks complete** (3.1 + 3.2 + Slice A + 3.4 + Slice B + 3.8 + Slice C + 3.9; remaining: 3.5 + 3.6 + 3.7).

---

### 2026-06-15 — Session 18 (Phase 3 Task 3.5 COMPLETE — `/ovd-plan idea` IDEA pipeline)

**Did:**
- **Pre-flight surface-conflicts-before-code at 8th instance.** Q3.5 design proposal surfaced BEFORE any code: module placement / Pattern 1 dispatch shape / approved-path new-chat handoff per Q8 lock / continue+research no-state-mutation / reject path inbox header + considered-but-not-adopted format / Q3.10 sketch sub-state stub for Phase 6 / commit boundary. ONE genuine open choice surfaced (decisions.md Node column for IDEA: chose `IDEA: <word-boundary-truncated 80 chars>` over flat `IDEA` / blank / agent-supplied — preserves searchability, identity, filterability). Orchestrator approved with ONE refinement: **word-boundary truncation** (mid-word truncation reads as malformed in the decisions.md table). Refinement applied as `truncateAtWordBoundary(text, maxLen)` helper that slices at the last whitespace before `maxLen-1` then appends `…`, with hard-truncate fallback when no usable space exists (single very-long words / last space < `maxLen/3`).
- **Created `lib/ovd-plan/idea.js` (~328 lines):**
  - Constants: `STATUS='idea'`, `ACTIONS = ['approved', 'continue', 'research', 'reject']`, `NODE_PREFIX = 'IDEA: '`, `NODE_MAX_LEN = 80`, `INBOX_HEADER_IDEA_REJECTED = 'Ideas considered but not adopted (rejected)'`.
  - `envelope(payload)` — adds `status: 'idea'` to every return shape (parity with deliberate/reentry envelope helper pattern).
  - `truncateAtWordBoundary(text, maxLen)` — word-boundary slicer with hard-truncate fallback; safe against non-string input. Returns text with appended `…` when truncation occurs.
  - `nodeIdentifierFromIdea(ideaText)` — collapses internal whitespace, trims, applies word-boundary truncation, prepends `IDEA: `. Returns the decisions.md Node-column identifier.
  - `summarizeProposedTree(opened)` — tree summary helper with proposed_tree-first-fallback-to-committed precedence per Q3.8.4 (plan-quality.js:125 precedent). Returns `{source: 'proposed'|'committed'|null, lines: []}` of one-liner milestone summaries for the agent's impact-analysis prompt context.
  - `buildIdeaPlan(rootDir, opts)` — plan-mode dispatcher per r3 §5.2. Tolerant of missing OVERDRIVE.md (early-stage brainstorming with no plan yet); soft-fails calibration read. Returns plan-mode envelope with: idea text echo / calibration (when present) / tree summary (when present) / internal-analysis instructions (Q9 dual-presentation per architect-level rigor) / external action-path render template (r3 §5.2 step 4) / Q3.10 sketch sub-state stub note / commit syntax for all 4 actions.
  - `normalizeIdeaEntries(rawEntries)` — Pattern 4 validation: action enum + idea_text required for all; `approved` additionally requires impact_summary + tradeoffs + suggested_route (with optional decision_rationale); `reject` additionally requires rejection_reason; `continue` / `research` need only action + idea_text. Returns `{ok, entries}` or `{ok: false, reason, errors}`.
  - `applyIdeaApproved(rootDir, entries, opts)` — calls `appendDecision({ date, node: nodeIdentifierFromIdea(idea_text), decision: suggested_route, rationale: decision_rationale || impact_summary })`. Returns approved-envelope with explicit new-chat handoff text per Q8 lock: "Recommend: start a fresh conversation and run /ovd-plan edit to integrate. Optionally run /ovd-log first to save current state." **No auto-route.**
  - `applyIdeaContinue(_, entries)` — pure no-op (no state mutation per pre-flight design). Emits "Re-run /ovd-plan idea \"<refined>\"" recommendation.
  - `applyIdeaResearch(_, entries)` — pure no-op. Emits "/ovd-plan research \"<idea>\"" recommendation + r3 §5.5 cross-reference.
  - `applyIdeaReject(rootDir, entries, opts)` — opens deliberation-state; appends to inbox under `INBOX_HEADER_IDEA_REJECTED` via `appendUnderHeader` with the `[considered-but-not-adopted: idea-rejected: <reason>] <idea_text> (<ISO timestamp>)` format (blind-spot.js:388-407 precedent). Sanitizes `\r\n` → space in both idea_text and rejection_reason to keep entries on a single inbox line. Requires existing OVERDRIVE.md (missing-plan returns explicit error).
  - `applyIdeaAction(rootDir, entries, opts)` — switch dispatcher across the 4 action handlers; returns `invalid-action` envelope if entries.action falls through (defense-in-depth even though normalizeIdeaEntries already gates on ACTIONS membership).
  - `runIdea(rootDir, opts)` — plan/commit orchestrator. plan-mode → buildIdeaPlan; commit-mode → normalize then dispatch.
  - `formatPlan` / `formatCommit` — text-formatter parity with other modules.
- **`lib/ovd-plan/index.js` changes:**
  - Added `ideaModule = require('./idea')` at the top.
  - Added `idea` subcommand case in `runPlan` (parity with calibrate/deliberate/blind-spot/verify Pattern 1 shape: resolveProjectDir → parse entriesJson → isCommit → call `ideaModule.runIdea(rootDir, {mode, text, entries})`). **`text` field threaded through** (CLI dispatch already maps `options.positionals.slice(1).join(' ')` → `options.text`; lib/installer.js:391, no installer change needed).
  - Added `idea: ideaModule, runIdea: ideaModule.runIdea` to `module.exports`.
- **`lib/ovd-plan/migrate.js` change (Task 3.5 multi-reject use case surfaced a latent bug):**
  - `appendUnderHeader(content, header, body)` — header is now regex-escaped before being interpolated into the matching pattern. Without this fix, headers containing regex metacharacters like `(`, `)`, `.`, `[`, `]` would not match their own emitted `## ... ` line on a second pass, causing duplicate headers. **Surfaced by Task 3.5's test-reject-multiple scenario** — running two reject calls with `INBOX_HEADER_IDEA_REJECTED = 'Ideas considered but not adopted (rejected)'` produced two `## Ideas considered but not adopted (rejected)` headers because the regex `(rejected)` matched a capture group, not the literal parens. Fix is `header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`. Latent in blind-spot.js's `INBOX_HEADER_NA = 'Blind-spot N/A categories (agent-deemed-not-applicable)'` and `INBOX_HEADER_PRUNED` too, but never surfaced there because blind-spot's Stage 3 inbox writes only fire once per session.
- **`package.json` changes:**
  - `check` chain: added `lib/ovd-plan/idea.js` + `scripts/test-ovd-plan-idea.js`. Now 49 files (was 47).
  - `test:ovd-plan` chain: added `scripts/test-ovd-plan-idea.js`. Now 22 suites.
- **Wrote `scripts/test-ovd-plan-idea.js` (169 checks across 16 scenario groups; **WITHIN the brief's 140-180 band — 6% above midpoint**):** module surface (22 sub-checks); word-boundary truncation (9 — incl. mid-word avoidance + hard-truncate fallback + non-string input); node identifier from idea (9 — incl. long-idea truncation + whitespace handling + empty/null input); summarizeProposedTree (8 — null/failed/no-innerObj/proposed-source/committed-source/depth-filter/empty-tree); buildIdeaPlan (22 — missing text + no-plan tolerance + with-proposed-tree + with-calibration; verifies Q9 marker + 4 action paths + new-chat handoff text + Q3.10 stub + all 4 commit-syntax examples); normalizeIdeaEntries (19 — invalid-shape + all action × required-field combinations + trimming); applyIdeaApproved (15 — happy path + decisions.md content + decision_rationale precedence over impact_summary + long-idea truncation); applyIdeaContinue (6 — text + no-mutation); applyIdeaResearch (8 — text + no-mutation + §5.5 ref); applyIdeaReject (12 — no-plan error + happy path + inbox content + newline sanitization + multi-reject single-header); applyIdeaAction dispatch (7 — all 4 actions + invalid-action); runIdea (8 — plan + commit + bad entries + null entries); runPlan subcommand dispatch (8 — plan + bad JSON + valid commit); module surface integration (3 — ovdPlan.idea + ovdPlan.runIdea + STATUS); formatters (4); locked-design pre-flight tripwires (8 — Q8 explicit "Recommend" + no "Running" + fresh-conversation; Q9 four-action-path render; Q3.10 Phase 6 sketch-stub mention).

**Verified:**
- `npm run check` ✓ (49 files: +1 source + +1 test versus Task 3.9's 47).
- `npm run test:ovd-plan` ✓ — **2943 checks total** (was 2774; +169 net: all new idea suite). Per-file: prior 21 suites unchanged; idea **169 (new)**.
- `npm run test:workflow` ✓ — `ovd-workflow tests passed` (no v1 regression; Task 3.5 is additive subcommand route + a regex-escape bugfix in appendUnderHeader that's defensive — no behavior change for existing callers without metacharacters).
- `npm run eval:router` ✓ — 269/269 (no SKILL.md edits).
- **Production dispatch path verified via integration scenarios** in test-ovd-plan-idea.js's "runPlan subcommand dispatch" section: `runPlan({subcommand: 'idea', text: '...'})` → plan-mode envelope; bad JSON → ok=false with "Invalid --entries-json"; valid commit JSON → commit envelope.

**Decided:**
- **Q3.5.A — decisions.md Node-column format for IDEA approvals: `IDEA: <word-boundary-truncated 80 chars>` with ellipsis.** Chosen over flat `IDEA` (loses identity in table), blank cell (loses key), or agent-supplied node ID (conflates new-work vs modify-existing, would need fallback to this option anyway). Preserves searchability (prefix grep), identity (text body), and filterability (groups all IDEA decisions). Word-boundary truncation refinement applied at orchestrator's prompt — mid-word truncation reads as malformed in markdown tables. Hard-truncate fallback for single very-long words (no usable space within first 1/3 of maxLen).
- **Q8 lock honored: approved path emits explicit new-chat handoff, NOT auto-route to /ovd-plan edit.** The handoff text: "Approved. Decision recorded to <path>. Recommend: start a fresh conversation and run /ovd-plan edit to integrate. Optionally run /ovd-log first to save current state." Two locked-design tripwires assert this: text contains "Recommend:" and does NOT contain "Running /ovd-plan edit". Preserves context cleanliness per r3 §5.2 final paragraph ("deliberation context doesn't bleed into integration context").
- **Q3.10 sketch sub-state: stubbed in plan-mode render with explicit Phase 6 note.** Plan text includes: "Note (Q3.10 sketch sub-state): sketch sub-state is Phase 6 — if this idea involves UI sketching, it will be recorded as an idea only; sketches won't be generated yet." No state mutation, no sketch file creation, no `references.sketches[]` write — Q17's full sketch promotion is deferred to Phase 6 per kickoff direction. Tripwire test asserts both "Phase 6" and "sketch sub-state" appear in plan-mode text.
- **Continue + Research actions are pure no-ops (zero state mutation).** Both emit only a recommendation: continue → "Re-run /ovd-plan idea \"<refined>\""; research → "/ovd-plan research \"<idea>\"". Decisions.md is NOT written. Inbox is NOT written. Tests assert `readDecisions(projectDir) === null` after both action paths.
- **Reject path uses the existing inbox section with a new `INBOX_HEADER_IDEA_REJECTED` constant.** Format matches blind-spot.js:388-407 precedent: `- [considered-but-not-adopted: idea-rejected: <reason>] <idea_text> (<ISO timestamp>)`. Newlines in idea_text or rejection_reason are sanitized to spaces (single-line inbox entries).
- **`appendUnderHeader` regex-escape fix is a defensive bugfix scoped to Task 3.5.** Latent in blind-spot's `INBOX_HEADER_NA` + `INBOX_HEADER_PRUNED` (both contain parens) but never triggered because blind-spot writes its inbox section only once per Stage 3 session. Task 3.5's multi-reject path is the first multi-call use case against `appendUnderHeader`, and the test scenario `reject-multiple` surfaced the duplicate-header bug directly. Fix is pure (no behavior change for headers without metacharacters); benefits both existing blind-spot headers (already-correct render, now also safe under hypothetical multi-call) AND future Task 3.6/3.7 inbox writes.
- **IDEA is tolerant of missing OVERDRIVE.md for plan-mode (early-stage brainstorming).** Plan-mode soft-fails `openState`/`readCalibration` → `tree_source: null`, `calibration: null`, emits "No current tree found — early-stage idea (no impact-on-existing-nodes analysis)." This matches r3 §5.2's framing: IDEA is a focused, smaller version of DELIBERATE+RESEARCH and may run before any planning has happened. Reject-action commit-mode DOES require OVERDRIVE.md (inbox section lives there); returns explicit missing-plan error.

**Committed:**
- (not yet — proposing single-commit boundary per `feedback_commit_cleavage`. Files in scope: `lib/ovd-plan/idea.js` (new — ~328 lines), `scripts/test-ovd-plan-idea.js` (new — 169 checks), `lib/ovd-plan/index.js` (mod — require idea + subcommand case + namespace export + top-level runIdea export), `lib/ovd-plan/migrate.js` (mod — appendUnderHeader regex-escape bugfix), `package.json` (mod — check + test:ovd-plan chains include idea), `docs/superpowers/specs/2026-06-08-ovd-plan-implementation-plan.md` (mod — this entry).)

**Deviations from plan:**
- **Test count 169 came in WITHIN the brief's 140-180 band (~6% above midpoint).** No deviation flag — the band was correctly estimated by the kickoff's 3-factor model.
- **Source line count 328 came in BELOW the brief's 400-600 band (~18% under low end) AND WELL BELOW the 3-factor model's 600-1100 prediction.** Reason: IDEA's per-action handlers are short (continue + research are pure no-op rendering; approved delegates to decisions-log; reject delegates to appendUnderHeader). The plan-mode render is the longest single function (~90 lines) and is well-modularized — no factor-(2) inlined-rendering trap. **Calibration finding for the 3-factor model: factor (2) "substantial render" was OVER-estimated for IDEA because the render is bounded (4 action paths × short template), not branching (no per-stage / per-domain / per-type variants like reentry's renderPosition). Phase 4/5 estimation refinement: when factor (2) render has a FIXED OUTPUT SHAPE (single template + interpolation), use the brief estimate; when it BRANCHES (per-stage / per-domain), apply the 40-60% over-estimate. Task 3.5 is the 6th data point on the 3-factor model — factor (2) needs sub-distinction: "fixed-shape render" (within-band) vs "branching render" (40-60% over).**
- **Latent regex-escape bug in `appendUnderHeader` was surfaced AND fixed in-scope.** Could have been deferred as a Phase 7 polish, but Task 3.5 introduced the first multi-call use case (multi-reject) that triggers it. Fix is one-line + defensive; in-scope per "every changed line should trace back to the request or to verification required by the request" — Task 3.5's reject path verification REQUIRES this fix.

**Key insights worth preserving:**
- **Pre-flight surface-conflicts-before-code now at 8th instance.** Q3.3A.10 → Q3.4.1 → Q3.3B.5 → Q3.3B.7-bis → Q3.8.3/4/10 → Q3.3C-A/B/C/D → Q3.9.1'-null-guard + Q3.9.6'-explicit-cancel → Q3.5.A-Node-column-format with word-boundary-truncation refinement. The pattern has stabilized: pre-flight identifies the genuine open choice (often ONE per task at this maturity), the orchestrator approves with at-most-one refinement (often a small UX polish like word-boundary truncation), implementer applies it inline. **Promoting to LOCKED PHASE METHODOLOGY for the Phase 3 wrap-up entry.**
- **3-factor model 6th data point with a sub-distinction refinement: factor (2) "render" splits into FIXED-SHAPE (within-band) vs BRANCHING (40-60% over).** Task 3.5's IDEA hit fixed-shape render → 18% UNDER low-end. Task 3.8's plan-quality hit branching render → 84% OVER. Task 3.9's reentry hit branching render with decomposition → 17% over midpoint. Phase 4/5 estimation should ASK whether the render is single-template-interpolation (use brief) or per-stage/per-domain (apply over-estimate).
- **Latent regex bugs in appendUnderHeader's header-pattern construction.** The bug existed since Phase 2 (migrate.js) but never surfaced because all prior callers wrote headers once-per-session. **Pattern: any new caller of `appendUnderHeader` that may run multiple times in a session needs to verify the header doesn't contain regex metacharacters OR rely on the fixed escape.** Now fixed defensively; future callers can use any header text.
- **IDEA's tolerance of missing OVERDRIVE.md is structurally important.** r3 §5.2 frames IDEA as a brainstorming tool that may run before any planning has happened. The implementation honors this: plan-mode soft-fails openState, emits "early-stage idea" marker, still produces the architect-level analysis prompt + 4 action paths. Reject-mode requires the plan (inbox is part of it); approved + continue + research do not. This shape matches the user's mental model of "throw an idea at the planner before committing to a plan structure" — important to preserve.

**Post-review ratification candidates (orchestrator concur expected):**
- **One refinement (word-boundary truncation on the IDEA Node identifier) applied as locked.**
- **One latent bugfix (appendUnderHeader regex-escape) applied in-scope because Task 3.5 surfaced it.** Defensive; pure (no behavior change for existing callers without metacharacters); benefits Task 3.6/3.7 inbox writes.
- **3-factor model 6th data point with the fixed-shape vs branching sub-distinction.** Promotes the model from hypothesis-with-5-data-points to locked-methodology with the renderer-shape sub-distinction. Worth amplifying in the Phase 3 wrap-up entry.

**Next:**
- Surface Task 3.5 work for commit approval. Proposed boundary: single commit `ovd-plan(phase-3.task-5): IDEA pipeline (Stage IDEA — impact + tradeoffs + action paths per Q8 new-chat handoff)`. All code + tests + this §7 entry + appendUnderHeader regex-escape bugfix go together per `feedback_commit_cleavage`.
- **After Task 3.5 commit lands:** continue this session with Task 3.6 EDIT pre-flight surface. Phase 3 status at Task 3.5 end: **8.33 of 9 tasks complete** (3.1 + 3.2 + Slice A + 3.4 + Slice B + 3.8 + Slice C + 3.9 + 3.5; remaining: 3.6 + 3.7).

---

### 2026-06-15 — Session 18 continued (Phase 3 Task 3.6 COMPLETE — `/ovd-plan edit` EDIT pipeline)

**Did:**
- **Pre-flight surface-conflicts-before-code at 9th instance.** Q3.6 design proposal surfaced BEFORE code with 5 concrete picks: (1) 5-kind operation enum `patch / add_milestone / add_leaf / remove / reorder` (covering REFINE+REORDER+CLEANUP sub-states from r3 §5.1 without `move`/`replace` — those are rare + expressible as remove+add); (2) atomic-batch via `entries.operations: [{ kind, target_id, body }]` array (matches diff-before-apply contract); (3) two-phase via `confirm` flag (single envelope, agent toggles); (4) cache invalidation by file delete (delete-and-lazy-regenerate); (5) DOC UPDATE = one-line recommendation only (full impl Phase 7). Orchestrator approved as-is — first task this session with zero refinements needed.
- **Created `lib/ovd-plan/edit.js` (~530 lines):**
  - Constants: `STATUS='edit'`, `KINDS = ['patch', 'add_milestone', 'add_leaf', 'remove', 'reorder']`, `STRUCTURAL_KINDS = Set('add_milestone', 'add_leaf', 'remove', 'reorder')` (patch excluded per Q3.6.5), `PATCH_ALLOWED_FIELDS = ['title', 'description', 'scope', 'success', 'deps', 'verify', 'skills', 'ambiguity_score']` (id excluded by design — use remove+add for rekeying).
  - `envelope(payload)` — adds `status: 'edit'` (parity with deliberate/reentry/idea envelope pattern).
  - `resolveTreeSource(opened)` — per Q3.6.6: proposed_tree first, parsed.tree.children fallback. Returns `{ source: 'proposed'|'committed'|null, milestones, root }`. **Critical detail:** `treeCtx.milestones` is a *reference* to the live array (either `inner.proposed_tree.milestones` or `parsed.tree.children`) — mutations to it propagate through `commitState`'s writeback. For committed source the root children are all depth-2 milestones (parser invariant), so the reference works without filtering. This was a re-think from the initial implementation that used `parsedTree.children.filter(c => c.depth === 2)` — the filter created a snapshot that mutations didn't propagate from. Reference-not-copy is the key.
  - `findNodeInMilestones(milestones, targetId)` / `collectAllIds(milestones)` — pre-mutation tree introspection helpers.
  - `validateOperation(op, idx, treeCtx)` — Pattern 4 validation; per-kind matrix. Returns error string or null. Constraints: `patch` rejects id-rewrite + unsupported fields; `add_milestone`/`add_leaf` require body.id + body.title (id collision check against treeCtx.idSet); `add_leaf` additionally requires body.parent_milestone_id pointing to an actual milestone (not a leaf); `remove` requires existing target_id; `reorder` requires body.ordered_ids to be the EXACT set of current children IDs (no additions/removals/duplicates).
  - `normalizeEditEntries(rawEntries, treeCtx)` — top-level shape validation (operations array non-empty) + per-op delegation to validateOperation. Strict `confirm === true` check (no coercion of truthy values). Optional rationale field trimmed.
  - `renderNarrativeDiff(operations, treeCtx)` — Q3.6.3 lock: narrative + indented bullet list, NOT unified diff. Fixed-shape per kind (`Patch <type> <id> "<title>" — <rename/update>`, `Add milestone <id> "<title>"`, `Add leaf <id> "<title>" (under milestone <p>)`, `Remove <type> <id> "<title>"`, `Reorder children of <p|top-level> → [<ids>]`). Includes structural/non-structural count + cache-invalidation note + 3 action paths (apply/adjust/cancel) + commit syntax.
  - 5 op appliers: `applyPatchOp` / `applyAddMilestoneOp` / `applyAddLeafOp` / `applyRemoveOp` / `applyReorderOp`. **Committed-source asymmetry:** `applyPatchOp` writes contract fields (scope/success/deps/verify/skills) to `leaf.annotations` for committed leaves (parser convention), but title/description stay on the top-level node. `applyAddLeafOp` mirrors this. `applyAddMilestoneOp` sets `depth=2, status='pending', annotations=null` for committed source. `applyRemoveOp` splices in place. `applyReorderOp` mutates the milestones array in place (`length=0` + push) to preserve the array reference shared with `inner.proposed_tree.milestones` / `parsed.tree.children`.
  - `OP_APPLIERS` dispatch table + `applyAllOps(operations, treeCtx)` — sequential apply (validation already gated the batch).
  - `describeStructuralOpForDecisions(op)` — returns `{ node, decision }` for the 4 structural kinds; returns null for patch (excluded per Q3.6.5).
  - `invalidateCache(rootDir)` — deletes `.overdrive/cache.json` if present (per Q3.6.7). Lazy regeneration on next read.
  - `buildEditPlan(rootDir, opts)` — plan-mode emit. Tree-source-aware header + current tree dump + supported operation kinds reference + two-phase commit explanation + explicit atomic-batch constraint note ("ops do NOT see each other in the same batch") + commit syntax for both phases.
  - `commitEdit(rootDir, rawEntries, opts)` — commit-mode dispatcher. Resolves tree → validates entries → branches on `confirm`: false → renders preview diff (no mutation); true → atomic apply path. Apply path: renders operation lines BEFORE mutation (so patch/remove descriptions capture pre-state titles, post-mutation the old title is gone), applies all ops, bumps revision when proposed, updates last_action, commits state, appends structural ops to decisions.md with shared rationale, invalidates cache if any structural op ran, emits final summary text with DOC UPDATE recommendation stub.
  - `runEdit(rootDir, opts)` — plan/commit orchestrator.
  - `formatPlan` / `formatCommit` — text formatter parity.
- **`lib/ovd-plan/index.js` changes:**
  - Added `editModule = require('./edit')` at the top.
  - Added `edit` subcommand case in `runPlan` (parity with other subcommands; resolveProjectDir → parse entriesJson → isCommit → call `editModule.runEdit(rootDir, {mode, text, entries})` — `text` threaded for the edit-direction hint in plan-mode).
  - Added `edit: editModule, runEdit: editModule.runEdit` to `module.exports`.
- **`package.json` changes:**
  - `check` chain: added `lib/ovd-plan/edit.js` + `scripts/test-ovd-plan-edit.js`. Now 51 files (was 49).
  - `test:ovd-plan` chain: added `scripts/test-ovd-plan-edit.js`. Now 23 suites.
- **Wrote `scripts/test-ovd-plan-edit.js` (221 checks across 18 scenario groups; **WITHIN the brief's 200-260 band — 1% above midpoint**):** module surface (35 sub-checks: STATUS / KINDS shape / STRUCTURAL_KINDS / PATCH_ALLOWED_FIELDS / 21 function exports); resolveTreeSource (8 scenarios: no-tree / proposed / committed / proposed-wins-over-committed); findNodeInMilestones + collectAllIds (8); validateOperation matrix (30 — null/array/unknown-kind + patch × 7 / add_milestone × 4 / add_leaf × 5 / remove × 3 / reorder × 8); normalizeEditEntries (10 — invalid shapes + valid + confirm strict + rationale); renderers (16 — describePatchChange × 3 + renderOperationLine × 7 + renderNarrativeDiff × 11 incl. Q3.6.3 tripwires); apply on proposed_tree (7 scenarios × ~3 sub-checks each = ~22: patch / add_milestone / add_leaf / remove-leaf / remove-milestone / reorder-children / reorder-top); apply on committed tree (5 scenarios × ~3 sub-checks each = ~12: patch-leaf-annotations / patch-rename / add_milestone / remove-leaf / no-revision-bump); multi-op atomic batches (~10 — 3-op happy path + atomic-reject-on-invalid + inter-op-dependency-rejected-by-design); two-phase commit (8 — preview no-mutation + apply mutates); cache invalidation (4 — structural deletes / patch-only preserves); decisions log content (8 — shared rationale × 3 ops + synthesized "EDIT <kind>" rationale); buildEditPlan (12 — no-tree / no-plan / proposed-with-edit-direction / committed); runEdit + ovdPlan integration (~10 — plan + commit + dispatch via runPlan + bad JSON); module surface integration (3); formatters (4); describeStructuralOpForDecisions (6 — all 4 structural kinds + reorder-top-level + patch-returns-null); locked-design pre-flight tripwires (8 — Q3.6.3 narrative-not-unified + Q3.6.5 patch-not-logged + Q3.6.6 proposed-wins + Q3.6.8 DOC UPDATE recommendation + Q3.3A.4 envelope shape preserved).

**Verified:**
- `npm run check` ✓ (51 files: +1 source + +1 test versus Task 3.5's 49).
- `npm run test:ovd-plan` ✓ — **3164 checks total** (was 2943; +221 net: all new edit suite). Per-file: prior 22 suites unchanged; edit **221 (new)**.
- `npm run test:workflow` ✓ — `ovd-workflow tests passed` (no v1 regression; Task 3.6 is additive subcommand route).
- `npm run eval:router` ✓ — 269/269 (no SKILL.md edits).
- **Production dispatch path verified via integration scenarios** in test-ovd-plan-edit.js's "runEdit + ovdPlan integration" section: `runPlan({subcommand: 'edit'})` → plan-mode envelope; bad JSON → ok=false; valid commit JSON → commit envelope. Two-phase semantics verified: same operations array with `confirm: false` produces preview only (no mutation); with `confirm: true` produces apply with full mutation + decisions log + cache invalidation.

**Decided:**
- **Operation enum scope: 5 kinds (`patch / add_milestone / add_leaf / remove / reorder`).** Covers REFINE+REORDER+CLEANUP sub-states from r3 §5.1. `move` (reparent) was considered and rejected — rare in practice + expressible as `remove` + `add`. `replace` (full milestone reset like Stage 7) was rejected — EDIT is for post-deliberation surgical changes, not whole-milestone rewrites; that's IDEA → /ovd-plan deliberate territory. Phase 7 could add `move` if real-world usage demands it.
- **`patch` excludes id rewrite by design.** PATCH_ALLOWED_FIELDS explicitly excludes `id`. Rekeying a node requires `remove` + `add_milestone`/`add_leaf` because (a) downstream references in decisions.md, sketches, sessions would break silently on a silent id rewrite, and (b) the rename intent is structurally different from the contract-update intent — splitting forces the agent to commit to the structural impact via the decisions log. Tested explicitly via the "patch with id field" validation tripwire.
- **Atomic-batch validation against pre-state ONLY (no inter-op dependencies in one batch).** Documented in plan-mode text + tested via the `inter-op-dep` scenario which asserts `{add_milestone III, add_leaf III.1 under III}` is rejected at validation (parent doesn't exist at the pre-state snapshot). Two-call workflow is the supported path: edit-1 adds III, edit-2 adds III.1. Rationale: chained-validation is structurally complex (would need rolling idSet + simulated tree mutation in validation phase) AND error reporting on chain-validation failures is harder to make actionable. Phase 7 can add it if usage demands.
- **Render operation lines BEFORE mutation in the apply path.** Patch + remove descriptions reference the target node's title; post-mutation that title is overwritten (patch) or gone entirely (remove). Render-before-apply captures pre-state titles for the summary text. The diff-preview path (no mutation) renders on the live treeCtx and also sees pre-state titles. **This is a subtle ordering invariant that the tests pin via the apply-text-mentions-old-title assertions.**
- **Committed-source asymmetry: contract fields → annotations.** For committed leaves, `scope/success/deps/verify/skills` go into `leaf.annotations` (parser convention — committed leaves carry contract data there); `title/description` stay top-level. Proposed-source leaves keep everything top-level (proposed_tree YAML is flat). The `applyPatchOp` branches on `treeCtx.source === 'committed' && found.kind === 'leaf'` to route writes. `applyAddLeafOp` mirrors the same split. Tested via `apply-committed-patch-leaf` (success array lands in annotations YAML in the rendered plan).
- **Mutate-in-place vs replace-array: `treeCtx.milestones` is a *reference* to the live array.** Initial implementation used `parsedTree.children.filter((c) => c.depth === 2)` which created a snapshot; mutations to the snapshot didn't propagate to the writeback. Re-thought to use the reference directly (parser invariant ensures all root children are depth-2 milestones). `applyReorderOp` for top-level uses `treeCtx.milestones.length = 0; push(...reordered)` instead of reassignment for the same reason — preserves the array reference. **Key calibration: when a function takes a tree-context object and mutations should propagate, the tree-context array must BE the live array, not a derived/filtered copy.**
- **Cache invalidation only on structural ops.** Patch-only batches don't invalidate the cache (no structural change → cache topology stays valid; only fields change, and the cache regenerates lazily on next stale read anyway). The semantics: cache.json caches the *tree shape*, not the field values — adding/removing/reordering nodes invalidates the shape; patching fields doesn't. Tested via the `cache-structural` (invalidated) and `cache-patch-only` (intact) scenarios.
- **DOC UPDATE = one-line recommendation only.** Apply response includes: *"Recommend: /ovd-workflow refresh to update codebase mapping if EDIT touched documented surfaces."* No actual doc-write, no inventory of changed surfaces. Full DOC UPDATE flow is Phase 7 per the kickoff direction.
- **Decisions.md rationale falls back to synthesized `EDIT <kind>` when none provided.** Optional `entries.rationale` field is shared across all structural ops in a batch; if omitted, each op's rationale becomes the literal `EDIT <op.kind>`. Tested via the `decisions-synthesized-rationale` scenario.

**Committed:**
- (not yet — proposing single-commit boundary per `feedback_commit_cleavage`. Files in scope: `lib/ovd-plan/edit.js` (new — ~530 lines), `scripts/test-ovd-plan-edit.js` (new — 221 checks), `lib/ovd-plan/index.js` (mod — require edit + subcommand case + namespace export + top-level runEdit export), `package.json` (mod — check + test:ovd-plan chains include edit), `docs/superpowers/specs/2026-06-08-ovd-plan-implementation-plan.md` (mod — this entry).)

**Deviations from plan:**
- **Test count 221 came in WITHIN the brief's 200-260 band (~1% above midpoint).** Right on target.
- **Source line count 530 came in WITHIN the brief's 500-700 band (~6% above low end), VALIDATING the 3-factor model's FIXED-SHAPE vs BRANCHING render sub-distinction from Task 3.5.** EDIT's renderNarrativeDiff is fixed-shape per kind (5 templates × 1 line each + bounded summary lines = ~10-line render). The 3-factor model predicted FIXED-SHAPE → in-band; actual was 6% above low end. **Calibration finding: 7th data point on the 3-factor model (Task 3.5's fixed-shape vs branching sub-distinction now validated across 2 data points). Pattern: when factor (2) "render" is single-template-interpolation-per-kind with bounded total, expect within-band. When it branches per-stage/per-domain (like reentry's per-stage position rendering), expect 40-60% over-estimate.**
- **Tree-source asymmetry (`treeCtx.milestones` reference-not-copy) was a mid-implementation re-think.** Initial attempt used `parsedTree.children.filter(c => c.depth === 2)` for committed source; the filter created a snapshot that prevented mutations from propagating to `parsed.tree.children` (which is what gets written by `commitState`). Switched to direct reference (parser invariant: all root children are depth-2 milestones). **No deviation flag — this is a subtle mutation-semantics requirement that surfaced during implementation, NOT scope expansion or design conflict.** Documented in the §Decided block under "Mutate-in-place vs replace-array."
- **Test seed (`seedProposedTree`) bypasses Stage 2/4 turn replay.** First implementation called `applyElicitTurn` + `applySpecTurn` with `transition: 'plan'` — but Spec's valid transitions are `null | 'blind_spot'` (not `'plan'`), so the spec commit was rejected and `proposed_tree` was never written, causing a TypeError on the next test access. Switched to direct state assembly via `openState` + manual inner-state mutation + `commitState`. **EDIT only needs a valid proposed_tree to operate; the exact stage transition path is irrelevant to EDIT's runtime contract.** No production code impact — purely a test fixture refactor.

**Key insights worth preserving:**
- **Pre-flight surface-conflicts-before-code now at 9th instance — first task this session with ZERO refinements needed.** Q3.3A.10 → Q3.4.1 → Q3.3B.5 → Q3.3B.7-bis → Q3.8.3/4/10 → Q3.3C-A/B/C/D → Q3.9.1'-null-guard + Q3.9.6'-explicit-cancel → Q3.5.A-Node-column-format-with-word-boundary-truncation → Q3.6 (5 picks, 0 refinements). The discipline has matured to the point where the implementer's design proposal is consistently calibrated to the orchestrator's lock criteria. **Continued promotion to LOCKED PHASE METHODOLOGY in the Phase 3 wrap-up entry.**
- **3-factor model FIXED-SHAPE sub-distinction validated across 2 data points (Task 3.5 + Task 3.6).** Both hit factor (2) render with bounded fixed-shape-per-kind templates; both came in within or slightly above the brief's low-end (Task 3.5: 18% UNDER low end; Task 3.6: 6% above low end). **Pattern is robust: single-template-interpolation-per-kind + bounded summary lines → expect within-band. Locking the sub-distinction in the Phase 3 wrap-up entry.**
- **Mutation-semantics on shared tree references is a subtle ordering concern.** EDIT's `treeCtx.milestones` MUST be the live array (reference, not copy/filter). The `commitState` writeback path writes `parsed.tree.children` — if we mutate a filtered snapshot, the writeback doesn't see our changes. **Pattern to apply forward: when a module takes a tree-context object and mutations should propagate to disk, the tree-context array must BE the live array, not a derived snapshot. Phase 4 (`/ovd-go` execution surface) will likely face the same concern when updating node status fields.**
- **Render-before-mutate for apply-path summaries.** Patch + remove descriptions reference the target's title; the apply path captures these BEFORE the mutation overwrites/deletes them. The preview path renders on the live pre-state and naturally sees old titles. **Subtle ordering invariant worth pinning in tests.**
- **Atomic-batch-without-chaining is a deliberate scope cut.** Supporting `{add_milestone, add_leaf-under-new-milestone}` in one batch would require rolling-idSet validation + simulated tree mutation during validation. The simpler "two separate calls" workflow is documented in plan-mode text. **Phase 7 polish candidate: chained-validation IF real usage shows many "create + populate" patterns. Until then, the constraint is a feature: two commits keep the decisions log granular.**

**Post-review ratification candidates (orchestrator concur expected):**
- **Zero refinements applied — pre-flight discipline at 9th-instance maturity is producing ratified-as-proposed designs.**
- **FIXED-SHAPE vs BRANCHING render sub-distinction validated across 2 data points.** Worth promoting to locked methodology in the Phase 3 wrap-up entry.
- **Atomic-batch-without-chaining + render-before-mutate + mutate-in-place-on-shared-reference are 3 subtle invariants worth amplifying in Phase 4's "patterns to apply" section.**

**Next:**
- Surface Task 3.6 work for commit approval. Proposed boundary: single commit `ovd-plan(phase-3.task-6): EDIT pipeline (structural tree mutations + narrative diff per Q3.6 locks)`. All code + tests + this §7 entry go together per `feedback_commit_cleavage`.
- **After Task 3.6 commit lands:** continue this session with Task 3.7 RESEARCH pre-flight surface. Phase 3 status at Task 3.6 end: **8.67 of 9 tasks complete** (3.1 + 3.2 + Slice A + 3.4 + Slice B + 3.8 + Slice C + 3.9 + 3.5 + 3.6; remaining: 3.7).

---

### 2026-06-15 — Session 18 continued (Phase 3 Task 3.7 COMPLETE — `/ovd-plan research` RESEARCH pipeline) — **PHASE 3 = 9/9 DONE**

**Did:**
- **Pre-flight surface-conflicts-before-code at 10th instance — second task this session ratified-as-proposed (5 picks approved + 3 tiny refinements applied inline).** Q3.7 design proposal surfaced BEFORE code with 5 concrete picks: (1) agent self-classifies `kind: 'one-liner' | 'substantive'` (semantic > mechanical length threshold); (2) synthesize slug from topic + agent-override via `entries.slug` (lowers agent burden + format-validation on override); (3) ISO-timestamp filename `<ts>-research-<slug>.md` (`:` → `-` for filesystem safety; matches reentry.js SESSIONS_REL precedent; handles multiple-per-day); (4) emit BOTH action paths at apply + `(recommended)` marker via `next_action` (r3 Principle 7 — never silently suppress); (5) soft-fail + diagnostic note on missing codebase context (matches plan-skills.js null-codebase tolerance precedent). Orchestrator approved all 5 + surfaced 3 inline refinements: **(a)** inbox topic truncation via the IDEA `truncateAtWordBoundary` helper (Pattern 3 cross-module reuse); **(b)** `kind: research` frontmatter on substantive files for downstream `/ovd-plan edit` disambiguation; **(c)** Pattern 4 sources-array validation (empty-string entries rejected). All 3 refinements applied inline during implementation.
- **Created `lib/ovd-plan/research.js` (~390 lines):**
  - Constants: `STATUS='research'`, `KINDS = ['one-liner', 'substantive']`, `NEXT_ACTIONS = ['edit', 'handoff', null]`, `SESSIONS_REL = path.join('.overdrive', 'sessions')` (matches reentry.js precedent), `CODEBASE_REL = path.join('.overdrive', 'codebase')`, `INBOX_HEADER_RESEARCH = 'Research findings (lightweight)'`, `INBOX_TOPIC_MAX_LEN = 60` (per refinement a), `SLUG_MAX_LEN = 40`, `SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/`.
  - `synthesizeSlug(text)` — lowercase + alphanumeric-or-hyphen + collapse-runs + trim-edges + word-boundary-truncate (reuses `idea.truncateAtWordBoundary` per refinement a + Pattern 3 cross-module reuse). Empty/null input → `'untitled'`. Output guaranteed to match SLUG_PATTERN.
  - `validateSlug(slug)` — agent-override format check: non-string / empty / too-long / SLUG_PATTERN mismatch all rejected with clear messages.
  - `isoToFilenameSafe(iso)` — `:` → `-` substitution for filesystem-safe ISO timestamps (Windows compatibility).
  - `loadCodebaseContext(rootDir)` — soft-fails on missing files. Returns `{ patterns, techStack, present }` where `present` is true if EITHER file exists. Matches plan-skills.js null-codebase tolerance.
  - `buildResearchPlan(rootDir, opts)` — plan-mode emit. Tolerant of missing OVERDRIVE.md (early-stage research is valid). Reads calibration via `readCalibration`; loads codebase context via `loadCodebaseContext`; emits structured prompt with topic echo + calibration recap + codebase context summary (or domain-only-proceed note when absent) + tools reference (Context7 + WebSearch + Read for codebase) + Q3.7 hybrid output classification + 3 next-step recommendations + commit syntax for both kinds.
  - `normalizeResearchEntries(rawEntries)` — Pattern 4 validation: topic / kind / findings required; slug / sources / next_action optional with format validation. Per refinement c: sources is non-empty-string array (each entry validated individually, empty strings rejected with `sources[<idx>] must be a non-empty string`). next_action ∈ NEXT_ACTIONS (allows null).
  - `buildSessionsFilename(now, slug)` → `<isoToFilenameSafe(now)>-research-<slug>.md`.
  - `buildSubstantiveFileBody(entries, now)` — emits YAML frontmatter (`kind: research` per refinement b + topic + sources when present + generated_at) then `# Research: <topic>` heading + findings body.
  - `applyResearchSubstantive(rootDir, entries, opts)` — creates `.overdrive/sessions/` if missing, writes file, returns envelope with `sessions_path` + `sessions_rel` + `slug`. **Does NOT require existing OVERDRIVE.md** — sessions/ is independent of the plan file. Renders apply summary with 3-option next-step block + recommendation marker when entries.next_action is set.
  - `applyResearchOneLiner(rootDir, entries, opts)` — requires OVERDRIVE.md (inbox lives there). Truncates topic via IDEA's word-boundary helper (per refinement a). Sanitizes `\r\n` → space in both topic and findings. Appends to inbox under INBOX_HEADER_RESEARCH via `appendUnderHeader` (Task 3.5's regex-escape bugfix in migrate.js makes this safe for the parenthesized header `(lightweight)`).
  - `renderApplySummary(entries, contextSpecific)` — fixed-shape per kind. Both kinds emit 3 next-step options: `/ovd-plan edit` + `/ovd-log handoff` + `/ovd-plan idea "<follow-up>"`. `entries.next_action` ∈ {'edit', 'handoff', null} appends `(recommended)` to one option without removing the alternatives (Q3.7.4 lock + r3 Principle 7).
  - `applyResearchFindings(rootDir, entries, opts)` — kind dispatcher; returns invalid-kind envelope as defense-in-depth even though normalize gates membership.
  - `runResearch(rootDir, opts)` — plan/commit orchestrator.
  - `formatPlan` / `formatCommit` — text-formatter parity.
- **`lib/ovd-plan/index.js` changes:**
  - Added `researchModule = require('./research')` at the top.
  - Added `research` subcommand case in `runPlan` (Pattern 1 parity).
  - Added `research: researchModule, runResearch: researchModule.runResearch` to `module.exports`.
- **`package.json` changes:**
  - `check` chain: added `lib/ovd-plan/research.js` + `scripts/test-ovd-plan-research.js`. Now 53 files (was 51).
  - `test:ovd-plan` chain: added `scripts/test-ovd-plan-research.js`. Now 24 suites.
- **Wrote `scripts/test-ovd-plan-research.js` (186 checks across 16 scenario groups; **WITHIN the brief's 150-200 band — 6% above midpoint**):** module surface (29 sub-checks: STATUS / KINDS / NEXT_ACTIONS / SESSIONS_REL / CODEBASE_REL / INBOX_HEADER_RESEARCH / INBOX_TOPIC_MAX_LEN / SLUG_MAX_LEN / SLUG_PATTERN + 15 function exports); synthesizeSlug (11 — happy + lowercases + strips-specials + collapses-runs + trims-edges + empty/null/all-special inputs + long-topic truncation); validateSlug (11 — non-string + empty + too-long + leading-hyphen + trailing-hyphen + slash + underscore + uppercase + valid forms); isoToFilenameSafe (3); loadCodebaseContext (3 scenarios: none + both + only-patterns); buildResearchPlan (24 — no-topic + no-codebase soft-fail + with-codebase + with-calibration; verifies Q3.7 markers + Context7/WebSearch refs + commit syntax for both kinds + 3 next-step refs); normalizeResearchEntries (20 — Pattern 4 matrix incl. slug validation + sources non-empty + next_action enum); buildSessionsFilename + buildSubstantiveFileBody (9 — filename shape + frontmatter shape + kind: research field per refinement b + sources block included/omitted); applyResearchSubstantive (12 — happy path + slug-override + multi-session + no-plan tolerance); applyResearchOneLiner (15 — no-plan error + happy + multi-call single-header + topic-truncation per refinement a + newline-sanitization); renderApplySummary (8 — substantive + one-liner + next_action markers); applyResearchFindings dispatch (3); runResearch + ovdPlan integration (10 — plan + commit + bad entries + runPlan dispatch); module surface integration (3); formatters (4); locked-design pre-flight tripwires (8 — Q3.7 hybrid + Q3.7.4 /ovd-log handoff option + Q3.7.5 no-legacy-research.md write + both-paths-always-emitted + refinement b frontmatter + refinement c sources validation).

**Verified:**
- `npm run check` ✓ (53 files: +1 source + +1 test versus Task 3.6's 51).
- `npm run test:ovd-plan` ✓ — **3350 checks total** (was 3164; +186 net: all new research suite). Per-file: prior 23 suites unchanged; research **186 (new)**.
- `npm run test:workflow` ✓ — `ovd-workflow tests passed` (no v1 regression; Task 3.7 is purely additive).
- `npm run eval:router` ✓ — 269/269 (no SKILL.md edits).
- **Production dispatch path verified via integration scenarios** in test-ovd-plan-research.js's "runResearch + ovdPlan integration" section: `runPlan({subcommand: 'research', text: '...'})` → plan-mode envelope; bad JSON → ok=false with "Invalid --entries-json"; valid commit JSON → commit envelope with kind-dispatched apply.

**Decided:**
- **`kind` enum agent self-classifies (`one-liner | substantive`) — locked over heuristic length-threshold.** Length thresholds have edge-case failures (499 vs 501 char split); semantic decision belongs in the agent, not the CLI. Same Pattern 1 boundary discipline as plan-quality's coverage/goal-backward verdicts + blind-spot's category/N/A decisions.
- **Slug source: synthesize-from-topic with optional agent override.** Defaults lower agent burden; override (validated via SLUG_PATTERN) handles edge cases like acronym-heavy topics + version numbers in topic. The validator closes the format-injection vector — agent cannot supply a slug containing `/`, `..`, or other filesystem-hostile characters.
- **ISO-timestamp filename `<ts>-research-<slug>.md` with `:` → `-` substitution.** Matches reentry.js SESSIONS_REL precedent + handles multiple-per-day. The substitution is Windows-compatible; the unmodified ISO portion still chronologically sorts in directory listings.
- **Always emit BOTH `/ovd-plan edit` and `/ovd-log handoff` at apply; `entries.next_action` adds a `(recommended)` marker without removing the alternative.** r3 Principle 7 ("action paths at every pause point") + Q3.7.4 lock. Silently suppressing one option would make the agent the decision-maker for the user's choice surface. The recommendation marker conveys agent suggestion without removing choice.
- **Soft-fail + diagnostic note when codebase context is missing.** Domain-only RESEARCH topics ("best practices for X authentication patterns") don't need repo grounding. Hard-error would block legitimate use cases. Soft-fail matches plan-skills.js null-codebase tolerance precedent.
- **Three refinements applied inline (a/b/c — orchestrator suggestion).** **(a)** Inbox topic truncation via IDEA's `truncateAtWordBoundary` helper — Pattern 3 cross-module reuse; longer topics get word-boundary-cut to INBOX_TOPIC_MAX_LEN=60. **(b)** `kind: research` frontmatter on substantive files — `/ovd-plan edit` (Task 3.6) can grep sessions/ for `kind: research` to disambiguate file types when scanning the directory. **(c)** Pattern 4 sources-array validation — each entry must be a non-empty string; empty-string entries are explicitly rejected via per-entry validation in `normalizeResearchEntries`. **All three are pure improvements with zero behavior cost when not exercised** (most callers won't hit them; defensive when they do).
- **Substantive does NOT require existing OVERDRIVE.md — sessions/ is independent.** Early-stage research is valid (the agent may want to investigate before any plan exists). One-liner DOES require it (inbox lives in the plan file). Tested explicitly via the substantive-no-plan scenario.
- **Q3.7.5 migration-compat seam: zero handling needed in `research.js`.** Legacy `.overdrive/research.md` files are left untouched (verified via Q3.7.5 tripwire). The migration is `/ovd-workflow init`'s responsibility per r3 §13 migration map. RESEARCH writes only to `.overdrive/sessions/<ts>-research-<slug>.md` — new layout exclusively.

**Committed:**
- (not yet — proposing single-commit boundary per `feedback_commit_cleavage`. Files in scope: `lib/ovd-plan/research.js` (new — ~390 lines), `scripts/test-ovd-plan-research.js` (new — 186 checks), `lib/ovd-plan/index.js` (mod — require research + subcommand case + namespace export + top-level runResearch export), `package.json` (mod — check + test:ovd-plan chains include research), `docs/superpowers/specs/2026-06-08-ovd-plan-implementation-plan.md` (mod — this entry).)

**Deviations from plan:**
- **Test count 186 came in WITHIN the brief's 150-200 band (6% above midpoint).** No deviation flag.
- **Source line count 390 came in BELOW the brief's 400-500 band (~3% under low end), VALIDATING the 3-factor model's FIXED-SHAPE prediction for the 3rd consecutive task.** Task 3.5 (IDEA): 18% under low end. Task 3.6 (EDIT): 6% above low end. Task 3.7 (RESEARCH): 3% under low end. **All 3 hit factor (2) FIXED-SHAPE render and all 3 came in within or near low end of brief's band.** The sub-distinction (FIXED-SHAPE vs BRANCHING) is now validated across 3 consecutive data points — promoting to LOCKED METHODOLOGY for the Phase 3 wrap-up entry.
- **One test assertion regex was too greedy → fixed inline.** The `/\/ovd-plan edit.*\(recommended\)/` regex matched the `/ovd-log handoff` line because that line's descriptive text contains the literal `/ovd-plan edit` ("(next session resumes with /ovd-plan edit)"). Fixed by splitting on newlines + filtering for lines containing `(recommended)` + asserting which prefix the line starts with. **Calibration finding: when emitting recommendation markers within multi-line text where lines may reference other actions, use line-based assertions (start-anchored) rather than greedy regex over the full string.**

**Key insights worth preserving:**
- **Pre-flight surface-conflicts-before-code now at 10th instance — second task this session ratified-as-proposed.** Pattern: Q3.3A.10 → Q3.4.1 → Q3.3B.5 → Q3.3B.7-bis → Q3.8.3/4/10 → Q3.3C-A/B/C/D → Q3.9.1'-null-guard + Q3.9.6'-explicit-cancel → Q3.5.A-Node-column with word-boundary refinement → Q3.6 (5 picks, 0 refinements) → Q3.7 (5 picks, 3 inline refinements). **Maturity inflection: the discipline has moved from "catch errors before ship" to "confirm green-on-green-on-green against well-charted precedent." Phase 4 readiness baseline.**
- **3-factor model FIXED-SHAPE sub-distinction validated across 3 consecutive data points — promoting to LOCKED METHODOLOGY.** Tasks 3.5 + 3.6 + 3.7 all hit single-template-interpolation-per-kind renders with bounded summary lines; all 3 came within or near brief's low-end band. **Pattern locked**: when factor (2) "substantial render" is FIXED-SHAPE (single template per kind + bounded total), use brief estimate. When it BRANCHES per-stage/per-domain (Task 3.8 plan-quality / Task 3.9 reentry), apply 40-60% over-estimate. Phase 4 estimation should ASK this question first.
- **Pattern 3 cross-module helper reuse: IDEA's `truncateAtWordBoundary` is now used by both IDEA (Node identifier truncation) and RESEARCH (inbox topic truncation).** When a helper has clear semantics and the caller's need is identical, reuse via require beats duplicate implementation. Phase 4 (`/ovd-go`) execution surface may surface more reuse candidates from the Phase 3 surfaces.
- **Test-greedy-regex calibration: line-based assertions for recommendation markers in multi-line text.** When an action label like `/ovd-plan edit` may appear in MULTIPLE rendered lines (the option itself AND descriptive text on a sibling line), greedy regex like `/.../` over the full string yields false positives. Use `text.split('\n').filter((l) => l.includes(marker))` then assert prefix on the matched line. Worth pinning as a test-pattern guideline in the Phase 3 wrap-up.
- **Action-path render with recommendation markers ≠ silent decision-making.** The `(recommended)` tag conveys agent suggestion; both/all options remain visible. This is the structural shape of "agent recommends, user decides" — same pattern as IDEA's approved-route handoff (recommends new chat, user can choose otherwise) and EDIT's apply summary (recommends `/ovd-workflow refresh`, user picks). **Pattern: never silently suppress an action path the user would otherwise have access to.**

**Post-review ratification candidates (orchestrator concur expected):**
- **Five locked picks approved as-is; three inline refinements applied (inbox truncation Pattern 3 reuse + frontmatter `kind: research` + sources Pattern 4 validation).**
- **3-factor model FIXED-SHAPE sub-distinction promoted to LOCKED METHODOLOGY after 3 consecutive validating data points.** Phase 4/5 estimation should branch on render shape FIRST.
- **Pre-flight surface-conflicts-before-code at 10th-instance maturity — Phase 4 readiness baseline.**
- **Pattern 3 cross-module helper reuse documented as Phase 4 pattern.**

**Next:**
- Surface Task 3.7 work for commit approval. Proposed boundary: single commit `ovd-plan(phase-3.task-7): RESEARCH pipeline (hybrid output per Q3.7 + new-chat handoff recommendation per r3 §5.5)`.
- **After Task 3.7 commit lands: PHASE 3 = 9/9 COMPLETE.** Next surface: Phase 3 wrap-up §7 entry covering (a) commit chronology (10 commits — 13cf63a through whatever 3.7 commits as); (b) aggregate test state (3350 ovd-plan checks); (c) 3-factor estimation model promoted from hypothesis to locked methodology with FIXED-SHAPE vs BRANCHING sub-distinction; (d) pre-flight surface-conflicts-before-code at 10th-instance maturity → promoted to locked phase methodology; (e) accumulated §6 follow-ups consolidated (Q3.3A.10 field names, Q3.4.1 stage ordering, Q3.3B.5/7-bis, Q3.3C r3 §6.7 gap, plus any new ones from 3.5/3.6/3.7); (f) Phase 4 (`/ovd-go` execution surface) readiness sketch.

---

### 2026-06-16 — Phase 3 wrap-up (9/9 + completion commit landed; methodologies promoted; ready for Phase 4)

**Phase 3 progress: 9 of 9 tasks complete + 1 completion commit reconciling against §5 done-definition and readiness brief 12 §5.1.** Per impl plan §5 Phase 3 done definition:

- ✓ Task 3.1 — `DISPLAY` (visual tree render with hierarchical IDs, `← ACTIVE` marker, status counts, action-path trailing recommendation).
- ✓ Task 3.2 — User calibration sub-system (3 axes: domain/technical/scope; observation-driven; verbosity override; persists to deliberation-state).
- ✓ Task 3.3 — Socratic protocol delivered in **three slices**:
  - **Slice A** — happy-path stages 2/4/5-partial/7/8 with deliberation-state schema + `proposed_tree` landing + 6-stage STAGES.
  - **Slice B** — Stage 5.5 RESOLVE SKILLS sub-step (per-leaf canonical; calls Phase 1 Task 1.5 `resolvePriorSet`; CLI-as-custodian per Q3.3B.6; structural enforcement of `→ present` transition).
  - **Slice C** — Stage 6 Verify wiring + `/ovd-plan verify` user-facing subcommand (retrospective audit; tree-source precedence; canonical action paths).
- ✓ Task 3.4 — Blind-spot expansion (Stage 3 — internal exhaustive 11-category checklist; external one-line-per-inserted-node; `inserted_reason` preserved; Q9 dual-presentation lock).
- ✓ Task 3.5 — `IDEA` pipeline (4 action paths approved/continue/research/reject; Q8 new-chat handoff no auto-route; word-boundary-truncated `IDEA:` Node-column format; `appendUnderHeader` regex-escape inline bugfix).
- ✓ Task 3.6 — `EDIT` pipeline (5 operation kinds; Q3.3A.4 envelope reused; atomic-batch via `entries.operations[]`; two-phase `confirm` flag; narrative diff per Q3.6.3; structural-only decisions log; cache invalidation; DOC UPDATE one-line stub — Phase 5 Task 5.7 wires the full flow per Q3.6.1 follow-up).
- ✓ Task 3.7 — `RESEARCH` pipeline (hybrid output by agent-classified `kind`; substantive → `.overdrive/sessions/`; one-liner → inbox; canonical 4 action paths per completion commit Remediation B).
- ✓ Task 3.8 — Plan-quality check (Stage 6 — coverage + leaf-completeness + goal-backward; Pattern 1 bundled dispatch; tree-source precedence; trace-key validation per Q3.8.10).
- ✓ Task 3.9 — Deliberation-state persistence + re-entry (multi-session per r3 §5.7; stale-state detection; 4 action paths approved/review/restart/reconcile; null-guard + explicit-cancel refinements).
- ✓ **Completion commit** (`c0f1fce`, 2026-06-16) — three remediations reconciling against §5 + readiness brief 12: (A) bare `/ovd-plan` 3-way routing (committed-tree → DISPLAY / paused → re-entry / empty → 3-option action-path); (B) Task 3.7 RESEARCH 4 canonical action paths per §5; (E) verbose `[proposed-by-agent: <reason>]` tag per r3 §10.4 across `blind-spot.js` + `display.js`.
- ✓ One commit per task (12 total counting 3 slices + completion) — each approved by user.

**Aggregate test state after Phase 3 completion: 3354 ovd-plan checks across 24 test suites.** (Was 1244 at Phase 2 end.) Per-suite breakdown:

| Suite | Checks |
|---|---|
| fs | 59 |
| parser | 104 |
| writer | 28 |
| cache | 39 |
| skill-router | 53 |
| workflow | 204 |
| migrate | 150 |
| decisions | 81 |
| preferences | 80 |
| requirements | 88 |
| codebase-mapper | 135 |
| drift | 99 |
| refresh | 124 |
| **display** | **139** (was 137; +2 completion: agent-tag verbose + bare-no-plan route) |
| deliberation-state | 93 |
| calibrate | 103 |
| deliberate | 325 |
| blind-spot | 242 |
| plan-skills | 196 |
| plan-quality | 208 |
| reentry | 227 |
| idea | 169 |
| edit | 221 |
| **research** | **187** (was 186; +1 completion: 4-option assertion expansion) |

Plus 4 workflow regression checks + 269 router benchmark checks. `npm run check` parses 53 source/script files clean.

**Phase 3 commit chronology (12 commits on `feature/ovd-plan`, newest first):**

```
c0f1fce  ovd-plan(phase-3.completion): bare routing + research action-paths + verbose blind-spot tags
66dbbd1  ovd-plan(phase-3.task-7): RESEARCH pipeline (hybrid output per Q3.7 + new-chat handoff per r3 §5.5)
cde9326  ovd-plan(phase-3.task-6): EDIT pipeline (structural tree mutations + narrative diff per Q3.6 locks)
b6051a7  ovd-plan(phase-3.task-5): IDEA pipeline (Stage IDEA — impact + tradeoffs + action paths per Q8 new-chat handoff)
1f31d6f  ovd-plan(phase-3.task-9): deliberation-state re-entry + stale-state detection (multi-session per r3 §5.7)
ab01574  ovd-plan(phase-3.task-3.slice-c): Stage 6 Verify wiring + /ovd-plan verify subcommand
74b9fc8  ovd-plan(phase-3.task-8): plan-quality check (Stage 6 — coverage + leaf-completeness + goal-backward)
96c622b  ovd-plan(phase-3.task-3.slice-b): RESOLVE SKILLS sub-step (planning-time canonical, per-leaf)
0adbbc9  ovd-plan(phase-3.task-4): blind-spot expansion (Stage 3 — exhaustive internally, terse externally)
1fd28a1  ovd-plan(phase-3.task-3.slice-a): Socratic happy path (stages 2/4/5-partial/7/8)
c54335f  ovd-plan(phase-3.task-2): calibration sub-system (3 axes + verbosity override)
13cf63a  ovd-plan(phase-3.task-1): DISPLAY (visual tree render)
```

**Branch state at Phase 3 end:**
- `feature/ovd-plan` is 24 commits ahead of `main` (12 from Phase 1/2 + 12 from Phase 3).
- Working tree clean except the two pre-existing untracked 2026-06-06 spec docs (untouched throughout Phase 3).
- No push. Per hard rules: no push without explicit user approval.

---

#### Comprehensive review reconciliation (2026-06-16 in-chat review → completion commit)

The pre-Phase-3-close comprehensive review surfaced 6 concerns + 3 r4 amendment candidates against the §5 plan and readiness brief 12. Orchestrator reclassifications + remediations landed as one batched completion commit (`c0f1fce`):

| Concern | Reclassification | Resolution |
|---|---|---|
| A — bare `/ovd-plan` routing | **PARTIAL → Required fix.** Readiness brief 12 §5.1 specifies bare-on-empty action-path + bare-on-paused re-entry; both missing. | Remediation A in completion commit. 3-branch routing now wired. |
| B — Task 3.7 missing "more research" + "other" options | Required fix per Pattern 7 (non-negotiable). | Remediation B in completion commit. §5-canonical 4 options shipped verbatim. |
| C — Task 3.7 no node-attachment output mode | Phase 7 deferral accepted. §6 entry required. | Q3.7.1-followup added to §6. r4 may add `references.research[]` schema if user wants the surface formalized pre-Phase-7. |
| D — Task 3.6 DOC UPDATE is one-line stub | **Phase 5 dependency, NOT Phase 7.** Phase 5 Task 5.7 builds `runDocUpdate`. Task 3.6 wires when Phase 5 ships. | Q3.6.1-followup added to §6 with Phase 5 target verbatim. |
| E — Task 3.4 `[agent]` vs `[proposed-by-agent: <reason>]` | Orchestrator call: **ship verbose form.** r3 §10.4 wins on Pattern 7 transparency over §5.3.4's terse example. | Remediation E in completion commit + Q3.4.2-followup added to §6 for r4 §5.3.4 example alignment. |
| F — Task 3.5 `reject` vs `other` naming | As-is; internal naming OK. | No change. |

---

#### Methodologies promoted to LOCKED at Phase 3 end

**(1) 3-factor estimation model with FIXED-SHAPE vs BRANCHING render sub-distinction.**

The model classifies each task module by which factor classes it hits:
- **Factor (1):** validation matrix (Pattern 4 normalize + per-field/per-kind checks; bounded by enum size).
- **Factor (2):** substantial user-facing render (action paths, diff preview, summary text — sub-distinction below).
- **Factor (3):** structural mutation logic (tree mutation, state-machine transition, atomic-batch apply).

**Phase 3's 11 data points + sub-distinction discovery:**

| Task | Factors hit | Render shape | Brief band (lines) | Actual lines | Deviation |
|---|---|---|---|---|---|
| 3.1 DISPLAY | (2) | FIXED-SHAPE | 200-300 | ~280 | in band |
| 3.2 calibration | (1)(2) | FIXED-SHAPE | 250-350 | ~346 | upper band |
| 3.3 Slice A | (1)(3) heavy | — | 500-700 | ~600 | in band |
| 3.4 blind-spot | (1)(2)(3) | BRANCHING (per-category) | 500-700 | ~510 | low end |
| 3.3 Slice B | (1)(2) | FIXED-SHAPE | 400-500 | ~440 | in band |
| 3.8 plan-quality | (1)(2)(3) | **BRANCHING (per-stage)** | 400-500 | ~735 | **84% over** |
| 3.3 Slice C | (1)(2) | FIXED-SHAPE | 200-300 | ~270 | in band |
| 3.9 reentry | (1)(2)(3) | BRANCHING decomposed | 500-700 | ~620 | in band |
| 3.5 IDEA | (1)(2) | FIXED-SHAPE | 400-600 | ~328 | **18% under** |
| 3.6 EDIT | (1)(2)(3) | FIXED-SHAPE | 500-700 | ~530 | low end |
| 3.7 RESEARCH | (1)(2) | FIXED-SHAPE | 400-500 | ~390 | low end |

**Sub-distinction validated across 8 FIXED-SHAPE data points + 3 BRANCHING data points:**
- **FIXED-SHAPE render** (single template per kind/option, bounded total): use brief estimate as-is. All 8 FIXED-SHAPE landings came within or near the band's low end.
- **BRANCHING render** (per-stage / per-domain / per-category switch with rich inner content): apply 40-60% over-estimate. Task 3.8 inlined `renderReport` ran 84% over; Task 3.9 decomposed renderers into per-domain helpers and came in at 17% over midpoint — **decomposition mitigates branching overhead** (Phase 7 polish candidate: refactor 3.8's `renderReport` into per-domain helpers matching 3.9's shape).

**Locked methodology for Phase 4/5/etc:** before locking a line estimate, classify the render shape. FIXED-SHAPE → trust brief; BRANCHING → apply 40-60% over-estimate AND ask whether helpers can decompose the render.

**(2) Pre-flight surface-conflicts-before-code at 10th-instance maturity.**

The discipline: before writing any task code, the implementer surfaces a tight design proposal listing concrete picks + flagging *genuine open choices* (often 1-3 per task at this maturity). Orchestrator confirms or refines; refinements applied inline; code starts only after green-on-green-on-green confirmation.

**Instances tracked across Phase 3:**

| # | Task | Open choice surfaced | Orchestrator response |
|---|---|---|---|
| 1 | 3.3 Slice A (Q3.3A.10) | r3 §10.1 vs writer canonical field names | Locked + §6 follow-up |
| 2 | 3.4 (Q3.4.1) | r3 §5.3 numerical vs §5.3.4 data-flow stage ordering | Locked + §6 follow-up |
| 3 | 3.3 Slice B (Q3.3B.5) | codebase context one-file-vs-both | Locked |
| 4 | 3.3 Slice B (Q3.3B.7-bis) | catalog-empty fail-fast vs silent-fallback | Locked |
| 5 | 3.8 (Q3.8.3/4/10) | coverage scope + tree source + trace-key validation | Locked |
| 6 | 3.3 Slice C (Q3.3C-A/B/C/D) | 4 brief-vs-canonical conflicts | Canonical wins; §6 follow-up |
| 7 | 3.9 (Q3.9.1' + Q3.9.6') | null-guard + explicit-cancel refinements | Both applied inline |
| 8 | 3.5 (Q3.5.A) | decisions.md Node-column format | Locked + word-boundary refinement |
| 9 | 3.6 (Q3.6) | 5 picks (op enum + atomic batch + two-phase + cache + DOC UPDATE) | All approved as-is (zero refinements) |
| 10 | 3.7 (Q3.7) | 5 picks (kind self-classify + slug + filename + action paths + soft-fail) | All approved + 3 inline refinements |

**Maturity inflection from instances 1-6 to 7-10:** instances 1-6 caught spec-vs-code gaps requiring r4 amendments; instances 7-10 ratified-against-precedent with only minor refinements. The discipline shifted from "catch errors before they ship" to "confirm green-on-green-on-green against well-charted precedent." **Phase 4 readiness baseline: pre-flight is now load-bearing for slice quality.** Phase 7 polish candidate: codify the kickoff-brief template addition that invites pre-flight questions per task.

---

#### Accumulated §6 follow-ups (consolidated at Phase 3 close)

Reproduced from §6 for visibility. None are blockers; address after the 7 phases if the user wants them.

| # | Origin | Item | Recommended fix |
|---|---|---|---|
| Q8 | r3 §13.3 | auto-route IDEA → EDIT for trivially small changes | Decide later if friction warrants the shortcut |
| Q9 | r3 §13.3 | per-project configurable blind-spot categories | r3 §13.3 |
| Q14 | r3 §13.3 | closure-prompt format at recursion-root | r3 §13.3 |
| Q17 | r3 §13.3 | superseded sketch file disposition (keep/archive/delete) | r3 §13.3 |
| Q3.3A.10 | Phase 3 Slice A | r3 §10.1 leaf field names ↔ writer canonical | **r4 amendment** updating §10.1 example to writer-canonical names |
| Q3.4.1 | Phase 3 Task 3.4 | r3 §5.3 numerical-stage vs §5.3.4 data-flow ordering | **r4 amendment** renumbering §5.3 stages to match data flow |
| Q3.3C | Phase 3 Slice C | r3 has no §X covering `/ovd-plan verify` user-facing surface | **r4 amendment** adding §6.7 (or §5.8) |
| **Q3.4.2** | Phase 3 completion | r3 §5.3.4 example uses `[agent]`; §10.4 specifies `[proposed-by-agent: <reason>]`; code ships verbose form | **r4 amendment** aligning §5.3.4 example with §10.4 |
| **Q3.7.1** | Phase 3 completion (Concern C) | RESEARCH no node-attachment output mode | **Phase 7 deferral**; r4 may add `references.research[]` schema |
| **Q3.6.1** | Phase 3 completion (Concern D) | EDIT full DOC UPDATE wiring | **Phase 5 Task 5.7 dependency** — wires when Phase 5's `runDocUpdate` ships |

**Four of these (Q3.3A.10 / Q3.4.1 / Q3.3C / Q3.4.2) are independent r3-side amendments that can land as one r4 revision pass.** Q3.7.1 + Q3.6.1 are cross-phase code dependencies (Phase 7 / Phase 5 respectively). **Decision deferral confirmed**: Phase 3 chose code-side stability over spec adherence, scoped each gap into §6 per Failure Mode #8 (unscoped deferral disappearing).

---

#### Phase 4 readiness sketch (`/ovd-go` execution surface)

**Phase 3 surfaces Phase 4 will consume:**
- `proposed_tree` / committed `parsed.tree.children` shape (Phase 1 + Slice A): leaves carry full contract (`success` / `scope` / `deps` / `verify` / `skills`), `inserted_by` / `inserted_reason` (Task 3.4), `pending_skill_resolution` flag.
- `lib/ovd-plan/skill-router.js::resolvePriorSet()` (Phase 1 Task 1.5; canonical at planning time per Slice B; **execution-time delta path is Phase 4's responsibility per r3 §11.2**).
- `cache.js::closureCheck` + `isNodeClosed` (Phase 1; consumed by Phase 4's recursive-close mechanism per r3 §6.5).
- `decisions-log.js::appendDecision` (Phase 2 Task 2.6).
- `deliberation-state` infrastructure (Task 3.9; Phase 4 may extend with execution-state OR keep them separate).
- `EDIT` pipeline (Task 3.6; consumed by Phase 4 when execution surfaces a leaf needing structural change).

**Phase 4 task list per impl plan §5:**
- Task 4.1 — `/ovd-go` bare dispatch (DISPLAY-DRIVEN BY-DEFAULT per r3 §6.1).
- Task 4.2 — `LEAF EXECUTE` (Pattern 1 dispatch; skill prior set + execution loop).
- Task 4.3 — `LEAF VERIFY` (auto-verify method + agent self-check fallback per r3 §6.6).
- Task 4.4 — `LEAF DELTA` (skill-router delta path per r3 §11.2).
- Task 4.5 — `LEAF SECURITY` (threat-vs-mitigation matrix per r3 §6.6).
- Task 4.6 — `CLUSTER VERIFY` (recursive close + closure prompt at root per r3 §6.5).
- Task 4.7 — `assessScope` (small-mode auto-detection per Q15 lock).
- Task 4.8 — `monitorSmallScope` (small-mode growth detection per Q15 lock).
- Task 4.9 — `runFixLoop` (2-attempt cap + escalation per Q11 lock).

**Methodologies to carry forward from Phase 3:**
1. **3-factor estimation model with FIXED-SHAPE vs BRANCHING sub-distinction.**
2. **Pre-flight surface-conflicts-before-code** — one Q&A batch per task BEFORE any code.
3. **Pattern 1 dispatch (CLI emits plan + commits structured payload)** + **Pattern 4 JSON parse guard** — load-bearing for every new subcommand.
4. **`feedback_commit_cleavage`** — code + docs explaining THIS code go together; unrelated docs split.
5. **Test-first / locked-design tripwires** — every task lands with a per-suite test file pinning §6-scoped resolutions.

**Phase 4 recommended kickoff sequence:**
1. Read resume protocol (`docs/superpowers/handoff/08-resume-protocol.md`).
2. Read this wrap-up entry + readiness brief 13 (`docs/superpowers/handoff/13-phase-4-readiness.md`).
3. Confirm Phase 3 commits landed clean via `git log` + run the 4-command regression baseline.
4. Read r3 §6 (`/ovd-go` state machine) end-to-end.
5. Surface Phase 4 Task 4.1 design choices BEFORE any code (matching the Phase 3 discipline).

**Phase 4 has zero pre-blockers on r4 amendments.** Phase 4 can proceed against current r3 + current code; the 4 r3-side r4 amendments (Q3.3A.10 / Q3.4.1 / Q3.3C / Q3.4.2) can land as a single r4 pass at the user's convenience, before or after Phase 4. The 2 cross-phase code follow-ups (Q3.7.1 / Q3.6.1) are tracked for Phase 5 / Phase 7 respectively.

---

#### Phase 3 conclusion

`/ovd-plan` is feature-complete for the v1 design: deliberation (Stages 2/3/4/5/5.5/6/7/8) + display + calibration + idea + edit + research + re-entry + the 3-branch bare-command routing. The Socratic pipeline is unified under a single command; blind-spot expansion materializes as tree nodes with verbose r3-§10.4-canonical tags; calibration is structured on 3 axes; the IDEA → new-chat → EDIT handoff preserves context cleanliness; RESEARCH ships hybrid output by agent-classification with the §5-canonical 4 action paths; EDIT supports 5 op kinds with narrative diff + atomic-batch + structural-only decisions logging; plan-quality verifies coverage + leaf-completeness + goal-backward; multi-session re-entry honors "summary → confirmation → continue" with stale-state detection.

**Two methodologies promoted to LOCKED at Phase 3 end** (3-factor estimation + pre-flight surface-conflicts-before-code) are Phase 4 readiness baseline. **Six §6 follow-ups carry over** (Q3.3A.10 / Q3.4.1 / Q3.3C / Q3.4.2 → r4 amendments; Q3.6.1 → Phase 5 Task 5.7 dependency; Q3.7.1 → Phase 7 deferral).

Ready for Phase 4 (`/ovd-go`) in a fresh session.

### 2026-06-19 — Session 19 (Phase 4 kickoff — design Q&A batch + Task 4.1 COMPLETE — ORIENT default)

**Phase 4 design Q&A batch surfaced + locked before code (Q4.1–Q4.11; pre-flight methodology — 11th instance).** Applied Methodology 2 (pre-flight surface-conflicts): 7 of 11 are confirmation-class (anchored by RESOLVED ledger decisions — Q4.1/Q7, Q4.3/Q7, Q4.4/Q14, Q4.5/Q4+Q14, Q4.7/Q15, Q4.8/Q11, Q4.2/r3 §6.8) and adopted as brief-recommended; 4 were surfaced as genuine open choices and locked by the user:
- **Q4.6** `--small` boundary: `files_touched ≤ 1 AND no shared-contract files` (conservative; tighten in Phase 7).
- **Q4.9** DECISION POINT taxonomy: 5 pre-defined kinds (scope-overflow / ambiguous-spec / missing-dependency / contract-conflict / other) + free-form body (tags feed Phase 5 LEARNINGS EXTRACT).
- **Q4.10** Node-ref fuzzy tie-break: depth (leaves > containers) → active milestone → pending status → else prompt. **Locked WITH an orchestrator amendment (Pattern 7 hygiene): the auto-pick MUST be announced + offer a cancel before executing** — otherwise the auto-tie-break is a silent decision. Contract: *announce + allow cancel before execute* (implementer picks phrasing; lower-friction "Matched X — reply 'continue' or describe a different target"). Spec note added to §5 Task 4.11 (≈5–10 lines + ≈3 test checks when 4.11 lands).
- **Q4.11** SKILL DELTA runtime: capture-and-continue; surface in the AWAITING REVIEW summary; user may 'replan' if it signals a planning gap (honors the planning-time-canonical contract; no mid-leaf interrupt).

**Task 4.1 — `runGoDefault` (ORIENT default, r3 §6.1/§6.2).** Created `lib/ovd-plan/orient.js` (~340 lines). Bare `/ovd-go` reads OVERDRIVE.md + the most recent `.overdrive/sessions/` (fallback `.overdrive/handoffs/`) capture + surfaces the active node's `scope.in` files (writer-canonical per Q3.3A.10 — read the F1-corrected brief-13:89), then renders an orientation with status-keyed 5–6 numbered action paths (Pattern 7; the `active-awaiting-review` branch matches the r3 §6.2 worked example's 6 options). **Pattern 1 honored:** the CLI surfaces *which* scope files are in play (+ existence flag) but does NOT read or dump their contents — the host agent reads them. **Pattern 2 reuse:** tree analysis delegates to `display.js` (`analyzeTree` / `findActiveNode` / `getProjectTitle`); only `findActiveMilestone` (depth-2 ancestor) + the ORIENT action-path renderer are new. Bare `/ovd-go` wired in `index.js` (`runGo` → `orientModule.runGoDefault`); subcommands (execute/verify/`<ref>`) still fall through to the stub until their tasks land. Shortcut forms (`continue`, `<node-ref>`) bypass ORIENT and route directly — wired in Tasks 4.2/4.11.

**Tests:** `scripts/test-ovd-plan-orient.js` — **113 checks across 12 scenario groups**: module surface (12); findLatestFile (latest-by-mtime + pattern filter + missing dir); extractCaptureSummary (frontmatter/heading/comment skip + bullet strip + bounded); readLatestCapture; findActiveMilestone (leaf→depth-2 ancestor + no-active + null-tree); activeScopeFiles (array + null + non-array + non-string filter); renderOrientActionPaths (all 7 kinds × numbered-options + Pattern-7 "Other" escape; awaiting-review = 6 options matching §6.2); buildOrientation (project/milestone/active-leaf/last-session/awaiting-count/scope-files-with-existence/Pattern-1-no-content-dump); runGoDefault (invalid-dir + missing-plan + parse-error + happy awaiting-review + never-auto-executes); dispatch via `ovdPlan.runGo` (bare→orient, subcommand→stub); 3 action-path kinds end-to-end (in-progress/blocked/all-closed); **migration-compat seam (Pattern 5)** — Phase-2-migrated OVERDRIVE.md (frontmatter + root only) → ok=true, kind empty, no crash.

**Estimation (3-factor model):** orient.js hit factor (2) render with **FIXED-SHAPE per-kind** action paths (bounded option list per kind, like EDIT's `renderNarrativeDiff`) → landed ~340 lines, consistent with the FIXED-SHAPE in-band prediction. Test count 113 sits in the Pattern-8 band. 12th FIXED-SHAPE-class data point.

**Regression:** `npm run check` exit 0; **ovd-plan 3359 → 3472 checks across 25 suites** (+113, +1 suite); `test:workflow` pass; `eval:router` 269 pass. No regressions.

**Files:** `lib/ovd-plan/orient.js` (new), `scripts/test-ovd-plan-orient.js` (new), `lib/ovd-plan/index.js` (mod — require + runGo dispatch + namespace export), `package.json` (mod — check chain + test:ovd-plan runner), this §7 entry + the §5 Task 4.11 Q4.10 spec note (doc). Commit boundary proposed at end of this entry (one commit per task, user-approved).

**Next:** Task 4.11 (node-ref fuzzy matching) per the readiness-brief order (4.1 → 4.11 → 4.2 …), carrying the Q4.10 announce-cancel contract.

### 2026-06-19 — Session 19 continued (Phase 4 Task 4.11 COMPLETE — node-ref fuzzy matching)

**Pre-flight (Methodology 2 — 12th instance):** surfaced 4 picks; 3 confirmation-class (fuzzy = case-insensitive substring; new module `noderef.js`; search all nodes incl. containers per r3 §6.8) + **1 genuine extension of the Q4.10 amendment**: announce-cancel applies to ALL fuzzy-derived single picks (`title-single` + `tie-broken`), while exact-ID matches skip the announce (the user was explicit). Adopted as the Pattern-7-consistent reading; the matcher exposes `autoResolved` (true for fuzzy-single + tie-broken, false for id-exact + ambiguous).

**Task 4.11 — `resolveNodeRef` (r3 §6.8 + Q4.10).** Created `lib/ovd-plan/noderef.js` (~215 lines). `resolveNodeRef(tree, ref)` is a PURE matcher returning `{ matchType, matches, ambiguous, autoResolved, tieBreak[], reason }`: exact hierarchical ID (case-insensitive) → `id-exact`; else case-insensitive title substring → `title-single` (1 match) / tie-break (>1) / `none` (0). **Q4.10 tie-break** (`applyTieBreak`): progressive narrowing `leaves > containers → active milestone → pending status`, with a `tieBreak[]` trace; if it can't narrow to one → `ambiguous` (numbered disambiguation). `renderNodeRefResolution` emits: id-exact "Resolved …" (no announce); auto-resolved "Matched …" + the Q4.10 **announce + (1) continue / (2) pick different / (3) other** (tie-broken also shows the auto-select trace); ambiguous → numbered list + Other + "Reply with a number"; none → guidance. **Pattern 2 reuse:** `display.findActiveNode` + `orient.findActiveMilestone` (the latter doubles as "depth-2 ancestor of any node"). **Pattern 1:** pure matcher; `runGoNodeRef` reads/parses OVERDRIVE.md but does no LLM work; execution of the resolved node is a separate dispatch (Task 4.2). Wired `/ovd-go <text>` (no subcommand) → `runGoNodeRef` in `index.js`; `continue`/`test`/`verify` subcommands still stubbed.

**Tests:** `scripts/test-ovd-plan-noderef.js` — **85 checks across 12 groups**: module surface; isLeaf + flattenNodes (excludes root, depth-correct); id-exact (+ case-insensitive); title-single (autoResolved); tie-broken (all 3 tiers narrow 'widget' → II.2.a with full trace); applyTieBreak tier isolation (leaves / active-milestone / pending each in isolation); ambiguous + none + empty-ref; nodeLabel + renderNodeRefResolution (id-exact no-announce / tie-broken announce+trace / title-single announce-no-trace / ambiguous numbered / none guidance — Pattern 7 throughout); runGoNodeRef (invalid-dir / missing-ref / missing-plan / parse-error / id-exact / fuzzy-single / no-match); dispatch via `ovdPlan.runGo({ text })`; **migration-compat seam (Pattern 5)** — migrated layout (no tree) → `none`, no crash; edge cases (null tree, container-only tier-1 no-op, no-active tier-2 skip, defensive nodeLabel).

**Estimation (3-factor model):** noderef.js hit factor (2) render **FIXED-SHAPE per-matchType** (bounded template per type) + light factor (1); no factor (3) (pure matcher, no tree mutation) → ~215 lines, consistent with the FIXED-SHAPE prediction. Initial 76 checks topped up to 85 to clear the Pattern-8 ≥80 undercoverage bar (genuine edge-case coverage, not padding). 13th FIXED-SHAPE-class data point.

**Regression:** `npm run check` exit 0; **ovd-plan 3472 → 3557 checks across 26 suites** (+85, +1 suite); `test:workflow` pass; `eval:router` 269 pass. No regressions.

**Files:** `lib/ovd-plan/noderef.js` (new), `scripts/test-ovd-plan-noderef.js` (new), `lib/ovd-plan/index.js` (mod — require + `/ovd-go <ref>` dispatch + namespace export), `package.json` (mod — check chain + test runner), this §7 entry (doc). Commit boundary proposed at end of this entry.

**Next:** Task 4.2 (LEAF EXECUTE with skill-router integration) — consumes the resolved node-ref + reads `leaf.skills` as the high-confidence prior (r3 §11.2; honor `confidence: high`, SKILL DELTA is the exception per Q4.11).

### 2026-06-19 — Session 19 continued (Phase 4 Task 4.2 COMPLETE — LEAF EXECUTE with pre-resolved skills)

**Pre-flight (Methodology 2 — 13th instance) surfaced a spec-vs-code conflict (→ §6 follow-up Q4.2.1).** §5 Task 4.2's "invokes `skill-router.route()`" wording is outdated: r3 §11.1 records there is **no code-level `route()`** — skill-router is a SKILL.md doc the agent reads. The canonical execution flow (r3 §11.2) is Pattern-1 dispatch: agent reads the pre-resolved `skills` annotation, loads those SKILL.md files, executes; no router consultation on the canonical path; SKILL DELTA is the exception. Logged as Q4.2.1 (impl-plan wording to be amended), same discipline as Q3.3A.10. Other picks confirmation-class (status via `commitState` round-trip; best-effort catalog skill validation; out-of-scope = warn not block; skill_delta → session, never rewrite annotation).

**Task 4.2 — `execute.js` (~340 lines), Pattern-1 dispatch.** PLAN mode (`buildExecutePlan`) reads the leaf's writer-canonical annotations and emits an execution plan carrying the prior_set (`leaf.skills`) + confidence-derived `skillMode` (r3 §11.5: `high`→canonical/as-is, `medium`→starting-point/may-add-1-2, `low`/empty→reconsult/SKILL-DELTA), the scope (in/read_only/out), success criteria, deps, verify spec, and the `--entries-json` callback syntax. Best-effort §11.6 catalog check splits prior skills into known/unknown (warn+skip unknown; skips silently if catalog absent). COMMIT mode (`applyExecuteResult`) validates entries (Pattern 4: `normalizeExecuteEntries`), transitions `leaf.status` (default `in-progress`, validated against `EXECUTE_STATUS_VALUES`) via the `openState`/`commitState` writer round-trip (Pattern 2 — hard rule 7, no hand-emitted status), **warns (never blocks) on `files_touched` outside `scope.in`** (a potential DECISION POINT, Task 4.10), and captures the execution record + any `skill_delta` to `.overdrive/sessions/<ts>-execute-<id>.md` — the **leaf annotation is NEVER rewritten** (r3 §11.2; planner improvement is Phase 5 LEARNINGS EXTRACT). **Pattern 2 reuse:** `noderef.flattenNodes`/`isLeaf`, `deliberation-state.openState/commitState`, `research.isoToFilenameSafe`, `skill-router.loadCatalogSkills`. **Pattern 1:** CLI does no LLM work, no task execution — the agent executes between plan and commit. Wired `/ovd-go execute <ref>` (plan) + `--entries-json` (commit) in `index.js` with the dispatch-layer Pattern-4 JSON guard; this is the internal LEAF EXECUTE entry the slash-command body orchestrates after orient/resolve (user-facing trigger stays `continue`/`<ref>`; full chaining lands in a later integration step once verify/review exist).

**Tests:** `scripts/test-ovd-plan-execute.js` — **94 checks across 11 groups**: module surface; findLeaf; leafContract (extraction + defensive defaults); skillMode (all 5 confidence/empty cases per §11.5); partitionSkills (catalog known/unknown split + catalog-absent pass-through, via a fixture catalog); isWithinScope (dir-prefix / exact / sibling / outside / empty); buildExecutePlan (canonical/reconsult modes + not-a-leaf + leaf-not-found + missing-ref + missing-plan + plan-text assertions incl. unknown-skill warning + callback syntax); normalizeExecuteEntries (Pattern 4 matrix incl. status + skill_delta validation); applyExecuteResult (status persisted to tree + scope warning + **skill_delta → session file with annotation UNCHANGED** + error paths); runExecuteLeaf dispatch + `ovdPlan.runGo` (plan/commit/bad-JSON guard); **migration-compat seam (Pattern 5)**.

**Cross-task test fix:** the Task 4.1 orient suite asserted `/ovd-go execute` → stub; now that execute is implemented, that assertion was repointed to `/ovd-go verify` (still stubbed, Task 4.3). This is a legitimate consequence of implementing execute, not a masked failure — it surfaced as a chain-stop (3471/25) and was corrected.

**Estimation (3-factor model):** execute.js hit factor (1) validation + factor (3) status mutation + factor (2) FIXED-SHAPE render (one plan template + one commit-summary template) → ~340 lines, in-band for a FIXED-SHAPE module despite hitting all 3 factors (the render shape, not the factor count, governs — consistent with EDIT). 14th data point.

**Regression:** `npm run check` exit 0; **ovd-plan 3557 → 3651 checks across 27 suites** (+94 execute, +1 suite); `test:workflow` pass; `eval:router` 269 pass. No regressions.

**Files:** `lib/ovd-plan/execute.js` (new), `scripts/test-ovd-plan-execute.js` (new), `lib/ovd-plan/index.js` (mod — require + execute dispatch + export), `scripts/test-ovd-plan-orient.js` (mod — stub-assertion repoint), `package.json` (mod — check + test runner), this §7 entry + the §6 Q4.2.1 follow-up (doc). Commit boundary proposed at end of this entry.

**Next:** Task 4.3 (LEAF VERIFY dispatch by `verification.method`) — consumes the leaf's `verify.{method,fallback}`; transparent fallback to `agent_self_check_against_success_criteria` (Q4.2); persists pass/fail to iteration history.

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
