---
description: ovd-plan — deliberate, edit, or surface a new idea against the project plan
argument-hint: "[deliberate|research|create|edit|idea \"text\"] (optional)"
---

Run:

```bash
overdrive plan ${ARGUMENTS:-} --project-dir "$PWD"
```

Then act on the output. Bare `/ovd-plan` displays the tree + state and proposes next steps; `/ovd-plan idea "text"` analyzes impact of a new direction; `/ovd-plan deliberate` enters Socratic planning; `/ovd-plan edit` modifies the tree structurally. Full semantics: `docs/ovd-plan-v2.md` in the Overdrive repo.

**Intent routing (r3 §3.4):** This is an explicit `/ovd-...` command — run it as typed; do **not** re-classify. When the user sends a *free-form* message instead (no leading `/ovd-`), classify it first with `overdrive plan intent "<message>" --project-dir "$PWD"`, then follow the routing decision (announce + execute, a numbered options prompt, or a clarifying question). Explicit commands always bypass classification. If the user corrects a route you announced ("that's not what I meant"), log it: `overdrive plan intent --entries-json '{"action":"correction","original_message":"...","classified_as":"...","corrected_to":"..."}'` (r3 §3.5).

If the command is unavailable, explain that the full Overdrive CLI needs to be installed first.
