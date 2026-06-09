# ovd-plan: Pipeline Architecture — Converged Spec

**Date:** 2026-06-07
**Branch:** `feature/ovd-plan`
**Status:** Design — converged conceptual frame. Open questions enumerated in Section 10. No code.
**Supersedes:** `2026-06-06-ovd-plan-design.md` and `2026-06-06-ovd-plan-handoff.md` for command-surface and internal-state decisions. Those documents remain the historical record of how we got here.

---

## 0. Frame

`ovd-plan` adds a structural layer on top of Overdrive's existing skill execution layer. The 137 skills, skill-router, and global operating guide are not modified — they are the substrate this system consumes. What `ovd-plan` provides is **a planning, execution, and record pipeline that produces self-contained leaf-level contracts**, so that downstream execution can happen autonomously without re-contextualizing the codebase, re-routing skills cold, or asking the user to manually update state.

### Operating principles

1. **The plan is a contract, not a checklist.** Every leaf carries enough specification — scope, skills, success criteria, dependencies — that an agent can execute it without re-reading the rest of the codebase. The thinking cost is paid once, at planning time. Autonomous execution downstream isn't "half-assed" because the spec was already complete; the agent is fulfilling a contract, not improvising one.

2. **Three commands, many internal states.** The user-facing surface is three commands plus a small handful of flags per command. Each command is internally a state machine. The agent routes between states based on tree state, user input, and progress signals. The user never picks an internal state.

3. **Apple / Notion / Supabase analogy applies literally.** Same power as the alternative (GSD), ~10% of the user-side effort. No mandatory hierarchy. No mandatory workflow. No commands that exist solely to glue other commands together. Hierarchy depth is recursive and user-defined.

4. **Pipelines chain themselves.** When `/ovd-plan idea` approves a new direction, it internally triggers `edit` (modify the tree) and queues `log doc-update` (propagate to docs). The user typed one command; the agent fulfilled the implications.

5. **The agent always recommends the next command at safe points.** "Leaf complete — `/ovd-log capture` if you want a note, then `/ovd-go` to continue." "Milestone closed — `/ovd-log handoff` to ship." The user doesn't have to remember workflow transitions.

6. **Skill-router is pre-resolved at planning time.** At execution, the router is a *delta engine* — it consults the node's annotations as a strong prior and only adds/overrides when reality contradicts the plan. This kills context bloat and "re-parsing the codebase for one feature."

7. **State persistence is invisible work.** No `update docs`, no `save state`, no `commit plan`. These happen automatically inside the pipelines. The user only types `/ovd-log handoff` when actually pausing.

8. **No fixed hierarchy.** The tree is recursive. A node can be a project, milestone, phase, feature, task, subtask, or anything the agent and user agree on. Labels are assigned in plain language during deliberation. Depth is unlimited.

---

## 1. User-Facing Surface

Three commands. Each takes minimal flags. The default form of each command is the most-used path.

### `/ovd-plan`

```
/ovd-plan              # default: visual display of tree + entry to deliberate→research→create
/ovd-plan deliberate   # explicit Socratic dialogue mode
/ovd-plan research     # investigate a specific question (codebase, external docs, skill spike)
/ovd-plan create       # write a confirmed tree to OVERDRIVE.md
/ovd-plan edit         # structural modifications to existing tree
/ovd-plan idea "text"  # propose a new direction; agent analyzes impact; if approved → edit + log doc-update
/ovd-plan sketch       # freeform UI/design sketch (throwaway HTML mockups, no commitment)
```

**Default behavior:** bare `/ovd-plan` does the right thing based on state.
- No `OVERDRIVE.md` exists → starts `NEW PROJECT` sub-pipeline.
- Existing tree, deliberation incomplete → `CONTINUE DELIBERATION`.
- Existing tree, deliberation complete → `DISPLAY` + offer edit/sketch/idea entries.

**Flags the user does NOT see:** map, import, mvp, refine, reorder, stats, cleanup, continue, status-of-deliberation, scope-check, dependency-detect, blind-spot-fill. These are internal states the agent enters automatically.

### `/ovd-go`

```
/ovd-go                       # default: execute next leaf based on plan + context
/ovd-go verify                # verify the active leaf or cluster (no implementation)
/ovd-go <node-ref>            # focus on a specific node (title fuzzy match or position path)
/ovd-go test <node-ref>       # implement or run tests for a specific node
/ovd-go --small               # surgical mode: no skill load, no remap, no re-read
/ovd-go --small "description" # surgical mode with inline description
```

**Default behavior:** bare `/ovd-go` reads the active node and decides.
- Leaf has no implementation → `LEAF EXECUTE`
- Leaf has implementation, no tests → `TEST IMPLEMENT`
- Leaf has implementation + tests → `TEST RUN` → `LEAF VERIFY`
- Cluster of leaves all complete → `CLUSTER VERIFY`
- Milestone complete → `MILESTONE BOUNDARY` (recommends `/ovd-log handoff`)

**Flags the user does NOT see:** fix, skill-delta, context-gather, decision-pause, blocked, milestone-boundary, report-checkpoint, cluster-verify, test-implement, test-run, retry. Internal.

### `/ovd-log`

```
/ovd-log                  # default: show inbox + recent activity
/ovd-log handoff          # full end-of-session: summarize, update state, docs, commit, handoff file
/ovd-log capture "text"   # granular sequential activity log entry
/ovd-log concerns         # structured review on active node (security/perf/persistence/tolerance)
/ovd-log idea "text"      # analyze a specific idea, attach to active node, await human direction
```

**Flags the user does NOT see:** state-update, doc-update, decision-record, milestone-close, inbox-view, inbox-promote, commit, learnings-extract, release-prep, archive. Internal.

---

## 2. `/ovd-plan` — Internal Architecture

### 2.1 Internal state machine

