---
name: planning-first
description: Use for complex coding work on Codex, Cursor, Gemini, Antigravity, or other agents without Claude Code's native opusplan flow. Trigger on multi-file implementation, refactors, new features beyond one function, vague specs, migrations, release work, or tasks needing Explore -> Plan -> Implement -> Verify discipline. Pair after clarify-and-plan when ambiguity exists. Avoid trivial fixes, factual answers, and one-line edits.
---

# Planning First

Use this skill when the implementation is large enough that rushing straight into edits is likely to create churn. It creates a portable version of a planning-first workflow for agents that do not have Claude Code's native `/model opusplan` or `/ultraplan` commands.

## Runtime Choice

- Claude Code: prefer native `/model opusplan` for multi-step coding and `/ultraplan` for complex multi-system tasks when available.
- Codex, Cursor, Gemini CLI, Antigravity, shared `.agents`, or local project agents: use this skill.
- If the user explicitly asks to skip planning, keep only a one-paragraph plan and proceed.

## Workflow

1. Explore:
   - Inspect the repo, instructions, relevant files, tests, scripts, and existing patterns.
   - Identify unknowns, constraints, and blast radius.
   - Use `clarify-and-plan` first if ambiguity would change the work.
2. Plan:
   - Produce a short ordered plan with verification after each phase.
   - Name files or modules likely to change when known.
   - State what is intentionally out of scope.
3. Implement:
   - Make the smallest complete changes that satisfy the plan.
   - Keep diffs surgical and preserve user-owned changes.
   - Update the plan as phases complete.
4. Verify:
   - Run the narrowest meaningful tests/checks first.
   - Add browser, build, lint, typecheck, or manual verification when the risk justifies it.
   - If verification fails, loop on the failure before declaring completion.
5. Close:
   - Summarize what changed, what passed, and any residual risk.

## Planning Rules

- Plans should usually be 3-6 steps, not a dissertation.
- One in-progress step at a time.
- If implementation reveals a better route, update the plan and explain the pivot.
- For destructive, publishing, auth, billing, production-data, or account-affecting actions, ask before acting.

## Hard Avoids

- Do not use for one-line fixes, short explanations, or quick factual answers.
- Do not create architecture documents unless the task needs them.
- Do not keep planning after the user has already approved a clear plan and expects implementation.

## Attribution

Original Overdrive skill by Stefan / Radu Stefan Dumitru, designed to give non-Claude agents a lightweight planning-first workflow.
