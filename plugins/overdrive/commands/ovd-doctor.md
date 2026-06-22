---
description: "[Deprecated] Diagnose project health — now delegates to overdrive verify --plan"
argument-hint: "[project path]"
---

> **Deprecated:** This command now delegates to `overdrive verify --plan` (the v2-native project-integrity check). Consider using the new command directly.

Run:

```bash
overdrive verify --plan --project-dir "$PWD"
```

Then explain any findings (OVERDRIVE.md parse, cache consistency, `.overdrive/` structure, orphan files) without changing project code. If the command is unavailable, explain that the full Overdrive CLI needs to be installed first.
