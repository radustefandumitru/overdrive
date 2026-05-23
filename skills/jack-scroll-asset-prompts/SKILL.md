---
name: jack-scroll-asset-prompts
description: >
  Generate coordinated start-frame, end-frame, and video-transition prompts for
  scroll-stopping website assets. Use for assembled-to-exploded product visuals,
  before/after transformations, 3D hero assets, image/video generation prompts,
  Nano Banana, Runway, Kling, Pika, Higgsfield, Veo, or any AI visual workflow
  intended for scroll-driven websites. Public-safe Jack Roberts inspired workflow.
---

# Jack Scroll Asset Prompts

Use this skill to create a coordinated visual prompt set for a scroll-driven website: a clean starting image, a transformed ending image, and a video transition between them.

Source attribution: public-safe synthesis inspired by Jack Roberts' public teaching on AI-generated scroll-stopping website assets. Credit Jack Roberts and link https://www.youtube.com/watch?v=TZUTe7s11-I when referencing the method publicly.

## Core Decision

First decide the asset type:

- Product deconstruction: assembled object -> exploded or deconstructed view.
- Service transformation: before state -> after state.
- Brand metaphor: simple hero symbol -> richer final arrangement.

Use product deconstruction for devices, vehicles, shoes, bags, watches, furniture, packaged goods, and objects with layers/components. Use service transformation for cleaning, renovation, moving, logistics, health, repair, or outcome-driven services.

## Prompt Set

Produce three prompts:

1. Start frame.
   - Single subject, centered, clean background, stable camera angle, premium lighting, generous margins, no text.
   - Preserve real logo/product details only if the user has rights and provided the asset.
   - Use the same aspect ratio intended for the website, usually 16:9 for desktop hero work.

2. End frame.
   - Same subject and camera logic.
   - For products: separated components should remain orderly, readable, and spatially related to the original silhouette.
   - For services: transformed result should be unmistakable but still the same subject.
   - Avoid chaos at the edges; keep enough empty space for cropping and responsive layouts.

3. Transition/video prompt.
   - Describe start frame and end frame precisely.
   - Ask for smooth deliberate motion, consistent lighting, stable background, and readable object silhouette.
   - Include hold moments at start/end so the result can be scrubbed by scroll.
   - Request no text, UI, arrows, labels, watermarks, or unexpected camera movement unless the design brief needs it.

## Quality Rules

- Generate or request multiple candidates when possible. The final scroll section is only as good as the start and end frames.
- Prefer high resolution over speed for final assets. Low-resolution assets become obvious in full-viewport scroll sections.
- Keep backgrounds compatible with the site background so edges disappear in the implementation.
- The start and end images should share angle, lens feel, lighting, and material treatment.
- Do not promise perfect brand accuracy from image models. Verify logos and product details manually.
- Avoid unrealistic internal components unless the user wants a fantastical metaphor. Real products should feel mechanically plausible.

## Output Format

Return:

- a short concept summary
- Prompt A: start frame
- Prompt B: end frame
- Prompt C: transition/video
- optional variants: reverse, loop, slow cinematic, dark-background, white-background
- recommended generation settings: aspect ratio, resolution, number of variations, and asset naming

## Routing

- Use `banana` or native image tools when actually generating images.
- Use `jack-scroll-3d-sites` after the user has a video file or frame sequence.
- Use `fluid-animations` and `emil-animation-polish` when the transition or scrub behavior needs to feel more natural.
- Use `brandkit` or `imagegen-frontend-web` if the brand/visual world is not defined yet.
