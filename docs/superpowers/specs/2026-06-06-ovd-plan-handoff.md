# ovd-plan: Full Design Handoff

**Branch:** `feature/ovd-plan`
**Date:** 2026-06-06
**Context:** This document captures the complete design conversation for resuming in a new session.
**Status:** Design phase — no code written yet. Do not begin implementation without resolving the open questions in Section 7.

---

## 1. Where This Started and Why

### The Origin Question

The conversation began with a request to understand Overdrive's "typical development cycle." The direct answer was: **Overdrive has no development cycle.** It is entirely request-scoped — each session the agent reads the global operating guide, consults skill-router, does the work, optionally appends a note to `.overdrive/`. There is no milestone, no phase, no task list, no blocking relationship between tasks, no session continuity beyond a flat preference file. The `ovd-workflow` state (`.overdrive/`) is gitignored, unstructured prose, flat, and passive.

The user's framing: they use GSD (https://github.com/open-gsd/gsd-core) for project structure but it lacks skills. Overdrive has skills but lacks structure. They wanted to explore whether Overdrive could be extended to cover its missing structural layer.

### The GSD Comparison That Identified the Gap

Overdrive and GSD operate at **different layers of the same stack**:

| Layer | GSD | Overdrive |
|---|---|---|
| Project structure | Project → Milestone → Phase → Task → Subtask (committed to `.planning/`) | None |
| Planning | `gsd-discuss-phase` → `gsd-plan-phase` → PLAN.md | `clarify-and-plan`, `planning-first` skills (advisory, session-local) |
| Execution | `gsd-execute-phase` with wave-based subagent parallelism | Skills loaded per request via `skill-router` |
| Verification | `gsd-verify-work`, `gsd-audit-*` | Global guide instructs agent to verify (no enforced protocol) |
| Session continuity | `gsd-pause-work` / `gsd-resume-work` (structured handoff) | `ovd-workflow checkpoint` (ad-hoc, gitignored) |
| Domain expertise | Specialist phase types (`gsd-ui-phase`, `gsd-secure-phase`) | 137 domain skills + skill-router |
| State persistence | `.planning/` committed to repo — non-lossy, portable | `.overdrive/` gitignored — local only, can be lost |
| Cross-agent | Claude Code only | Claude, Codex, Gemini, Cursor, Antigravity |
| User effort | ~50 slash commands, rigid hierarchy | Request-by-request, no structure |

**What GSD does that Overdrive cannot:**
- Milestone-level roadmap management
- Non-lossy committed plan state (survives machine changes, team-shareable)
- Wave-based parallel execution that actually runs subagents
- Backlog management and promotion
- Progress tracking across phases
- Structured context restoration between sessions

**What Overdrive does that GSD cannot:**
- 137 domain-specific execution skills (animation, liquid glass, SEO, security, marketing, prompt engineering, video, design extraction, etc.)
- Cross-agent portability (Codex, Gemini, Cursor)
- Context budget guidance baked into the operating layer
- Lightweight project preferences/decisions persistence
- Skill routing intelligence across the full catalog

**The identified synthesis:** Use Overdrive's execution skills as the substrate for a new structural layer — not by importing GSD, but by building something native to Overdrive that is structurally superior to GSD while being dramatically simpler to use. The analogy the user proposed: **Supabase to AWS** — same power, 10% of the effort.

GSD has ~50 commands. The target: 3 pipeline commands that cover everything GSD does, with the agent handling all internal complexity.

---

## 2. Design Session: Decisions Made (Precise)

These are settled. Do not relitigate without noting the change and why.

### 2.1 Storage Model: Auto-Detected

No user configuration required. Detection is automatic:

| Condition | Canonical state | Local cache |
|---|---|---|
| Git repository detected | `OVERDRIVE.md` at repo root — **committed to git** | `.overdrive/plan.cache.json` — gitignored |
| No git repository | `OVERDRIVE.md` in current working directory | `.overdrive/plan.cache.json` |

Rules:
- `OVERDRIVE.md` is the **single canonical source of truth**. Human-readable Markdown. Can be opened in any editor.
- `.overdrive/plan.cache.json` is a write-through performance cache. Derived from `OVERDRIVE.md`. Regeneratable at any time. Never surfaced to users.
- `OVERDRIVE.md` is committed at session boundaries (`/ovd-log handoff`) and explicit save points. Not auto-committed on every state update during a session.
- The user never thinks about this. It just works.

### 2.2 Hierarchy: Recursive Tree (Notion-Like)

- Every node in the tree is the **same first-class object**. No fixed levels. No mandatory "you must have a milestone before a phase."
- Node type/label is assigned by the agent during planning conversation, in plain language appropriate to the user's mental model.
- Depth is unlimited. A node with children is a container (planning unit). A node with no children is a leaf (execution unit).
- The project is the root. All work is a subtree of this root.
- Only leaf nodes are executed directly. Non-leaf nodes are decomposed until they reach leaves.
- The tree can grow and deepen over time — during planning, during execution (discovered complexity), and between sessions.

