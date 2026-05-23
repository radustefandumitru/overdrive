---
name: jack-premium-site-system
description: >
  Orchestrate a Jack Roberts inspired premium 3D/scroll website workflow from brand
  and purpose through asset prompting, scroll-driven 3D implementation, SEO polish,
  and optional launch. Use when the user asks to build, redesign, pitch, or publish
  a premium animated website, 3D scroll site, scroll-stopping landing page, AI-built
  client website, AntiGravity-style site, or "Jack Roberts" website system. Route to
  the narrower Jack skills when only one part is needed.
---

# Jack Premium Site System

Use this skill as the top-level playbook for premium AI-assisted websites inspired by Jack Roberts' public teaching on 3D scroll-based client websites.

Source attribution: this workflow is a public-safe synthesis of Jack Roberts' YouTube video at https://www.youtube.com/watch?v=TZUTe7s11-I and his linked Skool page at https://www.skool.com/aiautomationsbyjack/about?ref=d4618abaabee44c7ac3c146938a72100&el=youtube_description_paid. Do not copy or redistribute Jack's raw PDFs, zips, templates, prompts, or downloaded skill text unless the user has reviewed redistribution rights.

## When To Use

- The user wants an end-to-end premium website workflow, not only an animation or SEO audit.
- The user wants to pitch a redesigned site to a business or create a client-facing demo.
- The request includes brand extraction, competitor research, scroll-based visual assets, SEO, GitHub/Vercel, or publishing.
- The user says "Jack Roberts", "3D scroll website", "scroll-stopping website", "premium AI website", or "AntiGravity website".

If the request is narrow, use a narrower skill instead:

- `jack-website-intelligence` for brand/competitor research and build brief.
- `jack-scroll-asset-prompts` for image/video prompt sets.
- `jack-scroll-3d-sites` for frame-sequence or video-on-scroll implementation.
- `jack-seo-launch-audit` for SEO, metadata, structured data, and launch checks.

## Pair With Existing Skills

- `design-taste-frontend` for anti-generic visual direction.
- `emil-design-eng` and `emil-animation-polish` for interaction feel, easing, and transitions.
- `fluid-animations` for direct-manipulation, spring, snap, velocity, or tactile scroll/gesture behavior.
- `modern-web-guidance` plus Context7 for current Next.js, HTML/CSS, GSAP, Framer Motion, Three.js, Vercel, or platform docs.
- `playwright-cli` for screenshots, responsive checks, and real-browser verification.
- `seo-audit`, `schema`, `site-architecture`, or `ai-seo` when deeper SEO specialization is needed.

## Public-Safe Operating Rules

- Treat Firecrawl, GitHub, Vercel, browser connectors, and image/video generators as optional tools. Do not assume they exist.
- Keep Context7 as the only public-standard MCP recommendation.
- Never request, print, commit, zip, or screenshot API keys, OAuth tokens, MCP secrets, browser profiles, or account sessions.
- Ask before remote side effects: creating repos, deploying, buying domains, sending emails, charging credits, or publishing.
- Use a client's existing site for structure, brand cues, and content understanding, not for close visual copying.
- Do not invent testimonials, reviews, certifications, pricing, or claims. Mark placeholders clearly when real data is missing.
- Verify reduced-motion, mobile layout, performance, accessibility, and responsive text before calling the work done.

## Workflow

1. Define the commercial goal.
   - Identify the brand, audience, offer, primary CTA, desired conversion, and what "premium" should mean for this business.
   - If this is for a real client, confirm the user has rights to use the brand assets and public content.

2. Run website intelligence.
   - Use `jack-website-intelligence` to extract brand cues, summarize the current site, inspect competitors, and produce a build brief.
   - Stop for user approval before implementation if the brief changes positioning, copy, or page structure.

3. Create scroll-stop visual asset prompts.
   - Use `jack-scroll-asset-prompts` to produce a coordinated start frame, end frame, and transition prompt.
   - Prefer clean backgrounds, stable camera angle, consistent lighting, and generous object margins for downstream animation.

4. Build the scroll-driven experience.
   - Use `jack-scroll-3d-sites` to implement either a video-controlled scroll section or an extracted frame-sequence canvas.
   - Choose the stack that fits the project: vanilla HTML/CSS/JS for portable demos, or Next.js/React when the app already uses it.

5. Extend pages and SEO.
   - Use `jack-seo-launch-audit` to add page metadata, structured data, social previews, sitemap/robots guidance, internal links, and an SEO report.
   - Add marketing skills only when the request needs deeper keyword, CRO, content, or positioning work.

6. Validate and optionally launch.
   - Run local checks, browser screenshots, mobile/responsive checks, and performance sanity checks.
   - Only deploy through GitHub, Vercel, or another host after explicit user approval and with their configured credentials.

## Default Deliverables

For end-to-end tasks, produce:

- `research/01-brand-snapshot.md`
- `research/02-competitor-analysis.md`
- `research/03-build-brief.md`
- asset prompt set or links to generated assets
- implemented local website
- SEO/launch audit report
- clear notes on optional external setup still required

Keep deliverables proportional. For quick demos, make a compact version instead of a full agency report.
