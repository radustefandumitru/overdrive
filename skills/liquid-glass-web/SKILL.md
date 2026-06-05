---
name: liquid-glass-web
description: Build Apple-style liquid/frosted glass UI on the web with progressive enhancement. Use when implementing or reviewing glassmorphism, Liquid Glass, translucent navs, lens/refraction effects, SVG displacement filters, WebGL glass shaders, frosted panels, specular highlights, or cross-browser glass fallbacks.
---

# Liquid Glass Web

Use this skill when a web interface needs glass that feels premium without lying about platform support. Default to the simplest tier that meets the product goal, then enhance only when the target browsers and performance budget justify it.

Load `references/liquid-glass-tiers.md` for implementation snippets and `references/displacement-map-generator.js` when generating Tier 2 displacement maps.

## Progressive Enhancement Tiers

### Tier 1: Universal Frosted Glass

Use by default. Works across Chrome, Safari, Firefox, iOS, Android, and modern webviews.

- `backdrop-filter: blur(...) saturate(...)`
- translucent tint
- rounded shape
- subtle border/specular rim
- solid fallback for reduced transparency or unsupported devices

Choose Tier 1 for app chrome, nav bars, cards, modals, dashboards, and any UI where broad support, readability, accessibility, and performance matter more than true refraction.

### Tier 2: SVG-Displacement Refraction

Use as a Chromium-only enhancement. It adds lensing over arbitrary live content with `backdrop-filter: url(#displacement)` plus an SVG displacement map. It must fall back to Tier 1 elsewhere.

Keep the high-fidelity squircle displacement-map recipe from the reference:

- convex squircle profile: `Math.pow(1 - Math.pow(1 - x, 4), 0.25)`
- encode vector field as `R = 128 + x * 127`, `G = 128 + y * 127`, `B = 128`, `A = 255`
- animate filter `scale` or opacity rather than rebuilding the map during motion

Choose Tier 2 when Chromium/Electron fidelity is explicitly valuable and the glass needs to refract arbitrary live content behind it.

### Tier 3: WebGL Refraction

Use only when the product needs high-fidelity refraction beyond Chromium, including Safari/iPhone/iPad where WebGL and the device GPU support it.

Use a vetted permissively licensed WebGL library, such as `naughtyduk/liquidGL` after license verification, or an equivalent original shader. Do not vendor code without reviewing the license. If using `liquidGL`, note that it uses offscreen/snapshot rendering to refract page content; it does not magically read arbitrary live pixels from the browser surface.

Choose Tier 3 when:

- Safari/iOS also need true refraction.
- The backdrop is fixed, known, or snapshot/renderable.
- The project can afford WebGL complexity, memory, and browser/device testing.

Always provide Tier 1 as the fallback.

## Selection Checklist

1. Start at Tier 1.
2. Ask which browsers matter, especially Safari/iOS and Firefox.
3. Ask whether the backdrop is fixed/known, arbitrary live DOM, video, or animated content.
4. Check whether the effect is decorative or central to the product.
5. Check performance budget: number of glass layers, viewport size, scroll frequency, and mobile target.
6. Enhance to Tier 2 only for Chromium live-content refraction.
7. Enhance to Tier 3 only when cross-browser true refraction is worth WebGL complexity.

## Quality Rules

- Respect `prefers-reduced-transparency` when available and provide an explicit class/data-attribute fallback because browser support varies.
- Respect `prefers-reduced-motion`; do not animate lens strength, shimmer, tilt, or chromatic dispersion for reduced-motion users.
- Guarantee text contrast over the glass. Add an opaque text scrim when needed.
- Keep highlights restrained. Glass should improve depth, not become a rainbow border.
- Cap concurrent expensive glass layers. Avoid applying refraction to every card in a grid.
- Avoid animating width/height/radius on Tier 2 maps. Resize can force map regeneration.
- Use `will-change` sparingly and remove it after transitions when possible.
- Test on real target browsers. For Tier 2, validate in Chromium and confirm Tier 1 fallback elsewhere. For Tier 3, test actual Safari/iOS and lower-end mobile hardware.

## Pairing

- Pair with `emil-animation-polish` for easing, hover, press, and transition timing.
- Pair with `fluid-animations` for gesture-driven or springy glass movement.
- Pair with `design-taste-frontend` or `impeccable` for visual hierarchy, contrast, and premium restraint.
- Pair with `modern-web-guidance` when checking current browser APIs or progressive enhancement.
- Pair with `playwright-cli` for screenshots and browser validation.

## Attribution

Original Overdrive skill by Stefan / Radu Stefan Dumitru.

Inspired by Andrew Prifer's liquid-dom work (`https://github.com/AndrewPrifer/liquid-dom`, `https://x.com/AndrewPrifer/status/2056923983581446529`), kube.io's public CSS/SVG Liquid Glass technique (`https://kube.io/blog/liquid-glass-css-svg/`), and the broader web glass/refraction community. `naughtyduk/liquidGL` (`https://github.com/naughtyduk/liquidGL`) is an optional WebGL reference/library candidate; verify its license before adopting code or adding it as a dependency.
