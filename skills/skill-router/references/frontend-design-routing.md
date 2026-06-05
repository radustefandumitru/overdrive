# Frontend and Design Routing

This guide resolves conflicts between the installed design and frontend skills. The user's preference is explicit: community design skills should outrank generic design defaults because they produce less AI-looking output. Taste and Emil are normal defaults for visual frontend work; Impeccable is usually the final polish/audit pass with a user-feedback gate for broad hierarchy/font changes.

## Priority Stack

1. User-named skill or style.
2. Exact medium skill: image generation, brand kit, Stitch export, Remotion, Chrome extension, browser automation.
3. Community design defaults: Taste skills for visual direction, `emil-design-eng` for motion/feel, `emil-animation-polish` for practical web animation details, and `fluid-animations` for tactile spring/gesture systems.
4. End-of-development polish: `impeccable`, with feedback before broad font/hierarchy/identity changes.
5. Implementation support: `modern-web-guidance`, `playwright-cli`.
6. Narrow style modifiers: `minimalist-ui`, `industrial-brutalist-ui`, `high-end-visual-design`.
7. Anthropic/Claude `frontend-design` fallback if the community stack fails or the user rejects the direction.

## Primary Design Choices

| Situation | Primary skill | Add-on skills | Why |
|---|---|---|---|
| Any frontend or product UI with visual judgment | `design-taste-frontend` | `emil-design-eng`, `modern-web-guidance`, `playwright-cli` | Taste is the default anti-slop visual direction family and should be preferred over generic design defaults. |
| Buttons, hover/focus states, transitions, modals, menus, animation, UI feel | `emil-design-eng` | Taste skill for layout/style, `modern-web-guidance` for platform APIs | Emil's skill is the default for motion, easing, responsiveness, component feel, and details that stop UI feeling static. |
| CSS transitions, custom easing, duration tuning, press states, hover/touch behavior, tooltip timing, origin-aware popovers, or smooth animation audits | `emil-animation-polish` | `emil-design-eng`, `modern-web-guidance`, `playwright-cli` | Narrow implementation companion for Emil-style web animation polish; use when the task is specifically about making transitions feel smoother or less sluggish. |
| Gesture-driven, spring-based, interruptible, rubberbanded, snap-point, drag/swipe, route-transition, or Apple-like tactile motion | `fluid-animations` | `emil-design-eng`, `modern-web-guidance`, `playwright-cli` | Fluid Animations turns Apple's direct-manipulation principles into implementation rules: instant response, retargetable springs, velocity carry-through, projection, soft boundaries, and spatial consistency. |
| Liquid Glass, frosted glass, translucent UI, lens/refraction, SVG displacement, or WebGL glass | `liquid-glass-web` | `emil-animation-polish`, `fluid-animations`, `design-taste-frontend`, `modern-web-guidance`, `playwright-cli` | Choose Tier 1 universal frosted glass by default; enhance to Chromium SVG displacement or WebGL only when browser targets and performance justify it. |
| Product-design layer reasoning, conceptual model, domain vocabulary, or interaction flow before UI implementation | `layers-intro` -> narrow `layers-*` skill | `clarify-and-plan` only for ambiguous process; frontend skills only after product decisions are clear | Layers handles product-design substance; do not confuse it with visual polish or implementation planning. |
| End-of-development polish, audit, spacing, typography, critique, anti-pattern removal | `impeccable` | `playwright-cli` for visual verification | Use after the main implementation. Ask for user feedback before broad font, hierarchy, or identity changes unless the user asked the agent to decide. |
| Premium landing page or greenfield web surface with strong visual direction | `design-taste-frontend` or `gpt-taste` | `emil-design-eng`, `impeccable` after feedback, `modern-web-guidance` | Taste pulls the work away from generic AI-looking websites; Emil gives the interactions life. |
| Jack Roberts inspired 3D/scroll website workflow | `jack-premium-site-system` | `jack-website-intelligence`, `jack-scroll-asset-prompts`, `jack-scroll-3d-sites`, `jack-seo-launch-audit`, `design-taste-frontend`, `emil-design-eng`, `modern-web-guidance`, `playwright-cli` | Use the Jack skills for the workflow spine, then the existing design/web stack for taste, implementation correctness, and browser proof. |
| Scroll-stopping assembled/exploded asset prompts | `jack-scroll-asset-prompts` | `banana`, `brandkit`, `imagegen-frontend-web` | Use for coordinated start frame, end frame, and transition prompts before generating image/video assets. |
| Scroll-linked video/frame-sequence implementation | `jack-scroll-3d-sites` | `emil-animation-polish`, `fluid-animations`, `modern-web-guidance`, `playwright-cli` | Use for FFmpeg frame extraction, canvas/video scrub, GSAP/Framer Motion scroll sections, and responsive verification. |
| Codex/GPT-heavy frontend task needing stricter layout/motion enforcement | `gpt-taste` | `emil-design-eng`, `playwright-cli` | Stronger variance, motion, and layout constraints are useful when default model taste drifts generic. |
| Existing site/app needs visual upgrade without breaking behavior | `redesign-existing-projects` | `design-taste-frontend`, `emil-design-eng`, `impeccable` after feedback, `playwright-cli` | Starts from current implementation and audits before changing design. |
| Image-first website design before coding | `image-to-code` | `imagegen-frontend-web`, `impeccable` | Use when generated visual references should drive implementation. |
| Website section reference images only | `imagegen-frontend-web` | `brandkit` if identity is missing | Produces separate high-quality section references rather than code. |
| Mobile app screen concepts/images only | `imagegen-frontend-mobile` | `impeccable` later for implementation critique | Designed for mobile screen concepts and flows, not code. |
| Brand identity, logo directions, visual-world boards | `brandkit` | `imagegen-frontend-web` for landing refs | Use before page design when identity is undefined. |
| Google Stitch DESIGN.md export | `stitch-design-taste` | `impeccable document` if project design context exists | Generates Stitch-compatible semantic design rules. |
| Modern CSS/HTML/browser feature implementation | `modern-web-guidance` | Pair with design skill when visual decisions also matter | Chrome's guidance is best for current web APIs, Baseline, accessibility, performance, forms, dialogs, popovers. |
| Real UI validation, screenshots, browser snapshots, flows | `playwright-cli` | Any design skill whose result needs verification | Use after implementation or during debugging. |

