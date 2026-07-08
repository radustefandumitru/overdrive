# Overdrive v2: the structural layer

> **Status:** shipped in v2.0.0. All seven implementation phases are complete: `/ovd-workflow`, `/ovd-plan`, `/ovd-go`, `/ovd-log`, intent detection, `overdrive verify --plan`, cross-pipeline smoke coverage, and global-instruction discoverability. The release passed local checks plus an independent pre-release audit. This document is the public-facing introduction; full design records live in [`docs/superpowers/specs/`](superpowers/specs/).

---

## What v1 already does, and what was missing

Overdrive v1 is the **execution layer** for AI coding agents:

- 160 specialist skills covering frontend design, animation, security, SEO, research, launch, prompt engineering, codebase intelligence, and more.
- `skill-router` chooses the right skills per request without loading the whole catalog.
- Global operating guide, based on Andrej Karpathy's Claude system prompt and adapted to fit Overdrive, instructs agents to plan, verify, watch context budget, use current docs.
- `ovd-workflow`, the project state management system, persists project state (`.overdrive/project.md`, `state.md`, `decisions.md`, etc.) so agents remember active work, decisions, and constraints.
- Installer keeps sources pinned and updates safe.

This is excellent at *doing* the work in front of the agent. What it doesn't do: **structure a project beyond the current request**. There's no milestone, no phase, no contract, no recursive closure, no handoff that survives a context clear with intent intact. Each session is mostly request-scoped; project memory exists but is unstructured prose.

The closest comparable pattern is a structured project/milestone/phase/task hierarchy. Overdrive already has skills and routing; v2 adds the durable project structure around them.

## What v2 adds (in one paragraph)

Four user-facing commands, each a state machine with many internal states. A recursive tree at the project root (`OVERDRIVE.md`) where every leaf is a self-contained **contract**: scope, skills, success criteria, dependencies, verification method, optional sketches. Planning consults the skill-router once per leaf so execution never re-routes cold. Leaves never auto-complete; explicit user approval (or equivalent signal) closes a leaf. Closure walks recursively up the tree, asking the user at every level. Context persistence is invisible: a lightweight save before context clear; an orient-and-continue on resume. The user types four commands; the agent absorbs the complexity.

## The four commands

```
/ovd-workflow [init|map|preferences|requirements]
/ovd-plan     [deliberate|research|create|edit|idea "text"]
/ovd-go       [verify|<node-ref>|test <node-ref>|--small ["desc"]]
/ovd-log      [handoff|capture "text"|concerns]
```

Default form of each command is the most-used path:

- `/ovd-workflow` (bare) → tutorial + status + action-path next steps. On a fresh project, walks you through codebase mapping, preferences, and requirements with explicit approval at each step.
- `/ovd-plan` (bare) → visual tree display + state + action-path next steps. Specific flags enter deliberation, research, structural edit, or idea analysis.
- `/ovd-go` (bare) → orient + continue. Reads the active leaf and the most recent session/handoff file, presents an overview of where you were, lists the directions you can take, and waits for your reply.
- `/ovd-log` (bare) → lightweight save. Captures the active conversation, updates state and docs, writes a session file, walks the closure tree asking your approval at every level. `/ovd-log handoff` runs the full end-of-session pipeline with milestone-close detection.

The full design lives in [`docs/superpowers/specs/2026-06-08-ovd-plan-pipeline-architecture-r3.md`](superpowers/specs/2026-06-08-ovd-plan-pipeline-architecture-r3.md).

## What the project file structure looks like

```
project-root/
├── OVERDRIVE.md                              # plan tree (human-readable)
└── .overdrive/
    ├── codebase/
    │   ├── architecture.md                   # system structure, module boundaries
    │   ├── patterns.md                       # recurring conventions
    │   ├── tech-stack.md                     # frameworks, build chain
    │   ├── quality.md                        # test coverage, type discipline
    │   └── concerns.md                       # pre-existing risks
    ├── requirements.md
    ├── preferences.md
    ├── decisions.md
    ├── handoffs/YYYY-MM-DD-HH-MM.md
    ├── sessions/YYYY-MM-DD-HH-MM.md
    ├── sketches/                             # throwaway mockups
    │   └── approved/                         # promoted, referenced by leaves
    ├── reports/                              # milestone summaries
    └── plan.cache.json                       # internal (gitignored)
```

The default git policy carves out the team-shareable paths (`OVERDRIVE.md`, `codebase/`, `requirements.md`, `preferences.md`, `decisions.md`, `handoffs/`, `reports/`, `sketches/approved/`) and ignores the local-only ones (`sessions/`, unapproved `sketches/`, `plan.cache.json`). Cloning the repo on a new machine gives the next collaborator the plan + analysis + decisions + preferences, not your local session history.

