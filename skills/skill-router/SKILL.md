---
name: skill-router
description: Use as a lightweight preflight for non-trivial requests when no explicit skill was named and any installed skill might help. Route ambiguous or multi-phase work to clarify-and-plan/planning-first; product-design layer reasoning to layers-intro plus the narrow layers-* skill; frontend/design/motion to Taste/Emil/fluid/liquid-glass-web/playwright; React diagnostics to react-doctor; security audits to Claude native /security-review, Claude security-guidance when available, or portable security-review; pressure-testing to what-should-i-consider; recent online research to last30days; Reddit/community research to reddit-research; local PDF/Office/data reference conversion to convert-to-markdown; app questionnaire onboarding to app-onboarding-questionnaire; launch readiness to pre-launch-checklist. Also route docs/specs, MCP servers, Slack GIFs, context compression, marketing/copy, Obsidian JSON Canvas/Defuddle, media downloads, external app actions, browser automation, image generation, Remotion/video, Chrome extensions, and skill discovery. Advisory only: choose the smallest useful skill sequence, with no hard cap for genuinely complex work, and skip visible routing for tiny factual answers, casual conversation, obvious one-command requests, or task sections where the user already named the skill.
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
11. For local document references, PDFs, Office files, spreadsheets, presentations, HTML exports, CSV/data files, or AS-Workflow knowledge-vault ingest, use `convert-to-markdown` before reading native files when conversion would reduce context or preserve structure. Do not use it for code files or when visual layout fidelity is the task.
12. For questionnaire-style onboarding flows for web/mobile/subscription apps, use `app-onboarding-questionnaire`. Pair with design or frontend implementation skills only after the flow strategy is clear.
13. For launch readiness, shipping checklists, beta/public release, Product Hunt, App Store, SaaS launch, client handoff, monitoring, billing, privacy, or rollback preparation, use `pre-launch-checklist`. Pair with `security-review`, `jack-seo-launch-audit`, or marketing skills only for the relevant slice.
14. For Jack Roberts inspired premium 3D/scroll websites, route to the narrow Jack skill first, then add the normal design/web validation stack:
   - `jack-premium-site-system` for the full brand -> asset prompts -> scroll site -> SEO -> optional launch workflow.
   - `jack-website-intelligence` for brand extraction, competitor research, client-facing strategy, and build briefs.
   - `jack-scroll-asset-prompts` for assembled/exploded, before/after, or transition prompts for AI image/video generators.
   - `jack-scroll-3d-sites` for video-on-scroll, frame-sequence canvas, GSAP/Framer Motion/Three.js scroll experiences.
   - `jack-seo-launch-audit` for multi-page SEO, metadata, structured data, responsive checks, and launch readiness.
15. For product-design layer reasoning, use Jamie Mill's Layers skills. Always include `layers-intro` before a layer-specific skill because it explains the framework dependency model.
   - `layers-orient` when the user does not know where the product/design problem lives.
   - `layers-observed-behaviour` for user behavior evidence, job-story candidates, and confidence.
   - `layers-domain` for domain terminology, concept maps, nouns, and language conflicts.
   - `layers-user-needs` for needs, pains, desires, and prioritised job stories.
   - `layers-product-strategy` for opportunity selection, bets, and product/service strategy.
   - `layers-conceptual-model` for objects, states, relationships, vocabulary, and product model coherence.
   - `layers-interaction-flow` for flows, breadboards, edge cases, and open interaction decisions.
   - `layers-surface` for surface decision inventory only after lower layers are reasonably clear.