## Style Modifier Skills

- Use `minimalist-ui` only when the user wants restrained editorial product UI, warm monochrome palettes, flat bento grids, and no heavy effects.
- Use `industrial-brutalist-ui` only when the user wants a raw mechanical, Swiss/military-terminal, blueprint-like direction.
- Use `high-end-visual-design` as a fallback design-quality booster or for agency-grade heuristics, but do not put it ahead of Taste or Emil for normal visual decisions.

## Combination Recipes

- Premium landing page: `design-taste-frontend` -> `emil-design-eng` -> `emil-animation-polish` for transition/easing details -> `fluid-animations` when interactions are gesture-like -> `modern-web-guidance` -> `playwright-cli`; use `impeccable` after user feedback for final polish.
- Jack Roberts style 3D scroll site: `jack-premium-site-system` -> `jack-website-intelligence` -> `jack-scroll-asset-prompts` -> `jack-scroll-3d-sites` -> `jack-seo-launch-audit`; add `design-taste-frontend`, `emil-design-eng`, `modern-web-guidance`, and `playwright-cli` at the implementation/validation stages.
- Existing dashboard polish: `design-taste-frontend` or `redesign-existing-projects` -> `emil-design-eng` -> `emil-animation-polish` for sluggish transitions -> `fluid-animations` for tactile motion fixes -> `playwright-cli`; use `impeccable` for final spacing/typography audit and ask before broad hierarchy/font changes.
- Image-first marketing page: `imagegen-frontend-web` or `image-to-code` -> `emil-design-eng` -> `emil-animation-polish` for entrance/hover detail -> `fluid-animations` if gestures/transitions are part of the build -> `playwright-cli`; use `impeccable` after feedback.
- Brandless new product: `brandkit` -> `imagegen-frontend-web` -> `design-taste-frontend` -> `emil-design-eng`.
- Modern modal/popover/form work: `design-taste-frontend` for visual direction -> `emil-design-eng` for feel -> `emil-animation-polish` for easing/origin/transition details -> `fluid-animations` for spring/gesture behavior -> `modern-web-guidance` for platform APIs -> `playwright-cli`.
- Liquid Glass component: `liquid-glass-web` -> `emil-animation-polish` for transitions -> `modern-web-guidance` for browser support -> `playwright-cli`; add `design-taste-frontend` or `impeccable` if contrast, hierarchy, or visual restraint needs work.
- Product concept before UI: `layers-intro` -> `layers-orient` or the narrow layer skill -> `design-taste-frontend` only after the product/design layer decision is clear.

