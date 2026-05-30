# AS-Workflow

AS-Workflow is AgenticSupercharge's lightweight project-state layer.

Skills teach agents how to do specialist work. AS-Workflow helps them remember what is happening in the current project without loading a giant pile of context.

## What It Creates

On the first meaningful project task, supported agents may create:

```text
.agenticsupercharge/
  project.md
  state.md
  architecture.md
  constraints.md
  decisions.md
  research.md
  changelog.md
  config.json
  file-index.json
  routes.jsonl
  reports/
  handoffs/
  work/
    _active.json
```

The folder is local runtime state. The installer adds `.agenticsupercharge/` to `.gitignore` when it initializes the workflow.

## Commands

Use these from a project folder:

```bash
agentic-supercharge status
agentic-supercharge doctor
agentic-supercharge resync --dry-run
agentic-supercharge resync --apply
agentic-supercharge checkpoint --message "before refactor"
```

If `agentic-supercharge` is not on your `PATH`, installed hooks and slash commands use the persistent runtime shim at:

```text
~/.agentic-supercharge/bin/agentic-supercharge
```

## How Agents Use It

- Session hooks add a tiny reminder when a workflow already exists.
- Prompt/tool hooks may initialize the folder for non-trivial project work.
- The status line, where supported, shows a compact AS-Workflow health hint.
- `skill-router` can append short route traces to `routes.jsonl` when the workflow exists.
- `research.md` is a short project research log for objective findings, sources, and challenged assumptions.
- Durable user preferences and decisions belong in `decisions.md`; if a new statement contradicts recorded state, the agent should surface the conflict before overwriting it.

Hooks are advisory. They must exit successfully, avoid secrets, and never block the agent.

## Disable It

Set:

```bash
AGENTIC_SUPERCHARGE_WORKFLOW=disabled
```

This disables workflow hook/init behavior for that process.

## What It Is Not

- Not a cloud service.
- Not a replacement for tests, reviews, or clear prompts.
- Not a full codebase indexer.
- Not committed to your repo by default.
- Not connected to removed third-party workflow runtimes or raw third-party runtime files.
