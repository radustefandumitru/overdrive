# v0.6 Router Scorecard

This is the public scorecard template for comparing plain prompts against `skill-router` routed prompts. It is intentionally empty until real blind runs are collected and scored.

Do not claim AgenticSupercharge improves outputs from this file until the table contains real model runs.

## Protocol

1. Pick a case from `evals/router-benchmark.json`.
2. Run `controlPrompt` and `routedPrompt` in separate fresh sessions with the same model, tools, repo state, and time budget.
3. Hide which output is control vs routed when practical.
4. Score each rubric item from 0 to 2.
5. Record totals and notes in `evals/scorecard-results.json`.
6. Rebuild this file with `npm run scorecard`.

## Summary

- Scored cases: 0/21
- Routed wins: 0
- Ties: 0
- Routed losses: 0

## Results

| Case | Category | Expected Skills | Model | Control | Routed | Delta | Notes |
|---|---|---|---|---:|---:|---:|---|
| premium-frontend-landing-page | frontend-design | design-taste-frontend, emil-design-eng, playwright-cli |  |  |  |  |  |
| fluid-mobile-drawer | motion | fluid-animations, emil-design-eng |  |  |  |  |  |
| web-popover-animation-polish | motion | emil-animation-polish, emil-design-eng |  |  |  |  |  |
| multi-file-refactor | planning | planning-first, clarify-and-plan |  |  |  |  |  |
| ambiguous-app-feature | planning | clarify-and-plan, app-onboarding-questionnaire |  |  |  |  |  |
| security-review-pr | security | security-review |  |  |  |  |  |
| recent-react-sentiment | research | last30days |  |  |  |  |  |
| jack-scroll-site-build | premium-sites | jack-premium-site-system, jack-scroll-3d-sites, jack-seo-launch-audit |  |  |  |  |  |
| scroll-asset-prompts | premium-sites | jack-scroll-asset-prompts, banana |  |  |  |  |  |
| launch-readiness-saas | launch | pre-launch-checklist, security-review |  |  |  |  |  |
| human-launch-email | marketing-copy | emails, copywriting, stop-slop |  |  |  |  |  |
| json-canvas-map | knowledge-work | json-canvas |  |  |  |  |  |
| mcp-server-build | agent-infra | mcp-builder, modern-web-guidance |  |  |  |  |  |
| slack-gif | media | slack-gif-creator |  |  |  |  |  |
| complex-product-redesign-with-workflow | multi-phase | clarify-and-plan, planning-first, design-taste-frontend, emil-design-eng, security-review, playwright-cli |  |  |  |  |  |
| react-doctor-code-quality | react | react-doctor |  |  |  |  |  |
| architecture-pressure-test | planning | what-should-i-consider, security-review |  |  |  |  |  |
| media-download-mp3 | utility | media-download |  |  |  |  |  |
| layers-product-orientation | product-design | layers-intro, layers-orient |  |  |  |  |  |
| layers-conceptual-model | product-design | layers-intro, layers-conceptual-model |  |  |  |  |  |
| liquid-glass-web-progressive-enhancement | frontend | liquid-glass-web, emil-animation-polish, playwright-cli |  |  |  |  |  |

## Raw Results Schema

Each entry in `evals/scorecard-results.json` should look like:

```json
{
  "caseId": "case-id-from-router-benchmark",
  "model": "model name and settings",
  "date": "YYYY-MM-DD",
  "controlScore": 0,
  "routedScore": 0,
  "notes": "Short blind-scoring notes and regressions."
}
```