### 2.3 Planning Mode: Agent-Led, Socratic

When the user enters planning mode:
1. Agent **silently scans the codebase** first — as context provider only. Codebase does not drive the plan.
2. Agent **leads a Socratic dialogue** — assesses user's understanding level, adapts its language and depth to match.
3. Agent **fills blind spots** — proactively surfaces things the user hasn't thought about: tradeoffs, dependencies, security implications, testing needs, scalability, edge cases. All in plain language.
4. Agent **owns the conversation** — it is the orchestrator. The user answers; the agent guides.
5. Planning can span **multiple sessions**. State is persisted in `OVERDRIVE.md`. Each session picks up where the last left off.
6. The user can **always adjust** — at any point, including mid-execution.

### 2.4 Session Execution Model: Transparent + Traceable + Mostly Autonomous

- Agent works **autonomously on individual leaf tasks**.
- Agent **always keeps the user oriented** — surfaces what it did, where it is in the tree, what it plans next.
- `OVERDRIVE.md` is the **live source of truth**. The user can open it at any time and see current state.
- Agent **does not run without any human touchpoint** — stops at genuine decision points: ambiguity, blocked task, user input required, natural milestone boundary.
- User can **interrupt and redirect at any time**.
- Execution order follows the tree by default (depth-first, left-to-right). User can override by naming a specific node.

### 2.5 Architecture: Approach B (Clean Module)

- **New module:** `lib/ovd-plan.js` — standalone, separate from `lib/ovd-workflow.js`
- Registered in same `bin/overdrive.js` entry point and `overdrive` CLI
- `lib/ovd-workflow.js` is **not modified**
- The two modules coexist with distinct responsibilities:
  - `ovd-workflow` → session state, preferences, decisions, knowledge vault (unchanged)
  - `ovd-plan` → project tree, planning pipeline, execution pipeline, handoff pipeline
- No modifications to: installer, skill files, global instruction files, or skill-router

### 2.6 Skill Annotation Per Node (Decided in Principle)

- During planning, the agent annotates each node with **predicted OVD skills** — its assessment of which Overdrive skills will be needed to execute that task.
- At execution time, these annotations **pre-prime the skill-router** — the router operates with a narrowed starting set instead of cold-evaluating all 137 skills.
- The full skill-router can still override or extend the set if the task reveals unexpected complexity.
- Effect: **reduced context bloat** (fewer irrelevant skills loaded) and **faster routing** (pre-solved at planning time).
- This is the key integration point between `ovd-plan` and Overdrive's existing execution layer.

### 2.7 Command Surface: 3 Pipeline Commands

This was the final design conclusion of the session. After going through a first proposal (7 commands + N flags), the user correctly identified that this was just GSD remapped to flags. The right design is:

**3 pipeline commands. Each is a workflow domain. The agent manages all internal states. The user never routes between stages.**

```
/ovd-plan    →  the plan-space     (think, shape, adjust, understand)
/ovd-go      →  the work-space     (build, verify, test, advance)
/ovd-log     →  the record-space   (capture, handoff, document, ship)
```

The user's stated principle: developers should be able to use OVD as well as or better than GSD with **10% of the effort**. Everything GSD's ~50 commands do must be reachable through these 3 commands, handled internally by the agent, invisible to the user.

---

## 3. The Three Commands: Detailed Design

### 3.1 `/ovd-plan` — The Plan Space

#### User-Facing Surface (What Users Actually Type)

```
/ovd-plan                      # default: show tree visually + offer entry into workflows
/ovd-plan "text or question"   # feed something specific — agent handles the rest
```

That is the entire user-visible surface. Two forms. The agent decides everything else.

#### Default Behavior (No Args)

Renders `OVERDRIVE.md` as a visual tree with status markers. Shows:
- Current position in the tree (which node is active)
- Progress summary (X of N tasks done in current milestone)
- Health indicators (any blockers, any nodes with ambiguous status)
- A natural prompt: what to do next

This is also the **status view** — the user doesn't need a separate status command. Opening the plan space is how you orient yourself.

#### Internal Pipeline (Agent-Managed, User Never Sees This Routing)

```
ENTRY
  ↓
read OVERDRIVE.md + .overdrive/plan.cache.json
  ↓
assess current state:
  ├─ no OVERDRIVE.md: NEW PROJECT → [research → deliberate → create → annotate skills]
  ├─ deliberation_status = in-deliberation: CONTINUE PLANNING → [continue Socratic dialogue]
  ├─ deliberation_status = ready, no active execution: REVIEW/ADJUST → [show tree, offer]
  ├─ deliberation_status = executing: MID-EXECUTION ADJUSTMENT → [minimal edit, don't break running work]
  └─ user fed specific text: PROCESS INPUT → route to appropriate sub-pipeline
       ├─ "new idea": IDEA PIPELINE → [analyse impact → assess tradeoffs → if approved: edit tree + queue docs]
       ├─ "change X": EDIT PIPELINE → [identify affected nodes → propose changes → update tree]
       ├─ "sketch": SKETCH PIPELINE → [freeform ideation, nothing committed until approved]
       ├─ "import doc": IMPORT PIPELINE → [ingest document → extract plan items → merge into tree]
       └─ question/research: RESEARCH PIPELINE → [investigate → surface findings → offer to update tree]
```

