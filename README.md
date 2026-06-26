# Overdrive

> I built Overdrive over the years as my own daily AI coding-agent setup and I'm releasing it completely for free for the community to use. I've built many different websites, web-apps and mobile apps with it across Claude Code, Codex and Antigravity. If you build something with it, tag me on X [@editor_stefan](https://x.com/editor_stefan), send feedback on Reddit at [u/StefanDumitru](https://www.reddit.com/user/StefanDumitru/) or open an issue/PR.
>
> I'm just a recent uni grad that likes coding in his spare time. If you want to buy me a coffee, you can do so [here](https://buymeacoffee.com/stefandumitru) :) - Anything is much appreciated!
>
> - Stef

![Overdrive logo](assets/overdrive%20logo.png)

**Overdrive** is a complete, plug-and-play system for upgrading AI coding agents with specialist skills, smarter routing, local project memory, and safer install/update behavior.

It works across Claude Code, Codex, Gemini CLI, Antigravity, Cursor, and shared `.agents` roots. The current manifest contains 137 unique skills for web/app development, frontend polish, animation, SEO, product work, research, launch prep, security review, browser validation, prompt improvement, codebase intelligence, and local workflow state.

Overdrive is not just another skill pack. It is the operating layer around the skills:

- **Managed skills** teach agents how to handle specific kinds of work.
- **`skill-router`** chooses the right skills for the current request instead of loading the whole catalog.
- **`ovd-workflow`** stores small local project state in `.overdrive/` so agents can remember active work, decisions, constraints, preferences, routes, and handoffs.
- **Global instructions** make agents plan when needed, stay objective, keep diffs small, use Context7 for current docs, watch context budget, and verify work.
- **Installer safety** keeps sources pinned, avoids destructive overwrites by default, supports dry-runs, and uninstalls only managed files.

The goal is practical: better agent output with less repeated prompting, without turning every session into a giant context dump.

## Quick Start

Preview first. This prints the install plan without changing files:

```bash
npx -y github:radustefandumitru/overdrive -- --dry-run
```

Install globally:

```bash
npx -y github:radustefandumitru/overdrive
```

Or install from a clone:

```bash
git clone https://github.com/radustefandumitru/overdrive.git
cd overdrive
./install.sh --dry-run
./install.sh
```

Restart or reload your coding agent after install so it re-indexes the skill folders.

The npm package name is `overdrive-cli`. The CLI exposes these commands:

```bash
overdrive --help
ovd --help
overdrive-cli --help
```

## What Changes After Install

You keep prompting normally. For non-trivial work, the global instructions ask the agent to do a lightweight router check. The router can then load the smallest useful skill sequence.

| You ask | The router might use |
|---|---|
| "Review this for security holes before I deploy." | `security-review` |
| "Make this drawer feel smooth and natural." | `fluid-animations` + `emil-animation-polish` |
| "Find and fix problems in my React app." | `react-doctor` |
| "Make this prompt sharper before I send it to another AI." | `prompt-master` |
| "Make this paragraph sound less AI-written but keep the facts." | `humanizer` |
| "Extract the design language from this public website." | `design-extract` |
| "Watch this screen recording and tell me where the UI breaks." | `claude-video` |
| "Virtualize 100k variable-height text rows without layout thrash." | `pretext` |
| "SEO-audit my site before launch." | `jack-seo-launch-audit` |
| "Design a premium landing page and verify it in-browser." | `design-taste-frontend` + `impeccable` + `playwright-cli` |

You can also name a skill directly:

```text
Use prompt-master to tighten this launch prompt before I send it.
Use graphify to map how this codebase fits together before editing.
Use liquid-glass-web for this navigation component.
```

Explicit user-named skills win for that part of the task.

## System Overview

![Overdrive flow diagram](assets/overdrive-flow-diagram@2x.png)

Overdrive has four main runtime layers:

| Layer | What it does |
|---|---|
| Managed skills | Installs curated `SKILL.md` folders into selected agent roots. Each managed skill has an `.overdrive.json` marker. |
| Skill router | Reads the task and picks relevant skills in a stable, deterministic ordering. Complex work can use more than three skills when justified, preferably in phases. |
| ovd-workflow | Creates local `.overdrive/` project state for project memory, checkpoints, route traces, preferences, research notes, file hashes, usage summaries, and knowledge-vault indexing. |
| Global guide | Adds managed instruction blocks that keep agents cautious, objective, surgical, docs-aware, and verification-oriented. |

Skills answer **how should the agent do this kind of task?**

`skill-router` answers **which specialist guidance is relevant now?**

`ovd-workflow` answers **what is already happening in this project?**

## Operating Guide And Router

Overdrive installs a managed global operating guide and the `skill-router` skill. They are included here so users can inspect the actual behavior before installing.

<details>
<summary>Installed global operating guide</summary>

````markdown
<!-- overdrive:global-guidelines:start -->
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

## Objectivity And Pushback

- Default to objective, evidence-based reasoning. Do not blindly agree with the user, and say plainly when a plan, claim, or assumption is likely wrong.
- When the user asks to pressure-test, critique, or stress-test a plan, attack the plan first: find weak assumptions, failure modes, missing decisions, and hidden costs. Then steelman the best version and give an honest recommendation.
- Avoid the sycophancy / Dunning-Kruger feedback loop: do not validate or amplify an idea because the user is confident or enthusiastic. Judge it on the merits.
- Before a consequential, ambiguous, or irreversible decision built on a weak premise, briefly surface the strongest objection and the better alternative, then proceed once the direction is clear.
- When the user's preferred idea competes with a stronger one, recommend the stronger option and say why. Do not slow down trivial or clearly specified tasks with unnecessary challenge.
- If you do not know how to do something, or the user explicitly asks you to research, start with current research using web search, Context7, or official docs before guessing.

## Concise Output

- Skip unnecessary preamble, generic affirmations, and restating the user's question.
- Go straight to the answer or the next useful action.
- Match output length to the task. Do not pad short answers, and do not collapse important implementation detail when the task needs depth.
- These prompt-line principles are inspired by public guidance from Boris Cherny / Anthropic, shared via @AnatoliKopadze.

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

- Use the runtime's native plan mode where available, such as Claude Code plan mode with `/model opusplan`; for complex Claude multi-system tasks, use `/ultraplan`. Do not use these for trivial one-line fixes or factual questions.
- `clarify-and-plan` adds requirement and ambiguity clarification that native plan modes do not force, and `planning-first` is the planning layer for agents without a native plan mode. Do not run two redundant planning passes: clarify, then plan, then build.
- When Claude Code native review commands are available, use `/security-review` for security audits and `/code-review` for general code review.
- For Codex, Cursor, Gemini CLI, Antigravity, shared `.agents`, or project-local agents, use the `planning-first` skill for complex multi-file work when no native planning mode is available.
- For complex multi-step work, use the runtime's planning or model knob when available. Overdrive does not auto-switch models across providers; apply Claude Code `/model opusplan` or `/ultraplan`, Codex reasoning/model options, Gemini planning/model options, or Cursor model choices deliberately.
- For large, decomposable tasks, use the runtime's native orchestration where available, such as Claude dynamic workflows / Task subagents or Codex Goals, to run independent subtasks in parallel with clean contexts; lean on `multi-agent-patterns`. Do not build a custom orchestrator. Prefer cheaper or faster models for simple subtasks where the runtime supports that choice; do not assume every agent has subagents or per-task model routing.

## Context7 Documentation

- Use Context7 MCP for library, framework, SDK, API, CLI, cloud-service, setup, configuration, migration, or version-specific documentation tasks.
- Prefer current official docs through Context7 over memory when available.
- If Context7 is unavailable, say so briefly and use the safest official documentation fallback.
- Never expose API keys, OAuth tokens, MCP secrets, service-role keys, connection strings, or personal app-session data.

## Skills And Context

- At the start of each non-trivial user request, consult `skill-router` as the default lightweight preflight to check whether any installed skills apply.
- If the user explicitly names one or more skills, use those skills for the relevant part of the task and skip router selection for that part unless another unspecified part still needs routing.
- If `skill-router` finds no useful match, proceed normally without loading extra skills.
- When `skill-router` is only a setup step, name the chosen skill sequence briefly, then proceed with the task.
- For tiny factual answers, casual conversation, or obvious one-command requests, skip visible routing unless a matching skill is clearly useful.
- Do not load the full skill catalog by default. Load only the smallest useful skill set. Complex work may use more than three skills when genuinely needed, preferably phased instead of all at once.
- Keep context lean: after a verbose tool output has been used, summarize or mask it rather than re-reading it; do not re-paste large unchanged content.
- Prefer stable, front-loaded context: keep skills, instructions, and workflow state early and unchanged across turns so the harness's prompt cache stays warm; put the changing request last.
- For a vague or underspecified request, sharpen the goal or ask one clarifying question before executing; do not silently guess.
- Keep `context-optimization`, `context-compression`, and `clarify-and-plan` router-selectable for deep work; do not load them as always-on skills.
- Keep global context small. Put project facts in project files and detailed workflows in skills.
- For codebase relationship/orientation questions, if a Graphify graph already exists in the project, prefer querying it before broad `rg`; if stale, recommend Graphify's own `--watch` or git-hook workflow. Do not start a background indexer from Overdrive.

## ovd-workflow

- If `.overdrive/` exists in the project, treat it as local runtime state for project memory, active work, decisions, and handoffs.
- Read `.overdrive/state.md` or the active work folder only when it helps the current task. Do not dump the whole workflow folder into context.
- If `.overdrive/knowledge-index.json` exists and the task could benefit from local reference docs, inspect the index first, then load only the specific relevant source file or `markdownCache`. Do not dump the whole knowledge vault into context.
- If `.overdrive/preferences.md` exists, read it at the start of meaningful work when it could prevent repeating prior mistakes.
- When the user expresses a dislike, says "never do X", repeats a correction, or shows clear frustration, append a short dated rule to `.overdrive/preferences.md` when the workflow exists. If the new preference contradicts existing workflow state, ask before recording it. Keep it lightweight and never store secrets or sensitive data.
- For local PDFs, Office files, spreadsheets, HTML exports, or data files, prefer `convert-to-markdown`/MarkItDown before reading when it would reduce tokens or preserve structure.
- After meaningful multi-step work, keep workflow notes short and current when practical: state, decisions, progress, route trace, or checkpoint.
- When the user states a durable preference, constraint, or decision, append a short dated note to `.overdrive/decisions.md` when the workflow exists. If the new statement contradicts a recorded decision or constraint, surface the conflict and ask before overwriting it.
- If you notice an oscillating fix loop, such as fixing A breaking B and fixing B re-breaking A, or if the user signals frustration, stop and say so plainly. Propose a different approach such as a smaller repro, different method, online research, another skill, a fresh model/planning mode, or a checkpoint before continuing.
- Use `overdrive status`, `overdrive doctor`, `overdrive resync`, or `overdrive checkpoint` when those commands are available and the workflow state matters.
- When the user asks "show status", "what's going on", "OVD status", or similar project-state questions, run or suggest `overdrive status` if available.
- When the user asks "show usage", "what's burning tokens", "token usage", "Claude usage", or similar local usage questions, run or suggest `overdrive usage` if available. It is local, read-only, token-only, and should not print prompts or message content.
- Do not commit `.overdrive/`. It is local project state and should be gitignored by default.

## Context Budget

- Monitor estimated context use and re-check it on each substantial new request. Surface a brief, escalating heads-up as usage climbs, and re-surface it each time it crosses into a higher band, not just once:
  - ~60%+ (caution): note that context is getting heavy; offer to compact/summarize (`context-compression` or the runtime's native compaction), start a fresh session with a handoff, or continue, especially before a big multi-step task.
  - ~75%+ (warning): raise it again, more firmly. Recommend compacting or a fresh handoff before the next big step.
  - ~85-90%+ (red zone): strongly urge compaction or a fresh session now, before continuing; instruction-following and output quality degrade sharply here.
- Re-prompt when usage crosses each new band, even if the user previously chose to continue. Keep it brief, without nagging again within the same band.
- If the user chooses compact, invoke `context-compression` or native compaction, then restate the active goal and verification checkpoints in 2-3 lines.
- If the user chooses a fresh session, write a short handoff file with the active goal, key decisions, files touched, and next steps.
- Defer to the runtime's native compaction where it exists; this is a proactive prompt-level heads-up, not custom memory machinery. Use native context and memory commands when available instead of guessing: Claude Code `/memory` and `/compact`, Codex `/compact` and `/mcp`, Gemini CLI `/memory`, `/compress`, `/stats`, `/skills`, and `/mcp`.
- Treat platform-specific context levers as platform-specific. Claude-only options such as MCP tool-search deferral (`ENABLE_TOOL_SEARCH=false`) or `disable-model-invocation` should not be presented as universal behavior.
- Never compress silently. Compression loses detail, so the user should always consent.
<!-- overdrive:global-guidelines:end -->
````

</details>

<details>
<summary>Installed skill-router</summary>

````markdown
---
name: skill-router
description: Use as a lightweight preflight for non-trivial requests when no explicit skill was named and any installed skill might help. Route ambiguous or multi-phase work to clarify-and-plan/planning-first; prompt engineering to prompt-master; product-design layer reasoning to layers-intro plus the narrow layers-* skill; frontend/design/motion to Taste/Emil/fluid/liquid-glass-web/playwright; text measurement/layout performance to pretext; design-system extraction from public URLs to design-extract; video comprehension to claude-video; codebase relationship mapping and mixed-corpus graph questions to graphify when available; React diagnostics to react-doctor; security audits to Claude native /security-review, Claude security-guidance when available, or portable security-review; pressure-testing to what-should-i-consider; recent online research to last30days; Reddit/community research to reddit-research; local PDF/Office/data reference conversion to convert-to-markdown; app questionnaire onboarding to app-onboarding-questionnaire; launch readiness to pre-launch-checklist. Also route docs/specs, MCP servers, Slack GIFs, context compression, marketing/copy/humanizing, Obsidian JSON Canvas/Defuddle, media downloads, external app actions, browser automation, image generation, Remotion/video, Chrome extensions, and skill discovery. Advisory only: choose the smallest useful skill sequence, with no hard cap for genuinely complex work, and skip visible routing for tiny factual answers, casual conversation, obvious one-command requests, or task sections where the user already named the skill.
---

# Skill Router

Use this skill to choose the right installed skill or skill sequence without loading unnecessary context. It is a routing layer, not a replacement for the routed skill.

## Core Rules

1. Begin non-trivial requests by consulting `skill-router` as a lightweight preflight to decide whether any installed skills apply. This means selecting a small skill set, not loading the full catalog.
2. If the user explicitly names a skill, use that skill for the relevant task section and do not override it with router selection unless a different, unspecified section still needs routing.
3. Prefer exact domain skills over broad design or planning skills.
4. For ambiguous, high-impact, or multi-step requests, route to `clarify-and-plan` first when assumptions, tradeoffs, or phase boundaries need to be made explicit. Then add the relevant domain skill.
5. For complex coding implementation on Codex, Cursor, Gemini, Antigravity, shared `.agents`, or local project agents, route to `planning-first` when the task spans multiple files, phases, migrations, refactors, or vague feature work. In Claude Code, prefer native `/model opusplan` or `/ultraplan` when available.
6. For "what am I missing?", architecture pressure tests, plan critiques, hidden assumptions, or consequential technical/product decisions, use `what-should-i-consider`. Pair with `clarify-and-plan` only when the user also needs options or a phased plan.
7. For security review, vulnerability audit, hardening, auth/authz, injection, XSS, RCE, secrets, data exposure, or supply-chain checks: on Claude Code prefer the native `/security-review` for explicit audits and PR/code reviews. When Claude Code's `security-guidance` plugin is installed, treat it as the preferred Claude-only preventative layer for generated-code warnings, diff/commit security feedback, and project-specific `claude-security-guidance.md` rules. On other agents use the portable `security-review` skill. Do not load Claude-native review commands and the portable skill for the same audit.
8. For React diagnostics, `/doctor`, React lint/code quality cleanup, bundle/code-health scans, or "diagnose React issues", use `react-doctor`. Keep it React-specific; use broader planning/design/security skills for non-React work.
9. For recent online/social/community research, current sentiment, trending repos, "what are people saying," or "last 30 days" requests, use `last30days` when installed. Treat paid/social sources as optional user-configured capabilities.
10. For Reddit-specific research, subreddit mining, Reddit sentiment, thread/comment analysis, or "what are people saying on Reddit" requests, use `reddit-research`. Pair with `last30days` for current/recent sentiment. Keep it low-volume, public-read-only, and honest about rate limits or blocks.
11. For local document references, PDFs, Office files, spreadsheets, presentations, HTML exports, CSV/data files, or ovd-workflow knowledge-vault ingest, use `convert-to-markdown` before reading native files when conversion would reduce context or preserve structure. Do not use it for code files or when visual layout fidelity is the task. For codebase relationship mapping, "how does this fit together?", "what connects X to Y?", or mixed code/docs corpus graph questions, use `graphify` when available. If a Graphify graph already exists in the project, prefer querying it before broad `rg`; if stale, recommend Graphify's own `--watch` or git-hook workflow. If Graphify is missing after installer setup or the user declines setup, fall back to normal repo exploration with `rg`, file reads, tests, and ovd-workflow state.
12. For questionnaire-style onboarding flows for web/mobile/subscription apps, use `app-onboarding-questionnaire`. Pair with design or frontend implementation skills only after the flow strategy is clear.
13. For launch readiness, shipping checklists, beta/public release, Product Hunt, App Store, SaaS launch, client handoff, monitoring, billing, privacy, or rollback preparation, use `pre-launch-checklist`. Pair with `security-review`, `jack-seo-launch-audit`, or marketing skills only for the relevant slice.
14. For prompt writing, prompt improvement, meta-prompts, reusable AI instructions, or "make this prompt better" requests, use `prompt-master`. Use `clarify-and-plan` when the actual project requirements are ambiguous; use `prompt-master` when the deliverable is the prompt itself.
15. For Jack Roberts inspired premium 3D/scroll websites, route to the narrow Jack skill first, then add the normal design/web validation stack:
   - `jack-premium-site-system` for the full brand -> asset prompts -> scroll site -> SEO -> optional launch workflow.
   - `jack-website-intelligence` for brand extraction, competitor research, client-facing strategy, and build briefs.
   - `jack-scroll-asset-prompts` for assembled/exploded, before/after, or transition prompts for AI image/video generators.
   - `jack-scroll-3d-sites` for video-on-scroll, frame-sequence canvas, GSAP/Framer Motion/Three.js scroll experiences.
   - `jack-seo-launch-audit` for multi-page SEO, metadata, structured data, responsive checks, and launch readiness.
16. For product-design layer reasoning, use Jamie Mill's Layers skills. Always include `layers-intro` before a layer-specific skill because it explains the framework dependency model.
   - `layers-orient` when the user does not know where the product/design problem lives.
   - `layers-observed-behaviour` for user behavior evidence, job-story candidates, and confidence.
   - `layers-domain` for domain terminology, concept maps, nouns, and language conflicts.
   - `layers-user-needs` for needs, pains, desires, and prioritised job stories.
   - `layers-product-strategy` for opportunity selection, bets, and product/service strategy.
   - `layers-conceptual-model` for objects, states, relationships, vocabulary, and product model coherence.
   - `layers-interaction-flow` for flows, breadboards, edge cases, and open interaction decisions.
   - `layers-surface` for surface decision inventory only after lower layers are reasonably clear.
17. For visual/frontend work, prefer the community design stack over generic design defaults:
   - Taste skills by default for real design references, premium visual direction, anti-slop landing pages, image-first frontend workflows, brand kits, and stronger style variants.
   - `emil-design-eng` by default for buttons, hover/focus states, transitions, animations, micro-interactions, easing, component feel, and UI that should not feel static.
   - `emil-animation-polish` for practical Emil-inspired web animation implementation: CSS transitions, custom easing, duration tuning, press feedback, hover/touch behavior, tooltip timing, origin-aware popovers, and smooth animation audits.
   - `fluid-animations` when motion needs Apple-quality direct manipulation: spring behavior, interruptibility, gesture velocity, rubberbanding, snap points, spatially consistent transitions, or reduced-motion-safe tactile UI.
	   - `liquid-glass-web` when the user asks for Liquid Glass, frosted glass, glassmorphism, translucent UI, SVG displacement, or WebGL refraction. It should choose Tier 1 universal frosted glass by default and enhance to Tier 2 or Tier 3 only when target browsers and performance justify it.
	   - `pretext` when the hard problem is text measurement/layout performance: virtualized variable-height text rows, shrinkwrapped chat bubbles, multiline measurement without DOM reflow, auto-growing textareas, label overflow checks, or Canvas/SVG/WebGL text.
	   - `design-extract` when the user wants to extract colors, fonts, spacing, components, Tailwind/shadcn tokens, or a design language from a public website URL. Treat the tool as optional: Overdrive attempts browser setup during install, the agent checks availability first, and extraction stays limited to public/authorized pages.
   - `impeccable` mostly as an end-of-development polish, audit, critique, spacing, and typography pass. Ask for user feedback before broad font, hierarchy, or visual-identity changes unless the user explicitly asks the agent to decide.
   - Anthropic/Claude `frontend-design` only as fallback if the community stack fails, is unavailable, or the user rejects the direction.
18. Add implementation support skills only when the task needs them:
   - `modern-web-guidance` for modern HTML/CSS/browser APIs, accessibility, forms, dialogs, popovers, performance, and Baseline compatibility.
   - `playwright-cli` for official Playwright CLI browser validation, screenshots, snapshots, flows, data extraction, and debugging.
   - `playwright` only as the pinned OpenAI wrapper/fallback when that specific wrapper is useful; otherwise prefer `playwright-cli`.
19. Use Context Engineering skills when context quality, compression, prompt-cache hygiene, multi-agent architecture, memory, tool design, long-thread continuity, or evaluation is the problem. `context-optimization`, `context-compression`, and `clarify-and-plan` are situational tools, not always-on skills; use `context-compression` only when the user asks for compaction or accepts a context-budget reminder.
20. Use Corey Haines marketing skills for SEO, CRO, copywriting, launches, pricing, ads, customer research, and growth strategy. Add `stop-slop` for public-facing prose and AI-tell cleanup. Use `humanizer` when the user gives existing text and asks to preserve meaning/facts while making it sound more natural, personal, or voice-matched; do not use it to fake authorship, fabricate lived experience, or remove required AI disclosure.
21. Use `banana` for image-generation requests when its Claude Code/Gemini setup is available. In runtimes without Banana/API setup, route to the native image tool or ask for setup.
22. Use Kepano's retained Obsidian-adjacent skills narrowly: `json-canvas` for JSON Canvas files and `defuddle` for clean web-to-markdown extraction when available. For broader Obsidian vault editing, proceed with normal Markdown/file tooling or ask the user to install a dedicated Obsidian workflow; snapshot real vaults before broad edits.
23. Use `claude-video` for understanding videos, screen recordings, product demos, visual regressions in recordings, or `/watch`-style analysis. Overdrive attempts non-privileged ffmpeg/yt-dlp setup during install; Whisper keys remain user-configured and must never be collected from chat. Use `media-download` for downloading or extracting media files, not for comprehension.
24. Use `media-download` for user-requested local media downloads, MP3 extraction, highest-quality MP4 downloads, or yt-dlp workflows. Respect platform terms and confirm permissions for restricted/copyrighted material.
25. Use Anthropic example skills for their narrow official domains:
   - `brand-guidelines` only when Anthropic branding, colors, typography, or company style guidelines are explicitly requested or appropriate.
   - `doc-coauthoring` for substantial docs, proposals, PRDs, RFCs, technical specs, and decision docs.
   - `mcp-builder` for MCP server design, tool schemas, API/service integrations, and MCP evaluation. Use Context7/current docs for SDK specifics.
   - `slack-gif-creator` for Slack-ready GIFs, animated emoji, and short workspace reaction loops. Approval-gate any actual Slack upload/post.
26. Use Composio/connect-style action skills reluctantly and only after explicit user approval before sending, posting, creating, deleting, authenticating, spending credits, or touching external accounts.
27. Treat MCPs/connectors as tools, not skills. The shareable kit only assumes Context7 for current documentation lookup; other MCPs are user/project-specific and should not be assumed.
28. Use Vercel Labs `find-skills` only when the user wants to discover, compare, or install new skills. Do not run broad skill discovery for normal implementation tasks.
29. Keep context small: route to the minimum sufficient skill sequence, state the order, and load only the reference needed for the conflict. Prefer stable, deterministic ordering: clarify/planning first, then product/domain reasoning, implementation, validation, launch/handoff, and context-management skills only when needed. There is no hard cap: genuinely complex tasks may use more skills when they are phased and each skill has a clear job.
30. If `.overdrive/` exists and the runtime command is available, append a short route trace after choosing skills:
   `overdrive route --skills "skill-a,skill-b" --reason "short reason"`.
   Skip this silently if the command is unavailable or the workflow folder is absent.

## Resolving Trigger Overlap

- `clarify-and-plan` vs `planning-first`: use `clarify-and-plan` when the request is ambiguous or has meaningful options. Use `planning-first` when the direction is mostly clear but the implementation is complex. Use both in that order for broad "build/refactor this" requests.
- `what-should-i-consider` vs `clarify-and-plan`: use `what-should-i-consider` to attack assumptions, risks, and missing decisions. Use `clarify-and-plan` to turn ambiguity into options and a phase plan.
- `planning-first` vs domain skills: planning is the wrapper; the domain skill does the specialized work. Example: `planning-first` -> `design-taste-frontend` for a multi-page UI rebuild.
- `security-guidance` vs Claude native `/security-review` vs portable `security-review`: use Claude's `security-guidance` plugin as an always-on/preventative Claude-only layer when available; use Claude's native `/security-review` for explicit security audits and PR/code reviews; use the portable `security-review` skill for Codex, Cursor, Gemini, Antigravity, and shared `.agents`.
- `react-doctor` vs generic frontend/design skills: use `react-doctor` for React code quality diagnostics. Use Taste/Emil/Impeccable for visual/interaction quality and `security-review` for vulnerability review.
- `layers-*` vs `clarify-and-plan`/`planning-first`: use Layers for product-design substance: observed behavior, domain language, user needs, strategy, conceptual model, interaction flow, and surface decisions. Use planning skills for process, implementation phases, and execution discipline.
- `layers-surface` vs visual polish skills: use `layers-surface` to inventory surface-level product/design decisions. Use Taste, Emil, Impeccable, and `liquid-glass-web` for actual visual direction, motion, polish, and implementation.
- `prompt-master` vs `clarify-and-plan`: use `prompt-master` when the output is an improved AI prompt, reusable instruction, or prompt template. Use `clarify-and-plan` when the agent needs to clarify the actual product/code requirements before doing work.
- `humanizer` vs `stop-slop`: use `humanizer` for preserving facts and meaning while adapting existing text to a human voice. Use `stop-slop` for broader AI-tell cleanup, punchier public prose, and generic writing removal.
- `design-extract` vs design-generation/polish skills: use `design-extract` to extract a design language from an existing public URL. Feed the findings into Taste/Impeccable/Emil when implementing or polishing a new UI.
- `liquid-glass-web` vs `emil-animation-polish`/`fluid-animations`: use `liquid-glass-web` for glass/refraction tier selection and implementation. Use Emil/Fluid for how it moves, responds, and feels.
- `pretext` vs design-generation/polish skills: use `pretext` for text layout math, measurement, virtualization, and reflow avoidance. Use Taste/Impeccable/Emil/Layers for visual direction, typography taste, product reasoning, and interaction polish.
- `claude-video` vs `media-download`: use `claude-video` to understand a video or screen recording. Use `media-download` when the requested action is saving, extracting, or downloading media.
- `pre-launch-checklist` vs `jack-seo-launch-audit`: use `pre-launch-checklist` for product/business readiness, monitoring, billing, privacy, rollback, support, and launch-day runbooks. Use `jack-seo-launch-audit` for animated/3D website SEO, metadata, structured data, performance, and responsive launch checks.
- `last30days` vs normal web search: use `last30days` for time-boxed community/recent sentiment research. Use normal web/docs search or Context7 for official documentation and exact API/library references.
- `reddit-research` vs `last30days`: use `reddit-research` when Reddit/subreddits/threads/comments are explicitly in scope. Add `last30days` when recency or broader community context matters.
- `convert-to-markdown` vs `defuddle`: use `convert-to-markdown` for local files and ovd-workflow knowledge-vault ingest. Use `defuddle` for web pages that need clean article/content extraction.
- `graphify` vs ovd-workflow knowledge vault: use `graphify` for on-demand queryable codebase or mixed-corpus relationship graphs. Prefer an existing Graphify graph before broad `rg` for relationship/orientation questions, but do not start a background indexer from Overdrive. Use ovd-workflow knowledge vault for local project reference docs, project memory, decisions, and indexed Markdown caches. Avoid routing both for the same request unless the user explicitly needs both code graph intelligence and local project-memory/reference-doc context.
- `app-onboarding-questionnaire` vs marketing `onboarding`/`signup`: use `app-onboarding-questionnaire` for questionnaire-style app onboarding flows and screen-by-screen strategy. Use marketing `onboarding` or `signup` for growth optimization of existing onboarding/signup funnels.
- `find-skills` vs `skill-router`: use `skill-router` to choose among installed skills. Use `find-skills` only to discover or install new skills.

## Reference Routing

- Read `references/frontend-design-routing.md` for frontend, product UI, landing page, brand, motion, image-first, or visual-quality conflicts.
- Read `references/compatibility-audit.md` for source, platform, overlap, context-bloat, and approval-risk notes.
- Read `references/sharing-and-transfer.md` when asked how to move this setup to another machine or teammate.
- Read `references/catalog.md` for broad inventory, non-design routing, or when the user asks what every skill is for.
- Read `references/routing-trace-examples.md` for example prompts and expected routing decisions.
  The examples also show how ovd-workflow route traces should stay short enough for `.overdrive/routes.jsonl`.

## Output Pattern

When routing is the main task, answer with:

```text
Recommended skill(s): <skill names in order>
Why: <one concise rationale>
Use now: <which skill should be loaded/invoked first>
Notes: <optional caveat about secondary skills or validation>
```

When routing is only a setup step before doing work, briefly name the chosen skill sequence, then proceed with the task using the relevant skill instructions.

## Hard Avoids

- Do not load the full catalog for every task.
- Do not make router output noisy for tiny tasks; the default skill-router preflight can be silent when no skill applies.
- Do not choose generic/Anthropic-style design guidance ahead of Taste skills, `emil-design-eng`, or `impeccable` for visual taste unless the user explicitly requests it.
- Do not let `impeccable` make broad font/hierarchy/identity changes without user feedback unless the user explicitly asks the agent to decide.
- Do not use `full-output-enforcement` unless the user needs complete unabridged output or previous output was truncated.
- Do not use external action skills without approval.
- Do not assume a shared setup includes MCP credentials, OAuth state, API keys, or personal connector sessions.
````

</details>

## Skill Library

The current manifest contains 137 unique skills. For a compact map, see [`SKILLS_TLDR.md`](SKILLS_TLDR.md). For the full inventory, see [`SKILLS_SUMMARY.md`](SKILLS_SUMMARY.md).

| Area | What it helps with |
|---|---|
| Frontend quality | Better layouts, typography, spacing, responsive behavior, visual hierarchy, and anti-generic UI direction. |
| Animation | Smooth transitions, spring-like motion, gesture feel, scroll animation, reduced-motion support, and practical browser implementation. |
| 3D/scroll websites | Brand research, AI asset prompts, video/frame-sequence scroll experiences, SEO, and launch checks. |
| Product design layers | `layers-*` skills help agents reason from observed behaviour through domain, user needs, strategy, conceptual model, interaction flow, and surface decisions. |
| Glass UI | `liquid-glass-web` teaches Liquid Glass as progressive enhancement: universal frosted glass first, then SVG displacement or WebGL only when justified. |
| Text layout engineering | `pretext` teaches agents to use `@chenglou/pretext` for text measurement/layout performance: virtualized text rows, shrinkwrapped chat bubbles, auto-growing textareas, overflow checks, and Canvas/SVG/WebGL text. |
| Prompt engineering | `prompt-master` helps write or improve prompts, reusable instructions, and AI task specs without turning every task into meta-prompting. |
| Writing polish | `humanizer` rewrites text to sound more natural while preserving meaning and facts; `stop-slop` remains the broader AI-tell cleanup skill. |
| Design extraction | `design-extract` can ingest a public website's design language, tokens, fonts, spacing, and component patterns when optional tooling is available. |
| Video comprehension | `claude-video` helps agents analyze videos and screen recordings; `media-download` remains the downloader. |
| Product and planning | Clarifying vague requests, phase planning, launch readiness, app onboarding, and product strategy. |
| Marketing and growth | SEO, CRO, copywriting, pricing, ads, lifecycle, onboarding, launch planning, and copy cleanup. |
| Security and safety | Portable security review guidance, secrets/supply-chain checks, and safer install/uninstall behavior. |
| Browser validation | Playwright-based screenshots, flow checks, responsive checks, and browser debugging. |
| Knowledge work | Docs, specs, MCP building, recent research, Reddit community signal, local document-to-Markdown conversion, context-management skills, JSON Canvas, and clean web-to-markdown extraction. |
| Codebase intelligence | Optional Graphify-powered code/corpus relationship mapping for "how does this codebase fit together?" and "what connects X to Y?" questions. |
| Usage insight | `overdrive usage` reads local Claude Code token logs on demand and reports token counts, cache use, top projects/models/tools, biggest sessions, and best-effort route attribution. It prints no prompt or message content. |
| Code health | React diagnostics through `react-doctor`, plus planning/security/browser checks when the task needs them. |
| Objective review | `what-should-i-consider` pressure-tests plans for hidden assumptions, architecture risks, and missing decisions. |
| Media utilities | `media-download` wraps `yt-dlp` for user-requested MP3 and high-quality MP4 downloads. |
| Project memory | ovd-workflow local state, preferences, knowledge vault, route traces, file hashes, checkpoints, and workflow health checks. |

## ovd-workflow

![Overdrive system diagram](assets/overdrive-system-diagram@2x.png)

`ovd-workflow` is Overdrive's local project-state layer. It is intentionally small and boring.

On meaningful project work or explicit workflow commands, it can create:

```text
.overdrive/
  project.md
  state.md
  architecture.md
  constraints.md
  decisions.md
  preferences.md
  research.md
  changelog.md
  config.json
  file-index.json
  knowledge-index.json
  routes.jsonl
  knowledge/
  reports/
  handoffs/
  work/
```

The folder is local runtime state and is gitignored by default. Overdrive adds `.overdrive/` to `.gitignore` when it initializes the workflow.

Useful commands:

```bash
overdrive status
overdrive doctor
overdrive knowledge --dry-run
overdrive knowledge --apply
overdrive resync --dry-run
overdrive resync --apply
overdrive usage --days 30
overdrive checkpoint --message "before refactor"
```

Claude Code slash commands install as `/ovd-status`, `/ovd-resync`, `/ovd-knowledge`, `/ovd-doctor`, `/ovd-checkpoint`, and `/ovd-usage`.

Disable hook/init behavior for a process with:

```bash
OVERDRIVE_WORKFLOW=disabled
```

For details, see [`docs/ovd-workflow.md`](docs/ovd-workflow.md).

## Architecture

![Overdrive architecture diagram](assets/overdrive-architecture-diagram@2x.png)

Overdrive is file-based. It does not run a cloud service and it does not upload your project.

Overdrive manages its own **managed skills** and instruction blocks. It does not replace or manage your agent's native skills, third-party plugin skills, or MCP servers; those remain separate layers that live alongside Overdrive.

| Piece | When it appears | What it does |
|---|---|---|
| Skills | During install | Copies curated `SKILL.md` folders into selected agent roots. |
| Instruction blocks | During install | Adds a managed global guidance block while preserving user content outside the block. |
| Runtime | During install | Writes persistent helpers at `~/.overdrive/runtime/current/` plus `overdrive` and `ovd` CLI shims. |
| Optional helper tools and installer-backed sources | During install, unless `--no-tool-install` is set | Attempts safe user-space setup for Graphify, video helpers, browser support, and official installer-backed skills. Missing tools become warnings, not install failures. |
| Hooks/commands/rules | During global install, where supported | Let supported agents call ovd-workflow. Hooks are advisory and fail open. |
| Project state | During meaningful project work or explicit workflow commands | Creates local `.overdrive/` state and adds `.overdrive/` to `.gitignore`. |

Global skill roots:

| Agent/tool | Global skill root | Instruction file |
|---|---|---|
| Claude Code | `~/.claude/skills` | `~/.claude/CLAUDE.md` |
| Codex | `~/.codex/skills` | `~/.codex/AGENTS.md` |
| Gemini CLI | `~/.gemini/skills` | `~/.gemini/GEMINI.md` |
| Antigravity | `~/.gemini/config/skills` | `~/.gemini/GEMINI.md` |
| Cursor | `~/.cursor/skills` | Cursor reads skill folders directly |
| Shared `.agents` | `~/.agents/skills` | Shared skill root only |

Antigravity uses the `.gemini` convention for its agent shell. Even if you run Claude inside Antigravity, the IDE still reads the Gemini-style global instruction file.

Cursor personal skills belong in `~/.cursor/skills`. Overdrive does not touch Cursor's reserved `~/.cursor/skills-cursor` folder or write Cursor hook settings.

## Install Modes

| Mode | Use it when | What happens |
|---|---|---|
| Global install | You want these skills available in all projects. | Installs into detected or selected agent roots on your Mac. |
| Local project install | You want one repo to carry its own AI setup. | Adds project-local skills and instruction files such as `.agents/skills`, `.cursor/skills`, `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md`. |
| Dry run | You want to inspect changes first. | Prints the install plan without writing files. |

Full install is recommended because the router keeps context small, but power users can install a subset:

```bash
./install.sh --scope global --tools auto --skills skill-router,planning-first,playwright-cli
./install.sh --scope global --tools auto --skip-skills connect,connect-apps
./install.sh --scope global --tools auto --all
./install.sh --scope global --tools auto --no-tool-install
```

## Safety Model

Overdrive is non-destructive by default.

| Policy | Behavior |
|---|---|
| `preserve` | Install missing skills, update Overdrive-managed skills, and skip unmarked folders. |
| `backup-and-replace` | Move matching folders into `~/.overdrive/backups/...` before replacing them. |
| `replace-managed-only` | Replace only folders that already contain an Overdrive managed marker. |
| `force` | Replace matching folders even if unmarked. This requires an explicit flag or confirmation. |

Managed skill folders receive `.overdrive.json`. Managed instruction blocks use `overdrive:global-guidelines`; user content outside that block is preserved.

Uninstall removes only managed folders, managed instruction blocks, managed hooks/rules/commands, managed runtime files, and Overdrive-managed helper venvs/shims under `~/.overdrive`. Shared Homebrew/winget tools are left in place because they may be used outside Overdrive:

```bash
./uninstall.sh --dry-run
./uninstall.sh
```

## Optional Tool Setup

By default, Overdrive may attempt safe setup for a narrow set of optional helpers when their related skills are selected:

- Graphify: `graphifyy==0.1.14` via `pipx` or a managed user-space virtualenv, preferring Python 3.10-3.12.
- Video helpers: `ffmpeg` and `yt-dlp`.
- Browser support for `design-extract`, preferring existing system Chrome/Chromium where available.

These attempts are non-privileged, fail open, and never collect keys or write MCP/app config. Overdrive never uses global `pip`, `sudo`, or `--break-system-packages`. Use `--no-tool-install` if you only want skill files and instructions; it also skips official installer-backed `npx` sources.

Graphify is separate from ovd-workflow. ovd-workflow remembers local project state, decisions, route traces, and reference docs; Graphify is for on-demand queryable knowledge graphs over a codebase or mixed corpus. If setup is skipped, fails, or is unavailable, agents fall back to normal `rg` and file reads.

For local PDFs, Office files, spreadsheets, HTML exports, and data files, `convert-to-markdown` can use Microsoft MarkItDown when installed; otherwise agents fall back to native file reading or simple text caches.

For readiness details, see [`docs/skill-readiness.md`](docs/skill-readiness.md).

## Updates

There are two kinds of updates.

### Overdrive Updates

These update the installer, router, local skills, docs, checks, and verified source pins.

If you installed from a git clone:

```bash
./check-updates.sh
./update.sh
```

If you installed with GitHub `npx`, re-run:

```bash
npx -y github:radustefandumitru/overdrive
```

### Upstream Skill Updates

Many skills come from external creators. By default, Overdrive installs verified pinned commits and exact package versions. This is safer than silently pulling whatever changed upstream today.

When an original creator updates their repo, users do **not** automatically receive that unreviewed upstream change by default. The normal path is:

1. Upstream creator updates their skill.
2. Overdrive maintainer reviews the change.
3. `manifest.json` and [`VERIFIED_SOURCES.md`](VERIFIED_SOURCES.md) are updated with a new verified pin.
4. Users run the normal update command.

Power users can intentionally follow live upstream branches or latest packages:

```bash
./update.sh --skills-only --allow-upstream-drift
```

That is flexible but less safe. It may install content this release has not verified.

## Claude Plugin Wrapper

Overdrive includes a thin Claude Code marketplace wrapper:

- `.claude-plugin/marketplace.json`
- `plugins/overdrive/.claude-plugin/plugin.json`
- a small helper skill and a few commands that explain or invoke the CLI

It does **not** bundle all 137 skills into the plugin. The full cross-agent install remains the CLI/GitHub/zip path.

Claude Code marketplace docs describe root `.claude-plugin/marketplace.json`, plugin-root `.claude-plugin/plugin.json`, and default `skills/` / `commands/` component discovery. This wrapper follows that model.

## Verification

Maintainers can run:

```bash
bash -n install.sh verify.sh update.sh uninstall.sh check-updates.sh
node --check lib/installer.js lib/ovd-workflow.js bin/overdrive.js
npm run consistency
npm run eval:router
npm run test:workflow
npm run analyze:routes
npm run source:fidelity
./verify.sh
npm pack --dry-run
```

The eval pack is a test bench, not a performance claim. It helps compare routed prompts against plain prompts and catch obvious routing drift.

v0.6 also includes a human-scored scorecard harness at [`docs/scorecard-v0.6.md`](docs/scorecard-v0.6.md). It starts empty on purpose; real output-quality claims should wait until blind control-vs-routed runs are scored.

`npm run analyze:routes` writes [`docs/catalog-health.md`](docs/catalog-health.md), a local-only maintainer report for route frequency, common skill pairings, and human-review candidates. It is not telemetry and never collects user data.

`npm run source:fidelity` clones pinned upstream sources and writes a maintainer report comparing copied, modified, omitted, and transformed skill files. It is a release-audit helper and is not part of the runtime.

## Privacy And Credentials

Overdrive does not copy, publish, or ask agents to print:

- API keys, OAuth tokens, service-role keys, database URLs, or connection strings.
- MCP configs containing secrets.
- Browser profiles, cookies, app sessions, or login state.
- GitHub, Vercel, Supabase, Firecrawl, Google, Claude, Codex, Gemini, Antigravity, Cursor, or other account credentials.
- Private course/community material or raw third-party resource downloads.
- Prompt/message content from local usage logs.

There is no telemetry. `overdrive usage` is local and read-only. It reports token counts, cache use, top projects/models/tools, biggest sessions, and best-effort route attribution; it prints no prompt or message content.

Context7 is the only public-standard MCP recommendation in this kit. Other MCPs and connectors are optional user/project setup and are documented in [`MCP_AND_CONNECTORS.md`](MCP_AND_CONNECTORS.md). MarkItDown MCP and Browserbase are documented as optional tools only; they are not installed or configured by Overdrive. Obsidian support is intentionally light: the public install keeps `json-canvas` and `defuddle`, while deeper vault automation belongs in each user's own Obsidian setup.

## What This Is Not

Overdrive is not:

- A replacement for clear requirements, tests, or code review.
- A promise that every model output becomes better.
- A background service watching your machine.
- A telemetry or analytics system.
- A system that uploads private files or credentials.
- A live auto-sync to every upstream skill repo by default.
- A privileged package manager.

It works best when the router stays selective, ovd-workflow stays lightweight, and agents still verify their work.

## Documentation

Most users only need this README and [`SKILLS_TLDR.md`](SKILLS_TLDR.md).

Power-user and maintainer docs:

| File | Purpose |
|---|---|
| [`SKILLS_SUMMARY.md`](SKILLS_SUMMARY.md) | Full human-readable skill inventory. |
| [`docs/skill-readiness.md`](docs/skill-readiness.md) | Which skills work immediately and which need optional tools. |
| [`docs/ovd-workflow.md`](docs/ovd-workflow.md) | Local project-state workflow, commands, hooks, and disable behavior. |
| [`docs/context-runtime-matrix.md`](docs/context-runtime-matrix.md) | Verified native context-window mechanisms by supported runtime. |
| [`docs/prompt-caching.md`](docs/prompt-caching.md) | How Overdrive stays friendly to prompt-cache reuse. |
| [`docs/evaluation.md`](docs/evaluation.md) | Router benchmark protocol and consistency-check explanation. |
| [`docs/catalog-health.md`](docs/catalog-health.md) | Local route-analysis output for maintainers. |
| `docs/source-fidelity-report.md` | Optional generated maintainer report from `npm run source:fidelity`. |
| [`MCP_AND_CONNECTORS.md`](MCP_AND_CONNECTORS.md) | Context7 and optional MCP/connectors guidance. |
| [`VERIFIED_SOURCES.md`](VERIFIED_SOURCES.md) | Pinned source refs used by default. |
| [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) | Attribution, licenses, and redistribution notes. |
| [`SECURITY.md`](SECURITY.md) | Security policy and vulnerability reporting. |
| [`PUBLISHING.md`](PUBLISHING.md) | Maintainer release checklist. |

## Credits

Overdrive is a curated installer and router. Most skills come from other people and projects.

Development and review support also credits [Eugen Bulboaca](https://github.com/bulboacaeugen).

Major sources include [Leonxlnx / Taste Skill](https://github.com/Leonxlnx/taste-skill), [Paul Bakaus / Impeccable](https://github.com/pbakaus/impeccable) and [impeccable.style](https://impeccable.style), [Aiden Bai / Million / React Doctor](https://github.com/millionco/react-doctor) and [react.doctor](https://react.doctor), [Emil Kowalski](https://emilkowal.ski), [GoogleChrome / Modern Web Guidance](https://github.com/GoogleChrome/modern-web-guidance), [Muratcan Koylan / Agent Skills for Context Engineering](https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering), [Corey Haines / MarketingSkills](https://github.com/coreyhaines31/marketingskills), [Hardik Pandya / Stop Slop](https://github.com/hardikpandya/stop-slop), [Kepano / Obsidian Skills](https://github.com/kepano/obsidian-skills), [yt-dlp](https://github.com/yt-dlp/yt-dlp), [Anthropic Skills](https://github.com/anthropics/skills), [OpenAI Skills](https://github.com/openai/skills), [Vercel Labs Skills](https://github.com/vercel-labs/skills), [ComposioHQ Awesome Claude Skills](https://github.com/ComposioHQ/awesome-claude-skills), [Remotion](https://www.remotion.dev), [Microsoft Playwright CLI](https://github.com/microsoft/playwright-cli), [Apple's Designing Fluid Interfaces session](https://developer.apple.com/videos/play/wwdc2018/803/), [Jack Roberts](https://www.youtube.com/watch?v=TZUTe7s11-I&list=WL&index=50), [Boris Cherny / Anthropic prompt guidance shared by @AnatoliKopadze](https://x.com/AnatoliKopadze/status/2054568935274549597), and [multica-ai / andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills).

v0.6 product-design and motion additions credit [Jamie Mill's Layers of Product Design skills](https://github.com/jamiemill/layers-skills) and [Layers site](https://layers.jamiemill.com), [Andrew Prifer's liquid-dom](https://github.com/AndrewPrifer/liquid-dom) as Liquid Glass inspiration, [kube.io's CSS/SVG Liquid Glass technique](https://kube.io/blog/liquid-glass-css-svg/), [`naughtyduk/liquidGL`](https://github.com/naughtyduk/liquidGL) as an optional license-checked WebGL reference, [@gabriell_lab's proximity-hover pattern](https://x.com/gabriell_lab/status/2060336070059864461), [@baptistebriel's rect-caching performance note](https://x.com/baptistebriel/status/2060351541345681851), [@mannupaaji's scroll-state navbar pattern](https://x.com/mannupaaji/status/2060025609867387239), and the [Chrome CSS scroll-state queries writeup](https://developer.chrome.com/blog/css-scroll-state-queries).

v0.7 knowledge and token-efficiency additions credit [Microsoft MarkItDown](https://github.com/microsoft/markitdown) for the optional document-to-Markdown conversion pipeline and [Browserbase skills](https://github.com/browserbase/skills) as an optional documented connector. Reddit research uses public read-only Reddit endpoints only and does not bundle credentials or Reddit code.

v0.8 context-efficiency guidance credits [Andre Kreidemann's prompt-caching writeup](https://kreidemann.com/blog/prompt-caching), [Sankalp Shubham's prompt-caching walkthrough](https://sankalp.bearblog.dev/how-prompt-caching-works/), and [Sam Rose / ngrok's prompt-caching article](https://ngrok.com/blog/prompt-caching). The guidance is paraphrased; no article text is redistributed.

v0.9 code-intelligence additions credit [Safi Shamsi / Graphify](https://github.com/safishamsi/graphify) and [graphify.net](https://graphify.net). Overdrive installs an MIT-allowed, safety-adapted Graphify skill from a pinned commit. It does not bundle the `graphifyy` package, Python dependencies, Neo4j, MCP servers, PDFs extras, or Graphify runtime state.

v0.10 additions credit [Nidhin J S / prompt-master](https://github.com/nidhinjs/prompt-master), [Siqi Chen / humanizer](https://github.com/blader/humanizer), [Manav Arya Singh / design-extract](https://github.com/Manavarya09/design-extract) and [designlang](https://designlang.manavaryasingh.com), and [Brad Bonanno / claude-video](https://github.com/bradautomates/claude-video). `design-extract` and `claude-video` are safety-adapted so agents check availability, avoid writing secrets, and fail open when dependencies are unavailable. The on-demand `usage` command is original Overdrive code inspired by [codeburn](https://github.com/getagentseal/codeburn) and [ccusage](https://github.com/ryoppippi/ccusage); no code is reused.

v0.11 changes make selected optional dependencies more plug-and-play by attempting safe, non-privileged setup during the installer: `graphifyy==0.1.14`, `yt-dlp`, `ffmpeg`, and browser support for Design Extract. These are invoked or downloaded on the user's machine only when needed; no third-party runtime packages, browsers, generated data, or credentials are bundled in this repository.

v0.12 adds native context-window guidance through [`docs/context-runtime-matrix.md`](docs/context-runtime-matrix.md) and a local `pretext` skill for Cheng Lou's MIT [`@chenglou/pretext`](https://github.com/chenglou/pretext) library. The skill teaches agents how to use Pretext as a per-project app dependency; no Pretext source code or npm package is bundled.

Please support the original creators. Detailed attribution lives in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Overdrive v2 — plan, execute, and remember your work

Overdrive v2 gives your AI coding agent a **memory and a method**: one human-readable plan (`OVERDRIVE.md`) plus four commands that carry a project from idea → shipped without losing context across sessions. It layers on top of the v1 skill catalog (137 specialist skills + `skill-router`) — skills stay untouched; v2 adds the structure that turns request-by-request work into a persistent, contract-driven lifecycle.

**The mental model — four commands:**

| Command | In one line | Start when… |
|---|---|---|
| **`/ovd-workflow`** | **Set up.** Map the codebase; capture preferences + requirements. | …a project is new (run once). |
| **`/ovd-plan`** | **Decide what to build.** Socratic planning into a tree where every leaf is a complete, executable contract. | …you know the goal but not the steps. |
| **`/ovd-go`** | **Do the work.** Execute one leaf at a time — implement → verify → your review → done; closures roll up the tree. | …the plan is ready. |
| **`/ovd-log`** | **Save & hand off.** Capture the session, update docs, close milestones — resume cleanly later. | …context is filling or you're stopping. |

Type plainly — an **intent layer** classifies free-form messages and routes them; an explicit `/ovd-…` always runs as typed.

### The four commands (with flags)

| Command | Key forms |
|---|---|
| `/ovd-workflow` | `init` · `map` · `preferences` · `requirements` · `knowledge` |
| `/ovd-plan` | *(bare = show the tree)* · `deliberate` · `idea "…"` · `edit` · `research "…"` *(opt. `attach_to_leaf`)* · `verify` |
| `/ovd-go` | *(bare = orient)* · `<node-ref>` · `continue` · `--small` · `test <ref>` · `verify` |
| `/ovd-log` | *(bare = quick save)* · `handoff` · `capture "…"` · `concerns` · `milestone-close` |

The pre-v2 slash commands (`/ovd-status`, `/ovd-doctor`, `/ovd-checkpoint`, `/ovd-resync`, `/ovd-knowledge`) still resolve — each delegates to its v2 equivalent with a deprecation note.

### What you'll see — the domain overview

Bare commands **orient, they never silently execute.** Running `/ovd-go` opens with a compact dashboard, then numbered next steps:

```text
Overdrive · Foo Dashboard
Milestone II. Dashboard  •  active: II.2.a [awaiting-review]
3 done · 1 in-progress · 4 pending  •  1 awaiting your review
→ Recommended: review II.2.a
  (1) review II.2.a  (2) continue  (3) show plan  (4) other
```

You always get **where things stand + a recommendation + a choice** — never a surprise edit.

### Internal states (what happens under the hood)

You don't invoke these; they're the machinery each command runs. Handy for reading what the agent is doing:

- **`/ovd-workflow`:** TUTORIAL+STATUS → INIT → CODEBASE MAP (5 mappers) → MAP REFRESH · PREFERENCES ELICIT · REQUIREMENTS DRAFT · DECISIONS LOG.
- **`/ovd-plan`:** DISPLAY · DELIBERATE *(calibrate → elicit → blind-spot → spec → plan + resolve-skills → verify → present)* · IDEA · EDIT · RESEARCH · PLAN-QUALITY CHECK.
- **`/ovd-go`:** ORIENT → LEAF EXECUTE → LEAF VERIFY → AWAITING REVIEW → *(ITERATE | FIX → escalate after 2 | DECISION POINT)* → recursive close.
- **`/ovd-log`:** CONVO CAPTURE → STATE UPDATE → DOC UPDATE → SESSION FILE → RECURSIVE CLOSE → *(MILESTONE CLOSE → learnings · release · archive)* → COMMIT *(always your approval)*.

### Typical developer workflows

```text
1. New project
   /ovd-workflow init  →  /ovd-plan deliberate  →  /ovd-go  →  /ovd-log handoff

2. Resume after a context clear
   /ovd-go            # orients from the cache + last handoff, resumes mid-iteration
   → "continue"       # picks up exactly where you left off

3. A new idea mid-flight
   /ovd-plan idea "add dark mode"   # analyses impact, never silently edits
   → approve  →  (fresh chat)  →  /ovd-plan edit  →  /ovd-go
```

### Where skills live (global vs project)

On install, Overdrive **asks where to put skills**:

- **Global** *(recommended)* — into your per-agent home dirs (`~/.claude/skills`, `~/.cursor/skills`, …). Available in every project; nothing touches your repos.
- **This project** — into the repo's conventional agent dirs so your agents auto-discover them. **Vendored skills are gitignored** (fully regenerable with `overdrive install`); **your own authored skills stay tracked** and ship to teammates through git. *Installed = ignored, authored = shared* — clone, run `overdrive install`, and everyone has the same setup.

Installs show a single progress bar (use `--verbose` for full per-skill logs). Your plan and codebase map (`OVERDRIVE.md` + `.overdrive/codebase/`) are committed by default, so parallel collaborators share one live plan.

### File layout

```text
your-project/
├── OVERDRIVE.md            # the plan tree (human-readable, committed to git)
└── .overdrive/             # supporting context (mostly gitignored)
    ├── plan.cache.json      # hierarchical cache of the tree
    ├── codebase/            # codebase analysis (architecture, patterns, tech-stack)
    ├── preferences.md       # user/team preferences and vetoes
    ├── requirements.md      # functional / non-functional / out-of-scope
    ├── decisions.md         # append-only decision log
    ├── sessions/            # per-session working notes
    ├── handoffs/            # end-of-session handoffs
    ├── reports/             # milestone reports
    └── sketches/approved/   # approved UI sketches referenced by leaves
```

### Quick start

```bash
overdrive workflow init     # or /ovd-workflow init — map the codebase, set preferences
overdrive plan deliberate   # or /ovd-plan deliberate — build the tree
overdrive go                # or /ovd-go — orient and execute the active leaf
overdrive log handoff       # or /ovd-log handoff — save a full handoff at session end
```

Check project health at any time:

```bash
overdrive verify --plan     # OVERDRIVE.md parse, cache consistency, structure, orphans
```

### Testing (contributors)

`npm test` runs the fast suite (parse check, consistency, workflow, ovd-plan units + integration, cross-pipeline smoke test). `npm run test:full` adds the slower router benchmark.

For a public-facing overview of what v2 changes for users, see [`docs/ovd-plan-v2.md`](docs/ovd-plan-v2.md). For the full design and implementation records, see the [pipeline architecture spec](docs/superpowers/specs/2026-06-08-ovd-plan-pipeline-architecture-r3.md) and the rest of [`docs/superpowers/specs/`](docs/superpowers/specs/).

## License

Overdrive's original code, installer, workflow runtime, docs, and local skills are licensed under Apache-2.0. Third-party skills, references, tools, and upstream projects keep their own licenses and attribution; see [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) and [`VERIFIED_SOURCES.md`](VERIFIED_SOURCES.md).

## Honest Assessment

Stefan asked his coding agent to review the project bluntly and say whether it is useful or just context bloat.

My assessment: Overdrive is genuinely useful, but only under the discipline it was designed around. Its value is not that it magically makes models smarter. The value is that it gives coding agents sharper task-specific procedures, safer install/update behavior, source attribution, current-doc habits, and a small local memory layer so they do less guessing and less repeated re-discovery.

The main failure mode is context bloat. If an agent loads the whole catalog, treats every skill as mandatory, or uses workflow state as a dumping ground, output quality can get worse. There is also no honest universal benchmark claim yet; the router benchmark exists to track routing quality, not to pretend every model response is automatically better. The defensible claim is narrower: for the web/app/product/security/research work Overdrive targets, selective routing plus lightweight project state should usually improve consistency, verification, and final output quality compared with an unstructured agent session.

- Codex, GPT-5-based coding agent, Extra High reasoning effort.

## Contributing

Contributions are welcome. Please keep the repo safe, small, and attribution-heavy:

- Prefer upstream installs over copied third-party snapshots.
- Add new skills through `manifest.json` or public-safe local skills.
- Credit original creators with links.
- Do not include secrets, OAuth state, MCP configs, browser profiles, private course material, or account-specific setup.
- Run `./verify.sh` before publishing changes.

Project note: Overdrive is being used to improve Overdrive. The README, router checks, and quality passes are produced with the same setup installed locally.
