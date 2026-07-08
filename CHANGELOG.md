# Changelog

## v2.0.1 - 2026-07-08

Docs and branding only. No installer, CLI, or `ovd-plan` behavior changed.

- Reworked all three README diagrams to match the Overdrive logo: true-black
  backgrounds, a silver brushed-metal edge on every content box, the logo's
  lens-flare treatment on headline wordmarks, and correct wordmark alignment.
- Rewrote the README hero copy and system-overview language around the actual
  pipeline (global instructions, curated skills, skill router, project state
  management system) and dropped inaccurate "operating layer" phrasing.
- Named `ovd-workflow`/`ovd-plan` consistently as the project state
  management system across the README and docs.
- Added a "Why leaf?" explanation of `ovd-plan` node naming to the README and
  `docs/ovd-plan-v2.md`.
- Added a skills-provenance section (22 pinned upstream open-source sources
  plus the 19 skills built specifically for Overdrive) and a `docs/README.md`
  index.
- Credited Eugen Bulboaca for designing `ovd-workflow`; credited Andrej
  Karpathy's Claude system prompt as the basis for the global operating
  guide, consistent with the existing THIRD_PARTY_NOTICES.md entry.
- Updated Stefan's contact links (X handle, GitHub) and removed em dashes
  from public-facing prose.
- Fixed two dead documentation links and restored an uninstall command block
  that had been dropped from the v2.0.0 README rework.

## v2.0.0 - 2026-07-07

- Added the v2 `ovd-plan` structural layer: `OVERDRIVE.md`, `/ovd-workflow`, `/ovd-plan`, `/ovd-go`, `/ovd-log`, intent routing, recursive closure, and `overdrive verify --plan`.
- Added parser/writer/cache/state modules under `lib/ovd-plan/` plus extensive unit and smoke coverage for the new project-management pipeline.
- Reworked the README around the v2 mental model and public first-time-reader flow while keeping exact installed instructions available in advanced sections.
- Hardened hook setup after the independent pre-release audit: a malformed existing agent settings file (for example `~/.claude/settings.json`) now aborts install/uninstall with a clear message instead of being silently replaced, with a regression test covering install and uninstall.
- Fixed `./update.sh` on stock macOS bash 3.2, where `set -u` plus empty argument arrays aborted the default invocation.
- Uninstall now also removes the empty `~/.overdrive/` scaffolding directories it created, and slash-command docs no longer reference internal spec paths that public packages exclude.
- Rebuilt all three README diagrams for the v2 architecture (flow, system, architecture) with the plan/state layer, review gates, the four commands, and the `.overdrive/` layout.
- Reorganized the repository root: `SKILLS_SUMMARY.md`, `SKILLS_TLDR.md`, `MCP_AND_CONNECTORS.md`, `AGENTS_OPENAI_YAML.md`, `PUBLISHING.md`, and `VERIFIED_SOURCES.md` moved under `docs/`, with all code, package, and consistency-check references updated.
- Moved `design-extract` to a local Overdrive compatibility skill so installs no longer depend on the upstream Git source, which was unreachable during v2 pin verification (upstream distribution has since moved to the `designlang` npm package).
- Added local dependency preflight and runtime dependency copying for `js-yaml`, which powers `yaml ovd-plan` block parsing.
- Updated CI, package metadata, plugin metadata, notices, release docs, and packaging checks for the v2 release candidate.

## v1.0.2 - 2026-06-06

- Removed pre-launch compatibility surfaces so the public package uses only canonical Overdrive names: `overdrive`, `ovd`, `overdrive-cli`, `.overdrive/`, `.overdrive.json`, `OVERDRIVE_WORKFLOW`, `/ovd-*`, and `ovd-workflow`.
- Moved Stefan's README note to a top quote, added collapsible README sections for the installed global guide and `skill-router`, and removed redundant public draft files.
- Strengthened package and repository checks for tracked junk, local runtime state, obsolete brand surfaces, archive exclusions, and canonical install/uninstall behavior.

## v1.0.1 - 2026-06-06

- Fixed the thin Claude Code marketplace/plugin manifests so `claude plugin validate`, marketplace add, and plugin install pass with Claude's current plugin schema.
- Added frontmatter metadata to the `/ovd-*` helper commands included in the Claude plugin wrapper.

## v1.0.0-rc - 2026-06-05

- Rebranded the project to Overdrive as a local release candidate, with canonical `overdrive`, `ovd`, `ovd-workflow`, `.overdrive/`, `~/.overdrive/`, `OVERDRIVE_WORKFLOW`, package name `overdrive-cli`, and archive `Overdrive.zip`.
- Hardened the RC after audit: exact `SKILL.md` casing for lowercase upstream skill files, idempotent workflow hook cleanup, stricter `--no-tool-install` semantics, safer `claude-video` payload stripping, managed helper-tool uninstall cleanup, and behavioral/source-fidelity tests for installed output.
- Switched the original Overdrive project license to Apache-2.0 and added `NOTICE`; third-party skills and references remain governed by their own licenses in `THIRD_PARTY_NOTICES.md`.
- Added repo-local README assets, a polished Overdrive README landing page, and a thin Claude Code marketplace/plugin wrapper that points users to the full CLI install without bundling all 137 skills.
- Rebuilt release packaging around `Overdrive.zip`; no public tag, GitHub release, hardening audit, or remote repo rename is part of this RC.

