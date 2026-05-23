# Social Post Drafts

Replace `YOUR_GITHUB_URL` with the published repo URL before posting.

## Creator Credits

Use GitHub links for the canonical source. Only include Reddit usernames when they were visible in source material; do not guess.

- Taste Skill by Leon Lin / LeonxInx: [GitHub](https://github.com/Leonxlnx/taste-skill), [site](https://www.tasteskill.dev), X: [@LexnLin](https://x.com/LexnLin), project X: [@_TasteSkill](https://x.com/_TasteSkill). No reliable Reddit username found.
- Impeccable by Paul Bakaus: [GitHub](https://github.com/pbakaus/impeccable), [docs](https://impeccable.style/docs/), X: [@pbakaus](https://x.com/pbakaus). No reliable Reddit username found.
- Emil Kowalski skill: [GitHub](https://github.com/emilkowalski/skill), [site](https://emilkowal.ski/skill), [animations.dev](https://animations.dev), X: [@emilkowalski](https://x.com/emilkowalski). No reliable Reddit username found.
- GSD by Lex Christopherson / TACHES: [GitHub](https://github.com/gsd-build/get-shit-done), legacy GitHub: [@glittercowboy](https://github.com/glittercowboy), [site](https://gsd.build), Reddit: [u/officialtaches](https://www.reddit.com/user/officialtaches/), X: [@official_taches](https://x.com/official_taches).
- Agent Skills for Context Engineering by Muratcan Koylan: [GitHub](https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering). No reliable Reddit/X account found beyond GitHub.
- MarketingSkills by Corey Haines: [GitHub](https://github.com/coreyhaines31/marketingskills), GitHub profile lists X: [@coreyhainesco](https://x.com/coreyhainesco). No reliable Reddit username found.
- Stop Slop by Hardik Pandya: [GitHub](https://github.com/hardikpandya/stop-slop), site from skill metadata: [hvpandya.com](https://hvpandya.com). No reliable Reddit/X account found.
- Banana Claude by AgriciDaniel: [GitHub](https://github.com/AgriciDaniel/banana-claude). No reliable Reddit/X account found.
- Obsidian Skills by Steph Ango / Kepano: [GitHub](https://github.com/kepano/obsidian-skills), Reddit: [u/kepano](https://www.reddit.com/user/kepano/), X: [@kepano](https://x.com/kepano).
- Composio Awesome Claude Skills: [GitHub](https://github.com/ComposioHQ/awesome-claude-skills), [site](https://composio.dev).
- Remotion Skills: [GitHub](https://github.com/remotion-dev/skills), [site](https://www.remotion.dev).
- Playwright CLI skill: [docs](https://playwright.dev/agent-cli/skills), [GitHub](https://github.com/microsoft/playwright-cli).
- Google Modern Web Guidance: [docs](https://developer.chrome.com/docs/modern-web-guidance/get-started), [GitHub](https://github.com/GoogleChrome/modern-web-guidance).

## Reddit Post

**Title ideas**

- I made AgenticSupercharge: a Skill Router + installer for Claude Code, Codex, Gemini, Antigravity, and Cursor
- Curated AI agent skills setup for vibe coders, with a router so agents pick the right skill
- I made an upstream-pulling agent skill installer/router, with full credit to the original creators

**Post**

I kept seeing great Claude/Codex/agent skills scattered across GitHub, Reddit, and X, but the setup was messy if you are not already deep in the skills ecosystem.

So I put together AgenticSupercharge: a portable installer + `skill-router` that pulls a curated set of skills from the original upstream repos/installers into Claude Code, Codex, Gemini CLI, Antigravity, Cursor, project-local roots, and shared `.agents`.

Repo: YOUR_GITHUB_URL

What it does:

- Installs a curated set of high-quality agent skills into detected or selected coding-agent roots from upstream sources.
- Supports local project installs and global machine installs.
- Uses a non-destructive conflict policy by default, with marker files for AgenticSupercharge-managed skills.
- Adds a `skill-router` skill that tells the agent which skill to use when multiple skills could apply.
- Keeps context bloat down by routing to 1-3 relevant skills instead of loading everything.
- Adds guardrails: external app actions require approval, Obsidian vault edits should use snapshots/git, and Impeccable should ask before broad font/hierarchy changes.
- Includes `install.sh --dry-run`, `verify.sh`, `update.sh`, a lockfile, `.gitignore` for private bundled snapshots, and a human-readable skills summary.

The rough routing logic:

- Frontend/design: Taste Skill for visual direction, Emil Kowalski's skill plus local Emil Animation Polish for motion/component feel and transition/easing details, Modern Web Guidance for current browser APIs, Playwright for validation, Impeccable at the end for polish.
- Project planning: GSD via its official installer for planning/execution/verification, Context Engineering skills when context/token/memory/tool boundaries are the problem.
- Marketing: Corey Haines' MarketingSkills for SEO/CRO/copy/ads/launch/pricing, Stop Slop as a final human-sounding voice pass.
- Notes/knowledge: Kepano's Obsidian skills for Markdown, Bases, JSON Canvas, CLI, and Defuddle.
- Images/video: Banana Claude for images where configured, Remotion for programmatic video.
- External actions: Composio/connect skills, but approval-gated.

Credit where it belongs: I did not create the underlying skills. This is a curated installer/router around excellent work by:

- Leon Lin / LeonxInx: Taste Skill
- Paul Bakaus: Impeccable
- Emil Kowalski: design-engineering skill
- Lex Christopherson / TACHES / gsd-build: GSD
- Muratcan Koylan: Agent Skills for Context Engineering
- Corey Haines: MarketingSkills
- Hardik Pandya: Stop Slop
- AgriciDaniel: Banana Claude
- Kepano / `u/kepano`: Obsidian Skills
- ComposioHQ: Awesome Claude Skills
- Remotion, Playwright, and Chrome/Modern Web Guidance teams

Please star/support the original repos if you use this. My goal is not to take credit for the skills, but to make discovery, installation, updating, and routing easier for vibe coders/builders who do not have time to research every individual skill.

Install flow:

```bash
git clone YOUR_GITHUB_URL
cd AgenticSupercharge
./install.sh --dry-run
./install.sh
./verify.sh
```

GitHub `npx` after publishing:

```bash
npx -y github:radustefandumitru/AgenticSupercharge -- --dry-run
npx -y github:radustefandumitru/AgenticSupercharge
```

Then restart Claude Code, Codex, Gemini CLI, Antigravity, or Cursor.

I would love feedback on the routing rules, especially from people using multiple agents/IDEs together.

## X / Twitter Thread

**Post 1**

I built AgenticSupercharge, a portable AI skill setup for Claude Code, Codex, Gemini CLI, Antigravity, Cursor, and project-local installs.

It pulls a curated set of agent skills from upstream + installs a `skill-router` that helps the agent choose the right skill instead of loading a giant pile of context.

Repo: YOUR_GITHUB_URL

**Post 2**

The goal: make great community skills easy for vibe coders and busy builders to use.

There are amazing skills scattered across GitHub, Reddit, and X, but finding/installing/routing them takes time.

This setup gives you:
- installer
- dry run
- verifier
- update script for previously managed skills
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

- GSD through its official installer for planning/execution/verification
- Context Engineering for token/context/memory issues
- MarketingSkills for SEO/CRO/copy/ads/launch/pricing
- Stop Slop for human-sounding writing
- Kepano's Obsidian skills for vault workflows
- Banana Claude for images
- Remotion for video

**Post 5**

Important: I did not create the underlying skills.

This is a curated installer + router around great work by Leon Lin/LeonxInx, Paul Bakaus, Emil Kowalski, Lex Christopherson/TACHES/gsd-build, Muratcan Koylan, Corey Haines, Hardik Pandya, AgriciDaniel, Steph Ango/Kepano, ComposioHQ, Remotion, Playwright, and Chrome's Modern Web Guidance team.

Please star/support the originals.

**Post 6**

Install:

```bash
git clone YOUR_GITHUB_URL
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

**Short single-post version**

I built AgenticSupercharge, a portable AI skill setup for Claude Code, Codex, Gemini CLI, Antigravity, Cursor, and local project installs.

It pulls a curated set of high-quality skills from upstream plus a `skill-router` so agents choose the right skill without loading unnecessary context.

Includes Taste, Impeccable, Emil, GSD, Context Engineering, MarketingSkills, Stop Slop, Banana Claude, Obsidian Skills, Remotion, Playwright, and more.

All credit to the original creators. This is an installer/router to make discovery easier for builders.

Repo: YOUR_GITHUB_URL
