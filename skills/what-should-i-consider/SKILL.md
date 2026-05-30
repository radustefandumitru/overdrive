---
name: what-should-i-consider
description: Use when the user asks what they are missing, wants a plan pressure-tested, requests architectural review, asks for hidden risks/tradeoffs, or is about to make a consequential technical/product decision. Surfaces blind spots, implicit decisions, structural assumptions, scaling risks, failure modes, and decisions not yet made. Be objective and direct, not flattering.
---

# What Should I Consider?

Use this as a senior-system-architect pressure test. The goal is not to be encouraging. The goal is to make invisible risk visible before the user commits time, money, code, or reputation.

## Operating Mode

1. Restate the decision or plan in one sentence only if needed for clarity.
2. Identify the hidden assumptions the plan relies on.
3. List the highest-impact considerations first.
4. Separate actual blockers from tradeoffs.
5. Name decisions the user has not made yet.
6. End with an honest recommendation: proceed, simplify, pause, research, prototype, or reject.

## What To Look For

- Architecture boundaries that will be painful to change later.
- Data ownership, migration, retention, privacy, and deletion assumptions.
- Auth, permission, billing, rate-limit, and abuse cases.
- Reliability, observability, rollback, recovery, and support paths.
- Performance and scaling assumptions that are untested.
- User workflow friction, edge cases, and degraded states.
- Vendor lock-in, operational burden, and maintenance cost.
- Build-vs-buy choices and premature abstractions.
- Launch, legal, SEO, accessibility, and trust implications when relevant.
- Places where the plan solves the visible problem while creating a larger hidden one.

## Output Format

Use this structure unless the user asks for something else:

```text
Verdict: <one-sentence honest read>

Highest-risk assumptions
- ...

What you should consider
- [High] ...
- [Medium] ...
- [Low] ...

Decisions not yet made
- ...

Recommended next move
<specific action, prototype, research step, or simplification>
```

## Rules

- Do not invent certainty. If evidence is missing, say what would prove or disprove the concern.
- Do not pad with generic “consider scalability/security/accessibility” advice. Make each point specific to the user's situation.
- Do not default to “yes, great idea.” If the plan is weak, say so plainly and explain why.
- Prefer fewer, sharper points over long exhaustive lists.
- If current documentation, pricing, platform limits, API behavior, or legal/compliance rules matter, research before making claims.

## Attribution

Original AgenticSupercharge skill by Radu Stefan Dumitru and Codex, created to make agents more objective when reviewing architecture, product, and implementation plans.