#### Sub-Pipelines (Internal, Never User-Visible)

**New Project Pipeline:**
1. Silent codebase scan (context only)
2. Assess user's understanding level from opening message
3. Socratic dialogue — agent leads, adapts to user's level
4. Agent surfaces: tradeoffs, dependencies, missing considerations, technical implications
5. Agent proposes full tree in plain language
6. User reviews, adjusts, approves
7. Agent writes approved tree to `OVERDRIVE.md` with skill annotations per node
8. Sets `deliberation_status: ready`

**Idea Pipeline** (when user feeds "what about X" or "I want to add Y"):
1. Agent identifies which nodes in the tree are affected
2. Agent assesses: is this an addition (new node), a change (modify existing), or a blocker (dependency)?
3. Agent surfaces tradeoffs: effort, risk, impact on existing work
4. User approves or rejects
5. If approved: agent edits tree + queues documentation update in log space
6. If rejected: agent notes the consideration and moves on

**Continuation Planning Pipeline** (multi-session, returning to deliberation):
1. Read `deliberation_state` block from `OVERDRIVE.md`
2. Surface: what was decided last session, what's still open
3. Resume Socratic dialogue from where it left off
4. Agent asks only questions that haven't been answered yet
5. When all decisions are made: propose finalized tree, set `deliberation_status: ready`

#### Which OVD Skills Are Used Here

The planning space uses **thinking skills**, not execution skills:

| Sub-pipeline | OVD Skills Used |
|---|---|
| New project — codebase scan | `graphify` (if available), normal file reads |
| Deliberation / tradeoffs | `what-should-i-consider`, `clarify-and-plan` |
| Technical planning | `planning-first` |
| Research spike | `last30days`, `reddit-research`, Context7 |
| Spec writing | `doc-coauthoring` |
| MVP scoping | `what-should-i-consider` + `planning-first` |
| Codebase mapping | `graphify`, `gsd-map-codebase` equivalent behavior |
| Import/ingest | `convert-to-markdown` |

---

### 3.2 `/ovd-go` — The Work Space

#### User-Facing Surface

```
/ovd-go                   # execute from current position — agent decides everything
/ovd-go <node-ref>        # jump to a specific named node (e.g. "auth.jwt" or "2.2.1")
/ovd-go --small           # surgical low-overhead execution for small targeted changes
/ovd-go --small "text"    # small mode with an inline description of the change
```

Node refs are human-readable — either the node's title (partial match) or its position path in the tree. Not UUIDs.

#### `--small` Flag: Low-Overhead Surgical Mode

Designed for small, well-understood changes where the full execution pipeline would waste tokens: moving a component, tweaking a layout, renaming something, adjusting spacing, changing a colour, rewiring a prop. The kind of thing a developer does instinctively without needing to think about architecture, skills, or tradeoffs.

**What `--small` skips entirely:**
- Skill-router consultation — no routing pass
- Skill SKILL.md pre-loading — no skill context loaded
- Codebase remapping / graphify — no structural analysis
- Doc re-reading — no documentation loaded into context
- Planning overhead — no OVERDRIVE.md analysis beyond locating the current node

**What `--small` keeps:**
- Reading the specific file(s) directly affected by the change
- Making the targeted edit
- A minimal fast check (does the file still parse? does the import still resolve?)
- Updating the active node's status in OVERDRIVE.md if the change completes a leaf

**Internal pipeline for `--small`:**
```
ENTRY
  ↓
read only: the specific file(s) the user named or the active leaf's target file
  ↓
make the targeted change
  ↓
fast check: parse / import resolution only (no skill-based verification)
  ↓
done — no advancement, no skill loading, no session summary
```

**Design principle:** `--small` is the agent equivalent of the global guide's "surgical changes" rule applied at the command level. The user is saying: *I know what I want, I know it's small, don't think — just do it.* The agent trusts this and acts accordingly.

**What `--small` is not for:**
- Anything that touches more than 2-3 files
- Anything that changes a contract (API, prop interface, shared type)
- Anything that requires understanding how components relate
- Anything that might break something downstream

If the agent detects that the requested change is larger than "small" warrants (e.g. the user asked to "move a component" but the component is imported in 14 places), it surfaces this before proceeding: *"This touches 14 files — more than small mode is designed for. Continue with full mode?"*

#### Default Behavior (No Args)

1. Reads `OVERDRIVE.md` — finds the current active node
2. Reads that node's skill annotations
3. Pre-loads those skills (pre-primes skill-router)
4. Executes the task autonomously
5. After each leaf: auto-verifies, marks done, advances
6. Surfaces brief checkpoint to user: "Completed X. Starting Y."
7. Stops only at decision points, ambiguity, or milestone boundaries

