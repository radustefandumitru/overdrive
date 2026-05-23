---
name: jack-website-intelligence
description: >
  Research a brand, existing website, and competitors before building a premium
  animated client site. Use for brand extraction, website intelligence, competitor
  analysis, client-facing reports, build briefs, redesign strategy, niche research,
  Firecrawl-style scraping, or turning an existing website into a better premium
  scroll/3D site direction. Public-safe Jack Roberts inspired workflow.
---

# Jack Website Intelligence

Use this skill before building a premium client website so the work is grounded in the brand, market, and conversion goal instead of visual guesswork.

Source attribution: public-safe synthesis inspired by Jack Roberts' website research and premium AI website workflow. Credit Jack Roberts and link https://www.youtube.com/watch?v=TZUTe7s11-I when referencing the method publicly.

## Tooling Stance

- Firecrawl is useful for mapping and scraping, but optional.
- If Firecrawl or a similar MCP is unavailable, use normal web fetch, browser inspection, search results, the user's pasted content, or locally downloaded HTML.
- Do not put Firecrawl, GitHub, Vercel, Supabase, or other MCP setup into public instructions as a requirement.
- Never expose API keys or personal connector state.

## Workflow

1. Intake.
   - Brand or company name.
   - Existing URL or uploaded/local site files.
   - Offer, audience, location, conversion goal, and pages to build.
   - Permission to use logo, public copy, and brand assets if this is for a real business.

2. Brand snapshot.
   - Extract logo references, colors, fonts, visual style, tone of voice, headline/value proposition, primary CTAs, trust signals, and site architecture.
   - Save as `research/01-brand-snapshot.md` when working in a project folder.

3. Competitor scan.
   - Find 5 to 10 relevant competitors or aspirational references.
   - Compare design quality, mobile responsiveness, content depth, social proof, CTA clarity, page speed impressions, SEO basics, and visual differentiation.
   - Save as `research/02-competitor-analysis.md`.

4. Pattern extraction.
   - Identify what the strongest sites consistently do well.
   - Name 3 to 5 opportunities where the target site can improve without becoming a clone.
   - Note what to avoid: generic AI visuals, weak claims, fake reviews, bloated effects, inaccessible contrast, or copied layouts.

5. Build brief and approval.
   - Produce `research/03-build-brief.md`.
   - Include design direction, page architecture, content hierarchy, CTA strategy, animation opportunities, asset needs, SEO targets, and open questions.
   - Stop before implementation when the brief changes positioning, page structure, or brand direction. Ask for approval or corrections.

## Recommended Report Shape

For a client-facing report, create a print-friendly HTML or markdown report with:

- executive summary
- brand snapshot
- competitor table
- "top 10 percent patterns"
- recommended site architecture
- design and animation direction
- SEO and conversion opportunities
- prioritized next steps

Keep reports factual. If a claim cannot be verified, label it as an assumption.

## Routing

- Use `jack-premium-site-system` when this is part of the full site workflow.
- Use `brandkit`, `design-taste-frontend`, or `imagegen-frontend-web` when the brand needs visual exploration.
- Use `competitor-profiling`, `competitors`, `cro`, `copywriting`, or `site-architecture` for deeper marketing work.
- Use `jack-scroll-asset-prompts` after the brief identifies the hero visual or scroll-stop concept.
