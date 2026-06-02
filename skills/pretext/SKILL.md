---
name: pretext
description: Use for advanced web text measurement and layout with @chenglou/pretext: virtualized lists with variable-height text, shrinkwrapped chat bubbles, responsive multiline text, auto-growing textareas, dev-time label overflow checks, Canvas/SVG/WebGL text, and avoiding DOM reflow from getBoundingClientRect/offsetHeight. This is text-layout engineering/performance, not visual design polish.
---

# Pretext Text Layout

Use this skill when the hard part is measuring or laying out text accurately without forcing browser layout reflow. Do not use it for ordinary typography taste, brand direction, or visual polish; route those to the frontend/design skills.

## What This Skill Does

`@chenglou/pretext` is a pure TypeScript text measurement and layout library. It helps agents replace repeated DOM measurement loops with deterministic text layout calls when building:

- Virtualized feeds, logs, comments, or chat lists with variable-height rows.
- Chat/message bubbles that shrinkwrap text without layout thrash.
- Auto-growing textareas or editor previews.
- Responsive/magazine/multi-column text layout experiments.
- Dev-time checks such as "does this label overflow at this width?"
- Canvas, SVG, WebGL, or custom-rendered text where the browser DOM is not doing layout.

## Before Implementing

1. Confirm the project is a JavaScript/TypeScript web project and inspect its package manager.
2. If the package is not installed, ask or state the dependency change before adding it:

   ```bash
   npm install @chenglou/pretext
   ```

   Use the project's existing package manager when it is not npm.
3. Match measurement inputs to rendered CSS: font family, font size, line height, letter spacing, available width, white-space behavior, and locale.
4. Ensure relevant web fonts are loaded before relying on measured output in the browser.

## Implementation Pattern

Use `prepare` for repeated layout of the same text/font inputs, then call `layout` whenever width or wrapping constraints change.

```ts
import { layout, prepare } from '@chenglou/pretext';

const prepared = prepare({
  text: message.body,
  font: '16px Inter',
  lineHeight: 22,
  whiteSpace: 'pre-wrap',
});

const box = layout(prepared, {
  width: availableWidth,
});
```

For virtualization, keep prepared handles or cached layout metadata near the row model. Recompute only when the text, font metrics, or available width changes. Use the resulting height/line information to feed the virtualizer instead of mounting hidden DOM nodes.

For lower-level control, use APIs such as `prepareWithSegments`, `layoutWithLines`, `measureLineStats`, `walkLineRanges`, `layoutNextLineRange`, and `materializeLineRange` when the component needs custom segmentation, incremental line layout, or manual rendering.

For rich inline text, inspect `@chenglou/pretext/rich-inline` and keep spans/segments explicit rather than trying to infer style from rendered DOM.

## Verification

- Compare a few representative strings against the rendered browser result, including long words, emoji, mixed scripts, newlines, and narrow widths.
- Test resize behavior and font-loading timing.
- Check that the implementation reduces layout reads such as `getBoundingClientRect`, `offsetHeight`, and hidden measurement nodes.
- For virtualized lists, verify scroll position stability when data loads or widths change.

## Caveats

- Pretext is not a full CSS layout engine. It is for text measurement/layout, not arbitrary flex/grid/block layout.
- Browser font rendering, fallback fonts, and international text can still create differences; verify visually when precision matters.
- Do not add global tooling or AgenticSupercharge installer setup for this. It is a normal per-project app dependency.

## Attribution

This skill is original AgenticSupercharge guidance for using Cheng Lou's MIT-licensed `@chenglou/pretext` library.

- GitHub: https://github.com/chenglou/pretext
- npm package: `@chenglou/pretext`
- Creator credit: Cheng Lou / @_chenglou