#### Internal Pipeline

```
ENTRY
  ↓
read OVERDRIVE.md → find active node + skill annotations
  ↓
pre-load skill set from node annotations
  ↓
execute leaf task:
  ↓
  [agent works using loaded OVD skills]
  ↓
auto-verify (lightweight check against task's success criteria):
  ├─ pass: mark node done → advance to next leaf → loop
  └─ fail: surface to user with specific problem + proposed fix
              ├─ user approves fix: apply fix → re-verify → continue
              └─ user rejects / wants different approach: pause → surface to /ovd-plan
  ↓
milestone boundary detection:
  └─ all leaves in a milestone done: surface summary → offer to continue or /ovd-log handoff
```

#### What "Verify" Means Per Node Type

Verification is not a separate command. It is baked into every task completion. The agent determines what verification means based on the node's skills:

| Node skills include | Auto-verification behavior |
|---|---|
| `playwright-cli` | Screenshots + snapshot comparison |
| `security-review` | Quick scan for introduced vulnerabilities |
| `react-doctor` | React-specific lint/health check |
| `modern-web-guidance` | Accessibility + browser compatibility check |
| `jack-seo-launch-audit` | Meta tags + structured data check |
| Any UI skill | Visual regression check via playwright |
| Any backend skill | API response validation |
| (fallback) | Agent reads its own output and checks against task description |

#### Execution-Mode Skill Routing

This is the key mechanism for how `ovd-plan`'s skill annotations make `ovd-go` smarter:

```
node annotations: ["design-taste-frontend", "impeccable", "react-doctor"]
                        ↓
agent pre-loads these 3 SKILL.md files before starting
                        ↓
skill-router runs with these as a strong prior
                        ↓
if task reveals unexpected complexity (e.g. animation needed):
  skill-router adds "fluid-animations" from its normal routing
                        ↓
result: context contains only relevant skills
        (not all 137)
```

#### Which OVD Skills Are Used Here

This is where **all execution skills** are deployed. The specific skills depend on which nodes are being executed. The full catalog is available, but only node-annotated skills are pre-loaded:

**Frontend nodes:** `design-taste-frontend`, `impeccable`, `emil-design-eng`, `fluid-animations`, `emil-animation-polish`, `liquid-glass-web`, `pretext`, `modern-web-guidance`, `playwright-cli`

**Security nodes:** `security-review`, `what-should-i-consider`

**Launch/SEO nodes:** `pre-launch-checklist`, `jack-seo-launch-audit`, `jack-premium-site-system`

**AI integration nodes:** `clarify-and-plan`, Context7 for framework docs

**Testing nodes:** `playwright-cli`, `react-doctor`

**Documentation nodes:** `doc-coauthoring`, `convert-to-markdown`

**Research nodes:** `last30days`, `reddit-research`, `graphify`

**Media nodes:** `claude-video`, `media-download`

---

### 3.3 `/ovd-log` — The Record Space

#### User-Facing Surface

```
/ovd-log                   # show inbox of captured items
/ovd-log "text"            # capture an item to inbox (without interrupting anything)
/ovd-log handoff           # full end-of-session pipeline
```

Three forms. The `handoff` form is the most important.

#### Default Behavior (No Args)

Shows the inbox — items captured but not yet promoted to the tree. This is the lightweight idea buffer. The user can review, promote items to the plan, or discard.

#### Quick Capture (`/ovd-log "text"`)

Appends item to the inbox section of `OVERDRIVE.md` with a timestamp. Does nothing else. Zero interruption to current workflow. The user doesn't lose their train of thought.

#### The Handoff Pipeline (The Critical One)

`/ovd-log handoff` is the **end-of-session command**. It runs a complete pipeline without requiring user input, packages everything, and leaves the project in a state where any agent in a new session can pick up exactly where this one left off.

```
/ovd-log handoff
  ↓
1. SUMMARISE SESSION
   - List all nodes that moved to 'done' this session
   - List decisions made (from agent's working memory)
   - List any plan adjustments made during execution
   - List any new nodes added during execution
  ↓
2. UPDATE OVERDRIVE.MD
   - Mark completed nodes as done
   - Set active_node to the next pending leaf
   - Update session_count
   - Update updated timestamp
   - Write any new nodes added during session
   - Move approved inbox items to tree if flagged
  ↓
3. IDENTIFY FOLLOW-UPS
   - Nodes that need testing (auto-detected from node type)
   - Nodes that need verification (if verification was skipped)
   - Plan edits that were deferred ("we talked about dark mode, not in tree yet")
   - Open questions raised but not resolved
  ↓
4. UPDATE DOCUMENTATION
   - If any nodes that touch docs were completed: update relevant docs
   - If API changes: update API docs
   - If any decisions affect architecture: flag for architecture.md update
  ↓
5. WRITE HANDOFF FILE
   Location: .overdrive/handoffs/YYYY-MM-DD-HH-MM.md
   Contents:
     - What was completed this session (node list)
     - Current position (active node + tree path)
     - Decisions made
     - Follow-ups required (with priority)
     - Exact suggested opening for next session:
       "Start by running /ovd-plan to see where we are.
        The next task is [node title]. Use /ovd-go to continue.
        Before starting: [any critical context the agent should know]"
  ↓
6. COMMIT (if git)
   - Stage OVERDRIVE.md
   - Stage any doc updates
   - Commit with message: "ovd-plan: checkpoint — [X tasks done, current: node-title]"
   - Print: commit hash + branch
  ↓
7. PRINT RESUME SUMMARY
   "Session saved. X tasks completed.
    Next: [node title]
    To resume: open a new conversation, run /ovd-plan to orient, then /ovd-go to continue.
    Handoff: .overdrive/handoffs/[filename]"
```

