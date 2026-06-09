# ovd-plan: Pipeline Architecture — Revision 2

**Date:** 2026-06-08
**Branch:** `feature/ovd-plan`
**Status:** Design — converged conceptual frame, second revision. Incorporates 2026-06-08 user feedback. Open questions enumerated in Section 13. No code.
**Supersedes:** `2026-06-07-ovd-plan-pipeline-architecture.md` in all command-surface, default-behavior, file-architecture, and execution-loop decisions. The previous document remains as historical record of the convergence path.

---

## 0. User feedback (2026-06-08) and how this revision addresses it

This section captures the user's input exhaustively, so the reasoning behind every change is recoverable.

### Point 1 — Drop `/ovd-plan sketch`

**User input:** "There’s no real reason for /ovd-plan sketch. If you’d like to have some sort of pipeline for making UIs and mockups, unless it cannot be done through /ovd-plan idea -> /ovd-go and /ovd-go small, we could have something like /ovd-sketch, but I don’t really see the necessity for it. […] Tell me what you think."

**Recommendation:** discard the `sketch` flag for v1. Mockup-style exploration routes through `/ovd-plan idea "sketch X"` → internal `SKETCH` sub-state inside the `IDEA` pipeline → throwaway HTML rendered for the user → if approved, normal `EDIT` integration; if not, the artifact stays in `.overdrive/sketches/` and the conversation appends to the inbox. Surgical visual tweaks after a design is approved route through `/ovd-go --small`. Reasoning: 5 user-facing commands violate the minimalism we're optimizing for; sketching is a sub-activity of ideation, not a parallel pipeline. If a measurable need emerges later, we add `/ovd-sketch` + `/ovd-log sketch` exactly as the user proposed.

**Where addressed:** Section 5 (sketch dropped from flags), Section 5.4 (sketching folded into `IDEA` sub-pipeline), Section 9 (`.overdrive/sketches/` folder defined).

### Point 2 — Drop `/ovd-log idea` (overlap with `/ovd-plan idea`)

**User input:** "It seems there is a somewhat high overlap between /ovd-plan idea and /ovd-log idea. […] I suggest we use /ovd-plan idea for idea analysis and by capturing it we would use /ovd-log capture or handoff. There’s no real reason for using both, but the /ovd-plan idea might actually better analyse the impact over the existing plan, and the integration."

**Change:** `/ovd-log idea` is removed. All idea analysis lives in `/ovd-plan idea`. Lightweight thought-capture lives in `/ovd-log capture "text"` or the new `/ovd-log` default (which captures the active conversation).

**Where addressed:** Section 7.2 (flag list reduced to `handoff` / `capture` / `concerns` plus the new default behavior).

### Point 3 — Explicit pipeline for adding new features/tasks

**User input:** "It’s important to handle the creation of new features / tasks easily, regardless of how small, and to integrate them into the existing plan, in the same UX-style level as Notion. For this I think the best pipeline would be /ovd-plan idea for deliberation, /ovd-plan research for a detailed analysis if approved then it goes to /ovd-log handoff from there /ovd-plan edit to pass it around into the existing plan."

**Change:** the agent now routes the feature-addition flow explicitly. For small ideas: `/ovd-plan idea` → analyze impact → if approved → internal `EDIT` + `DOC UPDATE`. For larger ideas needing research: `/ovd-plan idea` → analyze impact → if research needed → `/ovd-plan research` → if mid-session pause: `/ovd-log handoff` (context-save) → next session: `/ovd-plan edit` integrates. The agent recommends the next step at each decision point, so the user doesn't have to know the path.

**Where addressed:** Section 5.5 (full feature-addition pipeline mapped), Section 8.2 (recommendation matrix), Section 5.2 (`/ovd-plan idea` upgraded to a true impact analyzer).

### Point 4 — Natural-language intent detection

**User input:** "It’s of utmost importance to determine the actual intention of the user, and adjust our flags and pipelines to that one, even if they did not use the proper commands. […] it is important to align their intention to our model from even possible position they might be in."

**Change:** new top-level subsystem — the **Intent Detection Layer** — sits in front of every command. Any free-form message without a command is classified and routed to the most likely pipeline + internal state. High-confidence classifications execute directly with a one-line announcement ("Reading this as `/ovd-plan idea`. Continuing."). Low-confidence classifications surface 2-3 candidate routes and ask the user to pick.

**Where addressed:** Section 3 (new section dedicated to intent detection).

### Point 5 — Codebase mapping at `/ovd-workflow` (first step), not `/ovd-plan`

**User input:** "I think the codebase mapping should be done at the first step, for example /ovd-workflow, and only referenced, updated and used from that point onwards. In this sense the /ovd-plan and everything that follows use it, but they don’t create it."

**Change:** codebase mapping moves out of `/ovd-plan`'s `NEW PROJECT` state and into `/ovd-workflow init`. `/ovd-workflow` is repositioned from passive tutorial layer to the **initialization + persistent-context hub**: it runs the codebase map once, owns its updates, and serves as the read-only source for `/ovd-plan` and `/ovd-go`. `/ovd-plan` consumes the map; it never produces it. If a user runs `/ovd-plan` in an un-initialized project, the system implicitly invokes `/ovd-workflow init` first (or asks).

**Where addressed:** Section 4 (new section: `/ovd-workflow` as init + context hub).

### Point 6 — Agent proactively adds non-elicited but required tasks during planning

**User input:** "It’s also important that in the plan, the agent captures all sorts of 'tasks' and phases that were not actually elicited by the users (because they might not be exhaustive), but actually required, so that in the moment of development the agent doesn’t realise mid-task that they need to also take a look at X, Y, Z and try to implement it with the remaining of the context rapidly."

**Change:** the Socratic protocol gets a new mandatory pass — **blind-spot tree expansion**. Before proposing the tree, the agent walks a checklist of categories typically missed by non-exhaustive users (security, perf, accessibility, observability, error handling, data migration, edge cases, rollback, fixtures, documentation, user onboarding, etc.) and inserts proposed nodes for each that applies. Each inserted node is marked `[proposed-by-agent]` with a one-line justification, so the user can review and reject. This shifts blind-spot fill from "surface to user" to "add to tree by default, user prunes."

**Where addressed:** Section 5.3 (Socratic protocol upgraded), Section 5.3.4 (blind-spot category checklist), Section 10 (node schema gains `inserted_by` field).

### Point 7 — Multi-file architecture matching/exceeding `gsd-map-codebase`

**User input:** "It’s also of utmost importance that the plan and codebase mapping works at least as well as the gsd-map-codebase command, so we don’t have a single OVERDRIVE.md file, but rather multiple, each concerning a different domain, a different level of abstraction, following the best industry practices. I do expect to create multiple, including for user preferences, and requirements. […] follow the GSD command, and eventually enhance it to have the codebase mapping as good as possible, and to keep it updated throughout the pipelines (critical task)."

**Change:** single `OVERDRIVE.md` becomes a curated human-readable plan view at the project root; the supporting analysis is split across multiple specialized files inside `.overdrive/`. Specifically:

