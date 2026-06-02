# Routing Trace Examples

These examples are for maintainers checking whether `skill-router` remains selective as the catalog grows. The router should pick the minimum sufficient skill sequence, then load only the chosen skill bodies. Complex tasks can use more skills when they are phased and each skill has a clear job.

| Prompt | Expected route | Why |
|---|---|---|
| "Build me a premium Next.js landing page with smooth animation." | `design-taste-frontend` -> `emil-design-eng` -> `playwright-cli` | Frontend quality is the main task; browser validation proves the result. |
| "This product drawer should feel physical when I drag and release it." | `fluid-animations` -> `emil-design-eng` | Gesture velocity, springs, interruption, and snap behavior are fluid-animation territory. |
| "This popover animation feels sluggish." | `emil-animation-polish` -> `emil-design-eng` | Practical easing, duration, hover/touch, and origin-aware polish. |
| "Help me figure out which design layer this product problem lives at." | `layers-intro` -> `layers-orient` | Layers orientation diagnoses the product-design layer before picking implementation or visual skills. |
| "Model the objects and states for this scheduling tool." | `layers-intro` -> `layers-conceptual-model` | Object/state/vocabulary decisions are conceptual-model work, not generic planning or visual polish. |
| "Create a cross-browser Liquid Glass navbar." | `liquid-glass-web` -> `emil-animation-polish` -> `playwright-cli` | The skill chooses the glass tier and fallbacks; Emil handles motion polish and Playwright proves browser behavior. |
| "Virtualize 100k differently-sized text rows without DOM reflow." | `pretext` | Text measurement/layout performance is the core task; design polish is secondary unless requested. |
| "Make chat bubbles shrinkwrap multiline text without layout thrash." | `pretext` -> `playwright-cli` if browser verification is needed | Pretext handles text measurement; browser proof is useful when visual precision matters. |
| "Refactor this auth flow across the app, but first tell me the safest plan." | `clarify-and-plan` -> `planning-first` -> `security-review` if auth risk is material | Ambiguous multi-file work needs assumptions and phases before implementation; auth may need a security pass. |
| "Security review this PR for vulnerabilities." | Claude Code: native `/security-review`; other agents: `security-review` | Avoid loading both the native command and the portable skill. |
| "Make sure Claude warns me about dangerous generated code and commit diffs." | Claude Code: `security-guidance` plugin; other agents: `security-review` only for explicit audits | `security-guidance` is a Claude-only preventative hook/plugin layer, not a portable skill folder. |
| "What has the React community been saying about server components in the last 30 days?" | `last30days` | Time-boxed community/recent sentiment research. |
| "What are Reddit users saying about this product category?" | `reddit-research` -> `last30days` if recency matters | Reddit is explicitly in scope; keep it low-volume and public-read-only. |
| "Read this PDF and spreadsheet, then summarize the useful bits." | `convert-to-markdown` | Convert local documents to Markdown first when that reduces tokens and preserves structure. |
| "Run React doctor and fix the highest-risk code quality issues." | `react-doctor` | React-specific diagnostics and cleanup should stay scoped to React code health. |
| "What should I consider before changing this auth architecture?" | `what-should-i-consider` | The user wants hidden assumptions, risks, and missing decisions before implementation. |
| "Design a questionnaire onboarding flow for my subscription app." | `app-onboarding-questionnaire` -> design/frontend skill only after strategy | The onboarding sequence comes before implementation polish. |
| "Run a launch checklist before I ship this SaaS." | `pre-launch-checklist` -> `security-review` or marketing skills only if needed | Broad product/business launch readiness, not just SEO. |
| "SEO audit this 3D scroll website before Vercel." | `jack-seo-launch-audit` -> `playwright-cli` | Animated-site SEO/performance launch checks fit the Jack workflow. |
| "Find me a new skill for React performance work." | `find-skills` | Skill discovery is different from routing among installed skills. |
| "Create a JSON Canvas map for these project ideas." | `json-canvas` | The retained Obsidian-adjacent skill is canvas-specific and file-based. |
| "Download this video as an MP3." | `media-download` | User-requested local media extraction maps to the yt-dlp wrapper. |
| "This thread is huge, compact it into a handoff." | `context-compression` | User explicitly requested compaction, so the lossy step is approved. |

## AS-Workflow Route Trace

When `.agenticsupercharge/` exists and the runtime command is available, keep route traces terse:

```bash
agentic-supercharge route --skills "planning-first,design-taste-frontend,playwright-cli" --reason "multi-file UI implementation with browser validation"
```

This appends one JSONL entry to `.agenticsupercharge/routes.jsonl`. It is optional and should never block the task.

## Collision Notes

- `clarify-and-plan` answers "what should we do and what are the options?" while `planning-first` answers "how do we execute this complex coding task safely?"
- `pre-launch-checklist` is for product and operational launch readiness. `jack-seo-launch-audit` is for technical/SEO launch checks on animated premium websites.
- `last30days` is for recent community discourse. Context7 is still the default for current official library/API documentation.
- `reddit-research` is for Reddit-specific public community signal. `last30days` is broader recent sentiment.
- `convert-to-markdown` is for local documents and AS-Workflow knowledge-vault ingest. `defuddle` remains the better fit for web-page extraction.
- `pretext` is for text measurement/layout engineering and reflow avoidance. Use visual/frontend design skills when the problem is hierarchy, typography taste, brand, or UI polish.
