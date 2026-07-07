# Skills TL;DR

Use this as the quick map. `SKILLS_SUMMARY.md` remains the deep reference.

Overdrive v1 keeps the v0.12 skill set at 137 unique skills, but rebrands the system around `overdrive`, `ovd`, `ovd-workflow`, `.overdrive/`, and `OVERDRIVE_WORKFLOW`. The installer may attempt safe non-privileged setup for Graphify, `yt-dlp`, `ffmpeg`, and Design Extract browser support. Use `--no-tool-install` to skip helper setup.

| Goal | Start With | Add When Needed |
|---|---|---|
| Ambiguous or broad task | `clarify-and-plan` | domain skill after assumptions/options are clear |
| Complex multi-file coding work | `planning-first` | `clarify-and-plan` first if the task is vague; Claude Code can use `/model opusplan` or `/ultraplan` |
| Write or improve a prompt | `prompt-master` | `clarify-and-plan` only if the underlying project requirements are unclear |
| Pressure-test a plan | `what-should-i-consider` | `security-review` for auth/security risk; `clarify-and-plan` if options need shaping |
| Product-design layer reasoning | `layers-intro` | `layers-orient` if focus is unclear; then the narrow `layers-*` skill |
| Security review or hardening | Claude Code `/security-review`, otherwise `security-review` | dependency scanners, tests, or manual verification for fixes |
| React code diagnostics | `react-doctor` | `planning-first` for larger refactors; `playwright-cli` for UI validation |
| Recent market/community research | `last30days` | Context7 or official docs for library/API facts |
| Reddit community signal | `reddit-research` | `last30days` for recency; customer-research/content strategy for synthesis |
| Local PDF/Office/data docs | `convert-to-markdown` | ovd-workflow knowledge vault; `defuddle` for web pages |
| Codebase or mixed-corpus relationship mapping | `graphify` | Normal `rg`/file reads if Graphify is unavailable; ovd-workflow knowledge vault for project memory/reference docs |
| Existing text sounds AI-written | `humanizer` | `stop-slop` for broader public-prose AI-tell cleanup |
| App questionnaire onboarding | `app-onboarding-questionnaire` | frontend/design skills after the onboarding blueprint is confirmed |
| Pre-launch readiness | `pre-launch-checklist` | `security-review`, marketing skills, `jack-seo-launch-audit`, or `playwright-cli` for focused checks |
| Premium frontend or landing page | `skill-router`, `design-taste-frontend`, `emil-design-eng` | `impeccable`, `modern-web-guidance`, `playwright-cli` |
| Extract a site's design language | `design-extract` | `design-taste-frontend`, `impeccable`, `emil-design-eng` after extraction |
| Smooth web animation | `emil-animation-polish` | `fluid-animations` for gesture, spring, velocity, rubberbanding, or direct-manipulation work |
| Liquid/frosted glass UI | `liquid-glass-web` | `emil-animation-polish`, `modern-web-guidance`, `playwright-cli` for motion, support, and validation |
| Advanced text measurement/layout | `pretext` | `playwright-cli` for browser verification; frontend design skills only if visual polish is also requested |
| Jack Roberts style 3D/scroll site | `jack-premium-site-system` | `jack-website-intelligence`, `jack-scroll-asset-prompts`, `jack-scroll-3d-sites`, `jack-seo-launch-audit` |
| SEO, launch, copy, CRO | Corey Haines MarketingSkills | `stop-slop` for final human voice polish |
| Brand-specific artifacts | `brand-guidelines` | `brandkit` for new visual identity boards; `impeccable` for final polish |
| MCP server development | `mcp-builder` | Context7/current MCP SDK docs when implementation details matter |
| Current docs or APIs | Context7 guidance in global instructions | `modern-web-guidance` for browser/platform decisions |
| Browser validation | `playwright-cli` | OpenAI `playwright` wrapper as fallback; screenshots, snapshots, responsive checks, UI flow checks |
| Discover more skills | `find-skills` | only when the user asks to find, compare, or install additional skills |
| Context or token efficiency | `context-optimization` | `context-compression` only after user approval; ovd-workflow preferences/knowledge files when local project memory helps |
| Runtime context behavior | native runtime commands | see `docs/context-runtime-matrix.md`; do not assume Claude-only context levers work everywhere |
| Obsidian-adjacent files/research | `json-canvas`, `defuddle` | broader vault operations need a dedicated user/project Obsidian setup |
| Image/video/media workflows | `banana`, Remotion skills, `media-download` | approval-gated external tools where configured; `yt-dlp` for downloads |
| Video or screen-recording comprehension | `claude-video` | `media-download` only when the task is downloading/extracting media |
| Slack GIF or emoji animation | `slack-gif-creator` | Banana/image tooling only if a custom source image is needed |
| Project memory and handoff | ovd-workflow (`.overdrive/`) | `overdrive status`, `doctor`, `resync`, `knowledge`, `usage`, `checkpoint`; not a routed skill |

The intended pattern is not "load everything." Let `skill-router` choose the minimum useful skill sequence, then proceed. Complex tasks can use more skills when they are phased and each one has a clear job.