```
                          ┌───────────────────────────────┐
                          │  ENTRY: read OVERDRIVE.md     │
                          │  + .overdrive/plan.cache.json │
                          └──────────────┬────────────────┘
                                         │
                          ┌──────────────▼────────────────┐
                          │  ASSESS: tree state           │
                          │  + user input                 │
                          │  + deliberation_status        │
                          └──────────────┬────────────────┘
                                         │
              ┌──────────┬──────────┬────┴─────┬──────────┬──────────┬──────────┐
              │          │          │          │          │          │          │
        ┌─────▼──┐ ┌────▼────┐ ┌──▼────┐ ┌──▼───┐ ┌────▼────┐ ┌───▼───┐ ┌────▼────┐
        │DISPLAY │ │   NEW   │ │CONT.  │ │ IDEA │ │ EDIT    │ │SKETCH │ │ IMPORT  │
        │ (tree) │ │ PROJECT │ │DELIB. │ │      │ │         │ │       │ │         │
        └────────┘ └─────────┘ └───────┘ └──┬───┘ └─────────┘ └───────┘ └─────────┘
                                            │
                                  ┌─────────▼──────────┐
                                  │ ANALYZE IMPACT     │
                                  │ → propose change   │
                                  │ → user approves?   │
                                  └─────┬──────────────┘
                                        │ yes
                                  ┌─────▼──────────────┐
                                  │ CALL: EDIT         │
                                  │ CALL: log/DOC-UPD. │
                                  └────────────────────┘
```

All internal states:

| State | Trigger | What it does |
|---|---|---|
| `DISPLAY` | bare `/ovd-plan`, deliberation complete | Render tree visually with status, active position, health |
| `NEW PROJECT` | no `OVERDRIVE.md` exists | Codebase scan → Socratic deliberation → tree creation → skill annotation |
| `CONTINUE DELIBERATION` | `deliberation_status: in-deliberation` | Read open questions, resume Socratic dialogue from where it left off |
| `DELIBERATE` | `/ovd-plan deliberate` | Explicit Socratic mode — no tree commitment yet |
| `RESEARCH` | `/ovd-plan research` | Investigate a specific question: codebase scan, external docs (Context7), skill spike |
| `CREATE` | confirmed tree from deliberation | Write tree to `OVERDRIVE.md`, annotate skills, set `deliberation_status: ready` |
| `EDIT` | `/ovd-plan edit` or internal call from `IDEA` | Structural modifications: add/remove/restructure/rename nodes |
| `IDEA` | `/ovd-plan idea "text"` | Analyze impact, propose change, await approval, route to `EDIT` + queue `log doc-update` |
| `SKETCH` | `/ovd-plan sketch` | Freeform UI/design mockups — not committed to tree until promoted |
| `IMPORT` | internal, user feeds external doc | Ingest doc, extract plan items, merge into tree |
| `MAP` | internal, auto on `NEW PROJECT` or user request | Codebase analysis (graphify) to inform planning |
| `MVP SCOPE` | internal, user says "scope to MVP" | Apply SPIDR-style splitting to reduce to vertical slice |
| `REFINE` | internal, agent detects fat node | Split node into children during deliberation |
| `REORDER` | internal, user requests | Change tree traversal order |
| `CLEANUP` | internal, user says "tidy up" | Archive completed branches, prune stale nodes |
| `BLIND-SPOT FILL` | internal, every 2-3 deliberation turns | Agent surfaces things the user hasn't considered (tradeoffs, dependencies, security, perf, edge cases) |

### 2.2 The Socratic planning protocol

This is the single most important UX call in the system. It governs whether the experience feels Apple-like or GSD-like.

**Protocol:**

1. **Open assessment (first turn after user invokes planning).**
   - Agent reads the user's opening message.
   - Agent silently scans codebase if one exists — context only, not plan input.
   - Agent assesses user's understanding level on three axes:
     - **Domain depth** — how deeply does the user understand the problem space?
     - **Technical depth** — how comfortable is the user with implementation tradeoffs?
     - **Scope clarity** — how precisely has the user defined what they want?
   - Agent calibrates language and depth to match the lowest of the three.

2. **Elicit (subsequent turns).**
   - Agent asks one question at a time, in plain language.
   - Each question targets the highest-leverage unknown.
   - Agent never asks more than one question per turn unless they are tightly linked.
   - Agent presents tradeoffs proactively — "X means Y but loses Z. Which matters more?"
   - Agent rephrases user answers back to confirm understanding when stakes are high.

3. **Blind-spot fill (every 2-3 turns).**
   - Agent surfaces things the user hasn't anticipated:
     - Dependencies (X requires Y first)
     - Tradeoffs (option A is faster but less flexible)
     - Cross-cutting concerns (security, performance, accessibility, observability, persistence)
     - Edge cases the user implicitly assumed won't happen
   - Always in plain language matched to the user's level.
   - User can defer ("we'll figure it out later") and agent records it as an open question.

4. **Propose tree (when sufficient information).**
   - Agent assesses: do I have enough to draft a tree where every leaf has a complete contract?
   - If yes → render proposed tree, ask for review.
   - If no → identify the specific gap and ask the question that closes it.
   - "Sufficient information" means: scope, skills, success criteria for each leaf are derivable.

5. **Iterate on tree.**
   - User reviews, suggests changes.
   - Agent applies, re-renders.
   - Continue until user approves.

6. **Commit.**
   - Write tree to `OVERDRIVE.md` with skill annotations per node.
   - Set `deliberation_status: ready`.
   - Recommend next: "Plan complete. Run `/ovd-go` when ready."

### 2.3 Socratic stopping condition (Open Question #1)

The crux: when does the agent stop asking?

**Proposed dual rule:**

