# Skill Readiness Audit

AgenticSupercharge is plug-and-play for installation: the installer can place skills and global instructions without account setup. As of v0.12, it also documents native context-window behavior by runtime and attempts safe, non-privileged setup for selected optional helpers when relevant skills are installed. Some workflows still need user-owned accounts, credentials, app permissions, or manual setup before they can execute fully.

## Default Install Summary

- Unique skills in the current manifest: 137
- Locally authored AgenticSupercharge skills: 18
- Upstream GitHub-sourced skills: 118
- Official installer-backed skills: 1 (`playwright-cli`)
- Global roots supported: Claude Code, Codex, Gemini CLI, Antigravity, Cursor, and shared `.agents`
- AS-Workflow runtime: installed under `~/.agentic-supercharge/runtime/current/` for hooks, status, doctor, resync, knowledge-vault indexing, preferences, route traces, and checkpoints.

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
- `liquid-glass-web`
- `pretext` guidance for advanced text measurement/layout, with `@chenglou/pretext` added only as a per-project app dependency when the project needs it
- `media-download` guidance, with installer-attempted `yt-dlp` setup when the skill is selected
- `convert-to-markdown` guidance, with MarkItDown enhancement when installed
- `reddit-research` guidance, with public Reddit access treated as best-effort
- `prompt-master` prompt-writing guidance
- `humanizer` meaning-preserving voice cleanup guidance
- Jack Roberts inspired `jack-*` workflow skills when used as planning/build guidance
- Jamie Mill `layers-*` product-design reasoning skills
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
| `graphify` | Python 3.10-3.12 preferred for the pinned `graphifyy==0.1.14` dependency tree; optional PDF support | Installer attempts `pipx install --python python3.12 graphifyy==0.1.14` when a compatible interpreter is available, or a managed user-space virtualenv. It never uses global `pip`, `sudo`, or `--break-system-packages`. Agents should check availability and fall back to normal `rg`/file reads if unavailable. |
| `design-extract` | Node/designlang, Chrome/Chromium or Playwright, and public page access | Installer prefers an existing system Chrome/Chromium/Edge and only attempts Playwright Chromium when no system browser is found. Agents should check availability, prefer `--system-chrome`, avoid extensions/MCP/cookies/auth state, and fall back to screenshots/source inspection or user-provided brand details. |
| `claude-video` | ffmpeg/ffprobe, yt-dlp, and optional Groq/OpenAI Whisper key for transcription | Installer attempts non-privileged `ffmpeg`/`yt-dlp` setup through Homebrew, winget, pipx, or managed venv paths where possible. Agents should run preflight checks, never write API keys from chat, and fall back to frames-only/captions-only when needed. |
| `liquid-glass-web` Tier 3 | WebGL support and any adopted WebGL glass library license review | Tier 1 CSS works broadly; Tier 2 is Chromium-specific; Tier 3 needs browser/device testing and permissive license review. |
| `pretext` | `@chenglou/pretext` installed in the user's web app project | No global installer setup. Agents should add it through the project's package manager only when text measurement/layout performance is the actual task. |
| Composio/connect-style skills | User-configured connectors, auth, and explicit approval | Approval-gate external actions such as sending, posting, creating, deleting, authenticating, or spending credits. |
| `langsmith-fetch` | LangSmith access and CLI/setup | Only useful if the user has LangSmith traces and credentials configured. |
| `media-download` | `yt-dlp` | Treat download requests as user-approved local actions, default to `~/Downloads` when appropriate, and respect platform terms. |
| `convert-to-markdown` | Python and Microsoft MarkItDown, ideally `pip install 'markitdown[all]'` | Converts local PDF/Office/spreadsheet/data files before reading. If unavailable, agents should fall back to native reading or simple text caches. |
| `reddit-research` | Public Reddit JSON endpoints and normal web access | Best-effort only. Reddit may rate-limit/block unauthenticated requests; no auth, cookies, API keys, or stored credentials are required or bundled. |
| Jack Roberts inspired publishing steps | Optional Firecrawl, image/video generators, GitHub, Vercel, browser tools | The skills treat these as optional user-configured tools and approval-gate publishing. |

## Obsidian Verification Notes

v0.5 trims Obsidian to the portable pieces: `json-canvas` and `defuddle`. Broader Obsidian vault editing, Bases, and CLI workflows are now left to a user's own project/tool setup instead of being part of the default public install.

Before broad edits to a real vault, create a git commit, vault snapshot, or Obsidian Sync/version-history checkpoint.

## Public-Safety Notes

- The public kit does not copy MCP configs, OAuth state, tokens, browser profiles, `.env` files, or app sessions.
- Optional MCPs remain documented in `MCP_AND_CONNECTORS.md` and are not installed by default. The installer may attempt a narrow set of non-privileged external helper tools for selected bundled skills; pass `--no-tool-install` to skip that behavior.
- If a skill requires account access or external side effects, the agent should ask before acting.
