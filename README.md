# AgenticSupercharge

AgenticSupercharge is a safe installer and routing layer for AI coding-agent skills. It installs a curated skill library across Claude Code, Codex, Gemini CLI, Antigravity, Cursor, and shared `.agents` workflows, then teaches those agents to choose the right skill for the task instead of loading everything into context.

The aim is practical: better agent output for web and app development, frontend polish, animations, SEO, product work, launch prep, research, security review, browser validation, and project planning.

I built this as my own daily coding-agent setup and am releasing it free for the community. If you build something with it, tag me or send feedback on Reddit at [u/StefanDumitru](https://www.reddit.com/user/StefanDumitru/). Contributions are welcome. If you want to buy me a coffee, you can do so [here](https://buymeacoffee.com/stefandumitru) :)

## What It Gives You

- One installer for a large, curated skill library.
- Global or project-local installs.
- Automatic target detection for the coding agents on your Mac.
- A `skill-router` that keeps context small by selecting only the relevant skills.
- Non-destructive installs by default, with marker files and safe conflict handling.
- Verified pinned upstream sources by default, with an explicit opt-in for live upstream drift.
- Consistency checks and a router benchmark pack for maintainers who want to measure routing quality.
- Public-safe attribution and documentation for the original skill creators.

## Quick Start

Preview the install without changing anything:

```bash
npx -y github:radustefandumitru/AgenticSupercharge -- --dry-run
```

Install globally from GitHub:

```bash
npx -y github:radustefandumitru/AgenticSupercharge
```

Or clone the repo:

```bash
git clone https://github.com/radustefandumitru/AgenticSupercharge.git
cd AgenticSupercharge
./install.sh --dry-run
./install.sh
```

Restart or reload your coding agent after installing so it re-indexes the skill folders.

## How You Use It

After install, you keep prompting your coding agent normally.

Example:

```text
Build a premium Next.js landing page with smooth scroll-based animation and run a browser check.
```

The global instructions ask the agent to run a lightweight skill check for non-trivial work. The router might select:

```text
design-taste-frontend -> emil-design-eng -> fluid-animations -> playwright-cli
```

That is the core idea: install broad capability, load narrow context.

You can also name a skill directly:

```text
Use jack-scroll-3d-sites for the hero section.
```

When you name a skill, your explicit choice wins for that part of the task.

## How It Works

Agent skills are folders with a `SKILL.md` file. Coding agents read those folders from known skill roots such as `~/.claude/skills`, `~/.codex/skills`, `~/.gemini/skills`, or `.cursor/skills`.

AgenticSupercharge does three things:

1. Installs selected skills into the right global or local folders.
2. Adds small managed instruction blocks to `CLAUDE.md`, `AGENTS.md`, and `GEMINI.md` where supported.
3. Uses `skill-router` as a preflight layer so agents pick only the skills that fit the request.

The router is advisory. It does not run a separate service. It is a skill that helps the agent decide what to load next.

## What It Installs

The current manifest contains 120 unique skills for a full target root.

| Category | Count | Purpose |
|---|---:|---|
| AgenticSupercharge local skills | 12 | Routing, planning, security, launch readiness, animation, and 3D website workflows |
| Upstream GitHub skills | 107 | Curated skills from verified public repos |
| Installer-backed skills | 1 | `playwright-cli` from the pinned official npm installer |
| Managed instruction templates | 3 | Global guidance blocks for Claude, Codex, Gemini, and Antigravity-style agents |

Claude Code receives one fewer local skill because AgenticSupercharge skips the portable `security-review` skill there and prefers Claude Code's native `/security-review`.

On the reference macOS install, a full skill root is about 22 MB. A five-root global install mirrors the library across multiple agents and uses roughly 110 MB before caches.

## Skill Coverage

| Work you want done | Skills likely to help |
|---|---|
| Premium frontend/UI work | Taste Skill, Emil design engineering, Impeccable, Modern Web Guidance, Playwright CLI |
| Smooth animations and gestures | `fluid-animations`, `emil-animation-polish`, Emil design engineering |
| 3D scroll websites and animated landing pages | `jack-premium-site-system`, `jack-scroll-asset-prompts`, `jack-scroll-3d-sites`, `jack-seo-launch-audit` |
| Multi-file planning and implementation | `clarify-and-plan`, `planning-first` |
| Security review and hardening | Claude Code `/security-review`, or portable `security-review` on other agents |
| Launch readiness | `pre-launch-checklist`, marketing, SEO, browser validation |
| SEO, copy, CRO, onboarding, launches | Corey Haines MarketingSkills plus Stop Slop |
| Recent community or market research | `last30days` |
| Questionnaire onboarding flows | `app-onboarding-questionnaire` |
| Obsidian and knowledge work | Kepano Obsidian skills |
| Browser validation and screenshots | Microsoft `playwright-cli`, OpenAI `playwright` wrapper |
| MCP server authoring | Anthropic `mcp-builder` plus current docs through Context7 |
| Image and video workflows | Banana Claude, Remotion skills, marketing video skills |
| Slack GIFs and emoji animations | Anthropic `slack-gif-creator` |

For the full skill inventory, see [`SKILLS_TLDR.md`](SKILLS_TLDR.md) and [`SKILLS_SUMMARY.md`](SKILLS_SUMMARY.md).

## AgenticSupercharge Skills

These are the local skills added by this kit on top of upstream sources:

| Skill | What it does |
|---|---|
| `skill-router` | Routes each non-trivial request to the smallest useful skill set. |
| `clarify-and-plan` | Turns broad or ambiguous requests into options, assumptions, tradeoffs, and a first phase. |
| `planning-first` | Provides a portable Explore -> Plan -> Implement -> Verify workflow for non-Claude agents. |
| `security-review` | Portable security audit workflow for Codex, Gemini, Antigravity, Cursor, and shared `.agents`. |
| `pre-launch-checklist` | Checks product readiness before a SaaS, app, client site, or public launch. |
| `fluid-animations` | Apple-inspired interaction guidance for springs, gestures, interruptible motion, and reduced-motion support. |
| `emil-animation-polish` | Practical web animation polish for easing, transitions, touch feedback, popovers, and motion audits. |
| `jack-premium-site-system` | Orchestrates brand research, scroll assets, animated site build, SEO, and optional launch. |
| `jack-website-intelligence` | Turns brand and competitor research into a build brief. |
| `jack-scroll-asset-prompts` | Creates start-frame, end-frame, and video transition prompts for scroll-stop assets. |
| `jack-scroll-3d-sites` | Guides video-on-scroll, frame sequences, GSAP/Framer Motion/Three.js choices, and browser validation. |
| `jack-seo-launch-audit` | Checks metadata, structured data, responsive behavior, performance, and launch readiness. |

The Jack Roberts inspired skills are rewritten from public workflow ideas and do not redistribute his raw PDFs, zips, templates, prompts, course material, downloaded resource folders, or private community content.

## Supported Agents

| Agent/tool | Global skill root | Instruction file |
|---|---|---|
| Claude Code | `~/.claude/skills` | `~/.claude/CLAUDE.md` |
| Codex | `~/.codex/skills` | `~/.codex/AGENTS.md` |
| Gemini CLI | `~/.gemini/skills` | `~/.gemini/GEMINI.md` |
| Antigravity | `~/.gemini/config/skills` | `~/.gemini/GEMINI.md` |
| Cursor | `~/.cursor/skills` | Cursor reads skill folders directly |
| Shared `.agents` | `~/.agents/skills` | Shared skill root only |

Antigravity uses the `.gemini` convention for its agent shell. Even if you run Claude inside Antigravity, the IDE still reads the Gemini-style global instruction file.

Cursor personal skills belong in `~/.cursor/skills`. This installer does not write to Cursor's reserved `~/.cursor/skills-cursor` folder.

## Install Modes

| Mode | What happens |
|---|---|
| Global install | Installs into detected or selected agent roots on your Mac. Use this when you want the skills in every project. |
| Local project install | Adds `.agents/skills`, `.cursor/skills`, `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` to one project. Use this when a repo should carry its own setup. |
| Dry run | Shows exactly what would happen without writing files. Use this first. |

The installer auto-detects installed agents for global installs. You can also choose targets manually.

## Safety Model

AgenticSupercharge defaults to `preserve`.

| Policy | Behavior |
|---|---|
| `preserve` | Install missing skills, update AgenticSupercharge-managed skills, and skip unmarked folders. |
| `backup-and-replace` | Move matching folders into `~/.agentic-supercharge/backups/...` before replacing them. |
| `replace-managed-only` | Replace only folders that already contain an AgenticSupercharge marker. |
| `force` | Replace matching folders even if unmarked. This requires an explicit flag or confirmation. |

Managed skill folders receive a `.agentic-supercharge.json` marker. Managed instruction blocks are delimited and updated in place, preserving user content outside those blocks.

## Update And Uninstall

Update a cloned install:

```bash
./update.sh
```

Check for available updates without applying them:

```bash
./check-updates.sh
```

Uninstall only AgenticSupercharge-managed folders and instruction blocks:

```bash
./uninstall.sh --dry-run
./uninstall.sh
```

GitHub `npx` users can re-run the install command to fetch the latest published repository state.

## Requirements

- macOS-first. Linux/local installs may work, but this release is tested for macOS-style agent roots.
- Node.js/npm for the GitHub `npx` path and npm-backed installers.
- Git for upstream skill installs.
- At least one supported coding agent for global auto-detection. Local installs do not require global agents.

Windows support is planned but not released.

## Privacy And Credentials

This installer does not copy or publish:

- API keys, OAuth tokens, service-role keys, database URLs, or connection strings.
- MCP configs containing secrets.
- Browser profiles, cookies, app sessions, or login state.
- GitHub, Vercel, Supabase, Firecrawl, Google, Claude, Codex, Gemini, Antigravity, Cursor, or other account credentials.
- Private course/community material or raw third-party resource downloads.

Context7 is the only public-standard MCP recommendation in this kit. Other MCPs and connectors are documented as optional user/project setup in [`MCP_AND_CONNECTORS.md`](MCP_AND_CONNECTORS.md).

## Source Verification

Default installs use verified pinned Git commits and pinned package versions. Users can intentionally follow live upstream branches with `--allow-upstream-drift`, but that installs content this release has not verified.

See:

- [`VERIFIED_SOURCES.md`](VERIFIED_SOURCES.md) for pinned refs and package versions.
- [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) for attribution and license notes.
- [`SECURITY.md`](SECURITY.md) for vulnerability reporting.
- [`CHANGELOG.md`](CHANGELOG.md) for release history.

## Quality Checks

For maintainers and contributors:

```bash
npm run consistency
npm run eval:router
./verify.sh
```

The v0.3 eval pack validates router coverage and provides a repeatable manual benchmark protocol. It helps test whether routed prompts produce better, more specialized outputs than plain prompts without pretending the benchmark has already proved a universal quality lift.

## Credits

AgenticSupercharge is a curated installer and router. Most skills come from other people and projects.

Major sources include [Leonxlnx / Taste Skill](https://github.com/Leonxlnx/taste-skill), [Paul Bakaus / Impeccable](https://github.com/pbakaus/impeccable), [Emil Kowalski](https://emilkowal.ski), [GoogleChrome / Modern Web Guidance](https://github.com/GoogleChrome/modern-web-guidance), [Muratcan Koylan / Agent Skills for Context Engineering](https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering), [Corey Haines / MarketingSkills](https://github.com/coreyhaines31/marketingskills), [Hardik Pandya / Stop Slop](https://github.com/hardikpandya/stop-slop), [Kepano / Obsidian Skills](https://github.com/kepano/obsidian-skills), [Anthropic Skills](https://github.com/anthropics/skills), [OpenAI Skills](https://github.com/openai/skills), [Vercel Labs Skills](https://github.com/vercel-labs/skills), [ComposioHQ Awesome Claude Skills](https://github.com/ComposioHQ/awesome-claude-skills), [Remotion](https://www.remotion.dev), [Microsoft Playwright CLI](https://github.com/microsoft/playwright-cli), [Apple's Designing Fluid Interfaces session](https://developer.apple.com/videos/play/wwdc2018/803/), [Jack Roberts](https://www.youtube.com/watch?v=TZUTe7s11-I&list=WL&index=50), and [multica-ai / andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills).

Please support the original creators. Detailed attribution lives in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Agent Review

Stefan asked his coding agent to give a blunt assessment of whether this project is useful or just context bloat.

My assessment: AgenticSupercharge is useful when the router stays selective. The value comes from combining pinned sources, non-destructive install behavior, source attribution, and task-specific routing. It can hurt if an agent loads the whole catalogue for every prompt, or if a user expects skills to replace product judgment, tests, or clear requirements. The v0.3 eval pack gives the project a way to measure router quality, but it does not yet prove a universal output-quality lift. The stronger claim is narrower: good task-specific instructions, applied only when relevant, usually improve agent behavior on the work this kit targets.

Codex, GPT-5-based coding agent, high reasoning effort.

## Documentation Map

| File | Purpose |
|---|---|
| [`SKILLS_TLDR.md`](SKILLS_TLDR.md) | Compact skill map. |
| [`SKILLS_SUMMARY.md`](SKILLS_SUMMARY.md) | Full human-readable skill inventory. |
| [`docs/skill-readiness.md`](docs/skill-readiness.md) | Which skills work immediately and which need optional tools. |
| [`docs/evaluation.md`](docs/evaluation.md) | Router benchmark protocol and consistency-check explanation. |
| [`MCP_AND_CONNECTORS.md`](MCP_AND_CONNECTORS.md) | Context7 and optional MCP/connectors guidance. |
| [`VERIFIED_SOURCES.md`](VERIFIED_SOURCES.md) | Pinned source refs used by default. |
| [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) | Attribution, licenses, and redistribution notes. |
| [`PUBLISHING.md`](PUBLISHING.md) | Maintainer packaging and release checklist. |

## Contributing

Contributions are welcome. Keep the repo safe, small, and attribution-heavy:

- Prefer upstream installs over copied third-party snapshots.
- Add new skills through `manifest.json` or public-safe local skills.
- Credit original creators with links.
- Do not include secrets, OAuth state, MCP configs, browser profiles, private course material, or account-specific setup.
- Run `./verify.sh` before publishing changes.