- `OVERDRIVE.md` — the plan tree (the user's primary view)
- `.overdrive/codebase/architecture.md` — system structure, module boundaries, data flow
- `.overdrive/codebase/patterns.md` — recurring patterns, idioms, conventions
- `.overdrive/codebase/tech-stack.md` — frameworks, libraries, versions, build chain
- `.overdrive/codebase/quality.md` — test coverage, type discipline, lint posture
- `.overdrive/codebase/concerns.md` — pre-existing risks: security, perf, debt
- `.overdrive/requirements.md` — what the project must deliver (functional + non-functional)
- `.overdrive/preferences.md` — user / team preferences and vetoes
- `.overdrive/decisions.md` — log of decisions and rationale
- `.overdrive/handoffs/YYYY-MM-DD-HH-MM.md` — per-session handoff files
- `.overdrive/sessions/YYYY-MM-DD-HH-MM.md` — per-session capture logs
- `.overdrive/sketches/` — throwaway UI mockups (gitignored by default)
- `.overdrive/plan.cache.json` — internal cache (gitignored)

These are produced and maintained by `/ovd-workflow`. `/ovd-plan` reads them and writes `OVERDRIVE.md`. `/ovd-go` reads all of them, writes status updates to `OVERDRIVE.md` and per-session files. `/ovd-log` writes per-session files, updates docs and decisions.

**Where addressed:** Section 4 (codebase mapper design), Section 9 (full file layout).

### Point 8 — GSD-level planning granularity, plain-language surfacing

**User input:** "Look at GSD to see how their pipelines for planning defines the stages, especially the iteration, success criteria and so on. I want it to be extremely granular and well thought out, even more than GSD, while not hindering performance, or presenting in plain text items that go above the user’s experience. (Internall it’s fine to make it a principal SDE / Architect-level)"

**Change:** internally, the planning pipeline runs through staged depth matching GSD's `discuss → spec → plan → verify` rigor (architect-level analysis: requirement clarification, ambiguity scoring, dependency mapping, risk identification, verification criteria per leaf, plan-quality goal-backward check). Externally, all output is plain-language and adapted to the user's calibrated level. The user sees a tree and a conversation; the agent runs the full GSD-equivalent planning machinery behind it.

**Where addressed:** Section 5.3 (Socratic protocol now mirrors `gsd-discuss-phase`), Section 5.4 (planning stages mapped to GSD equivalents), Section 5.6 (verification criteria specification mirrors `gsd-plan-phase`).

### Point 9 — Iterative execution, default behaviors of `/ovd-go` and `/ovd-log`

**User input:** "It’s also important to realise that the process is never that linear as in 'ovd-go -> feature ended'. It’s always an extensive iteration where the user says what they don’t like about the current implementation (often small things), and they continue to work on that. […] it’s important that the ovd-go + ovd-log doesn’t just consider the aspects finished, until the user explicitly states so, and the combination is rather used for capturing the modifications, the user responses, the new alignment, the criteria, new discoveries etc […] Always updating the state, the documentation to the right level, never leaving things in memory. It should work good so that if the user says /ovd-log (default: updates the state, the documentation, capturing the conversation) then clears the context then /ovd-go, it can just natively continues where it left off. […] equivalent to gsd-stop and gsd-resume-work. […] /ovd-go by default is the entry point, which first presents an overview of where they are, what was the last update […] continues from that point."

**Change:** the defaults of `/ovd-go` and `/ovd-log` are restructured to model the GSD pause/resume cycle:

- **`/ovd-log` (default)** = lightweight save (analogous to `gsd-pause-work`): capture the active conversation, distill modifications/responses/alignment/criteria/discoveries, update OVERDRIVE.md state, update affected docs, write a per-session capture file. Not a full handoff; no milestone-close detection. Designed to be invoked right before a context clear.
- **`/ovd-log handoff`** = the previously-defined full end-of-session pipeline with milestone-close detection, commit, release prep.
- **`/ovd-go` (default)** = orient + continue (analogous to `gsd-resume-work`): read OVERDRIVE.md, the most recent session capture, and the active node; present orientation (where you are, last conversation summary, what was interrupted, directions to proceed); ask "continue, switch, or replan?"; then either continue or branch.
- Crucially, **leaves never auto-mark `done`**. After implementation + auto-verify, status becomes `awaiting-review`. Marking `done` requires explicit user approval (captured by `/ovd-log` or naturally during conversation: "looks good", "ship it", "next leaf", etc.). The iteration loop (implement → present → capture feedback → adjust → re-present) is the default cadence.

**Where addressed:** Section 6 (full restructure of `/ovd-go`), Section 7 (full restructure of `/ovd-log`), Section 10 (status enum gains `awaiting-review`), Section 8 (iteration loop mapped explicitly).

---

## 1. Frame & operating principles (revised)

`ovd-plan` adds a structural layer on top of Overdrive's existing skill execution layer. The 137 skills, skill-router, and global operating guide are not modified — they are the substrate. What `ovd-plan` provides is a **planning, execution, and record pipeline that produces self-contained leaf-level contracts**, so downstream execution happens autonomously without re-contextualizing the codebase, re-routing skills cold, or asking the user to manually update state.

### Operating principles

1. **The plan is a contract, not a checklist.** Every leaf carries enough specification — scope, skills, success criteria, dependencies, verification method — that an agent can execute it without re-reading the rest of the codebase. The thinking cost is paid once, at planning time.

2. **Four commands, many internal states.** Externally: `/ovd-workflow`, `/ovd-plan`, `/ovd-go`, `/ovd-log`. Internally each is a state machine with many states the user never sees.

3. **The agent matches the user where they are.** Free-form messages route to the right pipeline via intent detection; the user doesn't need to know the commands. The Socratic dialogue adapts to the user's level on three calibrated axes (domain / technical / scope) and never speaks above that level.

4. **The agent fills blind spots by adding nodes, not by asking.** During planning, the agent proactively inserts tasks the user didn't elicit but the project requires (security, accessibility, observability, error handling, etc.), each marked as agent-inserted for review.

5. **Execution is iterative by default.** Leaves don't auto-mark `done`. After implementation + verify, they become `awaiting-review`. The user's feedback (explicit or implicit) is what closes a leaf. The agent expects iteration and treats it as normal flow.

6. **Pipelines chain themselves.** When `/ovd-plan idea` approves a new direction, it internally triggers `EDIT` and queues `DOC UPDATE`. The user typed one command; the agent fulfilled the implications.

7. **The agent always recommends the next command at safe points.** "Leaf implementation done, awaiting your review." "Idea integrated. `/ovd-go` to start." "Context filling — recommend `/ovd-log` to save."

8. **State persistence is invisible work that never lives only in memory.** `/ovd-log` (default) is the lightweight save invoked before context clear; `/ovd-go` (default) is the resume that orients and continues. Equivalent to `gsd-pause-work` and `gsd-resume-work` paired.

9. **Skill-router is pre-resolved at planning time.** At execution, the router is a delta engine — annotations from the plan are the canonical starting set; the router only adds/overrides when reality contradicts the plan.

10. **No fixed hierarchy.** The tree is recursive. A node can be a project, milestone, phase, feature, task, subtask, anything. Labels are assigned in plain language during deliberation.

11. **Apple / Notion / Supabase analogy applies literally.** Same power as the alternative (GSD), ~10% of the user-side effort. The complexity isn't removed; it's absorbed by the agent.

---

## 2. User-facing surface (revised)

**Four commands.** Minimal flags. Default form of each command is the most-used path.

### `/ovd-workflow` (formerly passive; now active hub)

```
/ovd-workflow              # default: show tutorial + project status + setup state
/ovd-workflow init         # initialize project: codebase map + preferences + requirements
/ovd-workflow map          # refresh / re-run the codebase mapping
/ovd-workflow preferences  # review / edit user preferences
/ovd-workflow requirements # review / edit project requirements
```

This command **owns** the codebase analysis files, preferences, requirements, and decisions. It runs once at project initialization and is updated on demand or by the system when context drifts.

### `/ovd-plan`

```
/ovd-plan              # default: visual display of tree + entry to deliberate/edit/idea
/ovd-plan deliberate   # explicit Socratic dialogue mode
/ovd-plan research     # investigate a specific question (codebase ref, external docs, skill spike)
/ovd-plan create       # write a confirmed tree to OVERDRIVE.md
/ovd-plan edit         # structural modifications to existing tree
/ovd-plan idea "text"  # propose new direction; impact analysis; if approved → edit + DOC UPDATE
```

(`sketch` removed — see Section 0, Point 1.)

### `/ovd-go`

```
/ovd-go                       # default: orient + continue (gsd-resume-work analogue)
/ovd-go verify                # verify the active leaf or cluster (no implementation)
/ovd-go <node-ref>            # focus on a specific node (title fuzzy match or position path)
/ovd-go test <node-ref>       # implement or run tests for a specific node
/ovd-go --small               # surgical mode: no skill load, no remap, no re-read
/ovd-go --small "description" # surgical mode with inline description
```

### `/ovd-log`

```
/ovd-log                  # default: lightweight save (capture convo + update state + update docs)
/ovd-log handoff          # full end-of-session: summarize, update, docs, commit, milestone-close
/ovd-log capture "text"   # granular sequential activity log entry (timestamped)
/ovd-log concerns         # structured review on active node (security/perf/persistence/tolerance)
```

(`idea` removed — see Section 0, Point 2.)

---

## 3. Intent Detection Layer (new)

The intent detection layer sits in front of every command. It exists because users — especially less experienced ones — won't always reach for the right command. The system must align them to the model from wherever they are.

### 3.1 What it does

When the user submits a message without a leading `/ovd-*` command (or with a malformed command), the agent:

1. **Classifies the intent** into one of the routable internal states across all four commands.
2. **Confidence scores** the classification.
3. **High confidence (≥ 0.85)** → announces and executes: *"Reading this as `/ovd-plan idea`. Analyzing impact."*
4. **Medium confidence (0.5–0.85)** → presents 2-3 candidate routes ranked, asks the user to pick.
5. **Low confidence (< 0.5)** → asks a clarifying question matched to the user's calibrated level.

### 3.2 Classification dimensions

The classifier evaluates the message along four axes:

- **Verb intent** — is the user proposing, asking, instructing, reviewing, capturing, halting?
- **Object** — code, plan, tree, doc, concern, idea, sketch?
- **State context** — what's the current `deliberation_status`? Active node? Recent activity?
- **Calibration cue** — how technically-framed is the message? (Adjusts down-stream presentation.)

### 3.3 Routing matrix (illustrative, not exhaustive)

| User says | Likely route |
|---|---|
| "What about adding dark mode?" | `/ovd-plan idea "add dark mode"` |
| "Can we change the auth to Supabase?" | `/ovd-plan idea "switch auth to Supabase"` |
| "Make this button bigger" (mid-flow) | `/ovd-go --small "increase button size"` |
| "What's the current state?" | `/ovd-plan` (display) |
| "Looks good, next" | implicit approval → mark `awaiting-review` leaf as `done`, then `/ovd-go` |
| "Wait, I want X to be Y" | iteration feedback → captured into session log, leaf returns to `in-progress` |
| "Save and let me clear" | `/ovd-log` (default lightweight save) |
| "I'm done for today" | `/ovd-log handoff` |
| "How do I…" / "What does X do?" | `/ovd-workflow` (tutorial mode) |
| "Map the codebase" | `/ovd-workflow map` |
| "What could go wrong here?" | `/ovd-log concerns` |
| (long message describing a problem) | `/ovd-plan research` |

### 3.4 Fault tolerance

- The classifier never silently rewrites a `/ovd-*`-prefixed command — those are honored as typed.
- The classifier announces the route before executing, so the user can correct: *"That's not what I meant — I want X."*
- Repeated mis-classifications surface in the `LEARNINGS EXTRACT` step at milestone close, feeding planner heuristic adjustment.

### 3.5 Implementation note

The classifier is itself a small skill-routed task — it uses the agent's own reasoning plus the active node context. No separate model is added. The skill-router prior-set for this task is fixed (the classifier's own dictionary of patterns), so cost is bounded.

