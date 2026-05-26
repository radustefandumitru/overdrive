---
name: skill-router
description: Use as a lightweight preflight for non-trivial requests when no explicit skill was named and any installed skill might help. Route ambiguous or multi-phase work to clarify-and-plan/planning-first; frontend/design/motion to Taste/Emil/fluid/playwright; security audits to security-review; recent online research to last30days; app questionnaire onboarding to app-onboarding-questionnaire; launch readiness to pre-launch-checklist. Also route docs/specs, MCP servers, Slack GIFs, context compression, marketing/copy, Obsidian, external app actions, browser automation, image generation, Remotion/video, Chrome extensions, and skill discovery. Advisory only: choose 1-3 useful skills and skip visible routing for tiny factual answers, casual conversation, obvious one-command requests, or task sections where the user already named the skill.
---

# Skill Router

Use this skill to choose the right installed skill or skill sequence without loading unnecessary context. It is a routing layer, not a replacement for the routed skill.

## Core Rules

1. Begin non-trivial requests by consulting `skill-router` as a lightweight preflight to decide whether any installed skills apply. This means selecting a small skill set, not loading the full catalog.
2. If the user explicitly names a skill, use that skill for the relevant task section and do not override it with router selection unless a different, unspecified section still needs routing.
3. Prefer exact domain skills over broad design or planning skills.
4. For ambiguous, high-impact, or multi-step requests, route to `clarify-and-plan` first when assumptions, tradeoffs, or phase boundaries need to be made explicit. Then add the relevant domain skill.
5. For complex coding implementation on Codex, Cursor, Gemini, Antigravity, shared `.agents`, or local project agents, route to `planning-first` when the task spans multiple files, phases, migrations, refactors, or vague feature work. In Claude Code, prefer native `/model opusplan` or `/ultraplan` when available.
6. For security review, vulnerability audit, hardening, auth/authz, injection, XSS, RCE, secrets, data exposure, or supply-chain checks: on Claude Code prefer the native `/security-review`; on other agents use `security-review`. Do not load both.
7. For recent online/social/community research, current sentiment, trending repos, "what are people saying," or "last 30 days" requests, use `last30days` when installed. Treat paid/social sources as optional user-configured capabilities.
8. For questionnaire-style onboarding flows for web/mobile/subscription apps, use `app-onboarding-questionnaire`. Pair with design or frontend implementation skills only after the flow strategy is clear.
9. For launch readiness, shipping checklists, beta/public release, Product Hunt, App Store, SaaS launch, client handoff, monitoring, billing, privacy, or rollback preparation, use `pre-launch-checklist`. Pair with `security-review`, `jack-seo-launch-audit`, or marketing skills only for the relevant slice.
10. For Jack Roberts inspired premium 3D/scroll websites, route to the narrow Jack skill first, then add the normal design/web validation stack:
   - `jack-premium-site-system` for the full brand -> asset prompts -> scroll site -> SEO -> optional launch workflow.
   - `jack-website-intelligence` for brand extraction, competitor research, client-facing strategy, and build briefs.
   - `jack-scroll-asset-prompts` for assembled/exploded, before/after, or transition prompts for AI image/video generators.
   - `jack-scroll-3d-sites` for video-on-scroll, frame-sequence canvas, GSAP/Framer Motion/Three.js scroll experiences.
   - `jack-seo-launch-audit` for multi-page SEO, metadata, structured data, responsive checks, and launch readiness.
11. For visual/frontend work, prefer the community design stack over generic design defaults:
   - Taste skills by default for real design references, premium visual direction, anti-slop landing pages, image-first frontend workflows, brand kits, and stronger style variants.
   - `emil-design-eng` by default for buttons, hover/focus states, transitions, animations, micro-interactions, easing, component feel, and UI that should not feel static.
   - `emil-animation-polish` for practical Emil-inspired web animation implementation: CSS transitions, custom easing, duration tuning, press feedback, hover/touch behavior, tooltip timing, origin-aware popovers, and smooth animation audits.
   - `fluid-animations` when motion needs Apple-quality direct manipulation: spring behavior, interruptibility, gesture velocity, rubberbanding, snap points, spatially consistent transitions, or reduced-motion-safe tactile UI.
   - `impeccable` mostly as an end-of-development polish, audit, critique, spacing, and typography pass. Ask for user feedback before broad font, hierarchy, or visual-identity changes unless the user explicitly asks the agent to decide.
   - Anthropic/Claude `frontend-design` only as fallback if the community stack fails, is unavailable, or the user rejects the direction.
