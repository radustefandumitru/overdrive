# Sharing and Transfer

Use the standalone installer kit instead of copying personal app folders.

Default local kit shape:

```bash
Overdrive/
```

## Recommended Flow

1. Share the whole `overdrive` folder by zip, AirDrop, private repo, or cloud storage.
2. On the receiving Mac, inspect `manifest.json` and `install.sh`.
3. Run:

```bash
./install.sh --dry-run
./install.sh
./verify.sh
```

4. Restart Claude Code, Codex, Gemini CLI, and Antigravity so they re-index skills.

Antigravity uses the `.gemini` config convention for its agent shell. Even when the selected model is Claude/Sonnet, its global instruction file is `~/.gemini/GEMINI.md`.

## What Transfers

- Public skill folders and bundled `SKILL.md` instructions.
- Pinned upstream skill sources, including the selected Anthropic example skills from `anthropics/skills`, OpenAI `playwright`, and Vercel Labs `find-skills`.
- `skill-router` and its references.
- Local public-safe skills such as `fluid-animations`, `emil-animation-polish`, and the `jack-*` premium 3D website workflow skills.
- Managed global instruction templates in `global-instructions/`, including an explicit default instruction to consult `skill-router` as a lightweight preflight for non-trivial requests, with user-named skill overrides.
- Context7 usage guidance and generic connector safety guidance.
- `docs/MCP_AND_CONNECTORS.md` as a public-safe Context7 and connector explainer.
- A lockfile of upstream source commits.
- A verification script for all target roots.

## What Does Not Transfer

- Claude/Codex/Gemini/Antigravity sign-ins.
- OAuth sessions.
- API keys.
- MCP secrets.
- MCP server config, connector auth, database URLs, service-role keys, browser profiles, or personal app sessions.
- Google Drive, Slack, email, calendar, or Composio account auth.
- Any app connector state that should remain personal.
- Jack Roberts raw source materials from the private local research folder, including PDFs, zips, templates, prompts, and downloaded skill text.

## Global Instruction Files

The installer upserts a managed block into these files and preserves any personal content outside that block:

- Claude Code: `CLAUDE.md` in the Claude Code user config directory
- Codex: `AGENTS.md` in the Codex user config directory
- Gemini CLI and Antigravity: `GEMINI.md` in the Gemini user config directory

The managed block includes Context7 guidance. Real MCP access does not transfer: every recipient must configure Context7 and any other personal/project-specific connectors in their own agent runtime.

## One-Line Install

Only use this after hosting the kit somewhere trusted:

```bash
curl -fsSL <raw-install-url> | bash
```

Prefer cloning/downloading the kit first so the recipient can inspect the script.