16. For visual/frontend work, prefer the community design stack over generic design defaults:
   - Taste skills by default for real design references, premium visual direction, anti-slop landing pages, image-first frontend workflows, brand kits, and stronger style variants.
   - `emil-design-eng` by default for buttons, hover/focus states, transitions, animations, micro-interactions, easing, component feel, and UI that should not feel static.
   - `emil-animation-polish` for practical Emil-inspired web animation implementation: CSS transitions, custom easing, duration tuning, press feedback, hover/touch behavior, tooltip timing, origin-aware popovers, and smooth animation audits.
   - `fluid-animations` when motion needs Apple-quality direct manipulation: spring behavior, interruptibility, gesture velocity, rubberbanding, snap points, spatially consistent transitions, or reduced-motion-safe tactile UI.
   - `liquid-glass-web` when the user asks for Liquid Glass, frosted glass, glassmorphism, translucent UI, SVG displacement, or WebGL refraction. It should choose Tier 1 universal frosted glass by default and enhance to Tier 2 or Tier 3 only when target browsers and performance justify it.
   - `impeccable` mostly as an end-of-development polish, audit, critique, spacing, and typography pass. Ask for user feedback before broad font, hierarchy, or visual-identity changes unless the user explicitly asks the agent to decide.
   - Anthropic/Claude `frontend-design` only as fallback if the community stack fails, is unavailable, or the user rejects the direction.
17. Add implementation support skills only when the task needs them:
   - `modern-web-guidance` for modern HTML/CSS/browser APIs, accessibility, forms, dialogs, popovers, performance, and Baseline compatibility.
   - `playwright-cli` for official Playwright CLI browser validation, screenshots, snapshots, flows, data extraction, and debugging.
   - `playwright` only as the pinned OpenAI wrapper/fallback when that specific wrapper is useful; otherwise prefer `playwright-cli`.
18. Use Context Engineering skills when context quality, compression, prompt-cache hygiene, multi-agent architecture, memory, tool design, long-thread continuity, or evaluation is the problem. `context-optimization`, `context-compression`, and `clarify-and-plan` are situational tools, not always-on skills; use `context-compression` only when the user asks for compaction or accepts a context-budget reminder.
19. Use Corey Haines marketing skills for SEO, CRO, copywriting, launches, pricing, ads, customer research, and growth strategy. Add `stop-slop` for public-facing prose, emails, landing copy, blog posts, social posts, and any "make this sound human" request.
20. Use `banana` for image-generation requests when its Claude Code/Gemini setup is available. In runtimes without Banana/API setup, route to the native image tool or ask for setup.
21. Use Kepano's retained Obsidian-adjacent skills narrowly: `json-canvas` for JSON Canvas files and `defuddle` for clean web-to-markdown extraction when available. For broader Obsidian vault editing, proceed with normal Markdown/file tooling or ask the user to install a dedicated Obsidian workflow; snapshot real vaults before broad edits.
22. Use `media-download` for user-requested local media downloads, MP3 extraction, highest-quality MP4 downloads, or yt-dlp workflows. Respect platform terms and confirm permissions for restricted/copyrighted material.
23. Use Anthropic example skills for their narrow official domains:
   - `brand-guidelines` only when Anthropic branding, colors, typography, or company style guidelines are explicitly requested or appropriate.
   - `doc-coauthoring` for substantial docs, proposals, PRDs, RFCs, technical specs, and decision docs.
   - `mcp-builder` for MCP server design, tool schemas, API/service integrations, and MCP evaluation. Use Context7/current docs for SDK specifics.
   - `slack-gif-creator` for Slack-ready GIFs, animated emoji, and short workspace reaction loops. Approval-gate any actual Slack upload/post.
24. Use Composio/connect-style action skills reluctantly and only after explicit user approval before sending, posting, creating, deleting, authenticating, spending credits, or touching external accounts.
25. Treat MCPs/connectors as tools, not skills. The shareable kit only assumes Context7 for current documentation lookup; other MCPs are user/project-specific and should not be assumed.
26. Use Vercel Labs `find-skills` only when the user wants to discover, compare, or install new skills. Do not run broad skill discovery for normal implementation tasks.
27. Keep context small: route to the minimum sufficient skill sequence, state the order, and load only the reference needed for the conflict. Prefer stable, deterministic ordering: clarify/planning first, then product/domain reasoning, implementation, validation, launch/handoff, and context-management skills only when needed. There is no hard cap: genuinely complex tasks may use more skills when they are phased and each skill has a clear job.
28. If `.agenticsupercharge/` exists and the runtime command is available, append a short route trace after choosing skills:
   `agentic-supercharge route --skills "skill-a,skill-b" --reason "short reason"`.
   Skip this silently if the command is unavailable or the workflow folder is absent.

