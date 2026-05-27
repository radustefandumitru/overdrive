# Evaluation And Consistency Checks

AgenticSupercharge v0.3 added lightweight maintainer checks for two things:

- The repo stays internally consistent as skills, docs, release archives, and installer metadata change.
- The `skill-router` can be evaluated against repeatable prompts instead of judged only by vibes.

These checks are intentionally small and dependency-free. They do not call paid model APIs and they do not claim that every routed answer will be better. They make the project easier to test, review, and improve.

## Deterministic Checks

Run:

```bash
npm run consistency
npm run eval:router
```

`npm run consistency` checks repo metadata:

- `manifest.json` schema, pinned refs, package pins, skill counts, and smoke checks.
- Local skill folders, `SKILL.md` frontmatter, and `agents/openai.yaml` metadata.
- README, skill readiness docs, verified sources, third-party notices, changelog, package allowlist, and router catalog coverage.

`npm run eval:router` checks the router benchmark pack:

- Every benchmark case has a prompt, routed prompt, control prompt, expected skills, and scoring rubric.
- Expected skills exist in the manifest.
- Expected skills are documented in the router skill, catalog, or routing examples.
- The benchmark covers several task categories instead of only frontend work.

`./verify.sh` runs the normal installer verifier and then these two repo-level checks.

Add `-- --verbose` when running through npm if you want every individual check printed:

```bash
npm run consistency -- --verbose
npm run eval:router -- --verbose
```

## Router Benchmark Pack

The benchmark cases live in:

```text
evals/router-benchmark.json
```

Each case has:

- `prompt`: the user task being evaluated.
- `controlPrompt`: the task without explicit router usage.
- `routedPrompt`: the same task with `skill-router` invoked first.
- `expectedSkills`: the narrow skill set the router should consider.
- `rubric`: 0-2 scoring criteria for comparing outputs.

The benchmark is designed for manual or future automated evaluation. It validates that the router has coverage for the important paths, but the actual quality comparison still requires running model outputs and scoring them.

## Manual Quality Protocol

For a fair check:

1. Pick one benchmark case.
2. Run `controlPrompt` in a fresh session with the same model and tools.
3. Run `routedPrompt` in a separate fresh session with the same model and tools.
4. Hide which output is control vs routed when practical.
5. Score each rubric item from 0 to 2.
6. Record total score, notes, and any regressions.

Use the same model, repository state, tool access, temperature/settings, and time budget. Do not add extra hidden instructions to one side.

## What Counts As A Win

The router is doing its job when routed outputs are more likely to:

- Pick the right specialized skill instead of generic advice.
- Keep context small by loading only useful skills.
- Surface safety, accessibility, verification, and tool-approval concerns earlier.
- Produce more domain-specific plans and implementations.
- Avoid unnecessary skill loading on tiny or obvious tasks.

The router is failing when it:

- Selects too many skills.
- Routes to broad skills when a narrow skill exists.
- Adds noise before simple tasks.
- Hides uncertainty instead of using `clarify-and-plan`.
- Makes the agent appear more confident without improving the actual work.

## Current Claim

As of v0.3, AgenticSupercharge has a repeatable router benchmark and automated coverage checks. It does not yet include a statistically meaningful public scorecard proving a fixed output-quality lift across models. That claim should wait until benchmark runs are collected and reviewed.

v0.4 extends the benchmark with a complex multi-phase case to ensure the router no longer treats three skills as a hard cap and can mention AS-Workflow/checkpoints when project memory would help.
