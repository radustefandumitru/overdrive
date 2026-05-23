# AgenticSupercharge

AgenticSupercharge is a safe interactive installer for a portable AI coding-agent skill setup. It can install globally across the coding agents you actually have installed, or locally into one project so the project carries its own AI setup.

It currently supports Claude Code, Codex, Gemini CLI, Antigravity, Cursor, and a shared `.agents` skill root.

## Quick Start

From a cloned repo or unzipped folder:

```bash
./install.sh
./verify.sh
```

Preview first without changing anything:

```bash
./install.sh --dry-run
```

Run from GitHub with `npx` once this repo is published:

```bash
npx -y github:radustefandumitru/AgenticSupercharge -- --dry-run
npx -y github:radustefandumitru/AgenticSupercharge
```

Restart or reload your coding agents after installing so they re-index the skill folders.

## Which Install Should I Choose?

| Choice | What it does | Best for |
|---|---|---|
| Local project install | Creates project-local `.agents/skills`, `.cursor/skills`, `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` in the selected project. | A repo that should carry its own AI setup for teammates or future sessions. |
| Global machine install | Installs into global skill folders for detected or selected coding agents. | Making the skills available in all projects on your machine. |
| Dry run | Shows exactly what would happen and reports conflicts. | Checking safety before writing anything. |

The interactive installer asks for the scope first, then explains the target paths and conflict policy before writing files.

## Global Target Options

For global installs, the first option is:

```text
Scan and install for available coding agents
```

That is the recommended default. It checks your machine and installs only for detected tools. You can also choose exact targets manually if you want to skip a detected tool or prepare a config folder for a tool you plan to install.

Detection checks common CLI commands, app/config folders, and existing skill roots. Gemini CLI is treated separately from Antigravity: a real `gemini` command or existing `~/.gemini/skills` root counts as Gemini CLI, while Antigravity uses `~/.gemini/config/skills`.

| Target | Global skills path | Global instruction path |
|---|---|---|
| Claude Code | `~/.claude/skills` | `~/.claude/CLAUDE.md` |
| Codex | `~/.codex/skills` | `~/.codex/AGENTS.md` |
| Gemini CLI | `~/.gemini/skills` | `~/.gemini/GEMINI.md` |
| Antigravity | `~/.gemini/config/skills` | `~/.gemini/GEMINI.md` |
| Cursor | `~/.cursor/skills` | Cursor reads skill folders directly; no global instruction file is written. |
| Shared `.agents` | `~/.agents/skills` | Shared skill root only. |

Cursor note: custom personal Cursor skills belong in `~/.cursor/skills`; project Cursor skills belong in `.cursor/skills`. `~/.cursor/skills-cursor` is reserved for Cursor itself and this installer does not write there.

Antigravity note: Antigravity uses the `.gemini` config convention for its agent shell. Even when the selected model is Claude/Sonnet, Antigravity reads `~/.gemini/GEMINI.md`, not `~/.claude/CLAUDE.md`.

## Conflict Policy

AgenticSupercharge is non-destructive by default. Installed skill folders get a `.agentic-supercharge.json` marker so future runs can tell which folders are managed by this kit.

| Policy | Behavior |
|---|---|
| `preserve` | Default. Install missing skills, update AgenticSupercharge-managed skills, and skip unmarked existing skill folders with a clear message. |
| `backup-and-replace` | Move existing matching skill folders to `~/.agentic-supercharge/backups/...` before replacing them. |
| `replace-managed-only` | Replace only folders that already contain the AgenticSupercharge marker. Skip unmarked folders. |
| `force` | Replace matching skill folders even if unmarked. This requires an explicit flag or interactive confirmation. |

Managed instruction files are handled differently: the installer updates only the delimited AgenticSupercharge block and preserves user content outside that block.

## Useful Commands

Interactive install:

```bash
./install.sh
```

List detected tools and target paths:

```bash
./install.sh --list-targets
```

Global automatic install with the safe default conflict policy:

