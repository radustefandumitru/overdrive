---
description: ovd-workflow — initialize the project (tutorial, codebase map, preferences, requirements)
argument-hint: "[init|map|preferences|requirements] (optional)"
---

Run:

```bash
overdrive workflow ${ARGUMENTS:-} --project-dir "$PWD"
```

Then act on the output. Bare `/ovd-workflow` shows tutorial + status + action-path next steps. `/ovd-workflow init` runs the initialization flow (codebase mapping, preferences, requirements) with explicit user approval at each step; on projects with the pre-r3 `.overdrive/` layout it detects and offers migration. `/ovd-workflow map` refreshes the codebase analysis. See r3 §4 for full semantics.

If the command is unavailable, explain that the full Overdrive CLI needs to be installed first.
