# ovd-plan: Pipeline Architecture — Revision 3

**Date:** 2026-06-08
**Branch:** `feature/ovd-plan`
**Status:** Design — third revision. Resolves Q1, Q4–Q17 from r2. Q2 and Q3 carry forward with detailed tradeoffs (Section 13). No code.
**Supersedes:** `2026-06-08-ovd-plan-pipeline-architecture-r2.md` for all decisions resolved in Section 0. The r2 document remains historical record.

---

## 0. Question resolutions from 2026-06-08

| Q | Topic | Resolution |
|---|---|---|
| Q1 | Socratic stopping condition | **Confirmed.** Dual rule (sufficiency + relevance) stands. |
| Q2 | `OVERDRIVE.md` per-node syntax | **Resolved.** Fenced YAML block per node (Option C in §13.1 analysis) — parsing rigor over visual compactness. Locked format example in §9.3. |
| Q3 | Skill-router prior-set integration shape | **Resolved.** Option B — native `prior_set` mode in skill-router. Router stays as the contact layer to skills; `ovd-plan` parses leaf annotations and passes them through. See §11. |
| Q4 | Cache update frequency | **Resolved.** Hierarchical recursive cache: writes on every change; on `/ovd-log` checks closure up the tree, asks user to approve closing each level. Modeled on GSD milestone-close pattern but applied to *every* hierarchical level. See §7.5. |
| Q5 | Codebase map drift detection | **Resolved.** Primary signal: tag-of-affected-modules. Secondary: file-tree hash diff. File-count dropped. Autonomous drift avoided unless user requests; agent-discovered patterns append up the codebase-file hierarchy. See §4.4. |
| Q6 | Intent classifier confidence cutoffs | **Resolved (in spirit).** No fixed numeric cutoffs. When ambiguous → present brief tradeoffs and routing suggestion (e.g., *"consider deliberating with `/ovd-plan idea` or adjusting with `/ovd-plan edit`"*) and let the user pick. See §3. |
| Q7 | Awaiting-review approval signal | **Resolved.** No guessing. After every leaf, agent prompts: *"Reply with `approved` to close this, or describe changes to iterate."* Applied universally to every pause point. See §1 principles + §6.4. |
| Q8 | `/ovd-plan idea` impact-analysis depth | **Resolved.** `IDEA` is a smaller version of `DELIBERATE` + `RESEARCH`. Agent presents impact + tradeoffs + suggested route, asks user to reply `approved` / `continue` / describe alternative. Approval starts new chat segment beginning with `/ovd-plan edit`. See §5.5. |
| Q9 | Blind-spot expansion checklist | **Resolved.** Internally exhaustive (architect-level analysis). Externally presented as terse high-overview items: one-line per inserted node, no detailed report. Internals stay rich; surface stays brief. See §5.3.4. |
| Q10 | Node IDs | **Resolved.** Hierarchical short IDs by level: Roman → Arabic → lowercase letter → lowercase Roman → uppercase letter. Example: `II.3.b.i`. See §10.2. |
| Q11 | Failure escalation thresholds | **Resolved.** Match GSD pattern: 2 fix attempts, then surface to user with diagnosis + options. See §6.9. |
| Q12 | Multi-session deliberation re-entry | **Resolved.** Always: summary → user confirmation → continue. Never silent resume. See §5.7. |
| Q13 | `/ovd-workflow init` vs implicit | **Resolved.** Nothing implicit. `/ovd-workflow` shows tutorial first, then in "Next steps" asks user to approve codebase mapping. Mapping runs only after explicit approval. See §4.1 and §4.6. |
| Q14 | Conversation capture scope | **Resolved.** Capture follows hierarchical recursion depth. Default `/ovd-log` integrates with the previous capture. If subtree solved → present summary, recommend `/ovd-go verify` (or `/ovd-log handoff` if already verified). See §7.5. |
| Q15 | `--small` discovery | **Resolved.** Agent auto-detects small scope and recommends `/ovd-go --small`. If user keeps iterating beyond small scope, agent transparently recommends switching back to full mode. See §6.7. |
| Q16 | Multi-project support | **Resolved.** Project-level scoped; each repo gets its own OVD setup. Multiple projects in one repo: each project is a root node in the tree. Out-of-scope for v1 attention. See §1.13. |
| Q17 | Sketch promotion mapping | **Resolved.** Sketches map to leaves via an explicit `references.sketches[]` field on the leaf. Approved sketches are referenced by file path from the leaf that implements them. See §10.5. |

---

## 1. Frame & operating principles (revised)

`ovd-plan` adds a structural layer on top of Overdrive's existing skill execution layer. The 137 skills, skill-router, and global operating guide are not modified — they are the substrate. `ovd-plan` provides a **planning, execution, and record pipeline that produces self-contained leaf-level contracts**, so downstream execution happens autonomously without re-contextualizing the codebase, re-routing skills cold, or asking the user to manually update state.

### Operating principles

1. **The plan is a contract, not a checklist.** Every leaf carries scope, skills, success criteria, dependencies, verification method, and (where relevant) sketch references — sufficient to execute without re-reading the rest of the codebase.

2. **Four commands, many internal states.** Externally: `/ovd-workflow`, `/ovd-plan`, `/ovd-go`, `/ovd-log`. Internally each is a state machine the user never has to think about.

3. **Action paths are mandatory at every pause point.** The agent never guesses what the user means. At every interaction that requires user input, the agent presents numbered options ending with an explicit escape ("Other — describe what you want"). Patterns: *"Reply `approved` or describe changes,"* *"Continue with: (1) X, (2) Y, (3) other."* This is a fundamental principle, applied universally.

4. **Implicit only via prior conceptual approval.** The system never silently runs heavy operations. It announces what it intends to do, asks for approval, then proceeds. Once the user gives conceptual approval (e.g., "yes, run the mapping"), the system executes without re-asking each sub-step.

5. **Transparency over autonomy when ambiguous.** When intent or approach is unclear, the agent surfaces the tradeoffs in plain language and lets the user pick. Internal reasoning may be architect-level; user-facing presentation is high-overview and terse.

6. **The agent matches the user where they are.** The Socratic dialogue adapts to calibrated level (domain / technical / scope). Plain-language presentation, regardless of internal complexity.

7. **Blind spots are filled by adding nodes, not by asking.** During planning, agent inserts tasks the user didn't elicit but the project requires. Each inserted node is one-line-justified and reviewable. Brief outside; complete inside.

8. **Execution is iterative by default.** Leaves don't auto-mark `done`. After implementation + verify, status becomes `awaiting-review`. Only an explicit `approved` (or equivalent action-path response) closes a leaf.

9. **Closure is recursive.** When a leaf closes, the system walks *up* the tree: parent cluster complete? Ask user to close it. Grandparent? Ask. Continues to root or until a parent has open siblings. Modeled on GSD's milestone-close behavior extended to every level.

10. **Pipelines chain themselves and recommend the next command.** *"Idea integrated. `/ovd-go` to start. Recommend `/ovd-go --small` for the first task — it's narrow scope."*

11. **Skill-router is pre-resolved at planning time.** At execution the router is a delta engine — annotations from the plan are canonical priors; the router only adds/overrides when reality contradicts the plan.

12. **No fixed hierarchy.** The tree is recursive. A node can be a project, milestone, phase, feature, task, subtask — labels assigned in plain language during deliberation.

13. **Project-level scoped.** Each repo has its own `.overdrive/` setup. Multi-project in one repo: each project = root node. Multi-project in different repos: separate `.overdrive/` per repo.

14. **State persistence is invisible work that never lives only in memory.** `/ovd-log` (default) = `gsd-pause-work` analogue. `/ovd-go` (default) = `gsd-resume-work` analogue.

15. **Apple / Notion / Supabase analogy.** Same power as the alternative (GSD), ~10% user-side effort. Complexity absorbed by the agent.

---

## 2. User-facing surface (unchanged from r2)

Four commands. Minimal flags. (Identical to r2 §2 — included here only for reference.)

```
/ovd-workflow [init|map|preferences|requirements]
/ovd-plan     [deliberate|research|create|edit|idea "text"]
/ovd-go       [verify|<node-ref>|test <node-ref>|--small ["desc"]]
/ovd-log      [handoff|capture "text"|concerns]
```

Default form of each command does the most-used path (display / orient-and-continue / lightweight-save).

---

## 3. Intent Detection Layer (refined per Q6)

Sits in front of every command. Free-form messages are routed to the right pipeline. No silent guessing.

### 3.1 Behavior

1. **Classify** the message intent across the routable internal states.
2. **Unambiguous case** — exactly one route is clearly correct: announce + execute. *"Reading this as `/ovd-plan idea` — analyzing impact."* User can still interrupt: *"That's not what I meant."*
3. **Ambiguous case** — multiple plausible routes: present a short transparent comparison and ask.

### 3.2 Ambiguous-case template (per Q6)

```
"I read your message a few ways. Pick one:

 (1) /ovd-plan idea "..." — deliberate this as a new direction; analyze impact on the existing plan
 (2) /ovd-plan edit       — adjust the existing tree directly without deliberation
 (3) /ovd-go --small "..." — surgical change to the current leaf

 Reply with the number, or describe what you want."
```

The agent always shows 2–4 options, always includes the "describe what you want" escape, and one-line each option so the user understands the tradeoff.