```bash
./install.sh --scope global --tools auto --conflict preserve
```

Global install for selected tools only:

```bash
./install.sh --scope global --tools cursor,codex --conflict backup-and-replace
```

Local project install:

```bash
./install.sh --scope local --project-dir . --conflict preserve
```

Update only previously managed folders:

```bash
./update.sh
```

Verify current installation:

```bash
./verify.sh
```

## What The Installer Does

`install.sh` is a small wrapper around the shared Node installer in `bin/agentic-supercharge.js` and `lib/installer.js`. The same core runs for shell installs, zip installs, and GitHub `npx` installs.

The script:

1. Asks whether to install locally or globally, unless flags already specify it.
2. For global installs, detects installed coding agents or lets the user choose exact targets.
3. Explains the target paths and conflict policy.
4. Pulls approved upstream skills from `manifest.json`.
5. Installs local AgenticSupercharge skills from `skills/`.
6. Optionally runs official installer-backed sources such as GSD and Playwright CLI.
7. Copies skills into selected target roots using the chosen conflict policy.
8. Writes `.agentic-supercharge.json` markers into managed skill folders.
9. Upserts managed instruction blocks into `CLAUDE.md`, `AGENTS.md`, and `GEMINI.md` where relevant.
10. Writes `sources.lock.json` after real installs with source metadata and install results.

`verify.sh` checks expected skills, YAML frontmatter, managed instruction blocks, forbidden bulk automation folders, broken symlinks, router smoke prompts, and non-Claude GSD path leakage.

## Included Skills

The exact install set is defined in `manifest.json` and summarized in `SKILLS_SUMMARY.md`.

The main families are:

- AgenticSupercharge local skills: `skill-router`, `fluid-animations`, `emil-animation-polish`, and the Jack Roberts inspired premium 3D website workflow skills.
- Frontend/design taste and polish skills from Taste Skill, Impeccable, Emil Kowalski, and Google Modern Web Guidance.
- GSD project workflow skills installed through the official `get-shit-done-cc` installer.
- Context engineering skills by Muratcan Koylan.
- Marketing skills by Corey Haines.
- Stop Slop for removing generic AI writing tells.
- Banana Claude for image-generation workflows.
- Obsidian skills by Kepano.
- A curated public-safe subset of Composio's awesome Claude skills.
- Remotion best practices.
- Playwright CLI browser automation skill through the official Playwright installer.

`skill-router` is the routing layer. The global instruction templates tell agents to consult it as a lightweight preflight for non-trivial work, then load only the smallest useful skill set.

## What This Will Never Copy

The installer does not copy or publish:

- API keys, OAuth tokens, service-role keys, database URLs, or connection strings.
- MCP configs containing secrets.
- Browser profiles, app sessions, account cookies, or login state.
- GitHub, Vercel, Supabase, Firecrawl, Google, or other personal account credentials.
- Jack Roberts raw PDFs, zips, templates, downloaded resource folders, or private course/community material.
- `~/.cursor/skills-cursor`.

Context7 is the only public-standard MCP recommendation in this kit. Other MCPs and connectors are intentionally left to each user and project.

## Publishing To GitHub

The public repo already created for this is:

[radustefandumitru/AgenticSupercharge](https://github.com/radustefandumitru/AgenticSupercharge)

First-time publish from this folder:

```bash
git init
git add .
git commit -m "Initial AgenticSupercharge installer"
git branch -M main
git remote add origin https://github.com/radustefandumitru/AgenticSupercharge.git
git push -u origin main
```

If the repo already has a remote:

```bash
git remote -v
git remote set-url origin https://github.com/radustefandumitru/AgenticSupercharge.git
git push -u origin main
```

After it is pushed, users can install with:

```bash
git clone https://github.com/radustefandumitru/AgenticSupercharge.git
cd AgenticSupercharge
./install.sh
```

Or directly with:

```bash
npx -y github:radustefandumitru/AgenticSupercharge
```

See `PUBLISHING.md` for the full public-sharing checklist.
