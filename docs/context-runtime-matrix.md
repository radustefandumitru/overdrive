# Context Runtime Matrix

Verified on: 2026-06-02

This document records which context-window levers are real in the supported runtimes and how AgenticSupercharge uses them. The v0.12 decision is conservative: prefer native runtime mechanisms, keep the global instruction block lean, and do not add always-on context machinery.

## Summary

| Runtime | Verified context mechanisms | Do not assume | AgenticSupercharge v0.12 behavior |
|---|---|---|---|
| Claude Code | `CLAUDE.md` memory, `/memory`, `/compact`, skills, skill description budgets, `disable-model-invocation`, MCP `ENABLE_TOOL_SEARCH=false`, and MCP `alwaysLoad` are documented. Path-scoped `.claude/rules` and lazy instruction loading exist in Claude docs, but their compaction behavior is runtime-specific. | Do not present Claude-only `disable-model-invocation`, `.claude/rules`, `/context`, or MCP tool-search knobs as cross-platform features. Do not fight `/compact`. | Keep root guidance lean, front-load local skill descriptions, mention native memory/compaction commands, and leave Claude-specific advanced rules as documented options rather than installed defaults. |
| Codex | `AGENTS.md`, `AGENTS.override.md`, `project_doc_max_bytes`, `codex status`, `/compact`, and `/mcp` are documented. | Do not use Claude skill frontmatter fields or Claude rule directories in Codex. | Keep `AGENTS.md` concise and route specialist detail through skills. Users can raise `project_doc_max_bytes` or split project instructions if needed. |
| Gemini CLI | Hierarchical `GEMINI.md`, just-in-time context files, `/memory show`, `/memory reload`, `/compress`, `/stats`, `/skills`, `/mcp`, and `context.fileName` are documented. | Do not assume Claude slash commands or Claude skill fields. | Keep `GEMINI.md` lean, let Gemini reload/refresh memory through its native commands, and use the same skill-router guidance as other agents. |
| Antigravity | This kit installs Antigravity through Gemini-compatible roots: `~/.gemini/config/skills` and `~/.gemini/GEMINI.md`. Direct Antigravity-specific context-rule docs were not independently fetched in the v0.12 pass. | Do not invent Antigravity-only hooks, path-scoped rules, or context commands. | Treat Antigravity as a Gemini-root consumer for this release. Add no new Antigravity-specific context machinery. |
| Cursor | Cursor rules live under `.cursor/rules` or `~/.cursor/rules`, and project/user rule guidance is documented by Cursor. AgenticSupercharge already installs a lightweight Cursor rule. | Do not assume Claude/Gemini hooks or slash commands. Cursor hook support remains out of scope. | Keep Cursor support to skills plus natural-language/rules guidance. Do not install broad path-specific rules in v0.12. |

## Applied Rules

- Keep managed root instruction files small enough to survive normal use and native compaction.
- Put the most important trigger line at the top of each local skill through frontmatter `description` and the opening paragraph.
- Load skill bodies only when routed or explicitly requested.
- Do not silently compress. Ask before invoking `context-compression` or a runtime-native compact/compress command.
- Prefer native commands when available: Claude `/memory` and `/compact`; Codex `/compact` and `/mcp`; Gemini `/memory`, `/compress`, `/stats`, `/skills`, and `/mcp`.
- MCP tool-search deferral is a Claude-specific advanced setting, not a public cross-runtime default.

## Sources

- Claude Code skills: https://docs.anthropic.com/en/docs/claude-code/skills
- Claude Code memory: https://docs.anthropic.com/en/docs/claude-code/memory
- Claude Code MCP: https://docs.anthropic.com/en/docs/claude-code/mcp
- Codex AGENTS.md: https://developers.openai.com/codex/guides/agents-md
- Codex slash commands: https://developers.openai.com/codex/cli/slash-commands
- Gemini CLI memory: https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/gemini-md.md
- Gemini CLI commands: https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/commands.md
- Cursor rules: https://docs.cursor.com/en/context/rules