---

## 4. `/ovd-workflow` — initialization, codebase mapping, persistent context (new)

`/ovd-workflow` is the **hub** for project-spanning context: codebase maps, preferences, requirements, decisions, tutorials. It owns these files and serves them read-only to the other three commands.

### 4.1 Internal state machine

| State | Trigger | What it does |
|---|---|---|
| `STATUS` | bare `/ovd-workflow` | Show tutorial overview + setup state + last activity |
| `INIT` | `/ovd-workflow init` or implicit on first `/ovd-plan` in un-initialized project | Run codebase mapping + preferences elicitation + requirements draft |
| `CODEBASE MAP` | `/ovd-workflow map` or internal call from `INIT` | Multi-agent codebase analysis (architecture, patterns, tech-stack, quality, concerns) |
| `MAP REFRESH` | internal, on major detected drift | Incremental update to specific codebase files |
| `PREFERENCES ELICIT` | `/ovd-workflow preferences` or internal from `INIT` | Socratic capture of user preferences and vetoes |
| `REQUIREMENTS DRAFT` | `/ovd-workflow requirements` or internal from `INIT` | Capture functional + non-functional requirements |
| `TUTORIAL` | bare `/ovd-workflow` if no project setup detected | Walk the user through the four commands |
| `DECISIONS LOG` | internal, append-only on every approved decision elsewhere | Maintain `.overdrive/decisions.md` |

### 4.2 The `CODEBASE MAP` state — gsd-quality

This state matches `gsd-map-codebase` in rigor and exceeds it in maintenance discipline:

```
ENTRY: codebase directory
  ↓
Parallel dispatch (4 mapper agents, one per focus area):
  ├─ ARCHITECTURE mapper → .overdrive/codebase/architecture.md
  ├─ PATTERNS mapper     → .overdrive/codebase/patterns.md
  ├─ TECH-STACK mapper   → .overdrive/codebase/tech-stack.md
  ├─ QUALITY mapper      → .overdrive/codebase/quality.md
  └─ CONCERNS mapper     → .overdrive/codebase/concerns.md
  ↓
Synthesis: write index / cross-references
  ↓
Hash file tree snapshot for drift detection
  ↓
DONE
```

Each mapper:
- Reads the codebase scoped to its concern
- Produces a structured markdown document (consistent shape: overview, components, evidence, risks)
- Cites file paths and line numbers as evidence
- Stays within token budget (no all-files load)

### 4.3 Map maintenance (critical, per user point 7)

The map is not static. Updates happen at three triggers:

1. **`/ovd-workflow map` (explicit)** — full re-run.
2. **`/ovd-log handoff` at milestone close** — automatic incremental refresh of affected sections (architecture if module boundaries changed; patterns if new conventions introduced).
3. **`/ovd-go` on completion of leaves that touched architectural code** — targeted updates to just the relevant codebase file (architecture or tech-stack), not full re-run.

This ensures the map never drifts from reality without a refresh.

### 4.4 Outputs read by other commands

