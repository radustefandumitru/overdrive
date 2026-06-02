# AgenticSupercharge

**AgenticSupercharge** is a complete, plug-and-play system that supercharges AI coding agents, not just another skill pack.

It installs four layers that work together across Claude Code, Codex, Gemini CLI, Antigravity, Cursor, and shared local agents:

- **Specialist skills:** a curated library that teaches agents how to do specific work well, including web/app development, frontend polish, animation, SEO, research, product work, security review, launch prep, and browser validation.
- **A skill-router:** picks the minimum useful skills for each task instead of dumping the whole catalog into context, keeping agents focused, fast, and token-light.
- **AS-Workflow:** a local `.agenticsupercharge/` project-state layer that gives agents memory: active work, decisions, constraints, file hashes, routing history, checkpoints, handoffs, and an optional knowledge vault. It is local, gitignored, and never uploaded by AgenticSupercharge.
- **A global operating guide:** a Karpathy-inspired instruction layer that makes agents think before coding, keep diffs surgical, plan complex work, stay objective, and verify their output.

All of that is wrapped in a safe, boring installer: pinned sources, non-destructive defaults, reversible uninstall, and no telemetry.

There are a million skill packs on GitHub. AgenticSupercharge is the workflow around them: tools, selective routing, project state, and an operating discipline for how the agent works, so you get better output with less manual prompting. The promise is simple: **it just works.**

I built AgenticSupercharge as my own daily AI coding-agent setup. I've been an early AI adopter since ChatGPT launched in November 2022, and this distills the manual practices and habits I've refined over years of trial and error into something that just works. I'm releasing it free for the community. If you build something with it, tag me or send feedback on Reddit at [u/StefanDumitru](https://www.reddit.com/user/StefanDumitru/). Contributions are welcome. If you want to buy me a coffee, you can do so [here](https://buymeacoffee.com/stefandumitru) :)

## Why Use It?

Most AI coding agents are powerful, but they often need repeated guidance:

- "Make this less generic."
- "Use better UI taste."
- "Check accessibility."
- "Use current docs."
- "Run a browser test."
- "Think through the launch/security/SEO implications."

AgenticSupercharge packages those recurring instructions into reusable skills and installs them where your agents can find them.

You keep prompting normally. For non-trivial work, the agent checks the router, loads the smallest useful skill set, and proceeds with more relevant guidance. For longer projects, AS-Workflow keeps a small local memory so the agent does not have to rediscover the same context every session. For reference-heavy work, the knowledge vault lets you drop local docs into `.agenticsupercharge/knowledge/`, index them, and have the agent read only the relevant Markdown/cache files.

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

By default, v0.12 also tries to set up a few optional helper tools when their skills are selected: Graphify (`graphifyy==0.1.14`), video helpers (`ffmpeg` and `yt-dlp`), and browser support for `design-extract`. These attempts are non-privileged, fail open, and never collect keys or write MCP/app config. Use `--no-tool-install` if you only want the skill files and instructions.

## Sanity Check

If you installed from a clone, run:

```bash
./verify.sh
```

If you want to check AS-Workflow from any project folder, run:

```bash
~/.agentic-supercharge/bin/agentic-supercharge status
```

At first it may say AS-Workflow is not initialized. That is normal. A `.agenticsupercharge/` folder is created only after meaningful project work or an explicit workflow command such as `checkpoint` or `resync --apply`.

## What Changes After Install?

You do not need to memorize every skill.

The global instructions tell the agent to do a lightweight skill check. The router might choose different skills depending on the work:

| You ask | The router might use |
|---|---|
| "Review this for security holes before I deploy." | `security-review` |
| "Make this drawer feel smooth and natural." | `fluid-animations` + `emil-animation-polish` |
| "Find and fix problems in my React app." | `react-doctor` |
| "Make this prompt sharper before I send it to another AI." | `prompt-master` |
| "Make this paragraph sound less AI-written but keep the facts." | `humanizer` |
| "Extract the design system from this public website." | `design-extract` |
| "Watch this screen recording and tell me where the UI breaks." | `claude-video` |
| "Virtualize 100k variable-height text rows without layout thrash." | `pretext` |
| "SEO-audit my site before launch." | `jack-seo-launch-audit` |
| "Design a premium landing page and verify it in-browser." | `design-taste-frontend` + `impeccable` + `playwright-cli` |

