# Changelog

## Unreleased

- No unreleased changes.

## v0.4.0 - 2026-05-27

- Added AS-Workflow, a lightweight local project-state layer backed by a gitignored `.agenticsupercharge/` folder for project state, decisions, file hashes, route traces, reports, active work, and handoff checkpoints.
- Added persistent runtime installation under `~/.agentic-supercharge/runtime/current/` plus a managed CLI shim so hooks do not depend on temporary `npx` folders or disposable clones.
- Added workflow commands: `status`, `doctor`, `resync`, `checkpoint`, and `route`.
- Added non-blocking AS-Workflow hook integration for supported runtimes, with Claude slash commands and Cursor rule fallback where appropriate.
- Updated global instruction templates and `skill-router` to use flexible phased skill selection instead of a hard 1-3 skill cap.
- Added AS-Workflow documentation and archive safety checks while keeping raw GSD material out of the public package.
- Removed the private/offline bundled zip workflow and simplified distribution around the GitHub repo plus one public release archive.

## v0.3.0 - 2026-05-26

- Added dependency-free repo consistency checks for manifest counts, local skill metadata, source pins, smoke checks, docs, package contents, verified sources, third-party notices, and router catalog coverage.
- Added a lightweight `skill-router` benchmark pack with control/routed prompts, expected skills, and manual scoring rubrics across frontend, motion, planning, security, research, premium site, launch, copy, knowledge-work, agent-infra, and media tasks.
- Added `docs/evaluation.md` to explain what the benchmark does and does not prove, plus a fair manual scoring protocol for comparing routed vs non-routed outputs.
- Wired consistency and router benchmark checks into `npm run check`, `npm run verify`, `./verify.sh`, CI, README, and publishing docs.
- Reduced installer noise by making temporary Git source checkouts quiet during normal and dry-run installs.
- Improved the no-targets error message to explain `--force-targets` for intentionally creating undetected target folders.
- Tightened public docs by fixing the Taste Skill attribution typo, moving `full-output-enforcement` under its real upstream source, and removing maintainer social-post drafts from npm/GitHub `npx` and zip payloads.

## v0.2.0 - 2026-05-26

- Added local skills: `clarify-and-plan`, `planning-first`, portable non-Claude `security-review`, and `pre-launch-checklist`.
- Added pinned upstream sources for `mvanhorn/last30days-skill` and `adamlyttleapps/claude-skill-app-onboarding-questionnaire`.
- Optimized `skill-router` with sharper trigger rules, a "Resolving Trigger Overlap" section, new catalog rows, routing trace examples, and smoke checks for every new skill.
- Strengthened global instruction templates with explicit options/tradeoff guidance, phased-work confirmation, Claude planning workflow notes, and a user-consent context-budget reminder.
- Added `agentic-supercharge check-updates` and `./check-updates.sh`, plus passive update notices during install/verify.
- Expanded optional MCP and external-tool documentation for GitHub, Supabase, Vercel, Firecrawl, Playwright MCP, voice dictation, Obsidian CLI, and Defuddle while keeping Context7 as the only default MCP recommendation.
- Added `docs/skill-readiness.md` to document which skills are plug-and-play and which need optional external setup.
- Updated README, SKILLS summaries, verified sources, third-party notices, publishing docs, and social post notes for the v0.2.0 workflow additions.
- Clarified that Anthropic example skills come from the public `anthropics/skills` repository, not Claude Code's bundled internal commands.
- Refreshed the verified Taste Skill pin to `339afcbf575daeaa61ee89646b3ba8912b308c39` before release.

## v0.1.4 - 2026-05-25

### Removed

- Quarantined the GSD integration after the upstream relocation from gsd-build/get-shit-done to open-gsd/get-shit-done-redux following a community governance change; the keep, replace, fork, or custom workflow decision is deferred to a later release.

## v0.1.3 - 2026-05-24

- Added pinned official sources for Vercel Labs `find-skills` and OpenAI `playwright`.
- Restored drifted local `playwright` copies to the upstream OpenAI skill instead of keeping local path edits.
- Fixed an official Superpowers plugin cache drift by restoring its deleted `AGENTS.md` symlink.
- Narrowed non-Claude path sanitization to generated runtime files so unrelated upstream skills stay byte-for-byte original apart from AgenticSupercharge marker files.

## v0.1.2 - 2026-05-23

- Fixed manual global target selection so `--tools cursor` no longer implicitly includes the shared `.agents` root.
- Kept auto target selection limited to detected roots, including `.agents` only when that root already exists.

## v0.1.1 - 2026-05-23

- Added the pinned official `anthropics/skills` source for `brand-guidelines`, `doc-coauthoring`, `mcp-builder`, and `slack-gif-creator`.
- Routed `brand-guidelines` and `doc-coauthoring` through `skill-router`, docs, smoke checks, and global installs.
- Moved future `mcp-builder` and `slack-gif-creator` installs to the official Anthropic example-skills source.

## v0.1.0 - 2026-05-23

- Added verified pinned upstream refs and pinned official installer package versions.
- Added `--allow-upstream-drift` for users who intentionally want tracking branches or latest packages.
- Added safe uninstall support through `uninstall.sh` and `agentic-supercharge uninstall`.
- Added `SECURITY.md`, `VERIFIED_SOURCES.md`, CI workflow, and release-ready documentation polish.
- Tightened Antigravity detection, managed-block marker handling, and defensive secret-file copy filters.
- Added non-destructive installer, updater, verifier, router, global instruction templates, and public-safe local skills for the first public release.