## v0.12.0 - 2026-06-02

- Added local `pretext` skill for advanced text measurement/layout guidance using Cheng Lou's MIT `@chenglou/pretext` library, raising the manifest to 137 unique skills.
- Added `docs/context-runtime-matrix.md` to document verified native context-window mechanisms across Claude Code, Codex, Gemini CLI, Antigravity, and Cursor without adding always-on machinery.
- Updated global instruction templates to defer to each runtime's native memory/compact/compress commands and avoid presenting Claude-only context levers as universal behavior.
- Updated `skill-router`, smoke checks, router benchmark cases, summaries, readiness docs, third-party notices, verified sources, and consistency checks for the v0.12 routing and attribution boundaries.

## v0.11.0 - 2026-06-02

- Changed the optional dependency policy from "document only" to "attempt safe setup during install, then fail open": Graphify, Claude Video/media helpers, and Design Extract browser support now get non-privileged installer attempts unless `--no-tool-install` is set.
- Added installer support for `graphifyy==0.1.14` through `pipx` or a managed user-space virtualenv, never global `pip`, `sudo`, or `--break-system-packages`.
- Added safe helper setup paths for `yt-dlp`, `ffmpeg`, and Design Extract browser support while preserving runtime preflights, manual fallback commands, and no API-key collection.
- Updated Graphify router/instruction guidance to prefer an existing project graph for codebase relationship questions, recommend Graphify's own watch/git-hook freshness flow when stale, and avoid any Overdrive background graph daemon.
- Strengthened global objectivity guidance against sycophancy and weak-premise feedback loops, including proactive challenge for consequential, ambiguous, or irreversible decisions.
- Updated docs, third-party notices, readiness checks, router catalog, and consistency tests for the v0.11 plug-and-play dependency policy.

## v0.10.0 - 2026-06-02

- Added four pinned MIT upstream skills: `prompt-master`, `humanizer`, `design-extract`, and `claude-video`, raising the manifest to 136 unique skills.
- Added safety transforms for `design-extract` and `claude-video` so agents check availability, ask before setup, avoid writing secrets, and never auto-install packages, browsers, Homebrew/apt/winget/pip tooling, or MCPs.
- Added an ethics note to `humanizer` so humanizing preserves meaning and facts without deceptive authorship, fake lived experience, or removing required AI disclosure.
- Added `overdrive usage`, workflow command coverage, and workflow tests for local, read-only token usage reporting from Claude Code JSONL logs with best-effort route attribution and no prompt/message content printing.
- Updated `skill-router`, smoke checks, router benchmark cases, docs, third-party notices, verified sources, skill readiness, and consistency checks for the v0.10 manifest and new routing boundaries.

## v0.9.0 - 2026-05-31

- Added Safi Shamsi's MIT Graphify source pinned at `91f4d120b630ee35c79bf3c75ccd186870a808f9`, importing one optional `graphify` code/corpus intelligence skill.
- Added installer support for upstream skills whose source file is lowercase `skill.md`, normalizing to installed `SKILL.md`.
- Added a Graphify-specific safety transform that removes upstream Python auto-install behavior, preserves optional setup guidance for `pip install graphifyy` / `pip install 'graphifyy[pdf]'`, and teaches agents to fall back to normal repo exploration when Graphify is unavailable.
- Updated `skill-router`, smoke checks, router benchmark cases, docs, third-party notices, verified sources, skill readiness, and consistency checks for the 132-skill v0.9 manifest.

## v0.8.0 - 2026-05-31

- Added prompt-cache-friendly guidance and `docs/prompt-caching.md` while keeping caching controlled by the host runtime/harness.
- Added ovd-workflow `preferences.md` for lightweight per-project do-not rules and durable user preferences, with init/doctor/test coverage.
- Strengthened global instructions for lean context, escalating ~60% / ~75% / ~85-90% context-budget heads-ups, native plan-mode versus `clarify-and-plan`, and native orchestration instead of custom orchestrators.
- Kept the catalog at 131 unique skills: v0.8 adds no new skills and keeps context skills router-selectable rather than always-on.
- Updated README examples, router/catalog guidance, attribution, and consistency checks for the context-efficiency release.

## v0.7.0 - 2026-05-31

