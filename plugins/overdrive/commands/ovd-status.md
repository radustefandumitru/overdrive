---
description: "[Deprecated] Show project status — now delegates to /ovd-plan"
argument-hint: "[project path]"
---

> **Deprecated:** This command now delegates to `/ovd-plan`. Consider using the new command directly.

Run:

```bash
overdrive plan --project-dir "$PWD"
```

Then summarize the displayed plan tree and current state, and surface the proposed next steps. If the command is unavailable, explain that the full Overdrive CLI needs to be installed first.
