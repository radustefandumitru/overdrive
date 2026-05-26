<!-- ai-skill-setup:global-guidelines:start -->
# Global Coding Agent Guidelines

These guidelines are adapted from the Karpathy-inspired coding-agent guidance in `multica-ai/andrej-karpathy-skills`. They apply across projects and should be merged with more specific project instructions.

Tradeoff: bias toward caution, clarity, and small diffs on non-trivial work. For obvious one-line fixes, use judgment and keep moving.

## Think Before Coding

- Do not silently choose an interpretation when the request is ambiguous.
- State important assumptions briefly before relying on them.
- Ask when uncertainty would materially change the implementation.
- When multiple viable approaches exist, present 2-3 options with tradeoffs and recommend one.
- Surface tradeoffs and push back when a simpler or safer approach exists.
- Stop and name confusion instead of coding around it.

## Simplicity First

- Write the minimum code that solves the requested problem.
- Do not add features, abstractions, configurability, dependencies, or error handling that were not asked for or clearly required.
- Avoid one-use abstractions unless they remove real complexity.
- If the solution is becoming much larger than the problem, simplify before continuing.

## Surgical Changes

- Touch only files and lines needed for the user's request.
- Match the existing style even when you would normally choose a different one.
- Do not refactor, reformat, rename, or delete adjacent code as a drive-by improvement.
- Remove imports, variables, functions, and files that your own change made unused.
- Mention unrelated dead code or suspicious behavior, but do not remove it unless asked.
- Every changed line should trace back to the request or to verification required by the request.

## Goal-Driven Execution

- Convert vague implementation requests into concrete success criteria.
- For bugs, prefer a failing reproduction or test before the fix when practical.
- For refactors, preserve behavior and verify before and after when practical.
- For multi-step work, use a short plan with verification points.
- For complex phased work, break the work into explicit phases and confirm phase 1 before starting phase 2 when the next phase materially changes scope, architecture, data, auth, publishing, or irreversible state.
- Keep looping until the stated goal is verified or a real blocker is named.

## Planning Workflows

- For multi-step coding work in Claude Code, prefer `/model opusplan`; for complex multi-system tasks, use `/ultraplan`. Do not use these for trivial one-line fixes or factual questions.
- When Claude Code native review commands are available, use `/security-review` for security audits and `/code-review` for general code review.
- For Codex, Cursor, Gemini CLI, Antigravity, shared `.agents`, or project-local agents, use the `planning-first` skill for complex multi-file work when no native planning mode is available.

## Context7 Documentation

- Use Context7 MCP for library, framework, SDK, API, CLI, cloud-service, setup, configuration, migration, or version-specific documentation tasks.
- Prefer current official docs through Context7 over memory when available.
- If Context7 is unavailable, say so briefly and use the safest official documentation fallback.
- Never expose API keys, OAuth tokens, MCP secrets, service-role keys, connection strings, or personal app-session data.

## Skills And Context

- At the start of each non-trivial user request, consult `skill-router` as the default lightweight preflight to check whether any installed skills apply.
- If the user explicitly names one or more skills, use those skills for the relevant part of the task and skip router selection for that part unless another unspecified part still needs routing.
- If `skill-router` finds no useful match, proceed normally without loading extra skills.
- When `skill-router` is only a setup step, name the chosen 1-3 skills briefly, then proceed with the task.
- For tiny factual answers, casual conversation, or obvious one-command requests, skip visible routing unless a matching skill is clearly useful.
- Do not load the full skill catalog by default. Load only the smallest useful skill set.
- Keep global context small. Put project facts in project files and detailed workflows in skills.

## Context Budget

- Monitor remaining context as work progresses. When estimated remaining context drops below about 40% of the model window, or earlier if large tool outputs are accumulating, surface a brief in-chat choice: compact prior conversation with `context-compression`, start a fresh session with a handoff file, or continue as-is.
- If the user chooses compact, invoke `context-compression`, then restate the active goal and verification checkpoints in 2-3 lines.
- If the user chooses a fresh session, write a short handoff file with the active goal, key decisions, files touched, and next steps.
- If the user chooses to continue, proceed normally and do not re-prompt unless context grows substantially further, such as past roughly 75% used.
- Never compress silently. Compression loses detail, so the user should always consent.
<!-- ai-skill-setup:global-guidelines:end -->
