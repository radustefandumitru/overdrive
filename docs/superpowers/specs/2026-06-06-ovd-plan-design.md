# ovd-plan: Project & State Management for Overdrive

**Date:** 2026-06-06
**Branch:** `feature/ovd-plan`
**Status:** Design — not yet approved for implementation

---

## Purpose

Overdrive has a strong execution-level capability layer (137 skills, skill-router, global operating guide) but no structured project and state management system. This document designs `ovd-plan`: a persistent, fault-tolerant, Apple-like project and state management extension that lives entirely within Overdrive's existing infrastructure, uses only Overdrive's existing execution-level skills, and adds the structural layer that Overdrive is currently missing.

The execution layer is not being redesigned. Skills, skill-router, ovd-workflow, and the global operating guide remain exactly as they are. `ovd-plan` adds structure on top.

---

## What Was Decided (Precise)

### 1. The Core Concept

`ovd-plan` is a **recursive tree-based project management system** where:

- Every node in the tree is the **same first-class object** — there are no fixed levels (not "you must have a milestone before a phase"). A node can represent a project, a milestone, a feature, a task, a step, or any other unit of work the agent and user agree on.
- The **type/label of each node** is determined by the agent during planning conversation, not by a fixed schema. The agent assigns labels in plain language appropriate to the user's mental model.
- The **depth of the tree is unlimited** and flexible. A node can have zero children (it is a leaf — directly executable) or any number of children (it is a container — broken down further).
- The **project is the root node**. All work is a subtree of this root.
- Leaf nodes are the units of execution. Non-leaf nodes are the units of planning and organization.

### 2. State Storage — Auto-Detection

Storage location is determined automatically, with zero user configuration:

| Condition | Canonical state | Local cache |
|---|---|---|
| Git repository detected | `OVERDRIVE.md` at repo root, committed to git | `.overdrive/plan.cache.json`, gitignored |
| No git repository | `OVERDRIVE.md` in current working directory | `.overdrive/plan.cache.json` |

Rules:
- `OVERDRIVE.md` is always the **single source of truth**. It is human-readable Markdown.
- `.overdrive/plan.cache.json` is a **write-through performance cache** for CLI operations. It is derived from `OVERDRIVE.md` and can be regenerated from it at any time.
- The user **never needs to know** the cache exists. It is never surfaced in normal operation.
- If git is detected, `OVERDRIVE.md` is committed automatically when state changes (via `ovd stop` or explicit plan saves). The agent does not auto-commit on every single state update during a session — only at session boundaries and explicit save points.
- **Ambiguous:** Exactly when during a session `OVERDRIVE.md` is written to disk vs held in memory is not yet decided. This affects how frequently the file on disk reflects the true current state.

### 3. Architecture — Approach B

`ovd-plan` is implemented as a **new, standalone module**:

- `lib/ovd-plan.js` — new module, separate from `lib/ovd-workflow.js`
- Registered in the same `bin/overdrive.js` entry point and `overdrive` CLI
- `ovd-workflow` is **not modified** or extended
- The two modules coexist: `ovd-workflow` manages session state, preferences, decisions; `ovd-plan` manages the project tree

The canonical file `OVERDRIVE.md` is **human-readable Markdown**. A person can open it in any editor, read the full plan, and understand where the project is — without running any command.

### 4. Planning Mode — Agent Behavior (Decided)

When the user initiates planning on a new project:

1. The agent **silently scans the codebase** (if one exists) to gather context. This context informs the agent but does **not** drive the plan. The codebase scan is a background context provider, not a plan generator.
2. The agent **starts a Socratic dialogue** with the user. It assesses how much the user has already thought through and matches its language and depth to the user's understanding level.
3. The agent **leads the conversation** — it is the orchestrator. It asks questions, elicits the user's vision, surfaces gaps the user did not anticipate (trade-offs, dependencies, technical aspects, edge cases, testing needs, security, scalability, etc.).
4. Everything is **presented in plain language**, regardless of technical complexity. The agent adapts vocabulary to the user.
5. The agent **proposes a full tree** based on the elicited information, presented to the user for review.
6. Planning can span **multiple sessions**. Each session picks up where the last left off. The plan-in-progress is persisted between deliberation sessions.
7. The user can **always adjust** — add nodes, remove nodes, reorder, reframe — at any point, both during initial planning and after execution has started.

### 5. Skill Annotation Per Node (Decided in Principle)

During planning, the agent annotates each node with **predicted OVD skills**. For leaf nodes (units of execution), this annotation is the agent's assessment of which Overdrive skills will most likely be needed to execute that task.

Effect at execution time:
- When the agent reaches a node for execution, it reads the node's skill annotations.
- These annotations **pre-prime the skill router** — instead of running skill-router cold against all 137 skills, the router operates with a narrowed, pre-selected starting set.
- The full skill-router can still override or extend this set if the task reveals unexpected complexity.
- This reduces context bloat: fewer irrelevant skills are loaded per task.

