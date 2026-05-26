---
name: security-review
description: Use for security reviews, vulnerability audits, hardening passes, auth/authz checks, injection/XSS/RCE/data exposure analysis, supply-chain risk, secrets handling, or "audit this for security issues" requests on agents without Claude Code's bundled /security-review. Prefer Claude Code's official /security-review when available. Report only concrete, high-confidence security findings; avoid generic best-practice noise.
---

# Security Review

Use this portable skill for non-Claude agents when the user asks for a security review, vulnerability audit, hardening pass, or security-focused PR/code review. On Claude Code, prefer the bundled `/security-review` command when it is available.

This skill is adapted from Anthropic's MIT-licensed `anthropics/claude-code-security-review` template for portable AgenticSupercharge runtimes.

## Scope First

1. Determine whether the user wants a diff review, whole-repo audit, file-specific review, or threat-model pass.
2. For diff reviews, compare against the base branch if available.
3. For whole-repo reviews, prioritize entry points, auth boundaries, data flows, server actions/API routes, database access, file operations, secrets handling, and deployment config.
4. Do not perform destructive actions, live exploitation, credential use, account changes, or production probing without explicit approval.

## Review Categories

Look for concrete, exploitable issues in:

- Injection: SQL, NoSQL, shell command, template, XML/XXE, path traversal, unsafe deserialization, YAML/pickle, eval/dynamic code.
- Web security: reflected/stored/DOM XSS, CSRF where relevant, unsafe redirects with real impact, SSRF where host/protocol is attacker-controlled.
- Authentication and authorization: bypasses, privilege escalation, missing server-side checks, session/JWT flaws, tenant isolation breaks.
- Data exposure: sensitive logging, debug information exposure, PII leaks, overly broad API responses, insecure public storage.
- Crypto and secrets: weak crypto, bad randomness, disabled certificate validation, hardcoded credentials, leaked tokens.
- Configuration and deployment: unsafe CORS, public admin/debug surfaces, insecure defaults, missing environment separation.
- Supply chain: suspicious install scripts, unpinned high-risk dependencies, dependency execution paths, untrusted package sources.
- Business logic: purchase, billing, quota, invite, ownership, or workflow bypasses with real user/security impact.

## False-Positive Filter

Report only findings with a credible exploit path and meaningful impact. Skip:

- Style issues, refactors, or general code quality.
- Pure denial-of-service, rate-limit, or resource exhaustion concerns unless the user explicitly asks.
- Theoretical "could be safer" findings without a concrete attacker path.
- Documentation-only issues.
- Test-only code unless tests run privileged production-affecting actions.
- Client-side missing auth checks when the server correctly enforces authorization.
- React/Angular XSS concerns unless unsafe HTML APIs are used.
- Outdated dependency notices unless the task is specifically a dependency/security update.
- Log spoofing or non-sensitive logging.

## Output

Lead with findings, ordered by severity. If there are no concrete issues, say so plainly and name the residual risk or test gaps.

Use this format:

```markdown
## Findings

### High: <short title>
- Location: `path/to/file.ext:line`
- Category: <injection/authz/xss/data-exposure/etc>
- Why it matters: <impact>
- Exploit path: <specific scenario>
- Recommendation: <specific fix>
- Confidence: <0.8-1.0>

## No Findings
No high-confidence security issues found in the reviewed scope. Remaining risk: <limits of review>.
```

## Verification

When practical and safe, verify fixes with tests, targeted static checks, dependency scanners, or minimal local reproduction. Do not invent proof you did not run.

## Attribution

Adapted from Anthropic's MIT-licensed `anthropics/claude-code-security-review` repository: https://github.com/anthropics/claude-code-security-review
