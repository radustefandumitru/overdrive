# Fluid Interface Principles

Source inspiration: Apple Developer, WWDC 2018 Session 803, "Designing Fluid Interfaces" (`https://developer.apple.com/videos/play/wwdc2018/803/`).

This reference is a paraphrased implementation guide for coding agents. It does not include or require the Apple transcript. Use it to translate fluid-interface principles into practical animation and gesture code.

## Contents

- Mental model
- Response
- Interruption and redirection
- Spatial consistency
- Gesture direction hints
- Lightweight input, amplified output
- Rubberbanding
- Smooth frames of motion
- Behavior over animation
- Spring tuning
- Momentum projection
- Gesture implementation
- Teaching gestures
- Accessibility and performance

## Mental Model

Fluid motion is not just "smooth animation." A fluid interface feels like direct manipulation: the UI responds at the speed of the user's intent, stays attached to gesture input, and can be redirected without waiting for a scripted timeline.

The user should feel that:

- The interface heard the input immediately.
- The object is under control during the whole interaction.
- Motion preserves spatial memory.
- Gesture energy carries into the result.
- The UI can change course as quickly as the user does.

## Response

Every interaction should provide visible response on down/press/start, not only on click/release/end.

Implementation:

- Button/card/tile: apply pressed scale, highlight, opacity, elevation, or color immediately.
- Gesture target: begin tracking as soon as the gesture starts, even if final intent is not known.
- Async work: never wait for network/data before showing local feedback.
- Tap confirmation: show press feedback on down, but commit the action on up/release inside the target.

Avoid:

- Delayed tap feedback caused by double-tap recognition.
- Waiting for animation completion before accepting input.
- `setTimeout` before the first feedback frame.

## Interruption And Redirection

Users change intent while moving. Motion should retarget from its current value and current velocity instead of resetting or waiting.

Implementation:

- Use springs/dynamic behaviors for interactive motion.
- Store motion values where possible so a new target starts from the current position.
- Preserve current velocity when a gesture or animation changes direction.
- Avoid chaining user-controllable states through completion callbacks.
- Use acceleration/change in velocity to detect an intentional pause or redirection when precision matters.

Bad pattern:

```ts
await animateTo("open");
await animateTo("settled");
```

Better pattern:

```ts
controls.start({ x: targetX, transition: springForCurrentIntent });
```

Then retarget `controls.start(...)` whenever intent changes.

## Spatial Consistency

Objects need a believable place where they live. If a panel enters from the right, it should usually exit to the right. If a player expands from the bottom, collapse it toward the bottom.

Implementation:

- Define each component's off-screen home position.
- Match `initial` and `exit` directions for conditional UI.
- Make back/close gestures retrace the opening path unless the product is intentionally communicating "send away" or "archive."
- Use shared layout transitions when the same object changes size or surface.

## Gesture Direction Hints

Motion should preview where the interaction is going. When the user starts a gesture, interpolate toward the final state so the result feels predictable.

Implementation:

- Map gesture progress `0..1` to scale, opacity, translation, elevation, blur, or reveal.
- Begin the preview immediately, not only after a threshold.
- Use grabbers, clipped content edges, paging dots, or elevated layers to expose hidden gestures.

## Lightweight Input, Amplified Output

Small inputs should produce satisfying output when velocity communicates intent.

Implementation:

- Use position, velocity, speed, and pressure/touch data where available.
- Preserve flick velocity into scrolling, dismissal, snap, and expansion.
- Let short gestures move content far when the user's velocity indicates that intent.
- Avoid requiring long, laborious drags for common actions.

## Rubberbanding

Boundaries should feel resistant rather than frozen. When content exceeds a boundary, apply diminishing movement past the edge, then spring it back.

TypeScript helper:

```ts
export function rubberband(offset: number, dimension: number, constant = 0.55) {
  if (offset === 0 || dimension <= 0) return 0;
  const sign = Math.sign(offset);
  const magnitude = Math.abs(offset);
  return (
    (1 - 1 / (magnitude * constant / dimension + 1)) *
    dimension *
    sign
  );
}
```

Use this for overscroll, pull-to-expand, edge drawers, draggable cards, sheets, and any surface that can be pulled past a valid range.

## Smooth Frames Of Motion

Perceived smoothness depends on both frame rate and the amount of visual change per frame. Fast motion can strobe even at high frame rates.

Techniques:

