---
name: reddit-research
description: Use when the user explicitly asks for Reddit/community signal, subreddit research, Reddit sentiment, or public Reddit thread/comment analysis. Uses low-volume public read-only JSON endpoints where available, with clear caveats, no auth, no API keys, no stored credentials, and graceful fallback when Reddit blocks or rate-limits requests.
---

# Reddit Research

Use this for lightweight Reddit/community research when the user mentions Reddit or explicitly wants community signal from Reddit.

This skill is best-effort. Reddit can rate-limit, block, or change unauthenticated JSON behavior. Do not promise complete coverage.

## Use Cases

- "What are people on Reddit saying about X?"
- "Research pain points in r/SaaS / r/ClaudeAI / r/webdev."
- "Summarize this Reddit thread and comments."
- "Find common objections, language, complaints, or feature requests from Reddit."

Pair with `last30days` when the request is about recent/current community sentiment.

## Public Read-Only Endpoints

Use public JSON endpoints only, for low-volume reads:

```text
https://www.reddit.com/r/<subreddit>/search.json?q=<query>&restrict_sr=1&sort=relevance&limit=25&raw_json=1
https://www.reddit.com/r/<subreddit>/new.json?limit=25&raw_json=1
https://www.reddit.com/comments/<post_id>.json?limit=100&raw_json=1
```

Use a descriptive User-Agent if making HTTP requests from scripts:

```text
AgenticSupercharge research helper (local, read-only; contact: user-provided)
```

Do not use credentials, cookies, OAuth tokens, or user sessions unless the user explicitly asks for their own configured tooling and understands the privacy implications.

## Workflow

1. Clarify subreddit/query/time window if missing.
2. Fetch a small number of public results or ask the user to provide exported/search result content if Reddit blocks access.
3. Capture URLs, dates, titles, score/comment count, and representative comments.
4. Synthesize patterns, not just quotes: recurring pain points, language users use, objections, misconceptions, desired outcomes, and outliers.
5. Separate observed community signal from your recommendation.
6. Cite Reddit URLs when used and keep direct quotes short unless the user specifically needs them.

## Safety And Etiquette

- Low volume only. Respect rate limits and back off on `429`, `403`, captcha, or Cloudflare blocks.
- Do not post, vote, comment, message, scrape private content, or bypass access controls.
- Do not collect personal data beyond public usernames/links needed for citation, and avoid unnecessary username lists.
- Treat Reddit as noisy qualitative signal, not statistically representative research.

## Fallbacks

If public JSON fails:

- Ask the user to paste links or exported content.
- Use normal web search for indexed Reddit pages.
- Use `last30days` or broader community research sources.
- Say plainly that Reddit blocked unauthenticated access instead of fabricating findings.

## Attribution

This is an original AgenticSupercharge skill using Reddit's public read-only JSON-style endpoints and Reddit's API documentation as reference. No Reddit code or credentials are bundled.

