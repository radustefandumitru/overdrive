# AgenticSupercharge

AgenticSupercharge is an open-source skill pack and installer for AI coding agents.

It gives Claude Code, Codex, Gemini CLI, Antigravity, Cursor, and local project agents a shared library of specialist skills for web/app development, frontend polish, animation, SEO, research, product work, security review, launch prep, and browser validation.

Think of it as three things:

- **A toolbox:** curated skills that teach agents how to handle specific kinds of work.
- **A bouncer:** a `skill-router` that helps the agent pick the right skills for the current task instead of loading everything into context.
- **A notebook:** AS-Workflow, a local `.agenticsupercharge/` project-state folder that helps agents remember active work, decisions, checkpoints, and routing history.

The goal is simple: better outputs from coding agents, with less manual prompting.

I built this as my own daily AI coding-agent setup and am releasing it free for the community. If you build something with it, tag me or send feedback on Reddit at [u/StefanDumitru](https://www.reddit.com/user/StefanDumitru/). Contributions are welcome. If you want to buy me a coffee, you can do so [here](https://buymeacoffee.com/stefandumitru) :)

## Why Use It?

Most AI coding agents are powerful, but they often need repeated guidance:

- "Make this less generic."
- "Use better UI taste."
- "Check accessibility."
- "Use current docs."
- "Run a browser test."
- "Think through the launch/security/SEO implications."

AgenticSupercharge packages those recurring instructions into reusable skills and installs them where your agents can find them.

You keep prompting normally. For non-trivial work, the agent checks the router, loads the smallest useful skill set, and proceeds with more relevant guidance. For longer projects, AS-Workflow keeps a small local memory so the agent does not have to rediscover the same context every session.

## Quick Start

Preview first. This shows what would be installed without changing files:

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

After installing, restart or reload your coding agent so it re-indexes the skill folders.

## What Changes After Install?

You do not need to memorize every skill.

Example prompt:

```text
Build a premium Next.js landing page with smooth scroll-based animation and run a browser check.
```

The global instructions tell the agent to do a lightweight skill check. The router might choose:

```text
design-taste-frontend -> emil-design-eng -> fluid-animations -> playwright-cli
```

Then the agent uses those skills while doing the work.

You can also name a skill directly:

```text
Use jack-scroll-3d-sites for the hero section.
```

When you name a skill, your explicit choice wins for that part of the task.

## What You Get

The current manifest contains 120 unique skills.

| Area | What it helps with |
|---|---|
| Frontend quality | Better layouts, typography, spacing, component feel, responsive behavior, and anti-generic UI direction. |
| Animation | Smooth transitions, spring-like motion, gesture feel, scroll animation, reduced-motion support, and practical browser implementation. |
| 3D/scroll websites | Brand research, AI asset prompts, video/frame-sequence scroll experiences, SEO, and launch checks. |
| Product and planning | Clarifying vague requests, splitting complex work into phases, launch readiness, app onboarding, and product strategy. |
| Marketing and growth | SEO, CRO, copywriting, pricing, ads, lifecycle, onboarding, launch planning, and human-sounding copy cleanup. |
| Security and safety | Portable security review guidance, secrets/supply-chain checks, and safer install/uninstall behavior. |
| Browser validation | Playwright-based screenshots, flow checks, responsive checks, and browser debugging. |
| Knowledge work | Obsidian workflows, docs, specs, MCP building, recent research, and context-management skills. |
| Project memory | AS-Workflow local state, route traces, file hashes, checkpoints, and workflow health checks. |

For a compact map of the whole library, see [`SKILLS_TLDR.md`](SKILLS_TLDR.md). For the full inventory, see [`SKILLS_SUMMARY.md`](SKILLS_SUMMARY.md).

## How It Works

AgenticSupercharge has five main parts.

### 1. Skills

Skills are folders containing a `SKILL.md` file. A skill is a focused playbook for one kind of work.

Examples:

- `design-taste-frontend` for higher-quality UI direction.
- `fluid-animations` for natural, interruptible, Apple-style motion.
- `jack-scroll-3d-sites` for scroll-driven animated sites.
- `security-review` for non-Claude security audits.
- `pre-launch-checklist` for release readiness.

### 2. Skill Router

`skill-router` is the bouncer.

It is not a background daemon, model, or external service. It is a routing skill with rules, examples, and a catalog. It helps the agent decide which specialist skills are worth loading for the current request.

The router is designed to keep context small. For simple tasks, it should stay quiet. For complex tasks, it should pick the useful skills and explain the sequence briefly. There is no hard skill cap: the router should use as many skills as the task genuinely needs, preferably phased so the agent does not load everything at once.

As of v0.3, the router does not improve itself automatically. The repo includes consistency checks and a router benchmark so maintainers can test and improve it over time.

This same router is included in the public install. It is not only for the maintainer's local machine.

### 3. AS-Workflow

AS-Workflow is the local notebook.

Skills answer "how should the agent do this kind of task?" AS-Workflow answers "what is already happening in this project?"

When supported agents do meaningful project work, they can create:

```text
.agenticsupercharge/
```

That folder stores concise project state, active work, decisions, file hashes, route traces, reports, and handoff checkpoints. It is local runtime state and is added to `.gitignore` by default.

Useful commands:

```bash
agentic-supercharge status
agentic-supercharge doctor
agentic-supercharge resync --dry-run
agentic-supercharge resync --apply
agentic-supercharge checkpoint --message "before refactor"
```

Disable hook/init behavior for a process with:

```bash
AGENTIC_SUPERCHARGE_WORKFLOW=disabled
```

For details, see [`docs/as-workflow.md`](docs/as-workflow.md).

### 4. Installer

The installer copies skills into the folders used by each supported tool.

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

The installer also writes a persistent AS-Workflow runtime under `~/.agentic-supercharge/runtime/current/` so hooks do not depend on a temporary `npx` folder or a clone you might delete.

### 5. Verification

The project includes checks for:

- Manifest/source consistency.
- Skill metadata.
- Router coverage.
- Release archive safety.
- Installer dry-runs.
- Pinned source references.

Maintainers can run:

```bash
npm run consistency
npm run eval:router
./verify.sh
```

The v0.3 eval pack is a test bench, not a magic score. It helps compare routed prompts against plain prompts and catch obvious routing drift.

## Install Modes

| Mode | Use it when | What happens |
|---|---|---|
| Global install | You want these skills available in all projects. | Installs into detected or selected agent roots on your Mac. |
| Local project install | You want one repo to carry its own AI setup. | Adds project-local skills and instruction files such as `.agents/skills`, `.cursor/skills`, `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md`. |
| Dry run | You want to inspect changes first. | Prints the install plan without writing files. |

The installer auto-detects installed agents for global installs. You can also choose targets manually.

## Safety Model

AgenticSupercharge is non-destructive by default.

| Policy | Behavior |
|---|---|
| `preserve` | Install missing skills, update AgenticSupercharge-managed skills, and skip unmarked folders. |
| `backup-and-replace` | Move matching folders into `~/.agentic-supercharge/backups/...` before replacing them. |
| `replace-managed-only` | Replace only folders that already contain an AgenticSupercharge marker. |
| `force` | Replace matching folders even if unmarked. This requires an explicit flag or confirmation. |

Managed skill folders receive a `.agentic-supercharge.json` marker. Managed instruction blocks are delimited and updated in place, preserving user content outside those blocks.

Uninstall removes only AgenticSupercharge-managed folders and instruction blocks:

```bash
./uninstall.sh --dry-run
./uninstall.sh
```

## Updates

There are two kinds of updates.

### AgenticSupercharge Updates

These update this installer, router, local skills, docs, checks, and verified source pins.

If you installed from a git clone:

```bash
./check-updates.sh
./update.sh
```

`./check-updates.sh` reports available updates without changing anything. `./update.sh` applies the latest AgenticSupercharge release state and refreshes managed skills from verified pinned sources.

If you installed with GitHub `npx`, re-run:

```bash
npx -y github:radustefandumitru/AgenticSupercharge
```

### Upstream Skill Updates

Many skills come from external creators. By default, AgenticSupercharge installs verified pinned commits and exact package versions. This is safer than silently pulling whatever changed upstream today.

When an original creator updates their repo, users do **not** automatically receive that unreviewed upstream change by default.

The normal path is:

1. Upstream creator updates their skill.
2. AgenticSupercharge maintainer checks the change.
3. `manifest.json` and [`VERIFIED_SOURCES.md`](VERIFIED_SOURCES.md) are updated with a new verified pin.
4. Users run the normal update command.

Power users can intentionally follow live upstream branches or latest packages:

```bash
./update.sh --skills-only --allow-upstream-drift
```

That is flexible, but less safe. It may install content this release has not verified.

There are no push notifications. Install, verify, and update commands may print passive update notices when they detect newer versions, and maintainers can run `./check-updates.sh` whenever they want to check manually.

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

Context7 is the only public-standard MCP recommendation in this kit. Other MCPs and connectors are optional user/project setup and are documented in [`MCP_AND_CONNECTORS.md`](MCP_AND_CONNECTORS.md).

## What This Is Not

AgenticSupercharge is not:

- A replacement for clear requirements, tests, or code review.
- A promise that every model output becomes better.
- A background service watching your machine.
- A system that uploads your private files or credentials.
- A live auto-sync to every upstream skill repo by default.

It is a curated, installable skill layer. It works best when the router stays selective and the agent still verifies its work.

## Documentation

Most users only need this README and [`SKILLS_TLDR.md`](SKILLS_TLDR.md).

Power-user and maintainer docs:

| File | Purpose |
|---|---|
| [`SKILLS_SUMMARY.md`](SKILLS_SUMMARY.md) | Full human-readable skill inventory. |
| [`docs/skill-readiness.md`](docs/skill-readiness.md) | Which skills work immediately and which need optional tools. |
| [`docs/as-workflow.md`](docs/as-workflow.md) | Local project-state workflow, commands, hooks, and disable behavior. |
| [`docs/evaluation.md`](docs/evaluation.md) | Router benchmark protocol and consistency-check explanation. |
| [`MCP_AND_CONNECTORS.md`](MCP_AND_CONNECTORS.md) | Context7 and optional MCP/connectors guidance. |
| [`VERIFIED_SOURCES.md`](VERIFIED_SOURCES.md) | Pinned source refs used by default. |
| [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) | Attribution, licenses, and redistribution notes. |
| [`SECURITY.md`](SECURITY.md) | Security policy and vulnerability reporting. |
| [`PUBLISHING.md`](PUBLISHING.md) | Maintainer release checklist. |

## Credits

AgenticSupercharge is a curated installer and router. Most skills come from other people and projects.

Major sources include [Leonxlnx / Taste Skill](https://github.com/Leonxlnx/taste-skill), [Paul Bakaus / Impeccable](https://github.com/pbakaus/impeccable), [Emil Kowalski](https://emilkowal.ski), [GoogleChrome / Modern Web Guidance](https://github.com/GoogleChrome/modern-web-guidance), [Muratcan Koylan / Agent Skills for Context Engineering](https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering), [Corey Haines / MarketingSkills](https://github.com/coreyhaines31/marketingskills), [Hardik Pandya / Stop Slop](https://github.com/hardikpandya/stop-slop), [Kepano / Obsidian Skills](https://github.com/kepano/obsidian-skills), [Anthropic Skills](https://github.com/anthropics/skills), [OpenAI Skills](https://github.com/openai/skills), [Vercel Labs Skills](https://github.com/vercel-labs/skills), [ComposioHQ Awesome Claude Skills](https://github.com/ComposioHQ/awesome-claude-skills), [Remotion](https://www.remotion.dev), [Microsoft Playwright CLI](https://github.com/microsoft/playwright-cli), [Apple's Designing Fluid Interfaces session](https://developer.apple.com/videos/play/wwdc2018/803/), [Jack Roberts](https://www.youtube.com/watch?v=TZUTe7s11-I&list=WL&index=50), and [multica-ai / andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills).

Please support the original creators. Detailed attribution lives in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Honest Assessment

Stefan asked his coding agent to review the project bluntly and say whether it is useful or just context bloat.

My assessment: AgenticSupercharge is useful when the router stays selective and AS-Workflow stays lightweight. The value comes from combining pinned sources, safe install behavior, source attribution, task-specific routing, and local project state. It can become harmful if an agent loads the whole catalog for every prompt, or if users expect skills to replace product judgment, tests, or clear requirements. The v0.3 benchmark gives the project a way to measure routing quality, and v0.4 adds project memory, but neither proves a universal output-quality lift. The honest claim is narrower: good task-specific instructions and small project state, applied only when relevant, usually improve agent behavior on the work this kit targets.

Codex, GPT-5-based coding agent, high reasoning effort.

## Contributing

Contributions are welcome. Please keep the repo safe, small, and attribution-heavy:

- Prefer upstream installs over copied third-party snapshots.
- Add new skills through `manifest.json` or public-safe local skills.
- Credit original creators with links.
- Do not include secrets, OAuth state, MCP configs, browser profiles, private course material, or account-specific setup.
- Run `./verify.sh` before publishing changes.

Project note: AgenticSupercharge is being used to improve AgenticSupercharge. The README, router checks, and quality passes are produced with the same setup installed locally.