Then the agent loads only the relevant skill bodies while doing the work. For complex requests, it can use more skills in phases; for simple requests, the router should stay quiet.

You can also name a skill directly:

```text
Use jack-scroll-3d-sites for the hero section.
```

When you name a skill, your explicit choice wins for that part of the task.

## What Happens Under The Hood

AgenticSupercharge is file-based. It does not run a cloud service and it does not upload your project.

AgenticSupercharge installs its own managed skills into each selected agent's skill directory. Each managed skill folder contains an `.agentic-supercharge.json` marker so future updates and uninstalls can tell what belongs to this kit. It also installs the AS-Workflow runtime and, where supported, hooks, commands, or rules. It does not replace or manage your agent's native skills, third-party plugin skills, or MCP servers. Those are separate layers that live alongside AgenticSupercharge.

On Cursor specifically, AgenticSupercharge installs into `~/.cursor/skills` and adds the AS-Workflow rule at `~/.cursor/rules/`. It does not touch Cursor's reserved `~/.cursor/skills-cursor` folder or write Cursor hook settings.

| Piece | When it appears | What it does |
|---|---|---|
| Skills | During install | Copies curated `SKILL.md` folders into the selected agent roots. |
| Instruction blocks | During install | Adds a managed global guidance block while preserving user content outside the block. |
| Runtime | During install | Writes a persistent helper at `~/.agentic-supercharge/runtime/current/` plus a CLI shim. |
| Optional helper tools | During install, unless `--no-tool-install` is set | Attempts safe user-space setup for Graphify, video helpers, and browser support. Missing tools become warnings, not install failures. |
| Hooks/commands/rules | During global install, where supported | Let supported agents call AS-Workflow. Hooks are advisory and fail open. |
| Project state | During meaningful project work or explicit workflow commands | Creates local `.agenticsupercharge/` state and adds it to `.gitignore`. |

The important split:

- Skills teach the agent **how** to do specialist work.
- `skill-router` chooses **which** skills are relevant.
- AS-Workflow helps the agent remember **what is happening in this project**.
- The knowledge vault helps the agent find **which local reference docs matter** without dumping all of them into context.

## What You Get

The current manifest contains 137 unique skills.