### 3.3 What the classifier evaluates

- **Verb intent** — propose / ask / instruct / review / capture / halt
- **Object** — code / plan / tree / doc / concern / idea / sketch
- **State context** — current `deliberation_status`, active node, recent activity, last action
- **Calibration cue** — how technically framed is the message (affects downstream presentation depth)

### 3.4 The classifier doesn't override explicit commands

A leading `/ovd-*` is honored as typed. The classifier only fires for free-form input or malformed commands.

### 3.5 Recurring mis-classifications

Tracked in the session log and surfaced at `LEARNINGS EXTRACT` (milestone close) to refine routing heuristics.

---

## 4. `/ovd-workflow` — initialization, codebase mapping, context hub (refined per Q5, Q13)

`/ovd-workflow` owns the codebase analysis files, preferences, requirements, and decisions. It runs the codebase map at initialization (after user approval) and maintains it on demand.

### 4.1 Behavior on bare invocation (per Q13: tutorial first, ask after)

When the user runs `/ovd-workflow` for the first time:

1. **Tutorial pass** — agent presents a brief overview of the OVD model: what `/ovd-plan`, `/ovd-go`, `/ovd-log` do, what the file structure looks like, what the typical session loop is. Plain language, ~10 lines.
2. **Status pass** — agent inspects the project: is there a `.overdrive/`? Are codebase files populated? Is `OVERDRIVE.md` present?
3. **Next-steps prompt** — ends with explicit action paths:

```
"Next steps:

 (1) Run codebase mapping — produces architecture, patterns, tech-stack, quality, concerns
     files in .overdrive/codebase/. Recommended before any planning. Takes ~1–3 minutes.
 (2) Skip mapping and go straight to /ovd-plan (faster but planner will have less context).
 (3) Set up preferences and requirements first.

 Reply with the number, or describe what you want."
```

The user explicitly approves before mapping runs. Nothing implicit.

### 4.2 Internal state machine

| State | Trigger | What it does |
|---|---|---|
| `TUTORIAL + STATUS` | bare `/ovd-workflow` first run | Show overview + project status + action-path next-steps |
| `STATUS` | bare `/ovd-workflow` subsequent runs | Show status + most recent activity + next-step recommendations |
| `INIT` | user approves init flow | Sequence: `CODEBASE MAP` → `PREFERENCES ELICIT` → `REQUIREMENTS DRAFT`, each gated on user approval |
| `CODEBASE MAP` | `/ovd-workflow map` or approved from `INIT` | Multi-agent codebase analysis producing five files |
| `MAP REFRESH` | per Q5: tag-of-affected-modules signal | Incremental update to specific codebase files |
| `PREFERENCES ELICIT` | `/ovd-workflow preferences` or approved from `INIT` | Socratic capture of preferences/vetoes |
| `REQUIREMENTS DRAFT` | `/ovd-workflow requirements` or approved from `INIT` | Capture functional + non-functional + out-of-scope |
| `DECISIONS LOG` | internal append-only | Maintain `.overdrive/decisions.md` |

### 4.3 Codebase map structure (gsd-quality, multi-file)

Five mapper agents run in parallel (token-bounded, scoped):

| File | Mapper focus |
|---|---|
| `.overdrive/codebase/architecture.md` | System structure, module boundaries, data flow |
| `.overdrive/codebase/patterns.md` | Recurring idioms, conventions, abstraction patterns |
| `.overdrive/codebase/tech-stack.md` | Frameworks, libraries, versions, build chain, deploy |
| `.overdrive/codebase/quality.md` | Test coverage, type discipline, lint posture |
| `.overdrive/codebase/concerns.md` | Pre-existing risks: security, perf, debt, drift |

Each mapper produces a structured markdown doc with consistent shape (overview / components / evidence with file paths and line numbers / risks).

### 4.4 Drift detection and incremental refresh (resolved per Q5)

**Primary signal: tag-of-affected-modules.** The map records, per codebase file, a list of source modules it analyzed. On commit or on `/ovd-go` completion of a leaf that touched code, the agent diffs the changed paths against these module tags. If a module is touched, the corresponding map file is queued for refresh.

**Secondary signal: file-tree hash.** A snapshot of the project's file tree is hashed at last map run. If the hash diff is significant (new top-level dirs, large file count delta), `CODEBASE MAP` is recommended.

**File-count alone: dropped** (per user input: not indicative).

**Refresh discipline:** the agent never autonomously rewrites map files unless the user requested it. When the agent discovers a new pattern or architectural fact during execution, it:
1. Appends a note to the relevant map file (architecture.md or patterns.md) under a clearly-labeled "discovered during execution" subsection.
2. Surfaces the discovery in the next `/ovd-log` capture so the user is aware.
3. Recommends `/ovd-workflow map` if discoveries accumulate.

This satisfies the user's principle: *"drifting from autonomous implementation should be avoided if not required by the user, and if the agent actually determines a better or new pattern it appends it to the mapping up the level of hierarchy, as required."*

### 4.5 Preferences and requirements

`PREFERENCES ELICIT` produces `.overdrive/preferences.md`:
- Vetoes (libraries to avoid)
- Coding style preferences
- Workflow preferences (commit style, tests-before-merge)
- Communication preferences (concise / detailed)

`REQUIREMENTS DRAFT` produces `.overdrive/requirements.md`:
- Functional requirements
- Non-functional requirements (perf, security, accessibility, scalability, observability)
- Out-of-scope explicit list

Both read by `/ovd-plan` during deliberation.

### 4.6 When other commands hit an uninitialized project (resolved per Q13)

If `/ovd-plan` or `/ovd-go` is invoked before `/ovd-workflow init`, the agent:

1. Announces: *"This project hasn't been initialized — no `.overdrive/codebase/` files found."*
2. Presents action paths:
   ```
   (1) Run /ovd-workflow now (recommended) — tutorial + setup, then return to your request.
   (2) Continue without initialization — I'll plan with less context; you can run /ovd-workflow later.
   (3) Other — describe what you want.
   ```
3. Waits for the user's choice. Nothing implicit.

---

## 5. `/ovd-plan` — deep planning (refined per Q8, Q9, Q12)

### 5.1 Internal state machine

Same as r2 §5.1, summarized: `DISPLAY` / `DELIBERATE` / `RESEARCH` / `CREATE` / `EDIT` / `IDEA` (+ internal sub-states `SKETCH` / `IMPORT` / `MVP SCOPE` / `REFINE` / `REORDER` / `CLEANUP` / `BLIND-SPOT EXPANSION` / `VERIFICATION-CRITERIA WRITE` / `PLAN-QUALITY CHECK`).

### 5.2 The `IDEA` pipeline (refined per Q8)

`/ovd-plan idea "X"` is a focused, smaller version of `DELIBERATE + RESEARCH`. Flow:

```
1. INGEST idea text
2. ANALYSE IMPACT (lightweight DELIBERATE):
   - Which existing nodes are affected?
   - Addition / modification / removal?
   - Effort and risk estimate
   - Dependencies / blockers
   - Skills it would need

3. SURFACE TRADEOFFS (lightweight RESEARCH):
   - Plain-language pros/cons
   - Brief alternatives if applicable
   - Suggested route (with reasoning)

4. PROMPT (action paths):
   "I can see three ways to proceed:

    (1) approved — integrate now as proposed. I'll run /ovd-plan edit
        in a fresh chat segment (clean context).
    (2) continue — keep deliberating; describe what's missing.
    (3) research — needs deeper investigation; route to /ovd-plan research.
    (4) other — describe what you want.

    Reply with 1–4 or a custom direction."

5. ON 'approved':
   a. Commit the idea analysis to .overdrive/decisions.md
   b. Recommend starting a new chat: "Start new conversation with /ovd-plan edit
      to integrate." (Provides clean context for the integration step.)

6. ON 'continue':
   Stay in IDEA loop, refine.

7. ON 'research':
   Route to /ovd-plan research with the idea as input.

8. ON rejection:
   Append to inbox as "considered but not adopted" with reasoning.
```

The split between `idea → approved → new chat with /ovd-plan edit` preserves context cleanliness: deliberation context doesn't bleed into integration context.

### 5.3 Socratic protocol (unchanged in stages; refined for blind-spot brevity)

Stages 1–8 identical to r2 §5.3 (Open assessment → Elicit → Blind-spot expansion → Spec → Plan → Verify → Present + iterate → Commit). The change is *how* blind-spot expansion is presented (next subsection).

### 5.3.4 Blind-spot expansion: exhaustive internally, terse externally (refined per Q9)

The agent runs the full architect-level checklist internally. Categories examined:

- Security (auth, authz, validation, secrets, CSRF, XSS, rate limiting)
- Performance (load, caching, queries, bundle, perceived perf)
- Accessibility (WCAG, keyboard, screen reader, contrast)
- Observability (logging, tracing, metrics, alerting)
- Error handling (failure modes, retries, fallbacks, user messages)
- Data (migrations, fixtures, seeds, backup, schema evolution)
- Testing (unit, integration, e2e, regression, contract)
- Operations (deployment, rollback, env config, feature flags)
- Documentation (README, API, runbook, onboarding)
- User-facing (empty / loading / error states, onboarding, edge cases)
- Compliance (licensing, privacy, audit logging)

The agent's *internal* reasoning is full — architect-level analysis per category, evidence-driven.

