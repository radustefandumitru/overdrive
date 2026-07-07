# Overdrive — Known Issues

Short, dated log of known problems to address. Newest first.

## 2026-06-25 — Resolved: upstream skill source `design-extract` became unavailable

**Symptom:** `npm run test:workflow` and real installs failed when the installer tried to clone the `design-extract` skill source.

**Diagnosis:** the upstream Git source for `design-extract` became unavailable. This was environmental/upstream, not caused by the presentation-pass work; the change-stashed baseline failed identically, and `--verbose` did not affect it.

**Impact:** before v2 release cleanup, this blocked any real install that included the `design-extract` skill and the full `npm test` path with that source unreachable.

**Resolution:** v2 moves `design-extract` to a local Overdrive compatibility skill with attribution and no upstream code bundled. The broken Git source is removed from `manifest.json`; installs no longer depend on that repository.
