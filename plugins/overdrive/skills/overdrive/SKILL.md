---
name: overdrive
description: Use when the user asks about installing, updating, checking, or using Overdrive from Claude Code. This plugin is a thin helper; the full cross-agent skill system is installed by the Overdrive CLI.
---

# Overdrive Claude Helper

This plugin does not bundle the full Overdrive skill library. It helps Claude Code explain and invoke the full Overdrive CLI installer.

Use this when the user asks to:

- install Overdrive
- check whether Overdrive is installed
- update Overdrive-managed skills
- inspect ovd-workflow status
- run Overdrive doctor/checkpoint/usage commands

## Commands To Prefer

If the CLI is installed, prefer:

```bash
overdrive status --project-dir "$PWD"
overdrive doctor --project-dir "$PWD"
overdrive checkpoint --project-dir "$PWD"
overdrive usage --project-dir "$PWD"
overdrive check-updates
```

If `overdrive` is not on PATH, suggest one of the public install paths:

```bash
npx -y github:radustefandumitru/overdrive -- --dry-run
npx -y github:radustefandumitru/overdrive
```

Or from a clone:

```bash
git clone https://github.com/radustefandumitru/overdrive.git
cd overdrive
./install.sh --dry-run
./install.sh
```

## Safety Rules

- Start with `--dry-run` when the user is unsure.
- Do not ask the user to paste secrets, API keys, OAuth tokens, MCP config, browser session state, or private database credentials.
- The CLI installs and updates managed files only; unmarked user-owned skill folders are preserved unless the user explicitly chooses a destructive conflict policy.
- For Claude Code, native `/security-review` remains preferred for security audits when available.