**Ambiguous:**
- The exact mechanism by which skill annotations are "fed" to the agent at execution time is not yet decided. Options include: the agent reading the node's metadata and manually loading those SKILL.md files, the node metadata being injected into the system prompt, or the skill-router being given the annotation as a strong hint. These have different implementation costs and different levels of integration with the existing router.
- Whether non-leaf (container) nodes also carry skill annotations or only leaf nodes.
- Whether skill annotations are set exclusively by the agent, or the user can also specify them.

### 6. Execution Model — Session Behavior (Decided)

During an active work session:

- The agent **works autonomously** on individual leaf tasks.
- The agent **always keeps the user oriented** — it surfaces what it just did, where it is in the tree, and what it plans to do next.
- The tree is the **live source of truth** during execution. The user can open `OVERDRIVE.md` at any time and see the current state.
- The agent **does not run fully without any human touchpoint**. It stops at decision points: genuine ambiguity, a task that requires user input, a task where the planned approach doesn't work, or a natural checkpoint.
- The user can **interrupt at any time** and redirect, adjust the plan, or stop the session.
- The execution order follows the tree by default (depth-first, left-to-right through children). **Ambiguous:** whether the user can specify a different traversal order, or skip to a specific node, via a simple command.

### 7. Target User (Decided)

`ovd-plan` is designed for users with limited coding experience who want a **single, complete system** for any project. The design constraints:

- At most **7 commands** to memorize for normal operation.
- No edge cases surfaced to the user in typical use.
- Everything flows into the next thing — no manual state transitions.
- Plain language at all times.
- The user should not need to understand the underlying file structure, cache, or skill routing to use the system effectively.

### 8. UX Aesthetic — Apple-like (Decided in Principle)

"Apple-like" was the user's term, and it implies specific design principles:

- **One primary action per command** — no flags required for the common case.
- **The system does the right thing by default** — the user does not need to configure it to work.
- **Progressive disclosure** — simple surface, depth available when the user asks for it.
- **No machinery visible** — the user sees the plan and the work, not the file operations happening underneath.
- **Consistent mental model** — the same interaction pattern regardless of which command is running.
- **Graceful recovery** — if something goes wrong, the path back is obvious and does not require understanding internals.

---

## What Is Ambiguous (Precise List)

The following points were **not resolved** in the design conversation. They need decisions before implementation begins. I have noted what is known and what is genuinely open.

### A. The Exact 7 Commands

We discussed candidate commands but the user did not confirm the final set. The candidates discussed were:

| Command | Candidate behavior |
|---|---|
| `ovd` | Smart entry point — does the right thing based on current state |
| `ovd plan` | Enter planning/management mode — create tree if none, view/edit if exists |
| `ovd go [target]` | Start or resume execution |
| `ovd stop` | Pause session, commit state, create handoff |
| `ovd done` | Mark current task done, advance |
| `ovd fix "description"` | Ad-hoc modification to the plan mid-flight |
| `ovd status` | Print current tree state and orientation |

**Open:** Are these the right 7? Are any redundant (e.g. does `ovd` subsume `ovd status`)? Is `ovd fix` too complex to be a single command or is it the right abstraction? Nothing here is confirmed.

### B. The Exact Format of OVERDRIVE.md

The canonical file format was described as "human-readable Markdown" but the specific structure is not yet designed. Open questions:

- How are node levels represented? (ATX headers `#`/`##`/`###`? Indented checkbox lists `- [ ]`? A mix?)
- How are skill annotations embedded? (As a frontmatter block? As inline HTML comments? As a structured sub-list under each node?)
- How is "current focus" / "in-progress" marked so it's visually obvious to a human opening the file?
- How are blockers, notes, and agent decisions attached to nodes?
- What does a node with no children look like vs a node with children?

A rough conceptual sketch was discussed (headers + status markers + skills as metadata) but no format was approved.

### C. The Exact Node Schema

What properties does a single tree node have? Known properties:

- `title` — the name of the node
- `status` — some form of progress state (pending / in-progress / done / blocked / skipped — exact enum not decided)
- `children` — list of child nodes (zero = leaf)
- `skills` — predicted OVD skill names

Open:
- Does a node have a `description`? If so, how long can it be?
- Does a node have `decisions` (agent conclusions reached while working on it)?
- Does a node have a `session_log` (which sessions touched it)?
- Does a node have `blockers` (and if so, what shape do they take)?
- Does a node have an `id`? If so, what format? (Needed for the CLI to target specific nodes)
- Does a node have a `type`/`label` field, or is the label just part of the title?

### D. Multi-Session Planning ("Deliberation Sessions")

The user described planning as potentially spanning multiple conversations — the agent returns to deliberation, refines the plan, deepens it. How this works mechanically is not decided:

- What state is persisted between deliberation sessions to let the agent know it is in an ongoing planning conversation (not a new one)?
- What signals "planning is complete" and transitions to execution mode? (User explicitly says so? Agent proposes it? A specific command?)
- Can execution and planning interleave? (i.e. can the user execute some tasks, then go back and re-plan others, then execute again?) This was implied but not confirmed.

