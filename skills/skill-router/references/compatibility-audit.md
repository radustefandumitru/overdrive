# Compatibility Audit

Use this reference when deciding whether skills should work together, whether a source is safe to install broadly, or whether a skill should be held behind approval.

| Source or family | Primary value | Works across agents? | Use with | Avoid / gate |
|---|---|---|---|---|
| Taste Skill | Anti-slop frontend direction, real visual references, image-first workflows | Yes; framework-agnostic `SKILL.md` folders | `emil-design-eng`, `emil-animation-polish`, `modern-web-guidance`, `playwright-cli` | Do not let narrow style modifiers override user brand/preferences |
| Emil Kowalski skill | Motion, easing, component feel, micro-interactions | Yes as a local skill | Taste, `emil-animation-polish`, `modern-web-guidance`, `playwright-cli` | Avoid for non-visual backend tasks |
| Emil Animation Polish | Paraphrased Emil-inspired implementation checklist for web easing, CSS transitions, duration, hover/touch, tooltips, popovers, and animation audits | Yes; local framework-agnostic skill with public source attribution | `emil-design-eng`, `fluid-animations`, Taste, `modern-web-guidance`, `playwright-cli` | Do not copy Emil's course text, videos, interactive examples, or assets into public bundles |
| Fluid Animations | Apple-inspired spring, gesture, interruptibility, rubberbanding, momentum projection, and spatial-consistency guidance | Yes; local framework-agnostic skill with a public-safe paraphrased reference | `emil-design-eng`, Taste, `modern-web-guidance`, `playwright-cli` | Do not copy Apple transcript/slides into public bundles; keep source as attribution/link and use paraphrased implementation guidance |
| Jack Roberts premium 3D website skills | Public-safe workflow for brand/competitor research, scroll-stop asset prompts, scroll-driven sites, SEO/launch readiness, and end-to-end premium site orchestration | Yes; local paraphrased skills with source attribution | Taste, `emil-design-eng`, `emil-animation-polish`, `fluid-animations`, `modern-web-guidance`, `playwright-cli`, Banana/image tools, SEO skills | Do not copy Jack's raw PDFs, zips, templates, prompts, or downloaded skill text into public bundles; Firecrawl/GitHub/Vercel/image/video generators are optional user-configured tools |
| Impeccable | Spacing, typography, critique, anti-pattern audit, design-system polish | Yes as a local skill | Taste, Emil, Playwright | Ask before broad font, hierarchy, or visual identity changes unless user asked agent to decide |
| Anthropic/Claude frontend-design | Generic frontend design fallback | Mostly Claude/plugin surfaced | Use only if community stack is unavailable or rejected | Do not prioritize over Taste/Emil/Impeccable for visual taste |
| Context Engineering | Compression, context degradation, tool design, memory, multi-agent architecture, evaluation | Yes; repo describes platform-agnostic skills | GSD, subagents, long-running work, MCP/tool design | Do not load the whole family for normal coding; choose the specific context failure mode |
| GSD | Project lifecycle, planning, execution, verification, persistent `.planning/` state | Yes when installed through the official runtime installer | Context Engineering, Playwright CLI, design stack | Follow the active runtime's exposed GSD skill surface |
| Corey Haines Marketing Skills | SEO, CRO, copywriting, ads, pricing, launch, customer research, growth | Yes as local skills | `stop-slop`, Taste/design for landing pages | Do not load all marketing skills; choose the task-specific one |
| Stop Slop | Removes AI tells from prose | Yes as a local skill | Marketing, internal comms, launch, copywriting, emails | Do not use when the user wants formal/legal/technical precision over voice |
| Banana Claude | Image generation creative director using Gemini/Nano Banana workflows | Best in Claude Code; portable only if scripts/API/MCP setup exists | Taste image workflows, brandkit, marketing image skill | Requires setup/API key; use native image tool fallback elsewhere |
| Kepano Obsidian skills | Obsidian Markdown, Bases, JSON Canvas, Obsidian CLI, and Defuddle web extraction | Yes; repo follows Agent Skills spec and documents Claude Code/Codex/OpenCode support | Context Engineering, GSD docs, writing skills, research workflows | Use git/snapshots/version history before editing real vaults; `obsidian-cli` and `defuddle` require their CLIs |
| Composio/Connect curated skills | Real actions across external apps and utility workflows | Skill files are portable; actions depend on connectors/auth | Marketing, operations, Slack/email/app actions | Always ask before sending, posting, creating, deleting, authenticating, or spending credits |
| Playwright | Browser validation, screenshots, snapshots, UI flows, data extraction | Yes where CLI/runtime is installed | Design stack, GSD verification, checkout/debug flows | Do not use for static code-only tasks unless real browser proof matters |
| Modern Web Guidance | Current platform APIs, Baseline, accessibility, browser features | Yes as local/plugin skill | Design stack, forms/dialogs/popovers/performance work | Do not use as visual taste replacement |
| Remotion | Programmatic video in React | Yes as local/plugin skill | Emil for animation feel, marketing video skill for strategy | Do not use for generic video editing outside Remotion |
| Karpathy-inspired global guidelines | Always-on coding behavior defaults: surface assumptions, keep code simple, edit surgically, verify goals, and consult `skill-router` as the default lightweight preflight for non-trivial requests | Yes via runtime-specific global instruction files for Claude Code, Codex, Gemini CLI, and Antigravity | All coding tasks; `skill-router` chooses domain skills; explicit user-named skills win for their task section | Keep concise because these files load broadly; do not turn them into a giant skill catalog |

## Context7 And Connector Guidance

MCPs and connectors are execution tools, not skills. The shareable kit standardizes Context7 for current docs lookup, but it does not prescribe database, repository, or account-specific MCP setups.

| MCP / connector | Use for | Transfer status | Gate |
|---|---|---|---|
| Context7 | Current library, framework, SDK, API, CLI, cloud-service, setup, migration, and version-specific documentation | Guidance transfers; each user/runtime must have Context7 configured | Prefer read-only docs lookup; no secrets required in prompts |
| Other MCPs/connectors | Repository, database, browser, app, or account-specific workflows | Not prescribed by the public kit; each user/project decides what to configure | Ask before remote side effects and never expose secrets |
| Browser / Playwright / in-app browser | Local UI validation, screenshots, interaction checks, debugging web flows | Tool availability depends on runtime | Avoid for static code-only work unless browser proof matters |
| Composio/connect/app connectors | External app actions across Slack, email, Notion, calendars, CRMs, etc. | Skill guidance transfers; app auth does not | Always ask before sending, posting, creating, deleting, authenticating, or spending credits |

Never copy API keys, OAuth tokens, MCP secrets, service-role keys, database URLs, or personal app-session files into the kit, docs, zips, screenshots, or responses.

## Context Bloat Rule

Skills are cheap at metadata level but expensive when full bodies and references are loaded. Prefer one primary skill plus one or two support skills. Use `skill-router` to name the sequence, then load only the chosen skill bodies.

## Approval Rule

Any skill that can act outside the local filesystem needs explicit user approval before the action: email, Slack, Linear, Notion, calendars, paid APIs, image generation credits, account auth, publishing, deleting, or posting.