The *external* presentation is brief — one line per inserted node:

```
"Items I'm adding to the tree (you can prune any):

 [proposed-by-agent: WCAG AA for internal tooling] II.4 Accessibility pass
 [proposed-by-agent: auth/session token storage] III.1 Security review
 [proposed-by-agent: empty/loading/failure UI] III.2 Error states
 [proposed-by-agent: request tracing] III.3 Observability
 [proposed-by-agent: meta tags, SEO basics] III.4 Pre-launch checklist

 Reply 'approved' to accept all, or list numbers to remove (e.g., 'remove II.4, III.4'),
 or describe other adjustments."
```

The user gets a fast scan of additions; the internal detail (why each, what it entails, what skills it loads) is encoded in the leaf's stored fields and revealed only when the user asks ("tell me more about II.4") or when execution begins.

### 5.3.5 RESOLVE SKILLS sub-step (added in Stage 5 — Plan phase)

After Stage 4 (Spec) and Stage 3 (Blind-spot expansion) produce the leaf set, Stage 5 (Plan phase) writes per-leaf annotations. **Skill annotation is performed via an explicit RESOLVE SKILLS sub-step** that invokes the skill-router helper (`lib/ovd-plan/skill-router.js::resolvePriorSet()`) once per leaf with full planning context (description, scope, success criteria, codebase patterns).

The helper returns `{ skills, confidence, rationale, considered }`. ovd-plan writes the result to the leaf's YAML annotation in `OVERDRIVE.md`. Planning-time resolution is the **canonical** path — execution short-circuits cold routing per the prior. Execution-time delta is the exception (triggered only for ambiguity, novel complexity, or observed need outside the prior).

See §11 for the full skill-router protocol, including confidence semantics and the SKILL.md updates required.

### 5.4 Sketch sub-state (Q17 refinement)

`SKETCH` (entered from `IDEA` or detected via intent) produces a throwaway HTML mockup in `.overdrive/sketches/`. Once approved, the file moves to `.overdrive/sketches/approved/` and is **referenced from the leaf that implements it** via the leaf's `references.sketches[]` field (see §10.5).

The leaf's description includes a sentence like: *"Implement per sketch at `.overdrive/sketches/approved/2026-06-08-widget-layout.html`."* The agent reads the sketch file at execution time and uses it as the visual contract.

### 5.5 Feature-addition pipeline (refined per Q8 — explicit new-chat handoff)

```
/ovd-plan idea "add dark mode"
  ↓
IDEA: ANALYSE IMPACT + SURFACE TRADEOFFS
  ↓
present with action paths
  ↓
user replies 'approved'
  ↓
Agent: "Approved. Commit recorded. Recommend starting a fresh conversation
        and running /ovd-plan edit to integrate. Run /ovd-log first if you
        want the current state saved."
  ↓
(user clears context)
  ↓
/ovd-plan edit
  ↓
EDIT: applies tree changes
  ↓
DOC UPDATE
  ↓
recommend /ovd-go
```

For larger ideas needing research:

```
user replies 'research'
  ↓
/ovd-plan research (focused on the idea)
  ↓
RESEARCH: findings written
  ↓
session ending? ── yes ──→ recommend /ovd-log handoff
  │                       (next session: /ovd-plan edit with findings)
  no
  ↓
recommend /ovd-plan edit → DOC UPDATE → /ovd-go
```

### 5.6 Verification-criteria specification per leaf

Each leaf at end of `CREATE` (or `EDIT`) gets (writer-canonical field names per §10.1):
- `success: [strings]` — externally verifiable
- `verify.method: <name>` — primary auto-verify
- `verify.fallback: agent_self_check_against_success_criteria`
- `verify.review_required: bool` — default `true`; `false` only for trivially-objective leaves

### 5.7 Multi-session deliberation re-entry (resolved per Q12)

When the user re-enters `/ovd-plan` after a deliberation pause:

```
1. Read deliberation-state from OVERDRIVE.md
2. Present summary:
   "Last session (2026-06-07):
    - You decided: target browser = modern only, auth = Supabase
    - Still open: data model for user preferences, offline mode
    - Proposed tree revision 3 was the latest"
3. Action-path prompt:
   "Ready to continue? Pick one:
    (1) approved — resume the open questions where we left off
    (2) review — walk through what's already decided before continuing
    (3) restart — reset deliberation (rare; loses prior turns)
    (4) other — describe what you want."
4. On 'approved': resume Socratic from first open question
5. On 'review': walk through `answered_questions` first, then resume
6. On 'restart': confirm twice (destructive), then reset
```

Always summary → user confirmation → continue. Never silent resume.

### 5.8 `/ovd-plan verify` — retrospective plan-quality audit

> Added post-audit 2026-06-22 per FU-4 / Q3.3C to document a user-facing surface the code already ships. Distinct from `/ovd-go verify` (§6.6), which runs post-execution `LEAF VERIFY` / `CLUSTER VERIFY`.

`/ovd-plan verify` runs a **retrospective audit of the plan tree itself** — coverage (every functional requirement traces to ≥1 leaf), leaf completeness (`scope` + `skills` + `success` + `verify` all present), and goal-backward soundness — without advancing any deliberation-state stage. It is read-and-report: it never mutates the tree.

- **Tree source precedence:** audits the proposed tree if one is open, otherwise the committed tree (`resolveTreeFromOpened` — proposed-first, fallback-to-committed).
- **Dispatch shape:** plan-mode (render the audit) vs commit-mode (persist the report), inheriting the Pattern 1 + Pattern 4 JSON-guard dispatch from the `plan-quality.js` helper.
- **Action paths at close:** `(1) accept-and-commit`, `(2) iterate-via-deliberate`, `(3) describe-other`.

The handler is the Stage-6 plan-quality check (`plan-quality.js`) exposed as a user-facing subcommand; the CLI is the custodian (it surfaces gaps), not the grader.

---

## 6. `/ovd-go` — orient & continue (refined per Q7, Q11, Q15)

### 6.1 The default behavior

`/ovd-go` (bare) = `gsd-resume-work` analogue. Does NOT immediately execute. Sequence:

1. Read `OVERDRIVE.md`, most recent `.overdrive/sessions/*.md`, most recent `.overdrive/handoffs/*.md`.
2. Read codebase files for active node's scope.
3. Present orientation with explicit action paths (next subsection).
4. Wait for user response.
5. Branch.

### 6.2 Orientation prompt (per Q7 — always present action paths)

```
"Project: Foo Dashboard
 Milestone: II. Dashboard
 Active leaf: II.2.a Widget layout design [awaiting-review]
 Last session summary (2026-06-08 14:30):
   You asked for smaller title font; I reduced to 18px.
   You requested more contrast on secondary text; adjustment pending.

 Awaiting your review: 1 leaf (II.2.a)

 How would you like to continue?

  (1) Iterate on II.2.a (apply the pending contrast change and re-present)
  (2) Mark II.2.a as 'approved' and advance to II.2.b
  (3) Switch focus to a different node — name or describe it
  (4) Review the broader plan — show me where things stand
  (5) Replan — adjust the tree before continuing
  (6) Other — describe what you want.

 Reply with 1–6 or describe."
```

The agent never assumes "continue" means a specific thing. It always asks.

### 6.3 All internal states

Identical to r2 §6.3: `ORIENT` / `REVIEW TRIAGE` / `LEAF EXECUTE` / `LEAF VERIFY` / `AWAITING REVIEW STATE` / `CLUSTER VERIFY` / `MILESTONE BOUNDARY` / `TEST IMPLEMENT` / `TEST RUN` / `SMALL EXECUTE` / `DECISION POINT` / `BLOCKED` / `FIX` / `SKILL DELTA` / `CONTEXT GATHER` / `ITERATION LOOP`.

### 6.4 `AWAITING REVIEW STATE` prompt (per Q7)

After every leaf implementation + verify:

```
"II.2.a Widget layout design — implementation complete.

 Changes:
  - src/components/Dashboard/Grid.tsx (new)
  - src/styles/grid.css (modified)

 Verification (playwright_visual_regression):
  ✓ Renders at 768/1024/1440px
  ✓ Visual hierarchy matches reference
  ✓ Three sizes composable

 Reply 'approved' to mark this done, or describe changes to iterate.
 Other options: 'defer' (come back to this later), 'replan' (this needs rethinking)."
```

Approval is `approved` or equivalent ("ship it", "done", "next"). Iteration is anything that describes a change. The agent doesn't guess — if the user's reply is ambiguous, the agent asks: *"I'm not sure if you mean 'approve as-is' or 'change Y'. Pick one or describe."*

### 6.5 Recursive close at cluster / milestone boundaries (Q4 + Q14 connection)

When a leaf is `approved` and it was the last open leaf in its parent cluster, the agent walks up:

```
"II.2.a is now done. That closes II.2 Stats widgets (all three leaves done).

 Should we proceed?

  (1) close II.2 — mark it 'done', then check II (Dashboard) closure
  (2) verify II.2 first — run /ovd-go verify on II.2 (cluster verification)
  (3) hold — keep II.2 open for now and continue elsewhere
  (4) other — describe."
```

If approved → checks parent (`II Dashboard`); if all sub-clusters done → asks again; continues up the chain until a parent has open siblings or root is reached. Each level requires explicit user confirmation. See §7.5 for the full recursive close mechanism (same logic applies whether triggered from `/ovd-go` or `/ovd-log`).

