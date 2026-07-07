---
name: design-extract
description: Use when the user wants to extract or approximate a design language from a public or authorized website: colors, typography, spacing, components, Tailwind/shadcn tokens, visual patterns, and implementation guidance. Checks optional tooling first and falls back to manual browser/source inspection.
---

# Design Extract

Use this skill to turn an existing public or authorized website into a practical design-language brief for implementation.

This is a local Overdrive compatibility skill. It preserves the useful workflow from the earlier Design Extract integration without depending on any upstream Git source at install time. Do not claim that a tool extraction ran unless you actually ran one.

## Safety Rules

- Inspect only public pages or pages the user owns or has permission to analyze.
- Do not use cookies, authenticated browser profiles, scraped private data, paywalled content, or extension state.
- Do not install MCP servers, global CLIs, browser extensions, or packages without explicit user approval.
- Prefer an existing system Chrome/Chromium/Edge browser when tooling supports it.
- Keep trademark/logo usage rights separate from visual inspiration. Do not copy a competitor site too closely.

## Workflow

1. Clarify the target URL, target product/app, and whether the user wants extraction, redesign inspiration, or implementation tokens.
2. Check available tooling:
   - If a `designlang`, `extract-design`, or equivalent local tool is already available, run its help/preflight first.
   - If browser automation is available, use a public-page screenshot/source/CSS inspection pass.
   - If no tool is available, continue manually from fetched HTML/CSS, screenshots, or user-provided reference images.
3. Extract:
   - Color palette with usage roles, not only hex values.
   - Typography scale, weights, line heights, and type personality.
   - Spacing rhythm, layout grid, breakpoints, radii, shadows, borders, and density.
   - Reusable component patterns, navigation, CTAs, forms, cards, tables, modals, and empty/loading/error states.
   - Motion/interaction patterns when visible.
4. Convert findings into implementation guidance:
   - CSS variables or Tailwind theme tokens when useful.
   - Component-level notes for the user's stack.
   - What to borrow as inspiration and what to avoid copying.
5. Validate:
   - Check contrast and responsive implications.
   - Flag inaccessible, fragile, or brand-specific patterns.
   - Pair with `design-taste-frontend`, `impeccable`, `emil-design-eng`, or `playwright-cli` when implementing or verifying UI.

## Output

Provide a concise design-language brief:

```markdown
## Design Language
- Visual direction:
- Colors:
- Typography:
- Spacing/layout:
- Components:
- Interaction/motion:
- Implementation tokens:
- Risks/avoid copying:
- Suggested next skills:
```

## Fallbacks

If the extractor tool is missing, say so and use manual inspection. If the target blocks access or requires authentication, ask the user for screenshots, exported CSS, a public staging page, or permission-safe reference material.

## Attribution

Original Overdrive compatibility skill by Stefan / Radu Stefan Dumitru. Inspired by Manav Arya Singh's Design Extract / designlang workflow and public design-system extraction patterns; no upstream code is bundled.
