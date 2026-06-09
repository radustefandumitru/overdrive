---
description: ovd-plan — deliberate, edit, or surface a new idea against the project plan
argument-hint: "[deliberate|research|create|edit|idea \"text\"] (optional)"
---

Run:

```bash
overdrive plan ${ARGUMENTS:-} --project-dir "$PWD"
```

Then act on the output. Bare `/ovd-plan` displays the tree + state and proposes next steps; `/ovd-plan idea "text"` analyzes impact of a new direction; `/ovd-plan deliberate` enters Socratic planning; `/ovd-plan edit` modifies the tree structurally. See `docs/superpowers/specs/2026-06-08-ovd-plan-pipeline-architecture-r3.md` §5 for full semantics.

If the command is unavailable, explain that the full Overdrive CLI needs to be installed first.
