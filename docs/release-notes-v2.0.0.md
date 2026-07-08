# Overdrive v2.0.0

Overdrive v2 adds a project-management/state layer on top of the existing skill installer and router.

## Highlights

- Added `ovd-plan`: a structured project tree in `OVERDRIVE.md` with executable leaves, success criteria, dependencies, verification, and recursive closure.
- Added the main v2 workflow commands:
  - `/ovd-workflow` for setup, codebase mapping, requirements, preferences, and decisions.
  - `/ovd-plan` for deliberate planning, research, editing, and plan-quality checks.
  - `/ovd-go` for orienting and executing active work.
  - `/ovd-log` for progress capture, concerns, handoffs, and closure.
- Added `overdrive verify --plan` to audit project-state layout and plan health.
- Reworked the README around a first-time-reader flow: what Overdrive is, install, what changes after install, the v2 mental model, common workflows, safety/privacy, and advanced internals.
- Moved `design-extract` to a local compatibility skill so no upstream repository is required at install time. The previously pinned upstream Git source was unreachable during v2 pin verification; upstream distribution has since moved to the `designlang` npm package.
- Added `js-yaml` as a runtime dependency for ovd-plan YAML parsing and hardened runtime dependency copying for npm/npx layouts.
- Expanded CI and local tests for the v2 project-management pipeline.
- Rebuilt the README and all three diagrams around the v2 architecture, and reorganized secondary docs under `docs/` for a cleaner repository root.

## Audit Fixes

An independent pre-release audit (Claude Fable 5) reviewed installer safety, v2 state semantics, CLI surfaces, packaging, licensing, and release readiness. Fixes landed in this release:

- Hook setup no longer rewrites a malformed existing agent settings file (`~/.claude/settings.json`, `~/.gemini/settings.json`, `~/.codex/hooks.json`). Install and uninstall now abort with a clear message and leave the file byte-identical, covered by a new regression test.
- `./update.sh` no longer aborts on stock macOS bash 3.2 (`set -u` + empty argument arrays).
- Uninstall removes the empty `~/.overdrive/` scaffolding directories it created.
- Stale "upstream unavailable" wording for `design-extract` was corrected across docs and notices.

## Credits

- The `ovd-workflow` project-context layer was designed by [Eugen Bulboaca](https://www.linkedin.com/in/eugenbulboaca/) ([GitHub](https://github.com/BulboacaEugen)).
- The installed global operating guide is based on Andrej Karpathy's Claude system prompt, adapted to fit Overdrive, via [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills).

## Safety Notes

- No telemetry.
- No API keys, OAuth state, browser profiles, cookies, MCP secrets, `.env` files, or account sessions are copied.
- Installs remain non-destructive by default and use Overdrive-managed markers.
- A malformed existing settings file aborts hook setup instead of being replaced.
- Existing v1 `.overdrive/` layouts are detected and require explicit migration choices.
- The release does not claim measured output-quality gains; router/scorecard tooling is included for validation, not marketing proof.

## Verification

Release checks passed on the final release candidate:

- `npm run test:full` (syntax, consistency, router benchmark, workflow, ovd-plan, smoke)
- `./verify.sh`
- `npm audit --omit=dev` (0 vulnerabilities)
- `npm pack --dry-run` + package-content scans
- local/global install dry-runs and real install → use → update → uninstall round-trips in a clean environment
- tracked artifact, secret-pattern, and personal-path scans (hidden files included)

