---
description: ovd-log — lightweight save (default) or full handoff at session end
argument-hint: "[handoff|capture \"text\"|concerns] (optional)"
---

Run:

```bash
overdrive log ${ARGUMENTS:-} --project-dir "$PWD"
```

Then act on the output. Bare `/ovd-log` is the lightweight save (captures conversation, updates state and docs, walks the closure tree) — invoke before clearing context. `/ovd-log handoff` runs the full end-of-session pipeline including milestone-close detection. `/ovd-log capture "text"` appends a timestamped activity entry. `/ovd-log concerns` runs a structured review on the active node. See r3 §7 for full semantics.

**Intent routing (r3 §3.4):** This is an explicit `/ovd-...` command — run it as typed; do **not** re-classify. When the user sends a *free-form* message instead (no leading `/ovd-`), classify it first with `overdrive plan intent "<message>" --project-dir "$PWD"`, then follow the routing decision (announce + execute, a numbered options prompt, or a clarifying question). Explicit commands always bypass classification.

If the command is unavailable, explain that the full Overdrive CLI needs to be installed first.
