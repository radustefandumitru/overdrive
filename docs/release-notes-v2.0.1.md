# Overdrive v2.0.1

Docs and branding patch. No installer, CLI, or `ovd-plan` behavior changed from v2.0.0.

## Why This Patch Exists

v2.0.0 shipped correct but unpolished: an early README draft with placeholder-feeling copy, diagrams with a blue-tinted background instead of the logo's black/white/silver palette, and a couple of stale links. This patch brings the published package in line with what the project actually looks and reads like today.

## Highlights

- Reworked all three README diagrams to match the Overdrive logo: true-black backgrounds, a silver brushed-metal edge on every content box, the logo's lens-flare treatment on headline wordmarks, and corrected wordmark alignment.
- Rewrote the README hero copy and system-overview language around the actual pipeline: global instructions, curated skills, the skill router, and the project state management system. Dropped inaccurate "operating layer" phrasing.
- Named `ovd-workflow` and `ovd-plan` consistently as the project state management system across the README and docs, replacing inconsistent "project-state layer" / "project-management layer" phrasing.
- Added a "Why leaf?" explanation of `ovd-plan` node naming to the README and [docs/ovd-plan-v2.md](ovd-plan-v2.md): a leaf is the smallest implementable unit, deliberately not called a task, step, phase, or action, so the plan tree can take whatever shape a project needs.
- Added a skills-provenance section: 22 pinned upstream open-source sources plus the 19 skills built specifically for Overdrive, counted directly from `manifest.json`. Added a [docs/README.md](README.md) index grouping the rest of the documentation by what a reader is trying to do.
- Removed em dashes and other AI-tell phrasing from public-facing prose.

## Credits

- `ovd-workflow`, the project state management system, was designed by [Eugen Bulboaca](https://www.linkedin.com/in/eugenbulboaca/) ([GitHub](https://github.com/BulboacaEugen)).
- The installed global operating guide is based on Andrej Karpathy's Claude system prompt, adapted to fit Overdrive, via [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills).

## Fixes

- Two documentation links pointed at an internal `handoff/` directory that was never shipped in the public repo; both now point at the real design record or a plain-text note.
- The README's Safety/Updates section had dropped its uninstall command block during the v2.0.0 README rework; restored.
- The Claude Code plugin manifests (`.claude-plugin/marketplace.json`, `plugins/overdrive/.claude-plugin/plugin.json`) still referenced a retired X handle; updated to the current one.

## Verification

- `npm run consistency` (1176 checks), `npm run check`, `npm run test:smoke`, `npm run test:workflow`, `npm run eval:router`
- `npm pack --dry-run`
- Diagram renders visually inspected against the logo asset; corner pixels sampled to confirm true-black backgrounds.