### 6.6 `verify` flag

`/ovd-go verify` runs `LEAF VERIFY` or `CLUSTER VERIFY` without `LEAF EXECUTE`. Useful for re-verifying after manual or iteration adjustments.

### 6.7 `--small` auto-detection (resolved per Q15)

The agent detects scope automatically before executing:

```
"This change looks small — single file, no contract impact.
 Recommending /ovd-go --small to skip skill load and remap.

  (1) approved — use --small mode
  (2) full — use full mode anyway (slower, more thorough)
  (3) other — describe."
```

If the user keeps iterating beyond what `--small` scope warrants (multiple files touched, contracts changing), the agent transparently surfaces:

```
"This iteration has grown — now touching 5 files including a shared interface.
 Recommend switching to full mode for the rest:

  (1) switch — continue in full mode (loads skill set, remaps if needed)
  (2) keep --small — proceed but with caveats noted
  (3) replan — this needs a tree adjustment
  (4) other — describe."
```

Always transparent. Never silently switches modes.

### 6.8 Task targeting

`/ovd-go <node-ref>` and `/ovd-go test <node-ref>` accept hierarchical IDs (`II.2.a`) or fuzzy title match. Ambiguous → numbered list disambiguation.

### 6.9 Failure escalation (resolved per Q11, matching GSD)

GSD's pattern: agent attempts a fix, re-verifies; if fails, attempts a second fix with a different approach; if still fails, surfaces to user with diagnosis + options.

```
LEAF VERIFY fails
  ↓
FIX attempt 1: agent diagnoses, applies targeted fix
  ↓
LEAF VERIFY
  ├─ pass → AWAITING REVIEW STATE
  └─ fail
       ↓
FIX attempt 2: agent tries a different approach
  ↓
LEAF VERIFY
  ├─ pass → AWAITING REVIEW STATE (with note: "required 2 fix attempts")
  └─ fail
       ↓
ESCALATE TO USER:
  "II.2.a — verification still failing after 2 fix attempts.
   Diagnosis: [summary of what was tried, what's failing, hypothesis]
   Options:
    (1) try-once-more — describe what to try
    (2) replan — this leaf needs a rethink; route to /ovd-plan edit
    (3) skip — mark as blocked, advance
    (4) other — describe."
```

The 2-attempt cap is GSD's posture. Repeated escalations across the project feed `LEARNINGS EXTRACT` for planner improvement.

---

## 7. `/ovd-log` — lightweight save & recursive closure (refined per Q4, Q14)

### 7.1 The default behavior

`/ovd-log` (bare) = `gsd-pause-work` analogue + recursive close check. Sequence:

1. **Capture the active conversation** — distill modifications, responses, alignment, criteria, discoveries since last save.
2. **Update OVERDRIVE.md state** — active node, status changes, decisions logged.
3. **Update affected docs** — `doc-coauthoring` surgical propagation.
4. **Write per-session capture file** → `.overdrive/sessions/YYYY-MM-DD-HH-MM.md`.
5. **Recursive close check** (per Q4 + Q14) — if the active leaf is `done` or any node just closed, walk up the tree presenting closure prompts.
6. **Print** confirmation + recommended next.

### 7.2 Flags

- `/ovd-log handoff` — full end-of-session: handoff file + milestone-close detection + release prep + commit.
- `/ovd-log capture "text"` — timestamped activity log entry.
- `/ovd-log concerns` — structured review on active node (security, perf, persistence, fault tolerance, accessibility, observability, scalability). Actionable findings recommend `/ovd-plan idea`.

(Reminder: `idea` flag was removed; idea analysis is `/ovd-plan idea`.)

### 7.3 Internal state machine

| State | Trigger | What it does |
|---|---|---|
| `DEFAULT (lightweight save)` | bare `/ovd-log` | Convo capture + state + docs + session file + recursive close check |
| `CAPTURE` | `/ovd-log capture "text"` | Timestamped activity entry |
| `CONCERNS REVIEW` | `/ovd-log concerns` | Structured review on active node |
| `HANDOFF` | `/ovd-log handoff` | Full pipeline (per §7.6) |
| `CONVO CAPTURE` | internal at default | Distill active conversation |
| `STATE UPDATE` | internal | Statuses, active_node, decisions |
| `DOC UPDATE` | internal | Surgical propagation |
| `DECISION RECORD` | internal | Append to `.overdrive/decisions.md` |
| `SESSION FILE WRITE` | internal at default | `.overdrive/sessions/YYYY-MM-DD-HH-MM.md` |
| `HANDOFF FILE WRITE` | internal at handoff | `.overdrive/handoffs/YYYY-MM-DD-HH-MM.md` |
| `RECURSIVE CLOSE CHECK` | internal at default/handoff | Walk tree upward presenting closure prompts |
| `MILESTONE CLOSE` | internal at handoff if milestone complete | Trigger learnings + release + archive |
| `LEARNINGS EXTRACT` | internal at milestone close | What worked, friction, skill accuracy, iteration counts |
| `RELEASE PREP` | internal at milestone close, release milestone | `pre-launch-checklist`, `jack-seo-launch-audit` |
| `ARCHIVE` | internal post learnings | Move subtree to archive section |
| `COMMIT` | internal at handoff if git | `git commit` |

### 7.4 What `CONVO CAPTURE` extracts

Same as r2 §7.6 — modifications, user responses, new alignment, new criteria, new discoveries, decisions, open threads, what was interrupted (active leaf state, mid-edit).

### 7.5 Hierarchical recursive cache & closure (resolved per Q4 + Q14)

This is the operational pattern modeled on GSD's milestone-close behavior, extended to every level of the tree.

**Cache writes are continuous.** Every state change — even an in-iteration adjustment ("changed font size from 24 to 18") — writes to `.overdrive/plan.cache.json`. The cache structure mirrors the tree: each node has a snapshot of its current state, iteration history, and child-summary. A new conversation can resume mid-iteration without losing context.

**Closure is checked recursively on `/ovd-log` (default and handoff).** The mechanism:

```
On /ovd-log:
  1. CONVO CAPTURE + STATE UPDATE + DOC UPDATE + SESSION FILE
  2. RECURSIVE CLOSE CHECK:
     a. If any leaf just transitioned to 'done':
        Check its parent cluster.
     b. If parent cluster: all children 'done'?
        → present closure prompt for parent
     c. If user approves parent close:
        Check grandparent.
     d. If grandparent: all children 'done'?
        → present closure prompt for grandparent
     e. Continue up until: a parent has open siblings, OR root reached.
  3. At each closure prompt: ask whether to verify the level before closing
     (e.g., "II.2 closure — run cluster verification first?")
  4. After last closure prompt resolves: recommend next command
     ("Active focus is now II.3 — run /ovd-go to continue, or /ovd-log
     handoff to end session.")
```

**Closure prompt template:**

```
"That closes II.2 (Stats widgets) — all three leaves marked done.

 Before marking II.2 as done, would you like to:

  (1) verify — run /ovd-go verify on II.2 (cluster verification)
  (2) close — mark II.2 done and check II (Dashboard) closure
  (3) hold — keep II.2 open; continue working in this branch
  (4) other — describe."
```

**The recursive close never auto-advances.** Each level requires explicit user approval. This satisfies the user's principle: *"if the last implementation makes the end of a feature, the caching first resolves the current feature, then recursively assesses and either closes or proceed (with human acceptance) on the other higher-level hierarchical elements."*

**Resume preserves iteration depth.** When a new conversation starts with `/ovd-go`, the agent reads the cache and the last session file. If the previous session ended mid-iteration on a specific leaf (e.g., adjusting widget font size), the new session resumes there — not at cluster level. This satisfies: *"the caching from ovd-log should capture that and continue where it left off in a new conversation, and not reset to a cluster-level implementation."*

### 7.6 The handoff pipeline (full)

```
1. SUMMARISE SESSION
   - Leaves explicitly approved this session
   - Leaves still awaiting-review (flagged for next session)
   - Decisions made
   - Plan adjustments
   - New nodes added
   - Concerns recorded
   - Captured activity highlights
   - Iteration counts per leaf

2. STATE UPDATE

3. IDENTIFY FOLLOW-UPS
   - Awaiting-review leaves
   - Leaves needing testing
   - Deferred plan edits
   - Open questions
   - Concerns marked for follow-up

4. DOC UPDATE

5. WRITE HANDOFF FILE

6. RECURSIVE CLOSE CHECK (same mechanism as 7.5)
   - May trigger MILESTONE CLOSE if the recursion walks all the way to a
     milestone level and the user approves.

7. MILESTONE CLOSE (if recursion reached milestone and user approved)
   → 8, 9, 10

8. LEARNINGS EXTRACT
9. RELEASE PREP (if release milestone)
10. ARCHIVE

11. COMMIT (if git)

12. PRINT RESUME SUMMARY (with explicit action-path next steps)
```

---

## 8. Cross-pipeline flows + recursive closure

### 8.1 The complete pause–resume loop

