# agents/openai.yaml

Some skills include an `agents/openai.yaml` metadata file. Overdrive keeps these files with each skill so OpenAI/Codex-style runtimes can read small structured metadata without parsing an entire skill body first.

The current files are lightweight descriptors only. They are not secrets, MCP configs, tool credentials, or executable code.

When adding a local skill:

- Keep `SKILL.md` as the source of truth for behavior.
- Use `agents/openai.yaml` only for compact metadata that helps OpenAI-compatible agents identify or route the skill.
- Do not put API keys, local paths, account names, tokens, or project-specific state in metadata files.
