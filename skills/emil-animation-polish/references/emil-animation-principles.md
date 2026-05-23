# Emil Animation Principles

This reference is a public-safe, paraphrased implementation guide based on Emil Kowalski's animation and taste writing:

- The Easing Blueprint: https://animations.dev/learn/animation-theory/the-easing-blueprint
- CSS Transitions: https://animations.dev/learn/css-animations/transitions
- Developing Taste: https://emilkowal.ski/ui/developing-taste
- 7 Practical Animation Tips: https://emilkowal.ski/ui/7-practical-animation-tips

Use the source links for deeper study. Do not copy course text, videos, interactive examples, or assets into public projects unless the license/terms allow it.

## How This Fits The Existing Skills

- `emil-design-eng`: broader design engineering philosophy and full UI review behavior.
- `emil-animation-polish`: narrow practical checklist for web animation, easing, CSS transitions, tooltips, popovers, press states, and subtle polish.
- `fluid-animations`: physics, springs, gestures, velocity, interruption, rubberbanding, snap points, and Apple-style direct manipulation.
- `modern-web-guidance`: current platform APIs, accessibility, Baseline, CSS/browser details, and progressive enhancement.
- `playwright-cli`: real browser validation for visual/interaction quality.

## Taste Loop

Treat taste as a trainable workflow:

1. Surround yourself with strong references.
2. Study why an interaction feels good instead of only labeling it good or bad.
3. Rebuild small details from products you admire.
4. Ask for critique and compare against the reference.
5. Practice until the invisible details become instinctive.

When an animation feels "off", slow it down in dev tools and inspect: origin, duration, easing, initial state, exit path, interruption, and whether the motion should exist.

## Easing Selection

| Situation | Default choice | Reason |
|---|---|---|
| Dropdown, menu, popover, toast, modal enter/exit | Custom ease-out | Starts fast, so the interface feels responsive. |
| Element already on screen moves, resizes, or morphs | Custom ease-in-out or spring | Acceleration and deceleration feel more natural for visible movement. |
| Subtle color, background, border, opacity hover | Ease or gentle custom ease-out | Small visual changes should feel calm, not theatrical. |
| Progress over fixed time, hold-to-confirm, marquee, spinner rotation | Linear | Time or constant motion should not accelerate. |
| Gesture release, drag snap, interruptible direct manipulation | Spring via `fluid-animations` | User velocity and retargeting matter more than fixed duration. |
| Common keyboard-triggered command | No animation or nearly instant state change | Repeated keyboard workflows should feel immediate. |

Avoid ease-in for normal product UI. It starts slowly, which makes the interface feel delayed at the moment the user is paying attention.

## Starter Motion Tokens

These are starting points, not permanent truth. Adjust per product:

```css
:root {
  --ease-ui-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-ui-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-ui-sheet: cubic-bezier(0.32, 0.72, 0, 1);
  --ease-ui-soft: ease;

  --duration-press: 120ms;
  --duration-hover: 160ms;
  --duration-menu: 180ms;
  --duration-popover: 180ms;
  --duration-toast: 220ms;
  --duration-modal: 240ms;
  --duration-rare: 320ms;
}
```

Rules of thumb:

- Press feedback: `100ms` to `160ms`.
- Hover and color changes: `140ms` to `200ms`.
- Menus/popovers: `150ms` to `220ms`.
- Toasts and small panels: `180ms` to `260ms`.
- Modals and larger surfaces: `220ms` to `300ms`.
- Rare page/marketing moments can exceed this, but only when the wait is intentional.

## CSS Transition Rules

Prefer explicit property lists:

```css
.button {
  transition:
    transform var(--duration-press) var(--ease-ui-out),
    background-color var(--duration-hover) var(--ease-ui-soft),
    border-color var(--duration-hover) var(--ease-ui-soft);
}
```

When many properties share the same timing, keep shorthand readable:

```css
.button {
  transition-duration: var(--duration-hover);
  transition-timing-function: var(--ease-ui-soft);
  transition-property: color, background-color, border-color;
}
```

