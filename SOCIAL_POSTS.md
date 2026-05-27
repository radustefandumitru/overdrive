# Social Post Drafts

Repo URL: https://github.com/radustefandumitru/AgenticSupercharge

Support link: https://buymeacoffee.com/stefandumitru

## v0.2.0 Announcement Notes

Short version:

> AgenticSupercharge v0.2.0 is out.
>
> This release makes the setup less like a pile of skills and more like an actual working agent layer:
>
> - sharper `skill-router` rules
> - `clarify-and-plan` for ambiguous tasks
> - `planning-first` for complex non-Claude coding work
> - portable `security-review` for Codex/Cursor/Gemini/Antigravity
> - `pre-launch-checklist` for apps/SaaS/landing pages before shipping
> - `last30days` for recent community research
> - app onboarding questionnaire skill
> - `./check-updates.sh`
> - context-budget reminder in global instructions
> - optional MCP/voice/Obsidian setup docs
>
> Still free, open source, macOS-first, and non-destructive by default.
>
> Repo: https://github.com/radustefandumitru/AgenticSupercharge

Tone to keep: grateful, attribution-heavy, and honest that this improves output only when the router stays selective.

## Creator Credits

Use GitHub links for the canonical source. Only include Reddit usernames when they were visible in source material; do not guess.