12. Add implementation support skills only when the task needs them:
   - `modern-web-guidance` for modern HTML/CSS/browser APIs, accessibility, forms, dialogs, popovers, performance, and Baseline compatibility.
   - `playwright-cli` for official Playwright CLI browser validation, screenshots, snapshots, flows, data extraction, and debugging.
   - `playwright` only as the pinned OpenAI wrapper/fallback when that specific wrapper is useful; otherwise prefer `playwright-cli`.
13. Use Context Engineering skills when context quality, compression, multi-agent architecture, memory, tool design, long-thread continuity, or evaluation is the problem. Use `context-compression` only when the user asks for compaction or accepts a context-budget reminder.
14. Use Corey Haines marketing skills for SEO, CRO, copywriting, launches, pricing, ads, customer research, and growth strategy. Add `stop-slop` for public-facing prose, emails, landing copy, blog posts, social posts, and any "make this sound human" request.
15. Use `banana` for image-generation requests when its Claude Code/Gemini setup is available. In runtimes without Banana/API setup, route to the native image tool or ask for setup.
16. Use Kepano's Obsidian skills for vault notes, Obsidian Flavored Markdown, wikilinks, callouts, properties/frontmatter, Bases, JSON Canvas, Obsidian CLI, and Defuddle clean web-to-markdown extraction. Before editing a real vault, prefer a git/snapshot/version-history safety point.
17. Use Anthropic example skills for their narrow official domains:
   - `brand-guidelines` only when Anthropic branding, colors, typography, or company style guidelines are explicitly requested or appropriate.
   - `doc-coauthoring` for substantial docs, proposals, PRDs, RFCs, technical specs, and decision docs.
   - `mcp-builder` for MCP server design, tool schemas, API/service integrations, and MCP evaluation. Use Context7/current docs for SDK specifics.
   - `slack-gif-creator` for Slack-ready GIFs, animated emoji, and short workspace reaction loops. Approval-gate any actual Slack upload/post.
18. Use Composio/connect-style action skills reluctantly and only after explicit user approval before sending, posting, creating, deleting, authenticating, spending credits, or touching external accounts.
19. Treat MCPs/connectors as tools, not skills. The shareable kit only assumes Context7 for current documentation lookup; other MCPs are user/project-specific and should not be assumed.
20. Use Vercel Labs `find-skills` only when the user wants to discover, compare, or install new skills. Do not run broad skill discovery for normal implementation tasks.
21. Keep context small: route to 1-3 skills, state the order, and load only the reference needed for the conflict.

## Resolving Trigger Overlap

- `clarify-and-plan` vs `planning-first`: use `clarify-and-plan` when the request is ambiguous or has meaningful options. Use `planning-first` when the direction is mostly clear but the implementation is complex. Use both in that order for broad "build/refactor this" requests.
- `planning-first` vs domain skills: planning is the wrapper; the domain skill does the specialized work. Example: `planning-first` -> `design-taste-frontend` for a multi-page UI rebuild.
- `security-review` vs Claude native `/security-review`: use Claude's native command on Claude Code. Use the portable `security-review` skill for Codex, Cursor, Gemini, Antigravity, and shared `.agents`.
- `pre-launch-checklist` vs `jack-seo-launch-audit`: use `pre-launch-checklist` for product/business readiness, monitoring, billing, privacy, rollback, support, and launch-day runbooks. Use `jack-seo-launch-audit` for animated/3D website SEO, metadata, structured data, performance, and responsive launch checks.
- `last30days` vs normal web search: use `last30days` for time-boxed community/recent sentiment research. Use normal web/docs search or Context7 for official documentation and exact API/library references.
- `app-onboarding-questionnaire` vs marketing `onboarding`/`signup`: use `app-onboarding-questionnaire` for questionnaire-style app onboarding flows and screen-by-screen strategy. Use marketing `onboarding` or `signup` for growth optimization of existing onboarding/signup funnels.
- `find-skills` vs `skill-router`: use `skill-router` to choose among installed skills. Use `find-skills` only to discover or install new skills.

## Reference Routing

- Read `references/frontend-design-routing.md` for frontend, product UI, landing page, brand, motion, image-first, or visual-quality conflicts.
- Read `references/compatibility-audit.md` for source, platform, overlap, context-bloat, and approval-risk notes.
- Read `references/sharing-and-transfer.md` when asked how to move this setup to another machine or teammate.
- Read `references/catalog.md` for broad inventory, non-design routing, or when the user asks what every skill is for.
- Read `references/routing-trace-examples.md` for example prompts and expected routing decisions.

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
