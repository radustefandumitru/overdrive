# Overdrive

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

I built this as my own daily AI coding-agent setup and am releasing it free for the community. If you build something with it, tag me on X [@editor_stefan](https://x.com/editor_stefan), send feedback on Reddit at [u/StefanDumitru](https://www.reddit.com/user/StefanDumitru/), or open an issue/PR. If you want to buy me a coffee, you can do so [here](https://buymeacoffee.com/stefandumitru) :)

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
agentic-supercharge --help   # legacy compatibility alias
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

The folder is local runtime state and is gitignored by default. Overdrive also keeps the legacy `.agenticsupercharge/` folder gitignored and can non-destructively copy old managed state into `.overdrive/` when a write action initializes the new workflow.

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

Claude Code slash commands install as `/ovd-status`, `/ovd-resync`, `/ovd-knowledge`, `/ovd-doctor`, `/ovd-checkpoint`, and `/ovd-usage`. Legacy `/as-*` aliases remain as managed compatibility commands.

Disable hook/init behavior for a process with:

```bash
OVERDRIVE_WORKFLOW=disabled
```

The legacy `AGENTIC_SUPERCHARGE_WORKFLOW=disabled` env var is still honored for compatibility.

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
| Legacy alias | During install | Keeps `agentic-supercharge` as a compatibility alias to the new Overdrive runtime. |
| Optional helper tools and installer-backed sources | During install, unless `--no-tool-install` is set | Attempts safe user-space setup for Graphify, video helpers, browser support, and official installer-backed skills. Missing tools become warnings, not install failures. |
| Hooks/commands/rules | During global install, where supported | Let supported agents call ovd-workflow. Hooks are advisory and fail open. |
| Project state | During meaningful project work or explicit workflow commands | Creates local `.overdrive/` state and adds `.overdrive/` plus `.agenticsupercharge/` to `.gitignore`. |

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
| `replace-managed-only` | Replace only folders that already contain an Overdrive or legacy managed marker. |
| `force` | Replace matching folders even if unmarked. This requires an explicit flag or confirmation. |

Managed skill folders receive `.overdrive.json`. Legacy `.agentic-supercharge.json` markers still count as managed so old installs can be updated or uninstalled safely. Managed instruction blocks now use `overdrive:global-guidelines`; old `ai-skill-setup:global-guidelines` blocks are replaced rather than duplicated.

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

## License

Overdrive's original code, installer, workflow runtime, docs, and local skills are licensed under Apache-2.0. Third-party skills, references, tools, and upstream projects keep their own licenses and attribution; see [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) and [`VERIFIED_SOURCES.md`](VERIFIED_SOURCES.md).

## Honest Assessment

Stefan asked his coding agent to review the project bluntly and say whether it is useful or just context bloat.

My assessment: Overdrive is useful when the router stays selective and ovd-workflow stays lightweight. The value comes from combining pinned sources, safe install behavior, source attribution, task-specific routing, and local project state. It can become harmful if an agent loads the whole catalog for every prompt, or if users expect skills to replace product judgment, tests, or clear requirements. The benchmark gives the project a way to measure routing quality, and ovd-workflow adds project memory, but neither proves a universal output-quality lift. The honest claim is narrower: good task-specific instructions and small project state, applied only when relevant, usually improve agent behavior on the work this kit targets.

Codex, GPT-5-based coding agent, high reasoning effort.

## Contributing

Contributions are welcome. Please keep the repo safe, small, and attribution-heavy:

- Prefer upstream installs over copied third-party snapshots.
- Add new skills through `manifest.json` or public-safe local skills.
- Credit original creators with links.
- Do not include secrets, OAuth state, MCP configs, browser profiles, private course material, or account-specific setup.
- Run `./verify.sh` before publishing changes.

Project note: Overdrive is being used to improve Overdrive. The README, router checks, and quality passes are produced with the same setup installed locally.
