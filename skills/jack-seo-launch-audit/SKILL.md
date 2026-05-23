---
name: jack-seo-launch-audit
description: >
  Add and audit SEO, metadata, structured data, internal links, responsiveness,
  performance, and launch readiness for premium AI-built websites. Use after a
  Jack Roberts inspired site build, when adding multiple pages, preparing GitHub
  or Vercel launch, checking page SEO, generating SEO reports, or making a
  scroll/3D landing page more rankable and shareable.
---

# Jack SEO Launch Audit

Use this skill after a premium website build to make it indexable, shareable, responsive, and ready for a careful launch.

Source attribution: public-safe synthesis inspired by Jack Roberts' public teaching on extending AI-built websites with multi-page SEO and launch workflows. Credit Jack Roberts and link https://www.youtube.com/watch?v=TZUTe7s11-I when referencing the method publicly.

## Scope

This is a launch and SEO readiness workflow, not a guarantee of rankings. For deep keyword strategy, pair with `seo-audit`, `ai-seo`, `programmatic-seo`, `schema`, `site-architecture`, `content-strategy`, or `copywriting`.

## Intake

Identify:

- production URL or local project path
- target pages and locations
- primary conversion goal
- target keywords, if known
- brand/social preview assets
- whether deployment is local-only, GitHub, Vercel, or another host

Treat GitHub, Vercel, analytics, and domain setup as optional user-configured services. Ask before creating repos, deploying, adding tokens, or changing remote projects.

## Page SEO Checklist

For every important page:

- unique `<title>` and meta description
- one clear H1
- logical H2/H3 hierarchy
- canonical URL when appropriate
- Open Graph and Twitter/X card metadata
- descriptive alt text or accessible adjacent text for images/video sections
- internal links to related pages
- clear CTA and contact/lead path
- no fake reviews, unsupported claims, or invented business details

## Structured Data

Add JSON-LD only when the facts are real:

- Organization or LocalBusiness for company pages.
- Product or Service for specific offers.
- FAQPage only for visible FAQs.
- BreadcrumbList when breadcrumbs or clear hierarchy exist.
- Review markup only when reviews are genuine, visible, and allowed by platform policy.

Prefer correct minimal schema over bloated schema.

## Technical Launch Checks

- responsive layout at mobile, tablet, and desktop sizes
- no text overlap in nav, hero, cards, buttons, or scroll overlays
- reduced-motion fallback for scroll-scrubbed or animated sections
- reasonable image/video/frame-sequence sizes
- lazy loading where appropriate
- sitemap and robots guidance
- favicon and social preview image
- 404 and basic error states where the framework supports them
- no local file paths, draft domains, test copy, or placeholder analytics IDs
- no secrets in source, logs, screenshots, docs, or zips

## Report Format

Produce a prioritized launch report:

- Overall readiness: Ready / Almost ready / Not ready
- Critical blockers
- High-impact SEO improvements
- Page-by-page metadata summary
- Structured data added or recommended
- Performance and mobile notes
- Deployment/account actions requiring user approval

When implementing fixes, keep changes surgical and verify with browser checks when visual behavior matters.

## Routing

- Use `jack-premium-site-system` when this is part of the full Jack-style workflow.
- Use `playwright-cli` for screenshots and responsive verification.
- Use `modern-web-guidance` plus Context7 for current framework/platform docs.
- Use `connect` or `connect-apps` only after explicit approval for external account actions.