#### Milestone-Complete Detection

If all leaves in the current milestone are marked done when `handoff` runs, the pipeline automatically extends:

```
[all above steps]
  ↓
MILESTONE COMPLETE DETECTED
  ↓
8. EXTRACT LEARNINGS
   - What worked well
   - What caused friction
   - What wasn't anticipated in planning
   - Skill annotation accuracy (were the predicted skills actually used?)
  ↓
9. RELEASE PREP (if milestone is a release milestone)
   - Invoke pre-launch-checklist skill behavior
   - Invoke jack-seo-launch-audit if applicable
   - Surface any blocking items before shipping
  ↓
10. ARCHIVE MILESTONE
    - Move completed milestone subtree to archive section of OVERDRIVE.md
    - Create milestone summary in .overdrive/reports/
    - Set next milestone as active
```

The user never has to remember that milestone close is different from session close. The system detects it and extends the pipeline automatically.

#### Which OVD Skills Are Used Here

| Pipeline step | OVD Skills Used |
|---|---|
| Session summarise | Agent's own reasoning (no special skills) |
| Documentation update | `doc-coauthoring` |
| Release prep | `pre-launch-checklist`, `jack-seo-launch-audit` |
| Learning extraction | Agent's own reasoning |
| Handoff writing | Agent's own reasoning |

---

## 4. How the Three Commands Flow Into Each Other

This is the complete developer lifecycle as a loop:

```
New project or new session:
  /ovd-plan
    ↓
  Agent reads OVERDRIVE.md (or creates it if none)
  Shows tree or starts deliberation
    ↓
  [Planning conversation happens — one session or many]
    ↓
  OVERDRIVE.md written with full tree + skill annotations
  deliberation_status: ready
    ↓
Ready to work:
  /ovd-go
    ↓
  Agent pre-loads node skill annotations
  Works autonomously
  Updates OVERDRIVE.md live as tasks complete
  Surfaces checkpoints
    ↓
  [User works with agent through tasks]
    ↓
  [Something unexpected — user says "we should also add X"]
    ↓
  User naturally types: /ovd-plan "what about adding X"
    ↓
  Agent pauses execution, analyses impact, updates tree if approved
    ↓
  /ovd-go resumes from where it left off
    ↓
End of session (or context getting full):
  /ovd-log handoff
    ↓
  Full pipeline runs: summarise → update OVERDRIVE.md → identify follow-ups →
  update docs → write handoff → commit → print resume summary
    ↓
New session (any time later):
  /ovd-plan
    ↓
  Agent reads handoff + OVERDRIVE.md
  "Last session: completed X, Y, Z. Current: node-title. Ready to continue?"
    ↓
  /ovd-go
    ↓
  [continues]
```

A developer's complete day:
- **Morning:** `/ovd-plan` → see where you are
- **Working:** `/ovd-go` → agent does the work
- **Idea mid-session:** `/ovd-log "thought"` → captured, not lost
- **Evening:** `/ovd-log handoff` → everything saved

That is the entire interface for normal operation.

---

## 5. GSD Full Coverage Map

Every GSD command is handled as an internal state of one of the three commands:

| GSD Command | Internal handler in ovd-plan |
|---|---|
| `gsd-new-project` | `/ovd-plan` → new project sub-pipeline |
| `gsd-new-milestone` | `/ovd-plan` → deliberation adds milestone nodes |
| `gsd-discuss-phase` | `/ovd-plan` → deliberation sub-pipeline |
| `gsd-plan-phase` | `/ovd-plan` → create sub-pipeline |
| `gsd-spec-phase` | `/ovd-plan "write spec for X"` → spec sub-pipeline |
| `gsd-ultraplan-phase` | `/ovd-plan "let's plan this exhaustively"` → deep deliberation |
| `gsd-mvp-phase` | `/ovd-plan "scope to MVP"` → scoping sub-pipeline |
| `gsd-phase` (CRUD) | `/ovd-plan "edit the plan"` → edit sub-pipeline |
| `gsd-import` | `/ovd-plan "import this doc"` → import sub-pipeline |
| `gsd-sketch` | `/ovd-plan "sketch idea"` → sketch sub-pipeline |
| `gsd-spike` | `/ovd-plan "spike this question"` → research sub-pipeline |
| `gsd-map-codebase` | `/ovd-plan` → initial codebase scan (automatic) |
| `gsd-cleanup` | `/ovd-plan "clean up the plan"` → cleanup sub-pipeline |
| `gsd-ingest-docs` | `/ovd-log --ingest path` (one extra flag, but rare operation) |
| `gsd-execute-phase` | `/ovd-go` |
| `gsd-verify-work` | `/ovd-go` → auto-verify after each task |
| `gsd-add-tests` | `/ovd-go` → test nodes executed as leaves |
| `gsd-audit-milestone` | `/ovd-go "audit current milestone"` |
| `gsd-audit-uat` | `/ovd-go "run UAT"` |
| `gsd-secure-phase` | `/ovd-go` → security skill annotation on relevant nodes |
| `gsd-ui-phase` | `/ovd-go` → UI skill annotations on relevant nodes |
| `gsd-ai-integration-phase` | `/ovd-go` → AI skill annotations on relevant nodes |
| `gsd-docs-update` | `/ovd-go` → auto-triggered by doc-annotated nodes |
| `gsd-audit-fix` | `/ovd-go` → fix is a sub-step of failed verification |
| `gsd-pr-branch` | `/ovd-go` → triggered at milestone boundaries |
| `gsd-pause-work` | `/ovd-log handoff` |
| `gsd-resume-work` | `/ovd-plan` (reads handoff automatically) |
| `gsd-capture` | `/ovd-log "text"` |
| `gsd-inbox` | `/ovd-log` |
| `gsd-quick` | `/ovd-log "quick task"` → inbox → user promotes to tree |
| `gsd-review-backlog` | `/ovd-log` → review + promote workflow |
| `gsd-progress` | `/ovd-plan` (default view shows progress) |
| `gsd-health` | `/ovd-plan` (default view shows health indicators) |
| `gsd-stats` | `/ovd-plan "show stats"` |
| `gsd-milestone-summary` | `/ovd-plan` (milestone boundary shows summary) |
| `gsd-forensics` | `/ovd-plan "why is X broken/blocked"` |
| `gsd-workstreams` | `/ovd-plan` (tree with parallel branches is natural) |
| `gsd-complete-milestone` | `/ovd-log handoff` → auto-detects milestone completion |
| `gsd-ship` | `/ovd-log handoff` → extended release pipeline |
| `gsd-extract-learnings` | `/ovd-log handoff` → milestone-complete sub-pipeline |
| `gsd-profile-user` | Baked into `/ovd-plan` deliberation (agent adapts to user) |
| `gsd-explore` | `/ovd-plan "explore X"` |
| `gsd-surface` | `/ovd-plan` default view |
| `gsd-update` | Automatic during deliberation and execution |
| `gsd-add-tests` | Test nodes in tree, executed by `/ovd-go` |
| `gsd-ns-review` | `/ovd-go "review X"` |

---

## 6. The `OVERDRIVE.md` File Format (Proposed — Needs Finalization)

This is a concrete proposal, not yet confirmed. It needs explicit approval before implementation.

```markdown
---
ovd-plan: true
version: 1
project: "Project Name"
description: "One-line description of what this project does and who it's for."
created: 2026-06-06
updated: 2026-06-06T14:30:00Z
deliberation_status: executing   # in-deliberation | ready | executing | paused
active_node: "2.2.1"
current_milestone: "2. Dashboard"
session_count: 4
---

# Project Name

> Description of the project in 1-2 sentences.

## 1. Foundation [done]
> Brief description of what this milestone accomplishes.
> skills: planning-first, modern-web-guidance

### 1.1 Project scaffolding [done]
### 1.2 Database schema [done]
### 1.3 Auth middleware [done]

## 2. Dashboard [in-progress]
> Main application dashboard with stats, navigation, and user profile.
> skills: design-taste-frontend, impeccable, react-doctor, playwright-cli

### 2.1 Navigation component [done]

### 2.2 Stats widgets [in-progress]
> skills: design-taste-frontend, emil-design-eng, modern-web-guidance

#### 2.2.1 Widget layout design [in-progress] ← ACTIVE
> Design the grid layout and visual hierarchy for the stats dashboard.
> skills: design-taste-frontend, impeccable

#### 2.2.2 Data fetching layer []
> Implement API calls and caching for widget data.
> skills: modern-web-guidance

#### 2.2.3 Widget animations []
> Add entrance animations and hover interactions.
> skills: fluid-animations, emil-animation-polish

### 2.3 User profile page []
> skills: design-taste-frontend, impeccable

## 3. Launch Prep []
> SEO, performance, security hardening, and go-live checklist.
> skills: pre-launch-checklist, jack-seo-launch-audit, security-review

### 3.1 SEO and metadata []
### 3.2 Security audit []
### 3.3 Performance pass []
### 3.4 Go-live checklist []

---
<!-- ovd-plan:decisions:start -->
| Date | Decision | Rationale |
|---|---|---|
| 2026-06-06 | Use Tailwind for all styling | Consistency with existing codebase |
| 2026-06-06 | Skip dark mode for v1 | Scope control — add in v2 |
<!-- ovd-plan:decisions:end -->

<!-- ovd-plan:inbox:start -->
- [ ] Consider adding dark mode (2026-06-06) — discuss in next planning session
- [ ] Performance audit recommended after 2.2 completes (2026-06-06)
<!-- ovd-plan:inbox:end -->

<!-- ovd-plan:deliberation-state:start -->
status: complete
last_question: "What's the target browser support?"
last_answer: "Modern browsers only, no IE11"
open_questions: []
<!-- ovd-plan:deliberation-state:end -->
```