| Area | What it helps with |
|---|---|
| Frontend quality | Better layouts, typography, spacing, component feel, responsive behavior, and anti-generic UI direction. |
| Animation | Smooth transitions, spring-like motion, gesture feel, scroll animation, reduced-motion support, and practical browser implementation. |
| 3D/scroll websites | Brand research, AI asset prompts, video/frame-sequence scroll experiences, SEO, and launch checks. |
| Product design layers | `layers-*` skills help agents reason from observed behaviour through domain, user needs, strategy, conceptual model, interaction flow, and surface decisions before jumping to screens. |
| Glass UI | `liquid-glass-web` teaches cross-browser Liquid Glass as progressive enhancement: universal frosted glass first, then SVG displacement or WebGL only when justified. |
| Text layout engineering | `pretext` teaches agents to use `@chenglou/pretext` for advanced text measurement/layout without DOM reflow: virtualized text rows, shrinkwrapped chat bubbles, auto-growing textareas, overflow checks, and Canvas/SVG/WebGL text. |
| Prompt engineering | `prompt-master` helps write or improve prompts, reusable instructions, and AI task specs without turning every request into meta-prompting. |
| Writing polish | `humanizer` rewrites existing text to sound more natural while preserving meaning and facts; `stop-slop` remains the broader AI-tell cleanup skill. |
| Design extraction | `design-extract` can ingest a public website's design language, tokens, fonts, spacing, and component patterns when optional tooling is available. |
| Video comprehension | `claude-video` helps agents analyze videos and screen recordings; `media-download` remains the downloader. |
| Product and planning | Clarifying vague requests, splitting complex work into phases, launch readiness, app onboarding, and product strategy. |
| Marketing and growth | SEO, CRO, copywriting, pricing, ads, lifecycle, onboarding, launch planning, and human-sounding copy cleanup. |
| Security and safety | Portable security review guidance, secrets/supply-chain checks, and safer install/uninstall behavior. |
| Browser validation | Playwright-based screenshots, flow checks, responsive checks, and browser debugging. |
| Knowledge work | Docs, specs, MCP building, recent research, Reddit community signal, local document-to-Markdown conversion, context-management skills, JSON Canvas, and clean web-to-markdown extraction. |
| Codebase intelligence | Optional Graphify-powered code/corpus relationship mapping for "how does this codebase fit together?" and "what connects X to Y?" questions. |
| Usage insight | `agentic-supercharge usage` reads local Claude Code token logs on demand and reports token counts, cache use, top projects/models/tools, biggest sessions, and best-effort route attribution. It prints no prompt or message content. |
| Code health | React diagnostics through `react-doctor`, plus planning/security/browser checks when the task needs them. |
| Objective review | `what-should-i-consider` pressure-tests plans for hidden assumptions, architecture risks, and missing decisions. |
| Media utilities | `media-download` wraps `yt-dlp` for user-requested MP3 and high-quality MP4 downloads. |
| Project memory | AS-Workflow local state, preferences, knowledge vault, route traces, file hashes, checkpoints, and workflow health checks. |

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
- `convert-to-markdown` for local PDFs, Office docs, spreadsheets, and data files.
- `reddit-research` for public Reddit/community signal.
- `graphify` for optional codebase or mixed-corpus graph intelligence.
- `prompt-master` for prompt writing and prompt improvement.
- `humanizer` for meaning-preserving human voice cleanup.
- `design-extract` for public website design-language extraction.
- `claude-video` for video and screen-recording comprehension.
- `pretext` for text measurement/layout engineering without DOM reflow.

### 2. Skill Router

`skill-router` is the bouncer.

It is not a background daemon, model, or external service. It is a routing skill with rules, examples, and a catalog. It helps the agent decide which specialist skills are worth loading for the current request.

The router is designed to keep context small. For simple tasks, it should stay quiet. For complex tasks, it should pick the useful skills and explain the sequence briefly. There is no hard skill cap: the router should use as many skills as the task genuinely needs, preferably phased so the agent does not load everything at once.

The router does not improve itself automatically. The repo includes consistency checks and a router benchmark so maintainers can test and improve it over time.

This same router is included in the public install. It is not only for the maintainer's local machine.

### 3. AS-Workflow

AS-Workflow is the local notebook.

Skills answer "how should the agent do this kind of task?" AS-Workflow answers "what is already happening in this project?"

When supported agents do meaningful project work, they can create:

```text
.agenticsupercharge/
```

That folder stores concise project state, active work, decisions, preferences, research notes, file hashes, route traces, reports, handoff checkpoints, and an optional reference-doc knowledge vault. It is local runtime state and is added to `.gitignore` by default.

The knowledge vault is intentionally boring:

```text
.agenticsupercharge/
  knowledge/
  knowledge-index.json
```

Drop project reference docs into `knowledge/`, then run:

```bash
agentic-supercharge knowledge --apply
```

The CLI indexes file paths, hashes, sizes, titles, and cached Markdown paths. It does not call a model or create embeddings. Agents can later inspect `knowledge-index.json`, choose the relevant file, and load only that source or its Markdown cache. This is the local, file-based version of "project knowledge" without telemetry or cloud sync.

AS-Workflow is intentionally conservative. A simple factual question should not initialize project state. Hooks only provide lightweight reminders or update local workflow files; if a hook fails, the agent should keep going.

Graphify is separate from AS-Workflow. AS-Workflow remembers local project state, decisions, route traces, and reference docs; Graphify is for on-demand queryable knowledge graphs over a codebase or mixed corpus. AgenticSupercharge attempts to set up `graphifyy==0.1.14` with `pipx` or a managed user-space virtualenv during install, preferring Python 3.10-3.12 because the pinned dependency tree may not build on newer Python releases yet. It never uses global `pip`, `sudo`, or `--break-system-packages`. If setup is skipped, fails, or is disabled with `--no-tool-install`, agents explain the manual setup and fall back to normal `rg`/file reads.

