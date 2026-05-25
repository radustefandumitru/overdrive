# Changelog

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
