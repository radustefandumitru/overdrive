# Skill Readiness Audit

AgenticSupercharge is plug-and-play for installation: the installer can place skills and global instructions without account setup. Some individual workflows still need optional tools, credentials, or app permissions before they can execute fully.

## Default Install Summary

- Unique skills in the current manifest: 119
- Locally authored AgenticSupercharge skills: 14
- Upstream GitHub-sourced skills: 104
- Official installer-backed skills: 1 (`playwright-cli`)
- Global roots supported: Claude Code, Codex, Gemini CLI, Antigravity, Cursor, and shared `.agents`
- AS-Workflow runtime: installed under `~/.agentic-supercharge/runtime/current/` for hooks, status, doctor, resync, route traces, and checkpoints.

Claude Code receives one fewer local skill because `security-review` is skipped there by policy in favor of Claude Code's native `/security-review` command.

## Plug-And-Play

These work immediately after install and agent reload because they are instruction/workflow skills:

- `skill-router`
- `clarify-and-plan`
- `planning-first`
- `security-review` on non-Claude agents
- `pre-launch-checklist`
- `what-should-i-consider`
- `fluid-animations`
- `emil-animation-polish`
- `media-download` guidance, once `yt-dlp` is installed
- Jack Roberts inspired `jack-*` workflow skills when used as planning/build guidance
- Taste, Impeccable, Emil, Modern Web Guidance, Remotion guidance, Stop Slop, most MarketingSkills, Context Engineering guidance, Anthropic example skills, and OpenAI/Vercel routing guidance

## Needs Optional External Tools Or Accounts

| Skill/family | Optional dependency | What to expect |
|---|---|---|
| `banana` | Gemini/Nano Banana or configured image-generation tooling | Use native image generation if Banana is unavailable. |
| `last30days` | Node/Python scripts included; optional paid/social keys for X, TikTok, Instagram, YouTube extras, Perplexity, etc. | Reddit, Hacker News, Polymarket, and GitHub are advertised upstream as zero-config; richer sources require user keys/session setup. |
| `defuddle` | Defuddle CLI | Enhances clean web-to-markdown extraction when available; agents should fall back to normal web fetch/browser if it is missing. |
| `react-doctor` | Node/npm and React Doctor package execution through `npx react-doctor@latest` | Useful only in React codebases; it may fetch the current React Doctor playbook on demand. |
| `playwright-cli` | Node/npm and browser binaries | The official installer provides the skill; browser install may happen on first real use depending on the user's environment. |
| `playwright` | Playwright CLI/runtime | OpenAI wrapper around Playwright-style automation; prefer `playwright-cli` for normal validation. |
| Composio/connect-style skills | User-configured connectors, auth, and explicit approval | Approval-gate external actions such as sending, posting, creating, deleting, authenticating, or spending credits. |
| `langsmith-fetch` | LangSmith access and CLI/setup | Only useful if the user has LangSmith traces and credentials configured. |
| `media-download` | `yt-dlp` | Treat download requests as user-approved local actions, default to `~/Downloads` when appropriate, and respect platform terms. |
| Jack Roberts inspired publishing steps | Optional Firecrawl, image/video generators, GitHub, Vercel, browser tools | The skills treat these as optional user-configured tools and approval-gate publishing. |

## Obsidian Verification Notes

v0.5 trims Obsidian to the portable pieces: `json-canvas` and `defuddle`. Broader Obsidian vault editing, Bases, and CLI workflows are now left to a user's own project/tool setup instead of being part of the default public install.

Before broad edits to a real vault, create a git commit, vault snapshot, or Obsidian Sync/version-history checkpoint.

## Public-Safety Notes

- The public kit does not copy MCP configs, OAuth state, tokens, browser profiles, `.env` files, or app sessions.
- Optional MCPs and external tools are documented in `MCP_AND_CONNECTORS.md`, not installed by default.
- If a skill requires account access or external side effects, the agent should ask before acting.