```
ACTIVE SESSION (iterative work on II.2.a)
  ↓
[multiple awaiting-review cycles, feedback captured, agent adjusts]
  ↓
context filling
  ↓
/ovd-log                                      [user]
  ↓
CONVO CAPTURE + STATE UPDATE + DOC UPDATE + SESSION FILE  [agent]
  ↓
RECURSIVE CLOSE CHECK (no closures this time — II.2.a still in iteration)
  ↓
"Saved. II.2.a remains in iteration. Run /ovd-go to continue."
  ↓
[user clears context]

NEW SESSION
  ↓
/ovd-go                                       [user]
  ↓
ORIENT (reads cache + session file)            [agent]
"Active leaf: II.2.a (awaiting-review).
 Last session: 3 iteration cycles on font/contrast. Latest adjustment: pending.
 (1) Apply the pending adjustment, (2) approve as-is, (3) describe new direction, (4) other."
  ↓
[loop continues, exact iteration state preserved]
```

### 8.2 The close-up-the-chain flow

```
[Last leaf in a cluster approved]
  ↓
/ovd-log                                      [user]
  ↓
RECURSIVE CLOSE CHECK detects II.2 candidate for closure
  ↓
"Closes II.2 (Stats widgets). Verify first, close, or hold?"
  ↓
[user picks 'close']
  ↓
II.2 marked done; check II (Dashboard)
  ↓
II has open siblings (II.3 User profile page is pending)
  ↓
"II.2 closed. II.3 is next pending in milestone II. Continue with /ovd-go,
 or /ovd-log handoff to end session."
  ↓
[recursion stops here — root not reached]
```

When the recursion does reach a milestone close (rare, end-of-milestone moment):

```
[Last leaf of last cluster in milestone approved]
  ↓
/ovd-log
  ↓
recursion: leaf done → cluster done → milestone done?
  ↓
"This closes milestone II (Dashboard). Before closing:
  (1) /ovd-log handoff — runs full milestone close (learnings + release + commit)
  (2) verify — run cluster + milestone verification before close
  (3) hold — defer closure
  (4) other."
```

### 8.3 Agent recommendation matrix (with action paths)

| Situation | Recommendation phrasing |
|---|---|
| Project uninitialized | "Run `/ovd-workflow` first — tutorial + mapping. (1) start, (2) skip mapping, (3) other." |
| Tree doesn't exist | "Plan empty. (1) `/ovd-plan` to deliberate, (2) `/ovd-plan import "doc.md"` to ingest, (3) other." |
| In-deliberation | "Resume deliberation. (1) `/ovd-plan deliberate`, (2) review what's decided, (3) restart." |
| Ready to execute | "Tree ready. (1) `/ovd-go` to start, (2) `/ovd-plan` to review tree, (3) other." |
| Leaf awaiting-review | "Reply `approved` or describe changes." |
| Cluster complete | "Closes [name]. (1) verify, (2) close, (3) hold, (4) other." |
| Milestone complete | "Closes milestone. (1) `/ovd-log handoff` (full close), (2) verify first, (3) hold." |
| Context filling | "Recommend `/ovd-log` before clearing. (1) save, (2) handoff, (3) keep going." |
| New feature mid-flow | "Sounds like a new direction. (1) `/ovd-plan idea "..."`, (2) keep current focus, (3) other." |
| Verification failed × 2 | "Two fix attempts failed. (1) describe what to try, (2) `/ovd-plan edit` to rethink, (3) skip, (4) other." |
| Surgical change detected | "Looks small — recommend `/ovd-go --small`. (1) approved, (2) full mode, (3) other." |
| --small scope growing | "Now touching N files. (1) switch to full mode, (2) keep --small, (3) replan, (4) other." |

---

## 9. File & folder structure (with sketch-leaf mapping per Q17)

```
project-root/
├── OVERDRIVE.md                              # plan tree (primary user-facing view)
└── .overdrive/
    ├── codebase/
    │   ├── architecture.md
    │   ├── patterns.md
    │   ├── tech-stack.md
    │   ├── quality.md
    │   └── concerns.md
    ├── requirements.md
    ├── preferences.md
    ├── decisions.md
    ├── handoffs/
    │   └── YYYY-MM-DD-HH-MM.md
    ├── sessions/
    │   └── YYYY-MM-DD-HH-MM.md
    ├── sketches/
    │   ├── YYYY-MM-DD-HH-MM-slug.html       # throwaway mockups (in-session)
    │   └── approved/                         # promoted sketches referenced by leaves
    │       └── YYYY-MM-DD-HH-MM-slug.html
    ├── reports/
    │   └── milestone-N-summary.md
    └── plan.cache.json                       # hierarchical recursive cache
```

### 9.1 Git policy

Committed: `OVERDRIVE.md`, `.overdrive/codebase/*`, `requirements.md`, `preferences.md`, `decisions.md`, `handoffs/*`, `reports/*`, `sketches/approved/*`.

Gitignored: `sessions/*` (ephemeral), `sketches/*` outside `approved/` (throwaway), `plan.cache.json` (regenerable).

### 9.2 Sketch-to-leaf mapping (per Q17)

When a sketch is approved during `IDEA` → moves to `.overdrive/sketches/approved/`. A leaf created or updated as a result references the sketch via the schema's `references.sketches[]` field (§10.5). The leaf's description includes a sentence pointing to the file. At execution, the agent reads the sketch file and treats it as the visual contract.

### 9.3 `OVERDRIVE.md` serialization format (locked per Q2 — fenced YAML)

Each node in `OVERDRIVE.md` is a Markdown header (`#`/`##`/`###`/`####`/`#####` for tree depth) followed optionally by a prose description paragraph and a fenced YAML block tagged `yaml ovd-plan` carrying the structured fields. Status marker in `[brackets]` after the title; active leaf marked with `← ACTIVE`.

**Concrete example** (a slice of a plan, showing milestone / cluster / leaf):

````
---
ovd-plan: true
version: 3
project: "Foo Dashboard"
description: "Stats dashboard for internal ops."
created: 2026-06-08
updated: 2026-06-08T14:30:00Z
deliberation_status: executing
active_node: "II.2.a"
current_milestone: "II. Dashboard"
session_count: 4
context_files:
  codebase: .overdrive/codebase/
  requirements: .overdrive/requirements.md
  preferences: .overdrive/preferences.md
  decisions: .overdrive/decisions.md
---

# Foo Dashboard

## I. Foundation [done]

```yaml ovd-plan
skills: [planning-first, modern-web-guidance]
```

### I.1 Project scaffolding [done]
### I.2 Database schema [done]
### I.3 Auth middleware [done]

```yaml ovd-plan
inserted_by: agent
inserted_reason: required for protected routes
```

## II. Dashboard [in-progress]

```yaml ovd-plan
skills: [design-taste-frontend, impeccable, react-doctor, playwright-cli]
cluster_verification:
  criteria:
    - All widgets coexist without visual conflict
    - Dashboard load < 200ms
  method: playwright_full_dashboard_check
  review_required: true
```

### II.1 Navigation [done]

### II.2 Stats widgets [in-progress]

```yaml ovd-plan
skills: [design-taste-frontend, emil-design-eng]
```

#### II.2.a Widget layout design [awaiting-review] ← ACTIVE

Design the grid layout and visual hierarchy. Three sizes (small/medium/large), responsive at 768/1024px breakpoints. Implement per sketch at `.overdrive/sketches/approved/2026-06-08-14-30-widget-layout.html`.

```yaml ovd-plan
skills: [design-taste-frontend, impeccable]
scope:
  in:
    - src/components/Dashboard/
    - src/styles/grid.css
  read_only:
    - src/components/Card.tsx
  out:
    - data fetching
    - animations
success:
  - Grid renders at 768/1024/1440px without overflow
  - Visual hierarchy matches the referenced sketch
  - Three widget sizes implemented as composable components
deps: [II.1]
verify:
  method: playwright_visual_regression
  fallback: agent_self_check_against_success_criteria
  review_required: true
references:
  sketches: [.overdrive/sketches/approved/2026-06-08-14-30-widget-layout.html]
  external: []
inserted_by: user
iterations:
  - session: 2026-06-08T14:30:00Z
    feedback: title font too large
    delta_applied: reduced to 18px
  - session: 2026-06-08T15:10:00Z
    feedback: need more contrast on secondary text
    delta_applied: pending
```

#### II.2.b Data fetching layer []

```yaml ovd-plan
skills: [modern-web-guidance]
scope:
  in: [src/lib/api/]
  out: []
success:
  - All three widgets fetch on mount
  - Cache invalidation on 60s interval
  - Error states render gracefully
deps: [II.2.a]
verify:
  method: api_response_check
  review_required: true
```

### II.3 Accessibility pass []

```yaml ovd-plan
inserted_by: agent
inserted_reason: WCAG AA required for internal tooling
skills: [modern-web-guidance, react-doctor]
success:
  - Keyboard nav works through all widgets
  - Screen reader announces widget changes
  - Contrast ratios meet AA
verify:
  method: agent_self_check_against_success_criteria
  review_required: true
```

## III. Launch prep []

<!-- ovd-plan:inbox:start -->
- [ ] 2026-06-08 — Consider dark mode for v2
<!-- ovd-plan:inbox:end -->

<!-- ovd-plan:capture:start -->
2026-06-08T14:14 — starting II.2.a, reading existing grid in Card.tsx
<!-- ovd-plan:capture:end -->

<!-- ovd-plan:concerns:start -->
| Node | Dim | Note | Status |
|---|---|---|---|
| II.2.a | perf | Re-render on resize | open |
<!-- ovd-plan:concerns:end -->

