# GSD Routing

Use GSD when the task benefits from persistent project state, phase artifacts, planning discipline, verification, or multi-step execution. Do not use GSD for tiny one-off edits unless the user asks for GSD or the task needs traceability.

Use Context Engineering skills alongside GSD when the problem is context quality, not project lifecycle. GSD owns the workflow; Context Engineering improves the way context, memory, tools, multi-agent boundaries, and evaluation are handled.

## Main Lifecycle

| Intent | Skill |
|---|---|
| Start a new project planning system | `gsd-new-project` |
| Analyze an existing codebase before planning | `gsd-map-codebase` |
| Clarify what a phase should deliver | `gsd-spec-phase` |
| Gather decisions before planning | `gsd-discuss-phase` |
| Create or repair a phase plan | `gsd-plan-phase` |
| Execute a planned phase | `gsd-execute-phase` |
| Validate completed work with UAT | `gsd-verify-work` |
| Create PR / prepare merge | `gsd-ship` |
| Complete/archive a milestone | `gsd-complete-milestone` |
| Start next milestone | `gsd-new-milestone` |
| Resume context later | `gsd-resume-work` |
| Pause with handoff | `gsd-pause-work` |
| Ask "what now?" | `gsd-progress` |
| GSD session is getting long or lossy | `context-compression`, `context-degradation` |
| GSD subagents/workstreams need better boundaries | `multi-agent-patterns`, `filesystem-context` |
| GSD-generated tools or MCPs need design review | `tool-design`, `evaluation` |

## Planning and Review

| Intent | Skill |
|---|---|
| Plan MVP vertical slice | `gsd-mvp-phase` |
| Cross-AI review of plans | `gsd-review` |
| Replan until review concerns converge | `gsd-plan-review-convergence` |
| UI contract for frontend phase | `gsd-ui-phase` |
| AI system contract for AI phase | `gsd-ai-integration-phase` |
| Security verification for completed phase | `gsd-secure-phase` |
| Evaluation coverage review | `gsd-eval-review` |
| Add tests from UAT | `gsd-add-tests` |

## Debugging, Audits, and Maintenance

| Intent | Skill |
|---|---|
| Systematic bug investigation | `gsd-debug` |
| Post-mortem failed workflow | `gsd-forensics` |
| Code review of changed files | `gsd-code-review` |
| Visual/UI audit after implementation | `gsd-ui-review` |
| Milestone audit | `gsd-audit-milestone` |
| Outstanding UAT audit | `gsd-audit-uat` |
| Audit-to-fix execution | `gsd-audit-fix` |
| Fill validation gaps | `gsd-validate-phase` |
| Planning directory health | `gsd-health` |
| Cleanup completed phases | `gsd-cleanup` |
| Safe rollback | `gsd-undo` |
| Update GSD | `gsd-update` |

## Project Knowledge and Operations

| Intent | Skill |
|---|---|
| Capture notes, tasks, ideas | `gsd-capture` |
| Explore idea before committing | `gsd-explore` |
| Spike risky idea | `gsd-spike` |
| Sketch UI idea | `gsd-sketch` |
| Manage phases in roadmap | `gsd-phase` |
| Manage workspaces | `gsd-workspace` |
| Manage parallel workstreams | `gsd-workstreams` |
| Manage context threads | `gsd-thread` |
| Import external plans/docs | `gsd-import`, `gsd-ingest-docs` |
| Update docs from code | `gsd-docs-update` |
| Extract learnings | `gsd-extract-learnings` |
| Build/query project graph | `gsd-graphify` |
| Review GitHub issues/PRs | `gsd-inbox` |
| Project stats | `gsd-stats` |
| Settings/config | `gsd-config`, `gsd-settings` |

## Namespace Routers

The `gsd-ns-*` skills are lightweight GSD namespace routers. Use them only when the user intent is broad and GSD-specific:

- `gsd-ns-workflow`: discuss, plan, execute, verify, progress.
- `gsd-ns-review`: code review, debug, audit, security, eval, UI review.
- `gsd-ns-project`: milestones, project lifecycle, milestone audits, summaries.
- `gsd-ns-context`: codebase mapping, graph, docs, learnings.
- `gsd-ns-ideate`: explore, sketch, spike, spec, capture.
- `gsd-ns-manage`: settings, workspace, workstreams, threads, update, ship, inbox.

## Runtime-Specific GSD Skills

Follow the official GSD installer surface for the current runtime. If a GSD skill exists in the active agent's skill list, it can be routed; if it is missing, use the nearest stable GSD workflow instead. Treat beta/cloud workflows such as `gsd-ultraplan-phase` as optional and ask before using them.

## Fast Path

- Use `gsd-fast` for trivial inline work with GSD conventions.
- Use `gsd-quick` when the task is small but should still have GSD guarantees such as state tracking or validation.
- Avoid full GSD orchestration for simple code edits unless the user asks for it.
- Add `context-compression` or `context-optimization` when the user mentions token usage, context bloat, compaction, or the agent losing the thread.
- Add `filesystem-context` when disk artifacts should carry state between agents/sessions.
- Add `evaluation` or `advanced-evaluation` when the workflow needs measurable quality gates rather than subjective review.

## Source Notes

- GSD: https://github.com/gsd-build/get-shit-done. The routing follows its documented lifecycle: map/new-project, discuss, plan, execute, verify, ship, complete milestone, and start the next milestone.
- GSD advertises support for Claude Code, OpenCode, Gemini CLI, Kilo, Codex, Copilot, Cursor, Windsurf, Antigravity, and other runtimes. This setup installs GSD through the official `get-shit-done-cc` npm installer rather than republishing a stale snapshot.
