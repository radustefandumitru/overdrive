---
name: autoresearch-harness
description: Design safe autonomous research/experiment loops inspired by Karpathy's autoresearch. Use for bounded experiment harnesses, optimization loops, overnight research plans, benchmark exploration, or repeated hypothesis testing with explicit budget, rollback, logging, and approval gates.
---

# Autoresearch Harness

Use this skill when the user wants an agent to explore a research, benchmark, optimization, or implementation space over repeated iterations.

This is an Overdrive-authored safety wrapper inspired by `karpathy/autoresearch`. Do not copy upstream code, do not auto-install dependencies, and do not start long-running loops without explicit user approval.

## Hard Requirements

Before running or proposing an autonomous loop, define:

1. **Objective**: what the loop optimizes or discovers.
2. **Editable Surface**: exactly which files, configs, prompts, or parameters may change.
3. **Locked Surface**: what must not change.
4. **Evaluation**: command, script, benchmark, metric, or human review gate.
5. **Budget**: max iterations, wall-clock time, API/tool budget, GPU/CPU constraints.
6. **Rollback**: git branch/worktree, checkpoint, patch files, or backup strategy.
7. **Logging**: where attempts, metrics, failures, and decisions are recorded.
8. **Stop Conditions**: target score, no improvement, repeated failure mode, budget reached, or user intervention.

If any of these are missing, ask or propose conservative defaults before continuing.

## Safety Rules

- Do not run overnight, high-cost, GPU-heavy, paid API, or large web-crawling loops without explicit confirmation.
- Do not install Python, Node, system packages, browser drivers, CUDA tooling, or model weights automatically.
- Do not write secrets into logs, prompts, configs, or experiment artifacts.
- Do not mutate production databases, real user accounts, auth settings, billing systems, deployment settings, or external services as part of an experiment loop.
- Keep loops fail-open: errors should stop or log and continue within budget, not hide failures.
- Prefer a dry run or one-iteration pilot before a long run.

## When To Use Other Skills

- Use `harness-engineering` when the main problem is building the test/evaluation harness.
- Use `self-improvement-loops` when the main problem is improving prompts, agents, or workflows over repeated runs.
- Use `advanced-evaluation` when scoring quality is the hard part.
- Use `graphify` when the loop needs codebase relationship mapping first.
- Use `planning-first` when there is not yet a clear experimental plan.

## Recommended Loop Shape

```text
for each iteration:
  1. read current state and previous results
  2. propose one small change
  3. apply only within editable surface
  4. run evaluation
  5. record metric, diff summary, and failure notes
  6. keep, revert, or branch based on acceptance rule
  7. stop if budget or stop condition is hit
```

## Output Contract

When asked to design a loop, produce:

- experiment title
- objective and hypothesis
- editable/locked surfaces
- setup commands, clearly marked as user-approved/manual if they install anything
- evaluation command or scoring rubric
- budget and stop conditions
- logging/checkpoint plan
- rollback plan
- first iteration plan
- risk notes

When asked to execute, run a pilot iteration first unless the user explicitly approves the full loop.

## Logging Template

```markdown
## Iteration N

- Change:
- Reason:
- Command:
- Result:
- Metric:
- Kept/Reverted:
- Notes:
```