<!-- ovd-plan:deliberation-state:start -->
```yaml
status: complete
last_session: 2026-06-08T14:30:00Z
turn_count: 7
open_questions: []
answered:
  - q: Target browser?
    a: Modern only
  - q: Auth?
    a: Supabase
user_calibration:
  domain: medium
  technical: low
  scope: high
```
<!-- ovd-plan:deliberation-state:end -->

<!-- ovd-plan:archive:start -->
(completed milestones move here after MILESTONE CLOSE)
<!-- ovd-plan:archive:end -->
````

**Format rules:**

- Tree depth → ATX header level (`#` project / `##` milestone / `###` cluster / `####` leaf / `#####` rare deeper).
- Status → `[status]` after the title text.
- Active position → `← ACTIVE` appended to the active leaf's header.
- Prose description → optional Markdown paragraph immediately after the header.
- Structured fields → single `​```yaml ovd-plan` fenced block per node, immediately after the description (or header if no description).
- The `ovd-plan` info-string tag on the fence is mandatory — the parser only treats blocks tagged this way as node annotations, ignoring any other YAML blocks in the file (e.g., examples in prose, deliberation-state).
- Managed sections (`inbox`, `capture`, `concerns`, `deliberation-state`, `archive`) use HTML-comment delimiters; `deliberation-state` holds its own untagged YAML inside the delimiters for cache simplicity.
- File-level metadata sits in standard YAML frontmatter between `---` at the top.

**Parsing contract:**

- A node's structured fields are exactly the contents of its `​```yaml ovd-plan` block. Absence → `pending` status, empty `skills`.
- A malformed YAML block is a hard parse error — the parser logs it and refuses to mutate state for that node. No silent field drop.
- Schema validation (required keys, value types, enum membership) runs on every parse.
- The cache layer (`.overdrive/plan.cache.json`) mirrors the parsed tree; it is regenerable from `OVERDRIVE.md` at any time via `/ovd-workflow map` (or implicitly when the cache is missing).

**Why fenced YAML over blockquote:** blockquote `> key: value` was tempting for compactness but is parser-fragile (indentation drift, multi-line continuation ambiguity, prose vs. structured-field disambiguation). Fenced YAML is unambiguous, validates against a strict schema, and any YAML linter can inspect a node in isolation. The visual weight is acceptable because the user's primary read of `OVERDRIVE.md` is the tree headers + status; structured fields are reference detail, not flowing prose.

---

## 10. Node schema (refined per Q10, Q17)

### 10.1 Required fields per leaf

> **Field names are writer-canonical** (matching the §9.3 fenced-YAML example and the Phase 1 parser/writer round-trip contract): `success`, `deps`, `verify`, and `scope.{in, read_only, out}`. (Corrected post-audit 2026-06-22 per FU-3 / Q3.3A.10 — earlier drafts of this example used the longer `success_criteria` / `dependencies` / `verification` / `scope.files_touched` names, which the code never adopted.)

```json
{
  "id": "II.2.a",
  "title": "Widget layout design",
  "description": "Design the grid layout and visual hierarchy. Three sizes, responsive 768/1024px. Implement per sketch at .overdrive/sketches/approved/2026-06-08-14-30-widget-layout.html.",
  "status": "pending | in-progress | awaiting-review | done | blocked | skipped",
  "inserted_by": "user | agent",
  "skills": ["design-taste-frontend", "impeccable"],
  "success": [
    "Grid renders at 768/1024/1440px without overflow",
    "Visual hierarchy matches the referenced sketch",
    "Three widget sizes implemented as composable components"
  ],
  "scope": {
    "in": ["src/components/Dashboard/", "src/styles/grid.css"],
    "read_only": ["src/components/Card.tsx"],
    "out": ["Widget data fetching", "Widget animations"]
  },
  "deps": ["II.1"],
  "verify": {
    "method": "playwright_visual_regression",
    "fallback": "agent_self_check_against_success_criteria",
    "review_required": true
  },
  "references": {
    "sketches": [".overdrive/sketches/approved/2026-06-08-14-30-widget-layout.html"],
    "external": []
  }
}
```

### 10.2 Hierarchical ID scheme (resolved per Q10)

Levels alternate notation to stay short and visually distinguishable:

| Level | Notation | Examples |
|---|---|---|
| 1 (milestones) | Uppercase Roman | `I`, `II`, `III`, `IV` |
| 2 (clusters / features) | Arabic digits | `I.1`, `I.2`, `II.3` |
| 3 (tasks / leaves) | Lowercase letters | `I.1.a`, `II.3.b` |
| 4 (subtasks) | Lowercase Roman | `I.1.a.i`, `II.3.b.iii` |
| 5 (rare deep) | Uppercase letters | `I.1.a.i.A` |
| 6+ (very rare) | Arabic digits restart | `I.1.a.i.A.1` |

Examples in a tree:

```
I. Foundation
  I.1 Project scaffolding
  I.2 Database schema
    I.2.a User table
    I.2.b Audit log table
II. Dashboard
  II.1 Navigation
  II.2 Stats widgets
    II.2.a Widget layout design
    II.2.b Data fetching
      II.2.b.i Fetch client
      II.2.b.ii Cache layer
    II.2.c Widget animations
```

Position-based; auto-generated from tree structure. The agent prefers IDs but also accepts fuzzy title matching for `/ovd-go <node-ref>`.

### 10.3 `awaiting-review` status

Set after `LEAF VERIFY` passes. Only an explicit user signal (`approved`, `ship it`, `next`, or equivalent captured via the action-path prompt) transitions to `done`. Anything else captured as iteration → back to `in-progress`.

### 10.4 `inserted_by` field

`user` (elicited from user) or `agent` (blind-spot expansion). Surface in `OVERDRIVE.md` as `[proposed-by-agent: <one-line-reason>]` tag.

### 10.5 `references.sketches[]` field (per Q17)

Array of file paths to `.overdrive/sketches/approved/*.html` that serve as the visual contract for this leaf. The leaf's description includes a sentence pointing to the sketch; the agent loads it at execution.

### 10.6 Iteration history (optional but recommended)

```json
{
  "iterations": [
    { "session": "2026-06-08T14:30:00Z", "feedback": "title font too large", "delta_applied": "reduced to 18px" },
    { "session": "2026-06-08T15:10:00Z", "feedback": "need more contrast on secondary text", "delta_applied": "pending" }
  ]
}
```

Reconstructable across sessions; feeds `LEARNINGS EXTRACT`.

### 10.7 Container nodes (unchanged from r2)

```json
{
  "id": "II.2",
  "title": "Stats widgets",
  "description": "...",
  "status": "pending | in-progress | mixed | done",
  "skills": [...],
  "children": [...],
  "cluster_verification": {
    "criteria": [...],
    "method": "...",
    "review_required": true
  }
}
```

### 10.8 `references.research[]` field (FU-2, shipped 2026-06-23)

Array of file paths to `.overdrive/sessions/<ts>-research-<slug>.md` findings files that inform this leaf — the research analogue of `references.sketches[]` (§10.5). A **pointer, not a paste**: the findings live in their file; the leaf carries only the path, keeping `OVERDRIVE.md` lean.

Written by `/ovd-plan research` when a **substantive** commit includes `attach_to_leaf: <node-id>` — the handler validates the target is an existing leaf (not a container) *before* writing the file, then appends the file path to that leaf's `references.research[]` via the committed-tree round-trip. One-liner research stays in the inbox (no file to point at). At execution, `/ovd-go` reads the leaf's `references.research[]` and surfaces the findings as context — strongest value is **cross-session** (research one day, execute after a context clear). Serialization order is fixed by `writer.js` `REFERENCES_KEY_ORDER = [sketches, research, external]`.

---

## 11. Skill-router protocol (Q3 RESOLVED 2026-06-08, refined after codebase research)

**Locked:** **Option D architecture** (catalog-as-data + skill-as-narrative) with a **B-style implementation path** (thin Node helper layered on existing SKILL.md; structured `catalog.json` deferred to post-v1). **Planning-time resolution is the canonical path; execution-time delta is the exception, not the default.**

### 11.1 Why the refined position

Initial r3 framing (preserved as historical record in §13.2) assumed skill-router was a Node function we could patch with `prior_set` parameters. Phase 1 Research (see implementation log entry 2026-06-08) confirmed skill-router is a SKILL.md document read by the AI agent itself — there is no code-level `route()` function to extend. The design intent (each leaf carries pre-resolved skill annotations so execution short-circuits cold routing) is unchanged; only the mechanism is refined.

### 11.2 The canonical flow