- Prefer `transform` and `opacity` for web animation.
- Limit large high-contrast travel over very short durations.
- Use subtle motion stretching or directional blur only for fast, expressive movement.
- Keep stretching subtle and velocity-linked; return to `scale(1)` as speed drops.
- Use 120 Hz where available, but do not rely on it to fix poor motion design.

Velocity-linked stretch example:

```ts
const scaleY = transform(velocityY, [-3000, 0, 3000], [0.9, 1, 1.1]);
const scaleX = transform(velocityY, [-3000, 0, 3000], [1.08, 1, 0.92]);
```

For horizontal motion, swap axes.

## Behavior Over Animation

Think "continuous behavior" instead of "animation clip." A spring is always ready for a new target. Scrolling can be interrupted before it visually ends. A dragged object should feel like it has consistent mass and friction across the product.

Implementation:

- Replace "duration" decisions with "response/stiffness" and "damping" decisions.
- Keep a small behavior family: tap, standard surface, heavy surface, momentum release, settle.
- Match conceptual weight: small cards feel lighter; full-screen surfaces feel heavier.
- Keep related surfaces consistent so users can transfer learning from one interaction to another.

## Spring Tuning

Start simple:

- Use no-overshoot springs for tap-triggered UI.
- Use mild overshoot only when the gesture that caused the movement had directional momentum.
- Use bounce as a teaching signal only when it communicates that a deeper interaction exists.
- Avoid springy decoration that distracts from the task.

Mapping:

- Damping controls overshoot. More damping means less bounce.
- Stiffness/response controls how quickly the value approaches the target.
- Mass controls perceived weight and inertia.

Practical defaults:

| Use case | Feel | Guidance |
|---|---|---|
| Press feedback | Immediate | High stiffness, high damping, low mass |
| Cards and small panels | Responsive | Medium-high stiffness, high damping |
| Full-screen sheets | Weighty | Lower stiffness, medium-high damping, higher mass |
| Flick dismissal | Momentum-aware | Medium stiffness, lower damping, carry velocity |
| Tap-triggered open/close | Calm | High damping, no overshoot |

## Momentum Projection

When a dragged or thrown object must snap to one of several endpoints, do not choose based only on current position. Project where it would naturally coast, then choose the nearest endpoint to that projection.

TypeScript helper for velocity in units per second:

```ts
export function projectMomentum(velocity: number, decelerationRate = 0.998) {
  return (velocity / 1000) * decelerationRate / (1 - decelerationRate);
}

export function closestPoint(value: number, points: number[]) {
  return points.reduce((best, point) =>
    Math.abs(point - value) < Math.abs(best - value) ? point : best
  );
}
```

Usage:

```ts
const projectedX = currentX + projectMomentum(releaseVelocityX);
const targetX = closestPoint(projectedX, snapPoints);
animate(x, targetX, { ...fluidSprings.momentum, velocity: releaseVelocityX });
```

Tune `decelerationRate` for product feel. Lower values project less distance; higher values amplify flicks more.

## Gesture Implementation

### Tap

1. Highlight immediately on down.
2. Commit on up/release inside the target.
3. Add a comfortable invisible hit margin.
4. Cancel if released outside.
5. Re-highlight and allow commit if the pointer/finger re-enters before release.

### Swipe Or Drag

1. Detect a small hysteresis threshold before committing direction.
2. After the threshold, keep content and pointer/finger attached one-to-one.
3. Track relative offset from the first contact point, not from the object's center.
4. Track recent position history for velocity. Do not rely only on the last event.
5. Preserve release velocity into the resulting animation.

### Multiple Simultaneous Gestures

1. Begin detecting all plausible gestures from the start.
2. Show immediate feedback without waiting for certainty.
3. Once intent is clear, cancel competing gestures.
4. Avoid double-tap patterns when a single tap needs immediate response.

## Teaching Gestures

Gestures are invisible, so teach through the interface:

- Use grabber handles for sheets and drawers.
- Clip scrollable content to reveal more content beyond the edge.
- Use paging dots or partial next-card previews.
- Elevate draggable objects above passive content.
- Make button-triggered animations follow the same direction as the gesture alternative.
- Use concise explicit text only for gestures that repeat across the product.

## Accessibility And Performance

- Respect reduced-motion preferences.
- Replace large travel with fade, scale, or shorter movement when reducing motion.
- Avoid parallax, endless loops, heavy blur, and strong bounce for reduced-motion users.
- Keep focus order, keyboard interaction, and screen-reader state aligned with visual state.
- Test on real devices or browsers when animation quality matters.
- Check for layout shift, text overlap, accidental blocked clicks, scroll hijacking, and dropped frames.
