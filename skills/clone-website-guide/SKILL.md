---
name: clone-website-guide
description: Safely guide authorized website rebuilds and visual recreations from a URL, including when to use JCodesMore's ai-website-cloner-template as a fresh project template. Use for "clone this website", "rebuild this landing page", "make a site like this", or "replicate this design" requests.
---

# Clone Website Guide

Use this skill when the user wants to rebuild, recreate, or closely reference a website from a URL or screenshot.

The goal is to help users make legitimate, authorized rebuilds and design-inspired implementations without phishing, impersonation, asset theft, or trademark misuse.

## Permission Gate

Before cloning or closely reproducing a site, establish one of:

- The user owns the site.
- The user has permission from the owner/client.
- The site is their competitor/reference and the goal is structural inspiration, not copying.
- The task is educational and the output will be clearly non-deceptive.

Refuse or redirect requests that are primarily for phishing, credential collection, impersonation, bypassing paywalls, brand spoofing, or deceptive copies of banks, marketplaces, login portals, crypto services, government portals, or other sensitive services.

## Choose The Right Path

### Path A: Fresh Template Flow

Use this when the user explicitly wants to use `JCodesMore/ai-website-cloner-template` or is starting from scratch.

1. Tell the user this is a full project template, not a portable global skill.
2. Start from a fresh repo/project created from the template, following the template's current README.
3. Use only public/authorized URLs.
4. Keep generated assets and copied text legally safe.
5. After generation, run normal Overdrive review: accessibility, responsive behavior, performance, and brand/legal cleanup.

Do not force this template into an existing app unless the user wants a separate prototype that will be manually ported.

### Path B: Existing Project Rebuild

Use this for most Overdrive work in an existing repo.

Recommended sequence:

1. `design-extract` for page structure, styles, screenshots, and design tokens where lawful.
2. `site-architecture` for page/component structure.
3. `redesign-existing-projects` if integrating into an existing app.
4. `design-taste-frontend`, `impeccable`, `high-end-visual-design`, or `modern-web-guidance` for quality.
5. `playwright-cli` for visual/browser verification.
6. `seo-audit`, `cro`, or `page`/copy skills only if the rebuild includes content/marketing work.

### Path C: Inspiration-Only

Use this when the target is a third-party site without permission.

- Extract layout patterns, interaction ideas, IA, and visual principles.
- Use new brand, copy, colors, assets, and product positioning.
- Avoid duplicating logos, proprietary illustrations, exact copy, protected trade dress, or distinctive branded combinations.

## Output Contract

For URL-based rebuild requests, produce:

- permission/safety classification
- recommended path: fresh template, existing project rebuild, or inspiration-only
- required inputs: target URL, screenshots, brand assets, desired framework, pages, and fidelity level
- implementation plan
- legal/brand constraints
- verification checklist

## Verification Checklist

- The site cannot be mistaken for the original owner if it is not owned/authorized.
- No login or payment collection is copied deceptively.
- No proprietary images, logos, fonts, or testimonials are used without rights.
- The build is responsive, accessible, and performant.
- The user can explain what changed from the source and why.