## Source Notes

- Taste Skill: https://www.tasteskill.dev and https://github.com/Leonxlnx/taste-skill. Positions the family as portable anti-slop frontend guidance, with variants for all-rounder frontend work, GPT/Codex strictness, image-first workflows, redesigns, brand kits, and visual styles.
- Impeccable: https://impeccable.style/docs/ and https://github.com/pbakaus/impeccable. One comprehensive frontend design skill with a command vocabulary for create/evaluate/refine/simplify/harden/system work, project teaching/documenting, and deterministic anti-pattern scanning.
- Emil Kowalski: https://emilkowal.ski/skill, https://animations.dev, and https://github.com/emilkowalski/skill. Best treated case-by-case for design engineering, animations, code, performance, motion decisions, component design, and subtle details that make software feel good.
- Emil Animation Polish: local skill based on paraphrased guidance from Emil Kowalski's public animation/taste writing and lessons at https://animations.dev and https://emilkowal.ski/ui. Best for CSS transition polish, easing, duration, press states, hover/touch behavior, tooltip timing, and origin-aware popovers.
- Fluid Animations: local skill based on paraphrased principles from Apple Developer WWDC 2018 Session 803, "Designing Fluid Interfaces" (https://developer.apple.com/videos/play/wwdc2018/803/). Best for spring systems, gesture velocity, momentum projection, rubberbanding, interruption, spatial consistency, and reduced-motion-safe tactile UI.
- Modern Web Guidance: https://developer.chrome.com/docs/modern-web-guidance/get-started. Maintained by the Chrome team and focused on current web platform APIs, Baseline-aware choices, accessibility, performance, forms, dialogs, popovers, and progressive enhancement.
- Playwright skills: https://playwright.dev/agent-cli/skills. Use for real-browser validation and debugging; the Playwright skill is portable to any coding agent that supports locally installed skills, not Codex-only.
- Jack Roberts premium 3D website workflow: public-safe local synthesis based on Jack Roberts' YouTube video at https://www.youtube.com/watch?v=TZUTe7s11-I and linked Skool page at https://www.skool.com/aiautomationsbyjack/about?ref=d4618abaabee44c7ac3c146938a72100&el=youtube_description_paid. Use the local Jack skills for brand/competitor intelligence, scroll-stop asset prompts, scroll-driven implementation, SEO/launch readiness, and orchestration. Do not redistribute Jack's raw PDFs, zips, templates, prompts, or downloaded skill text in public bundles unless redistribution rights are reviewed.
- Liquid Glass Web: original local Overdrive skill inspired by Andrew Prifer's liquid-dom work, kube.io's CSS/SVG Liquid Glass technique, and optional license-checked WebGL libraries such as https://github.com/naughtyduk/liquidGL. Do not vendor third-party code without license review.
- Layers of Product Design: https://github.com/jamiemill/layers-skills by Jamie Mill / @jamiemill. Use for product-design layer reasoning: observed behaviour, domain, user needs, product strategy, conceptual model, interaction flow, and surface decisions.
