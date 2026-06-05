# ovd-workflow

ovd-workflow is Overdrive's lightweight project-state layer.

Skills teach agents how to do specialist work. ovd-workflow helps them remember what is happening in the current project without loading a giant pile of context.

## What It Creates

On the first meaningful project task, supported agents may create:

```text
.overdrive/
  project.md
  state.md
  architecture.md
  constraints.md
  decisions.md
  preferences.md
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

The folder is local runtime state. The installer adds `.overdrive/` and the legacy `.agenticsupercharge/` path to `.gitignore` when it initializes the workflow.

## Migration From AgenticSupercharge

Overdrive v1 keeps migration deliberately conservative:

- `.overdrive/` is the new canonical project-state folder.
- If `.agenticsupercharge/` exists and `.overdrive/` does not, Overdrive copies the legacy folder into `.overdrive/` on install for the active project, on `overdrive migrate --apply`, or on a write action such as `overdrive checkpoint` or `overdrive resync --apply`.
- The old `.agenticsupercharge/` folder is not deleted during the RC.
- Old `.agentic-supercharge.json` markers count as managed, and new writes use `.overdrive.json`.
- `AGENTIC_SUPERCHARGE_WORKFLOW=disabled` still disables workflow writes for compatibility, but `OVERDRIVE_WORKFLOW=disabled` is canonical.

## Commands

Use these from a project folder:

```bash
overdrive status
overdrive doctor
overdrive migrate --dry-run
overdrive migrate --apply
overdrive knowledge --dry-run
overdrive knowledge --apply
overdrive resync --dry-run
overdrive resync --apply
overdrive usage --days 30
overdrive usage --all --json
overdrive checkpoint --message "before refactor"
```

If `overdrive` is not on your `PATH`, installed hooks and slash commands use the persistent runtime shim at:

```text
~/.overdrive/bin/overdrive
```

`ovd` is installed as a short alias where Overdrive installs its runtime shim. The legacy `agentic-supercharge` CLI alias remains available for compatibility and delegates to the new Overdrive runtime.

`overdrive migrate` is dry-run by default. Add `--apply` to copy legacy `.agenticsupercharge/` state into `.overdrive/`. It does not delete the legacy folder.

## How Agents Use It

- Session hooks add a tiny reminder when a workflow already exists.
- Prompt/tool hooks may initialize the folder for non-trivial project work.
- The status line, where supported, shows a compact ovd-workflow health hint.
- `skill-router` can append short route traces to `routes.jsonl` when the workflow exists.
- `usage` can read local Claude Code token logs on demand and join them to route traces when timestamps line up. It reports token counts, cache use, top projects/models/tools, and biggest sessions without printing prompts or message content.
- `preferences.md` records durable user preferences and do-not rules, such as repeated corrections or "never do X" instructions. Keep it short, dated, and free of secrets.
- `research.md` is a short project research log for objective findings, sources, and challenged assumptions.
- `knowledge/` is a local reference-doc vault. Drop project/business docs there, run `overdrive knowledge --apply`, then agents inspect `knowledge-index.json` and load only relevant files or markdown caches.
- Durable product and architecture decisions belong in `decisions.md`; durable user preferences belong in `preferences.md`. If a new statement contradicts recorded state, the agent should surface the conflict before overwriting it.

Hooks are advisory. They must exit successfully, avoid secrets, and never block the agent.

## Slash Commands

Claude Code receives canonical `/ovd-*` commands where slash commands are installed:

- `/ovd-status`
- `/ovd-resync`
- `/ovd-knowledge`
- `/ovd-doctor`
- `/ovd-checkpoint`
- `/ovd-usage`

Legacy `/as-*` aliases remain as managed compatibility commands.

## Knowledge Vault

The knowledge vault is for reference documents the project may need over time: briefs, PDFs, spreadsheets, strategy notes, research exports, client docs, and similar material.

It is deliberately not a codebase indexer, vector database, daemon, or telemetry pipeline.

```text
.overdrive/
  knowledge/
    brief.md
    research.pdf
    pricing.csv
  knowledge-index.json
```

`overdrive knowledge --apply` scans the vault, hashes files, records structural metadata, and converts supported non-Markdown files into cached Markdown when MarkItDown or a safe text fallback is available. The CLI cannot generate AI summaries; agents can fill the `summary` and `topics` fields later when useful.

The intended use is cheap lookup first:

1. Read `knowledge-index.json`.
2. Pick the specific relevant file or `markdownCache`.
3. Load only that file.
4. Keep summaries short and current when they are genuinely useful.

## Preferences

`preferences.md` is the lightweight "please do not repeat this" file.

Use it when the user:

- says they dislike a behavior or output style,
- says "never do X",
- repeats the same correction,
- shows clear frustration about a pattern the agent can avoid.

Do not use it for secrets, credentials, private personal data, temporary mood, or project facts that belong in `state.md`, `constraints.md`, or `decisions.md`. If a preference contradicts an existing decision or constraint, ask before recording it.

## Disable It

Set:

```bash
OVERDRIVE_WORKFLOW=disabled
```

This disables workflow hook/init behavior for that process.

Legacy compatibility:

```bash
AGENTIC_SUPERCHARGE_WORKFLOW=disabled
```

## What It Is Not

- Not a cloud service.
- Not a replacement for tests, reviews, or clear prompts.
- Not a full codebase indexer.
- Not a semantic search engine or embeddings database.
- Not committed to your repo by default.
- Not connected to removed third-party workflow runtimes or raw third-party runtime files.
