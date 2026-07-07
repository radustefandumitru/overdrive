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
- Moved `design-extract` to a local compatibility skill because the previously pinned upstream Git source became unavailable. No unavailable upstream repository is required for install.
- Added `js-yaml` as a runtime dependency for ovd-plan YAML parsing and hardened runtime dependency copying for npm/npx layouts.
- Expanded CI and local tests for the v2 project-management pipeline.

## Safety Notes

- No telemetry.
- No API keys, OAuth state, browser profiles, cookies, MCP secrets, `.env` files, or account sessions are copied.
- Installs remain non-destructive by default and use Overdrive-managed markers.
- Existing v1 `.overdrive/` layouts are detected and require explicit migration choices.
- The release does not claim measured output-quality gains; router/scorecard tooling is included for validation, not marketing proof.

## Verification

Local release-prep checks passed on the v2 review branch:

- `npm run test:full`
- `./verify.sh`
- `npm audit --omit=dev`
- `npm pack --dry-run`
- local/global install dry-runs
- tracked artifact, secret-pattern, and package-content scans