Key format decisions in this proposal:
- ATX headers (`#`, `##`, `###`, `####`) define the tree depth
- `[done]`, `[in-progress]`, `[]`, `[blocked]`, `[skipped]` are status markers
- `← ACTIVE` marks the current execution position
- `> skills: ...` is the skill annotation for a node (Markdown blockquote, parseable)
- `> ` description lines are the node's description
- Managed sections use HTML comment delimiters (consistent with Overdrive's existing pattern)
- The frontmatter block provides machine-readable metadata for the CLI cache

**What needs finalizing before implementation:**
- Is the `> skills:` blockquote the right syntax? (Alternatives: frontmatter, HTML comments, inline badge)
- Should node IDs be explicit (`#### 2.2.1`) or auto-generated from tree position?
- What exactly goes in `deliberation-state`?
- How are blockers represented?

---

## 7. Node Schema (Proposed — Needs Finalization)

The JSON representation in `.overdrive/plan.cache.json`:

```json
{
  "id": "2.2.1",
  "path": [1, 1, 0],
  "title": "Widget layout design",
  "description": "Design the grid layout and visual hierarchy for the stats dashboard.",
  "status": "in-progress",
  "skills": ["design-taste-frontend", "impeccable"],
  "children": [],
  "parent": "2.2",
  "decisions": [],
  "session_log": ["2026-06-06"],
  "verification_status": null,
  "verification_notes": null,
  "blockers": [],
  "metadata": {
    "created": "2026-06-06T10:00:00Z",
    "updated": "2026-06-06T14:30:00Z",
    "completed": null
  }
}
```

**What needs finalizing:**
- Full status enum (in-progress, done, blocked, skipped, planned — confirm all values)
- Whether `decisions` is a list of strings or structured objects
- Whether `blockers` is just a list of strings or has a type (external/internal/missing-info)
- Whether there's a `success_criteria` field per node (important for auto-verification)

---

## 8. Open Questions Before Implementation

These are the items that are **genuinely ambiguous** and must be decided before writing any code. In priority order:

### P0 — Must Resolve First (Block Implementation)

**Q1: OVERDRIVE.md format finalized?**
The proposal in Section 6 needs explicit approval. Specifically: skill annotation syntax (`> skills:` blockquote), node ID scheme (position-based vs explicit), status markers.

**Q2: How does `/ovd-plan` know it's a continuation vs a new start?**
The `deliberation_status` field in frontmatter handles this, but the exact state transitions need mapping: when does it move from `in-deliberation` to `ready`? When does it go back to `in-deliberation` during an idea pipeline? This affects the planning sub-pipeline logic entirely.

**Q3: Skill annotation mechanism — pre-load or hint?**
Two options:
- Agent reads node's `skills:` list and explicitly loads those SKILL.md files before executing
- Agent passes the `skills:` list to skill-router as a "strong prior" hint and router decides
The second option is more robust but requires skill-router to support a hints API (currently it doesn't). The first is simpler but may miss skills the planner didn't anticipate. **Decision needed before lib/ovd-plan.js can call skill-router.**

**Q4: Relationship to `ovd-workflow` — shared state or separate?**
When `/ovd-log handoff` runs, does it write to:
- Only `OVERDRIVE.md` + `.overdrive/handoffs/`
- Also `.overdrive/state.md`, `.overdrive/decisions.md` (from ovd-workflow)
- Both, with deduplication logic

The cleaner answer is probably to write ovd-plan state to `OVERDRIVE.md` exclusively and not touch ovd-workflow files. But if a user has both systems active, there will be two sources of truth for "current state." This needs a decision.

### P1 — Resolve Before Implementing Each Command

**Q5: What constitutes a "success criteria" for auto-verification?**
Verification is baked into every leaf node's execution. But what does the agent verify against? Options:
- The node's description text (semantic check: "does what I built match the description?")
- A structured `success_criteria` field added to each node during planning
- The skill-specific verification behavior per skill annotation

Option 2 is the most reliable but requires the planning pipeline to generate success criteria for every node. Option 3 is most natural but requires each skill to define its own verification behavior.

**Q6: What does `/ovd-go <node-ref>` accept as a valid reference?**
- Position path: `2.2.1`
- Title: `"widget layout"` (fuzzy match)
- Both

Fuzzy match is more user-friendly but needs disambiguation when matches are ambiguous.

**Q7: `ovd-plan` deliberation across sessions — what's the format of `deliberation_state`?**
The `<!-- ovd-plan:deliberation-state:start -->` block needs a full spec. What fields? How does the agent read it and know which questions to ask next? Does it store the full question history or just open questions?

### P2 — Implementation Details (Can Be Decided During Build)

**Q8: Does `/ovd-log "text"` require confirmation before adding to inbox, or is it instant?**
Recommendation: instant (otherwise it defeats the "zero interruption" purpose).

**Q9: What happens if the user calls `/ovd-go` when `deliberation_status` is still `in-deliberation`?**
Options: error with message, auto-transition to ready with warning, ask user to confirm.
Recommendation: warn + ask, don't silently transition.

**Q10: How does the `← ACTIVE` marker in `OVERDRIVE.md` move during execution?**
It needs to move as the agent advances through nodes. This means the agent writes to `OVERDRIVE.md` during execution. Is this a full rewrite of the file each time, or a targeted line edit? For large trees, full rewrites are expensive. Targeted edits require a reliable parser.
Recommendation: write-through cache handles position state; `OVERDRIVE.md` is only fully rewritten at handoff boundaries.

---

## 9. Implementation Plan (Ordered)

When resuming, work through this in order. Do not skip steps — each depends on the previous.

### Phase 1: Foundation (Before Any Command Logic)

1. **Finalize and document `OVERDRIVE.md` format** — produce a 1-page format spec with concrete examples. Answer Q1, Q7.
2. **Define Node schema fully** — answer Q5, finalize status enum, decide success_criteria field.
3. **Build `lib/ovd-plan.js` skeleton** — module structure, exports, test harness.
4. **Build parser: `OVERDRIVE.md` → Node tree** — read Markdown, produce JSON tree. This is the foundation everything else calls.
5. **Build writer: Node tree → `OVERDRIVE.md`** — inverse of parser. Regenerate canonical Markdown from tree.
6. **Build cache: tree → `.overdrive/plan.cache.json`** — write-through cache layer.
7. **Register commands in `bin/overdrive.js`** — `plan`, `go`, `log` subcommands wired to `lib/ovd-plan.js`.

### Phase 2: `/ovd-plan` 

8. **Default display** — read tree, render visual status view to terminal.
9. **New project pipeline** — codebase scan → deliberation → tree creation → skill annotation.
10. **Continuation planning pipeline** — read `deliberation_state`, resume dialogue.
11. **Idea pipeline** — accept text input, impact analysis, edit if approved.
12. **Edit pipeline** — structured tree modifications.

### Phase 3: `/ovd-go`

13. **Skill pre-loading** — answer Q3, implement the chosen mechanism.
14. **Basic execution loop** — pick active node, execute, mark done, advance.
15. **Auto-verification** — implement per-skill verification behavior.
16. **Decision point surfacing** — detect ambiguity/blocks, surface to user cleanly.
17. **Node-ref targeting** — `/ovd-go <ref>` with fuzzy matching.

### Phase 4: `/ovd-log`

18. **Inbox** — default view of captured items.
19. **Quick capture** — `/ovd-log "text"` → append to inbox section of OVERDRIVE.md.
20. **Handoff pipeline** — full sequence (summarise → update → follow-ups → docs → commit → print).
21. **Milestone-complete detection** — extend handoff pipeline when milestone is fully done.

### Phase 5: Integration and Polish

22. **Verify `/ovd-plan` correctly reads handoff from `/ovd-log`** — the session loop works end-to-end.
23. **Install integration** — register `OVERDRIVE.md` in `.gitignore` exclusion? No — it should be committed. Ensure `.overdrive/plan.cache.json` is gitignored.
24. **Global instruction update** — add a brief note to `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` managed block: "If `OVERDRIVE.md` exists in the project, treat it as the primary project context and current task source."
25. **Verify command** — add `ovd-plan` checks to `overdrive verify` and `verify.sh`.
26. **Tests** — `scripts/test-ovd-plan.js` covering parser, writer, cache, and each pipeline's state transitions.

---

## 10. What to Do When Resuming

**Opening context:**
- Read this document first
- Read `docs/superpowers/specs/2026-06-06-ovd-plan-design.md` for the original decisions/ambiguities record
- Branch is `feature/ovd-plan`. Nothing is committed yet.

**Immediate next steps:**
1. Resolve the P0 questions (Section 8) — especially Q1 (OVERDRIVE.md format) and Q3 (skill annotation mechanism). These block everything else.
2. Once Q1 is resolved, write the format spec as a concrete example document.
3. Then begin Phase 1 implementation.

**Do not begin writing `lib/ovd-plan.js` until Q1 and Q3 are resolved.** The parser and skill-loading mechanism are the two foundational pieces everything else depends on.

---

*This document is the complete design record as of 2026-06-06. Nothing here has been implemented. Everything in the "Proposed" sections is a proposal, not a decision. Check with the user before treating proposals as confirmed.*
