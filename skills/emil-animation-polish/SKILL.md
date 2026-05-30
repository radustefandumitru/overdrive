---
name: emil-animation-polish
description: Use for Emil Kowalski inspired web UI animation polish: CSS transitions, custom easing, duration choices, press feedback, hover/touch behavior, tooltip delay logic, origin-aware popovers, small blur-assisted state transitions, and audits for interfaces that should feel smooth, fast, responsive, and tasteful. Pair with emil-design-eng for broader UI taste and fluid-animations for spring, gesture, drag, swipe, and direct-manipulation motion.
---

# Emil Animation Polish

Use this skill when implementing or reviewing practical UI animation details, especially in React, Next.js, HTML, CSS, Tailwind, Framer Motion, Radix UI, Base UI, and similar web stacks.

This skill is adapted from Emil Kowalski's public writing and lessons:

- https://animations.dev/learn/animation-theory/the-easing-blueprint
- https://animations.dev/learn/css-animations/transitions
- https://emilkowal.ski/ui/developing-taste
- https://emilkowal.ski/ui/7-practical-animation-tips

Load `references/emil-animation-principles.md` when you need concrete easing tokens, CSS transition patterns, or an animation audit checklist.

## Routing With Other Skills

- Use `emil-design-eng` for broader Emil-style design engineering judgment, component feel, invisible details, and UI critique.
- Use this skill when the task is specifically about smoother web animations, easing, CSS transitions, hover/press details, tooltip/popover behavior, or animation polish.
- Use `fluid-animations` for gesture-driven, interruptible, spring-based, drag/swipe, momentum, rubberband, snap-point, or Apple-like direct-manipulation motion.
- Use `modern-web-guidance` when implementing current CSS/browser APIs, accessibility, Baseline compatibility, popovers, dialogs, forms, or performance-sensitive web behavior.
- Use `playwright-cli` after implementation when visual proof, screenshots, interaction testing, or browser validation matters.

## Animation Decision Pass

Before adding motion, decide:

1. Should this animate at all? Remove or reduce animation for interactions the user will trigger many times per day, especially keyboard-driven actions.
2. What job does the animation do? Acceptable jobs include feedback, spatial continuity, state explanation, reducing jarring changes, and making a rare moment feel polished.
3. What mechanism fits? Use CSS transitions for simple hover/press/state interpolation, Framer Motion or springs for interactive/gesture motion, and keyframes only for self-running or carefully staged sequences.
4. What easing fits the motion? Use ease-out for enter/exit and user-initiated UI, ease-in-out for morphs or moving elements already on screen, ease for subtle hover/color changes, and linear only for time-passage or constant motion.
5. How often will this be seen? Common UI should feel nearly instant. Rare onboarding or celebration moments can take more time.

## Core Rules

- Give immediate press feedback. Buttons and pressable cards should respond on down/active, commonly with a subtle scale near `0.97`.
- Do not animate UI from `scale(0)`. Start from a visible shape such as `0.92` to `0.98` plus opacity, so the object feels like it came from somewhere.
- Keep common UI motion fast. Most product UI should stay under roughly `300ms`; many hover/press/popover transitions belong closer to `120ms` to `220ms`.
- Avoid `transition: all`. Specify the exact properties, usually `transform`, `opacity`, `color`, `background-color`, `border-color`, or a small known set.
- Prefer transform and opacity for motion. Avoid layout-heavy properties for frequent or high-frequency animation.
- Make popovers and anchored menus origin-aware. Scale from the trigger or anchor position, not from the center. Centered modals are the exception.
- Tooltips should have an initial delay, then switch instantly between nearby tooltips once the group is active.
- Gate hover-only animation behind pointer support, so touch devices do not get sticky accidental hover effects.
- Use small blur only as a last-resort bridge for awkward state swaps or crossfades. Keep it subtle and verify Safari/performance.
- Respect reduced motion by reducing travel, disabling nonessential animation, and preserving state clarity.

## Implementation Pattern

Create motion tokens in the project rather than scattering raw timings and curves:

```css
:root {
  --ease-ui-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-ui-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-ui-sheet: cubic-bezier(0.32, 0.72, 0, 1);

  --duration-press: 140ms;
  --duration-hover: 180ms;
  --duration-popover: 180ms;
  --duration-modal: 240ms;
}
```

Use explicit transition properties:

```css
.pressable {
  transition:
    transform var(--duration-press) var(--ease-ui-out),
    opacity var(--duration-press) var(--ease-ui-out);
}

.pressable:active {
  transform: scale(0.97);
}

@media (hover: hover) and (pointer: fine) {
  .pressable:hover {
    opacity: 0.86;
  }
}
```

## Modern CSS Interaction Patterns

### Proximity Hover

For dock-style hover fields, use the proximity pattern from `fluid-animations`: cache item rects, recompute with `ResizeObserver`, and update CSS variables from pointer distance. Do not measure layout on every `pointermove`. Keep the scale/brightness range small and disable on coarse pointers and reduced motion.

Credit `@gabriell_lab` (`https://x.com/gabriell_lab/status/2060336070059864461`) for the public interaction pattern and `@baptistebriel` (`https://x.com/baptistebriel/status/2060351541345681851`) for the rect-caching performance guidance when sharing the technique.

### Scroll-State Sticky Navbar

For sticky navs that subtly morph only after they stick, prefer CSS scroll-state queries when available:

```css
.page-shell {
  container-type: scroll-state;
}

.site-nav {
  position: sticky;
  top: 12px;
  z-index: 20;
  border-radius: 999px;
  transition:
    background-color 180ms var(--ease-ui-out),
    box-shadow 180ms var(--ease-ui-out),
    transform 180ms var(--ease-ui-out);
}

@container scroll-state(stuck: top) {
  .site-nav {
    background: color-mix(in srgb, Canvas 78%, transparent);
    box-shadow: 0 10px 30px color-mix(in srgb, black 14%, transparent);
    backdrop-filter: blur(16px) saturate(170%);
  }
}
```

Support caveat: `container-type: scroll-state` and `@container scroll-state(...)` are currently a progressive enhancement, with Chromium support leading Safari/Firefox. Provide a JavaScript `IntersectionObserver` or scroll-class fallback when the stuck-state visual is important, and keep the default nav usable without the query.

Credit the public sticky-navbar pattern to `@mannupaaji` (`https://x.com/mannupaaji/status/2060025609867387239`) and reference the Chrome team's CSS scroll-state queries writeup (`https://developer.chrome.com/blog/css-scroll-state-queries`) when documenting browser support.

## Review Checklist

- Is every animation justified by feedback, continuity, explanation, or reduced jank?
- Are frequent or keyboard-driven interactions free of unnecessary animation?
- Are durations fast enough for product UI?
- Does easing start quickly for user-triggered enter/exit motion?
- Are moving/morphing elements using ease-in-out or a spring instead of a sluggish ease-in?
- Are transition properties explicit rather than `all`?
- Are hovers disabled on touch-only devices?
- Do pressable controls respond immediately?
- Do popovers/menus scale from the trigger or anchor?
- Do tooltips avoid repeat delay once a tooltip group is active?
- Does reduced-motion behavior preserve usability?
- Has the result been checked in a real browser when visual quality matters?
