# Overdrive — Known Issues

Short, dated log of known problems to address. Newest first.

## 2026-06-25 — Upstream skill source `design-extract` returns 404

**Symptom:** `npm run test:workflow` (and `npm test`) fail their real-install clone checks; a real (non-dry-run) `overdrive install` aborts when it reaches the `design-extract` skill source with:

```
remote: Repository not found.
fatal: repository 'https://github.com/Manavarya09/design-extract.git/' not found
Error: git -C <tmp> fetch --quiet --depth 1 origin 82b20dbe5a0e17f1f9153def04af8279f5672e3c failed
```

**Diagnosis:** the upstream repo `github.com/Manavarya09/design-extract.git` no longer exists (404). The source + pinned commit are still referenced in `manifest.json`. Confirmed environmental/upstream, **not** caused by the presentation-pass work — the change-stashed baseline fails identically, and `--verbose` does not affect it. The source was reachable at the start of the 2026-06-22 session, so it disappeared recently.

**Impact:** blocks any real install that includes the `design-extract` skill and the full `npm test` offline/with that source unreachable. `npm run check`, `test:ovd-plan`, `test:smoke`, and `consistency` are unaffected (no network).

**Likely fix (deferred per user — revisit after the presentation pass):** update the `design-extract` pin to a live source, repoint to a fork/mirror, or remove the source from `manifest.json` if it's no longer maintained. Then re-run `npm run test:workflow`.
