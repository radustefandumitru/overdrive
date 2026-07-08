# Overdrive Documentation

Start with the [main README](../README.md) for install and the mental model. This folder holds everything deeper, grouped by what you are trying to do.

## Understand the system

- [ovd-plan-v2.md](ovd-plan-v2.md): the v2 design. The four commands, the `OVERDRIVE.md` plan tree, leaf statuses, review gates, and closure semantics.
- [ovd-workflow.md](ovd-workflow.md): the project state management system on disk. What lives in `.overdrive/` and how agents use it.
- [context-runtime-matrix.md](context-runtime-matrix.md): how each supported agent runtime handles context windows, compaction, and memory.
- [prompt-caching.md](prompt-caching.md): why Overdrive keeps stable context up front, and what prompt caching means for agent setups.

## Skills: what is included and where it comes from

- [SKILLS_TLDR.md](SKILLS_TLDR.md): the quick map. Which skill to reach for by situation.
- [SKILLS_SUMMARY.md](SKILLS_SUMMARY.md): the deep reference. Every skill, its source, its author, and what was adapted.
- [VERIFIED_SOURCES.md](VERIFIED_SOURCES.md): the pinned upstream refs and package versions used by default installs.
- [skill-readiness.md](skill-readiness.md): which skills work out of the box and which need accounts, credentials, or extra tools.
- [AGENTS_OPENAI_YAML.md](AGENTS_OPENAI_YAML.md): the `agents/openai.yaml` metadata some skills carry for OpenAI/Codex-style runtimes.
- [MCP_AND_CONNECTORS.md](MCP_AND_CONNECTORS.md): the Context7 recommendation and how Overdrive treats MCP servers and connectors.

## Quality, evaluation, and honesty about limits

- [evaluation.md](evaluation.md): what the router benchmark measures (routing quality), what it does not (output quality), and the manual scoring protocol.
- [scorecard-v0.6.md](scorecard-v0.6.md): the blind-run scorecard template. Intentionally empty until real runs are collected.
- [catalog-health.md](catalog-health.md): generated route-frequency report. Refresh with `npm run analyze:routes`.
- [source-fidelity-report.md](source-fidelity-report.md): generated upstream-fidelity report. Refresh with `npm run source:fidelity`.

## Releases and maintenance

- [release-notes-v2.0.0.md](release-notes-v2.0.0.md): what shipped in v2.0.0, including audit fixes and credits.
- [PUBLISHING.md](PUBLISHING.md): the release checklist. How versions are verified, packaged, and published.

## Design records

- [superpowers/](superpowers/): the raw v2 design history. Specs, audits, plans, and known issues, kept as a record of how decisions were made. Read [ovd-plan-v2.md](ovd-plan-v2.md) first; it is the distilled version.