- **Sufficiency:** stop when every leaf in the proposed tree could be executed by a competent agent reading *only* that leaf's spec + the skills annotated to it.
- **Relevance:** don't ask a question whose answer isn't load-bearing for at least one leaf's contract.

These two rules bracket the stopping condition. If a leaf still requires "go read the rest of the codebase to figure out what to do" → contract is too thin → ask another question. If a question wouldn't change any leaf spec → don't ask it.

Needs confirmation. This is the lever that determines whether the planning experience feels intelligent or tedious.

### 2.4 Multi-session deliberation

Planning can span multiple sessions. State persisted in the `<!-- ovd-plan:deliberation-state -->` block of `OVERDRIVE.md`:

```
status: in-deliberation | ready
last_session: 2026-06-07T14:30:00Z
turn_count: 7
open_questions:
  - "What's the data model for user preferences?"
  - "Do we need offline mode?"
answered_questions:
  - { q: "Target browser?", a: "Modern only, no IE11" }
  - { q: "Auth provider?", a: "Supabase" }
proposed_tree_revision: 3
user_calibration:
  domain: medium
  technical: low
  scope: high
```

When the user re-enters `/ovd-plan` in a new session:
1. Agent reads deliberation-state.
2. Surfaces: "Last session we covered X, Y. Still open: Z. Ready to continue?"
3. Resumes from first open question.

### 2.5 Idea sub-pipeline (cross-pipeline trigger)

`/ovd-plan idea "what about dark mode"` flow:

```
1. INGEST idea text
2. ANALYSE IMPACT:
   - Which existing nodes are affected?
   - Is this addition, modification, or removal?
   - What's the effort estimate?
   - What's the risk to existing work?
   - What skills would it need?
3. PROPOSE: render proposed tree changes to user
4. AWAIT APPROVAL
5. IF APPROVED:
   a. INTERNAL CALL: EDIT — apply changes to tree
   b. INTERNAL CALL: /ovd-log DOC-UPDATE — propagate to docs
   c. REPORT: "Added dark-mode subtree (3 new leaves). Docs updated. Run /ovd-go to continue."
6. IF REJECTED:
   a. CAPTURE: append to inbox as "considered but not adopted"
   b. REPORT: "Noted. Moving on."
```

User typed one command. Agent did 5+ internal operations.

### 2.6 Plan-to-execute transition

`deliberation_status` is the canonical state field. Values:

- `in-deliberation` — Socratic dialogue ongoing, tree incomplete
- `ready` — tree complete, all leaves have contracts, execution can begin
- `executing` — at least one leaf in-progress or done
- `paused` — handoff written, awaiting resume

Transitions:

- `in-deliberation` → `ready` — user approves proposed tree in `CREATE`
- `ready` → `executing` — first `/ovd-go` invocation
- `executing` → `in-deliberation` — user runs `/ovd-plan idea` or `/ovd-plan edit` mid-flight (only for the affected subtree; rest stays `executing`)
- `executing` → `paused` — `/ovd-log handoff`
- `paused` → `executing` — `/ovd-go` in new session