```
PLANNING (/ovd-plan Stage 5 — Plan phase, RESOLVE SKILLS sub-step):
  For each leaf:
    ovd-plan invokes the skill-router helper with:
      - leaf description
      - leaf scope (in / out / read_only paths)
      - success criteria
      - relevant codebase patterns (from .overdrive/codebase/)
    Helper builds a focused routing prompt; host agent (the AI agent running
    the slash command) performs the routing reasoning and returns structured
    JSON; helper parses it. Returned:
      - skills: string[]      (the resolved prior set)
      - confidence: "high" | "medium" | "low"
      - rationale: string     (one-line reasoning)
      - considered: string[]  (skills considered but rejected, for transparency)
    Result written to the leaf's YAML annotation in OVERDRIVE.md.

EXECUTION (/ovd-go LEAF EXECUTE):
  Agent reads the leaf's pre-resolved skills annotation.
  Agent loads the named SKILL.md files directly.
  Agent executes the leaf.
  No router consultation per session — short-circuited by the annotation.

EXECUTION (SKILL DELTA — the exception, fires when ANY of):
  - leaf annotation is empty/missing
  - confidence was 'low' or 'medium' and agent observes complexity
  - agent observes a need outside the prior (e.g., security concern surfaces
    in a UI leaf during implementation)
  →
  Agent re-invokes the helper with live execution context.
  Delta captured to session log (.overdrive/sessions/*.md) under
  'skill-delta: planner=[...], runtime=[...]'.
  Leaf's annotation is NOT silently rewritten — planner heuristic improvement
  is the deferred action handled at LEARNINGS EXTRACT.
```

### 11.3 Architectural shape (Option D — catalog-as-data + skill-as-narrative)

- **`skills/skill-router/SKILL.md`** (existing, lightly updated) — narrative routing guide for direct AI use. Phase 1 adds a 'planning-time vs execution-time' section so agents invoked outside ovd-plan still honor consistent semantics (see §11.7).
- **`skills/skill-router/references/catalog.md`** (existing) — catalog reference. Phase 1 helper parses skill IDs from this file via lightweight regex.
- **`skills/skill-router/catalog.json`** (deferred to Phase 7 or post-v1) — structured catalog with id, triggers, tags, when-to-use rules per skill. Becomes the single source of truth; SKILL.md and catalog.md cross-validated against it. Promoted only if SKILL.md/catalog.md parsing proves fragile or richer queries are needed (e.g., skill-by-tag lookups, planner self-improvement metrics).
- **`lib/ovd-plan/skill-router.js`** (new in Phase 1) — thin Node helper invoked by ovd-plan during planning.

### 11.4 Implementation path (B-style — minimal restructuring in Phase 1)

1. Helper parses `skills/skill-router/references/catalog.md` (lightweight regex extraction) to enumerate skill IDs.
2. Helper exposes `resolvePriorSet({ leafDescription, leafScope, leafSuccessCriteria, codebaseContext }): { skills, confidence, rationale, considered }`.
3. Helper builds a focused routing prompt: catalog summary + leaf details + 'return JSON of skill IDs with confidence and rationale'.
4. The prompt is rendered for the host agent (whichever AI runtime is executing the slash command — Claude Code, Codex, Gemini, Cursor, Antigravity). The host agent performs the routing reasoning using its standard skill-router knowledge and returns structured JSON.
5. ovd-plan parses the JSON and writes to the leaf's YAML annotation in OVERDRIVE.md.

**Mechanism note:** the helper does NOT make LLM API calls itself (Overdrive is zero-runtime-deps and runs as CLI). Instead, the slash command markdown body orchestrates the host agent to call the helper for the leaf list, then answer the routing prompts, then call back with results. The pattern mirrors how existing `/ovd-status` etc. work — slash command markdown → AI agent runs `overdrive <cmd>` → parses output → acts.

**Catalog.json promotion path (Phase 7+):**
- Triggered if SKILL.md/catalog.md parsing proves fragile or richer queries are needed.
- Adds a derivation/validation step ensuring SKILL.md, catalog.md, and catalog.json stay consistent.
- Existing `scripts/evaluate-router.js` benchmark continues to validate skill coverage.

### 11.5 Confidence semantics

- **`high`** — prior set is canonical. Execution uses it as-is. SKILL DELTA fires only on observed need outside the prior. Planner emits `high` when leaf has narrow scope + clear success criteria + well-understood domain + applicable codebase patterns.
- **`medium`** — prior is starting point. Execution-time agent may add 1-2 skills as complexity emerges; deltas captured. Planner emits `medium` when scope is moderate or one input is partial.
- **`low`** — prior is advisory. Execution-time agent re-invokes full helper with current context. Planner emits `low` when leaf is experimental, novel, or scope is broad.

### 11.6 Fault tolerance

- Empty `skills[]` annotation → execution-time reconsultation (treated as low confidence).
- Skill in annotation that no longer exists (renamed/removed) → warn, skip slot, continue with the rest.
- Helper failure (parse error, host agent error) → fallback to no annotation; execution-time router consultation. Logged to session capture.
- Catalog.md parse failure → helper fails fast with diagnostic; ovd-plan reports to user; planning blocks until resolved.
- The router benchmark in `scripts/evaluate-router.js` continues to validate skill catalog coverage; any SKILL.md edits must keep it passing.

### 11.7 SKILL.md update (Phase 1 Task 1.5 deliverable)

Add a section to `skills/skill-router/SKILL.md`:

```
## Planning-time vs execution-time routing (ovd-plan protocol)

When invoked from ovd-plan during planning (RESOLVE SKILLS sub-step in
/ovd-plan Stage 5), return a structured JSON object:
  { "skills": [...], "confidence": "high"|"medium"|"low", "rationale": "...", "considered": [...] }

When the active leaf in OVERDRIVE.md has a pre-resolved `skills:` annotation
with `confidence: high`, do NOT reconsult the router for that leaf — load the
named skills and execute. Reconsult only if the agent observes a need outside
the prior set during execution.

When `confidence: medium`, treat the prior as the starting set and add 1-2
more skills only on observed need. Capture additions as skill-delta to the
session log under .overdrive/sessions/.

When `confidence: low` or the annotation is missing, perform full routing per
the rules above and capture the result back to the leaf annotation as a delta.
```

---

## 12. Relationship to existing systems (RESOLVED 2026-06-08 — full reposition)

**Locked posture:** the existing pre-ovd-plan code is preliminary scaffolding. r3 supersedes it. We gut and rebuild `lib/ovd-workflow.js`, repurpose the existing slash commands, and migrate the existing `.overdrive/` file layout to match r3. **The only untouchable layer is the 137 skill files in `skills/*/SKILL.md`** — those remain exactly as they are.

User direction (2026-06-08): *"don't be too much influenced by the existing workflow / plan structure — those are preliminary, and we are now working precisely to draw something permanent... r3 precedes the existing code... we have to choose the maximally beneficial option for this plan and for the final product, not previous commits."*

### 12.1 What gets repurposed

- **`lib/ovd-workflow.js`** — gutted and rebuilt to implement `/ovd-workflow` per r3 §4 (initialization + codebase mapping + preferences + requirements + decisions hub). May be renamed/relocated to `lib/ovd-plan/workflow.js`. Existing utility functions (`findProjectRoot`, `hasProjectSignal`, `isSafeProjectDir`, `writeIfMissing`-style helpers, `ensureWorkflowGitignore`) are preserved as imports for the new module; the dispatching/orchestration logic is replaced.
- **Existing slash commands** (`/ovd-status`, `/ovd-doctor`, `/ovd-checkpoint`, `/ovd-resync`, `/ovd-knowledge`) — repurposed per the migration map in the implementation plan (§5A.2). The old user-visible commands continue to *resolve* (muscle memory preserved), but their bodies delegate to the new commands with a one-line deprecation note pointing to the new replacement.
- **Existing `.overdrive/*` files** (`project.md`, `state.md`, `architecture.md`, `constraints.md`, `research.md`, `changelog.md`, `config.json`, `file-index.json`, `knowledge-index.json`, `routes.jsonl`, `work/_active.json`) — migrated to the new r3 §9 layout per the migration map in the implementation plan (§5A.1). Migration is handled by `/ovd-workflow init` when it detects the old layout, on explicit user approval. Old files are archived to `.overdrive/_legacy/YYYY-MM-DD-HH-MM/` for one cycle before the user can remove them.
- **Existing CLI subcommands** in `workflowCommands` Set (status, resync, knowledge, doctor, checkpoint, hook, route, usage) — repurposed per §5A.3. New commands added (plan, go, log, workflow). Installer-level commands (install, verify, etc.) unchanged.

### 12.2 What's untouched

- **The 137 skill files** in `skills/*/SKILL.md` and their references. Hard rule, applies everywhere.
- **The `skill-router` skill** gets the minimal additive update documented in §11.7 — same file, additive section under "Planning-time vs execution-time routing." No existing routing rules altered.
- **Installer-level CLI** (`install`, `verify`, `check-updates`, `self-update`, `update-skills`, `uninstall`, `help`, `list-targets`) — unchanged.
- **Hook integration** (`overdrive hook ...`) — unchanged; new commands can register hooks via the same mechanism.

### 12.3 Migration semantics

- Existing project with old `.overdrive/` layout → `/ovd-workflow init` detects it, presents action-path prompt: (1) migrate now, (2) skip migration (start fresh, archive old to `_legacy/`), (3) other.
- Migration reads old files, derives new layout entries per the migration map (impl plan §5A.1), writes the r3 §9 structure, archives old files in `.overdrive/_legacy/YYYY-MM-DD-HH-MM/` (timestamped one-time archive).
- Idempotent: re-running `/ovd-workflow init` on an already-migrated project shows status, not migration.
- Never overwrites existing new-layout files. Conflicts (new file already present + old file has data) surfaced in the migration report.

### 12.4 Internal granularity

Matches/exceeds GSD in internal stages; no runtime dependency on GSD. Pipelines and granularity per r3 §5–7.

