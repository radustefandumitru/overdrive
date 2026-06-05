# Catalog Health

Generated: deterministic report; rerun `npm run analyze:routes` to refresh metrics

This report is produced from local ovd-workflow route traces. It is maintainer infrastructure only: Overdrive does not collect user telemetry.

## Inputs

- Requested paths: `./.overdrive/routes.jsonl`
- Route files found: 1
- Route entries: 9
- Invalid JSONL lines: 0
- No-skill matched rate: 0%
- Scorecard cases recorded: 0

## Most Routed Skills

| Skill | Count |
| --- | --- |
| skill-router | 8 |
| planning-first | 6 |
| superpowers:finishing-a-development-branch | 2 |
| design-taste-frontend | 1 |
| impeccable | 1 |
| liquid-glass-web | 1 |
| superpowers:executing-plans | 1 |
| superpowers:verification-before-completion | 1 |

## Common Skill Pairs

| Pair | Count |
| --- | --- |
| planning-first + skill-router | 5 |
| skill-router + superpowers:finishing-a-development-branch | 2 |
| design-taste-frontend + impeccable | 1 |
| design-taste-frontend + liquid-glass-web | 1 |
| design-taste-frontend + planning-first | 1 |
| impeccable + liquid-glass-web | 1 |
| impeccable + planning-first | 1 |
| liquid-glass-web + planning-first | 1 |
| planning-first + superpowers:executing-plans | 1 |
| planning-first + superpowers:verification-before-completion | 1 |
| skill-router + superpowers:executing-plans | 1 |
| skill-router + superpowers:verification-before-completion | 1 |
| superpowers:executing-plans + superpowers:verification-before-completion | 1 |

## Review Candidates

These are candidates for human review only. Rare route selection is not proof a skill should be removed. At least 20 route entries are required before this script surfaces candidates.

Insufficient route data for candidate surfacing.
