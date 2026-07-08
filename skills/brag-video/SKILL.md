---
name: brag-video
description: Plan and produce concise product brag/demo videos, launch clips, or social cutdowns from an app, feature, workflow, or release. Use when the user wants a shareable product video, feature teaser, before/after demo, founder update, or launch asset. Inspired by latent-spaces/brag, but rewritten for Overdrive with no raw upstream redistribution.
---

# Brag Video

Use this skill to turn a product, feature, or release into a short video concept that is useful for launch, social proof, product marketing, or internal demos.

This is a planning and production-guidance skill. It does not assume a specific video generator, editor, SaaS, MCP server, or CLI. Use whatever the user has installed and approved.

## Safety And Scope

- Do not copy raw `latent-spaces/brag` files or prompts. The idea is credited, but this skill is Overdrive-authored.
- Do not auto-install Hyperframes, Remotion, ffmpeg, browser automation, image/video generators, or editing tools.
- Do not upload private code, customer data, credentials, unreleased product details, analytics dashboards, or user content to third-party tools without explicit approval.
- Do not make unsupported product claims. If a metric, testimonial, or customer logo is not verified and approved, omit it or mark it as placeholder copy.
- For client or competitor material, avoid impersonation and trademark misuse.

## When To Use

Use `brag-video` when the user asks for:

- a launch video
- a product demo clip
- a feature teaser
- a before/after transformation video
- a social clip for X, LinkedIn, TikTok, YouTube Shorts, or Product Hunt
- a founder/product update video
- a short investor/customer demo sequence

Pair with:

- `launch` for launch strategy and channels
- `claude-video` when the user needs to analyze source footage first
- `media-download` only for authorized media retrieval
- `copywriting` or `humanizer` for captions and narration polish
- `design-taste-frontend`, `impeccable`, or `high-end-visual-design` when the captured UI needs visual cleanup first

## Output Contract

For most requests, produce:

1. **Angle**: one sentence naming the core payoff.
2. **Audience**: who the clip is for and what they should feel/understand.
3. **Format**: aspect ratio, duration, platform, and whether it is screen capture, motion graphics, talking head, or hybrid.
4. **Storyboard**: 5-9 beats with timestamps.
5. **Capture List**: exact screens, interactions, assets, or shots needed.
6. **Script/Copy**: voiceover, captions, overlays, and CTA.
7. **Production Notes**: tool options, animation/motion notes, music/SFX guidance, and fallback path.
8. **Verification**: claims/assets that need approval before publishing.

## Practical Defaults

- Default length: 20-45 seconds.
- Default aspect: 16:9 for product demos, 9:16 for social vertical, 1:1 only when the platform requires it.
- Default pacing: hook in first 2 seconds, one clear product moment by second 8, CTA at the end.
- Prefer real UI/product footage over abstract stock visuals.
- Show the product doing the work, not a long explanation of the product.
- If the product is not visually ready, recommend improving the UI first rather than hiding it with effects.

## Brag Video Pattern

Use this structure unless the user gives a stronger one:

1. **Problem flash**: show the painful old way or outcome.
2. **Switch moment**: introduce the product/feature in one clean sentence.
3. **Proof by motion**: show the actual flow working.
4. **Payoff**: show the result, saved time, better output, or before/after.
5. **Credibility**: optional verified metric, customer, workflow detail, or technical proof.
6. **CTA**: try it, read the release, join waitlist, book demo, or install.

## Production Paths

Choose the lightest path that can hit the quality bar:

- **Storyboard only**: when the user needs planning before capture.
- **Screen-capture plan**: when the UI exists and can be recorded.
- **Motion spec**: when a designer/video tool will execute it.
- **Remotion/web video**: when the repo already uses video-as-code or the user asks for programmable video.
- **Image/video generator prompt pack**: when generated visuals are explicitly wanted and legally safe.

Always ask before running long render jobs, paid APIs, uploads, or third-party generators.

## Checklist Before Final

- Does the first 2 seconds communicate why to care?
- Is the product actually visible?
- Are claims verified?
- Is the CTA specific?
- Are captions readable on mobile?
- Does the clip work muted?
- Are logos, customer names, screenshots, and music rights cleared?
