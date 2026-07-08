---
name: fact-checker
description: Check factual claims in writing against credible sources, rate support levels, and suggest safer wording or better citations. Use for blog posts, landing pages, reports, social posts, research summaries, investor materials, SEO content, or any output with claims, stats, studies, or factual assertions.
---

# Fact Checker

Use this skill to separate claims that are supported, weakly supported, misleading, outdated, or unverifiable.

This is an original Overdrive skill inspired by public discussion of claim-checking skills. Do not copy unavailable or non-resolving upstream skill text.

## Claim Categories

Extract and review:

- numerical claims and statistics
- causal claims
- comparative claims
- quotes and attributions
- legal, medical, financial, or safety claims
- product claims and benchmarks
- historical/current-event claims
- source-dependent claims such as "studies show" or "experts say"

Ignore purely subjective opinions unless they are presented as fact.

## Source Hierarchy

Prefer sources in this order:

1. Primary sources, official docs, standards, public filings, datasets, papers, or legal/regulatory text.
2. Reputable secondary sources that cite primary evidence.
3. Established news/research organizations with visible methodology.
4. Company blogs or vendor docs for claims about their own products.
5. Social posts, forums, marketing pages, and unverified blogs only as weak context.

For current, legal, medical, financial, political, market, software-version, or high-stakes claims, use current web/official sources instead of memory.

## Ratings

Use these ratings:

- `TRUE`: directly supported by strong sources.
- `MOSTLY TRUE`: supported with minor caveats or wording issues.
- `MIXED`: partly supported but missing context or overgeneralized.
- `UNSUPPORTED`: plausible but not verified by adequate sources.
- `FALSE`: contradicted by reliable sources.
- `UNVERIFIABLE`: cannot be checked from available evidence.

## Output Contract

Return a table when practical:

| Claim | Rating | Evidence | Safer wording / action |
| --- | --- | --- | --- |

Then provide:

- highest-risk claims
- missing citations
- recommended rewrites
- source list
- remaining uncertainty

## Rewrite Rules

- Preserve the user's intended meaning where possible.
- Replace overconfident claims with scoped, sourced wording.
- Remove unsupported numbers instead of inventing citations.
- Use date-specific wording for time-sensitive facts.
- Do not bury high-risk uncertainty in footnotes.

## Pairings

- Pair with `last30days` for recent events.
- Pair with `reddit-research` when checking community sentiment, but do not treat Reddit as primary evidence.
- Pair with `content-research-writer` for sourced long-form content.
- Pair with `humanizer` only after factual corrections are complete.