- `/ovd-plan` reads all five codebase files during deliberation (loaded into the planner's context, scoped to current planning focus).
- `/ovd-go` reads `architecture.md` and `patterns.md` at the start of each leaf (scoped to the leaf's `scope-in` paths).
- `/ovd-log handoff` reads all files when generating session summaries and updating docs.

### 4.5 Preferences and requirements

`PREFERENCES ELICIT` produces `.overdrive/preferences.md`:

- User-stated vetoes ("never use library X")
- Coding style preferences ("strict TypeScript")
- Workflow preferences ("squash commits", "tests before merge")
- Communication preferences ("concise explanations", "code-first")

`REQUIREMENTS DRAFT` produces `.overdrive/requirements.md`:

- Functional requirements (what the project must do)
- Non-functional requirements (performance, security, accessibility, scalability, observability targets)
- Out-of-scope explicit list

Both are referenced during `/ovd-plan deliberate` so the planner doesn't re-litigate.

### 4.6 Implicit init

If a user runs `/ovd-plan` (or any other command) before `/ovd-workflow init`, the agent:
1. Detects no `.overdrive/codebase/` directory or it's empty
2. Announces: *"This project hasn't been initialized. I'll run `/ovd-workflow init` first — codebase mapping takes ~2 minutes. Continue?"*
3. On yes → runs init → resumes the original command.

---

## 5. `/ovd-plan` — deep planning (revised)

### 5.1 Internal state machine

```
                          ┌───────────────────────────────┐
                          │  ENTRY: read OVERDRIVE.md     │
                          │  + cache + codebase files     │
                          │  + preferences + requirements │
                          └──────────────┬────────────────┘
                                         │
                          ┌──────────────▼────────────────┐
                          │  ASSESS: tree state           │
                          │  + user input / intent        │
                          │  + deliberation_status        │
                          └──────────────┬────────────────┘
                                         │
              ┌──────────┬──────────┬────┴─────┬──────────┬──────────┐
              │          │          │          │          │          │
        ┌─────▼──┐ ┌────▼────┐ ┌──▼────┐ ┌──▼───┐ ┌────▼────┐ ┌────▼────┐
        │DISPLAY │ │ DELIB.  │ │RESEARCH│ │ IDEA │ │ EDIT    │ │ CREATE  │
        └────────┘ └─────────┘ └────────┘ └──┬───┘ └─────────┘ └─────────┘
                                            │
                                  ┌─────────▼──────────┐
                                  │ ANALYZE IMPACT     │
                                  │ → propose change   │
                                  │ → small or large?  │
                                  └─────┬──────────────┘
                                        │
                          ┌─────────────┼─────────────┐
                          │ small       │ large       │
                  ┌───────▼───┐   ┌─────▼─────┐ ┌────▼────┐
                  │ EDIT      │   │ RESEARCH  │ │ DEFER   │
                  │ + DOC UPD │   │ deeper    │ │ inbox   │
                  └───────────┘   └───────────┘ └─────────┘
```

### 5.2 All internal states

| State | Trigger | What it does |
|---|---|---|
| `DISPLAY` | bare `/ovd-plan`, tree exists | Render tree visually with status, active position, health, agent-recommended next |
| `DELIBERATE` | `/ovd-plan deliberate` or internal from `IDEA` | Socratic dialogue, matched to calibration |
| `RESEARCH` | `/ovd-plan research` or internal from `IDEA` | Investigate codebase ref, external docs (Context7), or skill spike |
| `CREATE` | confirmed tree from `DELIBERATE` | Write tree to `OVERDRIVE.md`, annotate skills + success criteria |
| `EDIT` | `/ovd-plan edit` or internal call | Structural mods to existing tree |
| `IDEA` | `/ovd-plan idea "text"` or detected intent | Analyze impact, route to small EDIT or larger RESEARCH path |
| `SKETCH` | internal from `IDEA` when sketching needed | Produce throwaway HTML mockup in `.overdrive/sketches/`, present to user |
| `IMPORT` | internal when user feeds doc | Ingest, extract plan items, merge into tree |
| `MVP SCOPE` | internal trigger "scope to MVP" | Apply SPIDR-style splitting |
| `REFINE` | internal, agent detects fat node | Split into children |
| `REORDER` | internal | Change traversal order |
| `CLEANUP` | internal trigger | Archive completed branches, prune stale |
| `BLIND-SPOT EXPANSION` | internal, every `CREATE` and major `EDIT` | Add agent-proposed nodes for typically-missed categories |
| `VERIFICATION-CRITERIA WRITE` | internal at end of `CREATE` | Generate per-leaf success_criteria |
| `PLAN-QUALITY CHECK` | internal at end of `CREATE` | Goal-backward verification of tree completeness |

### 5.3 Socratic protocol (upgraded — GSD-quality + blind-spot expansion)

The protocol now mirrors GSD's `discuss → spec → plan → verify` rigor internally, while keeping output in plain language.

**Stage 1: Open assessment.**
- Read user's opening message + `.overdrive/preferences.md` + `.overdrive/requirements.md` + codebase files.
- Calibrate user on three axes (domain, technical, scope). Calibration is persisted to `deliberation-state` and re-used across sessions.
- Match language to lowest axis.

**Stage 2: Elicit (mirrors `gsd-discuss-phase`).**
- One high-leverage question per turn.
- Tradeoffs surfaced proactively: "X gets you Y but loses Z. Which matters more?"
- Rephrase user answers when stakes are high.
- Internal: agent maintains a structured "what's known / what's uncertain / what's load-bearing for the contract" matrix.

**Stage 3: Blind-spot expansion (new, per user point 6).**
The agent runs a checklist of categories that non-exhaustive users miss. For each category that applies to the project, the agent inserts a proposed node (or sub-tree) labeled `[proposed-by-agent: reason]`. Categories:

- **Security:** auth, authz, input validation, secrets management, CSRF, XSS, rate limiting
- **Performance:** load testing, caching strategy, query optimization, bundle size, perceived perf
- **Accessibility:** WCAG compliance, keyboard nav, screen reader, contrast
- **Observability:** logging, tracing, metrics, alerting, error reporting
- **Error handling:** failure modes, retry policy, fallback states, user-facing error messages
- **Data:** migrations, fixtures, seed data, backup strategy, schema evolution
- **Testing:** unit, integration, e2e, regression, contract tests
- **Operations:** deployment, rollback, env config, feature flags, monitoring
- **Documentation:** README, API docs, runbook, onboarding doc
- **User-facing:** empty states, loading states, error states, onboarding flow, edge cases
- **Compliance:** licensing, GDPR/privacy, audit logging (if applicable)

Each inserted node is one-line-justified, user reviews, can prune. This is the lever that prevents "mid-task realisation that we also need X" — the user sees X in the tree before execution starts.

**Stage 4: Spec phase (mirrors `gsd-spec-phase`).**
- Ambiguity scoring per node — does this node's description leave room for two valid interpretations?
- Ambiguous nodes get a follow-up question or a Sec 5.3 stopping-rule reconsideration.

**Stage 5: Plan phase (mirrors `gsd-plan-phase`).**
- Skill annotation per node (high-confidence prior set for skill-router).
- Success criteria per leaf — non-negotiable.
- Scope per leaf — `scope-in` paths, `scope-out` paths, `read-only` paths.
- Dependency mapping — explicit `deps:` references between nodes.
- Verification method per leaf (playwright, security-review, react-doctor, agent-self-check, etc.).

**Stage 6: Verify phase (mirrors `gsd-plan-checker`).**
- Goal-backward check: does the proposed tree actually deliver the user's stated goal? Each requirement traces to at least one leaf.
- Coverage check: every functional requirement has a leaf; every non-functional has at least one annotated leaf or a cross-cutting cluster.
- Quality gate: every leaf passes the "could a competent agent execute this from the leaf spec alone?" rule.

**Stage 7: Present + iterate.**
- Render tree to user in plain language.
- User reviews, suggests, prunes. Agent applies, re-renders. Loop until approval.

**Stage 8: Commit.**
- Write tree to `OVERDRIVE.md` with all annotations.
- Set `deliberation_status: ready`.
- Recommend: "Plan complete. `/ovd-go` when ready."

### 5.4 Sketch sub-state (folded into IDEA, per user point 1)

When `/ovd-plan idea "sketch X"` is detected or the user explicitly requests a mockup, the agent enters `SKETCH`:

1. Produce throwaway HTML mockup in `.overdrive/sketches/YYYY-MM-DD-HH-MM-slug.html`.
2. Present mockup (file path + summary) to user.
3. User reviews:
   - **Approved + integrate:** `EDIT` adds a leaf for the design, `DOC UPDATE` if needed.
   - **Approved + keep as reference:** moves to `.overdrive/sketches/approved/`, attached as reference to a future leaf.
   - **Rejected:** stays in `.overdrive/sketches/` for the session; cleaned at next handoff if not promoted.

No commitment by default. The sketch is a side-product, not a pipeline.

### 5.5 Feature-addition pipeline (new, per user point 3)

The full surgical-to-major flow:

```
/ovd-plan idea "add X"
  ↓
IDEA: ANALYZE IMPACT
  ↓
small + low-risk? ── yes ──→ EDIT → DOC UPDATE → recommend /ovd-go
  │
  no
  ↓
needs research? ── yes ──→ recommend /ovd-plan research
  │
  no (large but understood)
  ↓
DELIBERATE briefly → EDIT → DOC UPDATE → recommend /ovd-go

(if research path:)
/ovd-plan research
  ↓
RESEARCH: findings written to inbox or research log
  ↓
session ending? ── yes ──→ recommend /ovd-log handoff
  │                       (then in next session:)
  │                       /ovd-plan edit → integrate findings
  no
  ↓
/ovd-plan edit → integrate findings → DOC UPDATE → recommend /ovd-go
```

This works for any size of addition. Surgical (1-2 nodes), medium (small subtree), or large (new milestone). The agent picks the depth based on impact analysis; the user types one to three commands depending on session pacing.

### 5.6 Verification criteria specification (per leaf)

At `Stage 5 → Plan phase`, every leaf gets:

- `success_criteria: [list of strings]` — externally verifiable conditions
- `verification.method: <method-name>` — primary auto-verify mechanism
- `verification.fallback: agent_self_check_against_success_criteria` — used when method unavailable
- `verification.review_required: true|false` — explicitly false only for trivially-objective leaves (tests pass, compile success)

`review_required: true` is the default. This connects to Section 6's `awaiting-review` status: most leaves require explicit user approval after auto-verify before they're `done`.

### 5.7 Plan-to-execute transition

`deliberation_status` values:
- `not-initialized` — `/ovd-workflow init` hasn't run
- `in-deliberation` — Socratic dialogue ongoing
- `ready` — tree complete, contracts written
- `executing` — at least one leaf in-progress or done
- `awaiting-review` — at least one leaf is `awaiting-review`, blocking advancement
- `paused` — session ended with `/ovd-log handoff` or `/ovd-log` (default)

Transitions (selected):
- `in-deliberation → ready` — user approves tree in `CREATE`
- `ready → executing` — first `/ovd-go`
- `executing ↔ awaiting-review` — leaf-by-leaf as user approves or iterates
- `executing → in-deliberation` — `/ovd-plan idea` or `/ovd-plan edit` mid-flight (scoped to affected subtree)
- `* → paused` — `/ovd-log` (default) or `/ovd-log handoff`
- `paused → executing` — `/ovd-go`

---

## 6. `/ovd-go` — orient & continue (restructured per user point 9)

### 6.1 The new default behavior

**`/ovd-go` (bare)** is now the **resume entry point**, modeled on `gsd-resume-work`. It does NOT immediately execute. It:

1. Reads `OVERDRIVE.md`, the most recent `.overdrive/sessions/*.md` capture file, and the most recent `.overdrive/handoffs/*.md` if applicable.
2. Reads the codebase files for the active node's scope.
3. **Presents orientation** to the user:
   - Project name + current milestone
   - Active node + its scope-in/scope-out
   - Status of the active node (pending / in-progress / awaiting-review)
   - Last session summary (one paragraph from the last capture)
   - If last command was `/ovd-log`: shows the captured conversation summary
   - Any leaves in `awaiting-review` that require triage
   - Directions: continue active leaf, switch to another, replan, or review awaiting-review leaves
4. **Asks** the user how to proceed.
5. Based on response, branches to one of the execution states.

The user can shortcut step 4 by appending intent: `/ovd-go continue`, `/ovd-go review`, `/ovd-go <node-ref>`.

### 6.2 Internal state machine

```
                       ┌───────────────────────────────┐
                       │  ENTRY: read state files      │
                       └──────────────┬────────────────┘
                                      │
                       ┌──────────────▼────────────────┐
                       │  ORIENT: present overview     │
                       │  + last update + directions   │
                       └──────────────┬────────────────┘
                                      │
                       ┌──────────────▼────────────────┐
                       │  ROUTE: based on user response│
                       │  / flag / awaiting-review     │
                       └──────────────┬────────────────┘
                                      │
        ┌──────────────┬──────────────┼──────────────┬──────────────┐
        │              │              │              │              │
   ┌────▼────┐   ┌────▼────┐    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
   │ REVIEW  │   │ LEAF    │    │ LEAF    │    │ CLUSTER │    │ SMALL   │
   │ TRIAGE  │   │ EXECUTE │    │ VERIFY  │    │ VERIFY  │    │ EXECUTE │
   └────┬────┘   └────┬────┘    └────┬────┘    └────┬────┘    └─────────┘
        │             │              │              │
        │        ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
        │        │ DECISION│    │ AWAIT.- │    │ MILE-   │
        │        │  POINT  │    │ REVIEW  │    │ STONE   │
        │        └─────────┘    │ STATE   │    │ BOUNDARY│
        │                       └────┬────┘    └─────────┘
        │                            │
        │              ┌─────────────▼──────────────┐
        │              │ ITERATION LOOP             │
        │              │ (user feedback captured    │
        │              │  via /ovd-log → back to    │
        │              │  LEAF EXECUTE OR DONE)     │
        │              └────────────────────────────┘
        │
   ┌────▼─────┐
   │ Approve  │
   │ or       │
   │ Iterate  │
   └──────────┘
```

### 6.3 All internal states

| State | Trigger | What it does |
|---|---|---|
| `ORIENT` | bare `/ovd-go` | Present overview, last update, directions; await user response |
| `REVIEW TRIAGE` | `awaiting-review` leaves exist on entry | Walk user through them; capture approve / iterate per leaf |
| `LEAF EXECUTE` | active leaf has no implementation, user confirms continue | Pre-load annotated skills, execute task, write to disk |
| `LEAF VERIFY` | after `LEAF EXECUTE` or `verify` flag | Auto-verify against success_criteria |
| `AWAITING REVIEW STATE` | after `LEAF VERIFY` pass | Mark leaf `awaiting-review`; present diff + verification result; await user feedback |
| `CLUSTER VERIFY` | last leaf in cluster approved | Run cluster-level verification |
| `MILESTONE BOUNDARY` | all leaves in milestone `done` | Recommend `/ovd-log handoff` |
| `TEST IMPLEMENT` | leaf has impl, no tests, route requested | Write tests for the leaf |
| `TEST RUN` | leaf has impl + tests | Execute tests |
| `SMALL EXECUTE` | `--small` flag | Surgical edit, no skill load, no remap |
| `DECISION POINT` | genuine ambiguity | Pause, surface, await user direction |
| `BLOCKED` | can't proceed | Mark blocked, recommend `/ovd-plan` or skip |
| `FIX` | verification failed | Re-attempt with proposed fix; escalate after threshold |
| `SKILL DELTA` | annotated skills insufficient | Runtime router adds skills; delta recorded for `LEARNINGS EXTRACT` |
| `CONTEXT GATHER` | agent needs leaf-scoped file reads | Minimal reads per `scope-in` |
| `ITERATION LOOP` | user provides feedback after `AWAITING REVIEW` | Capture feedback, return to `LEAF EXECUTE` with deltas |

### 6.4 The `AWAITING REVIEW` state and iteration loop

This is the operational heart of point 9.

```
LEAF EXECUTE completes
  ↓
LEAF VERIFY (auto)
  ↓
pass?
  no → FIX (loop) → if still failing → escalate to user
  yes
  ↓
status = awaiting-review
  ↓
present to user:
  - what changed (files + summary of edits)
  - verification result (test output, screenshot, etc.)
  - one-line: "Anything to adjust, or should I mark this done?"
  ↓
user responds (or runs /ovd-log capture, or runs /ovd-go again)
  ├─ Approval signal ("looks good", "ship", "next", "done", or silently runs /ovd-go on the next leaf):
  │     status = done → advance
  ├─ Iteration signal ("change X", "smaller", "but also Y"):
  │     status = in-progress, capture feedback to session log, re-enter LEAF EXECUTE with deltas
  └─ Defer signal ("come back to this", "blocked on Z"):
        status = blocked or awaiting-review (kept), agent moves on if user directs
```

The leaf never auto-promotes to `done` without an approval signal. This is the explicit ratchet for "process is never that linear."

### 6.5 `verify` flag

`/ovd-go verify` runs `LEAF VERIFY` or `CLUSTER VERIFY` without going through `LEAF EXECUTE`. Useful for re-verifying after manual edits or after iteration adjustments.

### 6.6 Task targeting

`/ovd-go <node-ref>` jumps to a specific node and routes from there.
`/ovd-go test <node-ref>` jumps and routes to `TEST IMPLEMENT` / `TEST RUN`.

Node-ref accepts position path (`2.2.1`) or fuzzy title match (`"widget layout"`). Ambiguous matches → numbered disambiguation prompt.

### 6.7 `--small` mode

Unchanged from prior spec: bypasses skill load, remap, doc re-read; keeps targeted file read + edit + parse-check + status update. Guardrail: if change touches >2-3 files or a shared contract, surface and ask before proceeding.

### 6.8 Verification protocol

Per leaf, verification reads `success_criteria` and runs the verification method:

| Leaf type (inferred from skills) | Auto-verification |
|---|---|
| UI / frontend | `playwright-cli` screenshot + visual regression |
| Backend / API | API response shape check |
| Security-annotated | `security-review` scan |
| React | `react-doctor` lint |
| Modern web | accessibility + browser compatibility |
| SEO / launch | `jack-seo-launch-audit` |
| Tests-only leaf | test suite pass |
| Fallback | agent self-check against success_criteria text |

Auto-verification PASS → `awaiting-review` (not `done`). User approval closes it.

---

## 7. `/ovd-log` — lightweight save & capture (restructured per user point 9)

### 7.1 The new default behavior

**`/ovd-log` (bare)** is now the **lightweight save**, modeled on `gsd-pause-work`. It does NOT do a full handoff. It:

1. **Captures the active conversation** since the last save — modifications discussed, user responses, new alignment, new criteria, new discoveries.
2. **Distills** the capture into a structured session entry.
3. **Updates `OVERDRIVE.md` state** — current `active_node`, status changes, decisions made (logged to `.overdrive/decisions.md`), inbox additions.
4. **Updates affected docs** — `doc-coauthoring` skill applied surgically to the sections that changed.
5. **Writes the per-session file:** `.overdrive/sessions/YYYY-MM-DD-HH-MM.md`.
6. **Does NOT commit** by default. Does NOT detect milestone close. Does NOT run release prep.
7. Prints: *"Saved. State updated. Run `/ovd-go` to continue or clear context safely."*

This is the command the user runs right before clearing context. The next session's `/ovd-go` will read the session file and orient.

### 7.2 Flags

- `/ovd-log handoff` — full end-of-session pipeline (the previously-defined behavior with milestone-close detection, commit, release prep, archive).
- `/ovd-log capture "text"` — granular timestamped log entry, appended to the current session file. Zero analysis, zero interruption.
- `/ovd-log concerns` — structured review on active node across dimensions (security, performance, persistence, fault tolerance, accessibility, observability, scalability). Findings attached to node; actionable findings recommend `/ovd-plan idea` for remediation.

(`idea` removed per user point 2.)

### 7.3 Internal state machine

```
                       ┌───────────────────────────────┐
                       │  ENTRY: read state            │
                       └──────────────┬────────────────┘
                                      │
                       ┌──────────────▼────────────────┐
                       │  ROUTE: based on flag         │
                       └──────────────┬────────────────┘
                                      │
        ┌─────────┬─────────┬─────────┼─────────┬─────────┐
        │         │         │         │         │         │
   ┌────▼────┐ ┌─▼──┐ ┌────▼────┐ ┌─▼──────┐ ┌─▼─────┐ ┌─▼─────┐
   │ DEFAULT │ │CAPT│ │ CONCERNS│ │HANDOFF │ │ STATE │ │ DOC   │
   │ (save)  │ │URE │ │ REVIEW  │ │        │ │ UPDATE│ │ UPDATE│
   └────┬────┘ └────┘ └────┬────┘ └────┬───┘ └───────┘ └───────┘
        │                  │           │
   ┌────▼────┐        ┌────▼────┐  ┌──▼──────────┐
   │CONVO    │        │ ATTACH  │  │ MILESTONE   │
   │CAPTURE  │        │ TO NODE │  │ CLOSE?      │
   │+ STATE  │        └─────────┘  └──┬──────────┘
   │+ DOCS   │                        │
   │+ SESSION│                  ┌─────▼─────┐
   │ FILE    │                  │ LEARNINGS │
   └─────────┘                  │ RELEASE   │
                                │ ARCHIVE   │
                                │ COMMIT    │
                                └───────────┘
```

### 7.4 All internal states

| State | Trigger | What it does |
|---|---|---|
| `DEFAULT (lightweight save)` | bare `/ovd-log` | Convo capture + state update + doc update + session file write |
| `CAPTURE` | `/ovd-log capture "text"` | Timestamped activity log entry |
| `CONCERNS REVIEW` | `/ovd-log concerns` | Structured review of active node; attach concerns; recommend remediation |
| `HANDOFF` | `/ovd-log handoff` | Full pipeline (see 7.5) |
| `CONVO CAPTURE` | internal at default | Distill the active conversation since last save |
| `STATE UPDATE` | internal | Mark statuses, update active_node, log decisions |
| `DOC UPDATE` | internal | Surgical doc propagation via `doc-coauthoring` |
| `DECISION RECORD` | internal | Append to `.overdrive/decisions.md` |
| `SESSION FILE WRITE` | internal at default | Write `.overdrive/sessions/YYYY-MM-DD-HH-MM.md` |
| `HANDOFF FILE WRITE` | internal at handoff | Write `.overdrive/handoffs/YYYY-MM-DD-HH-MM.md` |
| `MILESTONE CLOSE` | internal at handoff if milestone done | Trigger learnings/release/archive |
| `LEARNINGS EXTRACT` | internal at milestone close | What worked, friction, skill accuracy |
| `RELEASE PREP` | internal at milestone close, release milestone | `pre-launch-checklist`, `jack-seo-launch-audit` |
| `ARCHIVE` | internal post learnings | Move completed milestone subtree |
| `COMMIT` | internal at handoff if git | `git commit` |
| `INBOX VIEW` | internal, can be called from intent detection | Show inbox |
| `INBOX PROMOTE` | internal | Promote item to tree (also reachable from `/ovd-plan`) |

### 7.5 The handoff pipeline (unchanged in structure, refined in detail)

```
1. SUMMARISE SESSION
   - Leaves moved to 'done' (only those explicitly approved)
   - Leaves still 'awaiting-review' (flagged for next session)
   - Decisions made
   - Plan adjustments
   - New nodes added
   - Concerns recorded
   - Captured activity highlights

2. STATE UPDATE
   (as in 7.4)

3. IDENTIFY FOLLOW-UPS
   - Awaiting-review leaves
   - Leaves needing testing
   - Leaves needing verification (if skipped)
   - Deferred plan edits
   - Open questions
   - Concerns marked for follow-up

4. DOC UPDATE
   (as in 7.4)

5. WRITE HANDOFF FILE
   Location: .overdrive/handoffs/YYYY-MM-DD-HH-MM.md
   Contents:
     - Completed leaves (truly done)
     - Awaiting-review leaves with last presented diff
     - Current position
     - Decisions made
     - Follow-ups with priority
     - Suggested resume prompt

6. MILESTONE CLOSE DETECT
   - All leaves in current milestone fully 'done' (not awaiting-review)?
     yes → 7, 8, 9
     no  → 10

7. LEARNINGS EXTRACT
   - What worked, what didn't
   - Skill annotation accuracy (planner vs runtime)
   - Iteration count per leaf (signal for planner improvement)

8. RELEASE PREP (if release milestone)
   - Invoke pre-launch-checklist
   - Invoke jack-seo-launch-audit if applicable

9. ARCHIVE
   - Move completed milestone subtree to archive
   - Create milestone summary in .overdrive/reports/

10. COMMIT (if git)

11. PRINT RESUME SUMMARY
```

### 7.6 What the `DEFAULT` capture distills from the conversation

This is the operational equivalent of `gsd-pause-work`. The lightweight save extracts:

- **Modifications** the user requested or the agent applied since last save
- **User responses / feedback** ("not that, smaller", "yes but also X")
- **New alignment** ("we're going with Supabase after all")
- **New criteria** ("the page must load in < 200ms")
- **New discoveries** ("the existing routing layer doesn't handle this case")
- **Decisions reached** (recorded to decisions.md)
- **Open threads** (questions raised, not resolved)
- **What was interrupted** (active leaf state, what was mid-edit)

The session file is structured so `/ovd-go` next time can show it as orientation.

---

## 8. Cross-pipeline flows (updated)

### 8.1 The complete pause-resume loop (analogue of gsd-pause-work + gsd-resume-work)

```
ACTIVE SESSION
  ↓
[user and agent work iteratively on leaf 2.2.1]
[multiple awaiting-review cycles, user gives feedback, agent adjusts]
  ↓
context filling, user wants to pause
  ↓
/ovd-log                                [user]
  ↓
CONVO CAPTURE + STATE UPDATE + DOC UPDATE + SESSION FILE [agent]
  ↓
"Saved. Run /ovd-go to continue or clear context safely."
  ↓
[user clears context]

NEW SESSION
  ↓
/ovd-go                                 [user]
  ↓
ORIENT:                                 [agent]
  - Project: Foo
  - Milestone: 2. Dashboard
  - Active leaf: 2.2.1 Widget layout design (awaiting-review)
  - Last session captured:
    - You asked for the title font to be smaller
    - I adjusted to 18px
    - You wanted more contrast on the secondary text
    - Adjustment pending
  - 1 leaf awaiting review (2.2.1)
  - Directions:
    1. Continue iterating on 2.2.1 (recommended)
    2. Approve 2.2.1 as-is
    3. Switch to a different leaf
    4. Replan
  ↓
[user says: "continue, but also lighten the background"]
  ↓
ROUTE: ITERATION LOOP on 2.2.1
  ↓
LEAF EXECUTE with deltas → LEAF VERIFY → AWAITING REVIEW STATE
  ↓
[loop continues]
```

### 8.2 Agent recommendation matrix

When the agent recommends the next command:

| Situation | Recommendation |
|---|---|
| Project uninitialized | `/ovd-workflow init` |
| Tree doesn't exist | `/ovd-plan` (will route to NEW PROJECT via init dependency) |
| `deliberation_status: in-deliberation` | `/ovd-plan deliberate` to continue |
| `deliberation_status: ready` | `/ovd-go` to start execution |
| Leaf implementation complete, awaiting review | (no command — user gives feedback inline) |
| Leaf cluster done | `/ovd-go` to continue or `/ovd-log` to save |
| Milestone done | `/ovd-log handoff` to ship |
| Context filling | `/ovd-log` to save before clear |
| User describes a new feature mid-flow | `/ovd-plan idea "..."` |
| User raises a concern | `/ovd-log concerns` or `/ovd-plan idea "address X concern"` |
| User asks "how does this work?" | `/ovd-workflow` (tutorial mode) |
| Verification failed repeatedly | `/ovd-plan edit` to rescope, or `/ovd-plan idea` to redirect |

### 8.3 Internal command chaining

| User typed | Internal chain |
|---|---|
| `/ovd-plan idea "X"` (approved, small) | → `EDIT` → `DOC UPDATE` |
| `/ovd-plan idea "X"` (approved, needs research) | → recommend `/ovd-plan research` |
| `/ovd-plan idea "X"` (approved, needs deep deliberation) | → `DELIBERATE` (focused subtree) → `EDIT` |
| `/ovd-plan research` (findings actionable) | → recommend `/ovd-plan edit` or `/ovd-log handoff` if context full |
| `/ovd-go` (active leaf) | → `LEAF EXECUTE` → `LEAF VERIFY` → `AWAITING REVIEW STATE` |
| `/ovd-go` (awaiting-review leaves exist) | → `REVIEW TRIAGE` first |
| `/ovd-go` (cluster complete with approvals) | → `CLUSTER VERIFY` → `STATE UPDATE` |
| `/ovd-go` (milestone done) | → `MILESTONE BOUNDARY` → recommend `/ovd-log handoff` |
| `/ovd-log` (default) | → `CONVO CAPTURE` + `STATE UPDATE` + `DOC UPDATE` + `SESSION FILE WRITE` |
| `/ovd-log handoff` (milestone close detected) | → `LEARNINGS EXTRACT` → `RELEASE PREP` → `ARCHIVE` → `COMMIT` |
| `/ovd-log concerns` (actionable findings) | → recommend `/ovd-plan idea` for remediation |
| Free-form message | Intent Detection → routes to above as if typed |

### 8.4 The iteration loop as first-class flow

```
LEAF EXECUTE
  ↓
LEAF VERIFY (auto)
  ↓
PASS → AWAITING REVIEW STATE
  ↓
present diff + result to user
  ↓
USER FEEDBACK CAPTURED (via natural conversation; /ovd-log captures it on save)
  ↓
classify feedback:
  ├─ APPROVAL → status = done → advance
  ├─ ITERATION → status = in-progress, deltas applied, re-enter LEAF EXECUTE
  └─ DEFER → status = awaiting-review (held), advance to other work
```

Iteration is the default. The agent expects feedback. A leaf going from `awaiting-review` to `done` in one cycle is the exception, not the rule, for any leaf that touches UX or design judgment.

---

## 9. File & folder structure (new comprehensive layout)

```
project-root/
├── OVERDRIVE.md                              # plan tree (primary user-facing view)
└── .overdrive/
    ├── codebase/
    │   ├── architecture.md                   # system structure, module boundaries
    │   ├── patterns.md                       # recurring patterns, idioms, conventions
    │   ├── tech-stack.md                     # frameworks, libraries, build chain
    │   ├── quality.md                        # test coverage, type discipline, lint
    │   └── concerns.md                       # pre-existing risks: security, perf, debt
    ├── requirements.md                       # functional + non-functional + out-of-scope
    ├── preferences.md                        # user / team preferences and vetoes
    ├── decisions.md                          # append-only decision log
    ├── handoffs/
    │   └── YYYY-MM-DD-HH-MM.md              # per-handoff snapshot
    ├── sessions/
    │   └── YYYY-MM-DD-HH-MM.md              # per-session capture (default /ovd-log output)
    ├── sketches/
    │   ├── YYYY-MM-DD-HH-MM-slug.html       # throwaway mockups
    │   └── approved/                         # promoted sketches
    ├── reports/
    │   └── milestone-N-summary.md           # per-milestone summary at close
    └── plan.cache.json                       # internal cache (gitignored)
```

### 9.1 Git ignore policy

Committed to git:
- `OVERDRIVE.md`
- `.overdrive/codebase/*`
- `.overdrive/requirements.md`
- `.overdrive/preferences.md`
- `.overdrive/decisions.md`
- `.overdrive/handoffs/*`
- `.overdrive/reports/*`
- `.overdrive/sketches/approved/*`

Gitignored:
- `.overdrive/sessions/*` (ephemeral, per-context-clear)
- `.overdrive/sketches/*` except `approved/` (throwaway)
- `.overdrive/plan.cache.json` (regenerable)

### 9.2 OVERDRIVE.md format (refined for plan-tree primary role)

`OVERDRIVE.md` no longer carries codebase analysis, requirements, or preferences — those live in their own files. It carries:

- Frontmatter (project metadata)
- The plan tree (with skill annotations, success criteria, scope per leaf)
- Inbox managed section
- Capture managed section (lightweight, sweeped to session files at handoff)
- Concerns managed section
- Deliberation-state managed section
- Archive managed section

Example (truncated):

```markdown
---
ovd-plan: true
version: 2
project: "Foo Dashboard"
description: "Stats dashboard for internal ops."
created: 2026-06-08
updated: 2026-06-08T14:30:00Z
deliberation_status: executing
active_node: "2.2.1"
current_milestone: "2. Dashboard"
session_count: 4
context_files:
  codebase: .overdrive/codebase/
  requirements: .overdrive/requirements.md
  preferences: .overdrive/preferences.md
  decisions: .overdrive/decisions.md
---

# Foo Dashboard

## 1. Foundation [done]
> skills: planning-first, modern-web-guidance

### 1.1 Project scaffolding [done]
### 1.2 Database schema [done]
### 1.3 Auth middleware [done] [proposed-by-agent: required for protected routes]

## 2. Dashboard [in-progress]
> skills: design-taste-frontend, impeccable, react-doctor, playwright-cli
> cluster-verify: All widgets coexist without visual conflict; load < 200ms

### 2.1 Navigation [done]

### 2.2 Stats widgets [in-progress]

#### 2.2.1 Widget layout design [awaiting-review] ← ACTIVE
> Design grid layout + visual hierarchy. Three sizes, responsive 768/1024px.
> skills: design-taste-frontend, impeccable
> scope-in: src/components/Dashboard/, src/styles/grid.css
> scope-out: data fetching, animations
> success:
>  - Grid renders at 768/1024/1440px without overflow
>  - Visual hierarchy matches reference
>  - Three sizes implemented as composable components
> verify: playwright_visual_regression
> review-required: true
> deps: 2.1

#### 2.2.2 Data fetching layer []
...

### 2.3 Accessibility pass [] [proposed-by-agent: WCAG AA required for internal tooling]
> skills: modern-web-guidance, react-doctor
> success:
>  - Keyboard nav works through all widgets
>  - Screen reader announces widget changes
>  - Contrast ratios meet AA
> verify: agent_self_check_against_success_criteria
> review-required: true

## 3. Launch prep []
...

<!-- ovd-plan:inbox:start -->
- [ ] 2026-06-08 — Consider dark mode for v2
<!-- ovd-plan:inbox:end -->

<!-- ovd-plan:capture:start -->
2026-06-08T14:14 — starting 2.2.1, reading existing grid in Card.tsx
<!-- ovd-plan:capture:end -->

<!-- ovd-plan:concerns:start -->
| Node | Dim | Note | Status |
|---|---|---|---|
| 2.2.1 | perf | Re-render on resize | open |
<!-- ovd-plan:concerns:end -->

<!-- ovd-plan:deliberation-state:start -->
status: complete
last_session: 2026-06-08T14:30:00Z
turn_count: 7
open_questions: []
answered:
  - Target browser? → Modern only
  - Auth? → Supabase
user_calibration:
  domain: medium
  technical: low
  scope: high
<!-- ovd-plan:deliberation-state:end -->

<!-- ovd-plan:archive:start -->
(completed milestones move here)
<!-- ovd-plan:archive:end -->
```

---

## 10. Node schema (updated)

### 10.1 Required fields per leaf

```json
{
  "id": "2.2.1",
  "title": "Widget layout design",
  "description": "Design the grid layout and visual hierarchy for the stats dashboard. Three widget sizes (small/medium/large), responsive at 768px and 1024px breakpoints.",
  "status": "pending | in-progress | awaiting-review | done | blocked | skipped",
  "inserted_by": "user | agent",
  "skills": ["design-taste-frontend", "impeccable"],
  "success_criteria": [
    "Grid renders at 768/1024/1440px without overflow",
    "Visual hierarchy matches the reference",
    "Three widget sizes implemented as composable components"
  ],
  "scope": {
    "files_touched": ["src/components/Dashboard/", "src/styles/grid.css"],
    "files_read_only": ["src/components/Card.tsx"],
    "out_of_scope": ["Widget data fetching", "Widget animations"]
  },
  "dependencies": ["2.1"],
  "verification": {
    "method": "playwright_visual_regression",
    "fallback": "agent_self_check_against_success_criteria",
    "review_required": true
  }
}
```

### 10.2 New status: `awaiting-review`

Sits between `in-progress` and `done`. Set automatically after `LEAF VERIFY` passes. Only the user transitions it to `done` (explicit approval) or back to `in-progress` (iteration request).

### 10.3 New field: `inserted_by`

Records whether a node was elicited from the user (`user`) or proposed by the agent during blind-spot expansion (`agent`). Lets the user filter/prune agent-proposed nodes during review. Recorded in `OVERDRIVE.md` as `[proposed-by-agent: <reason>]` tag.

### 10.4 New field: `verification.review_required`

Default: `true`. Only `false` for trivially-objective leaves (test suites, compile checks, format passes). When `false`, verify-pass auto-promotes to `done` without user approval.

### 10.5 Iteration history (optional)

```json
{
  "iterations": [
    { "session": "2026-06-08T14:30:00Z", "feedback": "title font too large", "delta_applied": "reduced to 18px" },
    { "session": "2026-06-08T15:10:00Z", "feedback": "need more contrast", "delta_applied": "pending" }
  ]
}
```

This makes the iteration loop reconstructable across sessions and feeds `LEARNINGS EXTRACT`.

### 10.6 Required fields per container (non-leaf) — unchanged from prior

```json
{
  "id": "2.2",
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

---

## 11. Skill-router prior-set extension (unchanged in spirit, refined)

### 11.1 Prior-set API

```
skill-router.route({
  task: <task description>,
  prior_set: ["design-taste-frontend", "impeccable", "react-doctor"],
  prior_confidence: "high" | "medium" | "low",
  context: <minimal scoped context>
})
```

- `prior_confidence: high` (ovd-plan default) — router treats `prior_set` as canonical, only adds on explicit task triggers, removes nothing.
- `prior_confidence: medium` — re-evaluates priors, may add 1-2 more.
- `prior_confidence: low` — full cold evaluation, prior_set shown as suggestion.

### 11.2 Runtime delta recording

When the router adds a skill at runtime:
1. The new skill is added to the active context.
2. The leaf's `skills` annotation is **not** silently rewritten — that would be hidden drift.
3. The delta is logged to the session file as `skill-delta: planner=[…], runtime=[…]`.
4. `LEARNINGS EXTRACT` at milestone close aggregates deltas and proposes planner heuristic improvements for next milestone.

### 11.3 Efficiency, fault tolerance, token economy

- Average context per leaf: ~3-5 skills vs. full-catalog cold evaluation.
- Significant token reduction expected (precise figure not measured).
- Fault tolerance: empty `prior_set` → full router. Missing/renamed skill in `prior_set` → warn + fall back for that slot. Skill load failure → continue with partial set.
- Token economy compounded by `scope-in`-bounded codebase reads (no full re-parse).

### 11.4 Implementation surface

Two candidate shapes (Open Question Q3): wrapper layer in `ovd-plan` vs. router mode in skill-router itself. Decision pending.

---

## 12. Relationship to existing systems

### 12.1 `ovd-workflow` is repositioned, not deprecated

Previously envisioned as passive tutorial layer. Now actively owns:

- Codebase mapping (multi-file output)
- Preferences (file)
- Requirements (file)
- Decisions (file)
- Tutorial / status surface

`ovd-plan` reads these; `ovd-go` reads codebase + decisions; `/ovd-log` writes decisions and per-session files. **One owner per file.** No cross-write.

### 12.2 Existing skill catalog: untouched

The 137 skills remain as-is. Skill-router gains the prior-set API (Section 11). No SKILL.md files are modified.

### 12.3 Existing `lib/ovd-workflow.js` and `lib/ovd-plan.js`

User confirmed these can be freely reworked or overwritten to implement this design. They are previous-draft scaffolding, not constraints.

### 12.4 GSD inspiration without GSD dependency

Internal stages, granularity, and rigor match or exceed GSD (`discuss-phase`, `spec-phase`, `plan-phase`, `verify-work`, `map-codebase`, `pause-work`, `resume-work`, `extract-learnings`, `audit-milestone`). Implementation is native to `ovd-plan` — no runtime dependency on GSD. GSD's commands inform our internal states but don't appear on the user surface.

---

## 13. Open questions

In priority order. P0 blocks implementation. P1 decides before each pipeline build. P2 decides during build.

### P0

**Q1: Socratic stopping condition (carried from r1).**
Proposed dual rule: stop when every leaf could be executed by a competent agent reading only the leaf spec + annotated skills + scoped codebase files; don't ask a question whose answer isn't load-bearing for any leaf's contract. Needs confirmation.

**Q2: `OVERDRIVE.md` per-node field syntax (carried from r1).**
Blockquote `> key: value` vs. per-node YAML frontmatter vs. fenced YAML block. Needs commitment for parser implementation.

**Q3: Skill-router prior-set API integration (carried from r1).**
Wrapper layer in `ovd-plan` vs. router-mode in skill-router itself.

**Q4: Cache update frequency (carried from r1).**
Per-leaf vs. per-cluster vs. per-checkpoint.

**Q5 (new): Codebase map drift detection threshold.**
Section 4.3 specifies three triggers for map updates. How does the system detect "drift" between manual refreshes? File-tree hash diff? File-count threshold? Tag-of-affected-modules? Decision affects map maintenance cost.

**Q6 (new): Intent classifier confidence thresholds.**
Section 3.1 proposes 0.85 / 0.5 cutoffs. These are placeholders. Needs calibration: probably needs a small test suite of user-message → expected-route to tune.

**Q7 (new): Awaiting-review approval signal recognition.**
What words/patterns the agent treats as approval vs. iteration vs. defer. Needs a small classifier dictionary plus fallback to ask.

### P1

**Q8: `/ovd-plan idea` impact-analysis depth.**
For "small + low-risk" auto-route to `EDIT`, what's the size threshold? Number of affected leaves? Files touched? Or always defer to agent judgment with explicit "this is small, I'm just editing" announce?

**Q9: Blind-spot expansion category checklist.**
Section 5.3 lists categories. Should this be a configurable list (per project)? Defaults to all, user can disable categories?

**Q10: Node-ref fuzzy matching disambiguation (carried).**
Numbered list, path display, recency preference?

**Q11: Failure escalation thresholds (carried).**
After how many `FIX` attempts does the agent escalate?

**Q12: Multi-session deliberation re-entry (carried).**
Immediate resume vs. summary-and-confirm.

**Q13: `/ovd-workflow init` vs. implicit init.**
Section 4.6 proposes implicit init on first `/ovd-plan` in un-initialized project. Should the system ever run init silently, or always ask?

**Q14: Conversation capture scope.**
Section 7.6 lists what `/ovd-log` (default) extracts. How far back does "active conversation" go? Last session boundary? Token-window-based? Last `/ovd-log` call?

### P2

**Q15: `--small` discovery (carried).**
Suggest the flag when user repeatedly uses full mode for small changes?

**Q16: Multi-project support in one workspace (carried).**
Probably not v1.

**Q17: Sketch promotion UX.**
Section 5.4 routes approved sketches to `.overdrive/sketches/approved/`. How is that referenced from a leaf? File path string in `scope.references`? Needs minimal spec.

---

## 14. What this is not

- Not a replacement for Overdrive execution skills.
- Not a team collaboration tool.
- Not a replacement for git.
- Not cloud-connected.
- Not a fixed-schema system.
- Not a CLI verbosity competition with GSD — the user types less, the agent does more.
- Not "fast autonomous half-assing." The agent is autonomous because the contract is complete, not because it skips thinking.
- Not a single-file system — multi-file architecture with one owner per file.
- Not linear — iteration is the default. Leaves don't auto-mark `done` without user approval.

---

*This document is the second revision converged conceptual spec as of 2026-06-08. It captures the user's 2026-06-08 feedback exhaustively and adjusts the design accordingly. Sections 0–12 represent the agreed design frame. Section 13 enumerates remaining open questions. Once Section 13's P0 items are resolved, the implementation order in the prior handoff document becomes the build plan (with the multi-file architecture from Section 9 and the iteration loop from Sections 6.4 and 8.4 reshaping the actual code phases).*
