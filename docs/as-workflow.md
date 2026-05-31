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
  knowledge-index.json
  routes.jsonl
  knowledge/
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
agentic-supercharge knowledge --dry-run
agentic-supercharge knowledge --apply
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
- `knowledge/` is a local reference-doc vault. Drop project/business docs there, run `agentic-supercharge knowledge --apply`, then agents inspect `knowledge-index.json` and load only relevant files or markdown caches.
- Durable user preferences and decisions belong in `decisions.md`; if a new statement contradicts recorded state, the agent should surface the conflict before overwriting it.

Hooks are advisory. They must exit successfully, avoid secrets, and never block the agent.

## Knowledge Vault

The knowledge vault is for reference documents the project may need over time: briefs, PDFs, spreadsheets, strategy notes, research exports, client docs, and similar material.

It is deliberately not a codebase indexer, vector database, daemon, or telemetry pipeline.

```text
.agenticsupercharge/
  knowledge/
    brief.md
    research.pdf
    pricing.csv
  knowledge-index.json
```

`agentic-supercharge knowledge --apply` scans the vault, hashes files, records structural metadata, and converts supported non-Markdown files into cached Markdown when MarkItDown or a safe text fallback is available. The CLI cannot generate AI summaries; agents can fill the `summary` and `topics` fields later when useful.

The intended use is cheap lookup first:

1. Read `knowledge-index.json`.
2. Pick the specific relevant file or `markdownCache`.
3. Load only that file.
4. Keep summaries short and current when they are genuinely useful.

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
- Not a semantic search engine or embeddings database.
- Not committed to your repo by default.
- Not connected to removed third-party workflow runtimes or raw third-party runtime files.
