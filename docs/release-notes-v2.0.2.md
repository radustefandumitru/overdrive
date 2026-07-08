# Overdrive v2.0.2

Focused skill-intake release on top of v2.0.1. No `ovd-plan` state semantics changed.

## Added

- Added Addy Osmani's pinned engineering-method skills:
  `interview-me`, `doubt-driven-development`, `source-driven-development`,
  `api-and-interface-design`, `code-simplification`,
  `documentation-and-adrs`, `performance-optimization`,
  `test-driven-development`, and `debugging-and-error-recovery`.
- Added Matt Pocock's pinned `grill-me` and `grilling` skills.
- Updated Muratcan Koylan's context-engineering source and added
  `harness-engineering` and `self-improvement-loops`.
- Expanded the official Anthropic skills source with `algorithmic-art`,
  `canvas-design`, `claude-api`, `skill-creator`,
  `web-artifacts-builder`, `webapp-testing`, and the official
  `theme-factory`.
- Added four Overdrive-authored wrapper skills:
  `brag-video`, `autoresearch-harness`, `clone-website-guide`, and
  `fact-checker`.

## Safety Notes

- Raw `latent-spaces/brag` is not copied because no clear redistribution
  license was visible during review; Overdrive ships an original
  `brag-video` wrapper instead.
- `karpathy/autoresearch` is treated as inspiration for
  `autoresearch-harness`; Overdrive does not install dependencies, start
  long loops, or spend GPU/API budget without explicit user approval.
- `JCodesMore/ai-website-cloner-template` is treated as a fresh-template
  workflow, not a global skill. `clone-website-guide` requires
  public/authorized targets and rejects phishing, impersonation, credential
  harvesting, and trademark misuse.
- `hesreallyhim/awesome-claude-code` remains research/link-only because it is
  a curated list rather than a portable skill source and its license is not a
  fit for redistribution.
- The Reddit-linked fact-checker path was unavailable, so Overdrive ships an
  original `fact-checker` skill.

## Verification

- Manifest target: 160 unique skills: 23 local, 136 pinned upstream GitHub,
  and 1 installer-backed skill.
- Router smoke and benchmark coverage now includes the new skill families and
  conflict rules.
- Package and archive checks continue to exclude `.overdrive/`, `.DS_Store`,
  tarballs, old zips, secrets, auth state, local runtime state, and
  unsupported vendored third-party material.
