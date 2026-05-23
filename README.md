# AgenticSupercharge

AgenticSupercharge is an all-in-one skill pack and safe installer for AI coding agents. It gives Claude Code, Codex, Gemini CLI, Antigravity, Cursor, and shared `.agents` workflows a curated set of skills for building better web apps, mobile apps, SaaS products, marketing sites, animated interfaces, launch assets, SEO pages, Obsidian vaults, and long-running software projects.

The goal is simple: increase the quality of what your agents produce by giving them better reusable taste, workflow context, implementation checklists, and routing instructions before they start coding.

It does not replace your agent. It gives the agent a better toolbox.

Personal note from Stefan: I am giving my personal coding-agent setup away to the community for free because I want to see what people build with it. If it helps you ship something, tag me or send feedback on Reddit at [u/StefanDumitru](https://www.reddit.com/user/StefanDumitru/). The project is open source, feedback is welcome, and contributors are invited to help make it better. If you want to buy me a coffee, you can do so [here](https://buymeacoffee.com/stefandumitru) :)

## What You Get

- A curated skill library for frontend design, app development, animation, SEO, copywriting, product work, context engineering, project planning, browser validation, image/video workflows, and useful automation.
- A `skill-router` that tells agents to do a lightweight skill check before non-trivial work, then load only the smallest useful skill set.
- Global instruction templates for `CLAUDE.md`, `AGENTS.md`, and `GEMINI.md`, adapted from Karpathy-style coding-agent guidance.
- A non-destructive installer that can install globally across the agent tools you actually have, or locally into one project.
- Public-safe custom skills added on top of the upstream projects: fluid animation guidance, Emil-style animation polish, and Jack Roberts inspired premium 3D/scroll website workflows.
- Verification scripts, conflict handling, source attribution, and sharing-safe packaging for GitHub or zip distribution.

This repository was also built and iterated on using this same setup. In other words, AgenticSupercharge has been used on its own installer, routing, documentation, verification, and publishing workflow.

## Supported Agents

| Agent/tool | Global skill root | Global instruction file |
|---|---|---|
| Claude Code | `~/.claude/skills` | `~/.claude/CLAUDE.md` |
| Codex | `~/.codex/skills` | `~/.codex/AGENTS.md` |
| Gemini CLI | `~/.gemini/skills` | `~/.gemini/GEMINI.md` |
| Antigravity | `~/.gemini/config/skills` | `~/.gemini/GEMINI.md` |
| Cursor | `~/.cursor/skills` | Cursor reads skill folders directly |
| Shared `.agents` | `~/.agents/skills` | Shared skill root only |

Antigravity uses the `.gemini` convention for its agent shell. Even if you run Claude/Sonnet inside Antigravity, the IDE reads `~/.gemini/GEMINI.md`, not `~/.claude/CLAUDE.md`.

Cursor custom skills belong in `~/.cursor/skills` globally or `.cursor/skills` locally. This installer does not write to `~/.cursor/skills-cursor`.

## Quick Start

Install directly from GitHub with `npx`:

```bash
npx -y github:radustefandumitru/AgenticSupercharge
```

Preview first without changing anything:

```bash
npx -y github:radustefandumitru/AgenticSupercharge -- --dry-run
```

Or clone the repo:

```bash
git clone https://github.com/radustefandumitru/AgenticSupercharge.git
cd AgenticSupercharge
./install.sh
./verify.sh
```

Restart or reload your coding agents after installing so they re-index the skill folders.

## Requirements

- macOS-first setup. The installer targets the standard macOS global folders used by these tools.
- Node.js/npm for the GitHub `npx` path and upstream npm-backed installers.
- Git for normal upstream installs from the original skill repositories.
- A supported coding agent installed if you want global auto-detection. Local project installs work without global agents.

## Choose Your Install

The installer asks for scope first.

| Choice | What it does | Use it when |
|---|---|---|
| Local project install | Creates project-local `.agents/skills`, `.cursor/skills`, `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md`. | You want one repo to carry its own AI setup for teammates, clients, or future sessions. |
| Global machine install | Installs into global skill folders for detected or selected coding agents. | You want the skills available in all projects on your machine. |
| Dry run | Shows exactly what would happen and reports conflicts. | You want to check safety before writing anything. |

For global installs, the recommended option is:

```text
Scan and install for available coding agents
```

Auto mode installs only for detected tools. You can also choose exact targets manually, for example when you want to skip a detected tool or prepare a config folder for a tool you plan to install.

Cursor is auto-detected only when the Cursor app or CLI is present. A leftover `~/.cursor` folder by itself does not count as an installed Cursor target, because app uninstalls can leave config folders behind. To prepare Cursor skills manually before installing Cursor, choose Cursor manually and use `--force-targets`.

## Useful Commands

Interactive install:

```bash
./install.sh
```

Preview without changing files:

```bash
./install.sh --dry-run
```

List detected tools and target paths:

```bash
./install.sh --list-targets
```

Global automatic install with the safe default conflict policy:

```bash
./install.sh --scope global --tools auto --conflict preserve
```

Global install for selected tools only:

```bash
./install.sh --scope global --tools claude,codex,cursor --conflict preserve
```

Local project install:

```bash
./install.sh --scope local --project-dir . --conflict preserve
```

Update only previously managed folders:

```bash
./update.sh
```

Verify the current installation:

```bash
./verify.sh
```

## Non-Destructive By Default

AgenticSupercharge uses `preserve` as the default conflict policy.

| Policy | Behavior |
|---|---|
| `preserve` | Install missing skills, update AgenticSupercharge-managed skills, and skip unmarked existing folders. |
| `backup-and-replace` | Move existing matching skill folders to `~/.agentic-supercharge/backups/...` before replacing them. |
| `replace-managed-only` | Replace only folders that already contain the AgenticSupercharge marker. Skip unmarked folders. |
| `force` | Replace matching skill folders even if unmarked. Requires an explicit flag or interactive confirmation. |

Installed skill folders receive a `.agentic-supercharge.json` marker so future runs know which folders this kit manages.

Managed instruction files are handled with delimited blocks. The installer updates only the AgenticSupercharge block and preserves user content outside that block.

## How The Skill System Works

A skill is a folder with a `SKILL.md` file. The frontmatter describes when the agent should use it. After installation, supported agents discover those folders from their skill roots.

The important piece is `skill-router`. The global instruction templates tell agents to consult it before non-trivial work, then load only the skills that match the task. This keeps context small while making the agent more likely to use the right specialist guidance.

You can trigger skills in two ways:

- Ask normally. Example: "Build a premium Next.js landing page with smooth animations." The router should pick design, motion, modern web, and browser-validation skills.
- Name a skill explicitly. Example: "Use `jack-scroll-3d-sites` for this section." Explicit user choice wins for that part of the task.

## What The Skills Help With

| Task | Typical skill path |
|---|---|
| Premium frontend/UI work | Taste Skill, Emil design engineering, Impeccable, Modern Web Guidance, Playwright CLI |
| Smooth animation and gestures | `fluid-animations`, `emil-animation-polish`, Emil design engineering |
| 3D scroll websites and animated landing pages | `jack-premium-site-system`, `jack-website-intelligence`, `jack-scroll-asset-prompts`, `jack-scroll-3d-sites`, `jack-seo-launch-audit` |
| Long-running project execution | GSD project workflow skills plus context engineering when needed |
| Marketing, SEO, launch, copy, CRO | Corey Haines MarketingSkills plus Stop Slop for final voice polish |
| Current library/API docs | Context7 guidance in the global instruction templates |
| Browser checks and screenshots | Playwright CLI skill |
| Images, assets, and video workflows | Banana Claude, Remotion skills, marketing video skills |
| Obsidian vaults and knowledge work | Kepano Obsidian skills |
| External app actions | Curated Composio/connect-style skills, approval-gated |

## Skills Added By This Kit

These are the public-safe AgenticSupercharge additions layered on top of the upstream skills:

- `skill-router`: the routing layer that helps agents choose the smallest useful skill set.
- `fluid-animations`: Apple-inspired guidance for direct manipulation, springs, velocity, rubberbanding, interruptible motion, and reduced-motion-safe tactile UI. Inspired by Apple's WWDC 2018 session [Designing Fluid Interfaces](https://developer.apple.com/videos/play/wwdc2018/803/).
- `emil-animation-polish`: practical web animation polish for easing, timing, hover/touch feedback, popovers, CSS transitions, and motion audits. Inspired by [Emil Kowalski](https://emilkowal.ski), [animations.dev](https://animations.dev), and the public references listed in `THIRD_PARTY_NOTICES.md`.
- `jack-premium-site-system`: end-to-end orchestrator for premium brand-led websites, scroll assets, animated sections, SEO, and optional launch.
- `jack-website-intelligence`: brand extraction, competitor research, build briefs, and client-facing strategy reports.
- `jack-scroll-asset-prompts`: start-frame, end-frame, and transition prompts for scroll-stop assets.
- `jack-scroll-3d-sites`: video-on-scroll, frame-sequence canvas, GSAP/Framer Motion/Three.js choices, mobile fallbacks, and browser validation.
- `jack-seo-launch-audit`: metadata, structured data, internal linking, responsiveness, reduced motion, performance, and launch checks.

The Jack Roberts inspired skills are based on public workflow ideas from [Jack Roberts' YouTube video](https://www.youtube.com/watch?v=TZUTe7s11-I&list=WL&index=50) and [Skool page](https://www.skool.com/aiautomationsbyjack/about?ref=d4618abaabee44c7ac3c146938a72100&el=youtube_description_paid). They are rewritten/paraphrased and do not redistribute Jack's raw PDFs, zips, templates, prompts, downloaded skill files, course material, or private community content.

## Upstream Skills And Credits

AgenticSupercharge is a curated installer/router. Most skills come from other creators and projects. Please support the original work.

| Creator/project | What it contributes |
|---|---|
| [Leonxlnx / Taste Skill](https://github.com/Leonxlnx/taste-skill) and [tasteskill.dev](https://www.tasteskill.dev) | Frontend taste, visual direction, brand kits, image-to-code, redesigns, and style variants. |
| [Paul Bakaus / Impeccable](https://github.com/pbakaus/impeccable) and [impeccable.style](https://impeccable.style/docs/) | UI critique, polish, spacing, typography, accessibility, and frontend quality checks. |
| [Emil Kowalski](https://emilkowal.ski) and [emilkowalski/skill](https://github.com/emilkowalski/skill) | Design-engineering guidance for interaction feel, animation, easing, and component polish. |
| [GoogleChrome / Modern Web Guidance](https://github.com/GoogleChrome/modern-web-guidance) | Current web platform guidance for HTML, CSS, browser APIs, Baseline, accessibility, performance, and Chrome extensions. |
| [GSD / get-shit-done](https://github.com/gsd-build/get-shit-done) and [gsd.build](https://gsd.build) | Planning, execution, milestones, verification, reviews, and persistent project state. |
| [Muratcan Koylan / Agent Skills for Context Engineering](https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering) | Context compression, context degradation, memory, evaluation, tool design, hosted agents, and multi-agent patterns. |
| [Corey Haines / MarketingSkills](https://github.com/coreyhaines31/marketingskills) | SEO, CRO, copywriting, launch, pricing, ads, customer research, onboarding, referrals, analytics, and growth work. |
| [Hardik Pandya / Stop Slop](https://github.com/hardikpandya/stop-slop) | Removes common AI writing tells from public prose. |
| [AgriciDaniel / Banana Claude](https://github.com/AgriciDaniel/banana-claude) | Image-generation creative direction workflows. |
| [Kepano / Obsidian Skills](https://github.com/kepano/obsidian-skills), [Obsidian](https://obsidian.md), and [Obsidian Help](https://help.obsidian.md) | Obsidian Markdown, Bases, JSON Canvas, Obsidian CLI, and Defuddle workflows. |
| [ComposioHQ / Awesome Claude Skills](https://github.com/ComposioHQ/awesome-claude-skills) and [composio.dev](https://composio.dev) | Curated utility/action skills. External actions remain approval-gated. |
| [Remotion skills](https://github.com/remotion-dev/skills) and [remotion.dev](https://www.remotion.dev) | Programmatic video, React animation, captions, audio, and Remotion best practices. |
| [Microsoft Playwright CLI](https://github.com/microsoft/playwright-cli) and [Playwright](https://playwright.dev) | Browser automation, screenshots, snapshots, UI flow checks, data extraction, and frontend validation. |
| [skills.sh](https://skills.sh) | Discovery helper for finding and installing additional agent skills. |
| [Apple Developer: Designing Fluid Interfaces](https://developer.apple.com/videos/play/wwdc2018/803/) | Reference inspiration for the local `fluid-animations` skill. |
| [Jack Roberts](https://www.youtube.com/watch?v=TZUTe7s11-I&list=WL&index=50) | Public workflow inspiration for the local premium 3D/scroll website skills. |
| [multica-ai / andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) | Karpathy-inspired coding-agent instruction patterns adapted into the global templates. |

See `THIRD_PARTY_NOTICES.md` for license notes and redistribution guidance.

## What The Installer Does

`install.sh` is a shell wrapper around the shared Node installer in `bin/agentic-supercharge.js` and `lib/installer.js`. The same core runs for shell installs, zip installs, and GitHub `npx` installs.

The script:

1. Asks whether to install locally or globally, unless flags already specify it.
2. For global installs, detects installed coding agents or lets you choose exact targets.
3. Explains target paths and conflict policy.
4. Pulls approved upstream skills from `manifest.json`.
5. Installs local AgenticSupercharge skills from `skills/`.
6. Runs official installer-backed sources such as GSD and Playwright CLI when applicable.
7. Copies skills into selected roots using the chosen conflict policy.
8. Writes `.agentic-supercharge.json` markers into managed skill folders.
9. Upserts managed instruction blocks into `CLAUDE.md`, `AGENTS.md`, and `GEMINI.md` where relevant.
10. Writes `sources.lock.json` after real installs with source metadata and install results.

`verify.sh` checks expected skills, YAML frontmatter, managed instruction blocks, forbidden bulk automation folders, broken symlinks, router smoke prompts, and non-Claude GSD path leakage.

## Verification Status

Current local verification for this public package has passed:

- shell syntax checks for `install.sh`, `verify.sh`, and `update.sh`
- Node syntax checks for `lib/installer.js` and `bin/agentic-supercharge.js`
- `./verify.sh`
- global install dry-run with detected targets
- local project install dry-run
- `npm pack --dry-run`
- public zip exclusion checks for bundled snapshots, lock metadata, tarballs, `.DS_Store`, and private source material
- simple secret-pattern scan across the public package contents

This is not a formal third-party security audit. Treat it as a project-level sanity check, then review the scripts yourself before running any installer from the internet.

## Public-Safe Distribution Model

Public installs are upstream-first. The repo contains the installer, manifest, router, local public-safe skills, docs, and attribution. Third-party skills are pulled from their original GitHub repositories or official npm installers.

The private/offline zip can include bundled snapshots for convenience, but public GitHub sharing should avoid republishing third-party skill snapshots unless licenses have been reviewed.

## What This Will Never Copy

The installer does not copy or publish:

- API keys, OAuth tokens, service-role keys, database URLs, or connection strings.
- MCP configs containing secrets.
- Browser profiles, app sessions, account cookies, or login state.
- GitHub, Vercel, Supabase, Firecrawl, Google, or other personal account credentials.
- Jack Roberts raw PDFs, zips, templates, downloaded resource folders, or private course/community material.
- `~/.cursor/skills-cursor`.

Context7 is the only public-standard MCP recommendation in this kit. Other MCPs and connectors are intentionally left to each user and project.

## Troubleshooting

If skills do not show up:

1. Restart or reload the coding agent.
2. Run `./install.sh --list-targets` to confirm the target was detected.
3. Run `./verify.sh` to check installed roots, frontmatter, router files, and instruction blocks.
4. Use `./install.sh --dry-run` before changing conflict policies.

If a tool is not detected but you want to prepare its folders manually, choose it manually and use `--force-targets`.

If a skill needs an external tool, install that tool separately. Examples include Playwright CLI, Obsidian CLI, Defuddle, Banana/Gemini image tooling, or authenticated app connectors.

## Honest Assessment

Short answer: yes, this can be genuinely useful, but only when the router stays selective.

Where it adds value:

- It saves setup time by turning scattered high-quality skills into one repeatable install flow.
- It gives agents domain-specific taste and checklists for tasks where generic coding-agent behavior is often weak: frontend polish, animation, SEO, copy, project planning, browser validation, and long-running context management.
- It improves consistency across tools because Claude Code, Codex, Gemini CLI, Antigravity, Cursor, and local project roots can all receive the same skill set and global guidance.
- It makes skill use less annoying because `skill-router` asks the agent to choose 1-3 relevant skills instead of expecting the user to name every skill manually.

Where it can hurt:

- If an agent loads the whole catalogue, it becomes context bloat. The value depends on routing restraint.
- It does not magically make a weak prompt, broken codebase, or missing product judgment good.
- Some skills depend on external tools, current docs, paid APIs, or authenticated connectors that are not included.
- Upstream skill repos can change. Public installs intentionally pull from upstream, so users should read `manifest.json` and run `--dry-run`.
- There is no benchmark suite proving a fixed percentage improvement in output quality. The claim is practical and structural: better task-specific instructions usually improve agent behavior when applied narrowly.

My opinion: this is not just a "superskill" blob. The router, non-destructive installer, source attribution, and verification flow make it more useful than a pile of Markdown dumped into context. The main risk is misuse: if someone treats every skill as always-on context, it becomes noisy. Used as designed, it should improve agent output quality on the kinds of work this kit targets.

- Codex, GPT-5-based coding agent, high reasoning effort, May 23, 2026

## Repository Map

| Path | Purpose |
|---|---|
| `skills/` | Local public-safe AgenticSupercharge skills. |
| `global-instructions/` | Managed instruction templates for Claude Code, Codex, Gemini CLI, and Antigravity. |
| `lib/installer.js` | Shared installer core used by shell and `npx`. |
| `bin/agentic-supercharge.js` | CLI entrypoint for GitHub `npx` installs. |
| `manifest.json` | Source list, selected skill paths, installer-backed sources, and smoke prompts. |
| `SKILLS_SUMMARY.md` | Human-readable inventory and routing overview. |
| `THIRD_PARTY_NOTICES.md` | Attribution, licenses, and redistribution notes. |
| `MCP_AND_CONNECTORS.md` | Public guidance for Context7 and optional user-specific connectors. |
| `PUBLISHING.md` | Checklist for publishing and packaging safely. |
| `bundled/skills/` | Private/offline fallback snapshots, excluded from public zip by default. |

## Publishing And Sharing

Install from GitHub:

```bash
npx -y github:radustefandumitru/AgenticSupercharge
```

Clone and install:

```bash
git clone https://github.com/radustefandumitru/AgenticSupercharge.git
cd AgenticSupercharge
./install.sh
```

Share as a zip by distributing the public zip generated from this folder. The public zip excludes bundled third-party snapshots, lockfiles with local install metadata, `.DS_Store`, tarballs, and private source material.

See `PUBLISHING.md` for the full public-sharing checklist.

## Contributing

Keep the public repo safe, small, and attribution-heavy:

- Prefer upstream installs over copied third-party snapshots.
- Add new skills through `manifest.json` or public-safe local skills.
- Credit original creators with links.
- Do not include secrets, MCP configs, OAuth state, browser profiles, private course material, or account-specific setup.
- Run `./verify.sh` before publishing.