- Added ovd-workflow knowledge vault support with `.overdrive/knowledge/`, `.overdrive/knowledge-index.json`, `knowledge_autosummarize`, `overdrive knowledge`, doctor coverage, and workflow tests.
- Added local `convert-to-markdown` skill for token-efficient local PDF/Office/spreadsheet/data-file reading with optional Microsoft MarkItDown support.
- Added local `reddit-research` skill for low-volume public-read-only Reddit/community signal with explicit best-effort and rate-limit caveats.
- Added optional MarkItDown MCP and Browserbase connector documentation while keeping Context7 as the only prescribed MCP.
- Added `scripts/analyze-routes.js`, `npm run analyze:routes`, and `docs/catalog-health.md` for local maintainer route-frequency and catalog-health analysis with no telemetry.
- Updated `skill-router`, router benchmark cases, docs, attributions, global instructions, skill readiness, and consistency checks for the 131-skill v0.7 manifest.

## v0.6.0 - 2026-05-30

- Added Jamie Mill's MIT `layers-skills` source pinned at `64b9202bf0506ad1418b9975681c95798725e25a`, importing all nine `layers-*` product-design reasoning skills.
- Added local `liquid-glass-web`, an original progressive-enhancement skill for universal frosted glass, Chromium SVG-displacement refraction, and optional license-checked WebGL refraction.
- Folded proximity-hover and CSS scroll-state sticky-navbar patterns into local animation skills with attribution and performance/browser-support caveats.
- Added ovd-workflow `research.md` for objective project research notes and a lightweight `recordDecision` helper for dated decisions and contradiction prompts.
- Strengthened global instruction templates with durable decision tracking, contradiction surfacing, loop/frustration stopping, parallel-subagent guidance, and honest per-runtime model/planning knob guidance.
- Added a v0.6 router scorecard harness (`docs/scorecard-v0.6.md`, `evals/scorecard-results.json`, `scripts/build-scorecard.js`) without inventing benchmark scores.
- Updated `skill-router`, smoke checks, router benchmark cases, docs, third-party notices, verified sources, README credits, and consistency checks for the 129-skill v0.6 manifest.
- Backfilled complete creator/provenance links for v0.5/v0.6 additions without fetching credit-only X links or redistributing third-party code.

## v0.5.0 - 2026-05-30

- Trimmed the default Obsidian install to the portable `json-canvas` and `defuddle` skills; deeper Obsidian Markdown/Bases/CLI automation is now left to user/project-specific setup.
- Added verified pinned `react-doctor` from Million / Aiden Bai for React code-health diagnostics.
- Updated `impeccable` to the verified `skill-v3.1.1` commit and refreshed its Apache-2.0 attribution.
- Added local `what-should-i-consider` for objective architecture and plan pressure-testing.
- Replaced the upstream `video-downloader` include with local `media-download`, a small yt-dlp wrapper for MP3 and high-quality MP4 downloads.
- Added global instruction lines for objective pushback, research-before-guessing, concise output, and natural-language ovd-workflow status triggers.
- Added install-time skill selection with `--all`, `--skills`, and `--skip-skills`, while keeping full install as the recommended default.
- Added a first-run installer welcome, subset-aware dry runs, router smoke coverage for new skills, and hook hardening so emitted command hooks include command strings.
- Repositioned the README around Overdrive as a full workflow system, clarified managed skills versus native/plugin/MCP layers, and added Stefan's early-AI-adopter origin note.
- Updated `skill-router` to recognize Claude Code's `security-guidance` plugin as a Claude-only preventative security layer alongside native `/security-review` and portable `security-review`.

## v0.4.0 - 2026-05-27

- Added ovd-workflow, a lightweight local project-state layer backed by a gitignored `.overdrive/` folder for project state, decisions, file hashes, route traces, reports, active work, and handoff checkpoints.
- Added persistent runtime installation under `~/.overdrive/runtime/current/` plus a managed CLI shim so hooks do not depend on temporary `npx` folders or disposable clones.
- Added workflow commands: `status`, `doctor`, `resync`, `checkpoint`, and `route`.
- Added non-blocking ovd-workflow hook integration for supported runtimes, with Claude slash commands and Cursor rule fallback where appropriate.
- Updated global instruction templates and `skill-router` to use flexible phased skill selection instead of a hard 1-3 skill cap.
- Added ovd-workflow documentation and archive safety checks while keeping raw GSD material out of the public package.
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
- Added `overdrive check-updates` and `./check-updates.sh`, plus passive update notices during install/verify.
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
- Narrowed non-Claude path sanitization to generated runtime files so unrelated upstream skills stay byte-for-byte original apart from Overdrive marker files.

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
- Added safe uninstall support through `uninstall.sh` and `overdrive uninstall`.
- Added `SECURITY.md`, `VERIFIED_SOURCES.md`, CI workflow, and release-ready documentation polish.
- Tightened Antigravity detection, managed-block marker handling, and defensive secret-file copy filters.
- Added non-destructive installer, updater, verifier, router, global instruction templates, and public-safe local skills for the first public release.
