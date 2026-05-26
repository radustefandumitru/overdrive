---
name: pre-launch-checklist
description: Use before shipping a web app, mobile app, SaaS product, landing page, beta, waitlist, Product Hunt launch, App Store release, or client handoff. Checks product readiness, security, performance, analytics, billing, legal/privacy, support, monitoring, rollback, launch-day tasks, and first-week post-launch follow-up. Complements jack-seo-launch-audit; use this for product/business launch readiness, not only SEO.
---

# Pre-Launch Checklist

Use this skill when the user is close to shipping and wants to avoid preventable launch mistakes. It is optimized for one-person teams and indie builders: practical, sequenced, and focused on what can actually be checked before launch.

## Choose The Launch Type

First identify the surface:

- Web app or SaaS
- Mobile app or App Store/TestFlight release
- Marketing site or landing page
- Paid product / subscription / billing launch
- Client handoff
- Public announcement, Product Hunt, Reddit, X/LinkedIn, email list, or waitlist launch

Then tailor the checklist. Do not dump every item if half the categories do not apply.

## Pre-Launch Readiness

Check these before public traffic:

- Product: core flows work, empty/error/loading states exist, onboarding explains value, no dead-end CTAs, sample/placeholder content removed.
- Security: auth paths reviewed, server-side authorization verified, secrets out of client bundles and repo, env vars documented, dependency warnings triaged, file uploads and webhooks validated.
- Data and privacy: privacy policy, terms, cookie/analytics disclosure, data deletion/contact path, PII minimization, backups or export path where relevant.
- Billing: test payments, refund/cancel flow, receipt emails, plan names/prices, tax/VAT notes, failed-payment behavior, entitlement checks.
- Performance: production build, Lighthouse/Core Web Vitals pass where relevant, image/video optimization, mobile network behavior, reduced-motion fallback for heavy animation.
- Analytics: events for signup, activation, purchase, core action, error, churn/cancel, and traffic sources; dashboards checked with test data.
- SEO/share: title/meta/OG/Twitter cards, canonical URLs, sitemap/robots if needed, structured data where useful, clean social preview.
- Support: support email/form, known-issues note, FAQ, feedback path, status page or incident channel if relevant.
- Operations: monitoring/alerts, logs, uptime checks, backup/restore path, rollback plan, feature flags, admin access, deploy credentials.
- Legal/brand: rights to logos/images/testimonials, no unsupported claims, accessibility basics, license notices, attribution.

## Launch-Day Plan

Create a short runbook:

1. Freeze scope and ship from a known commit.
2. Run final smoke test in production.
3. Publish announcement assets in the planned order.
4. Watch errors, analytics, payment events, and support channels for the first two hours.
5. Capture user questions verbatim.
6. Triage blockers immediately; defer nice-to-haves.
7. Record what changed after launch.

## First-Week Follow-Up

Within seven days:

- Fix activation blockers and confusing copy before adding new features.
- Review conversion from visit -> signup -> activation -> paid/core action.
- Identify the top three reasons users bounced or asked for help.
- Write a short launch retro: what worked, what broke, what to test next.
- Turn repeated support answers into docs, onboarding, or product copy.
- Thank early users and ask for specific feedback.

## Output Options

Offer one of these, depending on the user request:

- A concise launch readiness scorecard.
- A prioritized blocker list.
- A launch-day runbook.
- A first-week monitoring plan.
- A complete checklist grouped by owner and due date.

## Pairing

- Use `jack-seo-launch-audit` for animated/3D websites needing SEO and technical launch checks.
- Use `security-review` for deeper vulnerability analysis.
- Use `playwright-cli` for browser smoke checks.
- Use marketing skills for launch copy, emails, social posts, Product Hunt copy, or positioning.

## Attribution

Original AgenticSupercharge skill by Stefan / Radu Stefan Dumitru. Inspired by public indie-builder launch checklist patterns and launch advice discussed by Hartdrawss and alphabatcher on X; no raw post text is redistributed.