Avoid:

```css
.button {
  transition: all 300ms ease;
}
```

Why: `all` can animate accidental future property changes, cause layout jank, and make debugging harder.

## Press Feedback

Use active/down feedback so the UI feels like it heard the user:

```css
.pressable {
  transform: translateZ(0);
  transition: transform var(--duration-press) var(--ease-ui-out);
}

.pressable:active {
  transform: scale(0.97);
}

@media (prefers-reduced-motion: reduce) {
  .pressable {
    transition-duration: 80ms;
  }

  .pressable:active {
    transform: none;
  }
}
```

Use less scale for tiny controls or dense UIs. For large cards, combine a tiny scale with shadow/outline/color feedback so it does not feel like the layout shrank.

## Avoid Scale From Zero

Elements that start at `scale(0)` feel like they appear from nowhere. Use a visible initial shape:

```css
.popover[data-starting-style],
.popover[data-ending-style] {
  opacity: 0;
  transform: scale(0.96) translateY(-2px);
}
```

Use `scale(0)` only for deliberately graphic effects, not normal menus, popovers, modals, or product UI.

## Origin-Aware Popovers

Anchored surfaces should scale from the trigger or anchor. Use component-library variables when available:

```css
.radix-dropdown {
  transform-origin: var(--radix-dropdown-menu-content-transform-origin);
}

.radix-popover {
  transform-origin: var(--radix-popover-content-transform-origin);
}

.baseui-popover {
  transform-origin: var(--transform-origin);
}
```

Centered modals are different. They are not anchored to a trigger in the same way, so center origin is usually correct.

## Tooltip Timing

Tooltips need an initial delay to avoid accidental noise. Once one tooltip in a group is visible, moving to nearby tooltips should feel instant.

Implementation pattern:

```css
.tooltip {
  transform-origin: var(--transform-origin, center);
  transition:
    transform 125ms var(--ease-ui-out),
    opacity 125ms var(--ease-ui-out);
}

.tooltip[data-starting-style],
.tooltip[data-ending-style] {
  opacity: 0;
  transform: scale(0.97);
}

.tooltip[data-instant] {
  transition-duration: 0ms;
}
```

Use the actual attribute/selector your component library exposes.

## Hover Only Where Hover Exists

Do not let touch devices inherit sticky hover behavior:

```css
@media (hover: hover) and (pointer: fine) {
  .card:hover {
    transform: translateY(-2px);
  }
}
```

In Tailwind v4, hover behavior is already more conservative for touch devices. For older Tailwind or plain CSS, add the media query yourself.

## Blur As A Last Resort

Small blur can hide awkward state swaps where opacity alone makes two separate objects visible. Use it sparingly:

```css
.swapping-label {
  transition:
    opacity 140ms var(--ease-ui-out),
    filter 140ms var(--ease-ui-out),
    transform 140ms var(--ease-ui-out);
}

.swapping-label[data-leaving] {
  opacity: 0;
  filter: blur(2px);
  transform: scale(0.98);
}
```

Keep blur small and verify performance. Heavy blur is expensive, especially on Safari and lower-power devices.

## Common Audit Findings

| Finding | Better default |
|---|---|
| `transition: all` | Transition exact properties only. |
| `ease-in` for dropdown/menu | Use custom ease-out. |
| `scale(0)` for popover/modal | Use `scale(0.92-0.98)` plus opacity. |
| Popover scales from center | Set origin to trigger/anchor. |
| Tooltip delay repeats across adjacent icons | Use instant subsequent tooltip transitions. |
| Hover effect sticks on touch | Gate hover with `(hover: hover) and (pointer: fine)`. |
| UI animation over `300ms` | Shorten unless it is rare or explanatory. |
| Keyboard command animates | Remove or make nearly instant. |
| Crossfade feels like two objects | Try tiny blur and scale, then verify performance. |
| Motion ignores reduced-motion preference | Add a reduced-motion path. |