## Resolving Trigger Overlap

- `clarify-and-plan` vs `planning-first`: use `clarify-and-plan` when the request is ambiguous or has meaningful options. Use `planning-first` when the direction is mostly clear but the implementation is complex. Use both in that order for broad "build/refactor this" requests.
- `what-should-i-consider` vs `clarify-and-plan`: use `what-should-i-consider` to attack assumptions, risks, and missing decisions. Use `clarify-and-plan` to turn ambiguity into options and a phase plan.
- `planning-first` vs domain skills: planning is the wrapper; the domain skill does the specialized work. Example: `planning-first` -> `design-taste-frontend` for a multi-page UI rebuild.
- `security-guidance` vs Claude native `/security-review` vs portable `security-review`: use Claude's `security-guidance` plugin as an always-on/preventative Claude-only layer when available; use Claude's native `/security-review` for explicit security audits and PR/code reviews; use the portable `security-review` skill for Codex, Cursor, Gemini, Antigravity, and shared `.agents`.
- `react-doctor` vs generic frontend/design skills: use `react-doctor` for React code quality diagnostics. Use Taste/Emil/Impeccable for visual/interaction quality and `security-review` for vulnerability review.
- `layers-*` vs `clarify-and-plan`/`planning-first`: use Layers for product-design substance: observed behavior, domain language, user needs, strategy, conceptual model, interaction flow, and surface decisions. Use planning skills for process, implementation phases, and execution discipline.
- `layers-surface` vs visual polish skills: use `layers-surface` to inventory surface-level product/design decisions. Use Taste, Emil, Impeccable, and `liquid-glass-web` for actual visual direction, motion, polish, and implementation.
- `liquid-glass-web` vs `emil-animation-polish`/`fluid-animations`: use `liquid-glass-web` for glass/refraction tier selection and implementation. Use Emil/Fluid for how it moves, responds, and feels.
- `pre-launch-checklist` vs `jack-seo-launch-audit`: use `pre-launch-checklist` for product/business readiness, monitoring, billing, privacy, rollback, support, and launch-day runbooks. Use `jack-seo-launch-audit` for animated/3D website SEO, metadata, structured data, performance, and responsive launch checks.
- `last30days` vs normal web search: use `last30days` for time-boxed community/recent sentiment research. Use normal web/docs search or Context7 for official documentation and exact API/library references.
- `reddit-research` vs `last30days`: use `reddit-research` when Reddit/subreddits/threads/comments are explicitly in scope. Add `last30days` when recency or broader community context matters.
- `convert-to-markdown` vs `defuddle`: use `convert-to-markdown` for local files and AS-Workflow knowledge-vault ingest. Use `defuddle` for web pages that need clean article/content extraction.
- `app-onboarding-questionnaire` vs marketing `onboarding`/`signup`: use `app-onboarding-questionnaire` for questionnaire-style app onboarding flows and screen-by-screen strategy. Use marketing `onboarding` or `signup` for growth optimization of existing onboarding/signup funnels.
- `find-skills` vs `skill-router`: use `skill-router` to choose among installed skills. Use `find-skills` only to discover or install new skills.

## Reference Routing

- Read `references/frontend-design-routing.md` for frontend, product UI, landing page, brand, motion, image-first, or visual-quality conflicts.
- Read `references/compatibility-audit.md` for source, platform, overlap, context-bloat, and approval-risk notes.
- Read `references/sharing-and-transfer.md` when asked how to move this setup to another machine or teammate.
- Read `references/catalog.md` for broad inventory, non-design routing, or when the user asks what every skill is for.
- Read `references/routing-trace-examples.md` for example prompts and expected routing decisions.
  The examples also show how AS-Workflow route traces should stay short enough for `.agenticsupercharge/routes.jsonl`.

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
