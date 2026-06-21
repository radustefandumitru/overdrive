---
description: ovd-go — orient on the active leaf and continue execution
argument-hint: "[verify|<node-ref>|test <node-ref>|--small \"desc\"] (optional)"
---

Run:

```bash
overdrive go ${ARGUMENTS:-} --project-dir "$PWD"
```

Then act on the output. Bare `/ovd-go` orients on the active leaf and presents action paths (continue, switch, review, replan); `/ovd-go --small "..."` performs surgical changes without skill load; `/ovd-go <node-ref>` jumps to a specific node. See r3 §6 for full semantics.

Leaves never auto-mark `done` — explicit user approval (`approved`, `ship`, `done`, `next`) closes a leaf. Iteration is the default.

**Intent routing (r3 §3.4):** This is an explicit `/ovd-...` command — run it as typed; do **not** re-classify. When the user sends a *free-form* message instead (no leading `/ovd-`), classify it first with `overdrive plan intent "<message>" --project-dir "$PWD"`, then follow the routing decision (announce + execute, a numbered options prompt, or a clarifying question). Explicit commands always bypass classification.

If the command is unavailable, explain that the full Overdrive CLI needs to be installed first.
