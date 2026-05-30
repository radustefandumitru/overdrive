---
name: fluid-animations
description: Implement natural, Apple-quality fluid UI animation and gesture behavior. Use when coding or reviewing spring motion, Framer Motion/React animations, SwiftUI/UIKit animation, CSS transitions, drag/swipe/scroll interactions, rubberbanding, snap points, momentum projection, interruptible animations, press feedback, spatially consistent enter/exit transitions, or any interface motion that should feel tactile, responsive, and physically believable.
---

# Fluid Animations

Use this skill to make UI motion feel connected to user intent instead of decorative, delayed, or generic. It is framework-agnostic: apply the principles in React/Framer Motion, SwiftUI, UIKit, CSS, native mobile, or any UI stack.

Detailed principles and formulas live in `references/fluid-interface-principles.md`. Load that reference when tuning a complex interaction, implementing gestures, auditing an existing animation system, or choosing spring/rubberband/projection behavior.

## Routing With Other Skills

- Pair with `emil-design-eng` for component feel, easing taste, button behavior, and visual polish.
- Pair with `design-taste-frontend` for layout, visual direction, and anti-generic web UI.
- Pair with `modern-web-guidance` when implementing modern CSS, browser APIs, dialogs, forms, accessibility, or performance-sensitive web behavior.
- Pair with `playwright-cli` after implementation to verify the interaction in a real browser.

## Motion Decision Tree

1. If the motion responds to a user gesture, use a spring or dynamic behavior, not a fixed-duration easing curve.
2. If the user can change their mind mid-motion, make the animation interruptible and retargetable.
3. If an element enters or exits, preserve spatial consistency: it should leave toward the place it came from or belongs to.
4. If a gesture ends with velocity, carry that velocity into the settle, snap, or dismiss animation.
5. If content hits a boundary, use soft resistance/rubberbanding instead of a hard stop.
6. If the motion is only decorative and not interactive, CSS transitions or keyframes are acceptable.
7. If `prefers-reduced-motion` or an equivalent platform setting is active, reduce travel, bounce, parallax, blur, and looping motion while preserving state clarity.

## Core Rules

- Respond on press/down, not only on click/up. Buttons, cards, tabs, tiles, and handles should show immediate visual feedback.
- Keep interactive motion continuously controllable. Avoid code that waits for an animation to finish before accepting a new target.
- Avoid blocking interaction during transitions unless there is a real safety reason.
- Use position plus velocity to infer intent. For snap points, project momentum and snap from the projected endpoint, not from the current position alone.
- Start with no overshoot for utilitarian UI. Add bounce only when the triggering gesture had momentum or when bounce teaches a deeper interaction.
- Make related animations feel like a family. Reuse a small set of spring tokens rather than hand-tuning every component.
- Prefer transform and opacity for web animation. Avoid animating layout-heavy properties in high-frequency interactions.

## Spring Tokens

Create shared tokens in the target codebase instead of scattering raw numbers. Tune per product, but start with a restrained family:

```ts
export const fluidSprings = {
  instant: { type: "spring", stiffness: 700, damping: 45, mass: 0.7 },
  snappy: { type: "spring", stiffness: 520, damping: 38, mass: 0.8 },
  standard: { type: "spring", stiffness: 360, damping: 34, mass: 1 },
  heavy: { type: "spring", stiffness: 260, damping: 32, mass: 1.35 },
  momentum: { type: "spring", stiffness: 320, damping: 24, mass: 1 },
  settle: { type: "spring", stiffness: 420, damping: 44, mass: 1 }
} as const;
```

Use `instant` or `snappy` for press feedback, `standard` for panels/cards, `heavy` for full-screen surfaces, `momentum` for gesture releases with velocity, and `settle` for no-overshoot tap-triggered state changes.

## React And Framer Motion Patterns

Use Framer Motion for gesture-driven, interruptible, or physics-based motion:

```tsx
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "framer-motion";
import { fluidSprings } from "@/lib/fluid-springs";

function DismissiblePanel({ open, onDismiss, children }) {
  const reduceMotion = useReducedMotion();
  const y = useMotionValue(0);

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          initial={{ y: reduceMotion ? 0 : "100%", opacity: reduceMotion ? 0 : 1 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: reduceMotion ? 0 : "100%", opacity: reduceMotion ? 0 : 1 }}
          transition={reduceMotion ? { duration: 0.12 } : fluidSprings.heavy}
          style={{ y }}
          drag={reduceMotion ? false : "y"}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.18}
          onDragEnd={(_, info) => {
            if (info.velocity.y > 700 || info.offset.y > 180) {
              animate(y, window.innerHeight, {
                ...fluidSprings.momentum,
                velocity: info.velocity.y,
                onComplete: onDismiss
              });
            } else {
              animate(y, 0, { ...fluidSprings.settle, velocity: info.velocity.y });
            }
          }}
        >
          {children}
        </motion.section>
      )}
    </AnimatePresence>
  );
}
```