---

## 13. Open questions

### 13.1 Q2 (RESOLVED 2026-06-08): `OVERDRIVE.md` per-node field syntax — fenced YAML (Option C)

**Decision:** Option C — fenced YAML block per node, tagged `​```yaml ovd-plan`. Chosen for parsing rigor, schema validation, and unambiguous separation between prose description and structured fields. See locked format example in §9.3.

The tradeoff analysis below is preserved as historical record.

---

The plan tree lives in `OVERDRIVE.md` as Markdown headers. Each node carries structured fields (`skills`, `success_criteria`, `scope-in`, `scope-out`, `verify`, `deps`, `review-required`, `references.sketches`, etc.). The question is **how to encode these fields next to each header**.

#### Option A: Blockquote `> key: value` lines (current proposal in r2/r3)

```markdown
#### II.2.a Widget layout design [awaiting-review] ← ACTIVE
> Design the grid layout. Three sizes, responsive 768/1024px.
> skills: design-taste-frontend, impeccable
> scope-in: src/components/Dashboard/, src/styles/grid.css
> scope-out: data fetching, animations
> success:
>  - Grid renders at 768/1024/1440px without overflow
>  - Visual hierarchy matches reference
> verify: playwright_visual_regression
> review-required: true
> deps: II.1
> sketches: .overdrive/sketches/approved/2026-06-08-widget-layout.html
```

**Pros:**
- Compact, visually integrated with the prose.
- Easy to read top-to-bottom — fields appear right under the title.
- Edit-friendly in any text editor; no nested syntax to track.
- Minimal vertical space.

**Cons:**
- Parser must handle blockquote continuation correctly (multi-line `success:` list).
- Indentation drift can break parsing (a stray space, missing `>`).
- No formal schema validation — typos in keys silently mis-parse.
- Mixing prose description (also blockquote `>`) with structured fields requires careful disambiguation.

#### Option B: Per-node YAML frontmatter blocks

```markdown
#### II.2.a Widget layout design [awaiting-review] ← ACTIVE

---
skills: [design-taste-frontend, impeccable]
scope-in: [src/components/Dashboard/, src/styles/grid.css]
scope-out: [data fetching, animations]
success:
  - Grid renders at 768/1024/1440px without overflow
  - Visual hierarchy matches reference
verify: playwright_visual_regression
review-required: true
deps: [II.1]
sketches: [.overdrive/sketches/approved/2026-06-08-widget-layout.html]
---

Design the grid layout. Three sizes, responsive 768/1024px.
```

**Pros:**
- Formal YAML — strict schema, validated by a YAML parser.
- Cleanly separated from prose description.
- Familiar pattern (top-level `OVERDRIVE.md` already uses YAML frontmatter).
- Tooling support (any YAML linter validates).

**Cons:**
- Visually noisier — `---` blocks for every node bloats the file.
- Multiple `---` blocks in one Markdown file confuse some renderers.
- Less Notion-like reading flow — structured data sits in a separate block from the prose.

#### Option C: Fenced YAML block per node

```markdown
#### II.2.a Widget layout design [awaiting-review] ← ACTIVE

Design the grid layout. Three sizes, responsive 768/1024px.

```yaml ovd-plan
skills: [design-taste-frontend, impeccable]
scope-in: [src/components/Dashboard/, src/styles/grid.css]
scope-out: [data fetching, animations]
success:
  - Grid renders at 768/1024/1440px without overflow
  - Visual hierarchy matches reference
verify: playwright_visual_regression
review-required: true
deps: [II.1]
sketches: [.overdrive/sketches/approved/2026-06-08-widget-layout.html]
```
```

**Pros:**
- Clean separation, YAML validation, no `---` collision.
- Renderers display the code block visually distinct — easy to scan.
- Easy to fold/collapse in most editors.

**Cons:**
- Each node has a code block — heavier visual weight than blockquote.
- Slightly more verbose than Option A.

#### Recommendation pending

My weak preference for v1 is **Option A** (blockquote) for the Apple/Notion-like feel; **Option C** (fenced YAML) is the safer choice if parsing fragility worries you. **Option B** (per-node YAML frontmatter) is the most rigorous but the noisiest. The decision affects parser complexity and reading experience. Pick one and we lock the format.

### 13.2 Q3 (RESOLVED 2026-06-08): Skill-router prior-set integration shape — Option B (native router mode)

**Decision:** Option B — modify skill-router to accept `prior_set` + `prior_confidence` parameters natively. Router stays as the contact / connection layer to all 137 skills; `ovd-plan` parses leaf annotations and passes them through. Single integration path, structured deltas, no behavior drift between planned and ad-hoc tasks. See §11 for the locked implementation contract.

The tradeoff analysis below is preserved as historical record.

---

The prior-set API itself is settled (see §11). The question is *where the logic lives*. Three candidates.

#### Option A: Wrapper layer in `ovd-plan` (no skill-router modification)

`lib/ovd-plan.js` wraps every skill-router call. Before calling the router, it:
1. Reads the leaf's `skills` annotation.
2. Loads those SKILL.md files directly.
3. Calls skill-router only for delta evaluation, with the prior set as instruction in the task description.

**Pros:**
- Zero changes to skill-router. Lowest risk.
- Fully decoupled — `ovd-plan` can iterate independently.
- Easy to roll back: skill-router stays exactly as it is.

**Cons:**
- Two paths exist: ad-hoc tasks go through router cold; planned tasks go through wrapper. Subtle behavior divergence over time.
- The "delta" computation is approximate — we ask the router *"do you think we need more than these?"* via a prompt, not via a structured API.
- Wrapper logic duplicates some router internals (which skills exist, naming conventions).

#### Option B: Native prior-set mode in skill-router

Skill-router gains an explicit `prior_set` + `prior_confidence` parameter. The router's own logic respects the prior set per the confidence level.

**Pros:**
- Single integration path. All skill-routing goes through the router.
- The router owns its semantics — no behavior drift between paths.
- Delta computation is structured: router returns added/removed skills as data, not prose.
- Sets up the router for other consumers (not just `ovd-plan`) to benefit from the prior-set pattern.

**Cons:**
- Requires modifying skill-router. The 137 skills are untouched, but the router's API and internals change.
- More upfront work. Risk of regressing existing skill-router behavior if poorly tested.
- If skill-router is a published library or used outside Overdrive, breaking change concerns apply.

#### Option C: Local lightweight router API in `ovd-plan`

Build a small dedicated router inside `ovd-plan` — fed only the leaf's prior set + a small dictionary of "skills typically added as deltas" — that runs locally without invoking the full skill-router. Falls back to the full router only when prior-set is empty.

**Pros:**
- Fastest by far — no full router invocation for planned tasks.
- Bounded token cost — the lightweight router operates over a known small set.
- Minimal coupling to skill-router internals.

**Cons:**
- Two routers to maintain. Drift between them over time.
- Lightweight router might miss skills the full router would have caught.
- Requires maintaining a "common deltas" dictionary that may go stale.

#### Recommendation pending

The user's framing: *"I do intend to use skill-router, but I am flexible in terms of modifying it briefly, abstracting over it to be the best, fastest, fine tuned representation of the router, or even changing to an API representation that would work lightly locally in the background."*

That phrasing leans toward **Option C** (local lightweight) or **Option B** (native router mode). **Option A** is the lowest-risk but produces the most behavior drift over time.

My recommendation if I had to pick one: **Option B** for the v1, because it consolidates semantics in one place; we can layer **Option C** on top later as a performance optimization once we have measurements.

But this is genuinely a decision that depends on factors I don't have visibility into (is skill-router consumed elsewhere? how much test coverage does it have? what's your appetite for risk in its core?). Tell me your read.

### 13.3 Remaining lower-priority items

- **Q8 follow-up (P1):** for the auto-route from `IDEA` → `EDIT` when an idea is small + low-risk, what's the size threshold? §5.2 currently always routes through the explicit approval prompt; we could add a "this is trivial — auto-integrating" path for changes touching ≤2 leaves with no dependency impact. Worth deciding.
- **Q9 follow-up (P2):** whether blind-spot expansion categories are configurable per-project (some teams may not want every category every time).
- **Q14 follow-up (P2):** exact format of the closure prompt when recursion reaches root — what counts as "project complete"?
- **Q17 follow-up (P2):** when an approved sketch is later superseded, what happens to the file? (Keep, archive, delete?)

---

## 14. What this is not

- Not a replacement for Overdrive execution skills.
- Not a team collaboration tool.
- Not a replacement for git.
- Not cloud-connected.
- Not a fixed-schema system.
- Not a CLI verbosity competition with GSD.
- Not "fast autonomous half-assing."
- Not a single-file system — multi-file architecture.
- Not linear — iteration is the default; closure is recursive and human-approved.
- Not silent — every consequential action presents action paths and waits for approval.

---

*Third revision of the converged conceptual spec as of 2026-06-08. Sections 0–12 represent the agreed design frame. Section 13 holds the two remaining P0 decisions (per-node field syntax, skill-router integration shape) with detailed tradeoffs. Once Section 13 is resolved, implementation begins from the foundation phase (parser → writer → cache → command registration) using the multi-file architecture from Section 9, the hierarchical ID scheme from Section 10.2, and the iteration / recursive-close loops from Sections 6 and 7.*