- Taste Skill by Leon Lin / Leonxlnx: [GitHub](https://github.com/Leonxlnx/taste-skill), [site](https://www.tasteskill.dev), X: [@LexnLin](https://x.com/LexnLin), project X: [@_TasteSkill](https://x.com/_TasteSkill). No reliable Reddit username found.
- Impeccable by Paul Bakaus: [GitHub](https://github.com/pbakaus/impeccable), [docs](https://impeccable.style/docs/), X: [@pbakaus](https://x.com/pbakaus). No reliable Reddit username found.
- Emil Kowalski skill: [GitHub](https://github.com/emilkowalski/skill), [site](https://emilkowal.ski/skill), [animations.dev](https://animations.dev), X: [@emilkowalski](https://x.com/emilkowalski). No reliable Reddit username found.
- Agent Skills for Context Engineering by Muratcan Koylan: [GitHub](https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering). No reliable Reddit/X account found beyond GitHub.
- MarketingSkills by Corey Haines: [GitHub](https://github.com/coreyhaines31/marketingskills), GitHub profile lists X: [@coreyhainesco](https://x.com/coreyhainesco). No reliable Reddit username found.
- Stop Slop by Hardik Pandya: [GitHub](https://github.com/hardikpandya/stop-slop), site from skill metadata: [hvpandya.com](https://hvpandya.com). No reliable Reddit/X account found.
- Banana Claude by AgriciDaniel: [GitHub](https://github.com/AgriciDaniel/banana-claude). No reliable Reddit/X account found.
- Obsidian Skills by Steph Ango / Kepano: [GitHub](https://github.com/kepano/obsidian-skills), Reddit: [u/kepano](https://www.reddit.com/user/kepano/), X: [@kepano](https://x.com/kepano).
- Last30Days by Matt Van Horn: [GitHub](https://github.com/mvanhorn/last30days-skill), X/GitHub links available in upstream docs.
- App Onboarding Questionnaire by Adam Lyttle: [GitHub](https://github.com/adamlyttleapps/claude-skill-app-onboarding-questionnaire).
- Anthropic example skills: [GitHub](https://github.com/anthropics/skills), [skills docs](https://support.claude.com/en/articles/12512180-using-skills-in-claude). Includes `brand-guidelines`, `doc-coauthoring`, `mcp-builder`, and `slack-gif-creator`.
- Anthropic Claude Code Security Review: [GitHub](https://github.com/anthropics/claude-code-security-review). The portable non-Claude `security-review` skill is adapted from this MIT-licensed template.
- OpenAI Skills Catalog: [GitHub](https://github.com/openai/skills). Includes the curated `playwright` wrapper skill in this setup.
- Vercel Labs Skills / skills.sh: [GitHub](https://github.com/vercel-labs/skills), [skills.sh](https://skills.sh). Includes `find-skills` in this setup.
- Composio Awesome Claude Skills: [GitHub](https://github.com/ComposioHQ/awesome-claude-skills), [site](https://composio.dev).
- Remotion Skills: [GitHub](https://github.com/remotion-dev/skills), [site](https://www.remotion.dev).
- Playwright CLI skill: [docs](https://playwright.dev/agent-cli/skills), [GitHub](https://github.com/microsoft/playwright-cli).
- Google Modern Web Guidance: [docs](https://developer.chrome.com/docs/modern-web-guidance/get-started), [GitHub](https://github.com/GoogleChrome/modern-web-guidance).

## Reddit Posts

The tone across all variants is humble and gratitude-forward: AgenticSupercharge is plumbing around great work by other people. Lead with the creators, name what's added on top, acknowledge the limits honestly.

### Where To Post (Ranked)

Stagger posts 24-48h apart. Reddit's spam filters punish simultaneous crossposting. Read each sub's rules first — some require self-promotion days or a comment-history threshold.

| Subreddit | Fit | Notes |
|---|---|---|
| [r/ClaudeAI](https://www.reddit.com/r/ClaudeAI/) | Strongest | Largest Claude community. Knows skills/MCP/Codex. Use the main post. |
| [r/ClaudeCode](https://www.reddit.com/r/ClaudeCode/) | Strongest | Smaller but laser-focused on the CLI. Use the main post. |
| [r/vibecoding](https://www.reddit.com/r/vibecoding/) | Strong | The "vibe coder" framing belongs natively here. Use the vibecoding variant. |
| [r/cursor](https://www.reddit.com/r/cursor/) | Strong | Lead with the Cursor angle. Use the Cursor variant. |
| [r/SideProject](https://www.reddit.com/r/SideProject/) | Strong | Builder-launch story works. Use the SideProject variant. |
| [r/AI_Agents](https://www.reddit.com/r/AI_Agents/) | Good | Agent-focused builders. Main post works; lean on the router. |
| [r/AnthropicAI](https://www.reddit.com/r/AnthropicAI/) | Good | Slightly more official-adjacent. Main post works. |
| [r/webdev](https://www.reddit.com/r/webdev/) | Conditional | Lead with the frontend/animation skills, not the agent angle. |
| [r/LocalLLaMA](https://www.reddit.com/r/LocalLLaMA/) | Conditional | Audience is hosted-model skeptical. Frame as "works with whichever agent you already use." |
| [r/programming](https://www.reddit.com/r/programming/) | Skip on launch | Too broad and AI-skeptical for an OSS announcement. Wait until there are stars/contributors. |
| [r/SaaS](https://www.reddit.com/r/SaaS/) | Skip | This is OSS, not SaaS. Wrong audience. |

Posting tips:
- Respond to the first 5-10 comments within the first hour. Reddit's algorithm weighs early engagement heavily.
- Expect skepticism, especially "isn't this just context bloat?" — the post pre-empts it but be ready to defend in comments with the router rules.
- Pin the GitHub link in the first comment if the sub strips URLs from post bodies (some do).
- Don't edit the title after posting; some subs auto-flag edits.

### Title Ideas (Main Post)

Best two are starred. Both signal the humble framing in the title itself, which sets the tone before anyone reads a word.

- ⭐ I packaged the Claude / Codex / Cursor skills I actually use into one installer — all credit to the original creators
- ⭐ I keep installing the same 10 community skills across Claude Code, Codex, and Cursor. I finally wrote an installer that does it for me.
- AgenticSupercharge: a non-destructive installer for the best community skills, with a router so agents pick the right one
- After collecting agent skills from GitHub for months, I built an installer that pulls them all from upstream with attribution

### Main Post (works in r/ClaudeAI, r/ClaudeCode, r/AnthropicAI, r/AI_Agents)

>
> The annoying part was the setup. Each repo lives in a different place, each coding agent wants skills in a different folder (`~/.claude/skills`, `~/.codex/skills`, `~/.gemini/skills`, `~/.gemini/config/skills`, `~/.cursor/skills`), keeping them updated is manual, and there's no good way to do it without clobbering whatever you already had.
>
> So I put together a small installer: **AgenticSupercharge**.
>
> Repo: https://github.com/radustefandumitru/AgenticSupercharge
>
> **What it actually does**
>
> - Pulls skills from their original upstream repos. Doesn't vendor them.
> - Installs into whichever coding agents it detects (Claude Code, Codex, Gemini CLI, Antigravity, Cursor) or only the ones you pick.
> - Adds one local skill called `skill-router` that tells the agent to consult it as a preflight and pick the minimum useful skill sequence instead of loading the whole pile.
> - **Non-destructive by default.** Drops a `.agentic-supercharge.json` marker in folders it manages, never touches unmarked folders unless you explicitly say so. Four conflict policies: `preserve` (default), `backup-and-replace`, `replace-managed-only`, `force`.
> - `--dry-run` actually does nothing — verified with a real audit, not just a flag check.
> - `./verify.sh` checks frontmatter, instruction markers, broken symlinks, router catalog coverage, and runtime path leakage.
> - `./update.sh` refreshes managed skills from verified pinned sources, with `--allow-upstream-drift` available if you intentionally want live upstream branches/latest packages.
>
> **Credit where it belongs.** This is plumbing around other people's work. If any of these look useful, please star/support the originals — that's the whole point.
>
> - [Taste Skill](https://github.com/Leonxlnx/taste-skill) by Leon Lin
> - [Impeccable](https://github.com/pbakaus/impeccable) by Paul Bakaus
> - [Emil Kowalski's skill](https://github.com/emilkowalski/skill) — this one alone is worth installing
> - [Agent Skills for Context Engineering](https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering) by Muratcan Koylan
> - [MarketingSkills](https://github.com/coreyhaines31/marketingskills) by Corey Haines
> - [Stop Slop](https://github.com/hardikpandya/stop-slop) by Hardik Pandya
> - [Banana Claude](https://github.com/AgriciDaniel/banana-claude) by AgriciDaniel
> - [Obsidian Skills](https://github.com/kepano/obsidian-skills) by Kepano
> - [Modern Web Guidance](https://github.com/GoogleChrome/modern-web-guidance) by Google Chrome
> - [Playwright CLI](https://github.com/microsoft/playwright-cli) by Microsoft, installed via the official installer
> - [Remotion skills](https://github.com/remotion-dev/skills) by Remotion
> - [Anthropic example skills](https://github.com/anthropics/skills) for brand guidelines, doc co-authoring, MCP building, and Slack GIF creation
> - [OpenAI Skills Catalog](https://github.com/openai/skills) for the curated `playwright` wrapper
> - [Vercel Labs Skills](https://github.com/vercel-labs/skills) / [skills.sh](https://skills.sh) for `find-skills`
> - [Awesome Claude Skills](https://github.com/ComposioHQ/awesome-claude-skills) by Composio (curated subset)
> - Global instruction templates adapted from [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills)
>
> The skills I added on top are the routing and workflow layer: `skill-router`, `clarify-and-plan`, `planning-first`, portable non-Claude `security-review`, `pre-launch-checklist`, `fluid-animations`, `emil-animation-polish`, and the `jack-*` premium 3D scroll-website workflow. The source-inspired ones are paraphrased and attributed in `THIRD_PARTY_NOTICES.md`; the installer still pulls the large third-party library from the original upstream repos.
>
> **Honest caveats** (because Reddit will ask anyway)
>
> - This only helps if the router stays selective. If your agent dumps all 120 skills into context, you'll get worse output, not better. The router exists exactly to prevent that, but it's still a learned behavior, not a guarantee.
> - No benchmarks. The bet is structural: better task-specific instructions, applied narrowly, usually improve agent behavior on those tasks. I haven't measured this against a baseline.
> - macOS-first. The detection code targets common Mac app/CLI paths. It might work on Linux but I haven't tested.
> - Default installs use verified pinned commits/package versions. You can opt into live upstream branches/latest packages with `--allow-upstream-drift`, but that is intentionally less conservative.
> - I had Claude Opus do a full security and behavior audit of the repo, then used the findings for the early remediation pass. The important supply-chain, uninstall, dry-run, and public-safety fixes are now part of the release.
>
> **Install**
>
> Preview first — writes nothing to your machine:
>
> ```bash
> npx -y github:radustefandumitru/AgenticSupercharge -- --dry-run
> ```
>
> Then for real:
>
> ```bash
> npx -y github:radustefandumitru/AgenticSupercharge
> ```
>
> Or clone the repo first if you want to read the installer code before running it (recommended for anything from a stranger on the internet):
>
> ```bash
> git clone https://github.com/radustefandumitru/AgenticSupercharge.git
> cd AgenticSupercharge
> ./install.sh --dry-run
> ./install.sh
> ./verify.sh
> ```
>
> Restart your coding agent afterward so it re-indexes the skill folders.
>
> I'd genuinely love feedback on the routing rules, especially from people who switch between multiple coding agents. If you build something with it, tag me — u/StefanDumitru.

### Variant — r/cursor

Lead with the Cursor-specific angle.

> Most Claude Code / Codex skill installers either ignore Cursor or write into the wrong folder (some try `~/.cursor/skills-cursor`, which is reserved for Cursor itself).
>
> I just published **AgenticSupercharge**, a non-destructive installer that handles Cursor correctly: `~/.cursor/skills` globally, `.cursor/skills` for project-local. Cursor auto-detect only fires if the app or CLI is actually installed, not just because a config folder exists.
>
> Same install ships across Claude Code, Codex, Gemini CLI, Antigravity, and shared `.agents` if you have any of those too.
>
>
> Repo: https://github.com/radustefandumitru/AgenticSupercharge
>
> Preview first:
>
> ```bash
> npx -y github:radustefandumitru/AgenticSupercharge -- --dry-run --scope local --project-dir .
> ```
>
> Honest caveat: only helps if your agent actually consults the included `skill-router` instead of loading every skill into context. macOS-first detection. Feedback welcome — u/StefanDumitru.

### Variant — r/SideProject

Tell the build story.

> **AgenticSupercharge** — I curated my favorite Claude/Codex/Cursor skills into one safe installer
>
>
> So I built an installer that does it for me, then ended up adding:
>
> - A `skill-router` that helps the agent pick the minimum useful skill sequence instead of overloading context
> - Non-destructive install (drops a marker in folders it owns, leaves your existing skills alone)
> - Real `--dry-run` (audited it — actually doesn't touch the filesystem)
> - `verify.sh` that checks frontmatter, markers, broken symlinks, runtime-path leakage
> - Multi-tool support: Claude Code, Codex, Gemini CLI, Antigravity, Cursor, shared `.agents`, project-local
> - Conflict policies: `preserve` / `backup-and-replace` / `replace-managed-only` / `force`
> - Full attribution to every upstream creator
>
> All credit to the original skill authors — this is just plumbing.
>
> Repo: https://github.com/radustefandumitru/AgenticSupercharge
>
> Built and iterated on using the same skills it installs, which was a fun feedback loop. macOS-first. Open to feedback and contributors.

### Variant — r/vibecoding

Lean into the identity.

>
> The annoying part is each one lives in a different repo and each tool wants them in a different folder. I built **AgenticSupercharge** to pull them all from upstream and install them safely across whichever coding agents you have. Adds a `skill-router` so your agent picks the minimum useful skill sequence instead of loading the whole pile.
>
> Full credit to the people who actually made the skills:
> - [Leon Lin / Taste Skill](https://github.com/Leonxlnx/taste-skill)
> - [Paul Bakaus / Impeccable](https://github.com/pbakaus/impeccable)
> - [Emil Kowalski](https://github.com/emilkowalski/skill)
> - [Muratcan Koylan / Context Engineering](https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering)
> - [Corey Haines / MarketingSkills](https://github.com/coreyhaines31/marketingskills)
> - [Hardik Pandya / Stop Slop](https://github.com/hardikpandya/stop-slop)
> - [Kepano / Obsidian Skills](https://github.com/kepano/obsidian-skills)
> - More in the repo
>
> Repo: https://github.com/radustefandumitru/AgenticSupercharge
>
> Preview first (writes nothing):
>
> ```
> npx -y github:radustefandumitru/AgenticSupercharge -- --dry-run
> ```
>
> Honest caveat: it only helps if the router stays selective. Throwing every skill into your agent's context will make output worse, not better. The router is there exactly to prevent that. macOS-first for now.
>
> Feedback / contributors welcome. u/StefanDumitru.

### Variant — r/webdev (frontend angle, skip the agent infrastructure)

For audiences that care about output more than tooling.

> If you use Claude Code, Cursor, or Codex for frontend work and you're tired of generic-looking output, the community skills ecosystem has gotten really good. The ones that actually changed my agent's frontend output:
>
> - [Taste Skill](https://github.com/Leonxlnx/taste-skill) by Leon Lin — visual direction, brand kits, anti-generic landing pages
> - [Impeccable](https://github.com/pbakaus/impeccable) by Paul Bakaus — spacing, typography, accessibility critique
> - [Emil Kowalski's skill](https://github.com/emilkowalski/skill) — design engineering, component feel, animation taste
> - [Google's Modern Web Guidance](https://github.com/GoogleChrome/modern-web-guidance) — current HTML/CSS/browser APIs, Baseline compatibility
>
> Setting them all up across multiple agents was annoying, so I packaged them into one installer: **AgenticSupercharge**. It also includes a `fluid-animations` skill (Apple-style direct manipulation, springs, gestures) and an `emil-animation-polish` skill (practical CSS easing/timing audits) that I wrote myself based on public material from Apple's WWDC talks and Emil's animation writing.
>
> Repo: https://github.com/radustefandumitru/AgenticSupercharge
>
> All credit to the upstream creators. macOS-first installer. Preview without writing anything:
>
> ```
> npx -y github:radustefandumitru/AgenticSupercharge -- --dry-run
> ```

## X / Twitter Thread

**Post 1**

I am giving away my personal AI coding-agent setup for free.

I built AgenticSupercharge, a portable AI skill setup for Claude Code, Codex, Gemini CLI, Antigravity, Cursor, and project-local installs.

It pulls a curated set of agent skills from upstream + installs a `skill-router` that helps the agent choose the right skill instead of loading a giant pile of context.

Repo: https://github.com/radustefandumitru/AgenticSupercharge

Feedback welcome. Tag me if you build something with it.

**Post 2**

The goal: make great community skills easy for vibe coders and busy builders to use.

There are amazing skills scattered across GitHub, Reddit, and X, but finding/installing/routing them takes time.

This setup gives you:
- installer
- dry run
- verifier
- update script for the setup itself, managed skills, or all matching skills with backups from verified pinned sources
- non-destructive default conflict policy
- Cursor support
- local/global install modes
- skill summary
- router rules

**Post 3**

The design stack is opinionated:

- Taste Skill for anti-generic visual direction
- Emil Kowalski's skill for motion/easing/component feel, plus a local public-safe Emil Animation Polish companion for practical transition/easing audits
- Modern Web Guidance for current browser APIs
- Playwright for screenshots/validation
- Impeccable for final polish, with feedback before broad hierarchy/font changes

**Post 4**

It also routes:

- Context Engineering for token/context/memory issues
- MarketingSkills for SEO/CRO/copy/ads/launch/pricing
- Stop Slop for human-sounding writing
- Kepano's Obsidian skills for vault workflows
- Banana Claude for images
- Remotion for video

**Post 5**

Important: I did not create the underlying skills.


Please star/support the originals.

**Post 6**

Install:

```bash
git clone https://github.com/radustefandumitru/AgenticSupercharge.git
cd AgenticSupercharge
./install.sh --dry-run
./install.sh
./verify.sh
```

Or with GitHub `npx`:

```bash
npx -y github:radustefandumitru/AgenticSupercharge -- --dry-run
npx -y github:radustefandumitru/AgenticSupercharge
```

Then restart Claude Code, Codex, Gemini CLI, Antigravity, or Cursor.

External actions are approval-gated. Obsidian vault edits should use snapshots/git.

It passed my local verification checks, but review scripts before running any installer from the internet.

**Short single-post version**

I am giving away my personal AI coding-agent setup for free.

I built AgenticSupercharge, a portable AI skill setup for Claude Code, Codex, Gemini CLI, Antigravity, Cursor, and local project installs.

It pulls a curated set of high-quality skills from upstream plus a `skill-router` so agents choose the right skill without loading unnecessary context.


All credit to the original creators. This is an installer/router to make discovery easier for builders.

Repo: https://github.com/radustefandumitru/AgenticSupercharge

Feedback: u/StefanDumitru