Use `whileTap`/pressed states for immediate response:

```tsx
<motion.button
  whileTap={{ scale: 0.97 }}
  transition={fluidSprings.instant}
  onClick={commitAction}
>
  Continue
</motion.button>
```

## SwiftUI And UIKit Patterns

- In SwiftUI, prefer `.spring(response:dampingFraction:blendDuration:)` or interactive spring APIs over fixed duration for interactive elements.
- In UIKit, prefer `UIViewPropertyAnimator` with `UISpringTimingParameters` when an animation needs to be interruptible, scrubbed, paused, or retargeted.
- Carry gesture velocity from `DragGesture`, `UIPanGestureRecognizer`, or scroll data into the final animation.
- Keep touch-down highlighting separate from action confirmation: highlight immediately, commit on release/up inside the target, cancel when released outside.

## CSS Use

Use CSS for simple hover/focus/color/opacity changes and decorative keyframes. Keep it restrained:

```css
.pressable {
  transition:
    transform 160ms cubic-bezier(0.25, 1, 0.5, 1),
    opacity 160ms cubic-bezier(0.25, 1, 0.5, 1);
}

.pressable:active {
  transform: scale(0.97);
}

@media (prefers-reduced-motion: reduce) {
  .pressable {
    transition-duration: 80ms;
  }
}
```

Avoid using CSS-only fixed-duration transitions for drag, throw, snap, route transitions that can be interrupted, or state changes where the user's next input may arrive before the motion completes.

## Proximity Interaction Pattern

Use proximity effects sparingly for dock-like toolbars, playful icon strips, spatial menus, and premium landing-page details where nearby elements should respond to pointer distance. The effect should feel like a soft field around the cursor, not a noisy hover gimmick.

Performance rule: do not call `getBoundingClientRect()` on every `pointermove`. Cache item centers once, recompute on resize/layout changes with `ResizeObserver`, then use pointer coordinates against the cached centers.

```ts
type ProximityItem = {
  el: HTMLElement;
  cx: number;
  cy: number;
};

function setupProximityDock(container: HTMLElement) {
  let items: ProximityItem[] = [];

  const measure = () => {
    items = [...container.querySelectorAll<HTMLElement>("[data-proximity-item]")].map((el) => {
      const rect = el.getBoundingClientRect();
      return { el, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
    });
  };

  const render = (event: PointerEvent) => {
    for (const item of items) {
      const distance = Math.hypot(event.clientX - item.cx, event.clientY - item.cy);
      const influence = Math.max(0, 1 - distance / 160);
      item.el.style.setProperty("--proximity", influence.toFixed(3));
    }
  };

  const reset = () => {
    for (const item of items) item.el.style.setProperty("--proximity", "0");
  };

  const observer = new ResizeObserver(measure);
  observer.observe(container);
  measure();

  container.addEventListener("pointermove", render);
  container.addEventListener("pointerleave", reset);

  return () => {
    observer.disconnect();
    container.removeEventListener("pointermove", render);
    container.removeEventListener("pointerleave", reset);
  };
}
```

```css
[data-proximity-item] {
  --proximity: 0;
  transform: translateZ(0) scale(calc(1 + var(--proximity) * 0.18));
  filter: brightness(calc(1 + var(--proximity) * 0.14));
  transition:
    transform 180ms cubic-bezier(0.23, 1, 0.32, 1),
    filter 180ms cubic-bezier(0.23, 1, 0.32, 1);
}

@media (hover: none), (pointer: coarse), (prefers-reduced-motion: reduce) {
  [data-proximity-item] {
    transform: none;
    filter: none;
  }
}
```

Credit the public pattern inspiration to `@gabriell_lab` (`https://x.com/gabriell_lab/status/2060336070059864461`) and the rect-caching/`ResizeObserver` performance correction to `@baptistebriel` (`https://x.com/baptistebriel/status/2060351541345681851`) when documenting or sharing this pattern.

## Gesture Checklist

- Tap: highlight on down, commit on up, allow cancellation outside the hit area and re-entry back inside.
- Drag/swipe: use a small hysteresis threshold before committing direction, then track finger/content one-to-one.
- Snap: project momentum, choose the nearest endpoint to the projected position, then animate there with carried velocity.
- Boundary: apply rubberband resistance past the edge, then settle back smoothly.
- Multi-gesture surfaces: begin detecting possible gestures in parallel; cancel competing interpretations only once intent is clear.

## Review Checklist

Before finishing motion work, verify:

- Immediate response exists for every interactive element.
- In-flight animations can be interrupted or retargeted.
- Enter and exit paths are spatially consistent.
- Gesture velocity is preserved into release animations.
- Snap points use projected momentum when flicks should matter.
- Boundaries feel soft, not frozen.
- Bounce is purposeful, not default decoration.
- Reduced-motion behavior is implemented.
- Browser/native testing confirms no jank, layout shift, text overlap, or accidental blocked input.