### E. `ovd stop` — Exact Behavior

The user described a "single command for stopping to document everything before clearing the context and resuming afterwards." What exactly happens is not specified:

- What does it write to disk? (Session summary? Decisions made? Tasks completed? Agent's last action?)
- Does it commit `OVERDRIVE.md` to git at this point?
- Does it write a handoff document (like `ovd-workflow`'s `handoffs/`)? If so, what format?
- What does `ovd go` or `ovd resume` read back to restore the session? What is the minimum required for a human or agent to pick up exactly where they left off?

### F. Verification Flow Out of Execution

The user mentioned "verification from the execution" — verification should flow naturally out of execution, not be a separate remembered step. But the mechanism is not defined:

- Does each leaf node automatically trigger a verification step after the agent completes it?
- Who defines what "done" means for a node? (The agent? The user during planning? A standard checklist?)
- Does verification use Overdrive's existing verification-oriented skills (playwright-cli, security-review, etc.) if they are in the node's skill annotations?
- What happens if verification fails? (Agent attempts fix? Marks node as blocked? Escalates to user?)

### G. `ovd fix` — Scope

The user confirmed plan adjustments should always be possible, but "fix" as a command concept is vague:

- Does `ovd fix` modify the plan tree? (restructure nodes, change descriptions, add/remove tasks)
- Does it modify what the agent is currently doing within a task? (redirect mid-execution)
- Does it do both based on what the user describes?
- Or should "adjusting the plan" just happen through the planning mode (`ovd plan`) rather than a separate command?

### H. Skill Annotation Mechanism

(See section 5 above.) The principle is decided; the mechanism is not. This is a high-impact technical decision because it determines how deeply `ovd-plan` integrates with the existing skill-router.

### I. How `ovd go` Selects the Next Task

When the user runs `ovd go` without specifying a target:

- Does it pick up from where the last session left off (last in-progress node)?
- Does it start from the first pending leaf in the tree?
- Does it ask the user which branch to start with?
- Does the agent decide based on dependency ordering?

### J. Relationship to `ovd-workflow`

`ovd-plan` and `ovd-workflow` will coexist in the same project. Their responsibilities overlap in one area: session state. `ovd-workflow` writes `state.md`, `decisions.md`, `preferences.md`. `ovd-plan` writes `OVERDRIVE.md` with similar information attached to nodes.

- Is there intentional duplication, or do they split responsibilities?
- Does `ovd stop` write to both systems?
- Does `ovd-workflow`'s `preferences.md` feed into planning decisions (e.g., "never use library X" should be visible to the planner)?
- Or are these treated as fully separate systems with no cross-reads?

---

## What This System Is Not (Decided)

- It is **not a replacement for Overdrive's execution skills**. The 137 skills, skill-router, and global operating guide are untouched.
- It is **not a team collaboration tool** (no real-time sync, no conflict resolution for concurrent edits).
- It is **not a replacement for git** (it does not manage branches, commits, or PRs — it uses git only as a persistence layer for `OVERDRIVE.md`).
- It is **not cloud-connected** — no telemetry, no remote state, consistent with Overdrive's existing privacy model.
- It is **not a fixed-schema system**. The hierarchy depth and node labeling are always determined by the agent and user together, never by the system.

---

## Open Design Work Required Before Implementation

The following design decisions need to be made before writing any code. In rough priority order:

1. **Confirm the 7 commands** — exact names and responsibilities
2. **Design the `OVERDRIVE.md` file format** — with concrete examples of a real project tree in this format
3. **Define the node schema** — all properties, their types, and which are required vs optional
4. **Define `ovd stop` and `ovd go` resume protocol** — exact handoff format
5. **Decide the skill annotation mechanism** — how annotations feed into execution
6. **Define the planning → execution transition** — what signals completion of deliberation
7. **Define verification trigger and failure behavior**
8. **Clarify `ovd fix` scope**
9. **Resolve `ovd-plan` vs `ovd-workflow` boundary**

---

## Implementation Scope (Agreed)

- New branch: `feature/ovd-plan` ✓ (already created)
- New module: `lib/ovd-plan.js` (to be created)
- New canonical file: `OVERDRIVE.md` at project root (created by the system on first use)
- New cache: `.overdrive/plan.cache.json` (write-through, auto-regeneratable)
- CLI integration: new commands registered in `bin/overdrive.js`
- No modifications to: `lib/installer.js`, `lib/ovd-workflow.js`, any skill files, any global instruction files
- The existing Overdrive execution layer (skills + router + global guide) is the **assumed substrate** — `ovd-plan` consumes it, does not replace it

---

*This document records the design conversation as of 2026-06-06. Anything marked **Ambiguous** must be resolved before implementation begins. Nothing in the "What Was Decided" sections should be re-litigated without noting that a decision has changed and why.*