## What an `OVERDRIVE.md` looks like

```markdown
---
ovd-plan: true
version: 3
project: "Foo Dashboard"
deliberation_status: executing
active_node: "II.2.a"
current_milestone: "II. Dashboard"
session_count: 4
---

# Foo Dashboard

## I. Foundation [done]
### I.1 Project scaffolding [done]
### I.2 Database schema [done]
### I.3 Auth middleware [done]

## II. Dashboard [in-progress]

### II.1 Navigation [done]

### II.2 Stats widgets [in-progress]

#### II.2.a Widget layout design [awaiting-review] ← ACTIVE

Design the grid layout and visual hierarchy. Three sizes, responsive at 768/1024px breakpoints.

​```yaml ovd-plan
skills: [design-taste-frontend, impeccable]
confidence: high
rationale: "UI design with clear visual specification"
considered: [emil-design-eng, fluid-animations]
scope:
  in: [src/components/Dashboard/, src/styles/grid.css]
  read_only: [src/components/Card.tsx]
  out: [data fetching, animations]
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
  sketches: [.overdrive/sketches/approved/2026-06-08-widget-layout.html]
inserted_by: user
​```

#### II.2.b Data fetching layer []
```

Tree depth is unbounded. IDs are position-derived using a hierarchical short notation: Roman → Arabic → lowercase letter → lowercase Roman → uppercase letter (`I` → `II.3` → `II.3.b` → `II.3.b.iv` → `II.3.b.iv.A`). Status markers in `[brackets]` after the title; `← ACTIVE` flags the current execution position. Structured fields live in a fenced `yaml ovd-plan` block per node, with deterministic field ordering for diff-friendly output.

A note on naming: a **leaf** is the smallest meaningful modular unit of work in the current plan, the bottom-level implementable node. Overdrive avoids words like task, step, phase, or action because they imply a fixed hierarchy. The structure above a leaf is yours to shape: features, milestones, systems, pages, user flows, bugs, experiments. v2 is a flexible project state management system, not a rigid task manager.

## The new statuses

Leaves move through six possible statuses:

- **pending**: not yet started (rendered as `[]`).
- **in-progress**: actively being worked on.
- **awaiting-review**: implementation complete + auto-verify passed, but no user approval yet. The leaf is held here until you reply `approved` (or equivalent: `ship`, `done`, `next`) or describe changes to iterate.
- **done**: user has explicitly approved.
- **blocked**: can't proceed (missing input, external dependency, planned approach fails).
- **skipped**: user opted out.

The `awaiting-review` state is the operational heart of v2. Iteration is the default; auto-completion is never assumed. The agent works autonomously through implementation + verification, then pauses for explicit user confirmation. This eliminates the "the agent thinks it's done but the user hates the result" failure mode that plagues fast-autonomous setups.

## Closure is recursive

When you approve a leaf, the system walks up the tree:

1. Is the parent cluster fully done? If yes, ask: *"That closes II.2 (Stats widgets) — all three leaves marked done. Verify, close, or hold?"*
2. If you close the cluster, check the grandparent (the milestone). Same prompt.
3. Continue until a parent has open siblings, OR you reach the project root.

Each level requires explicit approval. The same closure pattern applies to every level of the tree, not just milestones.

## The skill-router becomes a planning-time consultant

In v1, every non-trivial request consults `skill-router` cold: the 21KB `SKILL.md` is loaded and the agent uses it to pick the right skills per task. In v2, the consultation happens **once per leaf during planning**. The planner asks the router for the prior skill set, the agent confirms confidence (high/medium/low), and the result writes into the leaf's YAML annotation as a `skills:` list.

At execution time:
- `confidence: high` → no router consultation. Agent loads the named skills and executes.
- `confidence: medium` → router consultation only if the agent observes a need outside the prior. Additions logged as `skill-delta`.
- `confidence: low` → full execution-time consultation.

Net effect: dramatically fewer cold routing passes, no per-session catalog loading, and the planner gets better at picking skills over time (deltas feed `LEARNINGS EXTRACT` at milestone close).

The router's `SKILL.md` gets one new section documenting the planning-time / execution-time protocol. No existing rules touched; the router benchmark (269 checks, 100% expected-skill coverage) continues to pass.

## How v2 relates to your existing Overdrive setup