`/ovd-go` invoked while `in-deliberation` → warn + ask user to confirm transition (don't silently flip).

---

## 3. `/ovd-go` — Internal Architecture

### 3.1 Internal state machine

```
                       ┌───────────────────────────────┐
                       │  ENTRY: read OVERDRIVE.md     │
                       └──────────────┬────────────────┘
                                      │
                       ┌──────────────▼────────────────┐
                       │  ROUTE: based on flags + state│
                       └──────────────┬────────────────┘
                                      │
        ┌──────────────┬──────────────┼──────────────┬──────────────┐
        │              │              │              │              │
   ┌────▼────┐   ┌────▼────┐    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
   │ SMALL   │   │ LEAF    │    │ LEAF    │    │ CLUSTER │    │ TEST    │
   │ EXECUTE │   │ EXECUTE │    │ VERIFY  │    │ VERIFY  │    │ RUN     │
   └────┬────┘   └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘
        │             │              │              │              │
        │             │         ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
        │             │         │ PASS    │    │ PASS    │    │ PASS    │
        │             │         │ → ADV.  │    │ → MILE? │    │ → CLST. │
        │             │         └─────────┘    └─────────┘    │ VERIFY  │
        │             │              │              │         └─────────┘
        │             │         ┌────▼────┐    ┌────▼────┐
        │             │         │ FAIL    │    │ FAIL    │
        │             │         │ → FIX   │    │ → SURF. │
        │             │         └─────────┘    └─────────┘
        │             │
        │        ┌────▼────┐
        │        │ DECISION│
        │        │  POINT  │  → pause, surface to user
        │        └─────────┘
        │
   ┌────▼────┐
   │ DONE    │  → no advancement, no skill load
   └─────────┘
```

All internal states:

| State | Trigger | What it does |
|---|---|---|
| `LEAF EXECUTE` | default with active leaf | Pre-load annotated skills, execute task, write to disk |
| `LEAF VERIFY` | after `LEAF EXECUTE` or `verify` flag | Auto-verify against the leaf's success criteria |
| `CLUSTER VERIFY` | after last leaf in cluster complete | Verify the cluster (feature) as a whole |
| `MILESTONE BOUNDARY` | all leaves in milestone complete | Recommend `/ovd-log handoff` |
| `TEST IMPLEMENT` | leaf has impl, no tests, default route | Write tests for the leaf |
| `TEST RUN` | leaf has impl + tests | Execute tests |
| `SMALL EXECUTE` | `--small` flag | Surgical edit, no skill load, no remap |
| `DECISION POINT` | agent encounters genuine ambiguity | Pause, surface to user, await direction |
| `BLOCKED` | task can't proceed (missing input, external blocker) | Mark node blocked, recommend `/ovd-plan` |
| `FIX` | verification failed | Re-attempt with proposed fix; if fails repeatedly, escalate |
| `SKILL DELTA` | active skills insufficient for emerging complexity | Runtime router adds skills beyond planned set |
| `CONTEXT GATHER` | agent needs file reads scoped to current leaf | Minimal reads, no full codebase parse |
| `REPORT` | between leaves | Surface checkpoint: "done X, starting Y" |

### 3.2 Default routing logic

Bare `/ovd-go` decision tree:

```
Read active node from OVERDRIVE.md
  ↓
Has implementation? ── no ──→ LEAF EXECUTE → LEAF VERIFY
  │
  yes
  ↓
Has tests? ── no ──→ TEST IMPLEMENT → TEST RUN → LEAF VERIFY
  │
  yes
  ↓
Tests passing? ── no ──→ FIX (loop until pass or escalate)
  │
  yes
  ↓
Cluster of leaves all done? ── no ──→ advance to next leaf
  │
  yes
  ↓
CLUSTER VERIFY
  ↓
Milestone all done? ── no ──→ advance to next cluster
  │
  yes
  ↓
MILESTONE BOUNDARY → recommend /ovd-log handoff
```

The user types `/ovd-go` and the agent decides whether to implement, test, verify, or close a milestone. The user doesn't pick.

### 3.3 `verify` flag

`/ovd-go verify` skips implementation. Two modes:

- No node specified: verify the active leaf or cluster.
- `/ovd-go verify <node-ref>`: verify a specific node (useful for re-verifying after manual edits).

Internal behavior identical to `LEAF VERIFY` / `CLUSTER VERIFY` states.

### 3.4 Task targeting

`/ovd-go <node-ref>` jumps to a specific node and runs the default routing from there.

`/ovd-go test <node-ref>` jumps to a specific node and routes to `TEST IMPLEMENT` or `TEST RUN`.

Node-ref formats accepted:
- Position path: `2.2.1`
- Title fuzzy match: `"widget layout"`
- Both. If ambiguous, agent disambiguates by showing candidates.

### 3.5 `--small` mode

`/ovd-go --small` bypasses:
- Skill router consultation
- Skill SKILL.md pre-loading
- Codebase remapping (graphify)
- Doc re-reading
- Full `OVERDRIVE.md` analysis (only locates current node)

Keeps:
- Targeted file read for the named target
- The edit itself
- Parse-check or import-resolution check
- Status update on active leaf if change completes it

**Guardrail:** if the agent detects the change touches more than 2-3 files or a shared contract (API, prop interface, shared type), it surfaces before proceeding: *"This touches 14 files — beyond `--small` scope. Continue with full mode?"*

This is not autonomous half-assing. The user has explicitly declared the work fits in their head, and the agent trusts that.

### 3.6 Verification protocol

Per leaf, verification reads the leaf's `success criteria` field and matches against:

| Leaf type (inferred from skills) | Verification |
|---|---|
| UI / frontend | `playwright-cli` screenshots + visual regression |
| Backend / API | API response shape check |
| Security-annotated | `security-review` scan |
| React | `react-doctor` lint |
| Modern web | accessibility + browser compatibility |
| SEO / launch | `jack-seo-launch-audit` meta + structured data |
| Fallback | Agent reads its own output against success criteria text |

**Critical:** success criteria are written into the leaf at planning time. Without it, the agent has to re-think what "done" means — which violates the contract principle.

### 3.7 Decision point handling

The agent pauses at genuine decision points:
- Ambiguity in spec (two valid interpretations)
- Task requires external input (API key, credential, design decision)
- Planned approach doesn't work (file structure differs from assumption)
- Risk of cross-contract change (modifying a shared interface)

When pausing, agent surfaces:
- What specifically is ambiguous or blocked
- What the options are
- Recommended option with reasoning
- Asks user to confirm or pick

User input options:
- Confirm recommended → continue
- Pick alternative → continue with alternative
- "I need to think" → mark node blocked, advance to next executable leaf
- "Let's replan" → pause, recommend `/ovd-plan edit` or `/ovd-plan idea`

---

## 4. `/ovd-log` — Internal Architecture

### 4.1 Internal state machine

```
                       ┌───────────────────────────────┐
                       │  ENTRY: read OVERDRIVE.md     │
                       └──────────────┬────────────────┘
                                      │
                       ┌──────────────▼────────────────┐
                       │  ROUTE: based on flag         │
                       └──────────────┬────────────────┘
                                      │
        ┌─────────┬─────────┬─────────┼─────────┬─────────┬─────────┐
        │         │         │         │         │         │         │
   ┌────▼────┐ ┌─▼──┐ ┌────▼────┐ ┌─▼────┐ ┌──▼────┐ ┌──▼────┐ ┌──▼────┐
   │ INBOX   │ │CAPT│ │ CONCERNS│ │ IDEA │ │ STATE │ │ DOC   │ │HANDOFF│
   │ VIEW    │ │URE │ │ REVIEW  │ │ ANAL.│ │ UPDATE│ │ UPDATE│ │       │
   └─────────┘ └────┘ └────┬────┘ └──┬───┘ └───────┘ └───────┘ └───┬───┘
                           │         │                              │
                      ┌────▼────┐    │                         ┌───▼────┐
                      │ ATTACH  │    │                         │ MILEST.│
                      │ TO ACT. │    │                         │ CLOSE? │
                      │ NODE    │    │                         └────────┘
                      └─────────┘    │                              │
                                ┌────▼────┐                    ┌───▼────┐
                                │INTEGRATE│                    │EXTRACT │
                                │ OR WAIT │                    │LEARNING│
                                └─────────┘                    │RELEASE │
                                                              │ARCHIVE │
                                                              └────────┘
```

All internal states:

| State | Trigger | What it does |
|---|---|---|
| `INBOX VIEW` | bare `/ovd-log` | Show inbox items, recent activity, pending follow-ups |
| `CAPTURE` | `/ovd-log capture "text"` | Granular sequential log entry, timestamped |
| `CONCERNS REVIEW` | `/ovd-log concerns` | Structured review of active node: security, performance, persistence, fault tolerance, accessibility, observability |
| `IDEA ANALYSIS` | `/ovd-log idea "text"` | Analyze a specific idea, attach to active node, await human direction |
| `STATE UPDATE` | internal, post-leaf | Minor state update — mark leaf, update active position |
| `DOC UPDATE` | internal, triggered by `EDIT`, `IDEA` (approved), or post-leaf | Propagate changes to project docs (uses `doc-coauthoring`, surgical not full regen) |
| `DECISION RECORD` | internal, agent or user makes a decision | Append to decisions table in `OVERDRIVE.md` |
| `HANDOFF` | `/ovd-log handoff` | Full end-of-session pipeline |
| `MILESTONE CLOSE` | internal, all leaves in milestone done at `HANDOFF` | Extended pipeline: learnings, release prep, archive |
| `LEARNINGS EXTRACT` | internal, at `MILESTONE CLOSE` | What worked, what didn't, skill annotation accuracy |
| `RELEASE PREP` | internal, at `MILESTONE CLOSE` if release milestone | Invoke `pre-launch-checklist`, `jack-seo-launch-audit` |
| `ARCHIVE` | internal, post `LEARNINGS EXTRACT` | Move completed milestone to archive section of `OVERDRIVE.md` |
| `INBOX PROMOTE` | internal, user promotes item | Move inbox item to tree as a new node (also reachable from `/ovd-plan`) |
| `COMMIT` | internal, end of `HANDOFF` | Git commit if in git repo |

### 4.2 The four user-facing flags — semantic distinctions

**`capture`** = granular sequential activity log. Stream of consciousness during a session. "Trying X." "Hit a wall on Y." "Decided Z." Timestamped, appended to a session activity section in `OVERDRIVE.md`. Zero analysis, zero interruption. The user can review later or use it to reconstruct what happened.

**`concerns`** = structured review. Agent runs through dimensions on the active node (or specified node): security, performance, persistence, fault tolerance, accessibility, observability, scalability. Surfaces findings. If findings are actionable, may recommend `/ovd-plan idea` to add remediation leaves to the tree (or auto-add — see Q6 in Section 10).

**`idea`** (in log) = analyze a specific idea without necessarily integrating. Agent does impact analysis (similar to `/ovd-plan idea`), but the outcome is attached to the active node as a "consideration" rather than auto-routing to `EDIT`. User reviews later and decides whether to escalate to `/ovd-plan idea` (which would integrate).

**`handoff`** = end of session, full pipeline.

### 4.3 The handoff pipeline (deep)

`/ovd-log handoff` executes:

```
1. SUMMARISE SESSION
   - Leaves moved to 'done'
   - Decisions made (from working memory + DECISION RECORD entries)
   - Plan adjustments
   - New nodes added
   - Concerns recorded
   - Captured activity highlights

2. STATE UPDATE
   - Mark completed leaves done
   - Update active_node to next pending leaf
   - Update updated timestamp
   - Increment session_count

3. IDENTIFY FOLLOW-UPS
   - Leaves needing testing
   - Leaves needing verification (if skipped)
   - Deferred plan edits
   - Open questions raised but not resolved
   - Concerns marked for follow-up

4. DOC UPDATE
   - If any leaves touched docs: update
   - If API changes: update API docs
   - If architecture decisions: flag architecture.md
   - Uses doc-coauthoring skill, targeted not regenerative

5. WRITE HANDOFF FILE
   Location: .overdrive/handoffs/YYYY-MM-DD-HH-MM.md
   Contents:
     - Completed leaves
     - Current position
     - Decisions made
     - Follow-ups with priority
     - Suggested resume prompt

6. MILESTONE CLOSE DETECT
   - All leaves in current milestone done?
     yes → 7, 8, 9
     no  → 10

7. LEARNINGS EXTRACT
   - What worked
   - What caused friction
   - What wasn't anticipated in planning
   - Skill annotation accuracy (planner-predicted vs runtime-needed)

8. RELEASE PREP (if release milestone)
   - Invoke pre-launch-checklist
   - Invoke jack-seo-launch-audit if applicable
   - Surface blocking items

9. ARCHIVE
   - Move completed milestone subtree to archive section
   - Create milestone summary in .overdrive/reports/
   - Set next milestone active

10. COMMIT (if git)
   - Stage OVERDRIVE.md + doc updates
   - Commit with message: "ovd-plan: checkpoint — [details]"

11. PRINT RESUME SUMMARY
   - X leaves completed
   - Next leaf
   - Resume instructions
```

### 4.4 Doc update propagation

`DOC UPDATE` is an internal state triggered by:
- A leaf completing where the leaf's skills include `doc-coauthoring` or its description mentions doc changes
- `/ovd-plan edit` modifying scope of an existing leaf
- `/ovd-plan idea` integrating a new direction
- `HANDOFF` running at session end

The agent uses `doc-coauthoring` skill to propagate. It does NOT regenerate full docs every time — only sections affected by the change. Targeted, surgical. This is what eliminates the "manually update docs after every change" friction.

---

## 5. Cross-Pipeline Flows

### 5.1 The complete loop

```
SESSION START
  ↓
/ovd-plan                          [user]
  ↓
DISPLAY tree + state               [agent]
  ↓
[user reviews, decides what to do]
  ↓
/ovd-go                            [user]
  ↓
LEAF EXECUTE → LEAF VERIFY         [agent]
  ↓
REPORT checkpoint                  [agent]
  ↓
[user observes, maybe captures]
  ↓
/ovd-log capture "thought"         [user, optional]
  ↓
CAPTURE                            [agent]
  ↓
[continue]
  ↓
... loop through leaves ...
  ↓
MILESTONE BOUNDARY detected        [agent]
  ↓
RECOMMEND: "Run /ovd-log handoff"  [agent]
  ↓
/ovd-log handoff                   [user]
  ↓
HANDOFF + MILESTONE CLOSE          [agent]
  ↓
COMMIT + PRINT resume              [agent]
  ↓
SESSION END

NEW SESSION
  ↓
/ovd-plan                          [user]
  ↓
agent reads handoff + OVERDRIVE.md
"Last session: X. Current: Y. Continue?"
  ↓
/ovd-go                            [user]
  ↓
[continues]
```

### 5.2 Internal command chaining

When a user-facing command internally triggers others:

| User typed | Internal chain |
|---|---|
| `/ovd-plan idea "X"` (approved) | → `EDIT` → `/ovd-log DOC UPDATE` |
| `/ovd-plan edit` (structural change) | → `/ovd-log DOC UPDATE` (if doc-affecting) |
| `/ovd-go` (leaf complete) | → `LEAF VERIFY` → `STATE UPDATE` → `REPORT` |
| `/ovd-go` (cluster complete) | → `CLUSTER VERIFY` → `STATE UPDATE` → `REPORT` |
| `/ovd-go` (milestone complete) | → `MILESTONE BOUNDARY` → `RECOMMEND handoff` |
| `/ovd-log handoff` (milestone close detected) | → `LEARNINGS EXTRACT` → `RELEASE PREP` → `ARCHIVE` → `COMMIT` |
| `/ovd-log concerns` (actionable findings) | → recommend `/ovd-plan idea` for remediation |
| `/ovd-log idea` (user escalates) | → recommend `/ovd-plan idea` for integration |

### 5.3 Agent recommendations at safe points

The agent emits explicit next-command recommendations at:

- **After every leaf:** "Leaf complete. Run `/ovd-log capture` if you want to note anything specific, or `/ovd-go` to continue."
- **After every cluster:** "Feature complete. Run `/ovd-log` to record, or `/ovd-go` to continue."
- **After every milestone:** "Milestone complete. Run `/ovd-log handoff` to ship."
- **At decision points:** "I need input on X. Pick A or B, or `/ovd-plan edit` to restructure."
- **At blocks:** "Blocked on Y. Run `/ovd-plan idea` to address, or `/ovd-go <other-node>` to switch focus."
- **At idle / context-full:** "Context approaching full. Recommend `/ovd-log handoff` now."

This is how the user navigates the system without memorizing the workflow.

---

## 6. Skill-Router Prior-Set Extension

### 6.1 Why the extension is needed

Current skill-router behavior:
1. Receives user message.
2. Cold-evaluates skills against the message.
3. Returns ranked skill suggestions.

This is fine for ad-hoc requests but wasteful when planning has already pre-resolved the task. With `ovd-plan`, each leaf already has a skill annotation list. Re-running cold evaluation means:
- Tokens spent on irrelevant skills
- Re-deriving information already encoded in the plan
- Risk of router choosing differently than planner — defeating the contract

### 6.2 Prior-set semantics

Extend skill-router with a prior-set API:

```
skill-router.route({
  task: <task description>,
  prior_set: ["design-taste-frontend", "impeccable", "react-doctor"],
  prior_confidence: "high" | "medium" | "low",
  context: <minimal scoped context>
})
```

Behavior:

- **`prior_confidence: high`** — router treats prior_set as canonical. Only adds skills if task description contains explicit triggers for skills outside the prior. Removes nothing.
- **`prior_confidence: medium`** — prior_set is starting point. Router evaluates whether each prior skill is still relevant + considers adding 1-2 more if task hints at it.
- **`prior_confidence: low`** — full cold evaluation, but prior_set is shown to user as "planning suggested these."

`ovd-plan`'s default is `prior_confidence: high` — the planner did the work, trust it.

### 6.3 Runtime delta application

When the router decides to add a skill at runtime (delta):
1. The new skill is added to the active context.
2. The leaf node's `skills` annotation in `OVERDRIVE.md` is **not** updated automatically — that would be silent drift from the plan. Instead, the delta is **recorded** in the session's `CAPTURE` log as "skill delta: planner=[…], runtime=[…]".
3. The `LEARNINGS EXTRACT` at milestone close aggregates deltas and proposes planner heuristic improvements: "planner predicted X, runtime needed X + Y. Improve planner heuristic for next milestone."

This makes the planner self-correcting *across* milestones without silently mutating the contract *within* one.

### 6.4 Efficiency, fault tolerance, token economy

**Efficiency:**
- Average context per leaf: ~3-5 skills instead of cold-evaluation against the full catalog.
- Significant token reduction expected (precise figure not measured yet).
- No re-derivation of planning decisions.

**Fault tolerance:**
- If `prior_set` is empty (planner didn't annotate): fall back to full router.
- If `prior_set` contains a removed/renamed skill: warn + fall back for that slot.
- If a skill in `prior_set` fails to load: continue with partial set, log warning.
- Delta application never deletes `prior_set` items at runtime — only adds.

**Token economy:**
- Prior-set cuts cold-routing cost dramatically per task.
- Per-task skill load reduced from "load all matches" to "load only annotated".
- Codebase reads are leaf-scoped (per `scope-in:` field), not project-wide.
- Doc reads are skill-scoped (each skill's SKILL.md), not full docs.

### 6.5 Implementation surface in skill-router

This needs design (Open Question Q3 in Section 10). Candidates:

- **Wrapper layer:** `ovd-plan` wraps skill-router calls with prior-set logic, leaving the router core untouched. Simpler. May result in two paths.
- **Router mode:** skill-router itself learns to accept `prior_set` + `prior_confidence`. Cleaner long-term. Requires modifying skill-router.

Recommendation pending: probably the router mode, but wrapper is fine for v1 if router modification is risky.

---

## 7. Node Schema — The Contract

A leaf node is a *contract*. It must be self-sufficient.

### 7.1 Required fields per leaf

```json
{
  "id": "2.2.1",
  "title": "Widget layout design",
  "description": "Design the grid layout and visual hierarchy for the stats dashboard. Three widget sizes (small/medium/large), responsive at 768px and 1024px breakpoints.",
  "status": "pending | in-progress | done | blocked | skipped",
  "skills": ["design-taste-frontend", "impeccable"],
  "success_criteria": [
    "Grid renders at 768px, 1024px, and 1440px without overflow",
    "Visual hierarchy matches the proposed reference",
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
    "fallback": "agent_self_check_against_success_criteria"
  }
}
```

### 7.2 Required fields per container (non-leaf)

```json
{
  "id": "2.2",
  "title": "Stats widgets",
  "description": "Main dashboard widgets showing key metrics.",
  "status": "pending | in-progress | done | mixed",
  "skills": ["design-taste-frontend", "emil-design-eng", "modern-web-guidance"],
  "children": ["2.2.1", "2.2.2", "2.2.3"],
  "cluster_verification": {
    "criteria": ["All widgets render together without visual conflict", "Dashboard load time < 200ms"],
    "method": "playwright_full_dashboard_check"
  }
}
```

### 7.3 Optional fields (any node)

```json
{
  "decisions": [
    { "date": "2026-06-07", "decision": "Use CSS Grid not Flexbox", "rationale": "Better for 2D layouts" }
  ],
  "concerns": [
    { "dim": "performance", "note": "Re-render cost on resize", "status": "open | mitigated | accepted" }
  ],
  "session_log": ["2026-06-07"],
  "blockers": [
    { "type": "external | internal | missing-info", "description": "...", "since": "2026-06-07" }
  ],
  "metadata": {
    "created": "2026-06-07T10:00:00Z",
    "updated": "2026-06-07T14:30:00Z",
    "completed": null
  }
}
```

### 7.4 Why `success_criteria` is non-negotiable

Without explicit success criteria written at planning time:
- The agent has to re-derive "what does done mean?" at execution time.
- This forces re-contextualization.
- This breaks the contract.
- This collapses the value of the planning phase.

This is the single most important schema decision. Every leaf has it. The planner refuses to mark a leaf as `ready` without it.

---

## 8. `OVERDRIVE.md` Format

```markdown
---
ovd-plan: true
version: 1
project: "Project Name"
description: "One-line description."
created: 2026-06-07
updated: 2026-06-07T14:30:00Z
deliberation_status: executing
active_node: "2.2.1"
current_milestone: "2. Dashboard"
session_count: 4
---

# Project Name

> Brief description.

## 1. Foundation [done]
> Brief description.
> skills: planning-first, modern-web-guidance

### 1.1 Project scaffolding [done]
### 1.2 Database schema [done]

## 2. Dashboard [in-progress]
> Main dashboard with stats and navigation.
> skills: design-taste-frontend, impeccable, react-doctor, playwright-cli
> cluster-verify: All widgets coexist without visual conflict; dashboard load < 200ms.

### 2.1 Navigation [done]

### 2.2 Stats widgets [in-progress]
> skills: design-taste-frontend, emil-design-eng

#### 2.2.1 Widget layout design [in-progress] ← ACTIVE
> Design the grid layout and visual hierarchy for the stats dashboard.
> Three sizes (small/medium/large), responsive at 768/1024px breakpoints.
> skills: design-taste-frontend, impeccable
> scope-in: src/components/Dashboard/, src/styles/grid.css
> scope-out: data fetching, animations
> success:
>  - Grid renders at 768/1024/1440px without overflow
>  - Visual hierarchy matches Figma reference
>  - Three sizes implemented as composable components
> verify: playwright_visual_regression
> deps: 2.1

#### 2.2.2 Data fetching layer []
> Implement API calls and caching for widget data.
> skills: modern-web-guidance
> success:
>  - All three widgets fetch on mount
>  - Cache invalidation on 60s interval
>  - Error states render gracefully
> verify: api_response_check

## 3. Launch prep []
...

---

<!-- ovd-plan:decisions:start -->
| Date | Node | Decision | Rationale |
|---|---|---|---|
| 2026-06-07 | 2.2.1 | CSS Grid not Flexbox | 2D layout natural fit |
| 2026-06-07 | global | Skip dark mode for v1 | Scope control |
<!-- ovd-plan:decisions:end -->

<!-- ovd-plan:inbox:start -->
- [ ] 2026-06-07 — Consider dark mode for v2
- [ ] 2026-06-07 — Performance audit after 2.2 completes
<!-- ovd-plan:inbox:end -->

<!-- ovd-plan:capture:start -->
2026-06-07T10:14 — starting 2.2.1, looking at existing grid in Card.tsx
2026-06-07T10:32 — decided 12-col grid not 16-col, simpler
<!-- ovd-plan:capture:end -->

<!-- ovd-plan:concerns:start -->
| Node | Dim | Note | Status |
|---|---|---|---|
| 2.2.1 | perf | Re-render on resize | open |
<!-- ovd-plan:concerns:end -->

<!-- ovd-plan:deliberation-state:start -->
status: complete
last_session: 2026-06-07T14:30:00Z
turn_count: 7
open_questions: []
answered:
  - Target browser? → Modern only, no IE11
  - Auth? → Supabase
user_calibration:
  domain: medium
  technical: low
  scope: high
<!-- ovd-plan:deliberation-state:end -->

<!-- ovd-plan:archive:start -->
(completed milestones move here after MILESTONE CLOSE)
<!-- ovd-plan:archive:end -->
```

Key format decisions:
- ATX headers (`#`, `##`, `###`, `####`) define tree depth.
- `[status]` markers after title.
- `← ACTIVE` marks current execution position. Moved only at handoff or milestone-close boundaries; in-session position kept in `.overdrive/plan.cache.json` to avoid full rewrites.
- `> ` blockquote lines under each header carry the structured fields (`skills:`, `success:`, `scope-in:`, `scope-out:`, `verify:`, `deps:`).
- HTML-comment-delimited managed sections for decisions, inbox, capture, concerns, deliberation-state, archive.
- YAML frontmatter for the cache to read machine-readably.

Syntax is Open Question Q2 in Section 10 — the blockquote convention is the candidate, alternatives are per-node frontmatter or fenced YAML.

---

## 9. Relationship to existing `ovd-workflow`

`ovd-workflow` and `ovd-plan` coexist. Roles are realigned.

### 9.1 `ovd-workflow` → tutorial / preferences layer

- Becomes the high-level guide explaining the OVD development model.
- Documents the three pipelines, when to use each, what to expect.
- Does NOT manage state for `ovd-plan` — that's `OVERDRIVE.md`'s job.
- Continues to manage: user preferences (`preferences.md`), cross-project decisions (`decisions.md`), knowledge vault — these are project-spanning concerns.

### 9.2 What `ovd-plan` reads from `ovd-workflow`

- `preferences.md` — at planning time, planner consults user preferences ("never use library X", "always use TypeScript strict mode"). These propagate into tree decisions and skill annotations.
- `decisions.md` — at planning time, planner reads cross-project decisions ("we always use Supabase for auth") to avoid re-litigating.

### 9.3 What `ovd-plan` does NOT write to `ovd-workflow`

- All `ovd-plan` state lives in `OVERDRIVE.md` and `.overdrive/plan.cache.json`.
- All session activity, decisions, concerns, ideas for the current project live in `OVERDRIVE.md`.
- `.overdrive/handoffs/` is shared between systems (already exists in `ovd-workflow`).

This gives **one source of truth per concept** and prevents drift.

### 9.4 Permission to rework existing modules

User confirmed: any existing `lib/ovd-workflow.js` or `lib/ovd-plan.js` can be freely extended or overwritten as required to implement this design. The existing implementation is not a constraint; we treat it as previous-draft scaffolding. Skills themselves remain untouched.

---

## 10. Open Questions

In priority order. P0 blocks implementation. P1 decides before each pipeline build. P2 decides during build.

### P0

**Q1: Socratic stopping condition.**
When does the planner stop asking? Proposal: "stop when every leaf could be executed by a competent agent reading only the leaf spec + annotated skills" + "don't ask a question whose answer isn't load-bearing for any leaf's contract." Needs confirmation or refinement.

**Q2: `OVERDRIVE.md` per-node field syntax.**
The `> blockquote-with-key:` convention is parseable but slightly fragile (newlines, trailing whitespace, escaping). Alternatives: explicit YAML frontmatter per node (verbose), HTML comment block per node (machine-clean but visually ugly), or fenced YAML block per node. One must be committed to before writing the parser.

**Q3: Skill-router prior-set API design.**
Wrapper layer in `ovd-plan` vs. router mode in skill-router itself. Affects implementation order and how invasive the change is. The router needs to handle prior-set efficiently and fault-tolerantly without exponential token growth.

**Q4: Cache update frequency.**
`.overdrive/plan.cache.json` is write-through. During execution, when does it write? Every leaf complete (potentially noisy)? Every cluster (cleaner but stale)? Every checkpoint synced with `← ACTIVE`? Affects perceived responsiveness and crash recovery.

### P1

**Q5: Distinction between `/ovd-plan idea` and `/ovd-log idea`.**
Section 4.2 distinguishes them by integration intent (plan = adopt now, log = consider later). Is this distinction clear enough to the user, or should one be renamed? Candidate rename: `/ovd-log consider "X"` to make the no-commit nature obvious.

**Q6: Does `concerns` auto-add remediation leaves?**
When `concerns` surfaces an actionable finding, does it auto-add a leaf via internal `/ovd-plan idea` call, or recommend the user run it explicitly? Auto-add is more frictionless but risks silent plan drift.

**Q7: Node-ref fuzzy matching disambiguation.**
When `/ovd-go "widget"` matches 3 nodes, how does the agent disambiguate? Numbered list? Path display? Most-recently-touched preference? Active-cluster preference?

**Q8: Failure escalation thresholds.**
After how many `FIX` attempts does the agent escalate to user? 2? 3? Adaptive based on skill confidence?

**Q9: Multi-session deliberation re-entry.**
When the user re-enters `/ovd-plan` after deliberation pause, does the agent immediately resume asking, or first summarise and confirm context is still accurate?

### P2

**Q10: Does `/ovd-log capture` ever interrupt?**
Default proposal: never. Should it surface a confirmation in rare cases?

**Q11: Multi-project support in one workspace.**
Probably not v1, but worth scoping the constraint.

**Q12: `--small` discovery.**
If the user repeatedly uses full `/ovd-go` for what would obviously qualify as `--small`, should the agent suggest the flag, or stay silent?

---

## 11. What This Is Not

- Not a replacement for Overdrive execution skills.
- Not a team collaboration tool.
- Not a replacement for git.
- Not cloud-connected.
- Not a fixed-schema system.
- Not a CLI verbosity competition with GSD — the user types less, the agent does more.
- Not "fast autonomous half-assing." The agent is autonomous because the contract is complete, not because it skips thinking.

---

*This document is the converged conceptual spec as of 2026-06-07. Sections 0–9 represent the agreed design frame. Section 10 enumerates the remaining open questions that block writing `lib/ovd-plan.js`. Once Section 10 is resolved, the implementation order in the prior handoff document (Section 9 of `2026-06-06-ovd-plan-handoff.md`) becomes the build plan.*
