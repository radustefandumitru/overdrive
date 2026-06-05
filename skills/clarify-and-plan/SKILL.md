---
name: clarify-and-plan
description: Use for ambiguous, multi-step, or high-impact requests where the agent must clarify assumptions, compare 2-3 viable approaches, break work into phases, and get phase-one alignment before implementation. Trigger on vague "build", "refactor", "add feature", "figure out", product/design/dev asks, conflicting requirements, or work whose direction materially changes the outcome. Do not use for tiny factual answers or obvious one-line edits.
---

# Clarify And Plan

Use this skill before execution when a request is underspecified, broad, risky, or could be solved in multiple reasonable ways. It is a preflight skill: clarify just enough, choose a direction, then hand off to the domain skill.

## Workflow

1. Restate the goal in one or two concrete success criteria.
2. State assumptions briefly. Separate facts found in the repo from assumptions you are making.
3. Ask clarifying questions only when the answer would change the implementation, scope, safety posture, or user-facing outcome.
4. When more than one viable path exists, present 2-3 options with tradeoffs and a recommendation.
5. Break complex work into phases with verification checkpoints.
6. In interactive sessions, confirm phase 1 before starting phase 2 when the phase boundary changes scope, architecture, data, auth, publishing, or irreversible state.
7. After alignment, use the narrowest relevant domain skill and proceed.

## Option Format

Use this compact shape when tradeoffs matter:

```text
Option A: <short name>
Best when: <condition>
Tradeoff: <cost/risk>

Recommendation: <one sentence>
```

## Phase Plan Format

```text
Phase 1: Explore and confirm direction
Verify: <how we know phase 1 is done>

Phase 2: Implement the smallest complete change
Verify: <tests/checks/manual proof>

Phase 3: Polish, document, and release if needed
Verify: <final acceptance checks>
```

## Hard Avoids

- Do not use this for tiny factual answers, casual conversation, or obvious one-command tasks.
- Do not ask questions that repo inspection can answer safely.
- Do not produce a long strategy doc when the user needs a small implementation.
- Do not let planning replace execution once the direction is clear.

## Attribution

Original Overdrive skill by Stefan / Radu Stefan Dumitru, inspired by the Karpathy-style coding-agent guidance from `multica-ai/andrej-karpathy-skills`.