If you have an existing `.overdrive/` layout from v1 (`project.md`, `state.md`, `architecture.md`, `constraints.md`, `decisions.md`, `preferences.md`, `research.md`, `changelog.md`, plus `config.json`, `file-index.json`, `knowledge-index.json`, `routes.jsonl`, `work/`, `reports/`, `handoffs/`, `knowledge/`), v2's `/ovd-workflow init` detects it and offers migration:

```
"I see a pre-v2 .overdrive/ layout in this project. Pick one:

 (1) Migrate now — I'll move your existing files to the new structure
     and archive the originals in .overdrive/_legacy/YYYY-MM-DD-HH-MM/.
     One-time, reversible: you can remove _legacy/ after one cycle if
     everything looks right.
 (2) Skip migration — start fresh; old files preserved as-is.
 (3) Other — describe what you want.

 Reply with a number or describe."
```

Migration is **one-time and opt-in**. Nothing is silently rewritten. The migration map (which old file maps where in the new structure, what gets archived, what gets discarded with archive backup) is documented in `docs/superpowers/specs/2026-06-08-ovd-plan-implementation-plan.md` §5A.

Your existing `/ovd-status`, `/ovd-doctor`, `/ovd-checkpoint`, `/ovd-resync`, `/ovd-knowledge` slash commands continue to resolve in v2; they delegate to the new handlers with a one-line deprecation note pointing at the replacement. Muscle memory doesn't break.

## What's untouched

- **The 160 skill files** in `skills/*/SKILL.md` and their references. Hard rule: v2 does not modify any skill.
- **`skill-router`'s existing routing rules.** The new section is purely additive.
- **The installer.** v2 adds new CLI subcommands; nothing existing changes behavior.
- **The hook integration.** New commands can register hooks via the same mechanism.

## Roadmap

Implementation is laid out in seven phases, documented in [`docs/superpowers/specs/2026-06-08-ovd-plan-implementation-plan.md`](superpowers/specs/2026-06-08-ovd-plan-implementation-plan.md):

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation: parser, writer, cache, skill-router helper, CLI skeletons, fixtures | ✓ done |
| 2 | `/ovd-workflow` full repurpose: tutorial, init, 5 parallel codebase mappers, preferences, requirements, drift detection, migration | ✓ done |
| 3 | `/ovd-plan`: Socratic deliberation, blind-spot expansion, idea / edit / research, plan-quality check, RESOLVE SKILLS sub-step | ✓ done |
| 4 | `/ovd-go`: orient default, awaiting-review state + iteration loop, recursive close, --small auto-detect, 2-attempt escalation | ✓ done |
| 5 | `/ovd-log`: lightweight save default, handoff full pipeline, capture, concerns, milestone close + learnings + release prep | ✓ done |
| 6 | Intent detection layer: free-form messages route to the right pipeline; action-path prompts on ambiguity | ✓ done |
| 7 | Polish: cross-pipeline smoke test, global instruction note, `overdrive verify --plan`, comprehensive test suite, README, install hygiene, legacy command repurposing | ✓ done |

Each phase ends with a coherent commit; nothing ships piecemeal.

## Design records

For the full design and discussion history:

- [`2026-06-06-ovd-plan-design.md`](superpowers/specs/2026-06-06-ovd-plan-design.md): original decisions and ambiguities record
- [`2026-06-06-ovd-plan-handoff.md`](superpowers/specs/2026-06-06-ovd-plan-handoff.md): first detailed handoff doc
- [`2026-06-07-ovd-plan-pipeline-architecture.md`](superpowers/specs/2026-06-07-ovd-plan-pipeline-architecture.md): first converged architecture
- [`2026-06-08-ovd-plan-pipeline-architecture-r2.md`](superpowers/specs/2026-06-08-ovd-plan-pipeline-architecture-r2.md): second revision
- **[`2026-06-08-ovd-plan-pipeline-architecture-r3.md`](superpowers/specs/2026-06-08-ovd-plan-pipeline-architecture-r3.md)**: current converged spec (the canonical reference)
- [`2026-06-08-ovd-plan-implementation-plan.md`](superpowers/specs/2026-06-08-ovd-plan-implementation-plan.md): phased implementation plan with running session log

For the comprehensive context-handoff design (preserves conversation nuance across context clears), see [`docs/superpowers/specs/2026-06-06-ovd-plan-handoff.md`](superpowers/specs/2026-06-06-ovd-plan-handoff.md).

## Release status

v2.0.0 shipped after all seven phases were completed and an independent pre-release audit passed (installer safety, state semantics, packaging, licensing, and the full test suite). The v1 surface stays available: the legacy commands delegate to their v2 equivalents with deprecation notes, and existing `.overdrive/` layouts migrate only through the explicit opt-in flow.