Useful commands:

```bash
agentic-supercharge status
agentic-supercharge doctor
agentic-supercharge knowledge --dry-run
agentic-supercharge knowledge --apply
agentic-supercharge resync --dry-run
agentic-supercharge resync --apply
agentic-supercharge usage --days 30
agentic-supercharge checkpoint --message "before refactor"
```

`usage` is read-only and local. It scans Claude Code JSONL usage logs first, reports token counts rather than prices, joins to AS route traces when timestamps line up, and keeps prompt/message content out of the output. Codex usage parsing is opportunistic for now; if cheap token fields are not present, the command says so.

Disable hook/init behavior for a process with:

```bash
AGENTIC_SUPERCHARGE_WORKFLOW=disabled
```

For details, see [`docs/as-workflow.md`](docs/as-workflow.md).

AgenticSupercharge also keeps context optimization native to each runtime instead of adding a background memory system. The current matrix lives in [`docs/context-runtime-matrix.md`](docs/context-runtime-matrix.md): Claude Code, Codex, Gemini CLI, Antigravity, and Cursor do not expose identical context controls, so the global guide stays lean and defers to each runtime's own memory, compact/compress, rules, and skill-loading behavior.

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

When relevant skills are selected, it may also attempt safe helper setup for `graphifyy==0.1.14`, `yt-dlp`, `ffmpeg`, and browser support. These attempts are best-effort and non-privileged; missing tools become warnings and manual fallback instructions.

The interactive installer asks whether you want the full library or a subset. Full install is recommended because the router keeps context small, but power users can install a subset:

```bash
./install.sh --scope global --tools auto --skills skill-router,planning-first,playwright-cli
./install.sh --scope global --tools auto --skip-skills connect,connect-apps
./install.sh --scope global --tools auto --all
./install.sh --scope global --tools auto --no-tool-install
```

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
npm run analyze:routes
./verify.sh
```

The eval pack is a test bench, not a magic score. It helps compare routed prompts against plain prompts and catch obvious routing drift.

v0.6 also includes a human-scored scorecard harness at [`docs/scorecard-v0.6.md`](docs/scorecard-v0.6.md). It starts empty on purpose; real output-quality claims should wait until blind control-vs-routed runs are scored.

`npm run analyze:routes` writes [`docs/catalog-health.md`](docs/catalog-health.md), a local-only maintainer report for route frequency, common skill pairings, and human-review candidates. It is not telemetry and never collects user data.

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

Context7 is the only public-standard MCP recommendation in this kit. Other MCPs and connectors are optional user/project setup and are documented in [`MCP_AND_CONNECTORS.md`](MCP_AND_CONNECTORS.md). MarkItDown MCP and Browserbase are documented as optional tools only; they are not installed or configured by AgenticSupercharge. Obsidian support is intentionally light: the public install keeps `json-canvas` and `defuddle`, while deeper vault automation belongs in each user's own Obsidian setup.

The installer may attempt non-privileged setup for a narrow set of external helper binaries/packages used by bundled skills: `graphifyy==0.1.14`, `yt-dlp`, `ffmpeg`, and browser support for `design-extract`. It does not install account connectors, MCP servers, browser extensions, cookies, API keys, or app sessions.

## What This Is Not

AgenticSupercharge is not:

- A replacement for clear requirements, tests, or code review.
- A promise that every model output becomes better.
- A background service watching your machine.
- A telemetry or analytics system.
- A system that uploads your private files or credentials.
- A live auto-sync to every upstream skill repo by default.
- A privileged package manager. Optional helper setup is best-effort, user-space where possible, and can be skipped with `--no-tool-install`.

It is a curated, installable skill layer. It works best when the router stays selective and the agent still verifies its work.

## Documentation

Most users only need this README and [`SKILLS_TLDR.md`](SKILLS_TLDR.md).

Power-user and maintainer docs:

| File | Purpose |
|---|---|
| [`SKILLS_SUMMARY.md`](SKILLS_SUMMARY.md) | Full human-readable skill inventory. |
| [`docs/skill-readiness.md`](docs/skill-readiness.md) | Which skills work immediately and which need optional tools. |
| [`docs/as-workflow.md`](docs/as-workflow.md) | Local project-state workflow, commands, hooks, and disable behavior. |
| [`docs/context-runtime-matrix.md`](docs/context-runtime-matrix.md) | Verified native context-window mechanisms by supported runtime. |
| [`docs/prompt-caching.md`](docs/prompt-caching.md) | How AgenticSupercharge stays friendly to prompt-cache reuse. |
| [`docs/evaluation.md`](docs/evaluation.md) | Router benchmark protocol and consistency-check explanation. |
| [`docs/catalog-health.md`](docs/catalog-health.md) | Local route-analysis output for maintainers. |
| [`MCP_AND_CONNECTORS.md`](MCP_AND_CONNECTORS.md) | Context7 and optional MCP/connectors guidance. |
| [`VERIFIED_SOURCES.md`](VERIFIED_SOURCES.md) | Pinned source refs used by default. |
| [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) | Attribution, licenses, and redistribution notes. |
| [`SECURITY.md`](SECURITY.md) | Security policy and vulnerability reporting. |
| [`PUBLISHING.md`](PUBLISHING.md) | Maintainer release checklist. |

## Credits

AgenticSupercharge is a curated installer and router. Most skills come from other people and projects.

Major sources include [Leonxlnx / Taste Skill](https://github.com/Leonxlnx/taste-skill), [Paul Bakaus / Impeccable](https://github.com/pbakaus/impeccable) and [impeccable.style](https://impeccable.style), [Aiden Bai / Million / React Doctor](https://github.com/millionco/react-doctor) and [react.doctor](https://react.doctor), [Emil Kowalski](https://emilkowal.ski), [GoogleChrome / Modern Web Guidance](https://github.com/GoogleChrome/modern-web-guidance), [Muratcan Koylan / Agent Skills for Context Engineering](https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering), [Corey Haines / MarketingSkills](https://github.com/coreyhaines31/marketingskills), [Hardik Pandya / Stop Slop](https://github.com/hardikpandya/stop-slop), [Kepano / Obsidian Skills](https://github.com/kepano/obsidian-skills), [yt-dlp](https://github.com/yt-dlp/yt-dlp), [Anthropic Skills](https://github.com/anthropics/skills), [OpenAI Skills](https://github.com/openai/skills), [Vercel Labs Skills](https://github.com/vercel-labs/skills), [ComposioHQ Awesome Claude Skills](https://github.com/ComposioHQ/awesome-claude-skills), [Remotion](https://www.remotion.dev), [Microsoft Playwright CLI](https://github.com/microsoft/playwright-cli), [Apple's Designing Fluid Interfaces session](https://developer.apple.com/videos/play/wwdc2018/803/), [Jack Roberts](https://www.youtube.com/watch?v=TZUTe7s11-I&list=WL&index=50), [Boris Cherny / Anthropic prompt guidance shared by @AnatoliKopadze](https://x.com/AnatoliKopadze/status/2054568935274549597), and [multica-ai / andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills).

v0.6 product-design and motion additions credit [Jamie Mill's Layers of Product Design skills](https://github.com/jamiemill/layers-skills) and [Layers site](https://layers.jamiemill.com), [Andrew Prifer's liquid-dom](https://github.com/AndrewPrifer/liquid-dom) as Liquid Glass inspiration, [kube.io's CSS/SVG Liquid Glass technique](https://kube.io/blog/liquid-glass-css-svg/), [`naughtyduk/liquidGL`](https://github.com/naughtyduk/liquidGL) as an optional license-checked WebGL reference, [@gabriell_lab's proximity-hover pattern](https://x.com/gabriell_lab/status/2060336070059864461), [@baptistebriel's rect-caching performance note](https://x.com/baptistebriel/status/2060351541345681851), [@mannupaaji's scroll-state navbar pattern](https://x.com/mannupaaji/status/2060025609867387239), and the [Chrome CSS scroll-state queries writeup](https://developer.chrome.com/blog/css-scroll-state-queries).

v0.7 knowledge and token-efficiency additions credit [Microsoft MarkItDown](https://github.com/microsoft/markitdown) for the optional document-to-Markdown conversion pipeline and [Browserbase skills](https://github.com/browserbase/skills) as an optional documented connector. Reddit research uses public read-only Reddit endpoints only and does not bundle credentials or Reddit code.

v0.8 context-efficiency guidance credits [Andre Kreidemann's prompt-caching writeup](https://kreidemann.com/blog/prompt-caching), [Sankalp Shubham's prompt-caching walkthrough](https://sankalp.bearblog.dev/how-prompt-caching-works/), and [Sam Rose / ngrok's prompt-caching article](https://ngrok.com/blog/prompt-caching). The guidance is paraphrased; no article text is redistributed.

v0.9 code-intelligence additions credit [Safi Shamsi / Graphify](https://github.com/safishamsi/graphify) and [graphify.net](https://graphify.net). AgenticSupercharge installs an MIT-allowed, safety-adapted Graphify skill from a pinned commit. It does not bundle the `graphifyy` package, Python dependencies, Neo4j, MCP servers, PDFs extras, or Graphify runtime state.

v0.10 additions credit [Nidhin J S / prompt-master](https://github.com/nidhinjs/prompt-master), [Siqi Chen / humanizer](https://github.com/blader/humanizer), [Manav Arya Singh / design-extract](https://github.com/Manavarya09/design-extract) and [designlang](https://designlang.manavaryasingh.com), and [Brad Bonanno / claude-video](https://github.com/bradautomates/claude-video). `design-extract` and `claude-video` are safety-adapted so agents check availability, avoid writing secrets, and fail open when dependencies are unavailable. The on-demand `usage` command is original AgenticSupercharge code inspired by [codeburn](https://github.com/getagentseal/codeburn) and [ccusage](https://github.com/ryoppippi/ccusage); no code is reused.

v0.11 changes make selected optional dependencies more plug-and-play by attempting safe, non-privileged setup during the installer: `graphifyy==0.1.14`, `yt-dlp`, `ffmpeg`, and browser support for Design Extract. These are invoked or downloaded on the user's machine only when needed; no third-party runtime packages, browsers, generated data, or credentials are bundled in this repository.

v0.12 adds native context-window guidance through [`docs/context-runtime-matrix.md`](docs/context-runtime-matrix.md) and a local `pretext` skill for Cheng Lou's MIT [`@chenglou/pretext`](https://github.com/chenglou/pretext) library. The skill teaches agents how to use Pretext as a per-project app dependency; no Pretext source code or npm package is bundled.

Please support the original creators. Detailed attribution lives in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Honest Assessment

Stefan asked his coding agent to review the project bluntly and say whether it is useful or just context bloat.

My assessment: AgenticSupercharge is useful when the router stays selective and AS-Workflow stays lightweight. The value comes from combining pinned sources, safe install behavior, source attribution, task-specific routing, and local project state. It can become harmful if an agent loads the whole catalog for every prompt, or if users expect skills to replace product judgment, tests, or clear requirements. The benchmark gives the project a way to measure routing quality, and AS-Workflow adds project memory, but neither proves a universal output-quality lift. The honest claim is narrower: good task-specific instructions and small project state, applied only when relevant, usually improve agent behavior on the work this kit targets.

Codex, GPT-5-based coding agent, high reasoning effort.

## Contributing

Contributions are welcome. Please keep the repo safe, small, and attribution-heavy:

- Prefer upstream installs over copied third-party snapshots.
- Add new skills through `manifest.json` or public-safe local skills.
- Credit original creators with links.
- Do not include secrets, OAuth state, MCP configs, browser profiles, private course material, or account-specific setup.
- Run `./verify.sh` before publishing changes.

Project note: AgenticSupercharge is being used to improve AgenticSupercharge. The README, router checks, and quality passes are produced with the same setup installed locally.
